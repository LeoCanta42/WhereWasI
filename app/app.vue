<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useMediaTracker } from '~/composables/useMediaTracker'
import { useFriends } from '~/composables/useFriends'
import { useProfile } from '~/composables/useProfile'
import { useAppearance } from '~/composables/useAppearance'
import { usePwa } from '~/composables/usePwa'
import { useQuickAdd } from '~/composables/useQuickAdd'
import { useOfflineSync } from '~/composables/useOfflineSync'
import { offlineStorage } from '~/utils/offlineStorage'
import { appleSplashLinks } from '~/utils/appleSplash'

useSeoMeta({
  title: 'WhereWasI? — Tracker Serie TV, Libri e Film con Amici',
  description: 'Tieni traccia di episodi, stagioni e pagine lette, e condividi i progressi con gli amici.',
  ogTitle: 'WhereWasI?',
  ogDescription: 'Tieni traccia di dove sei rimasto con serie TV, libri e film.',
  ogType: 'website'
})

const { user } = useAuth()
const { loadItems, items, addItem } = useMediaTracker()
const { loadFriends, friends, pendingIncoming } = useFriends()
const { status: approvalStatus, isApproved, isAdmin, loaded: profileLoaded, loadProfile, resetProfile } = useProfile()
const { needRefresh, offlineReady, updateApp } = usePwa()
const { openQuickAdd, isQuickAddOpen, quickAddInitialType } = useQuickAdd()
const { isOnline, isSyncing, pendingCount, processQueue } = useOfflineSync()
const route = useRoute()

// Route protection watcher (e.g. if user is on /admin and logs out or switches to non-admin)
watch([user, isAdmin, profileLoaded, () => route.path], ([currentUser, admin, loaded, path]) => {
  if (path === '/admin') {
    if (!currentUser || (loaded && !admin)) {
      navigateTo('/')
    }
  }
})

// Projects theme & accent onto <html>
useAppearance()

// iOS splash links
useHead({ link: appleSplashLinks as any })

const toast = useToast()
const isSettingsOpen = ref(false)

// PWA updates
watch(needRefresh, (val) => {
  if (!val) return
  toast.add({
    title: 'Nuova versione disponibile',
    description: 'Aggiorna per usare l\'ultima versione.',
    color: 'info',
    duration: 0,
    actions: [{ label: 'Aggiorna', color: 'primary', variant: 'soft', onClick: () => updateApp() }]
  })
})

watch(offlineReady, (val) => {
  if (!val) return
  toast.add({
    title: 'Pronta per l\'uso offline',
    description: 'L\'interfaccia è disponibile anche senza connessione.',
    color: 'neutral'
  })
})

onMounted(() => {
  if (isOnline.value) {
    processQueue()
  }
})

// Workspace data loader
watch(user, async (currentUser) => {
  if (!currentUser) {
    if (offlineStorage.isLoggedOut()) {
      items.value = []
      friends.value = []
      pendingIncoming.value = []
      resetProfile()
      isSettingsOpen.value = false
    }
    return
  }

  await loadProfile()

  if (isApproved.value) {
    await Promise.all([
      loadItems(),
      loadFriends()
    ])
  }
}, { immediate: true })
</script>

<template>
  <UApp>
    <div class="app-shell min-h-dvh text-slate-900 transition-colors dark:text-slate-100">
      <!-- Glow gradient layer -->
      <div class="app-glow" aria-hidden="true" />

      <ClientOnly>
        <!-- Navigation bar -->
        <AppNavbar
          :user="user"
          @open-settings="isSettingsOpen = true"
        />

        <!-- Offline / Sync banner -->
        <aside
          v-if="!isOnline"
          role="status"
          aria-live="polite"
          class="sticky top-16 z-20 flex items-center justify-center gap-2 border-b border-amber-300/40 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 transition-all dark:border-amber-900/40 dark:bg-amber-950/80 dark:text-amber-200"
        >
          <UIcon name="i-lucide-wifi-off" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Sei offline. Le modifiche vengono salvate sul dispositivo e sincronizzate appena torna la connessione.</span>
          <span
            v-if="pendingCount > 0"
            class="rounded-full bg-amber-200/70 px-2 py-0.5 text-[11px] font-bold dark:bg-amber-900/70"
          >
            {{ pendingCount }} in attesa
          </span>
        </aside>

        <aside
          v-else-if="isSyncing || pendingCount > 0"
          role="status"
          aria-live="polite"
          class="sticky top-16 z-20 flex items-center justify-center gap-2 border-b border-indigo-300/40 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-900 transition-all dark:border-indigo-900/40 dark:bg-indigo-950/80 dark:text-indigo-200"
        >
          <UIcon name="i-lucide-refresh-cw" class="h-4 w-4 shrink-0 animate-spin text-indigo-600 dark:text-indigo-400" />
          <span>{{ isSyncing ? 'Sincronizzazione modifiche in corso...' : `${pendingCount} modifiche in attesa di sincronizzazione...` }}</span>
        </aside>

        <!-- Main viewport -->
        <main :class="user && isApproved ? 'pb-safe-nav md:pb-8' : ''">
          <!-- Unauthenticated: Login / Sign up -->
          <div v-if="!user" class="mx-auto max-w-3xl px-4 sm:px-6">
            <AuthView />
          </div>

          <!-- Signed in but pending approval -->
          <div v-else-if="approvalStatus !== 'approved'" class="mx-auto max-w-3xl px-4 sm:px-6">
            <AccountStatus :status="approvalStatus" />
          </div>

          <!-- Authenticated and approved: Routed Pages -->
          <NuxtPage v-else />
        </main>

        <!-- Global Dialogs & Modals -->
        <LazyQuickAddModal
          v-if="user && isApproved"
          v-model:open="isQuickAddOpen"
          :initial-type="quickAddInitialType"
          @add="addItem"
        />
        <LazySettingsModal v-model:open="isSettingsOpen" />
        <AppConfirmDialog />

        <!-- Mobile Bottom Navigation Bar -->
        <MobileBottomNav
          v-if="user && isApproved"
          @open-settings="isSettingsOpen = true"
        />

        <template #fallback>
          <div class="flex min-h-dvh items-center justify-center">
            <UIcon name="i-lucide-loader-2" class="h-7 w-7 animate-spin text-indigo-400" />
          </div>
        </template>
      </ClientOnly>
    </div>
  </UApp>
</template>
