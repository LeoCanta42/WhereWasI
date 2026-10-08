import { createPreferencesStore } from '~/composables/usePreferences'

export default defineNuxtPlugin(() => {
  return {
    provide: {
      preferences: createPreferencesStore()
    }
  }
})
