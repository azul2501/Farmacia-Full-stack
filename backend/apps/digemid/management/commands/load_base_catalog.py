from pathlib import Path

from django.core.management.base import BaseCommand

from apps.digemid.catalog_import import import_catalog
from apps.digemid.models import MasterProduct

BASE_CATALOG = Path(__file__).resolve().parents[2] / "data" / "catalogo_base.csv"


class Command(BaseCommand):
    help = (
        "Carga la lista base del catálogo: los genéricos esenciales de la RM 220-2024-MINSA y productos "
        "comerciales e insumos comunes, con precio sugerido. Se puede correr varias veces."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--if-empty",
            action="store_true",
            help="Solo carga si la lista base aún no está (para correrlo en cada arranque sin pisar cambios).",
        )

    def handle(self, *args, **options):
        if options["if_empty"] and MasterProduct.objects.filter(digemid_code__startswith="RM220-").exists():
            self.stdout.write("La lista base ya está cargada.")
            return
        result = import_catalog(BASE_CATALOG)
        self.stdout.write(self.style.SUCCESS(f"Lista base cargada: {result.rows_saved} productos."))
