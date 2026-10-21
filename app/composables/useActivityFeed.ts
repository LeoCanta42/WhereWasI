import type { Database } from '~/types/database.types'
import type { MediaActivity, Profile } from '~/types'
import { useCurrentUser } from '~/composables/useCurrentUser'

export function useActivityFeed() {
  const supabase = useSupabaseClient<Database>()
  const { userId } = useCurrentUser()

  const activities = useState<MediaActivity[]>('activity-feed', () => [])
  const loading = useState<boolean>('activity-feed-loading', () => false)

  async function loadFeed() {
    const id = userId.value
    if (!id) {
      activities.value = []
      return
    }

    loading.value = true
    try {
      // 1. Fetch activities (RLS guarantees we only get self and friends non-private)
      const { data, error } = await supabase
        .from('media_activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40)

      if (error) {
        console.error('Error loading activities:', error)
        return
      }

      const raw = (data as unknown as MediaActivity[]) ?? []
      if (raw.length === 0) {
        activities.value = []
        return
      }

      // 2. Fetch profiles for user_ids in feed
      const userIds = Array.from(new Set(raw.map((a) => a.user_id)))
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)

      const profilesMap = new Map<string, Profile>()
      for (const p of (profilesData as unknown as Profile[]) ?? []) {
        profilesMap.set(p.id, p)
      }

      activities.value = raw.map((a) => ({
        ...a,
        profile: profilesMap.get(a.user_id)
      }))
    } catch (err) {
      console.error('Unexpected error loading activity feed:', err)
    } finally {
      loading.value = false
    }
  }

  return {
    activities,
    loading,
    loadFeed
  }
}
