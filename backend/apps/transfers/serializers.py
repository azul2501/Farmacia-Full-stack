from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.core.permissions import ensure_branch_access
from apps.sales.models import DocumentSequence
from apps.transfers.models import Transfer, TransferItem, TransferReceipt, TransferReceiptItem, TransferStatus


def _next_transfer_number(company, branch):
    sequence, _ = DocumentSequence.objects.select_for_update().get_or_create(
        company=company,
        branch=branch,
        document_type="TRANSFER",
        defaults={"prefix": f"TR-{branch.code[:4].upper()}"},
    )
    sequence.current_number += 1
    sequence.save(update_fields=["current_number", "updated_at"])
    return f"{sequence.prefix}-{sequence.current_number:04d}"


class TransferItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="variant.product.commercial_name", read_only=True)
    presentation = serializers.CharField(source="variant.presentation", read_only=True)
    batch_number = serializers.CharField(source="lot.batch_number", read_only=True, allow_null=True)

    class Meta:
        model = TransferItem
        exclude = ["company", "transfer"]
        read_only_fields = [
            "id",
            "dispatched_quantity",
            "received_quantity",
            "created_at",
            "updated_at",
        ]


class TransferReceiptItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransferReceiptItem
        exclude = ["company", "receipt"]
        read_only_fields = [field.name for field in TransferReceiptItem._meta.fields if field.name != "company"]


class TransferReceiptSerializer(serializers.ModelSerializer):
    received_by_name = serializers.CharField(source="received_by.full_name", read_only=True)
    items = TransferReceiptItemSerializer(many=True, read_only=True)

    class Meta:
        model = TransferReceipt
        exclude = ["company"]
        read_only_fields = [field.name for field in TransferReceipt._meta.fields if field.name != "company"]


class TransferSerializer(serializers.ModelSerializer):
    number = serializers.CharField(read_only=True)
    items = TransferItemSerializer(many=True)
    receipts = TransferReceiptSerializer(many=True, read_only=True)

    class Meta:
        model = Transfer
        exclude = ["company"]
        read_only_fields = [
            "id",
            "number",
            "status",
            "created_by",
            "dispatched_by",
            "received_by",
            "dispatched_at",
            "received_at",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        company = self.context["request"].company
        if self.instance and self.instance.status != TransferStatus.DRAFT:
            raise serializers.ValidationError("Solo una transferencia en borrador puede editarse.")
        origin_branch = attrs.get("origin_branch", getattr(self.instance, "origin_branch", None))
        origin_warehouse = attrs.get("origin_warehouse", getattr(self.instance, "origin_warehouse", None))
        destination_branch = attrs.get("destination_branch", getattr(self.instance, "destination_branch", None))
        destination_warehouse = attrs.get(
            "destination_warehouse", getattr(self.instance, "destination_warehouse", None)
        )
        entities = [
            origin_branch,
            origin_warehouse,
            destination_branch,
            destination_warehouse,
        ]
        if any(entity is None or entity.company_id != company.id for entity in entities):
            raise serializers.ValidationError("Todas las ubicaciones deben pertenecer a la empresa.")
        if origin_warehouse.branch_id != origin_branch.id:
            raise serializers.ValidationError("El almacén origen no pertenece a su sucursal.")
        if destination_warehouse.branch_id != destination_branch.id:
            raise serializers.ValidationError("El almacén destino no pertenece a su sucursal.")
        if origin_warehouse.id == destination_warehouse.id:
            raise serializers.ValidationError("Los almacenes de origen y destino deben ser diferentes.")
        for branch in (origin_branch, destination_branch):
            ensure_branch_access(
                user=self.context["request"].user,
                company=company,
                branch_id=branch.id,
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        company = validated_data.pop("company", self.context["request"].company)
        origin_branch = validated_data["origin_branch"]
        number = _next_transfer_number(company, origin_branch)
        transfer = Transfer.objects.create(
            company=company, number=number, created_by=self.context["request"].user, **validated_data
        )
        for item in items_data:
            variant = item["variant"]
            lot = item.get("lot")
            if variant.company_id != company.id or (lot and lot.company_id != company.id):
                raise serializers.ValidationError("Producto o lote fuera de la empresa activa.")
            if lot and lot.variant_id != variant.id:
                raise serializers.ValidationError("El lote no pertenece a la presentación.")
            TransferItem.objects.create(company=company, transfer=transfer, **item)
        return transfer

    @transaction.atomic
    def update(self, instance, validated_data):
        if instance.status != TransferStatus.DRAFT:
            raise serializers.ValidationError("Solo una transferencia en borrador puede editarse.")
        items_data = validated_data.pop("items", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if items_data is not None:
            company = self.context["request"].company
            validated_items = []
            for item in items_data:
                variant = item["variant"]
                lot = item.get("lot")
                if variant.company_id != company.id or (lot and lot.company_id != company.id):
                    raise serializers.ValidationError("Producto o lote fuera de la empresa activa.")
                if lot and lot.variant_id != variant.id:
                    raise serializers.ValidationError("El lote no pertenece a la presentación.")
                validated_items.append(item)
            instance.items.all().delete()
            TransferItem.objects.bulk_create(
                [TransferItem(company=company, transfer=instance, **item) for item in validated_items]
            )
        return instance


class ReceiveLineSerializer(serializers.Serializer):
    item_id = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=16, decimal_places=3, min_value=Decimal("0.001"))


class ReceiveTransferSerializer(serializers.Serializer):
    items = ReceiveLineSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)
