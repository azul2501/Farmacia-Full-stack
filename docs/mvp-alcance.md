# MVP Botica Farma: alcance y plan de mejora

Fecha: 9 de octubre de 2026.

## 1. Qué es el MVP

Un sistema para que una botica con una o varias sucursales opere su día completo: comprar mercadería, controlar stock por lote y vencimiento, vender en caja y cerrar la caja con su arqueo. Todo queda trazado en el kardex y en finanzas.

**Usuarios:** dueño, administrador de sucursal, almacenero y cajero. Cada rol ve solo los módulos que le corresponden.

### Flujos incluidos (probados de punta a punta en el navegador)

| Flujo | Qué cubre |
|---|---|
| Catálogo | Productos con presentaciones, código de barras, categoría, laboratorio y proveedor habitual. Importación y exportación por CSV. |
| Compras | Borrador, edición, anulación del borrador y confirmación. La confirmación crea el lote, el stock, el kardex y el pago o la cuenta por pagar. |
| Inventario | Stock por almacén y lote, ajustes con motivo (merma, conteo, vencido), kardex con filtros por fecha y almacén, y transferencias entre almacenes. |
| Caja | Apertura, arqueo, cierre con diferencia y movimientos de caja. |
| Ventas (POS) | Búsqueda o escaneo, salida por lotes FEFO (vence primero, sale primero), contado o crédito, varios medios de pago, vuelto, anulación e impresión. |
| Clientes y cuentas | Clientes, cuentas por cobrar y por pagar con sus estados, gastos e ingresos adicionales. |
| Solicitudes | Pedidos programados de clientes, con sus estados. |
| Gestión | Dashboard del día, alertas de stock mínimo y vencimientos, reportes, usuarios, sucursales, almacenes, cajas y terminales. |

### Fuera del MVP (se muestran como "no disponible en esta versión")

Cotizaciones, despachos, servicios, bonificaciones, programa de puntos, facturación electrónica, series, transporte, editor de roles y configuración de empresa. Antes estas pantallas mostraban datos simulados; ahora muestran un aviso claro.

## 2. Qué se cerró en esta revisión

- Las pantallas simuladas ya no se abren por URL.
- Se pueden anular compras en borrador.
- Se puede ajustar el stock desde Inventario: registra el motivo y queda en el kardex.
- El kardex y el stock muestran las cantidades con sus decimales, sin redondear.
- El contador de solicitudes pendientes cuenta todas las solicitudes abiertas.
- El formulario de producto ya no repite el código de barras ni marca "Acumula puntos", porque no hay un programa de puntos.
- Se quitó la plantilla de lotes y stock inicial, que no tenía un importador. El stock inicial entra como una compra confirmada.

## 3. Cómo mejorar sin salir del alcance

Ordenado por impacto. Ninguna mejora agrega módulos nuevos: todas refuerzan los flujos que ya existen.

### Prioridad 1: antes de usarlo con clientes reales

1. **Restablecer contraseñas.** Hoy el administrador crea usuarios, pero no puede cambiarles la contraseña desde la pantalla. Falta una acción "Restablecer contraseña" en Usuarios.
2. **Carga del stock inicial.** Funciona registrando una compra por almacén, pero es lento si hay cientos de productos. Lo ideal es un importador CSV de lotes y stock inicial, que genere una compra confirmada y reutilice la validación de compras.
3. **Respaldo de la base de datos.** Programar una copia diaria de PostgreSQL y probar una restauración al menos una vez.
4. **Ortografía de la interfaz.** Muchos textos no llevan tildes ni eñes ("Almacen", "Codigo"). Afecta la confianza del usuario y es un cambio de bajo riesgo.
5. **Monitoreo de errores.** Conectar Sentry u otra herramienta similar al backend y al frontend, para enterarse de los errores antes de que los reporte un cajero.

### Prioridad 2: primeras semanas de uso

6. **Prueba automática del flujo principal en CI.** Que la compra, la venta, la anulación y el cierre de caja se ejecuten en cada PR. El script de Playwright de esta revisión es una buena base.
7. **Reporte de cierre del día imprimible.** Un resumen por caja con ventas por medio de pago, egresos y diferencia, para firmar al cerrar.
8. **Listados grandes.** Las pantallas descargan hasta 5000 registros y filtran en el navegador. Con más volumen conviene paginar en el servidor: Ventas y Kardex ya filtran por fecha, y el mismo patrón sirve para Stock y Productos.
9. **Alerta de vencidos en el POS.** El POS no vende lotes vencidos. Además, podría avisar de los lotes que vencen en menos de 30 días al agregarlos al carrito.

### Prioridad 3: pulido de la experiencia

10. **Atajos y foco en el POS.** Volver el foco al buscador después de cada venta y confirmar con Enter cuando el vuelto ya es correcto.
11. **Mensajes vacíos con acción.** Por ejemplo, "Sin productos, crea el primero" con su botón. Ya existe en algunas pantallas y falta en otras.
12. **Uso en celular.** El POS ya se adapta al celular. Revisar con el mismo criterio Compras y Caja, que tienen formularios anchos.

## 4. Decisión pendiente

**Comprobantes electrónicos (SUNAT).** El POS emite notas de venta internas. Si la botica debe emitir boletas o facturas electrónicas, hay que integrarlo con un OSE o PSE. Es la única pieza fuera del alcance que puede ser obligatoria para operar, y conviene decidirla antes de salir a producción.
