import type { DemoRole, Permission } from "@/features/auth/types/demo-session";

const ownerPermissions: Permission[] = [
  "dashboard.view",
  "branches.view",
  "warehouses.view",
  "users.view",
  "roles.view",
  "catalogs.view",
  "suppliers.view",
  "customers.view",
  "products.view",
  "purchases.view",
  "inventory.view",
  "transfers.view",
  "cash.view",
  "pos.view",
  "sales.view",
  "sales.credit",
  "sales.discount",
  "reports.view",
  "settings.view",
  "payables.view",
  "receivables.view",
  "finance.view",
  "requests.view",
  "records.create",
  "records.update",
  "records.delete",
];

export const permissionsByRole: Record<DemoRole, Permission[]> = {
  SUPERADMIN: ownerPermissions,
  DUENO: ownerPermissions,
  ADMINISTRADOR_SUCURSAL: ownerPermissions.filter(
    (permission) => permission !== "roles.view",
  ),
  ALMACENERO: [
    "dashboard.view",
    "catalogs.view",
    "suppliers.view",
    "products.view",
    "purchases.view",
    "inventory.view",
    "transfers.view",
    "records.create",
    "records.update",
  ],
  CAJERO: [
    "dashboard.view",
    "customers.view",
    "cash.view",
    "pos.view",
    "sales.view",
    "receivables.view",
    "requests.view",
    "records.create",
  ],
};

export const roleLabels: Record<DemoRole, string> = {
  SUPERADMIN: "Superadministrador",
  DUENO: "Dueño",
  ADMINISTRADOR_SUCURSAL: "Administrador de sucursal",
  ALMACENERO: "Almacenero",
  CAJERO: "Cajero",
};
