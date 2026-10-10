"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/features/auth/context/session-context";
import { apiDownload, apiRequest, apiRequestAll } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { invalidateOperationalData } from "@/features/shared/api/invalidate";
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

type StockImportResponse = {
  rows: Array<{ row: number; product: string; warehouse: string; lot: string; expiry_date: string | null; quantity: string; valid: boolean; errors: string[] }>;
  valid_count: number;
  error_count: number;
  imported: number;
};

type ExpiryTier = "danger" | "warning" | "muted";

function message(error: unknown) {
  return apiErrorMessage(error, "No se pudo cargar el stock.");
}

function integer(value: string) {
  return formatQuantity(Number(value || 0));
}

type Adjustment = { adjustment_type: "IN" | "OUT"; quantity: string; reason: string; observation: string };

const adjustmentReasons = ["Conteo físico", "Merma o rotura", "Vencido retirado", "Stock inicial", "Devolución", "Otro"];
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
  const [year, month] = dateValue.split("-");
  return `${month}/${year}`;
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
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<StockImportResponse | null>(null);

  const importMutation = useMutation({
    mutationFn: ({ file, commit }: { file: File; commit: boolean }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (commit) formData.append("commit", "true");
      return apiRequest<StockImportResponse>(apiEndpoints.productStockImport, { method: "POST", body: formData });
    },
    onSuccess: (response, { commit }) => {
      setImportPreview(response);
      if (!commit) return;
      showToast({ title: "Stock inicial cargado", description: `${response.imported} fila(s) registradas en el kardex.`, tone: "success" });
      setImportOpen(false);
      void invalidateOperationalData(queryClient);
    },
  });

  async function downloadTemplate() {
    try {
      const blob = await apiDownload(apiEndpoints.productStockTemplate);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "plantilla-stock-inicial.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo descargar", description: apiErrorMessage(error, "Intenta nuevamente.") });
    }
  }

  const adjustMutation = useMutation({
    mutationFn: (row: StockRow) =>
      apiRequest(`${apiEndpoints.stock}adjustments/`, {
        method: "POST",
        body: { warehouse: row.warehouse, variant: row.variant, lot: row.lot, ...adjustment },
      }),
    onSuccess: () => {
      showToast({ title: "Ajuste registrado", description: "El movimiento ya aparece en el kardex.", tone: "success" });
      setAdjusting(null);
      void invalidateOperationalData(queryClient);
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
    { id: "warehouse", header: "Almacén", value: (row) => row.warehouse_name, sortable: true },
    { id: "product", header: "Producto", value: (row) => row.product_name, sortable: true, render: (row) => <strong>{row.product_name}</strong> },
    { id: "presentation", header: "Presentación", value: (row) => row.presentation },
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
        title="Stock por almacén y lote"
        description="Existencias reales calculadas por movimientos de inventario. Para corregir una cantidad registra un ajuste; queda en el kardex."
        actions={canAdjust ? <>
          <button type="button" className="ghost-button" onClick={() => void downloadTemplate()}><i className="fa fa-download" aria-hidden="true" /> Plantilla stock inicial</button>
          <button type="button" className="app-button primary" onClick={() => { setImportFile(null); setImportPreview(null); importMutation.reset(); setImportOpen(true); }}><i className="fa fa-file-import" aria-hidden="true" /> Importar stock inicial</button>
        </> : null}
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
                <option value="danger">Crítico / vencido</option>
              </select>
            </>
          }
          loading={stockQuery.isLoading}
          error={stockQuery.error ? message(stockQuery.error) : undefined}
          onRetry={() => void stockQuery.refetch()}
          emptyTitle="No hay existencias registradas"
          caption="Stock por almacén y lote"
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
          <label className="form-span-full"><span>Observación (opcional)</span><textarea maxLength={500} value={adjustment.observation} onChange={(event) => setAdjustment({ ...adjustment, observation: event.target.value })} /></label>
          {adjustError ? <p className="form-span-full field-error" role="alert">{adjustError}</p> : null}
        </form>
      </Modal>
      <Modal
        open={importOpen}
        title="Importar stock inicial"
        description="Usa la plantilla: un renglón por lote con código de barras, almacén, lote, vencimiento, cantidad y costo. Primero se valida; nada se guarda hasta confirmar."
        size="lg"
        busy={importMutation.isPending}
        onClose={() => setImportOpen(false)}
        footer={<>
          <button type="button" className="ghost-button" onClick={() => setImportOpen(false)} disabled={importMutation.isPending}>Cerrar</button>
          <button type="button" className="ghost-button" disabled={!importFile || importMutation.isPending} onClick={() => importFile && importMutation.mutate({ file: importFile, commit: false })}>{importMutation.isPending ? "Validando..." : "Vista previa"}</button>
          <button type="button" className="app-button primary" disabled={!importFile || !importPreview || importPreview.error_count > 0 || !importPreview.valid_count || importMutation.isPending} onClick={() => importFile && importMutation.mutate({ file: importFile, commit: true })}>Confirmar carga</button>
        </>}
      >
        <div className="import-panel">
          <label><span>Archivo CSV guardado desde Excel</span><input type="file" accept=".csv,text/csv" onChange={(event) => { setImportFile(event.target.files?.[0] ?? null); setImportPreview(null); }} /></label>
          {importMutation.error ? <p className="field-error" role="alert">{apiErrorMessage(importMutation.error, "No se pudo leer el archivo.")}</p> : null}
          {importPreview ? <div className="import-summary"><strong>{importPreview.valid_count} filas válidas</strong><span>{importPreview.error_count} filas con errores{importPreview.error_count ? " (corrígelas y vuelve a validar)" : ""}</span></div> : null}
          {importPreview ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Fila</th><th>Producto</th><th>Almacén</th><th>Lote</th><th>Vence</th><th>Cantidad</th><th>Errores</th></tr></thead><tbody>{importPreview.rows.map((row) => <tr key={row.row}><td>{row.row}</td><td>{row.product || "-"}</td><td>{row.warehouse}</td><td>{row.lot || "-"}</td><td>{row.expiry_date ?? "-"}</td><td>{row.quantity}</td><td>{row.errors.join(" · ") || "Lista"}</td></tr>)}</tbody></table></div> : null}
        </div>
      </Modal>
    </>
  );
}
