import { runtimeConfig } from "@/features/shared/config/runtime";
import type { RepositoryPair } from "@/features/shared/data/repository";

export function selectRepository<TRepository>(repositories: RepositoryPair<TRepository>): TRepository {
  return repositories[runtimeConfig.dataSource];
}
