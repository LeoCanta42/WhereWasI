<script setup lang="ts">
import { useFriends } from '~/composables/useFriends'
import { useActivityFeed } from '~/composables/useActivityFeed'

const {
  friends,
  pendingIncoming,
  loadFriends,
  removeFriend
} = useFriends()

const { activities, loadFeed, loading: feedLoading } = useActivityFeed()

const activeTab = ref<'feed' | 'friends'>('feed')
const isAddFriendOpen = ref(false)

onMounted(() => {
  loadFriends()
  loadFeed()
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Amici & Attività
        </h1>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Scopri a che episodio o pagina sono arrivati i tuoi amici.
        </p>
      </div>

      <!-- Add Friend Button -->
      <button
        type="button"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        @click="isAddFriendOpen = true"
      >
        <UIcon name="i-lucide-user-plus" class="h-4 w-4" />
        <span>Aggiungi Amico</span>
      </button>
    </div>

    <!-- Pending Requests Alert Banner -->
    <div
      v-if="pendingIncoming.length > 0"
      class="surface-card flex items-center justify-between rounded-2xl border border-indigo-200/80 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/40"
    >
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <UIcon name="i-lucide-bell" class="h-4 w-4" />
        </div>
        <div>
          <p class="text-xs font-bold text-indigo-950 dark:text-indigo-200">
            Hai {{ pendingIncoming.length }} {{ pendingIncoming.length === 1 ? 'richiesta di amicizia in attesa' : 'richieste di amicizia in attesa' }}
          </p>
          <p class="text-[11px] text-indigo-700/80 dark:text-indigo-400">
            Accettala per condividere reciprocamente le vostre tracce.
          </p>
        </div>
      </div>

      <button
        type="button"
        class="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm"
        @click="isAddFriendOpen = true"
      >
        Gestisci
      </button>
    </div>

    <!-- Segmented Tab Switcher -->
    <div class="flex items-center gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition"
        :class="activeTab === 'feed'
          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
        @click="activeTab = 'feed'"
      >
        <UIcon name="i-lucide-activity" class="h-4 w-4" />
        <span>Attività Recenti</span>
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition"
        :class="activeTab === 'friends'
          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
        @click="activeTab = 'friends'"
      >
        <UIcon name="i-lucide-users" class="h-4 w-4" />
        <span>I Miei Amici ({{ friends.length }})</span>
      </button>
    </div>

    <!-- Tab 1: Activity Feed -->
    <div v-if="activeTab === 'feed'">
      <div v-if="activities.length > 0" class="space-y-3">
        <ActivityFeedItem
          v-for="act in activities"
          :key="act.id"
          :activity="act"
        />
      </div>

      <div
        v-else
        class="surface-card flex flex-col items-center justify-center rounded-3xl p-10 text-center border border-slate-200/80 dark:border-slate-800"
      >
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
          <UIcon name="i-lucide-sparkles" class="h-7 w-7" />
        </div>
        <h3 class="mt-4 text-base font-bold text-slate-900 dark:text-white">
          Nessuna attività recente
        </h3>
        <p class="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
          Quando tu o i tuoi amici aggiornerete lo stato di una serie o libro, apparirà qui!
        </p>
      </div>
    </div>

    <!-- Tab 2: Friends Grid -->
    <div v-else>
      <div v-if="friends.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <FriendCard
          v-for="f in friends"
          :key="f.friendship_id"
          :friend="f"
          @remove="removeFriend"
        />
      </div>

      <div
        v-else
        class="surface-card flex flex-col items-center justify-center rounded-3xl p-10 text-center border border-slate-200/80 dark:border-slate-800"
      >
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
          <UIcon name="i-lucide-user-plus" class="h-7 w-7" />
        </div>
        <h3 class="mt-4 text-base font-bold text-slate-900 dark:text-white">
          Non hai ancora amici aggiunti
        </h3>
        <p class="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
          Invia una richiesta con l'username o l'email del tuo amico per iniziare a seguire i suoi progressi.
        </p>
        <button
          type="button"
          class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700"
          @click="isAddFriendOpen = true"
        >
          <UIcon name="i-lucide-user-plus" class="h-4 w-4" />
          <span>Aggiungi Amico</span>
        </button>
      </div>
    </div>

    <!-- Add Friend Modal -->
    <LazyFriendRequestModal
      v-model:open="isAddFriendOpen"
    />
  </div>
</template>
