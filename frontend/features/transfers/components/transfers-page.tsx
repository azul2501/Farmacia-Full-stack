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
import { useConfirm } from "@/features/shared/ui/confirm/confirm-provider";
import { useToast } from "@/features/shared/ui/toast/toast-provider";
import { roundInteger } from "@/features/shared/utils/formatters";

type StockRow = {
  id: string;
  variant: string;
  lot: string | null;
  product_name: string;
  presentation: string;
  batch_number: string | null;
  expiry_date: string | null;
  available_quantity: string;
};

type TransferItem = {
  id: string;
  variant: string;
  lot: string | null;
  product_name: string;
  presentation: string;
  batch_number: string | null;
  requested_quantity: string;
  dispatched_quantity: string;
  received_quantity: string;
};

type Transfer = {
  id: string;
  number: string;
  status: "DRAFT" | "DISPATCHED" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";
  notes: string;
  origin_branch: string;
  origin_warehouse: string;
  destination_branch: string;
  destination_warehouse: string;
  created_at: string;
  dispatched_at: string | null;
  received_at: string | null;
  items: TransferItem[];
};

type Line = { stockId: string; requested_quantity: string };

const emptyLine: Line = { stockId: "", requested_quantity: "1" };

const statusLabels: Record<Transfer["status"], string> = {
  DRAFT: "Borrador",
  DISPATCHED: "Despachada",
  IN_TRANSIT: "En transito",
  RECEIVED: "Recibida",
  CANCELLED: "Cancelada",
};

const statusTones: Record<Transfer["status"], string> = {
  DRAFT: "neutral",
  DISPATCHED: "warning",
  IN_TRANSIT: "warning",
  RECEIVED: "success",
  CANCELLED: "danger",
};

function statusChip(status: Transfer["status"]) {
  return <span className={`sale-chip ${statusTones[status] ?? "neutral"}`}>{statusLabels[status] ?? status}</span>;
}

function message(error: unknown) {
  return apiErrorMessage(error, "No se pudo procesar la transferencia.");
}

function dateOnly(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("es-PE");
}

export function TransfersPage() {
  const { branches, warehouses, activeBranchId, hasPermission } = useSession();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const canManage = hasPermission("inventory.view") && hasPermission("records.create");

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Transfer | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<Transfer | null>(null);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({});
  const [receiveNotes, setReceiveNotes] = useState("");

  const [header, setHeader] = useState({
    origin_branch: activeBranchId,
    origin_warehouse: "",
    destination_branch: "",
    destination_warehouse: "",
    notes: "",
  });
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);

  const transfersQuery = useQuery({
    queryKey: ["transfers"],
    queryFn: () => apiRequest<ApiPage<Transfer>>(apiEndpoints.transfers, { query: { pageSize: 100, ordering: "-created_at" } }),
  });
  const originStockQuery = useQuery({
    queryKey: ["stock", "by-warehouse", header.origin_warehouse],
    enabled: Boolean(header.origin_warehouse),
    queryFn: () =>
      apiRequest<ApiPage<StockRow>>(apiEndpoints.stock, {
        query: { pageSize: 200, warehouse: header.origin_warehouse },
      }),
  });

  const branchName = (id: string) => branches.find((branch) => branch.id === id)?.name ?? id;
  const warehouseName = (id: string) => warehouses.find((warehouse) => warehouse.id === id)?.name ?? id;
  const originBranchWarehouses = warehouses.filter((warehouse) => warehouse.branchId === header.origin_branch);
  const destinationBranchWarehouses = warehouses.filter((warehouse) => warehouse.branchId === header.destination_branch);
  const availableStock = (originStockQuery.data?.items ?? []).filter((row) => Number(row.available_quantity) > 0);

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<Transfer>(apiEndpoints.transfers, {
        method: "POST",
        body: {
          origin_branch: header.origin_branch,
          origin_warehouse: header.origin_warehouse,
          destination_branch: header.destination_branch,
          destination_warehouse: header.destination_warehouse,
          notes: header.notes,
          items: lines
            .filter((line) => line.stockId)
            .map((line) => {
              const stockRow = availableStock.find((row) => row.id === line.stockId);
              return {
                variant: stockRow?.variant,
                lot: stockRow?.lot ?? null,
                requested_quantity: line.requested_quantity,
              };
            }),
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transfers"] }),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "dispatch" | "start-transit" | "cancel" }) =>
      apiRequest<Transfer>(`${apiEndpoints.transfers}${id}/${action}/`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["resource"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`${apiEndpoints.transfers}${id}/`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transfers"] }),
  });

  const receiveMutation = useMutation({
    mutationFn: () =>
      apiRequest<Transfer>(`${apiEndpoints.transfers}${receiveTarget?.id}/receive/`, {
        method: "POST",
        body: {
          notes: receiveNotes,
          items: Object.entries(receiveQuantities)
            .filter(([, quantity]) => Number(quantity) > 0)
            .map(([item_id, quantity]) => ({ item_id, quantity })),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["resource"] });
    },
  });

  function updateLine(index: number, changes: Partial<Line>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...changes } : line)));
  }

  function resetCreateForm() {
    setHeader({ origin_branch: activeBranchId, origin_warehouse: "", destination_branch: "", destination_warehouse: "", notes: "" });
    setLines([{ ...emptyLine }]);
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await createMutation.mutateAsync();
      showToast({ tone: "success", title: "Transferencia creada", description: "Quedo en borrador. Despachala cuando la mercaderia salga del almacen." });
      setCreateOpen(false);
      resetCreateForm();
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo crear la transferencia", description: message(error) });
    }
  }

  async function runAction(transfer: Transfer, action: "dispatch" | "start-transit" | "cancel") {
    const copy = {
      dispatch: {
        title: "Despachar transferencia",
        description: "Esto descontara el stock del almacen de origen. No podras editar la transferencia despues.",
        success: "Transferencia despachada",
      },
      "start-transit": {
        title: "Marcar en transito",
        description: "Confirma que la mercaderia salio hacia el almacen de destino.",
        success: "Transferencia en transito",
      },
      cancel: {
        title: "Cancelar transferencia",
        description: "Solo se puede cancelar mientras esta en borrador. No afecta stock.",
        success: "Transferencia cancelada",
      },
    }[action];
    if (!(await confirm({ title: copy.title, description: copy.description, confirmLabel: "Confirmar", tone: action === "cancel" ? "danger" : "warning" }))) return;
    try {
      await actionMutation.mutateAsync({ id: transfer.id, action });
      showToast({ tone: "success", title: copy.success });
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo completar la accion", description: message(error) });
    }
  }

  async function runDelete(transfer: Transfer) {
    if (!(await confirm({ title: "Eliminar transferencia", description: `Se eliminara la transferencia ${transfer.number}. Esta accion no se puede deshacer.`, confirmLabel: "Eliminar", tone: "danger" }))) return;
    try {
      await deleteMutation.mutateAsync(transfer.id);
      showToast({ tone: "success", title: "Transferencia eliminada" });
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo eliminar", description: message(error) });
    }
  }

  function openReceive(transfer: Transfer) {
    setReceiveTarget(transfer);
    setReceiveNotes("");
    const initial: Record<string, string> = {};
    for (const item of transfer.items) {
      const pending = Number(item.dispatched_quantity) - Number(item.received_quantity);
      initial[item.id] = pending > 0 ? String(pending) : "0";
    }
    setReceiveQuantities(initial);
  }

  async function submitReceive(event: FormEvent) {
    event.preventDefault();
    try {
      await receiveMutation.mutateAsync();
      showToast({ tone: "success", title: "Recepcion registrada", description: "El stock del almacen destino fue actualizado." });
      setReceiveTarget(null);
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo registrar la recepcion", description: message(error) });
    }
  }

  const columns = useMemo<DataTableColumn<Transfer>[]>(
    () => [
      { id: "number", header: "Numero", value: (row) => row.number, sortable: true },
      { id: "origin", header: "Origen", value: (row) => warehouseName(row.origin_warehouse) },
      { id: "destination", header: "Destino", value: (row) => warehouseName(row.destination_warehouse) },
      { id: "items", header: "Productos", value: (row) => row.items?.length ?? 0, align: "right" },
      { id: "status", header: "Estado", value: (row) => statusLabels[row.status] ?? row.status, render: (row) => statusChip(row.status) },
      { id: "created", header: "Creada", value: (row) => dateOnly(row.created_at), sortable: true },
      {
        id: "actions",
        header: "Acciones",
        render: (row) => (
          <div className="row-actions compact-row-actions">
            <button type="button" className="row-action-edit" title="Ver detalle" onClick={() => setDetail(row)}>
              <i className="fas fa-eye" />
            </button>
            {canManage && row.status === "DRAFT" ? (
              <>
                <button type="button" className="row-action-edit" title="Despachar" onClick={() => void runAction(row, "dispatch")}>
                  <i className="fas fa-truck-loading" />
                </button>
                <button type="button" className="row-action-delete" title="Cancelar" onClick={() => void runAction(row, "cancel")}>
                  <i className="fas fa-ban" />
                </button>
                <button type="button" className="row-action-delete" title="Eliminar" onClick={() => void runDelete(row)}>
                  <i className="fas fa-trash" />
                </button>
              </>
            ) : null}
            {canManage && row.status === "DISPATCHED" ? (
              <button type="button" className="row-action-edit" title="Marcar en transito" onClick={() => void runAction(row, "start-transit")}>
                <i className="fas fa-shipping-fast" />
              </button>
            ) : null}
            {canManage && row.status === "IN_TRANSIT" ? (
              <button type="button" className="app-button primary compact-button" title="Recibir" onClick={() => openReceive(row)}>
                <i className="fas fa-inbox" /> Recibir
              </button>
            ) : null}
          </div>
        ),
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
    ],
    [canManage, branches, warehouses],
  );

  return (
    <>
      <PageHeader
        title="Transferencias"
        description="Traslados de inventario entre almacenes con despacho y recepcion controlados."
        actions={
          canManage ? (
            <button type="button" className="app-button primary" onClick={() => setCreateOpen(true)}>
              <i className="fa fa-plus" /> Nueva transferencia
            </button>
          ) : undefined
        }
      />
      <section className="workspace-panel">
        <DataTable
          rows={transfersQuery.data?.items ?? []}
          columns={columns}
          rowKey={(row) => row.id}
          searchText={(row) => `${row.number} ${warehouseName(row.origin_warehouse)} ${warehouseName(row.destination_warehouse)}`}
          searchPlaceholder="Buscar transferencia"
          loading={transfersQuery.isLoading}
          error={transfersQuery.error ? message(transfersQuery.error) : undefined}
          onRetry={() => void transfersQuery.refetch()}
          emptyTitle="No hay transferencias registradas"
          emptyDescription={canManage ? "Crea una transferencia para mover stock entre almacenes." : undefined}
          caption="Transferencias"
        />
      </section>

      <Modal
        open={createOpen}
        title="Nueva transferencia"
        description="Selecciona el almacen de origen para ver el stock disponible que puedes transferir."
        size="xl"
        busy={createMutation.isPending}
        onClose={() => { setCreateOpen(false); resetCreateForm(); }}
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>Cancelar</button>
            <button type="submit" form="transfer-form" className="app-button primary" disabled={createMutation.isPending}>Guardar borrador</button>
          </>
        }
      >
        <form id="transfer-form" className="purchase-form" onSubmit={(event) => void submitCreate(event)}>
          <fieldset>
            <legend>Origen y destino</legend>
            <div className="form-grid">
              <label>
                <span>Sucursal origen</span>
                <select required value={header.origin_branch} onChange={(e) => setHeader({ ...header, origin_branch: e.target.value, origin_warehouse: "" })}>
                  <option value="">Seleccionar</option>
                  {branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}
                </select>
              </label>
              <label>
                <span>Almacen origen</span>
                <select required value={header.origin_warehouse} onChange={(e) => setHeader({ ...header, origin_warehouse: e.target.value })}>
                  <option value="">Seleccionar</option>
                  {originBranchWarehouses.map((warehouse) => <option value={warehouse.id} key={warehouse.id}>{warehouse.name}</option>)}
                </select>
              </label>
              <label>
                <span>Sucursal destino</span>
                <select required value={header.destination_branch} onChange={(e) => setHeader({ ...header, destination_branch: e.target.value, destination_warehouse: "" })}>
                  <option value="">Seleccionar</option>
                  {branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}
                </select>
              </label>
              <label>
                <span>Almacen destino</span>
                <select required value={header.destination_warehouse} onChange={(e) => setHeader({ ...header, destination_warehouse: e.target.value })}>
                  <option value="">Seleccionar</option>
                  {destinationBranchWarehouses.map((warehouse) => <option value={warehouse.id} key={warehouse.id}>{warehouse.name}</option>)}
                </select>
              </label>
              <label className="form-span-full">
                <span>Observacion</span>
                <textarea value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Productos a transferir</legend>
            {!header.origin_warehouse ? (
              <p className="form-hint">Elige primero el almacen de origen para ver el stock disponible.</p>
            ) : availableStock.length === 0 && !originStockQuery.isLoading ? (
              <p className="form-hint">Este almacen no tiene stock disponible para transferir.</p>
            ) : null}
            <div className="purchase-lines">
              {lines.map((line, index) => {
                const stockRow = availableStock.find((row) => row.id === line.stockId);
                return (
                  <div className="purchase-line" key={index}>
                    <label>
                      <span>Producto / lote disponible</span>
                      <select required value={line.stockId} disabled={!header.origin_warehouse} onChange={(e) => updateLine(index, { stockId: e.target.value })}>
                        <option value="">Seleccionar</option>
                        {availableStock.map((row) => (
                          <option value={row.id} key={row.id}>
                            {row.product_name} - {row.presentation}{row.batch_number ? ` (Lote ${row.batch_number})` : ""} - Disp. {Number(row.available_quantity).toLocaleString("es-PE")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Cantidad</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        max={stockRow?.available_quantity}
                        required
                        value={line.requested_quantity}
                        onChange={(e) => updateLine(index, { requested_quantity: e.target.value })}
                        onBlur={(e) => updateLine(index, { requested_quantity: String(roundInteger(Number(e.target.value)) || 1) })}
                      />
                    </label>
                    <button type="button" className="row-action-delete" title="Quitar" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>
                      <i className="fa fa-trash" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" className="ghost-button" onClick={() => setLines((current) => [...current, { ...emptyLine }])}>
              <i className="fa fa-plus" /> Agregar producto
            </button>
          </fieldset>
        </form>
      </Modal>

      <Modal
        open={Boolean(detail)}
        title={detail ? `Transferencia ${detail.number}` : "Detalle"}
        description={detail ? `${warehouseName(detail.origin_warehouse)} -> ${warehouseName(detail.destination_warehouse)} - ${statusLabels[detail.status]}` : undefined}
        size="lg"
        onClose={() => setDetail(null)}
        footer={<button type="button" className="ghost-button" onClick={() => setDetail(null)}>Cerrar</button>}
      >
        {detail ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Producto</th><th>Lote</th><th>Solicitado</th><th>Despachado</th><th>Recibido</th></tr></thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name} - {item.presentation}</td>
                    <td>{item.batch_number ?? "-"}</td>
                    <td>{Number(item.requested_quantity).toLocaleString("es-PE")}</td>
                    <td>{Number(item.dispatched_quantity).toLocaleString("es-PE")}</td>
                    <td>{Number(item.received_quantity).toLocaleString("es-PE")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.notes ? <p className="form-hint">Observacion: {detail.notes}</p> : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(receiveTarget)}
        title={receiveTarget ? `Recibir transferencia ${receiveTarget.number}` : "Recibir"}
        description="Indica la cantidad realmente recibida por producto. Puede ser parcial; lo pendiente queda para una siguiente recepcion."
        busy={receiveMutation.isPending}
        onClose={() => setReceiveTarget(null)}
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => setReceiveTarget(null)}>Cancelar</button>
            <button form="transfer-receive-form" type="submit" className="app-button primary" disabled={receiveMutation.isPending}>Confirmar recepcion</button>
          </>
        }
      >
        <form id="transfer-receive-form" className="form-grid" onSubmit={(event) => void submitReceive(event)}>
          {receiveTarget?.items.map((item) => {
            const pending = Number(item.dispatched_quantity) - Number(item.received_quantity);
            if (pending <= 0) return null;
            return (
              <label key={item.id}>
                <span>{item.product_name} - {item.presentation}{item.batch_number ? ` (Lote ${item.batch_number})` : ""} - Pendiente {pending.toLocaleString("es-PE")}</span>
                <input
                  type="number"
                  min="0"
                  max={pending}
                  step="1"
                  value={receiveQuantities[item.id] ?? "0"}
                  onChange={(e) => setReceiveQuantities((current) => ({ ...current, [item.id]: e.target.value }))}
                  onBlur={(e) => setReceiveQuantities((current) => ({ ...current, [item.id]: String(Math.min(roundInteger(Number(e.target.value)), pending)) }))}
                />
              </label>
            );
          })}
          <label className="form-span-full">
            <span>Observacion</span>
            <textarea value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)} />
          </label>
        </form>
      </Modal>
    </>
  );
}
