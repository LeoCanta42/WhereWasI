<script setup lang="ts">
import type { MediaActivity } from '~/types'
import { getMediaTypeInfo } from '~/utils/media'
import { formatTimeAgo } from '~/utils/date'

const props = defineProps<{
  activity: MediaActivity
}>()

const typeInfo = computed(() => getMediaTypeInfo(props.activity.media_type))

const avatarInitial = computed(() => {
  const name = props.activity.profile?.display_name || props.activity.profile?.username || 'U'
  return name.charAt(0).toUpperCase()
})

const timeDisplay = computed(() => {
  if (!props.activity.created_at) return ''
  try {
    return formatTimeAgo(new Date(props.activity.created_at))
  } catch {
    return ''
  }
})

const actionIcon = computed(() => {
  switch (props.activity.action_type) {
    case 'completed': return 'i-lucide-trophy'
    case 'started': return 'i-lucide-sparkles'
    case 'rated': return 'i-lucide-star'
    default: return 'i-lucide-play'
  }
})
</script>

<template>
  <div class="surface-card flex items-start gap-3.5 rounded-2xl p-4 border transition duration-150 hover:border-indigo-500/30 dark:border-slate-800">
    <!-- User Avatar -->
    <NuxtLink
      :to="`/friend/${activity.user_id}`"
      class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
    >
      {{ avatarInitial }}
    </NuxtLink>

    <!-- Content -->
    <div class="min-w-0 flex-1">
      <div class="flex items-center justify-between gap-2">
        <NuxtLink
          :to="`/friend/${activity.user_id}`"
          class="truncate text-xs font-bold text-slate-900 dark:text-white hover:underline"
        >
          {{ activity.profile?.display_name || activity.profile?.username || 'Un amico' }}
        </NuxtLink>
        <span class="text-[11px] text-slate-400 whitespace-nowrap">{{ timeDisplay }}</span>
      </div>

      <p class="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
        {{ activity.message || 'Ha aggiornato i suoi progressi' }}
      </p>

      <!-- Media summary pill -->
      <div class="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-800/80 dark:text-slate-200">
        <UIcon :name="typeInfo.icon" class="h-3.5 w-3.5 text-indigo-500" />
        <span class="font-bold">{{ activity.media_title }}</span>
        <span v-if="activity.progress_text" class="text-indigo-600 dark:text-indigo-400">• {{ activity.progress_text }}</span>
      </div>
    </div>
  </div>
</template>
