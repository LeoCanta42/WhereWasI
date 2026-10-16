export type AccentId = 'indigo' | 'violet' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'teal' | 'sky' | 'blue'
export type ViewMode = 'grid' | 'list'
export type SortOptionId =
  | 'created_desc'
  | 'created_asc'
  | 'updated_desc'
  | 'title_asc'
  | 'title_desc'
  | 'rating_desc'
  | 'progress_desc'

export interface AccentOption {
  id: AccentId
  label: string
  swatch: string
  ink: string
}

export const ACCENTS: AccentOption[] = [
  { id: 'indigo', label: 'Indaco', swatch: '#6366f1', ink: '#4338ca' },
  { id: 'violet', label: 'Viola', swatch: '#8b5cf6', ink: '#6d28d9' },
  { id: 'emerald', label: 'Smeraldo', swatch: '#10b981', ink: '#047857' },
  { id: 'rose', label: 'Rosa / Rosso', swatch: '#f43f5e', ink: '#be123c' },
  { id: 'amber', label: 'Ambra', swatch: '#f59e0b', ink: '#b45309' },
  { id: 'cyan', label: 'Ciano', swatch: '#06b6d4', ink: '#0e7490' },
  { id: 'teal', label: 'Teal', swatch: '#14b8a6', ink: '#0f766e' },
  { id: 'sky', label: 'Azzurro', swatch: '#0ea5e9', ink: '#0369a1' },
  { id: 'blue', label: 'Blu', swatch: '#3b82f6', ink: '#1d4ed8' }
]

export interface Preferences {
  accent: AccentId
  viewMode: ViewMode
  confirmDelete: boolean
  hideCompleted: boolean
  sortBy: SortOptionId
  bookStep: number
  movieStep: number
  seriesStep: number
}

export const DEFAULT_PREFERENCES: Preferences = {
  accent: 'indigo',
  viewMode: 'grid',
  confirmDelete: true,
  hideCompleted: false,
  sortBy: 'created_desc',
  bookStep: 10,
  movieStep: 10,
  seriesStep: 1
}

const COOKIE_KEY = 'wherewasi_prefs'

export function normalizePreferences(raw: Partial<Preferences> | null | undefined): Preferences {
  const value = raw ?? {}
  const validSorts: SortOptionId[] = [
    'created_desc',
    'created_asc',
    'updated_desc',
    'title_asc',
    'title_desc',
    'rating_desc',
    'progress_desc'
  ]
  return {
    accent: ACCENTS.some((a) => a.id === value.accent) ? (value.accent as AccentId) : DEFAULT_PREFERENCES.accent,
    viewMode: value.viewMode === 'list' ? 'list' : 'grid',
    confirmDelete: value.confirmDelete ?? DEFAULT_PREFERENCES.confirmDelete,
    hideCompleted: value.hideCompleted ?? DEFAULT_PREFERENCES.hideCompleted,
    sortBy: validSorts.includes(value.sortBy as SortOptionId) ? (value.sortBy as SortOptionId) : DEFAULT_PREFERENCES.sortBy,
    bookStep: typeof value.bookStep === 'number' && value.bookStep > 0 ? value.bookStep : DEFAULT_PREFERENCES.bookStep,
    movieStep: typeof value.movieStep === 'number' && value.movieStep > 0 ? value.movieStep : DEFAULT_PREFERENCES.movieStep,
    seriesStep: typeof value.seriesStep === 'number' && value.seriesStep > 0 ? value.seriesStep : DEFAULT_PREFERENCES.seriesStep
  }
}

export interface PreferencesStore {
  stored: Ref<Preferences>
  prefs: ComputedRef<Preferences>
  accentOption: ComputedRef<AccentOption>
}

export function createPreferencesStore(): PreferencesStore {
  const stored = useCookie<Preferences>(COOKIE_KEY, {
    default: () => ({ ...DEFAULT_PREFERENCES }),
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/'
  })

  const prefs = computed<Preferences>(() => normalizePreferences(stored.value))

  return {
    stored,
    prefs,
    accentOption: computed<AccentOption>(
      () => ACCENTS.find((a) => a.id === prefs.value.accent) ?? ACCENTS[0]!
    )
  }
}

export function usePreferences() {
  const { stored, prefs, accentOption } = useNuxtApp().$preferences

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    stored.value = { ...normalizePreferences(stored.value), [key]: value }
  }

  function patch(changes: Partial<Preferences>) {
    stored.value = normalizePreferences({ ...normalizePreferences(stored.value), ...changes })
  }

  function reset() {
    stored.value = { ...DEFAULT_PREFERENCES }
  }

  return {
    prefs,
    accentOption,
    update,
    patch,
    reset
  }
}
