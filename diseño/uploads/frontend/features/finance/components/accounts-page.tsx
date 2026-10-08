"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { apiRequest } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ApiPage } from "@/features/shared/api/types";
import type { DataTableColumn } from "@/features/shared/ui/data-table/data-table";
import { DataTable } from "@/features/shared/ui/data-table/data-table";
import { Modal } from "@/features/shared/ui/modal/modal";
import { useToast } from "@/features/shared/ui/toast/toast-provider";

type Account = {
  id: string; supplier_name?: string; customer_name?: string; purchase_number?: string; sale_number?: string;
  branch_name: string; issue_date: string; due_date: string; original_amount: string; paid_amount?: string;
  collected_amount?: string; balance: string; effective_status: string;
};
type CashSession = { id: string; register_name: string; status: string };

function message(error: unknown) { return apiErrorMessage(error, "No se pudo registrar la operacion."); }
function money(value: string) { return `S/ ${Number(value).toFixed(2)}`; }

export function AccountsPage({ type }: { type: "payable" | "receivable" }) {
  const payable = type === "payable";
  const endpoint = payable ? apiEndpoints.payables : apiEndpoints.receivables;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [account, setAccount] = useState<Account | null>(null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", method: "CASH", cash_session: "", reference: "", operation_number: "", notes: "" });
  const idempotencyKey = useRef(crypto.randomUUID());
  const accountsQuery = useQuery({ queryKey: [type, "accounts"], queryFn: () => apiRequest<ApiPage<Account>>(endpoint, { query: { pageSize: 100, ordering: "due_date" } }) });
  const sessionsQuery = useQuery({ queryKey: ["cash-sessions", "open"], queryFn: () => apiRequest<ApiPage<CashSession>>(apiEndpoints.cashSessions, { query: { pageSize: 100, status: "OPEN" } }) });
  const mutation = useMutation({
    mutationFn: () => apiRequest(`${endpoint}${account?.id}/${payable ? "payments" : "collections"}/`, { method: "POST", body: { ...form, cash_session: form.cash_session || null, idempotency_key: idempotencyKey.current } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [type, "accounts"] });
      idempotencyKey.current = crypto.randomUUID();
    },
  });

  function openAccount(row: Account) {
    idempotencyKey.current = crypto.randomUUID();
    setAccount(row);
    setForm((current) => ({ ...current, amount: row.balance }));
  }

  const columns = useMemo<DataTableColumn<Account>[]>(() => [
    { id: "party", header: payable ? "Proveedor" : "Cliente", value: (row) => payable ? row.supplier_name : row.customer_name, sortable: true },
    { id: "document", header: "Documento", value: (row) => payable ? row.purchase_number : row.sale_number },
    { id: "issue", header: "Emision", value: (row) => row.issue_date, sortable: true },
    { id: "due", header: "Vencimiento", value: (row) => row.due_date, sortable: true },
    { id: "original", header: "Monto original", value: (row) => money(row.original_amount) },
    { id: "balance", header: "Saldo", value: (row) => money(row.balance), sortable: true },
    { id: "status", header: "Estado", value: (row) => row.effective_status },
    { id: "actions", header: "Acciones", render: (row) => Number(row.balance) > 0 ? <button type="button" className="app-button primary compact-button" onClick={() => openAccount(row)}><i className={`fas ${payable ? "fa-money-check-alt" : "fa-hand-holding-usd"}`} /> {payable ? "Pagar" : "Cobrar"}</button> : null },
  ], [payable]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await mutation.mutateAsync();
      showToast({ tone: "success", title: payable ? "Pago registrado" : "Cobro registrado", description: "El saldo y la caja fueron actualizados transaccionalmente." });
      setAccount(null);
    } catch (error) { showToast({ tone: "error", title: "Operacion rechazada", description: message(error) }); }
  }

  return <>
    <PageHeader title={payable ? "Cuentas por pagar" : "Cuentas por cobrar"} section="Caja y finanzas" current={payable ? "Proveedores" : "Clientes"} />
    <section className="content-panel"><DataTable rows={accountsQuery.data?.items ?? []} columns={columns} rowKey={(row) => row.id} searchText={(row) => `${row.supplier_name ?? row.customer_name} ${row.purchase_number ?? row.sale_number} ${row.effective_status}`} loading={accountsQuery.isLoading} error={accountsQuery.error ? message(accountsQuery.error) : undefined} onRetry={() => void accountsQuery.refetch()} /></section>
    <Modal open={Boolean(account)} title={payable ? "Registrar pago" : "Registrar cobro"} description={`Saldo pendiente: ${account ? money(account.balance) : ""}`} busy={mutation.isPending} onClose={() => setAccount(null)} footer={<><button type="button" className="ghost-button" onClick={() => setAccount(null)}>Cancelar</button><button form="account-transaction-form" type="submit" className="app-button primary" disabled={mutation.isPending}>{mutation.isPending ? "Procesando..." : "Confirmar"}</button></>}>
      <form id="account-transaction-form" className="form-grid" onSubmit={(event) => void submit(event)}><label><span>Fecha</span><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label><span>Monto</span><input type="number" min="0.01" max={account?.balance} step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label><label><span>Medio de pago</span><select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option value="CASH">Efectivo</option><option value="YAPE">Yape</option><option value="PLIN">Plin</option><option value="CARD">Tarjeta</option><option value="TRANSFER">Transferencia</option></select></label>{form.method === "CASH" ? <label><span>Caja abierta</span><select required value={form.cash_session} onChange={(e) => setForm({ ...form, cash_session: e.target.value })}><option value="">Seleccionar</option>{sessionsQuery.data?.items.map((session) => <option value={session.id} key={session.id}>{session.register_name}</option>)}</select></label> : null}<label><span>Referencia</span><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></label><label><span>Numero de operacion</span><input value={form.operation_number} onChange={(e) => setForm({ ...form, operation_number: e.target.value })} /></label><label className="form-span-full"><span>Observacion</span><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label></form>
    </Modal>
  </>;
}

