import type { User } from '@supabase/supabase-js'

export function useCurrentUser() {
  const supabaseUser = useSupabaseUser()

  const fallbackUserId = useState<string | null>('fallback-user-id', () => {
    if (import.meta.client) {
      try {
        return localStorage.getItem('where_was_i_user_id')
      } catch {
        return null
      }
    }
    return null
  })

  const fallbackEmail = useState<string | null>('fallback-user-email', () => {
    if (import.meta.client) {
      try {
        return localStorage.getItem('where_was_i_user_email')
      } catch {
        return null
      }
    }
    return null
  })

  const cachedRawUser = useState<any>('fallback-user-raw', () => {
    if (import.meta.client) {
      try {
        const raw = localStorage.getItem('where_was_i_user_raw')
        if (raw) return JSON.parse(raw)
      } catch {
        return null
      }
    }
    return null
  })

  // Keep local storage in sync whenever user object is present from Supabase
  if (import.meta.client) {
    watch(supabaseUser, (val) => {
      const u = val as (User & { sub?: string }) | null
      if (u) {
        const id = u.id || u.sub || null
        const email = (u.email || (u as any).user_metadata?.email || null)?.toLowerCase() ?? null
        if (id) {
          fallbackUserId.value = id
          localStorage.setItem('where_was_i_user_id', id)
        }
        if (email) {
          fallbackEmail.value = email
          localStorage.setItem('where_was_i_user_email', email)
        }
        const userSnapshot = {
          id: id || fallbackUserId.value,
          email: email || fallbackEmail.value,
          user_metadata: (u as any).user_metadata || { email }
        }
        cachedRawUser.value = userSnapshot
        localStorage.setItem('where_was_i_user_raw', JSON.stringify(userSnapshot))
      }
    }, { immediate: true })
  }

  const userId = computed<string | null>(() => {
    const u = supabaseUser.value as (User & { sub?: string }) | null
    if (u) {
      return u.id || u.sub || null
    }
    return fallbackUserId.value
  })

  const userEmail = computed<string | null>(() => {
    const u = supabaseUser.value as (User & { email?: string }) | null
    if (u) {
      return (u.email || (u as any).user_metadata?.email || null)?.toLowerCase() ?? null
    }
    return fallbackEmail.value
  })

  const effectiveUser = computed(() => {
    if (supabaseUser.value) return supabaseUser.value
    if (cachedRawUser.value) return cachedRawUser.value
    if (fallbackUserId.value) {
      return {
        id: fallbackUserId.value,
        email: fallbackEmail.value,
        user_metadata: { email: fallbackEmail.value }
      }
    }
    return null
  })

  const isAuthenticated = computed<boolean>(() => Boolean(userId.value))

  const claims = computed(() => (supabaseUser.value as any) ?? cachedRawUser.value ?? null)

  function clearFallbackUser() {
    fallbackUserId.value = null
    fallbackEmail.value = null
    cachedRawUser.value = null
    if (import.meta.client) {
      try {
        localStorage.removeItem('where_was_i_user_id')
        localStorage.removeItem('where_was_i_user_email')
        localStorage.removeItem('where_was_i_user_raw')
        localStorage.removeItem('where_was_i_profile_snapshot')
        localStorage.removeItem('where_was_i_items_snapshot')
        localStorage.removeItem('where_was_i_friends_snapshot')
      } catch {
        // ignore
      }
    }
  }

  return {
    user: effectiveUser,
    supabaseUser,
    claims,
    userId,
    userEmail,
    isAuthenticated,
    clearFallbackUser
  }
}
