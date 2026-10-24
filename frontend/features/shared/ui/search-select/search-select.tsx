"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Select, { type GroupBase, type SingleValue, type StylesConfig } from "react-select";

export type SearchSelectOption = {
  value: string;
  label: string;
  /** Texto extra para buscar (principio activo, códigos de barras...). No se muestra. */
  keywords?: string;
  /** Códigos que, escritos o escaneados completos, eligen la opción al instante. */
  exactCodes?: string[];
};

type Props = {
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Título del grupo en la lista (como "COLOURS" en react-select), con el total al lado. */
  groupLabel?: string;
  required?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
  /** Para lectores de pantalla cuando el campo no está dentro de un <label>. */
  ariaLabel?: string;
};

type Group = GroupBase<SearchSelectOption>;

export function normalizeSearch(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const styles: StylesConfig<SearchSelectOption, false, Group> = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderRadius: 6,
    borderColor: state.isFocused ? "var(--primary)" : "var(--border)",
    boxShadow: state.isFocused ? "0 0 0 1px var(--primary)" : "none",
    backgroundColor: "var(--panel)",
    "&:hover": { borderColor: "var(--primary)" },
  }),
  valueContainer: (base) => ({ ...base, padding: "2px 8px" }),
  singleValue: (base) => ({ ...base, color: "var(--text)" }),
  input: (base) => ({ ...base, color: "var(--text)", margin: 0 }),
  placeholder: (base) => ({ ...base, color: "var(--muted)" }),
  indicatorSeparator: (base) => ({ ...base, backgroundColor: "var(--border)" }),
  dropdownIndicator: (base, state) => ({ ...base, padding: 6, color: state.isFocused ? "var(--text)" : "var(--muted)" }),
  clearIndicator: (base) => ({ ...base, padding: 6, color: "var(--muted)", cursor: "pointer" }),
  // La lista se dibuja sobre el body para que el modal no la recorte; va encima del modal (z-index 4000).
  menuPortal: (base) => ({ ...base, zIndex: 4100 }),
  menu: (base) => ({
    ...base,
    marginTop: 4,
    borderRadius: 6,
    border: "1px solid var(--panel-border)",
    boxShadow: "0 8px 24px rgb(15 23 42 / 14%)",
    backgroundColor: "var(--panel)",
    minWidth: "100%",
    width: "max-content",
    maxWidth: "min(560px, 90vw)",
  }),
  menuList: (base) => ({ ...base, maxHeight: 280, padding: "4px 0" }),
  groupHeading: (base) => ({
    ...base,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: 0,
    padding: "6px 12px",
    color: "var(--muted)",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
  }),
  option: (base, state) => ({
    ...base,
    padding: "8px 12px",
    fontSize: 13,
    cursor: "pointer",
    color: "var(--text)",
    fontWeight: state.isSelected ? 600 : 400,
    backgroundColor: state.isFocused ? "var(--primary-soft)" : "transparent",
    "&:active": { backgroundColor: "var(--primary-soft)" },
  }),
  noOptionsMessage: (base) => ({ ...base, color: "var(--muted)", fontSize: 13 }),
};

function GroupHeading({ label, count }: { label: string; count: number }) {
  return (
    <>
      <span>{label}</span>
      <span className="search-select-count">{count}</span>
    </>
  );
}

/**
 * Select con buscador (react-select): se escribe y se borra en el mismo campo, la lista se filtra al
 * escribir (varias palabras, sin tildes), "×" quita lo elegido y un código de barras completo
 * (escrito o escaneado) elige el producto solo.
 */
export function SearchSelect({
  value,
  options,
  onChange,
  placeholder = "Seleccionar",
  groupLabel,
  required,
  disabled,
  emptyMessage = "Sin resultados",
  ariaLabel,
}: Props) {
  const instanceId = useId();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  useEffect(() => setMounted(true), []);

  const searchIndex = useMemo(
    () => new Map(options.map((option) => [option.value, normalizeSearch(`${option.label} ${option.keywords ?? ""}`)])),
    [options],
  );
  const grouped = useMemo<(SearchSelectOption | Group)[]>(
    () => (groupLabel ? [{ label: groupLabel, options }] : options),
    [groupLabel, options],
  );
  const selected = options.find((option) => option.value === value) ?? null;

  function filterOption(candidate: { data: SearchSelectOption }, input: string) {
    const words = normalizeSearch(input).split(/\s+/).filter(Boolean);
    const haystack = searchIndex.get(candidate.data.value) ?? "";
    return words.every((word) => haystack.includes(word));
  }

  function handleInputChange(text: string, meta: { action: string }) {
    if (meta.action !== "input-change") {
      setInputValue("");
      return;
    }
    const code = text.trim();
    const exact = code ? options.find((option) => option.exactCodes?.includes(code)) : undefined;
    if (exact) {
      onChange(exact.value);
      setInputValue("");
      return;
    }
    setInputValue(text);
  }

  return (
    <div
      className="search-select"
      onKeyDown={(event) => {
        // El lector de código de barras manda Enter al final: nunca debe enviar el formulario.
        if (event.key === "Enter") event.preventDefault();
        // Esc cierra la lista, no el modal que la contiene.
        if (event.key === "Escape" && menuOpen) event.stopPropagation();
      }}
    >
      <Select<SearchSelectOption, false, Group>
        instanceId={instanceId}
        aria-label={ariaLabel}
        options={grouped}
        value={selected}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onChange={(option: SingleValue<SearchSelectOption>) => onChange(option?.value ?? "")}
        filterOption={filterOption}
        formatGroupLabel={(group) => <GroupHeading label={group.label ?? ""} count={group.options.length} />}
        placeholder={placeholder}
        noOptionsMessage={() => emptyMessage}
        isClearable
        isDisabled={disabled}
        required={required}
        onMenuOpen={() => setMenuOpen(true)}
        onMenuClose={() => setMenuOpen(false)}
        menuPortalTarget={mounted ? document.body : undefined}
        menuPlacement="auto"
        styles={styles}
        classNamePrefix="search-select"
      />
    </div>
  );
}
