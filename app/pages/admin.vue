<script setup lang="ts">
import { useAdmin } from '~/composables/useAdmin'
import { useProfile } from '~/composables/useProfile'
import { useConfirm } from '~/composables/useConfirm'
import { formatShortDate } from '~/utils/date'
import type { AdminUser } from '~/types'

definePageMeta({ middleware: 'admin' })

const {
  users,
  loading,
  loaded,
  busyId,
  pendingCount,
  loadUsers,
  setApproved,
  resetPassword,
  deleteUser,
  isSelf
} = useAdmin()

const { refreshProfile, isAdmin, loaded: profileLoaded } = useProfile()
const { ask } = useConfirm()
const toast = useToast()

watch([isAdmin, profileLoaded], ([admin, loaded]) => {
  if (loaded && !admin) {
    navigateTo('/')
  }
}, { immediate: true })

type Filter = 'all' | 'pending' | 'admins'

const filter = ref<Filter>('all')
const search = ref('')

const expandedId = ref<string | null>(null)
const draftPassword = ref('')
const revealPassword = ref(false)
const copied = ref(false)

onMounted(async () => {
  if (!loaded.value) {
    await loadUsers()
  }
})

const filterOptions = computed(() => [
  { id: 'all', label: 'Tutti', count: users.value.length },
  { id: 'pending', label: 'Da approvare', count: pendingCount.value },
  { id: 'admins', label: 'Amministratori', count: users.value.filter((u) => u.is_admin).length }
])

const visibleUsers = computed(() => {
  let list = users.value

  if (filter.value === 'pending') {
    list = list.filter((u) => !u.approved)
  } else if (filter.value === 'admins') {
    list = list.filter((u) => u.is_admin)
  }

  const query = search.value.trim().toLowerCase()
  if (query) {
    list = list.filter((u) =>
      (u.email ?? '').toLowerCase().includes(query) ||
      (u.username ?? '').toLowerCase().includes(query) ||
      (u.display_name ?? '').toLowerCase().includes(query)
    )
  }

  return list
})

function generateRandomPassword(length = 12): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*'
  let pass = ''
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pass
}

function togglePasswordPanel(user: AdminUser) {
  if (expandedId.value === user.id) {
    expandedId.value = null
    return
  }

  expandedId.value = user.id
  revealPassword.value = false
  copied.value = false
  draftPassword.value = generateRandomPassword()
}

function regenerate() {
  draftPassword.value = generateRandomPassword()
  revealPassword.value = true
}

async function copyPassword() {
  if (!import.meta.client || !draftPassword.value) return
  try {
    await navigator.clipboard.writeText(draftPassword.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1800)
  } catch (error) {
    console.error('Clipboard error:', error)
  }
}

async function applyPassword(user: AdminUser) {
  if (draftPassword.value.length < 6) {
    toast.add({
      title: 'Password non valida',
      description: 'Inserisci almeno 6 caratteri.',
      color: 'warning'
    })
    return
  }

  const confirmed = await ask({
    title: `Reimpostare la password di ${user.display_name || user.username || user.email}?`,
    description: 'La password attuale smetterà di funzionare. Comunica la nuova password all\'utente: non viene inviata alcuna email automatica.',
    confirmLabel: 'Reimposta Password',
    tone: 'danger',
    icon: 'i-lucide-key-round'
  })
  if (!confirmed) return

  const done = await resetPassword(user, draftPassword.value)
  if (done) {
    expandedId.value = null
    draftPassword.value = ''
  }
}

async function toggleApproved(user: AdminUser) {
  if (user.approved) {
    const confirmed = await ask({
      title: `Revocare l'accesso a ${user.display_name || user.username || user.email}?`,
      description: 'L\'utente non potrà più accedere alle proprie liste o interagire con gli amici finché non verrà riapprovato.',
      confirmLabel: 'Revoca Accesso',
      tone: 'danger',
      icon: 'i-lucide-user-x'
    })
    if (!confirmed) return
  }

  await setApproved(user, !user.approved)
}

async function removeUser(user: AdminUser) {
  if (isSelf(user)) {
    toast.add({
      title: 'Azione non consentita',
      description: 'Non puoi eliminare il tuo stesso account da questo pannello.',
      color: 'warning'
    })
    return
  }

  const confirmed = await ask({
    title: `Eliminare definitivamente ${user.display_name || user.username || user.email}?`,
    description: 'Tutti i dati dell\'utente (opere tracciate, amicizie, recensioni) verranno cancellati in modo irreversibile.',
    confirmLabel: 'Elimina Utente',
    tone: 'danger',
    icon: 'i-lucide-trash-2'
  })
  if (!confirmed) return

  await deleteUser(user)
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-black text-slate-900 dark:text-white">Pannello Amministratore</h1>
          <span class="rounded-lg bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
            Admin
          </span>
        </div>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Approva o revoca l'accesso agli utenti registrati, gestisci password e ruoli.
        </p>
      </div>

      <button
        type="button"
        :disabled="loading"
        class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        @click="loadUsers"
      >
        <UIcon v-if="loading" name="i-lucide-loader-2" class="h-4 w-4 animate-spin" />
        <UIcon v-else name="i-lucide-refresh-cw" class="h-4 w-4" />
        <span>Aggiorna Elenco</span>
      </button>
    </div>

    <!-- Filter & Search Controls -->
    <div class="surface-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl p-3 border dark:border-slate-800">
      <!-- Filter Tabs -->
      <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          v-for="opt in filterOptions"
          :key="opt.id"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition"
          :class="filter === opt.id
            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'"
          @click="filter = opt.id as Filter"
        >
          <span>{{ opt.label }}</span>
          <span
            class="rounded-full px-1.5 py-0.2 text-[10px]"
            :class="filter === opt.id
              ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'"
          >
            {{ opt.count }}
          </span>
        </button>
      </div>

      <!-- Search Input -->
      <div class="relative w-full sm:w-64">
        <UIcon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          v-model="search"
          type="text"
          placeholder="Cerca utente..."
          class="w-full rounded-xl border border-slate-200 bg-white/80 py-1.5 pl-9 pr-3 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        />
      </div>
    </div>

    <!-- Users Table / List -->
    <div class="surface-card overflow-hidden rounded-3xl border dark:border-slate-800 shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-600 dark:text-slate-400">
          <thead class="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <tr>
              <th scope="col" class="px-5 py-3.5">Utente</th>
              <th scope="col" class="px-4 py-3.5">Stato</th>
              <th scope="col" class="px-4 py-3.5">Tracce / Amici</th>
              <th scope="col" class="px-4 py-3.5">Data Reg.</th>
              <th scope="col" class="px-5 py-3.5 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80">
            <tr
              v-for="u in visibleUsers"
              :key="u.id"
              class="transition hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
            >
              <!-- User Info -->
              <td class="px-5 py-4">
                <div class="flex items-center gap-3">
                  <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-sm">
                    {{ (u.display_name || u.username || u.email || 'U').charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="truncate font-bold text-slate-900 dark:text-white">
                        {{ u.display_name || u.username || 'Senza nome' }}
                      </span>
                      <span
                        v-if="u.is_admin"
                        class="rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                      >
                        Admin
                      </span>
                      <span
                        v-if="isSelf(u)"
                        class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      >
                        Tu
                      </span>
                    </div>
                    <div class="truncate text-[11px] text-slate-400">
                      {{ u.email }} <span v-if="u.username">• @{{ u.username }}</span>
                    </div>
                  </div>
                </div>
              </td>

              <!-- Status -->
              <td class="px-4 py-4 whitespace-nowrap">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  :class="u.approved
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="u.approved ? 'bg-emerald-500' : 'bg-amber-500'" />
                  <span>{{ u.approved ? 'Approvato' : 'In attesa' }}</span>
                </span>
              </td>

              <!-- Counts -->
              <td class="px-4 py-4 whitespace-nowrap">
                <div class="flex items-center gap-3 text-xs">
                  <span title="Opere tracciate">📺 {{ u.media_count ?? 0 }}</span>
                  <span title="Amici collegati">👥 {{ u.friend_count ?? 0 }}</span>
                </div>
              </td>

              <!-- Registered Date -->
              <td class="px-4 py-4 whitespace-nowrap text-xs text-slate-400">
                {{ formatShortDate(u.created_at) }}
              </td>

              <!-- Actions -->
              <td class="px-5 py-4 text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-1.5">
                  <!-- Approve / Revoke Button -->
                  <button
                    type="button"
                    :disabled="busyId === u.id"
                    class="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition"
                    :class="u.approved
                      ? 'border border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/40'
                      : 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'"
                    @click="toggleApproved(u)"
                  >
                    <UIcon v-if="busyId === u.id" name="i-lucide-loader-2" class="h-3.5 w-3.5 animate-spin" />
                    <UIcon v-else :name="u.approved ? 'i-lucide-user-x' : 'i-lucide-check'" class="h-3.5 w-3.5" />
                    <span>{{ u.approved ? 'Revoca' : 'Approva' }}</span>
                  </button>

                  <!-- Password Reset Button -->
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                    title="Reimposta password"
                    @click="togglePasswordPanel(u)"
                  >
                    <UIcon name="i-lucide-key-round" class="h-4 w-4" />
                  </button>

                  <!-- Delete Button -->
                  <button
                    v-if="!isSelf(u)"
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                    title="Elimina utente"
                    @click="removeUser(u)"
                  >
                    <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty Users Notice -->
      <div v-if="visibleUsers.length === 0" class="p-8 text-center text-xs text-slate-400">
        Nessun utente trovato con i criteri selezionati.
      </div>
    </div>

    <!-- Password Reset Modal Panel -->
    <AppModal
      :open="expandedId !== null"
      title="Reimposta Password Utente"
      subtitle="Genera una nuova password da consegnare direttamente all'utente"
      icon="i-lucide-key-round"
      size="md"
      @update:open="expandedId = null"
    >
      <div v-if="expandedId" class="space-y-4 py-2">
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Nuova Password generata
          </label>
          <div class="flex items-center gap-2">
            <input
              v-model="draftPassword"
              :type="revealPassword ? 'text' : 'password'"
              class="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400"
              title="Mostra / Nascondi"
              @click="revealPassword = !revealPassword"
            >
              <UIcon :name="revealPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400"
              title="Rigenera"
              @click="regenerate"
            >
              <UIcon name="i-lucide-refresh-cw" class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"
              title="Copia negli appunti"
              @click="copyPassword"
            >
              <UIcon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" class="h-4 w-4" />
            </button>
          </div>
          <p v-if="copied" class="text-[11px] font-semibold text-emerald-600">
            Password copiata negli appunti!
          </p>
        </div>

        <div class="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Nota: Per motivi di sicurezza e assenza di email transazionali, consegna la password all'utente a voce o tramite messaggio privato.
        </div>
      </div>

      <template #footer>
        <div class="flex w-full items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300"
            @click="expandedId = null"
          >
            Annulla
          </button>
          <button
            type="button"
            class="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700"
            @click="users.find(u => u.id === expandedId) && applyPassword(users.find(u => u.id === expandedId)!)"
          >
            Applica Nuova Password
          </button>
        </div>
      </template>
    </AppModal>
  </div>
</template>
