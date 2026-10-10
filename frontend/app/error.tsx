"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <main className="session-loading route-error-page" aria-live="polite">
      <div className="content-state error-content-state">
        <i className="fas fa-triangle-exclamation" aria-hidden="true" />
        <strong>Ocurrió un error inesperado</strong>
        <p>Esta pantalla no pudo mostrarse. Puedes intentarlo de nuevo o volver al inicio.</p>
        <div className="route-error-actions">
          <button type="button" className="app-button primary" onClick={() => reset()}>
            <i className="fas fa-redo" aria-hidden="true" /> Reintentar
          </button>
          <Link className="ghost-button" href="/">Ir al inicio</Link>
        </div>
      </div>
    </main>
  );
}
