import type { User, JwtPayload } from '@supabase/supabase-js'
import { offlineStorage } from '~/utils/offlineStorage'

/**
 * Identity of the signed-in user.
 *
 * In offline mode or when network fails, this composable falls back to the
 * locally cached user session so the user remains authenticated offline.
 */
export function useCurrentUser() {
  const rawSupabaseUser = useSupabaseUser()

  const offlineUserState = useState<JwtPayload | null>('wherewasi-offline-user', () => {
    if (import.meta.client && !offlineStorage.isLoggedOut()) {
      return offlineStorage.getUser()
    }
    return null
  })

  // Hydrate client-side if needed
  if (import.meta.client && !offlineStorage.isLoggedOut() && !offlineUserState.value) {
    const cached = offlineStorage.getUser()
    if (cached) {
      offlineUserState.value = cached
    }
  }

  // If Supabase user claims are present, update cache
  if (rawSupabaseUser.value) {
    offlineUserState.value = rawSupabaseUser.value as JwtPayload
    offlineStorage.setUser(rawSupabaseUser.value as JwtPayload)
  } else if (offlineUserState.value && !offlineStorage.isLoggedOut()) {
    // Keep useSupabaseUser populated so any external plugins/composables see the user
    rawSupabaseUser.value = offlineUserState.value as any
  }

  const activeUser = computed<any>(() => {
    if (rawSupabaseUser.value) return rawSupabaseUser.value
    if (!offlineStorage.isLoggedOut()) {
      return offlineUserState.value
    }
    return null
  })

  const userId = computed<string | null>(() => {
    const u = activeUser.value as (User & { sub?: string }) | null
    if (!u) return null
    return u.id || u.sub || null
  })

  const userEmail = computed<string | null>(() => {
    const u = activeUser.value as (User & { email?: string }) | null
    if (!u) return null
    return (u.email || (u as any).user_metadata?.email || null)?.toLowerCase() ?? null
  })

  const claims = computed(() => activeUser.value ?? null)

  return { user: activeUser, claims, userId, userEmail, rawUser: rawSupabaseUser }
}
