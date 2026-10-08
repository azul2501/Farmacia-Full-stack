from decimal import Decimal

from rest_framework import serializers

from apps.cash.models import CashCount, CashCountType, CashMovement, CashRegister, CashSession
from apps.core.permissions import ensure_branch_access


class CashRegisterSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = CashRegister
        exclude = ["company"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_branch(self, branch):
        request = self.context["request"]
        if branch.company_id != request.company.id:
            raise serializers.ValidationError("La sucursal no pertenece a la empresa activa.")
        ensure_branch_access(user=request.user, company=request.company, branch_id=branch.id)
        return branch


class CashMovementSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source="performed_by.full_name", read_only=True)

    class Meta:
        model = CashMovement
        exclude = ["company"]
        read_only_fields = [field.name for field in CashMovement._meta.fields if field.name != "company"]


class CashSessionSerializer(serializers.ModelSerializer):
    register_name = serializers.CharField(source="register.name", read_only=True)
    opened_by_name = serializers.CharField(source="opened_by.full_name", read_only=True)
    movements = CashMovementSerializer(many=True, read_only=True)

    class Meta:
        model = CashSession
        exclude = ["company"]
        read_only_fields = [field.name for field in CashSession._meta.fields if field.name != "company"]


class OpenCashSerializer(serializers.Serializer):
    register = serializers.UUIDField()
    opening_amount = serializers.DecimalField(max_digits=16, decimal_places=2, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True)


class CashMovementInputSerializer(serializers.Serializer):
    movement_type = serializers.ChoiceField(choices=["MANUAL_IN", "WITHDRAWAL"])
    amount = serializers.DecimalField(max_digits=16, decimal_places=2, min_value=Decimal("0.01"))
    reason = serializers.CharField(max_length=240)


class CloseCashSerializer(serializers.Serializer):
    counted_cash = serializers.DecimalField(max_digits=16, decimal_places=2, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True)


class CashCountSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source="performed_by.full_name", read_only=True)

    class Meta:
        model = CashCount
        exclude = ["company"]
        read_only_fields = [field.name for field in CashCount._meta.fields if field.name != "company"]


class CashCountInputSerializer(serializers.Serializer):
    count_type = serializers.ChoiceField(choices=CashCountType.choices)
    counted_cash = serializers.DecimalField(max_digits=16, decimal_places=2, min_value=0)
    counted_breakdown = serializers.DictField(
        child=serializers.DecimalField(max_digits=16, decimal_places=2, min_value=0), required=False
    )
    observation = serializers.CharField(required=False, allow_blank=True)
