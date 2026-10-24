"""Registro autonomo de una botica nueva (fase 3 de la V1).

Crea en una sola transaccion la empresa, su sucursal, almacen, terminal y caja, y el usuario dueño.
La botica entra en periodo de prueba segun el plan por defecto. En la V1 no se envia ningun correo.
"""

from datetime import timedelta

from django.contrib.auth import password_validation
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.models import Membership, Role, User
from apps.audit.services import record_audit
from apps.cash.models import CashRegister
from apps.tenancy.models import Branch, Company, POSTerminal, SubscriptionPlan, SubscriptionStatus, Warehouse
from apps.tenancy.ruc import is_valid_ruc_format, lookup_ruc


class SignupSerializer(serializers.Serializer):
    trade_name = serializers.CharField(max_length=160)
    ruc = serializers.CharField(max_length=11, min_length=11)
    address = serializers.CharField(max_length=250)
    owner_full_name = serializers.CharField(max_length=180)
    phone = serializers.CharField(max_length=30)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_ruc(self, ruc):
        ruc = ruc.strip()
        if not is_valid_ruc_format(ruc):
            raise serializers.ValidationError("El RUC no es válido. Debe tener 11 dígitos y empezar con 10 o 20.")
        if Company.objects.filter(tax_id=ruc).exists():
            raise serializers.ValidationError("Ya existe una botica registrada con este RUC.")
        return ruc

    def validate_email(self, email):
        email = email.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo. Inicia sesión.")
        return email

    def validate(self, attrs):
        password_validation.validate_password(
            attrs["password"], User(email=attrs["email"], full_name=attrs["owner_full_name"])
        )
        lookup = lookup_ruc(attrs["ruc"])
        if lookup.verified is False:
            raise serializers.ValidationError({"ruc": lookup.reason or "El RUC no está activo en SUNAT."})
        attrs["ruc_lookup"] = lookup
        return attrs


class SignupResultSerializer(serializers.Serializer):
    company_id = serializers.UUIDField()
    trade_name = serializers.CharField()
    email = serializers.EmailField()
    ruc_verified = serializers.BooleanField()
    trial_ends_at = serializers.DateTimeField(allow_null=True)


def trial_settings():
    """Plan por defecto y fin de la prueba para una botica nueva."""
    plan = SubscriptionPlan.default_plan()
    trial_days = plan.trial_days if plan else 30
    return plan, timezone.now() + timedelta(days=trial_days)


def provision_store(*, company, address, phone, owner_full_name, owner_email, owner_password):
    """Deja lista para vender una botica de una sola tienda: sucursal, almacen, terminal, caja y dueño."""
    branch = Branch.objects.create(company=company, code="PRINCIPAL", name="Principal", address=address, phone=phone)
    Warehouse.objects.create(company=company, branch=branch, code="TIENDA", name="Tienda")
    POSTerminal.objects.create(company=company, branch=branch, code="POS-01", name="Mostrador")
    CashRegister.objects.create(company=company, branch=branch, code="CAJA-01", name="Caja 1")
    user = User.objects.create_user(
        email=owner_email, password=owner_password, full_name=owner_full_name, phone=phone
    )
    membership = Membership.objects.create(user=user, company=company, role=Role.OWNER)
    membership.branches.set([branch])
    return user


class SignupService:
    @staticmethod
    @transaction.atomic
    def register(*, trade_name, ruc, address, owner_full_name, phone, email, password, ruc_lookup):
        plan, trial_ends_at = trial_settings()
        company = Company.objects.create(
            legal_name=ruc_lookup.legal_name or trade_name,
            trade_name=trade_name,
            tax_id=ruc,
            subscription_plan=plan,
            subscription_status=SubscriptionStatus.TRIAL,
            trial_ends_at=trial_ends_at,
            tax_id_verified=bool(ruc_lookup.verified),
        )
        user = provision_store(
            company=company,
            address=address,
            phone=phone,
            owner_full_name=owner_full_name,
            owner_email=email,
            owner_password=password,
        )
        record_audit(
            company=company,
            actor=user,
            action="company.signup",
            resource=company,
            payload={"ruc_verified": company.tax_id_verified, "plan": plan.name if plan else None},
        )
        return company, user


class SignupView(APIView):
    """Registro publico. Sin autenticacion y con limite de intentos por IP."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "signup"

    @extend_schema(request=SignupSerializer, responses={201: SignupResultSerializer})
    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        company, user = SignupService.register(
            trade_name=data["trade_name"].strip(),
            ruc=data["ruc"],
            address=data["address"].strip(),
            owner_full_name=data["owner_full_name"].strip(),
            phone=data["phone"].strip(),
            email=data["email"],
            password=data["password"],
            ruc_lookup=data["ruc_lookup"],
        )
        result = SignupResultSerializer(
            {
                "company_id": company.id,
                "trade_name": company.trade_name,
                "email": user.email,
                "ruc_verified": company.tax_id_verified,
                "trial_ends_at": company.trial_ends_at,
            }
        )
        return Response(result.data, status=status.HTTP_201_CREATED)
