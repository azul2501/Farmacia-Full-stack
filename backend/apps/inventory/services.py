from dataclasses import dataclass
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.inventory.models import InventoryMovement, Lot, MovementType, Stock

INBOUND_TYPES = {
    MovementType.PURCHASE_IN,
    MovementType.TRANSFER_IN,
    MovementType.ADJUSTMENT_IN,
    MovementType.RETURN_IN,
}


@dataclass(frozen=True)
class MovementCommand:
    company: object
    warehouse: object
    variant: object
    lot: Lot | None
    movement_type: str
    quantity: Decimal
    reference_type: str
    reference_id: object
    performed_by: object
    counterpart_warehouse: object | None = None
    unit_cost: Decimal | None = None
    document_number: str = ""
    reason: str = ""


class InventoryService:
    @staticmethod
    @transaction.atomic
    def apply_movement(command: MovementCommand) -> InventoryMovement:
        if command.quantity <= 0:
            raise ValidationError("La cantidad debe ser mayor que cero.")
        if command.warehouse.company_id != command.company.id:
            raise ValidationError("El almacen no pertenece a la empresa.")
        if command.variant.company_id != command.company.id:
            raise ValidationError("La presentacion no pertenece a la empresa.")
        if command.lot and command.lot.company_id != command.company.id:
            raise ValidationError("El lote no pertenece a la empresa.")
        if command.lot and command.lot.variant_id != command.variant.id:
            raise ValidationError("El lote no pertenece a la presentacion indicada.")
        if command.counterpart_warehouse and command.counterpart_warehouse.company_id != command.company.id:
            raise ValidationError("El almacen relacionado no pertenece a la empresa.")

        stock = (
            Stock.objects.select_for_update()
            .filter(
                company=command.company,
                warehouse=command.warehouse,
                variant=command.variant,
                lot=command.lot,
            )
            .first()
        )
        if stock is None:
            stock = Stock.objects.create(
                company=command.company,
                warehouse=command.warehouse,
                variant=command.variant,
                lot=command.lot,
                quantity=0,
            )

        signed_quantity = command.quantity if command.movement_type in INBOUND_TYPES else -command.quantity
        new_quantity = stock.quantity + signed_quantity
        if new_quantity < 0:
            raise ValidationError("Stock insuficiente para completar la operacion.")
        stock.quantity = new_quantity
        stock.save(update_fields=["quantity", "updated_at"])

        return InventoryMovement.objects.create(
            company=command.company,
            warehouse=command.warehouse,
            counterpart_warehouse=command.counterpart_warehouse,
            variant=command.variant,
            lot=command.lot,
            movement_type=command.movement_type,
            quantity=signed_quantity,
            balance_after=new_quantity,
            unit_cost=command.unit_cost,
            reference_type=command.reference_type,
            reference_id=command.reference_id,
            document_number=command.document_number,
            reason=command.reason,
            performed_by=command.performed_by,
        )
