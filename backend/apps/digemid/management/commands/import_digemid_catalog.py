from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.digemid.catalog_import import COLUMN_ALIASES, import_catalog


class Command(BaseCommand):
    help = "Carga o actualiza el catálogo maestro desde el Excel (.xlsx) o CSV de productos de DIGEMID."

    def add_arguments(self, parser):
        parser.add_argument("path", help="Ruta del archivo, por ejemplo /app/data/catalogo_digemid.xlsx")
        parser.add_argument("--dry-run", action="store_true", help="Solo revisa el archivo, no guarda nada.")

    def handle(self, *args, **options):
        path = Path(options["path"])
        if not path.exists():
            raise CommandError(f"No existe el archivo {path}.")
        result = import_catalog(path, dry_run=options["dry_run"])
        if not result.mapping:
            raise CommandError(
                "No encontré la fila de encabezados. Necesito al menos las columnas del código de producto "
                f"y del nombre. Nombres reconocidos: {COLUMN_ALIASES['digemid_code']} y {COLUMN_ALIASES['name']}."
            )
        self.stdout.write("Columnas reconocidas:")
        for field_name, header in result.mapping.items():
            self.stdout.write(f"  {field_name:<22} <- {header}")
        if result.missing:
            self.stdout.write(f"Columnas no encontradas (quedan vacías): {', '.join(result.missing)}")
        verb = "se cargarían" if options["dry_run"] else "guardados"
        self.stdout.write(
            self.style.SUCCESS(
                f"Filas leídas: {result.rows_read} · productos {verb}: {result.rows_saved} · "
                f"omitidas sin código o nombre: {result.rows_skipped}"
            )
        )
