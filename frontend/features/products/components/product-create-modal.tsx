"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ApiPage } from "@/features/shared/api/types";
import { Modal } from "@/features/shared/ui/modal/modal";
import type { NamedOption, Product } from "@/features/products/types/api";
import { roundDecimal } from "@/features/shared/utils/formatters";

type QuickType = "category" | "laboratory" | "active_ingredient";

type FormState = {
  commercial_name: string;
  internal_code: string;
  category: string;
  laboratory: string;
  active_ingredient: string;
  product_type: string;
  presentation: string;
  base_sale_price: string;
  purchase_pack_price: string;
  requires_lot: boolean;
  requires_expiry: boolean;
  is_controlled: boolean;
  is_active: boolean;
};

const initialForm: FormState = {
  commercial_name: "",
  internal_code: "",
  category: "",
  laboratory: "",
  active_ingredient: "",
  product_type: "MEDICINE",
  presentation: "",
  base_sale_price: "",
  purchase_pack_price: "0",
  requires_lot: false,
  requires_expiry: false,
  is_controlled: false,
  is_active: true,
};

const quickEndpoints: Record<QuickType, string> = {
  category: apiEndpoints.categories,
  laboratory: apiEndpoints.laboratories,
  active_ingredient: apiEndpoints.activeIngredients,
};

const quickTitles: Record<QuickType, string> = {
  category: "Nueva categoria",
  laboratory: "Nuevo laboratorio",
  active_ingredient: "Nuevo principio activo",
};

function apiMessage(error: unknown) {
  return apiErrorMessage(error, "No fue posible guardar el producto.");
}

function formFromProduct(product: Product): FormState {
  return {
    ...initialForm,
    commercial_name: product.commercial_name,
    internal_code: product.internal_code,
    category: product.category,
    laboratory: product.laboratory ?? "",
    active_ingredient: product.active_ingredient ?? "",
    product_type: product.product_type,
    requires_lot: product.requires_lot,
    requires_expiry: product.requires_expiry,
    is_controlled: product.is_controlled,
    is_active: product.is_active,
  };
}

type Props = { open: boolean; onClose: () => void; product?: Product };

export function ProductCreateModal({ open, onClose, product }: Props) {
  const editing = Boolean(product);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => (product ? formFromProduct(product) : initialForm));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [apiError, setApiError] = useState("");
  const [quick, setQuick] = useState<QuickType | null>(null);
  const [quickName, setQuickName] = useState("");

  useEffect(() => {
    if (open) {
      setForm(product ? formFromProduct(product) : initialForm);
      setErrors({});
      setApiError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  const categoriesQuery = useQuery({ queryKey: ["catalog", "categories"], queryFn: () => apiRequest<ApiPage<NamedOption>>(apiEndpoints.categories, { query: { pageSize: 100, is_active: true, ordering: "name" } }) });
  const laboratoriesQuery = useQuery({ queryKey: ["catalog", "laboratories"], queryFn: () => apiRequest<ApiPage<NamedOption>>(apiEndpoints.laboratories, { query: { pageSize: 100, is_active: true, ordering: "name" } }) });
  const ingredientsQuery = useQuery({ queryKey: ["catalog", "active-ingredients"], queryFn: () => apiRequest<ApiPage<NamedOption>>(apiEndpoints.activeIngredients, { query: { pageSize: 100, is_active: true, ordering: "name" } }) });

  const quickCreateMutation = useMutation({
    mutationFn: () => apiRequest<NamedOption>(quickEndpoints[quick as QuickType], { method: "POST", body: { name: quickName.trim(), is_active: true } }),
    onSuccess: async (created) => {
      if (!quick) return;
      await queryClient.invalidateQueries({ queryKey: ["catalog", quick === "category" ? "categories" : quick === "laboratory" ? "laboratories" : "active-ingredients"] });
      field(quick, created.id);
      setQuick(null);
      setQuickName("");
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const identity = {
        commercial_name: form.commercial_name.trim(),
        internal_code: form.internal_code.trim(),
        category: form.category,
        laboratory: form.laboratory || null,
        active_ingredient: form.active_ingredient || null,
        product_type: form.product_type,
        requires_lot: form.requires_lot,
        requires_expiry: form.requires_expiry,
        is_controlled: form.is_controlled,
        is_active: form.is_active,
      };
      if (editing && product) {
        return apiRequest<Product>(`${apiEndpoints.products}${product.id}/`, { method: "PATCH", body: identity });
      }
      return apiRequest<Product>(apiEndpoints.products, {
        method: "POST",
        body: {
          ...identity,
          initial_variant: {
            presentation: form.presentation.trim(),
            unit_of_measure: "UNIT",
            sale_unit: "UNIT",
            conversion_factor: "1",
            allows_fractioning: false,
            minimum_stock: "0",
            purchase_pack_price: form.purchase_pack_price || "0",
            purchase_factor: "1",
            sale_factor: "1",
            base_sale_price: form.base_sale_price,
            currency: "PEN",
          },
        },
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["pos", "products"] }),
      ]);
      reset();
      onClose();
    },
  });

  function field<K extends keyof FormState>(name: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "requires_expiry" && value === true) next.requires_lot = true;
      if (name === "requires_lot" && value === false) next.requires_expiry = false;
      return next;
    });
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function reset() {
    setForm(initialForm);
    setErrors({});
    setApiError("");
  }

  function validate() {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.commercial_name.trim()) next.commercial_name = "Ingresa el nombre comercial.";
    if (!form.category) next.category = "Selecciona una categoria.";
    if (!editing) {
      if (!form.presentation.trim()) next.presentation = "Describe la presentacion (ej: Caja x 100 tab).";
      if (!form.base_sale_price || Number(form.base_sale_price) <= 0) next.base_sale_price = "Ingresa un precio de venta valido.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setApiError("");
    if (!validate()) return;
    try {
      await saveMutation.mutateAsync();
    } catch (error) {
      setApiError(apiMessage(error));
    }
  }

  const option = (item: NamedOption) => <option value={item.id} key={item.id}>{item.name}</option>;

  function selectWithQuick(name: "category" | "laboratory" | "active_ingredient", label: string, options: React.ReactNode, required = false) {
    return (
      <label>
        <span>{label}</span>
        <div className="select-with-create">
          <select required={required} value={form[name]} onChange={(event) => field(name, event.target.value)}>
            {options}
          </select>
          <button type="button" className="mini-create-button" aria-label={`Crear ${label}`} onClick={() => setQuick(name)}>+</button>
        </div>
        {errors[name] ? <small className="field-error">{errors[name]}</small> : null}
      </label>
    );
  }

  return (
    <>
      <Modal
        open={open}
        title={editing ? "Editar producto" : "Nuevo producto"}
        description={editing ? "Datos generales del producto. Las presentaciones y precios se administran aparte." : "Catalogo maestro. Podras agregar mas presentaciones y detalles desde Editar."}
        size="lg"
        busy={saveMutation.isPending}
        onClose={() => { if (!saveMutation.isPending) { reset(); onClose(); } }}
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => { reset(); onClose(); }} disabled={saveMutation.isPending}>Cancelar</button>
            <button type="submit" form="product-create-form" className="app-button primary" disabled={saveMutation.isPending}>
              <i className={`fas ${saveMutation.isPending ? "fa-circle-notch fa-spin" : "fa-check"}`} aria-hidden="true" /> {saveMutation.isPending ? "Guardando..." : editing ? "Guardar cambios" : "Guardar producto"}
            </button>
          </>
        }
      >
        <form id="product-create-form" className="form-grid" onSubmit={(event) => void submit(event)}>
          <span className="form-section-label">Identificacion</span>
          <label>
            <span>Codigo interno</span>
            <input placeholder="Ej: PAR-500 (automatico si lo dejas vacio)" value={form.internal_code} onChange={(event) => field("internal_code", event.target.value)} />
          </label>
          <label>
            <span>Nombre comercial *</span>
            <input required placeholder="Ej: Paracetamol 500 mg" value={form.commercial_name} onChange={(event) => field("commercial_name", event.target.value)} />
            {errors.commercial_name ? <small className="field-error">{errors.commercial_name}</small> : null}
          </label>

          <span className="form-section-label">Clasificacion</span>
          {selectWithQuick("category", "Categoria *", <><option value="">Seleccionar</option>{categoriesQuery.data?.items.map(option)}</>, true)}
          {selectWithQuick("laboratory", "Laboratorio", <><option value="">Seleccionar</option>{laboratoriesQuery.data?.items.map(option)}</>)}
          {selectWithQuick("active_ingredient", "Principio activo", <><option value="">Seleccionar</option>{ingredientsQuery.data?.items.map(option)}</>)}
          <label>
            <span>Tipo de producto *</span>
            <select required value={form.product_type} onChange={(event) => field("product_type", event.target.value)}>
              <option value="MEDICINE">Medicamento</option>
              <option value="SUPPLY">Insumo</option>
              <option value="SERVICE">Servicio</option>
            </select>
          </label>

          {!editing ? (
            <>
              <span className="form-section-label">Presentacion y precio</span>
              <label>
                <span>Presentacion *</span>
                <input required placeholder="Ej: Caja x 100 tab" value={form.presentation} onChange={(event) => field("presentation", event.target.value)} />
                {errors.presentation ? <small className="field-error">{errors.presentation}</small> : null}
              </label>
              <label>
                <span>Precio de venta *</span>
                <input required type="number" min="0.1" step="0.1" placeholder="S/" value={form.base_sale_price} onChange={(event) => field("base_sale_price", event.target.value)} onBlur={(event) => field("base_sale_price", String(roundDecimal(Number(event.target.value))))} />
                {errors.base_sale_price ? <small className="field-error">{errors.base_sale_price}</small> : null}
              </label>
              <label>
                <span>Costo de compra</span>
                <input type="number" min="0" step="0.1" placeholder="S/ (opcional)" value={form.purchase_pack_price} onChange={(event) => field("purchase_pack_price", event.target.value)} onBlur={(event) => field("purchase_pack_price", String(roundDecimal(Number(event.target.value))))} />
              </label>
            </>
          ) : null}

          <span className="form-section-label">Control sanitario</span>
          <div className="checkbox-card-grid">
            <label className="checkbox-card">
              <input type="checkbox" checked={form.requires_lot} onChange={(event) => field("requires_lot", event.target.checked)} />
              <span className="checkbox-card-copy"><strong>Requiere lote</strong><span>Obliga a registrar lote en compras</span></span>
            </label>
            <label className="checkbox-card">
              <input type="checkbox" checked={form.requires_expiry} onChange={(event) => field("requires_expiry", event.target.checked)} />
              <span className="checkbox-card-copy"><strong>Requiere vencimiento</strong><span>Controla fecha de expiracion por lote</span></span>
            </label>
            <label className="checkbox-card">
              <input type="checkbox" checked={form.is_controlled} onChange={(event) => field("is_controlled", event.target.checked)} />
              <span className="checkbox-card-copy"><strong>Medicamento controlado</strong><span>Exige receta y registro adicional</span></span>
            </label>
            <label className="checkbox-card">
              <input type="checkbox" checked={form.is_active} onChange={(event) => field("is_active", event.target.checked)} />
              <span className="checkbox-card-copy"><strong>Activo</strong><span>Disponible para venta y compra</span></span>
            </label>
          </div>

          {apiError ? <p className="field-error form-span-full">{apiError}</p> : null}
        </form>
      </Modal>

      <Modal
        open={quick !== null}
        title={quick ? quickTitles[quick] : ""}
        size="sm"
        busy={quickCreateMutation.isPending}
        onClose={() => setQuick(null)}
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => setQuick(null)} disabled={quickCreateMutation.isPending}>Cancelar</button>
            <button type="button" className="app-button primary" disabled={!quickName.trim() || quickCreateMutation.isPending} onClick={() => quickCreateMutation.mutate()}>
              {quickCreateMutation.isPending ? "Guardando..." : "Guardar"}
            </button>
          </>
        }
      >
        <div className="quick-create-form">
          <label><span>Nombre</span><input value={quickName} onChange={(event) => setQuickName(event.target.value)} autoFocus /></label>
          {quickCreateMutation.error ? <p className="field-error">{apiMessage(quickCreateMutation.error)}</p> : null}
        </div>
      </Modal>
    </>
  );
}
