# Fase 1 - Base frontend lista para evolucionar

Fecha: 2026-06-19

## Cambios realizados

- Auditoria completa en `docs/frontend-current-state-audit.md`.
- Configuracion `NEXT_PUBLIC_DATA_SOURCE=mock|api`.
- Cliente HTTP sin URL CodeIgniter predeterminada.
- Contratos comunes de listado, paginacion, mutaciones y repositorios.
- Coleccion temporal reutilizable con `persisted: false`.
- Contexto demo de empresa, sucursal, almacen, caja, usuario y rol.
- Roles demo: SUPERADMIN, DUENO, ADMINISTRADOR_SUCURSAL, ALMACENERO y CAJERO.
- Permisos visuales para modulos y acciones CRUD.
- Etiqueta global visible de modo demostracion.
- Sidebar colapsable en escritorio y drawer con overlay en movil.
- Navegacion reducida al MVP; POS, almacenes y roles aparecen como proximamente.
- Selector de sucursal y almacen activo.
- Selector de rol temporal para probar permisos.
- Menu de usuario y cierre de sesion demo.
- Modal accesible con Escape, trap de foco, restauracion de foco y bloqueo de scroll.
- Confirmaciones reutilizables.
- Toasts success, error, warning e info.
- Estados loading, empty y error con reintento.
- Tabla generica con busqueda, ordenamiento, paginacion y selector de filas.
- Utilidades de formato de moneda, cantidad, fecha y fecha/hora.
- Utilidad base para impresion con `window.print()`.
- Validacion base tipada sin dependencia externa.
- ESLint configurado y sin warnings.

## Archivos importantes

- `frontend/features/shared/config/runtime.ts`
- `frontend/features/shared/http/http-client.ts`
- `frontend/features/shared/data/repository.ts`
- `frontend/features/shared/data/in-memory-collection.ts`
- `frontend/features/auth/context/demo-session-context.tsx`
- `frontend/features/auth/mocks/demo-tenant.ts`
- `frontend/features/auth/utils/demo-permissions.ts`
- `frontend/features/shared/ui/modal/modal.tsx`
- `frontend/features/shared/ui/toast/toast-provider.tsx`
- `frontend/features/shared/ui/confirm/confirm-provider.tsx`
- `frontend/features/shared/ui/data-table/data-table.tsx`
- `frontend/components/layout/app-chrome.tsx`
- `frontend/components/sidebar.tsx`

## Que sigue siendo mock

- Empresa, sucursales, almacenes, cajas, usuario y roles.
- Filas de las pantallas genericas en `module-screens.ts`.
- Productos de ejemplo. La administracion global de empresas queda fuera de Next.js y pertenece a Django Admin.
- Metricas del dashboard.
- Altas, ediciones y eliminaciones de la pantalla generica.
- Alertas de stock y vencimiento del topbar.

Las pantallas muestran que los cambios son temporales. No existe autenticacion, token, base de datos ni persistencia real.

## Deuda trasladada a Fase 2

- Extraer las 50 filas genericas de `module-screens.ts` hacia mocks por dominio.
- Sustituir el estado React CRUD por repositorios mock por dominio.
- Crear hooks de consulta y mutacion para cada modulo del MVP.
- Incorporar schemas completos para formularios especializados.
- Migrar dashboard a repositorio mock coherente.
- Retirar tipos legacy de farmacia usados para prototipos visuales; no crear contratos SaaS de empresa y plan en Next.js.

## Cambio de mock a API

Modo actual:

```env
NEXT_PUBLIC_DATA_SOURCE=mock
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_ENABLE_LEGACY_PRINT=false
```

Modo futuro:

```env
NEXT_PUBLIC_DATA_SOURCE=api
NEXT_PUBLIC_API_BASE_URL=https://api.ejemplo.com/api/v1
NEXT_PUBLIC_ENABLE_LEGACY_PRINT=false
```

Cada dominio debe exportar un servicio o repositorio seleccionado por `runtimeConfig.dataSource`. La UI consume hooks del dominio y nunca importa fixtures. El modo API no debe caer silenciosamente a mocks cuando falla.

## Contratos esperados para la siguiente fase Django

Estos contratos son una propuesta frontend y no representan endpoints existentes:

- Contexto de sesion: usuario, rol, permisos, empresa y sucursales disponibles.
- Empresas, sucursales, almacenes y cajas con IDs estables.
- Listados paginados con `items`, `page`, `pageSize` y `total`.
- Filtros por empresa, sucursal, almacen, fechas y estado.
- Ordenamiento mediante `sortBy` y `sortDirection`.
- Errores normalizados con codigo, mensaje y errores de campo.
- Mutaciones con entidad resultante y metadatos de operacion.
- Productos con presentaciones, codigos de barra y reglas de lote/vencimiento.
- Stock por almacen y lote, nunca como campo editable directo.
- Compras, transferencias, caja y ventas como documentos con detalle y estados.

Las URLs concretas se definiran cuando se disene el API Django REST Framework.
