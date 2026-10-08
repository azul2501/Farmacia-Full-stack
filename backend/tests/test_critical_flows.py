from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Membership, Role, User
from apps.audit.models import AuditEvent
from apps.cash.models import CashCount, CashRegister
from apps.cash.services import CashService
from apps.catalog.models import Category, Customer, Product, ProductBarcode, ProductVariant, Supplier
from apps.core.choices import PaymentCondition, PaymentMethod
from apps.customer_requests.models import CustomerRequest, CustomerRequestItem, CustomerRequestStatus, ServiceType
from apps.customer_requests.services import CustomerRequestService
from apps.finance.models import (
    AccountStatus,
    FinancialCategory,
    FinancialCategoryType,
    PayableAccount,
    ReceivableAccount,
)
from apps.finance.services import FinanceService
from apps.inventory.models import InventoryMovement, Lot, MovementType, Stock
from apps.purchases.models import Purchase, PurchaseItem, PurchaseStatus
from apps.purchases.services import PurchaseService
from apps.sales.models import Sale
from apps.sales.services import PaymentInput, SaleLineInput, SaleService
from apps.tenancy.models import Branch, Company, POSTerminal, Warehouse
from apps.transfers.models import Transfer, TransferItem, TransferReceipt, TransferStatus
from apps.transfers.services import TransferService


@pytest.fixture
def domain():
    company = Company.objects.create(legal_name="Botica Test SAC", trade_name="Botica Test", tax_id="20111111111")
    user = User.objects.create_user(email="owner@example.com", password="test-password", full_name="Owner Test")
    Membership.objects.create(user=user, company=company, role=Role.OWNER)
    origin_branch = Branch.objects.create(company=company, code="CENTRAL", name="Central", address="Lima")
    destination_branch = Branch.objects.create(company=company, code="NORTE", name="Norte", address="Lima Norte")
    origin_warehouse = Warehouse.objects.create(
        company=company, branch=origin_branch, code="ALM-C", name="Almacen Central"
    )
    destination_warehouse = Warehouse.objects.create(
        company=company, branch=destination_branch, code="ALM-N", name="Almacen Norte"
    )
    supplier = Supplier.objects.create(
        company=company,
        document_number="20666666666",
        legal_name="Proveedor Test SAC",
    )
    category = Category.objects.create(company=company, name="Medicamentos")
    product = Product.objects.create(
        company=company,
        internal_code="MED-001",
        commercial_name="Paracetamol 500 mg",
        category=category,
        product_type=Product.ProductType.MEDICINE,
        requires_lot=True,
        requires_expiry=True,
    )
    variant = ProductVariant.objects.create(
        company=company,
        product=product,
        sku="PAR-500-TAB",
        presentation="Tableta",
        unit_of_measure="UNIDAD",
        sale_unit="UNIDAD",
        base_sale_price=Decimal("1.00"),
    )
    terminal = POSTerminal.objects.create(company=company, branch=origin_branch, code="POS-01", name="POS 01")
    register = CashRegister.objects.create(company=company, branch=origin_branch, code="CAJA-01", name="Caja 01")
    return {
        "company": company,
        "user": user,
        "origin_branch": origin_branch,
        "destination_branch": destination_branch,
        "origin_warehouse": origin_warehouse,
        "destination_warehouse": destination_warehouse,
        "supplier": supplier,
        "variant": variant,
        "terminal": terminal,
        "register": register,
    }


def receive_purchase(domain, quantity=Decimal("20")):
    purchase = Purchase.objects.create(
        company=domain["company"],
        supplier=domain["supplier"],
        branch=domain["origin_branch"],
        destination_warehouse=domain["origin_warehouse"],
        document_type="INVOICE",
        document_number="F001-1",
        document_date=date.today(),
        payment_method=PaymentMethod.TRANSFER,
        total=Decimal("10.00"),
        created_by=domain["user"],
    )
    PurchaseItem.objects.create(
        company=domain["company"],
        purchase=purchase,
        variant=domain["variant"],
        quantity=quantity,
        unit_cost=Decimal("0.50"),
        line_total=quantity * Decimal("0.50"),
        batch_number="LOT-001",
        expiry_date=date.today() + timedelta(days=365),
    )
    return PurchaseService.receive(purchase_id=purchase.id, company=domain["company"], user=domain["user"])


@pytest.mark.django_db
def test_purchase_sale_cash_flow_is_transactional_and_idempotent(domain):
    purchase = receive_purchase(domain)
    assert purchase.status == PurchaseStatus.CONFIRMED
    stock = Stock.objects.get(
        company=domain["company"],
        warehouse=domain["origin_warehouse"],
        variant=domain["variant"],
    )
    assert stock.quantity == Decimal("20")
    assert (
        InventoryMovement.objects.filter(reference_id=purchase.id, movement_type=MovementType.PURCHASE_IN).count() == 1
    )

    cash_session = CashService.open_session(
        company=domain["company"],
        register_id=domain["register"].id,
        user=domain["user"],
        opening_amount=Decimal("100.00"),
    )
    sale, created = SaleService.checkout(
        company=domain["company"],
        branch=domain["origin_branch"],
        warehouse=domain["origin_warehouse"],
        terminal=domain["terminal"],
        cash_session_id=cash_session.id,
        user=domain["user"],
        idempotency_key="checkout-001",
        lines=[
            SaleLineInput(
                variant_id=domain["variant"].id,
                quantity=Decimal("2"),
                unit_price=Decimal("1.00"),
                discount=Decimal("0"),
            )
        ],
        payments=[
            PaymentInput(
                method=PaymentMethod.CASH,
                amount=Decimal("2.00"),
                received_amount=Decimal("5.00"),
            )
        ],
    )
    assert created is True
    assert sale.change_total == Decimal("3.00")
    stock.refresh_from_db()
    cash_session.refresh_from_db()
    assert stock.quantity == Decimal("18")
    assert cash_session.expected_cash == Decimal("102.00")

    repeated, created = SaleService.checkout(
        company=domain["company"],
        branch=domain["origin_branch"],
        warehouse=domain["origin_warehouse"],
        terminal=domain["terminal"],
        cash_session_id=cash_session.id,
        user=domain["user"],
        idempotency_key="checkout-001",
        lines=[],
        payments=[],
    )
    stock.refresh_from_db()
    assert created is False
    assert repeated.id == sale.id
    assert stock.quantity == Decimal("18")
    assert Sale.objects.count() == 1


@pytest.mark.django_db
def test_transfer_dispatch_transit_and_partial_receipt(domain):
    receive_purchase(domain, quantity=Decimal("10"))
    lot = Lot.objects.get(company=domain["company"], variant=domain["variant"])
    transfer = Transfer.objects.create(
        company=domain["company"],
        number="TR-0001",
        origin_branch=domain["origin_branch"],
        origin_warehouse=domain["origin_warehouse"],
        destination_branch=domain["destination_branch"],
        destination_warehouse=domain["destination_warehouse"],
        created_by=domain["user"],
    )
    item = TransferItem.objects.create(
        company=domain["company"],
        transfer=transfer,
        variant=domain["variant"],
        lot=lot,
        requested_quantity=Decimal("6"),
    )

    TransferService.dispatch(transfer_id=transfer.id, company=domain["company"], user=domain["user"])
    origin_stock = Stock.objects.get(company=domain["company"], warehouse=domain["origin_warehouse"], lot=lot)
    assert origin_stock.quantity == Decimal("4")
    transfer.refresh_from_db()
    assert transfer.status == TransferStatus.DISPATCHED

    TransferService.start_transit(transfer_id=transfer.id, company=domain["company"], user=domain["user"])
    TransferService.receive(
        transfer_id=transfer.id,
        company=domain["company"],
        user=domain["user"],
        received_lines=[{"item_id": item.id, "quantity": Decimal("2")}],
    )
    transfer.refresh_from_db()
    assert transfer.status == TransferStatus.IN_TRANSIT
    destination_stock = Stock.objects.get(company=domain["company"], warehouse=domain["destination_warehouse"], lot=lot)
    assert destination_stock.quantity == Decimal("2")

    TransferService.receive(
        transfer_id=transfer.id,
        company=domain["company"],
        user=domain["user"],
        received_lines=[{"item_id": item.id, "quantity": Decimal("4")}],
    )
    transfer.refresh_from_db()
    destination_stock.refresh_from_db()
    assert transfer.status == TransferStatus.RECEIVED
    assert destination_stock.quantity == Decimal("6")


@pytest.mark.django_db
def test_api_pagination_tenant_context_and_role_policy(domain):
    receive_purchase(domain)
    client = APIClient()
    client.force_authenticate(domain["user"])
    headers = {"HTTP_X_COMPANY_ID": str(domain["company"].id)}

    response = client.get("/api/v1/stock/?page=1&pageSize=10", **headers)
    assert response.status_code == 200
    assert set(response.data) == {"items", "page", "pageSize", "total"}
    assert response.data["total"] == 1

    dashboard = client.get("/api/v1/reports/dashboard/", **headers)
    assert dashboard.status_code == 200
    assert "salesToday" in dashboard.data

    membership = Membership.objects.get(user=domain["user"], company=domain["company"])
    membership.role = Role.CASHIER
    membership.save(update_fields=["role", "updated_at"])
    forbidden = client.get("/api/v1/purchases/", **headers)
    assert forbidden.status_code == 403


@pytest.mark.django_db
def test_company_header_cannot_cross_tenants(domain):
    foreign_company = Company.objects.create(
        legal_name="Otra Botica SAC", trade_name="Otra Botica", tax_id="20222222222"
    )
    client = APIClient()
    client.force_authenticate(domain["user"])
    response = client.get("/api/v1/stock/", HTTP_X_COMPANY_ID=str(foreign_company.id))
    assert response.status_code == 403


@pytest.mark.django_db
def test_cookie_jwt_login_context_refresh_and_logout(domain):
    client = APIClient()
    login = client.post(
        "/api/v1/auth/login/",
        {"email": "owner@example.com", "password": "test-password"},
        format="json",
    )
    assert login.status_code == 200
    assert set(login.data) == {"access"}
    assert login.cookies["boticas_refresh"]["httponly"] is True

    context = client.get(
        "/api/v1/auth/context/",
        HTTP_AUTHORIZATION=f"Bearer {login.data['access']}",
        HTTP_X_COMPANY_ID=str(domain["company"].id),
    )
    assert context.status_code == 200
    assert context.data["user"]["email"] == "owner@example.com"
    assert context.data["membership"]["role"] == Role.OWNER
    assert "products.view" in context.data["permissions"]

    refreshed = client.post("/api/v1/auth/refresh/", format="json")
    assert refreshed.status_code == 200
    assert set(refreshed.data) == {"access"}
    assert refreshed.cookies["boticas_refresh"].value

    logout = client.post("/api/v1/auth/logout/", format="json")
    assert logout.status_code == 204
    assert logout.cookies["boticas_refresh"]["max-age"] == 0
    assert client.post("/api/v1/auth/refresh/", format="json").status_code == 401


@pytest.mark.django_db
def test_transfer_list_serializes_items(domain):
    receive_purchase(domain, quantity=Decimal("10"))
    lot = Lot.objects.get(company=domain["company"], variant=domain["variant"])
    transfer = Transfer.objects.create(
        company=domain["company"],
        number="TR-API-001",
        origin_branch=domain["origin_branch"],
        origin_warehouse=domain["origin_warehouse"],
        destination_branch=domain["destination_branch"],
        destination_warehouse=domain["destination_warehouse"],
        created_by=domain["user"],
    )
    TransferItem.objects.create(
        company=domain["company"],
        transfer=transfer,
        variant=domain["variant"],
        lot=lot,
        requested_quantity=Decimal("2"),
    )
    client = APIClient()
    client.force_authenticate(domain["user"])
    response = client.get(
        "/api/v1/transfers/?pageSize=100&ordering=number",
        HTTP_X_COMPANY_ID=str(domain["company"].id),
    )
    assert response.status_code == 200
    assert response.data["items"][0]["number"] == "TR-API-001"
    assert response.data["items"][0]["items"][0]["batch_number"] == "LOT-001"


@pytest.mark.django_db
def test_transfer_creation_via_api_autogenerates_sequential_number(domain):
    receive_purchase(domain, quantity=Decimal("10"))
    client = APIClient()
    client.force_authenticate(domain["user"])
    headers = {"HTTP_X_COMPANY_ID": str(domain["company"].id)}
    payload = {
        "origin_branch": str(domain["origin_branch"].id),
        "origin_warehouse": str(domain["origin_warehouse"].id),
        "destination_branch": str(domain["destination_branch"].id),
        "destination_warehouse": str(domain["destination_warehouse"].id),
        "items": [{"variant": str(domain["variant"].id), "requested_quantity": "2"}],
    }
    first = client.post("/api/v1/transfers/", payload, format="json", **headers)
    assert first.status_code == 201
    assert first.data["number"]
    second = client.post("/api/v1/transfers/", payload, format="json", **headers)
    assert second.status_code == 201
    assert second.data["number"] != first.data["number"]


@pytest.mark.django_db
def test_product_api_calculates_purchase_cost_and_margin(domain):
    client = APIClient()
    client.force_authenticate(domain["user"])
    payload = {
        "internal_code": "MED-PRICE-01",
        "commercial_name": "Producto con precio",
        "category": str(domain["variant"].product.category_id),
        "product_type": "MEDICINE",
        "requires_lot": False,
        "requires_expiry": False,
        "initial_variant": {
            "sku": "SKU-PRICE-01",
            "presentation": "Caja x 100",
            "unit_of_measure": "UNIT",
            "sale_unit": "UNIT",
            "conversion_factor": "1",
            "minimum_stock": "0",
            "purchase_pack_price": "100.00",
            "purchase_factor": "100",
            "sale_factor": "1",
            "base_sale_price": "1.50",
            "currency": "PEN",
        },
    }
    response = client.post("/api/v1/products/", payload, format="json", HTTP_X_COMPANY_ID=str(domain["company"].id))
    assert response.status_code == 201, response.data
    variant = ProductVariant.objects.get(sku="SKU-PRICE-01")
    assert variant.unit_purchase_cost == Decimal("1.0000")
    assert variant.unit_gain == Decimal("0.5000")
    assert variant.margin_on_cost == Decimal("50.00")

    payload["internal_code"] = "MED-PRICE-02"
    payload["initial_variant"] = {**payload["initial_variant"], "sku": "SKU-PRICE-02", "purchase_factor": "0"}
    invalid = client.post("/api/v1/products/", payload, format="json", HTTP_X_COMPANY_ID=str(domain["company"].id))
    assert invalid.status_code == 400


@pytest.mark.django_db
def test_simplified_product_api_generates_codes_and_finds_by_barcode(domain):
    client = APIClient()
    client.force_authenticate(domain["user"])
    payload = {
        "commercial_name": "Amoxicilina 500 mg",
        "category": str(domain["variant"].product.category_id),
        "usual_supplier": str(domain["supplier"].id),
        "product_type": "MEDICINE",
        "requires_lot": True,
        "requires_expiry": True,
        "health_surveillance": True,
        "initial_variant": {
            "presentation": "Caja x 100 capsulas",
            "unit_of_measure": "capsulas",
            "sale_unit": "UNIDAD",
            "conversion_factor": "1",
            "minimum_stock": "0",
            "purchase_pack_price": "100.00",
            "purchase_factor": "100",
            "sale_factor": "1",
            "base_sale_price": "1.50",
            "currency": "PEN",
            "barcode": "7750000000099",
        },
        "sale_variants": [
            {
                "sale_unit": "UNIDAD",
                "presentation": "Unidad",
                "contains_units": "1",
                "base_sale_price": "1.50",
            },
            {
                "sale_unit": "CAJA",
                "presentation": "Caja x 100",
                "contains_units": "100",
                "base_sale_price": "135.00",
            },
        ],
    }

    response = client.post("/api/v1/products/", payload, format="json", HTTP_X_COMPANY_ID=str(domain["company"].id))
    assert response.status_code == 201, response.data
    assert response.data["internal_code"].startswith("PRD-")
    assert response.data["health_surveillance"] is True
    product = Product.objects.get(id=response.data["id"])
    assert product.variants.count() == 2
    assert all(variant.sku for variant in product.variants.all())
    assert ProductBarcode.objects.filter(
        company=domain["company"], code="7750000000099", variant__product=product
    ).exists()

    found = client.get(
        "/api/v1/products/by-barcode/?code=7750000000099",
        HTTP_X_COMPANY_ID=str(domain["company"].id),
    )
    assert found.status_code == 200
    assert found.data["id"] == str(product.id)


@pytest.mark.django_db
def test_product_import_preview_commit_and_templates_use_business_headers(domain):
    client = APIClient()
    client.force_authenticate(domain["user"])
    headers = {"HTTP_X_COMPANY_ID": str(domain["company"].id)}

    template = client.get("/api/v1/products/template/", **headers)
    assert template.status_code == 200
    header_line = template.content.decode("utf-8-sig").splitlines()[0]
    assert "CATEGORIA" in header_line
    assert "LABORATORIO" in header_line
    assert "CATEGORIA_ID" not in header_line
    stock_template = client.get("/api/v1/products/stock-template/", **headers)
    assert stock_template.status_code == 200
    assert "LOTE" in stock_template.content.decode("utf-8-sig").splitlines()[0]

    csv_content = (
        "CODIGO_BARRAS,NOMBRE_COMERCIAL,CATEGORIA,LABORATORIO,UNIDAD_BASE,PRESENTACION_PRINCIPAL,"
        "SE_COMPRA_POR,CONTENIDO_POR_EMPAQUE,COSTO_COMPRA_EMPAQUE,VENDER_UNIDAD,PRECIO_UNIDAD,"
        "VENDER_BLISTER,UNIDADES_POR_BLISTER,PRECIO_BLISTER,VENDER_CAJA,PRECIO_CAJA,PRINCIPIO_ACTIVO,"
        "ACCION_TERAPEUTICA,PROVEEDOR_HABITUAL,REGISTRO_SANITARIO,CODIGO_DIGEMID,MANEJA_LOTES,"
        "CONTROLA_VENCIMIENTO,VENTA_CON_RECETA,MEDICAMENTO_CONTROLADO,VIGILANCIA_SANITARIA,"
        "ACUMULA_PUNTOS,INFORMACION_ADICIONAL\n"
        "7750000000100,Ibuprofeno 400 mg,Medicamentos,,tabletas,Caja x 100 tabletas,Caja,100,80.00,"
        "SI,1.20,NO,,,NO,,,,,,SI,SI,NO,NO,NO,SI,\n"
    )
    upload = SimpleUploadedFile("productos.csv", csv_content.encode("utf-8"), content_type="text/csv")
    preview = client.post("/api/v1/products/import-preview/", {"file": upload}, format="multipart", **headers)
    assert preview.status_code == 200, preview.data
    assert preview.data["valid_count"] == 1
    assert preview.data["error_count"] == 0

    commit = client.post(
        "/api/v1/products/import-commit/",
        {"rows": [preview.data["rows"][0]["payload"]]},
        format="json",
        **headers,
    )
    assert commit.status_code == 201, commit.data
    assert Product.objects.filter(company=domain["company"], commercial_name="Ibuprofeno 400 mg").exists()

    duplicate_upload = SimpleUploadedFile("productos.csv", csv_content.encode("utf-8"), content_type="text/csv")
    duplicate = client.post(
        "/api/v1/products/import-preview/", {"file": duplicate_upload}, format="multipart", **headers
    )
    assert duplicate.status_code == 200
    assert duplicate.data["error_count"] == 1


@pytest.mark.django_db
def test_credit_purchase_creates_one_payable_and_partial_payment(domain):
    purchase = Purchase.objects.create(
        company=domain["company"],
        supplier=domain["supplier"],
        branch=domain["origin_branch"],
        destination_warehouse=domain["origin_warehouse"],
        document_type="INVOICE",
        document_number="F-CREDIT-01",
        document_date=date.today(),
        payment_condition=PaymentCondition.CREDIT,
        payment_due_date=date.today() + timedelta(days=30),
        total=Decimal("10.00"),
        created_by=domain["user"],
    )
    PurchaseItem.objects.create(
        company=domain["company"],
        purchase=purchase,
        variant=domain["variant"],
        quantity=Decimal("10"),
        pack_quantity=Decimal("1"),
        purchase_pack_price=Decimal("10"),
        purchase_factor=Decimal("10"),
        unit_cost=Decimal("1"),
        line_total=Decimal("10"),
        batch_number="CREDIT-LOT",
        expiry_date=date.today() + timedelta(days=365),
    )
    PurchaseService.receive(purchase_id=purchase.id, company=domain["company"], user=domain["user"])
    account = PayableAccount.objects.get(purchase=purchase)
    assert PayableAccount.objects.filter(purchase=purchase).count() == 1
    payment, created = FinanceService.register_payable_payment(
        account_id=account.id,
        company=domain["company"],
        user=domain["user"],
        amount=Decimal("4"),
        date=date.today(),
        method=PaymentMethod.TRANSFER,
        idempotency_key="payable-test-1",
    )
    assert created and payment.amount == Decimal("4")
    repeated, created = FinanceService.register_payable_payment(
        account_id=account.id,
        company=domain["company"],
        user=domain["user"],
        amount=Decimal("4"),
        date=date.today(),
        method=PaymentMethod.TRANSFER,
        idempotency_key="payable-test-1",
    )
    account.refresh_from_db()
    assert not created and repeated.id == payment.id
    assert account.balance == Decimal("6") and account.status == AccountStatus.PARTIAL


@pytest.mark.django_db
def test_credit_sale_collection_and_cash_are_not_duplicated(domain):
    receive_purchase(domain)
    customer = Customer.objects.create(
        company=domain["company"], document_number="70000002", full_name="Cliente Credito"
    )
    session = CashService.open_session(
        company=domain["company"],
        register_id=domain["register"].id,
        user=domain["user"],
        opening_amount=Decimal("10"),
    )
    sale, _ = SaleService.checkout(
        company=domain["company"],
        branch=domain["origin_branch"],
        warehouse=domain["origin_warehouse"],
        terminal=domain["terminal"],
        cash_session_id=session.id,
        user=domain["user"],
        customer=customer,
        idempotency_key="credit-sale-1",
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
    account = ReceivableAccount.objects.get(sale=sale)
    assert account.original_amount == Decimal("4") and account.balance == Decimal("3")
    collection, created = FinanceService.register_receivable_collection(
        account_id=account.id,
        company=domain["company"],
        user=domain["user"],
        amount=Decimal("2"),
        date=date.today(),
        method=PaymentMethod.CASH,
        cash_session=session,
        idempotency_key="collection-test-1",
    )
    assert created and collection.amount == Decimal("2")
    account.refresh_from_db()
    session.refresh_from_db()
    sale.refresh_from_db()
    assert account.balance == Decimal("1") and account.status == AccountStatus.PARTIAL
    assert sale.balance_due == Decimal("1")
    assert session.expected_cash == Decimal("13")


@pytest.mark.django_db
def test_manual_finance_cash_count_and_close_rules(domain):
    session = CashService.open_session(
        company=domain["company"],
        register_id=domain["register"].id,
        user=domain["user"],
        opening_amount=Decimal("100"),
    )
    expense = FinancialCategory.objects.create(
        company=domain["company"], category_type=FinancialCategoryType.EXPENSE, name="Limpieza"
    )
    income = FinancialCategory.objects.create(
        company=domain["company"], category_type=FinancialCategoryType.INCOME, name="Servicio"
    )
    FinanceService.record_manual_movement(
        company=domain["company"],
        branch=domain["origin_branch"],
        user=domain["user"],
        category=expense,
        date=date.today(),
        amount=Decimal("20"),
        method=PaymentMethod.CASH,
        origin="EXPENSE",
        cash_session=session,
    )
    FinanceService.record_manual_movement(
        company=domain["company"],
        branch=domain["origin_branch"],
        user=domain["user"],
        category=income,
        date=date.today(),
        amount=Decimal("5"),
        method=PaymentMethod.CASH,
        origin="ADDITIONAL_INCOME",
        cash_session=session,
    )
    session.refresh_from_db()
    assert session.expected_cash == Decimal("85")
    with pytest.raises(ValidationError):
        CashService.close_session(
            session_id=session.id, company=domain["company"], user=domain["user"], counted_cash=Decimal("84")
        )
    CashService.close_session(
        session_id=session.id,
        company=domain["company"],
        user=domain["user"],
        counted_cash=Decimal("84"),
        notes="Falta por revisar",
    )
    assert CashCount.objects.filter(session=session, count_type="FINAL", difference=Decimal("-1")).count() == 1


@pytest.mark.django_db
def test_scheduled_request_does_not_touch_stock_until_conversion(domain):
    receive_purchase(domain)
    customer = Customer.objects.create(
        company=domain["company"], document_number="70000003", full_name="Cliente Agenda"
    )
    stock = Stock.objects.get(
        company=domain["company"], warehouse=domain["origin_warehouse"], variant=domain["variant"]
    )
    initial_stock = stock.quantity
    customer_request = CustomerRequest.objects.create(
        company=domain["company"],
        code="SOL-TEST-1",
        customer=customer,
        contact_phone="999999999",
        branch=domain["origin_branch"],
        scheduled_at=timezone.now() + timedelta(days=1),
        service_type=ServiceType.STORE_PICKUP,
        status=CustomerRequestStatus.CONFIRMED,
        created_by=domain["user"],
    )
    CustomerRequestItem.objects.create(
        company=domain["company"],
        request=customer_request,
        variant=domain["variant"],
        quantity=Decimal("2"),
        reference_price=Decimal("1"),
    )
    stock.refresh_from_db()
    assert stock.quantity == initial_stock
    session = CashService.open_session(
        company=domain["company"],
        register_id=domain["register"].id,
        user=domain["user"],
        opening_amount=Decimal("0"),
    )
    sale, created = CustomerRequestService.convert_to_sale(
        request_id=customer_request.id,
        company=domain["company"],
        user=domain["user"],
        warehouse=domain["origin_warehouse"],
        terminal=domain["terminal"],
        cash_session_id=session.id,
        idempotency_key="request-sale-1",
        payments=[{"method": PaymentMethod.CASH, "amount": Decimal("2"), "received_amount": Decimal("2")}],
        payment_condition=PaymentCondition.CASH,
    )
    stock.refresh_from_db()
    customer_request.refresh_from_db()
    assert created and customer_request.converted_sale_id == sale.id
    assert customer_request.status == CustomerRequestStatus.FULFILLED
    assert stock.quantity == initial_stock - Decimal("2")


@pytest.mark.django_db
def test_checkout_rejects_manipulated_price_and_uses_official_tax_calculation(domain):
    receive_purchase(domain)
    session = CashService.open_session(
        company=domain["company"],
        register_id=domain["register"].id,
        user=domain["user"],
        opening_amount=Decimal("0"),
    )
    client = APIClient()
    client.force_authenticate(domain["user"])
    headers = {"HTTP_X_COMPANY_ID": str(domain["company"].id)}
    payload = {
        "branch": str(domain["origin_branch"].id),
        "warehouse": str(domain["origin_warehouse"].id),
        "terminal": str(domain["terminal"].id),
        "cash_session": str(session.id),
        "idempotency_key": "tampered-price",
        "items": [
            {
                "variant": str(domain["variant"].id),
                "quantity": "2",
                "unit_price": "0.01",
                "discount": "0",
            }
        ],
        "payments": [{"method": "CASH", "amount": "0.02", "received_amount": "0.02"}],
    }
    rejected = client.post("/api/v1/sales/checkout/", payload, format="json", **headers)
    assert rejected.status_code == 400
    assert "precio oficial" in str(rejected.data).lower()
    assert not Sale.objects.filter(idempotency_key="tampered-price").exists()

    payload["idempotency_key"] = "excessive-discount"
    payload["items"][0].pop("unit_price")
    payload["items"][0]["discount"] = "3.00"
    payload["items"][0]["discount_reason"] = "Descuento invalido"
    excessive_discount = client.post("/api/v1/sales/checkout/", payload, format="json", **headers)
    assert excessive_discount.status_code == 400
    assert "superar" in str(excessive_discount.data).lower()

    payload["idempotency_key"] = "official-price"
    payload["items"][0]["discount"] = "0"
    payload["items"][0].pop("discount_reason")
    payload["payments"] = [{"method": "CASH", "amount": "2.00", "received_amount": "2.00"}]
    accepted = client.post("/api/v1/sales/checkout/", payload, format="json", **headers)
    assert accepted.status_code == 201, accepted.data
    sale = Sale.objects.get(id=accepted.data["id"])
    assert sale.subtotal == Decimal("2.00")
    assert sale.discount_total == Decimal("0.00")
    assert sale.tax_total == Decimal("0.31")
    assert sale.total == Decimal("2.00")
    assert sale.items.get().unit_price == Decimal("1.00")


@pytest.mark.django_db
def test_checkout_rejects_unauthorized_discount_and_audits_authorized_discount(domain):
    receive_purchase(domain)
    membership = Membership.objects.get(user=domain["user"], company=domain["company"])
    membership.role = Role.CASHIER
    membership.save(update_fields=["role", "updated_at"])
    membership.branches.set([domain["origin_branch"]])
    session = CashService.open_session(
        company=domain["company"],
        register_id=domain["register"].id,
        user=domain["user"],
        opening_amount=Decimal("0"),
    )
    client = APIClient()
    client.force_authenticate(domain["user"])
    headers = {"HTTP_X_COMPANY_ID": str(domain["company"].id)}
    payload = {
        "branch": str(domain["origin_branch"].id),
        "warehouse": str(domain["origin_warehouse"].id),
        "terminal": str(domain["terminal"].id),
        "cash_session": str(session.id),
        "idempotency_key": "unauthorized-discount",
        "items": [
            {
                "variant": str(domain["variant"].id),
                "quantity": "2",
                "unit_price": "1.00",
                "discount": "0.50",
                "discount_reason": "Promocion autorizada",
            }
        ],
        "payments": [{"method": "CASH", "amount": "1.50", "received_amount": "1.50"}],
    }
    rejected = client.post("/api/v1/sales/checkout/", payload, format="json", **headers)
    assert rejected.status_code == 400
    assert "permiso" in str(rejected.data).lower()

    membership.role = Role.OWNER
    membership.save(update_fields=["role", "updated_at"])
    payload["idempotency_key"] = "authorized-discount"
    accepted = client.post("/api/v1/sales/checkout/", payload, format="json", **headers)
    assert accepted.status_code == 201, accepted.data
    sale = Sale.objects.get(id=accepted.data["id"])
    event = AuditEvent.objects.get(action="sale.discount_authorized", resource_id=sale.id)
    detail = event.payload["discounts"][0]
    assert event.actor == domain["user"]
    assert detail["reason"] == "Promocion autorizada"
    assert detail["discount_amount"] == "0.50"
    assert detail["discount_percentage"] == "25.00"
    assert detail["final_value"] == "1.50"


@pytest.mark.django_db
def test_branch_scope_blocks_stock_purchase_request_reports_and_audit(domain):
    limited = User.objects.create_user(
        email="branch-admin@example.com",
        password="test-password",
        full_name="Administrador limitado",
    )
    membership = Membership.objects.create(
        user=limited,
        company=domain["company"],
        role=Role.BRANCH_ADMIN,
    )
    membership.branches.set([domain["origin_branch"]])
    foreign_purchase = Purchase.objects.create(
        company=domain["company"],
        supplier=domain["supplier"],
        branch=domain["destination_branch"],
        destination_warehouse=domain["destination_warehouse"],
        document_type="INVOICE",
        document_number="F-OTHER-BRANCH",
        document_date=date.today(),
        payment_method=PaymentMethod.TRANSFER,
        total=Decimal("1"),
        created_by=domain["user"],
    )
    customer = Customer.objects.create(
        company=domain["company"], document_number="70000010", full_name="Cliente otra sucursal"
    )
    customer_request = CustomerRequest.objects.create(
        company=domain["company"],
        code="SOL-OTHER-BRANCH",
        customer=customer,
        contact_phone="999999999",
        branch=domain["destination_branch"],
        scheduled_at=timezone.now() + timedelta(days=1),
        service_type=ServiceType.STORE_PICKUP,
        created_by=domain["user"],
    )
    AuditEvent.objects.create(
        company=domain["company"],
        branch=domain["destination_branch"],
        actor=domain["user"],
        action="test.other_branch",
        resource_type="tests.resource",
    )
    client = APIClient()
    client.force_authenticate(limited)
    headers = {"HTTP_X_COMPANY_ID": str(domain["company"].id)}

    adjustment = client.post(
        "/api/v1/stock/adjustments/",
        {
            "warehouse": str(domain["destination_warehouse"].id),
            "variant": str(domain["variant"].id),
            "quantity": "1",
            "adjustment_type": "IN",
            "reason": "Intento no autorizado",
        },
        format="json",
        **headers,
    )
    assert adjustment.status_code == 403
    purchase_receive = client.post(f"/api/v1/purchases/{foreign_purchase.id}/receive/", format="json", **headers)
    assert purchase_receive.status_code == 404
    request_transition = client.post(
        f"/api/v1/customer-requests/{customer_request.id}/submit/", format="json", **headers
    )
    assert request_transition.status_code == 404
    branch_report = client.get(f"/api/v1/reports/sales/?branch={domain['destination_branch'].id}", **headers)
    assert branch_report.status_code == 403
    audit = client.get("/api/v1/audit-events/?pageSize=100", **headers)
    assert audit.status_code == 200
    assert all(item["action"] != "test.other_branch" for item in audit.data["items"])


@pytest.mark.django_db
def test_cross_company_related_ids_and_memberships_are_isolated(domain):
    foreign_company = Company.objects.create(
        legal_name="Botica Extranjera SAC", trade_name="Botica Extranjera", tax_id="20999999991"
    )
    foreign_branch = Branch.objects.create(
        company=foreign_company, code="FOREIGN", name="Sucursal externa", address="Lima"
    )
    foreign_warehouse = Warehouse.objects.create(
        company=foreign_company, branch=foreign_branch, code="F-WH", name="Almacen externo"
    )
    foreign_terminal = POSTerminal.objects.create(
        company=foreign_company, branch=foreign_branch, code="F-POS", name="POS externo"
    )
    shared_user = User.objects.create_user(
        email="shared@example.com", password="original-password", full_name="Usuario compartido"
    )
    own_membership = Membership.objects.create(user=shared_user, company=domain["company"], role=Role.CASHIER)
    foreign_membership = Membership.objects.create(user=shared_user, company=foreign_company, role=Role.CASHIER)
    admin_client = APIClient()
    admin_client.force_authenticate(domain["user"])
    headers = {"HTTP_X_COMPANY_ID": str(domain["company"].id)}

    changed = admin_client.patch(
        f"/api/v1/users/{own_membership.id}/",
        {"email": "changed@example.com", "password": "changed-password"},
        format="json",
        **headers,
    )
    assert changed.status_code == 400
    shared_user.refresh_from_db()
    assert shared_user.email == "shared@example.com"
    assert shared_user.check_password("original-password")
    assert (
        admin_client.patch(
            f"/api/v1/users/{foreign_membership.id}/",
            {"role": Role.BRANCH_ADMIN},
            format="json",
            **headers,
        ).status_code
        == 404
    )

    own_client = APIClient()
    own_client.force_authenticate(shared_user)
    own_password_change = own_client.post(
        "/api/v1/auth/password/change/",
        {"current_password": "original-password", "new_password": "New-secure-password-123!"},
        format="json",
        **headers,
    )
    assert own_password_change.status_code == 204, own_password_change.data
    shared_user.refresh_from_db()
    assert shared_user.check_password("New-secure-password-123!")

    receive_purchase(domain)
    session = CashService.open_session(
        company=domain["company"],
        register_id=domain["register"].id,
        user=domain["user"],
        opening_amount=Decimal("0"),
    )
    cross_checkout = admin_client.post(
        "/api/v1/sales/checkout/",
        {
            "branch": str(foreign_branch.id),
            "warehouse": str(foreign_warehouse.id),
            "terminal": str(foreign_terminal.id),
            "cash_session": str(session.id),
            "idempotency_key": "foreign-related-ids",
            "items": [{"variant": str(domain["variant"].id), "quantity": "1"}],
            "payments": [{"method": "CASH", "amount": "1", "received_amount": "1"}],
        },
        format="json",
        **headers,
    )
    assert cross_checkout.status_code == 400
    assert not Sale.objects.filter(idempotency_key="foreign-related-ids").exists()


@pytest.mark.django_db
def test_dispatched_transfer_cannot_be_edited_deleted_or_cancelled_and_receipt_is_traced(domain):
    receive_purchase(domain, quantity=Decimal("10"))
    lot = Lot.objects.get(company=domain["company"], variant=domain["variant"])
    transfer = Transfer.objects.create(
        company=domain["company"],
        number="TR-LOCKED-001",
        origin_branch=domain["origin_branch"],
        origin_warehouse=domain["origin_warehouse"],
        destination_branch=domain["destination_branch"],
        destination_warehouse=domain["destination_warehouse"],
        created_by=domain["user"],
    )
    item = TransferItem.objects.create(
        company=domain["company"],
        transfer=transfer,
        variant=domain["variant"],
        lot=lot,
        requested_quantity=Decimal("6"),
    )
    TransferService.dispatch(transfer_id=transfer.id, company=domain["company"], user=domain["user"])
    origin_stock = Stock.objects.get(company=domain["company"], warehouse=domain["origin_warehouse"], lot=lot)
    dispatched_stock = origin_stock.quantity

    client = APIClient()
    client.force_authenticate(domain["user"])
    headers = {"HTTP_X_COMPANY_ID": str(domain["company"].id)}
    assert (
        client.patch(
            f"/api/v1/transfers/{transfer.id}/",
            {"notes": "Edicion indebida"},
            format="json",
            **headers,
        ).status_code
        == 400
    )
    assert client.delete(f"/api/v1/transfers/{transfer.id}/", **headers).status_code == 400
    assert client.post(f"/api/v1/transfers/{transfer.id}/cancel/", format="json", **headers).status_code == 400
    origin_stock.refresh_from_db()
    assert origin_stock.quantity == dispatched_stock

    TransferService.start_transit(transfer_id=transfer.id, company=domain["company"], user=domain["user"])
    received = client.post(
        f"/api/v1/transfers/{transfer.id}/receive/",
        {"items": [{"item_id": str(item.id), "quantity": "2"}], "notes": "Recepcion parcial"},
        format="json",
        **headers,
    )
    assert received.status_code == 200, received.data
    receipt = TransferReceipt.objects.get(transfer=transfer)
    receipt_line = receipt.items.get()
    assert receipt.received_by == domain["user"]
    assert receipt.received_at is not None
    assert receipt_line.expected_quantity == Decimal("6")
    assert receipt_line.received_quantity == Decimal("2")
    assert receipt_line.difference_quantity == Decimal("4")


@pytest.mark.django_db
def test_product_search_and_exact_barcode_work_beyond_first_hundred_products(domain):
    products = [
        Product(
            company=domain["company"],
            internal_code=f"MASS-{index:03d}",
            commercial_name=f"Producto masivo {index:03d}",
            category=domain["variant"].product.category,
            product_type=Product.ProductType.MEDICINE,
            requires_lot=False,
            requires_expiry=False,
        )
        for index in range(101)
    ]
    products.append(
        Product(
            company=domain["company"],
            internal_code="TARGET-OVER-100",
            commercial_name="Producto objetivo remoto",
            category=domain["variant"].product.category,
            product_type=Product.ProductType.MEDICINE,
            requires_lot=False,
            requires_expiry=False,
        )
    )
    Product.objects.bulk_create(products)
    variants = [
        ProductVariant(
            company=domain["company"],
            product=product,
            sku=f"SKU-{product.internal_code}",
            presentation="Unidad",
            unit_of_measure="UNIT",
            sale_unit="UNIT",
            base_sale_price=Decimal("1"),
        )
        for product in products
    ]
    ProductVariant.objects.bulk_create(variants)
    target_variant = ProductVariant.objects.get(company=domain["company"], sku="SKU-TARGET-OVER-100")
    ProductBarcode.objects.create(
        company=domain["company"], variant=target_variant, code="7759999999999", is_primary=True
    )
    client = APIClient()
    client.force_authenticate(domain["user"])
    headers = {"HTTP_X_COMPANY_ID": str(domain["company"].id)}

    search = client.get("/api/v1/products/?search=objetivo+remoto&pageSize=20", **headers)
    assert search.status_code == 200
    assert search.data["total"] == 1
    assert search.data["items"][0]["commercial_name"] == "Producto objetivo remoto"
    barcode = client.get("/api/v1/product-variants/by-barcode/?code=7759999999999", **headers)
    assert barcode.status_code == 200
    assert barcode.data["id"] == str(target_variant.id)


@pytest.mark.django_db
def test_sale_cancel_reverses_stock_and_cash_and_is_not_repeatable(domain):
    receive_purchase(domain)
    stock = Stock.objects.get(
        company=domain["company"], warehouse=domain["origin_warehouse"], variant=domain["variant"]
    )
    session = CashService.open_session(
        company=domain["company"],
        register_id=domain["register"].id,
        user=domain["user"],
        opening_amount=Decimal("50"),
    )
    sale, _ = SaleService.checkout(
        company=domain["company"],
        branch=domain["origin_branch"],
        warehouse=domain["origin_warehouse"],
        terminal=domain["terminal"],
        cash_session_id=session.id,
        user=domain["user"],
        idempotency_key="cancel-flow-1",
        lines=[
            SaleLineInput(
                variant_id=domain["variant"].id,
                quantity=Decimal("3"),
                unit_price=Decimal("1"),
                discount=Decimal("0"),
            )
        ],
        payments=[PaymentInput(method=PaymentMethod.CASH, amount=Decimal("3"), received_amount=Decimal("3"))],
    )
    stock.refresh_from_db()
    session.refresh_from_db()
    assert stock.quantity == Decimal("17")
    assert session.expected_cash == Decimal("53")

    with pytest.raises(ValidationError):
        SaleService.cancel(sale_id=sale.id, company=domain["company"], user=domain["user"], reason="  ")

    cancelled = SaleService.cancel(
        sale_id=sale.id, company=domain["company"], user=domain["user"], reason="Cliente se arrepintio"
    )
    stock.refresh_from_db()
    session.refresh_from_db()
    assert cancelled.status == "CANCELLED"
    assert stock.quantity == Decimal("20")
    assert session.expected_cash == Decimal("50")
    assert (
        InventoryMovement.objects.filter(reference_id=sale.id, movement_type=MovementType.RETURN_IN).count() == 1
    )

    with pytest.raises(ValidationError):
        SaleService.cancel(sale_id=sale.id, company=domain["company"], user=domain["user"], reason="Otra vez")


@pytest.mark.django_db
def test_sale_cancel_blocks_when_cash_session_already_closed(domain):
    receive_purchase(domain)
    session = CashService.open_session(
        company=domain["company"],
        register_id=domain["register"].id,
        user=domain["user"],
        opening_amount=Decimal("10"),
    )
    sale, _ = SaleService.checkout(
        company=domain["company"],
        branch=domain["origin_branch"],
        warehouse=domain["origin_warehouse"],
        terminal=domain["terminal"],
        cash_session_id=session.id,
        user=domain["user"],
        idempotency_key="cancel-flow-closed-session",
        lines=[
            SaleLineInput(
                variant_id=domain["variant"].id,
                quantity=Decimal("1"),
                unit_price=Decimal("1"),
                discount=Decimal("0"),
            )
        ],
        payments=[PaymentInput(method=PaymentMethod.CASH, amount=Decimal("1"), received_amount=Decimal("1"))],
    )
    CashService.close_session(
        session_id=session.id, company=domain["company"], user=domain["user"], counted_cash=Decimal("11")
    )
    with pytest.raises(ValidationError):
        SaleService.cancel(sale_id=sale.id, company=domain["company"], user=domain["user"], reason="Devolucion")


@pytest.mark.django_db
def test_sale_cancel_endpoint_requires_management_role(domain):
    receive_purchase(domain)
    session = CashService.open_session(
        company=domain["company"],
        register_id=domain["register"].id,
        user=domain["user"],
        opening_amount=Decimal("10"),
    )
    sale, _ = SaleService.checkout(
        company=domain["company"],
        branch=domain["origin_branch"],
        warehouse=domain["origin_warehouse"],
        terminal=domain["terminal"],
        cash_session_id=session.id,
        user=domain["user"],
        idempotency_key="cancel-flow-api",
        lines=[
            SaleLineInput(
                variant_id=domain["variant"].id,
                quantity=Decimal("1"),
                unit_price=Decimal("1"),
                discount=Decimal("0"),
            )
        ],
        payments=[PaymentInput(method=PaymentMethod.CASH, amount=Decimal("1"), received_amount=Decimal("1"))],
    )
    cashier = User.objects.create_user(email="cashier@example.com", password="test-password", full_name="Cajero")
    Membership.objects.create(user=cashier, company=domain["company"], role=Role.CASHIER, is_active=True)
    client = APIClient()
    client.force_authenticate(cashier)
    headers = {"HTTP_X_COMPANY_ID": str(domain["company"].id)}
    denied = client.post(f"/api/v1/sales/{sale.id}/cancel/", {"reason": "Prueba"}, **headers)
    assert denied.status_code == 403

    client.force_authenticate(domain["user"])
    allowed = client.post(f"/api/v1/sales/{sale.id}/cancel/", {"reason": "Prueba"}, **headers)
    assert allowed.status_code == 200
    assert allowed.data["status"] == "CANCELLED"
