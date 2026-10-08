"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            fontFamily: "system-ui, sans-serif",
            background: "#f4f6f9",
            color: "#334155",
            textAlign: "center",
            padding: 24,
          }}
        >
          <strong style={{ fontSize: 20 }}>El sistema no pudo cargar</strong>
          <p style={{ maxWidth: 420 }}>
            Ocurrio un error grave al iniciar la aplicacion. Intenta recargar la pagina; si el problema
            persiste, comunicate con soporte.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: "#0b7285",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "10px 18px",
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- last-resort fallback outside the app router tree */}
            <a
              href="/login"
              style={{
                border: "1px solid #94a3b8",
                borderRadius: 6,
                padding: "10px 18px",
                textDecoration: "none",
                color: "#334155",
              }}
            >
              Ir al login
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
