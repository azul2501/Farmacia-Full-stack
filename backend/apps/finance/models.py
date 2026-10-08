from django.conf import settings
from django.db import models

from apps.core.choices import PaymentMethod
from apps.core.models import CompanyScopedModel


class AccountStatus(models.TextChoices):
    PENDING = "PENDING", "Pendiente"
    PARTIAL = "PARTIAL", "Parcial"
    PAID = "PAID", "Pagada"
    CANCELLED = "CANCELLED", "Anulada"


class PayableAccount(CompanyScopedModel):
    supplier = models.ForeignKey("catalog.Supplier", on_delete=models.PROTECT, related_name="payables")
    purchase = models.OneToOneField("purchases.Purchase", on_delete=models.PROTECT, related_name="payable")
    branch = models.ForeignKey("tenancy.Branch", on_delete=models.PROTECT, related_name="payables")
    issue_date = models.DateField()
    due_date = models.DateField()
    original_amount = models.DecimalField(max_digits=16, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=16, decimal_places=2)
    status = models.CharField(max_length=16, choices=AccountStatus.choices, default=AccountStatus.PENDING)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payables_created")

    class Meta:
        ordering = ["due_date", "created_at"]
        indexes = [models.Index(fields=["company", "branch", "status", "due_date"])]
        constraints = [
            models.CheckConstraint(condition=models.Q(original_amount__gt=0), name="ck_payable_original_gt_zero"),
            models.CheckConstraint(condition=models.Q(paid_amount__gte=0), name="ck_payable_paid_non_negative"),
            models.CheckConstraint(condition=models.Q(balance__gte=0), name="ck_payable_balance_non_negative"),
        ]


class ReceivableAccount(CompanyScopedModel):
    customer = models.ForeignKey("catalog.Customer", on_delete=models.PROTECT, related_name="receivables")
    sale = models.OneToOneField("sales.Sale", on_delete=models.PROTECT, related_name="receivable")
    branch = models.ForeignKey("tenancy.Branch", on_delete=models.PROTECT, related_name="receivables")
    issue_date = models.DateField()
    due_date = models.DateField()
    original_amount = models.DecimalField(max_digits=16, decimal_places=2)
    collected_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=16, decimal_places=2)
    status = models.CharField(max_length=16, choices=AccountStatus.choices, default=AccountStatus.PENDING)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="receivables_created"
    )

    class Meta:
        ordering = ["due_date", "created_at"]
        indexes = [models.Index(fields=["company", "branch", "status", "due_date"])]
        constraints = [
            models.CheckConstraint(condition=models.Q(original_amount__gt=0), name="ck_receivable_original_gt_zero"),
            models.CheckConstraint(
                condition=models.Q(collected_amount__gte=0), name="ck_receivable_collected_non_negative"
            ),
            models.CheckConstraint(condition=models.Q(balance__gte=0), name="ck_receivable_balance_non_negative"),
        ]


class AccountTransactionBase(CompanyScopedModel):
    date = models.DateField()
    amount = models.DecimalField(max_digits=16, decimal_places=2)
    method = models.CharField(max_length=16, choices=PaymentMethod.choices)
    cash_session = models.ForeignKey("cash.CashSession", null=True, blank=True, on_delete=models.PROTECT)
    reference = models.CharField(max_length=100, blank=True)
    operation_number = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    idempotency_key = models.CharField(max_length=80)
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        abstract = True


class PayablePayment(AccountTransactionBase):
    account = models.ForeignKey(PayableAccount, on_delete=models.PROTECT, related_name="payments")

    class Meta:
        ordering = ["-date", "-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["company", "idempotency_key"], name="uq_payable_payment_idempotency"),
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="ck_payable_payment_gt_zero"),
        ]


class ReceivableCollection(AccountTransactionBase):
    account = models.ForeignKey(ReceivableAccount, on_delete=models.PROTECT, related_name="collections")

    class Meta:
        ordering = ["-date", "-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["company", "idempotency_key"], name="uq_receivable_collection_idempotency"),
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="ck_receivable_collection_gt_zero"),
        ]


class FinancialCategoryType(models.TextChoices):
    EXPENSE = "EXPENSE", "Gasto"
    INCOME = "INCOME", "Ingreso"


class FinancialCategory(CompanyScopedModel):
    category_type = models.CharField(max_length=16, choices=FinancialCategoryType.choices)
    name = models.CharField(max_length=160)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "category_type", "name"], name="uq_financial_category_company_type_name"
            )
        ]


class FinancialDirection(models.TextChoices):
    IN = "IN", "Entrada"
    OUT = "OUT", "Salida"


class FinancialOrigin(models.TextChoices):
    SALE = "SALE", "Venta"
    RECEIVABLE_COLLECTION = "RECEIVABLE_COLLECTION", "Cobro CxC"
    PAYABLE_PAYMENT = "PAYABLE_PAYMENT", "Pago CxP"
    EXPENSE = "EXPENSE", "Gasto"
    ADDITIONAL_INCOME = "ADDITIONAL_INCOME", "Ingreso adicional"
    CASH_WITHDRAWAL = "CASH_WITHDRAWAL", "Retiro de caja"
    CASH_CONTRIBUTION = "CASH_CONTRIBUTION", "Aporte de caja"
    ADJUSTMENT = "ADJUSTMENT", "Ajuste"


class FinancialMovementStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Activo"
    VOID = "VOID", "Anulado"


class FinancialMovement(CompanyScopedModel):
    branch = models.ForeignKey("tenancy.Branch", on_delete=models.PROTECT, related_name="financial_movements")
    cash_session = models.ForeignKey(
        "cash.CashSession", null=True, blank=True, on_delete=models.PROTECT, related_name="financial_movements"
    )
    category = models.ForeignKey(
        FinancialCategory, null=True, blank=True, on_delete=models.PROTECT, related_name="movements"
    )
    date = models.DateField()
    direction = models.CharField(max_length=8, choices=FinancialDirection.choices)
    origin = models.CharField(max_length=32, choices=FinancialOrigin.choices)
    amount = models.DecimalField(max_digits=16, decimal_places=2)
    method = models.CharField(max_length=16, choices=PaymentMethod.choices)
    beneficiary_or_source = models.CharField(max_length=200, blank=True)
    document_number = models.CharField(max_length=100, blank=True)
    reference = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    attachment = models.FileField(upload_to="finance/%Y/%m/", blank=True)
    source_type = models.CharField(max_length=80)
    source_id = models.UUIDField(null=True, blank=True)
    status = models.CharField(
        max_length=16, choices=FinancialMovementStatus.choices, default=FinancialMovementStatus.ACTIVE
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="financial_movements_created"
    )
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="financial_movements_voided",
    )
    voided_at = models.DateTimeField(null=True, blank=True)
    void_reason = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["company", "branch", "date"]),
            models.Index(fields=["company", "origin", "source_type", "source_id"]),
        ]
        constraints = [models.CheckConstraint(condition=models.Q(amount__gt=0), name="ck_financial_amount_gt_zero")]
