<script setup lang="ts">
import type { MediaItem, MediaType, MediaStatus } from '~/types'
import { MEDIA_TYPES } from '~/utils/media'

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
const season = ref<number | null>(1)
const episode = ref<number | null>(1)
const totalEpisodes = ref<number | null>(null)
const currentPage = ref<number | null>(1)
const totalPages = ref<number | null>(null)
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
    totalEpisodes.value = null
    currentPage.value = 1
    totalPages.value = null
    percentage.value = 0
    currentUnit.value = ''
    isPrivate.value = false
    isFavorite.value = false
  }
})

const isSeries = computed(() => selectedType.value === 'series' || selectedType.value === 'anime')
const isBook = computed(() => selectedType.value === 'book' || selectedType.value === 'manga')

function handleAdd() {
  const cleanTitle = title.value.trim()
  if (!cleanTitle) return

  let progressType: MediaItem['progress_type'] = 'episode_season'
  if (isBook.value) progressType = 'pages'
  else if (selectedType.value === 'other' || selectedType.value === 'game') progressType = 'percentage'

  emit('add', {
    title: cleanTitle,
    media_type: selectedType.value,
    status: status.value,
    progress_type: progressType,
    season: isSeries.value ? (season.value ?? 1) : null,
    episode: isSeries.value ? (episode.value ?? 1) : null,
    total_seasons: null,
    total_episodes: isSeries.value ? totalEpisodes.value : null,
    current_page: isBook.value ? (currentPage.value ?? 1) : null,
    total_pages: isBook.value ? totalPages.value : null,
    percentage: !isSeries.value && !isBook.value ? (percentage.value ?? 0) : null,
    current_unit: currentUnit.value || null,
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
        <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
          <button
            v-for="t in MEDIA_TYPES.slice(0, 7)"
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
        
        <!-- Series: S & Ep -->
        <div v-if="isSeries" class="grid grid-cols-3 gap-2">
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
            <span class="text-[11px] font-medium text-slate-500">Tot. Episodi</span>
            <input
              v-model.number="totalEpisodes"
              type="number"
              min="1"
              placeholder="Opz."
              class="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm text-center text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
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

        <!-- Custom % -->
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
