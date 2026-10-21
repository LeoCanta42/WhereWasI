import type { Database } from '~/types/database.types'
import type { ApprovalStatus, Profile } from '~/types'
import { useCurrentUser } from '~/composables/useCurrentUser'
import { getAppCache, setAppCache } from '~/utils/offlineStorage'

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

    // Try reading cached profile first for instant rendering & offline usage
    const cached = await getAppCache<Profile>(`profile_${id}`)
    if (cached) {
      profile.value = cached
      loaded.value = true
    }

    loading.value = true
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        // If offline or network error and we already have cached profile, proceed gracefully
        const isNetworkError = error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')
        if (isNetworkError && profile.value) {
          console.warn('[useProfile] Offline: using cached profile')
        } else {
          console.error('Error loading profile:', error)
          if (!profile.value) {
            toast.add({
              title: 'Errore caricamento profilo',
              description: error.message,
              color: 'error'
            })
          }
        }
      } else if (data) {
        profile.value = data as Profile
        await setAppCache(`profile_${id}`, data)
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
        const { data: inserted, error: insertError } = await supabase
          .from('profiles')
          .insert(defaultProfile as any)
          .select()
          .single()

        if (insertError) {
          console.error('Error creating default profile:', insertError)
          if (!profile.value) {
            toast.add({
              title: 'Errore creazione profilo',
              description: insertError.message,
              color: 'error'
            })
          }
        } else if (inserted) {
          profile.value = inserted as Profile
          await setAppCache(`profile_${id}`, inserted)
        }
      }
      loaded.value = true
    } catch (err: any) {
      const isNetworkError = err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')
      if (isNetworkError && profile.value) {
        console.warn('[useProfile] Offline exception: continuing with cached profile')
      } else {
        console.error('Unexpected error loading profile:', err)
        if (!profile.value) {
          toast.add({
            title: 'Errore imprevisto profilo',
            description: err?.message || 'Si è verificato un errore durante il caricamento del profilo.',
            color: 'error'
          })
        }
      }
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(updates: Partial<Pick<Profile, 'display_name' | 'username' | 'bio' | 'avatar_url'>>): Promise<boolean> {
    const id = userId.value
    if (!id) return false

    // Optimistic update locally
    if (profile.value) {
      profile.value = {
        ...profile.value,
        ...updates
      }
      await setAppCache(`profile_${id}`, profile.value)
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        const isNetwork = error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')
        if (isNetwork) {
          toast.add({
            title: 'Profilo aggiornato offline',
            description: 'Le modifiche al profilo verranno sincronizzate non appena tornerai online.',
            color: 'info'
          })
          return true
        }
        toast.add({
          title: 'Errore',
          description: error.message.includes('unique') ? 'Nome utente già in uso' : error.message,
          color: 'error'
        })
        return false
      }

      profile.value = data as Profile
      await setAppCache(`profile_${id}`, data)
      toast.add({
        title: 'Profilo salvato',
        description: 'Le modifiche sono state salvate.',
        color: 'success'
      })
      return true
    } catch (err: any) {
      const isNetwork = err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')
      if (isNetwork) {
        toast.add({
          title: 'Profilo aggiornato offline',
          description: 'Le modifiche al profilo verranno sincronizzate non appena tornerai online.',
          color: 'info'
        })
        return true
      }
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
