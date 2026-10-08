<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useProfile } from '~/composables/useProfile'
import { useAppearance } from '~/composables/useAppearance'
import { useFriends } from '~/composables/useFriends'
import { useQuickAdd } from '~/composables/useQuickAdd'

const props = defineProps<{
  user: any
}>()

const emit = defineEmits<{
  (e: 'open-settings'): void
  (e: 'open-friends'): void
}>()

const route = useRoute()
const { logout } = useAuth()
const { profile } = useProfile()
const { theme, setTheme, isDark } = useAppearance()
const { pendingIncoming, friends } = useFriends()
const { openQuickAdd } = useQuickAdd()

const incomingCount = computed(() => pendingIncoming.value.length)

const displayName = computed(() => {
  if (profile.value?.display_name) return profile.value.display_name
  if (profile.value?.username) return `@${profile.value.username}`
  return props.user?.email?.split('@')[0] ?? 'Profilo'
})

const avatarInitial = computed(() => {
  const name = displayName.value
  return name.charAt(0).toUpperCase()
})
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
      <!-- Logo & Brand -->
      <NuxtLink to="/" class="group transition hover:opacity-90">
        <AppLogo size="md" with-text />
      </NuxtLink>

      <!-- Navigation links (when authenticated) -->
      <nav v-if="user" class="hidden md:flex items-center gap-1 rounded-2xl bg-slate-100/80 p-1 dark:bg-slate-900/80">
        <NuxtLink
          to="/"
          class="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition"
          :class="route.path === '/'
            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
        >
          <UIcon name="i-lucide-layout-grid" class="h-4 w-4" />
          <span>Le mie Liste</span>
        </NuxtLink>

        <NuxtLink
          to="/friends"
          class="relative flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition"
          :class="route.path.startsWith('/friend')
            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
        >
          <UIcon name="i-lucide-users" class="h-4 w-4" />
          <span>Amici & Attività</span>
          <span
            v-if="incomingCount > 0"
            class="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm"
          >
            {{ incomingCount }}
          </span>
        </NuxtLink>

        <NuxtLink
          v-if="profile?.is_admin"
          to="/admin"
          class="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition"
          :class="route.path === '/admin'
            ? 'bg-purple-600 text-white shadow-sm'
            : 'text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/50'"
        >
          <UIcon name="i-lucide-shield" class="h-4 w-4" />
          <span>Admin</span>
        </NuxtLink>
      </nav>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        <!-- Quick Add Button -->
        <button
          v-if="user"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          @click="openQuickAdd()"
        >
          <UIcon name="i-lucide-plus" class="h-4 w-4" />
          <span class="hidden sm:inline">Traccia</span>
        </button>

        <!-- Theme Toggle -->
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          :aria-label="isDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'"
          @click="setTheme(isDark ? 'light' : 'dark')"
        >
          <UIcon :name="isDark ? 'i-lucide-sun' : 'i-lucide-moon'" class="h-4.5 w-4.5" />
        </button>

        <!-- User Menu (Settings / Logout) -->
        <div v-if="user" class="flex items-center gap-1">
          <button
            type="button"
            class="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 p-1 pr-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            @click="emit('open-settings')"
          >
            <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {{ avatarInitial }}
            </div>
            <span class="max-w-[100px] truncate hidden sm:inline">{{ displayName }}</span>
            <UIcon name="i-lucide-settings" class="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
