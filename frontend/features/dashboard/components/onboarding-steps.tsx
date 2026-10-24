"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/features/shared/api/client";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ApiPage } from "@/features/shared/api/types";
import { isDemoMode } from "@/features/shared/config/runtime";

type Step = {
  id: string;
  title: string;
  hint: string;
  href: string;
  action: string;
  endpoint: string;
};

// Asistente de inicio de la V1: tres pasos para pasar de "cuenta nueva" a "primera venta".
const steps: Step[] = [
  {
    id: "products",
    title: "Carga tus productos",
    hint: "Crea los productos o súbelos con la plantilla CSV.",
    href: "/producto",
    action: "Ir a productos",
    endpoint: apiEndpoints.products,
  },
  {
    id: "stock",
    title: "Registra tu stock",
    hint: "Sube tu stock inicial en Stock y vencimientos, o registra un ingreso de mercadería.",
    href: "/inventario",
    action: "Cargar stock",
    endpoint: apiEndpoints.stock,
  },
  {
    id: "cash",
    title: "Abre tu caja y vende",
    hint: "Abre la caja con tu monto inicial y empieza a vender en el punto de venta.",
    href: "/caja",
    action: "Abrir caja",
    endpoint: apiEndpoints.cashSessions,
  },
];

function countFor(endpoint: string) {
  return apiRequest<ApiPage<unknown>>(endpoint, { query: { page: 1, pageSize: 1 } }).then((page) => page.total);
}

/** Muestra los primeros pasos hasta que la botica tenga productos, stock y una caja abierta. */
export function OnboardingSteps() {
  const countsQuery = useQuery({
    queryKey: ["onboarding-steps"],
    queryFn: async () => Promise.all(steps.map((step) => countFor(step.endpoint))),
    enabled: !isDemoMode,
    staleTime: 30_000,
  });
  if (!countsQuery.data) return null;
  const done = steps.map((_, index) => (countsQuery.data[index] ?? 0) > 0);
  const completed = done.filter(Boolean).length;
  if (completed === steps.length) return null;

  return (
    <article className="content-panel">
      <div className="panel-header">
        <div>
          <h2>Primeros pasos</h2>
          <p>{completed} de {steps.length} completados</p>
          <div className="onboarding-progress" aria-hidden="true"><span style={{ width: `${(completed / steps.length) * 100}%` }} /></div>
        </div>
      </div>
      <ol className="onboarding-steps">
        {steps.map((step, index) => (
          <li key={step.id} className={done[index] ? "is-done" : ""}>
            <i className={`fas ${done[index] ? "fa-check-circle" : "fa-circle"}`} aria-hidden="true" />
            <div>
              <strong>{step.title}</strong>
              <small>{step.hint}</small>
            </div>
            {done[index] ? null : <Link className="ghost-button compact-button" href={step.href}>{step.action}</Link>}
          </li>
        ))}
      </ol>
    </article>
  );
}
