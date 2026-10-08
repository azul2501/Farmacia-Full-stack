from decimal import ROUND_HALF_UP, Decimal

from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import CompanyScopedModel


class ActiveNamedModel(CompanyScopedModel):
    name = models.CharField(max_length=160)
    is_active = models.BooleanField(default=True)

    class Meta:
        abstract = True

    def __str__(self):
        return self.name


class Category(ActiveNamedModel):
    class Meta:
        verbose_name_plural = "categories"
        constraints = [models.UniqueConstraint(fields=["company", "name"], name="uq_category_company_name")]


class Laboratory(ActiveNamedModel):
    class Meta:
        verbose_name_plural = "laboratories"
        constraints = [models.UniqueConstraint(fields=["company", "name"], name="uq_laboratory_company_name")]


class ActiveIngredient(ActiveNamedModel):
    class Meta:
        constraints = [models.UniqueConstraint(fields=["company", "name"], name="uq_active_ingredient_company_name")]


class TherapeuticAction(ActiveNamedModel):
    class Meta:
        constraints = [models.UniqueConstraint(fields=["company", "name"], name="uq_therapeutic_action_company_name")]


class Supplier(CompanyScopedModel):
    document_type = models.CharField(max_length=16, default="RUC")
    document_number = models.CharField(max_length=20)
    legal_name = models.CharField(max_length=200)
    trade_name = models.CharField(max_length=160, blank=True)
    address = models.CharField(max_length=250, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "document_number"], name="uq_supplier_company_document")
        ]
        indexes = [models.Index(fields=["company", "legal_name"])]

    def __str__(self):
        return self.trade_name or self.legal_name


class Customer(CompanyScopedModel):
    document_type = models.CharField(max_length=16, default="DNI")
    document_number = models.CharField(max_length=20, blank=True)
    full_name = models.CharField(max_length=200)
    address = models.CharField(max_length=250, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "document_number"],
                condition=~models.Q(document_number=""),
                name="uq_customer_company_document",
            )
        ]
        indexes = [models.Index(fields=["company", "full_name"])]

    def __str__(self):
        return self.full_name


class Product(CompanyScopedModel):
    class ProductType(models.TextChoices):
        MEDICINE = "MEDICINE", "Medicamento"
        SUPPLY = "SUPPLY", "Insumo"
        SERVICE = "SERVICE", "Servicio"

    class TaxAffectation(models.TextChoices):
        TAXED = "TAXED", "Gravado"
        EXEMPT = "EXEMPT", "Exonerado"
        UNAFFECTED = "UNAFFECTED", "Inafecto"

    internal_code = models.CharField(max_length=48)
    commercial_name = models.CharField(max_length=220)
    active_ingredient = models.ForeignKey(
        ActiveIngredient, null=True, blank=True, on_delete=models.PROTECT, related_name="products"
    )
    therapeutic_action = models.ForeignKey(
        TherapeuticAction, null=True, blank=True, on_delete=models.PROTECT, related_name="products"
    )
    category = models.ForeignKey(Category, null=True, on_delete=models.PROTECT, related_name="products")
    laboratory = models.ForeignKey(Laboratory, null=True, blank=True, on_delete=models.PROTECT, related_name="products")
    usual_supplier = models.ForeignKey(
        Supplier, null=True, blank=True, on_delete=models.PROTECT, related_name="usual_products"
    )
    sanitary_registration = models.CharField(max_length=80, blank=True)
    digemid_code = models.CharField(max_length=80, blank=True)
    tax_affectation = models.CharField(max_length=16, choices=TaxAffectation.choices, default=TaxAffectation.TAXED)
    product_type = models.CharField(max_length=16, choices=ProductType.choices)
    requires_lot = models.BooleanField(default=True)
    requires_expiry = models.BooleanField(default=True)
    is_controlled = models.BooleanField(default=False)
    requires_prescription = models.BooleanField(default=False)
    health_surveillance = models.BooleanField(default=False)
    earns_points = models.BooleanField(default=False)
    additional_info = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "internal_code"], name="uq_product_company_internal_code")
        ]
        indexes = [models.Index(fields=["company", "commercial_name", "is_active"])]

    def __str__(self):
        return self.commercial_name

    def save(self, *args, **kwargs):
        # El vencimiento se guarda en el lote: un producto con vencimiento siempre maneja lotes.
        if self.requires_expiry:
            self.requires_lot = True
            update_fields = kwargs.get("update_fields")
            if update_fields is not None and "requires_expiry" in update_fields:
                kwargs["update_fields"] = {*update_fields, "requires_lot"}
        super().save(*args, **kwargs)


class ProductVariant(CompanyScopedModel):
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="variants")
    sku = models.CharField(max_length=48)
    presentation = models.CharField(max_length=120)
    unit_of_measure = models.CharField(max_length=32)
    sale_unit = models.CharField(max_length=32)
    conversion_factor = models.DecimalField(max_digits=12, decimal_places=4, default=1)
    allows_fractioning = models.BooleanField(default=False)
    minimum_stock = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    purchase_pack_price = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    purchase_factor = models.DecimalField(max_digits=12, decimal_places=4, default=1)
    unit_purchase_cost = models.DecimalField(max_digits=14, decimal_places=4, default=0, editable=False)
    sale_factor = models.DecimalField(max_digits=12, decimal_places=4, default=1)
    base_sale_price = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="PEN")
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "sku"], name="uq_variant_company_sku"),
            models.CheckConstraint(
                condition=models.Q(purchase_factor__gt=0), name="ck_variant_purchase_factor_gt_zero"
            ),
            models.CheckConstraint(
                condition=models.Q(purchase_pack_price__gte=0),
                name="ck_variant_purchase_price_non_negative",
            ),
            models.CheckConstraint(condition=models.Q(base_sale_price__gt=0), name="ck_variant_sale_price_gt_zero"),
            models.CheckConstraint(condition=models.Q(sale_factor__gt=0), name="ck_variant_sale_factor_gt_zero"),
        ]
        indexes = [models.Index(fields=["company", "product", "is_active"])]

    def __str__(self):
        return f"{self.product.commercial_name} - {self.presentation}"

    @property
    def unit_gain(self):
        return self.base_sale_price - self.unit_purchase_cost

    @property
    def margin_on_cost(self):
        if self.unit_purchase_cost <= 0:
            return None
        return (self.unit_gain / self.unit_purchase_cost * Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    def save(self, *args, **kwargs):
        purchase_factor = Decimal(str(self.purchase_factor))
        purchase_price = Decimal(str(self.purchase_pack_price))
        sale_price = Decimal(str(self.base_sale_price))
        if purchase_factor <= 0:
            raise ValidationError({"purchase_factor": "El factor de compra debe ser mayor que cero."})
        if purchase_price < 0:
            raise ValidationError({"purchase_pack_price": "El precio de compra no puede ser negativo."})
        if sale_price <= 0:
            raise ValidationError({"base_sale_price": "El precio de venta debe ser mayor que cero."})
        self.unit_purchase_cost = (purchase_price / purchase_factor).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        if update_fields := kwargs.get("update_fields"):
            kwargs["update_fields"] = set(update_fields) | {"unit_purchase_cost"}
        super().save(*args, **kwargs)


class ProductBarcode(CompanyScopedModel):
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name="barcodes")
    code = models.CharField(max_length=64)
    is_primary = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["company", "code"], name="uq_barcode_company_code")]


class ProductWarehouseLocation(CompanyScopedModel):
    warehouse = models.ForeignKey("tenancy.Warehouse", on_delete=models.PROTECT, related_name="product_locations")
    variant = models.ForeignKey(ProductVariant, on_delete=models.PROTECT, related_name="warehouse_locations")
    code = models.CharField(max_length=48)
    description = models.CharField(max_length=180, blank=True)
    aisle = models.CharField(max_length=48, blank=True)
    shelf = models.CharField(max_length=48, blank=True)
    level = models.CharField(max_length=48, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "warehouse", "variant"], name="uq_product_location_warehouse_variant"
            ),
            models.UniqueConstraint(fields=["company", "warehouse", "code"], name="uq_product_location_warehouse_code"),
        ]
        indexes = [models.Index(fields=["company", "warehouse", "is_active"])]

    def __str__(self):
        return f"{self.warehouse} / {self.code}"
