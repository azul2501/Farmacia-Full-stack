import uuid

from django.db import transaction
from rest_framework import serializers

from apps.core.choices import PaymentCondition
from apps.core.permissions import ensure_branch_access
from apps.customer_requests.models import (
    CustomerRequest,
    CustomerRequestItem,
    CustomerRequestStatus,
    ServiceType,
)
from apps.customer_requests.services import CustomerRequestService
from apps.sales.serializers import CheckoutPaymentSerializer
from apps.tenancy.models import POSTerminal, Warehouse


class CustomerRequestItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="variant.product.commercial_name", read_only=True)
    presentation = serializers.CharField(source="variant.presentation", read_only=True)

    class Meta:
        model = CustomerRequestItem
        exclude = ["company", "request"]
        read_only_fields = ["id", "created_at", "updated_at"]


class CustomerRequestSerializer(serializers.ModelSerializer):
    code = serializers.CharField(read_only=True)
    items = CustomerRequestItemSerializer(many=True)
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    sale_number = serializers.CharField(source="converted_sale.number", read_only=True, allow_null=True)

    class Meta:
        model = CustomerRequest
        exclude = ["company"]
        read_only_fields = [
            "id",
            "code",
            "status",
            "created_by",
            "converted_sale",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        company = self.context["request"].company
        customer = attrs.get("customer", getattr(self.instance, "customer", None))
        branch = attrs.get("branch", getattr(self.instance, "branch", None))
        if customer and customer.company_id != company.id:
            raise serializers.ValidationError({"customer": "El cliente no pertenece a la empresa."})
        if branch and branch.company_id != company.id:
            raise serializers.ValidationError({"branch": "La sucursal no pertenece a la empresa."})
        if branch:
            ensure_branch_access(user=self.context["request"].user, company=company, branch_id=branch.id)
        if attrs.get("service_type") == ServiceType.SCHEDULED_DELIVERY and not attrs.get("delivery_address"):
            raise serializers.ValidationError({"delivery_address": "La direccion es obligatoria para entrega."})
        if self.instance and self.instance.status != CustomerRequestStatus.DRAFT:
            raise serializers.ValidationError("Solo una solicitud en borrador puede editarse.")
        if "items" in attrs and not attrs["items"]:
            raise serializers.ValidationError({"items": "Agrega al menos un producto."})
        return attrs

    def _validate_items(self, items, company):
        from apps.accounts.models import Membership
        from apps.accounts.permissions import permissions_for_role

        request = self.context["request"]
        membership = Membership.objects.filter(user=request.user, company=company, is_active=True).first()
        can_discount = request.user.is_superuser or (
            membership is not None and "sales.discount" in permissions_for_role(membership.role)
        )
        for item in items:
            if item["variant"].company_id != company.id:
                raise serializers.ValidationError({"items": "Una presentacion no pertenece a la empresa."})
            lot = item.get("preferred_lot")
            if lot and (lot.company_id != company.id or lot.variant_id != item["variant"].id):
                raise serializers.ValidationError({"items": "El lote preferido no corresponde al producto."})
            if item.get("authorized_discount", 0) > 0:
                if not can_discount:
                    raise serializers.ValidationError({"items": "El usuario no puede autorizar descuentos."})
                if not item.get("notes", "").strip():
                    raise serializers.ValidationError({"items": "Un descuento requiere un motivo."})
            item["reference_price"] = item["variant"].base_sale_price

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop("items")
        company = validated_data.pop("company", self.context["request"].company)
        self._validate_items(items, company)
        customer_request = CustomerRequest.objects.create(
            company=company,
            code=f"SOL-{uuid.uuid4().hex[:10].upper()}",
            created_by=self.context["request"].user,
            **validated_data,
        )
        CustomerRequestItem.objects.bulk_create(
            [CustomerRequestItem(company=company, request=customer_request, **item) for item in items]
        )
        return customer_request

    @transaction.atomic
    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        company = self.context["request"].company
        if items is not None:
            self._validate_items(items, company)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if items is not None:
            instance.items.all().delete()
            CustomerRequestItem.objects.bulk_create(
                [CustomerRequestItem(company=company, request=instance, **item) for item in items]
            )
        return instance


class ConvertCustomerRequestSerializer(serializers.Serializer):
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.all())
    terminal = serializers.PrimaryKeyRelatedField(queryset=POSTerminal.objects.all())
    cash_session = serializers.UUIDField()
    idempotency_key = serializers.CharField(max_length=80)
    payment_condition = serializers.ChoiceField(choices=PaymentCondition.choices, default=PaymentCondition.CASH)
    payment_due_date = serializers.DateField(required=False, allow_null=True)
    payments = CheckoutPaymentSerializer(many=True, required=False, default=list)

    def create(self, validated_data):
        request = self.context["request"]
        sale, created = CustomerRequestService.convert_to_sale(
            request_id=self.context["request_id"],
            company=request.company,
            user=request.user,
            cash_session_id=validated_data.pop("cash_session"),
            payments=validated_data.pop("payments"),
            **validated_data,
        )
        self.created = created
        return sale
