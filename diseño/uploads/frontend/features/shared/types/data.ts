export type SortDirection = "asc" | "desc";

export type ListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDirection?: SortDirection;
  filters?: Record<string, string | number | boolean | undefined>;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type RepositoryContext = {
  companyId: string;
  branchId: string;
  userId: string;
};

export type MutationResult<T> = {
  data: T;
  persisted: boolean;
  message: string;
};

export type LoadableState<T> =
  | { status: "idle"; data?: undefined; error?: undefined }
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "success"; data: T; error?: undefined }
  | { status: "error"; data?: undefined; error: string };
