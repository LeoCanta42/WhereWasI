import type { User } from '@supabase/supabase-js'

export function useCurrentUser() {
  const user = useSupabaseUser()

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

  // Keep local storage in sync whenever user object is present
  if (import.meta.client) {
    watch(user, (val) => {
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
      }
    }, { immediate: true })
  }

  const userId = computed<string | null>(() => {
    const u = user.value as (User & { sub?: string }) | null
    if (u) {
      return u.id || u.sub || null
    }
    return fallbackUserId.value
  })

  const userEmail = computed<string | null>(() => {
    const u = user.value as (User & { email?: string }) | null
    if (u) {
      return (u.email || (u as any).user_metadata?.email || null)?.toLowerCase() ?? null
    }
    return fallbackEmail.value
  })

  const claims = computed(() => (user.value as any) ?? null)

  function clearFallbackUser() {
    fallbackUserId.value = null
    fallbackEmail.value = null
    if (import.meta.client) {
      try {
        localStorage.removeItem('where_was_i_user_id')
        localStorage.removeItem('where_was_i_user_email')
      } catch {
        // ignore
      }
    }
  }

  return { user, claims, userId, userEmail, clearFallbackUser }
}
