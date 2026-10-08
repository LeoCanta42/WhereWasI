<script setup lang="ts">
import { ACCENTS, usePreferences } from '~/composables/usePreferences'
import { useAppearance } from '~/composables/useAppearance'
import { useProfile } from '~/composables/useProfile'
import { useAuth } from '~/composables/useAuth'
import { usePwa } from '~/composables/usePwa'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const { prefs, update } = usePreferences()
const { theme, setTheme, setAccent } = useAppearance()
const { profile, updateProfile } = useProfile()
const { changePassword, logout } = useAuth()
const { canInstall, isInstalled, install, needRefresh, updateApp, manualInstallHint, offlineReady } = usePwa()

const displayName = ref('')
const username = ref('')
const bio = ref('')
const currentPass = ref('')
const newPass = ref('')
const isSavingProfile = ref(false)
const isChangingPass = ref(false)

watch(() => props.open, (isOpen) => {
  if (isOpen && profile.value) {
    displayName.value = profile.value.display_name || ''
    username.value = profile.value.username || ''
    bio.value = profile.value.bio || ''
    currentPass.value = ''
    newPass.value = ''
  }
})

async function handleSaveProfile() {
  if (isSavingProfile.value) return
  isSavingProfile.value = true
  await updateProfile({
    display_name: displayName.value.trim(),
    username: username.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
    bio: bio.value.trim()
  })
  isSavingProfile.value = false
}

async function handleChangePassword() {
  if (isChangingPass.value || !currentPass.value || !newPass.value) return
  isChangingPass.value = true
  const success = await changePassword(currentPass.value, newPass.value)
  isChangingPass.value = false
  if (success) {
    currentPass.value = ''
    newPass.value = ''
  }
}
</script>

<template>
  <AppModal
    :open="open"
    title="Impostazioni"
    subtitle="Personalizza aspetto, tema e profilo"
    icon="i-lucide-settings"
    size="md"
    @update:open="emit('update:open', $event)"
  >
    <div class="space-y-6 py-2">
      <!-- Theme & Accent Section -->
      <div class="space-y-3">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Aspetto</h3>

        <div class="space-y-2">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Tema</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="t in ['light', 'dark', 'system'] as const"
              :key="t"
              type="button"
              class="flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold capitalize transition"
              :class="theme === t
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-300'
                : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'"
              @click="setTheme(t)"
            >
              <UIcon :name="t === 'light' ? 'i-lucide-sun' : t === 'dark' ? 'i-lucide-moon' : 'i-lucide-laptop'" class="h-3.5 w-3.5" />
              <span>{{ t === 'system' ? 'Sistema' : t === 'dark' ? 'Scuro' : 'Chiaro' }}</span>
            </button>
          </div>
        </div>

        <!-- Accent Colors -->
        <div class="space-y-2 pt-1">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Colore Principale</label>
          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="acc in ACCENTS"
              :key="acc.id"
              type="button"
              class="flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-bold transition"
              :class="prefs.accent === acc.id
                ? 'border-indigo-600 bg-slate-100 dark:border-indigo-400 dark:bg-slate-800 ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-slate-600 dark:text-slate-400'"
              @click="setAccent(acc.id)"
            >
              <span class="h-4 w-4 rounded-full" :style="{ backgroundColor: acc.swatch }" />
              <span class="truncate max-w-[50px]">{{ acc.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Profile Edit Section -->
      <div class="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Il tuo Profilo</h3>

        <form class="space-y-3" @submit.prevent="handleSaveProfile">
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Nome</label>
              <input
                v-model="displayName"
                type="text"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Username</label>
              <input
                v-model="username"
                type="text"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Biografia</label>
            <textarea
              v-model="bio"
              rows="2"
              placeholder="Cosa ti piace guardare o leggere..."
              class="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            :disabled="isSavingProfile"
            class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {{ isSavingProfile ? 'Salvataggio...' : 'Salva Profilo' }}
          </button>
        </form>
      </div>

      <!-- Password Change Section -->
      <div class="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Sicurezza</h3>

        <form class="space-y-2" @submit.prevent="handleChangePassword">
          <input
            v-model="currentPass"
            type="password"
            placeholder="Password attuale"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
          <input
            v-model="newPass"
            type="password"
            placeholder="Nuova password (min 6 caratteri)"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
          <button
            type="submit"
            :disabled="!currentPass || !newPass || isChangingPass"
            class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {{ isChangingPass ? 'Aggiornamento...' : 'Cambia Password' }}
          </button>
        </form>
      </div>

      <!-- PWA & Mobile App Section -->
      <div class="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Applicazione & Mobile</h3>
          <span
            v-if="isInstalled"
            class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
          >
            <UIcon name="i-lucide-check-circle" class="h-3 w-3" />
            Installata
          </span>
          <span
            v-else-if="offlineReady"
            class="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
          >
            <UIcon name="i-lucide-wifi-off" class="h-3 w-3" />
            Offline Ready
          </span>
        </div>

        <div class="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 space-y-2.5 dark:border-slate-800 dark:bg-slate-900/60">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <UIcon name="i-lucide-smartphone" class="h-4.5 w-4.5" />
              </div>
              <div>
                <p class="text-xs font-bold text-slate-900 dark:text-white">PWA Mobile & Desktop</p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">
                  {{ isInstalled ? 'Stai usando l\'app installata.' : 'Installa WhereWasI sulla schermata Home.' }}
                </p>
              </div>
            </div>

            <!-- Install Button -->
            <button
              v-if="canInstall && !isInstalled"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500"
              @click="install"
            >
              <UIcon name="i-lucide-download" class="h-3.5 w-3.5" />
              <span>Installa</span>
            </button>
          </div>

          <!-- Manual Hint for iOS Safari or browsers without prompt -->
          <div
            v-if="!isInstalled && !canInstall && manualInstallHint"
            class="rounded-xl bg-white p-2.5 text-[11px] font-medium text-slate-600 border border-slate-200/60 dark:bg-slate-850 dark:border-slate-800 dark:text-slate-300"
          >
            <div class="flex items-start gap-1.5">
              <UIcon name="i-lucide-info" class="h-3.5 w-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <span>{{ manualInstallHint }}</span>
            </div>
          </div>

          <!-- Update Check Button -->
          <div v-if="needRefresh" class="flex items-center justify-between border-t border-slate-200/60 pt-2 dark:border-slate-800">
            <span class="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Aggiornamento disponibile!</span>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-amber-600"
              @click="updateApp"
            >
              <UIcon name="i-lucide-refresh-cw" class="h-3 w-3" />
              <span>Aggiorna ora</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Logout & Info -->
      <div class="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-400 dark:hover:bg-rose-900/50"
          @click="logout(); emit('update:open', false)"
        >
          <UIcon name="i-lucide-log-out" class="h-4 w-4" />
          <span>Disconnetti account</span>
        </button>

        <div class="flex items-center justify-between pt-2 px-1">
          <AppLogo size="xs" with-text />
          <span class="text-[10px] text-slate-400 font-mono">v1.0.0</span>
        </div>
      </div>
    </div>
  </AppModal>
</template>
