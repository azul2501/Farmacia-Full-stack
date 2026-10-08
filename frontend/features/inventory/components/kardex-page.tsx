"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/features/auth/context/session-context";
import { apiRequest } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ApiPage } from "@/features/shared/api/types";
import { DataTable, type DataTableColumn } from "@/features/shared/ui/data-table/data-table";

type MovementRow = {
  id: string;
  created_at: string;
  movement_type: string;
  warehouse: string;
  warehouse_name: string;
  product_name: string;
  presentation: string;
  batch_number: string | null;
  quantity: string;
  balance_after: string;
  document_number: string;
  performed_by_name: string;
};

const movementLabels: Record<string, string> = {
  PURCHASE_IN: "Ingreso por compra",
  SALE_OUT: "Salida por venta",
  TRANSFER_OUT: "Salida por transferencia",
  TRANSFER_IN: "Ingreso por transferencia",
  ADJUSTMENT_IN: "Ajuste positivo",
  ADJUSTMENT_OUT: "Ajuste negativo",
  RETURN_IN: "Ingreso por devolucion",
};

const movementIcons: Record<string, string> = {
  PURCHASE_IN: "fa-cart-arrow-down",
  SALE_OUT: "fa-cash-register",
  TRANSFER_OUT: "fa-truck-ramp-box",
  TRANSFER_IN: "fa-truck-ramp-box",
  ADJUSTMENT_IN: "fa-circle-plus",
  ADJUSTMENT_OUT: "fa-circle-minus",
  RETURN_IN: "fa-rotate-left",
};

function movementTone(type: string) {
  return type.endsWith("_IN") ? "success" : "danger";
}

function movementChip(type: string) {
  return (
    <span className={`sale-chip ${movementTone(type)}`}>
      <i className={`fas ${movementIcons[type] ?? "fa-right-left"}`} aria-hidden="true" /> {movementLabels[type] ?? type}
    </span>
  );
}

function integerSigned(value: string) {
  const number = Math.round(Number(value || 0));
  const text = Math.abs(number).toLocaleString("es-PE");
  return number > 0 ? `+${text}` : number < 0 ? `-${text}` : text;
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("es-PE");
}

function message(error: unknown) {
  return apiErrorMessage(error, "No se pudo cargar el kardex.");
}

export function KardexPage() {
  const { warehouses } = useSession();
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const movementsQuery = useQuery({
    queryKey: ["inventory-movements", "list"],
    queryFn: () => apiRequest<ApiPage<MovementRow>>(apiEndpoints.inventoryMovements, { query: { pageSize: 500, ordering: "-created_at" } }),
  });

  const rows = movementsQuery.data?.items ?? [];

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!warehouseFilter || row.warehouse === warehouseFilter) &&
          (!typeFilter || row.movement_type === typeFilter),
      ),
    [rows, warehouseFilter, typeFilter],
  );

  const columns: DataTableColumn<MovementRow>[] = [
    { id: "date", header: "Fecha", value: (row) => row.created_at, render: (row) => dateTime(row.created_at), sortable: true },
    { id: "type", header: "Movimiento", value: (row) => movementLabels[row.movement_type] ?? row.movement_type, render: (row) => movementChip(row.movement_type), sortable: true },
    { id: "product", header: "Producto", value: (row) => row.product_name, sortable: true, render: (row) => <strong>{row.product_name}</strong> },
    { id: "presentation", header: "Presentacion", value: (row) => row.presentation },
    { id: "lot", header: "Lote", value: (row) => row.batch_number ?? "-" },
    { id: "warehouse", header: "Almacen", value: (row) => row.warehouse_name, sortable: true },
    {
      id: "quantity",
      header: "Cantidad",
      value: (row) => Number(row.quantity),
      align: "right",
      sortable: true,
      render: (row) => <strong className={Number(row.quantity) < 0 ? "sale-balance-due" : undefined}>{integerSigned(row.quantity)}</strong>,
    },
    { id: "balance", header: "Saldo", value: (row) => Number(row.balance_after), render: (row) => Math.round(Number(row.balance_after)).toLocaleString("es-PE"), align: "right", sortable: true },
    { id: "document", header: "Documento", value: (row) => row.document_number || "-" },
    { id: "user", header: "Usuario", value: (row) => row.performed_by_name },
  ];

  return (
    <>
      <PageHeader
        title="Kardex"
        description="Historial inmutable de entradas y salidas de inventario."
        actions={<span className="readonly-badge"><i className="fas fa-lock" aria-hidden="true" /> Solo lectura</span>}
      />
      <section className="workspace-panel">
        <DataTable
          rows={filteredRows}
          columns={columns}
          rowKey={(row) => row.id}
          searchText={(row) => `${row.product_name} ${row.presentation} ${row.batch_number ?? ""} ${row.warehouse_name} ${row.document_number}`}
          searchPlaceholder="Buscar movimiento"
          filters={
            <>
              <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)}>
                <option value="">Todos los almacenes</option>
                {warehouses.map((warehouse) => <option value={warehouse.id} key={warehouse.id}>{warehouse.name}</option>)}
              </select>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">Todos los movimientos</option>
                {Object.entries(movementLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </>
          }
          loading={movementsQuery.isLoading}
          error={movementsQuery.error ? message(movementsQuery.error) : undefined}
          onRetry={() => void movementsQuery.refetch()}
          emptyTitle="No hay movimientos registrados"
          caption="Kardex"
        />
      </section>
    </>
  );
}
