import { notFound } from "next/navigation";
import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function CashRegistersPage() {
  const appModule = findModuleByHref("/cajas");
  if (!appModule) notFound();
  return <ModuleShell module={appModule} />;
}
