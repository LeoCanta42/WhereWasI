import { ACCENTS, usePreferences } from '~/composables/usePreferences'

export function useAppearance() {
  const { prefs, update, patch, accentOption } = usePreferences()
  const colorMode = useColorMode()

  const isDark = computed(() => colorMode.value === 'dark')

  useHead({
    htmlAttrs: {
      'data-accent': () => prefs.value.accent,
      'lang': 'it'
    },
    meta: [
      {
        name: 'theme-color',
        content: () => (isDark.value ? '#0f172a' : accentOption.value.ink)
      },
      {
        name: 'color-scheme',
        content: () => (isDark.value ? 'dark' : 'light')
      }
    ]
  })

  const theme = computed<'light' | 'dark' | 'system'>(() => {
    const preference = colorMode.preference
    return preference === 'dark' || preference === 'light' ? preference : 'system'
  })

  function setTheme(next: 'light' | 'dark' | 'system') {
    colorMode.preference = next
  }

  function setAccent(id: (typeof ACCENTS)[number]['id']) {
    update('accent', id)
  }

  return { prefs, update, patch, accentOption, isDark, theme, setTheme, setAccent }
}
