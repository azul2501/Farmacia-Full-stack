import { ModuleShell } from "@/components/module-shell";
import { modules } from "@/lib/modules";

export default function BillingPage() {
  return <ModuleShell module={modules.find((module) => module.href === "/facturacion")!} />;
}
