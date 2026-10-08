# Auditoría funcional de farmacia — 6 de septiembre de 2026

**Dictamen: no aprobar todavía para operación completa.** La aplicación compila y los flujos automatizados existentes pasan, pero se reprodujeron seis casos defectuosos y se detectaron brechas de trazabilidad, precisión y paginación por inspección del código.

## Alcance y límites

Revisión de backend Django, frontend Next, rutas operativas, documentación y pruebas. Ejecución de pruebas con base SQLite de test y datos aislados; no se modificaron datos operativos ni lógica del producto. Se añadieron pruebas de aceptación y este informe.

No se ejecutó una sesión manual de navegador: este entorno no tiene Chromium/Playwright disponible. No se verificaron PostgreSQL, concurrencia real entre cajas, Redis/Celery, MinIO, despliegue, impresora física, lector físico ni integraciones externas. La carpeta `diseño/uploads/frontend` se considera referencia de diseño, no una segunda aplicación certificada. Esto es una auditoría técnica y funcional, no una certificación sanitaria o tributaria.

Los documentos de agosto son antecedentes, no evidencia de esta ejecución. Algunas observaciones antiguas ya están resueltas: existen anulación de ventas, observaciones, pantalla de transferencias, reportes reales de ventas con CSV, creación de categorías financieras y páginas de error.

## Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| Backend: `.venv/bin/python -m pytest -W error` antes de agregar casos | 23 aprobadas |
| Nuevos casos: `.venv/bin/python -m pytest tests/test_audit_regressions.py --tb=short -W error` | 6 fallos reproducidos |
| Django `check` | Sin incidencias |
| Migraciones `makemigrations --check --dry-run` | Sin cambios pendientes |
| OpenAPI `spectacular --file /tmp/farmacia-audit-openapi.yaml --validate` | Finalizó correctamente |
| Frontend `npm run typecheck` | Aprobado |
| Frontend `npm test` | Aprobado; un archivo con tres casos de cálculo de precios |
| Frontend `npm run build` | Aprobado, incluidas generación de páginas y validación de tipos |
| Backend `ruff check .` | 18 incidencias preexistentes, principalmente líneas largas y dos imports sin uso |
| Backend `ruff format --check .` | 6 archivos preexistentes requieren formato |

El ejecutable directo `.venv/bin/pytest` tiene un intérprete de cabecera no disponible; ejecutar el módulo con `.venv/bin/python -m pytest` sí funciona. Las nuevas pruebas fallan deliberadamente contra defectos pendientes: no se marcaron como ignoradas ni se corrigió el código de negocio en esta auditoría.

## Hallazgos reproducidos

### QA-01 — Crítico: venta de lote vencido cuando se indica su ID

- Evidencia: `backend/apps/sales/services.py:60`, prueba `test_explicit_expired_lot_must_be_rejected`.
- Preparación: recibir stock, poner vencimiento del lote en ayer y realizar checkout indicando ese lote.
- Esperado: rechazar sin crear venta ni descontar stock.
- Actual: se completa la venta. La rama de lote explícito valida bloqueo y cantidad, pero omite vencimiento. La selección automática sí descarta vencidos.
- Alcance: servicio de checkout usado por API y solicitudes con lote preferido. La prueba reproduce el servicio; no afirma que el POS permita seleccionar manualmente ese lote desde su interfaz.
- Corrección: aplicar la misma validación de vigencia a todas las rutas y conservarla en backend.

### QA-02 — Alto: efectivo recibido igual a cero se acepta

- Evidencia: `backend/apps/sales/services.py:228`, prueba `test_zero_cash_received_must_be_rejected`.
- Preparación: venta S/2, pago efectivo S/2, `received_amount=0`.
- Actual: venta aceptada; `received_amount or amount` sustituye cero por S/2.
- Esperado: error de efectivo insuficiente. Usar el importe como valor por defecto solamente cuando recibido sea `None`.
- La interfaz POS tiene una barrera de importe recibido; el backend debe proteger también llamadas directas y otros consumidores.

### QA-03 — Alto: arqueo incluye ventas anuladas con tarjeta

- Evidencia: `backend/apps/cash/services.py:183`, prueba `test_cancelled_card_sale_must_not_count_in_cash_breakdown`.
- Preparación: vender S/2 con tarjeta, anular y consultar desglose esperado.
- Actual: `card_sales` sigue en S/2; esperado S/0 para ventas vigentes.
- La consulta también abarca Yape, Plin y transferencias, sin filtrar estado de venta. El caso ejecutado fue tarjeta.
- Corrección: definir y reflejar reversos no efectivos de forma coherente entre arqueo, reportes y auditoría.

### QA-04 — Alto: venta rechazada pese a stock total suficiente

- Evidencia: `backend/apps/sales/services.py:60`, prueba `test_sale_uses_combined_available_lots`.
- Preparación: dos lotes vigentes con 3 unidades cada uno, venta de 5.
- Actual: «No existe un lote vigente con stock suficiente»; hay 6 unidades disponibles.
- Corrección: repartir consumo por lotes y conservar detalle de trazabilidad. El POS también escoge un único lote y limita la cantidad a ese lote (`frontend/features/pos/components/pos-page.tsx`, función de agregar producto).

### QA-05 — Alto: selección automática omite el lote que vence primero

- Evidencia: misma función, prueba `test_fefo_consumes_earliest_lot_even_when_later_lot_covers_sale`.
- Preparación: lote temprano con 3 unidades, lote posterior con 10, venta de 5.
- Actual: consume 5 del posterior y deja intactas las 3 primeras.
- Esperado bajo FEFO: consumir 3 del primero y 2 del segundo. Es una segunda manifestación de la falta de reparto por lotes.

### QA-06 — Alto: compra con descuento mayor al subtotal

- Evidencia: `backend/apps/purchases/serializers.py:110`, prueba `test_purchase_discount_cannot_create_negative_payable`.
- Preparación: POST `/api/v1/purchases/`, una unidad a S/10, descuento S/20, condición crédito.
- Actual: HTTP 201; debería rechazar con 400. La fórmula permite un total de −S/10.
- La prueba confirma creación de borrador inválido; no se ejecutó su recepción ni se afirma haber creado una CxP negativa.
- Corrección: validar descuentos, impuestos, cantidades y total antes de guardar; proteger también recepción y obligaciones financieras.

## Hallazgos por inspección de código

### QA-07 — Alto: centavos alterados u ocultos

`frontend/features/shared/utils/formatters.ts:30` redondea a un decimal. Compras y gastos/ingresos lo aplican al perder foco en montos. S/10.25 pasa a S/10.3. Ventas, POS, CxP/CxC, reportes e impresión también muestran un decimal, incluso cuando backend conserva dos. Ejemplo: `frontend/features/sales/components/sale-print-page.tsx:27`.

Corregir política monetaria a dos decimales y conservar precisión adicional para costo unitario cuando corresponda. Revisar entrada, envío, cálculo, presentación y comprobantes por separado. Esto afecta valores persistidos en formularios que redondean, y solo visualización en otros componentes.

### QA-08 — Alto: listas y filtros incompletos al superar 100 registros

`backend/apps/core/pagination.py:8` limita a 100. `frontend/features/sales/components/sales-list-page.tsx:168` solicita 500 y filtra localmente los `items`; no recorre páginas del servidor. Stock y kardex siguen el mismo patrón. Otras listas y selectores piden 100 y pueden quedar incompletos.

Consecuencia: ventas antiguas, stock o movimientos pueden no aparecer al buscar. En compras, los selectores de proveedor y presentación solo obtienen una página. Implementar paginación y filtros de servidor; usar búsqueda remota en selectores. La paginación visual de una tabla sobre esos primeros resultados no resuelve el problema.

### QA-09 — Alto: no se captura lote del fabricante en compra

El tipo `Line` y el formulario de `frontend/features/purchases/components/purchases-page.tsx` no incluyen `batch_number` de entrada. La recepción en `backend/apps/purchases/services.py:47` genera `LOTE-...` cuando falta. El detalle muestra el lote generado.

Un número interno no identifica por sí solo el lote impreso en la caja del medicamento. Se necesita capturar y conservar ese dato para búsquedas, devoluciones y retiros por lote; puede coexistir con el identificador interno. Hallazgo funcional por código, sin evaluación normativa externa.

### QA-10 — Medio: vencimiento depende de `requires_lot`

En `backend/apps/purchases/services.py:44`, la validación de `requires_expiry` está dentro de `if product.requires_lot`. Si un producto admite `requires_expiry=True` y `requires_lot=False`, el servicio no exige ni conserva un lote con vencimiento. Conviene impedir esa combinación o soportarla explícitamente. Caso pendiente de reproducción por API.

## Cobertura por funcionalidad

“Probado” significa casos automatizados concretos, no todas las combinaciones ni recorrido visual completo.

| Funcionalidad | Evidencia actual | Estado |
|---|---|---|
| Login, cookies JWT, refresh y logout | Prueba API existente aprobada | Probado en API |
| Empresas, membresías, permisos y sucursales | Casos de aislamiento y acceso aprobados | Probado parcialmente; no certifica seguridad integral |
| Productos, precios, códigos de barras, importación CSV | Casos de API aprobados, prueba frontend de cálculo aprobada | Base funcional; revisar precisión y volumen |
| Categorías, laboratorios y demás atributos | Pantallas/repositorios reales revisados | Sin recorrido CRUD completo en navegador |
| Proveedores y clientes | API real y uso en fixtures/flujos | CRUD visual completo pendiente |
| Compras y recepción | Flujo transaccional aprobado | Con defectos QA-06, QA-07 y QA-09 |
| Stock y kardex | Movimientos verificados en flujos | Paginación y lotes requieren corrección |
| POS y ventas | Precio oficial, descuentos, checkout e idempotencia secuencial aprobados | Casos críticos adicionales fallan |
| Anulación de venta | Reversión efectivo/stock y permisos aprobados | Desglose no efectivo incorrecto |
| Caja: apertura, movimientos, arqueo y cierre | Casos existentes aprobados | Revisar medios no efectivos y pruebas físicas |
| Transferencias | Despacho, tránsito, recepción parcial y protección de estados aprobados | Pantalla real; recorrido visual pendiente |
| Cuentas por pagar y cobrar | Crédito, abonos y repetición secuencial aprobados | Listas/montos por corregir; concurrencia pendiente |
| Gastos e ingresos | Servicios financieros probados, creación rápida de categorías presente | Precisión y formularios pendientes de E2E |
| Solicitudes | No afecta stock hasta conversión, probado | Revisar lote explícito y reintento tras conversión |
| Dashboard | Alcance por sucursal probado | Exactitud de todos los indicadores pendiente |
| Reporte de ventas y CSV | API y componente reales; esquema válido | Descarga y conciliación visual no ejecutadas |
| Impresión de venta | Vista real, compilación aprobada | Centavos incorrectos por código; impresora no probada |
| Usuarios, sucursales, almacenes, terminales y registradoras | Recursos y permisos presentes | CRUD de cada rol en navegador pendiente |
| Facturación/SUNAT, cotizaciones, notas legacy, despacho, bonificaciones, servicios, empresa/series/puntos/transporte/utilitarios y consultas genéricas | Fuera de los componentes operativos especializados; pantallas demo o alcance aplazado | No deben considerarse funcionalidades completas |

## Orden de resolución y aceptación

1. Bloquear lotes vencidos en todas las rutas, importes incoherentes y compras negativas.
2. Corregir precisión monetaria y conciliación de anulaciones por medio de pago.
3. Implementar consumo por varios lotes con FEFO y captura de lote real.
4. Completar paginación/búsqueda y distinguir módulos pendientes en navegación.
5. Ejecutar los seis casos nuevos hasta que pasen y volver a ejecutar la suite existente.
6. Ejecutar E2E con distintos roles y más de 100 registros: compra → recepción → stock/kardex → venta mixta/crédito → abonos → anulación → arqueo/cierre → exportación/impresión.
7. Probar en PostgreSQL ventas simultáneas del último stock, doble envío concurrente, apertura simultánea y cobro simultáneo con anulación; SQLite no valida los bloqueos de producción.

La aprobación final requiere cerrar los fallos críticos/altos y ejecutar los pendientes de entorno. El build aprobado y las 23 pruebas iniciales no equivalen a que todas las funcionalidades estén correctas.
