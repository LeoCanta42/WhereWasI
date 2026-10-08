import type { Database } from '~/types/database.types'
import type { ApprovalStatus, Profile } from '~/types'
import { useCurrentUser } from '~/composables/useCurrentUser'

export function useProfile() {
  const supabase = useSupabaseClient<Database>()
  const { userId, userEmail } = useCurrentUser()
  const toast = useToast()

  const profile = useState<Profile | null>('my-profile', () => null)
  const loading = useState<boolean>('my-profile-loading', () => false)
  const loaded = useState<boolean>('my-profile-loaded', () => false)

  const isAdmin = computed(() => Boolean(profile.value?.is_admin))

  const status = computed<ApprovalStatus>(() => {
    if (!loaded.value) return 'unknown'
    if (!profile.value) return 'pending'
    return profile.value.approved ? 'approved' : 'pending'
  })

  const isApproved = computed(() => status.value === 'approved')

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
        // Create initial profile row waiting for approval
        const defaultProfile: Partial<Profile> = {
          id,
          email: userEmail.value,
          username: userEmail.value ? userEmail.value.split('@')[0] : 'user',
          display_name: userEmail.value ? userEmail.value.split('@')[0] : 'User',
          bio: '',
          approved: false,
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

  async function refreshProfile(): Promise<void> {
    await loadProfile()
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
    status,
    loadProfile,
    refreshProfile,
    updateProfile,
    resetProfile
  }
}
