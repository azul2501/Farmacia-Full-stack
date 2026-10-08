from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from rest_framework import serializers

from apps.core.choices import PaymentCondition, PaymentMethod
from apps.core.permissions import ensure_branch_access
from apps.purchases.models import Purchase, PurchaseItem


class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="variant.product.commercial_name", read_only=True)
    presentation = serializers.CharField(source="variant.presentation", read_only=True)

    class Meta:
        model = PurchaseItem
        exclude = ["company", "purchase"]
        read_only_fields = ["id", "quantity", "unit_cost", "line_total", "lot", "created_at", "updated_at"]


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True)
    supplier_name = serializers.CharField(source="supplier.__str__", read_only=True)
    warehouse_name = serializers.CharField(source="destination_warehouse.name", read_only=True)

    class Meta:
        model = Purchase
        exclude = ["company"]
        read_only_fields = [
            "id",
            "status",
            "subtotal",
            "discount_total",
            "tax_total",
            "total",
            "created_by",
            "received_by",
            "received_at",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        company = self.context["request"].company
        supplier = attrs.get("supplier", getattr(self.instance, "supplier", None))
        branch = attrs.get("branch", getattr(self.instance, "branch", None))
        warehouse = attrs.get("destination_warehouse", getattr(self.instance, "destination_warehouse", None))
        if any(entity.company_id != company.id for entity in (supplier, branch, warehouse)):
            raise serializers.ValidationError("Proveedor, sucursal y almacen deben pertenecer a la empresa.")
        if warehouse.branch_id != branch.id:
            raise serializers.ValidationError("El almacen destino no pertenece a la sucursal seleccionada.")
        ensure_branch_access(user=self.context["request"].user, company=company, branch_id=branch.id)
        condition = attrs.get("payment_condition", getattr(self.instance, "payment_condition", PaymentCondition.CASH))
        due_date = attrs.get("payment_due_date", getattr(self.instance, "payment_due_date", None))
        if condition == PaymentCondition.CREDIT and not due_date:
            raise serializers.ValidationError({"payment_due_date": "Es obligatoria para compras a credito."})
        if condition == PaymentCondition.CASH:
            method = attrs.get("payment_method", getattr(self.instance, "payment_method", ""))
            if not method:
                raise serializers.ValidationError({"payment_method": "Es obligatorio para compras al contado."})
            if method == PaymentMethod.CASH:
                session = attrs.get("cash_session", getattr(self.instance, "cash_session", None))
                if session is None:
                    raise serializers.ValidationError({"cash_session": "Selecciona una caja abierta."})
                if session.company_id != company.id or session.register.branch_id != branch.id:
                    raise serializers.ValidationError({"cash_session": "La caja no pertenece a la sucursal activa."})
            elif attrs.get("cash_session", getattr(self.instance, "cash_session", None)) is not None:
                raise serializers.ValidationError(
                    {"cash_session": "Solo los pagos en efectivo pueden asociarse a una caja."}
                )
        elif attrs.get("cash_session", getattr(self.instance, "cash_session", None)) is not None:
            raise serializers.ValidationError({"cash_session": "Una compra a credito no usa caja al confirmarse."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        company = validated_data.pop("company", self.context["request"].company)
        normalized_items, totals = self._normalize_items(items_data, company)
        purchase = Purchase.objects.create(
            company=company,
            created_by=self.context["request"].user,
            **totals,
            **validated_data,
        )
        PurchaseItem.objects.bulk_create(
            [PurchaseItem(company=company, purchase=purchase, **item) for item in normalized_items]
        )
        return purchase

    @staticmethod
    def _normalize_items(items_data, company):
        subtotal = Decimal("0")
        discount_total = Decimal("0")
        tax_total = Decimal("0")
        normalized_items = []
        for item in items_data:
            if item["variant"].company_id != company.id:
                raise serializers.ValidationError({"items": "Una presentacion no pertenece a la empresa."})
            pack_quantity = item["pack_quantity"]
            purchase_factor = item["purchase_factor"]
            purchase_pack_price = item["purchase_pack_price"]
            if purchase_factor <= 0:
                raise serializers.ValidationError({"items": "El factor de compra debe ser mayor que cero."})
            item["quantity"] = pack_quantity * purchase_factor
            item["unit_cost"] = (purchase_pack_price / purchase_factor).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
            line_subtotal = pack_quantity * purchase_pack_price
            line_total = line_subtotal - item.get("discount", 0) + item.get("tax", 0)
            item["line_total"] = line_total
            subtotal += line_subtotal
            discount_total += item.get("discount", 0)
            tax_total += item.get("tax", 0)
            normalized_items.append(item)

        return normalized_items, {
            "subtotal": subtotal,
            "discount_total": discount_total,
            "tax_total": tax_total,
            "total": subtotal - discount_total + tax_total,
        }

    @transaction.atomic
    def update(self, instance, validated_data):
        if instance.status != "DRAFT":
            raise serializers.ValidationError("Solo una compra en borrador puede editarse.")
        items_data = validated_data.pop("items", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if items_data is not None:
            normalized_items, totals = self._normalize_items(items_data, instance.company)
            for field, value in totals.items():
                setattr(instance, field, value)
            instance.items.all().delete()
            PurchaseItem.objects.bulk_create(
                [PurchaseItem(company=instance.company, purchase=instance, **item) for item in normalized_items]
            )
        instance.save()
        return instance


class PurchaseSummarySerializer(PurchaseSerializer):
    class Meta(PurchaseSerializer.Meta):
        exclude = None
        fields = [
            "id",
            "supplier",
            "supplier_name",
            "branch",
            "destination_warehouse",
            "warehouse_name",
            "document_type",
            "document_number",
            "document_date",
            "status",
            "payment_condition",
            "payment_due_date",
            "payment_method",
            "total",
            "created_at",
        ]
