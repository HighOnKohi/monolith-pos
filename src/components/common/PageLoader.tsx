/**
 * PageLoader
 * Minimal full-screen loading fallback used by route-level Suspense boundaries.
 * Replace with a proper spinner/skeleton when the UI design system is built.
 */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <span className="text-sm text-gray-400">Loading…</span>
    </div>
  )
}

export default PageLoader
