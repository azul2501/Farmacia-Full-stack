from decimal import Decimal

from rest_framework import serializers

from apps.inventory.models import InventoryMovement, Lot, Stock


class LotSerializer(serializers.ModelSerializer):
    variant_name = serializers.CharField(source="variant.__str__", read_only=True)

    class Meta:
        model = Lot
        exclude = ["company"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_variant(self, variant):
        if variant.company_id != self.context["request"].company.id:
            raise serializers.ValidationError("La presentación no pertenece a la empresa activa.")
        return variant


class StockSerializer(serializers.ModelSerializer):
    available_quantity = serializers.DecimalField(max_digits=16, decimal_places=3, read_only=True)
    product_name = serializers.CharField(source="variant.product.commercial_name", read_only=True)
    presentation = serializers.CharField(source="variant.presentation", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    batch_number = serializers.CharField(source="lot.batch_number", read_only=True, allow_null=True)
    expiry_date = serializers.DateField(source="lot.expiry_date", read_only=True, allow_null=True)

    class Meta:
        model = Stock
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "variant",
            "product_name",
            "presentation",
            "lot",
            "batch_number",
            "expiry_date",
            "quantity",
            "reserved_quantity",
            "available_quantity",
            "updated_at",
        ]
        read_only_fields = fields


class InventoryMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="variant.product.commercial_name", read_only=True)
    presentation = serializers.CharField(source="variant.presentation", read_only=True)
    batch_number = serializers.CharField(source="lot.batch_number", read_only=True, allow_null=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    performed_by_name = serializers.CharField(source="performed_by.full_name", read_only=True)

    class Meta:
        model = InventoryMovement
        exclude = ["company"]
        read_only_fields = [field.name for field in InventoryMovement._meta.fields if field.name != "company"]


class InventoryAdjustmentSerializer(serializers.Serializer):
    warehouse = serializers.UUIDField()
    variant = serializers.UUIDField()
    lot = serializers.UUIDField(required=False, allow_null=True)
    quantity = serializers.DecimalField(max_digits=16, decimal_places=3, min_value=Decimal("0.001"))
    adjustment_type = serializers.ChoiceField(choices=["IN", "OUT"])
    reason = serializers.CharField(max_length=240)
    observation = serializers.CharField(max_length=500, required=False, allow_blank=True)
