import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function PurchasesPage() {
  return <ModuleShell module={findModuleByHref("/compra")!} />;
}
