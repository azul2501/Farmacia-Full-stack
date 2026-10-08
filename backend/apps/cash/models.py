from django.conf import settings
from django.db import models

from apps.core.models import CompanyScopedModel


class CashRegister(CompanyScopedModel):
    branch = models.ForeignKey("tenancy.Branch", on_delete=models.PROTECT, related_name="cash_registers")
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["company", "code"], name="uq_cash_register_company_code")]


class CashSessionStatus(models.TextChoices):
    OPEN = "OPEN", "Abierta"
    CLOSING = "CLOSING", "En cierre"
    CLOSED = "CLOSED", "Cerrada"
    CLOSED_WITH_DIFFERENCE = "CLOSED_WITH_DIFFERENCE", "Cerrada con diferencia"


class CashSession(CompanyScopedModel):
    register = models.ForeignKey(CashRegister, on_delete=models.PROTECT, related_name="sessions")
    opened_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="cash_openings")
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="cash_closings",
    )
    status = models.CharField(max_length=32, choices=CashSessionStatus.choices, default=CashSessionStatus.OPEN)
    opening_amount = models.DecimalField(max_digits=16, decimal_places=2)
    expected_cash = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    counted_cash = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    difference = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    opened_at = models.DateTimeField()
    closed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["register"],
                condition=models.Q(status__in=[CashSessionStatus.OPEN, CashSessionStatus.CLOSING]),
                name="uq_cash_register_active_session",
            )
        ]
        indexes = [models.Index(fields=["company", "status", "opened_at"])]


class CashMovementType(models.TextChoices):
    OPENING = "OPENING", "Apertura"
    CASH_SALE = "CASH_SALE", "Venta en efectivo"
    MANUAL_IN = "MANUAL_IN", "Ingreso manual"
    WITHDRAWAL = "WITHDRAWAL", "Retiro"
    REFUND = "REFUND", "Devolucion"
    RECEIVABLE_COLLECTION = "RECEIVABLE_COLLECTION", "Cobro de cuenta"
    PAYABLE_PAYMENT = "PAYABLE_PAYMENT", "Pago de cuenta"
    EXPENSE = "EXPENSE", "Gasto"
    ADDITIONAL_INCOME = "ADDITIONAL_INCOME", "Ingreso adicional"
    CONTRIBUTION = "CONTRIBUTION", "Aporte de caja"


class CashMovement(CompanyScopedModel):
    session = models.ForeignKey(CashSession, on_delete=models.PROTECT, related_name="movements")
    movement_type = models.CharField(max_length=24, choices=CashMovementType.choices)
    amount = models.DecimalField(max_digits=16, decimal_places=2)
    reference_type = models.CharField(max_length=60, blank=True)
    reference_id = models.UUIDField(null=True, blank=True)
    reason = models.CharField(max_length=240)
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        indexes = [models.Index(fields=["company", "session", "created_at"])]
        constraints = [models.CheckConstraint(condition=models.Q(amount__gt=0), name="ck_cash_movement_amount_gt_zero")]


class CashCountType(models.TextChoices):
    PARTIAL = "PARTIAL", "Parcial"
    FINAL = "FINAL", "Final"


class CashCount(CompanyScopedModel):
    session = models.ForeignKey(CashSession, on_delete=models.PROTECT, related_name="counts")
    count_type = models.CharField(max_length=16, choices=CashCountType.choices)
    expected_breakdown = models.JSONField(default=dict)
    counted_breakdown = models.JSONField(default=dict)
    expected_cash = models.DecimalField(max_digits=16, decimal_places=2)
    counted_cash = models.DecimalField(max_digits=16, decimal_places=2)
    difference = models.DecimalField(max_digits=16, decimal_places=2)
    observation = models.TextField(blank=True)
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="cash_counts")
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="cash_counts_approved",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["company", "session", "created_at"])]
