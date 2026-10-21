<script setup lang="ts">
import { useOfflineSync } from '~/composables/useOfflineSync'

const { isOnline, isSyncing, pendingCount, syncNow } = useOfflineSync()
const isDismissed = ref(false)

// Reset dismissed state whenever offline status changes
watch(isOnline, () => {
  isDismissed.value = false
})

const shouldShow = computed(() => {
  if (isDismissed.value) return false
  return !isOnline.value || pendingCount.value > 0 || isSyncing.value
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="-translate-y-2 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="-translate-y-2 opacity-0"
  >
    <div
      v-if="shouldShow"
      class="border-b px-4 py-2.5 text-xs transition-colors"
      :class="!isOnline
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
        : isSyncing
          ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'"
      role="status"
    >
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <!-- Message & Status Icon -->
        <div class="flex items-center gap-2">
          <UIcon
            v-if="!isOnline"
            name="i-lucide-wifi-off"
            class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <UIcon
            v-else-if="isSyncing"
            name="i-lucide-refresh-cw"
            class="h-4 w-4 shrink-0 animate-spin text-indigo-600 dark:text-indigo-400"
          />
          <UIcon
            v-else
            name="i-lucide-cloud-upload"
            class="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          />

          <span class="font-medium">
            <template v-if="!isOnline">
              <strong>Modalità offline</strong> — Le modifiche vengono salvate nella memoria locale del dispositivo.
              <span v-if="pendingCount > 0" class="ml-1 font-semibold underline decoration-amber-500/50">
                ({{ pendingCount }} {{ pendingCount === 1 ? 'modifica in attesa' : 'modifiche in attesa' }})
              </span>
            </template>
            <template v-else-if="isSyncing">
              Sincronizzazione dati in corso con il cloud...
            </template>
            <template v-else-if="pendingCount > 0">
              Connessione ripristinata: <strong>{{ pendingCount }}</strong> {{ pendingCount === 1 ? 'modifica pronta' : 'modifiche pronte' }} per la sincronizzazione.
            </template>
          </span>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2 shrink-0">
          <button
            v-if="isOnline && pendingCount > 0 && !isSyncing"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500"
            @click="syncNow(true)"
          >
            <UIcon name="i-lucide-refresh-cw" class="h-3 w-3" />
            <span>Sincronizza ora</span>
          </button>

          <button
            type="button"
            class="rounded-lg p-1 text-slate-400 transition hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
            title="Chiudi avviso"
            @click="isDismissed = true"
          >
            <UIcon name="i-lucide-x" class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
