import type { MediaType } from '~/types'

export function useQuickAdd() {
  const isQuickAddOpen = useState<boolean>('quick-add-open', () => false)
  const quickAddInitialType = useState<MediaType | null>('quick-add-type', () => null)

  function openQuickAdd(defaultType?: MediaType) {
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
