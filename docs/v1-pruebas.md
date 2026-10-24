# V1: qué probar

Lista para validar las fases 1 a 4 antes de hacer commit. Marca cada punto; si algo falla, anota la pantalla, lo que hiciste y el mensaje de error.

## 0. Preparar el entorno

1. En `C:\projects\FARMACIA`, rama `v1-recorte`.
2. Si tienes un `.env` en la raíz, agrega `APP_VERSION=1` y `RUC_API_TOKEN=local-ruc-token` (o copia `.env.example`).
3. Reconstruye y levanta el backend (instala Unfold y aplica la migración nueva):
   ```bash
   docker compose up -d --build api
   docker compose logs -f api      # debe decir "Applying tenancy.0002_subscription_plan_and_status... OK"
   ```
4. Crea tu usuario de superadmin si no lo tienes: `docker compose exec api python manage.py createsuperuser`.
5. Frontend: en `frontend/.env.local` agrega `NEXT_PUBLIC_APP_VERSION=1` (opcional, es el valor por defecto) y corre `npm run dev`.

## 1. Pruebas automáticas

- [ ] Backend: `docker compose run --rm tests` → todos en verde (incluye `test_v1_scope.py`, `test_signup.py`, `test_admin_panel.py` y `test_digemid.py`).
- [ ] Migraciones al día: `docker compose run --rm tests sh -c "pip install -q -r requirements-dev.txt && python manage.py makemigrations --check --dry-run"` → "No changes detected".
- [ ] Frontend: en `frontend/`, `npx tsc --noEmit` y `npm run build` sin errores.

## 2. Fase 1: frontend recortado a la V1

- [ ] El menú muestra solo: Inicio · Ventas (Punto de venta, Ventas) · Productos y stock (Productos, Ingreso de mercadería, Stock y vencimientos, Historial del producto, Proveedores) · Caja (Caja y arqueo) · Administración (Usuarios).
- [ ] No aparecen Clientes, Cuentas por cobrar/pagar, Gastos, Ingresos, Transferencias, Solicitudes, Sucursales, Almacenes, Cajas, Terminales, Reportes ni Atributos.
- [ ] Escribir a mano estas URLs muestra la página 404: `/cliente`, `/cobrar`, `/pagar`, `/gasto`, `/traslado`, `/solicitud`, `/establecimiento`, `/almacenes`, `/cajas`, `/reporte`, `/facturacion`, `/cotizacion`, `/consulta/stockv`.
- [ ] Inicio se llama "Inicio", no muestra "Transferencias pendientes" ni "Ventas por sucursal", y el enlace de "Diferencias de caja" lleva a Caja.
- [ ] POS: no aparece la opción "Crédito" y el producto no muestra "SKU".
- [ ] Ingreso de mercadería: el título dice "Ingreso de mercadería", la condición solo ofrece "Contado".
- [ ] Historial del producto: el título ya no dice "Kardex".
- [ ] Productos: el formulario no pide almacén; si pones una ubicación de estante, se guarda.
- [ ] Usuarios: al crear, el rol solo ofrece Cajero y Dueño, y no aparece "Sucursales autorizadas". El cajero creado puede entrar y vender.

## 3. Fase 2: backend de la V1

Con la sesión del dueño (puedes usar `http://localhost:8000/api/docs/` o el navegador):

- [ ] `GET /api/v1/transfers/`, `/payables/`, `/receivables/`, `/financial-movements/`, `/customer-requests/` → 404.
- [ ] `GET /api/v1/products/`, `/stock/`, `/sales/`, `/reports/dashboard/` → 200.
- [ ] Una venta a crédito enviada a la API se rechaza con "Las ventas a crédito no están disponibles en esta versión".
- [ ] Crear un usuario con rol `WAREHOUSE_OPERATOR` por la API se rechaza.

## 4. Flujo completo de una botica nueva (fase 3)

- [ ] En `/login` aparece "Regístrala gratis" y lleva a `/signup`.
- [ ] RUC inválido (por ejemplo `20600000006`) muestra el error en el campo RUC.
- [ ] Registro con RUC válido (prueba con uno real de una empresa activa) entra directo a Inicio.
- [ ] Arriba aparece "Prueba gratis: te quedan 30 día(s)".
- [ ] Inicio muestra "Primeros pasos" con 0 de 3.
- [ ] Crear un producto → el paso 1 se marca.
- [ ] Ingreso de mercadería con lote y vencimiento, confirmarlo → el paso 2 se marca y el stock aparece.
- [ ] Abrir caja → el paso 3 se marca y "Primeros pasos" desaparece.
- [ ] Vender en el POS con efectivo y vuelto, imprimir la nota, anular la venta desde Ventas.
- [ ] Cerrar la caja con diferencia cero.
- [ ] Registrar otra botica con el mismo RUC o el mismo correo se rechaza.
- [ ] Hacer 6 registros seguidos desde tu PC: el sexto dice "Demasiados intentos" (límite 5 por hora).
- [ ] Si el contenedor `ruc` no responde (`docker compose stop ruc`), el registro igual funciona y la botica aparece "RUC por verificar" en el panel.

## 5. Panel de superadmin (fase 4)

En `http://localhost:8000/admin/` con tu superusuario:

- [ ] El panel tiene el diseño de Unfold y el menú Clientes · Operación (solo lectura) · Sistema.
- [ ] Inicio muestra las cifras (boticas, en prueba, pagando…), "Últimos registros" y "Sin ventas en 7 días".
- [ ] Planes: cambia el precio y los días de prueba del "Plan Básico"; una botica nueva toma los días nuevos.
- [ ] Boticas → selecciona la botica de prueba → acción **Suspender**. En la app aparece el aviso rojo y vender da "Tu periodo de prueba terminó o tu cuenta está suspendida".
- [ ] Acción **Activar plan** → la botica vuelve a vender y desaparece el aviso de prueba.
- [ ] Acción **Extender la prueba 15 días** → vuelve a estado "En prueba" con 15 días más.
- [ ] Ventas y Productos se pueden ver pero no editar ni borrar.
- [ ] Un usuario normal (dueño o cajero) no puede entrar a `/admin/`.

## 6. Catálogo y alertas DIGEMID

- [ ] Al levantar el `api`, `docker compose logs api` dice "Lista base cargada: 565 productos" (la segunda vez dice "ya está cargada").
- [ ] En el panel, DIGEMID → Catálogo maestro muestra los productos, se filtra por fuente y se puede cambiar el precio sugerido desde la lista.
- [ ] En la app, Productos → **Agregar desde el catálogo**: buscar "paracetamol 500", elegirlo → el precio viene puesto en S/ 0.10; ponle código de barras y agrégalo → aparece en Productos y en el POS.
- [ ] Buscar "amoxicilina", marcar 3 casillas → "Agregar seleccionados (3)" → aviso "3 producto(s) agregado(s)"; quedan como "En tu catálogo".
- [ ] Con el buscador vacío, "Cargar toda la lista" → "Sí, agregar N" → aviso con agregados y los que se saltaron; Productos muestra la lista completa y el recuadro desaparece.
- [ ] Buscar "alcohol", agregarlo → queda en "Insumos y cuidado personal" y el ingreso de mercadería no le pide lote ni vencimiento.
- [ ] (Cuando llegue el Excel de DIGEMID) `docker compose cp <archivo>.xlsx api:/tmp/catalogo.xlsx`, luego `import_digemid_catalog /tmp/catalogo.xlsx --dry-run` muestra las columnas reconocidas; sin `--dry-run` guarda los productos.
- [ ] Buscar el mismo producto otra vez → dice "En tu catálogo"; intentar agregarlo de nuevo da error.
- [ ] Un cajero no ve el botón "Agregar desde el catálogo".
- [ ] `docker compose exec api python manage.py sync_digemid_alerts` descarga las alertas del año y lista lotes; aparecen en el panel (DIGEMID → Alertas sanitarias) y en Inicio.
- [ ] En el panel, crea una alerta a mano con el lote de un producto que tengas en stock → en Inicio sale en rojo con "Tienes en stock".

## 7. Alta de botica desde el panel

- [ ] Panel → Boticas → Agregar: pide nombre comercial, razón social (opcional), RUC, dirección, plan y los datos del dueño.
- [ ] Al guardar aparece "Botica lista para vender" con la contraseña temporal.
- [ ] Con ese correo y contraseña se entra a la app y se puede abrir caja y vender.
- [ ] Un RUC inválido o un correo ya usado muestran el error en el formulario.

## 8. Si algo falla

Copia el error de `docker compose logs api` o de la consola del navegador y pásamelo junto con el paso de esta lista.
