"use client";

import Decimal from "decimal.js";
import { FormEvent, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/features/auth/context/session-context";
import { apiRequest, apiRequestAll } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ApiPage } from "@/features/shared/api/types";
import { DataTable, type DataTableColumn } from "@/features/shared/ui/data-table/data-table";
import { Modal } from "@/features/shared/ui/modal/modal";
import { useConfirm } from "@/features/shared/ui/confirm/confirm-provider";
import { useToast } from "@/features/shared/ui/toast/toast-provider";
import { roundDecimal, roundInteger } from "@/features/shared/utils/formatters";

type Customer = { id: string; full_name: string; phone?: string };
type Variant = { id: string; product_name: string; presentation: string; base_sale_price: string };
type CashSession = { id: string; register: string; register_name: string };
type Terminal = { id: string; branch: string; name: string };
type RequestItem = { variant: string; quantity: string; reference_price: string; authorized_discount: string; notes: string };
type CustomerRequest = {
  id: string;
  code: string;
  customer_name: string;
  branch: string;
  branch_name: string;
  scheduled_at: string;
  service_type: string;
  status: string;
  sale_number: string | null;
  items: Array<RequestItem & { id: string; product_name: string; presentation: string }>;
};
type StockRow = { variant: string; available_quantity: string };

const emptyItem: RequestItem = { variant: "", quantity: "1", reference_price: "0", authorized_discount: "0", notes: "" };
const statusLabels: Record<string, string> = { DRAFT: "Borrador", PENDING: "Pendiente", CONFIRMED: "Confirmada", PREPARED: "Preparada", PARTIALLY_FULFILLED: "Parcial", FULFILLED: "Atendida", CANCELLED: "Cancelada", EXPIRED: "Vencida" };
const requestSteps = ["DRAFT", "PENDING", "CONFIRMED", "PREPARED", "FULFILLED"];
const transitionCopy: Record<string, { title: string; description: string; label: string; tone?: "danger" | "warning" | "primary" }> = {
  submit: { title: "Enviar solicitud", description: "La solicitud pasara de borrador a pendiente para que el equipo la revise.", label: "Enviar", tone: "primary" },
  confirm: { title: "Confirmar solicitud", description: "Confirma que el pedido fue validado y puede prepararse.", label: "Confirmar", tone: "primary" },
  prepare: { title: "Marcar como preparada", description: "Confirma que los productos quedaron listos para recojo o entrega.", label: "Preparada", tone: "primary" },
  cancel: { title: "Cancelar solicitud", description: "La solicitud quedara cancelada y ya no podra convertirse en venta.", label: "Cancelar solicitud", tone: "danger" },
};

function errorMessage(error: unknown) {
  return apiErrorMessage(error, "No se pudo procesar la solicitud.");
}

export function CustomerRequestsPage() {
  const { activeBranchId, activeWarehouseId, branches, warehouses, cashRegisters } = useSession();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const conversionKey = useRef(crypto.randomUUID());
  const [formOpen, setFormOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState<CustomerRequest | null>(null);
  const [detailTarget, setDetailTarget] = useState<CustomerRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [branchFilter, setBranchFilter] = useState("");
  const [header, setHeader] = useState({ customer: "", contact_phone: "", branch: activeBranchId, scheduled_at: "", service_type: "STORE_PICKUP", delivery_address: "", notes: "" });
  const [items, setItems] = useState<RequestItem[]>([{ ...emptyItem }]);
  const [payment, setPayment] = useState({ condition: "CASH", due_date: "", method: "CASH", amount: "", received: "" });
  const targetBranchId = convertTarget?.branch ?? activeBranchId;

  const requests = useQuery({ queryKey: ["customer-requests"], queryFn: () => apiRequestAll<CustomerRequest>(apiEndpoints.customerRequests, { query: { ordering: "scheduled_at" } }) });
  const customers = useQuery({ queryKey: ["customers", "request-options"], queryFn: () => apiRequestAll<Customer>(apiEndpoints.customers, { query: { is_active: true } }) });
  const variants = useQuery({ queryKey: ["variants", "request-options"], queryFn: () => apiRequestAll<Variant>(apiEndpoints.productVariants, { query: { is_active: true } }) });
  const sessions = useQuery({ queryKey: ["cash-sessions", "request-convert"], queryFn: () => apiRequestAll<CashSession>(apiEndpoints.cashSessions, { query: { status: "OPEN" } }) });
  const terminals = useQuery({ queryKey: ["terminals", "request-convert", targetBranchId], queryFn: () => apiRequestAll<Terminal>(apiEndpoints.posTerminals, { query: { branch: targetBranchId, is_active: true } }), enabled: Boolean(targetBranchId) });
  const detailWarehouses = warehouses.filter((item) => item.branchId === detailTarget?.branch);
  const detailStockQuery = useQuery({
    queryKey: ["stock", "request-detail", detailTarget?.id],
    enabled: Boolean(detailTarget) && detailWarehouses.length > 0,
    queryFn: async () => {
      const pages = await Promise.all(detailWarehouses.map((item) => apiRequestAll<StockRow>(apiEndpoints.stock, { query: { warehouse: item.id } })));
      const totals = new Map<string, number>();
      for (const page of pages) {
        for (const row of page.items) totals.set(row.variant, (totals.get(row.variant) ?? 0) + Number(row.available_quantity));
      }
      return totals;
    },
  });

  const total = (convertTarget?.items ?? []).reduce((sum, item) => sum.plus(new Decimal(item.reference_price).mul(item.quantity).minus(item.authorized_discount)), new Decimal(0));
  const currentRegisterIds = new Set(cashRegisters.filter((item) => item.branchId === targetBranchId).map((item) => item.id));
  const cashSession = sessions.data?.items.find((item) => currentRegisterIds.has(item.register));
  const warehouse = warehouses.find((item) => item.id === activeWarehouseId && item.branchId === targetBranchId) ?? warehouses.find((item) => item.branchId === targetBranchId);
  const terminal = terminals.data?.items.find((item) => item.branch === targetBranchId);

  const createMutation = useMutation({
    mutationFn: () => apiRequest<CustomerRequest>(apiEndpoints.customerRequests, { method: "POST", body: { ...header, scheduled_at: new Date(header.scheduled_at).toISOString(), delivery_address: header.service_type === "SCHEDULED_DELIVERY" ? header.delivery_address : "", items } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-requests"] }),
  });
  const transitionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => apiRequest(`${apiEndpoints.customerRequests}${id}/${action}/`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-requests"] }),
  });
  const convertMutation = useMutation({
    mutationFn: () => {
      if (!convertTarget || !warehouse || !terminal || !cashSession) throw new Error("Selecciona una sucursal con almacen, terminal y caja abierta.");
      const paid = payment.condition === "CASH" ? total : new Decimal(payment.amount || 0);
      return apiRequest(`${apiEndpoints.customerRequests}${convertTarget.id}/convert/`, { method: "POST", body: {
        warehouse: warehouse.id,
        terminal: terminal.id,
        cash_session: cashSession.id,
        idempotency_key: conversionKey.current,
        payment_condition: payment.condition,
        payment_due_date: payment.condition === "CREDIT" ? payment.due_date : null,
        payments: paid.gt(0) ? [{ method: payment.method, amount: paid.toFixed(2), received_amount: payment.method === "CASH" ? new Decimal(payment.received || paid).toFixed(2) : null }] : [],
      } });
    },
    onSuccess: async () => {
      conversionKey.current = crypto.randomUUID();
      setConvertTarget(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["customer-requests"] }), queryClient.invalidateQueries({ queryKey: ["pos", "stock"] }), queryClient.invalidateQueries({ queryKey: ["receivable"] })]);
      showToast({ tone: "success", title: "Solicitud convertida en venta" });
    },
    onError: (error) => showToast({ tone: "error", title: "No se pudo convertir", description: errorMessage(error) }),
  });

  function chooseVariant(index: number, id: string) {
    const variant = variants.data?.items.find((item) => item.id === id);
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, variant: id, reference_price: variant?.base_sale_price ?? "0" } : item));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await createMutation.mutateAsync();
      setFormOpen(false);
      setItems([{ ...emptyItem }]);
      showToast({ tone: "success", title: "Solicitud guardada", description: "No se desconto stock ni se genero una venta." });
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo guardar", description: errorMessage(error) });
    }
  }
  async function transition(row: CustomerRequest, action: string) {
    const copy = transitionCopy[action];
    const accepted = await confirm({ title: copy.title, description: `${copy.description}\n\nSolicitud ${row.code} - ${row.customer_name}`, confirmLabel: copy.label, tone: copy.tone ?? "primary" });
    if (!accepted) return;
    try { await transitionMutation.mutateAsync({ id: row.id, action }); showToast({ tone: "success", title: "Estado actualizado", description: `${row.code}: ${copy.label}` }); }
    catch (error) { showToast({ tone: "error", title: "No se pudo actualizar", description: errorMessage(error) }); }
  }

  function openConvert(row: CustomerRequest) {
    const rowTotal = row.items.reduce((sum, item) => sum.plus(new Decimal(item.reference_price).mul(item.quantity).minus(item.authorized_discount)), new Decimal(0));
    setConvertTarget(row);
    setPayment({ condition: "CASH", due_date: "", method: "CASH", amount: rowTotal.toFixed(2), received: rowTotal.toFixed(2) });
  }

  function renderProgress(status: string) {
    const currentIndex = requestSteps.indexOf(status);
    if (currentIndex < 0) return <span className={`status-pill status-${status.toLowerCase()}`}>{statusLabels[status] ?? status}</span>;
    return <div className="request-progress" aria-label={`Estado ${statusLabels[status] ?? status}`}>{requestSteps.map((step, index) => <span className={index < currentIndex ? "is-done" : index === currentIndex ? "is-current" : ""} key={step}>{statusLabels[step]}</span>)}</div>;
  }

  const columns = useMemo<DataTableColumn<CustomerRequest>[]>(() => [
    { id: "code", header: "Solicitud", value: (row) => row.code },
    { id: "customer", header: "Cliente", value: (row) => row.customer_name },
    { id: "branch", header: "Sucursal", value: (row) => row.branch_name },
    { id: "scheduled", header: "Programada", value: (row) => new Date(row.scheduled_at).toLocaleString("es-PE"), sortable: true },
    { id: "service", header: "Atencion", value: (row) => row.service_type === "STORE_PICKUP" ? "Recojo" : "Entrega" },
    { id: "status", header: "Flujo", render: (row) => renderProgress(row.status) },
    { id: "detail", header: "Detalle", render: (row) => <button type="button" className="row-action-edit" title="Ver detalle" aria-label={`Ver detalle de ${row.code}`} onClick={() => setDetailTarget(row)}><i className="fas fa-eye" /></button> },
    { id: "actions", header: "Siguiente paso", render: (row) => <div className="request-actions">
      {row.status === "DRAFT" ? <button type="button" className="ghost-button compact-button" onClick={() => void transition(row, "submit")} disabled={transitionMutation.isPending}><i className="fas fa-paper-plane" /> Enviar</button> : null}
      {row.status === "PENDING" ? <button type="button" className="app-button primary compact-button" onClick={() => void transition(row, "confirm")} disabled={transitionMutation.isPending}><i className="fas fa-check" /> Confirmar</button> : null}
      {row.status === "CONFIRMED" ? <button type="button" className="app-button primary compact-button" onClick={() => void transition(row, "prepare")} disabled={transitionMutation.isPending}><i className="fas fa-box" /> Preparar</button> : null}
      {row.status === "PREPARED" ? <button type="button" className="app-button primary compact-button" onClick={() => openConvert(row)}><i className="fas fa-motorcycle" /> Entregar y vender</button> : null}
      {["PENDING", "CONFIRMED"].includes(row.status) ? <button type="button" className="ghost-button compact-button" onClick={() => openConvert(row)}><i className="fas fa-cash-register" /> Vender ahora</button> : null}
      {["DRAFT", "PENDING", "CONFIRMED", "PREPARED"].includes(row.status) ? <button type="button" className="ghost-button compact-button danger-action" onClick={() => void transition(row, "cancel")} disabled={transitionMutation.isPending}><i className="fas fa-ban" /> Cancelar</button> : null}
    </div> },
  ], [transitionMutation.isPending]);

  const filteredRequests = useMemo(() => {
    return (requests.data?.items ?? []).filter((row) =>
      (!branchFilter || row.branch === branchFilter) &&
      (statusFilter === "ACTIVE" ? !["CANCELLED", "FULFILLED"].includes(row.status) : !statusFilter || row.status === statusFilter),
    );
  }, [requests.data?.items, statusFilter, branchFilter]);

  return <>
    <PageHeader title="Solicitudes programadas" section="Ventas" current="Agenda de clientes" actions={<button type="button" className="app-button primary" onClick={() => setFormOpen(true)}><i className="fas fa-plus" /> Nueva solicitud</button>} />
    <div className="request-summary"><span><strong>{requests.data?.items.filter((item) => new Date(item.scheduled_at).toDateString() === new Date().toDateString()).length ?? 0}</strong> Para hoy</span><span><strong>{requests.data?.items.filter((item) => !["FULFILLED", "CANCELLED", "EXPIRED"].includes(item.status)).length ?? 0}</strong> Pendientes</span><span><strong>{requests.data?.items.filter((item) => new Date(item.scheduled_at) < new Date() && !["FULFILLED", "CANCELLED"].includes(item.status)).length ?? 0}</strong> Atrasadas</span></div>
    <section className="content-panel">
      <DataTable
        rows={filteredRequests}
        columns={columns}
        rowKey={(row) => row.id}
        searchText={(row) => `${row.code} ${row.customer_name} ${row.branch_name}`}
        searchPlaceholder="Buscar solicitud"
        filters={<>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ACTIVE">Activas (sin canceladas ni atendidas)</option>
            <option value="">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="PENDING">Pendiente</option>
            <option value="CONFIRMED">Confirmada</option>
            <option value="PREPARED">Preparada</option>
            <option value="FULFILLED">Atendida</option>
            <option value="CANCELLED">Cancelada</option>
            <option value="EXPIRED">Vencida</option>
          </select>
          <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
            <option value="">Todas las sucursales</option>
            {branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}
          </select>
        </>}
        loading={requests.isLoading}
        error={requests.error ? errorMessage(requests.error) : undefined}
        onRetry={() => void requests.refetch()}
        emptyTitle="No hay solicitudes con estos filtros"
      />
    </section>
    <Modal open={formOpen} title="Nueva solicitud programada" size="xl" busy={createMutation.isPending} onClose={() => setFormOpen(false)} footer={<><button type="button" className="ghost-button" onClick={() => setFormOpen(false)}>Cancelar</button><button type="submit" form="request-form" className="app-button primary" disabled={createMutation.isPending}>Guardar borrador</button></>}>
      <form id="request-form" className="request-form" onSubmit={(event) => void submit(event)}><div className="form-grid">
        <label><span>Cliente</span><select required value={header.customer} onChange={(e) => { const customer = customers.data?.items.find((item) => item.id === e.target.value); setHeader({ ...header, customer: e.target.value, contact_phone: customer?.phone ?? header.contact_phone }); }}><option value="">Seleccionar</option>{customers.data?.items.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}</option>)}</select></label>
        <label><span>Telefono</span><input required value={header.contact_phone} onChange={(e) => setHeader({ ...header, contact_phone: e.target.value })} /></label>
        <label><span>Sucursal</span><select required value={header.branch} onChange={(e) => setHeader({ ...header, branch: e.target.value })}>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></label>
        <label><span>Fecha y hora</span><input type="datetime-local" required value={header.scheduled_at} onChange={(e) => setHeader({ ...header, scheduled_at: e.target.value })} /></label>
        <label><span>Tipo de atencion</span><select value={header.service_type} onChange={(e) => setHeader({ ...header, service_type: e.target.value })}><option value="STORE_PICKUP">Recojo en tienda</option><option value="SCHEDULED_DELIVERY">Entrega programada</option></select></label>
        {header.service_type === "SCHEDULED_DELIVERY" ? <label><span>Direccion</span><input required value={header.delivery_address} onChange={(e) => setHeader({ ...header, delivery_address: e.target.value })} /></label> : null}
      </div><div className="request-lines">{items.map((item, index) => <div className="request-line" key={index}><label><span>Producto</span><select required value={item.variant} onChange={(e) => chooseVariant(index, e.target.value)}><option value="">Seleccionar</option>{variants.data?.items.map((variant) => <option value={variant.id} key={variant.id}>{variant.product_name} - {variant.presentation}</option>)}</select></label><label><span>Cantidad</span><input type="number" min="1" step="1" required value={item.quantity} onChange={(e) => setItems((current) => current.map((line, i) => i === index ? { ...line, quantity: e.target.value } : line))} onBlur={(e) => setItems((current) => current.map((line, i) => i === index ? { ...line, quantity: String(roundInteger(Number(e.target.value)) || 1) } : line))} /></label><label><span>Precio referencial</span><input type="number" min="0" step="0.01" required value={item.reference_price} onChange={(e) => setItems((current) => current.map((line, i) => i === index ? { ...line, reference_price: e.target.value } : line))} onBlur={(e) => setItems((current) => current.map((line, i) => i === index ? { ...line, reference_price: String(roundDecimal(Number(e.target.value))) } : line))} /></label><button type="button" className="row-action-delete" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, i) => i !== index))}><i className="fas fa-trash" /></button></div>)}</div><button type="button" className="ghost-button" onClick={() => setItems((current) => [...current, { ...emptyItem }])}><i className="fas fa-plus" /> Agregar producto</button>
      </form>
    </Modal>
    <Modal open={Boolean(convertTarget)} title="Entregar y convertir en venta" busy={convertMutation.isPending} onClose={() => setConvertTarget(null)} footer={<><button type="button" className="ghost-button" onClick={() => setConvertTarget(null)}>Cancelar</button><button type="button" className="app-button primary" disabled={!cashSession || !warehouse || !terminal || convertMutation.isPending || (payment.condition === "CREDIT" && !payment.due_date) || (payment.method === "CASH" && new Decimal(payment.received || 0).lt(payment.condition === "CASH" ? total : new Decimal(payment.amount || 0)))} onClick={() => convertMutation.mutate()}>Confirmar entrega y venta</button></>}>
      <div className="form-grid"><p className="form-span-full">Paso final tipo delivery: registra la venta, descuenta stock y marca la solicitud como atendida por <strong>S/ {total.toFixed(2)}</strong>.</p><p className="form-span-full field-warning">Requiere almacen, terminal y caja abierta en la sucursal de la solicitud.</p><label><span>Condicion</span><select value={payment.condition} onChange={(e) => setPayment({ ...payment, condition: e.target.value })}><option value="CASH">Contado</option><option value="CREDIT">Credito</option></select></label>{payment.condition === "CREDIT" ? <><label><span>Vencimiento</span><input type="date" required value={payment.due_date} onChange={(e) => setPayment({ ...payment, due_date: e.target.value })} /></label><label><span>Pago inicial</span><input type="number" min="0" max={total.toFixed(2)} step="0.01" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} onBlur={(e) => setPayment((current) => ({ ...current, amount: String(roundDecimal(Number(e.target.value))) }))} /></label></> : null}<label><span>Medio</span><select value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}><option value="CASH">Efectivo</option><option value="YAPE">Yape</option><option value="PLIN">Plin</option><option value="CARD">Tarjeta</option><option value="TRANSFER">Transferencia</option></select></label>{payment.method === "CASH" ? <label><span>Efectivo recibido</span><input type="number" min="0" step="0.01" value={payment.received} onChange={(e) => setPayment({ ...payment, received: e.target.value })} onBlur={(e) => setPayment((current) => ({ ...current, received: String(roundDecimal(Number(e.target.value))) }))} /></label> : null}</div>
    </Modal>
    <Modal
      open={Boolean(detailTarget)}
      title={detailTarget ? `Solicitud ${detailTarget.code}` : "Detalle de solicitud"}
      description={detailTarget ? `${detailTarget.customer_name} - ${detailTarget.branch_name}` : undefined}
      size="lg"
      onClose={() => setDetailTarget(null)}
      footer={<button type="button" className="ghost-button" onClick={() => setDetailTarget(null)}>Cerrar</button>}
    >
      {detailTarget ? (
        <div className="table-wrap">
          {detailWarehouses.length === 0 ? <p className="field-warning">La sucursal no tiene almacenes configurados; no se puede validar el stock.</p> : null}
          <table className="data-table">
            <thead><tr><th>Producto</th><th>Presentacion</th><th>Cantidad</th><th>Precio ref.</th><th>Stock disponible</th></tr></thead>
            <tbody>
              {detailTarget.items.map((item) => {
                const requested = Number(item.quantity);
                const available = detailStockQuery.data?.get(item.variant) ?? 0;
                const short = available < requested;
                return (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td>{item.presentation}</td>
                    <td>{requested.toLocaleString("es-PE")}</td>
                    <td>S/ {Number(item.reference_price).toFixed(2)}</td>
                    <td>
                      {detailStockQuery.isLoading ? "Calculando..." : (
                        <span className={`sale-chip ${short ? "danger" : "success"}`}>
                          {short ? <i className="fas fa-triangle-exclamation" aria-hidden="true" /> : null} {available.toLocaleString("es-PE")} disponible{available === 1 ? "" : "s"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </Modal>
  </>;
}
