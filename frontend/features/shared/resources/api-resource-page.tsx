"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/features/auth/context/session-context";
import { apiRequest, apiRequestAll } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";
import { apiEndpoints } from "@/features/shared/api/endpoints";
import type { ApiPage } from "@/features/shared/api/types";
import type {
  ResourceConfig,
  ResourceField,
  ResourceRecord,
} from "@/features/shared/resources/resource-types";
import type { DataTableColumn } from "@/features/shared/ui/data-table/data-table";
import { DataTable } from "@/features/shared/ui/data-table/data-table";
import { Modal } from "@/features/shared/ui/modal/modal";
import { useConfirm } from "@/features/shared/ui/confirm/confirm-provider";
import { useToast } from "@/features/shared/ui/toast/toast-provider";

type ApiResourcePageProps = { config: ResourceConfig; embedded?: boolean };

function errorMessage(error: unknown) {
  return apiErrorMessage(error, "No fue posible procesar la solicitud.");
}

function defaultValues(fields: ResourceField[]) {
  return Object.fromEntries(fields.map((field) => [field.name, field.type === "checkbox" ? true : field.type === "multiselect" ? [] : ""]));
}

function displayValue(row: ResourceRecord, name: string, format?: string, labels?: Record<string, string>) {
  const value = row[name];
  if (labels && typeof value === "string") return labels[value] ?? value;
  if (format === "status") return value ? "Activo" : "Inactivo";
  if (format === "boolean") return value ? "Si" : "No";
  if (format === "currency") return `S/ ${Number(value ?? 0).toFixed(2)}`;
  if (format === "count") return Array.isArray(value) ? value.length : 0;
  return String(value ?? "-");
}

function statusChip(isActive: boolean) {
  return <span className={`sale-chip ${isActive ? "success" : "muted"}`}>{isActive ? "Activo" : "Inactivo"}</span>;
}

export function ApiResourcePage({ config, embedded = false }: ApiResourcePageProps) {
  const { branches, warehouses, company, hasPermission } = useSession();
  const queryClient = useQueryClient();
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  const [editing, setEditing] = useState<ResourceRecord | null | undefined>(undefined);
  const [values, setValues] = useState<Record<string, unknown>>(() => defaultValues(config.fields));
  const resourceKey = ["resource", company?.id, config.endpoint] as const;
  const resourceQuery = useQuery({
    queryKey: resourceKey,
    queryFn: () => apiRequestAll<ResourceRecord>(config.endpoint, {
      query: { ordering: config.columns[0]?.name },
    }),
    enabled: Boolean(company),
  });
  const optionSources = new Set(config.fields.map((field) => field.optionSource).filter(Boolean));
  const categoriesQuery = useQuery({
    queryKey: ["options", company?.id, "categories"],
    queryFn: () => apiRequestAll<ResourceRecord>(apiEndpoints.categories, {}),
    enabled: optionSources.has("categories"),
  });
  const laboratoriesQuery = useQuery({
    queryKey: ["options", company?.id, "laboratories"],
    queryFn: () => apiRequestAll<ResourceRecord>(apiEndpoints.laboratories, {}),
    enabled: optionSources.has("laboratories"),
  });
  const variantsQuery = useQuery({
    queryKey: ["options", company?.id, "product-variants"],
    queryFn: () => apiRequestAll<ResourceRecord>(apiEndpoints.productVariants, { query: { is_active: true } }),
    enabled: optionSources.has("productVariants"),
  });
  const saveMutation = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: "POST" | "PATCH"; body: Record<string, unknown> }) =>
      apiRequest<ResourceRecord>(path, { method, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: resourceKey }),
  });
  const deleteMutation = useMutation({
    mutationFn: (path: string) => apiRequest<void>(path, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: resourceKey }),
  });
  const busy = saveMutation.isPending || deleteMutation.isPending;

  const columns = useMemo<DataTableColumn<ResourceRecord>[]>(
    () => [
      ...config.columns.map((column) => ({
        id: column.name,
        header: column.label,
        value: (row: ResourceRecord) => displayValue(row, column.name, column.format, column.labels),
        render: column.format === "status" ? (row: ResourceRecord) => statusChip(Boolean(row[column.name])) : undefined,
        sortable: true,
      })),
      ...(!config.readOnly ? [{
        id: "actions",
        header: "Acciones",
        width: "110px",
        render: (row: ResourceRecord) => (
          <div className="row-actions compact-row-actions">
            {hasPermission("records.update") ? (
              <button type="button" className="row-action-edit" title="Editar" aria-label={`Editar ${config.singular}`} onClick={() => openEdit(row)}>
                <i className="fa fa-edit" aria-hidden="true" />
              </button>
            ) : null}
            {hasPermission("records.delete") ? (
              <button type="button" className="row-action-delete" title={config.deactivateOnly ? "Desactivar" : "Eliminar"} aria-label={`${config.deactivateOnly ? "Desactivar" : "Eliminar"} ${config.singular}`} onClick={() => void remove(row)}>
                <i className="fa fa-trash" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ),
      } satisfies DataTableColumn<ResourceRecord>] : []),
    ],
    [config, hasPermission],
  );

  function optionsFor(field: ResourceField) {
    if (field.optionSource === "branches") return branches.map((branch) => ({ value: branch.id, label: branch.name }));
    if (field.optionSource === "warehouses") return warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }));
    if (field.optionSource === "categories") return categoriesQuery.data?.items.map((item) => ({ value: item.id, label: String(item.name) })) ?? [];
    if (field.optionSource === "laboratories") return laboratoriesQuery.data?.items.map((item) => ({ value: item.id, label: String(item.name) })) ?? [];
    if (field.optionSource === "productVariants") return variantsQuery.data?.items.map((item) => ({ value: item.id, label: `${String(item.product_name ?? "Producto")} - ${String(item.presentation ?? item.sku ?? "")}` })) ?? [];
    return field.options ?? [];
  }

  function openCreate() {
    setValues(defaultValues(config.fields));
    setEditing(null);
  }

  function openEdit(row: ResourceRecord) {
    setValues(Object.fromEntries(config.fields.filter((field) => !field.createOnly).map((field) => [field.name, row[field.name] ?? (field.type === "checkbox" ? false : field.type === "multiselect" ? [] : "")])));
    setEditing(row);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    try {
      const path = editing ? `${config.endpoint}${editing.id}/` : config.endpoint;
      const passwordFields = new Set(config.fields.filter((field) => field.type === "password").map((field) => field.name));
      const body = Object.fromEntries(Object.entries(values).filter(([name, value]) => !(passwordFields.has(name) && value === "")));
      await saveMutation.mutateAsync({ path, method: editing ? "PATCH" : "POST", body });
      setEditing(undefined);
      showToast({ tone: "success", title: editing ? "Registro actualizado" : "Registro creado", description: `Se guardo el ${config.singular}.` });
    } catch (caughtError) {
      showToast({ tone: "error", title: "No se pudo guardar", description: errorMessage(caughtError) });
    }
  }

  async function remove(row: ResourceRecord) {
    const accepted = await confirm({
      title: `${config.deactivateOnly ? "Desactivar" : "Eliminar"} ${config.singular}`,
      description: config.deactivateOnly ? "Dejara de estar disponible, pero su historial se conserva. Puedes reactivarlo editandolo." : "Esta accion no se puede deshacer.",
      confirmLabel: config.deactivateOnly ? "Desactivar" : "Eliminar",
      tone: "danger",
    });
    if (!accepted) return;
    try {
      if (config.deactivateOnly) {
        await saveMutation.mutateAsync({ path: `${config.endpoint}${row.id}/`, method: "PATCH", body: { is_active: false } });
      } else {
        await deleteMutation.mutateAsync(`${config.endpoint}${row.id}/`);
      }
      showToast({ tone: "success", title: config.deactivateOnly ? "Registro desactivado" : "Registro eliminado" });
    } catch (caughtError) {
      showToast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(caughtError) });
    }
  }

  const createButton = !config.readOnly && hasPermission("records.create") ? (
    <button type="button" className="app-button primary" onClick={openCreate}>
      <i className="fa fa-plus" aria-hidden="true" /> Agregar {config.singular}
    </button>
  ) : null;
  const readOnlyBadge = config.readOnly ? (
    <span className="readonly-badge"><i className="fas fa-lock" aria-hidden="true" /> Solo lectura</span>
  ) : null;

  return (
    <>
      {!embedded ? (
        <PageHeader title={config.title} description={config.description} actions={createButton ?? readOnlyBadge ?? undefined} />
      ) : null}
      <section className="workspace-panel">
        <DataTable
          rows={resourceQuery.data?.items ?? []}
          columns={columns}
          rowKey={(row) => row.id}
          searchText={(row) => config.columns.map((column) => displayValue(row, column.name, column.format, column.labels)).join(" ")}
          searchPlaceholder={config.searchPlaceholder ?? `Buscar ${config.title.toLowerCase()}`}
          toolbarActions={embedded ? createButton ?? undefined : undefined}
          loading={resourceQuery.isLoading}
          error={resourceQuery.error ? errorMessage(resourceQuery.error) : undefined}
          onRetry={() => void resourceQuery.refetch()}
          emptyTitle={`No hay ${config.title.toLowerCase()}`}
          caption={config.title}
        />
      </section>

      <Modal
        open={editing !== undefined}
        title={editing ? `Editar ${config.singular}` : `Agregar ${config.singular}`}
        busy={busy}
        onClose={() => setEditing(undefined)}
        footer={<><button type="button" className="ghost-button" disabled={busy} onClick={() => setEditing(undefined)}>Cancelar</button><button type="submit" form="api-resource-form" className="app-button primary" disabled={busy}><i className={`fa ${busy ? "fa-circle-notch fa-spin" : "fa-save"}`} aria-hidden="true" /> {busy ? "Guardando..." : "Guardar"}</button></>}
      >
        <form id="api-resource-form" className="form-grid" onSubmit={(event) => void submit(event)}>
          {config.fields.filter((field) => !(editing && field.createOnly)).map((field) => (
            <label key={field.name} className={field.type === "checkbox" ? "checkbox-field" : undefined}>
              {field.type === "checkbox" ? (
                <><input type="checkbox" checked={Boolean(values[field.name])} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.checked }))} /><span>{field.label}</span></>
              ) : (
                <><span>{field.label}</span>{field.type === "select" ? (
                  <select required={field.required} value={String(values[field.name] ?? "")} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value || null }))}>
                    <option value="">Seleccionar</option>
                    {optionsFor(field).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                  </select>
                ) : field.type === "multiselect" ? (
                  <span className="checkbox-group">
                    {optionsFor(field).map((option) => {
                      const selected = Array.isArray(values[field.name]) ? (values[field.name] as string[]) : [];
                      return (
                        <label key={option.value} className="checkbox-field">
                          <input type="checkbox" checked={selected.includes(option.value)} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value) }))} />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </span>
                ) : field.type === "textarea" ? (
                  <textarea required={field.required} value={String(values[field.name] ?? "")} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />
                ) : (
                  <input type={field.type ?? "text"} required={field.required} minLength={field.type === "password" ? 8 : undefined} autoComplete={field.type === "password" ? "new-password" : undefined} value={String(values[field.name] ?? "")} onChange={(event) => setValues((current) => ({ ...current, [field.name]: field.type === "number" ? Number(event.target.value) : event.target.value }))} />
                )}{field.hint ? <small className="field-hint">{field.hint}</small> : null}</>
              )}
            </label>
          ))}
        </form>
      </Modal>
    </>
  );
}
