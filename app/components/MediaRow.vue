<script setup lang="ts">
import type { MediaItem } from '~/types'
import {
  calculateProgressPercentage,
  formatProgressDisplay,
  getMediaStatusInfo,
  getMediaTypeInfo
} from '~/utils/media'

const props = defineProps<{
  item: MediaItem
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', item: MediaItem): void
  (e: 'increment', item: MediaItem): void
  (e: 'decrement', item: MediaItem): void
  (e: 'toggle-favorite', item: MediaItem): void
  (e: 'set-status', item: MediaItem, status: any): void
}>()

const typeInfo = computed(() => getMediaTypeInfo(props.item.media_type))
const statusInfo = computed(() => getMediaStatusInfo(props.item.status))
const progressPct = computed(() => calculateProgressPercentage(props.item))
const progressText = computed(() => formatProgressDisplay(props.item, true))

import { usePreferences } from '~/composables/usePreferences'

const { prefs } = usePreferences()

const isSeries = computed(() => props.item.media_type === 'series')
const isBook = computed(() => props.item.media_type === 'book')
const isMovie = computed(() => props.item.media_type === 'movie' || props.item.progress_type === 'time')

const stepValue = computed(() => {
  if (isSeries.value) return prefs.value.seriesStep ?? 1
  if (isMovie.value) return prefs.value.movieStep ?? 10
  if (isBook.value) return prefs.value.bookStep ?? 10
  return 1
})

const incrementLabel = computed(() => {
  if (isSeries.value) return `${stepValue.value}`
  if (isMovie.value) return `${stepValue.value}m`
  if (isBook.value) return `${stepValue.value}`
  return `${stepValue.value}`
})

const incrementTitle = computed(() => {
  if (isSeries.value) return `+${stepValue.value} Episodio`
  if (isMovie.value) return `+${stepValue.value} Minuti`
  if (isBook.value) return `+${stepValue.value} Pagine`
  return `+${stepValue.value} Avanzamento`
})

const decrementTitle = computed(() => {
  if (isSeries.value) return `-${stepValue.value} Episodio`
  if (isMovie.value) return `-${stepValue.value} Minuti`
  if (isBook.value) return `-${stepValue.value} Pagine`
  return `-${stepValue.value} Avanzamento`
})
</script>

<template>
  <div
    class="surface-card flex items-center justify-between gap-3 rounded-2xl p-3 sm:p-4 transition hover:border-indigo-500/40 dark:hover:border-indigo-500/40"
    :class="item.is_favorite ? 'border-amber-400/40' : ''"
  >
    <!-- Left: Icon & Info -->
    <div class="flex min-w-0 flex-1 cursor-pointer items-center gap-3" @click="emit('click', item)">
      <div class="relative h-11 w-8 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <img
          v-if="item.cover_url"
          :src="item.cover_url"
          :alt="item.title"
          class="h-full w-full object-cover"
          loading="lazy"
        />
        <div v-else class="flex h-full w-full items-center justify-center bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
          <UIcon :name="typeInfo.icon" class="h-4 w-4" />
        </div>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3 class="truncate text-sm font-bold text-slate-900 dark:text-white">
            {{ item.title }}
          </h3>
          <UIcon v-if="item.is_favorite" name="i-lucide-star" class="h-3.5 w-3.5 flex-shrink-0 fill-amber-400 text-amber-400" />
          <UIcon v-if="item.is_private" name="i-lucide-lock" class="h-3 w-3 flex-shrink-0 text-slate-400" />
        </div>

        <div class="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span class="font-semibold text-indigo-600 dark:text-indigo-400">
            {{ progressText }}
          </span>
          <span v-if="item.creator" class="hidden sm:inline truncate max-w-[150px]">• {{ item.creator }}</span>
          <span v-else-if="item.genre" class="hidden sm:inline truncate max-w-[150px]">• {{ item.genre }}</span>
        </div>
      </div>
    </div>

    <!-- Right: Progress Bar & Actions -->
    <div class="flex items-center gap-3" @click.stop>
      <!-- Progress Bar (hidden on small mobile) -->
      <div class="hidden sm:flex flex-col items-end gap-1 w-28">
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="item.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-600'"
            :style="{ width: `${progressPct}%` }"
          />
        </div>
        <span class="text-[10px] font-bold text-slate-400">{{ progressPct }}%</span>
      </div>

      <!-- Quick increment buttons -->
      <div v-if="!readonly" class="flex items-center gap-1">
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          :title="decrementTitle"
          @click="emit('decrement', item)"
        >
          <UIcon name="i-lucide-minus" class="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          class="inline-flex h-8 items-center gap-1 rounded-xl bg-indigo-50 px-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
          :title="incrementTitle"
          @click="emit('increment', item)"
        >
          <UIcon name="i-lucide-plus" class="h-3.5 w-3.5" />
          <span>{{ incrementLabel }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
