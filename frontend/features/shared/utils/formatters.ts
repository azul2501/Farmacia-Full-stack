const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat("es-PE", {
  maximumFractionDigits: 3,
});

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function roundInteger(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

/** Redondea montos a centimos (2 decimales), la precision que guarda el backend. */
export function roundDecimal(value: number) {
  return Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : 0;
}

/**
 * Valor para un campo de precio: siempre 2 decimales ("0.2000" del backend -> "0.20").
 * El backend guarda algunos costos con 4 decimales; en pantalla y en los formularios se usan 2.
 */
export function toMoneyInput(value: string | number | null | undefined, empty = "") {
  if (value === null || value === undefined || value === "") return empty;
  const number = Number(value);
  return Number.isFinite(number) ? roundDecimal(number).toFixed(2) : empty;
}

/** Valor para un campo de cantidad entera o factor ("100.0000" -> "100"). */
export function toIntegerInput(value: string | number | null | undefined, empty = "") {
  if (value === null || value === undefined || value === "") return empty;
  const number = Number(value);
  return Number.isFinite(number) ? String(roundInteger(number)) : empty;
}

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatQuantity(value: number) {
  return quantityFormatter.format(value);
}

export function formatDate(value: Date | string) {
  return dateFormatter.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDateTime(value: Date | string) {
  return dateTimeFormatter.format(typeof value === "string" ? new Date(value) : value);
}

/** Fecha local YYYY-MM-DD. No usar toISOString(): en Peru (UTC-5) devuelve el dia siguiente desde las 19:00. */
export function localDateIso(date: Date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDateIso(date);
}

export const paymentMethodLabels: Record<string, string> = {
  CASH: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};
