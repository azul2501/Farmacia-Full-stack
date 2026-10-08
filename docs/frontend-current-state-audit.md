# Auditoria del estado actual del frontend

Fecha: 2026-06-19

## Alcance

Esta auditoria cubre exclusivamente `frontend/`. El backend CodeIgniter permanece fuera del alcance de esta fase. No existe todavia un backend Django REST Framework ni se asume persistencia real.

## Estructura actual

- Next.js 15 con App Router y TypeScript estricto.
- Layout global en `frontend/app/layout.tsx`.
- Shell autenticado visual en `frontend/components/layout/app-chrome.tsx`.
- Sidebar en `frontend/components/sidebar.tsx`.
- Rutas dinamicas `app/[modulo]` y `app/[modulo]/[vista]`.
- Pantalla generica en `features/modules/components/module-screen-page.tsx`.
- Configuracion de 50 pantallas en `features/modules/config/module-screens.ts`.
- Registro de 32 modulos en `frontend/lib/modules.ts`.
- 44 accesos visibles definidos directamente en el sidebar.
- Estilos propios en `frontend/app/globals.css`.

## Componentes reutilizables existentes

- `AppChrome`: topbar, sidebar, contenido y footer.
- `Sidebar`: grupos desplegables y estado de ruta activa.
- `PageHeader`: titulo, breadcrumb y acciones.
- `ModuleShell`: adaptador entre rutas y pantalla generica.
- `ModuleScreenPage`: tabla, busqueda, formulario y acciones CRUD en memoria.

La reutilizacion actual reduce duplicacion visual, pero sobre-generaliza ventas, compras, caja, inventario y transferencias. Esos flujos requieren pantallas de dominio.

## Rutas existentes

- `/`: dashboard.
- `/login`: login visual no conectado.
- `/[modulo]`: ruta dinamica principal.
- `/[modulo]/[vista]`: submodulos.
- `/operacion/[modulo]/[accion]`: apertura de una accion generica.
- Alias existentes: `/ventas`, `/compras`, `/clientes`, `/productos`, `/reportes`.
- No existe modulo frontend de superadmin SaaS. La administracion global de empresas/farmacias clientes corresponde solo a Django Admin.

Las rutas actuales deben conservarse mientras se introducen progresivamente rutas especializadas como `/pos`, `/stock`, `/transferencias` y `/ventas/[id]/imprimir`.

## Modulos registrados

Venta, notas de venta, cotizaciones, despacho, clientes, productos, atributos, bonificaciones, servicios, inventario, compras, solicitudes, proveedores, caja, cuentas por cobrar, cuentas por pagar, ingresos, gastos, facturacion, consultas, movimientos, reportes, empresa, establecimientos, series, puntos, transporte, traslados, usuarios y utilitarios.

Solo productos aparece marcado internamente como `next-ready`; los otros 31 modulos siguen marcados como `legacy`, aunque el dashboard los presenta visualmente como Next.

## Datos estaticos detectados

- `features/modules/config/module-screens.ts`: filas de demostracion de todas las pantallas genericas.
- La ruta `/farmacias` fue retirada del portal operativo.
- `features/dashboard/components/dashboard-page.tsx`: metricas fijas.
- `features/products/api/products-api.ts`: fallback silencioso a dos productos demo.
- `components/layout/app-chrome.tsx`: usuario y contadores fijos.

Estos datos deben migrarse a `mocks/` por dominio y exponerse mediante contratos de repositorio.

## CRUD simulados

`ModuleScreenPage` agrega, edita y elimina filas con `useState`. No existe persistencia, control de concurrencia, validacion de dominio ni respuesta de servidor. Al recargar se pierde todo cambio.

El login y la sesion deben mostrar estados bloqueantes claros cuando no exista empresa, sucursal o almacen asignado.

## Dependencias con CodeIgniter legacy

- La impresion abre rutas definidas por `NEXT_PUBLIC_LEGACY_APP_BASE_URL`.
- El `.env` actual contiene una IP privada para impresion legacy.
- `frontend/public/legacy` contiene aproximadamente 12 MB de CSS, JavaScript, fuentes, logos y plugins copiados.
- En ejecucion solo se usa Font Awesome y algunos logos; Bootstrap, AdminLTE y jQuery no se cargan.

La impresion nueva debe usar rutas Next y `window.print()`. Las rutas legacy deben quedar aisladas tras una feature flag temporal y no ser la opcion predeterminada.

## Modulos que pueden continuar genericos

- Categorias.
- Laboratorios.
- Proveedores.
- Clientes.
- Usuarios, durante la etapa visual.
- Roles y permisos, durante la etapa visual.
- Configuraciones simples.
- Catalogos auxiliares.

Aunque usen componentes compartidos, cada dominio debe mantener tipos, schemas, mocks y repositorio propios.

## Modulos que necesitan pantallas especializadas

- Productos y presentaciones vendibles.
- Compras y recepcion de mercaderia.
- Stock por almacen y lote.
- Inventario fisico y ajustes.
- Kardex.
- Transferencias y recepcion parcial.
- Apertura, operacion y cierre de caja.
- POS.
- Ventas y detalle de venta.
- Impresion termica y normal.
- Dashboard y reportes.

## MVP visual

El MVP visual incluye dashboard, sucursales, almacenes, cajas, usuarios, roles, categorias, laboratorios, proveedores, clientes, productos, compras, stock, kardex, transferencias, caja, POS, ventas, reportes basicos y configuracion.

Facturacion SUNAT, cotizaciones avanzadas, cuentas por cobrar/pagar, bonificaciones, puntos, transportes, utilitarios y herramientas contables deben ocultarse o mostrarse como `Proximamente` hasta tener un flujo definido.

## Riesgos actuales

- No hay autenticacion, autorizacion ni contexto tenant real.
- No hay pruebas unitarias ni E2E.
- ESLint no esta configurado y `npm run lint` abre un asistente.
- El entorno ejecuta Node 24, fuera del rango declarado `>=20 <23`.
- Los modales no controlan foco, Escape ni bloqueo de scroll.
- El sidebar movil no funciona como drawer.
- Los formularios genericos no representan reglas de negocio.
- Los errores de productos se convierten silenciosamente en datos demo.

## Plan de migracion mock a API

1. Definir contratos TypeScript de repositorio por dominio.
2. Aislar fixtures en `features/<dominio>/mocks`.
3. Implementar repositorios mock con relaciones coherentes entre empresa, sucursal, almacen, caja, lote y stock.
4. Consumir repositorios desde hooks; las pantallas no deben importar fixtures.
5. Preparar repositorios API que usen el cliente HTTP compartido.
6. Seleccionar implementacion con `NEXT_PUBLIC_DATA_SOURCE=mock|api`.
7. Mantener respuestas paginadas, filtros, ordenamiento y errores con contratos comunes.
8. Sustituir un repositorio mock por su implementacion API sin cambiar componentes visuales.
9. Eliminar la etiqueta de demostracion solo cuando la API y persistencia real esten activas.

## Criterio de avance

El frontend actual es una base navegable y visual, no una migracion funcional completa. La Fase 1 debe estabilizar layout, sesion demo, permisos visuales, sidebar responsive, modal, confirmaciones, toasts, estados y tabla base antes de especializar dominios.
