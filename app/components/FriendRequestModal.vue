<script setup lang="ts">
import { useFriends } from '~/composables/useFriends'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const {
  pendingIncoming,
  pendingOutgoing,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  loading
} = useFriends()

const identifier = ref('')
const isSending = ref(false)

async function handleSend() {
  if (!identifier.value.trim() || isSending.value) return

  isSending.value = true
  const success = await sendFriendRequest(identifier.value)
  isSending.value = false

  if (success) {
    identifier.value = ''
  }
}
</script>

<template>
  <AppModal
    :open="open"
    title="Aggiungi Amici"
    subtitle="Connettiti con gli amici per vedere cosa stanno guardando e leggendo"
    icon="i-lucide-user-plus"
    size="md"
    @update:open="emit('update:open', $event)"
  >
    <div class="space-y-6 py-2">
      <!-- Send Request Input -->
      <form class="space-y-2" @submit.prevent="handleSend">
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Cerca per Username o Email
        </label>
        <div class="flex items-center gap-2">
          <input
            v-model="identifier"
            type="text"
            required
            placeholder="es. mario_rossi o amico@email.com"
            class="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
          <button
            type="submit"
            :disabled="!identifier.trim() || isSending"
            class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            <UIcon v-if="isSending" name="i-lucide-loader-2" class="h-4 w-4 animate-spin" />
            <UIcon v-else name="i-lucide-send" class="h-4 w-4" />
            <span>Invia</span>
          </button>
        </div>
      </form>

      <!-- Incoming Requests Section -->
      <div v-if="pendingIncoming.length > 0" class="space-y-3">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">
          Richieste Ricevute ({{ pendingIncoming.length }})
        </h3>
        <div class="space-y-2">
          <div
            v-for="req in pendingIncoming"
            :key="req.friendship_id"
            class="flex items-center justify-between rounded-2xl bg-slate-50 p-3 dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-slate-900 dark:text-white">
                {{ req.display_name || req.username || req.email }}
              </p>
              <p v-if="req.username" class="text-xs text-slate-400">
                @{{ req.username }}
              </p>
            </div>

            <div class="flex items-center gap-1.5 ml-2">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                @click="acceptFriendRequest(req.friendship_id)"
              >
                <UIcon name="i-lucide-check" class="h-3.5 w-3.5" />
                <span>Accetta</span>
              </button>
              <button
                type="button"
                class="rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:border-slate-800 dark:hover:bg-slate-800"
                title="Rifiuta"
                @click="declineFriendRequest(req.friendship_id)"
              >
                <UIcon name="i-lucide-x" class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Outgoing Requests Section -->
      <div v-if="pendingOutgoing.length > 0" class="space-y-3">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">
          Richieste Inviate in Attesa ({{ pendingOutgoing.length }})
        </h3>
        <div class="space-y-2">
          <div
            v-for="req in pendingOutgoing"
            :key="req.friendship_id"
            class="flex items-center justify-between rounded-2xl bg-slate-50/60 p-3 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                {{ req.display_name || req.username || req.email }}
              </p>
              <span class="text-[11px] font-medium text-amber-500">In attesa di conferma...</span>
            </div>

            <button
              type="button"
              class="rounded-xl border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-800"
              @click="declineFriendRequest(req.friendship_id)"
            >
              Annulla
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppModal>
</template>
