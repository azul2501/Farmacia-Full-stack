"""Catalogo maestro de DIGEMID, alertas sanitarias y alta completa de boticas desde el panel."""

from decimal import Decimal

import pytest
from django.core.management import call_command
from django.test import Client
from rest_framework.test import APIClient

from apps.accounts.models import Membership, Role, User
from apps.catalog.models import Product, ProductBarcode
from apps.digemid.alerts_sync import candidate_urls, parse_alert_text
from apps.digemid.catalog_import import import_catalog
from apps.digemid.models import DigemidAlert, MasterBarcode, MasterProduct
from apps.tenancy.models import Branch, Company, SubscriptionStatus, Warehouse
from tests.test_critical_flows import domain, receive_purchase  # noqa: F401

CATALOG_CSV = (
    "Cod_Prod;Nom_Prod;Concent;Nom_Form_Farm;Presentac;Num_RegSan;Nom_Titular;Situacion\n"
    "1001;PARACETAMOL;500 mg;Tableta;Caja x 100;N-12345;LAB UNO S.A.C.;ACT\n"
    "1002;IBUPROFENO;400 mg;Tableta;Caja x 50;N-22222;LAB DOS S.A.;ACT\n"
    ";SIN CODIGO;1 mg;Tableta;;;;\n"
)


def api_client(domain):  # noqa: F811
    client = APIClient()
    client.force_authenticate(domain["user"])
    return client, {"HTTP_X_COMPANY_ID": str(domain["company"].id)}


@pytest.mark.django_db
def test_catalog_import_reads_digemid_columns_and_updates(tmp_path):
    path = tmp_path / "catalogo.csv"
    path.write_text("Catálogo de Productos Farmacéuticos\n" + CATALOG_CSV, encoding="utf-8")
    result = import_catalog(path)
    assert result.rows_saved == 2 and result.rows_skipped == 1
    assert result.mapping["digemid_code"] == "Cod_Prod"
    product = MasterProduct.objects.get(digemid_code="1001")
    assert (product.name, product.concentration, product.sanitary_registration) == ("PARACETAMOL", "500 mg", "N-12345")

    path.write_text(CATALOG_CSV.replace("Caja x 100", "Caja x 200"), encoding="utf-8")
    import_catalog(path)
    assert MasterProduct.objects.count() == 2
    assert MasterProduct.objects.get(digemid_code="1001").presentation == "Caja x 200"


@pytest.mark.django_db
def test_catalog_import_dry_run_saves_nothing(tmp_path):
    path = tmp_path / "catalogo.csv"
    path.write_text(CATALOG_CSV, encoding="utf-8")
    result = import_catalog(path, dry_run=True)
    assert result.rows_saved == 2
    assert MasterProduct.objects.count() == 0


@pytest.mark.django_db
def test_base_catalog_loads_generics_brands_and_supplies():
    call_command("load_base_catalog")
    assert MasterProduct.objects.filter(digemid_code__startswith="RM220-").count() == 434
    paracetamol = MasterProduct.objects.get(digemid_code="RM220-362")
    assert (paracetamol.name, paracetamol.concentration, paracetamol.dosage_form) == ("Paracetamol", "500mg", "Tableta")
    assert paracetamol.suggested_price == Decimal("0.10")
    assert MasterProduct.objects.filter(product_type="SUPPLY").exists()
    total = MasterProduct.objects.count()

    paracetamol.suggested_price = Decimal("0.15")
    paracetamol.save(update_fields=["suggested_price"])
    call_command("load_base_catalog", "--if-empty")  # ya cargada: no pisa el precio cambiado
    assert MasterProduct.objects.count() == total
    assert MasterProduct.objects.get(digemid_code="RM220-362").suggested_price == Decimal("0.15")


@pytest.mark.django_db
def test_supply_from_catalog_does_not_require_lot(domain):  # noqa: F811
    supply = MasterProduct.objects.create(
        digemid_code="BASE-900", name="Alcohol medicinal 70°", product_type="SUPPLY", suggested_price=Decimal("3.50")
    )
    client, headers = api_client(domain)
    found = client.get("/api/v1/digemid/products/?search=alcohol", **headers)
    assert found.data["items"][0]["suggested_price"] == "3.50"
    added = client.post(f"/api/v1/digemid/products/{supply.id}/add/", {"sale_price": "3.50"}, format="json", **headers)
    assert added.status_code == 201, added.data
    product = Product.objects.get(company=domain["company"], digemid_code="BASE-900")
    assert product.product_type == Product.ProductType.SUPPLY
    assert not product.requires_lot and not product.requires_expiry
    assert product.category.name == "Insumos y cuidado personal"


@pytest.mark.django_db
def test_search_and_add_master_product_to_pharmacy(domain):  # noqa: F811
    master = MasterProduct.objects.create(
        digemid_code="1001", name="PARACETAMOL", concentration="500 mg", dosage_form="Tableta",
        sanitary_registration="N-12345", manufacturer="LAB UNO S.A.C.",
    )
    client, headers = api_client(domain)
    assert client.get("/api/v1/digemid/products/?search=pa", **headers).data["total"] == 0  # minimo 3 letras
    found = client.get("/api/v1/digemid/products/?search=paracetamol 500", **headers)
    assert found.status_code == 200 and found.data["total"] == 1
    assert found.data["items"][0]["in_my_catalog"] is False

    added = client.post(
        f"/api/v1/digemid/products/{master.id}/add/",
        {"sale_price": "0.50", "purchase_price": "0.20", "barcode": "7750000000017"},
        format="json",
        **headers,
    )
    assert added.status_code == 201, added.data
    product = Product.objects.get(company=domain["company"], digemid_code="1001")
    assert product.sanitary_registration == "N-12345"
    assert product.laboratory.name == "LAB UNO S.A.C."
    assert ProductBarcode.objects.filter(company=domain["company"], code="7750000000017").exists()
    assert MasterBarcode.objects.get(code="7750000000017").master_product == master

    again = client.get("/api/v1/digemid/products/?search=paracetamol", **headers)
    assert again.data["items"][0]["in_my_catalog"] is True
    repeated = client.post(f"/api/v1/digemid/products/{master.id}/add/", {"sale_price": "1"}, format="json", **headers)
    assert repeated.status_code == 400

    by_barcode = client.get("/api/v1/digemid/products/by-barcode/?code=7750000000017", **headers)
    assert by_barcode.status_code == 200 and by_barcode.data["digemid_code"] == "1001"
    assert client.get("/api/v1/digemid/products/by-barcode/?code=000", **headers).status_code == 404


@pytest.mark.django_db
def test_cashier_cannot_add_products_from_catalog(domain):  # noqa: F811
    master = MasterProduct.objects.create(digemid_code="2002", name="IBUPROFENO")
    membership = Membership.objects.get(user=domain["user"], company=domain["company"])
    membership.role = Role.CASHIER
    membership.save(update_fields=["role", "updated_at"])
    membership.branches.set([domain["origin_branch"]])
    client, headers = api_client(domain)
    response = client.post(f"/api/v1/digemid/products/{master.id}/add/", {"sale_price": "1"}, format="json", **headers)
    assert response.status_code == 403


def test_alert_pdf_text_is_parsed():
    parsed = parse_alert_text(
        "ALERTA DIGEMID Nº 011-2026\nRetiro del mercado del lote Nº 2304067 del producto MEGACILINA B, "
        "con Registro Sanitario N° EE-05782. Los lotes: AB1234, CD-5678 y 99X01."
    )
    assert parsed.title.startswith("ALERTA DIGEMID")
    assert parsed.sanitary_registrations == ["EE-05782"]
    assert parsed.lot_numbers == ["2304067", "AB1234", "CD-5678", "99X01"]
    assert candidate_urls(2026, 11)[0] == "https://www.digemid.minsa.gob.pe/Archivos/Alertas/2026/ALERTA_11-26.pdf"


@pytest.mark.django_db
def test_alerts_flag_lots_in_stock(domain):  # noqa: F811
    receive_purchase(domain)  # deja el lote LOT-001 en stock
    DigemidAlert.objects.create(
        year=2026, number=1, title="Retiro lote", url="https://x.pe/1.pdf", lot_numbers=["LOT001"]
    )
    DigemidAlert.objects.create(
        year=2026,
        number=2,
        title="Otro producto, mismo lote",
        url="https://x.pe/2.pdf",
        lot_numbers=["LOT-001"],
        sanitary_registrations=["EE-05782"],
    )
    DigemidAlert.objects.create(year=2026, number=3, title="Oculta", url="https://x.pe/3.pdf", is_published=False)
    client, headers = api_client(domain)
    response = client.get("/api/v1/digemid/alerts/", **headers)
    assert response.status_code == 200
    by_number = {item["number"]: item for item in response.data}
    assert set(by_number) == {1, 2}
    assert by_number[1]["in_stock"] == [{"product": "Paracetamol 500 mg", "lot": "LOT-001"}]
    assert by_number[2]["in_stock"] == []  # el registro sanitario no coincide


@pytest.mark.django_db
def test_admin_creates_a_complete_pharmacy():
    superuser = User.objects.create_superuser(email="admin@botica.pe", password="Admin-12345", full_name="Admin")
    client = Client()
    client.force_login(superuser)
    response = client.post(
        "/admin/tenancy/company/add/",
        {
            "trade_name": "Botica Panel",
            "legal_name": "",
            "tax_id": "20600000013",
            "address": "Jr. Lima 456",
            "subscription_plan": "",
            "owner_full_name": "Luis Pérez",
            "owner_email": "luis@botica.pe",
            "owner_phone": "999888777",
        },
    )
    assert response.status_code == 302, response.content[:2000]
    company = Company.objects.get(tax_id="20600000013")
    assert company.legal_name == "Botica Panel"
    assert company.subscription_status == SubscriptionStatus.TRIAL and company.can_operate
    assert Branch.objects.filter(company=company).count() == 1
    assert Warehouse.objects.filter(company=company).count() == 1
    owner = User.objects.get(email="luis@botica.pe")
    assert Membership.objects.get(user=owner, company=company).role == Role.OWNER


@pytest.mark.django_db
def test_bulk_add_selected_and_whole_base_list(domain):  # noqa: F811
    with_price = MasterProduct.objects.create(
        digemid_code="BASE-901", name="Ketorolaco", concentration="10mg", suggested_price=Decimal("0.30"), source="Base"
    )
    without_price = MasterProduct.objects.create(digemid_code="BASE-902", name="Fentanilo", source="Base")
    MasterProduct.objects.create(
        digemid_code="BASE-903", name="Cetirizina", suggested_price=Decimal("0.20"), source="Base"
    )
    MasterProduct.objects.create(
        digemid_code="99999", name="Solo DIGEMID", suggested_price=Decimal("1.00"), source="DIGEMID"
    )
    client, headers = api_client(domain)
    url = "/api/v1/digemid/products/bulk-add/"

    assert client.post(url, {}, format="json", **headers).status_code == 400
    picked = client.post(url, {"ids": [str(with_price.id), str(without_price.id)]}, format="json", **headers)
    assert picked.status_code == 200, picked.data
    assert (picked.data["added"], picked.data["without_price"]) == (1, 1)
    product = Product.objects.get(company=domain["company"], digemid_code="BASE-901")
    assert product.variants.get().base_sale_price == Decimal("0.30")

    summary = client.get("/api/v1/digemid/products/base-summary/", **headers).data
    assert summary == {"total": 2, "in_my_catalog": 1}
    everything = client.post(url, {"all_base": True}, format="json", **headers)
    assert (everything.data["added"], everything.data["already_in_catalog"]) == (1, 1)
    assert not Product.objects.filter(company=domain["company"], digemid_code="99999").exists()


@pytest.mark.django_db
def test_cashier_cannot_bulk_add(domain):  # noqa: F811
    membership = Membership.objects.get(user=domain["user"], company=domain["company"])
    membership.role = Role.CASHIER
    membership.save(update_fields=["role", "updated_at"])
    membership.branches.set([domain["origin_branch"]])
    client, headers = api_client(domain)
    response = client.post("/api/v1/digemid/products/bulk-add/", {"all_base": True}, format="json", **headers)
    assert response.status_code == 403
