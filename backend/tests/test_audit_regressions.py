"""Casos de aceptación de auditoría; los fallos documentan defectos pendientes."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient

from apps.cash.services import CashService
from apps.core.choices import PaymentMethod
from apps.inventory.models import Lot, Stock
from apps.sales.services import PaymentInput, SaleLineInput, SaleService
from tests.test_critical_flows import domain as domain_fixture
from tests.test_critical_flows import receive_purchase

pytestmark = pytest.mark.django_db
domain = domain_fixture


def test_purchase_discount_cannot_create_negative_payable(domain):
    client = APIClient()
    client.force_authenticate(domain["user"])
    response = client.post(
        "/api/v1/purchases/",
        {
            "supplier": str(domain["supplier"].id),
            "branch": str(domain["origin_branch"].id),
            "destination_warehouse": str(domain["origin_warehouse"].id),
            "document_type": "INVOICE",
            "document_number": "AUDIT-NEGATIVE",
            "document_date": str(timezone.localdate()),
            "payment_condition": "CREDIT",
            "payment_due_date": str(timezone.localdate() + timedelta(days=30)),
            "items": [
                {
                    "variant": str(domain["variant"].id),
                    "pack_quantity": "1",
                    "purchase_factor": "1",
                    "purchase_pack_price": "10",
                    "discount": "20",
                    "expiry_date": str(timezone.localdate() + timedelta(days=365)),
                }
            ],
        },
        format="json",
    )
    assert response.status_code == 400, response.data


def checkout(data, *, lot=None, quantity="2", received="2", method=PaymentMethod.CASH):
    session = CashService.open_session(
        company=data["company"], register_id=data["register"].id, user=data["user"], opening_amount=Decimal("100")
    )
    sale, _ = SaleService.checkout(
        company=data["company"],
        branch=data["origin_branch"],
        warehouse=data["origin_warehouse"],
        terminal=data["terminal"],
        cash_session_id=session.id,
        user=data["user"],
        idempotency_key="audit-sale",
        lines=[
            SaleLineInput(
                variant_id=data["variant"].id,
                quantity=Decimal(quantity),
                discount=Decimal("0"),
                lot_id=lot.id if lot else None,
            )
        ],
        payments=[PaymentInput(method=method, amount=Decimal(quantity), received_amount=Decimal(received))],
    )
    return sale, session


def test_explicit_expired_lot_must_be_rejected(domain):
    receive_purchase(domain)
    lot = Lot.objects.get()
    lot.expiry_date = timezone.localdate() - timedelta(days=1)
    lot.save()
    with pytest.raises(ValidationError):
        checkout(domain, lot=lot)


def test_zero_cash_received_must_be_rejected(domain):
    receive_purchase(domain)
    with pytest.raises(ValidationError):
        checkout(domain, received="0")


def test_cancelled_card_sale_must_not_count_in_cash_breakdown(domain):
    receive_purchase(domain)
    sale, session = checkout(domain, method=PaymentMethod.CARD)
    SaleService.cancel(sale_id=sale.id, company=domain["company"], user=domain["user"], reason="Error")
    assert CashService.expected_breakdown(session=session)["card_sales"] == Decimal("0")


def test_sale_uses_combined_available_lots(domain):
    receive_purchase(domain, quantity=Decimal("3"))
    lot = Lot.objects.create(
        company=domain["company"],
        variant=domain["variant"],
        batch_number="SECOND",
        expiry_date=timezone.localdate() + timedelta(days=400),
    )
    Stock.objects.create(
        company=domain["company"],
        warehouse=domain["origin_warehouse"],
        variant=domain["variant"],
        lot=lot,
        quantity=Decimal("3"),
    )
    sale, _ = checkout(domain, quantity="5", received="5")
    assert sale.total == Decimal("5")
    assert sum(Stock.objects.values_list("quantity", flat=True)) == Decimal("1")


def test_fefo_consumes_earliest_lot_even_when_later_lot_covers_sale(domain):
    receive_purchase(domain, quantity=Decimal("3"))
    first = Stock.objects.get()
    lot = Lot.objects.create(
        company=domain["company"],
        variant=domain["variant"],
        batch_number="SECOND",
        expiry_date=timezone.localdate() + timedelta(days=400),
    )
    Stock.objects.create(
        company=domain["company"],
        warehouse=domain["origin_warehouse"],
        variant=domain["variant"],
        lot=lot,
        quantity=Decimal("10"),
    )
    checkout(domain, quantity="5", received="5")
    first.refresh_from_db()
    assert first.quantity == Decimal("0")
