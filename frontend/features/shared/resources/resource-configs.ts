import { roleLabels } from "@/features/auth/types/session";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ResourceConfig } from "@/features/shared/resources/resource-types";

const activeField = { name: "is_active", label: "Activo", type: "checkbox" as const };

export const categoryResource: ResourceConfig = {
  endpoint: apiEndpoints.categories,
  title: "Categorías",
  singular: "categoria",
  description: "Clasificación comercial de productos.",
  permission: "catalogs.view",
  deactivateOnly: true,
  columns: [
    { name: "name", label: "Nombre" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [{ name: "name", label: "Nombre", required: true }, activeField],
};

export const laboratoryResource: ResourceConfig = {
  ...categoryResource,
  endpoint: apiEndpoints.laboratories,
  title: "Laboratorios",
  singular: "laboratorio",
  description: "Laboratorios asociados al catálogo de medicamentos.",
};

export const activeIngredientResource: ResourceConfig = {
  ...categoryResource,
  endpoint: apiEndpoints.activeIngredients,
  title: "Principios activos",
  singular: "principio activo",
  description: "Sustancias activas utilizadas para clasificar medicamentos.",
};

export const therapeuticActionResource: ResourceConfig = {
  ...categoryResource,
  endpoint: apiEndpoints.therapeuticActions,
  title: "Acciones terapeuticas",
  singular: "acción terapéutica",
  description: "Clasificación terapéutica asociada a productos.",
};

export const productLocationResource: ResourceConfig = {
  endpoint: apiEndpoints.productLocations,
  title: "Ubicaciones",
  singular: "ubicacion",
  description: "Ubicaciones fisicas por almacén y presentación vendible.",
  permission: "catalogs.view",
  deactivateOnly: true,
  columns: [
    { name: "branch_name", label: "Sucursal" },
    { name: "warehouse_name", label: "Almacén" },
    { name: "code", label: "Código" },
    { name: "product_name", label: "Producto" },
    { name: "aisle", label: "Pasillo" },
    { name: "shelf", label: "Estante" },
    { name: "level", label: "Nivel" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "warehouse", label: "Almacén", type: "select", required: true, optionSource: "warehouses" },
    { name: "variant", label: "Producto / presentación", type: "select", required: true, optionSource: "productVariants" },
    { name: "code", label: "Código", required: true },
    { name: "description", label: "Descripción" },
    { name: "aisle", label: "Pasillo" },
    { name: "shelf", label: "Estante" },
    { name: "level", label: "Nivel" },
    activeField,
  ],
};

export const supplierResource: ResourceConfig = {
  endpoint: apiEndpoints.suppliers,
  title: "Proveedores",
  singular: "proveedor",
  description: "Proveedores disponibles para compras y recepciones.",
  permission: "suppliers.view",
  columns: [
    { name: "document_number", label: "Documento" },
    { name: "legal_name", label: "Razón social" },
    { name: "trade_name", label: "Nombre comercial" },
    { name: "phone", label: "Teléfono" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "document_type", label: "Tipo de documento", type: "select", required: true, options: [{ value: "RUC", label: "RUC" }, { value: "DNI", label: "DNI" }] },
    { name: "document_number", label: "Número de documento", required: true },
    { name: "legal_name", label: "Razón social", required: true },
    { name: "trade_name", label: "Nombre comercial" },
    { name: "address", label: "Dirección" },
    { name: "phone", label: "Teléfono" },
    { name: "email", label: "Correo", type: "email" },
    activeField,
  ],
};

export const customerResource: ResourceConfig = {
  endpoint: apiEndpoints.customers,
  title: "Clientes",
  singular: "cliente",
  description: "Clientes habilitados para ventas y notas de venta.",
  permission: "customers.view",
  columns: [
    { name: "document_number", label: "Documento" },
    { name: "full_name", label: "Nombre" },
    { name: "phone", label: "Teléfono" },
    { name: "email", label: "Correo" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "document_type", label: "Tipo de documento", type: "select", required: true, options: [{ value: "DNI", label: "DNI" }, { value: "RUC", label: "RUC" }, { value: "CE", label: "Carnet de extranjeria" }] },
    { name: "document_number", label: "Número de documento" },
    { name: "full_name", label: "Nombre completo", required: true },
    { name: "address", label: "Dirección" },
    { name: "phone", label: "Teléfono" },
    { name: "email", label: "Correo", type: "email" },
    activeField,
  ],
};

export const branchResource: ResourceConfig = {
  endpoint: apiEndpoints.branches,
  title: "Sucursales",
  singular: "sucursal",
  description: "Locales operativos autorizados para la empresa activa.",
  permission: "branches.view",
  columns: [
    { name: "code", label: "Código" },
    { name: "name", label: "Sucursal" },
    { name: "address", label: "Dirección" },
    { name: "phone", label: "Teléfono" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "code", label: "Código", required: true },
    { name: "name", label: "Nombre", required: true },
    { name: "address", label: "Dirección", required: true },
    { name: "phone", label: "Teléfono" },
    activeField,
  ],
};

export const posTerminalResource: ResourceConfig = {
  endpoint: apiEndpoints.posTerminals,
  title: "Terminales POS",
  singular: "terminal",
  description: "Terminales de punto de venta habilitadas por sucursal.",
  permission: "cash.view",
  columns: [
    { name: "code", label: "Código" },
    { name: "name", label: "Terminal" },
    { name: "branch_name", label: "Sucursal" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "branch", label: "Sucursal", type: "select", required: true, optionSource: "branches" },
    { name: "code", label: "Código", required: true },
    { name: "name", label: "Nombre", required: true },
    activeField,
  ],
};

export const warehouseResource: ResourceConfig = {
  endpoint: apiEndpoints.warehouses,
  title: "Almacenes",
  singular: "almacen",
  description: "Almacenes de stock asociados a cada sucursal.",
  permission: "warehouses.view",
  columns: [
    { name: "code", label: "Código" },
    { name: "name", label: "Almacén" },
    { name: "branch_name", label: "Sucursal" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "branch", label: "Sucursal", type: "select", required: true, optionSource: "branches" },
    { name: "code", label: "Código", required: true },
    { name: "name", label: "Nombre", required: true },
    activeField,
  ],
};

export const cashRegisterResource: ResourceConfig = {
  endpoint: apiEndpoints.cashRegisters,
  title: "Cajas",
  singular: "caja",
  description: "Cajas fisicas configuradas para apertura y operación POS.",
  permission: "cash.view",
  columns: [
    { name: "code", label: "Código" },
    { name: "name", label: "Caja" },
    { name: "branch_name", label: "Sucursal" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "branch", label: "Sucursal", type: "select", required: true, optionSource: "branches" },
    { name: "code", label: "Código", required: true },
    { name: "name", label: "Nombre", required: true },
    activeField,
  ],
};

export const productResource: ResourceConfig = {
  endpoint: apiEndpoints.products,
  title: "Productos",
  singular: "producto maestro",
  description: "Catálogo maestro conectado a Django. Las presentaciones se administran como SKU relacionados.",
  permission: "products.view",
  columns: [
    { name: "internal_code", label: "Código" },
    { name: "commercial_name", label: "Producto" },
    { name: "active_ingredient", label: "Principio activo" },
    { name: "laboratory_name", label: "Laboratorio" },
    { name: "category_name", label: "Categoría" },
    { name: "variants", label: "Presentaciones", format: "count" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "internal_code", label: "Código interno", required: true },
    { name: "commercial_name", label: "Nombre comercial", required: true },
    { name: "active_ingredient", label: "Principio activo" },
    { name: "category", label: "Categoría", type: "select", required: true, optionSource: "categories" },
    { name: "laboratory", label: "Laboratorio", type: "select", optionSource: "laboratories" },
    { name: "product_type", label: "Tipo de producto", type: "select", required: true, options: [{ value: "MEDICINE", label: "Medicamento" }, { value: "SUPPLY", label: "Insumo" }, { value: "SERVICE", label: "Servicio" }] },
    { name: "requires_lot", label: "Requiere lote", type: "checkbox" },
    { name: "requires_expiry", label: "Requiere vencimiento", type: "checkbox" },
    { name: "is_controlled", label: "Medicamento controlado", type: "checkbox" },
    activeField,
  ],
};

export const stockResource: ResourceConfig = {
  endpoint: apiEndpoints.stock,
  title: "Stock por almacén y lote",
  singular: "existencia",
  description: "Existencias reales calculadas por movimientos de inventario. El stock no se edita directamente.",
  permission: "inventory.view",
  readOnly: true,
  columns: [
    { name: "warehouse_name", label: "Almacén" },
    { name: "product_name", label: "Producto" },
    { name: "presentation", label: "Presentación" },
    { name: "batch_number", label: "Lote" },
    { name: "expiry_date", label: "Vencimiento" },
    { name: "quantity", label: "Stock" },
    { name: "reserved_quantity", label: "Reservado" },
    { name: "available_quantity", label: "Disponible" },
  ],
  fields: [],
};

export const kardexResource: ResourceConfig = {
  endpoint: apiEndpoints.inventoryMovements,
  title: "Kardex",
  singular: "movimiento",
  description: "Historial inmutable de entradas y salidas de inventario.",
  permission: "inventory.view",
  readOnly: true,
  columns: [
    { name: "created_at", label: "Fecha" },
    { name: "movement_type", label: "Movimiento" },
    { name: "product_name", label: "Producto" },
    { name: "presentation", label: "Presentación" },
    { name: "batch_number", label: "Lote" },
    { name: "warehouse_name", label: "Almacén" },
    { name: "quantity", label: "Cantidad" },
    { name: "balance_after", label: "Saldo" },
    { name: "document_number", label: "Documento" },
    { name: "performed_by_name", label: "Usuario" },
  ],
  fields: [],
};

export const purchaseListResource: ResourceConfig = {
  endpoint: apiEndpoints.purchases,
  title: "Compras",
  singular: "compra",
  description: "Compras registradas y estado de recepción de mercaderia.",
  permission: "purchases.view",
  readOnly: true,
  columns: [
    { name: "document_number", label: "Documento" },
    { name: "document_date", label: "Fecha" },
    { name: "supplier_name", label: "Proveedor" },
    { name: "warehouse_name", label: "Almacén destino" },
    { name: "status", label: "Estado" },
    { name: "total", label: "Total", format: "currency" },
  ],
  fields: [],
};

export const salesListResource: ResourceConfig = {
  endpoint: apiEndpoints.sales,
  title: "Ventas",
  singular: "venta",
  description: "Ventas confirmadas mediante el checkout transaccional del POS.",
  permission: "sales.view",
  readOnly: true,
  columns: [
    { name: "number", label: "Número" },
    { name: "sold_at", label: "Fecha" },
    { name: "branch_name", label: "Sucursal" },
    { name: "customer_name", label: "Cliente" },
    { name: "cashier_name", label: "Cajero" },
    { name: "status", label: "Estado" },
    { name: "total", label: "Total", format: "currency" },
  ],
  fields: [],
};

export const transferListResource: ResourceConfig = {
  endpoint: apiEndpoints.transfers,
  title: "Transferencias",
  singular: "transferencia",
  description: "Traslados de inventario entre almacenes con despacho y recepción controlados.",
  permission: "transfers.view",
  readOnly: true,
  columns: [
    { name: "number", label: "Número" },
    { name: "created_at", label: "Fecha" },
    { name: "status", label: "Estado" },
    { name: "origin_warehouse", label: "Almacén origen" },
    { name: "destination_warehouse", label: "Almacén destino" },
    { name: "items", label: "Productos", format: "count" },
  ],
  fields: [],
};

export const userListResource: ResourceConfig = {
  endpoint: "/users/",
  title: "Usuarios",
  singular: "usuario",
  description: "Personas con acceso a la empresa, su rol y las sucursales donde pueden operar.",
  permission: "users.view",
  deactivateOnly: true,
  passwordReset: true,
  columns: [
    { name: "email", label: "Correo" },
    { name: "full_name", label: "Nombre" },
    { name: "phone", label: "Teléfono" },
    { name: "role", label: "Rol", labels: roleLabels },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "email", label: "Correo", type: "email", required: true, createOnly: true },
    { name: "full_name", label: "Nombre completo", required: true, createOnly: true },
    { name: "phone", label: "Teléfono", createOnly: true },
    { name: "password", label: "Clave inicial", type: "password", createOnly: true, hint: "Mínimo 8 caracteres. Si el correo ya existe en otra empresa, dejala vacía." },
    {
      name: "role",
      label: "Rol",
      type: "select",
      required: true,
      options: [
        { value: "BRANCH_ADMIN", label: roleLabels.BRANCH_ADMIN },
        { value: "CASHIER", label: roleLabels.CASHIER },
        { value: "WAREHOUSE_OPERATOR", label: roleLabels.WAREHOUSE_OPERATOR },
        { value: "OWNER", label: roleLabels.OWNER },
      ],
    },
    { name: "branch_ids", label: "Sucursales autorizadas", type: "multiselect", optionSource: "branches" },
    { name: "is_active", label: "Activo", type: "checkbox" },
  ],
};
