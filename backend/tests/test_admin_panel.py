"""Fase 4: el panel de superadmin (Django Unfold) carga y sus acciones cambian la suscripcion."""

from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from apps.accounts.models import User
from apps.tenancy.models import Company, SubscriptionStatus
from tests.test_critical_flows import domain  # noqa: F401


@pytest.fixture
def admin_client():
    superuser = User.objects.create_superuser(email="admin@botica.pe", password="Admin-12345", full_name="Admin")
    client = Client()
    client.force_login(superuser)
    return client


@pytest.mark.django_db
def test_admin_pages_load(admin_client, domain):  # noqa: F811
    company = domain["company"]
    for url in (
        "/admin/",
        "/admin/tenancy/company/",
        f"/admin/tenancy/company/{company.pk}/change/",
        "/admin/tenancy/subscriptionplan/",
        "/admin/accounts/user/",
        "/admin/accounts/user/add/",
        "/admin/sales/sale/",
        "/admin/catalog/product/",
        "/admin/audit/auditevent/",
    ):
        assert admin_client.get(url).status_code == 200, url


@pytest.mark.django_db
def test_admin_actions_change_subscription(admin_client, domain):  # noqa: F811
    company = domain["company"]
    company.subscription_status = SubscriptionStatus.TRIAL
    company.trial_ends_at = timezone.now() - timedelta(days=1)
    company.save()

    def run(action):
        return admin_client.post(
            "/admin/tenancy/company/",
            {"action": action, "_selected_action": [str(company.pk)]},
        )

    run("extend_trial_15_days")
    company.refresh_from_db()
    assert company.can_operate and company.trial_ends_at > timezone.now() + timedelta(days=14)

    run("suspend")
    company.refresh_from_db()
    assert company.subscription_status == SubscriptionStatus.SUSPENDED and not company.can_operate

    run("activate_plan")
    company.refresh_from_db()
    assert company.subscription_status == SubscriptionStatus.ACTIVE and company.can_operate


@pytest.mark.django_db
def test_non_staff_cannot_open_admin(domain):  # noqa: F811
    client = Client()
    client.force_login(domain["user"])
    assert client.get("/admin/").status_code == 302
    assert Company.objects.count() == 1
