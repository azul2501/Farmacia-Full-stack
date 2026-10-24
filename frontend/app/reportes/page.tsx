import { notFound } from "next/navigation";
import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function ReportsPage() {
  const appModule = findModuleByHref("/reporte");
  if (!appModule) notFound();
  return <ModuleShell module={appModule} />;
}
