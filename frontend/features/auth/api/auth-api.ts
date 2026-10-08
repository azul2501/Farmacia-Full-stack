import { apiEndpoints } from "@/features/shared/api/endpoints";
import {
  apiRequest,
  clearApiSession,
  setApiAccessToken,
} from "@/features/shared/api/client";
import type { ApiPage } from "@/features/shared/api/types";
import type { AppRole } from "@/features/auth/types/session";
import type { Permission } from "@/features/auth/types/demo-session";

export type ApiCompany = {
  id: string;
  legal_name: string;
  trade_name: string;
  tax_id: string;
  timezone: string;
  currency: string;
  is_active: boolean;
};

export type ApiBranch = {
  id: string;
  code: string;
  name: string;
  address: string;
  is_active: boolean;
};

export type ApiWarehouse = {
  id: string;
  branch: string;
  branch_name: string;
  code: string;
  name: string;
  is_active: boolean;
};

export type ApiCashRegister = {
  id: string;
  branch: string;
  branch_name: string;
  code: string;
  name: string;
  is_active: boolean;
};

export type ApiSessionContext = {
  user: {
    id: string;
    email: string;
    full_name: string;
    phone: string;
    is_active: boolean;
  };
  active_company: ApiCompany;
  membership: {
    id: string;
    role: AppRole;
    is_active: boolean;
  };
  available_branches: ApiBranch[];
  permissions: Permission[];
};

export async function loginWithPassword(email: string, password: string) {
  const response = await apiRequest<{ access: string }>(apiEndpoints.auth.login, {
    method: "POST",
    body: { email, password },
    authenticated: false,
    retryAfterRefresh: false,
  });
  setApiAccessToken(response.access);
}

export async function restoreAccessToken() {
  const response = await apiRequest<{ access: string }>(apiEndpoints.auth.refresh, {
    method: "POST",
    authenticated: false,
    retryAfterRefresh: false,
  });
  setApiAccessToken(response.access);
}

export function getSessionContext() {
  return apiRequest<ApiSessionContext>(apiEndpoints.auth.context);
}

export function getSessionWarehouses() {
  return apiRequest<ApiPage<ApiWarehouse>>(apiEndpoints.warehouses, { query: { pageSize: 100 } });
}

export function getSessionCashRegisters() {
  return apiRequest<ApiPage<ApiCashRegister>>(apiEndpoints.cashRegisters, { query: { pageSize: 100 } });
}

export async function logoutFromApi() {
  try {
    await apiRequest<void>(apiEndpoints.auth.logout, {
      method: "POST",
      authenticated: false,
      retryAfterRefresh: false,
    });
  } finally {
    clearApiSession();
  }
}
