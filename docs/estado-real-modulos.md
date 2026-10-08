# Estado real de módulos — Sistema Botica Farma

Fecha de auditoría: 2026-08-08/09. Metodología: lectura completa de backend (`apps/*/views.py`, `services.py`, `models.py`, `permissions.py`) y frontend (`app/`, `features/*/components/`, `features/shared/*`), más una prueba end-to-end real en navegador contra un backend Django local (SQLite + `seed_demo`) — no solo lectura de código.

Estados usados: `API_REAL`, `MOCK`, `LEGACY`, `PLACEHOLDER`, `PARCIAL`, `BLOQUEADO`.

## 1. Clasificación real de módulos

| Módulo | Ruta | Estado real | Usa API | Usa mock | Usa legacy | Problema principal | Acción recomendada |
|---|---|---|---|---|---|---|---|
| Dashboard | `/` | API_REAL | Sí | Solo si `isDemoMode` | No | Ninguno grave; es el único componente que respeta correctamente `NEXT_PUBLIC_DATA_SOURCE` | Ninguna urgente |
| Login | `/login` | API_REAL | Sí | Copia visual en modo demo | No | Muestra credenciales demo en pantalla vía `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` | Apagar ese flag en producción |
| Productos | `/productos`, `/producto`, `/productos/nuevo`, `/productos/[id]/editar` | API_REAL | Sí (ignora el modo mock, ver §7) | No | No | No se puede reactivar un producto desactivado; costo unitario en el listado aparece en `S/0.00` para productos con compra ya recibida (ver Fase C) | Agregar reactivación; revisar de dónde lee el listado el costo unitario |
| Atributos de producto (categorías, laboratorios, principios activos, acciones terapéuticas, ubicaciones) | `/atributo` | API_REAL | Sí (ignora modo mock) | No | No | Sin problemas funcionales relevantes; confirmado en vivo con las 5 pestañas | Ninguna urgente |
| Proveedores | `/proveedor` | API_REAL | Sí (ignora modo mock) | No | No | Sin ficha de proveedor ni historial de compras, sin exportar | Posponer a Fase C |
| Clientes | `/cliente` | API_REAL | Sí (ignora modo mock) | No | No | Sin ficha de cliente/deuda, sin exportar | Posponer a Fase C |
| Compras | `/compras`, `/compra` | API_REAL | Sí (ignora modo mock) | No | No | Campo "Observación" de cabecera existe en el código pero no tiene control visible (huérfano); lote/vencimiento son opcionales aunque el producto los exija; no hay ver detalle/anular/imprimir una compra ya confirmada | Fase C (UX) + revisar cruce de validación con `requires_lot/requires_expiry` |
| Inventario / Stock | `/inventario` | API_REAL (solo lectura) | Sí (ignora modo mock) | No | No | Sin filtros por almacén/producto/vencimiento, sin exportar | Fase C |
| Kardex | `/consulta/kardex` | API_REAL (solo lectura) | Sí (ignora modo mock) | No | No | Fecha se muestra como timestamp crudo (`2026-06-20T13:03:28-0500`); sin filtros; sin exportar | Fase C |
| Transferencias | `/traslado` | **BLOQUEADO** para el usuario final | Solo lectura | No | No | El backend soporta el flujo completo (`dispatch`/`start-transit`/`receive`/`cancel`), pero el frontend es una tabla 100% de solo lectura (`transferListResource` con `readOnly:true, fields:[]`) — no existe ningún formulario para crear, despachar o recibir una transferencia | **Prioridad alta**: construir la pantalla real (Fase A/C) |
| Caja | `/caja` | API_REAL | Sí (ignora modo mock) | No | No | El arqueo solo pide un monto total, nunca desglose por denominación (ni esperado ni contado); no existe "reabrir caja" (tampoco en backend); no exporta el cierre | Fase C (desglose), evaluar reapertura como mejora de backend |
| POS | `/pos` | API_REAL | Sí (ignora modo mock: cuelga en skeleton si la API no responde) | No | No | Expone la palabra y el valor "SKU" al cajero; descuento por línea sin tope superior | Fase A (estado de error cuando la API no responde), Fase C (SKU, tope de descuento) |
| Ventas | `/ventas`, `/venta` | API_REAL | Sí (ignora modo mock) | No | No | No existe forma de anular una venta (ni en backend ni en frontend, aunque el modelo tiene estado `CANCELLED`); filtros son sobre los últimos 500 registros en cliente, no contra el servidor; no hay campo de observación en la venta; sin exportar | **Fase A** (falta de anulación es un bloqueador operativo real) |
| Cuentas por cobrar | `/cobrar` | API_REAL | Sí (ignora modo mock) | No | No | **Bug de idempotencia**: la clave se genera de nuevo en cada intento de envío (no es estable), a diferencia de POS/Solicitudes — un doble clic puede registrar un cobro duplicado | **Fase A** (riesgo financiero directo) |
| Cuentas por pagar | `/pagar` | API_REAL | Sí (ignora modo mock) | No | No | Mismo bug de idempotencia que Cuentas por cobrar | **Fase A** |
| Gastos | `/gasto` | API_REAL | Sí (ignora modo mock) | No | No | No existe ninguna pantalla para crear categorías financieras; si no vienen sembradas, el selector queda vacío sin salida | Fase B/C |
| Ingresos | `/ingreso` | API_REAL | Sí (ignora modo mock) | No | No | Mismo problema de categorías que Gastos | Fase B/C |
| Solicitudes | `/solicitud` | API_REAL | Sí (ignora modo mock) | No | No | Campos "descuento autorizado" y "notas" por línea existen en el código pero no tienen control en pantalla; la conversión a venta no valida que el efectivo recibido cubra el monto (a diferencia de POS) | Fase C |
| Reportes | `/reportes`, `/reporte` | **MOCK puro** | No | Sí (100%) | No | Es el peor caso del sistema: los botones "Generar/Ver/Exportar" abren un modal falso que, al confirmar, simplemente se cierra sin descargar nada y **sin ningún aviso de error** — ni el toast "modo demostración" que sí aparece en crear/editar/eliminar en otros mocks. El backend solo expone `/reports/dashboard/` y `/reports/sales/` en JSON (sin descarga), y el frontend de Reportes no los consume | **Fase C**: construir con datos reales de `/reports/sales/` + exportación real, o etiquetar "Próximamente" mientras tanto |
| Notas de venta | `/nventa` | MOCK | No | Sí | No | No hay dominio backend equivalente separado de Ventas | Definir si es redundante con Ventas y, si no aporta valor propio, quitarlo del menú |
| Cotizaciones | `/cotizacion` | MOCK | No | Sí | No | Sin endpoint backend | Ocultar/"Próximamente" (Fase D) |
| Despachos | `/despacho` | MOCK | No | Sí | No | Sin endpoint backend propio (se solapa conceptualmente con Transferencias/Ventas) | Ocultar/"Próximamente" |
| Bonificaciones | `/bonificacion` | MOCK | No | Sí | No | Sin endpoint backend | Ocultar/"Próximamente" |
| Servicios | `/servicio` | MOCK | No | Sí | No | Sin endpoint backend | Ocultar/"Próximamente" |
| Facturación | `/facturacion` | PLACEHOLDER | No | Sí | No | Fuera de alcance confirmado (SUNAT no incluido en esta etapa) | Marcar explícitamente "Próximamente", no dejarlo como tabla mock editable |
| Movimientos | `/movimiento` | MOCK | No | Sí | No | Se solapa conceptualmente con Kardex (inventario) y con el libro financiero (`financial-movements`) | Aclarar alcance o eliminar duplicidad de nombre/menú |
| Empresa | `/empresa` | **BLOQUEADO** | Parcial | Sí (en frontend) | No | El frontend es mock, y aunque se conectara, el backend solo permite editar `Company` a un `is_superuser` de Django — ni siquiera `OWNER` puede autoadministrar el nombre/RUC/moneda de su propia empresa vía API | Decidir si se necesita autoservicio; si sí, ampliar permiso en backend antes de construir la pantalla |
| Series | `/serie` | MOCK/PLACEHOLDER | No | Sí | No | Ligado a facturación SUNAT, fuera de alcance | Ocultar |
| Puntos | `/punto` | MOCK/PLACEHOLDER | No | Sí | No | Existe el flag `earns_points` en producto pero no hay backend de canje/acumulación | Ocultar hasta definir el flujo completo |
| Transporte | `/transporte` | MOCK/PLACEHOLDER | No | Sí | No | Sin endpoint backend | Ocultar |
| Utilitarios | `/utilitario` | MOCK/PLACEHOLDER | No | Sí | No | Sin alcance claro definido | Ocultar |
| Consultas | `/consulta` (base) y subvistas (`stockv`, `vhorario`, `bvendedor`) | MOCK (excepto Kardex) | Parcial | Sí | No | `/consulta/kardex` es real (contado arriba); el resto son mock puro sin backend | Definir cuáles subconsultas son necesarias, eliminar el resto del menú |

**Adicionales relevantes no pedidos explícitamente pero que sostienen los flujos anteriores:**

| Módulo | Ruta | Estado real | Problema principal |
|---|---|---|---|
| Establecimientos/Sucursales | `/establecimiento` | API_REAL | Solo `OWNER`/`BRANCH_ADMIN` puede administrar; sin problemas mayores |
| Almacenes | `/almacenes` | API_REAL | Sin problemas mayores |
| Cajas (registradoras) | `/cajas` | API_REAL, **pero rompe el build** | `app/cajas/page.tsx:6` usa `const module = ...`, nombre reservado por Next.js → `npm run build` falla hoy |
| Usuarios | `/usuario` | API_REAL | Borrado es físico (`instance.delete()`), inconsistente con el resto del sistema que usa baja lógica |

## 2. Acciones necesarias por módulo

Acciones que **hoy existen y funcionan** (✅), **existen pero están rotas/incompletas** (⚠️), y **faltan por completo** (❌).

### Productos
```
✅ Ver listado / buscar
✅ Editar
✅ Escanear código de barras (crear y buscar)
✅ Importar Excel (en realidad solo CSV; ver §3)
✅ Exportar Excel (en realidad CSV)
✅ Descargar plantilla (producto y stock inicial)
✅ Desactivar
❌ Reactivar — no existe en ningún lugar de la UI
❌ Ver stock por producto (hay que ir a /inventario y buscar manualmente)
❌ Ver kardex por producto (mismo problema)
⚠️ Filtro activos/inactivos — no existe, la tabla mezcla ambos estados
```

### Ventas
```
✅ Ver detalle
✅ Imprimir (térmica/A4, funciona muy bien)
❌ Ver observación — el modelo/UI no tiene ningún campo de observación en la venta
❌ Anular, aunque tenga permiso — no existe ni en frontend ni en backend
❌ Exportar Excel
⚠️ Filtros — funcionan pero solo sobre los últimos 500 registros descargados al cliente
```

### Compras
```
✅ Ver listado
✅ Nueva compra (borrador)
✅ Confirmar recepción (bloquea edición, crea lote/stock/kardex/pago o CxP)
❌ Ver detalle de una compra ya confirmada
❌ Editar — solo se puede mientras está en borrador (correcto por diseño, pero no hay aviso claro al usuario de por qué el botón desaparece)
❌ Anular una compra ya confirmada (solo se puede cancelar en borrador; no hay devolución a proveedor)
❌ Exportar Excel
❌ Imprimir/descargar comprobante interno
```

### Caja
```
✅ Abrir caja
✅ Ver movimientos/resumen
✅ Arqueo parcial
✅ Cierre (con observación y monto contado)
❌ Registrar ingreso/gasto/retiro directamente desde esta pantalla — hoy solo se hace indirectamente desde "Gastos"/"Ingresos" eligiendo medio de pago Efectivo
❌ Exportar cierre
❌ Reabrir una caja cerrada por error (tampoco existe en backend)
⚠️ El arqueo pide un solo monto total, nunca desglose por denominación
```

### Transferencias
```
❌ Nueva transferencia
❌ Despachar
❌ Recibir (total o parcial)
❌ Cancelar
✅ Solo "ver listado" (sin ninguna acción de fila)
```
El backend ya soporta las cuatro acciones faltantes; es 100% trabajo de frontend.

### Reportes
```
❌ Filtrar
❌ Exportar Excel
❌ Exportar PDF
❌ Ver detalle
❌ Limpiar filtros
```
Ninguna acción real existe hoy; todo el módulo es una tabla de demostración.

## 3. Reportes y descargas Excel/importación

| Ruta | Botón visible | Endpoint usado | Formato | ¿Funciona? | ¿El usuario entiende qué descarga? | ¿Pide filtros? | ¿Confirma? | ¿Muestra loading? | ¿Error claro? |
|---|---|---|---|---|---|---|---|---|---|
| `/productos` — Exportar Excel | "Exportar Excel" | `GET /products/export/` | CSV (rotulado como Excel) | Sí | Nombre `productos.csv`, sin fecha — parcialmente claro | No, siempre trae todo el catálogo activo | No aplica | No (sin spinner ni disabled) | Sí, con toast de error |
| `/productos` — Descargar plantilla | "Descargar plantilla" | `GET /products/template/` | CSV | Sí | Nombre `plantilla-productos.csv`, claro | No aplica | No aplica | No | Sí |
| `/productos` — Plantilla lotes/stock | "Plantilla lotes/stock" | `GET /products/stock-template/` | CSV | Sí (descarga) pero **es una plantilla huérfana**: no existe ningún endpoint que reciba ese archivo de vuelta | Nombre claro, pero el usuario no tiene cómo usarla luego | No aplica | No aplica | No | Sí |
| `/productos` — Importar Excel | "Importar Excel" (en realidad solo acepta `.csv`) | `POST /products/import-preview/` + `POST /products/import-commit/` | CSV únicamente | Sí, con vista previa real y errores por fila | Rótulo dice "Excel" pero exige CSV — confuso | No aplica | Sí (preview antes de confirmar) | Sí (`isPending`) | Sí, errores por fila en pantalla, **pero no hay descarga de un archivo de errores** |
| `/productos` — Ver historial de importaciones | No existe | — | — | No | — | — | — | — | — |
| `/ventas`, `/compras`, `/caja`, `/pagar`, `/cobrar`, `/gasto`, `/ingreso`, `/solicitud`, `/inventario`, `/consulta/kardex`, `/traslado` | Ninguno existe | — | — | No | — | — | — | — | — |
| `/reportes` (todas las subvistas: Almacén, Compras, Ventas, Caja, Contable) | "Generar", "Ver", "Exportar", botones dentro del modal de exportación | Ninguno — el modal se cierra sin llamar a ningún endpoint | — | **No, nunca ha funcionado** | No — no pasa nada y no se avisa | Pide fechas en un formulario que no hace nada con ellas | No | No | **No, falla en silencio** — ni siquiera el toast de "modo demostración" |

**Reglas esperadas vs. cumplimiento actual:**

1. Reporte con filtros claros (fecha, sucursal, almacén, proveedor/cliente) → ❌ no existe ningún reporte real filtrable en el frontend.
2. Nombre de archivo entendible → ⚠️ parcial: los de productos son legibles pero sin fecha (`productos.csv` siempre igual, se sobrescribe visualmente cada vez).
3. Plantilla con nombres legibles, no IDs → ✅ cumplido en las dos plantillas de productos.
4. Importación con vista previa y validación por fila → ✅ cumplido, pero solo para productos.
5. Descarga de archivo de errores → ❌ no existe en ningún lugar del sistema.
6. No debe haber botones de exportar que no hagan nada → ❌ **incumplido**: todo el módulo de Reportes.
7. No debe depender de rutas legacy/IPs internas → ✅ cumplido para lo que sí es real (impresión de venta usa `window.print()` de Next, no rutas legacy).
8. No debe exportar datos de otra empresa/sucursal → ✅ los endpoints reales de exportación filtran por la empresa activa del backend.
9. No debe cargar todo sin paginar cuando corresponda → ⚠️ el export de productos siempre trae el catálogo completo sin filtro; el listado de ventas trae hasta 500 registros fijos y filtra en cliente.

**Estructura estándar propuesta (a implementar en Fase C):**

```
Exportación:  [Filtrar]  [Limpiar filtros]  [Exportar Excel]
Importación:  [Descargar plantilla]  [Importar Excel]  [Ver historial de importaciones]
```

Hoy ningún módulo cumple ese estándar completo; Productos es el más cercano (le falta "Filtrar antes de exportar" e "Historial de importaciones").

## 4. Formularios difíciles de llenar

### Producto (`features/products/components/product-form-page.tsx`)
- Obligatorios reales: nombre comercial, categoría, unidad de venta, factor y precio de compra por empaque, al menos una forma de venta con precio.
- Ya no se muestra la palabra "SKU" al usuario (correcto); el código interno se genera automáticamente (correcto).
- Código de barras: buen soporte de lector con Enter, **pero el mismo campo aparece duplicado** en dos inputs distintos del formulario — confuso.
- Categoría, laboratorio, principio activo, acción terapéutica y proveedor habitual: tienen botón "+" y **sí crean en la API real**. Unidad y ubicación también tienen botón "+", pero **son simulacros solo-locales que no persisten** — se pierden al recargar. Inconsistencia a corregir.
- Moneda: correctamente fija a soles, sin selector.
- Precio/costo/margen: el sistema calcula automáticamente el costo por unidad y el margen — no se le pide al usuario que calcule nada. Bien resuelto.
- Falta: el sistema advierte si el precio de venta es menor al costo, pero **no bloquea el guardado**.
- Lote, vencimiento y costo real correctamente NO están en este formulario (están en Compra), cumpliendo la regla de negocio pedida.
- Estado vacío bien resuelto solo para almacenes ("No hay almacenes… Crear almacén"); el resto de selects (categoría, laboratorio, etc.) no necesitan mensaje porque tienen su propio botón "+".

### Compra (`features/purchases/components/purchases-page.tsx`)
- Lote y vencimiento son opcionales incluso cuando el producto los exige (`requires_lot`/`requires_expiry`) — no hay cruce de validación.
- El campo "Observación" de cabecera existe en el código pero no tiene ningún input visible — no se puede usar.
- No muestra el costo por unidad calculado en pantalla al momento de recibir (sí lo muestra el formulario de producto).
- Proveedor no tiene botón "+" de creación rápida (sí lo tiene en el formulario de producto).
- Descuento e IGV son montos en soles sin el símbolo "S/", ambiguos sobre si son monto o porcentaje.

### Stock inicial
- No existe un formulario de "stock inicial" independiente; el stock siempre entra por una compra recibida. La plantilla de importación de stock (`plantilla-lotes-stock-inicial.csv`) existe pero no hay ninguna pantalla que la consuma — es una plantilla huérfana.

### Transferencia
- No existe ningún formulario — ver §1 y §2. Esta es la brecha más grande de todo el sistema en este apartado.

### POS
- Búsqueda con doble función (texto + escáner) bien resuelta, salvo que expone la palabra "SKU" al cajero.
- Selección de lote 100% automática (FEFO), sin opción manual — correcto para un flujo simple, pero sin salida si el cajero necesita forzar otro lote.
- Descuento por línea sin tope superior (solo se detecta si el total cae a cero o menos).
- Sin botón de creación rápida de cliente nuevo desde el mostrador.
- El mejor ejemplo de mensaje de estado bloqueante: "No hay una caja abierta en esta sucursal. Abre una caja antes de registrar ventas."

### Caja
- Apertura: solo pide monto inicial y observación — simple y correcto.
- Arqueo/cierre: un único campo de monto contado total, sin desglose de billetes/monedas ni para lo esperado ni para lo contado; la diferencia solo se ve después de enviar, no mientras se escribe.
- Sin botón "+" para crear una caja registradora si no existe ninguna en la sucursal.

### Gastos / Ingresos
- El medio de pago Efectivo exige correctamente una caja abierta.
- Sin botón "+" para categorías financieras, y **no existe ninguna pantalla en todo el sistema para crearlas** — si no vienen sembradas, es un callejón sin salida.
- El adjunto solo valida tipo de archivo por atributo HTML, no realmente.

### Cuentas por cobrar / pagar
- El monto a pagar/cobrar está correctamente limitado al saldo pendiente (`max=balance`), evitando sobrepagos.
- **Bug de idempotencia**: la clave se genera en cada intento en vez de una vez por operación — riesgo de duplicar el pago/cobro con doble clic.

### Solicitudes
- El formulario más completo y con mejores textos de ayuda de todo el sistema.
- Campos "descuento autorizado" y "notas" por línea existen en el modelo de datos pero no tienen control visible — se guardan siempre en su valor por defecto.
- La conversión a venta no valida que el efectivo recibido cubra el monto a pagar cuando el medio es efectivo (POS sí lo valida).
- Sin validación de que la fecha programada sea futura.
- Sin botón "+" de cliente nuevo.

## 5. Estados vacíos y dependencias

**Bien resueltos hoy (con mensaje accionable):**
```
Sin empresa asignada / empresa suspendida → "No tienes una empresa asignada..." con botón "Ir al login"
Sin caja abierta en POS → "No hay una caja abierta en esta sucursal. Abre una caja antes de registrar ventas." (sin botón directo a /caja)
```

**Existen pero sin ninguna acción de salida (callejón sin salida):**
```
Sin sucursal asignada → "No tienes una sucursal asignada." (sin botón, ni siquiera "Cerrar sesión")
Sin almacén asignado → "No tienes un almacén asignado." (mismo problema)
```

**No existen o son genéricos sin contexto (mensaje por defecto: "No hay datos para mostrar / Ajusta los filtros o registra un nuevo elemento"):**
```
No hay proveedores → mensaje genérico, sin decir "Crear proveedor"
No hay categorías/laboratorios/principios activos/acciones terapéuticas → mensaje genérico
No hay clientes → mensaje genérico
No hay stock / kardex / transferencias / usuarios → mismo mensaje genérico, y además incorrecto porque dice "registra un nuevo elemento" en pantallas de solo lectura donde no se puede crear nada
```

Mensajes recomendados (a implementar en Fase B, reutilizando el componente `EmptyState` que ya soporta una prop `action` hoy sin usar):
```
No tienes empresa asignada. Comunícate con el administrador de la plataforma. [Ir al login]
No tienes sucursal asignada. Comunícate con el administrador de tu empresa. [Cerrar sesión]
No hay almacenes registrados. [Crear almacén]
No hay caja abierta. [Abrir caja]
No hay proveedores. [Crear proveedor]
No hay categorías. [Crear categoría]
```

Recordatorio de alcance (ya respetado hoy): las empresas/farmacias clientes se crean desde Django Admin, no desde Next.js; el frontend es solo portal operativo por empresa; no existe ni debe existir un módulo superadmin en Next.js.

## 6. Manejo de errores y API caída

| Elemento | ¿Existe? | Detalle |
|---|---|---|
| `app/error.tsx` | ❌ No existe | Cualquier excepción de render no controlada rompe la página completa (overlay de dev / pantalla en blanco en producción) |
| `app/global-error.tsx` | ❌ No existe | — |
| `app/not-found.tsx` | ❌ No existe | Las rutas inválidas usan el 404 genérico de Next |
| `app/loading.tsx` | ❌ No existe | Cada pantalla maneja su propio loading local (inconsistente entre pantallas) |
| Error boundary por módulo | ❌ No existe ninguno en todo el proyecto | — |
| `ApiFallback` / pantalla "API no configurada" | ❌ No existe como componente reutilizable | Un `NEXT_PUBLIC_API_BASE_URL` mal configurado termina en el mismo mensaje de error genérico de cada pantalla |
| Banner global de backend desconectado | ⚠️ Existe el banner "Modo demostración", pero está atado a la variable de entorno, no a la conectividad real — puede mostrar "los cambios son temporales" mientras la pantalla intenta y falla contra la API real |
| Refresh token al arrancar la sesión | ✅ Funciona: si falla al inicio, pasa a "no autenticado" y redirige a login |
| Refresh token a mitad de sesión | ❌ No hay mecanismo: si el refresh falla mientras el usuario ya está autenticado y navegando, el estado nunca cambia a "no autenticado" — cada pantalla mostrará su propio error indefinidamente, sin logout automático ni redirección |
| Página 403 | ❌ No existe una página dedicada; se muestra como error genérico de la pantalla |
| Página 404 | ⚠️ Es el 404 por defecto de Next, no uno propio de la marca |
| Manejo de 401 | ✅ Reintenta una vez tras refrescar el token |
| Manejo de 403/404/409/422/500 | ❌ No hay ninguna rama especial; todos caen en el mismo mensaje genérico "La API respondió con estado {status}" salvo 3 excepciones puntuales (código de barras no encontrado x2, login incorrecto) |
| Manejo de timeout / red caída | ✅ Mensajes dedicados y claros ("No se pudo conectar con la API", "La API tardó demasiado en responder") |
| CORS | No se detectó manejo especial; caería en el mensaje de red genérico |

**Estándar propuesto para todas las pantallas (Fase B):**
1. Crear `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` con la identidad visual del sistema.
2. Crear un helper único de interpretación de errores (hoy duplicado en al menos 8 componentes) que traduzca 401/403/404/409/422/500/timeout/red a mensajes consistentes.
3. Ningún estado de carga debe quedar en skeleton infinito: todo `useQuery`/`fetch` debe tener un timeout visible y un estado de error con botón "Reintentar".
4. Ante fallo de refresh en cualquier momento (no solo al arrancar), cerrar sesión y redirigir a `/login` con un mensaje explicativo.

## 7. Modo mock vs. API real

Variable: `NEXT_PUBLIC_DATA_SOURCE` (`mock` | `api`), leída en `features/shared/config/runtime.ts`.

1. **Pantallas que respetan el modo mock**: solo el Dashboard (`/`). Login solo cambia el copy visual, no la llamada real.
2. **Pantallas que ignoran el modo mock y llaman siempre a la API real**: prácticamente todo el resto del sistema real — POS, Productos (listado y formulario), Compras, Caja, Cuentas por pagar/cobrar, Gastos/Ingresos, Solicitudes, Ventas, Impresión de venta, y **todas** las pantallas basadas en `ApiResourcePage` (Proveedores, Clientes, Establecimientos, Almacenes, Cajas registradoras, Stock, Kardex, Transferencias, Usuarios, y las 5 pestañas de Atributos).
3. **Pantallas que se quedan cargando indefinidamente si la API no responde**: todas las del punto 2 — confirmado en vivo para POS y Productos; por código, aplica al resto igual.
4. **Mocks muertos que no se usan**: `features/products/mocks/product-fixtures.ts`, `features/products/services/products-service.ts`, `features/companies/**` completo, `features/pharmacies/**` completo, `features/auth/context/demo-session-context.tsx`.
5. **Módulos que deben ser API sí o sí** (son transaccionales/financieros, un mock daría falsa confianza): POS, Ventas, Compras, Caja, Inventario/Stock/Kardex, Transferencias, Cuentas por cobrar/pagar, Gastos/Ingresos, Solicitudes.
6. **Módulos que pueden seguir en mock temporalmente** (no tienen backend aún y no son críticos): Notas de venta, Cotizaciones, Despachos, Bonificaciones, Servicios, Facturación, Movimientos, Empresa, Series, Puntos, Transporte, Utilitarios, Consultas (excepto Kardex).

**Decisión recomendada:**
```
Desarrollo visual (sin backend disponible): mock permitido, pero solo para los módulos del punto 6.
Desarrollo integrado (con backend local o de staging): API real obligatoria para todo lo del punto 5.
Producción: NEXT_PUBLIC_DATA_SOURCE=api forzado; el modo mock debe quedar deshabilitado por build/env, no solo por convención.
```

Antes de que esta decisión tenga sentido operativo, todas las pantallas del punto 2 deben empezar a consultar `runtimeConfig`/`isDemoMode` antes de llamar a la API (hoy no lo hacen) — ver Fase A.
