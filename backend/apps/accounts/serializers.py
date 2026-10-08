from django.contrib.auth import password_validation
from django.db import transaction
from django.utils.crypto import get_random_string
from rest_framework import serializers

from apps.accounts.models import Membership, Role, User
from apps.core.permissions import ensure_branch_access, get_active_membership
from apps.tenancy.models import Branch
from apps.tenancy.serializers import BranchSummarySerializer, CompanySerializer


class AccessTokenSerializer(serializers.Serializer):
    access = serializers.CharField(read_only=True)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "phone", "is_active"]
        read_only_fields = ["id"]


class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    company = CompanySerializer(read_only=True)
    branches = BranchSummarySerializer(many=True, read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "user", "company", "role", "branches", "is_active"]


class SessionContextSerializer(serializers.Serializer):
    user = UserSerializer()
    active_company = CompanySerializer()
    membership = MembershipSerializer()
    available_branches = BranchSummarySerializer(many=True)
    permissions = serializers.ListField(child=serializers.CharField())


class CompanyUserSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    email = serializers.EmailField(source="user.email", required=False)
    full_name = serializers.CharField(source="user.full_name", max_length=180, required=False)
    phone = serializers.CharField(source="user.phone", required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    branch_ids = serializers.PrimaryKeyRelatedField(
        source="branches", many=True, queryset=Branch.objects.all(), required=False
    )

    class Meta:
        model = Membership
        fields = [
            "id",
            "user_id",
            "email",
            "full_name",
            "phone",
            "password",
            "role",
            "branch_ids",
            "is_active",
        ]

    def validate_role(self, role):
        request = self.context["request"]
        if role == Role.SUPERADMIN and not request.user.is_superuser:
            raise serializers.ValidationError("Solo un superusuario puede asignar SUPERADMIN.")
        membership = get_active_membership(user=request.user, company=request.company)
        if membership and membership.role == Role.BRANCH_ADMIN and role in {Role.OWNER, Role.SUPERADMIN}:
            raise serializers.ValidationError("Un administrador de sucursal no puede asignar un rol global.")
        return role

    def validate(self, attrs):
        sensitive_fields = {"email", "full_name", "phone", "password"}
        if self.instance is not None:
            attempted = sensitive_fields.intersection(self.initial_data)
            if attempted:
                message = "Los datos globales del usuario no se modifican desde una membresia."
                raise serializers.ValidationError({field: message for field in attempted})
            return attrs

        user_data = attrs.get("user", {})
        email = user_data.get("email")
        if not email:
            raise serializers.ValidationError({"email": "El correo es obligatorio."})
        self.existing_user = User.objects.filter(email__iexact=email).first()
        if self.existing_user:
            if Membership.objects.filter(user=self.existing_user, company=self.context["request"].company).exists():
                raise serializers.ValidationError({"email": "El usuario ya pertenece a esta empresa."})
            if attrs.get("password"):
                raise serializers.ValidationError(
                    {"password": "No se puede cambiar la clave de un usuario global existente."}
                )
        else:
            if not user_data.get("full_name"):
                raise serializers.ValidationError({"full_name": "El nombre es obligatorio para un usuario nuevo."})
            if not attrs.get("password"):
                raise serializers.ValidationError({"password": "La clave inicial es obligatoria."})
        role = attrs.get("role", getattr(self.instance, "role", None))
        branches = attrs.get("branches", self.instance.branches.all() if self.instance else [])
        if role in {Role.BRANCH_ADMIN, Role.WAREHOUSE_OPERATOR, Role.CASHIER} and not branches:
            raise serializers.ValidationError({"branch_ids": "El rol requiere al menos una sucursal autorizada."})
        return attrs

    def validate_branch_ids(self, branches):
        company = self.context["request"].company
        if any(branch.company_id != company.id for branch in branches):
            raise serializers.ValidationError("Una sucursal no pertenece a la empresa activa.")
        for branch in branches:
            ensure_branch_access(
                user=self.context["request"].user,
                company=company,
                branch_id=branch.id,
            )
        return branches

    @transaction.atomic
    def create(self, validated_data):
        user_data = validated_data.pop("user")
        branches = validated_data.pop("branches", [])
        password = validated_data.pop("password", None) or get_random_string(24)
        user = getattr(self, "existing_user", None)
        if user is None:
            user = User.objects.create_user(password=password, **user_data)
        membership = Membership.objects.create(user=user, company=self.context["request"].company, **validated_data)
        membership.branches.set(branches)
        return membership

    @transaction.atomic
    def update(self, instance, validated_data):
        branches = validated_data.pop("branches", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if branches is not None:
            instance.branches.set(branches)
        return instance


class ChangeOwnPasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("La clave actual no es correcta.")
        return value

    def validate_new_password(self, value):
        password_validation.validate_password(value, self.context["request"].user)
        return value
