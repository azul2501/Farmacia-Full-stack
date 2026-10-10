"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/features/shared/api/client";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import { ErrorState, LoadingState } from "@/features/shared/ui/states/async-state";
import { useSession } from "@/features/auth/context/session-context";

type SaleDetail = {
  id: string;
  number: string;
  sold_at: string;
  branch_name: string;
  cashier_name: string;
  customer_name: string | null;
  subtotal: string;
  discount_total: string;
  total: string;
  change_total: string;
  notes: string;
  items: Array<{ id: string; product_name: string; presentation: string; batch_number: string | null; quantity: string; unit_price: string; discount: string; line_total: string }>;
  payments: Array<{ id: string; method: string; amount: string; received_amount: string | null; reference: string }>;
};

function money(value: string) {
  return new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}

function integer(value: string) {
  return Math.round(Number(value)).toLocaleString("es-PE");
}

export function SalePrintPage({ saleId }: { saleId: string }) {
  const { company } = useSession();
  const [paper, setPaper] = useState<"thermal" | "a4">("thermal");
  const saleQuery = useQuery({
    queryKey: ["sale", saleId],
    queryFn: () => apiRequest<SaleDetail>(`${apiEndpoints.sales}${saleId}/`),
  });
  if (saleQuery.isLoading) return <LoadingState rows={8} />;
  if (saleQuery.error) return <ErrorState message={saleQuery.error instanceof ApiError ? saleQuery.error.message : "No se pudo cargar la venta."} onRetry={() => void saleQuery.refetch()} />;
  const sale = saleQuery.data;
  if (!sale) return null;

  return (
    <main className="print-screen">
      <div className="print-toolbar no-print">
        <div className="segmented-control"><button type="button" className={paper === "thermal" ? "is-active" : ""} onClick={() => setPaper("thermal")}>Termica 80 mm</button><button type="button" className={paper === "a4" ? "is-active" : ""} onClick={() => setPaper("a4")}>A4</button></div>
        <button type="button" className="app-button primary" onClick={() => window.print()}><i className="fas fa-print" /> Imprimir</button>
      </div>
      <article className={`sale-document paper-${paper}`}>
        <header><img src="/legacy/logo/logo.png" alt="" /><h1>{company?.tradeName ?? "Botica Farma"}</h1><p>{sale.branch_name}</p><strong>NOTA DE VENTA {sale.number}</strong></header>
        <dl className="sale-print-meta"><div><dt>Fecha</dt><dd>{new Date(sale.sold_at).toLocaleString("es-PE")}</dd></div><div><dt>Cajero</dt><dd>{sale.cashier_name}</dd></div><div><dt>Cliente</dt><dd>{sale.customer_name ?? "Público general"}</dd></div></dl>
        <table><thead><tr><th>Producto</th><th>Cant.</th><th>P. unit.</th><th>Total</th></tr></thead><tbody>{sale.items.map((item) => <tr key={item.id}><td>{item.product_name}<small>{item.presentation}{item.batch_number ? ` / Lote ${item.batch_number}` : ""}</small></td><td>{integer(item.quantity)}</td><td>{money(item.unit_price)}</td><td>{money(item.line_total)}</td></tr>)}</tbody></table>
        <dl className="sale-print-totals"><div><dt>Subtotal</dt><dd>S/ {money(sale.subtotal)}</dd></div><div><dt>Descuento</dt><dd>S/ {money(sale.discount_total)}</dd></div><div className="total"><dt>Total</dt><dd>S/ {money(sale.total)}</dd></div>{sale.payments.map((payment) => <div key={payment.id}><dt>{payment.method}</dt><dd>S/ {money(payment.amount)}</dd></div>)}<div><dt>Vuelto</dt><dd>S/ {money(sale.change_total)}</dd></div></dl>
        {sale.notes ? <p className="sale-print-notes">{sale.notes}</p> : null}
        <footer>Gracias por su compra.</footer>
      </article>
    </main>
  );
}

