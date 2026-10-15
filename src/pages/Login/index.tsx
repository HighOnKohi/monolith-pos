import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { APP_NAME } from '@/config/app'
import PageLoader from '@/components/common/PageLoader'

export default function LoginPage() {
  const navigate = useNavigate()
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
              className="w-full mt-2 cursor-pointer"
            >
              Sign in
            </Button>

            {/* Quick Demo Credentials */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1.5">
                <span>Select Account Role:</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@monolith.com')
                    setPassword('AdminPassword123!')
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition-all text-center cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                  title="Autofill Admin credentials (admin@monolith.com / AdminPassword123!)"
                >
                  <span className="text-amber-500">👑</span>
                  <span>Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('staff@monolith.com')
                    setPassword('StaffPassword123!')
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition-all text-center cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                  title="Autofill Staff credentials (staff@monolith.com / StaffPassword123!)"
                >
                  <span>🧑‍🍳</span>
                  <span>Staff</span>
                </button>
              </div>
            </div>
          </form>

          {/* ── Customer Advance Order Button ── */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 text-center mb-2 font-semibold">
              Dining or Pre-Ordering at the Venue?
            </p>
            <button
              type="button"
              onClick={() => navigate('/advance-order')}
              className="w-full py-2.5 px-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100/80 text-blue-900 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-98"
            >
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Advance Order</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Requires venue location verification.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          {APP_NAME} · Restaurant Management System
        </p>
      </div>
    </div>
  )
}
