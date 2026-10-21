<script setup lang="ts">
import type { MediaItem, MediaStatus, MediaType } from '~/types'
import { useMediaTracker } from '~/composables/useMediaTracker'
import { usePreferences, type SortOptionId } from '~/composables/usePreferences'
import { useQuickAdd } from '~/composables/useQuickAdd'

const {
  items,
  loading,
  stats,
  loadItems,
  addItem,
  updateItem,
  deleteItem,
  incrementProgress,
  decrementProgress,
  toggleFavorite,
  setStatus,
  sortItems
} = useMediaTracker()

const { prefs, update } = usePreferences()
const { openQuickAdd } = useQuickAdd()

function handleSortChange(newSort: SortOptionId) {
  update('sortBy', newSort)
  sortItems(newSort)
}

function toggleTopFilter(type: MediaType | 'all') {
  if (type === 'all') {
    if (activeType.value === 'all' && activeStatus.value === 'completed') {
      activeStatus.value = 'in_progress'
    } else {
      activeType.value = 'all'
      activeStatus.value = 'completed'
    }
    return
  }

  if (activeType.value === type) {
    // Deselect back to all
    activeType.value = 'all'
    activeStatus.value = 'in_progress'
  } else {
    activeType.value = type
    const hasInProgress = items.value.some((i) => i.media_type === type && i.status === 'in_progress')
    const hasCompleted = items.value.some((i) => i.media_type === type && i.status === 'completed')
    if (hasInProgress) {
      activeStatus.value = 'in_progress'
    } else if (hasCompleted) {
      activeStatus.value = 'completed'
    } else {
      activeStatus.value = 'all'
    }
  }
}

const activeType = ref<MediaType | 'all'>('all')
const activeStatus = ref<MediaStatus | 'all'>('in_progress')
const searchQuery = ref('')
const selectedItem = ref<MediaItem | null>(null)
const isDetailOpen = ref(false)

// Handle query params on mount (e.g. from PWA shortcut ?type=series)
const route = useRoute()
onMounted(() => {
  if (route.query.type) {
    activeType.value = route.query.type as MediaType
  }
})

function openDetail(item: MediaItem) {
  selectedItem.value = item
  isDetailOpen.value = true
}

const categoryCounts = computed(() => {
  const currentCategoryItems = activeType.value === 'all'
    ? items.value
    : items.value.filter((i) => i.media_type === activeType.value)

  return {
    total: currentCategoryItems.length,
    inProgress: currentCategoryItems.filter((i) => i.status === 'in_progress').length,
    completed: currentCategoryItems.filter((i) => i.status === 'completed').length,
    planned: currentCategoryItems.filter((i) => i.status === 'planned').length
  }
})

const filteredItems = computed(() => {
  let list = items.value

  // Type filter
  if (activeType.value !== 'all') {
    list = list.filter((i) => i.media_type === activeType.value)
  }

  // Status filter
  if (activeStatus.value !== 'all') {
    list = list.filter((i) => i.status === activeStatus.value)
  }

  // Search filter
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter((i) =>
      i.title.toLowerCase().includes(q) ||
      (i.genre && i.genre.toLowerCase().includes(q)) ||
      (i.creator && i.creator.toLowerCase().includes(q)) ||
      (i.tags && i.tags.some((t) => t.toLowerCase().includes(q)))
    )
  }

  return list
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">
    <!-- Top Stats Overview Bar: Serie Viste, Film Visti, Libri Letti, Totale Opere -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <!-- Serie Viste -->
      <div
        class="surface-card flex flex-col justify-between cursor-pointer rounded-2xl p-3 sm:p-4 border transition hover:shadow-sm"
        :class="activeType === 'series'
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20'
          : 'border-slate-200/70 hover:border-indigo-500/40 dark:border-slate-800'"
        title="Filtra per Serie TV"
        @click="toggleTopFilter('series')"
      >
        <div class="flex items-center justify-between gap-1 text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span class="truncate">Serie Viste</span>
          <UIcon name="i-lucide-tv" class="h-4 w-4 shrink-0 text-indigo-500" />
        </div>
        <div class="mt-2">
          <div class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none">
            {{ stats.seriesCompleted }}
          </div>
          <div class="mt-1 text-[10px] sm:text-xs text-slate-400 truncate leading-tight">
            {{ stats.seriesWatching }} in corso
          </div>
        </div>
      </div>

      <!-- Film Visti -->
      <div
        class="surface-card flex flex-col justify-between cursor-pointer rounded-2xl p-3 sm:p-4 border transition hover:shadow-sm"
        :class="activeType === 'movie'
          ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30 dark:bg-amber-950/20'
          : 'border-slate-200/70 hover:border-amber-500/40 dark:border-slate-800'"
        title="Filtra per Film"
        @click="toggleTopFilter('movie')"
      >
        <div class="flex items-center justify-between gap-1 text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span class="truncate">Film Visti</span>
          <UIcon name="i-lucide-clapperboard" class="h-4 w-4 shrink-0 text-amber-500" />
        </div>
        <div class="mt-2">
          <div class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none">
            {{ stats.moviesWatched }}
          </div>
          <div class="mt-1 text-[10px] sm:text-xs text-slate-400 truncate leading-tight">
            {{ stats.moviesPlanned }} da vedere
          </div>
        </div>
      </div>

      <!-- Libri Letti -->
      <div
        class="surface-card flex flex-col justify-between cursor-pointer rounded-2xl p-3 sm:p-4 border transition hover:shadow-sm"
        :class="activeType === 'book'
          ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/20'
          : 'border-slate-200/70 hover:border-emerald-500/40 dark:border-slate-800'"
        title="Filtra per Libri"
        @click="toggleTopFilter('book')"
      >
        <div class="flex items-center justify-between gap-1 text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span class="truncate">Libri Letti</span>
          <UIcon name="i-lucide-book-open" class="h-4 w-4 shrink-0 text-emerald-500" />
        </div>
        <div class="mt-2">
          <div class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none">
            {{ stats.booksCompleted }}
          </div>
          <div class="mt-1 text-[10px] sm:text-xs text-slate-400 truncate leading-tight">
            {{ stats.booksReading }} in lettura
          </div>
        </div>
      </div>

      <!-- Totale Completati -->
      <div
        class="surface-card flex flex-col justify-between cursor-pointer rounded-2xl p-3 sm:p-4 border transition hover:shadow-sm"
        :class="activeType === 'all' && activeStatus === 'completed'
          ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/30 dark:bg-purple-950/20'
          : 'border-slate-200/70 hover:border-purple-500/40 dark:border-slate-800'"
        title="Filtra elementi completati"
        @click="toggleTopFilter('all')"
      >
        <div class="flex items-center justify-between gap-1 text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span class="truncate">Totale Completati</span>
          <UIcon name="i-lucide-check-circle-2" class="h-4 w-4 shrink-0 text-purple-500" />
        </div>
        <div class="mt-2">
          <div class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none">
            {{ stats.completedCount }}
          </div>
          <div class="mt-1 text-[10px] sm:text-xs text-slate-400 truncate leading-tight">
            su {{ stats.total }} totali
          </div>
        </div>
      </div>
    </div>

    <!-- Filters & Search -->
    <MediaFilters
      v-model:active-type="activeType"
      v-model:active-status="activeStatus"
      v-model:search-query="searchQuery"
      :view-mode="prefs.viewMode"
      :sort-by="prefs.sortBy"
      :counts="categoryCounts"
      @update:view-mode="update('viewMode', $event)"
      @update:sort-by="handleSortChange"
      @reorder="sortItems()"
    />

    <!-- Items Grid / List -->
    <div v-if="filteredItems.length > 0">
      <!-- Grid View -->
      <div v-if="prefs.viewMode === 'grid'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MediaCard
          v-for="item in filteredItems"
          :key="item.id"
          :item="item"
          @click="openDetail(item)"
          @increment="incrementProgress(item)"
          @decrement="decrementProgress(item)"
          @toggle-favorite="toggleFavorite(item)"
          @set-status="(it, st) => setStatus(it, st)"
        />
      </div>

      <!-- List View -->
      <div v-else class="space-y-2.5">
        <MediaRow
          v-for="item in filteredItems"
          :key="item.id"
          :item="item"
          @click="openDetail(item)"
          @increment="incrementProgress(item)"
          @decrement="decrementProgress(item)"
          @toggle-favorite="toggleFavorite(item)"
          @set-status="(it, st) => setStatus(it, st)"
        />
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="surface-card flex flex-col items-center justify-center rounded-3xl p-10 text-center border border-slate-200/80 dark:border-slate-800"
    >
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
        <UIcon name="i-lucide-bookmark-plus" class="h-8 w-8" />
      </div>

      <h3 class="mt-4 text-lg font-bold text-slate-900 dark:text-white">
        {{ items.length === 0 ? 'Nessun elemento ancora salvato' : 'Nessun risultato con i filtri attuali' }}
      </h3>

      <p class="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
        {{ items.length === 0
          ? 'Inizia ad aggiungere la serie che stai guardando o il libro che stai leggendo.'
          : 'Prova a modificare la ricerca o il filtro di categoria.' }}
      </p>

      <button
        type="button"
        class="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 dark:bg-indigo-500"
        @click="openQuickAdd(activeType !== 'all' ? activeType : 'series')"
      >
        <UIcon name="i-lucide-plus" class="h-4 w-4" />
        <span>Aggiungi Traccia</span>
      </button>
    </div>

    <!-- Detail / Edit Modal -->
    <LazyMediaDetailModal
      v-model:open="isDetailOpen"
      :item="selectedItem"
      @save="updateItem"
      @delete="deleteItem"
    />
  </div>
</template>
