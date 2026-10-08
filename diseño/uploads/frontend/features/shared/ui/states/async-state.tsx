type EmptyStateProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({
  title = "No hay datos para mostrar",
  description = "Ajusta los filtros o registra un nuevo elemento.",
  action,
}: EmptyStateProps) {
  return (
    <div className="content-state empty-content-state">
      <i className="far fa-folder-open" aria-hidden="true" />
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="content-state error-content-state" role="alert">
      <i className="fas fa-exclamation-circle" aria-hidden="true" />
      <strong>No se pudo cargar la informacion</strong>
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="app-button primary" onClick={onRetry}>
          <i className="fas fa-redo" aria-hidden="true" /> Reintentar
        </button>
      ) : null}
    </div>
  );
}

export function LoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-list" role="status" aria-label="Cargando informacion">
      {Array.from({ length: rows }, (_, index) => (
        <span className="skeleton-row" key={index} />
      ))}
    </div>
  );
}
