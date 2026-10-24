from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.catalog.models import Category, Laboratory, Product, ProductBarcode
from apps.digemid.models import DigemidAlert, MasterBarcode, MasterProduct
from apps.inventory.models import Stock

DEFAULT_CATEGORY = "Medicamentos"
SUPPLY_CATEGORY = "Insumos y cuidado personal"


def master_product_label(master: MasterProduct) -> str:
    return " ".join(part for part in (master.name, master.concentration, master.dosage_form) if part)[:220]


@transaction.atomic
def add_master_product_to_company(
    *, master: MasterProduct, request, sale_price, purchase_price=None, minimum_stock=None, barcode=""
):
    """Crea el producto de la botica a partir del catálogo maestro, enlazado por su código DIGEMID."""
    from apps.catalog.serializers import ProductSerializer

    company = request.company
    if Product.objects.filter(company=company, digemid_code=master.digemid_code, is_active=True).exists():
        raise ValidationError({"master_product": "Este producto ya está en tu catálogo."})
    is_supply = master.product_type == Product.ProductType.SUPPLY
    category_name = SUPPLY_CATEGORY if is_supply else DEFAULT_CATEGORY
    category, _ = Category.objects.get_or_create(company=company, name=category_name)
    laboratory = None
    lab_name = (master.manufacturer or master.holder).strip()[:160]
    if lab_name:
        laboratory, _ = Laboratory.objects.get_or_create(company=company, name=lab_name)
    barcode = (barcode or "").strip()
    payload = {
        "commercial_name": master_product_label(master),
        "category": category.id,
        "laboratory": laboratory.id if laboratory else None,
        "product_type": Product.ProductType.SUPPLY if is_supply else Product.ProductType.MEDICINE,
        "sanitary_registration": master.sanitary_registration[:80],
        "digemid_code": master.digemid_code,
        "requires_lot": not is_supply,
        "requires_expiry": not is_supply,
        "initial_variant": {
            "presentation": (master.presentation or "Unidad")[:120],
            "unit_of_measure": "UNIDAD",
            "sale_unit": "UNIDAD",
            "conversion_factor": "1",
            "sale_factor": "1",
            "purchase_factor": "1",
            "purchase_pack_price": str(purchase_price if purchase_price is not None else Decimal("0")),
            "base_sale_price": str(sale_price),
            "minimum_stock": str(minimum_stock if minimum_stock is not None else Decimal("0")),
            "barcode": barcode,
        },
    }
    serializer = ProductSerializer(data=payload, context={"request": request})
    serializer.is_valid(raise_exception=True)
    product = serializer.save(company=company)
    if barcode:
        # Compartido: la siguiente botica que escanee este codigo encuentra el producto del catalogo.
        MasterBarcode.objects.get_or_create(
            code=barcode, defaults={"master_product": master, "first_company": company}
        )
    return product


BULK_ADD_LIMIT = 1000


def base_catalog_queryset():
    """Lista base con precio sugerido (no incluye el Excel completo de DIGEMID, que tiene miles de productos)."""
    return MasterProduct.objects.exclude(source="DIGEMID").filter(suggested_price__isnull=False)


def bulk_add_master_products(*, masters, request) -> dict:
    """Agrega varios productos del catálogo a la botica con su precio sugerido.

    Salta los que ya están en la botica y los que no tienen precio sugerido; si uno falla, sigue con los demás.
    """
    masters = list(masters[:BULK_ADD_LIMIT])
    existing = company_codes_in_catalog(company=request.company, codes=[master.digemid_code for master in masters])
    summary = {"added": 0, "already_in_catalog": 0, "without_price": 0, "errors": []}
    for master in masters:
        if master.digemid_code in existing:
            summary["already_in_catalog"] += 1
            continue
        if not master.suggested_price:
            summary["without_price"] += 1
            continue
        try:
            add_master_product_to_company(master=master, request=request, sale_price=master.suggested_price)
        except ValidationError as error:
            if len(summary["errors"]) < 20:
                summary["errors"].append({"product": str(master), "detail": error.detail})
            continue
        existing.add(master.digemid_code)
        summary["added"] += 1
    return summary


def link_barcode(*, master: MasterProduct, barcode: str, company):
    barcode = (barcode or "").strip()
    if barcode:
        MasterBarcode.objects.get_or_create(code=barcode, defaults={"master_product": master, "first_company": company})


def company_codes_in_catalog(*, company, codes) -> set[str]:
    return set(
        Product.objects.filter(company=company, digemid_code__in=list(codes), is_active=True).values_list(
            "digemid_code", flat=True
        )
    )


def normalize_lot(value: str) -> str:
    return "".join(ch for ch in str(value).upper() if ch.isalnum())


def alerts_with_stock_matches(*, company, alerts):
    """Marca las alertas que mencionan un lote que la botica tiene en stock."""
    alerts = list(alerts)
    wanted = {normalize_lot(lot) for alert in alerts for lot in alert.lot_numbers}
    wanted.discard("")
    in_stock = {}
    if wanted:
        stock_rows = Stock.objects.filter(company=company, quantity__gt=0, lot__isnull=False).select_related(
            "lot", "variant__product"
        )
        for row in stock_rows:
            key = normalize_lot(row.lot.batch_number)
            if key in wanted:
                in_stock.setdefault(key, []).append(row)
    results = []
    for alert in alerts:
        matches = []
        registrations = {normalize_lot(value) for value in alert.sanitary_registrations}
        for lot in alert.lot_numbers:
            for row in in_stock.get(normalize_lot(lot), []):
                product = row.variant.product
                # Si la alerta trae registro sanitario, el producto tambien debe coincidir.
                if registrations and normalize_lot(product.sanitary_registration) not in registrations:
                    continue
                match = {"product": product.commercial_name, "lot": row.lot.batch_number}
                if match not in matches:
                    matches.append(match)
        results.append((alert, matches))
    return results


def published_alerts(limit=20):
    return DigemidAlert.objects.filter(is_published=True).order_by("-year", "-number")[:limit]
