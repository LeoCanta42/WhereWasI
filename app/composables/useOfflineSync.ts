import type { Database } from '~/types/database.types'
import { offlineStorage, type OfflineMutation, type MutationType } from '~/utils/offlineStorage'
import { isNetworkError } from '~/utils/network'
import type { MediaItem, Profile } from '~/types'
import { formatProgressDisplay } from '~/utils/media'

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'mut_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36)
}

export function useOfflineSync() {
  const isOnline = useState<boolean>('offline:is-online', () => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine
    }
    return true
  })

  const isSyncing = useState<boolean>('offline:is-syncing', () => false)
  const mutationQueue = useState<OfflineMutation[]>('offline:mutations', () => {
    return offlineStorage.getMutations()
  })

  const pendingCount = computed(() => mutationQueue.value.length)

  // Sync state between ref and localStorage
  function refreshQueueState() {
    mutationQueue.value = offlineStorage.getMutations()
  }

  function enqueueMutation(mutation: Omit<OfflineMutation, 'id' | 'createdAt'>): OfflineMutation {
    const fullMutation: OfflineMutation = {
      ...mutation,
      id: generateId(),
      createdAt: Date.now()
    }

    offlineStorage.addMutation(fullMutation)
    refreshQueueState()

    // If online, attempt background sync
    if (isOnline.value && !isSyncing.value) {
      processQueue().catch(err => {
        console.warn('[useOfflineSync] Error triggering sync after enqueue:', err)
      })
    }

    return fullMutation
  }

  function removeMutationsForTempId(tempId: number | string) {
    const remaining = offlineStorage.getMutations().filter(m => m.tempId !== tempId && m.targetId !== tempId)
    offlineStorage.setMutations(remaining)
    refreshQueueState()
  }

  async function processQueue(): Promise<void> {
    if (!import.meta.client) return
    if (!isOnline.value || isSyncing.value) return

    const currentQueue = offlineStorage.getMutations()
    if (currentQueue.length === 0) return

    isSyncing.value = true

    const supabase = useNuxtApp().$supabase?.client as ReturnType<typeof useSupabaseClient<Database>> | undefined
      ?? useSupabaseClient<Database>()
    if (!supabase) {
      isSyncing.value = false
      return
    }

    const toast = useToast()
    const itemsState = useState<MediaItem[]>('media-items', () => [])
    const profileState = useState<Profile | null>('my-profile', () => null)

    const idMap = new Map<number | string, number | string>()
    let processedCount = 0

    try {
      for (const mutation of currentQueue) {
        // Double check online status
        if (!navigator.onLine) {
          isOnline.value = false
          break
        }

        try {
          switch (mutation.type) {
            case 'media:insert': {
              const payload = { ...mutation.payload }
              if ('id' in payload && typeof payload.id === 'number' && payload.id < 0) {
                delete payload.id
              }

              const { data, error } = await supabase
                .from('media_items')
                .insert(payload as any)
                .select()
                .single()

              if (error) {
                if (isNetworkError(error)) {
                  throw error
                }
                console.error('[useOfflineSync] Error syncing media insert:', error)
              } else if (data && mutation.tempId) {
                const realItem = data as unknown as MediaItem
                idMap.set(mutation.tempId, realItem.id)

                // Replace temp item in memory
                itemsState.value = itemsState.value.map(item =>
                  item.id === mutation.tempId ? realItem : item
                )
                offlineStorage.setMediaItems(itemsState.value)

                // Try logging activity for the inserted item
                try {
                  let actionType: any = 'started'
                  let message = `Ha iniziato a seguire "${realItem.title}"`
                  if (realItem.status === 'completed') {
                    actionType = 'completed'
                    message = realItem.media_type === 'movie'
                      ? `Ha visto il film "${realItem.title}"! 🎬`
                      : realItem.media_type === 'book'
                        ? `Ha finito di leggere "${realItem.title}"! 📚`
                        : `Ha completato "${realItem.title}"! 🎉`
                  } else if (realItem.status === 'planned') {
                    actionType = 'status_changed'
                    message = `Ha aggiunto "${realItem.title}" alla lista`
                  }

                  await supabase.from('media_activities').insert({
                    user_id: realItem.user_id,
                    media_item_id: realItem.id,
                    media_title: realItem.title,
                    media_type: realItem.media_type,
                    action_type: actionType,
                    progress_text: formatProgressDisplay(realItem, true),
                    message,
                    is_private: realItem.is_private
                  } as any)
                } catch (actErr) {
                  console.warn('[useOfflineSync] Activity logging failed (non-fatal):', actErr)
                }
              }
              break
            }

            case 'media:update': {
              const rawTargetId = mutation.targetId
              const targetId = (typeof rawTargetId === 'number' && idMap.has(rawTargetId))
                ? idMap.get(rawTargetId)!
                : rawTargetId

              if (typeof targetId === 'number' && targetId > 0) {
                const payload = {
                  ...mutation.payload,
                  updated_at: new Date().toISOString()
                }

                const { data, error } = await supabase
                  .from('media_items')
                  .update(payload as any)
                  .eq('id', targetId)
                  .select()
                  .single()

                if (error) {
                  if (isNetworkError(error)) {
                    throw error
                  }
                  console.error('[useOfflineSync] Error syncing media update:', error)
                } else if (data) {
                  const updatedItem = data as unknown as MediaItem
                  itemsState.value = itemsState.value.map(item =>
                    item.id === targetId ? updatedItem : item
                  )
                  offlineStorage.setMediaItems(itemsState.value)
                }
              }
              break
            }

            case 'media:delete': {
              const rawTargetId = mutation.targetId
              const targetId = (typeof rawTargetId === 'number' && idMap.has(rawTargetId))
                ? idMap.get(rawTargetId)!
                : rawTargetId

              if (typeof targetId === 'number' && targetId > 0) {
                const { error } = await supabase
                  .from('media_items')
                  .delete()
                  .eq('id', targetId)

                if (error) {
                  if (isNetworkError(error)) {
                    throw error
                  }
                  console.error('[useOfflineSync] Error syncing media delete:', error)
                } else {
                  itemsState.value = itemsState.value.filter(item => item.id !== targetId)
                  offlineStorage.setMediaItems(itemsState.value)
                }
              }
              break
            }

            case 'profile:update': {
              const targetUserId = mutation.targetId as string
              if (targetUserId) {
                const { data, error } = await supabase
                  .from('profiles')
                  .update(mutation.payload)
                  .eq('id', targetUserId)
                  .select()
                  .single()

                if (error) {
                  if (isNetworkError(error)) {
                    throw error
                  }
                  console.error('[useOfflineSync] Error syncing profile update:', error)
                } else if (data) {
                  profileState.value = data as Profile
                  offlineStorage.setProfile(data as Profile)
                }
              }
              break
            }
          }

          // Successfully processed this mutation
          offlineStorage.removeMutation(mutation.id)
          processedCount++
        } catch (innerErr) {
          if (isNetworkError(innerErr)) {
            console.warn('[useOfflineSync] Network interrupted while syncing mutation, pausing queue.')
            isOnline.value = false
            break
          } else {
            console.error('[useOfflineSync] Non-network error on mutation, removing to prevent deadlock:', innerErr)
            offlineStorage.removeMutation(mutation.id)
          }
        }
      }
    } finally {
      refreshQueueState()
      isSyncing.value = false

      if (processedCount > 0 && offlineStorage.getMutations().length === 0) {
        toast.add({
          title: 'Sincronizzazione completata',
          description: `${processedCount} ${processedCount === 1 ? 'modifica sincronizzata' : 'modifiche sincronizzate'} con successo.`,
          color: 'success'
        })
      }
    }
  }

  // Setup connectivity listeners in browser
  if (import.meta.client && typeof window !== 'undefined') {
    const handleOnline = () => {
      isOnline.value = true
      processQueue().catch(err => {
        console.warn('[useOfflineSync] Error processing queue on reconnect:', err)
      })
    }

    const handleOffline = () => {
      isOnline.value = false
    }

    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  return {
    isOnline,
    isSyncing,
    pendingCount,
    mutationQueue,
    enqueueMutation,
    removeMutationsForTempId,
    processQueue,
    refreshQueueState
  }
}
