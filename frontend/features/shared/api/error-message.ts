import { ApiError } from "@/features/shared/api/client";

const statusFallbackMessages: Record<number, string> = {
  400: "Los datos enviados no son válidos.",
  401: "Tu sesión expiro. Vuelve a iniciar sesión.",
  403: "No tienes permiso para realizar esta acción.",
  404: "No se encontro el recurso solicitado.",
  409: "La operación entra en conflicto con el estado actual del registro.",
  422: "Los datos enviados no pudieron procesarse.",
  500: "Ocurrió un error en el servidor. Intenta de nuevo en unos minutos.",
};

function isGenericStatusMessage(message: string) {
  return /^La API respondio con estado \d+\.$/.test(message);
}

/**
 * Traduce un error de la API a un mensaje consistente para el usuario.
 * Prioriza el mensaje especifico que devuelve el backend (validaciones de
 * negocio); solo cae a un texto generico por codigo HTTP cuando el backend
 * no aporto ningun detalle util.
 */
export function apiErrorMessage(error: unknown, fallback = "No se pudo completar la operación."): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.message && !isGenericStatusMessage(error.message)) return error.message;
  return statusFallbackMessages[error.status] ?? fallback;
}
