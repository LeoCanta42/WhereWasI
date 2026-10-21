import type { Database } from '~/types/database.types'
import type { MediaItem, MediaActivity, MediaStatus, MediaType, ProgressType } from '~/types'
import { useCurrentUser } from '~/composables/useCurrentUser'
import { usePreferences, type SortOptionId } from '~/composables/usePreferences'
import { useOfflineSync } from '~/composables/useOfflineSync'
import {
  getCachedMediaItems,
  saveCachedMediaItems,
  saveCachedMediaItem,
  removeCachedMediaItem,
  enqueueMutation
} from '~/utils/offlineStorage'
import {
  formatProgressDisplay,
  getEpisodesForSeason,
  parseTimeToMinutes,
  formatMinutesToTime,
  sortMediaItems
} from '~/utils/media'

export function useMediaTracker() {
  const supabase = useSupabaseClient<Database>()
  const { userId } = useCurrentUser()
  const toast = useToast()
  const { isOnline, refreshPendingCount, syncVersion } = useOfflineSync()

  const items = useState<MediaItem[]>('media-items', () => {
    if (import.meta.client) {
      try {
        const raw = localStorage.getItem('where_was_i_items_snapshot')
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      } catch {
        return []
      }
    }
    return []
  })
  const loading = useState<boolean>('media-items-loading', () => false)
  const loaded = useState<boolean>('media-items-loaded', () => {
    if (import.meta.client) {
      try {
        return Boolean(localStorage.getItem('where_was_i_items_snapshot'))
      } catch {
        return false
      }
    }
    return false
  })

  function persistItemsSnapshot(list: MediaItem[]) {
    if (import.meta.client) {
      try {
        localStorage.setItem('where_was_i_items_snapshot', JSON.stringify(list))
      } catch (err) {
        // ignore quota errors
      }
    }
  }

  // Keep local storage snapshot updated on every mutation
  if (import.meta.client) {
    watch(items, (val) => {
      if (Array.isArray(val)) {
        persistItemsSnapshot(val)
      }
    }, { deep: true })

    // Reload when an offline sync completes
    watch(syncVersion, async () => {
      await loadItems()
    })
  }

  async function loadItems() {
    const id = userId.value
    if (!id) {
      items.value = []
      loaded.value = false
      return
    }

    // 1. Instant load from local IndexedDB cache
    const { prefs } = usePreferences()
    const cached = await getCachedMediaItems(id)
    if (cached && cached.length > 0) {
      // Keep any pending offline-created items (id < 0) that are currently in memory
      const pendingOffline = items.value.filter((i) => i.id < 0)
      const cachedIds = new Set(cached.map((c) => c.id))
      const combined = [
        ...pendingOffline.filter((p) => !cachedIds.has(p.id)),
        ...cached
      ]
      items.value = sortMediaItems(combined, prefs.value.sortBy)
      persistItemsSnapshot(items.value)
      loaded.value = true
    }

    loading.value = true
    try {
      const { data, error } = await supabase
        .from('media_items')
        .select('*')
        .eq('user_id', id)

      if (error) {
        const isNetwork = error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')
        if (!isNetwork) {
          console.error('Error loading media items:', error)
        } else {
          console.warn('[useMediaTracker] Network unavailable: using cached items.')
        }
      } else if (data) {
        const serverItems = (data as unknown as MediaItem[]) ?? []
        // Persist fresh server items in IndexedDB
        await saveCachedMediaItems(serverItems)

        // Merge server items with any locally created items still waiting to sync
        const pendingOffline = items.value.filter((i) => i.id < 0)
        items.value = sortMediaItems([...pendingOffline, ...serverItems], prefs.value.sortBy)
        persistItemsSnapshot(items.value)
      }
      loaded.value = true
    } catch (err: any) {
      console.warn('[useMediaTracker] Error or offline while loading items:', err)
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function addItem(payload: Omit<MediaItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<MediaItem | null> {
    const id = userId.value
    if (!id) return null

    const nowIso = new Date().toISOString()
    const row = {
      ...payload,
      user_id: id,
      started_at: payload.started_at ?? (payload.status !== 'planned' ? nowIso : null),
      completed_at: payload.completed_at ?? (payload.status === 'completed' ? nowIso : null),
      updated_at: nowIso
    }

    // Attempt online insert if online
    if (isOnline.value) {
      try {
        const { data, error } = await supabase
          .from('media_items')
          .insert(row as any)
          .select()
          .single()

        if (error) {
          const isNetwork = error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')
          if (!isNetwork) {
            toast.add({
              title: 'Errore',
              description: error.message,
              color: 'error'
            })
            return null
          }
          // Fall through to offline handling
        } else if (data) {
          const newItem = data as unknown as MediaItem
          items.value = [newItem, ...items.value]
          await saveCachedMediaItem(newItem)

          // Determine activity action type & message based on status
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

          // Log activity (best effort)
          try {
            await supabase.from('media_activities').insert({
              user_id: id,
              media_item_id: newItem.id,
              media_title: newItem.title,
              media_type: newItem.media_type,
              action_type: actionType,
              progress_text: formatProgressDisplay(newItem, true),
              message,
              is_private: newItem.is_private
            } as any)
          } catch {
            // activity logging failure should not block user
          }

          toast.add({
            title: 'Elemento aggiunto!',
            description: `"${newItem.title}" è stato aggiunto alla tua lista.`,
            color: 'success'
          })

          return newItem
        }
      } catch (err: any) {
        console.warn('[useMediaTracker] Online insert failed, falling back to offline:', err)
      }
    }

    // Offline creation path: assign a negative client ID
    const tempId = -Math.floor(Date.now() + Math.random() * 1000)
    const offlineItem: MediaItem = {
      ...row,
      id: tempId,
      created_at: nowIso,
      updated_at: nowIso
    } as MediaItem

    // Optimistically update memory and offline storage
    items.value = [offlineItem, ...items.value]
    await saveCachedMediaItem(offlineItem)

    await enqueueMutation({
      action: 'insert',
      item_id: tempId,
      tempId,
      payload: row,
      timestamp: Date.now()
    })
    await refreshPendingCount()

    toast.add({
      title: 'Elemento salvato offline! 💾',
      description: `"${offlineItem.title}" è stato salvato sul dispositivo. Verrà sincronizzato non appena tornerai online.`,
      color: 'warning'
    })

    return offlineItem
  }

  async function updateItem(id: number, updates: Partial<MediaItem>): Promise<boolean> {
    const currentUserId = userId.value
    if (!currentUserId) return false

    const oldIndex = items.value.findIndex((i) => i.id === id)
    const oldItem = oldIndex !== -1 ? items.value[oldIndex] : null

    const payload = {
      ...updates,
      updated_at: new Date().toISOString()
    }

    // Optimistically update memory
    const updated = {
      ...(oldItem || {}),
      ...payload
    } as MediaItem

    if (oldIndex !== -1) {
      items.value.splice(oldIndex, 1, updated)
    }

    // Save to local cache immediately
    await saveCachedMediaItem(updated)

    // If item was created offline (negative ID), update offline mutation
    if (id < 0) {
      await enqueueMutation({
        action: 'update',
        item_id: id,
        payload: updates,
        timestamp: Date.now()
      })
      await refreshPendingCount()
      return true
    }

    // If online, try sending to Supabase
    if (isOnline.value) {
      try {
        const { data, error } = await supabase
          .from('media_items')
          .update(payload as any)
          .eq('id', id)
          .select()
          .single()

        if (error) {
          const isNetwork = error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')
          if (!isNetwork) {
            toast.add({
              title: 'Errore durante l\'aggiornamento',
              description: error.message,
              color: 'error'
            })
            return false
          }
          // Fall through to offline queue
        } else if (data) {
          const serverUpdated = data as unknown as MediaItem
          if (oldIndex !== -1) {
            items.value.splice(oldIndex, 1, serverUpdated)
          }
          await saveCachedMediaItem(serverUpdated)

          // Activity logging
          if (oldItem) {
            const isProgressChanged =
              oldItem.episode !== serverUpdated.episode ||
              oldItem.season !== serverUpdated.season ||
              oldItem.current_page !== serverUpdated.current_page ||
              oldItem.percentage !== serverUpdated.percentage ||
              oldItem.time_stopped !== serverUpdated.time_stopped ||
              oldItem.current_unit !== serverUpdated.current_unit
            const isStatusChanged = oldItem.status !== serverUpdated.status
            const isCompleted = serverUpdated.status === 'completed' && oldItem.status !== 'completed'

            try {
              if (isCompleted) {
                await supabase.from('media_activities').insert({
                  user_id: currentUserId,
                  media_item_id: serverUpdated.id,
                  media_title: serverUpdated.title,
                  media_type: serverUpdated.media_type,
                  action_type: 'completed',
                  progress_text: formatProgressDisplay(serverUpdated, true),
                  message: `Ha completato "${serverUpdated.title}"! 🎉`,
                  is_private: serverUpdated.is_private
                } as any)
              } else if (isStatusChanged) {
                await supabase.from('media_activities').insert({
                  user_id: currentUserId,
                  media_item_id: serverUpdated.id,
                  media_title: serverUpdated.title,
                  media_type: serverUpdated.media_type,
                  action_type: 'status_changed',
                  progress_text: formatProgressDisplay(serverUpdated, true),
                  message: `Ha aggiornato lo stato di "${serverUpdated.title}"`,
                  is_private: serverUpdated.is_private
                } as any)
              } else if (isProgressChanged) {
                await supabase.from('media_activities').insert({
                  user_id: currentUserId,
                  media_item_id: serverUpdated.id,
                  media_title: serverUpdated.title,
                  media_type: serverUpdated.media_type,
                  action_type: 'progress_updated',
                  progress_text: formatProgressDisplay(serverUpdated, true),
                  message: `È arrivato a ${formatProgressDisplay(serverUpdated, true)} di "${serverUpdated.title}"`,
                  is_private: serverUpdated.is_private
                } as any)
              }
            } catch {
              // Ignore activity errors
            }
          }

          return true
        }
      } catch (err) {
        console.warn('[useMediaTracker] Online update failed, enqueueing offline:', err)
      }
    }

    // Offline queue path
    await enqueueMutation({
      action: 'update',
      item_id: id,
      payload: updates,
      timestamp: Date.now()
    })
    await refreshPendingCount()
    return true
  }

  async function deleteItem(id: number): Promise<boolean> {
    // Optimistic removal from state and local storage
    items.value = items.value.filter((i) => i.id !== id)
    await removeCachedMediaItem(id)

    // Offline-created item: delete local mutation, nothing needed on server
    if (id < 0) {
      await enqueueMutation({
        action: 'delete',
        item_id: id,
        timestamp: Date.now()
      })
      await refreshPendingCount()
      toast.add({
        title: 'Elemento eliminato (offline)',
        description: 'L\'elemento è stato rimosso dalla memoria locale.',
        color: 'neutral'
      })
      return true
    }

    if (isOnline.value) {
      try {
        const { error } = await supabase
          .from('media_items')
          .delete()
          .eq('id', id)

        if (error) {
          const isNetwork = error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')
          if (!isNetwork) {
            toast.add({
              title: 'Errore',
              description: error.message,
              color: 'error'
            })
            return false
          }
          // Fall through to offline queue
        } else {
          toast.add({
            title: 'Elemento eliminato',
            description: 'L\'elemento è stato rimosso dalla tua lista.',
            color: 'neutral'
          })
          return true
        }
      } catch (err) {
        console.warn('[useMediaTracker] Online delete failed, enqueueing offline:', err)
      }
    }

    await enqueueMutation({
      action: 'delete',
      item_id: id,
      timestamp: Date.now()
    })
    await refreshPendingCount()

    toast.add({
      title: 'Elemento eliminato (offline)',
      description: 'La rimozione verrà sincronizzata sul cloud appena tornerai online.',
      color: 'neutral'
    })
    return true
  }

  /**
   * Fast increment for one-click updates (uses user preferences by default or customStep)
   */
  async function incrementProgress(item: MediaItem, customStep?: number): Promise<void> {
    const { prefs } = usePreferences()
    const updates: Partial<MediaItem> = {}

    if (item.media_type === 'series' || item.progress_type === 'episode_season') {
      const step = customStep ?? prefs.value.seriesStep ?? 1
      const currentSeason = item.season ?? 1
      const currentEp = item.episode ?? 0
      const totalSeasons = item.total_seasons
      const seasonMaxEp = getEpisodesForSeason(item, currentSeason) ?? item.total_episodes

      if (item.status === 'planned') {
        updates.status = 'in_progress'
      }

      // Check if advancing reaches or exceeds the current season's episode limit
      if (seasonMaxEp && currentEp + step > seasonMaxEp) {
        // Season completed! Check if this was the last season
        if (totalSeasons && currentSeason >= totalSeasons) {
          updates.season = currentSeason
          updates.episode = seasonMaxEp
          updates.status = 'completed'
          updates.completed_at = new Date().toISOString()
        } else {
          // Move to next season!
          const nextSeason = currentSeason + 1
          updates.season = nextSeason
          updates.episode = 1
          const nextSeasonEp = getEpisodesForSeason(item, nextSeason)
          if (nextSeasonEp) {
            updates.total_episodes = nextSeasonEp
          }
        }
      } else {
        const nextEp = currentEp + step
        updates.episode = nextEp
        // If it was the final episode of the final season
        if (seasonMaxEp && nextEp >= seasonMaxEp && totalSeasons && totalSeasons <= currentSeason) {
          updates.status = 'completed'
          updates.completed_at = new Date().toISOString()
        }
      }
    } else if (item.media_type === 'movie' || item.progress_type === 'time') {
      const step = customStep ?? prefs.value.movieStep ?? 10
      const currentMin = parseTimeToMinutes(item.time_stopped || item.current_unit)
      const newMinutes = currentMin + step
      const formatted = formatMinutesToTime(newMinutes)

      updates.time_stopped = formatted
      updates.current_unit = formatted
      if (item.status === 'planned') {
        updates.status = 'in_progress'
      }

      if (item.total_duration) {
        const totMin = parseTimeToMinutes(item.total_duration)
        if (totMin > 0 && newMinutes >= totMin) {
          updates.time_stopped = item.total_duration
          updates.current_unit = item.total_duration
          updates.status = 'completed'
          updates.completed_at = new Date().toISOString()
        }
      }
    } else if (item.media_type === 'book' || item.progress_type === 'pages') {
      const step = customStep ?? prefs.value.bookStep ?? 10
      const nextP = (item.current_page ?? 0) + step
      updates.current_page = nextP
      if (item.status === 'planned') {
        updates.status = 'in_progress'
      }
      if (item.total_pages && nextP >= item.total_pages) {
        updates.status = 'completed'
        updates.completed_at = new Date().toISOString()
      }
    } else if (item.progress_type === 'percentage') {
      const step = customStep ?? 5
      const nextPct = Math.min(100, (item.percentage ?? 0) + step)
      updates.percentage = nextPct
      if (nextPct >= 100) {
        updates.status = 'completed'
        updates.completed_at = new Date().toISOString()
      }
    } else if (item.progress_type === 'chapter') {
      const step = customStep ?? 1
      const nextCh = (item.current_page ?? item.episode ?? 0) + step
      updates.current_page = nextCh
    }

    await updateItem(item.id, updates)
  }

  async function decrementProgress(item: MediaItem, customStep?: number): Promise<void> {
    const { prefs } = usePreferences()
    const updates: Partial<MediaItem> = {}

    if (item.media_type === 'series' || item.progress_type === 'episode_season') {
      const step = customStep ?? prefs.value.seriesStep ?? 1
      const currentSeason = item.season ?? 1
      const currentEp = item.episode ?? 0

      if (currentEp - step < 1 && currentSeason > 1) {
        // Go back to previous season's last episode
        const prevSeason = currentSeason - 1
        const prevMaxEp = getEpisodesForSeason(item, prevSeason) ?? 1
        updates.season = prevSeason
        updates.episode = prevMaxEp
        updates.total_episodes = prevMaxEp
      } else {
        updates.episode = Math.max(0, currentEp - step)
      }

      if (item.status === 'completed') {
        updates.status = 'in_progress'
      }
    } else if (item.media_type === 'movie' || item.progress_type === 'time') {
      const step = customStep ?? prefs.value.movieStep ?? 10
      const currentMin = parseTimeToMinutes(item.time_stopped || item.current_unit)
      const newMinutes = Math.max(0, currentMin - step)
      const formatted = formatMinutesToTime(newMinutes)

      updates.time_stopped = formatted
      updates.current_unit = formatted
      if (item.status === 'completed') {
        updates.status = 'in_progress'
      }
    } else if (item.media_type === 'book' || item.progress_type === 'pages') {
      const step = customStep ?? prefs.value.bookStep ?? 10
      updates.current_page = Math.max(0, (item.current_page ?? 0) - step)
      if (item.status === 'completed') {
        updates.status = 'in_progress'
      }
    } else if (item.progress_type === 'percentage') {
      const step = customStep ?? 5
      updates.percentage = Math.max(0, (item.percentage ?? 0) - step)
      if (item.status === 'completed') {
        updates.status = 'in_progress'
      }
    } else if (item.progress_type === 'chapter') {
      const step = customStep ?? 1
      const nextCh = Math.max(0, (item.current_page ?? item.episode ?? 0) - step)
      updates.current_page = nextCh
    }

    await updateItem(item.id, updates)
  }

  async function toggleFavorite(item: MediaItem): Promise<void> {
    await updateItem(item.id, { is_favorite: !item.is_favorite })
  }

  async function togglePrivate(item: MediaItem): Promise<void> {
    await updateItem(item.id, { is_private: !item.is_private })
  }

  async function setStatus(item: MediaItem, status: MediaStatus): Promise<void> {
    const updates: Partial<MediaItem> = { status }
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString()
      if (item.total_episodes && item.episode !== null) {
        updates.episode = item.total_episodes
      }
      if (item.total_pages && item.current_page !== null) {
        updates.current_page = item.total_pages
      }
      if (item.percentage !== null) {
        updates.percentage = 100
      }
      if (item.media_type === 'movie' || item.progress_type === 'time') {
        if (item.total_duration) {
          updates.time_stopped = item.total_duration
          updates.current_unit = item.total_duration
        }
      }
    }
    await updateItem(item.id, updates)
  }

  const stats = computed(() => {
    const all = items.value
    const inProgress = all.filter((i) => i.status === 'in_progress')
    const completed = all.filter((i) => i.status === 'completed')
    const planned = all.filter((i) => i.status === 'planned')
    const favorites = all.filter((i) => i.is_favorite)

    const seriesTotal = all.filter((i) => i.media_type === 'series').length
    const seriesWatching = inProgress.filter((i) => i.media_type === 'series').length
    const seriesCompleted = completed.filter((i) => i.media_type === 'series').length
    const seriesPlanned = planned.filter((i) => i.media_type === 'series').length

    const booksTotal = all.filter((i) => i.media_type === 'book').length
    const booksReading = inProgress.filter((i) => i.media_type === 'book').length
    const booksCompleted = completed.filter((i) => i.media_type === 'book').length
    const booksPlanned = planned.filter((i) => i.media_type === 'book').length

    const moviesTotal = all.filter((i) => i.media_type === 'movie').length
    const moviesWatching = inProgress.filter((i) => i.media_type === 'movie').length
    const moviesWatched = completed.filter((i) => i.media_type === 'movie').length
    const moviesPlanned = planned.filter((i) => i.media_type === 'movie').length

    let totalEpisodes = 0
    let totalPages = 0

    for (const item of all) {
      if (item.media_type === 'series') {
        totalEpisodes += item.episode ?? 0
      } else if (item.media_type === 'book') {
        totalPages += item.current_page ?? 0
      }
    }

    return {
      total: all.length,
      inProgressCount: inProgress.length,
      completedCount: completed.length,
      plannedCount: planned.length,
      favoritesCount: favorites.length,
      seriesTotal,
      seriesWatching,
      seriesCompleted,
      seriesPlanned,
      booksTotal,
      booksReading,
      booksCompleted,
      booksPlanned,
      moviesTotal,
      moviesWatching,
      moviesWatched,
      moviesPlanned,
      totalEpisodes,
      totalPages
    }
  })

  function sortItems(sortBy?: SortOptionId) {
    const { prefs } = usePreferences()
    const sort = sortBy || prefs.value.sortBy
    items.value = sortMediaItems(items.value, sort)
  }

  return {
    items,
    loading,
    loaded,
    stats,
    loadItems,
    addItem,
    updateItem,
    deleteItem,
    incrementProgress,
    decrementProgress,
    toggleFavorite,
    togglePrivate,
    setStatus,
    sortItems
  }
}
