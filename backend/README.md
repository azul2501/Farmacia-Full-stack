# Backend Botica SaaS

Monolito modular para el frontend Next existente. Usa Django 6, Django REST Framework 3.17,
PostgreSQL, Redis, Celery y almacenamiento S3-compatible.

## Principios

- Una sola aplicacion desplegable, separada internamente por dominios.
- UUID como identificadores publicos.
- Todas las entidades operativas incluyen `company_id`.
- La empresa operativa se resuelve desde la membresia activa del usuario autenticado; el frontend no envia `company_id`.
- Las consultas operativas se filtran siempre por empresa.
- Stock no tiene endpoints de escritura directa.
- Compras, ventas, caja y transferencias cambian stock mediante servicios transaccionales.
- Los flujos criticos usan `transaction.atomic()` y `select_for_update()`.
- Las ventas usan `idempotency_key` para impedir duplicados del POS.
- El checkout toma `ProductVariant.base_sale_price` como precio oficial; un precio distinto enviado
  por el cliente se rechaza. Los precios de venta incluyen IGV cuando el producto es gravado y el
  backend calcula el impuesto incluido, descuentos y total.
- Los descuentos requieren el permiso `sales.discount`, un motivo y un evento de auditoria.
- Los eventos relevantes se registran en `AuditEvent`.
- Redis se usa para cache, locks distribuidos de jobs y broker/resultados de Celery.

## Modulos

- `accounts`: usuarios, JWT, membresias y roles.
- `tenancy`: empresas, sucursales, almacenes y terminales POS.
- `catalog`: categorias, laboratorios, proveedores, clientes, productos y presentaciones.
- `inventory`: lotes, stock y kardex.
- `purchases`: borradores y recepcion de compras.
- `cash`: cajas, aperturas, movimientos y cierres.
- `sales`: checkout POS, ventas, detalle y pagos.
- `transfers`: despacho, transito y recepcion parcial.
- `reports`: dashboard y ventas basicas.
- `audit`: bitacora de operaciones.

## Desarrollo local sin Docker

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py bootstrap_demo
.venv/bin/python manage.py runserver 8000
```

SQLite y LocMemCache se usan solo en `config.settings.local` para facilitar pruebas. Produccion
requiere `DATABASE_URL` PostgreSQL.

## Desarrollo con infraestructura completa

El `compose.yml` esta en la raiz del repositorio y levanta backend y frontend juntos:

```bash
cd ..   # raiz del repositorio
docker compose up -d --build
docker compose exec api python manage.py bootstrap_demo
```

Servicios:

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/api/docs/`
- MinIO Console (opcional, `--profile s3`): `http://localhost:9001`

Variables de entorno: ver `.env.example` en la raiz.

## Acceso demo

Después de `bootstrap_demo`:

```text
owner@botica.demo
Demo12345!
```

Solicitar JWT:

```http
POST /api/v1/auth/token/
Content-Type: application/json

{"email":"owner@botica.demo","password":"Demo12345!"}
```

Las llamadas empresariales requieren:

```http
Authorization: Bearer <access-token>
```

La administracion global de empresas/farmacias clientes se realiza en Django Admin. Next.js es solo el portal operativo de la empresa asignada.

## Frontend Next

```env
NEXT_PUBLIC_DATA_SOURCE=api
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_ENABLE_LEGACY_PRINT=false
```

La paginacion responde con el contrato esperado por Next:

```json
{"items": [], "page": 1, "pageSize": 25, "total": 0}
```

## Validacion

```bash
.venv/bin/ruff format --check .
.venv/bin/ruff check .
.venv/bin/python manage.py check
.venv/bin/python manage.py makemigrations --check --dry-run
.venv/bin/python manage.py spectacular --file openapi.yaml --validate
.venv/bin/pytest -W error
# Opcional, contra PostgreSQL:
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/boticas_test .venv/bin/pytest -W error
```

## Alcance aplazado

No se implementan aun facturacion electronica, IA, promociones, fidelizacion, sincronizacion
offline completa ni integraciones externas.
