import type { User } from '@supabase/supabase-js'

export function useCurrentUser() {
  const user = useSupabaseUser()

  const userId = computed<string | null>(() => {
    const u = user.value as (User & { sub?: string }) | null
    if (!u) return null
    return u.id || u.sub || null
  })

  const userEmail = computed<string | null>(() => {
    const u = user.value as (User & { email?: string }) | null
    if (!u) return null
    return (u.email || (u as any).user_metadata?.email || null)?.toLowerCase() ?? null
  })

  const claims = computed(() => (user.value as any) ?? null)

  return { user, claims, userId, userEmail }
}
