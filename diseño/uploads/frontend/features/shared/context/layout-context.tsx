"use client";

import { createContext, useContext, useMemo, useState } from "react";

type LayoutContextValue = {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  toggleSidebar: () => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
};

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const value = useMemo<LayoutContextValue>(
    () => ({
      sidebarCollapsed,
      mobileSidebarOpen,
      toggleSidebar: () => setSidebarCollapsed((current) => !current),
      openMobileSidebar: () => setMobileSidebarOpen(true),
      closeMobileSidebar: () => setMobileSidebarOpen(false),
    }),
    [mobileSidebarOpen, sidebarCollapsed],
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useAppLayout() {
  const context = useContext(LayoutContext);
  if (!context) throw new Error("useAppLayout debe usarse dentro de LayoutProvider");
  return context;
}
