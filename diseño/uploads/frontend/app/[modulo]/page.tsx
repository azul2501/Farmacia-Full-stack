import { notFound } from "next/navigation";
import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

type ModulePageProps = {
  params: Promise<{
    modulo: string;
  }>;
};

export default async function ModulePage({ params }: ModulePageProps) {
  const { modulo } = await params;
  const appModule = findModuleByHref(`/${modulo}`);

  if (!appModule) {
    notFound();
  }

  return <ModuleShell module={appModule} />;
}
