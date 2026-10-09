import type { DemoTenantFixture } from "@/features/auth/types/demo-session";

export const demoTenantFixture: DemoTenantFixture = {
  company: {
    id: "company-botica-farma",
    legalName: "Botica Farma Demo S.A.C.",
    tradeName: "Botica Farma",
    taxId: "20123456789",
    status: "active",
  },
  branches: [
    {
      id: "branch-central",
      companyId: "company-botica-farma",
      name: "Sucursal Central",
      code: "CENTRAL",
      address: "Av. Principal 120, Lima",
      status: "active",
    },
    {
      id: "branch-norte",
      companyId: "company-botica-farma",
      name: "Sucursal Norte",
      code: "NORTE",
      address: "Jr. Los Olivos 450, Lima",
      status: "active",
    },
  ],
  warehouses: [
    {
      id: "warehouse-central-main",
      companyId: "company-botica-farma",
      branchId: "branch-central",
      name: "Almacén principal",
      code: "ALM-C01",
      status: "active",
    },
    {
      id: "warehouse-norte-main",
      companyId: "company-botica-farma",
      branchId: "branch-norte",
      name: "Almacén principal",
      code: "ALM-N01",
      status: "active",
    },
  ],
  cashRegisters: [
    {
      id: "register-central-01",
      companyId: "company-botica-farma",
      branchId: "branch-central",
      name: "Caja 01",
      status: "open",
    },
    {
      id: "register-norte-01",
      companyId: "company-botica-farma",
      branchId: "branch-norte",
      name: "Caja 01",
      status: "closed",
    },
  ],
  user: {
    id: "demo-user-01",
    name: "Andrea Torres",
    email: "andrea@demo.botica",
    initials: "AT",
  },
};
