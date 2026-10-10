<script setup lang="ts">
import type { MediaItem, MediaStatus, MediaType, ProgressType } from '~/types'
import {
  MEDIA_STATUSES,
  MEDIA_TYPES,
  calculateProgressPercentage,
  formatProgressDisplay,
  formatMinutesToTime,
  parseTimeToMinutes,
  splitMinutesToHoursAndMinutes,
  getCreatorLabel
} from '~/utils/media'
import { useConfirm } from '~/composables/useConfirm'

const props = defineProps<{
  open: boolean
  item: MediaItem | null
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', id: number, updates: Partial<MediaItem>): void
  (e: 'delete', id: number): void
}>()

const { ask } = useConfirm()
const toast = useToast()

const form = ref<Partial<MediaItem>>({})
const seasonEpisodes = ref<Record<string, number>>({})
const isAiLoading = ref(false)
const coverLoadError = ref(false)

watch(() => form.value.cover_url, () => {
  coverLoadError.value = false
})

async function handleAiAutocomplete() {
  const titleQuery = form.value.title?.trim()
  if (!titleQuery) {
    toast.add({
      title: 'Inserisci un titolo',
      description: 'Scrivi prima il titolo dell\'opera per effettuare la ricerca con Gemini.',
      color: 'warning'
    })
    return
  }

  isAiLoading.value = true
  try {
    const res = await $fetch<{
      title: string
      media_type: MediaType
      creator: string | null
      release_year: number | null
      genre: string
      description: string
      cover_url: string | null
      total_seasons: number | null
      total_episodes: number | null
      season_episodes: Record<string, number> | null
      duration_minutes: number | null
      total_duration: string | null
      total_pages: number | null
    }>('/api/ai/autocomplete', {
      method: 'POST',
      body: {
        title: titleQuery,
        mediaType: form.value.media_type || 'series'
      }
    })

    if (res) {
      if (res.title) form.value.title = res.title
      if (res.creator) form.value.creator = res.creator
      if (res.release_year) form.value.release_year = res.release_year
      if (res.genre) form.value.genre = res.genre
      if (res.description) form.value.description = res.description
      if (res.cover_url) form.value.cover_url = res.cover_url

      if (isSeries.value) {
        if (res.total_seasons) form.value.total_seasons = res.total_seasons
        if (res.total_episodes) form.value.total_episodes = res.total_episodes
        if (res.season_episodes && Object.keys(res.season_episodes).length > 0) {
          seasonEpisodes.value = { ...res.season_episodes }
        }
      } else if (isMovie.value) {
        if (res.duration_minutes) {
          movieDurationHours.value = Math.floor(res.duration_minutes / 60)
          movieDurationMinutes.value = res.duration_minutes % 60
          form.value.total_duration = res.total_duration
        }
      } else if (isBook.value) {
        if (res.total_pages) {
          form.value.total_pages = res.total_pages
        }
      }

      toast.add({
        title: 'Info aggiornate con Gemini AI! ✨',
        description: `Dettagli e locandina aggiornati per "${res.title}".`,
        color: 'success'
      })
    }
  } catch (err: any) {
    toast.add({
      title: 'Errore AI Gemini',
      description: err?.data?.statusMessage || err?.message || 'Impossibile aggiornare i dettagli.',
      color: 'error'
    })
  } finally {
    isAiLoading.value = false
  }
}

// Film time fields
const movieStopHours = ref<number>(0)
const movieStopMinutes = ref<number>(0)
const movieDurationHours = ref<number | null>(null)
const movieDurationMinutes = ref<number | null>(null)

watch(() => props.item, (newItem) => {
  if (newItem) {
    form.value = JSON.parse(JSON.stringify(newItem))
    seasonEpisodes.value = newItem.season_episodes ? { ...newItem.season_episodes } : {}

    // Initialize film time
    const stoppedMins = parseTimeToMinutes(newItem.time_stopped || newItem.current_unit)
    const splitStopped = splitMinutesToHoursAndMinutes(stoppedMins)
    movieStopHours.value = splitStopped.hours
    movieStopMinutes.value = splitStopped.minutes

    if (newItem.total_duration) {
      const durMins = parseTimeToMinutes(newItem.total_duration)
      if (durMins > 0) {
        const splitDur = splitMinutesToHoursAndMinutes(durMins)
        movieDurationHours.value = splitDur.hours
        movieDurationMinutes.value = splitDur.minutes
      } else {
        movieDurationHours.value = null
        movieDurationMinutes.value = null
      }
    } else {
      movieDurationHours.value = null
      movieDurationMinutes.value = null
    }
  } else {
    form.value = {}
    seasonEpisodes.value = {}
    movieStopHours.value = 0
    movieStopMinutes.value = 0
    movieDurationHours.value = null
    movieDurationMinutes.value = null
  }
}, { immediate: true })

const currentType = computed(() => form.value.media_type ?? 'series')
const isSeries = computed(() => currentType.value === 'series')
const isMovie = computed(() => currentType.value === 'movie')
const isBook = computed(() => currentType.value === 'book')

function updateSeasonEp(sNum: number, count: number | null) {
  if (!count || count <= 0) {
    delete seasonEpisodes.value[String(sNum)]
  } else {
    seasonEpisodes.value[String(sNum)] = count
  }
  if (form.value.season === sNum) {
    form.value.total_episodes = count || null
  }
}

function addMovieMinutes(addedMins: number) {
  const currentTotal = (movieStopHours.value || 0) * 60 + (movieStopMinutes.value || 0)
  const newTotal = Math.max(0, currentTotal + addedMins)
  movieStopHours.value = Math.floor(newTotal / 60)
  movieStopMinutes.value = newTotal % 60
}

const movieCalculatedProgress = computed(() => {
  const stopTotal = (movieStopHours.value || 0) * 60 + (movieStopMinutes.value || 0)
  const durTotal = ((movieDurationHours.value || 0) * 60) + (movieDurationMinutes.value || 0)
  if (durTotal > 0) {
    return Math.min(100, Math.round((stopTotal / durTotal) * 100))
  }
  return 0
})

async function handleSave() {
  if (!props.item) return

  if (isSeries.value) {
    form.value.progress_type = form.value.progress_type || 'episode_season'
    form.value.season_episodes = Object.keys(seasonEpisodes.value).length > 0 ? seasonEpisodes.value : null
    const curSeason = form.value.season ?? 1
    if (seasonEpisodes.value[String(curSeason)]) {
      form.value.total_episodes = seasonEpisodes.value[String(curSeason)]
    }

    // Auto complete if final season and episode reached
    if (form.value.total_seasons && form.value.season && form.value.season >= form.value.total_seasons) {
      if (form.value.total_episodes && (form.value.episode ?? 0) >= form.value.total_episodes && form.value.status === 'in_progress') {
        form.value.status = 'completed'
      }
    }
  } else if (isMovie.value) {
    form.value.progress_type = 'time'
    const totalStopMin = (movieStopHours.value || 0) * 60 + (movieStopMinutes.value || 0)
    const formattedStop = totalStopMin > 0 ? formatMinutesToTime(totalStopMin) : '0m'
    form.value.time_stopped = formattedStop
    form.value.current_unit = formattedStop

    if (movieDurationHours.value !== null || movieDurationMinutes.value !== null) {
      const totalDurMin = (movieDurationHours.value || 0) * 60 + (movieDurationMinutes.value || 0)
      if (totalDurMin > 0) {
        form.value.total_duration = formatMinutesToTime(totalDurMin)
        if (totalStopMin >= totalDurMin && form.value.status === 'in_progress') {
          form.value.status = 'completed'
        }
      } else {
        form.value.total_duration = null
      }
    } else {
      form.value.total_duration = null
    }
  } else if (isBook.value) {
    form.value.progress_type = form.value.progress_type || 'pages'
    if (form.value.total_pages && (form.value.current_page ?? 0) >= form.value.total_pages && form.value.status === 'in_progress') {
      form.value.status = 'completed'
    }
  }

  if (form.value.status === 'completed' && !form.value.completed_at) {
    form.value.completed_at = new Date().toISOString()
  } else if (form.value.status !== 'completed') {
    form.value.completed_at = null
  }

  emit('save', props.item.id, form.value)
  emit('update:open', false)
}

async function handleDelete() {
  if (!props.item) return

  const confirmed = await ask({
    title: `Eliminare "${props.item.title}"?`,
    description: 'L\'elemento verrà rimosso permanentemente dalla tua lista personale.',
    confirmLabel: 'Elimina',
    tone: 'danger',
    icon: 'i-lucide-trash-2'
  })

  if (confirmed) {
    emit('delete', props.item.id)
    emit('update:open', false)
  }
}
</script>

<template>
  <AppModal
    :open="open"
    :title="readonly ? (item?.title ?? 'Dettagli') : (item ? 'Modifica Traccia' : 'Dettagli')"
    :subtitle="item ? formatProgressDisplay(item) : undefined"
    icon="i-lucide-bookmark"
    size="lg"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="item" class="space-y-5 py-2">
      <!-- Readonly Banner for Friend's Track -->
      <div v-if="readonly" class="rounded-2xl bg-indigo-50/80 p-3.5 text-xs text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200">
        <p class="font-medium">Stai visualizzando il progresso di un tuo amico.</p>
      </div>

      <!-- Title, Type & AI Completion -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Dettagli Opera</label>
          <button
            v-if="!readonly"
            type="button"
            :disabled="isAiLoading || !form.title?.trim()"
            class="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-100 disabled:opacity-40 dark:border-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
            title="Recupera automaticamente copertina, dettagli, autore/regista, stagioni con Gemini AI"
            @click="handleAiAutocomplete"
          >
            <UIcon
              :name="isAiLoading ? 'i-lucide-loader-2' : 'i-lucide-sparkles'"
              class="h-3.5 w-3.5"
              :class="isAiLoading ? 'animate-spin text-indigo-600' : 'text-indigo-600 dark:text-indigo-400'"
            />
            <span>{{ isAiLoading ? 'Ricerca con Gemini...' : 'Completa con AI' }}</span>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="sm:col-span-2 space-y-1">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Titolo</label>
            <input
              v-model="form.title"
              :disabled="readonly"
              type="text"
              required
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white disabled:opacity-75"
            />
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Categoria</label>
            <select
              v-model="form.media_type"
              :disabled="readonly"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white disabled:opacity-75"
            >
              <option v-for="t in MEDIA_TYPES" :key="t.id" :value="t.id">{{ t.label }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Cover Art & Creator & Year Box -->
      <div class="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
        <div class="flex items-start gap-3.5">
          <!-- Thumbnail preview -->
          <div class="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <img
              v-if="form.cover_url && !coverLoadError"
              :src="form.cover_url"
              alt="Copertina"
              class="h-full w-full object-cover transition hover:scale-105"
              @error="coverLoadError = true"
              @load="coverLoadError = false"
            />
            <div v-else-if="form.cover_url && coverLoadError" class="flex h-full w-full flex-col items-center justify-center p-1 text-center bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
              <UIcon name="i-lucide-image-off" class="h-5 w-5" />
              <span class="text-[8px] font-bold mt-1 leading-tight">Link non visibile</span>
            </div>
            <div v-else class="flex h-full w-full flex-col items-center justify-center p-1 text-slate-400 dark:text-slate-500">
              <UIcon name="i-lucide-image" class="h-6 w-6" />
              <span class="text-[9px] font-semibold mt-1">Cover</span>
            </div>
          </div>

          <!-- Cover URL, Creator & Year Inputs -->
          <div class="min-w-0 flex-1 space-y-2">
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  URL Copertina / Locandina
                </label>
                <button
                  v-if="form.cover_url && !readonly"
                  type="button"
                  class="text-[10px] font-semibold text-rose-500 hover:text-rose-600"
                  @click="form.cover_url = null"
                >
                  Rimuovi
                </button>
              </div>
              <input
                v-model="form.cover_url"
                :disabled="readonly"
                type="url"
                placeholder="https://... (URL immagine copertina)"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white disabled:opacity-75"
              />
            </div>

            <!-- Creator & Year in sub-row -->
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-0.5">
                <label class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {{ getCreatorLabel(form.media_type) }}
                </label>
                <input
                  v-model="form.creator"
                  :disabled="readonly"
                  type="text"
                  placeholder="es. Autore / Regista"
                  class="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white disabled:opacity-75"
                />
              </div>

              <div class="space-y-0.5">
                <label class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Anno
                </label>
                <input
                  v-model.number="form.release_year"
                  :disabled="readonly"
                  type="number"
                  min="1800"
                  max="2100"
                  placeholder="es. 2024"
                  class="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white text-center disabled:opacity-75"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Description / Synopsis -->
        <div v-if="form.description || !readonly" class="mt-3 border-t border-slate-200/60 pt-2.5 dark:border-slate-800">
          <label class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Trama / Sinossi</label>
          <textarea
            v-model="form.description"
            :disabled="readonly"
            rows="2"
            placeholder="Breve descrizione o trama dell'opera..."
            class="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white disabled:opacity-75"
          />
        </div>
      </div>

      <!-- Status Selector -->
      <div class="space-y-1.5">
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Stato di avanzamento</label>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            v-for="st in MEDIA_STATUSES"
            :key="st.id"
            type="button"
            :disabled="readonly"
            class="flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition"
            :class="form.status === st.id
              ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-300'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'"
            @click="form.status = st.id"
          >
            <UIcon :name="st.icon" class="h-3.5 w-3.5" />
            <span>{{ st.label }}</span>
          </button>
        </div>
      </div>

      <!-- Specific Progress Fields -->
      <div class="rounded-2xl bg-slate-50/80 p-4 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Progresso Puntuale</h4>

        <!-- Series Progress (Season, Episode, Total Seasons & Per-Season Configuration) -->
        <div v-if="isSeries" class="space-y-3">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="space-y-1">
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Stagione Attuale</label>
              <input
                v-model.number="form.season"
                :disabled="readonly"
                type="number"
                min="1"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Episodio Attuale</label>
              <input
                v-model.number="form.episode"
                :disabled="readonly"
                type="number"
                min="0"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Totale Stagioni</label>
              <input
                v-model.number="form.total_seasons"
                :disabled="readonly"
                type="number"
                min="1"
                placeholder="es. 5"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Ep. Stagione {{ form.season || 1 }}</label>
              <input
                v-model.number="form.total_episodes"
                :disabled="readonly"
                type="number"
                min="1"
                placeholder="es. 10"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          <!-- Per-season episodes configuration table/grid -->
          <div v-if="form.total_seasons && form.total_seasons > 1" class="rounded-xl bg-white p-3 border border-slate-200/80 dark:bg-slate-800/80 dark:border-slate-700/80">
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Configurazione Episodi per Singola Stagione:</label>
              <span class="text-[11px] text-slate-400">Premendo +1 a fine stagione passerai alla successiva</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div
                v-for="sNum in form.total_seasons"
                :key="sNum"
                class="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border dark:bg-slate-900/60"
                :class="sNum === form.season ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30' : 'border-slate-100 dark:border-slate-800'"
              >
                <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">Stagione {{ sNum }}:</span>
                <input
                  :value="seasonEpisodes[String(sNum)] ?? (sNum === form.season ? form.total_episodes : '')"
                  :disabled="readonly"
                  type="number"
                  min="1"
                  placeholder="ep."
                  class="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none text-center"
                  @input="updateSeasonEp(sNum, ($event.target as HTMLInputElement).value ? parseInt(($event.target as HTMLInputElement).value, 10) : null)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Movie Progress (Time Stopped & Duration) -->
        <div v-else-if="isMovie" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Time Stopped -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Punto in cui ti sei fermato (Tempo)</label>
              <div class="grid grid-cols-2 gap-2">
                <div class="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                  <input
                    v-model.number="movieStopHours"
                    :disabled="readonly"
                    type="number"
                    min="0"
                    max="20"
                    placeholder="0"
                    class="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none dark:text-white text-center"
                  />
                  <span class="text-xs font-medium text-slate-400 ml-1">ore</span>
                </div>
                <div class="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                  <input
                    v-model.number="movieStopMinutes"
                    :disabled="readonly"
                    type="number"
                    min="0"
                    max="59"
                    placeholder="0"
                    class="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none dark:text-white text-center"
                  />
                  <span class="text-xs font-medium text-slate-400 ml-1">min</span>
                </div>
              </div>

              <!-- Quick Time Adjust Buttons -->
              <div v-if="!readonly" class="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  class="rounded-lg bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                  @click="movieStopHours = 0; movieStopMinutes = 0"
                >
                  Inizio
                </button>
                <button
                  v-for="mins in [10, 15, 30, 60]"
                  :key="mins"
                  type="button"
                  class="rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300"
                  @click="addMovieMinutes(mins)"
                >
                  +{{ mins }}m
                </button>
              </div>
            </div>

            <!-- Total Duration -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Durata Totale Film (Opzionale)</label>
              <div class="grid grid-cols-2 gap-2">
                <div class="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                  <input
                    v-model.number="movieDurationHours"
                    :disabled="readonly"
                    type="number"
                    min="0"
                    max="20"
                    placeholder="es. 2"
                    class="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none dark:text-white text-center"
                  />
                  <span class="text-xs font-medium text-slate-400 ml-1">ore</span>
                </div>
                <div class="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                  <input
                    v-model.number="movieDurationMinutes"
                    :disabled="readonly"
                    type="number"
                    min="0"
                    max="59"
                    placeholder="es. 15"
                    class="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none dark:text-white text-center"
                  />
                  <span class="text-xs font-medium text-slate-400 ml-1">min</span>
                </div>
              </div>

              <div v-if="movieCalculatedProgress > 0" class="flex items-center justify-between text-xs pt-2">
                <span class="text-slate-500">Progresso visivo:</span>
                <span class="font-bold text-indigo-600 dark:text-indigo-400">{{ movieCalculatedProgress }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Book Progress (Pages & Chapters) -->
        <div v-else-if="isBook" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="space-y-1">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Pagina Corrente</label>
            <input
              v-model.number="form.current_page"
              :disabled="readonly"
              type="number"
              min="0"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Totale Pagine</label>
            <input
              v-model.number="form.total_pages"
              :disabled="readonly"
              type="number"
              min="1"
              placeholder="es. 350"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Capitolo / Unità</label>
            <input
              v-model="form.current_unit"
              :disabled="readonly"
              type="text"
              placeholder="es. Capitolo 12"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        <!-- Percentage or Custom Progress -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="space-y-1">
            <div class="flex justify-between items-center">
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Percentuale (0-100%)</label>
              <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400">{{ form.percentage ?? 0 }}%</span>
            </div>
            <input
              v-model.number="form.percentage"
              :disabled="readonly"
              type="range"
              min="0"
              max="100"
              class="w-full accent-indigo-600"
            />
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Nota di stato</label>
            <input
              v-model="form.current_unit"
              :disabled="readonly"
              type="text"
              placeholder="es. Metà film / Livello 5"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      <!-- Rating & Genre -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Voto Personale (1 - 10)</label>
          <div class="flex items-center gap-2">
            <input
              v-model.number="form.rating"
              :disabled="readonly"
              type="number"
              min="0"
              max="10"
              step="0.5"
              placeholder="es. 8.5"
              class="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
            <div class="flex items-center text-amber-500">
              <UIcon name="i-lucide-star" class="h-4 w-4 fill-current" />
              <span class="ml-1 text-xs text-slate-500">/ 10</span>
            </div>
          </div>
        </div>

        <div class="space-y-1">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Genere / Note brevi</label>
          <input
            v-model="form.genre"
            :disabled="readonly"
            type="text"
            placeholder="es. Fantascienza, Thriller"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      <!-- Review / Notes -->
      <div class="space-y-1">
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Recensione & Commenti Personali</label>
        <textarea
          v-model="form.review"
          :disabled="readonly"
          rows="3"
          placeholder="Cosa ne pensi finora? Ricordi o citazioni preferite..."
          class="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        />
      </div>

      <!-- Flags (Favorite & Privacy) -->
      <div v-if="!readonly" class="flex flex-wrap items-center gap-4 pt-2">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="form.is_favorite"
            type="checkbox"
            class="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
          />
          <span class="text-xs font-bold text-slate-700 dark:text-slate-300">⭐ Aggiungi ai Preferiti</span>
        </label>

        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="form.is_private"
            type="checkbox"
            class="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
          />
          <span class="text-xs font-medium text-slate-600 dark:text-slate-400">🔒 Privato (nascondi agli amici)</span>
        </label>
      </div>
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <div class="flex w-full items-center justify-between">
        <div>
          <button
            v-if="!readonly && item"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
            @click="handleDelete"
          >
            <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
            <span>Elimina</span>
          </button>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="emit('update:open', false)"
          >
            {{ readonly ? 'Chiudi' : 'Annulla' }}
          </button>

          <button
            v-if="!readonly"
            type="button"
            class="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            @click="handleSave"
          >
            Salva Modifiche
          </button>
        </div>
      </div>
    </template>
  </AppModal>
</template>
