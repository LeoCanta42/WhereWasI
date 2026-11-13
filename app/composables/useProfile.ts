import type { Database } from '~/types/database.types'
import type { ApprovalStatus, Profile } from '~/types'
import { useCurrentUser } from '~/composables/useCurrentUser'
import { offlineStorage } from '~/utils/offlineStorage'
import { isNetworkError } from '~/utils/network'
import { useOfflineSync } from '~/composables/useOfflineSync'

export function useProfile() {
  const supabase = (useNuxtApp() as any).$supabase?.client as ReturnType<typeof useSupabaseClient<Database>> | undefined
    ?? useSupabaseClient<Database>()
  const { userId, userEmail } = useCurrentUser()
  const toast = useToast()
  const { enqueueMutation } = useOfflineSync()

  const profile = useState<Profile | null>('my-profile', () => {
    if (import.meta.client && !offlineStorage.isLoggedOut()) {
      return offlineStorage.getProfile()
    }
    return null
  })

  const loading = useState<boolean>('my-profile-loading', () => false)
  const loaded = useState<boolean>('my-profile-loaded', () => {
    if (import.meta.client && !offlineStorage.isLoggedOut()) {
      return Boolean(offlineStorage.getProfile())
    }
    return false
  })

  // Hydrate client-side if needed
  if (import.meta.client && !offlineStorage.isLoggedOut() && !profile.value) {
    const cached = offlineStorage.getProfile()
    if (cached) {
      profile.value = cached
      loaded.value = true
    }
  }

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
      if (offlineStorage.isLoggedOut()) {
        profile.value = null
        loaded.value = false
      }
      return
    }

    if (import.meta.client) {
      const cached = offlineStorage.getProfile()
      if (cached && (cached.id === id || !cached.id)) {
        profile.value = cached
        loaded.value = true
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return
      }
    }

    loading.value = true
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        if (!isNetworkError(error)) {
          console.error('Error loading profile:', error)
          toast.add({
            title: 'Errore caricamento profilo',
            description: error.message,
            color: 'error'
          })
        }
      } else if (data) {
        profile.value = data as Profile
        offlineStorage.setProfile(data as Profile)
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
        const { data: inserted, error: insertError } = await supabase.from('profiles').insert(defaultProfile as any).select().single()
        if (insertError) {
          if (!isNetworkError(insertError)) {
            console.error('Error creating default profile:', insertError)
            toast.add({
              title: 'Errore creazione profilo',
              description: insertError.message,
              color: 'error'
            })
          }
        } else if (inserted) {
          profile.value = inserted as Profile
          offlineStorage.setProfile(inserted as Profile)
        }
      }
      loaded.value = true
    } catch (err: any) {
      if (!isNetworkError(err)) {
        console.error('Unexpected error loading profile:', err)
      }
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(updates: Partial<Pick<Profile, 'display_name' | 'username' | 'bio' | 'avatar_url'>>): Promise<boolean> {
    const id = userId.value
    if (!id) return false

    // Optimistic local update
    if (profile.value) {
      profile.value = { ...profile.value, ...updates, updated_at: new Date().toISOString() }
      offlineStorage.setProfile(profile.value)
    }

    if (import.meta.client && typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueMutation({
        type: 'profile:update',
        targetId: id,
        payload: updates
      })
      toast.add({
        title: 'Profilo salvato (offline)',
        description: 'Le modifiche verranno sincronizzate appena torna la connessione.',
        color: 'info'
      })
      return true
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if (isNetworkError(error)) {
          enqueueMutation({
            type: 'profile:update',
            targetId: id,
            payload: updates
          })
          toast.add({
            title: 'Profilo salvato (offline)',
            description: 'Connessione assente. Verrà sincronizzato online.',
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
      offlineStorage.setProfile(data as Profile)
      toast.add({
        title: 'Profilo salvato',
        description: 'Le modifiche sono state salvate.',
        color: 'success'
      })
      return true
    } catch (err) {
      if (isNetworkError(err)) {
        enqueueMutation({
          type: 'profile:update',
          targetId: id,
          payload: updates
        })
        toast.add({
          title: 'Profilo salvato (offline)',
          description: 'Connessione assente. Verrà sincronizzato online.',
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
    offlineStorage.clearProfile()
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
