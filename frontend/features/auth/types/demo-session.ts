import type { Branch } from "@/features/branches/types/branch";
import type { CashRegister } from "@/features/cash-registers/types/cash-register";
import type { Company } from "@/features/companies/types/company";
import type { Warehouse } from "@/features/warehouses/types/warehouse";

export type DemoRole =
  | "SUPERADMIN"
  | "DUENO"
  | "ADMINISTRADOR_SUCURSAL"
  | "ALMACENERO"
  | "CAJERO";

export type Permission =
  | "dashboard.view"
  | "branches.view"
  | "warehouses.view"
  | "users.view"
  | "roles.view"
  | "catalogs.view"
  | "suppliers.view"
  | "customers.view"
  | "products.view"
  | "purchases.view"
  | "inventory.view"
  | "transfers.view"
  | "cash.view"
  | "pos.view"
  | "sales.view"
  | "sales.credit"
  | "sales.discount"
  | "sales.cancel"
  | "reports.view"
  | "settings.view"
  | "payables.view"
  | "receivables.view"
  | "finance.view"
  | "requests.view"
  | "records.create"
  | "records.update"
  | "records.delete";

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
};

export type DemoTenantFixture = {
  company: Company;
  branches: Branch[];
  warehouses: Warehouse[];
  cashRegisters: CashRegister[];
  user: DemoUser;
};
