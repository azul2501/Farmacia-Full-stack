import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function ProductPage() {
  return <ModuleShell module={findModuleByHref("/producto")!} />;
}
