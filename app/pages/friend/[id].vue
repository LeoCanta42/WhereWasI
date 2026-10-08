<script setup lang="ts">
import type { MediaItem, MediaType, Profile } from '~/types'
import { useFriends } from '~/composables/useFriends'

const route = useRoute()
const friendId = computed(() => route.params.id as string)

const { fetchProfile, fetchFriendMedia } = useFriends()

const friendProfile = ref<Profile | null>(null)
const mediaItems = ref<MediaItem[]>([])
const loading = ref(true)

const activeType = ref<MediaType | 'all'>('all')
const selectedItem = ref<MediaItem | null>(null)
const isDetailOpen = ref(false)

async function loadData() {
  if (!friendId.value) return

  loading.value = true
  try {
    const [p, media] = await Promise.all([
      fetchProfile(friendId.value),
      fetchFriendMedia(friendId.value)
    ])

    friendProfile.value = p
    mediaItems.value = media
  } catch (err) {
    console.error('Error loading friend data:', err)
  } finally {
    loading.value = false
  }
}

watch(friendId, (id) => {
  if (id) {
    loadData()
  }
}, { immediate: true })

const filteredItems = computed(() => {
  if (activeType.value === 'all') return mediaItems.value
  return mediaItems.value.filter((i) => i.media_type === activeType.value)
})

const avatarInitial = computed(() => {
  const name = friendProfile.value?.display_name || friendProfile.value?.username || 'A'
  return name.charAt(0).toUpperCase()
})

function openDetail(item: MediaItem) {
  selectedItem.value = item
  isDetailOpen.value = true
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">
    <!-- Top Navigation Bar -->
    <div class="flex items-center justify-between">
      <NuxtLink
        to="/friends"
        class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
      >
        <UIcon name="i-lucide-arrow-left" class="h-4 w-4" />
        <span>Torna agli amici</span>
      </NuxtLink>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition"
        :disabled="loading"
        title="Aggiorna contenuti"
        @click="loadData"
      >
        <UIcon name="i-lucide-refresh-cw" class="h-3.5 w-3.5" :class="{ 'animate-spin': loading }" />
        <span class="hidden sm:inline">Aggiorna</span>
      </button>
    </div>

    <!-- Friend Profile Header Card -->
    <div v-if="friendProfile" class="surface-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl p-6 border dark:border-slate-800">
      <div class="flex items-center gap-4">
        <div class="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-xl font-black text-white shadow-lg shadow-indigo-500/25">
          {{ avatarInitial }}
        </div>

        <div>
          <h1 class="text-xl font-extrabold text-slate-900 dark:text-white">
            {{ friendProfile.display_name || friendProfile.username || 'Amico' }}
          </h1>
          <p v-if="friendProfile.username" class="text-xs font-medium text-slate-400">
            @{{ friendProfile.username }}
          </p>
          <p v-if="friendProfile.bio" class="mt-1 text-xs text-slate-600 dark:text-slate-300">
            {{ friendProfile.bio }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 rounded-2xl bg-indigo-50/80 px-4 py-2 dark:bg-indigo-950/50 self-start sm:self-auto">
        <UIcon name="i-lucide-bookmark" class="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <span class="text-xs font-bold text-indigo-900 dark:text-indigo-200">
          {{ mediaItems.length }} {{ mediaItems.length === 1 ? 'opera tracciata' : 'opere tracciate' }}
        </span>
      </div>
    </div>

    <!-- Profile Skeleton Header if loading and no profile yet -->
    <div v-else-if="loading" class="surface-card flex items-center gap-4 rounded-3xl p-6 border animate-pulse dark:border-slate-800">
      <div class="h-16 w-16 rounded-3xl bg-slate-200 dark:bg-slate-800" />
      <div class="space-y-2 flex-1">
        <div class="h-5 w-48 rounded bg-slate-200 dark:bg-slate-800" />
        <div class="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>

    <!-- Category Filter Tabs -->
    <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      <button
        v-for="t in [
          { id: 'all', label: 'Tutti' },
          { id: 'series', label: 'Serie TV' },
          { id: 'book', label: 'Libri' },
          { id: 'movie', label: 'Film' },
          { id: 'game', label: 'Videogiochi' },
          { id: 'podcast', label: 'Podcast' },
          { id: 'other', label: 'Altro' }
        ]"
        :key="t.id"
        type="button"
        class="rounded-xl px-3.5 py-1.5 text-xs font-bold transition"
        :class="activeType === t.id
          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
          : 'bg-white/80 text-slate-600 hover:bg-slate-100 dark:bg-slate-900/80 dark:text-slate-400'"
        @click="activeType = t.id as any"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- Loading Skeleton Grid -->
    <div v-if="loading && mediaItems.length === 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="n in 6"
        :key="n"
        class="surface-card rounded-3xl p-5 border animate-pulse dark:border-slate-800 h-44 flex flex-col justify-between"
      >
        <div class="flex items-center gap-3">
          <div class="h-12 w-12 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div class="space-y-2 flex-1">
            <div class="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
            <div class="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
        <div class="h-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>

    <!-- Friend's Media Grid -->
    <div v-else-if="filteredItems.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <MediaCard
        v-for="item in filteredItems"
        :key="item.id"
        :item="item"
        :readonly="true"
        @click="openDetail(item)"
      />
    </div>

    <!-- Empty List -->
    <div
      v-else-if="!loading"
      class="surface-card flex flex-col items-center justify-center rounded-3xl p-10 text-center border dark:border-slate-800"
    >
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
        <UIcon name="i-lucide-bookmark-x" class="h-6 w-6" />
      </div>
      <h3 class="mt-3 text-sm font-bold text-slate-900 dark:text-white">
        Nessun elemento da mostrare
      </h3>
      <p class="mt-1 text-xs text-slate-400">
        {{ activeType === 'all' ? 'Questo amico non ha ancora aggiunto contenuti visibili.' : 'Questo amico non ha ancora aggiunto contenuti visibili per questa categoria.' }}
      </p>
    </div>

    <!-- Read-only Detail Modal -->
    <LazyMediaDetailModal
      v-model:open="isDetailOpen"
      :item="selectedItem"
      :readonly="true"
    />
  </div>
</template>
