"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getSessionCashRegisters,
  getSessionContext,
  getSessionWarehouses,
  loginWithPassword,
  logoutFromApi,
  restoreAccessToken,
  type ApiBranch,
  type ApiCompany,
} from "@/features/auth/api/auth-api";
import { demoTenantFixture } from "@/features/auth/mocks/demo-tenant";
import type { Permission } from "@/features/auth/types/demo-session";
import type { AppRole, SessionState } from "@/features/auth/types/session";
import { permissionsByRole } from "@/features/auth/utils/demo-permissions";
import { isDemoMode } from "@/features/shared/config/runtime";
import { useQueryClient } from "@tanstack/react-query";

type LoginInput = { email: string; password: string };

type SessionContextValue = SessionState & {
  isDemoMode: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<AppRole>;
  logout: () => Promise<void>;
  setActiveBranch: (branchId: string) => void;
  setActiveWarehouse: (warehouseId: string) => void;
  hasPermission: (permission: Permission) => boolean;
};

const emptySession: SessionState = {
  status: "loading",
  user: null,
  company: null,
  companies: [],
  branches: [],
  warehouses: [],
  cashRegisters: [],
  activeBranchId: "",
  activeWarehouseId: "",
  role: null,
  permissions: [],
  error: undefined,
};

function sessionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No fue posible validar tu sesion.";
}

function isBlockingSessionError(message: string) {
  return [
    "empresa",
    "suspendida",
    "No se pudo conectar",
    "tardo demasiado",
    "NEXT_PUBLIC_API_BASE_URL",
  ].some((text) => message.includes(text));
}

const SessionContext = createContext<SessionContextValue | null>(null);

function mapCompany(company: ApiCompany) {
  return {
    id: company.id,
    legalName: company.legal_name,
    tradeName: company.trade_name,
    taxId: company.tax_id,
    status: company.is_active ? ("active" as const) : ("inactive" as const),
  };
}

function mapBranch(branch: ApiBranch, companyId: string) {
  return {
    id: branch.id,
    companyId,
    name: branch.name,
    code: branch.code,
    address: branch.address,
    status: branch.is_active ? ("active" as const) : ("inactive" as const),
  };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function createDemoState(): SessionState {
  return {
    status: "authenticated",
    user: demoTenantFixture.user,
    company: demoTenantFixture.company,
    companies: [demoTenantFixture.company],
    branches: demoTenantFixture.branches,
    warehouses: demoTenantFixture.warehouses,
    cashRegisters: demoTenantFixture.cashRegisters,
    activeBranchId: demoTenantFixture.branches[0].id,
    activeWarehouseId: demoTenantFixture.warehouses[0].id,
    role: "OWNER",
    permissions: permissionsByRole.DUENO,
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<SessionState>(() => (isDemoMode ? createDemoState() : emptySession));

  const loadApiSession = useCallback(async () => {
    const [context, warehousesResponse, registersResponse] = await Promise.all([
      getSessionContext(),
      getSessionWarehouses(),
      getSessionCashRegisters(),
    ]);
    const companyId = context.active_company.id;
    const branches = context.available_branches.map((branch) => mapBranch(branch, companyId));
    const storedBranchId = window.sessionStorage.getItem("activeBranchId");
    const activeBranchId = branches.some((branch) => branch.id === storedBranchId)
      ? storedBranchId ?? ""
      : branches[0]?.id ?? "";
    const warehouses = warehousesResponse.items.map((warehouse) => ({
      id: warehouse.id,
      companyId,
      branchId: warehouse.branch,
      name: warehouse.name,
      code: warehouse.code,
      status: warehouse.is_active ? ("active" as const) : ("inactive" as const),
    }));
    const activeWarehouseId =
      warehouses.find((warehouse) => warehouse.branchId === activeBranchId)?.id ?? "";
    window.sessionStorage.setItem("activeBranchId", activeBranchId);

    setSession({
      status: "authenticated",
      user: {
        id: context.user.id,
        name: context.user.full_name,
        email: context.user.email,
        initials: initials(context.user.full_name),
      },
      company: mapCompany(context.active_company),
      companies: [mapCompany(context.active_company)],
      branches,
      warehouses,
      cashRegisters: registersResponse.items.map((register) => ({
        id: register.id,
        companyId,
        branchId: register.branch,
        name: register.name,
        status: "closed" as const,
      })),
      activeBranchId,
      activeWarehouseId,
      role: context.membership.role,
      permissions: context.permissions,
    });
    return context.membership.role;
  }, []);

  useEffect(() => {
    if (isDemoMode) return;
    restoreAccessToken()
      .then(() => loadApiSession())
      .catch((error) => {
        const message = sessionErrorMessage(error);
        if (isBlockingSessionError(message)) {
          setSession({ ...emptySession, status: "blocked", error: message });
          return;
        }
        setSession({ ...emptySession, status: "unauthenticated" });
      });
  }, [loadApiSession]);

  async function login(input: LoginInput) {
    if (isDemoMode) {
      setSession(createDemoState());
      return "OWNER" as const;
    }
    setSession((current) => ({ ...current, status: "loading" }));
    try {
      await loginWithPassword(input.email, input.password);
      return await loadApiSession();
    } catch (error) {
      setSession({ ...emptySession, status: "unauthenticated" });
      throw error;
    }
  }

  async function logout() {
    if (!isDemoMode) await logoutFromApi();
    window.sessionStorage.removeItem("activeBranchId");
    queryClient.clear();
    setSession({ ...emptySession, status: "unauthenticated" });
  }

  function setActiveBranch(branchId: string) {
    window.sessionStorage.setItem("activeBranchId", branchId);
    setSession((current) => ({
      ...current,
      activeBranchId: branchId,
      activeWarehouseId:
        current.warehouses.find((warehouse) => warehouse.branchId === branchId)?.id ?? "",
    }));
  }

  const value = useMemo<SessionContextValue>(
    () => ({
      ...session,
      isDemoMode,
      isAuthenticated: session.status === "authenticated",
      login,
      logout,
      setActiveBranch,
      setActiveWarehouse: (warehouseId) =>
        setSession((current) => ({ ...current, activeWarehouseId: warehouseId })),
      hasPermission: (permission) => session.permissions.includes(permission),
    }),
    [session],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession debe usarse dentro de SessionProvider");
  return context;
}
