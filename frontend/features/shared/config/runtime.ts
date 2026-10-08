export type DataSourceMode = "mock" | "api";

function resolveDataSource(value: string | undefined): DataSourceMode {
  return value === "api" ? "api" : "mock";
}

export const runtimeConfig = {
  dataSource: resolveDataSource(process.env.NEXT_PUBLIC_DATA_SOURCE),
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  apiTimeoutMs: Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? 15000),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Botica Farma",
  showDemoCredentials:
    process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === "true" && process.env.NODE_ENV !== "production",
} as const;

export const isDemoMode = runtimeConfig.dataSource === "mock";
