import type { Database } from '~/types/database.types'
import type { MediaItem, MediaActivity } from '~/types'
import {
  getPendingMutations,
  getPendingCount,
  removeMutation,
  updateMutationTempId,
  replaceCachedMediaItemId,
  getAppCache,
  setAppCache,
  clearAllOfflineStorage
} from '~/utils/offlineStorage'
import { formatProgressDisplay } from '~/utils/media'

export function useOfflineSync() {
  const supabase = useSupabaseClient<Database>()
  const toast = useToast()

  const isOnline = useState<boolean>('offline-is-online', () => true)
  const isSyncing = useState<boolean>('offline-is-syncing', () => false)
  const pendingCount = useState<number>('offline-pending-count', () => 0)
  const lastSyncTime = useState<string | null>('offline-last-sync', () => null)
  const syncVersion = useState<number>('offline-sync-version', () => 0)

  // Initialize client-side state
  if (import.meta.client) {
    if (typeof navigator !== 'undefined') {
      isOnline.value = navigator.onLine
    }
  }

  async function refreshPendingCount(): Promise<number> {
    const count = await getPendingCount()
    pendingCount.value = count
    return count
  }

  async function checkConnectivity(): Promise<boolean> {
    if (!import.meta.client) return true
    if (!navigator.onLine) {
      isOnline.value = false
      return false
    }

    // Ping check with small timeout to detect captive portals / dead Wi-Fi
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const res = await fetch('/manifest.webmanifest', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      })
      clearTimeout(timeout)
      isOnline.value = res.ok
      return res.ok
    } catch {
      // In case local fetch fails when truly offline
      isOnline.value = false
      return false
    }
  }

  async function syncNow(notifyOnSuccess = true): Promise<boolean> {
    if (isSyncing.value) return false

    if (import.meta.client && !navigator.onLine) {
      isOnline.value = false
      return false
    }

    isSyncing.value = true

    try {
      await refreshPendingCount()
      const mutations = await getPendingMutations()

      if (mutations.length === 0) {
        lastSyncTime.value = new Date().toISOString()
        await setAppCache('last_sync_time', lastSyncTime.value)
        isOnline.value = true
        isSyncing.value = false
        return true
      }

      const idMap = new Map<number, number>()
      let processedCount = 0

      for (const mutation of mutations) {
        if (!mutation.queue_id) continue

        // Check if item_id was mapped from a previous offline insert
        let targetId = mutation.item_id
        if (targetId < 0 && idMap.has(targetId)) {
          targetId = idMap.get(targetId)!
        }

        try {
          if (mutation.action === 'insert') {
            const rawPayload = { ...mutation.payload }
            // Remove negative temporary ID so DB sequence assigns real ID
            if (rawPayload.id && rawPayload.id < 0) {
              delete rawPayload.id
            }

            const { data, error } = await supabase
              .from('media_items')
              .insert(rawPayload as any)
              .select()
              .single()

            if (error) {
              if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
                isOnline.value = false
                break
              }
              console.error('[OfflineSync] Insert failed:', error)
              // If it's a validation error or invalid row, remove to avoid blocking the queue
              await removeMutation(mutation.queue_id)
              continue
            }

            const newItem = data as unknown as MediaItem
            const oldTempId = mutation.tempId || mutation.item_id
            idMap.set(oldTempId, newItem.id)

            // Update in offline cache
            await replaceCachedMediaItemId(oldTempId, newItem)
            await updateMutationTempId(oldTempId, newItem.id)

            // Log activity for newly synced item
            try {
              let actionType: MediaActivity['action_type'] = 'started'
              let message = `Ha iniziato a seguire "${newItem.title}"`

              if (newItem.status === 'completed') {
                actionType = 'completed'
                if (newItem.media_type === 'movie') message = `Ha visto il film "${newItem.title}"! 🎬`
                else if (newItem.media_type === 'book') message = `Ha finito di leggere "${newItem.title}"! 📚`
                else if (newItem.media_type === 'series') message = `Ha completato la serie "${newItem.title}"! 🍿`
                else message = `Ha completato "${newItem.title}"! 🎉`
              } else if (newItem.status === 'planned') {
                actionType = 'status_changed'
                if (newItem.media_type === 'movie') message = `Ha aggiunto "${newItem.title}" ai film da vedere`
                else if (newItem.media_type === 'book') message = `Ha aggiunto "${newItem.title}" ai libri da leggere`
                else message = `Ha aggiunto "${newItem.title}" alla lista da iniziare`
              }

              await supabase.from('media_activities').insert({
                user_id: newItem.user_id,
                media_item_id: newItem.id,
                media_title: newItem.title,
                media_type: newItem.media_type,
                action_type: actionType,
                progress_text: formatProgressDisplay(newItem, true),
                message,
                is_private: newItem.is_private
              } as any)
            } catch (actErr) {
              console.warn('[OfflineSync] Failed to log activity for synced item:', actErr)
            }

            await removeMutation(mutation.queue_id)
            processedCount++
          } else if (mutation.action === 'update') {
            if (targetId < 0) {
              // Target ID was not resolved yet (e.g. insert failed earlier)
              continue
            }

            const updatePayload = {
              ...mutation.payload,
              updated_at: new Date().toISOString()
            }
            if (updatePayload.id) delete updatePayload.id

            const { data, error } = await supabase
              .from('media_items')
              .update(updatePayload as any)
              .eq('id', targetId)
              .select()
              .single()

            if (error) {
              if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
                isOnline.value = false
                break
              }
              // If row was deleted on server (PGRST116), dismiss update
              if (error.code === 'PGRST116') {
                await removeMutation(mutation.queue_id)
                continue
              }
              console.error('[OfflineSync] Update failed:', error)
              await removeMutation(mutation.queue_id)
              continue
            }

            const updatedItem = data as unknown as MediaItem

            // Log activity if completed or progress changed
            try {
              if (updatedItem.status === 'completed') {
                await supabase.from('media_activities').insert({
                  user_id: updatedItem.user_id,
                  media_item_id: updatedItem.id,
                  media_title: updatedItem.title,
                  media_type: updatedItem.media_type,
                  action_type: 'completed',
                  progress_text: formatProgressDisplay(updatedItem, true),
                  message: `Ha completato "${updatedItem.title}"! 🎉`,
                  is_private: updatedItem.is_private
                } as any)
              }
            } catch {
              // Ignore activity errors during batch sync
            }

            await removeMutation(mutation.queue_id)
            processedCount++
          } else if (mutation.action === 'delete') {
            if (targetId > 0) {
              const { error } = await supabase
                .from('media_items')
                .delete()
                .eq('id', targetId)

              if (error) {
                if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
                  isOnline.value = false
                  break
                }
                console.error('[OfflineSync] Delete failed:', error)
              }
            }
            await removeMutation(mutation.queue_id)
            processedCount++
          }
        } catch (itemErr: any) {
          if (itemErr?.message?.includes('Failed to fetch') || itemErr?.message?.includes('NetworkError')) {
            isOnline.value = false
            break
          }
          console.error('[OfflineSync] Unexpected error on mutation:', itemErr)
          await removeMutation(mutation.queue_id)
        }
      }

      const remaining = await refreshPendingCount()
      isOnline.value = true
      lastSyncTime.value = new Date().toISOString()
      await setAppCache('last_sync_time', lastSyncTime.value)

      // Notify other composables that sync has altered items
      syncVersion.value++

      if (notifyOnSuccess && processedCount > 0) {
        toast.add({
          title: 'Sincronizzazione completata',
          description: `${processedCount} ${processedCount === 1 ? 'modifica sincronizzata' : 'modifiche sincronizzate'} con successo.`,
          color: 'success'
        })
      }

      return remaining === 0
    } catch (err) {
      console.error('[OfflineSync] General sync error:', err)
      return false
    } finally {
      isSyncing.value = false
    }
  }

  async function resetOfflineCache(): Promise<void> {
    await clearAllOfflineStorage()
    pendingCount.value = 0
    toast.add({
      title: 'Memoria locale svuotata',
      description: 'La cache locale è stata cancellata.',
      color: 'neutral'
    })
  }

  // Setup window network events once on client
  if (import.meta.client) {
    const handleOnline = async () => {
      isOnline.value = true
      const reallyOnline = await checkConnectivity()
      if (reallyOnline) {
        toast.add({
          title: 'Connessione ripristinata',
          description: pendingCount.value > 0 ? 'Sincronizzazione modifiche in corso...' : 'Sei di nuovo online.',
          color: 'info'
        })
        await syncNow(true)
      }
    }

    const handleOffline = () => {
      isOnline.value = false
      toast.add({
        title: 'Sei offline',
        description: 'WhereWasI continuerà a funzionare memorizzando le modifiche sul dispositivo.',
        color: 'warning'
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Load initial sync timestamp & count
    getAppCache<string>('last_sync_time').then((val) => {
      if (val) lastSyncTime.value = val
    })
    refreshPendingCount()
  }

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    syncVersion,
    refreshPendingCount,
    checkConnectivity,
    syncNow,
    resetOfflineCache
  }
}
