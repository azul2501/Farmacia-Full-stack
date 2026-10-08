# Ampliacion de productos, finanzas y solicitudes

## Auditoria inicial

Fecha: 2026-06-20.

Esta ampliacion conserva el monolito modular Django, la API `/api/v1`, el frontend Next.js y el aislamiento por membresia activa del usuario autenticado. No se crea un proyecto paralelo ni se reemplazan los flujos transaccionales existentes.

## Inventario de backend existente

| Dominio | Modelos y servicios reutilizables | Estado actual |
| --- | --- | --- |
| Producto | `Product`, `ProductVariant`, `ProductBarcode` | Ya separa producto maestro, SKU y codigo de barras. Producto tiene categoria, laboratorio, principio activo como texto y reglas de lote. SKU tiene conversion, fraccionamiento, stock minimo y precio de venta. |
| Atributos | `Category`, `Laboratory` | CRUD real, multiempresa y protegido por roles. No existen catalogos de principio activo, accion terapeutica ni ubicacion por almacen. |
| Inventario | `Lot`, `Stock`, `InventoryMovement`, `InventoryService` | Stock por almacen/SKU/lote, kardex inmutable y costo unitario por movimiento. No existe edicion directa de stock. |
| Compras | `Purchase`, `PurchaseItem`, `PurchaseService.receive` | Borrador con multiples detalles; recepcion atomica crea lote, stock, kardex y auditoria. No existen condicion de pago, pagos, vencimiento financiero ni CxP. |
| Ventas | `Sale`, `SaleItem`, `SalePayment`, `SaleService.checkout` | Checkout idempotente y atomico; FEFO, stock, kardex, caja y pagos. Exige pago completo. No soporta credito ni saldo pendiente. |
| Caja | `CashRegister`, `CashSession`, `CashMovement`, `CashService` | Apertura, entradas/retiros, venta en efectivo y cierre. No existe arqueo inmutable separado ni desglose esperado por medio de pago. |
| Terceros | `Supplier`, `Customer` | CRUD real y aislado por empresa. Cliente no tiene datos de limite de credito, que se dejan para futuro. |
| Auditoria | `AuditEvent`, `record_audit` | Reutilizable para precios, pagos, cobros, movimientos, arqueos y solicitudes. |
| Permisos | `Role`, `HasCompanyAccess`, `HasCompanyRole`, politicas por ViewSet | Roles fijos actuales: `SUPERADMIN`, `OWNER`, `BRANCH_ADMIN`, `WAREHOUSE_OPERATOR`, `CASHIER`. No existe `FINANCE_USER`. |

## Endpoints existentes relacionados

- Productos: `/products/`, `/product-variants/`.
- Categorias y laboratorios: `/categories/`, `/laboratories/`.
- Proveedores y clientes: `/suppliers/`, `/customers/`.
- Compras: `/purchases/`, `POST /purchases/{id}/receive/`.
- Lotes, stock y kardex: `/lots/`, `/stock/`, `/inventory-movements/`.
- Caja: `/cash-registers/`, `/cash-sessions/` y acciones `open`, `movements`, `close`.
- POS y ventas: `/sales/`, `POST /sales/checkout/`.
- Auditoria: `/audit-events/`.

No existen endpoints equivalentes para principios activos, acciones terapeuticas, ubicaciones, CxP, CxC, gastos, ingresos, arqueos persistidos o solicitudes programadas.

## Estado del frontend

- `/producto` consume `/products/`, pero usa `ApiResourcePage`, un CRUD generico que solo edita el maestro. No crea ni edita presentaciones, codigos o precios de compra.
- `/atributo` consume categorias y laboratorios mediante tabs reales. Faltan tres tabs y contexto de ubicacion.
- `/compra` es un listado API de solo lectura. La configuracion visual legacy contiene un formulario estatico que ya no es la fuente de datos.
- `/caja` actualmente administra cajas fisicas con CRUD generico; no representa caja actual, arqueo o cierre.
- `/pos` usa API real, stock, lotes, caja, pagos e idempotencia. No soporta credito.
- `/cobrar`, `/pagar`, `/ingreso`, `/gasto` y `/solicitud` siguen siendo pantallas genericas con filas locales de demostracion.
- TanStack Query, cliente API central, JWT, contexto de empresa asignada/sucursal y permisos reales ya existen y se reutilizaran.

## Brechas por fase

### Producto y atributos

Faltan en `Product`: registro sanitario, DIGEMID, afectacion IGV, receta, puntos e informacion adicional. `active_ingredient` sigue siendo texto y no existe accion terapeutica.

Faltan en `ProductVariant`: precio de empaque de compra, factor de compra, costo unitario calculado/persistido, factor de venta y moneda. `base_sale_price` se conserva como precio unitario vigente.

La ubicacion debe modelarse como una relacion `ProductWarehouseLocation` entre empresa, almacen y SKU, con codigo, pasillo, estante, nivel y estado. No se agregara una ubicacion global al producto.

La migracion de principio activo sera compatible: el texto actual se preservara durante una migracion de datos y se convertira en una relacion multiempresa. No se perderan valores existentes.

### Compras y costos

`PurchaseItem.unit_cost` y `InventoryMovement.unit_cost` ya conservan costo historico por recepcion. Se reutilizaran; no se permitira editar una compra confirmada ni sus costos historicos.

Se agregaran precio de empaque y factor al detalle; `unit_cost` sera calculado en backend. Para registros existentes el factor sera `1` y el precio de empaque tomara el costo previo.

La compra incorporara condicion de pago, vencimiento, medio de pago, referencia y caja cuando corresponda. La confirmacion seguira centralizada en `PurchaseService`, ampliada para crear exactamente un pago o una CxP.

### Finanzas

Se implemento la app modular `finance` con:

- `PayableAccount` y `PayablePayment`.
- `ReceivableAccount` y `ReceivableCollection`.
- `FinancialCategory` para gasto/ingreso.
- `FinancialMovement` como libro operativo con origen explicito y anulacion logica.

Las cuentas tendran relacion uno a uno con compra o venta para impedir duplicados. Los pagos y cobros seran inmutables e idempotentes. Cuando el medio sea efectivo, el servicio financiero creara tambien un `CashMovement` en la misma transaccion.

No se registrara una venta como ingreso adicional ni un pago de CxP como gasto. `FinancialMovement.origin` distinguira `SALE`, `RECEIVABLE_COLLECTION`, `PAYABLE_PAYMENT`, `EXPENSE`, `ADDITIONAL_INCOME`, `CASH_WITHDRAWAL`, `CASH_CONTRIBUTION` y `ADJUSTMENT`.

### Caja y arqueo

Se conservaran `CashSession` y `CashMovement`. Se ampliaran los tipos de movimiento para cobro, pago, gasto, ingreso y aporte.

Se agregara `CashCount` como registro inmutable de arqueo parcial/final. El backend calculara el desglose esperado; el frontend solo enviara montos contados y observacion. El cierre con diferencia exigira observacion.

### Solicitudes programadas

Se creara la app `customer_requests` con `CustomerRequest` y `CustomerRequestItem`. La solicitud no modificara stock, caja, kardex ni cuentas.

La conversion usara `SaleService.checkout` dentro de una transaccion y relacionara la venta resultante con la solicitud. No se implementara reserva de stock en esta fase.

## Migraciones previstas

1. `catalog.0002`: atributos farmaceuticos, campos de producto/precio, codigos de barra escribibles y ubicaciones por almacen; incluye migracion de datos del principio activo textual.
2. `purchases.0002`: condicion de pago, vencimiento y datos de pago; precio/factor de empaque en detalle y migracion de costos existentes.
3. `sales.0002`: condicion de pago, vencimiento, saldo inicial y relacion futura con solicitud.
4. `cash.0002`: nuevos tipos y modelo de arqueo.
5. `finance.0001`: CxP, CxC, pagos, cobros, categorias y movimientos.
6. `customer_requests.0001`: solicitudes y detalles.

Todas seran aditivas o incluiran `RunPython` reversible cuando se transforme informacion existente. No se borraran tablas ni datos actuales.

## Contratos API implementados

Se conservaran los endpoints actuales y se ampliaran sus serializers. Solo se agregaran recursos que hoy no tienen equivalente:

- `/active-ingredients/`
- `/therapeutic-actions/`
- `/product-locations/`
- `/product-barcodes/`
- `/payables/` y `/payables/{id}/payments/`
- `/receivables/` y `/receivables/{id}/collections/`
- `/financial-categories/`
- `/financial-movements/`, `POST /financial-movements/manual/` y `POST /financial-movements/{id}/void/`.
- `/cash-sessions/{id}/counts/`
- `/customer-requests/`, acciones `submit`, `confirm`, `prepare`, `cancel` y `convert`.

La confirmacion de compra mantendra la URL compatible `/purchases/{id}/receive/`; su semantica sera confirmacion/recepcion transaccional.

## Permisos

- `OWNER` y `BRANCH_ADMIN`: productos, atributos, finanzas, arqueos y solicitudes segun alcance empresarial/sucursal.
- `WAREHOUSE_OPERATOR`: productos, atributos, compras, inventario y transferencias; sin cuentas financieras ni cierre de caja.
- `CASHIER`: POS, caja propia, clientes, solicitudes y cobros autorizados; sin precios de compra, CxP ni administracion de catalogo.
- `SUPERADMIN`: mantiene acceso global sujeto al contexto seleccionado.

No se agregara `FINANCE_USER` hasta introducir permisos personalizables; el modelo actual usa roles fijos. Se agregaran permisos visuales y politicas backend especificas, pero Django seguira siendo la autoridad.

## Orden de implementacion

1. Producto, presentaciones, atributos, ubicaciones y auditoria de precio.
2. Pantallas especializadas de producto y atributos.
3. Compra especializada y CxP.
4. Credito POS y CxC.
5. Gastos, ingresos y libro financiero.
6. Arqueos/cierre.
7. Solicitudes y conversion.
8. Sidebar, permisos, seed, OpenAPI y pruebas integrales.

## Fuera de alcance confirmado

SUNAT, documentos electronicos, notas tributarias, portal publico, aplicacion movil, IA, delivery, pasarelas, contabilidad completa, listas de precios multiples, politicas avanzadas de credito, reservas de stock y modo offline completo.

## Riesgos y decisiones

- El costo historico debe seguir en compra/kardex; el costo de referencia del SKU no puede reescribir recepciones pasadas.
- El credito mixto requiere que pagos inmediatos mas saldo pendiente igualen el total; no se aceptaran saldos negativos.
- Toda salida/entrada en efectivo debe enlazar una caja abierta y una sola fuente financiera para evitar duplicacion.
- El mixin multiempresa filtra tambien por las sucursales asignadas a la membresia cuando la entidad tiene contexto de sucursal, almacen, caja o transferencia. Los servicios criticos vuelven a validar ese alcance antes de mutar datos.
- Las pantallas genericas se conservaran solo para modulos no migrados; los flujos criticos tendran componentes especializados.

## Estado implementado

### Backend

- Producto maestro, presentacion, codigo de barras, principio activo, accion terapeutica y ubicacion por almacen persisten en modelos separados.
- El costo unitario, ganancia y margen usan `Decimal`; precio y factor se validan en serializer, modelo y base de datos.
- Los cambios de precio de venta generan auditoria. Los catalogos, productos, presentaciones y ubicaciones usan baja logica en lugar de `DELETE` fisico.
- La compra en borrador calcula cantidades y costos por empaque. Su confirmacion atomica crea lote, stock, kardex y un pago o una unica CxP.
- El checkout POS admite contado o credito, pagos parciales, CxC unica, idempotencia y permiso `sales.credit`.
- CxP y CxC admiten pagos/cobros parciales idempotentes y reflejan efectivo una sola vez en caja.
- Gastos e ingresos adicionales usan categorias, origen explicito, adjunto S3-compatible, anulacion logica y contramovimiento de caja.
- `CashCount` guarda arqueos parciales/finales inmutables; todo cierre crea arqueo final y exige observacion ante diferencia.
- Las solicitudes no afectan stock. Las transiciones son controladas y la conversion reutiliza el checkout transaccional.

### Frontend

- `/producto`, `/atributo`, `/compra`, `/caja`, `/pagar`, `/cobrar`, `/gasto`, `/ingreso` y `/solicitud` usan componentes especializados con API real.
- POS permite credito solo cuando el contexto de sesion incluye `sales.credit` y muestra el saldo generado.
- El sidebar se reorganizo en Ventas, Almacen, Caja y finanzas, Catalogos y Administracion, filtrado por permisos Django.
- Formularios, errores API, estados de carga, confirmaciones, toasts y tablas reutilizan la infraestructura actual de Next/TanStack Query.

## Migraciones finales

- `catalog.0002_activeingredient_productwarehouselocation_and_more`
- `purchases.0002_purchase_cash_session_purchase_payment_condition_and_more`
- `sales.0002_sale_amount_paid_sale_balance_due_and_more`
- `cash.0002_alter_cashmovement_movement_type_cashcount`
- `finance.0001_initial`
- `finance.0002_financialmovement_attachment`
- `customer_requests.0001_initial`

## Verificacion ejecutada

- Backend: `ruff`, `manage.py check`, consistencia de migraciones y 11 pruebas pasan.
- OpenAPI: generado y validado sin advertencias.
- Frontend: TypeScript estricto, lint y build de produccion pasan.
- Migraciones locales y `seed_demo` ejecutados dos veces sin duplicar datos.
- PostgreSQL/Compose queda pendiente de ejecucion porque Docker Desktop no respondio desde WSL durante esta sesion.
