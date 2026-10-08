import type { MediaItem, MediaStatus, MediaType, ProgressType } from '~/types'

export interface MediaTypeOption {
  id: MediaType
  label: string
  icon: string
  color: string
  unitDefault: string
}

export const MEDIA_TYPES: MediaTypeOption[] = [
  { id: 'series', label: 'Serie TV', icon: 'i-lucide-tv', color: 'indigo', unitDefault: 'Episodio' },
  { id: 'book', label: 'Libro', icon: 'i-lucide-book-open', color: 'emerald', unitDefault: 'Pagina' },
  { id: 'movie', label: 'Film', icon: 'i-lucide-clapperboard', color: 'amber', unitDefault: 'Visione' },
  { id: 'game', label: 'Videogioco', icon: 'i-lucide-gamepad-2', color: 'cyan', unitDefault: 'Progresso' },
  { id: 'other', label: 'Altro', icon: 'i-lucide-bookmark', color: 'slate', unitDefault: 'Avanzamento' }
]

export interface StatusOption {
  id: MediaStatus
  label: string
  icon: string
  color: 'primary' | 'success' | 'warning' | 'neutral' | 'error' | 'info'
}

export const MEDIA_STATUSES: StatusOption[] = [
  { id: 'in_progress', label: 'In Corso', icon: 'i-lucide-play-circle', color: 'primary' },
  { id: 'completed', label: 'Completato', icon: 'i-lucide-check-circle-2', color: 'success' },
  { id: 'planned', label: 'Da Iniziare', icon: 'i-lucide-clock', color: 'neutral' },
  { id: 'on_hold', label: 'In Pausa', icon: 'i-lucide-pause-circle', color: 'warning' },
  { id: 'dropped', label: 'Abbandonato', icon: 'i-lucide-x-circle', color: 'error' }
]

export function getMediaTypeInfo(type: MediaType): MediaTypeOption {
  return MEDIA_TYPES.find((t) => t.id === type) ?? (MEDIA_TYPES[0] as MediaTypeOption)
}

export function getMediaStatusInfo(status: MediaStatus): StatusOption {
  return MEDIA_STATUSES.find((s) => s.id === status) ?? (MEDIA_STATUSES[0] as StatusOption)
}

/**
 * Parses time formats such as "1h 25m", "1h25m", "1:25:00", "01:25", "85m", "85" into total minutes.
 */
export function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0
  const s = String(timeStr).trim().toLowerCase()
  if (!s) return 0

  // Match "1h 25m", "1h25m", "1h 25", "1h", "25m", "90m", "90 min"
  const hMatch = s.match(/(\d+)\s*h/)
  const mMatch = s.match(/(\d+)\s*(?:m|min)/)

  if (hMatch || mMatch) {
    const hours = (hMatch && hMatch[1]) ? parseInt(hMatch[1], 10) : 0
    const minutes = (mMatch && mMatch[1]) ? parseInt(mMatch[1], 10) : 0
    return hours * 60 + minutes
  }

  // Match "hh:mm:ss" or "hh:mm"
  if (s.includes(':')) {
    const parts = s.split(':').map((p) => parseInt(p, 10) || 0)
    if (parts.length === 3) {
      const p0 = parts[0] ?? 0
      const p1 = parts[1] ?? 0
      const p2 = parts[2] ?? 0
      return p0 * 60 + p1 + Math.round(p2 / 60)
    } else if (parts.length === 2) {
      const p0 = parts[0] ?? 0
      const p1 = parts[1] ?? 0
      return p0 * 60 + p1
    }
  }

  // Pure number of minutes
  const num = parseInt(s, 10)
  if (!isNaN(num)) {
    return num
  }

  return 0
}

/**
 * Formats a total number of minutes into a human string (e.g. 85 -> "1h 25m", 45 -> "45m")
 */
export function formatMinutesToTime(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0m'
  const hours = Math.floor(totalMinutes / 60)
  const mins = Math.round(totalMinutes % 60)

  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins.toString().padStart(2, '0')}m`
  } else if (hours > 0) {
    return `${hours}h 00m`
  } else {
    return `${mins}m`
  }
}

/**
 * Splits total minutes into separate hours and minutes components
 */
export function splitMinutesToHoursAndMinutes(totalMinutes: number): { hours: number; minutes: number } {
  if (!totalMinutes || totalMinutes <= 0) return { hours: 0, minutes: 0 }
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: Math.round(totalMinutes % 60)
  }
}

/**
 * Retrieves the number of episodes for a specific season of a series.
 */
export function getEpisodesForSeason(item: Partial<MediaItem>, seasonNum?: number): number | null {
  const targetSeason = seasonNum ?? item.season ?? 1
  if (item.season_episodes && typeof item.season_episodes === 'object') {
    const epCount = (item.season_episodes as any)[String(targetSeason)] ?? (item.season_episodes as any)[targetSeason]
    const parsed = typeof epCount === 'number' ? epCount : parseInt(String(epCount), 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  if ((item.season ?? 1) === targetSeason && item.total_episodes && item.total_episodes > 0) {
    return item.total_episodes
  }
  return null
}

/**
 * Calculates a 0-100 percentage of the progress for visual bars and stats.
 */
export function calculateProgressPercentage(item: Partial<MediaItem>): number {
  if (item.status === 'completed') return 100
  if (item.status === 'planned') return 0

  // Movie / Time progress
  if (item.media_type === 'movie' || item.progress_type === 'time') {
    const stopped = item.time_stopped || item.current_unit
    const total = item.total_duration
    if (stopped && total) {
      const stopMins = parseTimeToMinutes(stopped)
      const totMins = parseTimeToMinutes(total)
      if (totMins > 0) {
        return Math.min(100, Math.max(0, Math.round((stopMins / totMins) * 100)))
      }
    }
    if (item.percentage !== null && item.percentage !== undefined && item.percentage >= 0) {
      return Math.min(100, Math.max(0, item.percentage))
    }
    return 0
  }

  if (item.percentage !== null && item.percentage !== undefined && item.percentage >= 0) {
    return Math.min(100, Math.max(0, item.percentage))
  }

  // Book pages progress
  if (item.media_type === 'book' || item.progress_type === 'pages') {
    if (item.current_page && item.total_pages && item.total_pages > 0) {
      return Math.min(100, Math.round((item.current_page / item.total_pages) * 100))
    }
  }

  // Series episodes progress
  if (item.media_type === 'series' || item.progress_type === 'episode_season') {
    const season = item.season ?? 1
    const ep = item.episode ?? 0
    const seasonEpCount = getEpisodesForSeason(item, season) ?? item.total_episodes
    if (ep > 0 && seasonEpCount && seasonEpCount > 0) {
      return Math.min(100, Math.round((ep / seasonEpCount) * 100))
    }
  }

  return 0
}

/**
 * Formats a clean, human-readable progress string, e.g.:
 * - "Stagione 3, Ep. 5 / 10" / "S3 E5/10"
 * - "1h 25m / 2h 10m" / "1h 25m"
 * - "Pagina 240 di 480 (50%)"
 * - "Capitolo 12"
 * - "Completato" / "Visto" / "Letto"
 */
export function formatProgressDisplay(item: Partial<MediaItem>, short = false): string {
  if (item.status === 'completed') {
    if (item.media_type === 'book') return 'Letto'
    if (item.media_type === 'movie') return 'Visto'
    return 'Completato'
  }

  if (item.status === 'planned') {
    if (item.media_type === 'book') return 'Da leggere'
    if (item.media_type === 'movie') return 'Da guardare'
    return 'Da iniziare'
  }

  // Movie / Time progress
  if (item.media_type === 'movie' || item.progress_type === 'time') {
    const stopped = item.time_stopped || item.current_unit
    const total = item.total_duration
    if (stopped && total) {
      const stopMins = parseTimeToMinutes(stopped)
      const totMins = parseTimeToMinutes(total)
      const pct = totMins > 0 ? Math.round((stopMins / totMins) * 100) : 0
      if (short) {
        return `${stopped} / ${total}`
      }
      return `Fermato a ${stopped} / ${total}${pct > 0 ? ` (${pct}%)` : ''}`
    }
    if (stopped) {
      return short ? stopped : `Fermato a ${stopped}`
    }
    return 'In corso'
  }

  if (item.media_type === 'series' || item.progress_type === 'episode_season') {
    const s = item.season ?? 1
    const ep = item.episode ?? 0
    const totalEp = getEpisodesForSeason(item, s) ?? item.total_episodes

    if (short) {
      return totalEp ? `S${s} E${ep}/${totalEp}` : `S${s} E${ep}`
    }
    return totalEp ? `Stagione ${s}, Ep. ${ep} / ${totalEp}` : `Stagione ${s}, Ep. ${ep}`
  }

  if (item.media_type === 'book' || item.progress_type === 'pages') {
    const p = item.current_page ?? 0
    const total = item.total_pages
    if (total && total > 0) {
      const pct = Math.round((p / total) * 100)
      return short ? `p. ${p}/${total} (${pct}%)` : `Pagina ${p} di ${total} (${pct}%)`
    }
    return short ? `p. ${p}` : `Pagina ${p}`
  }

  if (item.progress_type === 'chapter') {
    const p = item.current_page ?? item.episode ?? 0
    return `Cap. ${p}`
  }

  if (item.percentage !== null && item.percentage !== undefined) {
    return `${item.percentage}%`
  }

  if (item.current_unit) {
    return item.current_unit
  }

  return 'In corso'
}

/**
 * Returns an automatic gradient color pair for cards without cover art
 */
export function getMediaGradient(type: MediaType, id: number | string = 1): string {
  const gradients: Record<MediaType, string[]> = {
    series: [
      'from-indigo-600 to-purple-800',
      'from-blue-600 to-indigo-900',
      'from-violet-600 to-indigo-800'
    ],
    book: [
      'from-emerald-600 to-teal-800',
      'from-teal-600 to-cyan-800',
      'from-green-600 to-emerald-900'
    ],
    movie: [
      'from-amber-600 to-orange-800',
      'from-rose-600 to-amber-700',
      'from-orange-500 to-red-800'
    ],
    game: [
      'from-cyan-600 to-blue-800',
      'from-sky-500 to-indigo-700',
      'from-teal-500 to-blue-900'
    ],
    other: [
      'from-slate-600 to-zinc-800',
      'from-zinc-600 to-neutral-900',
      'from-gray-700 to-slate-900'
    ]
  }

  const list = gradients[type] || gradients.other
  const numId = typeof id === 'number' ? id : id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return list[Math.abs(numId) % list.length] ?? 'from-indigo-600 to-purple-800'
}
