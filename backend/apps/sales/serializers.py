from decimal import Decimal

from rest_framework import serializers

from apps.catalog.models import Customer
from apps.core.choices import PaymentCondition, PaymentMethod
from apps.sales.models import Sale, SaleItem, SalePayment
from apps.sales.services import PaymentInput, SaleLineInput, SaleService
from apps.tenancy.models import Branch, POSTerminal, Warehouse


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="variant.product.commercial_name", read_only=True)
    presentation = serializers.CharField(source="variant.presentation", read_only=True)
    batch_number = serializers.CharField(source="lot.batch_number", read_only=True, allow_null=True)

    class Meta:
        model = SaleItem
        exclude = ["company"]
        read_only_fields = [field.name for field in SaleItem._meta.fields if field.name != "company"]


class SalePaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalePayment
        exclude = ["company"]
        read_only_fields = [field.name for field in SalePayment._meta.fields if field.name != "company"]


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    payments = SalePaymentSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.full_name", read_only=True, allow_null=True)
    cashier_name = serializers.CharField(source="sold_by.full_name", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = Sale
        exclude = ["company"]
        read_only_fields = [field.name for field in Sale._meta.fields if field.name != "company"]


class CheckoutLineSerializer(serializers.Serializer):
    variant = serializers.UUIDField()
    lot = serializers.UUIDField(required=False, allow_null=True)
    quantity = serializers.DecimalField(max_digits=16, decimal_places=3, min_value=Decimal("0.001"))
    unit_price = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0, required=False)
    discount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0, default=0)
    discount_reason = serializers.CharField(max_length=240, required=False, allow_blank=True, default="")


class CheckoutPaymentSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=PaymentMethod.choices)
    amount = serializers.DecimalField(max_digits=16, decimal_places=2, min_value=Decimal("0.01"))
    received_amount = serializers.DecimalField(
        max_digits=16, decimal_places=2, min_value=0, required=False, allow_null=True
    )
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True)


class SaleCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=240)

    def save(self, **kwargs):
        request = self.context["request"]
        sale = self.context["sale"]
        return SaleService.cancel(
            sale_id=sale.id,
            company=request.company,
            user=request.user,
            reason=self.validated_data["reason"],
        )


class CheckoutSerializer(serializers.Serializer):
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all())
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.all())
    terminal = serializers.PrimaryKeyRelatedField(queryset=POSTerminal.objects.all())
    cash_session = serializers.UUIDField()
    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.all(), required=False, allow_null=True)
    idempotency_key = serializers.CharField(max_length=80)
    payment_condition = serializers.ChoiceField(choices=PaymentCondition.choices, default=PaymentCondition.CASH)
    payment_due_date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500, default="")
    items = CheckoutLineSerializer(many=True)
    payments = CheckoutPaymentSerializer(many=True, required=False, default=list)

    def create(self, validated_data):
        request = self.context["request"]
        lines = [
            SaleLineInput(
                variant_id=item["variant"],
                lot_id=item.get("lot"),
                quantity=item["quantity"],
                unit_price=item.get("unit_price"),
                discount=item.get("discount", Decimal("0")),
                discount_reason=item.get("discount_reason", ""),
            )
            for item in validated_data.pop("items")
        ]
        payments = [PaymentInput(**item) for item in validated_data.pop("payments")]
        sale, created = SaleService.checkout(
            company=request.company,
            user=request.user,
            lines=lines,
            payments=payments,
            cash_session_id=validated_data.pop("cash_session"),
            **validated_data,
        )
        self.created = created
        return sale
