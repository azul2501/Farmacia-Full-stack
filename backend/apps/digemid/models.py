"""Datos publicos de DIGEMID compartidos por todas las boticas.

- ``MasterProduct``: Catalogo de Productos Farmaceuticos de DIGEMID (se carga desde su Excel).
- ``MasterBarcode``: codigos de barras que las boticas enlazan a un producto del catalogo.
- ``DigemidAlert``: alertas sanitarias de DIGEMID (retiro de lotes, falsificaciones).

No son datos de una botica: no llevan ``company``. El producto de una botica se enlaza al catalogo
por ``Product.digemid_code`` (el CodProd de DIGEMID).
"""

from django.db import models

from apps.core.models import BaseModel


class MasterProduct(BaseModel):
    digemid_code = models.CharField(max_length=32, unique=True, help_text="CodProd del catálogo de DIGEMID.")
    name = models.CharField(max_length=250)
    concentration = models.CharField(max_length=160, blank=True)
    dosage_form = models.CharField(max_length=160, blank=True)
    presentation = models.CharField(max_length=300, blank=True)
    fractions = models.CharField(max_length=60, blank=True)
    sanitary_registration = models.CharField(max_length=80, blank=True, db_index=True)
    holder = models.CharField(max_length=250, blank=True)
    manufacturer = models.CharField(max_length=250, blank=True)
    active_ingredient = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=60, blank=True)
    product_type = models.CharField(max_length=16, default="MEDICINE", help_text="MEDICINE o SUPPLY (insumo).")
    suggested_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, help_text="Precio de venta referencial por unidad."
    )
    source = models.CharField(max_length=60, blank=True, help_text="De dónde viene: DIGEMID, RM 220-2024, lista base.")

    class Meta:
        ordering = ["name", "concentration"]
        indexes = [models.Index(fields=["name"], name="digemid_master_name_idx")]

    def __str__(self):
        return " ".join(part for part in (self.name, self.concentration, self.dosage_form) if part)


class MasterBarcode(BaseModel):
    code = models.CharField(max_length=64, unique=True)
    master_product = models.ForeignKey(MasterProduct, on_delete=models.CASCADE, related_name="barcodes")
    first_company = models.ForeignKey(
        "tenancy.Company", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    def __str__(self):
        return self.code


class DigemidAlert(BaseModel):
    year = models.PositiveSmallIntegerField()
    number = models.PositiveIntegerField()
    title = models.CharField(max_length=400)
    url = models.URLField(max_length=300, unique=True)
    summary = models.TextField(blank=True)
    sanitary_registrations = models.JSONField(default=list, blank=True)
    lot_numbers = models.JSONField(default=list, blank=True)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ["-year", "-number"]
        constraints = [models.UniqueConstraint(fields=["year", "number"], name="uq_digemid_alert_year_number")]

    def __str__(self):
        return f"Alerta DIGEMID {self.number:03d}-{self.year}"
