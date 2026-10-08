import { apiRequest, ApiError } from "@/features/shared/api/client";

export type HttpRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
};

export class HttpError extends ApiError {}

export interface HttpClient {
  request<T>(path: string, options?: HttpRequestOptions): Promise<T>;
}

export class FetchHttpClient implements HttpClient {
  async request<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    return apiRequest<T>(path, options);
  }
}

export const httpClient: HttpClient = new FetchHttpClient();
