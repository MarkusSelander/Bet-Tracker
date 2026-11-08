export default function PageHeader({ eyebrow, title, subtitle, action, testId }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="text-[26px] font-semibold leading-none tracking-[-0.025em] sm:text-[28px]" data-testid={testId}>
          {title}
        </h1>
        {subtitle ? <p className="mt-2 text-[13px] text-text-secondary">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}
