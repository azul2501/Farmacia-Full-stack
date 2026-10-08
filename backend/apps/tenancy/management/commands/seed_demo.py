from datetime import timedelta
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
from apps.customer_requests.models import CustomerRequest, CustomerRequestItem, CustomerRequestStatus, ServiceType
from apps.finance.models import FinancialCategory, FinancialCategoryType
from apps.inventory.models import Lot
from apps.purchases.models import Purchase, PurchaseItem, PurchaseStatus
from apps.purchases.services import PurchaseService
from apps.sales.models import Sale
from apps.sales.services import PaymentInput, SaleLineInput, SaleService
from apps.tenancy.models import Branch, Company, POSTerminal, Warehouse
from apps.transfers.models import Transfer, TransferItem
from apps.transfers.services import TransferService


class Command(BaseCommand):
    help = "Crea datos demo relacionados e idempotentes para la integracion frontend."

    @transaction.atomic
    def handle(self, *args, **options):
        company, _ = Company.objects.update_or_create(
            tax_id="20123456789",
            defaults={
                "legal_name": "Botica Farma Demo SAC",
                "trade_name": "Botica Farma Demo",
                "timezone": "America/Lima",
                "currency": "PEN",
                "is_active": True,
            },
        )
        central = self._branch(company, "CENTRAL", "Sucursal Central", "Av. Demo 123, Lima")
        norte = self._branch(company, "NORTE", "Sucursal Norte", "Av. Norte 456, Lima")
        central_warehouse = self._warehouse(company, central, "ALM-C01", "Almacen Central")
        norte_warehouse = self._warehouse(company, norte, "ALM-N01", "Almacen Norte")
        terminal, _ = POSTerminal.objects.update_or_create(
            company=company,
            code="POS-01",
            defaults={"branch": central, "name": "POS Central 01", "is_active": True},
        )
        register, _ = CashRegister.objects.update_or_create(
            company=company,
            code="CAJA-01",
            defaults={"branch": central, "name": "Caja Central 01", "is_active": True},
        )

        owner = self._user("owner@botica.demo", "Propietario Demo", "Demo12345!")
        cashier = self._user("cashier@botica.demo", "Cajero Demo", "Demo12345!")
        self._membership(owner, company, Role.OWNER, [central, norte])
        self._membership(cashier, company, Role.CASHIER, [central])

        analgesics, _ = Category.objects.update_or_create(
            company=company, name="Analgesicos", defaults={"is_active": True}
        )
        antibiotics, _ = Category.objects.update_or_create(
            company=company, name="Antibioticos", defaults={"is_active": True}
        )
        laboratory, _ = Laboratory.objects.update_or_create(
            company=company, name="Laboratorios Demo", defaults={"is_active": True}
        )
        supplier, _ = Supplier.objects.update_or_create(
            company=company,
            document_number="20555555551",
            defaults={
                "document_type": "RUC",
                "legal_name": "Distribuidora Farmaceutica Demo SAC",
                "trade_name": "Distribuidora Demo",
                "address": "Lima",
                "phone": "999111222",
                "email": "ventas@distribuidora.demo",
                "is_active": True,
            },
        )
        customer, _ = Customer.objects.update_or_create(
            company=company,
            document_number="70000001",
            defaults={
                "document_type": "DNI",
                "full_name": "Cliente Demo",
                "phone": "999333444",
                "email": "cliente@botica.demo",
                "is_active": True,
            },
        )
        for name in ("Servicios", "Alquiler", "Movilidad", "Limpieza", "Mantenimiento", "Otros"):
            FinancialCategory.objects.get_or_create(
                company=company,
                category_type=FinancialCategoryType.EXPENSE,
                name=name,
            )
        for name in ("Servicio adicional", "Recuperacion de gasto", "Ingreso administrativo", "Otros"):
            FinancialCategory.objects.get_or_create(
                company=company,
                category_type=FinancialCategoryType.INCOME,
                name=name,
            )

        paracetamol = self._product(
            company,
            analgesics,
            laboratory,
            "MED-0001",
            "Paracetamol 500 mg",
            "Paracetamol",
            "PAR-500-TAB",
            "Tableta",
            "0.50",
            "7750000000011",
        )
        amoxicillin = self._product(
            company,
            antibiotics,
            laboratory,
            "MED-0002",
            "Amoxicilina 500 mg",
            "Amoxicilina",
            "AMO-500-CAP",
            "Capsula",
            "1.20",
            "7750000000028",
        )

        purchase = Purchase.objects.filter(company=company, document_number="F001-000001").first()
        if purchase is None:
            purchase = Purchase.objects.create(
                company=company,
                supplier=supplier,
                branch=central,
                destination_warehouse=central_warehouse,
                document_type="INVOICE",
                document_number="F001-000001",
                document_date=timezone.localdate(),
                payment_method=PaymentMethod.TRANSFER,
                payment_reference="SEED-DEMO",
                status=PurchaseStatus.DRAFT,
                subtotal=Decimal("61.00"),
                total=Decimal("61.00"),
                notes="Compra inicial de demostracion",
                created_by=owner,
            )
            PurchaseItem.objects.create(
                company=company,
                purchase=purchase,
                variant=paracetamol,
                quantity=Decimal("50"),
                unit_cost=Decimal("0.30"),
                line_total=Decimal("15.00"),
                batch_number="PAR-DEMO-01",
                expiry_date=timezone.localdate() + timedelta(days=365),
            )
            PurchaseItem.objects.create(
                company=company,
                purchase=purchase,
                variant=amoxicillin,
                quantity=Decimal("40"),
                unit_cost=Decimal("1.15"),
                line_total=Decimal("46.00"),
                batch_number="AMO-DEMO-01",
                expiry_date=timezone.localdate() + timedelta(days=240),
            )
            PurchaseService.receive(purchase_id=purchase.id, company=company, user=owner)

        credit_purchase = Purchase.objects.filter(company=company, document_number="F001-000002").first()
        if credit_purchase is None:
            credit_purchase = Purchase.objects.create(
                company=company,
                supplier=supplier,
                branch=central,
                destination_warehouse=central_warehouse,
                document_type="INVOICE",
                document_number="F001-000002",
                document_date=timezone.localdate(),
                payment_condition=PaymentCondition.CREDIT,
                payment_due_date=timezone.localdate() + timedelta(days=30),
                subtotal=Decimal("30.00"),
                total=Decimal("30.00"),
                notes="Compra a credito de demostracion",
                created_by=owner,
            )
            PurchaseItem.objects.create(
                company=company,
                purchase=credit_purchase,
                variant=paracetamol,
                quantity=Decimal("20"),
                pack_quantity=Decimal("1"),
                purchase_pack_price=Decimal("30"),
                purchase_factor=Decimal("20"),
                unit_cost=Decimal("1.50"),
                line_total=Decimal("30.00"),
                batch_number="PAR-DEMO-02",
                expiry_date=timezone.localdate() + timedelta(days=420),
            )
            PurchaseService.receive(purchase_id=credit_purchase.id, company=company, user=owner)

        session = CashSession.objects.filter(
            company=company, register=register, status__in=[CashSessionStatus.OPEN, CashSessionStatus.CLOSING]
        ).first()
        if session is None:
            session = CashService.open_session(
                company=company,
                register_id=register.id,
                user=cashier,
                opening_amount=Decimal("100.00"),
                notes="Caja demo para pruebas de POS",
            )

        if not Sale.objects.filter(company=company, idempotency_key="seed-demo-sale-001").exists():
            SaleService.checkout(
                company=company,
                branch=central,
                warehouse=central_warehouse,
                terminal=terminal,
                cash_session_id=session.id,
                user=cashier,
                customer=customer,
                idempotency_key="seed-demo-sale-001",
                lines=[
                    SaleLineInput(
                        variant_id=paracetamol.id,
                        quantity=Decimal("2"),
                        unit_price=Decimal("0.50"),
                        discount=Decimal("0"),
                    )
                ],
                payments=[
                    PaymentInput(
                        method=PaymentMethod.CASH,
                        amount=Decimal("1.00"),
                        received_amount=Decimal("2.00"),
                    )
                ],
            )

        if not Sale.objects.filter(company=company, idempotency_key="seed-demo-credit-sale-001").exists():
            SaleService.checkout(
                company=company,
                branch=central,
                warehouse=central_warehouse,
                terminal=terminal,
                cash_session_id=session.id,
                user=owner,
                customer=customer,
                idempotency_key="seed-demo-credit-sale-001",
                payment_condition=PaymentCondition.CREDIT,
                payment_due_date=timezone.localdate() + timedelta(days=15),
                lines=[
                    SaleLineInput(
                        variant_id=paracetamol.id,
                        quantity=Decimal("4"),
                        unit_price=Decimal("0.50"),
                        discount=Decimal("0"),
                    )
                ],
                payments=[],
            )

        scheduled_request, created = CustomerRequest.objects.get_or_create(
            company=company,
            code="SOL-DEMO-001",
            defaults={
                "customer": customer,
                "contact_phone": customer.phone,
                "branch": central,
                "scheduled_at": timezone.now() + timedelta(days=1),
                "service_type": ServiceType.STORE_PICKUP,
                "status": CustomerRequestStatus.CONFIRMED,
                "notes": "Solicitud programada de demostracion",
                "created_by": cashier,
            },
        )
        if created:
            CustomerRequestItem.objects.create(
                company=company,
                request=scheduled_request,
                variant=paracetamol,
                quantity=Decimal("2"),
                reference_price=paracetamol.base_sale_price,
            )

        transfer = Transfer.objects.filter(company=company, number="TR-DEMO-001").first()
        if transfer is None:
            lot = Lot.objects.get(company=company, variant=amoxicillin, batch_number="AMO-DEMO-01")
            transfer = Transfer.objects.create(
                company=company,
                number="TR-DEMO-001",
                origin_branch=central,
                origin_warehouse=central_warehouse,
                destination_branch=norte,
                destination_warehouse=norte_warehouse,
                notes="Transferencia de demostracion en transito",
                created_by=owner,
            )
            TransferItem.objects.create(
                company=company,
                transfer=transfer,
                variant=amoxicillin,
                lot=lot,
                requested_quantity=Decimal("5"),
            )
            TransferService.dispatch(transfer_id=transfer.id, company=company, user=owner)
            TransferService.start_transit(transfer_id=transfer.id, company=company, user=owner)

        self.stdout.write(self.style.SUCCESS(f"Empresa demo: {company.id}"))
        self.stdout.write("Dueno: owner@botica.demo / Demo12345!")
        self.stdout.write("Cajero: cashier@botica.demo / Demo12345!")

    @staticmethod
    def _branch(company, code, name, address):
        branch, _ = Branch.objects.update_or_create(
            company=company,
            code=code,
            defaults={"name": name, "address": address, "is_active": True},
        )
        return branch

    @staticmethod
    def _warehouse(company, branch, code, name):
        warehouse, _ = Warehouse.objects.update_or_create(
            company=company,
            code=code,
            defaults={"branch": branch, "name": name, "is_active": True},
        )
        return warehouse

    @staticmethod
    def _user(email, full_name, password):
        user, _ = User.objects.update_or_create(
            email=email,
            defaults={"full_name": full_name, "is_active": True},
        )
        user.set_password(password)
        user.save(update_fields=["password"])
        return user

    @staticmethod
    def _membership(user, company, role, branches):
        membership, _ = Membership.objects.update_or_create(
            user=user,
            company=company,
            defaults={"role": role, "is_active": True},
        )
        membership.branches.set(branches)

    @staticmethod
    def _product(company, category, laboratory, code, name, ingredient, sku, presentation, price, barcode):
        active_ingredient, _ = ActiveIngredient.objects.get_or_create(company=company, name=ingredient)
        therapeutic_action, _ = TherapeuticAction.objects.get_or_create(
            company=company,
            name="Analgesica" if "Analges" in category.name else "Antibacteriana",
        )
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
                "minimum_stock": Decimal("10"),
                "purchase_pack_price": Decimal(price) * Decimal("100"),
                "purchase_factor": Decimal("100"),
                "base_sale_price": Decimal(price),
                "is_active": True,
            },
        )
        ProductBarcode.objects.update_or_create(
            company=company,
            code=barcode,
            defaults={"variant": variant, "is_primary": True},
        )
        return variant
