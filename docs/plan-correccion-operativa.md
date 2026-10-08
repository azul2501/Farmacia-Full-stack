# Plan de corrección operativa — Sistema Botica Farma

Basado en `docs/estado-real-modulos.md` y `docs/checklist-flujo-botica.md`. No incluye funcionalidades nuevas — solo orden, corrección y priorización de lo que ya existe a medias. Cuatro fases, en orden de ejecución. Dentro de cada fase las tareas están ordenadas por prioridad descendente.

## Estado de ejecución (actualizado 2026-08-13)

**Fase A: completa y verificada** (build, tests de backend 23/23, tests nuevos agregados, prueba manual en navegador). **Fase B: parcialmente completa** (páginas de error y helper central de errores implementados y verificados; sesión a media conversación y banner de backend caído quedan pendientes). **Fases C y D: sin iniciar**, quedan tal como se describen abajo.

| Tarea de Fase A | Estado |
|---|---|
| Build roto (`app/cajas/page.tsx`) | ✅ Corregido y verificado con `npm run build` |
| Idempotencia CxC/CxP | ✅ Corregido (clave estable con `useRef`, igual que POS) |
| Anular venta | ✅ Implementado backend (`SaleService.cancel`, reversa stock y caja, cancela CxC sin cobros) + frontend (botón, modal con motivo obligatorio) + 3 tests nuevos + probado en vivo |
| Transferencias sin UI | ✅ Construida pantalla completa (`features/transfers/components/transfers-page.tsx`): crear, despachar, iniciar tránsito, recibir (total/parcial), cancelar, eliminar. Se corrigió además la numeración automática (`Transfer.number` no se autogeneraba). Probado en vivo de punta a punta |
| Pantallas que ignoran `NEXT_PUBLIC_DATA_SOURCE` | ✅ Corregido de forma centralizada en `apiRequest`/`apiDownload` (`features/shared/api/client.ts`): en modo mock ahora devuelven un error claro en vez de colgarse. Verificado en vivo en `/productos` y `/pos` |
| `X-Company-ID` no se usaba | ✅ Corregido en `apps/core/permissions.py`; el test `test_company_header_cannot_cross_tenants` que fallaba ahora pasa |
| Estados "sin sucursal"/"sin almacén" sin salida | ✅ Se agregó botón "Cerrar sesión" en ambos casos |
| Credenciales demo expuestas | ✅ Se agregó guarda `NODE_ENV !== "production"` además de la variable de entorno |
| Credenciales locales en `compose.yml` | Revisado: ya estaba correctamente parametrizado con `${VAR:-default}`; no requería cambio |

| Tarea de Fase B | Estado |
|---|---|
| `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` | ✅ Creados con la identidad visual del sistema |
| Helper central de errores HTTP | ✅ Creado (`features/shared/api/error-message.ts`) y adoptado en los 11 componentes que antes duplicaban la lógica |
| Refresh token fallido a mitad de sesión | ⏳ Pendiente |
| Banner real de "backend desconectado" (distinto del banner de modo demo) | ⏳ Pendiente |
| Estados vacíos accionables en toda la app | ⏳ Pendiente |

| Tarea de Fase C realizada | Estado |
|---|---|
| Ocultar/marcar "Próximamente" módulos sin backend | ✅ Se verificó que casi todos ya eran inalcanzables desde la navegación (no estaban en el sidebar); solo `/empresa` (Configuración) seguía enlazado y mock — se marcó "Próximamente" igual que "Roles y permisos" |
| Módulo de Reportes con datos reales | ✅ Construido (`features/reports/components/reports-page.tsx`): filtros de sucursal/fecha, datos reales de `/reports/sales/`, y exportación CSV real generada desde los datos ya cargados (no hay endpoint de exportación en el backend, así que se resolvió del lado del cliente en vez de inventar un endpoint nuevo) |
| Campo de observación en la venta | ✅ Backend (`Sale.notes`, migración `0004_sale_notes`) + frontend (POS lo captura, detalle y ticket impreso lo muestran) |
| Campo de observación en compra | ✅ Ya se enviaba al backend pero no tenía input visible; se agregó el textarea |
| Reactivar producto desactivado | ✅ Agregado, probado en vivo |
| Validar pago suficiente en conversión de Solicitud→Venta | ✅ Agregado (igual que POS) |
| Tope superior al descuento por línea en POS | ✅ Agregado (antes solo tenía el atributo HTML `max`, que no bloquea el valor real) |
| Palabra "SKU" visible en el buscador de POS | ✅ Cambiada por "Buscar por nombre o escanear código" |

Lo que sigue pendiente de Fase C (formularios: unidad/ubicación como simulacro local en producto, desglose de arqueo de caja, categorías financieras sin pantalla de administración, campos huérfanos en Solicitudes, filtros server-side en Ventas, exportación real en Compras/Caja/CxC-CxP, historial de importaciones, archivo de errores descargable) y toda la Fase D quedan tal como se describen a continuación — no se ejecutaron en esta pasada.

---

## Fase A — Bloqueadores críticos

Seguridad, integridad financiera, y lo que impide operar o desplegar hoy mismo.

| Tarea | Archivo / módulo | Riesgo | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| Renombrar la variable `module` que rompe el build de producción | `frontend/app/cajas/page.tsx:6` | El sistema no se puede desplegar a producción hoy | Alto — bloquea todo despliegue | Bajo | **Máxima** |
| Corregir clave de idempotencia inestable en pagos/cobros (se genera nueva en cada intento en vez de una vez por operación) | `frontend/features/finance/components/accounts-page.tsx:34` | Doble clic puede duplicar un cobro o un pago real | Alto — dinero real | Bajo (usar `useRef`, igual que en POS) | **Máxima** |
| Agregar acción real de anulación de venta (backend + botón en frontend) | `backend/apps/sales/views.py`, `backend/apps/sales/services.py`, `frontend/features/sales/components/sales-list-page.tsx` | Un error de venta hoy no se puede corregir dentro del sistema, obliga a ajustes manuales de inventario fuera de control | Alto — operación diaria de cualquier botica | Medio-alto | Alta |
| Construir la pantalla real de Transferencias (crear, despachar, recibir total/parcial, cancelar) | `frontend/features/transfers/` (nuevo), reemplaza `transferListResource` en `features/shared/resources/resource-configs.ts` | El backend ya soporta el flujo completo; hoy es inutilizable desde la UI | Alto para boticas con más de un almacén/sucursal | Medio-alto | Alta |
| Hacer que las pantallas reales respeten `NEXT_PUBLIC_DATA_SOURCE` antes de llamar a la API | Prácticamente todos los componentes reales en `features/*/components/` (ver lista completa en `estado-real-modulos.md` §7) | Sin backend disponible, casi toda pantalla cuelga en skeleton infinito sin aviso; el modo mock hoy no sirve para nada excepto el Dashboard | Medio-alto — resiliencia y experiencia de desarrollo | Medio | Alta |
| Resolver el uso muerto del header `X-Company-ID` y el test de aislamiento tenant que falla hoy | `backend/apps/core/permissions.py:6-22`, `tests/test_critical_flows.py::test_company_header_cannot_cross_tenants` | Un usuario con membresía en varias empresas no puede elegir en cuál operar; hay un test de seguridad fallando activamente | Medio-alto — aislamiento multiempresa | Medio | Alta |
| Agregar botón de salida (mínimo "Cerrar sesión") en las pantallas "sin sucursal asignada" / "sin almacén asignado" | `frontend/components/layout/app-chrome.tsx:72-89` | El usuario queda atrapado sin ninguna acción posible | Medio-alto — UX bloqueante | Bajo | Alta |
| Apagar `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` fuera de desarrollo | `frontend/.env` / variables de despliegue | Expone credenciales válidas en la pantalla de login | Medio — exposición de credenciales | Bajo | Alta |
| Sacar credenciales locales embebidas del `compose.yml` y parametrizarlas por `.env` | `backend/compose.yml` | Credenciales en el repositorio | Medio | Bajo | Alta |

---

## Fase B — Resiliencia de frontend

Que ninguna pantalla se quede "muda" o rota cuando algo falla.

| Tarea | Archivo / módulo | Riesgo | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| Crear `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` con la identidad visual del sistema | `frontend/app/` (nuevos archivos) | Hoy cualquier excepción de render rompe la página entera sin UI de recuperación | Alto | Medio | Alta |
| Garantizar que ningún `useQuery`/`fetch` quede en skeleton infinito: agregar timeout visible + estado de error con "Reintentar" | Todas las pantallas reales (depende de la tarea de Fase A sobre modo mock/API) | Pantallas colgadas sin explicación cuando el backend no responde | Alto | Medio | Alta |
| Manejar el fallo del refresh token a mitad de sesión (no solo al arrancar): cerrar sesión y redirigir a `/login` con mensaje | `frontend/features/shared/api/client.ts`, `frontend/features/auth/context/session-context.tsx` | Hoy es un callejón sin salida: el usuario se queda con el shell completo pero cada pantalla falla indefinidamente | Alto | Medio | Alta |
| Crear un helper único de interpretación de errores HTTP (401/403/404/409/422/500/timeout) | `frontend/features/shared/api/client.ts` + reemplazar la lógica duplicada en 8+ componentes | Mensajes inconsistentes; los códigos 403/404/409/422/500 hoy se tratan todos igual | Medio-alto | Medio | Alta |
| Construir un componente `ApiFallback`/banner real de "backend desconectado", distinto del banner de "modo demostración" (que hoy depende de una variable de entorno, no de la conectividad real) | `frontend/components/layout/app-chrome.tsx` | El banner de modo demo puede decir "cambios temporales" mientras la pantalla falla contra la API real | Medio | Medio | Media-alta |
| Estados vacíos accionables en toda la app usando la prop `action` que `EmptyState` ya soporta pero nadie usa | `frontend/features/shared/ui/states/async-state.tsx` + cada tabla real | Mensajes genéricos que ni siquiera son correctos en pantallas de solo lectura ("registra un nuevo elemento" en Stock/Kardex/Transferencias/Usuarios) | Medio | Medio | Media |

---

## Fase C — UX operativa

Formularios, acciones de tabla, exportación/importación y reportes — lo que hace que el sistema "se sienta real" para el usuario final.

| Tarea | Archivo / módulo | Riesgo | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| Ocultar o marcar "Próximamente" los módulos sin backend real: Notas de venta, Cotizaciones, Despachos, Bonificaciones, Servicios, Facturación, Movimientos, Series, Puntos, Transporte, Utilitarios, Consultas (excepto Kardex), Empresa | `frontend/lib/modules.ts`, `frontend/components/sidebar.tsx`, `frontend/features/modules/config/module-screens.ts` | Es la causa principal de que el sistema "se sienta como demo técnica" | Alto — percepción general del producto | Bajo | Alta |
| Construir el módulo de Reportes con datos reales (`/reports/sales/`, `/reports/dashboard/`) y exportación real, empezando por Ventas y Caja | `frontend/features/reports/` (nuevo), reemplaza el mock de `/reportes` | Hoy no existe ninguna forma de sacar información del sistema para contabilidad o análisis | Alto | Alto | Alta |
| Agregar campo de observación a la venta (modelo + serializer + UI) | `backend/apps/sales/models.py`, `serializers.py`; `frontend/features/sales/components/sales-list-page.tsx` | Pedido explícito de flujo operativo; hoy no existe ningún lugar para registrar contexto de una venta | Medio | Medio | Alta |
| Cruzar la validación de lote/vencimiento obligatorios (`requires_lot`/`requires_expiry` del producto) en el formulario de compra | `frontend/features/purchases/components/purchases-page.tsx` | Se puede recibir mercadería controlada sin fecha de vencimiento sin ninguna advertencia | Medio-alto | Medio | Media-alta |
| Agregar tope superior al descuento por línea en POS | `frontend/features/pos/components/pos-page.tsx` | Un descuento mayor al subtotal de la línea solo se detecta indirectamente | Medio | Bajo | Media |
| Validar en la conversión de Solicitud→Venta que el efectivo recibido cubra el monto a pagar (igual que ya hace POS) | `frontend/features/requests/components/customer-requests-page.tsx` | Inconsistencia entre dos flujos que llegan al mismo `SaleService.checkout` | Medio | Bajo | Media |
| Crear pantalla de administración de categorías financieras | `backend/apps/finance/` (ya tiene CRUD, falta UI), `frontend/features/finance/components/` (nuevo) | Sin categorías sembradas, Gastos/Ingresos es un callejón sin salida | Medio | Medio | Media |
| Agregar desglose por denominación en el arqueo/cierre de caja, o al menos mostrar la diferencia en tiempo real mientras se escribe | `backend/apps/cash/services.py`, `frontend/features/cash/components/cash-operations-page.tsx` | Hoy solo se ingresa un monto total; la diferencia se ve recién después de enviar | Medio | Medio | Media |
| Permitir reactivar un producto desactivado | `frontend/features/products/components/product-form-page.tsx` | Un producto desactivado queda inactivo para siempre desde la UI | Medio | Bajo | Media |
| Exponer el campo "Observación" de cabecera de compra (existe en el código, no en la pantalla) | `frontend/features/purchases/components/purchases-page.tsx` | Campo huérfano que el usuario nunca puede llenar | Bajo-medio | Bajo | Media |
| Hacer persistentes los botones "+" de Unidad y Ubicación en el formulario de producto (hoy son simulacro solo-local) | `frontend/features/products/components/product-form-page.tsx:260` | Inconsistente con los otros 5 botones "+" que sí persisten; se pierde al recargar | Medio | Medio | Media |
| Agregar filtros server-side (fecha, sucursal, almacén, proveedor/cliente) antes de exportar/listar, reemplazando el filtrado en cliente sobre los últimos 500 registros de Ventas | `frontend/features/sales/components/sales-list-page.tsx`, endpoints de listado correspondientes | Ventas más allá del registro 500 no aparecen ni en filtros ni en exportación futura | Medio | Medio | Media |
| Corregir el rótulo "Importar Excel" que en realidad solo acepta `.csv` (o aceptar `.xlsx` de verdad) | `frontend/features/products/components/product-management-page.tsx:152` | Confunde al usuario que sube un archivo `.xlsx` real | Bajo | Bajo (cambiar texto) / Medio (aceptar xlsx real) | Baja-media |
| Agregar descarga de archivo de errores en la importación de productos | `backend/apps/catalog/views.py` (import_preview), frontend del modal de importación | Hoy los errores solo se ven en pantalla, no se pueden llevar a otro lado para corregir en Excel | Bajo | Bajo-medio | Baja |
| Agregar "Ver historial de importaciones" | Nuevo endpoint + pantalla | No hay trazabilidad de qué se importó y cuándo | Bajo | Medio | Baja |
| Mostrar costo unitario calculado en el formulario de compra (como ya hace el de producto) | `frontend/features/purchases/components/purchases-page.tsx` | Falta de retroalimentación al recibir mercadería | Bajo | Bajo | Baja |
| Bloquear o confirmar explícitamente el guardado de un producto con margen negativo | `frontend/features/products/components/product-form-page.tsx` | Hoy solo advierte visualmente, no impide guardar | Bajo-medio | Bajo | Baja |
| Quitar el campo de código de barras duplicado en el formulario de producto | `frontend/features/products/components/product-form-page.tsx:438,468` | Confuso, dos inputs ligados al mismo estado | Bajo | Bajo | Baja |
| Reemplazar "SKU" visible en el buscador de POS por lenguaje simple ("Buscar por nombre o código") | `frontend/features/pos/components/pos-page.tsx:244,246` | Jerga técnica visible al cajero | Bajo | Bajo | Baja |
| Exponer o quitar los campos huérfanos "descuento autorizado"/"notas" por línea en Solicitudes | `frontend/features/requests/components/customer-requests-page.tsx:168` | Datos que se guardan siempre con valor por defecto sin que el usuario lo sepa | Bajo | Bajo | Baja |
| Agregar botón "+" para crear caja registradora si no existe ninguna en la sucursal | `frontend/features/cash/components/cash-operations-page.tsx` | Selector vacío sin salida | Bajo | Bajo | Baja |

---

## Fase D — Limpieza y preparación

Deuda técnica y preparación para escalar con confianza, una vez resuelto lo anterior.

| Tarea | Archivo / módulo | Riesgo | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| Corregir el campo `status` de `lib/modules.ts` para que refleje la realidad (hoy dice "legacy" en módulos que ya son reales) | `frontend/lib/modules.ts` | Confunde a cualquiera que audite el sistema después | Medio | Bajo | Media |
| Alinear el formato de error real de la API (`{"error":{code,message,fields}}`) con lo documentado en `docs/separacion-frontend-backend.md` (`{"data","message","errors"}`) — actualizar la documentación, no el contrato ya en uso | `docs/separacion-frontend-backend.md` | Riesgo de que futuras integraciones se guíen por la doc equivocada | Medio | Bajo | Media |
| Manejar errores 500 con el mismo formato JSON que 4xx | `backend/apps/core/exceptions.py` | Un error de servidor hoy no es JSON estructurado, rompe el contrato para el frontend | Medio | Bajo-medio | Media |
| Ejecutar y validar Docker Compose con PostgreSQL real (pendiente desde la auditoría anterior) | `backend/compose.yml` | SQLite local no reproduce las restricciones únicas (`NULLS NOT DISTINCT`) que sí aplica PostgreSQL | Medio | Medio | Media |
| Alinear `requirements.txt` con las versiones realmente instaladas/probadas y documentar un venv nativo de Windows | `backend/requirements.txt`, `backend/.venv` | El `.venv` del repo es de Linux/WSL y no corre en Windows; hay drift de versión de Django/DRF | Medio | Bajo | Media |
| Agregar pipeline CI que corra `pytest`, `ruff`, `tsc --noEmit`, `next build` y `next lint` en cada cambio | Repositorio backend y frontend (nuevo) | Ninguno de estos problemas se habría detectado antes de llegar a este diagnóstico si hubiera CI | Alto a futuro | Medio | Media |
| Eliminar código muerto: `demo-session-context.tsx`, `features/companies/**`, `features/pharmacies/**`, `products-service.ts`, `product-fixtures.ts`, `purchaseListResource`/`salesListResource` sin usar | `frontend/features/` | Ninguno funcional, solo ruido para quien mantenga el código | Bajo | Bajo | Baja |
| Eliminar los ~11MB de assets legacy no usados en `public/legacy` (Bootstrap, jQuery, AdminLTE, DataTables, Select2, SweetAlert2, Toastr, moment, Chart.js) | `frontend/public/legacy/` | Peso muerto en el bundle/despliegue | Bajo | Bajo | Baja |
| Corregir `ruff` (2 errores de línea larga) y ejecutar `ruff format` | `backend/apps/accounts/admin.py`, `backend/apps/audit/admin.py` | Ninguno funcional | Bajo | Trivial | Baja |
| Unificar estrategia de borrado: hoy `Membership` y `Lot` usan borrado físico mientras el resto del sistema usa baja lógica | `backend/apps/accounts/views.py:193-201`, modelo `Lot` | Inconsistencia de auditoría/trazabilidad | Bajo-medio | Medio | Baja |
| Ampliar el health check para verificar Redis, no solo la base de datos | `backend/apps/core/views.py` | El sistema depende de Redis/Celery pero el health check no lo refleja | Bajo | Bajo | Baja |
| Limpiar `features/modules/config/module-screens.ts` de fixtures muertos para rutas ya migradas a componentes reales | `frontend/features/modules/config/module-screens.ts` | Código muerto, confunde sobre qué pantalla realmente se usa | Bajo | Bajo | Baja |

---

## Cómo leer este plan

- **Fase A y B no deben esperar a que Fase C esté completa** — son requisitos para que cualquier corrección de UX tenga sentido (de nada sirve mejorar un formulario si el build no compila o un pago se puede duplicar).
- **Fase C es la más larga porque es la más visible** para el usuario final: es la que decide si "se siente como demo" o "se siente real".
- **Fase D no es opcional a largo plazo**, pero no bloquea el uso diario del sistema — puede ejecutarse en paralelo por otro desarrollador mientras el resto avanza en A/B/C.
- Este plan **no agrega funcionalidades nuevas**: cotizaciones, facturación SUNAT, notas de venta, etc. permanecen fuera de alcance hasta que se decida explícitamente construirlas (ver "Fuera de alcance confirmado" en `docs/ampliacion-productos-finanzas-solicitudes.md`).
