import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function ProductsPage() {
  return <ModuleShell module={findModuleByHref("/producto")!} />;
}
