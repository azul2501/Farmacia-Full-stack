import { notFound } from "next/navigation";
import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function CustomersPage() {
  const appModule = findModuleByHref("/cliente");
  if (!appModule) notFound();
  return <ModuleShell module={appModule} />;
}
