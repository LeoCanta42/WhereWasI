<script setup lang="ts">
import type { MediaItem } from '~/types'
import {
  calculateProgressPercentage,
  formatProgressDisplay,
  getMediaGradient,
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
const progressText = computed(() => formatProgressDisplay(props.item))
const shortProgressText = computed(() => formatProgressDisplay(props.item, true))
const gradientClass = computed(() => getMediaGradient(props.item.media_type, props.item.id))

const isSeriesOrAnime = computed(() => props.item.media_type === 'series' || props.item.media_type === 'anime')
const isBookOrManga = computed(() => props.item.media_type === 'book' || props.item.media_type === 'manga')
</script>

<template>
  <div
    class="group surface-card relative flex flex-col justify-between overflow-hidden rounded-3xl border transition duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800/80"
    :class="item.is_favorite ? 'ring-1 ring-amber-400/40' : ''"
  >
    <!-- Top banner / Cover Art -->
    <div
      class="relative h-28 w-full cursor-pointer overflow-hidden bg-gradient-to-r p-4 transition duration-300"
      :class="gradientClass"
      @click="emit('click', item)"
    >
      <!-- Cover image overlay if exists -->
      <img
        v-if="item.cover_url"
        :src="item.cover_url"
        :alt="item.title"
        class="absolute inset-0 h-full w-full object-cover opacity-40 transition duration-300 group-hover:scale-105"
      />

      <div class="relative z-10 flex items-start justify-between">
        <!-- Media Type Tag -->
        <span class="inline-flex items-center gap-1 rounded-lg bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white">
          <UIcon :name="typeInfo.icon" class="h-3.5 w-3.5" />
          <span>{{ typeInfo.label }}</span>
        </span>

        <!-- Badges on right: Privacy & Favorite -->
        <div class="flex items-center gap-1.5">
          <span
            v-if="item.is_private"
            class="flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-slate-200"
            title="Elemento privato (visibile solo a te)"
          >
            <UIcon name="i-lucide-lock" class="h-3.5 w-3.5" />
          </span>

          <button
            v-if="!readonly"
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg transition active:scale-95"
            :class="item.is_favorite ? 'bg-amber-400 text-amber-950 shadow-sm' : 'bg-black/50 text-white/90 hover:text-white hover:bg-black/60'"
            :title="item.is_favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'"
            @click.stop="emit('toggle-favorite', item)"
          >
            <UIcon :name="item.is_favorite ? 'i-lucide-star' : 'i-lucide-star'" class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <!-- Quick status badge on bottom-right of header -->
      <div class="absolute bottom-2.5 right-3 z-10">
        <span
          class="rounded-md px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
          :class="{
            'bg-indigo-600': item.status === 'in_progress',
            'bg-emerald-600': item.status === 'completed',
            'bg-slate-700': item.status === 'planned',
            'bg-amber-600': item.status === 'on_hold',
            'bg-rose-700': item.status === 'dropped'
          }"
        >
          {{ statusInfo.label }}
        </span>
      </div>
    </div>

    <!-- Main Content Body -->
    <div class="flex flex-1 flex-col justify-between p-4 sm:p-5" @click="emit('click', item)">
      <div class="cursor-pointer">
        <h3 class="line-clamp-1 text-base font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
          {{ item.title }}
        </h3>
        
        <p v-if="item.genre" class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {{ item.genre }}
        </p>

        <!-- Current Progress Display -->
        <div class="mt-3.5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Progresso:</span>
            <span class="text-sm font-extrabold text-slate-900 dark:text-white">
              {{ shortProgressText }}
            </span>
          </div>
          <span v-if="progressPct > 0" class="text-xs font-bold text-indigo-600 dark:text-indigo-400">
            {{ progressPct }}%
          </span>
        </div>

        <!-- Progress Bar -->
        <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="item.status === 'completed' ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'"
            :style="{ width: `${progressPct}%` }"
          />
        </div>

        <!-- Rating or Note Preview -->
        <div v-if="item.rating" class="mt-3 flex items-center gap-1 text-amber-500">
          <UIcon name="i-lucide-star" class="h-3.5 w-3.5 fill-current" />
          <span class="text-xs font-bold text-slate-700 dark:text-slate-300">{{ item.rating }}/10</span>
        </div>
      </div>

      <!-- Quick Action Controls (when not readonly) -->
      <div v-if="!readonly" class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800/80" @click.stop>
        <div class="flex items-center gap-1.5">
          <!-- Decrement -->
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            title="Diminuisci progresso (-1)"
            @click="emit('decrement', item)"
          >
            <UIcon name="i-lucide-minus" class="h-3.5 w-3.5" />
          </button>

          <!-- Increment +1 / +10 -->
          <button
            type="button"
            class="inline-flex h-8 items-center gap-1 rounded-xl bg-indigo-50 px-2.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 active:scale-95 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
            :title="isSeriesOrAnime ? '+1 Episodio' : isBookOrManga ? '+10 Pagine' : '+1 Avanzamento'"
            @click="emit('increment', item)"
          >
            <UIcon name="i-lucide-plus" class="h-3.5 w-3.5" />
            <span>{{ isSeriesOrAnime ? '+1 Ep' : isBookOrManga ? '+10 Pag' : '+1' }}</span>
          </button>
        </div>

        <!-- Mark Completed Quick Button -->
        <button
          v-if="item.status !== 'completed'"
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-400"
          title="Segna come completato"
          @click="emit('set-status', item, 'completed')"
        >
          <UIcon name="i-lucide-check-circle" class="h-4 w-4" />
        </button>

        <span v-else class="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <UIcon name="i-lucide-check" class="h-3.5 w-3.5" />
          Finito
        </span>
      </div>
    </div>
  </div>
</template>
