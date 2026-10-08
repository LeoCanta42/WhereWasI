<script setup lang="ts">
import type { ApprovalStatus } from '~/types'
import { useProfile } from '~/composables/useProfile'
import { useAuth } from '~/composables/useAuth'

const props = defineProps<{ status: ApprovalStatus }>()

const { refreshProfile, loading } = useProfile()
const { logout } = useAuth()
const toast = useToast()

async function recheck() {
  await refreshProfile()

  if (props.status === 'pending') {
    toast.add({
      title: 'Approvazione in sospeso',
      description: 'Un amministratore deve ancora abilitare il tuo account.',
      color: 'info'
    })
  }
}
</script>

<template>
  <div class="flex items-center justify-center py-10 sm:py-20">
    <!-- Checking status -->
    <div v-if="status === 'unknown'" class="w-full max-w-sm space-y-3" aria-busy="true" aria-live="polite">
      <div class="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      <div class="mx-auto h-3.5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div class="mx-auto h-3 w-56 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
      <p class="sr-only">Verifica dell'accesso in corso...</p>
    </div>

    <!-- Pending approval -->
    <div v-else class="w-full max-w-md">
      <div class="surface-card space-y-5 rounded-3xl p-6 text-center sm:p-8">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 shadow-md">
          <UIcon name="i-lucide-hourglass" class="h-7 w-7" />
        </div>

        <div class="space-y-1.5">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">
            Account in attesa di approvazione
          </h2>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            La registrazione è andata a buon fine. Un amministratore deve abilitare il tuo account prima che tu possa tracciare serie, libri e interagire con gli amici.
          </p>
        </div>

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center pt-2">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
            @click="logout"
          >
            <UIcon name="i-lucide-log-out" class="h-4 w-4" />
            <span>Disconnetti</span>
          </button>
          <button
            type="button"
            :disabled="loading"
            class="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500"
            @click="recheck"
          >
            <UIcon v-if="loading" name="i-lucide-loader-2" class="h-4 w-4 animate-spin" />
            <UIcon v-else name="i-lucide-refresh-cw" class="h-4 w-4" />
            <span>Verifica Stato</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
