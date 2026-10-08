import type { MediaType } from '~/types'

export function useQuickAdd() {
  const isQuickAddOpen = useState<boolean>('quick-add-open', () => false)
  const quickAddInitialType = useState<MediaType | null>('quick-add-type', () => null)
  const router = useRouter()
  const route = useRoute()

  async function openQuickAdd(defaultType?: MediaType, navigateHome = true) {
    if (navigateHome && route.path !== '/') {
      await router.push('/')
    }
    quickAddInitialType.value = defaultType ?? null
    isQuickAddOpen.value = true
  }

  function closeQuickAdd() {
    isQuickAddOpen.value = false
    quickAddInitialType.value = null
  }

  return {
    isQuickAddOpen,
    quickAddInitialType,
    openQuickAdd,
    closeQuickAdd
  }
}
