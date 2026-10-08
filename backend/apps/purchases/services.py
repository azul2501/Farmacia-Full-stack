from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit
from apps.core.permissions import ensure_resource_access
from apps.inventory.models import Lot, MovementType
from apps.inventory.services import InventoryService, MovementCommand
from apps.purchases.models import Purchase, PurchaseStatus
from apps.sales.models import DocumentSequence


class PurchaseService:
    @staticmethod
    def _next_lot_number(company, branch):
        sequence, _ = DocumentSequence.objects.select_for_update().get_or_create(
            company=company,
            branch=branch,
            document_type="LOT",
            defaults={"prefix": f"LOTE-{branch.code[:4].upper()}"},
        )
        sequence.current_number += 1
        sequence.save(update_fields=["current_number", "updated_at"])
        return f"{sequence.prefix}-{sequence.current_number:06d}"

    @staticmethod
    @transaction.atomic
    def receive(*, purchase_id, company, user):
        purchase = (
            Purchase.objects.select_for_update()
            .select_related("destination_warehouse")
            .prefetch_related("items__variant__product")
            .get(id=purchase_id, company=company)
        )
        if purchase.status != PurchaseStatus.DRAFT:
            raise ValidationError("Solo una compra en borrador puede recibirse.")
        ensure_resource_access(user=user, company=company, resource=purchase)
        if not purchase.items.exists():
            raise ValidationError("La compra debe contener al menos un producto.")

        for item in purchase.items.all():
            product = item.variant.product
            lot = None
            if product.requires_lot:
                if product.requires_expiry and not item.expiry_date:
                    raise ValidationError(f"El vencimiento es obligatorio para {product.commercial_name}.")
                batch_number = item.batch_number or PurchaseService._next_lot_number(company, purchase.branch)
                lot, _ = Lot.objects.get_or_create(
                    company=company,
                    variant=item.variant,
                    batch_number=batch_number,
                    expiry_date=item.expiry_date,
                )
                item.batch_number = batch_number
                item.lot = lot
                item.save(update_fields=["batch_number", "lot", "updated_at"])

            InventoryService.apply_movement(
                MovementCommand(
                    company=company,
                    warehouse=purchase.destination_warehouse,
                    variant=item.variant,
                    lot=lot,
                    movement_type=MovementType.PURCHASE_IN,
                    quantity=item.quantity,
                    unit_cost=item.unit_cost,
                    reference_type="purchases.purchase",
                    reference_id=purchase.id,
                    document_number=purchase.document_number,
                    performed_by=user,
                )
            )

        purchase.status = PurchaseStatus.CONFIRMED
        purchase.received_by = user
        purchase.received_at = timezone.now()
        purchase.save(update_fields=["status", "received_by", "received_at", "updated_at"])
        record_audit(
            company=company,
            actor=user,
            action="purchase.received",
            resource=purchase,
            payload={
                "warehouse_id": str(purchase.destination_warehouse_id),
                "total": str(purchase.total),
            },
        )
        from apps.finance.services import FinanceService

        FinanceService.settle_confirmed_purchase(purchase=purchase, user=user)
        return purchase
