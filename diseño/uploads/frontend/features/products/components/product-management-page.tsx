"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/features/auth/context/session-context";
import { apiDownload, apiRequest } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ApiPage } from "@/features/shared/api/types";
import type { DataTableColumn } from "@/features/shared/ui/data-table/data-table";
import { DataTable } from "@/features/shared/ui/data-table/data-table";
import { useConfirm } from "@/features/shared/ui/confirm/confirm-provider";
import { Modal } from "@/features/shared/ui/modal/modal";
import { useToast } from "@/features/shared/ui/toast/toast-provider";
import type { ImportPreviewResponse, Product } from "@/features/products/types/api";

function apiMessage(error: unknown) {
  return apiErrorMessage(error, "No fue posible guardar el producto.");
}

function money(value?: string) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0));
}

function primaryBarcode(product: Product) {
  for (const variant of product.variants) {
    const barcode = variant.barcodes.find((item) => item.is_primary);
    if (barcode) return barcode.code;
  }
  return "";
}

async function downloadCsv(path: string, filename: string) {
  const blob = await apiDownload(path);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ProductManagementPage() {
  const { company, hasPermission } = useSession();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [importOpen, setImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const key = ["products", company?.id];
  const productsQuery = useQuery({ queryKey: key, queryFn: () => apiRequest<ApiPage<Product>>(apiEndpoints.products, { query: { pageSize: 100, ordering: "commercial_name" } }) });

  const setActiveMutation = useMutation({
    mutationFn: ({ product, isActive }: { product: Product; isActive: boolean }) =>
      apiRequest<Product>(`${apiEndpoints.products}${product.id}/`, { method: "PATCH", body: { is_active: isActive } }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["pos", "products"] }),
    ]),
  });

  const previewMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiRequest<ImportPreviewResponse>(apiEndpoints.productImportPreview, { method: "POST", body: formData });
    },
    onSuccess: setPreview,
  });

  const commitMutation = useMutation({
    mutationFn: (rows: Record<string, unknown>[]) => apiRequest<{ created: { id: string; commercial_name: string }[] }>(apiEndpoints.productImportCommit, { method: "POST", body: { rows } }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      setImportOpen(false);
      setSelectedFile(null);
      setPreview(null);
      showToast({ tone: "success", title: "Productos importados", description: `${response.created.length} productos guardados.` });
    },
  });

  async function deactivate(product: Product) {
    if (!await confirm({ title: "Desactivar producto", description: "El producto dejara de estar disponible para nuevas operaciones, pero conservara su historial.", confirmLabel: "Desactivar", tone: "warning" })) return;
    try {
      await setActiveMutation.mutateAsync({ product, isActive: false });
      showToast({ tone: "success", title: "Producto desactivado" });
    } catch (error) { showToast({ tone: "error", title: "No se pudo desactivar", description: apiMessage(error) }); }
  }

  async function activate(product: Product) {
    try {
      await setActiveMutation.mutateAsync({ product, isActive: true });
      showToast({ tone: "success", title: "Producto reactivado" });
    } catch (error) { showToast({ tone: "error", title: "No se pudo reactivar", description: apiMessage(error) }); }
  }

  async function download(path: string, filename: string) {
    try {
      await downloadCsv(path, filename);
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo descargar", description: apiMessage(error) });
    }
  }

  async function previewImport() {
    if (!selectedFile) {
      showToast({ tone: "warning", title: "Selecciona un archivo", description: "Usa la plantilla CSV descargada desde el sistema." });
      return;
    }
    try {
      await previewMutation.mutateAsync(selectedFile);
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo validar", description: apiMessage(error) });
    }
  }

  async function commitImport() {
    const validRows = preview?.rows.filter((row) => row.valid && row.payload).map((row) => row.payload as Record<string, unknown>) ?? [];
    if (!validRows.length) return;
    try {
      await commitMutation.mutateAsync(validRows);
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo importar", description: apiMessage(error) });
    }
  }

  const columns = useMemo<DataTableColumn<Product>[]>(() => [
    { id: "code", header: "Codigo", value: (row) => row.internal_code, sortable: true },
    { id: "name", header: "Producto", value: (row) => row.commercial_name, sortable: true },
    { id: "barcode", header: "Codigo barras", value: primaryBarcode },
    { id: "lab", header: "Laboratorio", value: (row) => row.laboratory_name ?? "-", sortable: true },
    { id: "presentation", header: "Presentacion", value: (row) => row.variants[0]?.presentation ?? "-" },
    { id: "cost", header: "Costo unit.", value: (row) => money(row.variants[0]?.unit_purchase_cost), align: "right" },
    { id: "price", header: "P. venta", value: (row) => money(row.variants[0]?.base_sale_price), align: "right" },
    { id: "margin", header: "Margen", value: (row) => row.variants[0]?.margin_on_cost ? `${row.variants[0].margin_on_cost}%` : "-" },
    { id: "status", header: "Estado", value: (row) => row.is_active ? "Activo" : "Inactivo" },
    { id: "actions", header: "Acciones", render: (row) => <div className="row-actions compact-row-actions"><Link className="row-action-edit" title="Editar" href={`/productos/${row.id}/editar`}><i className="fa fa-edit" /> Editar</Link>{row.is_active ? <button type="button" className="row-action-delete" title="Desactivar" onClick={() => void deactivate(row)} disabled={setActiveMutation.isPending}><i className="fa fa-ban" /></button> : <button type="button" className="row-action-edit" title="Reactivar" onClick={() => void activate(row)} disabled={setActiveMutation.isPending}><i className="fa fa-rotate-left" /></button>}</div> },
  ], [setActiveMutation.isPending]);

  return <>
    <PageHeader
      title="Productos"
      section="Almacen"
      current="Productos"
      actions={<>
        <button type="button" className="ghost-button" onClick={() => setImportOpen(true)}><i className="fa fa-file-import" /> Importar Excel</button>
        <button type="button" className="ghost-button" onClick={() => void download(apiEndpoints.productExport, "productos.csv")}><i className="fa fa-file-export" /> Exportar Excel</button>
        <button type="button" className="ghost-button" onClick={() => void download(apiEndpoints.productTemplate, "plantilla-productos.csv")}><i className="fa fa-download" /> Descargar plantilla</button>
        <button type="button" className="ghost-button" onClick={() => void download(apiEndpoints.productStockTemplate, "plantilla-lotes-stock-inicial.csv")} title="Plantilla separada para stock inicial y lotes"><i className="fa fa-boxes-stacked" /> Plantilla lotes/stock</button>
        {hasPermission("records.create") ? <Link className="app-button primary" href="/productos/nuevo"><i className="fa fa-plus" /> Agregar producto</Link> : null}
      </>}
    />
    <section className="content-panel"><DataTable rows={productsQuery.data?.items ?? []} columns={columns} rowKey={(row) => row.id} searchText={(row) => `${row.internal_code} ${primaryBarcode(row)} ${row.commercial_name} ${row.laboratory_name ?? ""}`} loading={productsQuery.isLoading} error={productsQuery.error ? apiMessage(productsQuery.error) : undefined} onRetry={() => void productsQuery.refetch()} /></section>
    <Modal open={importOpen} title="Importar productos desde Excel" description="Usa la plantilla CSV compatible con Excel. Stock inicial y lotes se importan con otra plantilla." size="lg" busy={previewMutation.isPending || commitMutation.isPending} onClose={() => setImportOpen(false)} footer={<><button type="button" className="ghost-button" onClick={() => setImportOpen(false)} disabled={previewMutation.isPending || commitMutation.isPending}>Cerrar</button><button type="button" className="ghost-button" onClick={() => void previewImport()} disabled={!selectedFile || previewMutation.isPending}>{previewMutation.isPending ? "Validando..." : "Vista previa"}</button><button type="button" className="app-button primary" onClick={() => void commitImport()} disabled={!preview?.valid_count || commitMutation.isPending}>{commitMutation.isPending ? "Guardando..." : "Confirmar importacion"}</button></>}>
      <div className="import-panel">
        <label><span>Archivo CSV guardado desde Excel</span><input type="file" accept=".csv,text/csv" onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setPreview(null); }} /></label>
        {preview ? <div className="import-summary"><strong>{preview.valid_count} filas validas</strong><span>{preview.error_count} filas con errores</span></div> : null}
        {preview ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Fila</th><th>Producto</th><th>Codigo de barras</th><th>Estado</th><th>Errores</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.row}><td>{row.row}</td><td>{row.name}</td><td>{row.barcode || "-"}</td><td>{row.valid ? "Lista" : "Corregir"}</td><td>{row.errors.join(" · ") || "-"}</td></tr>)}</tbody></table></div> : null}
      </div>
    </Modal>
  </>;
}
