"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/features/auth/context/session-context";
import { apiRequest, apiRequestAll } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ApiPage } from "@/features/shared/api/types";
import { DataTable, type DataTableColumn } from "@/features/shared/ui/data-table/data-table";
import { Modal } from "@/features/shared/ui/modal/modal";
import { useToast } from "@/features/shared/ui/toast/toast-provider";
import { formatQuantity } from "@/features/shared/utils/formatters";

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
  return formatQuantity(Number(value || 0));
}

type Adjustment = { adjustment_type: "IN" | "OUT"; quantity: string; reason: string; observation: string };

const adjustmentReasons = ["Conteo fisico", "Merma o rotura", "Vencido retirado", "Stock inicial", "Devolucion", "Otro"];
const emptyAdjustment: Adjustment = { adjustment_type: "OUT", quantity: "", reason: adjustmentReasons[0], observation: "" };

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
  const { warehouses, hasPermission } = useSession();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const canAdjust = hasPermission("records.update");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("");
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);
  const [adjustment, setAdjustment] = useState<Adjustment>(emptyAdjustment);
  const [adjustError, setAdjustError] = useState("");

  const adjustMutation = useMutation({
    mutationFn: (row: StockRow) =>
      apiRequest(`${apiEndpoints.stock}adjustments/`, {
        method: "POST",
        body: { warehouse: row.warehouse, variant: row.variant, lot: row.lot, ...adjustment },
      }),
    onSuccess: () => {
      showToast({ title: "Ajuste registrado", description: "El movimiento ya aparece en el kardex.", tone: "success" });
      setAdjusting(null);
      void queryClient.invalidateQueries({ queryKey: ["stock"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => setAdjustError(apiErrorMessage(error, "No se pudo registrar el ajuste.")),
  });

  function openAdjust(row: StockRow) {
    setAdjustment(emptyAdjustment);
    setAdjustError("");
    setAdjusting(row);
  }

  function submitAdjust(event: React.FormEvent) {
    event.preventDefault();
    if (!adjusting) return;
    if (adjustment.adjustment_type === "OUT" && Number(adjustment.quantity) > Number(adjusting.available_quantity)) {
      setAdjustError(`Solo hay ${integer(adjusting.available_quantity)} disponibles en este lote.`);
      return;
    }
    adjustMutation.mutate(adjusting);
  }

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
    ...(canAdjust
      ? [{ id: "actions", header: "Acciones", render: (row: StockRow) => <button type="button" className="ghost-button compact-button" onClick={() => openAdjust(row)}><i className="fas fa-sliders-h" aria-hidden="true" /> Ajustar</button> }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Stock por almacen y lote"
        description="Existencias reales calculadas por movimientos de inventario. Para corregir una cantidad registra un ajuste; queda en el kardex."
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
      <Modal
        open={adjusting !== null}
        title="Ajustar stock"
        description={adjusting ? `${adjusting.product_name} ${adjusting.presentation} · ${adjusting.warehouse_name}${adjusting.batch_number ? ` · Lote ${adjusting.batch_number}` : ""}` : undefined}
        size="sm"
        busy={adjustMutation.isPending}
        onClose={() => setAdjusting(null)}
        footer={<><button type="button" className="ghost-button" onClick={() => setAdjusting(null)}>Cancelar</button><button type="submit" form="stock-adjust-form" className="app-button primary" disabled={adjustMutation.isPending}>{adjustMutation.isPending ? "Guardando..." : "Registrar ajuste"}</button></>}
      >
        <form id="stock-adjust-form" className="form-grid" onSubmit={submitAdjust}>
          <p className="form-span-full field-hint">Stock actual: <strong>{adjusting ? integer(adjusting.quantity) : "-"}</strong> · Disponible: <strong>{adjusting ? integer(adjusting.available_quantity) : "-"}</strong></p>
          <label><span>Tipo</span><select value={adjustment.adjustment_type} onChange={(event) => setAdjustment({ ...adjustment, adjustment_type: event.target.value as Adjustment["adjustment_type"] })}><option value="OUT">Salida (resta)</option><option value="IN">Entrada (suma)</option></select></label>
          <label><span>Cantidad</span><input type="number" min="0.001" step="any" required value={adjustment.quantity} onChange={(event) => setAdjustment({ ...adjustment, quantity: event.target.value })} /></label>
          <label className="form-span-full"><span>Motivo</span><select value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })}>{adjustmentReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label>
          <label className="form-span-full"><span>Observacion (opcional)</span><textarea maxLength={500} value={adjustment.observation} onChange={(event) => setAdjustment({ ...adjustment, observation: event.target.value })} /></label>
          {adjustError ? <p className="form-span-full field-error" role="alert">{adjustError}</p> : null}
        </form>
      </Modal>
    </>
  );
}
