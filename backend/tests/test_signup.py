"""Fase 3: registro autonomo de boticas y bloqueo por suscripcion."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Membership, Role, User
from apps.cash.models import CashRegister
from apps.cash.services import CashService
from apps.sales.services import PaymentInput, SaleLineInput, SaleService
from apps.tenancy.models import Branch, Company, POSTerminal, SubscriptionPlan, SubscriptionStatus, Warehouse
from apps.tenancy.ruc import RucLookup, is_valid_ruc_format, lookup_ruc
from tests.test_critical_flows import domain, receive_purchase  # noqa: F401

VALID_RUC = "20600000005"


def signup_payload(**overrides):
    payload = {
        "trade_name": "Botica San Juan",
        "ruc": VALID_RUC,
        "address": "Av. Los Olivos 123, Lima",
        "owner_full_name": "Rosa Quispe",
        "phone": "987654321",
        "email": "rosa@botica.pe",
        "password": "Clave-Segura-2026",
    }
    payload.update(overrides)
    return payload


def test_ruc_format_uses_sunat_check_digit():
    assert is_valid_ruc_format("20131312955")
    assert is_valid_ruc_format(VALID_RUC)
    assert not is_valid_ruc_format("20600000006")  # digito verificador incorrecto
    assert not is_valid_ruc_format("30600000005")  # no empieza con 10 ni 20
    assert not is_valid_ruc_format("2060000000")


def test_ruc_lookup_is_skipped_when_not_configured(settings):
    settings.RUC_LOOKUP_URL = ""
    assert lookup_ruc(VALID_RUC).verified is None


@pytest.mark.django_db
def test_signup_creates_a_ready_to_sell_pharmacy():
    assert SubscriptionPlan.default_plan() is not None  # creado por la migracion
    response = APIClient().post("/api/v1/signup/", signup_payload(), format="json")
    assert response.status_code == 201, response.data
    company = Company.objects.get(tax_id=VALID_RUC)
    assert company.subscription_status == SubscriptionStatus.TRIAL
    assert company.trial_ends_at > timezone.now() + timedelta(days=29)
    assert company.can_operate
    assert company.tax_id_verified is False  # sin servicio de RUC configurado
    branch = Branch.objects.get(company=company)
    assert Warehouse.objects.filter(company=company, branch=branch).count() == 1
    assert POSTerminal.objects.filter(company=company, branch=branch).count() == 1
    assert CashRegister.objects.filter(company=company, branch=branch).count() == 1
    user = User.objects.get(email="rosa@botica.pe")
    assert user.check_password("Clave-Segura-2026")
    membership = Membership.objects.get(user=user, company=company)
    assert membership.role == Role.OWNER

    login = APIClient().post(
        "/api/v1/auth/login/", {"email": "rosa@botica.pe", "password": "Clave-Segura-2026"}, format="json"
    )
    assert login.status_code == 200


@pytest.mark.django_db
def test_signup_rejects_invalid_or_repeated_data(domain):  # noqa: F811
    client = APIClient()
    assert client.post("/api/v1/signup/", signup_payload(ruc="20600000006"), format="json").status_code == 400
    assert client.post("/api/v1/signup/", signup_payload(email="owner@example.com"), format="json").status_code == 400
    assert client.post("/api/v1/signup/", signup_payload(password="123"), format="json").status_code == 400
    assert client.post("/api/v1/signup/", signup_payload(), format="json").status_code == 201
    repeated = client.post("/api/v1/signup/", signup_payload(email="otra@botica.pe"), format="json")
    assert repeated.status_code == 400  # mismo RUC


@pytest.mark.django_db
def test_signup_rejects_ruc_that_sunat_reports_inactive(monkeypatch):
    monkeypatch.setattr(
        "apps.tenancy.signup.lookup_ruc",
        lambda ruc: RucLookup(verified=False, reason="El RUC figura como BAJA DE OFICIO en SUNAT."),
    )
    response = APIClient().post("/api/v1/signup/", signup_payload(), format="json")
    assert response.status_code == 400
    assert not Company.objects.filter(tax_id=VALID_RUC).exists()


@pytest.mark.django_db
def test_signup_marks_ruc_verified_when_sunat_confirms(monkeypatch):
    monkeypatch.setattr(
        "apps.tenancy.signup.lookup_ruc",
        lambda ruc: RucLookup(verified=True, legal_name="BOTICA SAN JUAN E.I.R.L."),
    )
    assert APIClient().post("/api/v1/signup/", signup_payload(), format="json").status_code == 201
    company = Company.objects.get(tax_id=VALID_RUC)
    assert company.tax_id_verified is True
    assert company.legal_name == "BOTICA SAN JUAN E.I.R.L."


@pytest.mark.django_db
def test_expired_trial_cannot_sell(domain):  # noqa: F811
    receive_purchase(domain)
    session = CashService.open_session(
        company=domain["company"],
        register_id=domain["register"].id,
        user=domain["user"],
        opening_amount=Decimal("10"),
    )
    company = domain["company"]
    company.subscription_status = SubscriptionStatus.TRIAL
    company.trial_ends_at = timezone.now() - timedelta(days=1)
    company.save(update_fields=["subscription_status", "trial_ends_at", "updated_at"])
    assert not company.can_operate
    with pytest.raises(ValidationError, match="periodo de prueba"):
        SaleService.checkout(
            company=company,
            branch=domain["origin_branch"],
            warehouse=domain["origin_warehouse"],
            terminal=domain["terminal"],
            cash_session_id=session.id,
            user=domain["user"],
            idempotency_key="expired-trial-sale",
            lines=[
                SaleLineInput(
                    variant_id=domain["variant"].id,
                    quantity=Decimal("1"),
                    unit_price=Decimal("1"),
                    discount=Decimal("0"),
                )
            ],
            payments=[PaymentInput(method="CASH", amount=Decimal("1"), received_amount=Decimal("1"))],
        )
