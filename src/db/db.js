const DB_NAME = 'hiking-gear-db'
const DB_VERSION = 1

const STORES = ['gear_items', 'route_templates', 'route_items', 'check_records']

let dbPromise = null

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('gear_items')) {
          db.createObjectStore('gear_items', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('route_templates')) {
          db.createObjectStore('route_templates', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('route_items')) {
          const store = db.createObjectStore('route_items', { keyPath: 'id' })
          store.createIndex('route_id', 'route_id', { unique: false })
        }
        if (!db.objectStoreNames.contains('check_records')) {
          const store = db.createObjectStore('check_records', { keyPath: 'id' })
          store.createIndex('date', 'date', { unique: false })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function requestResult(db, storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    const txn = db.transaction(storeName, mode)
    const store = txn.objectStore(storeName)
    let payload
    const req = fn(store)
    if (req) {
      req.onsuccess = () => {
        payload = req.result
      }
      req.onerror = () => reject(req.error)
    }
    txn.oncomplete = () => resolve(payload)
    txn.onerror = () => reject(txn.error)
    txn.onabort = () => reject(txn.error)
  })
}

async function read(storeName, fn) {
  const db = await openDB()
  return requestResult(db, storeName, 'readonly', fn)
}

async function write(storeName, fn) {
  const db = await openDB()
  return requestResult(db, storeName, 'readwrite', fn)
}

export function getAll(storeName) {
  return read(storeName, (store) => store.getAll())
}

export function getById(storeName, id) {
  return read(storeName, (store) => store.get(id))
}

export function getByIndex(storeName, indexName, value) {
  return read(storeName, (store) => store.index(indexName).getAll(value))
}

function toPlain(value) {
  if (value === null || value === undefined) return value
  return JSON.parse(JSON.stringify(value))
}

export function put(storeName, value) {
  return write(storeName, (store) => store.put(toPlain(value)))
}

export function bulkPut(storeName, values) {
  return write(storeName, (store) => {
    values.forEach((v) => store.put(toPlain(v)))
  })
}

export function remove(storeName, id) {
  return write(storeName, (store) => store.delete(id))
}

export function clear(storeName) {
  return write(storeName, (store) => store.clear())
}

export function removeByIndex(storeName, indexName, value) {
  return write(storeName, (store) => {
    store.index(indexName).openCursor(value).onsuccess = (e) => {
      const cursor = e.target.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
  })
}

export function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID()
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

export function storeNames() {
  return STORES.slice()
}