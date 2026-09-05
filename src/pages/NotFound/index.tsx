/**
 * NotFound page — displayed for any unmatched route
 */
function NotFound() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Monolith</h1>
      <p className="text-sm text-gray-500">404 — Page Not Found</p>
      <p className="text-xs text-gray-400">The page you are looking for does not exist.</p>
    </main>
  )
}

export default NotFound
