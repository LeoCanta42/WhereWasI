import type { Database } from '~/types/database.types'
import type { MediaItem, MediaStatus, MediaType, ProgressType } from '~/types'
import { useCurrentUser } from '~/composables/useCurrentUser'
import { formatProgressDisplay, getEpisodesForSeason, parseTimeToMinutes, formatMinutesToTime } from '~/utils/media'

export function useMediaTracker() {
  const supabase = useSupabaseClient<Database>()
  const { userId } = useCurrentUser()
  const toast = useToast()

  const items = useState<MediaItem[]>('media-items', () => [])
  const loading = useState<boolean>('media-items-loading', () => false)
  const loaded = useState<boolean>('media-items-loaded', () => false)

  async function loadItems() {
    const id = userId.value
    if (!id) {
      items.value = []
      loaded.value = false
      return
    }

    loading.value = true
    try {
      const { data, error } = await supabase
        .from('media_items')
        .select('*')
        .eq('user_id', id)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error loading media items:', error)
      } else {
        items.value = (data as unknown as MediaItem[]) ?? []
      }
      loaded.value = true
    } catch (err) {
      console.error('Unexpected error loading media items:', err)
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function addItem(payload: Omit<MediaItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<MediaItem | null> {
    const id = userId.value
    if (!id) return null

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
        toast.add({
          title: 'Errore',
          description: error.message,
          color: 'error'
        })
        return null
      }

      const newItem = data as unknown as MediaItem
      items.value = [newItem, ...items.value]

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

      // Log activity
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

      toast.add({
        title: 'Elemento aggiunto!',
        description: `"${newItem.title}" è stato aggiunto alla tua lista.`,
        color: 'success'
      })

      return newItem
    } catch (err) {
      console.error('Error adding media item:', err)
      return null
    }
  }

  async function updateItem(id: number, updates: Partial<MediaItem>): Promise<boolean> {
    const currentUserId = userId.value
    if (!currentUserId) return false

    const oldIndex = items.value.findIndex((i) => i.id === id)
    const oldItem = oldIndex !== -1 ? items.value[oldIndex] : null

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
        toast.add({
          title: 'Errore durante l\'aggiornamento',
          description: error.message,
          color: 'error'
        })
        return false
      }

      const updated = data as unknown as MediaItem
      if (oldIndex !== -1) {
        // Move updated to top or replace in place
        items.value.splice(oldIndex, 1)
        items.value.unshift(updated)
      }

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
      }

      return true
    } catch (err) {
      console.error('Error updating media item:', err)
      return false
    }
  }

  async function deleteItem(id: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('media_items')
        .delete()
        .eq('id', id)

      if (error) {
        toast.add({
          title: 'Errore',
          description: error.message,
          color: 'error'
        })
        return false
      }

      items.value = items.value.filter((i) => i.id !== id)
      toast.add({
        title: 'Elemento eliminato',
        description: 'L\'elemento è stato rimosso dalla tua lista.',
        color: 'neutral'
      })
      return true
    } catch (err) {
      console.error('Error deleting media item:', err)
      return false
    }
  }

  /**
   * Fast increment for one-click updates
   */
  async function incrementProgress(item: MediaItem, step = 1): Promise<void> {
    const updates: Partial<MediaItem> = {}

    if (item.media_type === 'series' || item.progress_type === 'episode_season') {
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
      const currentMin = parseTimeToMinutes(item.time_stopped || item.current_unit)
      const stepMinutes = 10 // +10 minutes per click
      const newMinutes = currentMin + stepMinutes
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
      const nextPct = Math.min(100, (item.percentage ?? 0) + step)
      updates.percentage = nextPct
      if (nextPct >= 100) {
        updates.status = 'completed'
        updates.completed_at = new Date().toISOString()
      }
    } else if (item.progress_type === 'chapter') {
      const nextCh = (item.current_page ?? item.episode ?? 0) + step
      updates.current_page = nextCh
    }

    await updateItem(item.id, updates)
  }

  async function decrementProgress(item: MediaItem, step = 1): Promise<void> {
    const updates: Partial<MediaItem> = {}

    if (item.media_type === 'series' || item.progress_type === 'episode_season') {
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
      const currentMin = parseTimeToMinutes(item.time_stopped || item.current_unit)
      const stepMinutes = 10
      const newMinutes = Math.max(0, currentMin - stepMinutes)
      const formatted = formatMinutesToTime(newMinutes)

      updates.time_stopped = formatted
      updates.current_unit = formatted
      if (item.status === 'completed') {
        updates.status = 'in_progress'
      }
    } else if (item.media_type === 'book' || item.progress_type === 'pages') {
      updates.current_page = Math.max(0, (item.current_page ?? 0) - step)
      if (item.status === 'completed') {
        updates.status = 'in_progress'
      }
    } else if (item.progress_type === 'percentage') {
      updates.percentage = Math.max(0, (item.percentage ?? 0) - step)
      if (item.status === 'completed') {
        updates.status = 'in_progress'
      }
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

    const seriesWatching = inProgress.filter((i) => i.media_type === 'series').length
    const seriesCompleted = completed.filter((i) => i.media_type === 'series').length
    const booksReading = inProgress.filter((i) => i.media_type === 'book').length
    const booksCompleted = completed.filter((i) => i.media_type === 'book').length
    const moviesWatched = completed.filter((i) => i.media_type === 'movie').length

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
      seriesWatching,
      seriesCompleted,
      booksReading,
      booksCompleted,
      moviesWatched,
      totalEpisodes,
      totalPages
    }
  })

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
    setStatus
  }
}
