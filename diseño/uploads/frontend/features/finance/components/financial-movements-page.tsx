"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/features/auth/context/session-context";
import { apiRequest } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ApiPage } from "@/features/shared/api/types";
import type { DataTableColumn } from "@/features/shared/ui/data-table/data-table";
import { DataTable } from "@/features/shared/ui/data-table/data-table";
import { Modal } from "@/features/shared/ui/modal/modal";
import { useConfirm } from "@/features/shared/ui/confirm/confirm-provider";
import { useToast } from "@/features/shared/ui/toast/toast-provider";

type Category = { id: string; name: string; category_type: string };
type Movement = { id: string; date: string; branch_name: string; category_name: string | null; beneficiary_or_source: string; method: string; amount: string; origin: string; description: string; status: string };
type CashSession = { id: string; register_name: string };
function message(error: unknown) { return apiErrorMessage(error, "No se pudo registrar el movimiento."); }

export function FinancialMovementsPage({ kind }: { kind: "expense" | "income" }) {
  const expense = kind === "expense";
  const origin = expense ? "EXPENSE" : "ADDITIONAL_INCOME";
  const categoryType = expense ? "EXPENSE" : "INCOME";
  const { branches, activeBranchId } = useSession();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [open, setOpen] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [form, setForm] = useState({ branch: activeBranchId, category: "", date: new Date().toISOString().slice(0, 10), amount: "", method: "CASH", cash_session: "", beneficiary_or_source: "", document_number: "", reference: "", description: "" });
  const movementsQuery = useQuery({ queryKey: ["financial-movements", origin], queryFn: () => apiRequest<ApiPage<Movement>>(apiEndpoints.financialMovements, { query: { pageSize: 100, origin, ordering: "-date" } }) });
  const categoriesQuery = useQuery({ queryKey: ["financial-categories", categoryType], queryFn: () => apiRequest<ApiPage<Category>>(apiEndpoints.financialCategories, { query: { pageSize: 100, category_type: categoryType, is_active: true } }) });
  const sessionsQuery = useQuery({ queryKey: ["cash-sessions", "open"], queryFn: () => apiRequest<ApiPage<CashSession>>(apiEndpoints.cashSessions, { query: { pageSize: 100, status: "OPEN" } }) });
  const mutation = useMutation({ mutationFn: () => { const body = new FormData(); Object.entries({ ...form, origin }).forEach(([key, value]) => { if (value) body.set(key, value); }); if (attachment) body.set("attachment", attachment); return apiRequest(`${apiEndpoints.financialMovements}manual/`, { method: "POST", body }); }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["financial-movements"] }) });
  const voidMutation = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => apiRequest(`${apiEndpoints.financialMovements}${id}/void/`, { method: "POST", body: { reason } }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["financial-movements"] }) });
  async function voidMovement(row: Movement) { const accepted = await confirm({ title: "Anular movimiento", description: "Se conservara el registro y, si fue en efectivo, se generara el contramovimiento en la caja abierta.", confirmLabel: "Anular", tone: "danger" }); if (!accepted) return; try { await voidMutation.mutateAsync({ id: row.id, reason: "Anulado por el usuario desde el modulo financiero" }); showToast({ tone: "success", title: "Movimiento anulado" }); } catch (error) { showToast({ tone: "error", title: "No se pudo anular", description: message(error) }); } }
  const columns = useMemo<DataTableColumn<Movement>[]>(() => [
    { id: "date", header: "Fecha", value: (row) => row.date, sortable: true }, { id: "branch", header: "Sucursal", value: (row) => row.branch_name },
    { id: "category", header: "Categoria", value: (row) => row.category_name ?? "-" }, { id: "party", header: expense ? "Beneficiario" : "Origen", value: (row) => row.beneficiary_or_source || "-" },
    { id: "method", header: "Medio", value: (row) => row.method }, { id: "amount", header: "Monto", value: (row) => `S/ ${Number(row.amount).toFixed(2)}`, sortable: true },
    { id: "status", header: "Estado", value: (row) => row.status },
    { id: "actions", header: "Acciones", render: (row) => row.status === "ACTIVE" ? <button type="button" className="row-action-delete" title="Anular" onClick={() => void voidMovement(row)} disabled={voidMutation.isPending}><i className="fas fa-ban" /></button> : null },
  ], [expense, voidMutation.isPending]);
  async function submit(event: FormEvent) { event.preventDefault(); try { await mutation.mutateAsync(); showToast({ tone: "success", title: expense ? "Gasto registrado" : "Ingreso registrado" }); setAttachment(null); setOpen(false); } catch (error) { showToast({ tone: "error", title: "Operacion rechazada", description: message(error) }); } }
  return <><PageHeader title={expense ? "Gastos" : "Ingresos adicionales"} section="Caja y finanzas" current={expense ? "Gastos operativos" : "Otros ingresos"} actions={<button type="button" className="app-button primary" onClick={() => setOpen(true)}><i className="fa fa-plus" /> {expense ? "Nuevo gasto" : "Nuevo ingreso"}</button>} /><section className="content-panel"><DataTable rows={movementsQuery.data?.items ?? []} columns={columns} rowKey={(row) => row.id} loading={movementsQuery.isLoading} error={movementsQuery.error ? message(movementsQuery.error) : undefined} onRetry={() => void movementsQuery.refetch()} /></section><Modal open={open} title={expense ? "Registrar gasto" : "Registrar ingreso adicional"} busy={mutation.isPending} onClose={() => setOpen(false)} footer={<><button type="button" className="ghost-button" onClick={() => setOpen(false)}>Cancelar</button><button type="submit" form="financial-movement-form" className="app-button primary" disabled={mutation.isPending}>Guardar</button></>}><form id="financial-movement-form" className="form-grid" onSubmit={(event) => void submit(event)}><label><span>Fecha</span><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label><span>Sucursal</span><select required value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></label><label><span>Categoria</span><select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">Seleccionar</option>{categoriesQuery.data?.items.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label><span>Monto</span><input type="number" min="0.01" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label><label><span>Medio de pago</span><select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option value="CASH">Efectivo</option><option value="YAPE">Yape</option><option value="PLIN">Plin</option><option value="CARD">Tarjeta</option><option value="TRANSFER">Transferencia</option></select></label>{form.method === "CASH" ? <label><span>Caja abierta</span><select required value={form.cash_session} onChange={(e) => setForm({ ...form, cash_session: e.target.value })}><option value="">Seleccionar</option>{sessionsQuery.data?.items.map((session) => <option value={session.id} key={session.id}>{session.register_name}</option>)}</select></label> : null}<label><span>{expense ? "Beneficiario" : "Entidad origen"}</span><input value={form.beneficiary_or_source} onChange={(e) => setForm({ ...form, beneficiary_or_source: e.target.value })} /></label><label><span>Comprobante / operacion</span><input value={form.document_number} onChange={(e) => setForm({ ...form, document_number: e.target.value })} /></label><label><span>Archivo adjunto</span><input type="file" accept="image/*,.pdf" onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} /></label><label className="form-span-full"><span>Observacion</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label></form></Modal></>;
}
