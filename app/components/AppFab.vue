<script setup lang="ts">
const emit = defineEmits<{
  (e: 'activate'): void
}>()
</script>

<template>
  <div class="fixed right-4 bottom-5 z-30 sm:hidden">
    <button
      type="button"
      class="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/40 transition hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500"
      aria-label="Aggiungi elemento da tracciare"
      @click="emit('activate')"
    >
      <UIcon name="i-lucide-plus" class="h-6 w-6" />
    </button>
  </div>
</template>
