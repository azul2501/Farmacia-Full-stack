"use client";

import { useEffect, useMemo, useState } from "react";
import type { SortDirection } from "@/features/shared/types/data";
import { EmptyState, ErrorState, LoadingState } from "@/features/shared/ui/states/async-state";

type CellValue = string | number | boolean | null | undefined;

export type DataTableColumn<T> = {
  id: string;
  header: string;
  value?: (row: T) => CellValue;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
};

type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  toolbarActions?: React.ReactNode;
  filters?: React.ReactNode;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  caption?: string;
};

function compareValues(left: CellValue, right: CellValue) {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left ?? "").localeCompare(String(right ?? ""), "es", {
    numeric: true,
    sensitivity: "base",
  });
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchText,
  searchPlaceholder = "Buscar en los resultados",
  toolbarActions,
  filters,
  loading = false,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  initialPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  caption,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sort, setSort] = useState<{ columnId: string; direction: SortDirection } | null>(null);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    const searched = normalizedQuery
      ? rows.filter((row) => {
          const content = searchText
            ? searchText(row)
            : columns.map((column) => column.value?.(row) ?? "").join(" ");
          return content.toLocaleLowerCase("es").includes(normalizedQuery);
        })
      : rows;

    if (!sort) return searched;
    const column = columns.find((item) => item.id === sort.columnId);
    if (!column?.value) return searched;

    return [...searched].sort((left, right) => {
      const result = compareValues(column.value?.(left), column.value?.(right));
      return sort.direction === "asc" ? result : -result;
    });
  }, [columns, query, rows, searchText, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const firstResult = filteredRows.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastResult = Math.min(safePage * pageSize, filteredRows.length);

  useEffect(() => setPage(1), [pageSize, query]);

  function toggleSort(column: DataTableColumn<T>) {
    if (!column.sortable || !column.value) return;
    setSort((current) =>
      current?.columnId === column.id
        ? { columnId: column.id, direction: current.direction === "asc" ? "desc" : "asc" }
        : { columnId: column.id, direction: "asc" },
    );
  }

  return (
    <div className="data-table-shell">
      <div className="data-table-toolbar">
        <label className="table-search-field">
          <i className="fas fa-search" aria-hidden="true" />
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button type="button" aria-label="Limpiar busqueda" onClick={() => setQuery("")}>
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          ) : null}
        </label>
        {filters ? <div className="table-filters">{filters}</div> : null}
        {toolbarActions ? <div className="table-toolbar-actions">{toolbarActions}</div> : null}
      </div>

      {loading ? (
        <LoadingState rows={pageSize > 10 ? 10 : pageSize} />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !filteredRows.length ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead>
              <tr>
                {columns.map((column) => {
                  const activeSort = sort?.columnId === column.id ? sort.direction : null;
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      style={{ width: column.width, textAlign: column.align }}
                      aria-sort={activeSort === "asc" ? "ascending" : activeSort === "desc" ? "descending" : undefined}
                    >
                      {column.sortable ? (
                        <button type="button" className="table-sort-button" onClick={() => toggleSort(column)}>
                          {column.header}
                          <i
                            className={`fas ${activeSort === "asc" ? "fa-sort-up" : activeSort === "desc" ? "fa-sort-down" : "fa-sort"}`}
                            aria-hidden="true"
                          />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td key={column.id} data-label={column.header} style={{ textAlign: column.align }}>
                      {column.render ? column.render(row) : String(column.value?.(row) ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && filteredRows.length ? (
        <div className="data-table-footer">
          <span>
            Mostrando {firstResult}-{lastResult} de {filteredRows.length}
          </span>
          <label>
            <span>Filas</span>
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              {pageSizeOptions.map((option) => (
                <option value={option} key={option}>{option}</option>
              ))}
            </select>
          </label>
          <div className="table-pagination" aria-label="Paginacion">
            <button type="button" aria-label="Pagina anterior" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
              <i className="fas fa-chevron-left" aria-hidden="true" />
            </button>
            <span>Pagina {safePage} de {pageCount}</span>
            <button type="button" aria-label="Pagina siguiente" disabled={safePage === pageCount} onClick={() => setPage(safePage + 1)}>
              <i className="fas fa-chevron-right" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
