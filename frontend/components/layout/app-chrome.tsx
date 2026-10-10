"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { requiredPermissionFor, Sidebar } from "@/components/sidebar";
import { useSession } from "@/features/auth/context/session-context";
import { roleLabels } from "@/features/auth/types/session";
import { useAppLayout } from "@/features/shared/context/layout-context";
import { apiRequest } from "@/features/shared/api/client";
import { apiEndpoints } from "@/features/shared/api/endpoints";

type TopbarAlerts = { lowStock: number; expiringLots: number; expiredLots: number };

type AppChromeProps = {
  children: React.ReactNode;
};

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const {
    user,
    company,
    branches,
    warehouses,
    activeBranchId,
    activeWarehouseId,
    role,
    error,
    setActiveBranch,
    setActiveWarehouse,
    permissions,
    status,
    isDemoMode,
    logout,
  } = useSession();
  const {
    sidebarCollapsed,
    mobileSidebarOpen,
    toggleSidebar,
    openMobileSidebar,
    closeMobileSidebar,
  } = useAppLayout();
  // Alertas reales del dashboard; solo roles de gestion pueden verlo (otros reciben 403 y se ocultan).
  const alertsQuery = useQuery({
    queryKey: ["dashboard", "topbar-alerts", activeBranchId],
    queryFn: () => apiRequest<TopbarAlerts>(apiEndpoints.dashboard),
    enabled: status === "authenticated" && !isDemoMode && permissions.includes("dashboard.view"),
    retry: false,
    staleTime: 60_000,
  });
  const alerts = alertsQuery.data;

  useEffect(() => {
    if (pathname !== "/login" && status === "unauthenticated") router.replace("/login");
    if (pathname === "/" && status === "authenticated" && !permissions.includes("dashboard.view")) {
      router.replace(role === "CASHIER" ? "/pos" : "/inventario");
    }
  }, [pathname, permissions, role, router, status]);

  if (pathname === "/login") return <>{children}</>;
  const requiredPermission = pathname === "/" ? null : requiredPermissionFor(pathname);
  if (status === "blocked") {
    return (
      <main className="session-loading" aria-live="polite">
        <i className="fas fa-user-lock" aria-hidden="true" />
        <strong>Acceso no disponible</strong>
        <span>{error ?? "No tienes una empresa asignada. Comunicate con el administrador de la plataforma."}</span>
        <button type="button" className="app-button primary" onClick={() => router.replace("/login")}>Ir al login</button>
      </main>
    );
  }
  if (status !== "authenticated" || !user || !company || !role) {
    return (
      <main className="session-loading" aria-live="polite">
        <i className="fas fa-circle-notch fa-spin" aria-hidden="true" />
        <span>Validando sesión...</span>
      </main>
    );
  }

  const branchWarehouses = warehouses.filter((warehouse) => warehouse.branchId === activeBranchId);
  if (!branches.length) {
    return (
      <main className="session-loading" aria-live="polite">
        <i className="fas fa-store-slash" aria-hidden="true" />
        <strong>No tienes una sucursal asignada.</strong>
        <span>Comunicate con el administrador de tu empresa.</span>
        <button type="button" className="app-button primary" onClick={() => void handleLogout()}>Cerrar sesión</button>
      </main>
    );
  }
  if (!warehouses.length) {
    return (
      <main className="session-loading" aria-live="polite">
        <i className="fas fa-warehouse" aria-hidden="true" />
        <strong>No tienes un almacén asignado.</strong>
        <span>Comunicate con el administrador de tu empresa.</span>
        <button type="button" className="app-button primary" onClick={() => void handleLogout()}>Cerrar sesión</button>
      </main>
    );
  }

  function handleNavigationToggle() {
    if (window.matchMedia("(max-width: 980px)").matches) openMobileSidebar();
    else toggleSidebar();
  }

  async function handleLogout() {
    setUserMenuOpen(false);
    await logout();
    router.push("/login");
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${mobileSidebarOpen ? "mobile-sidebar-open" : ""}`}>
      <Sidebar />
      <button type="button" className="sidebar-mobile-overlay" aria-label="Cerrar menú" onClick={closeMobileSidebar} />
      <div className="app-main">
        {isDemoMode ? (
          <div className="demo-environment-banner" role="status">
            <i className="fas fa-flask" aria-hidden="true" />
            <strong>Modo demostración</strong>
            <span>Los cambios son temporales y la persistencia se habilitará al conectar la API.</span>
          </div>
        ) : null}
        <header className="topbar">
          <div className="topbar-start">
            <button type="button" className="topbar-menu-button" aria-label="Alternar menú principal" onClick={handleNavigationToggle}>
              <i className="fas fa-bars" aria-hidden="true" />
            </button>
            <div className="topbar-company">
              <strong>{company.tradeName}</strong>
              <span>{roleLabels[role]}</span>
            </div>
            <label className="branch-selector">
              <span>Sucursal</span>
              <select value={activeBranchId} onChange={(event) => setActiveBranch(event.target.value)}>
                {branches.map((branch) => (
                  <option value={branch.id} key={branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="topbar-actions">
            {alerts ? (
              <>
                <button type="button" className="topbar-icon-button" title={`${alerts.lowStock} producto(s) en stock mínimo`} aria-label="Stock mínimo" onClick={() => router.push("/inventario")}>
                  <i className="fa fa-cubes" /> {alerts.lowStock > 0 ? <span>{alerts.lowStock}</span> : null}
                </button>
                <button type="button" className="topbar-icon-button" title={`${alerts.expiringLots} lote(s) por vencer en 30 días, ${alerts.expiredLots} vencido(s)`} aria-label="Lotes por vencer" onClick={() => router.push("/inventario")}>
                  <i className="fa fa-calendar-alt" /> {alerts.expiringLots + alerts.expiredLots > 0 ? <span>{alerts.expiringLots + alerts.expiredLots}</span> : null}
                </button>
              </>
            ) : null}
            <div className="user-menu-shell">
              <button type="button" className="user-menu-trigger" aria-expanded={userMenuOpen} onClick={() => setUserMenuOpen((current) => !current)}>
                <span className="user-avatar">{user.initials}</span>
                <span className="user-trigger-copy"><strong>{user.name}</strong><small>{roleLabels[role]}</small></span>
                <i className="fas fa-chevron-down" aria-hidden="true" />
              </button>
              {userMenuOpen ? (
                <div className="user-menu" role="menu">
                  <div className="user-menu-header"><strong>{user.name}</strong><span>{user.email}</span></div>
                  <div className="user-menu-role"><span>Rol</span><strong>{roleLabels[role]}</strong></div>
                  <label>
                    <span>Almacén activo</span>
                    <select value={activeWarehouseId} onChange={(event) => setActiveWarehouse(event.target.value)}>
                      {branchWarehouses.map((warehouse) => (
                        <option value={warehouse.id} key={warehouse.id}>{warehouse.name}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="user-menu-logout" onClick={() => void handleLogout()}>
                    <i className="fas fa-sign-out-alt" aria-hidden="true" /> Cerrar sesión
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="app-content">
          {status === "authenticated" && requiredPermission && !permissions.includes(requiredPermission) ? (
            <div className="content-state empty-content-state" role="alert">
              <i className="fas fa-lock" aria-hidden="true" />
              <strong>No tienes acceso a esta sección</strong>
              <p>Tu rol ({roleLabels[role]}) no incluye este módulo. Pide acceso al dueño o administrador.</p>
            </div>
          ) : children}
        </main>
        <footer className="app-footer">
          <span>{isDemoMode ? "Modo demostración - datos simulados" : company.tradeName}</span>
          <span>Copyright {new Date().getFullYear()}. Todos los derechos reservados.</span>
        </footer>
      </div>
    </div>
  );
}
