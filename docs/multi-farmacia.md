# Modelo Multi-Farmacia

## Objetivo

Definir el aislamiento multiempresa del sistema. La administracion global de farmacias clientes se
realiza desde Django Admin, no desde el frontend Next.js.

## Decision clave

Toda tabla operativa debe quedar asociada a una farmacia propietaria. El sistema actual usa
`idestablecimiento` en muchos flujos, pero para multi-farmacia falta una entidad superior:
`farmacia` o `tenant`.

## Entidades base

```txt
farmacias
├── id
├── nombre_comercial
├── razon_social
├── ruc
├── dominio
├── plan
├── estado
├── fecha_creacion
└── configuracion

establecimientos
├── id
├── farmacia_id
├── descripcion
├── direccion
└── datos fiscales/locales

usuarios
├── id
├── farmacia_id
├── establecimiento_predeterminado_id
├── nombres
├── usuario/email
├── password_hash
└── estado
```

## Regla de aislamiento

Ninguna consulta operativa debe traer datos sin filtrar por `farmacia_id`. Esto aplica a productos,
clientes, proveedores, ventas, compras, inventario, caja, documentos, series y reportes.

## Creacion de una nueva farmacia

Flujo recomendado en Django Admin:

1. Registrar datos de empresa: razon social, RUC, nombre comercial y contacto.
2. Crear usuario dueno o administrador.
3. Crear membresia activa con rol.
4. Crear establecimiento principal.
5. Crear almacen inicial.
6. Crear caja o terminal inicial si aplica.
7. Crear configuracion inicial: moneda, IGV, formatos y permisos base.
8. Crear series/documentos si aplica.
9. Cargar certificado SUNAT si tendra facturacion electronica.
10. Enviar credenciales o invitacion al administrador.

## Riesgos

- Mezclar datos entre farmacias por consultas sin `farmacia_id`.
- Reutilizar sesiones actuales sin separar tenant.
- Mantener series SUNAT compartidas.
- Copiar productos globales sin definir si son catalogo maestro o catalogo por farmacia.
- Ejecutar reportes sin filtro obligatorio por farmacia.

## Recomendacion

Antes de migrar ventas y facturacion, agregar `farmacia_id` al modelo de datos y crear una capa de
consulta obligatoria por farmacia activa.
