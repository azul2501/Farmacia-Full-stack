import { notFound } from "next/navigation";
import { ModuleShell } from "@/components/module-shell";
import { findModuleByHref } from "@/lib/modules";

const actionMap = {
  nuevo: { mode: "create", title: "Nuevo registro" },
  editar: { mode: "edit", title: "Editar registro" },
  importar: { mode: "export", title: "Importar datos" },
  sincronizar: { mode: "sync", title: "Sincronizar datos" },
  imprimir: { mode: "print", title: "Imprimir" },
  buscar: { mode: "search", title: "Buscar" },
} as const;

type OperationPageProps = {
  params: Promise<{
    modulo: string;
    accion: keyof typeof actionMap;
  }>;
};

export default async function OperationPage({ params }: OperationPageProps) {
  const { modulo, accion } = await params;
  const appModule = findModuleByHref(`/${modulo}`);
  const initialAction = actionMap[accion];

  if (!appModule || !initialAction) {
    notFound();
  }

  return <ModuleShell module={appModule} initialAction={initialAction} />;
}
