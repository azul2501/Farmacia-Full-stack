"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signupPharmacy, type SignupInput } from "@/features/auth/api/auth-api";
import { useSession } from "@/features/auth/context/session-context";
import { ApiError } from "@/features/shared/api/client";
import { apiErrorMessage } from "@/features/shared/api/error-message";

const emptyForm: SignupInput = {
  trade_name: "",
  ruc: "",
  address: "",
  owner_full_name: "",
  phone: "",
  email: "",
  password: "",
};

type FieldErrors = Partial<Record<keyof SignupInput, string>>;

function fieldErrorsFrom(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || !error.fields) return {};
  const result: FieldErrors = {};
  for (const [field, value] of Object.entries(error.fields)) {
    const message = Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
    if (message && field in emptyForm) result[field as keyof SignupInput] = message;
  }
  return result;
}

export function SignupPage() {
  const router = useRouter();
  const { login, isDemoMode } = useSession();
  const [form, setForm] = useState<SignupInput>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function update(field: keyof SignupInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    if (!/^(10|20)\d{9}$/.test(form.ruc)) {
      setFieldErrors({ ruc: "El RUC debe tener 11 dígitos y empezar con 10 o 20." });
      return;
    }
    setIsSubmitting(true);
    try {
      await signupPharmacy(form);
      await login({ email: form.email, password: form.password });
      router.replace("/");
    } catch (caughtError) {
      const errors = fieldErrorsFrom(caughtError);
      setFieldErrors(errors);
      if (!Object.keys(errors).length) {
        setError(
          caughtError instanceof ApiError && caughtError.status === 429
            ? "Demasiados intentos de registro. Espera unos minutos e intenta de nuevo."
            : apiErrorMessage(caughtError, "No se pudo crear tu cuenta."),
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function field(name: keyof SignupInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) {
    return (
      <label>
        <span>{label}</span>
        <input
          name={name}
          value={form[name]}
          onChange={(event) => update(name, event.target.value)}
          required
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors[name])}
          {...props}
        />
        {fieldErrors[name] ? <small className="field-error">{fieldErrors[name]}</small> : null}
      </label>
    );
  }

  return (
    <main className="login-screen">
      <form className="login-card signup-card" onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <span className="brand-mark">BF</span>
          <h1>Crea la cuenta de tu botica</h1>
          <p>30 días de prueba gratis. Sin tarjeta.</p>
        </div>

        {isDemoMode ? (
          <div className="demo-login-note">
            <i className="fas fa-info-circle" aria-hidden="true" />
            <span>El registro necesita la API real (NEXT_PUBLIC_DATA_SOURCE=api).</span>
          </div>
        ) : null}

        <fieldset className="signup-section">
          <legend>Tu botica</legend>
          {field("trade_name", "Nombre de la botica", { placeholder: "Botica San Juan", autoFocus: true })}
          {field("ruc", "RUC", { inputMode: "numeric", maxLength: 11, placeholder: "20XXXXXXXXX" })}
          {field("address", "Dirección", { placeholder: "Av. Los Olivos 123, Lima" })}
        </fieldset>

        <fieldset className="signup-section">
          <legend>Tus datos</legend>
          {field("owner_full_name", "Nombre completo", { autoComplete: "name" })}
          {field("phone", "Celular", { inputMode: "tel", autoComplete: "tel", placeholder: "987654321" })}
          {field("email", "Correo electrónico", { type: "email", autoComplete: "email", placeholder: "nombre@correo.com" })}
          <label>
            <span>Contraseña</span>
            <div className="input-with-icon">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
                minLength={8}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                required
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.password)}
              />
              <i className="fas fa-lock" />
              <button type="button" className="password-visibility" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword((current) => !current)}>
                <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`} aria-hidden="true" />
              </button>
            </div>
            {fieldErrors.password ? <small className="field-error">{fieldErrors.password}</small> : null}
          </label>
        </fieldset>

        {error ? <div className="login-error" role="alert"><i className="fas fa-exclamation-circle" aria-hidden="true" /> {error}</div> : null}
        <button type="submit" className="app-button primary" disabled={isSubmitting || isDemoMode}>
          <i className={`fas ${isSubmitting ? "fa-circle-notch fa-spin" : "fa-store"}`} aria-hidden="true" />
          {isSubmitting ? "Creando tu cuenta..." : "Crear mi cuenta"}
        </button>
        <p className="signup-switch">¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link></p>
      </form>
    </main>
  );
}
