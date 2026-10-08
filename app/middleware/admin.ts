import { useCurrentUser } from '~/composables/useCurrentUser'
import { useProfile } from '~/composables/useProfile'

export default defineNuxtRouteMiddleware(async () => {
  const { user } = useCurrentUser()
  const { isAdmin, loaded, loadProfile } = useProfile()

  if (!user.value) {
    return navigateTo('/')
  }

  if (!loaded.value) {
    await loadProfile()
  }

  if (!isAdmin.value) {
    return navigateTo('/')
  }
})
