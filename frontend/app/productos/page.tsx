import { notFound } from "next/navigation";
import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function ProductsPage() {
  const appModule = findModuleByHref("/producto");
  if (!appModule) notFound();
  return <ModuleShell module={appModule} />;
}
