import type { AppModule } from "@/types/domain";

export const modules: AppModule[] = [
  {
    href: "/pos",
    label: "Punto de venta",
    description: "Checkout transaccional con stock, lotes, caja y medios de pago.",
    status: "api-ready",
  },
  {
    href: "/inicio",
    label: "Inicio",
    description: "Dashboard principal del sistema actual.",
    status: "legacy",
  },
  {
    href: "/venta",
    label: "Comprobante Electronico",
    description: "Ventas con facturacion electronica.",
    status: "legacy",
  },
  {
    href: "/nventa",
    label: "Notas de Venta",
    description: "Notas de venta internas.",
    status: "legacy",
  },
  {
    href: "/cotizacion",
    label: "Cotizaciones",
    description: "Cotizaciones de venta.",
    status: "legacy",
  },
  {
    href: "/despacho",
    label: "Guia de Remision",
    description: "Despacho y guias de remision.",
    status: "legacy",
  },
  {
    href: "/cliente",
    label: "Clientes",
    description: "Clientes, puntos y vales.",
    status: "legacy",
  },
  {
    href: "/producto",
    label: "Productos",
    description: "Catalogo, laboratorios, precios, lotes y stock.",
    status: "next-ready",
  },
  {
    href: "/atributo",
    label: "Atributos",
    description: "Categorias, laboratorios, principios activos y ubicaciones.",
    status: "legacy",
  },
  {
    href: "/bonificacion",
    label: "Bonificaciones",
    description: "Productos bonificados.",
    status: "legacy",
  },
  {
    href: "/servicio",
    label: "Servicios",
    description: "Servicios registrados.",
    status: "legacy",
  },
  {
    href: "/inventario",
    label: "Inventario",
    description: "Actualizacion de inventario, kardex, lotes y vencimientos.",
    status: "legacy",
  },
  {
    href: "/compra",
    label: "Compras",
    description: "Compra de mercaderia.",
    status: "legacy",
  },
  {
    href: "/solicitud",
    label: "Solicitudes",
    description: "Solicitudes de compra.",
    status: "legacy",
  },
  {
    href: "/proveedor",
    label: "Proveedores",
    description: "Administracion de proveedores.",
    status: "legacy",
  },
  {
    href: "/caja",
    label: "Caja",
    description: "Arqueos de caja y medios de pago.",
    status: "legacy",
  },
  {
    href: "/cajas",
    label: "Cajas",
    description: "Cajas fisicas configuradas por sucursal para apertura, POS y arqueos.",
    status: "api-ready",
  },
  {
    href: "/cobrar",
    label: "Cuentas por Cobrar",
    description: "Cobros pendientes.",
    status: "legacy",
  },
  {
    href: "/pagar",
    label: "Cuentas por Pagar",
    description: "Pagos pendientes.",
    status: "legacy",
  },
  {
    href: "/ingreso",
    label: "Ingresos",
    description: "Ingresos de caja.",
    status: "legacy",
  },
  {
    href: "/gasto",
    label: "Gastos",
    description: "Gastos de caja.",
    status: "legacy",
  },
  {
    href: "/facturacion",
    label: "Facturacion",
    description: "SUNAT, XML, CDR, anulaciones, resumenes y validacion.",
    status: "legacy",
  },
  {
    href: "/consulta",
    label: "Consultas",
    description: "Consultas del sistema.",
    status: "legacy",
  },
  {
    href: "/movimiento",
    label: "Movimientos",
    description: "Movimientos de productos.",
    status: "legacy",
  },
  {
    href: "/reporte",
    label: "Reportes",
    description: "PDF, Excel, contabilidad, compras, ventas y caja.",
    status: "legacy",
  },
  {
    href: "/empresa",
    label: "Empresa",
    description: "Datos de empresa y configuracion general.",
    status: "legacy",
  },
  {
    href: "/establecimiento",
    label: "Establecimientos",
    description: "Locales y almacenes.",
    status: "legacy",
  },
  {
    href: "/almacenes",
    label: "Almacenes",
    description: "Almacenes asociados a las sucursales de la empresa activa.",
    status: "api-ready",
  },
  {
    href: "/serie",
    label: "Series",
    description: "Series de comprobantes.",
    status: "legacy",
  },
  {
    href: "/punto",
    label: "Puntos",
    description: "Configuracion de puntos.",
    status: "legacy",
  },
  {
    href: "/transporte",
    label: "Transporte",
    description: "Transportistas.",
    status: "legacy",
  },
  {
    href: "/traslado",
    label: "Traslado",
    description: "Traslados entre establecimientos.",
    status: "legacy",
  },
  {
    href: "/usuario",
    label: "Usuarios",
    description: "Usuarios, permisos y contrasenas.",
    status: "legacy",
  },
  {
    href: "/utilitario",
    label: "Utilitarios",
    description: "Herramientas del sistema.",
    status: "legacy",
  },
];

export function findModuleByHref(href: string) {
  const exactModule = modules.find((module) => module.href === href);

  if (exactModule) {
    return exactModule;
  }

  const parentHref = `/${href.split("/").filter(Boolean)[0] ?? ""}`;
  const parentModule = modules.find((module) => module.href === parentHref);

  if (!parentModule) {
    return undefined;
  }

  return {
    ...parentModule,
    href,
  };
}
