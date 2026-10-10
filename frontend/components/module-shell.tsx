import Link from "next/link";
import type { InitialModuleAction } from "@/features/modules/components/module-screen-page";
import { PageHeader } from "@/components/ui/page-header";
import type { AppModule } from "@/types/domain";
import { ApiResourcePage } from "@/features/shared/resources/api-resource-page";
import { CatalogsPage } from "@/features/catalogs/components/catalogs-page";
import { ProductManagementPage } from "@/features/products/components/product-management-page";
import { AccountsPage } from "@/features/finance/components/accounts-page";
import { FinancialMovementsPage } from "@/features/finance/components/financial-movements-page";
import { PurchasesPage } from "@/features/purchases/components/purchases-page";
import { CashOperationsPage } from "@/features/cash/components/cash-operations-page";
import { CustomerRequestsPage } from "@/features/requests/components/customer-requests-page";
import { SalesListPage } from "@/features/sales/components/sales-list-page";
import { TransfersPage } from "@/features/transfers/components/transfers-page";
import { ReportsPage } from "@/features/reports/components/reports-page";
import { StockPage } from "@/features/inventory/components/stock-page";
import { KardexPage } from "@/features/inventory/components/kardex-page";
import {
  branchResource,
  cashRegisterResource,
  posTerminalResource,
  customerResource,
  supplierResource,
  warehouseResource,
  userListResource,
} from "@/features/shared/resources/resource-configs";

type ModuleShellProps = {
  module: AppModule;
  initialAction?: InitialModuleAction;
};

export function ModuleShell({ module }: ModuleShellProps) {
  const rootPath = `/${module.href.split("/").filter(Boolean)[0] ?? ""}`;
  if (rootPath === "/atributo") return <CatalogsPage />;
  if (rootPath === "/proveedor") return <ApiResourcePage config={supplierResource} />;
  if (rootPath === "/cliente") return <ApiResourcePage config={customerResource} />;
  if (rootPath === "/establecimiento") return <ApiResourcePage config={branchResource} />;
  if (rootPath === "/almacenes") return <ApiResourcePage config={warehouseResource} />;
  if (rootPath === "/cajas") return <ApiResourcePage config={cashRegisterResource} />;
  if (rootPath === "/terminales") return <ApiResourcePage config={posTerminalResource} />;
  if (rootPath === "/producto") return <ProductManagementPage />;
  if (rootPath === "/caja") return <CashOperationsPage />;
  if (rootPath === "/inventario") return <StockPage />;
  if (module.href === "/consulta/kardex") return <KardexPage />;
  if (rootPath === "/compra") return <PurchasesPage />;
  if (rootPath === "/venta") return <SalesListPage />;
  if (rootPath === "/traslado") return <TransfersPage />;
  if (rootPath === "/usuario") return <ApiResourcePage config={userListResource} />;
  if (rootPath === "/pagar") return <AccountsPage type="payable" />;
  if (rootPath === "/cobrar") return <AccountsPage type="receivable" />;
  if (rootPath === "/gasto") return <FinancialMovementsPage kind="expense" />;
  if (rootPath === "/ingreso") return <FinancialMovementsPage kind="income" />;
  if (rootPath === "/solicitud") return <CustomerRequestsPage />;
  if (rootPath === "/reporte") return <ReportsPage />;
  // Modulos fuera del alcance del MVP: no se muestran pantallas simuladas con datos falsos.
  return (
    <>
      <PageHeader title={module.label} current={module.label} />
      <div className="content-state empty-content-state" role="status">
        <i className="fas fa-hourglass-half" aria-hidden="true" />
        <strong>Módulo no disponible en esta versión</strong>
        <p>Esta sección se habilitará en una próxima entrega. Las operaciones del día a día están en el menú lateral.</p>
        <Link className="app-button primary" href="/">Ir al inicio</Link>
      </div>
    </>
  );
}
