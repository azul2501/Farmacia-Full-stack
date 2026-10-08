from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit
from apps.cash.models import CashMovementType, CashSessionStatus
from apps.cash.services import CashService
from apps.core.choices import PaymentCondition, PaymentMethod
from apps.core.permissions import ensure_branch_access
from apps.finance.models import (
    AccountStatus,
    FinancialDirection,
    FinancialMovement,
    FinancialMovementStatus,
    FinancialOrigin,
    PayableAccount,
    PayablePayment,
    ReceivableAccount,
    ReceivableCollection,
)


class FinanceService:
    @staticmethod
    def _status(balance, original):
        if balance == 0:
            return AccountStatus.PAID
        if balance < original:
            return AccountStatus.PARTIAL
        return AccountStatus.PENDING

    @staticmethod
    def _validate_cash_session(*, session, company, branch):
        if session is None:
            raise ValidationError("Una operacion en efectivo requiere una caja abierta.")
        if session.company_id != company.id or session.register.branch_id != branch.id:
            raise ValidationError("La caja no pertenece a la empresa y sucursal de la operacion.")
        if session.status != CashSessionStatus.OPEN:
            raise ValidationError("La caja seleccionada no esta abierta.")

    @classmethod
    @transaction.atomic
    def settle_confirmed_purchase(cls, *, purchase, user):
        ensure_branch_access(user=user, company=purchase.company, branch_id=purchase.branch_id)
        if purchase.payment_condition == PaymentCondition.CREDIT:
            account, _ = PayableAccount.objects.get_or_create(
                company=purchase.company,
                purchase=purchase,
                defaults={
                    "supplier": purchase.supplier,
                    "branch": purchase.branch,
                    "issue_date": purchase.document_date,
                    "due_date": purchase.payment_due_date,
                    "original_amount": purchase.total,
                    "balance": purchase.total,
                    "notes": purchase.notes,
                    "created_by": user,
                },
            )
            return account

        if purchase.payment_method == PaymentMethod.CASH:
            cls._validate_cash_session(
                session=purchase.cash_session,
                company=purchase.company,
                branch=purchase.branch,
            )
        movement = FinancialMovement.objects.create(
            company=purchase.company,
            branch=purchase.branch,
            cash_session=purchase.cash_session,
            date=timezone.localdate(),
            direction=FinancialDirection.OUT,
            origin=FinancialOrigin.PAYABLE_PAYMENT,
            amount=purchase.total,
            method=purchase.payment_method,
            beneficiary_or_source=str(purchase.supplier),
            document_number=purchase.document_number,
            reference=purchase.payment_reference,
            description="Compra al contado",
            source_type="purchases.purchase",
            source_id=purchase.id,
            created_by=user,
        )
        if purchase.payment_method == PaymentMethod.CASH:
            CashService.record_movement(
                session_id=purchase.cash_session_id,
                company=purchase.company,
                user=user,
                movement_type=CashMovementType.PAYABLE_PAYMENT,
                amount=purchase.total,
                reason=f"Compra {purchase.document_number}",
                reference=("finance.financialmovement", movement.id),
            )
        record_audit(
            company=purchase.company,
            actor=user,
            action="purchase.payment_recorded",
            resource=movement,
            payload={"amount": str(purchase.total), "method": purchase.payment_method},
        )
        return movement

    @staticmethod
    @transaction.atomic
    def create_receivable_for_sale(*, sale, user):
        if sale.balance_due <= 0:
            return None
        account, _ = ReceivableAccount.objects.get_or_create(
            company=sale.company,
            sale=sale,
            defaults={
                "customer": sale.customer,
                "branch": sale.branch,
                "issue_date": sale.sold_at.date(),
                "due_date": sale.payment_due_date,
                "original_amount": sale.total,
                "collected_amount": sale.amount_paid,
                "balance": sale.balance_due,
                "status": AccountStatus.PARTIAL if sale.amount_paid else AccountStatus.PENDING,
                "created_by": user,
            },
        )
        return account

    @classmethod
    @transaction.atomic
    def register_payable_payment(
        cls,
        *,
        account_id,
        company,
        user,
        amount,
        date,
        method,
        idempotency_key,
        cash_session=None,
        reference="",
        operation_number="",
        notes="",
    ):
        existing = PayablePayment.objects.filter(company=company, idempotency_key=idempotency_key).first()
        if existing:
            return existing, False
        account = (
            PayableAccount.objects.select_for_update()
            .select_related("branch", "supplier")
            .get(id=account_id, company=company)
        )
        ensure_branch_access(user=user, company=company, branch_id=account.branch_id)
        if account.status == AccountStatus.CANCELLED or amount <= 0 or amount > account.balance:
            raise ValidationError("El monto no es valido para el saldo pendiente.")
        if method == PaymentMethod.CASH:
            cls._validate_cash_session(session=cash_session, company=company, branch=account.branch)
        elif cash_session is not None:
            raise ValidationError("Solo una operacion en efectivo puede asociarse a una caja.")
        payment = PayablePayment.objects.create(
            company=company,
            account=account,
            date=date,
            amount=amount,
            method=method,
            cash_session=cash_session,
            reference=reference,
            operation_number=operation_number,
            notes=notes,
            idempotency_key=idempotency_key,
            performed_by=user,
        )
        account.paid_amount += amount
        account.balance -= amount
        account.status = cls._status(account.balance, account.original_amount)
        account.save(update_fields=["paid_amount", "balance", "status", "updated_at"])
        movement = FinancialMovement.objects.create(
            company=company,
            branch=account.branch,
            cash_session=payment.cash_session,
            date=date,
            direction=FinancialDirection.OUT,
            origin=FinancialOrigin.PAYABLE_PAYMENT,
            amount=amount,
            method=method,
            beneficiary_or_source=str(account.supplier),
            reference=reference or operation_number,
            description=notes,
            source_type="finance.payablepayment",
            source_id=payment.id,
            created_by=user,
        )
        if method == PaymentMethod.CASH:
            CashService.record_movement(
                session_id=cash_session.id,
                company=company,
                user=user,
                movement_type=CashMovementType.PAYABLE_PAYMENT,
                amount=amount,
                reason=f"Pago CxP {account.purchase.document_number}",
                reference=("finance.financialmovement", movement.id),
            )
        record_audit(company=company, actor=user, action="payable.payment_recorded", resource=payment)
        return payment, True

    @classmethod
    @transaction.atomic
    def register_receivable_collection(
        cls,
        *,
        account_id,
        company,
        user,
        amount,
        date,
        method,
        idempotency_key,
        cash_session=None,
        reference="",
        operation_number="",
        notes="",
    ):
        existing = ReceivableCollection.objects.filter(company=company, idempotency_key=idempotency_key).first()
        if existing:
            return existing, False
        account = (
            ReceivableAccount.objects.select_for_update()
            .select_related("branch", "customer", "sale")
            .get(id=account_id, company=company)
        )
        ensure_branch_access(user=user, company=company, branch_id=account.branch_id)
        if account.status == AccountStatus.CANCELLED or amount <= 0 or amount > account.balance:
            raise ValidationError("El monto no es valido para el saldo pendiente.")
        if method == PaymentMethod.CASH:
            cls._validate_cash_session(session=cash_session, company=company, branch=account.branch)
        elif cash_session is not None:
            raise ValidationError("Solo una operacion en efectivo puede asociarse a una caja.")
        collection = ReceivableCollection.objects.create(
            company=company,
            account=account,
            date=date,
            amount=amount,
            method=method,
            cash_session=cash_session,
            reference=reference,
            operation_number=operation_number,
            notes=notes,
            idempotency_key=idempotency_key,
            performed_by=user,
        )
        account.collected_amount += amount
        account.balance -= amount
        account.status = cls._status(account.balance, account.original_amount)
        account.save(update_fields=["collected_amount", "balance", "status", "updated_at"])
        account.sale.amount_paid += amount
        account.sale.balance_due -= amount
        account.sale.save(update_fields=["amount_paid", "balance_due", "updated_at"])
        movement = FinancialMovement.objects.create(
            company=company,
            branch=account.branch,
            cash_session=collection.cash_session,
            date=date,
            direction=FinancialDirection.IN,
            origin=FinancialOrigin.RECEIVABLE_COLLECTION,
            amount=amount,
            method=method,
            beneficiary_or_source=str(account.customer),
            reference=reference or operation_number,
            description=notes,
            source_type="finance.receivablecollection",
            source_id=collection.id,
            created_by=user,
        )
        if method == PaymentMethod.CASH:
            CashService.record_movement(
                session_id=cash_session.id,
                company=company,
                user=user,
                movement_type=CashMovementType.RECEIVABLE_COLLECTION,
                amount=amount,
                reason=f"Cobro CxC {account.sale.number}",
                reference=("finance.financialmovement", movement.id),
            )
        record_audit(company=company, actor=user, action="receivable.collection_recorded", resource=collection)
        return collection, True

    @classmethod
    @transaction.atomic
    def record_manual_movement(
        cls,
        *,
        company,
        branch,
        user,
        category,
        date,
        amount,
        method,
        origin,
        cash_session=None,
        beneficiary_or_source="",
        document_number="",
        reference="",
        description="",
        attachment=None,
    ):
        if amount <= 0:
            raise ValidationError("El monto debe ser mayor que cero.")
        ensure_branch_access(user=user, company=company, branch_id=branch.id)
        expected_type = "EXPENSE" if origin == FinancialOrigin.EXPENSE else "INCOME"
        if category.company_id != company.id or category.category_type != expected_type:
            raise ValidationError("La categoria no corresponde al tipo de movimiento.")
        direction = FinancialDirection.OUT if origin == FinancialOrigin.EXPENSE else FinancialDirection.IN
        if method == PaymentMethod.CASH:
            cls._validate_cash_session(session=cash_session, company=company, branch=branch)
        elif cash_session is not None:
            raise ValidationError("Solo una operacion en efectivo puede asociarse a una caja.")
        movement = FinancialMovement.objects.create(
            company=company,
            branch=branch,
            cash_session=cash_session,
            category=category,
            date=date,
            direction=direction,
            origin=origin,
            amount=amount,
            method=method,
            beneficiary_or_source=beneficiary_or_source,
            document_number=document_number,
            reference=reference,
            description=description,
            attachment=attachment,
            source_type="finance.manual",
            created_by=user,
        )
        if method == PaymentMethod.CASH:
            CashService.record_movement(
                session_id=cash_session.id,
                company=company,
                user=user,
                movement_type=(
                    CashMovementType.EXPENSE
                    if origin == FinancialOrigin.EXPENSE
                    else CashMovementType.ADDITIONAL_INCOME
                ),
                amount=amount,
                reason=description or category.name,
                reference=("finance.financialmovement", movement.id),
            )
        record_audit(company=company, actor=user, action=f"financial.{origin.lower()}.recorded", resource=movement)
        return movement

    @classmethod
    @transaction.atomic
    def void_manual_movement(cls, *, movement_id, company, user, reason):
        movement = (
            FinancialMovement.objects.select_for_update()
            .select_related("branch", "cash_session")
            .get(id=movement_id, company=company)
        )
        ensure_branch_access(user=user, company=company, branch_id=movement.branch_id)
        if movement.status != FinancialMovementStatus.ACTIVE:
            raise ValidationError("El movimiento ya fue anulado.")
        if movement.origin not in {FinancialOrigin.EXPENSE, FinancialOrigin.ADDITIONAL_INCOME}:
            raise ValidationError("Solo los movimientos manuales pueden anularse desde este modulo.")
        if movement.method == PaymentMethod.CASH:
            cls._validate_cash_session(session=movement.cash_session, company=company, branch=movement.branch)
            CashService.record_movement(
                session_id=movement.cash_session_id,
                company=company,
                user=user,
                movement_type=(
                    CashMovementType.MANUAL_IN
                    if movement.origin == FinancialOrigin.EXPENSE
                    else CashMovementType.WITHDRAWAL
                ),
                amount=movement.amount,
                reason=f"Anulacion: {reason}",
                reference=("finance.financialmovement", movement.id),
            )
        movement.status = FinancialMovementStatus.VOID
        movement.voided_by = user
        movement.voided_at = timezone.now()
        movement.void_reason = reason
        movement.save(update_fields=["status", "voided_by", "voided_at", "void_reason", "updated_at"])
        record_audit(company=company, actor=user, action="financial.movement_voided", resource=movement)
        return movement
