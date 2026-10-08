const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const quantityFormatter = new Intl.NumberFormat("es-PE", {
  maximumFractionDigits: 0,
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

export function roundDecimal(value: number) {
  return Number.isFinite(value) ? Number((Math.round(value * 10) / 10).toFixed(1)) : 0;
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
