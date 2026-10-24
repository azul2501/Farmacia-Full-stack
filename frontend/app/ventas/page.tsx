import { notFound } from "next/navigation";
import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function SalesPage() {
  const appModule = findModuleByHref("/venta");
  if (!appModule) notFound();
  return <ModuleShell module={appModule} />;
}
