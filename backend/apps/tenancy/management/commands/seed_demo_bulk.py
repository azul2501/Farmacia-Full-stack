import random
from datetime import datetime, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Membership, Role, User
from apps.cash.models import CashRegister, CashSession, CashSessionStatus
from apps.cash.services import CashService
from apps.catalog.models import (
    ActiveIngredient,
    Category,
    Customer,
    Laboratory,
    Product,
    ProductBarcode,
    ProductVariant,
    Supplier,
    TherapeuticAction,
)
from apps.core.choices import PaymentCondition, PaymentMethod
from apps.purchases.models import Purchase, PurchaseItem, PurchaseStatus
from apps.purchases.services import PurchaseService
from apps.sales.models import Sale
from apps.sales.services import PaymentInput, SaleLineInput, SaleService
from apps.tenancy.models import Branch, Company, POSTerminal, Warehouse

EXTRA_PRODUCTS = [
    # code, name, ingredient, category, therapeutic action, sku, presentation, price, cost, barcode
    ("MED-0003", "Ibuprofeno 400 mg", "Ibuprofeno", "Antiinflamatorios", "Antiinflamatoria", "IBU-400-TAB", "Blister x 10 tab", "3.20", "1.10", "7750000000035"),
    ("MED-0004", "Clorfenamina 4 mg", "Clorfenamina", "Antihistaminicos", "Antihistaminica", "CLF-004-TAB", "Blister x 20 tab", "0.30", "0.10", "7750000000042"),
    ("MED-0005", "Omeprazol 20 mg", "Omeprazol", "Gastrointestinal", "Antiulcerosa", "OME-020-CAP", "Caja x 14 cap", "0.80", "0.30", "7750000000059"),
    ("MED-0006", "Loratadina 10 mg", "Loratadina", "Antihistaminicos", "Antihistaminica", "LOR-010-TAB", "Caja x 10 tab", "0.60", "0.20", "7750000000066"),
    ("MED-0007", "Metformina 850 mg", "Metformina", "Cardiovascular", "Antidiabetica", "MET-850-TAB", "Caja x 30 tab", "0.40", "0.15", "7750000000073"),
    ("MED-0008", "Losartan 50 mg", "Losartan", "Cardiovascular", "Antihipertensiva", "LOS-050-TAB", "Caja x 30 tab", "0.70", "0.25", "7750000000080"),
    ("MED-0009", "Vitamina C 1 g", "Acido ascorbico", "Vitaminas", "Suplemento", "VIT-C1G-TAB", "Tubo x 10 tab", "0.90", "0.35", "7750000000097"),
    ("MED-0010", "Salbutamol inhalador", "Salbutamol", "Respiratorio", "Broncodilatadora", "SAL-INH-100", "Inhalador 100 dosis", "12.50", "6.80", "7750000000103"),
]

PAYMENT_MIX = [
    (PaymentMethod.CASH, 0.55),
    (PaymentMethod.YAPE, 0.2),
    (PaymentMethod.PLIN, 0.1),
    (PaymentMethod.CARD, 0.1),
    (PaymentMethod.TRANSFER, 0.05),
]


class Command(BaseCommand):
    help = "Extiende seed_demo con mas productos, stock y un historial de ventas de varios dias."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=7, help="Dias hacia atras a poblar con ventas.")
        parser.add_argument("--per-day", type=int, default=10, help="Ventas aproximadas por dia.")

    @transaction.atomic
    def handle(self, *args, **options):
        company = Company.objects.filter(tax_id="20123456789").first()
        if company is None:
            self.stderr.write(self.style.ERROR("Ejecuta primero: manage.py seed_demo"))
            return

        central = Branch.objects.get(company=company, code="CENTRAL")
        central_warehouse = Warehouse.objects.get(company=company, code="ALM-C01")
        terminal = POSTerminal.objects.get(company=company, code="POS-01")
        register = CashRegister.objects.get(company=company, code="CAJA-01")
        owner = User.objects.get(email="owner@botica.demo")
        cashier = User.objects.get(email="cashier@botica.demo")

        laboratory, _ = Laboratory.objects.get_or_create(company=company, name="Laboratorios Demo")
        customers = self._customers(company)

        variants = list(
            ProductVariant.objects.filter(company=company, product__company=company).select_related("product")
        )
        existing_codes = {variant.product.internal_code for variant in variants}
        new_variants = []
        for code, name, ingredient, category_name, action_name, sku, presentation, price, cost, barcode in EXTRA_PRODUCTS:
            if code in existing_codes:
                continue
            category, _ = Category.objects.get_or_create(company=company, name=category_name, defaults={"is_active": True})
            active_ingredient, _ = ActiveIngredient.objects.get_or_create(company=company, name=ingredient)
            therapeutic_action, _ = TherapeuticAction.objects.get_or_create(company=company, name=action_name)
            product, _ = Product.objects.update_or_create(
                company=company,
                internal_code=code,
                defaults={
                    "commercial_name": name,
                    "active_ingredient": active_ingredient,
                    "therapeutic_action": therapeutic_action,
                    "category": category,
                    "laboratory": laboratory,
                    "product_type": Product.ProductType.MEDICINE,
                    "requires_lot": True,
                    "requires_expiry": True,
                    "is_controlled": False,
                    "is_active": True,
                },
            )
            variant, _ = ProductVariant.objects.update_or_create(
                company=company,
                sku=sku,
                defaults={
                    "product": product,
                    "presentation": presentation,
                    "unit_of_measure": "UNIT",
                    "sale_unit": "UNIT",
                    "conversion_factor": Decimal("1"),
                    "allows_fractioning": False,
                    "minimum_stock": Decimal("15"),
                    "purchase_pack_price": Decimal(cost) * Decimal("50"),
                    "purchase_factor": Decimal("50"),
                    "unit_purchase_cost": Decimal(cost),
                    "base_sale_price": Decimal(price),
                    "is_active": True,
                },
            )
            ProductBarcode.objects.update_or_create(
                company=company, code=barcode, defaults={"variant": variant, "is_primary": True}
            )
            new_variants.append((variant, Decimal(cost)))

        if new_variants:
            purchase = Purchase.objects.filter(company=company, document_number="F001-000010").first()
            if purchase is None:
                subtotal = sum((cost * Decimal("50") for _, cost in new_variants), Decimal("0"))
                purchase = Purchase.objects.create(
                    company=company,
                    supplier=Supplier.objects.filter(company=company).first(),
                    branch=central,
                    destination_warehouse=central_warehouse,
                    document_type="INVOICE",
                    document_number="F001-000010",
                    document_date=timezone.localdate(),
                    payment_method=PaymentMethod.TRANSFER,
                    payment_reference="SEED-BULK",
                    status=PurchaseStatus.DRAFT,
                    subtotal=subtotal,
                    total=subtotal,
                    notes="Reposicion de catalogo ampliado (seed bulk)",
                    created_by=owner,
                )
                today = timezone.localdate()
                for index, (variant, cost) in enumerate(new_variants):
                    # Most lots expire far out; a couple expire soon for realistic "por vencer" chips.
                    expiry = today + timedelta(days=45 if index < 2 else 300 + index * 20)
                    PurchaseItem.objects.create(
                        company=company,
                        purchase=purchase,
                        variant=variant,
                        quantity=Decimal("50"),
                        unit_cost=cost,
                        line_total=(cost * Decimal("50")).quantize(Decimal("0.01")),
                        batch_number=f"{variant.sku}-L1",
                        expiry_date=expiry,
                    )
                PurchaseService.receive(purchase_id=purchase.id, company=company, user=owner)
                self.stdout.write(self.style.SUCCESS(f"{len(new_variants)} productos nuevos con stock recibido."))

        all_variants = list(
            ProductVariant.objects.filter(company=company, is_active=True).select_related("product")
        )

        session = CashSession.objects.filter(
            company=company, register=register, status=CashSessionStatus.OPEN
        ).first()
        if session is None:
            session = CashService.open_session(
                company=company,
                register_id=register.id,
                user=cashier,
                opening_amount=Decimal("100.00"),
                notes="Caja demo (seed bulk)",
            )

        days = options["days"]
        per_day = options["per_day"]
        rng = random.Random(42)
        created_count = 0
        today = timezone.localdate()
        for day_offset in range(days):
            sale_date = today - timedelta(days=day_offset)
            for i in range(rng.randint(max(1, per_day - 4), per_day + 4)):
                idempotency_key = f"seed-bulk-{sale_date.isoformat()}-{i}"
                if Sale.objects.filter(company=company, idempotency_key=idempotency_key).exists():
                    continue
                variant = rng.choice(all_variants)
                quantity = Decimal(rng.randint(1, 4))
                unit_price = variant.base_sale_price
                line_total = (quantity * unit_price).quantize(Decimal("0.01"))
                condition = PaymentCondition.CREDIT if rng.random() < 0.08 else PaymentCondition.CASH
                customer = rng.choice(customers) if condition == PaymentCondition.CREDIT or rng.random() < 0.3 else None

                if condition == PaymentCondition.CASH:
                    method = rng.choices([m for m, _ in PAYMENT_MIX], weights=[w for _, w in PAYMENT_MIX])[0]
                    received = line_total if method != PaymentMethod.CASH else (line_total + Decimal(rng.choice([0, 0, 1, 2, 5])))
                    payments = [PaymentInput(method=method, amount=line_total, received_amount=received)]
                    due_date = None
                    if customer is None and rng.random() < 0.3:
                        customer = rng.choice(customers)
                else:
                    payments = []
                    due_date = sale_date + timedelta(days=15)

                try:
                    sale, created = SaleService.checkout(
                        company=company,
                        branch=central,
                        warehouse=central_warehouse,
                        terminal=terminal,
                        cash_session_id=session.id,
                        user=cashier,
                        customer=customer,
                        idempotency_key=idempotency_key,
                        payment_condition=condition,
                        payment_due_date=due_date,
                        lines=[SaleLineInput(variant_id=variant.id, quantity=quantity, unit_price=unit_price, discount=Decimal("0"))],
                        payments=payments,
                    )
                except Exception as exc:  # noqa: BLE001 - seed best-effort, skip lines without stock
                    self.stdout.write(self.style.WARNING(f"Omitido ({variant.sku}): {exc}"))
                    continue

                if created:
                    fake_time = timezone.make_aware(
                        datetime.combine(sale_date, datetime.min.time())
                    ) + timedelta(hours=rng.randint(8, 20), minutes=rng.randint(0, 59))
                    Sale.objects.filter(id=sale.id).update(sold_at=fake_time)
                    created_count += 1

        self.stdout.write(self.style.SUCCESS(f"{created_count} ventas de historial creadas en {days} dias."))
        self.stdout.write(self.style.SUCCESS(f"Catalogo total: {ProductVariant.objects.filter(company=company).count()} variantes."))

    @staticmethod
    def _customers(company):
        data = [
            ("70000002", "Maria Quispe", "958712230"),
            ("70000003", "Jose Ramirez", "945122334"),
            ("70000004", "Lucia Fernandez", "912887766"),
        ]
        customers = []
        for document_number, full_name, phone in data:
            customer, _ = Customer.objects.update_or_create(
                company=company,
                document_number=document_number,
                defaults={
                    "document_type": "DNI",
                    "full_name": full_name,
                    "phone": phone,
                    "email": "",
                    "is_active": True,
                },
            )
            customers.append(customer)
        existing = Customer.objects.filter(company=company, document_number="70000001").first()
        if existing:
            customers.append(existing)
        return customers
