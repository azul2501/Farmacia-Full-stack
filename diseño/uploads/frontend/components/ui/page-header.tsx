type PageHeaderProps = {
  title: string;
  section?: string;
  current?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, section, current, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <div className="breadcrumbs">
          <span>Principal</span>
          {section ? <span>{section}</span> : null}
          {current ? <strong>{current}</strong> : null}
        </div>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
