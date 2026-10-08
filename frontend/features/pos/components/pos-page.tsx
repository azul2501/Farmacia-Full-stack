"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/context/session-context";
import { apiRequest, apiRequestAll, ApiError } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ApiPage } from "@/features/shared/api/types";
import { EmptyState, ErrorState, LoadingState } from "@/features/shared/ui/states/async-state";
import { useToast } from "@/features/shared/ui/toast/toast-provider";
import { roundDecimal, roundInteger, localDateIso } from "@/features/shared/utils/formatters";

type ApiVariant = {
  id: string;
  product: string;
  sku: string;
  presentation: string;
  product_name: string;
  base_sale_price: string;
  minimum_stock: string;
  is_active: boolean;
  barcodes: Array<{ id: string; code: string; is_primary: boolean }>;
};

type ApiProduct = {
  id: string;
  commercial_name: string;
  active_ingredient: string | null;
  active_ingredient_name: string | null;
  is_active: boolean;
  variants: ApiVariant[];
};

type ApiStock = {
  id: string;
  warehouse: string;
  variant: string;
  lot: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  available_quantity: string;
};

type ApiTerminal = { id: string; branch: string; name: string; is_active: boolean };
type ApiCashSession = { id: string; register: string; status: string; register_name: string };
type ApiCustomer = { id: string; full_name: string; document_number: string };
type SaleResult = { id: string; number: string; total: string; change_total: string; balance_due: string };

type CartLine = {
  variant: ApiVariant;
  productName: string;
  lot: string | null;
  batchNumber: string;
  available: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountReason: string;
};

const paymentMethods = ["CASH", "YAPE", "PLIN", "CARD", "TRANSFER"] as const;
const paymentMethodLabels: Record<(typeof paymentMethods)[number], string> = {
  CASH: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

function stockTier(available: number, minimum: number): "success" | "warning" | "danger" {
  if (available <= 0) return "danger";
  if (available <= Math.max(minimum, 1)) return "warning";
  return "success";
}

function message(error: unknown) {
  return apiErrorMessage(error, "No se pudo completar la operacion.");
}

function currency(value: number | string) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}

export function PosPage() {
  const { activeBranchId, activeWarehouseId, branches, warehouses, cashRegisters, hasPermission } = useSession();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const [addingVariantId, setAddingVariantId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>("CASH");
  const [paymentCondition, setPaymentCondition] = useState<"CASH" | "CREDIT">("CASH");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [creditPayment, setCreditPayment] = useState("0");
  const [cashReceived, setCashReceived] = useState("");
  const [result, setResult] = useState<SaleResult | null>(null);
  const checkoutKey = useRef(crypto.randomUUID());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const customerSelectRef = useRef<HTMLSelectElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setSearchPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (event.key === "F4") {
        event.preventDefault();
        customerSelectRef.current?.focus();
      } else if (event.key === "F9") {
        event.preventDefault();
        confirmButtonRef.current?.click();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const productsQuery = useQuery({
    queryKey: ["pos", "products", debouncedSearch, searchPage],
    queryFn: () => apiRequest<ApiPage<ApiProduct>>(apiEndpoints.products, {
      query: { page: searchPage, pageSize: 20, search: debouncedSearch, is_active: true },
    }),
    enabled: debouncedSearch.length >= 2,
  });

  const terminalsQuery = useQuery({ queryKey: ["pos", "terminals", activeBranchId], queryFn: () => apiRequestAll<ApiTerminal>(apiEndpoints.posTerminals, { query: { branch: activeBranchId, is_active: true } }), enabled: Boolean(activeBranchId) });
  const sessionsQuery = useQuery({ queryKey: ["pos", "cash-sessions"], queryFn: () => apiRequestAll<ApiCashSession>(apiEndpoints.cashSessions, { query: { status: "OPEN" } }) });
  const customersQuery = useQuery({ queryKey: ["pos", "customers"], queryFn: () => apiRequestAll<ApiCustomer>(apiEndpoints.customers, { query: { is_active: true } }) });

  const activeRegisterIds = useMemo(() => new Set(cashRegisters.filter((item) => item.branchId === activeBranchId).map((item) => item.id)), [activeBranchId, cashRegisters]);
  const cashSession = sessionsQuery.data?.items.find((session) => activeRegisterIds.has(session.register));
  const terminal = terminalsQuery.data?.items[0];
  const activeBranch = branches.find((branch) => branch.id === activeBranchId);
  const activeWarehouse = warehouses.find((warehouse) => warehouse.id === activeWarehouseId);
  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const discountTotal = cart.reduce((sum, line) => sum + line.discount, 0);
  const total = subtotal - discountTotal;
  const amountToPay = paymentCondition === "CASH" ? total : Math.min(total, Math.max(0, Number(creditPayment || 0)));
  const received = paymentMethod === "CASH" ? Number(cashReceived || 0) : amountToPay;
  const change = paymentCondition === "CASH" ? Math.max(0, received - total) : 0;

  const visibleProducts = useMemo(
    () => (productsQuery.data?.items ?? []).flatMap((product) =>
      product.variants.filter((variant) => variant.is_active).map((variant) => ({ product, variant })),
    ).slice(0, 20),
    [productsQuery.data],
  );

  const visibleVariantIds = visibleProducts.map(({ variant }) => variant.id).join(",");
  const stockLevelsQuery = useQuery({
    queryKey: ["pos", "stock-levels", activeWarehouseId, visibleVariantIds],
    queryFn: () => apiRequestAll<ApiStock>(apiEndpoints.stock, { query: { warehouse: activeWarehouseId, variant__in: visibleVariantIds } }),
    enabled: Boolean(activeWarehouseId) && visibleVariantIds.length > 0,
  });

  const stockByVariant = useMemo(() => {
    const map = new Map<string, { available: number; batchNumber: string | null; expiryDate: string | null }>();
    const today = localDateIso();
    for (const row of stockLevelsQuery.data?.items ?? []) {
      const available = Number(row.available_quantity);
      if (available <= 0) continue;
      if (row.expiry_date && row.expiry_date < today) continue;
      const current = map.get(row.variant);
      const isEarlier = !current?.expiryDate || (row.expiry_date && row.expiry_date < current.expiryDate);
      map.set(row.variant, {
        available: (current?.available ?? 0) + available,
        batchNumber: isEarlier ? row.batch_number : current?.batchNumber ?? row.batch_number,
        expiryDate: isEarlier ? row.expiry_date : current?.expiryDate ?? row.expiry_date,
      });
    }
    return map;
  }, [stockLevelsQuery.data]);

  async function addProduct(productName: string, variant: ApiVariant) {
    if (!activeWarehouseId) return;
    setAddingVariantId(variant.id);
    try {
      const stockPage = await queryClient.fetchQuery({
        queryKey: ["pos", "stock", activeWarehouseId, variant.id],
        queryFn: () => apiRequestAll<ApiStock>(apiEndpoints.stock, {
          query: { warehouse: activeWarehouseId, variant: variant.id, ordering: "lot__expiry_date" },
        }),
        staleTime: 0,
      });
      const today = localDateIso();
      // El backend reparte la venta entre lotes vigentes por FEFO; aqui solo se suma el stock disponible.
      const lots = stockPage.items
        .filter((item) => Number(item.available_quantity) > 0 && (!item.expiry_date || item.expiry_date >= today))
        .sort((left, right) => String(left.expiry_date ?? "9999").localeCompare(String(right.expiry_date ?? "9999")));
      const available = lots.reduce((sum, item) => sum + Number(item.available_quantity), 0);
      if (!lots.length) {
        showToast({ tone: "warning", title: "Producto sin stock vigente", description: "No existe un lote disponible para este almacen." });
        return;
      }
      const lotLabel = lots[0].batch_number
        ? `${lots[0].batch_number}${lots.length > 1 ? ` y ${lots.length - 1} lote(s) mas` : ""}`
        : "Sin lote";
      setCart((current) => {
        const existing = current.find((line) => line.variant.id === variant.id);
        if (existing) {
          if (existing.quantity + 1 > available) {
            showToast({ tone: "warning", title: "Stock insuficiente", description: `Disponible: ${available}` });
            return current;
          }
          return current.map((line) => line === existing ? { ...line, available, batchNumber: lotLabel, quantity: line.quantity + 1 } : line);
        }
        return [...current, {
          variant,
          productName,
          lot: null,
          batchNumber: lotLabel,
          available,
          quantity: 1,
          unitPrice: Number(variant.base_sale_price),
          discount: 0,
          discountReason: "",
        }];
      });
      setSearch("");
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo consultar el stock", description: message(error) });
    } finally {
      setAddingVariantId(null);
    }
  }

  async function scanBarcode(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || !search.trim()) return;
    event.preventDefault();
    try {
      const variant = await apiRequest<ApiVariant>(apiEndpoints.productVariantByBarcode, {
        query: { code: search.trim() },
      });
      await addProduct(variant.product_name, variant);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        showToast({ tone: "warning", title: "Codigo no encontrado", description: search.trim() });
      } else {
        showToast({ tone: "error", title: "No se pudo consultar el codigo", description: message(error) });
      }
    }
  }

  function changeQuantity(index: number, quantity: number) {
    setCart((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: Math.max(1, Math.min(quantity, line.available)) } : line));
  }

  const checkoutMutation = useMutation({
    mutationFn: () => {
      if (!cashSession || !terminal || !activeBranchId || !activeWarehouseId) throw new Error("Falta caja, terminal o ubicacion activa.");
      return apiRequest<SaleResult>(`${apiEndpoints.sales}checkout/`, {
        method: "POST",
        body: {
          branch: activeBranchId,
          warehouse: activeWarehouseId,
          terminal: terminal.id,
          cash_session: cashSession.id,
          customer: customerId || null,
          idempotency_key: checkoutKey.current,
          payment_condition: paymentCondition,
          payment_due_date: paymentCondition === "CREDIT" ? paymentDueDate : null,
          notes,
          items: cart.map((line) => ({ variant: line.variant.id, lot: line.lot, quantity: line.quantity, unit_price: line.unitPrice.toFixed(2), discount: line.discount.toFixed(2), discount_reason: line.discountReason })),
          payments: amountToPay > 0 ? [{ method: paymentMethod, amount: amountToPay.toFixed(2), received_amount: paymentMethod === "CASH" ? received.toFixed(2) : null }] : [],
        },
      });
    },
    onSuccess: async (sale) => {
      setResult(sale);
      checkoutKey.current = crypto.randomUUID();
      setCart([]);
      setCashReceived("");
      setCreditPayment("0");
      setPaymentDueDate("");
      setNotes("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pos", "stock"] }),
        queryClient.invalidateQueries({ queryKey: ["pos", "stock-levels"] }),
        queryClient.invalidateQueries({ queryKey: ["pos", "products"] }),
        queryClient.invalidateQueries({ queryKey: ["resource"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      showToast({ tone: "success", title: "Venta registrada", description: `Nota ${sale.number}` });
    },
    onError: (error) => showToast({ tone: "error", title: "La venta no fue registrada", description: message(error) }),
  });

  const queryError = terminalsQuery.error ?? sessionsQuery.error ?? customersQuery.error;
  const loading = terminalsQuery.isLoading || sessionsQuery.isLoading || customersQuery.isLoading;

  if (loading) return <LoadingState rows={8} />;
  if (queryError) return <ErrorState message={message(queryError)} onRetry={() => void Promise.all([terminalsQuery.refetch(), sessionsQuery.refetch(), customersQuery.refetch()])} />;

  return (
    <div className="pos-screen">
      <header className="pos-header">
        <div><h1>Punto de venta</h1><span>{activeBranch?.name} · {activeWarehouse?.name}</span></div>
        <div className={`pos-cash-status ${cashSession ? "is-open" : "is-closed"}`}><i className={`fas ${cashSession ? "fa-lock-open" : "fa-lock"}`} /> {cashSession ? cashSession.register_name : "Caja cerrada"}</div>
      </header>
      {!cashSession ? <div className="notice warning"><strong>No hay una caja abierta en esta sucursal.</strong> Abre una caja antes de registrar ventas. <Link href="/caja">Ir a Caja</Link></div> : null}
      <div className="pos-layout">
        <section className="pos-catalog">
          <label className="pos-search">
            <i className="fas fa-barcode" aria-hidden="true" />
            <input ref={searchInputRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => void scanBarcode(event)} placeholder="Buscar por nombre o escanear codigo + Enter" autoFocus />
            <span className="pos-search-hint">Enter</span>
          </label>
          {debouncedSearch.length >= 2 ? (
            <div className="pos-results">
              <div className="pos-results-header"><span>Resultados</span>{productsQuery.data ? <span>{visibleProducts.length} de {productsQuery.data.total}</span> : null}</div>
              {productsQuery.isLoading ? <LoadingState rows={4} /> : productsQuery.error ? <ErrorState message={message(productsQuery.error)} onRetry={() => void productsQuery.refetch()} /> : visibleProducts.length ? <>
                {visibleProducts.map(({ product, variant }) => {
                  const stock = stockByVariant.get(variant.id);
                  const available = stock?.available ?? 0;
                  const hasStock = available > 0;
                  const tier = stockTier(available, Number(variant.minimum_stock || 0));
                  const expiryText = stock?.expiryDate ? ` vence ${String(new Date(stock.expiryDate).getUTCMonth() + 1).padStart(2, "0")}/${new Date(stock.expiryDate).getUTCFullYear()}` : "";
                  return (
                    <button type="button" key={variant.id} onClick={() => void addProduct(product.commercial_name, variant)} disabled={addingVariantId === variant.id || !hasStock}>
                      <span>
                        <strong>{product.commercial_name}</strong>
                        <small>{variant.presentation} · SKU {variant.sku}{stock?.batchNumber ? ` · Lote ${stock.batchNumber}${expiryText}` : ""}</small>
                      </span>
                      <span>
                        <span className={`pos-stock-pill ${tier}`}>{hasStock ? `Stock ${Math.trunc(available).toLocaleString("es-PE")}` : "Sin stock"}</span>
                        <strong>{currency(variant.base_sale_price)}</strong>
                        {hasStock ? <i className="fas fa-plus" aria-hidden="true" /> : null}
                      </span>
                    </button>
                  );
                })}
                <div className="table-pagination"><button type="button" disabled={searchPage <= 1} onClick={() => setSearchPage((page) => page - 1)}>Anterior</button><span>Pagina {searchPage}</span><button type="button" disabled={searchPage * 20 >= (productsQuery.data?.total ?? 0)} onClick={() => setSearchPage((page) => page + 1)}>Siguiente</button></div>
              </> : <EmptyState title="Sin coincidencias" description="La busqueda remota no encontro productos." />}
            </div>
          ) : <EmptyState title="Escanea o busca un producto" description="Escribe al menos 2 caracteres o escanea un codigo y presiona Enter." />}
          <div className="pos-hints">
            <span><span className="pos-hint-key">F2</span> Buscar producto</span>
            <span><span className="pos-hint-key">F4</span> Cambiar cliente</span>
            <span><span className="pos-hint-key">F9</span> Confirmar venta</span>
          </div>
        </section>
        <aside className="pos-cart">
          <div className="pos-cart-title"><h2>Venta actual</h2><span>{cart.length} productos</span></div>
          <div className="pos-cart-lines">{cart.length ? cart.map((line, index) => (
            <article key={`${line.variant.id}-${line.lot}`}>
              <div>
                <div><strong className="pos-line-name">{line.productName}</strong><small>{line.variant.presentation} · Lote {line.batchNumber}</small></div>
                <strong>{currency(line.quantity * line.unitPrice - line.discount)}</strong>
              </div>
              <div className="pos-line-controls">
                <div className="pos-line-stepper">
                  <button type="button" aria-label="Reducir" onClick={() => changeQuantity(index, line.quantity - 1)}>−</button>
                  <input type="number" min="1" max={line.available} value={line.quantity} onChange={(event) => changeQuantity(index, Number(event.target.value))} onBlur={(event) => changeQuantity(index, roundInteger(Number(event.target.value)) || 1)} />
                  <button type="button" aria-label="Aumentar" onClick={() => changeQuantity(index, line.quantity + 1)}>+</button>
                </div>
                <span className="pos-line-unit-price">× {currency(line.unitPrice)}</span>
                <button type="button" className="pos-remove" aria-label="Quitar producto" onClick={() => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))}><i className="fas fa-trash-can" /></button>
              </div>
              {hasPermission("sales.discount") ? (
                <div className="pos-line-discount">
                  <input aria-label="Descuento" type="number" min="0" max={line.quantity * line.unitPrice} step="0.01" placeholder="Descuento" value={line.discount || ""} onChange={(event) => setCart((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, discount: Math.min(Math.max(0, Number(event.target.value)), item.quantity * item.unitPrice) } : item))} onBlur={(event) => setCart((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, discount: Math.min(roundDecimal(Math.max(0, Number(event.target.value))), item.quantity * item.unitPrice) } : item))} />
                  {line.discount > 0 ? <input aria-label="Motivo del descuento" placeholder="Motivo del descuento" value={line.discountReason} onChange={(event) => setCart((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, discountReason: event.target.value } : item))} /> : null}
                </div>
              ) : null}
            </article>
          )) : <EmptyState title="Carrito vacio" description="Agrega productos desde el buscador." />}</div>
          <div className="pos-checkout-fields">
            <label><span>Cliente</span><select ref={customerSelectRef} value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Publico general</option>{customersQuery.data?.items.map((customer) => <option value={customer.id} key={customer.id}>{customer.full_name}</option>)}</select></label>
            <label><span>Observacion (opcional)</span><input value={notes} maxLength={500} placeholder="Ej: entrega despues de las 5pm" onChange={(event) => setNotes(event.target.value)} /></label>
            {hasPermission("sales.credit") ? <label><span>Condicion</span><select value={paymentCondition} onChange={(event) => setPaymentCondition(event.target.value as "CASH" | "CREDIT")}><option value="CASH">Contado</option><option value="CREDIT">Credito</option></select></label> : null}
            {paymentCondition === "CREDIT" ? <><label><span>Vencimiento</span><input type="date" required value={paymentDueDate} onChange={(event) => setPaymentDueDate(event.target.value)} /></label><label><span>Pago inicial</span><input type="number" min="0" max={total} step="0.01" value={creditPayment} onChange={(event) => setCreditPayment(event.target.value)} onBlur={(event) => setCreditPayment(String(roundDecimal(Number(event.target.value))))} /></label></> : null}
            <fieldset>
              <legend>Medio de pago</legend>
              <div className="payment-methods">{paymentMethods.map((method) => <button type="button" className={paymentMethod === method ? "is-active" : ""} key={method} onClick={() => setPaymentMethod(method)}>{paymentMethodLabels[method]}</button>)}</div>
            </fieldset>
            {paymentMethod === "CASH" && amountToPay > 0 ? <label><span>Efectivo recibido</span><input type="number" min="0" step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} onBlur={(event) => setCashReceived(String(roundDecimal(Number(event.target.value))))} /></label> : null}
          </div>
          <div className="pos-totals">
            <div><span>Subtotal</span><span>{currency(subtotal)}</span></div>
            <div><span>Descuento</span><span>{currency(discountTotal)}</span></div>
            <div className="pos-total-row"><span>Total</span><strong>{currency(total)}</strong></div>
            {paymentMethod === "CASH" ? <div className="pos-change-row"><span>Vuelto</span><strong>{currency(change)}</strong></div> : null}
          </div>
          <button ref={confirmButtonRef} type="button" className="pos-confirm" disabled={!cashSession || !terminal || !cart.length || total <= 0 || cart.some((line) => line.discount > 0 && !line.discountReason.trim()) || (paymentCondition === "CREDIT" && (!customerId || !paymentDueDate)) || (paymentMethod === "CASH" && received < amountToPay) || checkoutMutation.isPending} onClick={() => checkoutMutation.mutate()}><i className={`fas ${checkoutMutation.isPending ? "fa-circle-notch fa-spin" : "fa-check"}`} /> {checkoutMutation.isPending ? "Procesando..." : "Confirmar venta"}</button>
        </aside>
      </div>
      {result ? <div className="pos-result" role="dialog" aria-modal="true"><div><i className="fas fa-check-circle" /><h2>Venta confirmada</h2><strong>{result.number}</strong><p>Total {currency(result.total)} / Vuelto {currency(result.change_total)}</p>{Number(result.balance_due) > 0 ? <p>Cuenta por cobrar: <strong>{currency(result.balance_due)}</strong></p> : null}<div><button type="button" className="ghost-button" onClick={() => setResult(null)}>Cerrar</button><button type="button" className="app-button primary" onClick={() => window.open(`/ventas/${result.id}/imprimir`, "_blank", "noopener,noreferrer")}><i className="fas fa-print" /> Imprimir</button></div></div></div> : null}
    </div>
  );
}
