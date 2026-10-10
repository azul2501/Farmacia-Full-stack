"use client";

import Decimal from "decimal.js";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/features/auth/context/session-context";
import { apiRequest, apiRequestAll } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { invalidateOperationalData } from "@/features/shared/api/invalidate";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import { roundDecimal, roundInteger, localDateIso, formatDate } from "@/features/shared/utils/formatters";
import type { ApiPage } from "@/features/shared/api/types";
import type { DataTableColumn } from "@/features/shared/ui/data-table/data-table";
import { DataTable } from "@/features/shared/ui/data-table/data-table";
import { Modal } from "@/features/shared/ui/modal/modal";
import { useConfirm } from "@/features/shared/ui/confirm/confirm-provider";
import { useToast } from "@/features/shared/ui/toast/toast-provider";

type Supplier = { id: string; legal_name: string; trade_name: string };
type Variant = { id: string; product_name: string; sku: string; presentation: string; purchase_factor: string; purchase_pack_price: string; requires_lot?: boolean; requires_expiry?: boolean };
type Purchase = { id: string; document_number: string; document_date: string; supplier_name: string; warehouse_name: string; payment_condition: string; payment_due_date: string | null; status: string; total: string };
type CashSession = { id: string; register: string; register_name: string };
type Line = { variant: string; pack_quantity: string; purchase_pack_price: string; purchase_factor: string; discount: string; tax: string; expiry_date: string; batch_number: string };
type PurchaseDetail = Purchase & {
  supplier: string;
  branch: string;
  destination_warehouse: string;
  document_type: string;
  payment_method: string;
  cash_session: string | null;
  notes: string;
  items: Array<Line & { product_name: string; presentation: string; batch_number: string }>;
};
const emptyLine: Line = { variant: "", pack_quantity: "1", purchase_pack_price: "0", purchase_factor: "1", discount: "0", tax: "0", expiry_date: "", batch_number: "" };
function message(error: unknown) { return apiErrorMessage(error, "No se pudo procesar la compra."); }
const purchaseStatusLabels: Record<string, string> = { DRAFT: "Borrador", CONFIRMED: "Confirmada", CANCELLED: "Cancelada" };
function purchaseStatusChip(status: string) {
  const tone = status === "CONFIRMED" ? "success" : status === "CANCELLED" ? "danger" : "warning";
  return <span className={`sale-chip ${tone}`}>{purchaseStatusLabels[status] ?? status}</span>;
}
function purchaseConditionChip(condition: string) {
  const credit = condition === "CREDIT";
  return <span className={`sale-chip ${credit ? "warning" : "neutral"}`}>{credit ? "Crédito" : "Contado"}</span>;
}

export function PurchasesPage() {
  const { branches, warehouses, cashRegisters, activeBranchId, activeWarehouseId } = useSession();
  const { showToast } = useToast(); const { confirm } = useConfirm(); const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const emptyHeader = { supplier: "", branch: activeBranchId, destination_warehouse: activeWarehouseId ?? "", document_type: "INVOICE", document_number: "", document_date: localDateIso(), payment_condition: "CASH", payment_due_date: "", payment_method: "TRANSFER", cash_session: "", payment_reference: "", notes: "" };
  const [header, setHeader] = useState(emptyHeader);
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const purchasesQuery = useQuery({ queryKey: ["purchases"], queryFn: () => apiRequestAll<Purchase>(apiEndpoints.purchases, { query: { ordering: "-document_date" } }) });
  const suppliersQuery = useQuery({ queryKey: ["suppliers", "options"], queryFn: () => apiRequestAll<Supplier>(apiEndpoints.suppliers, { query: { is_active: true } }) });
  const variantsQuery = useQuery({ queryKey: ["variants", "purchase-options"], queryFn: () => apiRequestAll<Variant>(apiEndpoints.productVariants, { query: { is_active: true } }) });
  const sessionsQuery = useQuery({ queryKey: ["cash-sessions", "open"], queryFn: () => apiRequestAll<CashSession>(apiEndpoints.cashSessions, { query: { status: "OPEN" } }) });
  const detailQuery = useQuery({
    queryKey: ["purchases", "detail", detailId],
    queryFn: () => apiRequest<PurchaseDetail>(`${apiEndpoints.purchases}${detailId}/`),
    enabled: Boolean(detailId),
  });
  const branchWarehouses = warehouses.filter((warehouse) => warehouse.branchId === header.branch);
  const registerIds = new Set(cashRegisters.filter((register) => register.branchId === header.branch).map((register) => register.id));
  const sessions = sessionsQuery.data?.items.filter((session) => registerIds.has(session.register)) ?? [];
  const total = lines.reduce((sum, line) => sum.plus(new Decimal(line.pack_quantity || 0).mul(line.purchase_pack_price || 0).minus(line.discount || 0).plus(line.tax || 0)), new Decimal(0));
  const saveMutation = useMutation({
    mutationFn: () => {
      const body = { ...header, payment_due_date: header.payment_condition === "CREDIT" ? header.payment_due_date : null, payment_method: header.payment_condition === "CASH" ? header.payment_method : "", cash_session: header.payment_condition === "CASH" && header.payment_method === "CASH" ? header.cash_session : null, items: lines.map((line) => ({ ...line, expiry_date: line.expiry_date || null })) };
      return editingId
        ? apiRequest<Purchase>(`${apiEndpoints.purchases}${editingId}/`, { method: "PATCH", body })
        : apiRequest<Purchase>(apiEndpoints.purchases, { method: "POST", body });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchases"] }),
  });
  const confirmMutation = useMutation({ mutationFn: (id: string) => apiRequest(`${apiEndpoints.purchases}${id}/receive/`, { method: "POST" }), onSuccess: () => invalidateOperationalData(queryClient) });
  const cancelMutation = useMutation({ mutationFn: (id: string) => apiRequest(`${apiEndpoints.purchases}${id}/cancel/`, { method: "POST" }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchases"] }) });
  function updateLine(index: number, changes: Partial<Line>) { setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...changes } : line)); }
  function variantById(variantId: string) { return variantsQuery.data?.items.find((item) => item.id === variantId); }
  function chooseVariant(index: number, variantId: string) { const variant = variantsQuery.data?.items.find((item) => item.id === variantId); updateLine(index, { variant: variantId, purchase_factor: variant?.purchase_factor ?? "1", purchase_pack_price: variant?.purchase_pack_price ?? "0" }); }
  function closeModal() { setOpen(false); setEditingId(null); setHeader(emptyHeader); setLines([{ ...emptyLine }]); }
  async function save(event: FormEvent) { event.preventDefault(); try { await saveMutation.mutateAsync(); showToast({ tone: "success", title: editingId ? "Compra actualizada" : "Compra guardada como borrador" }); closeModal(); } catch (error) { showToast({ tone: "error", title: "No se pudo guardar", description: message(error) }); } }
  async function openEdit(purchase: Purchase) {
    setLoadingEdit(true);
    try {
      const detail = await apiRequest<PurchaseDetail>(`${apiEndpoints.purchases}${purchase.id}/`);
      setHeader({
        supplier: detail.supplier,
        branch: detail.branch,
        destination_warehouse: detail.destination_warehouse,
        document_type: detail.document_type,
        document_number: detail.document_number,
        document_date: detail.document_date,
        payment_condition: detail.payment_condition,
        payment_due_date: detail.payment_due_date ?? "",
        payment_method: detail.payment_method || "TRANSFER",
        cash_session: detail.cash_session ?? "",
        payment_reference: "",
        notes: detail.notes ?? "",
      });
      setLines(detail.items.map((item) => ({
        variant: item.variant,
        pack_quantity: item.pack_quantity,
        purchase_pack_price: item.purchase_pack_price,
        purchase_factor: item.purchase_factor,
        discount: item.discount,
        tax: item.tax,
        expiry_date: item.expiry_date ?? "",
        batch_number: item.batch_number ?? "",
      })));
      setEditingId(purchase.id);
      setOpen(true);
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo cargar la compra", description: message(error) });
    } finally {
      setLoadingEdit(false);
    }
  }
  async function confirmPurchase(purchase: Purchase) { if (!await confirm({ title: "Confirmar recepción", description: "Esta operación creará lotes, stock, kardex y el pago o cuenta por pagar. No podrá editarse después.", confirmLabel: "Confirmar compra", tone: "warning" })) return; try { await confirmMutation.mutateAsync(purchase.id); showToast({ tone: "success", title: "Compra confirmada", description: "Stock, kardex y finanzas actualizados." }); } catch (error) { showToast({ tone: "error", title: "No se pudo confirmar", description: message(error) }); } }
  async function cancelPurchase(purchase: Purchase) { if (!await confirm({ title: "Anular borrador", description: `La compra ${purchase.document_number} quedará anulada. No mueve stock ni finanzas porque aun no fue confirmada.`, confirmLabel: "Anular compra", tone: "danger" })) return; try { await cancelMutation.mutateAsync(purchase.id); showToast({ tone: "success", title: "Compra anulada" }); } catch (error) { showToast({ tone: "error", title: "No se pudo anular", description: message(error) }); } }
  const columns = useMemo<DataTableColumn<Purchase>[]>(() => [
    { id: "date", header: "Fecha", value: (row) => row.document_date, render: (row) => formatDate(`${row.document_date}T00:00:00`), sortable: true }, { id: "doc", header: "Documento", value: (row) => row.document_number }, { id: "supplier", header: "Proveedor", value: (row) => row.supplier_name }, { id: "warehouse", header: "Almacén", value: (row) => row.warehouse_name }, { id: "condition", header: "Condición", value: (row) => row.payment_condition, render: (row) => purchaseConditionChip(row.payment_condition) }, { id: "total", header: "Total", value: (row) => `S/ ${Number(row.total).toFixed(2)}`, align: "right" }, { id: "status", header: "Estado", value: (row) => row.status, render: (row) => purchaseStatusChip(row.status) }, { id: "actions", header: "Acciones", render: (row) => <div className="row-actions compact-row-actions"><button type="button" className="row-action-edit" title="Ver detalle" onClick={() => setDetailId(row.id)}><i className="fas fa-eye" /></button>{row.status === "DRAFT" ? <><button type="button" className="row-action-edit" title="Editar" onClick={() => void openEdit(row)} disabled={loadingEdit}><i className="fa fa-edit" /></button><button type="button" className="app-button primary compact-button" onClick={() => void confirmPurchase(row)} disabled={confirmMutation.isPending}><i className="fa fa-check" /> Confirmar</button><button type="button" className="row-action-delete" title="Anular borrador" onClick={() => void cancelPurchase(row)} disabled={cancelMutation.isPending}><i className="fa fa-ban" /></button></> : null}</div> },
  ], [confirmMutation.isPending, cancelMutation.isPending, loadingEdit]);
  return <><PageHeader title="Compras de mercaderia" description="La compra se guarda en borrador antes de confirmar la recepción." actions={<button type="button" className="app-button primary" onClick={() => { setHeader(emptyHeader); setLines([{ ...emptyLine }]); setEditingId(null); setOpen(true); }}><i className="fa fa-plus" /> Nueva compra</button>} /><section className="workspace-panel"><DataTable rows={purchasesQuery.data?.items ?? []} columns={columns} rowKey={(row) => row.id} searchPlaceholder="Buscar compra" loading={purchasesQuery.isLoading} error={purchasesQuery.error ? message(purchasesQuery.error) : undefined} onRetry={() => void purchasesQuery.refetch()} emptyTitle="No hay compras registradas" caption="Compras" /></section><Modal open={open} title={editingId ? "Editar compra" : "Nueva compra"} description="La compra se guarda en borrador antes de confirmar la recepción." size="xl" busy={saveMutation.isPending} onClose={closeModal} footer={<><button type="button" className="ghost-button" onClick={closeModal}>Cancelar</button><button type="submit" form="purchase-form" className="app-button primary" disabled={saveMutation.isPending}>{editingId ? "Guardar cambios" : "Guardar borrador"}</button></>}><form id="purchase-form" className="purchase-form" onSubmit={(event) => void save(event)}><fieldset><legend>Proveedor y documento</legend><div className="form-grid"><label><span>Proveedor</span><select required value={header.supplier} onChange={(e) => setHeader({ ...header, supplier: e.target.value })}><option value="">Seleccionar</option>{suppliersQuery.data?.items.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.trade_name || supplier.legal_name}</option>)}</select></label><label><span>Fecha</span><input type="date" required value={header.document_date} onChange={(e) => setHeader({ ...header, document_date: e.target.value })} /></label><label><span>Tipo documento</span><select value={header.document_type} onChange={(e) => setHeader({ ...header, document_type: e.target.value })}><option value="INVOICE">Factura</option><option value="RECEIPT">Boleta</option><option value="OTHER">Otro</option></select></label><label><span>Número</span><input required value={header.document_number} onChange={(e) => setHeader({ ...header, document_number: e.target.value })} /></label><label className="form-span-full"><span>Observación (opcional)</span><textarea value={header.notes} maxLength={500} onChange={(e) => setHeader({ ...header, notes: e.target.value })} /></label></div></fieldset><fieldset><legend>Destino y condición de pago</legend><div className="form-grid"><label><span>Sucursal</span><select required value={header.branch} onChange={(e) => setHeader({ ...header, branch: e.target.value, destination_warehouse: "" })}>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></label><label><span>Almacén destino</span><select required value={header.destination_warehouse} onChange={(e) => setHeader({ ...header, destination_warehouse: e.target.value })}><option value="">Seleccionar</option>{branchWarehouses.map((warehouse) => <option value={warehouse.id} key={warehouse.id}>{warehouse.name}</option>)}</select></label><label><span>Condición</span><select value={header.payment_condition} onChange={(e) => setHeader({ ...header, payment_condition: e.target.value })}><option value="CASH">Contado</option><option value="CREDIT">Crédito</option></select></label>{header.payment_condition === "CREDIT" ? <label><span>Vencimiento</span><input type="date" required value={header.payment_due_date} onChange={(e) => setHeader({ ...header, payment_due_date: e.target.value })} /></label> : <><label><span>Medio de pago</span><select value={header.payment_method} onChange={(e) => setHeader({ ...header, payment_method: e.target.value })}><option value="CASH">Efectivo</option><option value="TRANSFER">Transferencia</option><option value="YAPE">Yape</option><option value="PLIN">Plin</option><option value="CARD">Tarjeta</option></select></label>{header.payment_method === "CASH" ? <label><span>Caja abierta</span><select required value={header.cash_session} onChange={(e) => setHeader({ ...header, cash_session: e.target.value })}><option value="">Seleccionar</option>{sessions.map((session) => <option value={session.id} key={session.id}>{session.register_name}</option>)}</select></label> : null}</>}</div></fieldset><fieldset><legend>Detalle de mercaderia</legend><div className="purchase-lines">{lines.map((line, index) => <div className="purchase-line" key={index}><label><span>Producto / presentación</span><select required value={line.variant} onChange={(e) => chooseVariant(index, e.target.value)}><option value="">Seleccionar</option>{variantsQuery.data?.items.map((variant) => <option value={variant.id} key={variant.id}>{variant.product_name} - {variant.presentation}</option>)}</select></label><label><span>Empaques</span><input type="number" min="1" step="1" required value={line.pack_quantity} onChange={(e) => updateLine(index, { pack_quantity: e.target.value })} onBlur={(e) => updateLine(index, { pack_quantity: String(roundInteger(Number(e.target.value)) || 1) })} /></label><label><span>Precio empaque</span><input type="number" min="0" step="0.01" required value={line.purchase_pack_price} onChange={(e) => updateLine(index, { purchase_pack_price: e.target.value })} onBlur={(e) => updateLine(index, { purchase_pack_price: String(roundDecimal(Number(e.target.value))) })} /></label><label><span>Factor</span><input type="number" min="1" step="1" required value={line.purchase_factor} onChange={(e) => updateLine(index, { purchase_factor: e.target.value })} onBlur={(e) => updateLine(index, { purchase_factor: String(roundInteger(Number(e.target.value)) || 1) })} /></label><label><span>Lote del fabricante</span><input value={line.batch_number} maxLength={80} placeholder="Ej. L2401 (opcional)" onChange={(e) => updateLine(index, { batch_number: e.target.value.toUpperCase() })} /></label><label><span>Vencimiento{variantById(line.variant)?.requires_expiry ? " *" : ""}</span><input type="date" required={Boolean(variantById(line.variant)?.requires_expiry)} min={localDateIso()} value={line.expiry_date} onChange={(e) => updateLine(index, { expiry_date: e.target.value })} /></label><label><span>Descuento</span><input type="number" min="0" step="0.01" value={line.discount} onChange={(e) => updateLine(index, { discount: e.target.value })} onBlur={(e) => updateLine(index, { discount: String(roundDecimal(Number(e.target.value))) })} /></label><label><span>IGV</span><input type="number" min="0" step="0.01" value={line.tax} onChange={(e) => updateLine(index, { tax: e.target.value })} onBlur={(e) => updateLine(index, { tax: String(roundDecimal(Number(e.target.value))) })} /></label><button type="button" className="row-action-delete" title="Quitar" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}><i className="fa fa-trash" /></button></div>)}</div><button type="button" className="ghost-button" onClick={() => setLines((current) => [...current, { ...emptyLine }])}><i className="fa fa-plus" /> Agregar producto</button><div className="purchase-total"><span>Total calculado</span><strong>S/ {total.toFixed(2)}</strong></div></fieldset></form></Modal>
    <Modal
      open={detailId !== null}
      title={detailQuery.data ? `Compra ${detailQuery.data.document_number}` : "Detalle de compra"}
      description="Productos recibidos y lote asignado a cada uno."
      size="lg"
      onClose={() => setDetailId(null)}
      footer={<button type="button" className="ghost-button" onClick={() => setDetailId(null)}>Cerrar</button>}
    >
      {detailQuery.isLoading ? <p>Cargando...</p> : null}
      {detailQuery.error ? <p className="field-error">{message(detailQuery.error)}</p> : null}
      {detailQuery.data ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Producto</th><th>Presentación</th><th>Lote</th><th>Vencimiento</th><th>Cantidad</th><th>Costo</th></tr></thead>
            <tbody>
              {detailQuery.data.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.product_name}</td>
                  <td>{item.presentation}</td>
                  <td>{item.batch_number || <span className="sale-chip warning">Pendiente de recibir</span>}</td>
                  <td>{item.expiry_date || "-"}</td>
                  <td>{item.pack_quantity}</td>
                  <td>S/ {Number(item.purchase_pack_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Modal>
  </>;
}
