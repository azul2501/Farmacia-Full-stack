"""Versiones del producto.

Cada funcion opcional declara en ``settings.FEATURE_VERSIONS`` la version minima que la habilita.
``settings.APP_VERSION`` es la version publicada (1 por defecto). El codigo de las funciones
apagadas sigue en el repositorio; solo deja de estar disponible por la API.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from rest_framework.exceptions import NotFound


def feature_enabled(name: str) -> bool:
    required = settings.FEATURE_VERSIONS.get(name)
    if required is None:
        return True
    return settings.APP_VERSION >= required


class FeatureGatedMixin:
    """Responde 404 en un viewset cuya funcion no esta habilitada en la version publicada."""

    feature: str | None = None

    def initial(self, request, *args, **kwargs):
        if self.feature and not feature_enabled(self.feature):
            raise NotFound("Este módulo no está disponible en esta versión.")
        super().initial(request, *args, **kwargs)


def ensure_company_can_operate(company):
    """Bloquea ventas e ingresos de mercaderia si la prueba vencio o la cuenta esta suspendida."""
    if not company.can_operate:
        raise ValidationError(
            "Tu periodo de prueba terminó o tu cuenta está suspendida. Escríbenos para activar tu plan."
        )
