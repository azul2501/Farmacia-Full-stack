"use client";

import Link from "next/link";
import { useSession } from "@/features/auth/context/session-context";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { apiRequest, ApiError } from "@/features/shared/api/client";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import { isDemoMode } from "@/features/shared/config/runtime";
import { ErrorState, LoadingState } from "@/features/shared/ui/states/async-state";
import { localDateIso, formatDate, paymentMethodLabels } from "@/features/shared/utils/formatters";

type DashboardData = {
  date: string;
  salesToday: string;
  salesByBranch: Array<{ branch_id: string; branch_name: string; total: string; count: number }>;
  salesByPaymentMethod: Array<{ method: string; total: string }>;
  lowStock: number;
  expiringLots: number;
  expiredLots: number;
  openCashRegisters: number;
  cashDifferences: string;
  pendingTransfers: number;
};

const demoDashboard: DashboardData = {
  date: localDateIso(),
  salesToday: "1240.50",
  salesByBranch: [{ branch_id: "branch-central", branch_name: "Sucursal Central", total: "1240.50", count: 18 }],
  salesByPaymentMethod: [{ method: "CASH", total: "680.50" }, { method: "YAPE", total: "560.00" }],
  lowStock: 3,
  expiringLots: 2,
  expiredLots: 0,
  openCashRegisters: 1,
  cashDifferences: "0.00",
  pendingTransfers: 1,
};

function money(value: string) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}

export function DashboardPage() {
  const { hasPermission } = useSession();
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<DashboardData>(apiEndpoints.dashboard),
    enabled: !isDemoMode && hasPermission("dashboard.view"),
  });
  const data = isDemoMode ? demoDashboard : dashboardQuery.data;
  const error = dashboardQuery.error instanceof ApiError ? dashboardQuery.error.message : dashboardQuery.error ? "No se pudo cargar el dashboard." : "";

  return (
    <>
      <PageHeader title="Dashboard" current="Resumen operativo" />
      {dashboardQuery.isLoading ? <LoadingState rows={6} /> : error ? <ErrorState message={error} onRetry={() => void dashboardQuery.refetch()} /> : data ? (
        <>
          <section className="dashboard-grid">
            <article className="metric-card success"><span>Ventas del dia</span><strong>{money(data.salesToday)}</strong><Link href="/venta">Ver ventas <i className="fas fa-arrow-circle-right" /></Link></article>
            <article className="metric-card"><span>Cajas abiertas</span><strong>{data.openCashRegisters}</strong><Link href="/caja">Revisar cajas <i className="fas fa-arrow-circle-right" /></Link></article>
            <article className="metric-card warning"><span>Stock minimo</span><strong>{data.lowStock}</strong><Link href="/inventario">Revisar stock <i className="fas fa-arrow-circle-right" /></Link></article>
            <article className="metric-card danger"><span>Por vencer / vencidos</span><strong>{data.expiringLots} / {data.expiredLots}</strong><Link href="/inventario">Ver lotes <i className="fas fa-arrow-circle-right" /></Link></article>
            <article className="metric-card warning"><span>Transferencias pendientes</span><strong>{data.pendingTransfers}</strong><Link href="/traslado">Ver transferencias <i className="fas fa-arrow-circle-right" /></Link></article>
            <article className="metric-card danger"><span>Diferencias de caja</span><strong>{money(data.cashDifferences)}</strong><Link href="/reporte">Ver reporte <i className="fas fa-arrow-circle-right" /></Link></article>
          </section>
          <section className="dashboard-detail-grid">
            <article className="content-panel"><div className="panel-header"><div><h2>Ventas por sucursal</h2><p>{formatDate(`${data.date}T00:00:00`)}</p></div></div><div className="metric-list">{data.salesByBranch.length ? data.salesByBranch.map((item) => <div key={item.branch_id}><span>{item.branch_name}<small>{item.count} ventas</small></span><strong>{money(item.total)}</strong></div>) : <p>Sin ventas registradas hoy.</p>}</div></article>
            <article className="content-panel"><div className="panel-header"><div><h2>Medios de pago</h2><p>Distribucion del dia</p></div></div><div className="metric-list">{data.salesByPaymentMethod.length ? data.salesByPaymentMethod.map((item) => <div key={item.method}><span>{paymentMethodLabels[item.method] ?? item.method}</span><strong>{money(item.total)}</strong></div>) : <p>Sin pagos registrados hoy.</p>}</div></article>
          </section>
        </>
      ) : null}
    </>
  );
}
