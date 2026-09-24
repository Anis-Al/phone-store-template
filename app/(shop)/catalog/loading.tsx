/** Skeleton for first load / hard navigations. Filter changes keep the old grid (transition). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-page px-4 py-5 md:px-5 md:py-7" aria-busy>
      <div className="mb-5 h-10 w-48 animate-pulse rounded-sm bg-surface-alt" />
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-surface-alt" />
        ))}
      </ul>
    </div>
  );
}
