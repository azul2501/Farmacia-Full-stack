from config.settings.base import *  # noqa: F403

DEBUG = True
SECRET_KEY = "local-development-only-change-before-production"
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",  # noqa: F405
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "farmacia-local",
    }
}

# Cookie de refresco sin "Secure" para que funcione en http://localhost con cualquier navegador.
JWT_COOKIE_SECURE = env_bool("JWT_COOKIE_SECURE", False)  # noqa: F405
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
SILENCED_SYSTEM_CHECKS = ["models.W047"]
