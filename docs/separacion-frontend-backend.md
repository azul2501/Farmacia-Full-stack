# Separacion Frontend / Backend

## Estado actual

El sistema actual es CodeIgniter, no Laravel. La interfaz esta en `application/views`,
los controladores renderizan vistas PHP y varias acciones devuelven HTML parcial para jQuery.

La migracion debe mantener funcionando el sistema actual mientras Next reemplaza pantallas por
modulos.

## Estructura inicial

```txt
farmacia/
├── application/        # Backend actual CodeIgniter
├── system/
├── public/             # Assets legacy
├── frontend/           # Nuevo frontend Next
├── downloads/
├── composer.json
└── index.php
```

## Regla de migracion

Next no debe consumir vistas PHP ni respuestas HTML. Cada pantalla migrada debe usar endpoints
JSON versionados.

La migracion visual debe ser fiel al sistema actual:

- Mantener AdminLTE, Bootstrap, Font Awesome, DataTables, Select2, SweetAlert y Toastr.
- Mantener nombres de botones, tablas, modales, formularios y flujo de trabajo.
- No rediseñar pantallas durante la migracion.
- Cambiar solo la tecnologia de render: de vista PHP a componente Next.
- Cambiar el origen de datos: de variables PHP/modelos en vista a API JSON.

Formato recomendado:

```txt
/api/v1/auth/login
/api/v1/me
Django Admin gestiona empresas/farmacias clientes. No existe endpoint consumido por Next.js para administrar farmacias globales.
/api/v1/productos
/api/v1/clientes
/api/v1/ventas
/api/v1/inventario
```

## Orden recomendado

1. Autenticacion y usuario actual.
2. Layout principal, menu, permisos, establecimiento activo y notificaciones.
3. Productos, atributos, laboratorios y stock visible.
4. Clientes y proveedores.
5. Compras.
6. Inventario y kardex.
7. Ventas.
8. Caja.
9. Facturacion, XML, CDR, PDF y reportes.
10. Farmacias y configuracion multi-tenant.

## Respuestas del backend

Cada endpoint debe responder JSON consistente:

```json
{
  "data": {},
  "meta": {},
  "message": null
}
```

Errores:

```json
{
  "data": null,
  "message": "No autorizado",
  "errors": {}
}
```

## Sesion

Para separacion real, el frontend debe dejar de depender de redirects de CodeIgniter. Opciones:

- Temporal: cookie de sesion de CodeIgniter con CORS y SameSite configurado.
- Recomendado al migrar a Laravel: Laravel Sanctum con cookies first-party.
- Alternativa: tokens Bearer por farmacia/usuario, con expiracion y refresh.

## Criterio para declarar un modulo migrado

- La pantalla existe en Next.
- No usa `application/views`.
- No usa HTML parcial desde jQuery.
- Lee y escribe mediante API JSON.
- Respeta farmacia activa, establecimiento activo y permisos del usuario.
- Tiene validaciones del lado cliente y del lado servidor.
- Se ve y se comporta como la pantalla legacy equivalente.
