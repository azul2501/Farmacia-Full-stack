import type { Permission } from "@/features/auth/types/demo-session";

export type ResourceRecord = { id: string } & Record<string, unknown>;

export type ResourceOption = { value: string; label: string };

export type ResourceField = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "password" | "select" | "multiselect" | "checkbox" | "textarea";
  required?: boolean;
  /** Solo se muestra y envia al crear (p. ej. correo y clave inicial de un usuario). */
  createOnly?: boolean;
  hint?: string;
  options?: ResourceOption[];
  optionSource?: "branches" | "warehouses" | "categories" | "laboratories" | "productVariants";
};

export type ResourceColumn = {
  name: string;
  label: string;
  format?: "status" | "boolean" | "currency" | "count";
  labels?: Record<string, string>;
};

export type ResourceConfig = {
  endpoint: string;
  title: string;
  singular: string;
  description: string;
  permission: Permission;
  columns: ResourceColumn[];
  fields: ResourceField[];
  searchPlaceholder?: string;
  readOnly?: boolean;
  deactivateOnly?: boolean;
};
