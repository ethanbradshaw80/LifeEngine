/**
 * IndexedDB persistence. THE ONLY I/O IN THE PROJECT.
 *
 * The engine and the persistence package are both pure — they convert data and
 * touch nothing (ADR-0003). All reading and writing happens here, in the web
 * app, which is why the engine can run unchanged in a Worker today and on a
 * server at Milestone 6.
 *
 * Storage rules that matter:
 *
 * - **Never overwrite a good save with a bad one.** A failed load leaves the
 *   stored bytes exactly where they were, so a bug in this build cannot destroy
 *   progress made by the last one.
 * - **A quota error is not a crash.** Browsers evict IndexedDB under storage
 *   pressure and refuse writes when full. Both are reported, not thrown into
 *   the void.
 */

import type { SaveFile } from '@life-engine/persistence'

const DB_NAME = 'life-engine'
const DB_VERSION = 1
const STORE = 'saves'

/** Single slot until Milestone 6. Named save slots are explicitly out of scope. */
export const CURRENT_SLOT = 'current'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the save database'))
    request.onblocked = () =>
      reject(new Error('Another tab is holding the save database open. Close it and try again.'))
  })
}

export interface StorageResult {
  readonly ok: boolean
  readonly message?: string
}

export async function writeSave(save: SaveFile, slot: string = CURRENT_SLOT): Promise<StorageResult> {
  let db: IDBDatabase
  try {
    db = await openDatabase()
  } catch (error) {
    return { ok: false, message: describe(error) }
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(save, slot)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Save failed'))
      tx.onabort = () => reject(tx.error ?? new Error('Save was aborted'))
    })
    return { ok: true }
  } catch (error) {
    // QuotaExceededError is the one worth naming: it means the browser is out
    // of room, which the player can act on.
    const message =
      error instanceof DOMException && error.name === 'QuotaExceededError'
        ? 'There is no room left in browser storage for this save.'
        : describe(error)
    return { ok: false, message }
  } finally {
    db.close()
  }
}

export async function readSave(slot: string = CURRENT_SLOT): Promise<unknown> {
  const db = await openDatabase()
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(slot)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not read the save'))
    })
  } finally {
    db.close()
  }
}

export async function hasSave(slot: string = CURRENT_SLOT): Promise<boolean> {
  try {
    return (await readSave(slot)) !== undefined
  } catch {
    return false
  }
}

export async function deleteSave(slot: string = CURRENT_SLOT): Promise<StorageResult> {
  let db: IDBDatabase
  try {
    db = await openDatabase()
  } catch (error) {
    return { ok: false, message: describe(error) }
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(slot)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Delete failed'))
    })
    return { ok: true }
  } catch (error) {
    return { ok: false, message: describe(error) }
  } finally {
    db.close()
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unknown storage error'
}
