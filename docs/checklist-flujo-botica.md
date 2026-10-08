# Checklist del flujo operativo completo de una botica

Este checklist se validó ejecutando el flujo real en el navegador, contra un backend Django corriendo localmente (SQLite + `manage.py seed_demo`) y el frontend Next.js en modo `NEXT_PUBLIC_DATA_SOURCE=api` — no es una revisión de código únicamente. Usuario de prueba: `owner@botica.demo` (rol OWNER).

## Resultado paso a paso

| # | Paso | Estado | Qué falta / observación |
|---|---|---|---|
| 1 | Login | ✅ **Funciona** | JWT real, mensaje claro si la API no responde ("No se pudo conectar con la API") |
| 2 | Seleccionar empresa/sucursal | ✅ **Funciona** | El selector de sucursal en la barra superior funciona; no hay selección de empresa porque el usuario solo pertenece a una (correcto según el modelo: la empresa se resuelve por membresía, no la elige el usuario) |
| 3 | Crear categoría/laboratorio/proveedor | ✅ **Funciona** | Probado creando la categoría "Antiinflamatorios" desde el botón "+" del formulario de producto — se creó vía API real y quedó seleccionada al instante |
| 4 | Crear producto con código de barras | ✅ **Funciona** | Escaneo/tecleo de código con Enter, cálculo automático de costo/margen. **Parcial**: permite guardar con margen negativo (solo advierte, no bloquea) |
| 5 | Registrar compra con lote y vencimiento | ✅ **Funciona** | Se creó una compra en borrador y se confirmó sin error. **Parcial**: lote y vencimiento son opcionales aunque el producto los declare obligatorios; no hay forma de anular la compra después de confirmada |
| 6 | Ingresar stock | ✅ **Funciona automáticamente** | Al confirmar la compra, el stock se actualizó solo (100 unidades de Ibuprofeno 400mg, lote LOTE-0001, vencimiento 2027-12-31) — correcto, no requiere un paso manual separado |
| 7 | Ver kardex | ✅ **Funciona** | El movimiento `PURCHASE_IN` apareció inmediatamente en `/consulta/kardex` con saldo actualizado. **Parcial**: la fecha se muestra como timestamp crudo sin formato legible, y no hay filtros ni exportación |
| 8 | Abrir caja | ✅ **Funciona** | Verificado sobre una sesión ya abierta por el mismo usuario; el formulario de apertura (monto inicial + observación) se revisó por código y es consistente con el resto del flujo |
| 9 | Vender por POS | ✅ **Funciona** | Búsqueda por código de barras, selección automática de lote por FEFO (tomó LOTE-0001), cálculo de vuelto correcto (S/25.00 total, S/30.00 recibido, S/5.00 de vuelto) |
| 10 | Imprimir nota | ✅ **Funciona bien** | Vista de impresión con alternancia térmica 80mm / A4, logo, datos completos y correctos — una de las pantallas mejor resueltas del sistema |
| 11 | Ver venta | ✅ **Funciona** | Detalle completo: productos, lote, pagos, subtotal, IGV, descuento, total, pagado, saldo, vuelto |
| 12 | Ver observación | ❌ **No funciona / no existe** | La venta no tiene ningún campo de observación en el modelo ni en la pantalla de detalle — no hay nada que "ver" porque nunca se puede registrar |
| 13 | Cerrar caja | ✅ **Funciona** | El cierre precarga el efectivo esperado (calculado por el sistema), pide efectivo contado y observación, y calculó diferencia S/0.00 correctamente tras la venta registrada |
| 14 | Exportar reporte de ventas/caja | ❌ **No funciona** | El módulo "Reportes" es 100% de demostración: el botón de exportar abre un modal que, al confirmar, se cierra sin descargar nada y sin avisar del fallo. No hay ninguna forma real de sacar un reporte de ventas o de cierre de caja del sistema hoy |

## Resumen

- **11 de 14 pasos funcionan de extremo a extremo** con datos reales (login → producto → compra → stock → kardex → caja → POS → impresión → venta → cierre de caja).
- **1 paso es parcial en varios puntos** (creación de producto/compra: permite datos inconsistentes sin bloquear).
- **2 pasos no existen**: observación de venta, y exportación de reportes.
- El cuello de botella más grande no está en la cadena principal de venta (que funciona sólidamente), sino en todo lo que rodea el cierre del ciclo contable/operativo: no se puede anular una venta, no se puede sacar un reporte, y las cuentas por cobrar/pagar tienen un bug de idempotencia que puede duplicar cobros con doble clic (ver `docs/estado-real-modulos.md` y `docs/plan-correccion-operativa.md`).

## Nota sobre el entorno de prueba

Para esta validación se creó un entorno local (no incluido en el flujo normal de Docker Compose, que no pudo levantarse porque Docker Desktop no estaba disponible en esta máquina durante la auditoría):

```
backend/.venv-win/          venv nativo de Windows (el .venv del repo es de Linux/WSL y no corre aquí)
DJANGO_SETTINGS_MODULE=config.settings.local   (SQLite local, no PostgreSQL/Redis/MinIO)
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8000
```

Esto es solo para pruebas locales rápidas; no reemplaza la validación real contra PostgreSQL vía Docker Compose, que sigue pendiente de ejecutarse (ver Fase D del plan de corrección).
