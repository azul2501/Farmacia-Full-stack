"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/features/auth/context/session-context";
import { apiRequest } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ApiPage } from "@/features/shared/api/types";
import { DataTable, type DataTableColumn } from "@/features/shared/ui/data-table/data-table";
import { Modal } from "@/features/shared/ui/modal/modal";
import { ErrorState, LoadingState } from "@/features/shared/ui/states/async-state";
import { useToast } from "@/features/shared/ui/toast/toast-provider";

type SaleRow = {
  id: string;
  number: string;
  sold_at: string;
  branch: string;
  branch_name: string;
  customer_name: string | null;
  cashier_name: string;
  status: SaleStatus;
  payment_condition: PaymentCondition;
  amount_paid: string;
  total: string;
  balance_due: string;
};

type SaleStatus = "COMPLETED" | "CANCELLED" | string;
type PaymentCondition = "CASH" | "CREDIT" | string;

type SaleItem = {
  id: string;
  product_name: string;
  presentation: string;
  batch_number: string | null;
  quantity: string;
  unit_price: string;
  discount: string;
  discount_reason: string;
  line_total: string;
};

type SalePayment = {
  id: string;
  method: string;
  amount: string;
  received_amount: string | null;
  reference: string;
};

type SaleDetail = SaleRow & {
  subtotal: string;
  discount_total: string;
  tax_total: string;
  change_total: string;
  payment_due_date: string | null;
  notes: string;
  items: SaleItem[];
  payments: SalePayment[];
};

type SaleFilters = {
  branch: string;
  status: string;
  condition: string;
  dateFrom: string;
  dateTo: string;
};

const emptyFilters: SaleFilters = {
  branch: "",
  status: "",
  condition: "",
  dateFrom: "",
  dateTo: "",
};

const statusLabels: Record<string, string> = {
  COMPLETED: "Completada",
  CANCELLED: "Anulada",
};

const conditionLabels: Record<string, string> = {
  CASH: "Contado",
  CREDIT: "Credito",
};

const paymentLabels: Record<string, string> = {
  CASH: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

const paymentIcons: Record<string, string> = {
  CASH: "fa-money-bill-wave",
  YAPE: "fa-mobile-screen-button",
  PLIN: "fa-mobile-screen-button",
  CARD: "fa-credit-card",
  TRANSFER: "fa-right-left",
};

function message(error: unknown) {
  return apiErrorMessage(error, "No se pudieron cargar las ventas.");
}

function money(value: string) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0));
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("es-PE");
}

function dateOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statusBadge(status: string) {
  const cancelled = status === "CANCELLED";
  return <span className={`sale-chip ${cancelled ? "danger" : "success"}`}><i className={`fas ${cancelled ? "fa-ban" : "fa-circle-check"}`} aria-hidden="true" />{statusLabels[status] ?? status}</span>;
}

function conditionBadge(condition: string) {
  const credit = condition === "CREDIT";
  return <span className={`sale-chip ${credit ? "warning" : "neutral"}`}><i className={`fas ${credit ? "fa-hand-holding-dollar" : "fa-money-bill-wave"}`} aria-hidden="true" />{conditionLabels[condition] ?? condition}</span>;
}

function paymentLabel(method: string) {
  return paymentLabels[method] ?? method;
}

function paymentIcon(method: string) {
  return paymentIcons[method] ?? "fa-circle-dollar-to-slot";
}

function matchesFilters(row: SaleRow, filters: SaleFilters) {
  const soldDate = dateOnly(row.sold_at);
  return (
    (!filters.branch || row.branch === filters.branch) &&
    (!filters.status || row.status === filters.status) &&
    (!filters.condition || row.payment_condition === filters.condition) &&
    (!filters.dateFrom || soldDate >= filters.dateFrom) &&
    (!filters.dateTo || soldDate <= filters.dateTo)
  );
}

export function SalesListPage() {
  const { branches, hasPermission } = useSession();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<SaleFilters>(emptyFilters);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [saleToCancel, setSaleToCancel] = useState<SaleRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const salesQuery = useQuery({
    queryKey: ["sales", "list"],
    queryFn: () => apiRequest<ApiPage<SaleRow>>(apiEndpoints.sales, { query: { pageSize: 500, ordering: "-sold_at" } }),
  });
  const saleDetailQuery = useQuery({
    queryKey: ["sales", "detail", selectedSaleId],
    enabled: Boolean(selectedSaleId),
    queryFn: () => apiRequest<SaleDetail>(`${apiEndpoints.sales}${selectedSaleId}/`),
  });
  const cancelMutation = useMutation({
    mutationFn: () =>
      apiRequest(`${apiEndpoints.sales}${saleToCancel?.id}/cancel/`, {
        method: "POST",
        body: { reason: cancelReason },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", "list"] });
      queryClient.invalidateQueries({ queryKey: ["sales", "detail", saleToCancel?.id] });
      showToast({ tone: "success", title: "Venta anulada", description: "El stock y la caja fueron revertidos." });
      setSaleToCancel(null);
      setCancelReason("");
    },
  });

  async function confirmCancel(event: FormEvent) {
    event.preventDefault();
    try {
      await cancelMutation.mutateAsync();
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo anular la venta", description: message(error) });
    }
  }

  const filteredRows = useMemo(
    () => (salesQuery.data?.items ?? []).filter((row) => matchesFilters(row, filters)),
    [filters, salesQuery.data?.items],
  );

  const hasFilters = Object.values(filters).some(Boolean);
  const selectedSale = saleDetailQuery.data;
  const canCancel = hasPermission("sales.cancel");
  const columns: DataTableColumn<SaleRow>[] = [
    { id: "number", header: "Numero", value: (row) => row.number, sortable: true },
    { id: "sold_at", header: "Fecha", value: (row) => dateTime(row.sold_at), sortable: true },
    { id: "branch", header: "Sucursal", value: (row) => row.branch_name, sortable: true },
    { id: "customer", header: "Cliente", value: (row) => row.customer_name ?? "Publico general", sortable: true },
    { id: "cashier", header: "Cajero", value: (row) => row.cashier_name, sortable: true },
    { id: "condition", header: "Condicion", value: (row) => conditionLabels[row.payment_condition] ?? row.payment_condition, render: (row) => conditionBadge(row.payment_condition), sortable: true },
    { id: "status", header: "Estado", value: (row) => statusLabels[row.status] ?? row.status, render: (row) => statusBadge(row.status), sortable: true },
    { id: "total", header: "Total", value: (row) => Number(row.total), render: (row) => money(row.total), sortable: true, align: "right" },
    { id: "balance", header: "Saldo", value: (row) => Number(row.balance_due), render: (row) => <strong className={Number(row.balance_due) > 0 ? "sale-balance-due" : undefined}>{money(row.balance_due)}</strong>, sortable: true, align: "right" },
    { id: "actions", header: "Acciones", render: (row) => <div className="row-actions compact-row-actions"><button type="button" className="row-action-edit" title="Ver detalle" onClick={() => setSelectedSaleId(row.id)}><i className="fas fa-eye" /></button><button type="button" className="row-action-edit" title="Imprimir" onClick={() => window.open(`/ventas/${row.id}/imprimir`, "_blank", "noopener,noreferrer")}><i className="fas fa-print" /></button>{canCancel && row.status !== "CANCELLED" ? <button type="button" className="row-action-delete" title="Anular venta" onClick={() => setSaleToCancel(row)}><i className="fas fa-ban" /></button> : null}</div> },
  ];

  return (
    <>
      <PageHeader title="Ventas" section="Ventas" current="Listado" />
      <section className="content-panel">
        <DataTable
          rows={filteredRows}
          columns={columns}
          rowKey={(row) => row.id}
          searchText={(row) => `${row.number} ${row.branch_name} ${row.customer_name ?? ""} ${row.cashier_name}`}
          searchPlaceholder="Buscar venta por numero, cliente, sucursal o cajero"
          filters={
            <>
              <label>
                <span>Sucursal</span>
                <select value={filters.branch} onChange={(event) => setFilters((current) => ({ ...current, branch: event.target.value }))}>
                  <option value="">Todas</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
              <label>
                <span>Estado</span>
                <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="">Todos</option>
                  <option value="COMPLETED">Completada</option>
                  <option value="CANCELLED">Anulada</option>
                </select>
              </label>
              <label>
                <span>Condicion</span>
                <select value={filters.condition} onChange={(event) => setFilters((current) => ({ ...current, condition: event.target.value }))}>
                  <option value="">Todas</option>
                  <option value="CASH">Contado</option>
                  <option value="CREDIT">Credito</option>
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
              {hasFilters ? <button type="button" className="ghost-button compact-button" onClick={() => setFilters(emptyFilters)}>Limpiar</button> : null}
            </>
          }
          loading={salesQuery.isLoading}
          error={salesQuery.error ? message(salesQuery.error) : undefined}
          onRetry={() => void salesQuery.refetch()}
          emptyTitle="No hay ventas registradas"
          emptyDescription={hasFilters ? "No encontramos ventas con los filtros aplicados." : undefined}
          caption="Ventas"
        />
      </section>
      <Modal
        open={Boolean(selectedSaleId)}
        title={selectedSale ? `Venta ${selectedSale.number}` : "Detalle de venta"}
        description="Consulta de productos, pagos y totales de la venta."
        size="xl"
        onClose={() => setSelectedSaleId(null)}
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => setSelectedSaleId(null)}>Cerrar</button>
            {canCancel && selectedSale && selectedSale.status !== "CANCELLED" ? (
              <button type="button" className="app-button danger" onClick={() => { setSaleToCancel(selectedSale); setSelectedSaleId(null); }}>
                <i className="fas fa-ban" /> Anular
              </button>
            ) : null}
            {selectedSaleId ? <button type="button" className="app-button primary" onClick={() => window.open(`/ventas/${selectedSaleId}/imprimir`, "_blank", "noopener,noreferrer")}><i className="fas fa-print" /> Imprimir</button> : null}
          </>
        }
      >
        {saleDetailQuery.isLoading ? <LoadingState rows={6} /> : null}
        {saleDetailQuery.error ? <ErrorState message={message(saleDetailQuery.error)} onRetry={() => void saleDetailQuery.refetch()} /> : null}
        {selectedSale ? <SaleDetailContent sale={selectedSale} /> : null}
      </Modal>
      <Modal
        open={Boolean(saleToCancel)}
        title={saleToCancel ? `Anular venta ${saleToCancel.number}` : "Anular venta"}
        description="Esta accion revierte el stock vendido y, si aplica, el efectivo registrado en caja. No se puede deshacer."
        busy={cancelMutation.isPending}
        onClose={() => { setSaleToCancel(null); setCancelReason(""); }}
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => { setSaleToCancel(null); setCancelReason(""); }}>Cancelar</button>
            <button form="sale-cancel-form" type="submit" className="app-button danger" disabled={cancelMutation.isPending || !cancelReason.trim()}>
              {cancelMutation.isPending ? "Anulando..." : "Confirmar anulacion"}
            </button>
          </>
        }
      >
        <form id="sale-cancel-form" className="form-grid" onSubmit={(event) => void confirmCancel(event)}>
          <label className="form-span-full">
            <span>Motivo de la anulacion</span>
            <textarea required value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Ej: cliente se arrepintio, error en el registro..." />
          </label>
        </form>
      </Modal>
    </>
  );
}

function SaleDetailContent({ sale }: { sale: SaleDetail }) {
  return (
    <div className="sale-detail">
      <dl className="detail-grid">
        <div><dt>Fecha</dt><dd>{dateTime(sale.sold_at)}</dd></div>
        <div><dt>Sucursal</dt><dd>{sale.branch_name}</dd></div>
        <div><dt>Cajero</dt><dd>{sale.cashier_name}</dd></div>
        <div><dt>Cliente</dt><dd>{sale.customer_name ?? "Publico general"}</dd></div>
        <div><dt>Estado</dt><dd>{statusBadge(sale.status)}</dd></div>
        <div><dt>Condicion</dt><dd>{conditionBadge(sale.payment_condition)}</dd></div>
        {sale.payment_due_date ? <div><dt>Vence</dt><dd>{sale.payment_due_date}</dd></div> : null}
        {sale.notes ? <div className="form-span-full"><dt>Observacion</dt><dd>{sale.notes}</dd></div> : null}
      </dl>

      <section className="sale-detail-section">
        <h3><i className="fas fa-capsules" aria-hidden="true" /> Productos</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Producto</th><th>Presentacion / lote</th><th>Cantidad</th><th>Precio</th><th>Descuento</th><th>Total</th></tr></thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product_name}</td>
                  <td>{item.presentation}{item.batch_number ? ` / Lote ${item.batch_number}` : ""}</td>
                  <td>{Number(item.quantity).toLocaleString("es-PE")}</td>
                  <td>{money(item.unit_price)}</td>
                  <td>{money(item.discount)}</td>
                  <td>{money(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sale-detail-section">
        <h3><i className="fas fa-wallet" aria-hidden="true" /> Pagos</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Medio</th><th>Monto</th><th>Recibido</th><th>Referencia</th></tr></thead>
            <tbody>
              {sale.payments.length ? sale.payments.map((payment) => (
                <tr key={payment.id}>
                  <td><i className={`fas ${paymentIcon(payment.method)} sale-payment-icon`} aria-hidden="true" /> {paymentLabel(payment.method)}</td>
                  <td>{money(payment.amount)}</td>
                  <td>{payment.received_amount ? money(payment.received_amount) : "-"}</td>
                  <td>{payment.reference || "-"}</td>
                </tr>
              )) : <tr><td colSpan={4}>Sin pagos registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <dl className="sale-detail-totals">
        <div><dt>Subtotal</dt><dd>{money(sale.subtotal)}</dd></div>
        <div><dt>Descuento</dt><dd>{money(sale.discount_total)}</dd></div>
        <div><dt>IGV</dt><dd>{money(sale.tax_total)}</dd></div>
        <div className="total"><dt>Total</dt><dd>{money(sale.total)}</dd></div>
        <div><dt>Pagado</dt><dd>{money(sale.amount_paid)}</dd></div>
        <div><dt>Saldo</dt><dd>{money(sale.balance_due)}</dd></div>
        <div><dt>Vuelto</dt><dd>{money(sale.change_total)}</dd></div>
      </dl>
    </div>
  );
}
