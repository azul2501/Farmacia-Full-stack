from urllib.error import URLError

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.digemid.alerts_sync import sync_year


class Command(BaseCommand):
    help = "Descarga las alertas sanitarias nuevas de DIGEMID. Programarlo una vez al día (cron)."

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int, default=None, help="Año a revisar (por defecto, el actual).")
        parser.add_argument("--start", type=int, default=None, help="Número desde el que empezar.")
        parser.add_argument("--max-misses", type=int, default=3, help="Números seguidos sin alerta para detenerse.")

    def handle(self, *args, **options):
        year = options["year"] or timezone.localdate().year
        try:
            result = sync_year(year, max_misses=options["max_misses"], start=options["start"])
        except (URLError, TimeoutError) as error:
            raise CommandError(f"No se pudo conectar con DIGEMID: {error}") from error
        for alert in result.created:
            lots = ", ".join(alert.lot_numbers) or "sin lotes detectados"
            self.stdout.write(f"  {alert}: {alert.title[:90]} · lotes: {lots}")
        summary = f"{len(result.created)} alerta(s) nuevas de {year}; último número revisado: {result.last_checked}."
        self.stdout.write(self.style.SUCCESS(summary))
