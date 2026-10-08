import { httpClient } from "@/features/shared/http/http-client";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, body, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return httpClient.request<T>(path, {
    ...requestOptions,
    headers,
    body,
  });
}
