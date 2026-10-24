import os
from urllib.parse import urlparse

from config.settings.local import *  # noqa: F403

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CELERY_TASK_ALWAYS_EAGER = True
# La suite completa prueba todas las funciones; las reglas de la V1 se prueban con override_settings.
APP_VERSION = 3
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": {"signup": "1000/hour"}}  # noqa: F405
RUC_LOOKUP_URL = ""

# Permite correr la suite contra PostgreSQL (CI) con TEST_DATABASE_URL=postgresql://user:pass@host:5432/db
_test_database_url = os.getenv("TEST_DATABASE_URL", "")
if _test_database_url:
    _parsed = urlparse(_test_database_url)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": _parsed.path.lstrip("/"),
            "USER": _parsed.username,
            "PASSWORD": _parsed.password,
            "HOST": _parsed.hostname,
            "PORT": _parsed.port or 5432,
        }
    }
