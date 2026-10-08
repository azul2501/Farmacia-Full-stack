from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.audit.services import record_audit
from apps.cash.models import CashMovementType, CashSession, CashSessionStatus
from apps.cash.services import CashService
from apps.catalog.models import ProductVariant
from apps.core.choices import PaymentCondition, PaymentMethod
from apps.core.permissions import ensure_branch_access
from apps.inventory.models import Lot, MovementType, Stock
from apps.inventory.services import InventoryService, MovementCommand
from apps.sales.models import (
    DocumentSequence,
    Sale,
    SaleItem,
    SalePayment,
    SaleStatus,
)


@dataclass(frozen=True)
class SaleLineInput:
    variant_id: object
    quantity: Decimal
    discount: Decimal
    unit_price: Decimal | None = None
    lot_id: object | None = None
    discount_reason: str = ""


@dataclass(frozen=True)
class PaymentInput:
    method: str
    amount: Decimal
    received_amount: Decimal | None = None
    reference: str = ""


class SaleService:
    MONEY = Decimal("0.01")
    IGV_RATE = Decimal("0.18")

    @staticmethod
    def _next_number(company, branch):
        sequence, _ = DocumentSequence.objects.select_for_update().get_or_create(
            company=company,
            branch=branch,
            document_type="SALE_NOTE",
            defaults={"prefix": f"NV-{branch.code[:4].upper()}"},
        )
        sequence.current_number += 1
        sequence.save(update_fields=["current_number", "updated_at"])
        return f"{sequence.prefix}-{sequence.current_number:08d}"

    @staticmethod
    def _allocate_lots(*, company, warehouse, variant, quantity, lot_id=None):
        """Devuelve [(lote, cantidad)] aplicando FEFO; un lote explicito debe estar vigente."""
        today = timezone.localdate()
        if lot_id:
            lot = Lot.objects.get(id=lot_id, company=company, variant=variant, is_blocked=False)
            if lot.expiry_date and lot.expiry_date < today:
                raise ValidationError("El lote seleccionado esta vencido.")
            stock = Stock.objects.select_for_update().get(
                company=company, warehouse=warehouse, variant=variant, lot=lot
            )
            if stock.available_quantity < quantity:
                raise ValidationError("Stock insuficiente en el lote seleccionado.")
            return [(lot, quantity)]
        if not variant.product.requires_lot:
            return [(None, quantity)]

        candidates = (
            Stock.objects.select_for_update()
            .select_related("lot")
            .filter(
                company=company,
                warehouse=warehouse,
                variant=variant,
                lot__is_blocked=False,
                quantity__gt=0,
            )
            .order_by(F("lot__expiry_date").asc(nulls_last=True), "lot__created_at")
        )
        allocations = []
        remaining = quantity
        for stock in candidates:
            if stock.lot.expiry_date and stock.lot.expiry_date < today:
                continue
            take = min(stock.available_quantity, remaining)
            if take <= 0:
                continue
            allocations.append((stock.lot, take))
            remaining -= take
            if remaining <= 0:
                return allocations
        raise ValidationError("No existe stock vigente suficiente en los lotes disponibles.")

    @classmethod
    def _split_line(cls, *, allocations, official_price, discount, taxed):
        """Reparte el descuento de una linea entre sus lotes; el ultimo absorbe el redondeo."""
        total_quantity = sum((qty for _, qty in allocations), Decimal("0"))
        parts = []
        remaining_discount = discount
        for index, (lot, qty) in enumerate(allocations):
            if index == len(allocations) - 1:
                part_discount = remaining_discount
            else:
                part_discount = (discount * qty / total_quantity).quantize(cls.MONEY, rounding=ROUND_HALF_UP)
                remaining_discount -= part_discount
            part_subtotal = (qty * official_price).quantize(cls.MONEY, rounding=ROUND_HALF_UP)
            part_total = (part_subtotal - part_discount).quantize(cls.MONEY, rounding=ROUND_HALF_UP)
            tax_amount = Decimal("0")
            if taxed:
                tax_amount = (part_total * cls.IGV_RATE / (Decimal("1") + cls.IGV_RATE)).quantize(
                    cls.MONEY, rounding=ROUND_HALF_UP
                )
            parts.append((lot, qty, part_discount, part_total, tax_amount))
        return parts

    @classmethod
    @transaction.atomic
    def checkout(
        cls,
        *,
        company,
        branch,
        warehouse,
        terminal,
        cash_session_id,
        user,
        idempotency_key,
        lines,
        payments,
        customer=None,
        payment_condition=PaymentCondition.CASH,
        payment_due_date=None,
        notes="",
    ):
        existing = Sale.objects.filter(company=company, idempotency_key=idempotency_key).first()
        if existing:
            return existing, False
        if not lines:
            raise ValidationError("La venta debe incluir al menos un producto.")
        if any(entity.company_id != company.id for entity in (branch, warehouse, terminal)):
            raise ValidationError("Sucursal, almacen y terminal deben pertenecer a la empresa.")
        if customer and customer.company_id != company.id:
            raise ValidationError("El cliente no pertenece a la empresa.")
        if warehouse.branch_id != branch.id or terminal.branch_id != branch.id:
            raise ValidationError("Almacen y terminal deben pertenecer a la sucursal seleccionada.")
        ensure_branch_access(user=user, company=company, branch_id=branch.id)

        cash_session = (
            CashSession.objects.select_for_update().select_related("register").get(id=cash_session_id, company=company)
        )
        if cash_session.status != CashSessionStatus.OPEN:
            raise ValidationError("La caja seleccionada no esta abierta.")
        if cash_session.register.branch_id != branch.id:
            raise ValidationError("La caja abierta no pertenece a la sucursal de la venta.")

        normalized_lines = []
        subtotal = Decimal("0")
        discount_total = Decimal("0")
        tax_total = Decimal("0")
        discount_events = []
        for line in lines:
            variant = ProductVariant.objects.select_related("product").get(
                id=line.variant_id, company=company, is_active=True, product__is_active=True
            )
            official_price = variant.base_sale_price.quantize(cls.MONEY, rounding=ROUND_HALF_UP)
            if (
                line.unit_price is not None
                and line.unit_price.quantize(cls.MONEY, rounding=ROUND_HALF_UP) != official_price
            ):
                raise ValidationError("El precio enviado no coincide con el precio oficial vigente.")
            if line.quantity <= 0 or official_price < 0 or line.discount < 0:
                raise ValidationError("Cantidad, precio o descuento invalido.")
            line_subtotal = (line.quantity * official_price).quantize(cls.MONEY, rounding=ROUND_HALF_UP)
            if line.discount > line_subtotal:
                raise ValidationError("El descuento no puede superar el subtotal de la linea.")
            if line.discount > 0:
                from apps.accounts.models import Membership
                from apps.accounts.permissions import permissions_for_role

                membership = Membership.objects.filter(user=user, company=company, is_active=True).first()
                if not user.is_superuser and (
                    membership is None or "sales.discount" not in permissions_for_role(membership.role)
                ):
                    raise ValidationError("El usuario no tiene permiso para aplicar descuentos.")
                if not line.discount_reason.strip():
                    raise ValidationError("Un descuento requiere un motivo de autorizacion.")
            line_total = (line_subtotal - line.discount).quantize(cls.MONEY, rounding=ROUND_HALF_UP)
            if line_total < 0:
                raise ValidationError("El total de una linea no puede ser negativo.")
            allocations = cls._allocate_lots(
                company=company,
                warehouse=warehouse,
                variant=variant,
                quantity=line.quantity,
                lot_id=line.lot_id,
            )
            parts = cls._split_line(
                allocations=allocations,
                official_price=official_price,
                discount=line.discount,
                taxed=variant.product.tax_affectation == variant.product.TaxAffectation.TAXED,
            )
            normalized_lines.append((line, variant, official_price, parts))
            subtotal += line_subtotal
            discount_total += line.discount
            tax_total += sum((part[4] for part in parts), Decimal("0"))
            if line.discount > 0:
                discount_events.append(
                    {
                        "variant_id": str(variant.id),
                        "product": variant.product.commercial_name,
                        "reason": line.discount_reason.strip(),
                        "subtotal": str(line_subtotal),
                        "discount_amount": str(line.discount.quantize(cls.MONEY, rounding=ROUND_HALF_UP)),
                        "discount_percentage": str(
                            (line.discount * Decimal("100") / line_subtotal).quantize(cls.MONEY, rounding=ROUND_HALF_UP)
                            if line_subtotal
                            else Decimal("0")
                        ),
                        "final_value": str(line_total),
                    }
                )

        subtotal = subtotal.quantize(cls.MONEY, rounding=ROUND_HALF_UP)
        discount_total = discount_total.quantize(cls.MONEY, rounding=ROUND_HALF_UP)
        tax_total = tax_total.quantize(cls.MONEY, rounding=ROUND_HALF_UP)
        total = (subtotal - discount_total).quantize(cls.MONEY, rounding=ROUND_HALF_UP)
        if total < 0:
            raise ValidationError("El total de la venta no puede ser negativo.")
        amount_paid = sum((payment.amount for payment in payments), Decimal("0"))
        if amount_paid > total:
            raise ValidationError("La suma de los medios de pago no puede superar el total.")
        if payment_condition == PaymentCondition.CASH and amount_paid != total:
            raise ValidationError("Una venta al contado debe pagarse completamente.")
        if payment_condition == PaymentCondition.CREDIT:
            from apps.accounts.models import Membership
            from apps.accounts.permissions import permissions_for_role

            membership = Membership.objects.filter(user=user, company=company, is_active=True).first()
            if not user.is_superuser and (
                membership is None or "sales.credit" not in permissions_for_role(membership.role)
            ):
                raise ValidationError("El usuario no tiene permiso para registrar ventas a credito.")
            if customer is None:
                raise ValidationError("Una venta a credito requiere un cliente identificado.")
            if payment_due_date is None:
                raise ValidationError("La fecha de vencimiento es obligatoria para ventas a credito.")
        change_total = Decimal("0")
        for payment in payments:
            if payment.amount <= 0:
                raise ValidationError("Cada pago debe ser mayor que cero.")
            if payment.method == PaymentMethod.CASH:
                received = payment.amount if payment.received_amount is None else payment.received_amount
                if received < payment.amount:
                    raise ValidationError("El efectivo recibido es insuficiente.")
                change_total += received - payment.amount

        sale = Sale.objects.create(
            company=company,
            branch=branch,
            warehouse=warehouse,
            terminal=terminal,
            cash_session=cash_session,
            customer=customer,
            number=cls._next_number(company, branch),
            subtotal=subtotal,
            discount_total=discount_total,
            tax_total=tax_total,
            total=total,
            change_total=change_total,
            payment_condition=payment_condition,
            payment_due_date=payment_due_date,
            amount_paid=amount_paid,
            balance_due=total - amount_paid,
            idempotency_key=idempotency_key,
            notes=notes.strip(),
            sold_by=user,
            sold_at=timezone.now(),
        )
        for line, variant, official_price, parts in normalized_lines:
            for lot, quantity, part_discount, part_total, tax_amount in parts:
                SaleItem.objects.create(
                    company=company,
                    sale=sale,
                    variant=variant,
                    lot=lot,
                    quantity=quantity,
                    unit_price=official_price,
                    discount=part_discount,
                    discount_reason=line.discount_reason.strip(),
                    tax_amount=tax_amount,
                    line_total=part_total,
                )
                InventoryService.apply_movement(
                    MovementCommand(
                        company=company,
                        warehouse=warehouse,
                        variant=variant,
                        lot=lot,
                        movement_type=MovementType.SALE_OUT,
                        quantity=quantity,
                        reference_type="sales.sale",
                        reference_id=sale.id,
                        document_number=sale.number,
                        performed_by=user,
                    )
                )

        if discount_events:
            record_audit(
                company=company,
                actor=user,
                action="sale.discount_authorized",
                resource=sale,
                payload={"discounts": discount_events, "final_total": str(total)},
            )

        for payment in payments:
            SalePayment.objects.create(
                company=company,
                sale=sale,
                method=payment.method,
                amount=payment.amount,
                received_amount=payment.received_amount,
                reference=payment.reference,
            )
            if payment.method == PaymentMethod.CASH:
                CashService.record_movement(
                    session_id=cash_session.id,
                    company=company,
                    user=user,
                    movement_type=CashMovementType.CASH_SALE,
                    amount=payment.amount,
                    reason=f"Venta {sale.number}",
                    reference=("sales.sale", sale.id),
                )

        record_audit(
            company=company,
            actor=user,
            action="sale.completed",
            resource=sale,
            payload={"total": str(total), "warehouse_id": str(warehouse.id)},
        )
        if sale.balance_due > 0:
            from apps.finance.services import FinanceService

            FinanceService.create_receivable_for_sale(sale=sale, user=user)
        return sale, True

    @classmethod
    @transaction.atomic
    def cancel(cls, *, sale_id, company, user, reason):
        from apps.finance.models import AccountStatus

        sale = (
            Sale.objects.select_for_update()
            .select_related("cash_session", "branch", "warehouse")
            .get(id=sale_id, company=company)
        )
        ensure_branch_access(user=user, company=company, branch_id=sale.branch_id)
        if sale.status == SaleStatus.CANCELLED:
            raise ValidationError("La venta ya esta anulada.")
        if not reason.strip():
            raise ValidationError("La anulacion requiere un motivo.")

        receivable = getattr(sale, "receivable", None)
        if receivable is not None and receivable.collected_amount > 0:
            raise ValidationError("No se puede anular una venta con cobros ya registrados en su cuenta por cobrar.")

        for item in sale.items.select_related("variant", "lot"):
            InventoryService.apply_movement(
                MovementCommand(
                    company=company,
                    warehouse=sale.warehouse,
                    variant=item.variant,
                    lot=item.lot,
                    movement_type=MovementType.RETURN_IN,
                    quantity=item.quantity,
                    reference_type="sales.sale.cancel",
                    reference_id=sale.id,
                    document_number=sale.number,
                    performed_by=user,
                    reason=f"Anulacion de venta {sale.number}",
                )
            )

        cash_payments = list(sale.payments.filter(method=PaymentMethod.CASH))
        if cash_payments:
            if sale.cash_session.status != CashSessionStatus.OPEN:
                raise ValidationError(
                    "La caja de esta venta ya esta cerrada; no se puede reversar el efectivo automaticamente."
                )
            for payment in cash_payments:
                CashService.record_movement(
                    session_id=sale.cash_session_id,
                    company=company,
                    user=user,
                    movement_type=CashMovementType.REFUND,
                    amount=payment.amount,
                    reason=f"Anulacion de venta {sale.number}: {reason.strip()}",
                    reference=("sales.sale.cancel", sale.id),
                )

        if receivable is not None:
            receivable.status = AccountStatus.CANCELLED
            receivable.balance = Decimal("0")
            receivable.save(update_fields=["status", "balance", "updated_at"])

        sale.status = SaleStatus.CANCELLED
        sale.save(update_fields=["status", "updated_at"])

        record_audit(
            company=company,
            actor=user,
            action="sale.cancelled",
            resource=sale,
            payload={"reason": reason.strip(), "total": str(sale.total)},
        )
        return sale
