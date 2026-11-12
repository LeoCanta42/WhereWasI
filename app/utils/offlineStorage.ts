import type { JwtPayload } from '@supabase/supabase-js'
import type { MediaItem, Profile, FriendProfile } from '../types'

export type MutationType =
  | 'media:insert'
  | 'media:update'
  | 'media:delete'
  | 'profile:update'

export interface OfflineMutation {
  id: string
  type: MutationType
  tempId?: number
  targetId?: number | string
  payload?: any
  createdAt: number
}

const STORAGE_KEYS = {
  USER: 'wherewasi:offline:user',
  PROFILE: 'wherewasi:offline:profile',
  MEDIA_ITEMS: 'wherewasi:offline:media_items',
  FRIENDS: 'wherewasi:offline:friends',
  MUTATIONS: 'wherewasi:offline:mutations',
  LOGGED_OUT: 'wherewasi:offline:logged_out'
} as const

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function getItem<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback
  try {
    const item = window.localStorage.getItem(key)
    if (!item) return fallback
    return JSON.parse(item) as T
  } catch (err) {
    console.warn(`[offlineStorage] Failed to read ${key}:`, err)
    return fallback
  }
}

function setItem<T>(key: string, value: T): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.warn(`[offlineStorage] Failed to write ${key}:`, err)
  }
}

function removeItem(key: string): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(key)
  } catch (err) {
    console.warn(`[offlineStorage] Failed to remove ${key}:`, err)
  }
}

export const offlineStorage = {
  // ------------------------------------------------------------- User
  getUser(): JwtPayload | null {
    return getItem<JwtPayload | null>(STORAGE_KEYS.USER, null)
  },
  setUser(user: JwtPayload | null): void {
    if (user) {
      setItem(STORAGE_KEYS.USER, user)
      removeItem(STORAGE_KEYS.LOGGED_OUT)
    } else {
      removeItem(STORAGE_KEYS.USER)
    }
  },
  clearUser(): void {
    removeItem(STORAGE_KEYS.USER)
  },

  // ------------------------------------------------------------- Profile
  getProfile(): Profile | null {
    return getItem<Profile | null>(STORAGE_KEYS.PROFILE, null)
  },
  setProfile(profile: Profile | null): void {
    if (profile) {
      setItem(STORAGE_KEYS.PROFILE, profile)
    } else {
      removeItem(STORAGE_KEYS.PROFILE)
    }
  },
  clearProfile(): void {
    removeItem(STORAGE_KEYS.PROFILE)
  },

  // ------------------------------------------------------------- Media Items
  getMediaItems(): MediaItem[] {
    return getItem<MediaItem[]>(STORAGE_KEYS.MEDIA_ITEMS, [])
  },
  setMediaItems(items: MediaItem[]): void {
    setItem(STORAGE_KEYS.MEDIA_ITEMS, items)
  },
  clearMediaItems(): void {
    removeItem(STORAGE_KEYS.MEDIA_ITEMS)
  },

  // ------------------------------------------------------------- Friends
  getFriends(): FriendProfile[] {
    return getItem<FriendProfile[]>(STORAGE_KEYS.FRIENDS, [])
  },
  setFriends(friends: FriendProfile[]): void {
    setItem(STORAGE_KEYS.FRIENDS, friends)
  },
  clearFriends(): void {
    removeItem(STORAGE_KEYS.FRIENDS)
  },

  // ------------------------------------------------------------- Mutation queue
  getMutations(): OfflineMutation[] {
    return getItem<OfflineMutation[]>(STORAGE_KEYS.MUTATIONS, [])
  },
  setMutations(mutations: OfflineMutation[]): void {
    setItem(STORAGE_KEYS.MUTATIONS, mutations)
  },
  addMutation(mutation: OfflineMutation): void {
    const list = this.getMutations()
    list.push(mutation)
    this.setMutations(list)
  },
  removeMutation(id: string): void {
    const list = this.getMutations().filter(m => m.id !== id)
    this.setMutations(list)
  },
  clearMutations(): void {
    removeItem(STORAGE_KEYS.MUTATIONS)
  },

  // ------------------------------------------------------------- Explicit Logout
  isLoggedOut(): boolean {
    return getItem<boolean>(STORAGE_KEYS.LOGGED_OUT, false)
  },
  setLoggedOut(value: boolean): void {
    if (value) {
      setItem(STORAGE_KEYS.LOGGED_OUT, true)
    } else {
      removeItem(STORAGE_KEYS.LOGGED_OUT)
    }
  },

  // ------------------------------------------------------------- Wipe all
  clearAll(): void {
    this.clearUser()
    this.clearProfile()
    this.clearMediaItems()
    this.clearFriends()
    this.clearMutations()
    this.setLoggedOut(true)
  }
}
