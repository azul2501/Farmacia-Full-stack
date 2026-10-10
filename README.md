# Botica Farma

Sistema de gestion para boticas/farmacias (multiempresa): POS, ventas, compras, inventario por lotes
(FEFO), caja, transferencias, finanzas y reportes.

| Carpeta | Contenido |
| --- | --- |
| `backend/` | API Django 6 + DRF, PostgreSQL, Redis, Celery. Ver [backend/README.md](backend/README.md). |
| `frontend/` | Portal operativo Next.js 15 (App Router). Ver [frontend/README.md](frontend/README.md). |
| `docs/` | Arquitectura, auditorias y estado de modulos. |
| `diseño/` | Prototipos HTML del rediseño. |
| `compose.yml` | Stack completo: db, redis, api, worker y web. |

## Requisitos

- Python 3.12 o 3.13
- Node 22 LTS (`frontend/.nvmrc`)
- Docker (opcional, para el stack completo con PostgreSQL)

## Opcion A: local sin Docker (desarrollo diario)

Usa SQLite y cache en memoria; no necesita PostgreSQL ni Redis.

```bash
# Terminal 1 - API en http://localhost:8000
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt     # Windows: .venv\Scripts\pip
.venv/bin/python manage.py migrate
.venv/bin/python manage.py bootstrap_demo
.venv/bin/python manage.py runserver 8000

# Terminal 2 - Web en http://localhost:3000
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Entrar en `http://localhost:3000` con `owner@botica.demo` / `Demo12345!`.

Usa siempre `localhost` (no `127.0.0.1`) en el navegador y en `NEXT_PUBLIC_API_BASE_URL`: la cookie
de sesion es por host y mezclar ambos hace que se pierda la sesion al recargar.

## Opcion B: stack completo con Docker

```bash
cp .env.example .env      # opcional: los valores por defecto ya funcionan en local
docker compose up -d --build
docker compose exec api python manage.py bootstrap_demo
```

- Web: `http://localhost:3000`
- API: `http://localhost:8000/api/v1/` (docs en `/api/docs/`, admin en `/admin/`)

MinIO (S3 local para adjuntos) es opcional: `docker compose --profile s3 up -d` con `USE_S3=true`.

## Produccion

Checklist minimo antes de desplegar:

1. `DJANGO_SECRET_KEY` largo y aleatorio, `DJANGO_ALLOWED_HOSTS` y `CSRF_TRUSTED_ORIGINS` con tus dominios.
2. `DJANGO_HTTPS=true` (redireccion HTTPS, HSTS y cookies seguras) detras de un proxy que envie
   `X-Forwarded-Proto`.
3. `DATABASE_URL` de PostgreSQL gestionado con `POSTGRES_SSLMODE=require`, y Redis para cache/Celery.
4. `USE_S3=true` con un bucket privado para adjuntos (los archivos no se sirven desde el contenedor).
5. Frontend y API en el mismo dominio padre (p. ej. `app.midominio.com` y `api.midominio.com`) con
   `JWT_COOKIE_DOMAIN=.midominio.com`, `CORS_ALLOWED_ORIGINS=https://app.midominio.com` y la imagen web
   construida con `NEXT_PUBLIC_API_BASE_URL=https://api.midominio.com/api/v1`.
6. No ejecutar `bootstrap_demo`/`seed_demo` en produccion; crear empresas y usuarios desde Django Admin
   (`python manage.py createsuperuser`).

Las imagenes ya incluyen: usuario no root, `collectstatic` con WhiteNoise, healthcheck en `/health/`,
migraciones al arrancar la API y logs a stdout.

## Validacion (igual que en CI)

```bash
cd backend && ruff format --check . && ruff check . && python manage.py check \
  && python manage.py makemigrations --check --dry-run && pytest -W error
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```

Para correr los tests del backend contra PostgreSQL: `TEST_DATABASE_URL=postgresql://user:pass@host:5432/db pytest`.
