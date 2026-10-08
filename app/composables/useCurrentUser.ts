import type { JwtPayload } from '@supabase/supabase-js'

export function useCurrentUser() {
  const user = useSupabaseUser()

  const claims = computed<JwtPayload | null>(() => (user.value as JwtPayload | null) ?? null)

  const userId = computed<string | null>(() => claims.value?.sub ?? null)

  const userEmail = computed<string | null>(() => claims.value?.email?.toLowerCase() ?? null)

  return { user, claims, userId, userEmail }
}
