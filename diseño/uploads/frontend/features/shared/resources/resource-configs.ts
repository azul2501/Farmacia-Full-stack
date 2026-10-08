import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ResourceConfig } from "@/features/shared/resources/resource-types";

const activeField = { name: "is_active", label: "Activo", type: "checkbox" as const };

export const categoryResource: ResourceConfig = {
  endpoint: apiEndpoints.categories,
  title: "Categorias",
  singular: "categoria",
  description: "Clasificacion comercial de productos.",
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
  description: "Laboratorios asociados al catalogo de medicamentos.",
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
  singular: "accion terapeutica",
  description: "Clasificacion terapeutica asociada a productos.",
};

export const productLocationResource: ResourceConfig = {
  endpoint: apiEndpoints.productLocations,
  title: "Ubicaciones",
  singular: "ubicacion",
  description: "Ubicaciones fisicas por almacen y presentacion vendible.",
  permission: "catalogs.view",
  deactivateOnly: true,
  columns: [
    { name: "branch_name", label: "Sucursal" },
    { name: "warehouse_name", label: "Almacen" },
    { name: "code", label: "Codigo" },
    { name: "product_name", label: "Producto" },
    { name: "aisle", label: "Pasillo" },
    { name: "shelf", label: "Estante" },
    { name: "level", label: "Nivel" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "warehouse", label: "Almacen", type: "select", required: true, optionSource: "warehouses" },
    { name: "variant", label: "Producto / presentacion", type: "select", required: true, optionSource: "productVariants" },
    { name: "code", label: "Codigo", required: true },
    { name: "description", label: "Descripcion" },
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
    { name: "legal_name", label: "Razon social" },
    { name: "trade_name", label: "Nombre comercial" },
    { name: "phone", label: "Telefono" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "document_type", label: "Tipo de documento", type: "select", required: true, options: [{ value: "RUC", label: "RUC" }, { value: "DNI", label: "DNI" }] },
    { name: "document_number", label: "Numero de documento", required: true },
    { name: "legal_name", label: "Razon social", required: true },
    { name: "trade_name", label: "Nombre comercial" },
    { name: "address", label: "Direccion" },
    { name: "phone", label: "Telefono" },
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
    { name: "phone", label: "Telefono" },
    { name: "email", label: "Correo" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "document_type", label: "Tipo de documento", type: "select", required: true, options: [{ value: "DNI", label: "DNI" }, { value: "RUC", label: "RUC" }, { value: "CE", label: "Carnet de extranjeria" }] },
    { name: "document_number", label: "Numero de documento" },
    { name: "full_name", label: "Nombre completo", required: true },
    { name: "address", label: "Direccion" },
    { name: "phone", label: "Telefono" },
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
    { name: "code", label: "Codigo" },
    { name: "name", label: "Sucursal" },
    { name: "address", label: "Direccion" },
    { name: "phone", label: "Telefono" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "code", label: "Codigo", required: true },
    { name: "name", label: "Nombre", required: true },
    { name: "address", label: "Direccion", required: true },
    { name: "phone", label: "Telefono" },
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
    { name: "code", label: "Codigo" },
    { name: "name", label: "Almacen" },
    { name: "branch_name", label: "Sucursal" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "branch", label: "Sucursal", type: "select", required: true, optionSource: "branches" },
    { name: "code", label: "Codigo", required: true },
    { name: "name", label: "Nombre", required: true },
    activeField,
  ],
};

export const cashRegisterResource: ResourceConfig = {
  endpoint: apiEndpoints.cashRegisters,
  title: "Cajas",
  singular: "caja",
  description: "Cajas fisicas configuradas para apertura y operacion POS.",
  permission: "cash.view",
  columns: [
    { name: "code", label: "Codigo" },
    { name: "name", label: "Caja" },
    { name: "branch_name", label: "Sucursal" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "branch", label: "Sucursal", type: "select", required: true, optionSource: "branches" },
    { name: "code", label: "Codigo", required: true },
    { name: "name", label: "Nombre", required: true },
    activeField,
  ],
};

export const productResource: ResourceConfig = {
  endpoint: apiEndpoints.products,
  title: "Productos",
  singular: "producto maestro",
  description: "Catalogo maestro conectado a Django. Las presentaciones se administran como SKU relacionados.",
  permission: "products.view",
  columns: [
    { name: "internal_code", label: "Codigo" },
    { name: "commercial_name", label: "Producto" },
    { name: "active_ingredient", label: "Principio activo" },
    { name: "laboratory_name", label: "Laboratorio" },
    { name: "category_name", label: "Categoria" },
    { name: "variants", label: "Presentaciones", format: "count" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [
    { name: "internal_code", label: "Codigo interno", required: true },
    { name: "commercial_name", label: "Nombre comercial", required: true },
    { name: "active_ingredient", label: "Principio activo" },
    { name: "category", label: "Categoria", type: "select", required: true, optionSource: "categories" },
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
  title: "Stock por almacen y lote",
  singular: "existencia",
  description: "Existencias reales calculadas por movimientos de inventario. El stock no se edita directamente.",
  permission: "inventory.view",
  readOnly: true,
  columns: [
    { name: "warehouse_name", label: "Almacen" },
    { name: "product_name", label: "Producto" },
    { name: "presentation", label: "Presentacion" },
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
    { name: "presentation", label: "Presentacion" },
    { name: "batch_number", label: "Lote" },
    { name: "warehouse_name", label: "Almacen" },
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
  description: "Compras registradas y estado de recepcion de mercaderia.",
  permission: "purchases.view",
  readOnly: true,
  columns: [
    { name: "document_number", label: "Documento" },
    { name: "document_date", label: "Fecha" },
    { name: "supplier_name", label: "Proveedor" },
    { name: "warehouse_name", label: "Almacen destino" },
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
    { name: "number", label: "Numero" },
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
  description: "Traslados de inventario entre almacenes con despacho y recepcion controlados.",
  permission: "transfers.view",
  readOnly: true,
  columns: [
    { name: "number", label: "Numero" },
    { name: "created_at", label: "Fecha" },
    { name: "status", label: "Estado" },
    { name: "origin_warehouse", label: "Almacen origen" },
    { name: "destination_warehouse", label: "Almacen destino" },
    { name: "items", label: "Productos", format: "count" },
  ],
  fields: [],
};

export const userListResource: ResourceConfig = {
  endpoint: "/users/",
  title: "Usuarios",
  singular: "usuario",
  description: "Usuarios, roles y asignaciones devueltos por la empresa activa.",
  permission: "users.view",
  readOnly: true,
  columns: [
    { name: "email", label: "Correo" },
    { name: "full_name", label: "Nombre" },
    { name: "phone", label: "Telefono" },
    { name: "role", label: "Rol" },
    { name: "is_active", label: "Estado", format: "status" },
  ],
  fields: [],
};
