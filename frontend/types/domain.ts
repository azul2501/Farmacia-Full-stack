export type ModuleStatus = "legacy" | "api-ready" | "next-ready";

export type AppModule = {
  href: string;
  label: string;
  description: string;
  status: ModuleStatus;
};

export type Pharmacy = {
  id: string;
  name: string;
  ruc: string;
  plan: "demo" | "standard" | "premium";
  status: "active" | "suspended";
  branches: number;
};
