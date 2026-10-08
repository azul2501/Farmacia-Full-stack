"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/features/auth/context/session-context";
import type { Permission } from "@/features/auth/types/demo-session";
import { useAppLayout } from "@/features/shared/context/layout-context";

type SidebarItem = {
  href: string;
  label: string;
  icon: string;
  permission: Permission;
  status?: "available" | "upcoming";
};

type SidebarGroup = {
  label: string;
  icon: string;
  items: SidebarItem[];
};

const sidebarGroups: SidebarGroup[] = [
  {
    label: "Ventas",
    icon: "fas fa-cash-register",
    items: [
      { href: "/pos", label: "Punto de venta", icon: "fas fa-th-large", permission: "pos.view" },
      { href: "/venta", label: "Ventas", icon: "fas fa-receipt", permission: "sales.view" },
      { href: "/solicitud", label: "Solicitudes programadas", icon: "fas fa-calendar-check", permission: "requests.view" },
      { href: "/cliente", label: "Clientes", icon: "fas fa-user-tag", permission: "customers.view" },
      { href: "/cobrar", label: "Cuentas por cobrar", icon: "fas fa-hand-holding-usd", permission: "receivables.view" },
    ],
  },
  {
    label: "Almacen",
    icon: "fas fa-boxes",
    items: [
      { href: "/producto", label: "Productos", icon: "fas fa-capsules", permission: "products.view" },
      { href: "/compra", label: "Compras", icon: "fas fa-cart-plus", permission: "purchases.view" },
      { href: "/inventario", label: "Stock e inventario", icon: "fas fa-warehouse", permission: "inventory.view" },
      { href: "/consulta/kardex", label: "Kardex", icon: "fas fa-exchange-alt", permission: "inventory.view" },
      { href: "/traslado", label: "Transferencias", icon: "fas fa-truck-loading", permission: "transfers.view" },
    ],
  },
  {
    label: "Caja y finanzas",
    icon: "fas fa-coins",
    items: [
      { href: "/caja", label: "Caja y arqueo", icon: "fas fa-cash-register", permission: "cash.view" },
      { href: "/gasto", label: "Gastos", icon: "fas fa-file-invoice-dollar", permission: "finance.view" },
      { href: "/ingreso", label: "Ingresos adicionales", icon: "fas fa-plus-circle", permission: "finance.view" },
      { href: "/pagar", label: "Cuentas por pagar", icon: "fas fa-money-check-alt", permission: "payables.view" },
    ],
  },
  {
    label: "Catalogos",
    icon: "fas fa-tags",
    items: [
      { href: "/atributo", label: "Atributos de producto", icon: "fas fa-tags", permission: "catalogs.view" },
      { href: "/proveedor", label: "Proveedores", icon: "fas fa-truck", permission: "suppliers.view" },
    ],
  },
  {
    label: "Administracion",
    icon: "fas fa-building",
    items: [
      { href: "/establecimiento", label: "Sucursales", icon: "fas fa-store", permission: "branches.view" },
      { href: "/almacenes", label: "Almacenes", icon: "fas fa-warehouse", permission: "warehouses.view" },
      { href: "/cajas", label: "Cajas", icon: "fas fa-cash-register", permission: "cash.view" },
      { href: "/terminales", label: "Terminales POS", icon: "fas fa-desktop", permission: "cash.view" },
      { href: "/usuario", label: "Usuarios", icon: "fas fa-users", permission: "users.view" },
      { href: "/roles", label: "Roles y permisos", icon: "fas fa-user-shield", permission: "roles.view", status: "upcoming" },
      { href: "/reporte", label: "Reportes", icon: "fas fa-chart-bar", permission: "reports.view" },
      { href: "/empresa", label: "Configuracion", icon: "fas fa-cog", permission: "settings.view", status: "upcoming" },
    ],
  },
];

// Rutas alternativas que no aparecen en el menu pero muestran el mismo modulo.
const routeAliases: Array<{ href: string; permission: Permission }> = [
  { href: "/productos", permission: "products.view" },
  { href: "/compras", permission: "purchases.view" },
  { href: "/ventas", permission: "sales.view" },
  { href: "/clientes", permission: "customers.view" },
  { href: "/reportes", permission: "reports.view" },
  { href: "/consulta", permission: "inventory.view" },
];

/** Permiso necesario para ver una ruta del portal, o null si la ruta no esta protegida por menu. */
export function requiredPermissionFor(pathname: string): Permission | null {
  const candidates = [...sidebarGroups.flatMap((group) => group.items), ...routeAliases];
  const match = candidates
    .filter((item) => routeIsActive(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0];
  return match?.permission ?? null;
}

function routeIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission } = useSession();
  const { sidebarCollapsed, mobileSidebarOpen, toggleSidebar, closeMobileSidebar } = useAppLayout();
  const visibleGroups = useMemo(
    () => sidebarGroups
      .map((group) => ({ ...group, items: group.items.filter((item) => hasPermission(item.permission)) }))
      .filter((group) => group.items.length),
    [hasPermission],
  );
  const activeGroup = visibleGroups.find((group) => group.items.some((item) => routeIsActive(pathname, item.href)))?.label;
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup ?? visibleGroups[0]?.label ?? null);

  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup);
    closeMobileSidebar();
  }, [activeGroup, closeMobileSidebar, pathname]);

  function toggleGroup(groupLabel: string) {
    if (sidebarCollapsed) toggleSidebar();
    setOpenGroup((current) => (current === groupLabel ? null : groupLabel));
  }

  return (
    <aside className={`sidebar-shell ${mobileSidebarOpen ? "is-mobile-open" : ""}`} aria-label="Navegacion principal">
      <div className="brand">
        <Link href="/" className="brand-home" onClick={closeMobileSidebar}>
          <Image src="/legacy/logo/logo.png" alt="" width={34} height={34} className="brand-image" priority />
          <span className="brand-text">Botica Farma</span>
        </Link>
        <button type="button" className="sidebar-collapse-button" aria-label="Colapsar menu" onClick={toggleSidebar}>
          <i className={`fas ${sidebarCollapsed ? "fa-chevron-right" : "fa-chevron-left"}`} aria-hidden="true" />
        </button>
      </div>

      <nav className="sidebar-nav">
        {hasPermission("dashboard.view") ? (
          <Link href="/" title="Dashboard" className={`sidebar-link ${pathname === "/" ? "is-active" : ""}`} onClick={closeMobileSidebar}>
            <i className="sidebar-icon fas fa-tachometer-alt" />
            <span className="sidebar-label">Dashboard</span>
          </Link>
        ) : null}

        {visibleGroups.map((group) => {
          const isActive = group.items.some((item) => routeIsActive(pathname, item.href));
          const isOpen = openGroup === group.label;
          return (
            <section className="sidebar-section" key={group.label}>
              <button type="button" title={group.label} className={`sidebar-link sidebar-toggle ${isActive ? "is-active" : ""}`} aria-expanded={isOpen} onClick={() => toggleGroup(group.label)}>
                <i className={`sidebar-icon ${group.icon}`} />
                <span className="sidebar-label">{group.label}</span>
                <i className={`sidebar-chevron fas ${isOpen ? "fa-angle-down" : "fa-angle-left"}`} />
              </button>

              {isOpen ? (
                <div className="sidebar-subnav">
                  {group.items.map((item) =>
                    item.status === "upcoming" ? (
                      <div className="sidebar-sublink is-disabled" title={`${item.label}: proximamente`} key={item.href}>
                        <i className={`sidebar-subicon ${item.icon}`} />
                        <span>{item.label}</span>
                        <small>Proximamente</small>
                      </div>
                    ) : (
                      <Link href={item.href} className={`sidebar-sublink ${routeIsActive(pathname, item.href) ? "is-active" : ""}`} key={item.href} onClick={closeMobileSidebar}>
                        <i className={`sidebar-subicon ${item.icon}`} />
                        <span>{item.label}</span>
                      </Link>
                    ),
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
