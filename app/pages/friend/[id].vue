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

onMounted(async () => {
  if (!friendId.value) return

  loading.value = true
  const [p, media] = await Promise.all([
    fetchProfile(friendId.value),
    fetchFriendMedia(friendId.value)
  ])

  friendProfile.value = p
  mediaItems.value = media
  loading.value = false
})

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
    <!-- Back Button -->
    <div>
      <NuxtLink
        to="/friends"
        class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
      >
        <UIcon name="i-lucide-arrow-left" class="h-4 w-4" />
        <span>Torna agli amici</span>
      </NuxtLink>
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

    <!-- Category Filter Tabs -->
    <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      <button
        v-for="t in [
          { id: 'all', label: 'Tutti' },
          { id: 'series', label: 'Serie TV' },
          { id: 'book', label: 'Libri' },
          { id: 'movie', label: 'Film' },
          { id: 'game', label: 'Videogiochi' },
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

    <!-- Friend's Media Grid -->
    <div v-if="filteredItems.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        Questo amico non ha ancora aggiunto contenuti visibili per questa categoria.
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
