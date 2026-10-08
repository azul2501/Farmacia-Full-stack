from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from apps.audit.services import record_audit
from apps.core.permissions import ensure_branch_access
from apps.inventory.models import MovementType
from apps.inventory.services import InventoryService, MovementCommand
from apps.transfers.models import Transfer, TransferReceipt, TransferReceiptItem, TransferStatus


class TransferService:
    @staticmethod
    @transaction.atomic
    def dispatch(*, transfer_id, company, user):
        transfer = (
            Transfer.objects.select_for_update()
            .select_related("origin_warehouse", "destination_warehouse")
            .prefetch_related("items__variant__product", "items__lot")
            .get(id=transfer_id, company=company)
        )
        if transfer.status != TransferStatus.DRAFT:
            raise ValidationError("Solo una transferencia en borrador puede despacharse.")
        ensure_branch_access(user=user, company=company, branch_id=transfer.origin_warehouse.branch_id)
        if not transfer.items.exists():
            raise ValidationError("La transferencia no contiene productos.")

        for item in transfer.items.all():
            InventoryService.apply_movement(
                MovementCommand(
                    company=company,
                    warehouse=transfer.origin_warehouse,
                    counterpart_warehouse=transfer.destination_warehouse,
                    variant=item.variant,
                    lot=item.lot,
                    movement_type=MovementType.TRANSFER_OUT,
                    quantity=item.requested_quantity,
                    reference_type="transfers.transfer",
                    reference_id=transfer.id,
                    document_number=transfer.number,
                    performed_by=user,
                )
            )
            item.dispatched_quantity = item.requested_quantity
            item.save(update_fields=["dispatched_quantity", "updated_at"])

        transfer.status = TransferStatus.DISPATCHED
        transfer.dispatched_by = user
        transfer.dispatched_at = timezone.now()
        transfer.save(update_fields=["status", "dispatched_by", "dispatched_at", "updated_at"])
        record_audit(company=company, actor=user, action="transfer.dispatched", resource=transfer)
        return transfer

    @staticmethod
    @transaction.atomic
    def start_transit(*, transfer_id, company, user):
        transfer = Transfer.objects.select_for_update().get(id=transfer_id, company=company)
        ensure_branch_access(user=user, company=company, branch_id=transfer.origin_branch_id)
        if transfer.status != TransferStatus.DISPATCHED:
            raise ValidationError("Solo una transferencia despachada puede pasar a transito.")
        transfer.status = TransferStatus.IN_TRANSIT
        transfer.save(update_fields=["status", "updated_at"])
        record_audit(company=company, actor=user, action="transfer.in_transit", resource=transfer)
        return transfer

    @staticmethod
    @transaction.atomic
    def receive(*, transfer_id, company, user, received_lines, notes=""):
        transfer = (
            Transfer.objects.select_for_update()
            .select_related("origin_warehouse", "destination_warehouse")
            .prefetch_related("items__variant", "items__lot")
            .get(id=transfer_id, company=company)
        )
        if transfer.status != TransferStatus.IN_TRANSIT:
            raise ValidationError("Solo una transferencia en transito puede recibirse.")
        ensure_branch_access(user=user, company=company, branch_id=transfer.destination_warehouse.branch_id)
        items = {str(item.id): item for item in transfer.items.all()}
        if not received_lines:
            raise ValidationError("Debe indicar al menos una cantidad recibida.")
        if len({str(line["item_id"]) for line in received_lines}) != len(received_lines):
            raise ValidationError("No se puede repetir un detalle en la misma recepcion.")

        receipt = TransferReceipt.objects.create(
            company=company,
            transfer=transfer,
            received_by=user,
            notes=notes,
        )

        for line in received_lines:
            item = items.get(str(line["item_id"]))
            if not item:
                raise ValidationError("Un detalle no pertenece a la transferencia.")
            quantity = line["quantity"]
            pending = item.dispatched_quantity - item.received_quantity
            if quantity <= 0 or quantity > pending:
                raise ValidationError("La cantidad recibida supera la cantidad pendiente.")
            InventoryService.apply_movement(
                MovementCommand(
                    company=company,
                    warehouse=transfer.destination_warehouse,
                    counterpart_warehouse=transfer.origin_warehouse,
                    variant=item.variant,
                    lot=item.lot,
                    movement_type=MovementType.TRANSFER_IN,
                    quantity=quantity,
                    reference_type="transfers.transfer",
                    reference_id=transfer.id,
                    document_number=transfer.number,
                    performed_by=user,
                )
            )
            item.received_quantity += quantity
            item.save(update_fields=["received_quantity", "updated_at"])
            TransferReceiptItem.objects.create(
                company=company,
                receipt=receipt,
                transfer_item=item,
                expected_quantity=pending,
                received_quantity=quantity,
                difference_quantity=pending - quantity,
            )

        all_received = not transfer.items.filter(received_quantity__lt=models.F("dispatched_quantity")).exists()
        if all_received:
            transfer.status = TransferStatus.RECEIVED
            transfer.received_by = user
            transfer.received_at = timezone.now()
            transfer.save(update_fields=["status", "received_by", "received_at", "updated_at"])
        record_audit(
            company=company,
            actor=user,
            action="transfer.received" if all_received else "transfer.partially_received",
            resource=transfer,
            payload={
                "lines": [{"item": str(line["item_id"]), "quantity": str(line["quantity"])} for line in received_lines]
            },
        )
        return transfer

    @staticmethod
    @transaction.atomic
    def cancel(*, transfer_id, company, user):
        transfer = Transfer.objects.select_for_update().get(id=transfer_id, company=company)
        ensure_branch_access(user=user, company=company, branch_id=transfer.origin_branch_id)
        if transfer.status != TransferStatus.DRAFT:
            raise ValidationError("Solo una transferencia en borrador puede cancelarse sin afectar stock.")
        transfer.status = TransferStatus.CANCELLED
        transfer.save(update_fields=["status", "updated_at"])
        record_audit(company=company, actor=user, action="transfer.cancelled", resource=transfer)
        return transfer
