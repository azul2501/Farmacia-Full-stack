export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export type ValidationResult<T> =
  | { success: true; data: T; errors?: undefined }
  | { success: false; data?: undefined; errors: FieldErrors<T> };

export type Validator<T> = (value: T) => ValidationResult<T>;

export function required(value: string, label: string) {
  return value.trim() ? undefined : `${label} es obligatorio.`;
}
