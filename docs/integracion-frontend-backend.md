# Integracion frontend-backend

## Estado auditado

Fecha de auditoria: 2026-06-20.

Los proyectos se mantienen independientes y se comunican exclusivamente por HTTP:

- Frontend: `/mnt/c/laragon/www/farmacia/frontend`
- Backend: `/mnt/c/laragon/www/farmacia/backend`
- Docker Compose: `/mnt/c/laragon/www/farmacia/backend/compose.yml`
- Contrato OpenAPI: `/mnt/c/laragon/www/farmacia/backend/openapi.yaml`

No se moveran fuentes de Django al frontend ni fuentes de Next.js al backend.

## Infraestructura real

El Compose actual define estos servicios:

| Servicio | Funcion | Puerto local |
| --- | --- | --- |
| `api` | Django + Gunicorn | `8000` |
| `db` | PostgreSQL 17 | solo red interna |
| `redis` | cache, broker y resultados Celery | solo red interna |
| `minio` | almacenamiento S3 compatible | consola `9001` |
| `minio-init` | creacion idempotente del bucket | proceso temporal |
| `worker` | Celery Worker | no expuesto |

No existe un servicio Celery Beat. No se agregara hasta que exista una tarea periodica real.

URLs locales objetivo:

- Next.js: `http://localhost:3000`
- API Django: `http://localhost:8000/api/v1`
- Swagger: `http://localhost:8000/api/docs/`
- Esquema OpenAPI: `http://localhost:8000/api/schema/`
- Salud: `http://localhost:8000/health/`
- MinIO Console: `http://localhost:9001`

## Endpoints detectados

Todos los endpoints operativos usan JWT. Django resuelve la empresa operativa desde la membresia activa del usuario autenticado; el frontend no envia ni decide `company_id` para autorizar operaciones.

Django Admin es el superadmin interno de plataforma. Next.js es solo el portal operativo de la empresa asignada al usuario.

| Dominio | Endpoints reales |
| --- | --- |
| Autenticacion | `POST /auth/login/`, `POST /auth/refresh/`, `POST /auth/logout/`, `GET /auth/context/` |
| Credenciales propias | `POST /auth/password/change/` |
| Usuario actual, empresa asignada, rol y permisos | `GET /auth/context/` |
| Usuarios | `/users/`, `/users/{id}/` |
| Sucursales | `/branches/`, `/branches/{id}/` |
| Almacenes | `/warehouses/`, `/warehouses/{id}/` |
| Terminales POS | `/pos-terminals/`, `/pos-terminals/{id}/` |
| Categorias | `/categories/`, `/categories/{id}/` |
| Laboratorios | `/laboratories/`, `/laboratories/{id}/` |
| Proveedores | `/suppliers/`, `/suppliers/{id}/` |
| Clientes | `/customers/`, `/customers/{id}/` |
| Productos | `/products/`, `/products/{id}/`, `/product-variants/`, `/product-variants/{id}/` |
| Busqueda POS | `GET /products/?search=...` paginado y `GET /product-variants/by-barcode/?code=...` exacto |
| Lotes y stock | `/lots/`, `/stock/`, `POST /stock/adjustments/` |
| Kardex | `/inventory-movements/`, `/inventory-movements/{id}/` |
| Compras | `/purchases/`, `/purchases/{id}/`, `POST /purchases/{id}/receive/` |
| Cajas | `/cash-registers/`, `/cash-sessions/`, `POST /cash-registers/open/`, `POST /cash-sessions/{id}/movements/`, `POST /cash-sessions/{id}/close/` |
| POS y ventas | `/sales/`, `/sales/{id}/`, `POST /sales/checkout/` |
| Transferencias | `/transfers/`, `/transfers/{id}/`, `POST /transfers/{id}/dispatch/`, `POST /transfers/{id}/start-transit/`, `POST /transfers/{id}/receive/` |
| Cancelacion de transferencia | `POST /transfers/{id}/cancel/`, solo mientras permanece en borrador |
| Dashboard | `GET /reports/dashboard/` |
| Reporte de ventas | `GET /reports/sales/` |
| Auditoria | `/audit-events/`, `/audit-events/{id}/` |
| Atributos farmaceuticos | `/active-ingredients/`, `/therapeutic-actions/`, `/product-locations/`, `/product-barcodes/` |
| Finanzas | `/payables/`, `/receivables/`, `/financial-categories/`, `/financial-movements/` y acciones transaccionales |
| Arqueos | `GET/POST /cash-sessions/{id}/counts/` |
| Solicitudes | `/customer-requests/` y acciones de estado/conversion |

La paginacion usa `page` y `pageSize`; los listados soportan `search`, `ordering` y filtros definidos por cada ViewSet.

## JWT auditado

La implementacion real usa Simple JWT:

- Access token: 15 minutos.
- Refresh token: 7 dias.
- Rotacion de refresh: activada.
- Blacklist despues de rotacion: activada.
- Access token esperado en `Authorization: Bearer <token>`.
- Login y refresh devuelven el access token; el refresh se mantiene en cookie `HttpOnly`.
- Logout invalida el refresh mediante blacklist y elimina la cookie.

El access token vive solo en memoria del navegador. El refresh permanece en cookie `HttpOnly`, `SameSite=Lax` y `Secure` configurable; no se guardan tokens en `localStorage`.

## Frontend auditado

La seleccion de datos existe en `features/shared/config/runtime.ts` mediante:

- `NEXT_PUBLIC_DATA_SOURCE=mock|api`
- `NEXT_PUBLIC_API_BASE_URL`

El cliente API central gestiona base URL, JWT en memoria, refresh con cookie `HttpOnly`, timeout y normalizacion de errores. No envia `company_id`; Django resuelve la empresa desde la membresia activa.

Mocks aislados detectados:

- Sesion y tenant demo: `features/auth/mocks/demo-tenant.ts`
- Productos: `features/products/mocks/product-fixtures.ts`
- Pantallas genericas: `features/modules/config/module-screens.ts`

CRUD simulado detectado: `features/modules/components/module-screen-page.tsx` mantiene filas con `useState`; los cambios desaparecen al recargar.

Preparados parcialmente para API:

- Productos: tiene servicio seleccionable mock/API, pero la pagina principal aun no lo consume.
Solo visuales o mock actualmente: dashboard, categorias, laboratorios, proveedores, clientes, sucursales, almacenes, cajas, compras, inventario, kardex, transferencias, POS, ventas y reportes.

Existe `/login`, implementado en `features/auth/components/login-page.tsx` y estilizado en `app/globals.css`. Actualmente inicia una sesion demo sin validar credenciales. No existe middleware ni proteccion real de rutas.

## Arquitectura de integracion

1. Las paginas y componentes consumen servicios o repositorios, nunca fixtures ni `fetch` directo.
2. Los repositorios seleccionan implementacion mock/API con `NEXT_PUBLIC_DATA_SOURCE`.
3. Un cliente HTTP central gestiona base URL, access JWT, timeout, errores y refresh.
4. Un contexto de sesion carga usuario, empresa asignada, sucursales permitidas, rol y permisos desde Django en modo API.
5. La sucursal activa se elige solo entre opciones devueltas por Django. Toda autorizacion final permanece en el backend.
6. TanStack Query gestionara cache, invalidacion, loading, errores y mutaciones de datos del servidor.
7. Las operaciones criticas usaran los endpoints transaccionales existentes y sus claves de idempotencia.

## Variables de entorno

Backend: ver `backend/.env.example`. Los nombres efectivos son `DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` y variables `AWS_*` para MinIO/S3.

Frontend objetivo (`frontend/.env.local`):

```dotenv
NEXT_PUBLIC_DATA_SOURCE=api
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_APP_NAME=Botica Farma
NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true
```

No se publica ningun secreto de Django mediante variables `NEXT_PUBLIC_*`.

## Ejecucion local

Desde la raiz del repositorio:

```bash
docker compose up --build -d  # compose.yml ahora esta en la raiz
docker compose -f backend/compose.yml ps
docker compose -f backend/compose.yml exec api python manage.py migrate
docker compose -f backend/compose.yml exec api python manage.py check
docker compose -f backend/compose.yml exec api python manage.py seed_demo
cd frontend
npm install
npm run dev
```

Los comandos se validaran nuevamente despues de ajustar Compose y crear el seed completo.

## Estado de conexion

Login, sesion, empresa asignada, sucursales permitidas, productos, atributos, proveedores, clientes, compras, stock, kardex, caja, POS, ventas, transferencias, dashboard, CxP, CxC, gastos, ingresos y solicitudes consumen API real en modo `api`. Los modulos legacy no incluidos en estos dominios conservan su pantalla generica o estado planificado; no se presentan como persistencia real.

El POS no precarga el catalogo: busca productos remotamente con debounce y paginacion, consulta
codigos de barra de forma exacta y solicita stock por presentacion/almacen al agregar una linea. El
backend conserva autoridad sobre precio, impuesto incluido, descuentos y total.

## Problemas y decisiones

- JWT no expone logout: se agregara logout con blacklist y cookie `HttpOnly` para refresh.
- El contexto devuelve roles pero no permisos explicitos: Django expondra permisos calculados a partir de la membresia.
- El seed actual `bootstrap_demo` solo crea infraestructura minima: se reemplazara o ampliara con `seed_demo` idempotente.
- Compose tiene credenciales locales embebidas: se parametrizara con `.env` y valores de desarrollo documentados.
- Las rutas privadas solo estan ocultas visualmente: se agregara proteccion de navegacion y validacion de sesion.
- Persisten rutas opcionales de impresion CodeIgniter: se aislaran hasta reemplazarlas con una ruta imprimible de Next.js.
- Node local es 24.16.0 y el frontend declara `>=20 <23`: se recomienda Node 22 LTS para resultados reproducibles.
- No existe superadmin en Next.js: altas, suspension de empresas, membresias globales y auditoria global se realizan solo en Django Admin.
