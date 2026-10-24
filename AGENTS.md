# Contexto para asistentes de IA (Claude Code, Codex, Cursor, etc.)

Léelo completo antes de tocar código. Resume decisiones, convenciones, estado y la guía de soporte.
Si algo aquí contradice el código, manda el código: corrige este archivo en el mismo cambio.

## 1. El producto

- **Botica Farma**: punto de venta SaaS para **boticas pequeñas de una sola tienda en Perú** que venden en mostrador.
- El dueño (Anderson, programador en Perú) quiere canales digitales, sin venta presencial: la botica se registra sola
  (`/signup`), prueba 30 días gratis y él administra todo desde el panel de superadmin (`/admin/`, Django Unfold).
- **Idioma**: toda la interfaz, mensajes, documentación y respuestas al usuario en **español**.
- Detalle funcional y de APIs: `docs/v1.md`. Lista de pruebas manuales: `docs/v1-pruebas.md`.

## 2. Cómo se trabaja (preferencias del dueño)

- PC con **Windows + Git Bash**, proyecto en `C:\projects\FARMACIA`, rama de trabajo **`v1-recorte`**.
  En Git Bash: `rm` (no `del`), `docker compose up -d` (con espacio), comandos desde la raíz salvo que se diga otra cosa.
- **Docker solo para el backend** (`db`, `redis`, `ruc`, `api`). El **frontend se corre aparte** con `npm run dev`
  dentro de `frontend/`. No volver a meter el frontend en `compose.yml` (sí sigue en `compose.prod.yml`).
- **No hacer commit ni push sin que el dueño lo pida.** Secretos y tokens solo en `.env`, nunca en el chat ni en el código.
- Cambios pequeños y explicados en español simple; al terminar, decir qué probar.

## 3. Arquitectura

| Parte | Tecnología | Dónde |
| --- | --- | --- |
| API | Django 6 + DRF, SimpleJWT en cookie, PostgreSQL, Redis | `backend/` |
| Panel superadmin | django-unfold (`/admin/`), dashboard en `templates/admin/index.html` | `backend/apps/*/admin.py` |
| Web | Next.js 15 (App Router), React 19, React Query, react-select | `frontend/` |
| Consulta RUC | contenedor `ruc` (gratis, local) | `compose.yml` |

- **Multiempresa**: cada request lleva `X-Company-ID` (lo pone el frontend). Roles en `apps/accounts/models.py`
  (`OWNER`, `CASHIER`, `INVENTORY_ROLES`, `ALL_COMPANY_ROLES`); permisos con `HasCompanyAccess` + `HasCompanyRole` y
  `role_permissions` por acción.
- **Versiones del producto** (en vez de `mvp: true`): `APP_VERSION` (backend) y `NEXT_PUBLIC_APP_VERSION` (frontend), hoy **1**.
  - Backend: `apps/core/features.py` (`FEATURE_VERSIONS`, `feature_enabled`, `FeatureGatedMixin` → 404,
    `ensure_company_can_operate`). V2: crédito y finanzas; V3: varias sucursales, traslados, solicitudes.
  - Frontend: `lib/modules.ts` (rutas con versión; lo que no está habilitado da 404) y `lib/features.ts`.
- **Suscripción**: `SubscriptionPlan` y `Company.subscription_status / trial_ends_at / tax_id_verified / can_operate`.
  Precio y días de prueba se editan en el panel. Prueba vencida o suspendida: entra pero **no puede vender**.
- **Alta de botica**: `apps/tenancy/signup.py` (`provision_store` crea sucursal PRINCIPAL, almacén TIENDA, terminal POS-01,
  caja CAJA-01, usuario dueño y membresía OWNER). Lo usan el registro web y el formulario "Agregar" del panel de Boticas.
- **Catálogo maestro** (`apps/digemid/`), compartido por todas las boticas:
  - `MasterProduct` con `product_type` (MEDICINE/SUPPLY), `suggested_price` y `source`.
  - Lista base `apps/digemid/data/catalogo_base.csv`: 434 genéricos de la RM 220-2024-MINSA (`RM220-###`) y 131 marcas e
    insumos (`BASE-###`), con precios **referenciales estimados**. Se carga sola al arrancar el `api`
    (`load_base_catalog --if-empty`).
  - Excel oficial de DIGEMID: `import_digemid_catalog <archivo> [--dry-run]`. Pendiente de recibir (pedido a
    catalogacion@minsa.gob.pe). Convive con la lista base y no pisa precios sugeridos.
  - En la app: Productos → "Agregar desde el catálogo" (uno, varios marcados, o "Cargar toda la lista").
    Endpoints `digemid/products/` (`add`, `bulk-add`, `base-summary`, `by-barcode`).
  - Alertas sanitarias: `sync_digemid_alerts` lee los PDF de DIGEMID y marca lotes en stock. Servicio `digemid-sync`
    con `--profile jobs`.
- **Inventario**: stock por lote y vencimiento. Entra por **Ingreso de mercadería** (`/compra`), y la carga inicial por
  **Stock y vencimientos → Importar stock inicial** (CSV). Ajustes solo sobre lotes existentes.

## 4. Convenciones de código

- Python: líneas ≤ 120, `ruff check` y `ruff format --check` (los corre la CI). Migraciones con nombre descriptivo;
  verificar con `makemigrations --check --dry-run`.
- Dinero: el backend guarda costos con 4 decimales (el costo unitario sale de dividir). **En pantalla y en formularios
  siempre 2 decimales**; factores y cantidades de empaque, enteros. Usar `toMoneyInput` / `toIntegerInput` /
  `formatQuantity` de `frontend/features/shared/utils/formatters.ts`, sin formatos sueltos.
- Selects largos: `SearchSelect` (`frontend/features/shared/ui/search-select/`, basado en react-select). Busca por varias
  palabras sin tildes y acepta código de barras. Dentro de `Modal`, el menú se dibuja en `document.body` (z-index 4100).
- Estilos: reutilizar las clases y variables CSS de `frontend/app/globals.css` (`--primary`, `--panel-border`, `--muted`...).
- Textos de UI cortos y en español de botica ("Ingreso de mercadería", no "Compra"; "Historial del producto", no "Kardex").
- Nueva funcionalidad = prueba en `backend/tests/` (pytest) o `*.test.mjs` en el frontend.

## 5. Comandos

```bash
# Backend (raíz del proyecto)
docker compose up -d --build api            # levanta db, redis, ruc y api (migra y carga la lista base)
docker compose up -d --remove-orphans       # si quedó algún contenedor viejo (por ejemplo "web")
docker compose logs -f api
docker compose exec api python manage.py createsuperuser
docker compose exec api python manage.py bootstrap_demo      # datos demo: owner@botica.demo / Demo12345!
docker compose run --rm tests                                # pytest del backend
docker compose exec api python manage.py makemigrations --check --dry-run

# Frontend
cd frontend && npm install && npm run dev    # http://localhost:3000
npx tsc --noEmit && npm test && npm run build
```

URLs: web `http://localhost:3000` · API `http://localhost:8000/api/v1/` · docs `/api/docs/` · panel `http://localhost:8000/admin/`.

## 6. Estado actual (24-10-2026)

Hecho en la rama `v1-recorte` (sin commit todavía; revisar `git status`):

- Fases 1 a 4: recorte a V1, registro de boticas con RUC, prueba gratis y panel Unfold.
- Catálogo DIGEMID y lista base, carga masiva, alertas DIGEMID y alta completa de boticas desde el panel.
- Docker sin frontend, buscador react-select en Ingreso de mercadería, decimales homogéneos.

Antes de seguir, confirmar que están aplicados los dos últimos cambios. Deben existir:

- `frontend/features/shared/utils/formatters.test.mjs`
- `react-select` en `frontend/package.json`, instalado con `npm install` (que también actualiza `package-lock.json`).

Pendiente o ideas acordadas:

1. Probar todo con `docs/v1-pruebas.md`, correr los tests y luego **commit** (el dueño lo pide; incluir `package-lock.json`).
2. Cuando llegue el **Excel de DIGEMID**: ajustar los alias de columnas en `apps/digemid/catalog_import.py` si hace falta e importarlo.
3. Ofrecido y sin respuesta:
   - pantalla "Inventario inicial" en tabla (además del CSV que ya existe);
   - usar `SearchSelect` en proveedor y otros selects largos;
   - etiquetas del panel en español;
   - slug para la botica;
   - quitar el frontend también de `compose.prod.yml`.
4. V2 (fuera de la V1): boletas y facturas electrónicas SUNAT, clientes, crédito, cuentas por cobrar y pagar, gastos,
   reportes, correos.

## 7. Guía de soporte (diagnóstico rápido)

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `error during connect ... dockerDesktopLinuxEngine` | Docker Desktop cerrado | Abrir Docker Desktop y esperar "Engine running" |
| `del: command not found` / `up-d` no existe | Comandos de CMD en Git Bash | Usar `rm` y `docker compose up -d` |
| No deja iniciar sesión en la app | Base vacía o usuario sin botica | `createsuperuser` (panel) o `bootstrap_demo`; el dueño debe tener membresía OWNER |
| Botica creada en el panel no puede vender | Le falta caja, almacén o terminal (boticas antiguas) | Crearla con Boticas → Agregar (usa `provision_store`); revisar que la suscripción esté activa o en prueba |
| "Tu periodo de prueba terminó o tu cuenta está suspendida" | `can_operate` es falso | Panel → Boticas → acción Activar plan o Extender prueba |
| El catálogo sale vacío al buscar | Lista base no cargada o menos de 3 letras | `docker compose exec api python manage.py load_base_catalog` |
| El producto no aparece en el POS | Sin stock | Hacer Ingreso de mercadería con lote y vencimiento y confirmarlo |
| Precios con 4 decimales en algún formulario | Valor del backend sin formatear | Pasarlo por `toMoneyInput` |
| `git apply` dice que no encuentra el patch | El archivo no está en la carpeta | Copiar el `.patch` a la raíz del proyecto antes de aplicarlo |
| Cambios del backend no se ven | Imagen vieja | `docker compose up -d --build api` |
| Error 404 en una pantalla o API | Es de una versión posterior (`APP_VERSION`) | Es lo esperado en la V1 |

Ante un error: pedir la salida de `docker compose logs api` o la consola del navegador y el paso exacto de `docs/v1-pruebas.md`.

## 8. Mapa rápido de archivos

- Backend:
  - `config/settings/base.py` (apps, Unfold, menú del panel), `config/urls.py`;
  - apps `core`, `accounts`, `tenancy`, `catalog`, `inventory`, `purchases`, `sales`, `cash`, `digemid`, `reports`, `audit`.
- Frontend:
  - rutas en `app/`;
  - lógica por módulo en `features/<modulo>/components/`;
  - API en `features/shared/api/` (`endpoints.ts`, `client.ts`);
  - UI común en `features/shared/ui/` (`modal`, `data-table`, `toast`, `confirm`, `search-select`).
- Docs: `docs/v1.md` (módulos y APIs), `docs/v1-pruebas.md` (checklist), `README.md` (cómo levantar).
