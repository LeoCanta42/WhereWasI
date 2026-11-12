import test from 'node:test'
import assert from 'node:assert/strict'

// Create a mock window with localStorage for testing offlineStorage
class MockLocalStorage {
  private store: Map<string, string> = new Map()

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

// Polyfill global window and localStorage
const mockStorage = new MockLocalStorage()
;(globalThis as any).window = {
  localStorage: mockStorage
}
;(globalThis as any).localStorage = mockStorage

const fakeNavigator = { onLine: true }
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: fakeNavigator,
    configurable: true,
    writable: true
  })
} catch {
  // If property already exists
}

// Dynamic import of offlineStorage and network
const { offlineStorage } = await import('../app/utils/offlineStorage.ts')
const { isNetworkError } = await import('../app/utils/network.ts')

test('offlineStorage manages user authentication state', () => {
  offlineStorage.clearAll()

  assert.equal(offlineStorage.getUser(), null)
  assert.equal(offlineStorage.isLoggedOut(), true)

  const fakeUser = { sub: 'user-123', email: 'test@example.com' }
  offlineStorage.setUser(fakeUser)

  assert.deepEqual(offlineStorage.getUser(), fakeUser)
  assert.equal(offlineStorage.isLoggedOut(), false)

  offlineStorage.clearUser()
  assert.equal(offlineStorage.getUser(), null)
})

test('offlineStorage manages profile caching', () => {
  const fakeProfile = {
    id: 'user-123',
    approved: true,
    is_admin: false,
    email: 'test@example.com',
    username: 'tester',
    display_name: 'Tester',
    avatar_url: null,
    bio: 'Test bio',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  offlineStorage.setProfile(fakeProfile)
  assert.deepEqual(offlineStorage.getProfile(), fakeProfile)

  offlineStorage.clearProfile()
  assert.equal(offlineStorage.getProfile(), null)
})

test('offlineStorage manages media items caching', () => {
  const fakeItems = [
    {
      id: 1,
      user_id: 'user-123',
      title: 'Breaking Bad',
      media_type: 'series',
      status: 'in_progress',
      progress_type: 'episode_season',
      season: 2,
      episode: 5,
      total_seasons: 5,
      total_episodes: 7,
      rating: 5,
      review: 'Capolavoro',
      notes: '',
      tags: ['drama'],
      genre: 'Drama',
      is_favorite: true,
      is_private: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]

  offlineStorage.setMediaItems(fakeItems as any)
  assert.deepEqual(offlineStorage.getMediaItems(), fakeItems)

  offlineStorage.clearMediaItems()
  assert.deepEqual(offlineStorage.getMediaItems(), [])
})

test('offlineStorage manages friends caching', () => {
  const fakeFriends = [
    {
      id: 'friend-456',
      email: 'friend@example.com',
      username: 'friend',
      display_name: 'Amico',
      avatar_url: null,
      bio: '',
      approved: true,
      is_admin: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      friendship_id: 42,
      friendship_status: 'accepted',
      is_requester: false
    }
  ]

  offlineStorage.setFriends(fakeFriends as any)
  assert.deepEqual(offlineStorage.getFriends(), fakeFriends)

  offlineStorage.clearFriends()
  assert.deepEqual(offlineStorage.getFriends(), [])
})

test('offlineStorage manages mutation queue FIFO and removal', () => {
  offlineStorage.clearMutations()
  assert.deepEqual(offlineStorage.getMutations(), [])

  const mut1 = {
    id: 'm-1',
    type: 'media:insert' as const,
    tempId: -100,
    payload: { title: 'Dune Part 2', media_type: 'movie' },
    createdAt: Date.now()
  }
  const mut2 = {
    id: 'm-2',
    type: 'media:update' as const,
    targetId: 1,
    payload: { episode: 6 },
    createdAt: Date.now() + 10
  }

  offlineStorage.addMutation(mut1)
  offlineStorage.addMutation(mut2)

  const queue = offlineStorage.getMutations()
  assert.equal(queue.length, 2)
  assert.deepEqual(queue[0], mut1)
  assert.deepEqual(queue[1], mut2)

  offlineStorage.removeMutation('m-1')
  assert.equal(offlineStorage.getMutations().length, 1)
  assert.equal(offlineStorage.getMutations()[0].id, 'm-2')

  offlineStorage.clearMutations()
  assert.deepEqual(offlineStorage.getMutations(), [])
})

test('temp ID resolution simulates successful sync replay', () => {
  const idMap = new Map<number | string, number | string>()
  const tempId = -1700000000000
  const realServerId = 42

  // Simulate media:insert execution
  idMap.set(tempId, realServerId)

  // Subsequent update pointing to tempId
  const updateMutation = {
    type: 'media:update',
    targetId: tempId,
    payload: { episode: 8 }
  }

  const resolvedTargetId = idMap.get(updateMutation.targetId) ?? updateMutation.targetId
  assert.equal(resolvedTargetId, realServerId)
})

test('isNetworkError detects network failures correctly', () => {
  fakeNavigator.onLine = true

  // Network errors
  assert.equal(isNetworkError(new Error('Failed to fetch')), true)
  assert.equal(isNetworkError(new Error('NetworkError when attempting to fetch resource.')), true)
  assert.equal(isNetworkError(new Error('The user is offline.')), true)
  assert.equal(isNetworkError(new Error('Load failed')), true)
  assert.equal(isNetworkError({ message: 'fetch failed' }), true)
  assert.equal(isNetworkError({ message: 'The request timed out' }), true)

  // Non-network errors
  assert.equal(isNetworkError(new Error('duplicate key value violates unique constraint')), false)
  assert.equal(isNetworkError(new Error('JWT expired')), false)
  assert.equal(isNetworkError(new Error('permission denied for table media_items')), false)
  assert.equal(isNetworkError(null), false)

  // Offline navigator override
  fakeNavigator.onLine = false
  assert.equal(isNetworkError(new Error('Any error while offline')), true)
  fakeNavigator.onLine = true
})

test('offlineStorage clearAll resets entire local store and marks logged out', () => {
  offlineStorage.setUser({ sub: 'user-1' })
  offlineStorage.setProfile({ id: 'user-1', approved: true } as any)
  offlineStorage.setMediaItems([{ id: 1, title: 'Test' }] as any)
  offlineStorage.setFriends([{ id: 'f-1' }] as any)
  offlineStorage.addMutation({ id: 'm-1', type: 'media:insert', createdAt: Date.now() })

  assert.equal(offlineStorage.isLoggedOut(), false)
  assert.equal(offlineStorage.getMediaItems().length, 1)

  offlineStorage.clearAll()

  assert.equal(offlineStorage.getUser(), null)
  assert.equal(offlineStorage.getProfile(), null)
  assert.deepEqual(offlineStorage.getMediaItems(), [])
  assert.deepEqual(offlineStorage.getFriends(), [])
  assert.deepEqual(offlineStorage.getMutations(), [])
  assert.equal(offlineStorage.isLoggedOut(), true)
})
