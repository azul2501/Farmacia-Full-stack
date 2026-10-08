import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

export default function CustomersPage() {
  return <ModuleShell module={findModuleByHref("/cliente")!} />;
}
