import type { Database } from '~/types/database.types'
import { useCurrentUser } from '~/composables/useCurrentUser'
import { MIN_PASSWORD_LENGTH } from '~/utils/password'

export function useAuth() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const { userEmail } = useCurrentUser()
  const toast = useToast()

  const loading = ref(false)

  async function loginWithEmail(email: string, password: string): Promise<boolean> {
    loading.value = true
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      })

      if (error) {
        toast.add({
          title: 'Errore di accesso',
          description: error.message,
          color: 'error'
        })
        return false
      }

      toast.add({
        title: 'Accesso effettuato',
        description: 'Bentornato su WhereWasI?!',
        color: 'success'
      })
      return true
    } catch (err: unknown) {
      console.error('Email login error:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  async function signUpWithEmail(email: string, password: string, username?: string, displayName?: string): Promise<boolean> {
    loading.value = true
    try {
      const cleanEmail = email.trim()
      const cleanUsername = (username || cleanEmail.split('@')[0] || 'user').trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
      const cleanDisplay = (displayName || cleanUsername).trim()

      const { error, data } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name: cleanDisplay
          }
        }
      })

      if (error) {
        toast.add({
          title: 'Errore di registrazione',
          description: error.message,
          color: 'error'
        })
        return false
      }

      if (data.session) {
        toast.add({
          title: 'Account creato!',
          description: 'Il tuo account è stato creato ed è in attesa di approvazione da parte dell\'amministratore.',
          color: 'info'
        })
      } else {
        toast.add({
          title: 'Registrazione completata',
          description: 'Il tuo account è in attesa di approvazione da parte dell\'amministratore.',
          color: 'info'
        })
      }
      return true
    } catch (err: unknown) {
      console.error('Sign up error:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    const email = userEmail.value
    if (!email) {
      toast.add({
        title: 'Sessione non valida',
        description: 'Accedi di nuovo per cambiare la password.',
        color: 'error'
      })
      return false
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.add({
        title: 'Password non valida',
        description: `La nuova password deve contenere almeno ${MIN_PASSWORD_LENGTH} caratteri.`,
        color: 'error'
      })
      return false
    }

    loading.value = true
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword
      })

      if (verifyError) {
        toast.add({
          title: 'Password attuale errata',
          description: 'Verifica la password attuale e riprova.',
          color: 'error'
        })
        return false
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        toast.add({
          title: 'Errore durante l\'aggiornamento',
          description: updateError.message,
          color: 'error'
        })
        return false
      }

      toast.add({
        title: 'Password aggiornata',
        description: 'La password è stata modificata con successo.',
        color: 'success'
      })
      return true
    } catch (err: unknown) {
      console.error('Change password error:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    try {
      await supabase.auth.signOut()
      await navigateTo('/')
      toast.add({
        title: 'Disconnesso',
        description: 'A presto!',
        color: 'neutral'
      })
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  return {
    user,
    loading,
    loginWithEmail,
    signUpWithEmail,
    changePassword,
    logout
  }
}
