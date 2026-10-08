<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const { loading, loginWithEmail, signUpWithEmail } = useAuth()

type AuthMode = 'login' | 'signup'

const mode = ref<AuthMode>('login')
const email = ref('')
const username = ref('')
const displayName = ref('')
const password = ref('')
const confirmPassword = ref('')
const formError = ref('')

const isSignup = computed(() => mode.value === 'signup')

const modeOptions = [
  { id: 'login', label: 'Accedi' },
  { id: 'signup', label: 'Crea Account' }
]

function switchMode(next: AuthMode) {
  if (mode.value === next) return
  mode.value = next
  formError.value = ''
  password.value = ''
  confirmPassword.value = ''
}

function validate(): boolean {
  formError.value = ''
  const cleanEmail = email.value.trim()

  if (!cleanEmail) {
    formError.value = 'Inserisci il tuo indirizzo email.'
    return false
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    formError.value = 'Formato email non valido.'
    return false
  }
  if (password.value.length < 6) {
    formError.value = 'La password deve contenere almeno 6 caratteri.'
    return false
  }
  if (isSignup.value && password.value !== confirmPassword.value) {
    formError.value = 'Le due password non coincidono.'
    return false
  }
  return true
}

async function handleSubmit() {
  if (loading.value || !validate()) return

  const success = isSignup.value
    ? await signUpWithEmail(email.value, password.value, username.value, displayName.value)
    : await loginWithEmail(email.value, password.value)

  if (success) {
    password.value = ''
    confirmPassword.value = ''
  }
}
</script>

<template>
  <div class="flex items-center justify-center py-10 sm:py-16">
    <div class="w-full max-w-md">
      <!-- Brand & Welcome -->
      <div class="mb-8 text-center">
        <div class="mx-auto flex justify-center">
          <AppLogo size="xl" />
        </div>
        <h1 class="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          WhereWas<span class="text-indigo-600 dark:text-indigo-400">I?</span>
        </h1>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Tieni traccia di dove sei rimasto con serie TV, libri e film, e condividi i tuoi progressi con gli amici.
        </p>
      </div>

      <!-- Auth Card -->
      <div class="surface-card space-y-5 rounded-3xl p-6 sm:p-8">
        <SegmentedControl
          :model-value="mode"
          :options="modeOptions"
          aria-label="Accedi o registrati"
          size="md"
          class="w-full"
          @update:model-value="(val) => switchMode(val as AuthMode)"
        />

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div class="space-y-1.5">
            <label for="auth-email" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              id="auth-email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="tu@esempio.com"
              class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <template v-if="isSignup">
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label for="auth-username" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Username
                </label>
                <input
                  id="auth-username"
                  v-model="username"
                  type="text"
                  placeholder="mario_rossi"
                  class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div class="space-y-1.5">
                <label for="auth-name" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nome visualizzato
                </label>
                <input
                  id="auth-name"
                  v-model="displayName"
                  type="text"
                  placeholder="Mario"
                  class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>
          </template>

          <div class="space-y-1.5">
            <label for="auth-password" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Password
            </label>
            <input
              id="auth-password"
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div v-if="isSignup" class="space-y-1.5">
            <label for="auth-confirm" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Conferma Password
            </label>
            <input
              id="auth-confirm"
              v-model="confirmPassword"
              type="password"
              required
              autocomplete="new-password"
              placeholder="••••••••"
              class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div v-if="formError" class="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            {{ formError }}
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500/40 focus:outline-none disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            <UIcon v-if="loading" name="i-lucide-loader-2" class="h-4 w-4 animate-spin" />
            <span>{{ isSignup ? 'Registrati ora' : 'Accedi' }}</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
