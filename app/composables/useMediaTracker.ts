import type { Database } from '~/types/database.types'
import type { MediaItem, MediaStatus, MediaType, ProgressType, MediaActivity } from '~/types'
import { useCurrentUser } from '~/composables/useCurrentUser'
import { usePreferences, type SortOptionId } from '~/composables/usePreferences'
import { offlineStorage } from '~/utils/offlineStorage'
import { isNetworkError } from '~/utils/network'
import { useOfflineSync } from '~/composables/useOfflineSync'
import {
  formatProgressDisplay,
  getEpisodesForSeason,
  parseTimeToMinutes,
  formatMinutesToTime,
  sortMediaItems
} from '~/utils/media'

export function useMediaTracker() {
  const supabase = (useNuxtApp() as any).$supabase?.client as ReturnType<typeof useSupabaseClient<Database>> | undefined
    ?? useSupabaseClient<Database>()
  const { userId } = useCurrentUser()
  const toast = useToast()
  const { enqueueMutation, removeMutationsForTempId } = useOfflineSync()

  const initialItems = import.meta.client && !offlineStorage.isLoggedOut()
    ? offlineStorage.getMediaItems()
    : []

  const items = useState<MediaItem[]>('media-items', () => initialItems)
  const loading = useState<boolean>('media-items-loading', () => false)
  const loaded = useState<boolean>('media-items-loaded', () => {
    if (import.meta.client && !offlineStorage.isLoggedOut()) {
      return offlineStorage.getMediaItems().length > 0
    }
    return false
  })

  // Hydrate client-side if needed
  if (import.meta.client && !offlineStorage.isLoggedOut() && items.value.length === 0) {
    const cached = offlineStorage.getMediaItems()
    if (cached.length > 0) {
      items.value = cached
      loaded.value = true
    }
  }

  async function loadItems() {
    const id = userId.value
    if (!id) {
      if (offlineStorage.isLoggedOut()) {
        items.value = []
        loaded.value = false
      }
      return
    }

    if (import.meta.client && typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = offlineStorage.getMediaItems()
      if (cached.length > 0) {
        const { prefs } = usePreferences()
        items.value = sortMediaItems(cached, prefs.value.sortBy)
      }
      loaded.value = true
      return
    }

    loading.value = true
    try {
      const { data, error } = await supabase
        .from('media_items')
        .select('*')
        .eq('user_id', id)

      if (error) {
        if (!isNetworkError(error)) {
          console.error('Error loading media items:', error)
        }
        const cached = offlineStorage.getMediaItems()
        if (cached.length > 0) {
          const { prefs } = usePreferences()
          items.value = sortMediaItems(cached, prefs.value.sortBy)
        }
      } else {
        const { prefs } = usePreferences()
        const tempItems = items.value.filter(i => i.id < 0)
        const serverItems = (data as unknown as MediaItem[]) ?? []
        const merged = [...tempItems, ...serverItems.filter(si => !tempItems.some(ti => ti.id === si.id))]
        items.value = sortMediaItems(merged, prefs.value.sortBy)
        offlineStorage.setMediaItems(items.value)
      }
      loaded.value = true
    } catch (err) {
      if (!isNetworkError(err)) {
        console.error('Unexpected error loading media items:', err)
      }
      const cached = offlineStorage.getMediaItems()
      if (cached.length > 0) {
        const { prefs } = usePreferences()
        items.value = sortMediaItems(cached, prefs.value.sortBy)
      }
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  function addOfflineItem(payload: Omit<MediaItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>): MediaItem {
    const id = userId.value || 'local-user'
    const nowIso = new Date().toISOString()
    const tempId = -Math.floor(Date.now() + Math.random() * 1000)

    const tempItem: MediaItem = {
      id: tempId,
      user_id: id,
      title: payload.title,
      media_type: payload.media_type,
      status: payload.status,
      progress_type: payload.progress_type,
      season: payload.season ?? null,
      episode: payload.episode ?? null,
      total_seasons: payload.total_seasons ?? null,
      total_episodes: payload.total_episodes ?? null,
      season_episodes: payload.season_episodes ?? null,
      time_stopped: payload.time_stopped ?? null,
      total_duration: payload.total_duration ?? null,
      current_page: payload.current_page ?? null,
      total_pages: payload.total_pages ?? null,
      percentage: payload.percentage ?? null,
      current_unit: payload.current_unit ?? null,
      rating: payload.rating ?? null,
      review: payload.review ?? '',
      notes: payload.notes ?? '',
      cover_url: payload.cover_url ?? null,
      creator: payload.creator ?? null,
      release_year: payload.release_year ?? null,
      description: payload.description ?? null,
      tags: payload.tags ?? [],
      genre: payload.genre ?? '',
      is_favorite: payload.is_favorite ?? false,
      is_private: payload.is_private ?? false,
      started_at: payload.started_at ?? (payload.status !== 'planned' ? nowIso : null),
      completed_at: payload.completed_at ?? (payload.status === 'completed' ? nowIso : null),
      created_at: nowIso,
      updated_at: nowIso
    }

    items.value = [tempItem, ...items.value.filter(i => i.id !== tempId)]
    offlineStorage.setMediaItems(items.value)

    enqueueMutation({
      type: 'media:insert',
      tempId,
      payload: {
        ...payload,
        user_id: id,
        started_at: tempItem.started_at,
        completed_at: tempItem.completed_at,
        updated_at: nowIso
      }
    })

    toast.add({
      title: 'Elemento aggiunto (offline)',
      description: `"${tempItem.title}" salvato localmente. Verrà sincronizzato online.`,
      color: 'info'
    })

    return tempItem
  }

  async function addItem(payload: Omit<MediaItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<MediaItem | null> {
    const id = userId.value
    if (!id) return null

    if (import.meta.client && typeof navigator !== 'undefined' && !navigator.onLine) {
      return addOfflineItem(payload)
    }

    try {
      const nowIso = new Date().toISOString()
      const row = {
        ...payload,
        user_id: id,
        started_at: payload.started_at ?? (payload.status !== 'planned' ? nowIso : null),
        completed_at: payload.completed_at ?? (payload.status === 'completed' ? nowIso : null),
        updated_at: nowIso
      }

      const { data, error } = await supabase
        .from('media_items')
        .insert(row as any)
        .select()
        .single()

      if (error) {
        if (isNetworkError(error)) {
          return addOfflineItem(payload)
        }
        toast.add({
          title: 'Errore',
          description: error.message,
          color: 'error'
        })
        return null
      }

      const newItem = data as unknown as MediaItem
      items.value = [newItem, ...items.value.filter(i => i.id !== newItem.id)]
      offlineStorage.setMediaItems(items.value)

      // Determine activity action type & message based on status
      let actionType: MediaActivity['action_type'] = 'started'
      let message = `Ha iniziato a seguire "${newItem.title}"`

      if (newItem.status === 'completed') {
        actionType = 'completed'
        if (newItem.media_type === 'movie') {
          message = `Ha visto il film "${newItem.title}"! 🎬`
        } else if (newItem.media_type === 'book') {
          message = `Ha finito di leggere "${newItem.title}"! 📚`
        } else if (newItem.media_type === 'series') {
          message = `Ha completato la serie "${newItem.title}"! 🍿`
        } else {
          message = `Ha completato "${newItem.title}"! 🎉`
        }
      } else if (newItem.status === 'planned') {
        actionType = 'status_changed'
        if (newItem.media_type === 'movie') {
          message = `Ha aggiunto "${newItem.title}" ai film da vedere`
        } else if (newItem.media_type === 'book') {
          message = `Ha aggiunto "${newItem.title}" ai libri da leggere`
        } else {
          message = `Ha aggiunto "${newItem.title}" alla lista da iniziare`
        }
      }

      // Log activity (non-fatal if offline/network error)
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
      } catch (actErr) {
        console.warn('Activity logging failed (non-fatal):', actErr)
      }

      toast.add({
        title: 'Elemento aggiunto!',
        description: `"${newItem.title}" è stato aggiunto alla tua lista.`,
        color: 'success'
      })

      return newItem
    } catch (err) {
      if (isNetworkError(err)) {
        return addOfflineItem(payload)
      }
      console.error('Error adding media item:', err)
      return null
    }
  }

  async function updateItem(id: number, updates: Partial<MediaItem>): Promise<boolean> {
    const currentUserId = userId.value
    if (!currentUserId) return false

    const oldIndex = items.value.findIndex((i) => i.id === id)
    const oldItem: MediaItem | null = oldIndex !== -1 ? { ...(items.value[oldIndex] as MediaItem) } : null

    // Optimistic local update
    if (oldItem && oldIndex !== -1) {
      const updatedLocal: MediaItem = {
        ...oldItem,
        ...updates,
        updated_at: new Date().toISOString()
      }
      items.value.splice(oldIndex, 1, updatedLocal)
      offlineStorage.setMediaItems(items.value)
    }

    if (id < 0 || (import.meta.client && typeof navigator !== 'undefined' && !navigator.onLine)) {
      enqueueMutation({
        type: 'media:update',
        targetId: id,
        payload: updates
      })
      return true
    }

    try {
      const payload = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('media_items')
        .update(payload as any)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if (isNetworkError(error)) {
          enqueueMutation({
            type: 'media:update',
            targetId: id,
            payload: updates
          })
          return true
        }

        // Revert optimistic update
        if (oldItem && oldIndex !== -1) {
          items.value.splice(oldIndex, 1, oldItem)
          offlineStorage.setMediaItems(items.value)
        }

        toast.add({
          title: 'Errore durante l\'aggiornamento',
          description: error.message,
          color: 'error'
        })
        return false
      }

      const updated = data as unknown as MediaItem
      if (oldIndex !== -1) {
        items.value.splice(oldIndex, 1, updated)
      }
      offlineStorage.setMediaItems(items.value)

      // Check if progress or status changed to log activity
      if (oldItem) {
        const isProgressChanged =
          oldItem.episode !== updated.episode ||
          oldItem.season !== updated.season ||
          oldItem.current_page !== updated.current_page ||
          oldItem.percentage !== updated.percentage ||
          oldItem.time_stopped !== updated.time_stopped ||
          oldItem.current_unit !== updated.current_unit
        const isStatusChanged = oldItem.status !== updated.status
        const isCompleted = updated.status === 'completed' && oldItem.status !== 'completed'

        try {
          if (isCompleted) {
            await supabase.from('media_activities').insert({
              user_id: currentUserId,
              media_item_id: updated.id,
              media_title: updated.title,
              media_type: updated.media_type,
              action_type: 'completed',
              progress_text: formatProgressDisplay(updated, true),
              message: `Ha completato "${updated.title}"! 🎉`,
              is_private: updated.is_private
            } as any)
          } else if (isStatusChanged) {
            await supabase.from('media_activities').insert({
              user_id: currentUserId,
              media_item_id: updated.id,
              media_title: updated.title,
              media_type: updated.media_type,
              action_type: 'status_changed',
              progress_text: formatProgressDisplay(updated, true),
              message: `Ha aggiornato lo stato di "${updated.title}"`,
              is_private: updated.is_private
            } as any)
          } else if (isProgressChanged) {
            await supabase.from('media_activities').insert({
              user_id: currentUserId,
              media_item_id: updated.id,
              media_title: updated.title,
              media_type: updated.media_type,
              action_type: 'progress_updated',
              progress_text: formatProgressDisplay(updated, true),
              message: `È arrivato a ${formatProgressDisplay(updated, true)} di "${updated.title}"`,
              is_private: updated.is_private
            } as any)
          }
        } catch (actErr) {
          console.warn('Activity logging failed (non-fatal):', actErr)
        }
      }

      return true
    } catch (err) {
      if (isNetworkError(err)) {
        enqueueMutation({
          type: 'media:update',
          targetId: id,
          payload: updates
        })
        return true
      }
      if (oldItem && oldIndex !== -1) {
        items.value.splice(oldIndex, 1, oldItem)
        offlineStorage.setMediaItems(items.value)
      }
      console.error('Error updating media item:', err)
      return false
    }
  }

  async function deleteItem(id: number): Promise<boolean> {
    const oldIndex = items.value.findIndex((i) => i.id === id)
    const oldItem: MediaItem | null = oldIndex !== -1 ? { ...(items.value[oldIndex] as MediaItem) } : null

    // Optimistic removal
    items.value = items.value.filter((i) => i.id !== id)
    offlineStorage.setMediaItems(items.value)

    if (id < 0) {
      removeMutationsForTempId(id)
      toast.add({
        title: 'Elemento eliminato',
        description: 'L\'elemento è stato rimosso dalla tua lista.',
        color: 'neutral'
      })
      return true
    }

    if (import.meta.client && typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueMutation({
        type: 'media:delete',
        targetId: id
      })
      toast.add({
        title: 'Elemento eliminato (offline)',
        description: 'L\'eliminazione verrà sincronizzata online appena torna la connessione.',
        color: 'neutral'
      })
      return true
    }

    try {
      const { error } = await supabase
        .from('media_items')
        .delete()
        .eq('id', id)

      if (error) {
        if (isNetworkError(error)) {
          enqueueMutation({
            type: 'media:delete',
            targetId: id
          })
          toast.add({
            title: 'Elemento eliminato (offline)',
            description: 'Connessione assente. Verrà sincronizzato online.',
            color: 'neutral'
          })
          return true
        }

        // Restore item
        if (oldItem && oldIndex !== -1) {
          items.value.splice(oldIndex, 0, oldItem)
          offlineStorage.setMediaItems(items.value)
        }

        toast.add({
          title: 'Errore',
          description: error.message,
          color: 'error'
        })
        return false
      }

      toast.add({
        title: 'Elemento eliminato',
        description: 'L\'elemento è stato rimosso dalla tua lista.',
        color: 'neutral'
      })
      return true
    } catch (err) {
      if (isNetworkError(err)) {
        enqueueMutation({
          type: 'media:delete',
          targetId: id
        })
        toast.add({
          title: 'Elemento eliminato (offline)',
          description: 'Connessione assente. Verrà sincronizzato online.',
          color: 'neutral'
        })
        return true
      }
      if (oldItem && oldIndex !== -1) {
        items.value.splice(oldIndex, 0, oldItem)
        offlineStorage.setMediaItems(items.value)
      }
      console.error('Error deleting media item:', err)
      return false
    }
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
