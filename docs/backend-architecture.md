# Arquitectura backend SaaS para boticas

## Decision de arquitectura

Django Admin es el superadmin interno de plataforma. Desde ahi se crean y administran empresas/farmacias clientes, usuarios dueno o administradores, membresias, roles, estado operativo, sucursal inicial, almacen inicial, caja/terminal inicial y auditoria global.

Next.js es solo el portal operativo por empresa. No tendra modulos para crear empresas, suspender farmacias, gestionar planes globales, administrar clientes SaaS ni ver datos de todas las empresas.

## Contexto y aislamiento

El backend usa una base compartida con `company_id` explicito. El usuario obtiene un JWT y cada
peticion operativa resuelve la empresa desde la membresia activa del usuario autenticado. El frontend
no elige ni envia `company_id` para autorizar operaciones. `HasCompanyAccess` valida la membresia y
`CompanyScopedViewSetMixin` aplica el filtro empresarial antes de paginar o buscar.

Los roles iniciales son SUPERADMIN, OWNER, BRANCH_ADMIN, WAREHOUSE_OPERATOR y CASHIER. Las
membresias pueden limitarse a sucursales; el filtro fino por sucursal debe evolucionar junto con
los permisos que entregue el frontend.

## Consistencia de inventario

`Stock` es una proyeccion actual por empresa, almacen, presentacion y lote. No se edita desde CRUD.
`InventoryService.apply_movement()` bloquea la fila, valida que no quede negativa, actualiza la
existencia y crea `InventoryMovement` con saldo resultante, usuario y documento relacionado.

PostgreSQL aplica restricciones unicas con `NULLS NOT DISTINCT` para existencias y lotes sin
vencimiento. SQLite local no reproduce esa garantia y no debe usarse en produccion.

## Flujo de compra y venta

1. Compra DRAFT con detalles.
2. `receive` bloquea la compra.
3. Valida lote/vencimiento por producto.
4. Crea o reutiliza lote.
5. Genera PURCHASE_IN, stock y kardex.
6. POS exige caja OPEN y clave de idempotencia.
7. Selecciona lote FEFO vigente cuando no se indica uno.
8. Genera SALE_OUT por detalle.
9. Registra pagos y CASH_SALE para efectivo.
10. Confirma venta y auditoria en la misma transaccion.

## Flujo de transferencia

1. DRAFT define origen, destino, productos y lotes.
2. `dispatch` genera TRANSFER_OUT y estado DISPATCHED.
3. `start-transit` cambia a IN_TRANSIT.
4. `receive` acepta cantidades parciales.
5. Cada recepcion genera TRANSFER_IN en destino.
6. El estado cambia a RECEIVED cuando no queda cantidad pendiente.

## Alta interna de una empresa cliente

El flujo operativo en Django Admin es:

1. Crear `Company` con razon social, nombre comercial, RUC, moneda, zona horaria y estado activo.
2. Crear o seleccionar `User` dueno/administrador.
3. Crear `Membership` activa para la empresa y asignar `OWNER` o `BRANCH_ADMIN`.
4. Crear `Branch` inicial para la empresa.
5. Crear `Warehouse` inicial asociado a esa sucursal y empresa.
6. Crear `POSTerminal` o caja inicial cuando corresponda.
7. Revisar `AuditEvent` global desde Django Admin cuando se necesite soporte o trazabilidad.

Si una empresa esta suspendida (`is_active=False`), el portal operativo debe bloquear el acceso y mostrar un mensaje de soporte.

## API principal

- `/api/v1/auth/token/`, `/auth/token/refresh/`, `/auth/context/`
- `/users/`, `/branches/`, `/warehouses/`, `/pos-terminals/`
- `/categories/`, `/laboratories/`, `/suppliers/`, `/customers/`
- `/products/`, `/product-variants/`, `/lots/`
- `/stock/`, `/stock/adjustments/`, `/inventory-movements/`
- `/purchases/`, `/purchases/{id}/receive/`
- `/cash-registers/open/`, `/cash-sessions/{id}/movements/`, `/cash-sessions/{id}/close/`
- `/sales/checkout/`, `/sales/{id}/`
- `/transfers/{id}/dispatch/`, `/start-transit/`, `/receive/`
- `/reports/dashboard/`, `/reports/sales/`, `/audit-events/`

El contrato exacto generado está en `backend/openapi.yaml`.

## Siguiente etapa

1. Conectar repositorios Next con autenticacion y contexto real.
2. Añadir politicas por sucursal y permisos configurables por accion.
3. Implementar reservas de stock para ventas concurrentes de larga duracion.
4. Agregar devoluciones/anulaciones mediante movimientos compensatorios.
5. Añadir snapshots contables y reportes asincronos.
6. Ejecutar pruebas de concurrencia sobre PostgreSQL real.
