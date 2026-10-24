import { runtimeConfig } from "@/features/shared/config/runtime";

/** Versión mínima de cada función opcional. Mismo mapa que FEATURE_VERSIONS del backend. */
const featureVersions = {
  credit_sales: 2,
  finance: 2,
  multi_branch: 3,
  transfers: 3,
  customer_requests: 3,
} as const;

export type Feature = keyof typeof featureVersions;

export function isFeatureEnabled(feature: Feature) {
  return featureVersions[feature] <= runtimeConfig.appVersion;
}
