<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useMediaTracker } from '~/composables/useMediaTracker'
import { useFriends } from '~/composables/useFriends'
import { useProfile } from '~/composables/useProfile'
import { useAppearance } from '~/composables/useAppearance'
import { usePwa } from '~/composables/usePwa'
import { useQuickAdd } from '~/composables/useQuickAdd'
import { appleSplashLinks } from '~/utils/appleSplash'

useSeoMeta({
  title: 'WhereWasI? — Tracker Serie TV, Libri e Film con Amici',
  description: 'Tieni traccia di episodi, stagioni e pagine lette, e condividi i progressi con gli amici.',
  ogTitle: 'WhereWasI?',
  ogDescription: 'Tieni traccia di dove sei rimasto con serie TV, libri e film.',
  ogType: 'website'
})

const { user } = useAuth()
const { loadItems, items } = useMediaTracker()
const { loadFriends, friends, pendingIncoming } = useFriends()
const { status: approvalStatus, isApproved, loadProfile, resetProfile } = useProfile()
const { needRefresh, offlineReady, updateApp } = usePwa()
const { openQuickAdd } = useQuickAdd()

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

// Workspace data loader
watch(user, async (currentUser) => {
  if (!currentUser) {
    items.value = []
    friends.value = []
    pendingIncoming.value = []
    resetProfile()
    isSettingsOpen.value = false
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

      <!-- Navigation bar -->
      <AppNavbar
        :user="user"
        @open-settings="isSettingsOpen = true"
      />

      <!-- Main viewport -->
      <main>
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
      <LazySettingsModal v-model:open="isSettingsOpen" />
      <AppConfirmDialog />

      <!-- Mobile Floating Action Button -->
      <AppFab v-if="user && isApproved" @activate="openQuickAdd()" />
    </div>
  </UApp>
</template>
