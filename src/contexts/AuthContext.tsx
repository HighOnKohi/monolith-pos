/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignInCredentials {
  email: string
  password: string
}

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (credentials: SignInCredentials) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

// ─── Context (exported for useAuth.ts) ────────────────────────────────────────

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within an AuthProvider')
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const LOCAL_USER_KEY = 'monolith_app_auth_user'

function createSyntheticUser(email: string, role: 'admin' | 'staff'): User {
  return {
    id: role === 'admin' ? 'admin-system-account-id' : 'staff-operational-account-id',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {
      role,
      name: role === 'admin' ? 'System Administrator' : 'Operational Staff',
    },
    aud: 'authenticated',
    confirmation_sent_at: new Date().toISOString(),
    recovery_sent_at: '',
    email_change_sent_at: '',
    new_email: '',
    invited_at: '',
    action_link: '',
    email,
    phone: '',
    created_at: new Date().toISOString(),
    confirmed_at: new Date().toISOString(),
    email_confirmed_at: new Date().toISOString(),
    phone_confirmed_at: '',
    last_sign_in_at: new Date().toISOString(),
    role: 'authenticated',
    updated_at: new Date().toISOString(),
    identities: [],
    factors: [],
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session)
        setUser(session.user)
        setLoading(false)
      } else {
        const localUserRaw = localStorage.getItem(LOCAL_USER_KEY) || localStorage.getItem('monolith_staff_auth_user')
        if (localUserRaw) {
          try {
            const parsed = JSON.parse(localUserRaw) as { email: string; role?: 'admin' | 'staff' }
            const role = parsed.role || (parsed.email.includes('admin') ? 'admin' : 'staff')
            setUser(createSyntheticUser(parsed.email, role))
          } catch {
            localStorage.removeItem(LOCAL_USER_KEY)
          }
        }
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSession(session)
        setUser(session.user)
        setLoading(false)
      } else {
        const localUserRaw = localStorage.getItem(LOCAL_USER_KEY) || localStorage.getItem('monolith_staff_auth_user')
        if (localUserRaw) {
          try {
            const parsed = JSON.parse(localUserRaw) as { email: string; role?: 'admin' | 'staff' }
            const role = parsed.role || (parsed.email.includes('admin') ? 'admin' : 'staff')
            setUser(createSyntheticUser(parsed.email, role))
          } catch {
            localStorage.removeItem(LOCAL_USER_KEY)
            setUser(null)
          }
        } else {
          setUser(null)
        }
        setSession(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn({ email, password }: SignInCredentials) {
    const normEmail = email.trim().toLowerCase()
    const trimmedPass = password.trim()

    // 1. Dedicated Admin Account Credentials
    if (
      (normEmail === 'admin@monolith.com' ||
        normEmail === 'adminmonolith@gmail.com' ||
        normEmail === 'admin@pos.com') &&
      (trimmedPass === 'AdminPassword123!' || trimmedPass === 'Admin123!' || trimmedPass === 'admin123')
    ) {
      const adminUser = createSyntheticUser(normEmail, 'admin')
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify({ email: normEmail, role: 'admin' }))
      setUser(adminUser)
      return { error: null }
    }

    // 2. Dedicated Operational Staff Account Credentials
    if (
      (normEmail === 'staff@monolith.com' ||
        normEmail === 'staffmonolith@gmail.com') &&
      (trimmedPass === 'StaffPassword123!' || trimmedPass === 'Staff123!')
    ) {
      const staffUser = createSyntheticUser(normEmail, 'staff')
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify({ email: normEmail, role: 'staff' }))
      setUser(staffUser)
      return { error: null }
    }

    // 3. Supabase Cloud Authentication (e.g. taponakawnt@gmail.com)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data?.user) {
      localStorage.removeItem(LOCAL_USER_KEY)
      setUser(data.user)
    }
    return { error }
  }

  async function signOut() {
    localStorage.removeItem(LOCAL_USER_KEY)
    localStorage.removeItem('monolith_staff_auth_user')
    setUser(null)
    setSession(null)
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
