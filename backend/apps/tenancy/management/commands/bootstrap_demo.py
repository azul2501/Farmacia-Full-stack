from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Membership, Role, User
from apps.cash.models import CashRegister
from apps.tenancy.models import Branch, Company, POSTerminal, Warehouse


class Command(BaseCommand):
    help = "Crea un tenant minimo para desarrollo local."

    @transaction.atomic
    def handle(self, *args, **options):
        company, _ = Company.objects.update_or_create(
            tax_id="20123456789",
            defaults={
                "legal_name": "Botica Farma Demo SAC",
                "trade_name": "Botica Farma",
                "is_active": True,
            },
        )
        branch, _ = Branch.objects.update_or_create(
            company=company,
            code="CENTRAL",
            defaults={"name": "Sucursal Central", "address": "Lima", "is_active": True},
        )
        Warehouse.objects.update_or_create(
            company=company,
            code="ALM-C01",
            defaults={"branch": branch, "name": "Almacen principal", "is_active": True},
        )
        POSTerminal.objects.update_or_create(
            company=company,
            code="POS-01",
            defaults={"branch": branch, "name": "POS 01", "is_active": True},
        )
        CashRegister.objects.update_or_create(
            company=company,
            code="CAJA-01",
            defaults={"branch": branch, "name": "Caja 01", "is_active": True},
        )
        user, created = User.objects.get_or_create(
            email="owner@botica.demo",
            defaults={"full_name": "Propietario Demo", "is_active": True},
        )
        if created:
            user.set_password("Demo12345!")
            user.save(update_fields=["password"])
        membership, _ = Membership.objects.update_or_create(
            user=user,
            company=company,
            defaults={"role": Role.OWNER, "is_active": True},
        )
        membership.branches.set([branch])
        self.stdout.write(self.style.SUCCESS(f"Tenant demo: {company.id}"))
        self.stdout.write("Usuario: owner@botica.demo / Demo12345!")
