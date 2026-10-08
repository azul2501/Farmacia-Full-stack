import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function SalesPage() {
  return <ModuleShell module={findModuleByHref("/venta")!} />;
}
