import os
from urllib.parse import urlparse

from django.core.exceptions import ImproperlyConfigured

from config.settings.base import *  # noqa: F403

DEBUG = False
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY es obligatorio en produccion.")

database_url = os.getenv("DATABASE_URL", "")
if not database_url:
    raise ImproperlyConfigured("DATABASE_URL PostgreSQL es obligatorio en produccion.")

parsed = urlparse(database_url)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parsed.path.lstrip("/"),
        "USER": parsed.username,
        "PASSWORD": parsed.password,
        "HOST": parsed.hostname,
        "PORT": parsed.port or 5432,
        "CONN_MAX_AGE": 60,
        "OPTIONS": {"sslmode": os.getenv("POSTGRES_SSLMODE", "prefer")},
    }
}

# WhiteNoise sirve /static/ (admin y Swagger) directamente desde gunicorn.
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")  # noqa: F405

if not ALLOWED_HOSTS:  # noqa: F405
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS es obligatorio en produccion.")

# DJANGO_HTTPS=false solo para levantar la imagen de produccion en http://localhost (docker compose).
HTTPS = env_bool("DJANGO_HTTPS", True)  # noqa: F405
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = HTTPS and env_bool("DJANGO_SECURE_SSL_REDIRECT", True)  # noqa: F405
SECURE_REDIRECT_EXEMPT = [r"^health/$"]
SESSION_COOKIE_SECURE = HTTPS
CSRF_COOKIE_SECURE = HTTPS
JWT_COOKIE_SECURE = env_bool("JWT_COOKIE_SECURE", HTTPS)  # noqa: F405
SECURE_HSTS_SECONDS = 31536000 if HTTPS else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = HTTPS
SECURE_CONTENT_TYPE_NOSNIFF = True
