import type { Branch } from "@/features/branches/types/branch";
import type { CashRegister } from "@/features/cash-registers/types/cash-register";
import type { Company } from "@/features/companies/types/company";
import type { Warehouse } from "@/features/warehouses/types/warehouse";
import type { Permission } from "@/features/auth/types/demo-session";

export type AppRole = "SUPERADMIN" | "OWNER" | "BRANCH_ADMIN" | "WAREHOUSE_OPERATOR" | "CASHIER";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
};

export type SessionStatus = "loading" | "authenticated" | "unauthenticated" | "blocked";

export type SessionState = {
  status: SessionStatus;
  user: SessionUser | null;
  company: Company | null;
  companies: Company[];
  branches: Branch[];
  warehouses: Warehouse[];
  cashRegisters: CashRegister[];
  activeBranchId: string;
  activeWarehouseId: string;
  role: AppRole | null;
  permissions: Permission[];
  error?: string;
};

export const roleLabels: Record<AppRole, string> = {
  SUPERADMIN: "Superadministrador",
  OWNER: "Dueño",
  BRANCH_ADMIN: "Administrador de sucursal",
  WAREHOUSE_OPERATOR: "Almacenero",
  CASHIER: "Cajero",
};
