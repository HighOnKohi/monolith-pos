import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { APP_NAME } from '@/config/app'
import PageLoader from '@/components/common/PageLoader'

export default function LoginPage() {
  const { user, loading, signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // While Supabase session is resolving, don't flash the login form
  if (loading) return <PageLoader />

  // Already authenticated → go to kitchen
  if (user) return <Navigate to="/kitchen" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error } = await signIn({ email, password })

    if (error) {
      setError(error.message)
      setSubmitting(false)
    }
    // On success, AuthContext updates user → Navigate above handles redirect
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <span className="text-lg font-bold text-white">M</span>
          </div>
          <h1 className="text-xl font-bold text-primary">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-muted">Restaurant Management System</p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-secondary/15 bg-white p-6 shadow-xs">
          <h2 className="mb-5 text-sm font-semibold text-primary">Sign in to your account</h2>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && (
              <div className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
              disabled={!email || !password}
              className="w-full mt-2"
            >
              Sign in
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          {APP_NAME} · Restaurant Management System
        </p>
      </div>
    </div>
  )
}
