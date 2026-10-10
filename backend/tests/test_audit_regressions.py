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


def test_discount_is_split_across_fefo_lots_and_totals_match(domain):
    receive_purchase(domain, quantity=Decimal("3"))
    lot = Lot.objects.create(
        company=domain["company"],
        variant=domain["variant"],
        batch_number="SECOND",
        expiry_date=timezone.localdate() + timedelta(days=400),
    )
    Stock.objects.create(
        company=domain["company"], warehouse=domain["origin_warehouse"], variant=domain["variant"], lot=lot, quantity=3
    )
    session = CashService.open_session(
        company=domain["company"], register_id=domain["register"].id, user=domain["user"], opening_amount=Decimal("0")
    )
    sale, _ = SaleService.checkout(
        company=domain["company"],
        branch=domain["origin_branch"],
        warehouse=domain["origin_warehouse"],
        terminal=domain["terminal"],
        cash_session_id=session.id,
        user=domain["user"],
        idempotency_key="audit-split",
        lines=[
            SaleLineInput(
                variant_id=domain["variant"].id, quantity=Decimal("5"), discount=Decimal("1"), discount_reason="Cliente"
            )
        ],
        payments=[PaymentInput(method=PaymentMethod.CASH, amount=Decimal("4"))],
    )
    items = list(sale.items.order_by("lot__expiry_date"))
    assert [item.quantity for item in items] == [Decimal("3"), Decimal("2")]
    assert sum(item.discount for item in items) == Decimal("1")
    assert sum(item.line_total for item in items) == sale.total == Decimal("4")


def test_product_with_expiry_always_tracks_lots(domain):
    product = domain["variant"].product
    product.requires_lot = False
    product.requires_expiry = True
    product.save()
    product.refresh_from_db()
    assert product.requires_lot is True


def test_admin_resets_password_only_for_users_of_own_company(domain):
    from apps.accounts.models import Membership, Role, User
    from apps.tenancy.models import Company

    client = APIClient()
    client.force_authenticate(domain["user"])
    headers = {"HTTP_X_COMPANY_ID": str(domain["company"].id)}
    cashier = User.objects.create_user(email="cajero@example.com", password="old-password-1", full_name="Cajero")
    membership = Membership.objects.create(user=cashier, company=domain["company"], role=Role.CASHIER)

    weak = client.post(f"/api/v1/users/{membership.id}/reset-password/", {"new_password": "12345678"}, **headers)
    assert weak.status_code == 400
    ok = client.post(
        f"/api/v1/users/{membership.id}/reset-password/", {"new_password": "Nueva-clave-segura-1"}, **headers
    )
    assert ok.status_code == 204
    cashier.refresh_from_db()
    assert cashier.check_password("Nueva-clave-segura-1")

    other = Company.objects.create(legal_name="Otra SAC", trade_name="Otra", tax_id="20888888881")
    Membership.objects.create(user=cashier, company=other, role=Role.CASHIER)
    shared = client.post(
        f"/api/v1/users/{membership.id}/reset-password/", {"new_password": "Otra-clave-segura-2"}, **headers
    )
    assert shared.status_code == 400
    cashier.refresh_from_db()
    assert cashier.check_password("Nueva-clave-segura-1")

    own = Membership.objects.get(user=domain["user"], company=domain["company"])
    assert (
        client.post(
            f"/api/v1/users/{own.id}/reset-password/", {"new_password": "Otra-clave-segura-3"}, **headers
        ).status_code
        == 400
    )


def test_initial_stock_import_previews_then_commits_atomically(domain):
    from django.core.files.uploadedfile import SimpleUploadedFile

    from apps.catalog.models import ProductBarcode
    from apps.inventory.models import InventoryMovement

    ProductBarcode.objects.create(
        company=domain["company"], variant=domain["variant"], code="7750000000012", is_primary=True
    )
    client = APIClient()
    client.force_authenticate(domain["user"])
    headers = {"HTTP_X_COMPANY_ID": str(domain["company"].id)}
    future = (timezone.localdate() + timedelta(days=400)).isoformat()

    def upload(text, commit=False):
        file = SimpleUploadedFile("stock.csv", text.encode("utf-8"), content_type="text/csv")
        data = {"file": file, **({"commit": "true"} if commit else {})}
        return client.post("/api/v1/products/stock-import/", data, format="multipart", **headers)

    header = "CODIGO_BARRAS,ALMACEN,LOTE,VENCIMIENTO,CANTIDAD,COSTO_REAL\n"
    bad = header + f"7750000000012,Almacen Central,,{future},10,1.5\n9999,Almacen Central,L1,{future},5,1\n"
    preview = upload(bad)
    assert preview.status_code == 200
    assert preview.data["error_count"] == 2
    assert upload(bad, commit=True).status_code == 400
    assert not Stock.objects.filter(variant=domain["variant"]).exists()

    good = header + f"7750000000012,ALM-C,l-100,{future},10,1.5\n"
    result = upload(good, commit=True)
    assert result.status_code == 201
    assert result.data["imported"] == 1
    stock = Stock.objects.get(variant=domain["variant"], warehouse=domain["origin_warehouse"])
    assert stock.quantity == Decimal("10")
    assert stock.lot.batch_number == "L-100"
    movement = InventoryMovement.objects.get(variant=domain["variant"])
    assert movement.unit_cost == Decimal("1.5")


def test_credit_sale_with_down_payment_can_be_cancelled_until_a_later_collection(domain):
    from datetime import date

    from apps.catalog.models import Customer
    from apps.core.choices import PaymentCondition
    from apps.finance.models import ReceivableAccount
    from apps.finance.services import FinanceService

    receive_purchase(domain)
    customer = Customer.objects.create(company=domain["company"], document_number="70000009", full_name="Cliente")
    session = CashService.open_session(
        company=domain["company"], register_id=domain["register"].id, user=domain["user"], opening_amount=Decimal("10")
    )

    def credit_sale(key):
        sale, _ = SaleService.checkout(
            company=domain["company"],
            branch=domain["origin_branch"],
            warehouse=domain["origin_warehouse"],
            terminal=domain["terminal"],
            cash_session_id=session.id,
            user=domain["user"],
            customer=customer,
            idempotency_key=key,
            payment_condition=PaymentCondition.CREDIT,
            payment_due_date=date.today() + timedelta(days=15),
            lines=[
                SaleLineInput(
                    variant_id=domain["variant"].id,
                    quantity=Decimal("4"),
                    unit_price=Decimal("1"),
                    discount=Decimal("0"),
                )
            ],
            payments=[PaymentInput(method=PaymentMethod.CASH, amount=Decimal("1"), received_amount=Decimal("1"))],
        )
        return sale

    first = credit_sale("credit-cancel-1")
    cancelled = SaleService.cancel(sale_id=first.id, company=domain["company"], user=domain["user"], reason="Error")
    assert cancelled.status == "CANCELLED"

    second = credit_sale("credit-cancel-2")
    account = ReceivableAccount.objects.get(sale=second)
    FinanceService.register_receivable_collection(
        account_id=account.id,
        company=domain["company"],
        user=domain["user"],
        amount=Decimal("1"),
        date=date.today(),
        method=PaymentMethod.CASH,
        cash_session=session,
        idempotency_key="credit-cancel-collection",
    )
    with pytest.raises(ValidationError):
        SaleService.cancel(sale_id=second.id, company=domain["company"], user=domain["user"], reason="Error")


def test_sale_uses_unlotted_stock_after_product_starts_tracking_lots(domain):
    from apps.inventory.models import MovementType
    from apps.inventory.services import InventoryService, MovementCommand

    product = domain["variant"].product
    product.requires_lot = False
    product.requires_expiry = False
    product.save()
    InventoryService.apply_movement(
        MovementCommand(
            company=domain["company"],
            warehouse=domain["origin_warehouse"],
            variant=domain["variant"],
            lot=None,
            movement_type=MovementType.ADJUSTMENT_IN,
            quantity=Decimal("5"),
            reference_type="test",
            reference_id=domain["variant"].id,
            performed_by=domain["user"],
        )
    )
    product.requires_expiry = True
    product.save()
    session = CashService.open_session(
        company=domain["company"], register_id=domain["register"].id, user=domain["user"], opening_amount=Decimal("0")
    )
    sale, _ = SaleService.checkout(
        company=domain["company"],
        branch=domain["origin_branch"],
        warehouse=domain["origin_warehouse"],
        terminal=domain["terminal"],
        cash_session_id=session.id,
        user=domain["user"],
        idempotency_key="unlotted-sale",
        lines=[
            SaleLineInput(
                variant_id=domain["variant"].id, quantity=Decimal("2"), unit_price=Decimal("1"), discount=Decimal("0")
            )
        ],
        payments=[PaymentInput(method=PaymentMethod.CASH, amount=Decimal("2"), received_amount=Decimal("2"))],
    )
    assert sale.items.get().lot is None
    assert Stock.objects.get(variant=domain["variant"], lot=None).quantity == Decimal("3")


def test_adjustment_out_beyond_stock_is_a_validation_error_not_500(domain):
    receive_purchase(domain, quantity=Decimal("3"))
    stock = Stock.objects.get(variant=domain["variant"])
    client = APIClient()
    client.force_authenticate(domain["user"])
    response = client.post(
        "/api/v1/stock/adjustments/",
        {
            "warehouse": str(stock.warehouse_id),
            "variant": str(stock.variant_id),
            "lot": str(stock.lot_id),
            "quantity": "50",
            "adjustment_type": "OUT",
            "reason": "Conteo fisico",
            "observation": "x" * 500,
        },
        format="json",
        HTTP_X_COMPANY_ID=str(domain["company"].id),
    )
    assert response.status_code == 400
