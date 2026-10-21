import type { MediaItem } from '~/types'

export interface QueuedMutation {
  queue_id?: number
  action: 'insert' | 'update' | 'delete'
  item_id: number
  tempId?: number
  payload?: any
  timestamp: number
  retry_count?: number
}

const DB_NAME = 'where_was_i_db'
const DB_VERSION = 1
const STORE_MEDIA = 'media_items'
const STORE_QUEUE = 'sync_queue'
const STORE_CACHE = 'app_cache'

// Memory fallback in case IndexedDB is restricted or unavailable
const memoryFallback = {
  media: new Map<number, MediaItem>(),
  queue: [] as QueuedMutation[],
  cache: new Map<string, any>()
}

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

let dbInstance: IDBDatabase | null = null
let dbPromise: Promise<IDBDatabase | null> | null = null

function getDB(): Promise<IDBDatabase | null> {
  if (!isClient()) return Promise.resolve(null)
  if (dbInstance) return Promise.resolve(dbInstance)
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          const mediaStore = db.createObjectStore(STORE_MEDIA, { keyPath: 'id' })
          mediaStore.createIndex('user_id', 'user_id', { unique: false })
          mediaStore.createIndex('updated_at', 'updated_at', { unique: false })
        }

        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'queue_id', autoIncrement: true })
          queueStore.createIndex('timestamp', 'timestamp', { unique: false })
          queueStore.createIndex('item_id', 'item_id', { unique: false })
        }

        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          db.createObjectStore(STORE_CACHE, { keyPath: 'key' })
        }
      }

      request.onsuccess = () => {
        dbInstance = request.result
        dbInstance.onclose = () => {
          dbInstance = null
          dbPromise = null
        }
        resolve(dbInstance)
      }

      request.onerror = (err) => {
        console.warn('[OfflineStorage] IndexedDB open error, using memory fallback:', err)
        resolve(null)
      }

      request.onblocked = () => {
        console.warn('[OfflineStorage] IndexedDB open blocked')
      }
    } catch (err) {
      console.warn('[OfflineStorage] Exception opening IndexedDB:', err)
      resolve(null)
    }
  })

  return dbPromise
}

// -------------------------------------------------------------
// Media Items Cache
// -------------------------------------------------------------

export async function getCachedMediaItems(userId?: string): Promise<MediaItem[]> {
  const db = await getDB()
  if (!db) {
    const all = Array.from(memoryFallback.media.values())
    return userId ? all.filter((i) => i.user_id === userId) : all
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA, 'readonly')
      const store = tx.objectStore(STORE_MEDIA)

      if (userId && store.indexNames.contains('user_id')) {
        const index = store.index('user_id')
        const request = index.getAll(IDBKeyRange.only(userId))
        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => resolve([])
      } else {
        const request = store.getAll()
        request.onsuccess = () => {
          const list = request.result || []
          resolve(userId ? list.filter((i: MediaItem) => i.user_id === userId) : list)
        }
        request.onerror = () => resolve([])
      }
    } catch (err) {
      console.warn('[OfflineStorage] Failed to read cached media items:', err)
      resolve([])
    }
  })
}

export async function saveCachedMediaItems(items: MediaItem[]): Promise<void> {
  for (const item of items) {
    memoryFallback.media.set(item.id, item)
  }

  const db = await getDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA, 'readwrite')
      const store = tx.objectStore(STORE_MEDIA)

      for (const item of items) {
        store.put(item)
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch (err) {
      console.warn('[OfflineStorage] Failed to save media items:', err)
      resolve()
    }
  })
}

export async function saveCachedMediaItem(item: MediaItem): Promise<void> {
  memoryFallback.media.set(item.id, item)

  const db = await getDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA, 'readwrite')
      const store = tx.objectStore(STORE_MEDIA)
      store.put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch (err) {
      console.warn('[OfflineStorage] Failed to save media item:', err)
      resolve()
    }
  })
}

export async function removeCachedMediaItem(id: number): Promise<void> {
  memoryFallback.media.delete(id)

  const db = await getDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA, 'readwrite')
      const store = tx.objectStore(STORE_MEDIA)
      store.delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch (err) {
      console.warn('[OfflineStorage] Failed to remove media item:', err)
      resolve()
    }
  })
}

export async function replaceCachedMediaItemId(tempId: number, realItem: MediaItem): Promise<void> {
  memoryFallback.media.delete(tempId)
  memoryFallback.media.set(realItem.id, realItem)

  const db = await getDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA, 'readwrite')
      const store = tx.objectStore(STORE_MEDIA)
      store.delete(tempId)
      store.put(realItem)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch (err) {
      console.warn('[OfflineStorage] Failed to replace media item:', err)
      resolve()
    }
  })
}

export async function clearCachedMediaItems(): Promise<void> {
  memoryFallback.media.clear()
  const db = await getDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA, 'readwrite')
      tx.objectStore(STORE_MEDIA).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

// -------------------------------------------------------------
// Sync Queue
// -------------------------------------------------------------

export async function enqueueMutation(mutation: Omit<QueuedMutation, 'queue_id'>): Promise<number> {
  const db = await getDB()

  if (!db) {
    // Memory fallback coalescing
    if (mutation.action === 'delete') {
      if (mutation.item_id < 0) {
        memoryFallback.queue = memoryFallback.queue.filter((q) => q.item_id !== mutation.item_id)
        return 0
      }
      memoryFallback.queue = memoryFallback.queue.filter(
        (q) => !(q.item_id === mutation.item_id && q.action === 'update')
      )
    } else if (mutation.action === 'update') {
      const existing = memoryFallback.queue.find(
        (q) => q.item_id === mutation.item_id && (q.action === 'update' || q.action === 'insert')
      )
      if (existing) {
        existing.payload = { ...existing.payload, ...mutation.payload }
        existing.timestamp = mutation.timestamp
        return existing.queue_id || 0
      }
    }

    const nextId = (memoryFallback.queue.length > 0
      ? Math.max(...memoryFallback.queue.map((m) => m.queue_id || 0))
      : 0) + 1
    const queued: QueuedMutation = { ...mutation, queue_id: nextId }
    memoryFallback.queue.push(queued)
    return nextId
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_QUEUE, 'readwrite')
      const store = tx.objectStore(STORE_QUEUE)

      const request = store.getAll()
      request.onsuccess = () => {
        const all = (request.result as QueuedMutation[]) || []

        // Optimization: if deleting an offline item that was never sent to server
        if (mutation.action === 'delete') {
          if (mutation.item_id < 0) {
            // Delete all pending mutations for this negative temp id
            for (const item of all) {
              if (item.item_id === mutation.item_id && item.queue_id !== undefined) {
                store.delete(item.queue_id)
              }
            }
            tx.oncomplete = () => resolve(0)
            return
          }

          // If deleting an existing item, remove any pending updates for it first
          for (const item of all) {
            if (item.item_id === mutation.item_id && item.action === 'update' && item.queue_id !== undefined) {
              store.delete(item.queue_id)
            }
          }
        } else if (mutation.action === 'update') {
          // If update, check if an existing update or insert for this item_id exists
          const existing = all.find(
            (q) => q.item_id === mutation.item_id && (q.action === 'update' || q.action === 'insert')
          )
          if (existing && existing.queue_id !== undefined) {
            existing.payload = { ...existing.payload, ...mutation.payload }
            existing.timestamp = mutation.timestamp
            store.put(existing)
            tx.oncomplete = () => resolve(existing.queue_id!)
            return
          }
        }

        const addReq = store.add(mutation)
        addReq.onsuccess = () => {
          resolve(Number(addReq.result))
        }
        addReq.onerror = () => resolve(0)
      }

      request.onerror = () => resolve(0)
    } catch (err) {
      console.warn('[OfflineStorage] Error enqueueing mutation:', err)
      resolve(0)
    }
  })
}

export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const db = await getDB()
  if (!db) {
    return [...memoryFallback.queue].sort((a, b) => a.timestamp - b.timestamp)
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_QUEUE, 'readonly')
      const store = tx.objectStore(STORE_QUEUE)
      const request = store.getAll()
      request.onsuccess = () => {
        const list = (request.result as QueuedMutation[]) || []
        list.sort((a, b) => a.timestamp - b.timestamp)
        resolve(list)
      }
      request.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB()
  if (!db) return memoryFallback.queue.length

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_QUEUE, 'readonly')
      const countReq = tx.objectStore(STORE_QUEUE).count()
      countReq.onsuccess = () => resolve(countReq.result)
      countReq.onerror = () => resolve(0)
    } catch {
      resolve(0)
    }
  })
}

export async function removeMutation(queueId: number): Promise<void> {
  memoryFallback.queue = memoryFallback.queue.filter((m) => m.queue_id !== queueId)

  const db = await getDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_QUEUE, 'readwrite')
      tx.objectStore(STORE_QUEUE).delete(queueId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function updateMutationTempId(oldTempId: number, newRealId: number): Promise<void> {
  for (const item of memoryFallback.queue) {
    if (item.item_id === oldTempId) {
      item.item_id = newRealId
      if (item.tempId === oldTempId) item.tempId = newRealId
    }
  }

  const db = await getDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_QUEUE, 'readwrite')
      const store = tx.objectStore(STORE_QUEUE)
      const request = store.getAll()
      request.onsuccess = () => {
        const list = (request.result as QueuedMutation[]) || []
        for (const item of list) {
          if (item.item_id === oldTempId) {
            item.item_id = newRealId
            if (item.tempId === oldTempId) item.tempId = newRealId
            store.put(item)
          }
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function clearSyncQueue(): Promise<void> {
  memoryFallback.queue = []
  const db = await getDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_QUEUE, 'readwrite')
      tx.objectStore(STORE_QUEUE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

// -------------------------------------------------------------
// App Cache (Profile, Friends, Feed, Preferences, etc.)
// -------------------------------------------------------------

export async function getAppCache<T>(key: string): Promise<T | null> {
  const mem = memoryFallback.cache.get(key)
  if (mem !== undefined) return mem

  const db = await getDB()
  if (!db) return null

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_CACHE, 'readonly')
      const req = tx.objectStore(STORE_CACHE).get(key)
      req.onsuccess = () => {
        if (req.result && req.result.value !== undefined) {
          memoryFallback.cache.set(key, req.result.value)
          resolve(req.result.value as T)
        } else {
          resolve(null)
        }
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function setAppCache<T>(key: string, value: T): Promise<void> {
  memoryFallback.cache.set(key, value)

  const db = await getDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_CACHE, 'readwrite')
      tx.objectStore(STORE_CACHE).put({
        key,
        value,
        updated_at: Date.now()
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function removeAppCache(key: string): Promise<void> {
  memoryFallback.cache.delete(key)

  const db = await getDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_CACHE, 'readwrite')
      tx.objectStore(STORE_CACHE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function clearAllOfflineStorage(): Promise<void> {
  memoryFallback.media.clear()
  memoryFallback.queue = []
  memoryFallback.cache.clear()

  const db = await getDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_MEDIA, STORE_QUEUE, STORE_CACHE], 'readwrite')
      tx.objectStore(STORE_MEDIA).clear()
      tx.objectStore(STORE_QUEUE).clear()
      tx.objectStore(STORE_CACHE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}
