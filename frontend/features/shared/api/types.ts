export type ApiPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, unknown> | null;
  };
  detail?: string;
};

