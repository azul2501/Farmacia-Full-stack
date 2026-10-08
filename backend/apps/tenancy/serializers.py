from rest_framework import serializers

from apps.core.permissions import ensure_branch_access
from apps.tenancy.models import Branch, Company, POSTerminal, Warehouse


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "legal_name", "trade_name", "tax_id", "timezone", "currency", "is_active"]
        read_only_fields = ["id"]


class BranchSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["id", "code", "name", "address", "is_active"]


class BranchSerializer(BranchSummarySerializer):
    class Meta(BranchSummarySerializer.Meta):
        fields = [*BranchSummarySerializer.Meta.fields, "phone", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class WarehouseSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = Warehouse
        fields = [
            "id",
            "branch",
            "branch_name",
            "code",
            "name",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_branch(self, branch):
        company = self.context["request"].company
        if branch.company_id != company.id:
            raise serializers.ValidationError("La sucursal no pertenece a la empresa activa.")
        ensure_branch_access(user=self.context["request"].user, company=company, branch_id=branch.id)
        return branch


class POSTerminalSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = POSTerminal
        fields = ["id", "branch", "branch_name", "code", "name", "is_active"]
        read_only_fields = ["id"]

    def validate_branch(self, branch):
        request = self.context["request"]
        if branch.company_id != request.company.id:
            raise serializers.ValidationError("La sucursal no pertenece a la empresa activa.")
        ensure_branch_access(user=request.user, company=request.company, branch_id=branch.id)
        return branch
