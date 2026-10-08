type PageHeaderProps = {
  title: string;
  description?: string;
  section?: string;
  current?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, section, current, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <h1>{title}</h1>
        {description ? <span className="page-subtitle">{description}</span> : null}
        {!description && section ? (
          <div className="breadcrumbs">
            <span>Principal</span>
            <span>{section}</span>
            {current ? <strong>{current}</strong> : null}
          </div>
        ) : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
