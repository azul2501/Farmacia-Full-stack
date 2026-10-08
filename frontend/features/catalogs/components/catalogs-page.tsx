"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ApiResourcePage } from "@/features/shared/resources/api-resource-page";
import { activeIngredientResource, categoryResource, laboratoryResource, productLocationResource, therapeuticActionResource } from "@/features/shared/resources/resource-configs";

const tabs = {
  categories: categoryResource,
  laboratories: laboratoryResource,
  ingredients: activeIngredientResource,
  therapeutic: therapeuticActionResource,
  locations: productLocationResource,
} as const;

export function CatalogsPage() {
  const [tab, setTab] = useState<keyof typeof tabs>("categories");
  return (
    <>
      <PageHeader title="Categorias y laboratorios" description="Maestros que alimentan la ficha de producto" />
      <div className="screen-tabs" role="tablist" aria-label="Catalogos">
        <button type="button" role="tab" aria-selected={tab === "categories"} className={tab === "categories" ? "is-active" : ""} onClick={() => setTab("categories")}>Categorias</button>
        <button type="button" role="tab" aria-selected={tab === "laboratories"} className={tab === "laboratories" ? "is-active" : ""} onClick={() => setTab("laboratories")}>Laboratorios</button>
        <button type="button" role="tab" aria-selected={tab === "ingredients"} className={tab === "ingredients" ? "is-active" : ""} onClick={() => setTab("ingredients")}>Principios activos</button>
        <button type="button" role="tab" aria-selected={tab === "therapeutic"} className={tab === "therapeutic" ? "is-active" : ""} onClick={() => setTab("therapeutic")}>Acciones terapeuticas</button>
        <button type="button" role="tab" aria-selected={tab === "locations"} className={tab === "locations" ? "is-active" : ""} onClick={() => setTab("locations")}>Ubicaciones</button>
      </div>
      <ApiResourcePage config={tabs[tab]} embedded />
    </>
  );
}
