import { notFound } from "next/navigation";
import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function PurchasesPage() {
  const appModule = findModuleByHref("/compra");
  if (!appModule) notFound();
  return <ModuleShell module={appModule} />;
}
