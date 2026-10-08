"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { demoTenantFixture } from "@/features/auth/mocks/demo-tenant";
import type { DemoRole, Permission } from "@/features/auth/types/demo-session";
import { permissionsByRole } from "@/features/auth/utils/demo-permissions";

type DemoSessionContextValue = {
  user: typeof demoTenantFixture.user;
  company: typeof demoTenantFixture.company;
  branches: typeof demoTenantFixture.branches;
  warehouses: typeof demoTenantFixture.warehouses;
  cashRegisters: typeof demoTenantFixture.cashRegisters;
  activeBranchId: string;
  activeWarehouseId: string;
  role: DemoRole;
  isDemoSignedIn: boolean;
  setActiveBranch: (branchId: string) => void;
  setActiveWarehouse: (warehouseId: string) => void;
  setRole: (role: DemoRole) => void;
  hasPermission: (permission: Permission) => boolean;
  startDemoSession: () => void;
  endDemoSession: () => void;
};

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeBranchId, setActiveBranchId] = useState(demoTenantFixture.branches[0].id);
  const [activeWarehouseId, setActiveWarehouseId] = useState(demoTenantFixture.warehouses[0].id);
  const [role, setRole] = useState<DemoRole>("DUENO");
  const [isDemoSignedIn, setIsDemoSignedIn] = useState(true);

  function setActiveBranch(branchId: string) {
    const firstWarehouse = demoTenantFixture.warehouses.find(
      (warehouse) => warehouse.branchId === branchId,
    );
    setActiveBranchId(branchId);
    if (firstWarehouse) setActiveWarehouseId(firstWarehouse.id);
  }

  const value = useMemo<DemoSessionContextValue>(
    () => ({
      ...demoTenantFixture,
      activeBranchId,
      activeWarehouseId,
      role,
      isDemoSignedIn,
      setActiveBranch,
      setActiveWarehouse: setActiveWarehouseId,
      setRole,
      hasPermission: (permission) => permissionsByRole[role].includes(permission),
      startDemoSession: () => setIsDemoSignedIn(true),
      endDemoSession: () => setIsDemoSignedIn(false),
    }),
    [activeBranchId, activeWarehouseId, isDemoSignedIn, role],
  );

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession() {
  const context = useContext(DemoSessionContext);
  if (!context) throw new Error("useDemoSession debe usarse dentro de DemoSessionProvider");
  return context;
}
