"""Validacion de RUC para el registro de boticas.

La consulta usa un servicio externo configurable en ``RUC_LOOKUP_URL`` (por ejemplo, el contenedor
gratuito ``peru-consult-api`` definido en compose.yml). La URL lleva ``{ruc}`` donde va el numero.
Si el servicio no esta configurado o no responde, el registro sigue y la botica queda
"por verificar" en el admin.
"""

import json
import logging
import re
from dataclasses import dataclass
from urllib.error import URLError
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)

RUC_PATTERN = re.compile(r"^(10|20)\d{9}$")


@dataclass(frozen=True)
class RucLookup:
    """Resultado de la consulta. ``verified`` es None cuando no se pudo consultar."""

    verified: bool | None
    legal_name: str = ""
    reason: str = ""


def is_valid_ruc_format(ruc: str) -> bool:
    if not RUC_PATTERN.match(ruc):
        return False
    # Digito verificador de SUNAT (modulo 11).
    weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    total = sum(int(digit) * weight for digit, weight in zip(ruc[:10], weights, strict=True))
    check = 11 - (total % 11)
    if check == 10:
        check = 0
    elif check == 11:
        check = 1
    return check == int(ruc[10])


def _first(data: dict, *keys: str) -> str:
    for key in keys:
        value = data.get(key)
        if value:
            return str(value).strip()
    return ""


def lookup_ruc(ruc: str) -> RucLookup:
    url_template = getattr(settings, "RUC_LOOKUP_URL", "")
    if not url_template:
        return RucLookup(verified=None, reason="Consulta de RUC no configurada.")
    url = url_template.replace("{ruc}", ruc)
    try:
        request = Request(url, headers={"Accept": "application/json"})
        with urlopen(request, timeout=settings.RUC_LOOKUP_TIMEOUT) as response:
            if response.status == 404:
                return RucLookup(verified=False, reason="El RUC no existe en SUNAT.")
            data = json.loads(response.read().decode("utf-8") or "{}")
    except URLError as error:
        # urlopen lanza HTTPError (subclase de URLError) para 4xx/5xx.
        if getattr(error, "code", None) == 404:
            return RucLookup(verified=False, reason="El RUC no existe en SUNAT.")
        logger.warning("Consulta de RUC no disponible: %s", error)
        return RucLookup(verified=None, reason="Servicio de RUC no disponible.")
    except (TimeoutError, ValueError) as error:
        logger.warning("Consulta de RUC fallida: %s", error)
        return RucLookup(verified=None, reason="Servicio de RUC no disponible.")

    if not isinstance(data, dict) or not data:
        return RucLookup(verified=False, reason="El RUC no existe en SUNAT.")
    status = _first(data, "estado", "estadoContribuyente", "state").upper()
    condition = _first(data, "condicion", "condicionDomicilio", "condition").upper()
    legal_name = _first(data, "razonSocial", "razon_social", "nombre", "name")
    if status and status != "ACTIVO":
        return RucLookup(verified=False, legal_name=legal_name, reason=f"El RUC figura como {status} en SUNAT.")
    if condition and condition != "HABIDO":
        return RucLookup(verified=False, legal_name=legal_name, reason=f"El RUC figura como {condition} en SUNAT.")
    if not status:
        return RucLookup(verified=None, legal_name=legal_name, reason="SUNAT no informó el estado del RUC.")
    return RucLookup(verified=True, legal_name=legal_name)
