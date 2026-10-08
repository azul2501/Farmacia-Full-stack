from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.core.choices import PaymentMethod
from apps.finance.models import (
    AccountStatus,
    FinancialCategory,
    FinancialMovement,
    FinancialOrigin,
    PayableAccount,
    PayablePayment,
    ReceivableAccount,
    ReceivableCollection,
)


class PayablePaymentSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source="performed_by.full_name", read_only=True)

    class Meta:
        model = PayablePayment
        exclude = ["company"]
        read_only_fields = [field.name for field in PayablePayment._meta.fields if field.name != "company"]


class ReceivableCollectionSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source="performed_by.full_name", read_only=True)

    class Meta:
        model = ReceivableCollection
        exclude = ["company"]
        read_only_fields = [field.name for field in ReceivableCollection._meta.fields if field.name != "company"]


class PayableAccountSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.__str__", read_only=True)
    purchase_number = serializers.CharField(source="purchase.document_number", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    effective_status = serializers.SerializerMethodField()
    payments = PayablePaymentSerializer(many=True, read_only=True)

    class Meta:
        model = PayableAccount
        exclude = ["company"]
        read_only_fields = [field.name for field in PayableAccount._meta.fields if field.name != "company"]

    def get_effective_status(self, obj) -> str:
        if obj.status in {AccountStatus.PENDING, AccountStatus.PARTIAL} and obj.balance > 0:
            if obj.due_date < timezone.localdate():
                return "OVERDUE"
        return obj.status


class ReceivableAccountSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    sale_number = serializers.CharField(source="sale.number", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    effective_status = serializers.SerializerMethodField()
    collections = ReceivableCollectionSerializer(many=True, read_only=True)

    class Meta:
        model = ReceivableAccount
        exclude = ["company"]
        read_only_fields = [field.name for field in ReceivableAccount._meta.fields if field.name != "company"]

    def get_effective_status(self, obj) -> str:
        if obj.status in {AccountStatus.PENDING, AccountStatus.PARTIAL} and obj.balance > 0:
            if obj.due_date < timezone.localdate():
                return "OVERDUE"
        return obj.status


class AccountTransactionInputSerializer(serializers.Serializer):
    date = serializers.DateField(default=timezone.localdate)
    amount = serializers.DecimalField(max_digits=16, decimal_places=2, min_value=Decimal("0.01"))
    method = serializers.ChoiceField(choices=PaymentMethod.choices)
    cash_session = serializers.UUIDField(required=False, allow_null=True)
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True)
    operation_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    idempotency_key = serializers.CharField(max_length=80)


class FinancialCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialCategory
        exclude = ["company"]
        read_only_fields = ["id", "created_at", "updated_at"]


class FinancialMovementSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)

    class Meta:
        model = FinancialMovement
        exclude = ["company"]
        read_only_fields = [field.name for field in FinancialMovement._meta.fields if field.name != "company"]


class ManualFinancialMovementInputSerializer(serializers.Serializer):
    branch = serializers.UUIDField()
    cash_session = serializers.UUIDField(required=False, allow_null=True)
    category = serializers.UUIDField()
    date = serializers.DateField(default=timezone.localdate)
    amount = serializers.DecimalField(max_digits=16, decimal_places=2, min_value=Decimal("0.01"))
    method = serializers.ChoiceField(choices=PaymentMethod.choices)
    origin = serializers.ChoiceField(choices=[FinancialOrigin.EXPENSE, FinancialOrigin.ADDITIONAL_INCOME])
    beneficiary_or_source = serializers.CharField(max_length=200, required=False, allow_blank=True)
    document_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    attachment = serializers.FileField(required=False)


class VoidFinancialMovementInputSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=5, max_length=240)
