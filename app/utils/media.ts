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
  { id: 'anime', label: 'Anime', icon: 'i-lucide-sparkles', color: 'rose', unitDefault: 'Episodio' },
  { id: 'manga', label: 'Manga / Fumetto', icon: 'i-lucide-book-marked', color: 'violet', unitDefault: 'Capitolo' },
  { id: 'game', label: 'Videogioco', icon: 'i-lucide-gamepad-2', color: 'cyan', unitDefault: 'Progresso' },
  { id: 'podcast', label: 'Podcast', icon: 'i-lucide-mic', color: 'teal', unitDefault: 'Puntata' },
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
 * Calculates a 0-100 percentage of the progress for visual bars and stats.
 */
export function calculateProgressPercentage(item: Partial<MediaItem>): number {
  if (item.status === 'completed') return 100
  if (item.status === 'planned') return 0

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
  if (item.media_type === 'series' || item.media_type === 'anime' || item.progress_type === 'episode_season') {
    if (item.episode && item.total_episodes && item.total_episodes > 0) {
      return Math.min(100, Math.round((item.episode / item.total_episodes) * 100))
    }
  }

  return 0
}

/**
 * Formats a clean, human-readable progress string, e.g.:
 * - "Stagione 3 • Episodio 5" / "S3 E5"
 * - "Pagina 240 di 480 (50%)"
 * - "Capitolo 12"
 * - "Completato"
 */
export function formatProgressDisplay(item: Partial<MediaItem>, short = false): string {
  if (item.status === 'completed') {
    return item.media_type === 'book' ? 'Letto' : 'Completato'
  }

  if (item.status === 'planned') {
    return item.media_type === 'book' ? 'Da leggere' : 'Da guardare'
  }

  if (item.media_type === 'series' || item.media_type === 'anime' || item.progress_type === 'episode_season') {
    const s = item.season ?? 1
    const ep = item.episode ?? 0
    const totalEp = item.total_episodes

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

  if (item.progress_type === 'chapter' || item.media_type === 'manga') {
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
    anime: [
      'from-rose-500 to-pink-700',
      'from-fuchsia-600 to-purple-800',
      'from-pink-600 to-rose-900'
    ],
    manga: [
      'from-purple-600 to-pink-700',
      'from-violet-700 to-fuchsia-900',
      'from-indigo-600 to-violet-900'
    ],
    game: [
      'from-cyan-600 to-blue-800',
      'from-sky-500 to-indigo-700',
      'from-teal-500 to-blue-900'
    ],
    podcast: [
      'from-teal-600 to-emerald-800',
      'from-cyan-700 to-teal-950',
      'from-blue-600 to-teal-800'
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
