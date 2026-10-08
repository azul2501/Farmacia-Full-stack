import type { Permission } from "@/features/auth/types/demo-session";

export type ResourceRecord = { id: string } & Record<string, unknown>;

export type ResourceOption = { value: string; label: string };

export type ResourceField = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "select" | "checkbox" | "textarea";
  required?: boolean;
  options?: ResourceOption[];
  optionSource?: "branches" | "warehouses" | "categories" | "laboratories" | "productVariants";
};

export type ResourceColumn = {
  name: string;
  label: string;
  format?: "status" | "boolean" | "currency" | "count";
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
