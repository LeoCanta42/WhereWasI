<script setup lang="ts">
import type { FriendProfile } from '~/types'
import { useConfirm } from '~/composables/useConfirm'

const props = defineProps<{
  friend: FriendProfile
}>()

const emit = defineEmits<{
  (e: 'remove', friendshipId: number): void
}>()

const { ask } = useConfirm()

const avatarInitial = computed(() => {
  const name = props.friend.display_name || props.friend.username || props.friend.email || 'A'
  return name.charAt(0).toUpperCase()
})

async function handleRemove() {
  const confirmed = await ask({
    title: `Rimuovere ${props.friend.display_name || props.friend.username} dagli amici?`,
    description: 'Non potrete più vedere reciprocamente i vostri progressi di serie e libri.',
    confirmLabel: 'Rimuovi Amico',
    tone: 'danger',
    icon: 'i-lucide-user-minus'
  })

  if (confirmed) {
    emit('remove', props.friend.friendship_id)
  }
}
</script>

<template>
  <div class="surface-card flex flex-col justify-between rounded-3xl p-5 border transition duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800">
    <div class="flex items-start gap-3.5">
      <!-- Avatar -->
      <div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-base font-bold text-white shadow-md shadow-indigo-500/20">
        {{ avatarInitial }}
      </div>

      <div class="min-w-0 flex-1">
        <h3 class="truncate text-base font-bold text-slate-900 dark:text-white">
          {{ friend.display_name || friend.username || 'Amico' }}
        </h3>
        <p v-if="friend.username" class="text-xs font-medium text-slate-400 dark:text-slate-500">
          @{{ friend.username }}
        </p>
        <p v-if="friend.bio" class="mt-1.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
          {{ friend.bio }}
        </p>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div class="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5 dark:border-slate-800">
      <NuxtLink
        :to="`/friend/${friend.id}`"
        class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 active:scale-95 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
      >
        <UIcon name="i-lucide-bookmark" class="h-3.5 w-3.5" />
        <span>Vedi Tracce</span>
      </NuxtLink>

      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
        title="Rimuovi amico"
        @click="handleRemove"
      >
        <UIcon name="i-lucide-user-x" class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
