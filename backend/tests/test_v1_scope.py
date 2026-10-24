"""Reglas de la V1: las funciones de versiones posteriores no se exponen ni se pueden usar."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.test import override_settings
from rest_framework.test import APIClient

from apps.accounts.models import Membership, Role
from apps.cash.services import CashService
from apps.catalog.models import Customer
from apps.core.choices import PaymentCondition
from apps.core.features import feature_enabled
from apps.sales.services import SaleLineInput, SaleService
from tests.test_critical_flows import domain, receive_purchase  # noqa: F401

V1 = override_settings(APP_VERSION=1)


def api_client(domain):  # noqa: F811
    client = APIClient()
    client.force_authenticate(domain["user"])
    return client, {"HTTP_X_COMPANY_ID": str(domain["company"].id)}


def test_feature_versions_follow_published_version():
    with override_settings(APP_VERSION=1):
        assert not feature_enabled("transfers")
        assert not feature_enabled("credit_sales")
        assert feature_enabled("una_funcion_sin_version")
    with override_settings(APP_VERSION=2):
        assert feature_enabled("credit_sales")
        assert not feature_enabled("transfers")
    with override_settings(APP_VERSION=3):
        assert feature_enabled("transfers")


@pytest.mark.django_db
@V1
def test_v1_hides_later_version_endpoints(domain):  # noqa: F811
    client, headers = api_client(domain)
    for url in (
        "/api/v1/transfers/",
        "/api/v1/payables/",
        "/api/v1/receivables/",
        "/api/v1/financial-categories/",
        "/api/v1/financial-movements/",
        "/api/v1/customer-requests/",
    ):
        assert client.get(url, **headers).status_code == 404, url
    for url in ("/api/v1/products/", "/api/v1/stock/", "/api/v1/sales/", "/api/v1/reports/dashboard/"):
        assert client.get(url, **headers).status_code == 200, url
    assert client.get("/api/v1/reports/dashboard/", **headers).data["pendingTransfers"] == 0


@pytest.mark.django_db
@V1
def test_v1_rejects_credit_sales(domain):  # noqa: F811
    receive_purchase(domain)
    customer = Customer.objects.create(company=domain["company"], document_number="70000009", full_name="Cliente")
    session = CashService.open_session(
        company=domain["company"],
        register_id=domain["register"].id,
        user=domain["user"],
        opening_amount=Decimal("10"),
    )
    with pytest.raises(ValidationError, match="crédito no están disponibles"):
        SaleService.checkout(
            company=domain["company"],
            branch=domain["origin_branch"],
            warehouse=domain["origin_warehouse"],
            terminal=domain["terminal"],
            cash_session_id=session.id,
            user=domain["user"],
            customer=customer,
            idempotency_key="v1-credit-sale",
            payment_condition=PaymentCondition.CREDIT,
            payment_due_date=date.today() + timedelta(days=15),
            lines=[
                SaleLineInput(
                    variant_id=domain["variant"].id,
                    quantity=Decimal("1"),
                    unit_price=Decimal("1"),
                    discount=Decimal("0"),
                )
            ],
            payments=[],
        )


@pytest.mark.django_db
@V1
def test_v1_only_offers_owner_and_cashier_and_assigns_the_store(domain):  # noqa: F811
    client, headers = api_client(domain)
    base = {"full_name": "Usuario Nuevo", "password": "Clave-Segura-123"}

    rejected = client.post(
        "/api/v1/users/",
        {**base, "email": "almacen@example.com", "role": Role.WAREHOUSE_OPERATOR},
        format="json",
        **headers,
    )
    assert rejected.status_code == 400

    created = client.post(
        "/api/v1/users/",
        {**base, "email": "cajero@example.com", "role": Role.CASHIER},
        format="json",
        **headers,
    )
    assert created.status_code == 201, created.data
    membership = Membership.objects.get(user__email="cajero@example.com", company=domain["company"])
    assert membership.branches.count() == 2  # el fixture tiene dos sucursales activas

