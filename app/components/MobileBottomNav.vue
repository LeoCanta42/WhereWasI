<script setup lang="ts">
import { useProfile } from '~/composables/useProfile'
import { useFriends } from '~/composables/useFriends'
import { useQuickAdd } from '~/composables/useQuickAdd'

const emit = defineEmits<{
  (e: 'open-settings'): void
}>()

const route = useRoute()
const { profile } = useProfile()
const { pendingIncoming } = useFriends()
const { openQuickAdd } = useQuickAdd()

const incomingCount = computed(() => pendingIncoming.value.length)
</script>

<template>
  <nav
    class="fixed bottom-0 inset-x-0 z-30 block md:hidden border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] shadow-lg dark:border-slate-800/80 dark:bg-slate-950/95"
  >
    <div class="flex h-14 items-center justify-around px-2">
      <!-- Lists -->
      <NuxtLink
        to="/"
        class="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-bold transition"
        :class="route.path === '/'
          ? 'text-indigo-600 dark:text-indigo-400'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
      >
        <UIcon name="i-lucide-layout-grid" class="h-5 w-5" />
        <span>Liste</span>
      </NuxtLink>

      <!-- Friends -->
      <NuxtLink
        to="/friends"
        class="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-bold transition"
        :class="route.path.startsWith('/friend')
          ? 'text-indigo-600 dark:text-indigo-400'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
      >
        <div class="relative">
          <UIcon name="i-lucide-users" class="h-5 w-5" />
          <span
            v-if="incomingCount > 0"
            class="absolute -top-1 -right-2.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white"
          >
            {{ incomingCount }}
          </span>
        </div>
        <span>Amici</span>
      </NuxtLink>

      <!-- Quick Add Center Button -->
      <div class="flex flex-1 items-center justify-center">
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transition active:scale-95 dark:bg-indigo-500"
          aria-label="Aggiungi da tracciare"
          @click="openQuickAdd()"
        >
          <UIcon name="i-lucide-plus" class="h-5 w-5" />
        </button>
      </div>

      <!-- Admin (if admin) -->
      <NuxtLink
        v-if="profile?.is_admin"
        to="/admin"
        class="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-bold transition"
        :class="route.path === '/admin'
          ? 'text-purple-600 dark:text-purple-400'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
      >
        <UIcon name="i-lucide-shield" class="h-5 w-5" />
        <span>Admin</span>
      </NuxtLink>

      <!-- Settings -->
      <button
        type="button"
        class="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 transition dark:text-slate-400 dark:hover:text-white"
        @click="emit('open-settings')"
      >
        <UIcon name="i-lucide-settings" class="h-5 w-5" />
        <span>Opzioni</span>
      </button>
    </div>
  </nav>
</template>
