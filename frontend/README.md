# Frontend Next

Frontend Next.js independiente para el portal operativo por empresa del sistema de boticas.

La administracion global de empresas/farmacias clientes no vive en Next.js. Django Admin es el panel interno de plataforma para crear empresas, suspenderlas, crear usuarios dueno/administrador, membresias, sucursal inicial, almacen inicial, caja/terminal inicial y revisar auditoria global.

## Requisitos

- Node 22 LTS (version fijada en `.nvmrc`; `npm test` necesita >= 22.6). Node 20 ya no tiene soporte y Node 24 queda fuera del rango probado.
- Backend disponible en la URL definida por `NEXT_PUBLIC_API_BASE_URL`.

## Comandos

```bash
npm install
npm run dev
npm run build
```

Imagen de produccion: `frontend/Dockerfile` (salida `standalone`). Las variables `NEXT_PUBLIC_*`
se incrustan al construir, por eso se pasan como `build args` (ver `compose.yml` en la raiz).

## Configuracion

Crear `.env.local` desde `.env.local.example` y ajustar la URL del backend:

```bash
NEXT_PUBLIC_DATA_SOURCE=api
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_API_TIMEOUT_MS=15000
NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true
NEXT_PUBLIC_REFRESH_COOKIE_NAME=boticas_refresh
```

`mock` conserva fixtures aislados para desarrollo visual. `api` habilita login, sesion y los
repositorios conectados a Django; los modulos todavia no migrados permanecen identificados en la
documentacion de integracion.

## Estado de datos por modulo

Usan API real: autenticacion y sesion, dashboard, productos y atributos, proveedores, clientes,
sucursales, almacenes, compras, stock, kardex, caja, POS, ventas, transferencias, CxP, CxC,
gastos, ingresos y solicitudes.

Siguen mock o son pantallas genericas sin persistencia oficial: facturacion/SUNAT, notas de venta
legacy, cotizaciones, guias/despacho, bonificaciones, servicios, consultas y movimientos legacy,
reportes detallados fuera del dashboard, configuracion de empresa/series/puntos, transporte,
utilitarios y configuraciones pendientes dentro de la empresa activa.

El modo `mock` se conserva para fixtures y pantallas genericas. Los flujos especializados indicados
como API real requieren `NEXT_PUBLIC_DATA_SOURCE=api`; no deben presentarse como persistentes en
modo mock.

`.env` y `.env.local` son locales y no se versionan. Se mantienen `.env.example` y
`.env.local.example` como plantillas sin secretos.

## Estado

El frontend no carga rutas PHP ni iframes de CodeIgniter. Los recursos bajo `public/legacy` son
unicamente assets locales de identidad e iconos mientras se completa su reorganizacion.

No se deben crear modulos frontend para superadmin SaaS, crear empresas, crear farmacias clientes, suspender empresas, gestionar planes globales o ver datos de todas las empresas.
