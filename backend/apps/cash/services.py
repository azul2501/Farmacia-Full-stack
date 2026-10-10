from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit
from apps.cash.models import (
    CashCount,
    CashCountType,
    CashMovement,
    CashMovementType,
    CashRegister,
    CashSession,
    CashSessionStatus,
)
from apps.core.permissions import ensure_branch_access

INBOUND_MOVEMENTS = {
    CashMovementType.OPENING,
    CashMovementType.CASH_SALE,
    CashMovementType.MANUAL_IN,
    CashMovementType.RECEIVABLE_COLLECTION,
    CashMovementType.ADDITIONAL_INCOME,
    CashMovementType.CONTRIBUTION,
}


class CashService:
    @staticmethod
    @transaction.atomic
    def open_session(*, company, register_id, user, opening_amount, notes=""):
        register = CashRegister.objects.select_for_update().get(id=register_id, company=company, is_active=True)
        ensure_branch_access(user=user, company=company, branch_id=register.branch_id)
        if CashSession.objects.filter(
            register=register, status__in=[CashSessionStatus.OPEN, CashSessionStatus.CLOSING]
        ).exists():
            raise ValidationError("La caja ya tiene una sesión activa.")
        if opening_amount < 0:
            raise ValidationError("El monto inicial no puede ser negativo.")

        session = CashSession.objects.create(
            company=company,
            register=register,
            opened_by=user,
            status=CashSessionStatus.OPEN,
            opening_amount=opening_amount,
            expected_cash=opening_amount,
            opened_at=timezone.now(),
            notes=notes,
        )
        if opening_amount > 0:
            CashMovement.objects.create(
                company=company,
                session=session,
                movement_type=CashMovementType.OPENING,
                amount=opening_amount,
                reason="Monto inicial",
                performed_by=user,
            )
        record_audit(company=company, actor=user, action="cash.opened", resource=session)
        return session

    @staticmethod
    @transaction.atomic
    def record_movement(*, session_id, company, user, movement_type, amount, reason, reference=None):
        session = CashSession.objects.select_for_update().get(id=session_id, company=company)
        ensure_branch_access(user=user, company=company, branch_id=session.register.branch_id)
        if session.status != CashSessionStatus.OPEN:
            raise ValidationError("La caja no esta abierta.")
        if amount <= 0:
            raise ValidationError("El monto debe ser mayor que cero.")
        movement = CashMovement.objects.create(
            company=company,
            session=session,
            movement_type=movement_type,
            amount=amount,
            reason=reason,
            performed_by=user,
            reference_type=reference[0] if reference else "",
            reference_id=reference[1] if reference else None,
        )
        signed_amount = amount if movement_type in INBOUND_MOVEMENTS else -amount
        session.expected_cash += signed_amount
        if session.expected_cash < 0:
            raise ValidationError("El movimiento dejaria la caja con efectivo esperado negativo.")
        session.save(update_fields=["expected_cash", "updated_at"])
        return movement

    @staticmethod
    @transaction.atomic
    def close_session(*, session_id, company, user, counted_cash, notes=""):
        session = CashSession.objects.select_for_update().get(id=session_id, company=company)
        ensure_branch_access(user=user, company=company, branch_id=session.register.branch_id)
        if session.status != CashSessionStatus.OPEN:
            raise ValidationError("La caja no esta abierta.")
        if counted_cash < 0:
            raise ValidationError("El efectivo contado no puede ser negativo.")
        difference = counted_cash - session.expected_cash
        if difference != Decimal("0") and not notes.strip():
            raise ValidationError("Un cierre con diferencia requiere una observación.")
        breakdown = CashService.expected_breakdown(session=session)
        final_count = CashCount.objects.create(
            company=company,
            session=session,
            count_type=CashCountType.FINAL,
            expected_breakdown={key: str(value) for key, value in breakdown.items()},
            counted_breakdown={"cash": str(counted_cash)},
            expected_cash=session.expected_cash,
            counted_cash=counted_cash,
            difference=difference,
            observation=notes,
            performed_by=user,
        )
        record_audit(company=company, actor=user, action="cash.counted", resource=final_count)
        session.counted_cash = counted_cash
        session.difference = difference
        session.closed_by = user
        session.closed_at = timezone.now()
        session.notes = "\n".join(filter(None, [session.notes, notes]))
        session.status = (
            CashSessionStatus.CLOSED if difference == Decimal("0") else CashSessionStatus.CLOSED_WITH_DIFFERENCE
        )
        session.save(
            update_fields=["counted_cash", "difference", "closed_by", "closed_at", "notes", "status", "updated_at"]
        )
        record_audit(
            company=company,
            actor=user,
            action="cash.closed",
            resource=session,
            payload={
                "expected": str(session.expected_cash),
                "counted": str(counted_cash),
                "difference": str(difference),
            },
        )
        return session

    @staticmethod
    def expected_breakdown(*, session):
        from apps.core.choices import PaymentMethod
        from apps.finance.models import FinancialDirection, FinancialMovement, FinancialMovementStatus
        from apps.sales.models import SalePayment, SaleStatus

        breakdown = {
            "opening": session.opening_amount,
            "cash_sales": Decimal("0"),
            "yape_sales": Decimal("0"),
            "plin_sales": Decimal("0"),
            "card_sales": Decimal("0"),
            "transfer_sales": Decimal("0"),
            "receivable_collections": Decimal("0"),
            "payable_payments": Decimal("0"),
            "expenses": Decimal("0"),
            "additional_income": Decimal("0"),
            "withdrawals": Decimal("0"),
            "contributions": Decimal("0"),
            "refunds": Decimal("0"),
        }
        movement_map = {
            CashMovementType.CASH_SALE: ("cash_sales", 1),
            CashMovementType.RECEIVABLE_COLLECTION: ("receivable_collections", 1),
            CashMovementType.PAYABLE_PAYMENT: ("payable_payments", -1),
            CashMovementType.EXPENSE: ("expenses", -1),
            CashMovementType.ADDITIONAL_INCOME: ("additional_income", 1),
            CashMovementType.WITHDRAWAL: ("withdrawals", -1),
            CashMovementType.CONTRIBUTION: ("contributions", 1),
            CashMovementType.REFUND: ("refunds", -1),
            CashMovementType.MANUAL_IN: ("additional_income", 1),
        }
        for movement in session.movements.exclude(movement_type=CashMovementType.OPENING):
            target = movement_map.get(movement.movement_type)
            if target:
                breakdown[target[0]] += movement.amount * target[1]

        payment_keys = {
            PaymentMethod.YAPE: "yape_sales",
            PaymentMethod.PLIN: "plin_sales",
            PaymentMethod.CARD: "card_sales",
            PaymentMethod.TRANSFER: "transfer_sales",
        }
        for payment in (
            SalePayment.objects.filter(sale__cash_session=session)
            .exclude(method=PaymentMethod.CASH)
            .exclude(sale__status=SaleStatus.CANCELLED)
        ):
            breakdown[payment_keys[payment.method]] += payment.amount

        # Non-cash finance movements remain visible without affecting expected cash.
        noncash = FinancialMovement.objects.filter(
            company=session.company,
            cash_session=session,
            status=FinancialMovementStatus.ACTIVE,
        ).exclude(method=PaymentMethod.CASH)
        for movement in noncash:
            key = f"finance_{movement.method.lower()}"
            signed = movement.amount if movement.direction == FinancialDirection.IN else -movement.amount
            breakdown[key] = breakdown.get(key, Decimal("0")) + signed
        return breakdown

    @classmethod
    @transaction.atomic
    def create_count(
        cls,
        *,
        session_id,
        company,
        user,
        count_type,
        counted_cash,
        counted_breakdown=None,
        observation="",
    ):
        session = (
            CashSession.objects.select_for_update()
            .select_related("register__branch")
            .get(id=session_id, company=company)
        )
        if session.status != CashSessionStatus.OPEN:
            raise ValidationError("Solo se puede arquear una caja abierta.")
        ensure_branch_access(user=user, company=company, branch_id=session.register.branch_id)
        if counted_cash < 0:
            raise ValidationError("El efectivo contado no puede ser negativo.")
        expected = cls.expected_breakdown(session=session)
        difference = counted_cash - session.expected_cash
        if count_type == CashCountType.FINAL and difference != Decimal("0") and not observation.strip():
            raise ValidationError("Un arqueo final con diferencia requiere observación.")
        count = CashCount.objects.create(
            company=company,
            session=session,
            count_type=count_type,
            expected_breakdown={key: str(value) for key, value in expected.items()},
            counted_breakdown={key: str(value) for key, value in (counted_breakdown or {}).items()},
            expected_cash=session.expected_cash,
            counted_cash=counted_cash,
            difference=difference,
            observation=observation,
            performed_by=user,
        )
        record_audit(company=company, actor=user, action="cash.counted", resource=count)
        return count
