import type { QueryClient } from "@tanstack/react-query";

/** Datos que cambian cuando se mueve stock o dinero (venta, anulacion, compra, ajuste, caja). */
const operationalKeys = [
  "stock",
  "inventory-movements",
  "cash-sessions",
  "pos",
  "dashboard",
  "sales",
  "purchases",
  "receivable",
  "payable",
  "financial-movements",
  "reports",
];

export function invalidateOperationalData(queryClient: QueryClient) {
  return Promise.all(operationalKeys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}
