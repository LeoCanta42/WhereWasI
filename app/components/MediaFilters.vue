<script setup lang="ts">
import type { MediaStatus, MediaType } from '~/types'
import { MEDIA_TYPES } from '~/utils/media'

const props = defineProps<{
  activeType: MediaType | 'all'
  activeStatus: MediaStatus | 'all'
  searchQuery: string
  viewMode: 'grid' | 'list'
  counts: {
    total: number
    inProgress: number
    completed: number
    planned: number
  }
}>()

const emit = defineEmits<{
  (e: 'update:activeType', value: MediaType | 'all'): void
  (e: 'update:activeStatus', value: MediaStatus | 'all'): void
  (e: 'update:searchQuery', value: string): void
  (e: 'update:viewMode', value: 'grid' | 'list'): void
}>()

const typeTabs = computed(() => [
  { id: 'all', label: 'Tutti' },
  { id: 'series', label: 'Serie TV', icon: 'i-lucide-tv' },
  { id: 'book', label: 'Libri', icon: 'i-lucide-book-open' },
  { id: 'movie', label: 'Film', icon: 'i-lucide-clapperboard' },
  { id: 'game', label: 'Videogiochi', icon: 'i-lucide-gamepad-2' },
  { id: 'other', label: 'Altro', icon: 'i-lucide-bookmark' }
])

const statusTabs = computed(() => [
  { id: 'in_progress', label: `In Corso (${props.counts.inProgress})` },
  { id: 'planned', label: `Da Iniziare (${props.counts.planned})` },
  { id: 'completed', label: `Completati (${props.counts.completed})` },
  { id: 'all', label: `Tutti (${props.counts.total})` }
])
</script>

<template>
  <div class="space-y-4">
    <!-- Row 1: Search & View Toggle -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <!-- Search Input -->
      <div class="relative flex-1">
        <UIcon name="i-lucide-search" class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          :value="searchQuery"
          type="text"
          placeholder="Cerca per titolo o genere..."
          class="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-xs sm:text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          @click="emit('update:searchQuery', '')"
        >
          <UIcon name="i-lucide-x" class="h-4 w-4" />
        </button>
      </div>

      <!-- View Switcher (Grid / List) -->
      <div class="flex items-center gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/80 self-end sm:self-auto">
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-xl transition"
          :class="viewMode === 'grid'
            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
          title="Vista a Griglia"
          @click="emit('update:viewMode', 'grid')"
        >
          <UIcon name="i-lucide-layout-grid" class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-xl transition"
          :class="viewMode === 'list'
            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
          title="Vista a Elenco"
          @click="emit('update:viewMode', 'list')"
        >
          <UIcon name="i-lucide-list" class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Row 2: Media Type Pills (Horizontal Scroll) -->
    <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      <button
        v-for="tab in typeTabs"
        :key="tab.id"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition"
        :class="activeType === tab.id
          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25 dark:bg-indigo-500'
          : 'bg-white/80 text-slate-600 hover:bg-slate-100 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800'"
        @click="emit('update:activeType', tab.id as any)"
      >
        <UIcon v-if="tab.icon" :name="tab.icon" class="h-3.5 w-3.5" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- Row 3: Status Filter Pills -->
    <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      <button
        v-for="st in statusTabs"
        :key="st.id"
        type="button"
        class="rounded-lg px-3 py-1 text-xs font-bold whitespace-nowrap transition"
        :class="activeStatus === st.id
          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
          : 'bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:text-white'"
        @click="emit('update:activeStatus', st.id as any)"
      >
        {{ st.label }}
      </button>
    </div>
  </div>
</template>
