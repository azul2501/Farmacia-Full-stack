import { notFound } from "next/navigation";
import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function InventoryPage() {
  const appModule = findModuleByHref("/inventario");
  if (!appModule) notFound();
  return <ModuleShell module={appModule} />;
}
