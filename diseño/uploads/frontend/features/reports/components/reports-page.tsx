"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/features/auth/context/session-context";
import { apiRequest } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import { ErrorState, LoadingState } from "@/features/shared/ui/states/async-state";

type SalesReport = {
  total: string;
  count: number;
  byDay: { day: string; total: string; count: number }[];
};

function money(value: string | number) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const defaultFilters = { branch: "", dateFrom: daysAgoIso(30), dateTo: todayIso() };

export function ReportsPage() {
  const { branches } = useSession();
  const [filters, setFilters] = useState(defaultFilters);
  const hasCustomFilters = filters.branch !== "" || filters.dateFrom !== defaultFilters.dateFrom || filters.dateTo !== defaultFilters.dateTo;

  const reportQuery = useQuery({
    queryKey: ["reports", "sales", filters],
    queryFn: () =>
      apiRequest<SalesReport>(apiEndpoints.salesReport, {
        query: {
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          branch: filters.branch || undefined,
        },
      }),
  });

  const branchName = useMemo(() => branches.find((branch) => branch.id === filters.branch)?.name ?? "Todas las sucursales", [branches, filters.branch]);

  function exportCsv() {
    if (!reportQuery.data) return;
    const rows: string[][] = [
      ["Reporte de ventas"],
      ["Sucursal", branchName],
      ["Desde", filters.dateFrom || "-"],
      ["Hasta", filters.dateTo || "-"],
      [],
      ["Fecha", "Ventas", "Total"],
      ...reportQuery.data.byDay.map((row) => [row.day, String(row.count), row.total]),
      [],
      ["Total del periodo", String(reportQuery.data.count), reportQuery.data.total],
    ];
    downloadCsv(`reporte-ventas_${filters.dateFrom}_${filters.dateTo}.csv`, rows);
  }

  return (
    <>
      <PageHeader title="Reportes de ventas" section="Reportes" current="Ventas" />
      <section className="content-panel">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void reportQuery.refetch();
          }}
        >
          <label>
            <span>Sucursal</span>
            <select value={filters.branch} onChange={(event) => setFilters((current) => ({ ...current, branch: event.target.value }))}>
              <option value="">Todas</option>
              {branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label>
            <span>Desde</span>
            <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
          </label>
          <div className="form-actions">
            <button type="submit" className="app-button primary">
              <i className="fas fa-filter" /> Filtrar
            </button>
            {hasCustomFilters ? (
              <button type="button" className="ghost-button" onClick={() => setFilters(defaultFilters)}>
                Limpiar filtros
              </button>
            ) : null}
            <button type="button" className="app-button" disabled={!reportQuery.data || reportQuery.isLoading} onClick={exportCsv}>
              <i className="fas fa-file-csv" /> Exportar CSV
            </button>
          </div>
        </form>

        {reportQuery.isLoading ? <LoadingState rows={6} /> : null}
        {reportQuery.error ? <ErrorState message={apiErrorMessage(reportQuery.error, "No se pudo cargar el reporte.")} onRetry={() => void reportQuery.refetch()} /> : null}

        {reportQuery.data ? (
          <>
            <dl className="sale-detail-totals">
              <div><dt>Sucursal</dt><dd>{branchName}</dd></div>
              <div><dt>Ventas en el periodo</dt><dd>{reportQuery.data.count}</dd></div>
              <div className="total"><dt>Total</dt><dd>{money(reportQuery.data.total)}</dd></div>
            </dl>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Fecha</th><th>Ventas</th><th>Total</th></tr></thead>
                <tbody>
                  {reportQuery.data.byDay.length ? (
                    reportQuery.data.byDay.map((row) => (
                      <tr key={row.day}>
                        <td>{row.day}</td>
                        <td>{row.count}</td>
                        <td>{money(row.total)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={3}>No hay ventas completadas en el periodo seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}
