from django.db import models

from apps.core.models import BaseModel, CompanyScopedModel


class Company(BaseModel):
    legal_name = models.CharField(max_length=200)
    trade_name = models.CharField(max_length=160)
    tax_id = models.CharField(max_length=20, unique=True)
    timezone = models.CharField(max_length=64, default="America/Lima")
    currency = models.CharField(max_length=3, default="PEN")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "companies"
        indexes = [models.Index(fields=["is_active", "trade_name"])]

    def __str__(self):
        return self.trade_name


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
