"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/features/auth/context/session-context";
import { apiRequest, apiRequestAll } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ApiPage } from "@/features/shared/api/types";
import { DataTable, type DataTableColumn } from "@/features/shared/ui/data-table/data-table";

type StockRow = {
  id: string;
  warehouse: string;
  warehouse_name: string;
  variant: string;
  product_name: string;
  presentation: string;
  lot: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  quantity: string;
  reserved_quantity: string;
  available_quantity: string;
};

type ExpiryTier = "danger" | "warning" | "muted";

function message(error: unknown) {
  return apiErrorMessage(error, "No se pudo cargar el stock.");
}

function integer(value: string) {
  return Math.round(Number(value || 0)).toLocaleString("es-PE");
}

function expiryTier(dateValue: string | null): ExpiryTier {
  if (!dateValue) return "muted";
  const days = (new Date(dateValue).getTime() - Date.now()) / 86_400_000;
  if (days <= 60) return "danger";
  if (days <= 180) return "warning";
  return "muted";
}

const expiryIcons: Record<ExpiryTier, string> = {
  danger: "fa-triangle-exclamation",
  warning: "fa-clock",
  muted: "fa-calendar-days",
};

function expiryLabel(dateValue: string | null) {
  if (!dateValue) return "Sin vencimiento";
  const date = new Date(dateValue);
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function expiryChip(dateValue: string | null) {
  const tier = expiryTier(dateValue);
  return (
    <span className={`sale-chip ${tier}`}>
      <i className={`fas ${expiryIcons[tier]}`} aria-hidden="true" /> {expiryLabel(dateValue)}
    </span>
  );
}

export function StockPage() {
  const { warehouses } = useSession();
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("");

  const stockQuery = useQuery({
    queryKey: ["stock", "list"],
    queryFn: () => apiRequestAll<StockRow>(apiEndpoints.stock, { query: { ordering: "lot__expiry_date" } }),
  });

  const rows = stockQuery.data?.items ?? [];

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!warehouseFilter || row.warehouse === warehouseFilter) &&
          (!expiryFilter || expiryTier(row.expiry_date) === expiryFilter),
      ),
    [rows, warehouseFilter, expiryFilter],
  );

  const columns: DataTableColumn<StockRow>[] = [
    { id: "warehouse", header: "Almacen", value: (row) => row.warehouse_name, sortable: true },
    { id: "product", header: "Producto", value: (row) => row.product_name, sortable: true, render: (row) => <strong>{row.product_name}</strong> },
    { id: "presentation", header: "Presentacion", value: (row) => row.presentation },
    { id: "lot", header: "Lote", value: (row) => row.batch_number ?? "-" },
    { id: "expiry", header: "Vencimiento", value: (row) => row.expiry_date ?? "", render: (row) => expiryChip(row.expiry_date), sortable: true },
    { id: "quantity", header: "Stock", value: (row) => Number(row.quantity), render: (row) => integer(row.quantity), align: "right", sortable: true },
    { id: "reserved", header: "Reservado", value: (row) => Number(row.reserved_quantity), render: (row) => integer(row.reserved_quantity), align: "right", sortable: true },
    { id: "available", header: "Disponible", value: (row) => Number(row.available_quantity), render: (row) => <strong>{integer(row.available_quantity)}</strong>, align: "right", sortable: true },
  ];

  return (
    <>
      <PageHeader
        title="Stock por almacen y lote"
        description="Existencias reales calculadas por movimientos de inventario. El stock no se edita directamente."
        actions={<span className="readonly-badge"><i className="fas fa-lock" aria-hidden="true" /> Solo lectura</span>}
      />
      <section className="workspace-panel">
        <DataTable
          rows={filteredRows}
          columns={columns}
          rowKey={(row) => row.id}
          searchText={(row) => `${row.product_name} ${row.presentation} ${row.batch_number ?? ""} ${row.warehouse_name}`}
          searchPlaceholder="Buscar existencia"
          filters={
            <>
              <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)}>
                <option value="">Todos los almacenes</option>
                {warehouses.map((warehouse) => <option value={warehouse.id} key={warehouse.id}>{warehouse.name}</option>)}
              </select>
              <select value={expiryFilter} onChange={(event) => setExpiryFilter(event.target.value)}>
                <option value="">Todo vencimiento</option>
                <option value="muted">Vigente</option>
                <option value="warning">Por vencer</option>
                <option value="danger">Critico / vencido</option>
              </select>
            </>
          }
          loading={stockQuery.isLoading}
          error={stockQuery.error ? message(stockQuery.error) : undefined}
          onRetry={() => void stockQuery.refetch()}
          emptyTitle="No hay existencias registradas"
          caption="Stock por almacen y lote"
        />
      </section>
    </>
  );
}
