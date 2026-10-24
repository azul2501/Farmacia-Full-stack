from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel, CompanyScopedModel


class SubscriptionPlan(BaseModel):
    """Plan que paga una botica. Precio y dias de prueba se editan desde el admin."""

    name = models.CharField(max_length=80, unique=True)
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    trial_days = models.PositiveSmallIntegerField(default=30)
    is_default = models.BooleanField(default=False, help_text="Plan asignado a las boticas que se registran solas.")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["monthly_price", "name"]

    def __str__(self):
        return f"{self.name} (S/ {self.monthly_price})"

    @classmethod
    def default_plan(cls):
        return cls.objects.filter(is_active=True).order_by("-is_default", "monthly_price", "name").first()


class SubscriptionStatus(models.TextChoices):
    TRIAL = "TRIAL", "En prueba"
    ACTIVE = "ACTIVE", "Activa"
    SUSPENDED = "SUSPENDED", "Suspendida"


class Company(BaseModel):
    legal_name = models.CharField(max_length=200)
    trade_name = models.CharField(max_length=160)
    tax_id = models.CharField(max_length=20, unique=True)
    timezone = models.CharField(max_length=64, default="America/Lima")
    currency = models.CharField(max_length=3, default="PEN")
    is_active = models.BooleanField(default=True)
    subscription_plan = models.ForeignKey(
        SubscriptionPlan, on_delete=models.SET_NULL, null=True, blank=True, related_name="companies"
    )
    subscription_status = models.CharField(
        max_length=16, choices=SubscriptionStatus.choices, default=SubscriptionStatus.ACTIVE
    )
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    tax_id_verified = models.BooleanField(default=False, help_text="RUC confirmado como activo y habido en SUNAT.")

    class Meta:
        verbose_name_plural = "companies"
        indexes = [models.Index(fields=["is_active", "trade_name"])]

    def __str__(self):
        return self.trade_name

    @property
    def can_operate(self) -> bool:
        """Una botica suspendida o con la prueba vencida puede entrar, pero no vender ni ingresar mercaderia."""
        if not self.is_active or self.subscription_status == SubscriptionStatus.SUSPENDED:
            return False
        if self.subscription_status == SubscriptionStatus.TRIAL:
            return self.trial_ends_at is None or self.trial_ends_at > timezone.now()
        return True


class Branch(CompanyScopedModel):
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=160)
    address = models.CharField(max_length=250)
    phone = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["company", "code"], name="uq_branch_company_code")]
        indexes = [models.Index(fields=["company", "is_active", "name"])]

    def __str__(self):
        return self.name


class Warehouse(CompanyScopedModel):
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="warehouses")
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=160)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["company", "code"], name="uq_warehouse_company_code")]
        indexes = [models.Index(fields=["company", "branch", "is_active"])]

    def __str__(self):
        return f"{self.branch.name} - {self.name}"


class POSTerminal(CompanyScopedModel):
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="pos_terminals")
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["company", "code"], name="uq_terminal_company_code")]

    def __str__(self):
        return self.name
