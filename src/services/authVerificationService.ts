import { supabase } from '@/lib/supabase'

/**
 * Verifies administrator credentials using Supabase authentication.
 * Checks against the current session email, registered active ADMIN accounts
 * in Staff_Accounts, and the primary store administrator.
 *
 * Preserves the active staff session so the current station operator is not logged out.
 */
export async function verifyAdminPassword(
  password: string,
  currentEmail?: string | null,
): Promise<{ valid: boolean; error?: string }> {
  if (!password || !password.trim()) {
    return { valid: false, error: 'Admin password is required.' }
  }

  // 1. Gather candidate administrator emails
  const candidateEmails = new Set<string>()

  if (currentEmail && currentEmail.trim()) {
    candidateEmails.add(currentEmail.trim().toLowerCase())
  }

  try {
    const { data: adminAccounts } = await supabase
      .from('Staff_Accounts')
      .select('EMAIL')
      .eq('ROLE', 'ADMIN')
      .eq('STATUS', 'ACTIVE')

    for (const acc of adminAccounts ?? []) {
      if (acc.EMAIL && typeof acc.EMAIL === 'string') {
        candidateEmails.add(acc.EMAIL.trim().toLowerCase())
      }
    }
  } catch (err) {
    console.warn('[verifyAdminPassword] Staff_Accounts query warning:', err)
  }

  // Known fallback administrator account
  candidateEmails.add('taponakawnt123@gmail.com')

  // Capture existing session before attempting verification
  let originalSession: { access_token: string; refresh_token: string } | null = null
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData?.session) {
      originalSession = {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      }
    }
  } catch {
    // ignore
  }

  let isAuthenticated = false

  // 2. Test candidate emails against Supabase Auth
  for (const email of candidateEmails) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: password.trim(),
      })

      if (!error && data?.user) {
        isAuthenticated = true
        break
      }
    } catch {
      // Continue trying next candidate
    }
  }

  // 3. Restore original session if it was altered and differed from verified user
  if (originalSession) {
    try {
      const { data: currentSessionData } = await supabase.auth.getSession()
      if (currentSessionData?.session?.access_token !== originalSession.access_token) {
        await supabase.auth.setSession({
          access_token: originalSession.access_token,
          refresh_token: originalSession.refresh_token,
        })
      }
    } catch {
      // ignore
    }
  }

  if (isAuthenticated) {
    return { valid: true }
  }

  return { valid: false, error: 'Incorrect administrator password.' }
}
