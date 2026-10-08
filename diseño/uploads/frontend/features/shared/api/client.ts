import { runtimeConfig } from "@/features/shared/config/runtime";
import type { ApiErrorPayload } from "@/features/shared/api/types";
import { apiEndpoints } from "@/features/shared/api/endpoints";

type QueryValue = string | number | boolean | undefined;
const API_PREFIX = "api/v1";

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, QueryValue>;
  authenticated?: boolean;
  retryAfterRefresh?: boolean;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "request_error",
    public readonly fields: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let accessToken: string | null = null;
let refreshRequest: Promise<string> | null = null;

export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

function normalizedApiBaseUrl() {
  if (!runtimeConfig.apiBaseUrl) {
    throw new ApiError("NEXT_PUBLIC_API_BASE_URL no esta configurado.", 0, "configuration_error");
  }
  const url = new URL(runtimeConfig.apiBaseUrl);
  const basePath = url.pathname.replace(/\/+$/, "");
  if (basePath.endsWith("/api/v1")) {
    url.pathname = `${basePath}/`;
  } else if (basePath.endsWith("/api")) {
    url.pathname = `${basePath}/v1/`;
  } else {
    url.pathname = `${basePath}/${API_PREFIX}/`;
  }
  return url;
}

function normalizedApiPath(path: string) {
  const cleanPath = path.replace(/^\/+/, "");
  if (cleanPath === API_PREFIX) return "";
  if (cleanPath.startsWith(`${API_PREFIX}/`)) return cleanPath.slice(API_PREFIX.length + 1);
  return cleanPath;
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(normalizedApiPath(path), normalizedApiBaseUrl());
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, String(value));
  });
  return url;
}

async function parseError(response: Response) {
  let payload: ApiErrorPayload = {};
  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    // An HTML proxy error or an empty response still needs a useful status message.
  }
  const fields = payload.error?.fields ?? null;
  const fieldMessage = fields
    ? Object.values(fields).flat().filter(Boolean).map(String)[0]
    : null;
  return new ApiError(
    fieldMessage ?? payload.error?.message ?? payload.detail ?? `La API respondio con estado ${response.status}.`,
    response.status,
    payload.error?.code,
    fields,
  );
}

async function refreshAccessToken() {
  if (!refreshRequest) {
    refreshRequest = apiRequest<{ access: string }>(apiEndpoints.auth.refresh, {
      method: "POST",
      authenticated: false,
      retryAfterRefresh: false,
    })
      .then(({ access }) => {
        setApiAccessToken(access);
        return access;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (runtimeConfig.dataSource === "mock") {
    throw new ApiError(
      "Esta pantalla necesita datos reales. Estas en modo de demostracion visual (NEXT_PUBLIC_DATA_SOURCE=mock); cambia a modo API o conectate al backend para usarla.",
      0,
      "mock_mode_blocked",
    );
  }
  const {
    body,
    query,
    authenticated = true,
    retryAfterRefresh = true,
    signal,
    ...requestOptions
  } = options;
  const headers = new Headers(requestOptions.headers);
  headers.set("Accept", "application/json");
  if (body !== undefined && !(body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (authenticated && accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const timeoutController = new AbortController();
  const timeout = window.setTimeout(() => timeoutController.abort(), runtimeConfig.apiTimeoutMs);
  const abort = () => timeoutController.abort();
  signal?.addEventListener("abort", abort, { once: true });

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...requestOptions,
      headers,
      body:
        body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
      signal: timeoutController.signal,
    });
  } catch (error) {
    const timedOut = timeoutController.signal.aborted && !signal?.aborted;
    throw new ApiError(
      timedOut ? "La API tardo demasiado en responder." : "No se pudo conectar con la API.",
      0,
      timedOut ? "timeout" : "network_error",
    );
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }

  if (response.status === 401 && authenticated && retryAfterRefresh) {
    await refreshAccessToken();
    return apiRequest<T>(path, { ...options, retryAfterRefresh: false });
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiDownload(path: string, options: ApiRequestOptions = {}): Promise<Blob> {
  if (runtimeConfig.dataSource === "mock") {
    throw new ApiError(
      "Esta descarga necesita datos reales. Estas en modo de demostracion visual (NEXT_PUBLIC_DATA_SOURCE=mock); cambia a modo API o conectate al backend para usarla.",
      0,
      "mock_mode_blocked",
    );
  }
  const {
    body: _body,
    query,
    authenticated = true,
    signal,
    ...requestOptions
  } = options;
  const headers = new Headers(requestOptions.headers);
  if (authenticated && accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(buildUrl(path, query), {
    ...requestOptions,
    headers,
    credentials: "include",
    signal,
  });
  if (!response.ok) throw await parseError(response);
  return response.blob();
}

export function clearApiSession() {
  accessToken = null;
}
