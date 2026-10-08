"use client";

import Decimal from "decimal.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/features/auth/context/session-context";
import { ApiError, apiRequest } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ApiPage } from "@/features/shared/api/types";
import { Modal } from "@/features/shared/ui/modal/modal";
import { useToast } from "@/features/shared/ui/toast/toast-provider";
import { calculatePriceMetrics } from "@/features/products/utils/pricing";
import type { NamedOption, Product, ProductVariant, SupplierOption } from "@/features/products/types/api";

type ProductFormPageProps = {
  mode: "create" | "edit";
  productId?: string;
};

type QuickType =
  | "category"
  | "laboratory"
  | "unit"
  | "active_ingredient"
  | "therapeutic_action"
  | "supplier"
  | "location";

type FormState = {
  barcode: string;
  commercial_name: string;
  category: string;
  laboratory: string;
  usual_supplier: string;
  unit_of_measure: string;
  presentation: string;
  purchase_unit: string;
  purchase_factor: string;
  purchase_pack_price: string;
  sell_unit: boolean;
  unit_price: string;
  sell_blister: boolean;
  blister_units: string;
  blister_price: string;
  sell_box: boolean;
  box_price: string;
  requires_lot: boolean;
  requires_expiry: boolean;
  requires_prescription: boolean;
  is_controlled: boolean;
  earns_points: boolean;
  active_ingredient: string;
  therapeutic_action: string;
  sanitary_registration: string;
  digemid_code: string;
  health_surveillance: boolean;
  additional_info: string;
  warehouse: string;
  location_code: string;
  location_description: string;
  is_active: boolean;
};

type FormErrors = Partial<Record<keyof FormState | "sale_forms", string>>;

const baseUnits = ["UNIDAD", "tabletas", "cápsulas", "frasco", "ampolla", "sobre", "ml", "g"];
const purchaseUnits = ["Caja", "Blíster", "Unidad", "Frasco", "Paquete"];

const initialForm: FormState = {
  barcode: "",
  commercial_name: "",
  category: "",
  laboratory: "",
  usual_supplier: "",
  unit_of_measure: "tabletas",
  presentation: "",
  purchase_unit: "Caja",
  purchase_factor: "1",
  purchase_pack_price: "",
  sell_unit: true,
  unit_price: "",
  sell_blister: false,
  blister_units: "10",
  blister_price: "",
  sell_box: false,
  box_price: "",
  requires_lot: true,
  requires_expiry: true,
  requires_prescription: false,
  is_controlled: false,
  earns_points: true,
  active_ingredient: "",
  therapeutic_action: "",
  sanitary_registration: "",
  digemid_code: "",
  health_surveillance: false,
  additional_info: "",
  warehouse: "",
  location_code: "",
  location_description: "",
  is_active: true,
};

const quickTitles: Record<QuickType, string> = {
  category: "Nueva categoría",
  laboratory: "Nuevo laboratorio",
  unit: "Nueva unidad de venta",
  active_ingredient: "Nuevo principio activo",
  therapeutic_action: "Nueva acción terapéutica",
  supplier: "Nuevo proveedor habitual",
  location: "Nueva ubicación",
};

function apiMessage(error: unknown) {
  return apiErrorMessage(error, "No fue posible guardar el producto.");
}

function decimal(value: string) {
  try {
    return new Decimal(value || "0");
  } catch {
    return new Decimal(0);
  }
}

function money(value: Decimal | string | null) {
  if (value === null) return "-";
  return `S/ ${new Decimal(value || 0).toFixed(2)}`;
}

function mainVariant(product: Product) {
  return (
    product.variants.find((variant) => variant.sale_unit.toUpperCase() === "UNIDAD") ??
    product.variants.find((variant) => variant.is_active) ??
    product.variants[0]
  );
}

function barcodeOf(product: Product) {
  for (const variant of product.variants) {
    const barcode = variant.barcodes.find((item) => item.is_primary);
    if (barcode) return barcode.code;
  }
  return "";
}

function variantByUnit(product: Product, unit: string) {
  return product.variants.find((variant) => variant.sale_unit.toUpperCase() === unit);
}

function productToForm(product: Product): FormState {
  const main = mainVariant(product);
  const unit = variantByUnit(product, "UNIDAD");
  const blister = variantByUnit(product, "BLISTER");
  const box = variantByUnit(product, "CAJA");
  return {
    ...initialForm,
    barcode: barcodeOf(product),
    commercial_name: product.commercial_name,
    category: product.category,
    laboratory: product.laboratory ?? "",
    usual_supplier: product.usual_supplier ?? "",
    unit_of_measure: main?.unit_of_measure ?? "UNIDAD",
    presentation: main?.presentation ?? "",
    purchase_factor: main?.purchase_factor ?? "1",
    purchase_pack_price: main?.purchase_pack_price ?? "",
    sell_unit: Boolean(unit?.is_active),
    unit_price: unit?.base_sale_price ?? "",
    sell_blister: Boolean(blister?.is_active),
    blister_units: blister?.sale_factor ?? "10",
    blister_price: blister?.base_sale_price ?? "",
    sell_box: Boolean(box?.is_active),
    box_price: box?.base_sale_price ?? "",
    requires_lot: product.requires_lot,
    requires_expiry: product.requires_expiry,
    requires_prescription: product.requires_prescription,
    is_controlled: product.is_controlled,
    health_surveillance: product.health_surveillance,
    earns_points: product.earns_points,
    active_ingredient: product.active_ingredient ?? "",
    therapeutic_action: product.therapeutic_action ?? "",
    sanitary_registration: product.sanitary_registration,
    digemid_code: product.digemid_code,
    additional_info: product.additional_info,
    is_active: product.is_active,
  };
}

function marginFor(unitCost: Decimal | null, price: string) {
  if (!unitCost) return { gain: null, margin: null, belowCost: false };
  const salePrice = decimal(price);
  const gain = salePrice.minus(unitCost);
  return {
    gain,
    margin: unitCost.gt(0) ? gain.div(unitCost).mul(100) : null,
    belowCost: salePrice.gt(0) && salePrice.lt(unitCost),
  };
}

export function ProductFormPage({ mode, productId }: ProductFormPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const initialized = useRef(false);
  const { warehouses, branches } = useSession();
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState("");
  const [barcodeNotice, setBarcodeNotice] = useState<{ tone: "info" | "warning"; text: string; product?: Product } | null>(null);
  const [quick, setQuick] = useState<QuickType | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickDocument, setQuickDocument] = useState("");
  const [unitOptions, setUnitOptions] = useState(baseUnits);

  const productQuery = useQuery({
    queryKey: ["products", productId],
    queryFn: () => apiRequest<Product>(`${apiEndpoints.products}${productId}/`),
    enabled: mode === "edit" && Boolean(productId),
  });
  const categoriesQuery = useQuery({ queryKey: ["catalog", "categories"], queryFn: () => apiRequest<ApiPage<NamedOption>>(apiEndpoints.categories, { query: { pageSize: 100, is_active: true, ordering: "name" } }) });
  const labsQuery = useQuery({ queryKey: ["catalog", "laboratories"], queryFn: () => apiRequest<ApiPage<NamedOption>>(apiEndpoints.laboratories, { query: { pageSize: 100, is_active: true, ordering: "name" } }) });
  const ingredientsQuery = useQuery({ queryKey: ["catalog", "active-ingredients"], queryFn: () => apiRequest<ApiPage<NamedOption>>(apiEndpoints.activeIngredients, { query: { pageSize: 100, is_active: true, ordering: "name" } }) });
  const actionsQuery = useQuery({ queryKey: ["catalog", "therapeutic-actions"], queryFn: () => apiRequest<ApiPage<NamedOption>>(apiEndpoints.therapeuticActions, { query: { pageSize: 100, is_active: true, ordering: "name" } }) });
  const suppliersQuery = useQuery({ queryKey: ["catalog", "suppliers"], queryFn: () => apiRequest<ApiPage<SupplierOption>>(apiEndpoints.suppliers, { query: { pageSize: 100, is_active: true, ordering: "legal_name" } }) });

  const unitMetrics = calculatePriceMetrics(form.purchase_pack_price, form.purchase_factor, form.unit_price);
  const blisterCost = unitMetrics.unitCost ? unitMetrics.unitCost.mul(decimal(form.blister_units || "0")) : null;
  const boxCost = unitMetrics.unitCost ? unitMetrics.unitCost.mul(decimal(form.purchase_factor || "0")) : null;
  const unitMargin = marginFor(unitMetrics.unitCost, form.unit_price);
  const blisterMargin = marginFor(blisterCost, form.blister_price);
  const boxMargin = marginFor(boxCost, form.box_price);

  useEffect(() => {
    if (mode !== "edit" || !productQuery.data || initialized.current) return;
    setForm(productToForm(productQuery.data));
    initialized.current = true;
  }, [mode, productQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest<Product>(mode === "edit" ? `${apiEndpoints.products}${productId}/` : apiEndpoints.products, { method: mode === "edit" ? "PATCH" : "POST", body }),
    onSuccess: async (product) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["pos", "products"] }),
      ]);
      showToast({ tone: "success", title: mode === "edit" ? "Producto actualizado" : "Producto creado", description: product.commercial_name });
      router.push("/productos");
    },
  });

  const barcodeMutation = useMutation({
    mutationFn: (code: string) => apiRequest<Product>(apiEndpoints.productByBarcode, { query: { code } }),
  });

  const quickCreateMutation = useMutation({
    mutationFn: async ({ type, name, document }: { type: QuickType; name: string; document: string }) => {
      if (type === "unit" || type === "location") return { id: name, name };
      const endpoint = {
        category: apiEndpoints.categories,
        laboratory: apiEndpoints.laboratories,
        active_ingredient: apiEndpoints.activeIngredients,
        therapeutic_action: apiEndpoints.therapeuticActions,
        supplier: apiEndpoints.suppliers,
      }[type];
      const body = type === "supplier"
        ? { legal_name: name, trade_name: name, document_number: document, is_active: true }
        : { name, is_active: true };
      return apiRequest<NamedOption | SupplierOption>(endpoint, { method: "POST", body });
    },
    onSuccess: async (created) => {
      if (!quick) return;
      if (quick === "unit") {
        setUnitOptions((current) => current.includes(quickName) ? current : [...current, quickName]);
        field("unit_of_measure", quickName);
      } else if (quick === "location") {
        field("location_code", quickName);
        field("location_description", quickDocument);
      } else if (quick === "supplier") {
        const supplier = created as SupplierOption;
        await queryClient.invalidateQueries({ queryKey: ["catalog", "suppliers"] });
        field("usual_supplier", supplier.id);
      } else {
        const option = created as NamedOption;
        await queryClient.invalidateQueries({ queryKey: ["catalog"] });
        field(quick, option.id);
      }
      setQuick(null);
      setQuickName("");
      setQuickDocument("");
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

  async function searchBarcode() {
    const code = form.barcode.trim();
    if (!code) return;
    try {
      const product = await barcodeMutation.mutateAsync(code);
      if (mode === "edit" && product.id === productId) {
        setBarcodeNotice({ tone: "info", text: "Este código pertenece al producto actual." });
      } else {
        setBarcodeNotice({ tone: "warning", text: "Este código ya existe en otro producto.", product });
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setBarcodeNotice({ tone: "info", text: "Código disponible. Se mantendrá precargado al guardar." });
        return;
      }
      setBarcodeNotice({ tone: "warning", text: apiMessage(error) });
    }
  }

  function validate() {
    const next: FormErrors = {};
    if (!form.commercial_name.trim()) next.commercial_name = "Ingresa el nombre comercial.";
    if (!form.category) next.category = "Selecciona una categoría.";
    if (!form.unit_of_measure.trim()) next.unit_of_measure = "Selecciona la unidad base o unidad de venta.";
    if (decimal(form.purchase_factor).lte(0)) next.purchase_factor = "La cantidad contenida debe ser mayor a cero.";
    if (decimal(form.purchase_pack_price).lt(0) || !form.purchase_pack_price) next.purchase_pack_price = "Ingresa el costo de compra.";
    if (!form.sell_unit && !form.sell_blister && !form.sell_box) next.sale_forms = "Activa al menos una forma de venta.";
    if (form.sell_unit && decimal(form.unit_price).lte(0)) next.unit_price = "Ingresa el precio por unidad.";
    if (form.sell_blister && decimal(form.blister_units).lte(0)) next.blister_units = "Ingresa cuántas unidades contiene el blíster.";
    if (form.sell_blister && decimal(form.blister_price).lte(0)) next.blister_price = "Ingresa el precio por blíster.";
    if (form.sell_box && decimal(form.box_price).lte(0)) next.box_price = "Ingresa el precio por caja.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function saleVariants() {
    const variants: Record<string, unknown>[] = [];
    if (form.sell_unit) variants.push({ sale_unit: "UNIDAD", presentation: "Unidad", contains_units: "1", base_sale_price: form.unit_price });
    if (form.sell_blister) variants.push({ sale_unit: "BLISTER", presentation: `Blíster x ${form.blister_units}`, contains_units: form.blister_units, base_sale_price: form.blister_price });
    if (form.sell_box) variants.push({ sale_unit: "CAJA", presentation: `Caja x ${form.purchase_factor}`, contains_units: form.purchase_factor, base_sale_price: form.box_price });
    return variants;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setApiError("");
    if (!validate()) return;
    const firstSale = saleVariants()[0];
    const body = {
      commercial_name: form.commercial_name,
      category: form.category,
      laboratory: form.laboratory || null,
      usual_supplier: form.usual_supplier || null,
      active_ingredient: form.active_ingredient || null,
      therapeutic_action: form.therapeutic_action || null,
      sanitary_registration: form.sanitary_registration,
      digemid_code: form.digemid_code,
      tax_affectation: "TAXED",
      product_type: "MEDICINE",
      requires_lot: form.requires_lot,
      requires_expiry: form.requires_expiry,
      is_controlled: form.is_controlled,
      requires_prescription: form.requires_prescription,
      health_surveillance: form.health_surveillance,
      earns_points: form.earns_points,
      additional_info: form.additional_info,
      is_active: form.is_active,
      initial_variant: {
        presentation: form.presentation.trim() || String(firstSale.presentation ?? ""),
        unit_of_measure: form.unit_of_measure,
        sale_unit: firstSale.sale_unit,
        conversion_factor: firstSale.contains_units,
        allows_fractioning: form.sell_unit || form.sell_blister,
        minimum_stock: "0",
        purchase_pack_price: form.purchase_pack_price,
        purchase_factor: form.purchase_factor,
        sale_factor: firstSale.contains_units,
        base_sale_price: firstSale.base_sale_price,
        currency: "PEN",
        barcode: form.barcode,
        warehouse: form.warehouse || null,
        location_code: form.location_code,
        location_description: form.location_description,
      },
      sale_variants: saleVariants(),
    };
    try {
      await saveMutation.mutateAsync(body);
    } catch (error) {
      setApiError(apiMessage(error));
      showToast({ tone: "error", title: "No se pudo guardar", description: apiMessage(error) });
    }
  }

  const option = (item: NamedOption) => <option value={item.id} key={item.id}>{item.name}</option>;
  const supplierOption = (item: SupplierOption) => <option value={item.id} key={item.id}>{item.trade_name || item.legal_name}</option>;
  const hasWarehouses = branches.length > 0 && warehouses.length > 0;

  function selectWithQuick(name: keyof FormState, label: string, options: React.ReactNode, type: QuickType, required = false) {
    return (
      <label>
        <span>{label}</span>
        <div className="select-with-create">
          <select required={required} value={String(form[name])} onChange={(event) => field(name, event.target.value as never)}>
            {options}
          </select>
          <button type="button" className="mini-create-button" aria-label={`Crear ${label}`} onClick={() => setQuick(type)}>+</button>
        </div>
        {errors[name] ? <small className="field-error">{errors[name]}</small> : null}
      </label>
    );
  }

  function switchField(name: keyof FormState, label: string, title?: string) {
    return <label className="compact-check" title={title}><input type="checkbox" checked={Boolean(form[name])} onChange={(event) => field(name, event.target.checked as never)} /><span>{label}</span></label>;
  }

  function priceCard(title: string, cost: Decimal | null, price: string, margin: ReturnType<typeof marginFor>) {
    if (!price) return null;
    return <div className={`price-chip ${margin.belowCost ? "is-negative" : ""}`}><span>{title}</span><strong>{money(margin.gain)} · {margin.margin ? `${margin.margin.toFixed(2)}%` : "-"}</strong>{margin.belowCost ? <small>Precio menor al costo aproximado {money(cost)}</small> : null}</div>;
  }

  return (
    <>
      <PageHeader
        title={mode === "edit" ? "Editar producto" : "Agregar producto"}
        section="Almacen"
        current="Productos"
        actions={<Link className="ghost-button" href="/productos"><i className="fa fa-arrow-left" /> Volver</Link>}
      />

      <form className="product-form product-page-form" onSubmit={(event) => void submit(event)}>
        <section className="workspace-panel product-scan-panel">
          <label>
            <span>Escanear o ingresar código de barras</span>
            <input
              value={form.barcode}
              placeholder="Escanea con lector USB o escribe el código y presiona Enter"
              autoFocus={mode === "create"}
              onChange={(event) => field("barcode", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void searchBarcode();
                }
              }}
            />
          </label>
          <button type="button" className="ghost-button" onClick={() => void searchBarcode()} disabled={barcodeMutation.isPending}>
            {barcodeMutation.isPending ? "Buscando..." : "Buscar código"}
          </button>
          {barcodeNotice ? <div className={`scan-notice notice-${barcodeNotice.tone}`}>{barcodeNotice.text} {barcodeNotice.product ? <Link href={`/productos/${barcodeNotice.product.id}/editar`}>Abrir producto</Link> : null}</div> : null}
        </section>

        {productQuery.isLoading ? <section className="workspace-panel product-form-section"><p>Cargando producto...</p></section> : null}
        {productQuery.error ? <section className="workspace-panel product-form-section"><p className="field-error">{apiMessage(productQuery.error)}</p></section> : null}
        {apiError ? <section className="workspace-panel product-form-section"><p className="field-error">{apiError}</p></section> : null}

        <fieldset className="workspace-panel product-form-section">
          <legend>Datos del producto</legend>
          <p className="generated-code">Código interno: {mode === "edit" && productQuery.data?.internal_code ? productQuery.data.internal_code : "generado automáticamente por el sistema"}</p>
          <div className="form-grid compact-product-grid">
            <label><span>Código de barras</span><input value={form.barcode} onChange={(event) => field("barcode", event.target.value)} /></label>
            <label><span>Nombre comercial</span><input required value={form.commercial_name} onChange={(event) => field("commercial_name", event.target.value)} />{errors.commercial_name ? <small className="field-error">{errors.commercial_name}</small> : null}</label>
            {selectWithQuick("category", "Categoría", <><option value="">Seleccionar</option>{categoriesQuery.data?.items.map(option)}</>, "category", true)}
            {selectWithQuick("laboratory", "Laboratorio", <><option value="">Sin laboratorio</option>{labsQuery.data?.items.map(option)}</>, "laboratory")}
            {selectWithQuick("unit_of_measure", "Unidad base o unidad de venta", <>{unitOptions.map((unit) => <option value={unit} key={unit}>{unit}</option>)}</>, "unit", true)}
            <label><span>Presentación principal (opcional)</span><input value={form.presentation} placeholder="Se generará desde la forma de venta" onChange={(event) => field("presentation", event.target.value)} />{errors.presentation ? <small className="field-error">{errors.presentation}</small> : null}</label>
            {selectWithQuick("usual_supplier", "Proveedor habitual", <><option value="">Sin proveedor habitual</option>{suppliersQuery.data?.items.map(supplierOption)}</>, "supplier")}
          </div>
        </fieldset>

        <fieldset className="workspace-panel product-form-section">
          <legend>Presentaciones y formas de venta</legend>
          <div className="purchase-sale-grid">
            <div className="purchase-box">
              <h3>¿Cómo compras este producto?</h3>
              <div className="form-grid compact-product-grid">
                <label><span>Se compra por</span><select value={form.purchase_unit} onChange={(event) => field("purchase_unit", event.target.value)}>{purchaseUnits.map((unit) => <option value={unit} key={unit}>{unit}</option>)}</select></label>
                <label><span>La caja contiene</span><input type="number" min="0.0001" step="0.0001" value={form.purchase_factor} onChange={(event) => field("purchase_factor", event.target.value)} />{errors.purchase_factor ? <small className="field-error">{errors.purchase_factor}</small> : null}</label>
                <label><span>Costo de compra por caja</span><input type="number" min="0" step="0.0001" value={form.purchase_pack_price} onChange={(event) => field("purchase_pack_price", event.target.value)} />{errors.purchase_pack_price ? <small className="field-error">{errors.purchase_pack_price}</small> : null}</label>
              </div>
              <output className="price-calculation"><span>Costo aproximado por unidad</span><strong>{unitMetrics.unitCost ? money(unitMetrics.unitCost) : "Cantidad inválida"}</strong></output>
            </div>

            <div className="sale-box">
              <h3>¿Cómo vendes este producto?</h3>
              <div className="sale-form-list">
                <label className="sale-form-row"><input type="checkbox" checked={form.sell_unit} onChange={(event) => field("sell_unit", event.target.checked)} /><span>Por unidad</span><input aria-label="Precio por unidad" type="number" min="0.01" step="0.01" placeholder="Precio S/" value={form.unit_price} onChange={(event) => field("unit_price", event.target.value)} /></label>
                <label className="sale-form-row"><input type="checkbox" checked={form.sell_blister} onChange={(event) => field("sell_blister", event.target.checked)} /><span>Por blíster</span><input aria-label="Unidades por blíster" type="number" min="0.0001" step="0.0001" value={form.blister_units} onChange={(event) => field("blister_units", event.target.value)} /><input aria-label="Precio por blíster" type="number" min="0.01" step="0.01" placeholder="Precio S/" value={form.blister_price} onChange={(event) => field("blister_price", event.target.value)} /></label>
                <label className="sale-form-row"><input type="checkbox" checked={form.sell_box} onChange={(event) => field("sell_box", event.target.checked)} /><span>Por caja</span><input aria-label="Precio por caja" type="number" min="0.01" step="0.01" placeholder="Precio S/" value={form.box_price} onChange={(event) => field("box_price", event.target.value)} /></label>
              </div>
              {errors.sale_forms ? <small className="field-error">{errors.sale_forms}</small> : null}
              <div className="price-chip-grid">
                {form.sell_unit ? priceCard("Unidad", unitMetrics.unitCost, form.unit_price, unitMargin) : null}
                {form.sell_blister ? priceCard("Blíster", blisterCost, form.blister_price, blisterMargin) : null}
                {form.sell_box ? priceCard("Caja", boxCost, form.box_price, boxMargin) : null}
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="workspace-panel product-form-section">
          <legend>Control de inventario</legend>
          <div className="compact-check-grid">
            {switchField("requires_lot", "Maneja lotes")}
            {switchField("requires_expiry", "Controla vencimiento", "Si se activa, el producto también manejará lotes.")}
            {switchField("requires_prescription", "Venta con receta")}
            {switchField("is_controlled", "Medicamento controlado")}
            {switchField("earns_points", "Acumula puntos")}
          </div>
          {hasWarehouses ? (
            <div className="form-grid compact-product-grid">
              <label><span>Almacén</span><select value={form.warehouse} onChange={(event) => field("warehouse", event.target.value)}><option value="">Sin ubicación al crear</option>{warehouses.map((warehouse) => <option value={warehouse.id} key={warehouse.id}>{warehouse.name}</option>)}</select></label>
              {selectWithQuick("location_code", "Ubicación física", <><option value="">Sin ubicación</option>{form.location_code ? <option value={form.location_code}>{form.location_code}</option> : null}</>, "location")}
              <label><span>Descripción de ubicación</span><input value={form.location_description} onChange={(event) => field("location_description", event.target.value)} /></label>
            </div>
          ) : (
            <p className="field-warning">No hay almacenes configurados. Puedes crear el producto sin ubicación y asignarla luego. <Link href="/almacenes">Crear almacén</Link></p>
          )}
        </fieldset>

        <details className="workspace-panel product-form-section">
          <summary>Información farmacéutica y adicional</summary>
          <div className="form-grid compact-product-grid">
            {selectWithQuick("active_ingredient", "Principio activo", <><option value="">Sin principio activo</option>{ingredientsQuery.data?.items.map(option)}</>, "active_ingredient")}
            {selectWithQuick("therapeutic_action", "Acción terapéutica", <><option value="">Sin acción terapéutica</option>{actionsQuery.data?.items.map(option)}</>, "therapeutic_action")}
            <label><span>Registro sanitario</span><input value={form.sanitary_registration} title="Registro sanitario autorizado" onChange={(event) => field("sanitary_registration", event.target.value)} /></label>
            <label><span>Código DIGEMID</span><input value={form.digemid_code} title="Código de identificación DIGEMID" onChange={(event) => field("digemid_code", event.target.value)} /></label>
            {switchField("health_surveillance", "Vigilancia sanitaria")}
            <label className="form-span-full"><span>Información adicional</span><textarea value={form.additional_info} onChange={(event) => field("additional_info", event.target.value)} /></label>
          </div>
        </details>

        <div className="product-form-actions">
          <Link className="ghost-button" href="/productos">Cancelar</Link>
          <button type="submit" className="app-button primary" disabled={saveMutation.isPending}>
            <i className={`fa ${saveMutation.isPending ? "fa-circle-notch fa-spin" : "fa-save"}`} /> {saveMutation.isPending ? "Guardando..." : "Guardar producto"}
          </button>
        </div>
      </form>

      <Modal open={quick !== null} title={quick ? quickTitles[quick] : ""} size="sm" busy={quickCreateMutation.isPending} onClose={() => setQuick(null)} footer={<><button type="button" className="ghost-button" onClick={() => setQuick(null)} disabled={quickCreateMutation.isPending}>Cancelar</button><button type="button" className="app-button primary" disabled={!quickName.trim() || quickCreateMutation.isPending} onClick={() => quick ? quickCreateMutation.mutate({ type: quick, name: quickName.trim(), document: quickDocument.trim() }) : undefined}>{quickCreateMutation.isPending ? "Guardando..." : "Guardar"}</button></>}>
        <div className="quick-create-form">
          <label><span>{quick === "location" ? "Código de ubicación" : "Nombre"}</span><input value={quickName} onChange={(event) => setQuickName(event.target.value)} /></label>
          {quick === "supplier" ? <label><span>Documento opcional</span><input value={quickDocument} onChange={(event) => setQuickDocument(event.target.value)} /></label> : null}
          {quick === "location" ? <label><span>Descripción opcional</span><input value={quickDocument} onChange={(event) => setQuickDocument(event.target.value)} /></label> : null}
          {quickCreateMutation.error ? <p className="field-error">{apiMessage(quickCreateMutation.error)}</p> : null}
        </div>
      </Modal>
    </>
  );
}
