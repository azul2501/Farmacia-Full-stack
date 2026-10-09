"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/features/auth/context/session-context";
import type { ModuleAction } from "@/features/modules/config/module-screens";
import { getModuleScreen } from "@/features/modules/config/module-screens";
import type { DataTableColumn } from "@/features/shared/ui/data-table/data-table";
import { DataTable } from "@/features/shared/ui/data-table/data-table";
import { Modal } from "@/features/shared/ui/modal/modal";
import { useToast } from "@/features/shared/ui/toast/toast-provider";
import type { AppModule } from "@/types/domain";

type ModuleScreenPageProps = {
  module: AppModule;
  initialAction?: InitialModuleAction;
};

type ModalMode = "create" | "edit" | "view" | "delete" | "export" | "print" | "sync" | "search";

export type InitialModuleAction = {
  mode: ModalMode;
  title: string;
};

type ActivePanel = {
  mode: ModalMode;
  title: string;
  row?: string[];
  rowIndex?: number;
};

type ModuleTableRow = {
  id: string;
  values: string[];
  rowIndex: number;
};

const modeLabels: Record<ModalMode, string> = {
  create: "Guardar",
  edit: "Actualizar",
  view: "Cerrar",
  delete: "Eliminar",
  export: "Generar",
  print: "Imprimir",
  sync: "Sincronizar",
  search: "Buscar",
};

const actionIcons: Record<ModalMode, string> = {
  create: "fa fa-plus",
  edit: "fa fa-edit",
  view: "fa fa-eye",
  delete: "fa fa-trash",
  export: "fa fa-file-excel",
  print: "fa fa-file-pdf",
  sync: "fa fa-upload",
  search: "fa fa-search",
};

export function ModuleScreenPage({ module, initialAction }: ModuleScreenPageProps) {
  const router = useRouter();
  const { hasPermission } = useSession();
  const { showToast } = useToast();
  const screen = getModuleScreen(module.href, module.label);
  const editableFields = (screen.formFields ?? screen.columns).filter(
    (field) => !["#", "acciones"].includes(field.toLowerCase()),
  );
  const [tableRows, setTableRows] = useState<string[][]>(screen.rows);
  const [activeTab, setActiveTab] = useState(
    screen.tabs?.find((tab) => screen.tabRoutes?.[tab] === module.href) ?? screen.tabs?.[0] ?? "",
  );
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(
    initialAction ? { mode: initialAction.mode, title: initialAction.title } : null,
  );
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!initialAction) {
      return;
    }

    setActivePanel({ mode: initialAction.mode, title: initialAction.title });
    setFormValues(buildFormValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction?.mode, initialAction?.title]);

  const rows = useMemo<ModuleTableRow[]>(
    () => tableRows.map((values, rowIndex) => ({ id: `${module.href}-${values[0] ?? rowIndex}-${rowIndex}`, values, rowIndex })),
    [module.href, tableRows],
  );

  function resolveMode(action: ModuleAction): ModalMode {
    if (action.intent) {
      return action.intent;
    }

    const label = action.label.toLowerCase();
    if (label.includes("pdf") || label.includes("imprimir")) return "print";
    if (label.includes("excel") || label.includes("exportar")) return "export";
    if (label.includes("buscar") || label.includes("consultar")) return "search";
    if (label.includes("sincronizar") || label.includes("sunat")) return "sync";
    if (label.includes("editar") || label.includes("configurar")) return "edit";
    return "create";
  }

  function iconForAction(action: ModuleAction) {
    if (action.icon) {
      return action.icon;
    }

    return actionIcons[resolveMode(action)];
  }

  function openAction(action: ModuleAction) {
    const mode = resolveMode(action);
    setActivePanel({ mode, title: action.label });
    setFormValues(buildFormValues());
  }

  function openCreatePanel(title = `Nuevo ${screen.title}`) {
    setActivePanel({ mode: "create", title });
    setFormValues(buildFormValues());
  }

  function handleTabClick(tab: string) {
    setActiveTab(tab);

    const tabRoute = screen.tabRoutes?.[tab];
    if (tabRoute && tabRoute !== module.href) {
      router.push(tabRoute);
      return;
    }

    const normalizedTab = tab.toLowerCase();
    if (
      normalizedTab.includes("nuevo") ||
      normalizedTab.includes("nueva") ||
      normalizedTab.includes("registrar")
    ) {
      openCreatePanel(tab);
    }
  }

  function openRowAction(mode: ModalMode, row: string[], rowIndex: number) {
    const titles: Record<ModalMode, string> = {
      create: `Nuevo ${screen.title}`,
      edit: `Editar ${screen.title}`,
      view: `Datos ${screen.title}`,
      delete: `Eliminar ${screen.title}`,
      export: `Exportar ${screen.title}`,
      print: `Imprimir ${screen.title}`,
      sync: `Sincronizar ${screen.title}`,
      search: `Buscar ${screen.title}`,
    };

    setActivePanel({ mode, title: titles[mode], row, rowIndex });
    setFormValues(buildFormValues(row));
  }

  function valueForField(field: string, row?: string[]) {
    if (!row) {
      return "";
    }

    const fieldIndex = screen.columns.findIndex(
      (column) => column.toLowerCase() === field.toLowerCase(),
    );

    return fieldIndex >= 0 ? row[fieldIndex] ?? "" : "";
  }

  function buildFormValues(row?: string[]) {
    return Object.fromEntries(editableFields.map((field) => [field, valueForField(field, row)]));
  }

  function updateFormValue(field: string, value: string) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  function rowFromForm() {
    return screen.columns.map((column, index) => {
      const lowerColumn = column.toLowerCase();

      if (lowerColumn === "acciones") {
        return "";
      }

      if (column === "#") {
        return activePanel?.mode === "edit" && activePanel.row?.[index]
          ? activePanel.row[index]
          : String(tableRows.length + 1);
      }

      return valueFromFormColumn(column) ?? activePanel?.row?.[index] ?? "";
    });
  }

  function valueFromFormColumn(column: string) {
    const directValue = formValues[column];
    if (directValue !== undefined) {
      return directValue;
    }

    const aliases: Record<string, string[]> = {
      Producto: ["Descripción", "Producto"],
      Nombre: ["Nombres", "Razón Social", "Descripción"],
      Cliente: ["Cliente", "Nombres"],
      Proveedor: ["Proveedor", "Nombres"],
      Total: ["Total", "Importe", "Monto"],
      Precio: ["Precio", "P. Venta", "P. Compra"],
      Stock: ["Stock", "Stock Mínimo", "Stock Físico"],
      Estado: ["Estado", "Estado SUNAT", "Estado Sunat"],
      Documento: ["Documento", "Tipo Documento", "Comprobante"],
      Fecha: ["Fecha", "Fecha Inicio", "Fecha Apertura"],
    };

    for (const field of aliases[column] ?? []) {
      if (formValues[field] !== undefined) {
        return formValues[field];
      }
    }

    return undefined;
  }

  function savePanel() {
    if (!activePanel) {
      return;
    }

    if (activePanel.mode === "create") {
      setTableRows((current) => [...current, rowFromForm()]);
      setActivePanel(null);
      showToast({
        tone: "info",
        title: "Registro agregado en modo demostración",
        description: "El cambio vive temporalmente en memoria y se perdera al recargar.",
      });
      return;
    }

    if (activePanel.mode === "edit" && activePanel.rowIndex !== undefined) {
      const nextRow = rowFromForm();
      setTableRows((current) =>
        current.map((row, index) => (index === activePanel.rowIndex ? nextRow : row)),
      );
      setActivePanel(null);
      showToast({
        tone: "info",
        title: "Registro actualizado temporalmente",
        description: "La persistencia se habilitará al conectar el repositorio API.",
      });
      return;
    }

    if (activePanel.mode === "delete" && activePanel.rowIndex !== undefined) {
      setTableRows((current) => current.filter((_, index) => index !== activePanel.rowIndex));
      setActivePanel(null);
      showToast({
        tone: "warning",
        title: "Registro retirado de la vista demo",
        description: "No se ejecuto una eliminación permanente.",
      });
      return;
    }

    setActivePanel(null);
  }

  function inputTypeFor(field: string) {
    const value = field.toLowerCase();
    if (value.includes("fecha") || value.includes("vencimiento")) return "date";
    if (
      value.includes("monto") ||
      value.includes("importe") ||
      value.includes("precio") ||
      value.includes("cantidad") ||
      value.includes("stock") ||
      value.includes("total") ||
      value.includes("factor")
    ) {
      return "number";
    }
    if (value.includes("correo") || value.includes("email")) return "email";
    if (value.includes("archivo") || value.includes("logo") || value.includes("certificado")) return "file";
    return "text";
  }

  const actionPanelContent = activePanel ? (
    <div className="module-action-content">
      {activePanel.mode === "delete" ? (
        <div className="notice warning">
          Esta acción solo retirara el registro de la vista actual. No existe eliminación permanente en modo demostración.
        </div>
      ) : activePanel.mode === "view" ? (
        <dl className="detail-grid">
          {screen.columns
            .filter((column) => column.toLowerCase() !== "acciones")
            .map((column, index) => (
              <div key={column}>
                <dt>{column}</dt>
                <dd>{activePanel.row?.[index] ?? ""}</dd>
              </div>
            ))}
        </dl>
      ) : activePanel.mode === "export" || activePanel.mode === "print" ? (
        <div className="form-grid">
          {["Fecha Inicio", "Fecha Fin", "Formato", "Filtro"].map((field) => (
            <label key={field}>
              <span>{field}</span>
              {field === "Formato" ? (
                <select defaultValue={activePanel.mode === "print" ? "PDF" : "Excel"}>
                  <option>PDF</option>
                  <option>Excel</option>
                </select>
              ) : (
                <input type={field.includes("Fecha") ? "date" : "text"} />
              )}
            </label>
          ))}
        </div>
      ) : (
        <form className="form-grid">
          {editableFields.map((field) => (
            <label key={field}>
              <span>{field}</span>
              {field.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("observacion") ||
              field.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("direccion") ||
              field.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("informacion") ? (
                <textarea
                  value={formValues[field] ?? ""}
                  onChange={(event) => updateFormValue(field, event.target.value)}
                />
              ) : field.toLowerCase().includes("estado") ||
                field.toLowerCase().includes("tipo") ||
                field.toLowerCase().includes("comprobante") ||
                field.toLowerCase().includes("medio") ||
                field.toLowerCase().includes("formato") ? (
                <select
                  value={formValues[field] ?? ""}
                  onChange={(event) => updateFormValue(field, event.target.value)}
                >
                  <option value="">Seleccione</option>
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                  <option value="Pendiente API">Pendiente API</option>
                  <option value="Boleta">Boleta</option>
                  <option value="Factura">Factura</option>
                  <option value="Efectivo">Efectivo</option>
                </select>
              ) : (
                <input
                  type={inputTypeFor(field)}
                  value={inputTypeFor(field) === "file" ? undefined : formValues[field] ?? ""}
                  onChange={(event) => updateFormValue(field, event.target.value)}
                />
              )}
            </label>
          ))}
        </form>
      )}

    </div>
  ) : null;

  const actionPanelFooter = activePanel ? (
    <>
      <button type="button" className="ghost-button" onClick={() => setActivePanel(null)}>Cancelar</button>
      {activePanel.mode !== "view" && activePanel.mode !== "print" ? (
        <button type="button" className="app-button primary" onClick={savePanel}>
          <i className={actionIcons[activePanel.mode]} /> {modeLabels[activePanel.mode]}
        </button>
      ) : null}
    </>
  ) : null;

  const columns: DataTableColumn<ModuleTableRow>[] = screen.columns.map((column, columnIndex) => {
    if (column.toLowerCase() === "acciones") {
      return {
        id: `actions-${columnIndex}`,
        header: column,
        width: "164px",
        render: (item) => (
          <div className="row-actions compact-row-actions">
            {hasPermission("records.update") ? (
              <button type="button" className="row-action-edit" title="Editar" aria-label="Editar" onClick={() => openRowAction("edit", item.values, item.rowIndex)}>
                <i className="fa fa-edit" aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" className="row-action-view" title="Ver detalle" aria-label="Ver detalle" onClick={() => openRowAction("view", item.values, item.rowIndex)}>
              <i className="fa fa-eye" aria-hidden="true" />
            </button>
            {hasPermission("records.delete") ? (
              <button type="button" className="row-action-delete" title="Eliminar" aria-label="Eliminar" onClick={() => openRowAction("delete", item.values, item.rowIndex)}>
                <i className="fa fa-trash" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ),
      };
    }

    return {
      id: `${column}-${columnIndex}`,
      header: column,
      value: (item) => item.values[columnIndex] ?? "",
      sortable: true,
    };
  });

  return (
    <>
      <PageHeader
        title={screen.title}
        section={screen.section}
        current={screen.current}
        actions={
          <>
            {screen.actions.filter((action) => {
              const mode = resolveMode(action);
              if (mode === "create") return hasPermission("records.create");
              if (mode === "edit") return hasPermission("records.update");
              return true;
            }).map((action) => (
              <button
                key={action.label}
                type="button"
                className={`app-button ${action.intent === "print" ? "danger" : action.intent === "export" ? "success" : ""}`}
                onClick={() => openAction(action)}
              >
                <i className={iconForAction(action)} /> {action.label}
              </button>
            ))}
          </>
        }
      />

      <section className="workspace-panel">
        {screen.tabs?.length ? (
          <div className="tabs">
            {screen.tabs.map((tab) => (
              <button
                type="button"
                className={`tab-button ${activeTab === tab ? "is-active" : ""}`}
                key={tab}
                onClick={() => handleTabClick(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        ) : null}

        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(item) => item.id}
          searchText={(item) => item.values.join(" ")}
          searchPlaceholder={`Buscar en ${screen.title.toLowerCase()}`}
          caption={screen.title}
          toolbarActions={hasPermission("records.create") ? (
            <button type="button" className="app-button primary" onClick={() => openCreatePanel()}>
              <i className="fa fa-plus" /> Agregar
            </button>
          ) : null}
        />
      </section>

      <Modal
        open={Boolean(activePanel)}
        title={activePanel?.title ?? screen.title}
        description={`${screen.section} / ${screen.current} - Datos de demostración`}
        size="lg"
        footer={actionPanelFooter}
        onClose={() => setActivePanel(null)}
      >
        {actionPanelContent}
      </Modal>
    </>
  );
}
