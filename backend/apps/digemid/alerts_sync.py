"""Descarga las alertas sanitarias que DIGEMID publica como PDF y extrae registros sanitarios y lotes.

DIGEMID publica cada alerta en una URL con el numero y el año, por ejemplo
https://www.digemid.minsa.gob.pe/Archivos/Alertas/2026/ALERTA_11-26.pdf. El comando avanza desde la
ultima alerta guardada hasta que no encuentra varias seguidas. No hay una API oficial: si DIGEMID cambia
la forma de publicar, las alertas se pueden registrar a mano desde el panel de superadmin.
"""

import io
import logging
import re
from dataclasses import dataclass, field
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.db.models import Max

from apps.digemid.models import DigemidAlert

logger = logging.getLogger(__name__)

URL_TEMPLATE = "https://www.digemid.minsa.gob.pe/Archivos/Alertas/{year}/ALERTA_{number}-{yy}.pdf"
REGISTRATION_PATTERN = re.compile(
    r"(?:R\.?\s*S\.?|REGISTRO\s+SANITARIO)\s*(?:N[°º.O]*\s*)?[:\-]?\s*([A-Z]{1,3}-?\d{4,6})"
)
LOT_PATTERN = re.compile(
    r"\blotes?\b\s*(?:N[°º.o]*\s*)?[:\-]?\s*((?:[A-Z0-9][A-Z0-9\-/]{2,}(?:\s*(?:,|y)\s*)?)+)", re.I
)
LOT_TOKEN = re.compile(r"[A-Z0-9][A-Z0-9\-/]{2,}", re.I)
NOT_LOTS = {"DEL", "LOS", "LAS", "QUE", "CON", "POR", "PARA", "PRODUCTO", "PRODUCTOS"}


@dataclass
class ParsedAlert:
    title: str
    summary: str
    sanitary_registrations: list[str] = field(default_factory=list)
    lot_numbers: list[str] = field(default_factory=list)


def candidate_urls(year: int, number: int) -> list[str]:
    yy = f"{year % 100:02d}"
    numbers = dict.fromkeys([str(number), f"{number:02d}", f"{number:03d}"])
    return [URL_TEMPLATE.format(year=year, number=value, yy=yy) for value in numbers]


def download(url: str) -> bytes | None:
    request = Request(url, headers={"User-Agent": "BoticaFarma/1.0 (+alertas DIGEMID)"})
    try:
        with urlopen(request, timeout=settings.DIGEMID_ALERTS_TIMEOUT) as response:
            data = response.read()
    except HTTPError as error:
        if error.code != 404:
            logger.warning("Alerta DIGEMID %s respondió %s", url, error.code)
        return None
    except (URLError, TimeoutError) as error:
        logger.warning("No se pudo descargar %s: %s", url, error)
        raise
    return data if data[:4] == b"%PDF" else None


def pdf_text(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def parse_alert_text(text: str) -> ParsedAlert:
    compact = re.sub(r"[ \t]+", " ", text)
    lines = [line.strip() for line in compact.splitlines() if line.strip()]
    title = ""
    for index, line in enumerate(lines):
        if "ALERTA" in line.upper():
            title = " ".join(lines[index : index + 3])
            break
    title = (title or (lines[0] if lines else "Alerta DIGEMID"))[:400]
    registrations = list(dict.fromkeys(REGISTRATION_PATTERN.findall(compact.upper())))
    lots = []
    for match in LOT_PATTERN.finditer(compact):
        for token in LOT_TOKEN.findall(match.group(1)):
            token = token.strip("-/").upper()
            if token not in NOT_LOTS and any(char.isdigit() for char in token) and token not in registrations:
                lots.append(token)
    summary = " ".join(lines)[:2000]
    return ParsedAlert(
        title=title,
        summary=summary,
        sanitary_registrations=registrations[:50],
        lot_numbers=list(dict.fromkeys(lots))[:100],
    )


@dataclass
class SyncResult:
    created: list[DigemidAlert] = field(default_factory=list)
    last_checked: int = 0


def sync_year(year: int, *, max_misses: int = 3, start: int | None = None) -> SyncResult:
    result = SyncResult()
    if start is None:
        last = DigemidAlert.objects.filter(year=year).aggregate(last=Max("number"))["last"] or 0
        start = last + 1
    misses = 0
    number = start
    while misses < max_misses:
        result.last_checked = number
        if DigemidAlert.objects.filter(year=year, number=number).exists():
            number += 1
            misses = 0
            continue
        found = None
        for url in candidate_urls(year, number):
            data = download(url)
            if data:
                found = (url, data)
                break
        if not found:
            misses += 1
            number += 1
            continue
        misses = 0
        url, data = found
        try:
            parsed = parse_alert_text(pdf_text(data))
        except Exception as error:  # PDF ilegible: se guarda igual con el enlace para revisarlo a mano.
            logger.warning("No se pudo leer el PDF %s: %s", url, error)
            parsed = ParsedAlert(title=f"Alerta DIGEMID N° {number:03d}-{year}", summary="")
        alert, _ = DigemidAlert.objects.update_or_create(
            year=year,
            number=number,
            defaults={
                "url": url,
                "title": parsed.title,
                "summary": parsed.summary,
                "sanitary_registrations": parsed.sanitary_registrations,
                "lot_numbers": parsed.lot_numbers,
            },
        )
        result.created.append(alert)
        number += 1
    return result
