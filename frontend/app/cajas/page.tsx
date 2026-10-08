import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";
import { notFound } from "next/navigation";

export default function CashRegistersPage() {
  const cashRegisterModule = findModuleByHref("/cajas");
  if (!cashRegisterModule) notFound();
  return <ModuleShell module={cashRegisterModule} />;
}
