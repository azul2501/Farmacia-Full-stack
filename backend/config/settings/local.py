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

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
SILENCED_SYSTEM_CHECKS = ["models.W047"]
