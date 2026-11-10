import getpass
import os

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import Membership, Role, User
from apps.cash.models import CashRegister
from apps.tenancy.models import Branch, Company, POSTerminal, Warehouse


class Command(BaseCommand):
    help = (
        "Crea la empresa real con su primera sucursal, almacén, caja y terminal POS, y su usuario dueño. "
        "Las demás sucursales, almacenes, cajas y usuarios se crean luego desde la aplicación."
    )

    def add_arguments(self, parser):
        parser.add_argument("--ruc", required=True, help="RUC de la empresa (11 dígitos).")
        parser.add_argument("--razon-social", required=True)
        parser.add_argument("--nombre-comercial", required=True)
        parser.add_argument("--sucursal", default="Sucursal principal", help="Nombre de la primera sucursal.")
        parser.add_argument("--direccion", default="", help="Dirección de la primera sucursal.")
        parser.add_argument("--email", required=True, help="Correo del usuario dueño.")
        parser.add_argument("--nombre", required=True, help="Nombre completo del usuario dueño.")

    @transaction.atomic
    def handle(self, *args, **options):
        ruc = options["ruc"].strip()
        if not (ruc.isdigit() and len(ruc) == 11):
            raise CommandError("El RUC debe tener 11 dígitos.")
        if Company.objects.filter(tax_id=ruc).exists():
            raise CommandError(f"Ya existe una empresa con RUC {ruc}.")
        email = User.objects.normalize_email(options["email"].strip()).lower()
        if User.objects.filter(email__iexact=email).exists():
            raise CommandError(f"Ya existe un usuario con el correo {email}.")

        password = os.environ.get("OWNER_PASSWORD") or self._ask_password()
        user = User(email=email, full_name=options["nombre"].strip(), is_active=True)
        try:
            validate_password(password, user)
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages)) from exc
        user.set_password(password)
        user.save()

        company = Company.objects.create(
            tax_id=ruc,
            legal_name=options["razon_social"].strip(),
            trade_name=options["nombre_comercial"].strip(),
            is_active=True,
        )
        branch = Branch.objects.create(
            company=company,
            code="PRINCIPAL",
            name=options["sucursal"].strip(),
            address=options["direccion"].strip(),
            is_active=True,
        )
        Warehouse.objects.create(company=company, branch=branch, code="ALM-01", name="Almacén principal")
        POSTerminal.objects.create(company=company, branch=branch, code="POS-01", name="POS 01")
        CashRegister.objects.create(company=company, branch=branch, code="CAJA-01", name="Caja 01")
        membership = Membership.objects.create(user=user, company=company, role=Role.OWNER, is_active=True)
        membership.branches.set([branch])

        self.stdout.write(self.style.SUCCESS(f"Empresa creada: {company.trade_name} ({company.tax_id})"))
        self.stdout.write(f"Usuario dueño: {email}. Ya puede iniciar sesión en la aplicación.")

    def _ask_password(self):
        password = getpass.getpass("Contraseña del usuario dueño: ")
        if password != getpass.getpass("Repite la contraseña: "):
            raise CommandError("Las contraseñas no coinciden.")
        return password
