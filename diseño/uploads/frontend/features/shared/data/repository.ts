import type {
  ListQuery,
  MutationResult,
  PaginatedResult,
  RepositoryContext,
} from "@/features/shared/types/data";

export interface CrudRepository<TEntity, TCreate, TUpdate> {
  list(query: ListQuery, context: RepositoryContext): Promise<PaginatedResult<TEntity>>;
  getById(id: string, context: RepositoryContext): Promise<TEntity | null>;
  create(input: TCreate, context: RepositoryContext): Promise<MutationResult<TEntity>>;
  update(id: string, input: TUpdate, context: RepositoryContext): Promise<MutationResult<TEntity>>;
  remove(id: string, context: RepositoryContext): Promise<MutationResult<{ id: string }>>;
}

export type RepositoryPair<TRepository> = {
  mock: TRepository;
  api: TRepository;
};
