from django.conf import settings
from django.db import models

from apps.core.models import CompanyScopedModel


class TransferStatus(models.TextChoices):
    DRAFT = "DRAFT", "Borrador"
    DISPATCHED = "DISPATCHED", "Despachada"
    IN_TRANSIT = "IN_TRANSIT", "En transito"
    RECEIVED = "RECEIVED", "Recibida"
    CANCELLED = "CANCELLED", "Cancelada"


class Transfer(CompanyScopedModel):
    number = models.CharField(max_length=40)
    origin_branch = models.ForeignKey("tenancy.Branch", on_delete=models.PROTECT, related_name="transfers_out")
    origin_warehouse = models.ForeignKey("tenancy.Warehouse", on_delete=models.PROTECT, related_name="transfers_out")
    destination_branch = models.ForeignKey("tenancy.Branch", on_delete=models.PROTECT, related_name="transfers_in")
    destination_warehouse = models.ForeignKey(
        "tenancy.Warehouse", on_delete=models.PROTECT, related_name="transfers_in"
    )
    status = models.CharField(max_length=16, choices=TransferStatus.choices, default=TransferStatus.DRAFT)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="transfers_created")
    dispatched_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="transfers_dispatched",
    )
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="transfers_received",
    )
    dispatched_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="uq_transfer_company_number"),
            models.CheckConstraint(
                condition=~models.Q(origin_warehouse=models.F("destination_warehouse")),
                name="ck_transfer_different_warehouses",
            ),
        ]
        indexes = [models.Index(fields=["company", "status", "created_at"])]


class TransferItem(CompanyScopedModel):
    transfer = models.ForeignKey(Transfer, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.PROTECT)
    lot = models.ForeignKey("inventory.Lot", null=True, blank=True, on_delete=models.PROTECT)
    requested_quantity = models.DecimalField(max_digits=16, decimal_places=3)
    dispatched_quantity = models.DecimalField(max_digits=16, decimal_places=3, default=0)
    received_quantity = models.DecimalField(max_digits=16, decimal_places=3, default=0)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(requested_quantity__gt=0),
                name="ck_transfer_item_requested_gt_zero",
            ),
            models.CheckConstraint(
                condition=models.Q(dispatched_quantity__gte=0),
                name="ck_transfer_item_dispatched_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(received_quantity__gte=0),
                name="ck_transfer_item_received_non_negative",
            ),
        ]


class TransferReceipt(CompanyScopedModel):
    transfer = models.ForeignKey(Transfer, on_delete=models.PROTECT, related_name="receipts")
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="transfer_receipts"
    )
    received_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["received_at", "created_at"]
        indexes = [models.Index(fields=["company", "transfer", "received_at"], name="transfer_receipt_scope_idx")]


class TransferReceiptItem(CompanyScopedModel):
    receipt = models.ForeignKey(TransferReceipt, on_delete=models.PROTECT, related_name="items")
    transfer_item = models.ForeignKey(TransferItem, on_delete=models.PROTECT, related_name="receipt_items")
    expected_quantity = models.DecimalField(max_digits=16, decimal_places=3)
    received_quantity = models.DecimalField(max_digits=16, decimal_places=3)
    difference_quantity = models.DecimalField(max_digits=16, decimal_places=3)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(expected_quantity__gt=0), name="ck_transfer_receipt_expected_gt_zero"
            ),
            models.CheckConstraint(
                condition=models.Q(received_quantity__gt=0), name="ck_transfer_receipt_received_gt_zero"
            ),
            models.CheckConstraint(
                condition=models.Q(difference_quantity__gte=0), name="ck_transfer_receipt_difference_non_negative"
            ),
        ]
