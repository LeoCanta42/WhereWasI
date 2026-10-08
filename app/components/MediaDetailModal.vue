<script setup lang="ts">
import type { MediaItem, MediaStatus, MediaType, ProgressType } from '~/types'
import { MEDIA_STATUSES, MEDIA_TYPES, calculateProgressPercentage, formatProgressDisplay } from '~/utils/media'
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

const form = ref<Partial<MediaItem>>({})

watch(() => props.item, (newItem) => {
  if (newItem) {
    form.value = JSON.parse(JSON.stringify(newItem))
  } else {
    form.value = {}
  }
}, { immediate: true })

const currentType = computed(() => form.value.media_type ?? 'series')
const isSeries = computed(() => currentType.value === 'series' || currentType.value === 'anime')
const isBook = computed(() => currentType.value === 'book' || currentType.value === 'manga')

async function handleSave() {
  if (!props.item) return

  // Auto calculate completion if at total
  if (form.value.total_episodes && (form.value.episode ?? 0) >= form.value.total_episodes && form.value.status === 'in_progress') {
    form.value.status = 'completed'
  }
  if (form.value.total_pages && (form.value.current_page ?? 0) >= form.value.total_pages && form.value.status === 'in_progress') {
    form.value.status = 'completed'
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

      <!-- Title & Type -->
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

        <!-- Series Progress (Season & Episode) -->
        <div v-if="isSeries" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Totale Episodi</label>
            <input
              v-model.number="form.total_episodes"
              :disabled="readonly"
              type="number"
              min="1"
              placeholder="es. 10"
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
