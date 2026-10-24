import { notFound } from "next/navigation";
import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function CashPage() {
  const appModule = findModuleByHref("/caja");
  if (!appModule) notFound();
  return <ModuleShell module={appModule} />;
}
