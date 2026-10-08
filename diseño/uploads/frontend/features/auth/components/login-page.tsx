"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/features/auth/context/session-context";
import { ApiError } from "@/features/shared/api/client";
import { runtimeConfig } from "@/features/shared/config/runtime";
import type { AppRole } from "@/features/auth/types/session";

const defaultRouteByRole: Record<AppRole, string> = {
  SUPERADMIN: "/",
  OWNER: "/",
  BRANCH_ADMIN: "/",
  WAREHOUSE_OPERATOR: "/inventario",
  CASHIER: "/pos",
};

export function LoginPage() {
  const router = useRouter();
  const { login, isDemoMode } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Ingresa un correo electronico valido.");
      return;
    }
    setIsSubmitting(true);
    try {
      const role = await login({ email, password });
      router.replace(defaultRouteByRole[role]);
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(
          caughtError.status === 401
            ? "Correo o contrasena incorrectos."
            : caughtError.message,
        );
      } else {
        setError("No fue posible iniciar sesion.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <span className="brand-mark">BF</span>
          <h1>Sistema Botica</h1>
          <p>Inicio de sesion</p>
        </div>

        {isDemoMode ? <div className="demo-login-note">
          <i className="fas fa-info-circle" aria-hidden="true" />
          <span>Acceso visual de desarrollo. Las credenciales no se validan ni se almacenan.</span>
        </div> : null}

        {!isDemoMode && runtimeConfig.showDemoCredentials ? (
          <div className="demo-login-note">
            <i className="fas fa-code" aria-hidden="true" />
            <span>Desarrollo: owner@botica.demo / Demo12345!</span>
          </div>
        ) : null}

        <label>
          <span>Correo electronico</span>
          <div className="input-with-icon">
            <input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@empresa.com" autoComplete="email" required autoFocus disabled={isSubmitting} />
            <i className="fas fa-envelope" />
          </div>
        </label>
        <label>
          <span>Clave</span>
          <div className="input-with-icon">
            <input name="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ingrese la clave" autoComplete="current-password" required disabled={isSubmitting} />
            <i className="fas fa-lock" />
            <button type="button" className="password-visibility" aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"} onClick={() => setShowPassword((current) => !current)}>
              <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`} aria-hidden="true" />
            </button>
          </div>
        </label>
        <button type="button" className="forgot-password-link" disabled title="Proximamente">Olvide mi contrasena</button>
        {error ? <div className="login-error" role="alert"><i className="fas fa-exclamation-circle" aria-hidden="true" /> {error}</div> : null}
        <button type="submit" className="app-button primary" disabled={isSubmitting}>
          <i className={`fas ${isSubmitting ? "fa-circle-notch fa-spin" : "fa-sign-in-alt"}`} aria-hidden="true" />
          {isSubmitting ? "Iniciando sesion..." : "Iniciar sesion"}
        </button>
      </form>
    </main>
  );
}
