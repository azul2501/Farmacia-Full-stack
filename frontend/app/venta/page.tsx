import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function SalePage() {
  return <ModuleShell module={findModuleByHref("/venta")!} />;
}
