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
import { useToast } from "@/features/shared/ui/toast/toast-provider";
import { roundDecimal } from "@/features/shared/utils/formatters";

type CashSession = { id: string; register: string; register_name: string; opened_by_name: string; status: string; opening_amount: string; expected_cash: string; counted_cash: string | null; difference: string | null; opened_at: string; closed_at: string | null };
type CashCount = { id: string; expected_breakdown: Record<string, string>; expected_cash: string; counted_cash: string; difference: string; count_type: string };
type CashRegister = { id: string; branch: string; name: string; is_active: boolean };
function message(error: unknown) { return apiErrorMessage(error, "No se pudo procesar la caja."); }
const sessionStatusLabels: Record<string, string> = { OPEN: "Abierta", CLOSING: "En cierre", CLOSED: "Cerrada", CLOSED_WITH_DIFFERENCE: "Cerrada con diferencia" };
function sessionStatusChip(status: string) {
  const tone = status === "OPEN" ? "success" : status === "CLOSED_WITH_DIFFERENCE" ? "danger" : "muted";
  return <span className={`sale-chip ${tone}`}>{sessionStatusLabels[status] ?? status}</span>;
}

export function CashOperationsPage() {
  const { activeBranchId } = useSession(); const { showToast } = useToast(); const queryClient = useQueryClient();
  const [mode, setMode] = useState<"open" | "count" | "close" | null>(null); const [session, setSession] = useState<CashSession | null>(null); const [countResult, setCountResult] = useState<CashCount | null>(null);
  const [opening, setOpening] = useState({ register: "", opening_amount: "0", notes: "" });
  const [count, setCount] = useState({ count_type: "PARTIAL", counted_cash: "", observation: "" });
  const sessionsQuery = useQuery({ queryKey: ["cash-sessions"], queryFn: () => apiRequest<ApiPage<CashSession>>(apiEndpoints.cashSessions, { query: { pageSize: 100, ordering: "-opened_at" } }) });
  const registersQuery = useQuery({ queryKey: ["cash-registers", activeBranchId], queryFn: () => apiRequest<ApiPage<CashRegister>>(apiEndpoints.cashRegisters, { query: { pageSize: 100, branch: activeBranchId, is_active: true } }), enabled: Boolean(activeBranchId) });
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ["cash-sessions"] }), queryClient.invalidateQueries({ queryKey: ["cash-registers"] })]);
  const openMutation = useMutation({ mutationFn: () => apiRequest(`${apiEndpoints.cashRegisters}open/`, { method: "POST", body: opening }), onSuccess: refresh });
  const countMutation = useMutation({ mutationFn: () => apiRequest<CashCount>(`${apiEndpoints.cashSessions}${session?.id}/counts/`, { method: "POST", body: count }), onSuccess: refresh });
  const closeMutation = useMutation({ mutationFn: () => apiRequest(`${apiEndpoints.cashSessions}${session?.id}/close/`, { method: "POST", body: { counted_cash: count.counted_cash, notes: count.observation } }), onSuccess: refresh });
  const activeRegisters = registersQuery.data?.items ?? [];
  const stats = useMemo(() => {
    const sessions = sessionsQuery.data?.items ?? [];
    const open = sessions.filter((row) => row.status === "OPEN");
    const expectedTotal = open.reduce((sum, row) => sum + Number(row.expected_cash), 0);
    const openingTotal = open.reduce((sum, row) => sum + Number(row.opening_amount), 0);
    const withDifference = sessions
      .filter((row) => row.difference !== null)
      .sort((a, b) => new Date(b.closed_at ?? b.opened_at).getTime() - new Date(a.closed_at ?? a.opened_at).getTime());
    return {
      expectedTotal,
      openingTotal,
      openLabel: open.length === 1 ? open[0].register_name : `${open.length} cajas abiertas`,
      lastDifference: withDifference[0] ?? null,
    };
  }, [sessionsQuery.data?.items]);
  async function submit(event: FormEvent) { event.preventDefault(); try { if (mode === "open") { await openMutation.mutateAsync(); showToast({ tone: "success", title: "Caja abierta" }); setMode(null); } else if (mode === "count") { const result = await countMutation.mutateAsync(); setCountResult(result); showToast({ tone: "success", title: "Arqueo registrado" }); } else { await closeMutation.mutateAsync(); showToast({ tone: "success", title: "Caja cerrada" }); setMode(null); setSession(null); } } catch (error) { showToast({ tone: "error", title: "Operacion rechazada", description: message(error) }); } }
  const columns = useMemo<DataTableColumn<CashSession>[]>(() => [
    { id: "register", header: "Caja", value: (row) => row.register_name, render: (row) => <strong>{row.register_name}</strong>, sortable: true }, { id: "opened", header: "Apertura", value: (row) => new Date(row.opened_at).toLocaleString("es-PE"), sortable: true }, { id: "user", header: "Usuario", value: (row) => row.opened_by_name }, { id: "initial", header: "Inicial", value: (row) => `S/ ${Number(row.opening_amount).toFixed(1)}`, align: "right" }, { id: "expected", header: "Efectivo esperado", value: (row) => `S/ ${Number(row.expected_cash).toFixed(1)}`, align: "right", render: (row) => <strong>S/ {Number(row.expected_cash).toFixed(1)}</strong> }, { id: "status", header: "Estado", value: (row) => row.status, render: (row) => sessionStatusChip(row.status), sortable: true }, { id: "actions", header: "Acciones", render: (row) => row.status === "OPEN" ? <div className="row-actions"><button type="button" className="ghost-button compact-button" onClick={() => { setSession(row); setCount({ count_type: "PARTIAL", counted_cash: row.expected_cash, observation: "" }); setCountResult(null); setMode("count"); }}><i className="fa fa-calculator" /> Arquear</button><button type="button" className="app-button primary compact-button" onClick={() => { setSession(row); setCount({ count_type: "FINAL", counted_cash: row.expected_cash, observation: "" }); setMode("close"); }}><i className="fa fa-lock" /> Cerrar</button></div> : null },
  ], []);
  const busy = openMutation.isPending || countMutation.isPending || closeMutation.isPending;
  return <>
    <PageHeader title="Caja actual y arqueos" description="Sesiones de caja por terminal y usuario" actions={<button type="button" className="app-button primary" onClick={() => setMode("open")}><i className="fa fa-lock-open" /> Abrir caja</button>} />
    {!sessionsQuery.isLoading ? (
      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-label">Efectivo esperado</span>
          <strong className="stat-value">S/ {stats.expectedTotal.toFixed(1)}</strong>
          <span className="stat-caption">{stats.openLabel}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Monto inicial</span>
          <strong className="stat-value">S/ {stats.openingTotal.toFixed(1)}</strong>
          <span className="stat-caption">apertura del turno</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Ultima diferencia de caja</span>
          <strong className={`stat-value ${stats.lastDifference && Number(stats.lastDifference.difference) !== 0 ? "is-warning" : ""}`}>
            S/ {Number(stats.lastDifference?.difference ?? 0).toFixed(1)}
          </strong>
          <span className="stat-caption">{stats.lastDifference ? new Date(stats.lastDifference.closed_at ?? stats.lastDifference.opened_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "sin registros"}</span>
        </div>
      </div>
    ) : null}
    <section className="workspace-panel">
      <DataTable rows={sessionsQuery.data?.items ?? []} columns={columns} rowKey={(row) => row.id} searchPlaceholder="Buscar sesion de caja" loading={sessionsQuery.isLoading} error={sessionsQuery.error ? message(sessionsQuery.error) : undefined} onRetry={() => void sessionsQuery.refetch()} emptyTitle="No hay sesiones de caja" caption="Sesiones de caja" />
    </section>
    <Modal open={mode !== null} title={mode === "open" ? "Apertura de caja" : mode === "count" ? "Arqueo de caja" : "Cierre de caja"} busy={busy} onClose={() => setMode(null)} footer={<><button type="button" className="ghost-button" onClick={() => setMode(null)}>Cancelar</button><button type="submit" form="cash-operation-form" className="app-button primary" disabled={busy}>{busy ? "Procesando..." : "Confirmar"}</button></>}><form id="cash-operation-form" className="form-grid" onSubmit={(event) => void submit(event)}>{mode === "open" ? <><label><span>Caja</span><select required value={opening.register} onChange={(e) => setOpening({ ...opening, register: e.target.value })}><option value="">Seleccionar</option>{activeRegisters.map((register) => <option value={register.id} key={register.id}>{register.name}</option>)}</select></label><label><span>Monto inicial</span><input type="number" min="0" step="0.1" required value={opening.opening_amount} onChange={(e) => setOpening({ ...opening, opening_amount: e.target.value })} onBlur={(e) => setOpening((current) => ({ ...current, opening_amount: String(roundDecimal(Number(e.target.value))) }))} /></label><label className="form-span-full"><span>Observacion</span><textarea value={opening.notes} onChange={(e) => setOpening({ ...opening, notes: e.target.value })} /></label></> : <><div className="cash-expected"><span>Efectivo esperado</span><strong>S/ {Number(session?.expected_cash ?? 0).toFixed(1)}</strong></div>{mode === "count" ? <label><span>Tipo de arqueo</span><select value={count.count_type} onChange={(e) => setCount({ ...count, count_type: e.target.value })}><option value="PARTIAL">Parcial</option><option value="FINAL">Final</option></select></label> : null}<label><span>Efectivo contado</span><input type="number" min="0" step="0.1" required value={count.counted_cash} onChange={(e) => setCount({ ...count, counted_cash: e.target.value })} onBlur={(e) => setCount((current) => ({ ...current, counted_cash: String(roundDecimal(Number(e.target.value))) }))} /></label><label className="form-span-full"><span>Observacion</span><textarea value={count.observation} onChange={(e) => setCount({ ...count, observation: e.target.value })} /></label>{countResult ? <div className="cash-count-result form-span-full"><strong>Diferencia: S/ {Number(countResult.difference).toFixed(1)}</strong>{Object.entries(countResult.expected_breakdown).map(([key, value]) => <span key={key}>{key}: S/ {Number(value).toFixed(1)}</span>)}</div> : null}</>}</form></Modal></>;
}
