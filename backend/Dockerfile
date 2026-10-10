FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# psycopg[binary] trae libpq; no se necesitan compiladores en la imagen.
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

# collectstatic no toca la base de datos; se usan valores ficticios solo para esta fase del build.
RUN DJANGO_SETTINGS_MODULE=config.settings.production \
    DJANGO_SECRET_KEY=build-only \
    DATABASE_URL=postgresql://build:build@localhost/build \
    DJANGO_ALLOWED_HOSTS=localhost \
    USE_S3=false \
    python manage.py collectstatic --noinput -v0

RUN useradd --create-home --uid 1000 app && mkdir -p /app/media && chown -R app:app /app
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/', timeout=4)"
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--access-logfile", "-"]
