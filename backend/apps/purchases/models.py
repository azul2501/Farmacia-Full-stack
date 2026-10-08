from django.conf import settings
from django.db import models

from apps.core.choices import PaymentCondition, PaymentMethod
from apps.core.models import CompanyScopedModel


class PurchaseStatus(models.TextChoices):
    DRAFT = "DRAFT", "Borrador"
    CONFIRMED = "CONFIRMED", "Confirmada"
    CANCELLED = "CANCELLED", "Cancelada"


class Purchase(CompanyScopedModel):
    supplier = models.ForeignKey("catalog.Supplier", on_delete=models.PROTECT, related_name="purchases")
    branch = models.ForeignKey("tenancy.Branch", on_delete=models.PROTECT, related_name="purchases")
    destination_warehouse = models.ForeignKey("tenancy.Warehouse", on_delete=models.PROTECT, related_name="purchases")
    document_type = models.CharField(max_length=24)
    document_number = models.CharField(max_length=80)
    document_date = models.DateField()
    payment_condition = models.CharField(max_length=16, choices=PaymentCondition.choices, default=PaymentCondition.CASH)
    payment_due_date = models.DateField(null=True, blank=True)
    payment_method = models.CharField(max_length=16, choices=PaymentMethod.choices, blank=True)
    cash_session = models.ForeignKey(
        "cash.CashSession", null=True, blank=True, on_delete=models.PROTECT, related_name="purchases_paid"
    )
    payment_reference = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=16, choices=PurchaseStatus.choices, default=PurchaseStatus.DRAFT)
    subtotal = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="purchases_created")
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="purchases_received",
    )
    received_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "supplier", "document_type", "document_number"],
                name="uq_purchase_company_supplier_document",
            )
        ]
        indexes = [models.Index(fields=["company", "status", "document_date"])]


class PurchaseItem(CompanyScopedModel):
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=16, decimal_places=3)
    pack_quantity = models.DecimalField(max_digits=16, decimal_places=3, default=1)
    purchase_pack_price = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    purchase_factor = models.DecimalField(max_digits=12, decimal_places=4, default=1)
    unit_cost = models.DecimalField(max_digits=14, decimal_places=4)
    discount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=16, decimal_places=2)
    batch_number = models.CharField(max_length=80, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    lot = models.ForeignKey("inventory.Lot", null=True, blank=True, on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name="ck_purchase_item_quantity_gt_zero"),
            models.CheckConstraint(condition=models.Q(unit_cost__gte=0), name="ck_purchase_item_cost_non_negative"),
            models.CheckConstraint(condition=models.Q(pack_quantity__gt=0), name="ck_purchase_pack_quantity_gt_zero"),
            models.CheckConstraint(condition=models.Q(purchase_factor__gt=0), name="ck_purchase_factor_gt_zero"),
            models.CheckConstraint(
                condition=models.Q(purchase_pack_price__gte=0), name="ck_purchase_pack_price_non_negative"
            ),
        ]
