import type { Database } from '~/types/database.types'
import type { AdminUser } from '~/types'
import { useCurrentUser } from '~/composables/useCurrentUser'

export function useAdmin() {
  const supabase = useSupabaseClient<Database>()
  const { userId } = useCurrentUser()
  const toast = useToast()

  const users = useState<AdminUser[]>('admin-users', () => [])
  const loading = useState<boolean>('admin-users-loading', () => false)
  const loaded = useState<boolean>('admin-users-loaded', () => false)
  const busyId = useState<string | null>('admin-busy-id', () => null)

  const pendingCount = computed(() => users.value.filter((u) => !u.approved).length)
  const currentUserId = computed(() => userId.value)

  async function loadUsers() {
    loading.value = true
    try {
      const { data, error } = await supabase.rpc('admin_list_users')

      if (error) {
        users.value = []
        loaded.value = false
        toast.add({
          title: 'Utenti non disponibili',
          description: error.message.includes('42501') || /not authorized/i.test(error.message)
            ? 'Solo un amministratore può gestire gli utenti.'
            : error.message,
          color: 'error'
        })
        return
      }

      users.value = (data as unknown as AdminUser[]) ?? []
      loaded.value = true
    } catch (err) {
      console.error('Unexpected error loading users:', err)
    } finally {
      loading.value = false
    }
  }

  async function run(
    target: AdminUser,
    successTitle: string,
    failureTitle: string,
    call: () => PromiseLike<{ error: { message: string } | null }>
  ): Promise<boolean> {
    if (busyId.value) return false
    busyId.value = target.id

    try {
      const { error } = await call()

      if (error) {
        toast.add({
          title: failureTitle,
          description: error.message,
          color: 'error'
        })
        return false
      }

      toast.add({ title: successTitle, color: 'success' })
      return true
    } catch (err) {
      console.error('Admin action failed:', err)
      toast.add({ title: failureTitle, color: 'error' })
      return false
    } finally {
      busyId.value = null
    }
  }

  async function setApproved(target: AdminUser, approved: boolean): Promise<boolean> {
    const ok = await run(
      target,
      approved ? 'Utente approvato' : 'Approvazione revocata',
      'Impossibile aggiornare l\'approvazione',
      () => supabase.rpc('admin_set_approved', { p_user_id: target.id, p_approved: approved })
    )
    if (ok) {
      patch(target.id, { approved })
    }
    return ok
  }

  async function setAdminRole(target: AdminUser, isAdmin: boolean): Promise<boolean> {
    const ok = await run(
      target,
      isAdmin ? 'Promosso ad Amministratore' : 'Ruolo Amministratore revocato',
      'Impossibile aggiornare il ruolo',
      () => supabase.rpc('admin_set_admin', { p_user_id: target.id, p_is_admin: isAdmin })
    )
    if (ok) {
      patch(target.id, { is_admin: isAdmin })
    }
    return ok
  }

  async function resetPassword(target: AdminUser, password: string): Promise<boolean> {
    return run(
      target,
      'Password reimpostata con successo',
      'Impossibile reimpostare la password',
      () => supabase.rpc('admin_set_password', { p_user_id: target.id, p_password: password })
    )
  }

  async function deleteUser(target: AdminUser): Promise<boolean> {
    const ok = await run(
      target,
      'Utente eliminato',
      'Impossibile eliminare l\'utente',
      () => supabase.rpc('admin_delete_user', { p_user_id: target.id })
    )
    if (ok) {
      users.value = users.value.filter((u) => u.id !== target.id)
    }
    return ok
  }

  function patch(id: string, changes: Partial<AdminUser>) {
    users.value = users.value.map((u) => (u.id === id ? { ...u, ...changes } : u))
  }

  function isSelf(user: AdminUser): boolean {
    return Boolean(currentUserId.value && user.id === currentUserId.value)
  }

  return {
    users,
    loading,
    loaded,
    busyId,
    pendingCount,
    loadUsers,
    setApproved,
    setAdminRole,
    resetPassword,
    deleteUser,
    isSelf
  }
}
