from decimal import Decimal

from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from apps.audit.services import record_audit
from apps.catalog.models import (
    ActiveIngredient,
    Category,
    Customer,
    Laboratory,
    Product,
    ProductBarcode,
    ProductVariant,
    ProductWarehouseLocation,
    Supplier,
    TherapeuticAction,
)
from apps.core.permissions import ensure_branch_access


class NamedSerializer(serializers.ModelSerializer):
    class Meta:
        fields = ["id", "name", "is_active"]
        read_only_fields = ["id"]


class CategorySerializer(NamedSerializer):
    class Meta(NamedSerializer.Meta):
        model = Category


class LaboratorySerializer(NamedSerializer):
    class Meta(NamedSerializer.Meta):
        model = Laboratory


class ActiveIngredientSerializer(NamedSerializer):
    class Meta(NamedSerializer.Meta):
        model = ActiveIngredient


class TherapeuticActionSerializer(NamedSerializer):
    class Meta(NamedSerializer.Meta):
        model = TherapeuticAction


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        exclude = ["company"]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "document_number": {"required": False, "allow_blank": True},
            "document_type": {"required": False},
        }

    def _next_document_number(self, company):
        base = "PROV"
        next_number = Supplier.objects.filter(company=company, document_number__startswith=f"{base}-").count() + 1
        while True:
            candidate = f"{base}-{next_number:06d}"
            if not Supplier.objects.filter(company=company, document_number=candidate).exists():
                return candidate
            next_number += 1

    def create(self, validated_data):
        company = self.context["request"].company
        if not validated_data.get("document_number"):
            validated_data["document_type"] = validated_data.get("document_type") or "INTERNO"
            validated_data["document_number"] = self._next_document_number(company)
        return super().create(validated_data)


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        exclude = ["company"]
        read_only_fields = ["id", "created_at", "updated_at"]


class ProductBarcodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductBarcode
        fields = ["id", "variant", "code", "is_primary"]
        read_only_fields = ["id"]

    def validate_variant(self, variant):
        if variant.company_id != self.context["request"].company.id:
            raise serializers.ValidationError("La presentación no pertenece a la empresa activa.")
        return variant


class ProductVariantSerializer(serializers.ModelSerializer):
    barcodes = ProductBarcodeSerializer(many=True, read_only=True)
    product_name = serializers.CharField(source="product.commercial_name", read_only=True)
    unit_gain = serializers.DecimalField(max_digits=14, decimal_places=4, read_only=True)
    margin_on_cost = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, allow_null=True)
    requires_lot = serializers.BooleanField(source="product.requires_lot", read_only=True)
    requires_expiry = serializers.BooleanField(source="product.requires_expiry", read_only=True)

    class Meta:
        model = ProductVariant
        exclude = ["company"]
        read_only_fields = ["id", "unit_purchase_cost", "created_at", "updated_at"]

    def validate_product(self, product):
        if product.company_id != self.context["request"].company.id:
            raise serializers.ValidationError("El producto no pertenece a la empresa activa.")
        return product

    def validate(self, attrs):
        purchase_factor = attrs.get("purchase_factor", getattr(self.instance, "purchase_factor", None))
        purchase_price = attrs.get("purchase_pack_price", getattr(self.instance, "purchase_pack_price", None))
        sale_price = attrs.get("base_sale_price", getattr(self.instance, "base_sale_price", None))
        sale_factor = attrs.get("sale_factor", getattr(self.instance, "sale_factor", None))
        errors = {}
        if purchase_factor is not None and purchase_factor <= 0:
            errors["purchase_factor"] = "El factor de compra debe ser mayor que cero."
        if purchase_price is not None and purchase_price < 0:
            errors["purchase_pack_price"] = "El precio de compra no puede ser negativo."
        if sale_price is not None and sale_price <= 0:
            errors["base_sale_price"] = "El precio de venta debe ser mayor que cero."
        if sale_factor is not None and sale_factor <= 0:
            errors["sale_factor"] = "El factor de venta debe ser mayor que cero."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def update(self, instance, validated_data):
        previous_price = instance.base_sale_price
        instance = super().update(instance, validated_data)
        if instance.base_sale_price != previous_price:
            request = self.context["request"]
            record_audit(
                company=request.company,
                actor=request.user,
                action="product_variant.sale_price_changed",
                resource=instance,
                payload={"previous": str(previous_price), "current": str(instance.base_sale_price)},
            )
        return instance


class InitialProductVariantSerializer(serializers.Serializer):
    sku = serializers.CharField(max_length=48, required=False, allow_blank=True)
    presentation = serializers.CharField(max_length=120, required=False, allow_blank=True)
    unit_of_measure = serializers.CharField(max_length=32)
    sale_unit = serializers.CharField(max_length=32)
    conversion_factor = serializers.DecimalField(max_digits=12, decimal_places=4, min_value=Decimal("0.0001"))
    allows_fractioning = serializers.BooleanField(default=False)
    minimum_stock = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=0)
    purchase_pack_price = serializers.DecimalField(max_digits=14, decimal_places=4, min_value=0)
    purchase_factor = serializers.DecimalField(max_digits=12, decimal_places=4, min_value=Decimal("0.0001"))
    sale_factor = serializers.DecimalField(max_digits=12, decimal_places=4, min_value=Decimal("0.0001"))
    base_sale_price = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    currency = serializers.CharField(max_length=3, default="PEN")
    barcode = serializers.CharField(max_length=64, required=False, allow_blank=True)
    warehouse = serializers.UUIDField(required=False, allow_null=True)
    location_code = serializers.CharField(max_length=48, required=False, allow_blank=True)
    location_description = serializers.CharField(max_length=180, required=False, allow_blank=True)
    aisle = serializers.CharField(max_length=48, required=False, allow_blank=True)
    shelf = serializers.CharField(max_length=48, required=False, allow_blank=True)
    level = serializers.CharField(max_length=48, required=False, allow_blank=True)


class SaleVariantInputSerializer(serializers.Serializer):
    sale_unit = serializers.CharField(max_length=32)
    presentation = serializers.CharField(max_length=120, required=False, allow_blank=True)
    contains_units = serializers.DecimalField(max_digits=12, decimal_places=4, min_value=Decimal("0.0001"))
    base_sale_price = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    is_active = serializers.BooleanField(default=True)


class ProductSerializer(serializers.ModelSerializer):
    initial_variant = InitialProductVariantSerializer(write_only=True, required=False)
    sale_variants = SaleVariantInputSerializer(many=True, write_only=True, required=False)
    variants = ProductVariantSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    laboratory_name = serializers.CharField(source="laboratory.name", read_only=True, allow_null=True)
    active_ingredient_name = serializers.CharField(source="active_ingredient.name", read_only=True, allow_null=True)
    therapeutic_action_name = serializers.CharField(source="therapeutic_action.name", read_only=True, allow_null=True)
    usual_supplier_name = serializers.SerializerMethodField()

    class Meta:
        model = Product
        exclude = ["company"]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "category": {"required": True, "allow_null": False},
            "internal_code": {"required": False, "allow_blank": True},
        }

    def _next_product_code(self, company):
        base = "PRD"
        next_number = Product.objects.filter(company=company, internal_code__startswith=f"{base}-").count() + 1
        while True:
            candidate = f"{base}-{next_number:06d}"
            if not Product.objects.filter(company=company, internal_code=candidate).exists():
                return candidate
            next_number += 1

    def get_usual_supplier_name(self, product) -> str | None:
        return str(product.usual_supplier) if product.usual_supplier_id else None

    def _variant_sku(self, *, company, product_code, sale_unit):
        unit_part = slugify(sale_unit or "venta").upper().replace("-", "")[:12] or "VENTA"
        base = f"{product_code}-{unit_part}"[:44]
        candidate = base
        suffix = 1
        while ProductVariant.objects.filter(company=company, sku=candidate).exists():
            suffix += 1
            candidate = f"{base[:40]}-{suffix}"
        return candidate

    def _validate_barcode_available(self, *, company, barcode, product=None):
        if not barcode:
            return
        query = ProductBarcode.objects.filter(company=company, code=barcode)
        if product is not None:
            query = query.exclude(variant__product=product)
        if query.exists():
            raise serializers.ValidationError(
                {"initial_variant": {"barcode": "Ya existe un producto registrado con ese código de barras."}}
            )

    def _sale_variants_from_initial(self, initial_data):
        if not initial_data:
            return []
        return [
            {
                "sale_unit": initial_data["sale_unit"],
                "sku": initial_data.get("sku", ""),
                "presentation": initial_data.get("presentation", ""),
                "contains_units": initial_data["sale_factor"],
                "base_sale_price": initial_data["base_sale_price"],
                "is_active": True,
            }
        ]

    def _variant_payloads(self, *, company, product_code, initial_data, sale_variants):
        shared = {
            "unit_of_measure": initial_data["unit_of_measure"],
            "allows_fractioning": initial_data.get("allows_fractioning", False),
            "minimum_stock": initial_data.get("minimum_stock", Decimal("0")),
            "purchase_pack_price": initial_data["purchase_pack_price"],
            "purchase_factor": initial_data["purchase_factor"],
            "currency": initial_data.get("currency") or "PEN",
        }
        payloads = []
        for sale_variant in sale_variants:
            sale_unit = sale_variant["sale_unit"].strip()
            contains_units = sale_variant["contains_units"]
            presentation = sale_variant.get("presentation") or f"{sale_unit} x {contains_units:g}"
            payloads.append(
                {
                    **shared,
                    "sku": sale_variant.get("sku")
                    or self._variant_sku(company=company, product_code=product_code, sale_unit=sale_unit),
                    "presentation": presentation,
                    "sale_unit": sale_unit,
                    "conversion_factor": contains_units,
                    "sale_factor": contains_units,
                    "base_sale_price": sale_variant["base_sale_price"],
                    "is_active": sale_variant.get("is_active", True),
                }
            )
        return payloads

    def validate(self, attrs):
        company = self.context["request"].company
        for field in ("category", "laboratory", "active_ingredient", "therapeutic_action", "usual_supplier"):
            value = attrs.get(field)
            if value and value.company_id != company.id:
                raise serializers.ValidationError({field: "No pertenece a la empresa activa."})
        initial_variant = attrs.get("initial_variant")
        sale_variants = attrs.get("sale_variants")
        if self.instance is None and not initial_variant:
            raise serializers.ValidationError({"initial_variant": "La presentación base es obligatoria."})
        if initial_variant:
            self._validate_barcode_available(
                company=company,
                barcode=initial_variant.get("barcode", "").strip(),
                product=self.instance,
            )
        if self.instance is None and not (sale_variants or initial_variant):
            raise serializers.ValidationError({"sale_variants": "Debe activar al menos una forma de venta."})
        if sale_variants is not None and not [item for item in sale_variants if item.get("is_active", True)]:
            raise serializers.ValidationError({"sale_variants": "Debe activar al menos una forma de venta."})
        if sale_variants:
            normalized_units = [item["sale_unit"].strip().lower() for item in sale_variants]
            if len(normalized_units) != len(set(normalized_units)):
                raise serializers.ValidationError({"sale_variants": "No repitas una forma de venta."})
        if initial_variant and initial_variant.get("warehouse"):
            from apps.tenancy.models import Warehouse

            if not Warehouse.objects.filter(id=initial_variant["warehouse"], company=company).exists():
                raise serializers.ValidationError({"initial_variant": {"warehouse": "Almacén no autorizado."}})
            warehouse = Warehouse.objects.get(id=initial_variant["warehouse"], company=company)
            ensure_branch_access(
                user=self.context["request"].user,
                company=company,
                branch_id=warehouse.branch_id,
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        from apps.tenancy.models import Warehouse

        sale_variants = validated_data.pop("sale_variants", None)
        initial_data = validated_data.pop("initial_variant")
        company = validated_data.pop("company", self.context["request"].company)
        if not validated_data.get("internal_code"):
            validated_data["internal_code"] = self._next_product_code(company)
        product = Product.objects.create(company=company, **validated_data)
        barcode = initial_data.pop("barcode", "")
        warehouse_id = initial_data.pop("warehouse", None)
        location_data = {
            "code": initial_data.pop("location_code", ""),
            "description": initial_data.pop("location_description", ""),
            "aisle": initial_data.pop("aisle", ""),
            "shelf": initial_data.pop("shelf", ""),
            "level": initial_data.pop("level", ""),
        }
        if not sale_variants:
            sale_variants = self._sale_variants_from_initial(initial_data)
        variant_payloads = self._variant_payloads(
            company=company,
            product_code=product.internal_code,
            initial_data=initial_data,
            sale_variants=sale_variants,
        )
        first_variant = None
        barcode_variant = None
        for payload in variant_payloads:
            variant = ProductVariant.objects.create(company=company, product=product, **payload)
            first_variant = first_variant or variant
            if payload["sale_unit"].strip().upper() in {"UNIDAD", "UNIT"}:
                barcode_variant = variant
        barcode_variant = barcode_variant or first_variant
        if barcode:
            ProductBarcode.objects.create(company=company, variant=barcode_variant, code=barcode, is_primary=True)
        if warehouse_id and location_data["code"] and first_variant:
            warehouse = Warehouse.objects.get(id=warehouse_id, company=company)
            ProductWarehouseLocation.objects.create(
                company=company,
                warehouse=warehouse,
                variant=first_variant,
                **location_data,
            )
        return product

    @transaction.atomic
    def update(self, instance, validated_data):
        from apps.tenancy.models import Warehouse

        sale_variants = validated_data.pop("sale_variants", None)
        initial_data = validated_data.pop("initial_variant", None)
        product = super().update(instance, validated_data)
        if not initial_data:
            return product

        barcode = initial_data.pop("barcode", "")
        warehouse_id = initial_data.pop("warehouse", None)
        location_data = {
            "code": initial_data.pop("location_code", ""),
            "description": initial_data.pop("location_description", ""),
            "aisle": initial_data.pop("aisle", ""),
            "shelf": initial_data.pop("shelf", ""),
            "level": initial_data.pop("level", ""),
        }
        if not sale_variants:
            sale_variants = self._sale_variants_from_initial(initial_data)
        variant_payloads = self._variant_payloads(
            company=product.company,
            product_code=product.internal_code,
            initial_data=initial_data,
            sale_variants=sale_variants,
        )
        variants_by_unit = {variant.sale_unit.strip().lower(): variant for variant in product.variants.all()}
        active_units = set()
        first_variant = None
        barcode_variant = None
        for payload in variant_payloads:
            unit_key = payload["sale_unit"].strip().lower()
            active_units.add(unit_key)
            variant = variants_by_unit.get(unit_key)
            previous_price = variant.base_sale_price if variant else None
            if variant is None:
                variant = ProductVariant.objects.create(company=product.company, product=product, **payload)
            else:
                payload.pop("sku", None)
                for field, value in payload.items():
                    setattr(variant, field, value)
                variant.is_active = True
                variant.save()
            first_variant = first_variant or variant
            if payload["sale_unit"].strip().upper() in {"UNIDAD", "UNIT"}:
                barcode_variant = variant
            if previous_price is not None and previous_price != variant.base_sale_price:
                request = self.context["request"]
                record_audit(
                    company=request.company,
                    actor=request.user,
                    action="product_variant.sale_price_changed",
                    resource=variant,
                    payload={"previous": str(previous_price), "current": str(variant.base_sale_price)},
                )
        product.variants.exclude(sale_unit__in=[payload["sale_unit"] for payload in variant_payloads]).update(
            is_active=False
        )
        barcode_variant = barcode_variant or first_variant
        if barcode and barcode_variant:
            existing_barcode = (
                ProductBarcode.objects.filter(company=product.company, variant__product=product, is_primary=True)
                .order_by("created_at")
                .first()
            )
            if existing_barcode:
                existing_barcode.variant = barcode_variant
                existing_barcode.code = barcode
                existing_barcode.is_primary = True
                existing_barcode.save(update_fields=["variant", "code", "is_primary", "updated_at"])
            else:
                ProductBarcode.objects.create(
                    company=product.company,
                    variant=barcode_variant,
                    code=barcode,
                    is_primary=True,
                )
            ProductBarcode.objects.filter(company=product.company, variant__product=product).exclude(
                code=barcode
            ).update(is_primary=False)
        if warehouse_id and location_data["code"] and first_variant:
            warehouse = Warehouse.objects.get(id=warehouse_id, company=product.company)
            location = first_variant.warehouse_locations.order_by("created_at").first()
            if location:
                location.warehouse = warehouse
                for field, value in location_data.items():
                    setattr(location, field, value)
                location.is_active = True
                location.save()
            else:
                ProductWarehouseLocation.objects.create(
                    company=product.company,
                    warehouse=warehouse,
                    variant=first_variant,
                    **location_data,
                )
        return product


class ProductWarehouseLocationSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    branch = serializers.UUIDField(source="warehouse.branch_id", read_only=True)
    branch_name = serializers.CharField(source="warehouse.branch.name", read_only=True)
    product_name = serializers.CharField(source="variant.product.commercial_name", read_only=True)
    presentation = serializers.CharField(source="variant.presentation", read_only=True)

    class Meta:
        model = ProductWarehouseLocation
        exclude = ["company"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        company = self.context["request"].company
        warehouse = attrs.get("warehouse", getattr(self.instance, "warehouse", None))
        variant = attrs.get("variant", getattr(self.instance, "variant", None))
        if warehouse and warehouse.company_id != company.id:
            raise serializers.ValidationError({"warehouse": "El almacén no pertenece a la empresa activa."})
        if warehouse:
            ensure_branch_access(
                user=self.context["request"].user,
                company=company,
                branch_id=warehouse.branch_id,
            )
        if variant and variant.company_id != company.id:
            raise serializers.ValidationError({"variant": "La presentación no pertenece a la empresa activa."})
        return attrs
