import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function ReportsPage() {
  return <ModuleShell module={findModuleByHref("/reporte")!} />;
}
