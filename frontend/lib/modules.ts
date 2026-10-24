import type { AppModule } from "@/types/domain";
import { runtimeConfig } from "@/features/shared/config/runtime";

/**
 * Catálogo de módulos y la versión en la que se habilita cada uno.
 * Una ruta que no está aquí, o cuya versión es mayor a NEXT_PUBLIC_APP_VERSION, responde 404.
 */
export const modules: AppModule[] = [
  // V1: lo que una botica de una sola tienda usa todos los días.
  { href: "/pos", label: "Punto de venta", description: "Venta en mostrador con stock por lote.", version: 1 },
  { href: "/venta", label: "Ventas", description: "Ventas del día, reimpresión y anulación.", version: 1 },
  { href: "/producto", label: "Productos", description: "Catálogo, presentaciones y precios.", version: 1 },
  { href: "/proveedor", label: "Proveedores", description: "Distribuidoras y laboratorios a quienes compras.", version: 1 },
  { href: "/compra", label: "Ingreso de mercadería", description: "Mercadería recibida con lote y vencimiento.", version: 1 },
  { href: "/inventario", label: "Stock y vencimientos", description: "Stock por lote, ajustes y vencimientos.", version: 1 },
  { href: "/consulta/kardex", label: "Historial del producto", description: "Entradas y salidas de cada producto.", version: 1 },
  { href: "/caja", label: "Caja", description: "Apertura, arqueo y cierre de caja.", version: 1 },
  { href: "/usuario", label: "Usuarios", description: "Dueño y cajeros de la botica.", version: 1 },

  // V2: clientes, crédito, finanzas y reportes.
  { href: "/atributo", label: "Atributos de producto", description: "Categorías, laboratorios y principios activos.", version: 2 },
  { href: "/cliente", label: "Clientes", description: "Clientes de la botica.", version: 2 },
  { href: "/cobrar", label: "Cuentas por cobrar", description: "Ventas a crédito pendientes.", version: 2 },
  { href: "/pagar", label: "Cuentas por pagar", description: "Compras a crédito pendientes.", version: 2 },
  { href: "/gasto", label: "Gastos", description: "Gastos operativos.", version: 2 },
  { href: "/ingreso", label: "Ingresos adicionales", description: "Ingresos fuera de ventas.", version: 2 },
  { href: "/reporte", label: "Reportes", description: "Reportes de ventas y caja.", version: 2 },

  // V3: varias sucursales.
  { href: "/establecimiento", label: "Sucursales", description: "Locales de la empresa.", version: 3 },
  { href: "/almacenes", label: "Almacenes", description: "Almacenes por sucursal.", version: 3 },
  { href: "/cajas", label: "Cajas", description: "Cajas físicas por sucursal.", version: 3 },
  { href: "/terminales", label: "Terminales POS", description: "Terminales de venta por sucursal.", version: 3 },
  { href: "/traslado", label: "Transferencias", description: "Traslados entre almacenes.", version: 3 },
  { href: "/solicitud", label: "Solicitudes programadas", description: "Pedidos programados de clientes.", version: 3 },
];

export function isModuleEnabled(module: Pick<AppModule, "version">) {
  return module.version <= runtimeConfig.appVersion;
}

function findCatalogModule(href: string) {
  const exactModule = modules.find((module) => module.href === href);
  if (exactModule) return exactModule;
  const parentHref = `/${href.split("/").filter(Boolean)[0] ?? ""}`;
  const parentModule = modules.find((module) => module.href === parentHref);
  return parentModule ? { ...parentModule, href } : undefined;
}

/** Módulo habilitado para una ruta, o undefined si no existe o pertenece a una versión posterior. */
export function findModuleByHref(href: string) {
  const appModule = findCatalogModule(href);
  return appModule && isModuleEnabled(appModule) ? appModule : undefined;
}

/** Indica si una ruta del portal está habilitada en la versión publicada. */
export function isRouteEnabled(href: string) {
  return findModuleByHref(href) !== undefined;
}
