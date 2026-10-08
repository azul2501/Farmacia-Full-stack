from django.conf import settings
from django.db import models

from apps.core.models import CompanyScopedModel


class Lot(CompanyScopedModel):
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.PROTECT, related_name="lots")
    batch_number = models.CharField(max_length=80)
    expiry_date = models.DateField(null=True, blank=True)
    is_blocked = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "variant", "batch_number", "expiry_date"],
                name="uq_lot_company_variant_batch_expiry",
                nulls_distinct=False,
            )
        ]
        indexes = [models.Index(fields=["company", "expiry_date", "is_blocked"])]

    def __str__(self):
        return f"{self.variant} / {self.batch_number}"


class Stock(CompanyScopedModel):
    warehouse = models.ForeignKey("tenancy.Warehouse", on_delete=models.PROTECT, related_name="stocks")
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.PROTECT, related_name="stocks")
    lot = models.ForeignKey(Lot, null=True, blank=True, on_delete=models.PROTECT, related_name="stocks")
    quantity = models.DecimalField(max_digits=16, decimal_places=3, default=0)
    reserved_quantity = models.DecimalField(max_digits=16, decimal_places=3, default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "warehouse", "variant", "lot"],
                name="uq_stock_company_warehouse_variant_lot",
                nulls_distinct=False,
            ),
            models.CheckConstraint(condition=models.Q(quantity__gte=0), name="ck_stock_non_negative"),
            models.CheckConstraint(condition=models.Q(reserved_quantity__gte=0), name="ck_stock_reserved_non_negative"),
        ]
        indexes = [
            models.Index(fields=["company", "warehouse", "variant"]),
            models.Index(fields=["company", "warehouse", "quantity"]),
        ]

    @property
    def available_quantity(self):
        return self.quantity - self.reserved_quantity


class MovementType(models.TextChoices):
    PURCHASE_IN = "PURCHASE_IN", "Ingreso por compra"
    SALE_OUT = "SALE_OUT", "Salida por venta"
    TRANSFER_OUT = "TRANSFER_OUT", "Salida por transferencia"
    TRANSFER_IN = "TRANSFER_IN", "Ingreso por transferencia"
    ADJUSTMENT_IN = "ADJUSTMENT_IN", "Ajuste positivo"
    ADJUSTMENT_OUT = "ADJUSTMENT_OUT", "Ajuste negativo"
    RETURN_IN = "RETURN_IN", "Ingreso por devolucion"


class InventoryMovement(CompanyScopedModel):
    warehouse = models.ForeignKey("tenancy.Warehouse", on_delete=models.PROTECT, related_name="inventory_movements")
    counterpart_warehouse = models.ForeignKey(
        "tenancy.Warehouse", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.PROTECT)
    lot = models.ForeignKey(Lot, null=True, blank=True, on_delete=models.PROTECT)
    movement_type = models.CharField(max_length=24, choices=MovementType.choices)
    quantity = models.DecimalField(max_digits=16, decimal_places=3)
    balance_after = models.DecimalField(max_digits=16, decimal_places=3)
    unit_cost = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    reference_type = models.CharField(max_length=60)
    reference_id = models.UUIDField()
    document_number = models.CharField(max_length=80, blank=True)
    reason = models.CharField(max_length=240, blank=True)
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["company", "warehouse", "variant", "created_at"]),
            models.Index(fields=["company", "reference_type", "reference_id"]),
        ]
