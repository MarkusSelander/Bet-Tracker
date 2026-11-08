/** A row of compact figures divided by hairlines: 2 columns on mobile, 4 from sm. */
export function StatLine({ children }) {
  return (
    <div className="grid grid-cols-2 border-y border-hairline sm:grid-cols-4 [&>*]:border-hairline [&>*:nth-child(even)]:border-l sm:[&>*:not(:first-child)]:border-l [&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-t-0">
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, onClick }) {
  const inner = (
    <>
      <span className="eyebrow block">{label}</span>
      <span className="mt-1.5 block text-[14px] font-semibold figure">{value}</span>
      {sub ? <span className="mt-0.5 block text-[11px] text-text-muted figure">{sub}</span> : null}
    </>
  );
  if (onClick) {
    return (
      <div className="min-w-0">
        <button
          type="button"
          onClick={onClick}
          className="block w-full px-5 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
        >
          {inner}
        </button>
      </div>
    );
  }
  return <div className="min-w-0 px-5 py-3">{inner}</div>;
}
