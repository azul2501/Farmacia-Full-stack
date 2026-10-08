from django.conf import settings
from django.db import models

from apps.core.choices import PaymentCondition, PaymentMethod
from apps.core.models import CompanyScopedModel


class DocumentSequence(CompanyScopedModel):
    branch = models.ForeignKey("tenancy.Branch", on_delete=models.PROTECT)
    document_type = models.CharField(max_length=24)
    prefix = models.CharField(max_length=12)
    current_number = models.PositiveBigIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "branch", "document_type"],
                name="uq_sequence_company_branch_type",
            )
        ]


class SaleStatus(models.TextChoices):
    COMPLETED = "COMPLETED", "Completada"
    CANCELLED = "CANCELLED", "Anulada"


class Sale(CompanyScopedModel):
    branch = models.ForeignKey("tenancy.Branch", on_delete=models.PROTECT, related_name="sales")
    warehouse = models.ForeignKey("tenancy.Warehouse", on_delete=models.PROTECT, related_name="sales")
    terminal = models.ForeignKey("tenancy.POSTerminal", on_delete=models.PROTECT, related_name="sales")
    cash_session = models.ForeignKey("cash.CashSession", on_delete=models.PROTECT, related_name="sales")
    customer = models.ForeignKey(
        "catalog.Customer", null=True, blank=True, on_delete=models.PROTECT, related_name="sales"
    )
    number = models.CharField(max_length=40)
    status = models.CharField(max_length=16, choices=SaleStatus.choices, default=SaleStatus.COMPLETED)
    subtotal = models.DecimalField(max_digits=16, decimal_places=2)
    discount_total = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=16, decimal_places=2)
    change_total = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    payment_condition = models.CharField(max_length=16, choices=PaymentCondition.choices, default=PaymentCondition.CASH)
    payment_due_date = models.DateField(null=True, blank=True)
    amount_paid = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    balance_due = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    idempotency_key = models.CharField(max_length=80)
    notes = models.TextField(blank=True)
    sold_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sales")
    sold_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="uq_sale_company_number"),
            models.UniqueConstraint(fields=["company", "idempotency_key"], name="uq_sale_company_idempotency"),
        ]
        indexes = [models.Index(fields=["company", "branch", "sold_at", "status"])]


class SaleItem(CompanyScopedModel):
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="items")
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.PROTECT)
    lot = models.ForeignKey("inventory.Lot", null=True, blank=True, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=16, decimal_places=3)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2)
    discount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount_reason = models.CharField(max_length=240, blank=True)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=16, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name="ck_sale_item_quantity_gt_zero"),
            models.CheckConstraint(condition=models.Q(unit_price__gte=0), name="ck_sale_item_price_non_negative"),
        ]


class SalePayment(CompanyScopedModel):
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="payments")
    method = models.CharField(max_length=16, choices=PaymentMethod.choices)
    amount = models.DecimalField(max_digits=16, decimal_places=2)
    received_amount = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    reference = models.CharField(max_length=100, blank=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(amount__gt=0), name="ck_sale_payment_gt_zero")]
