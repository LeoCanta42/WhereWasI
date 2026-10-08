import type { Database } from '~/types/database.types'
import type { Profile } from '~/types'
import { useCurrentUser } from '~/composables/useCurrentUser'

export function useProfile() {
  const supabase = useSupabaseClient<Database>()
  const { userId, userEmail } = useCurrentUser()
  const toast = useToast()

  const profile = useState<Profile | null>('my-profile', () => null)
  const loading = useState<boolean>('my-profile-loading', () => false)
  const loaded = useState<boolean>('my-profile-loaded', () => false)

  const isAdmin = computed(() => Boolean(profile.value?.is_admin))
  const isApproved = computed(() => profile.value ? profile.value.approved : true)

  async function loadProfile() {
    const id = userId.value
    if (!id) {
      profile.value = null
      loaded.value = false
      return
    }

    loading.value = true
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        console.error('Error loading profile:', error)
      } else if (data) {
        profile.value = data as Profile
      } else {
        // Fallback: create default profile row if trigger hasn't run yet
        const defaultProfile: Partial<Profile> = {
          id,
          email: userEmail.value,
          username: userEmail.value ? userEmail.value.split('@')[0] : 'user',
          display_name: userEmail.value ? userEmail.value.split('@')[0] : 'User',
          bio: '',
          approved: true,
          is_admin: false
        }
        const { data: inserted } = await supabase.from('profiles').insert(defaultProfile as any).select().single()
        if (inserted) {
          profile.value = inserted as Profile
        }
      }
      loaded.value = true
    } catch (err) {
      console.error('Unexpected error loading profile:', err)
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(updates: Partial<Pick<Profile, 'display_name' | 'username' | 'bio' | 'avatar_url'>>): Promise<boolean> {
    const id = userId.value
    if (!id) return false

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        toast.add({
          title: 'Errore',
          description: error.message.includes('unique') ? 'Nome utente già in uso' : error.message,
          color: 'error'
        })
        return false
      }

      profile.value = data as Profile
      toast.add({
        title: 'Profilo salvato',
        description: 'Le modifiche sono state salvate.',
        color: 'success'
      })
      return true
    } catch (err) {
      console.error('Error updating profile:', err)
      return false
    }
  }

  function resetProfile() {
    profile.value = null
    loaded.value = false
  }

  return {
    profile,
    loading,
    loaded,
    isAdmin,
    isApproved,
    loadProfile,
    updateProfile,
    resetProfile
  }
}
