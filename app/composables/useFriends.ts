import type { Database } from '~/types/database.types'
import type { FriendProfile, Friendship, MediaItem, Profile } from '~/types'
import { useCurrentUser } from '~/composables/useCurrentUser'

export function useFriends() {
  const supabase = useSupabaseClient<Database>()
  const { userId, userEmail } = useCurrentUser()
  const toast = useToast()

  const friends = useState<FriendProfile[]>('friends-list', () => [])
  const pendingIncoming = useState<FriendProfile[]>('pending-incoming-friends', () => [])
  const pendingOutgoing = useState<FriendProfile[]>('pending-outgoing-friends', () => [])
  const loading = useState<boolean>('friends-loading', () => false)

  async function loadFriends() {
    const id = userId.value
    if (!id) {
      friends.value = []
      pendingIncoming.value = []
      pendingOutgoing.value = []
      return
    }

    loading.value = true
    try {
      // 1. Fetch all friendships involving this user
      const { data: friendshipsData, error: friendshipsError } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${id},addressee_id.eq.${id}`)

      if (friendshipsError) {
        console.error('Error loading friendships:', friendshipsError)
        return
      }

      const rawFriendships = (friendshipsData as unknown as Friendship[]) ?? []
      if (rawFriendships.length === 0) {
        friends.value = []
        pendingIncoming.value = []
        pendingOutgoing.value = []
        return
      }

      // 2. Collect other user IDs
      const otherUserIds = rawFriendships.map((f) => (f.requester_id === id ? f.addressee_id : f.requester_id))
      const uniqueIds = Array.from(new Set(otherUserIds))

      // 3. Fetch profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', uniqueIds)

      if (profilesError) {
        console.error('Error loading friend profiles:', profilesError)
        return
      }

      const profilesMap = new Map<string, Profile>()
      for (const p of (profilesData as unknown as Profile[]) ?? []) {
        profilesMap.set(p.id, p)
      }

      const acceptedList: FriendProfile[] = []
      const incomingList: FriendProfile[] = []
      const outgoingList: FriendProfile[] = []

      for (const f of rawFriendships) {
        const otherId = f.requester_id === id ? f.addressee_id : f.requester_id
        const p = profilesMap.get(otherId)
        if (!p) continue

        const item: FriendProfile = {
          ...p,
          friendship_id: f.id,
          friendship_status: f.status,
          is_requester: f.requester_id === id
        }

        if (f.status === 'accepted') {
          acceptedList.push(item)
        } else if (f.status === 'pending') {
          if (f.requester_id === id) {
            outgoingList.push(item)
          } else {
            incomingList.push(item)
          }
        }
      }

      friends.value = acceptedList
      pendingIncoming.value = incomingList
      pendingOutgoing.value = outgoingList
    } catch (err) {
      console.error('Unexpected error loading friends:', err)
    } finally {
      loading.value = false
    }
  }

  async function sendFriendRequest(identifier: string): Promise<boolean> {
    const currentId = userId.value
    if (!currentId) return false

    const clean = identifier.trim()
    if (!clean) {
      toast.add({
        title: 'Attenzione',
        description: 'Inserisci un nome utente o un indirizzo email.',
        color: 'warning'
      })
      return false
    }

    loading.value = true
    try {
      // Call RPC function
      const { data, error } = await (supabase.rpc as any)('send_friend_request_by_identifier', {
        identifier: clean
      })

      if (error) {
        toast.add({
          title: 'Errore',
          description: error.message,
          color: 'error'
        })
        return false
      }

      const res = data as any
      if (!res.success) {
        toast.add({
          title: 'Impossibile inviare la richiesta',
          description: res.error || 'Errore sconosciuto',
          color: 'warning'
        })
        return false
      }

      toast.add({
        title: 'Richiesta completata',
        description: res.message,
        color: 'success'
      })

      await loadFriends()
      return true
    } catch (err: unknown) {
      console.error('Error sending friend request:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  async function acceptFriendRequest(friendshipId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() } as any)
        .eq('id', friendshipId)

      if (error) {
        toast.add({
          title: 'Errore',
          description: error.message,
          color: 'error'
        })
        return false
      }

      toast.add({
        title: 'Richiesta accettata!',
        description: 'Ora potete vedere reciprocamente i vostri progressi.',
        color: 'success'
      })

      await loadFriends()
      return true
    } catch (err) {
      console.error('Error accepting friend request:', err)
      return false
    }
  }

  async function declineFriendRequest(friendshipId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)

      if (error) {
        toast.add({
          title: 'Errore',
          description: error.message,
          color: 'error'
        })
        return false
      }

      toast.add({
        title: 'Richiesta rifiutata',
        description: 'La richiesta è stata rimossa.',
        color: 'neutral'
      })

      await loadFriends()
      return true
    } catch (err) {
      console.error('Error declining friend request:', err)
      return false
    }
  }

  async function removeFriend(friendshipId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)

      if (error) {
        toast.add({
          title: 'Errore',
          description: error.message,
          color: 'error'
        })
        return false
      }

      toast.add({
        title: 'Amico rimosso',
        description: 'Non condividerete più i vostri progressi.',
        color: 'neutral'
      })

      await loadFriends()
      return true
    } catch (err) {
      console.error('Error removing friend:', err)
      return false
    }
  }

  /**
   * Fetch a friend's tracked media items (RLS ensures only non-private items are returned)
   */
  async function fetchFriendMedia(friendUserId: string): Promise<MediaItem[]> {
    try {
      const { data, error } = await supabase
        .from('media_items')
        .select('*')
        .eq('user_id', friendUserId)
        .eq('is_private', false)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error loading friend media:', error)
        return []
      }

      return (data as unknown as MediaItem[]) ?? []
    } catch (err) {
      console.error('Unexpected error loading friend media:', err)
      return []
    }
  }

  /**
   * Fetch a user profile by ID
   */
  async function fetchProfile(userIdToFetch: string): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userIdToFetch)
        .maybeSingle()

      if (error) {
        console.error('Error loading profile:', error)
        return null
      }

      return (data as unknown as Profile) ?? null
    } catch (err) {
      console.error('Unexpected error loading profile:', err)
      return null
    }
  }

  return {
    friends,
    pendingIncoming,
    pendingOutgoing,
    loading,
    loadFriends,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    fetchFriendMedia,
    fetchProfile
  }
}
