export default function PageFallback() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Laster">
      <div className="space-y-2">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-7 w-48" />
      </div>
      <div className="skeleton h-[360px] w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-24 rounded-none" />
        ))}
      </div>
    </div>
  );
}
