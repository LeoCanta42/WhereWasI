<script setup lang="ts">
const props = withDefaults(defineProps<{
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  withText?: boolean
}>(), {
  size: 'md',
  withText: false
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'xs': return 'h-6 w-6 rounded-lg'
    case 'sm': return 'h-8 w-8 rounded-xl'
    case 'md': return 'h-10 w-10 rounded-xl'
    case 'lg': return 'h-14 w-14 rounded-2xl'
    case 'xl': return 'h-18 w-18 rounded-3xl'
    default: return 'h-10 w-10 rounded-xl'
  }
})
</script>

<template>
  <div class="inline-flex items-center gap-2.5">
    <!-- SVG Icon Container -->
    <div
      class="relative flex items-center justify-center overflow-hidden bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 shadow-md shadow-indigo-600/25 transition duration-200"
      :class="sizeClasses"
    >
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-4/5 w-4/5">
        <!-- Bookmark ribbon -->
        <path
          d="M9 7C9 5.89543 9.89543 5 11 5H21C22.1046 5 23 5.89543 23 7V27L16 22L9 27V7Z"
          fill="white"
          fill-opacity="0.95"
        />
        <!-- Inner play triangle -->
        <path
          d="M14 11L19 14L14 17V11Z"
          fill="#4f46e5"
        />
      </svg>
    </div>

    <!-- Optional Brand Text -->
    <div v-if="withText" class="flex flex-col text-left">
      <span class="text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
        WhereWas<span class="text-indigo-600 dark:text-indigo-400">I?</span>
      </span>
      <span class="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
        Media & Book Tracker
      </span>
    </div>
  </div>
</template>
