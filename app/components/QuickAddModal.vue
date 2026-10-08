<script setup lang="ts">
import type { MediaItem, MediaType, MediaStatus } from '~/types'
import { MEDIA_TYPES, formatMinutesToTime, parseTimeToMinutes } from '~/utils/media'

const props = defineProps<{
  open: boolean
  initialType?: MediaType | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'add', payload: Omit<MediaItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>): void
}>()

const selectedType = ref<MediaType>('series')
const title = ref('')
const genre = ref('')
const status = ref<MediaStatus>('in_progress')

// Series fields
const season = ref<number | null>(1)
const episode = ref<number | null>(1)
const totalSeasons = ref<number | null>(null)
const totalEpisodes = ref<number | null>(null)
const seasonEpisodes = ref<Record<string, number>>({})
const showSeasonBreakdown = ref(false)

// Film / Movie fields
const movieStopHours = ref<number>(0)
const movieStopMinutes = ref<number>(0)
const movieDurationHours = ref<number | null>(null)
const movieDurationMinutes = ref<number | null>(null)

// Book fields
const currentPage = ref<number | null>(1)
const totalPages = ref<number | null>(null)

// Generic percentage
const percentage = ref<number | null>(0)
const currentUnit = ref('')
const isPrivate = ref(false)
const isFavorite = ref(false)

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    selectedType.value = props.initialType ?? 'series'
    title.value = ''
    genre.value = ''
    status.value = 'in_progress'
    season.value = 1
    episode.value = 1
    totalSeasons.value = null
    totalEpisodes.value = null
    seasonEpisodes.value = {}
    showSeasonBreakdown.value = false
    movieStopHours.value = 0
    movieStopMinutes.value = 0
    movieDurationHours.value = null
    movieDurationMinutes.value = null
    currentPage.value = 1
    totalPages.value = null
    percentage.value = 0
    currentUnit.value = ''
    isPrivate.value = false
    isFavorite.value = false
  }
})

const isSeries = computed(() => selectedType.value === 'series')
const isMovie = computed(() => selectedType.value === 'movie')
const isBook = computed(() => selectedType.value === 'book')

// Auto-expand season breakdown when totalSeasons > 1
watch(totalSeasons, (val) => {
  if (val && val > 1) {
    showSeasonBreakdown.value = true
  }
})

function updateSeasonEp(sNum: number, count: number | null) {
  if (!count || count <= 0) {
    delete seasonEpisodes.value[String(sNum)]
  } else {
    seasonEpisodes.value[String(sNum)] = count
  }
  if (season.value === sNum) {
    totalEpisodes.value = count || null
  }
}

function setMovieQuickTime(mins: number) {
  movieStopHours.value = Math.floor(mins / 60)
  movieStopMinutes.value = mins % 60
}

function handleAdd() {
  const cleanTitle = title.value.trim()
  if (!cleanTitle) return

  let progressType: MediaItem['progress_type'] = 'episode_season'
  let calculatedTimeStopped: string | null = null
  let calculatedTotalDuration: string | null = null

  if (isSeries.value) {
    progressType = 'episode_season'
    const curSeason = season.value ?? 1
    if (totalEpisodes.value && !seasonEpisodes.value[String(curSeason)]) {
      seasonEpisodes.value[String(curSeason)] = totalEpisodes.value
    }
  } else if (isMovie.value) {
    progressType = 'time'
    const totalStopMin = (movieStopHours.value || 0) * 60 + (movieStopMinutes.value || 0)
    calculatedTimeStopped = totalStopMin > 0 ? formatMinutesToTime(totalStopMin) : '0m'

    if (movieDurationHours.value !== null || movieDurationMinutes.value !== null) {
      const totalDurMin = (movieDurationHours.value || 0) * 60 + (movieDurationMinutes.value || 0)
      if (totalDurMin > 0) {
        calculatedTotalDuration = formatMinutesToTime(totalDurMin)
      }
    }
  } else if (isBook.value) {
    progressType = 'pages'
  } else if (selectedType.value === 'other' || selectedType.value === 'game') {
    progressType = 'percentage'
  }

  const curSeason = season.value ?? 1
  const effectiveTotalEp = seasonEpisodes.value[String(curSeason)] || totalEpisodes.value || null

  emit('add', {
    title: cleanTitle,
    media_type: selectedType.value,
    status: status.value,
    progress_type: progressType,
    season: isSeries.value ? curSeason : null,
    episode: isSeries.value ? (episode.value ?? 1) : null,
    total_seasons: isSeries.value ? totalSeasons.value : null,
    total_episodes: isSeries.value ? effectiveTotalEp : null,
    season_episodes: isSeries.value && Object.keys(seasonEpisodes.value).length > 0 ? seasonEpisodes.value : null,
    time_stopped: isMovie.value ? calculatedTimeStopped : null,
    total_duration: isMovie.value ? calculatedTotalDuration : null,
    current_page: isBook.value ? (currentPage.value ?? 1) : null,
    total_pages: isBook.value ? totalPages.value : null,
    percentage: !isSeries.value && !isBook.value && !isMovie.value ? (percentage.value ?? 0) : null,
    current_unit: isMovie.value ? calculatedTimeStopped : (currentUnit.value || null),
    rating: null,
    review: '',
    notes: '',
    cover_url: null,
    tags: [],
    genre: genre.value.trim(),
    is_favorite: isFavorite.value,
    is_private: isPrivate.value,
    started_at: new Date().toISOString(),
    completed_at: null
  })

  emit('update:open', false)
}
</script>

<template>
  <AppModal
    :open="open"
    title="Aggiungi da Tracciare"
    subtitle="Cosa stai guardando, leggendo o giocando?"
    icon="i-lucide-plus"
    size="md"
    @update:open="emit('update:open', $event)"
  >
    <form class="space-y-4 py-2" @submit.prevent="handleAdd">
      <!-- Media Type Selection -->
      <div class="space-y-1.5">
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Cosa vuoi tracciare?</label>
        <div class="grid grid-cols-3 sm:grid-cols-5 gap-2">
          <button
            v-for="t in MEDIA_TYPES"
            :key="t.id"
            type="button"
            class="flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-2.5 text-xs font-bold transition"
            :class="selectedType === t.id
              ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-300 shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'"
            @click="selectedType = t.id"
          >
            <UIcon :name="t.icon" class="h-5 w-5" />
            <span>{{ t.label }}</span>
          </button>
        </div>
      </div>

      <!-- Title & Genre -->
      <div class="space-y-3">
        <div class="space-y-1">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Titolo dell'opera *</label>
          <input
            v-model="title"
            type="text"
            required
            placeholder="es. Breaking Bad, Il Signore degli Anelli..."
            class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div class="space-y-1">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Genere o Categoria</label>
          <input
            v-model="genre"
            type="text"
            placeholder="es. Fantasy, Dramma, Sci-Fi..."
            class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      <!-- Initial Progress Counter -->
      <div class="rounded-2xl bg-slate-50/80 p-3.5 border border-slate-100 dark:bg-slate-900/60 dark:border-slate-800">
        <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">A che punto sei?</label>
        
        <!-- Series: S & Ep & Season episodes -->
        <div v-if="isSeries" class="space-y-3">
          <div class="grid grid-cols-3 gap-2">
            <div class="space-y-1">
              <span class="text-[11px] font-medium text-slate-500">Stagione</span>
              <input
                v-model.number="season"
                type="number"
                min="1"
                class="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm text-center text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div class="space-y-1">
              <span class="text-[11px] font-medium text-slate-500">Episodio</span>
              <input
                v-model.number="episode"
                type="number"
                min="0"
                class="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm text-center text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div class="space-y-1">
              <span class="text-[11px] font-medium text-slate-500">Tot. Stagioni</span>
              <input
                v-model.number="totalSeasons"
                type="number"
                min="1"
                placeholder="Opz."
                class="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm text-center text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          <!-- Singular Season Episodes Configuration -->
          <div v-if="totalSeasons && totalSeasons > 1" class="rounded-xl bg-white p-3 border border-slate-200/80 dark:bg-slate-800/80 dark:border-slate-700/80">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Episodi per ogni stagione:</span>
              <span class="text-[11px] text-slate-400">Passaggio automatico a fine stagione</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div v-for="sNum in totalSeasons" :key="sNum" class="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:bg-slate-900/60 dark:border-slate-800">
                <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">S{{ sNum }}:</span>
                <input
                  :value="seasonEpisodes[String(sNum)] ?? (sNum === season ? totalEpisodes : '')"
                  type="number"
                  min="1"
                  placeholder="ep."
                  class="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none text-center"
                  @input="updateSeasonEp(sNum, ($event.target as HTMLInputElement).value ? parseInt(($event.target as HTMLInputElement).value, 10) : null)"
                />
              </div>
            </div>
          </div>

          <!-- Single Season total episodes input if totalSeasons not set or is 1 -->
          <div v-else class="space-y-1">
            <div class="flex justify-between items-center">
              <span class="text-[11px] font-medium text-slate-500">Episodi della Stagione {{ season || 1 }}</span>
              <span class="text-[10px] text-slate-400">Opzionale per avanzamento automatico</span>
            </div>
            <input
              v-model.number="totalEpisodes"
              type="number"
              min="1"
              placeholder="es. 10 episodi"
              class="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        <!-- Movie: Time Stopped (instead of percentage) -->
        <div v-else-if="isMovie" class="space-y-3">
          <div class="space-y-2">
            <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Punto in cui ti sei fermato (Tempo)</span>
            <div class="grid grid-cols-2 gap-2">
              <div class="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
                <input
                  v-model.number="movieStopHours"
                  type="number"
                  min="0"
                  max="20"
                  placeholder="0"
                  class="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none dark:text-white text-center"
                />
                <span class="text-xs font-medium text-slate-400 ml-1">ore</span>
              </div>
              <div class="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
                <input
                  v-model.number="movieStopMinutes"
                  type="number"
                  min="0"
                  max="59"
                  placeholder="0"
                  class="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none dark:text-white text-center"
                />
                <span class="text-xs font-medium text-slate-400 ml-1">min</span>
              </div>
            </div>

            <!-- Quick presets -->
            <div class="flex items-center gap-1.5 overflow-x-auto pt-1">
              <button
                v-for="preset in [
                  { label: 'Inizio', mins: 0 },
                  { label: '30m', mins: 30 },
                  { label: '45m', mins: 45 },
                  { label: '1h 00m', mins: 60 },
                  { label: '1h 30m', mins: 90 }
                ]"
                :key="preset.label"
                type="button"
                class="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 whitespace-nowrap"
                @click="setMovieQuickTime(preset.mins)"
              >
                {{ preset.label }}
              </button>
            </div>
          </div>

          <!-- Total Duration (Optional) -->
          <div class="space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-800">
            <span class="text-[11px] font-medium text-slate-500">Durata totale del film (opzionale)</span>
            <div class="grid grid-cols-2 gap-2">
              <div class="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
                <input
                  v-model.number="movieDurationHours"
                  type="number"
                  min="0"
                  max="20"
                  placeholder="es. 2"
                  class="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none dark:text-white text-center"
                />
                <span class="text-xs font-medium text-slate-400 ml-1">ore</span>
              </div>
              <div class="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
                <input
                  v-model.number="movieDurationMinutes"
                  type="number"
                  min="0"
                  max="59"
                  placeholder="es. 15"
                  class="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none dark:text-white text-center"
                />
                <span class="text-xs font-medium text-slate-400 ml-1">min</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Book: Pages -->
        <div v-else-if="isBook" class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <span class="text-[11px] font-medium text-slate-500">Pagina Attuale</span>
            <input
              v-model.number="currentPage"
              type="number"
              min="0"
              class="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm text-center text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div class="space-y-1">
            <span class="text-[11px] font-medium text-slate-500">Totale Pagine</span>
            <input
              v-model.number="totalPages"
              type="number"
              min="1"
              placeholder="es. 400"
              class="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm text-center text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        <!-- Custom % for Other/Game -->
        <div v-else class="space-y-2">
          <div class="flex justify-between text-xs">
            <span class="text-slate-500">Percentuale</span>
            <span class="font-bold text-indigo-600 dark:text-indigo-400">{{ percentage }}%</span>
          </div>
          <input v-model.number="percentage" type="range" min="0" max="100" class="w-full accent-indigo-600" />
        </div>
      </div>

      <!-- Privacy & Favorite Checkboxes -->
      <div class="flex items-center justify-between pt-1">
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="isPrivate" type="checkbox" class="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" />
          <span class="text-xs text-slate-600 dark:text-slate-400">🔒 Privato (nascondi agli amici)</span>
        </label>

        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="isFavorite" type="checkbox" class="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" />
          <span class="text-xs font-semibold text-amber-500">⭐ Preferito</span>
        </label>
      </div>

      <div class="pt-2">
        <button
          type="submit"
          :disabled="!title.trim()"
          class="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          <UIcon name="i-lucide-plus" class="h-4 w-4" />
          <span>Inizia a Tracciare</span>
        </button>
      </div>
    </form>
  </AppModal>
</template>
