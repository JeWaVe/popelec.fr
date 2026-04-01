export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Title skeleton */}
      <div className="h-8 bg-neutral-200 rounded w-64 mb-8 animate-pulse" />

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar skeleton */}
        <aside className="md:w-64 flex-shrink-0 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 bg-neutral-200 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
          ))}
        </aside>

        {/* Grid skeleton */}
        <div className="flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                <div className="aspect-square bg-neutral-200 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-neutral-200 rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-neutral-200 rounded animate-pulse w-1/2" />
                  <div className="h-6 bg-neutral-200 rounded animate-pulse w-1/3 mt-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
