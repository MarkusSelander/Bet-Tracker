export default function PageFallback() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-[#18181B] border border-[#27272A] rounded-xl h-24 shimmer" />
      ))}
    </div>
  );
}
