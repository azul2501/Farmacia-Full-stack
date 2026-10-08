# Experiencia de usuario y comparación con sistemas de farmacia

Fecha: 6 de septiembre de 2026. Complementa la auditoría técnica anterior.

## Conclusión de producto

El sistema ya tiene una base visual coherente y módulos operativos conectados. Para acercarse a un producto de farmacia maduro, necesita mejorar la continuidad de las tareas: localizar información, actuar y comprobar el resultado sin perder la venta o repetir búsquedas. El problema principal no es la elección de colores; es la distribución de información, la precisión y la conexión entre pantallas.

Decisión: conservar la identidad y los componentes útiles, rediseñar primero POS, compras, inventario y caja. No ampliar el menú antes de cerrar esos recorridos.

## Evidencia y método

- Recorrido real con Chromium, frontend Next y API Django; base independiente `/tmp/farmacia-ux.sqlite3` con `seed_demo`.
- Usuario propietario de demostración, pantalla de escritorio 1366 × 768. Capturas completas: [evidencias](ux-evidencias/recorrido.json). Las capturas completas pueden ser más altas que el área visible inicial.
- Once pantallas recorridas: inicio, POS, productos, compras, stock, kardex, caja, ventas, transferencias, CxC y reportes. También apertura de compra, salida con Escape y búsqueda de producto.
- En ese recorrido no se capturaron excepciones JavaScript de página. Eso no prueba todas las operaciones ni todos los roles.
- Comparación con páginas oficiales de proveedores. Sus capacidades comerciales no se trataron como pruebas independientes de velocidad, fiabilidad o cumplimiento. No se ingresó a cuentas privadas ni se contactó a vendedores. El enlace público de demo de Sysfarma conduce a un login.
- Evaluación experta de tareas, no estudio con empleados reales. No se asignan notas numéricas de usabilidad ni tiempos que no se hayan medido.

## Referencias y decisiones que aportan

| Referencia oficial | Qué publica | Decisión para este proyecto |
|---|---|---|
| [FarmaSystem, Perú](https://www.farmasystem.pe/) | Búsqueda por nombre o componente, precios por caja/blíster/pastilla y alertas de stock/vencimiento | Mostrar presentación y equivalencia junto a cantidad y precio; facilitar búsqueda farmacéutica |
| [Sysfarma, Perú](https://sysfarma.pe/) | POS con medios de pago locales, alertas por vencimiento y panel de control; publica capturas de producto | Mantener cobro visible y convertir alertas en accesos a trabajo pendiente |
| [FoxPinium PHARM, Perú](https://foxpinium.com/farmacias/) | Lotes por sede, caja/fracción/factor, stock mínimo y sugerencias de compra | Conectar falta de stock con consulta de otra sucursal y reposición |
| [Unycop Next](https://www.unycop.es/caracteristicas/) | Ventas en espera, arqueo por puesto/vendedor, compras relacionadas con documentos, listas y alertas interactivas | Conservar ventas interrumpidas, navegar entre documentos relacionados y permitir investigar desde la lista |

Estas referencias apoyan patrones de trabajo. Las propuestas de columnas, disposición y prioridad que siguen son decisiones propias para esta aplicación. No se copian las integraciones sanitarias o tributarias de otro país ni se promete equivalencia funcional con los proveedores.

## Lo que conviene conservar

- Menú agrupado por Ventas, Almacén, Caja/finanzas, Catálogos y Administración; respeta permisos y marca algunas opciones futuras.
- Búsqueda destacada en POS y atajos visibles F2/F4/F9.
- Separación entre borrador y recepción de compras.
- Tablas consistentes, filtros y estados etiquetados en varias pantallas.
- Componentes modales con control de foco y navegación con Tab.
- Detalles, anulación de venta y reporte de ventas con exportación implementados.

## Hallazgos y decisiones por recorrido

### 1. Atender al cliente — prioridad inmediata

**Observado:** el POS supera la altura de 768 px incluso vacío. Total y confirmación quedan debajo del primer viewport. El carrito reserva mucho espacio vacío mientras datos opcionales y pagos empujan el cobro hacia abajo. En búsqueda, los controles “Anterior / Página / Siguiente” se superponen visualmente. Se muestra SKU junto al producto. [Captura](ux-evidencias/pos-busqueda.png).

**Decisión:** mantener dos áreas en escritorio: búsqueda/resultados y venta actual. Dentro del carrito, desplazar únicamente las líneas; fijar total y acción de cobro. Cliente opcional, observación y descuento deben ocupar espacio solo cuando se usan. Sustituir el protagonismo de SKU por nombre, concentración, presentación, laboratorio y precio.

La tabla de resultados propuesta: **Producto | Presentación | Disponible en esa presentación | Precio | Agregar**. Código y lotes quedan accesibles en detalle. No sugerir una sustitución terapéutica automática: una búsqueda por principio activo ayuda a localizar productos, pero la decisión de dispensación corresponde al profesional.

Agregar después: cliente rápido sin salir, pagos repartidos, venta en espera/recuperación, consulta de otra sucursal y detalle del lote asignado. Son funcionalidades a construir, no solo cambios de CSS.

### 2. Buscar y administrar productos — prioridad alta

**Observado:** diez columnas comprimen el nombre del medicamento. La lista enseña primera presentación y sus precios; esto puede parecer el precio de todo el producto. Importar, exportar y dos plantillas compiten por espacio en la cabecera. [Captura](ux-evidencias/productos.png).

**Decisión:** tabla base de seis o siete columnas, con nombre ancho. **Producto/concentración | Laboratorio | Presentaciones | Precio o rango | Estado | Acciones**; añadir stock por sucursal en una vista operativa cuando exista el dato correcto. Código de barras, costo y margen se ofrecen como columnas configurables según rol.

Abrir ficha lateral al seleccionar nombre: datos, presentaciones/precios, stock/lotes y movimientos. Conservar filtros al volver. Un único botón principal “Nuevo producto”; importación y plantillas dentro de “Importar”, exportación secundaria. “Margen sobre costo” debe nombrarse así para evitar confundirlo con margen sobre venta.

### 3. Recibir una compra — prioridad inmediata

**Observado:** la ventana dedica casi todo el espacio inicial a cabecera y observación; los productos quedan debajo del pliegue. La compra no permite escribir lote del fabricante. Se escribió un número y Escape cerró la ventana sin confirmación de descarte; abrir una nueva compra reinicia el formulario. [Captura](ux-evidencias/nueva-compra.png).

**Decisión:** página completa para una compra con varios productos. Tres bloques: documento/proveedor, detalle de recepción y revisión final. Observación plegada inicialmente. Barra inferior con “Guardar borrador” y “Revisar recepción”, sin confirmar movimientos irreversibles por accidente.

Tabla de entrada: **Producto | Presentación comprada | Cantidad de empaques | Unidades por empaque | Costo/empaque | Lote fabricante | Vencimiento | Subtotal**. Equivalencia visible: “2 cajas × 100 = 200 unidades”; costo unitario calculado. Descuentos e impuestos deben indicar si son monto o porcentaje y cómo afectan el total. Validación al lado de la línea con foco en el primer error. Advertir antes de abandonar cambios sin guardar.

### 4. Saber qué hay y qué vence — prioridad inmediata

**Observado:** inventario es una tabla por lote; un producto aparece varias veces. Hay filtros, pero “Crítico / vencido” agrupa stock utilizable y no utilizable. No hay acción de detalle o kardex desde la fila. [Captura](ux-evidencias/stock.png).

**Decisión:** vista inicial por producto con total vendible; expandir lotes cuando se investiga. Pestañas “Existencias”, “Por vencer”, “Vencidos” y “Stock bajo”. Estados independientes: bloqueado, vencido, próximo a vencer, vigente. Mostrar texto y fecha, además del color. Usar la fecha de negocio de la farmacia consistentemente.

Tabla general: **Producto | Presentación | Almacén | Disponible | Estado | Próximo vencimiento | Ver lotes**. En el detalle: **Lote | Fecha exacta | Existencia | Reservado, si aplica | Vendible | Estado | Documento de ingreso / Kardex**.

“Vencidos” debe llevar a una tarea de revisión y al procedimiento autorizado de bloqueo/ajuste/devolución; esas operaciones necesitan reglas de backend y auditoría. No habilitar una edición directa de stock como atajo visual.

### 5. Abrir y cerrar turno — prioridad alta

**Observado:** “Caja actual” es principalmente una lista de sesiones. El formulario de arqueo precarga “contado” con lo esperado; el detalle usa claves internas como `cash_sales` por código. El historial de sesiones cerradas no ofrece acciones de fila en este componente. [Captura](ux-evidencias/caja.png).

**Decisión:** “Mi turno” como vista inicial: caja, responsable, apertura, efectivo esperado, movimientos y pagos no efectivos separados. Historial en otra pestaña. Cierre por pasos: contar → revisar diferencias → confirmar y descargar comprobante. Conteo por denominaciones opcional y total editable validado; nunca aparentar un conteo físico que el empleado no hizo. Etiquetas en español, dos decimales, diferencia visible antes de confirmar.

### 6. Revisar una venta, deuda o transferencia — prioridad alta

**Observado por código y pantallas:** varias tablas muestran solo la primera página devuelta por API, y filtran ese subconjunto. El usuario puede interpretar “sin resultados” como inexistencia. En transferencias hay acciones representadas solamente por iconos.

**Decisión:** búsqueda y filtros en servidor, total real de registros, filtros persistentes, “Limpiar filtros” y mensaje diferenciado entre lista vacía y búsqueda sin coincidencias. Fechas, estados y métodos traducidos. Abrir detalle desde número/documento. Acciones principales con texto; anular/eliminar dentro de un menú claramente identificado.

Ventas: **Fecha/hora | Documento | Cliente | Total | Pagado/saldo | Estado | Ver detalle**. Detalle con pagos, lotes, observación, impresión y anulación según permiso. CxC/CxP: **Cliente/proveedor | Documento | Vence | Importe | Abonado | Saldo | Estado | Cobrar/pagar**; historial de abonos vinculado. Transferencias: **Documento | Origen → Destino | Despachado/recibido/pendiente | Estado | Siguiente acción**.

### 7. Saber qué requiere atención — prioridad alta

**Observado:** inicio muestra rojo para vencimientos y diferencias aun cuando son cero; aparece `CASH` sin traducir. “Diferencias de caja → Ver reporte” lleva al reporte de ventas. “Ver lotes” abre inventario sin el filtro correspondiente. [Captura](ux-evidencias/inicio.png).

**Decisión:** inicio del administrador con “Pendientes de hoy” y resúmenes discretos. Cero incidencias es estado neutro o correcto. Cada tarjeta abre una lista con fecha, sucursal y estado ya aplicados. No mostrar utilidad hasta disponer de costos reales y una definición contable consistente. Cajero entra al POS; encargado entra a su trabajo de inventario, conservando las rutas por rol que ya existen.

## Estándar de tablas e interfaces

1. Ordenar columnas según la pregunta del usuario; identificador técnico nunca debe desplazar al nombre.
2. Números a la derecha, moneda con dos decimales y unidades explícitas. Cantidades y precios deben corresponder a la misma presentación.
3. Filtrar todos los registros autorizados del servidor, no solo los cargados en memoria.
4. Una acción principal por pantalla y acciones de fila con nombre accesible. Reservar rojo para problemas y acciones destructivas.
5. Recordar búsqueda, filtros y página al cerrar detalle. Exportar con el mismo alcance y mostrarlo en el archivo.
6. Formularios cortos en modal; operaciones largas en página completa con borrador y protección de salida.
7. Estados vacíos accionables: “Sin proveedores → Crear proveedor”, “Caja cerrada → Abrir caja”. Los botones deben respetar permisos.
8. No mostrar “API conectada”, nombres de claves internas ni conceptos de implementación al personal operativo.
9. Desktop compacto para mostrador; móvil orientado primero a consulta del propietario. Validar específicamente cada tarea que se anuncie como operable desde móvil.

## Prototipo entregado

[Abrir propuesta interactiva](propuesta-ux-farmacia.html). Cuatro pantallas conceptuales: venta, inventario/vencimientos, recepción y cierre de caja. Datos ficticios y acciones locales demostrativas. Permite agregar producto, simular cobro, filtrar vencidos y contar denominaciones. No cambia la aplicación ni sustituye su implementación.

## Prioridad de implementación y criterio de salida

| Etapa | Resultado a conseguir | Criterio verificable |
|---|---|---|
| 1. Confianza operativa | Corregir fallos de lotes/pagos/montos, etiquetas y filtros reales | Casos de auditoría técnica pasan; centavos y stock coinciden entre pantallas |
| 2. Mostrador | POS con cobro visible, cantidades claras y recuperación de contexto | Venta de tres productos en 1366 × 768 sin desplazar la página para llegar al total/cobro |
| 3. Compras e inventario | Recepción comprensible, lotes reales y vistas de alertas | Registrar diez líneas, corregir una y continuar sin pérdida de datos; desde una alerta llegar al lote concreto |
| 4. Caja y gestión | Cierre guiado, abonos y documentos relacionados | Explicar una diferencia y obtener el comprobante; encontrar una venta antigua con más de 100 registros |
| 5. Validación con personas | Cajero, encargado y administrador usan tareas representativas | Medir finalización sin ayuda, errores, tiempo y confianza; ajustar según evidencia |

Pruebas de aceptación con usuarios: venta normal; cambio de presentación; pago repartido; interrupción y recuperación; compra con varios lotes; producto agotado; revisión de vencidos; abono de deuda; anulación y cierre con diferencia. Algunas requieren desarrollar funcionalidades actualmente ausentes. Establecer primero la línea base y luego objetivos de mejora; los tiempos publicitarios de proveedores no son un benchmark medido de este proyecto.

## Límites pendientes

No se certifica accesibilidad completa, rendimiento con catálogo masivo, operación real de periféricos, todos los permisos, ni servicios sanitarios/tributarios. La base de demostración sirve para evaluar recorridos, pero necesita ampliarse para probar nombres largos, múltiples presentaciones, cientos de lotes y registros históricos. El recorrido de navegador de esta revisión complementa —y supera en alcance visual— la limitación de entorno anotada en la auditoría técnica anterior.
