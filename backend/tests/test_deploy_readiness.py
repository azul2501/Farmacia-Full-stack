from datetime import date

import pytest
from django.core.management import CommandError, call_command
from rest_framework.test import APIClient

from apps.accounts.models import Membership, Role, User
from apps.cash.models import CashRegister
from apps.tenancy.models import Company, POSTerminal, Warehouse
from tests.test_critical_flows import domain as domain_fixture

domain = domain_fixture

OWNER_ARGS = [
    "--ruc=20600000001",
    "--razon-social=Botica Real SAC",
    "--nombre-comercial=Botica Real",
    "--email=Duenio@Botica.pe",
    "--nombre=Dueña Real",
]


@pytest.mark.django_db
def test_crear_empresa_creates_a_usable_tenant(monkeypatch):
    monkeypatch.setenv("OWNER_PASSWORD", "Farmacia-Segura-2026")
    call_command("crear_empresa", *OWNER_ARGS)

    company = Company.objects.get(tax_id="20600000001")
    user = User.objects.get(email="duenio@botica.pe")
    assert user.check_password("Farmacia-Segura-2026")
    membership = Membership.objects.get(user=user, company=company)
    assert membership.role == Role.OWNER
    branch = membership.branches.get()
    assert Warehouse.objects.filter(company=company, branch=branch).count() == 1
    assert POSTerminal.objects.filter(company=company, branch=branch).count() == 1
    assert CashRegister.objects.filter(company=company, branch=branch).count() == 1

    client = APIClient()
    response = client.post(
        "/api/v1/auth/login/", {"email": "duenio@botica.pe", "password": "Farmacia-Segura-2026"}, format="json"
    )
    assert response.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    assert client.get("/api/v1/branches/").data["total"] == 1


@pytest.mark.django_db
def test_crear_empresa_rejects_weak_password_and_duplicates(monkeypatch):
    monkeypatch.setenv("OWNER_PASSWORD", "12345678")
    with pytest.raises(CommandError):
        call_command("crear_empresa", *OWNER_ARGS)
    assert not Company.objects.exists()

    monkeypatch.setenv("OWNER_PASSWORD", "Farmacia-Segura-2026")
    call_command("crear_empresa", *OWNER_ARGS)
    with pytest.raises(CommandError):
        call_command("crear_empresa", *OWNER_ARGS)


@pytest.mark.django_db
def test_purchase_without_pack_fields_is_a_validation_error_not_500(domain):
    client = APIClient()
    client.force_authenticate(domain["user"])
    payload = {
        "supplier": str(domain["supplier"].id),
        "branch": str(domain["origin_branch"].id),
        "destination_warehouse": str(domain["origin_warehouse"].id),
        "document_type": "INVOICE",
        "document_number": "F001-1",
        "document_date": date.today().isoformat(),
        "items": [{"variant": str(domain["variant"].id), "quantity": "10", "unit_cost": "2.00"}],
    }
    response = client.post("/api/v1/purchases/", payload, format="json", HTTP_X_COMPANY_ID=str(domain["company"].id))
    assert response.status_code == 400
    assert "pack_quantity" in str(response.data)
