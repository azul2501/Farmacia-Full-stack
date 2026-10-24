"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ApiPage } from "@/features/shared/api/types";
import { Modal } from "@/features/shared/ui/modal/modal";
import { useToast } from "@/features/shared/ui/toast/toast-provider";
import { toMoneyInput } from "@/features/shared/utils/formatters";

export type MasterProduct = {
  id: string;
  digemid_code: string;
  name: string;
  concentration: string;
  dosage_form: string;
  presentation: string;
  sanitary_registration: string;
  manufacturer: string;
  holder: string;
  active_ingredient: string;
  product_type: "MEDICINE" | "SUPPLY";
  suggested_price: string | null;
  source: string;
  in_my_catalog: boolean;
};

type AddForm = { sale_price: string; purchase_price: string; minimum_stock: string; barcode: string };
type BulkResult = { added: number; already_in_catalog: number; without_price: number; errors: { product: string }[] };
type BaseSummary = { total: number; in_my_catalog: number };

const emptyAddForm: AddForm = { sale_price: "", purchase_price: "", minimum_stock: "", barcode: "" };

function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function money(value: string | null) {
  return value ? `S/ ${Number(value).toFixed(2)}` : "";
}

function describe(product: MasterProduct) {
  return [product.concentration, product.dosage_form].filter(Boolean).join(" · ");
}

/** Buscar en el catálogo compartido (lista base y DIGEMID) y agregar el producto a la botica con su precio. */
export function MasterCatalogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MasterProduct | null>(null);
  const [form, setForm] = useState<AddForm>(emptyAddForm);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmAll, setConfirmAll] = useState(false);
  const term = useDebounced(search.trim());

  const resultsQuery = useQuery({
    queryKey: ["digemid-products", term],
    queryFn: () => apiRequest<ApiPage<MasterProduct>>(apiEndpoints.digemidProducts, { query: { search: term, pageSize: 50 } }),
    enabled: open && term.length >= 3,
    staleTime: 60_000,
  });

  const summaryQuery = useQuery({
    queryKey: ["digemid-products", "base-summary"],
    queryFn: () => apiRequest<BaseSummary>(`${apiEndpoints.digemidProducts}base-summary/`),
    enabled: open && !selected,
    staleTime: 60_000,
  });

  async function refreshCatalogs() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["pos", "products"] }),
      queryClient.invalidateQueries({ queryKey: ["digemid-products"] }),
      queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] }),
    ]);
  }

  const bulkMutation = useMutation({
    mutationFn: (body: { ids: string[] } | { all_base: true }) => apiRequest<BulkResult>(`${apiEndpoints.digemidProducts}bulk-add/`, { method: "POST", body }),
    onSuccess: async (result) => {
      const skipped = [
        result.already_in_catalog ? `${result.already_in_catalog} ya estaban` : "",
        result.without_price ? `${result.without_price} sin precio sugerido (agrégalos uno por uno)` : "",
        result.errors.length ? `${result.errors.length} con error` : "",
      ].filter(Boolean).join(" · ");
      showToast({ tone: "success", title: `${result.added} producto(s) agregado(s)`, description: skipped || "Ya están en tu catálogo; revisa sus precios cuando puedas." });
      setChecked(new Set());
      setConfirmAll(false);
      await refreshCatalogs();
    },
  });

  const addMutation = useMutation({
    mutationFn: (product: MasterProduct) => apiRequest(`${apiEndpoints.digemidProducts}${product.id}/add/`, {
      method: "POST",
      body: {
        sale_price: form.sale_price,
        ...(form.purchase_price ? { purchase_price: form.purchase_price } : {}),
        ...(form.minimum_stock ? { minimum_stock: form.minimum_stock } : {}),
        barcode: form.barcode.trim(),
      },
    }),
    onSuccess: async (_, product) => {
      showToast({ tone: "success", title: "Producto agregado", description: `${product.name} ya está en tu catálogo.` });
      setSelected(null);
      setForm(emptyAddForm);
      await refreshCatalogs();
    },
  });

  function close() {
    setSelected(null);
    setForm(emptyAddForm);
    setChecked(new Set());
    setConfirmAll(false);
    addMutation.reset();
    bulkMutation.reset();
    onClose();
  }

  function toggle(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function choose(product: MasterProduct) {
    setSelected(product);
    setForm({ ...emptyAddForm, sale_price: toMoneyInput(product.suggested_price) });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected) addMutation.mutate(selected);
  }

  const items = resultsQuery.data?.items ?? [];
  const selectable = items.filter((product) => !product.in_my_catalog);
  const allVisibleChecked = selectable.length > 0 && selectable.every((product) => checked.has(product.id));
  const summary = summaryQuery.data;
  const pendingBase = summary ? summary.total - summary.in_my_catalog : 0;
  const busy = addMutation.isPending || bulkMutation.isPending;

  function toggleAllVisible() {
    setChecked((current) => {
      const next = new Set(current);
      selectable.forEach((product) => (allVisibleChecked ? next.delete(product.id) : next.add(product.id)));
      return next;
    });
  }

  return (
    <Modal
      open={open}
      title={selected ? "Agregar a mi catálogo" : "Agregar desde el catálogo"}
      description={selected ? `${selected.name} ${describe(selected)}` : "Busca el producto; el precio sugerido ya viene puesto y lo puedes cambiar."}
      size="lg"
      busy={busy}
      onClose={close}
      footer={selected ? <>
        <button type="button" className="ghost-button" onClick={() => { setSelected(null); addMutation.reset(); }} disabled={addMutation.isPending}>Volver</button>
        <button type="submit" form="master-catalog-add" className="app-button primary" disabled={addMutation.isPending || !form.sale_price}>{addMutation.isPending ? "Agregando..." : "Agregar"}</button>
      </> : <>
        <button type="button" className="ghost-button" onClick={close} disabled={bulkMutation.isPending}>Cerrar</button>
        {checked.size ? <button type="button" className="app-button primary" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate({ ids: [...checked] })}>{bulkMutation.isPending ? "Agregando..." : `Agregar seleccionados (${checked.size})`}</button> : null}
      </>}
    >
      {selected ? (
        <form id="master-catalog-add" className="form-grid" onSubmit={submit}>
          <p className="form-span-full master-catalog-meta">
            {selected.presentation ? <span>{selected.presentation}</span> : null}
            {selected.sanitary_registration ? <span>Reg. sanitario {selected.sanitary_registration}</span> : null}
            {selected.manufacturer || selected.holder ? <span>{selected.manufacturer || selected.holder}</span> : null}
            {selected.suggested_price ? <span>Precio sugerido {money(selected.suggested_price)} (referencial)</span> : null}
          </p>
          <label><span>Precio de venta por unidad (S/)</span><input type="number" min="0.01" step="0.01" required autoFocus value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} onBlur={(event) => setForm({ ...form, sale_price: toMoneyInput(event.target.value) })} /></label>
          <label><span>Costo por unidad (opcional)</span><input type="number" min="0" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} onBlur={(event) => setForm({ ...form, purchase_price: toMoneyInput(event.target.value) })} /></label>
          <label><span>Stock mínimo (opcional)</span><input type="number" min="0" step="1" value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })} /></label>
          <label><span>Código de barras (opcional)</span><input value={form.barcode} maxLength={64} placeholder="Escanéalo aquí" onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></label>
          {addMutation.error ? <p className="form-span-full field-error">{apiErrorMessage(addMutation.error, "No se pudo agregar el producto.")}</p> : null}
        </form>
      ) : (
        <div className="master-catalog">
          {summary && pendingBase > 0 ? (
            <div className="master-catalog-bulk">
              <div>
                <strong>Lista base: {summary.total} productos con precio sugerido</strong>
                <small>Genéricos esenciales, marcas comunes e insumos. Ya tienes {summary.in_my_catalog}. Después ajustas precios y borras los que no vendas.</small>
              </div>
              {confirmAll ? (
                <div className="master-catalog-bulk-actions">
                  <button type="button" className="ghost-button" onClick={() => setConfirmAll(false)} disabled={bulkMutation.isPending}>Cancelar</button>
                  <button type="button" className="app-button primary" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate({ all_base: true })}>{bulkMutation.isPending ? "Cargando..." : `Sí, agregar ${pendingBase}`}</button>
                </div>
              ) : <button type="button" className="ghost-button" onClick={() => setConfirmAll(true)}>Cargar toda la lista ({pendingBase})</button>}
            </div>
          ) : null}
          {bulkMutation.error ? <p className="field-error">{apiErrorMessage(bulkMutation.error, "No se pudieron agregar los productos.")}</p> : null}
          <label className="master-catalog-search">
            <span>Buscar por nombre o principio activo</span>
            <input type="search" value={search} autoFocus placeholder="Ej. paracetamol 500" onChange={(e) => setSearch(e.target.value)} />
          </label>
          {term.length < 3 ? <p className="master-catalog-hint">Escribe al menos 3 letras.</p>
            : resultsQuery.isLoading ? <p className="master-catalog-hint">Buscando...</p>
            : resultsQuery.error ? <p className="field-error">{apiErrorMessage(resultsQuery.error, "No se pudo buscar en el catálogo.")}</p>
            : !items.length ? <p className="master-catalog-hint">Sin resultados. Créalo con &quot;Nuevo producto&quot;.</p>
            : (
              <>
              {selectable.length ? (
                <label className="master-catalog-check-all">
                  <input type="checkbox" checked={allVisibleChecked} onChange={toggleAllVisible} />
                  <span>Marcar todos los resultados ({selectable.length})</span>
                </label>
              ) : null}
              <ul className="master-catalog-results">
                {items.map((product) => (
                  <li key={product.id}>
                    <input type="checkbox" aria-label={`Marcar ${product.name}`} disabled={product.in_my_catalog} checked={product.in_my_catalog || checked.has(product.id)} onChange={() => toggle(product.id)} />
                    <div>
                      <strong>{product.name}</strong>
                      <small>{[describe(product), product.presentation, product.manufacturer || product.holder].filter(Boolean).join(" · ")}</small>
                      {product.sanitary_registration ? <small>Reg. sanitario {product.sanitary_registration}</small> : null}
                      {product.suggested_price ? <small>Precio sugerido {money(product.suggested_price)}</small> : null}
                    </div>
                    {product.in_my_catalog
                      ? <span className="master-catalog-added"><i className="fas fa-check" aria-hidden="true" /> En tu catálogo</span>
                      : <button type="button" className="app-button primary compact-button" onClick={() => choose(product)}>Agregar</button>}
                  </li>
                ))}
              </ul>
              </>
            )}
        </div>
      )}
    </Modal>
  );
}
