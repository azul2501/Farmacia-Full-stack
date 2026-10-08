import Link from "next/link";

export default function NotFound() {
  return (
    <main className="session-loading route-error-page" aria-live="polite">
      <div className="content-state empty-content-state">
        <i className="fas fa-compass" aria-hidden="true" />
        <strong>Pagina no encontrada</strong>
        <p>La direccion que buscas no existe o fue movida.</p>
        <div className="route-error-actions">
          <Link className="app-button primary" href="/">Ir al inicio</Link>
        </div>
      </div>
    </main>
  );
}
