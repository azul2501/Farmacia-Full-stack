"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/features/shared/api/client";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import { isDemoMode } from "@/features/shared/config/runtime";

type DigemidAlert = {
  id: string;
  year: number;
  number: number;
  title: string;
  url: string;
  lot_numbers: string[];
  in_stock: Array<{ product: string; lot: string }>;
};

/** Alertas sanitarias de DIGEMID; resalta las que mencionan un lote que la botica tiene en stock. */
export function DigemidAlerts() {
  const alertsQuery = useQuery({
    queryKey: ["dashboard", "digemid-alerts"],
    queryFn: () => apiRequest<DigemidAlert[]>(apiEndpoints.digemidAlerts, { query: { limit: 5 } }),
    enabled: !isDemoMode,
    staleTime: 10 * 60_000,
  });
  const alerts = alertsQuery.data ?? [];
  if (!alerts.length) return null;
  const affected = alerts.filter((alert) => alert.in_stock.length);

  return (
    <article className="content-panel digemid-alerts">
      <div className="panel-header">
        <div>
          <h2>Alertas DIGEMID</h2>
          <p>{affected.length ? `${affected.length} alerta(s) mencionan lotes que tienes en stock` : "Ninguna menciona lotes que tengas en stock"}</p>
        </div>
      </div>
      <ul>
        {alerts.map((alert) => (
          <li key={alert.id} className={alert.in_stock.length ? "is-affected" : ""}>
            <i className={`fas ${alert.in_stock.length ? "fa-exclamation-triangle" : "fa-bullhorn"}`} aria-hidden="true" />
            <div>
              <a href={alert.url} target="_blank" rel="noopener noreferrer">N° {String(alert.number).padStart(3, "0")}-{alert.year}: {alert.title}</a>
              {alert.in_stock.length ? (
                <strong>Tienes en stock: {alert.in_stock.map((match) => `${match.product} (lote ${match.lot})`).join(", ")}. Sepáralo y no lo vendas.</strong>
              ) : alert.lot_numbers.length ? <small>Lotes: {alert.lot_numbers.join(", ")}</small> : null}
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
