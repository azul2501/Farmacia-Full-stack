/** Versión del producto en la que se habilita un módulo (ver NEXT_PUBLIC_APP_VERSION). */
export type ModuleVersion = 1 | 2 | 3;

export type AppModule = {
  href: string;
  label: string;
  description: string;
  version: ModuleVersion;
};

export type Pharmacy = {
  id: string;
  name: string;
  ruc: string;
  plan: "demo" | "standard" | "premium";
  status: "active" | "suspended";
  branches: number;
};
