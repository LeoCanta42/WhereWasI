<script setup lang="ts">
import type { MediaItem, MediaStatus, MediaType } from '~/types'
import { useMediaTracker } from '~/composables/useMediaTracker'
import { usePreferences } from '~/composables/usePreferences'
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
  setStatus
} = useMediaTracker()

const { prefs, update } = usePreferences()
const { openQuickAdd } = useQuickAdd()

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
      (i.tags && i.tags.some((t) => t.toLowerCase().includes(q)))
    )
  }

  return list
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">
    <!-- Top Stats Overview Bar -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="surface-card rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800">
        <div class="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>Serie in corso</span>
          <UIcon name="i-lucide-tv" class="h-4 w-4 text-indigo-500" />
        </div>
        <div class="mt-2 flex items-baseline gap-2">
          <span class="text-2xl font-black text-slate-900 dark:text-white">{{ stats.seriesWatching }}</span>
          <span class="text-xs text-slate-400">{{ stats.seriesCompleted }} completate</span>
        </div>
      </div>

      <div class="surface-card rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800">
        <div class="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>Libri in lettura</span>
          <UIcon name="i-lucide-book-open" class="h-4 w-4 text-emerald-500" />
        </div>
        <div class="mt-2 flex items-baseline gap-2">
          <span class="text-2xl font-black text-slate-900 dark:text-white">{{ stats.booksReading }}</span>
          <span class="text-xs text-slate-400">{{ stats.booksCompleted }} letti</span>
        </div>
      </div>

      <div class="surface-card rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800">
        <div class="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>Episodi Visti</span>
          <UIcon name="i-lucide-play" class="h-4 w-4 text-amber-500" />
        </div>
        <div class="mt-2 flex items-baseline gap-2">
          <span class="text-2xl font-black text-slate-900 dark:text-white">{{ stats.totalEpisodes }}</span>
          <span class="text-xs text-slate-400">totali</span>
        </div>
      </div>

      <div class="surface-card rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800">
        <div class="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>Pagine Lette</span>
          <UIcon name="i-lucide-book-marked" class="h-4 w-4 text-purple-500" />
        </div>
        <div class="mt-2 flex items-baseline gap-2">
          <span class="text-2xl font-black text-slate-900 dark:text-white">{{ stats.totalPages }}</span>
          <span class="text-xs text-slate-400">pagine</span>
        </div>
      </div>
    </div>

    <!-- Filters & Search -->
    <MediaFilters
      v-model:active-type="activeType"
      v-model:active-status="activeStatus"
      v-model:search-query="searchQuery"
      :view-mode="prefs.viewMode"
      :counts="{
        total: items.length,
        inProgress: stats.inProgressCount,
        completed: stats.completedCount,
        planned: stats.plannedCount
      }"
      @update:view-mode="update('viewMode', $event)"
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
