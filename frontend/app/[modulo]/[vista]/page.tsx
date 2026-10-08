import { notFound } from "next/navigation";
import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

type ModuleSubPageProps = {
  params: Promise<{
    modulo: string;
    vista: string;
  }>;
};

export default async function ModuleSubPage({ params }: ModuleSubPageProps) {
  const { modulo, vista } = await params;
  const appModule = findModuleByHref(`/${modulo}/${vista}`);

  if (!appModule) {
    notFound();
  }

  return <ModuleShell module={appModule} />;
}
