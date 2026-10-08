"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useSession } from "@/features/auth/context/session-context";
import { roleLabels } from "@/features/auth/types/session";
import { useAppLayout } from "@/features/shared/context/layout-context";
import { useToast } from "@/features/shared/ui/toast/toast-provider";

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
  const { showToast } = useToast();

  useEffect(() => {
    if (pathname !== "/login" && status === "unauthenticated") router.replace("/login");
    if (pathname === "/" && status === "authenticated" && !permissions.includes("dashboard.view")) {
      router.replace(role === "CASHIER" ? "/pos" : "/inventario");
    }
  }, [pathname, permissions, role, router, status]);

  if (pathname === "/login") return <>{children}</>;
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
        <span>Validando sesion...</span>
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
        <button type="button" className="app-button primary" onClick={() => void handleLogout()}>Cerrar sesion</button>
      </main>
    );
  }
  if (!warehouses.length) {
    return (
      <main className="session-loading" aria-live="polite">
        <i className="fas fa-warehouse" aria-hidden="true" />
        <strong>No tienes un almacen asignado.</strong>
        <span>Comunicate con el administrador de tu empresa.</span>
        <button type="button" className="app-button primary" onClick={() => void handleLogout()}>Cerrar sesion</button>
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
      <button type="button" className="sidebar-mobile-overlay" aria-label="Cerrar menu" onClick={closeMobileSidebar} />
      <div className="app-main">
        {isDemoMode ? (
          <div className="demo-environment-banner" role="status">
            <i className="fas fa-flask" aria-hidden="true" />
            <strong>Modo demostracion</strong>
            <span>Los cambios son temporales y la persistencia se habilitara al conectar la API.</span>
          </div>
        ) : null}
        <header className="topbar">
          <div className="topbar-start">
            <button type="button" className="topbar-menu-button" aria-label="Alternar menu principal" onClick={handleNavigationToggle}>
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
            <button type="button" className="topbar-icon-button" title="Stock minimo" onClick={() => showToast({ title: "Datos de demostracion", description: "Hay 3 productos con stock bajo.", tone: "warning" })}>
              <i className="fa fa-cubes" /> <span>3</span>
            </button>
            <button type="button" className="topbar-icon-button" title="Proximo a vencer" onClick={() => showToast({ title: "Datos de demostracion", description: "Hay 2 lotes proximos a vencer.", tone: "info" })}>
              <i className="fa fa-calendar-alt" /> <span>2</span>
            </button>
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
                    <span>Almacen activo</span>
                    <select value={activeWarehouseId} onChange={(event) => setActiveWarehouse(event.target.value)}>
                      {branchWarehouses.map((warehouse) => (
                        <option value={warehouse.id} key={warehouse.id}>{warehouse.name}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="user-menu-logout" onClick={() => void handleLogout()}>
                    <i className="fas fa-sign-out-alt" aria-hidden="true" /> Cerrar sesion
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="app-content">{children}</main>
        <footer className="app-footer">
          <span>{isDemoMode ? "Frontend Next - Datos simulados" : "Botica Farma - API conectada"}</span>
          <span>Copyright {new Date().getFullYear()}. Todos los derechos reservados.</span>
        </footer>
      </div>
    </div>
  );
}
