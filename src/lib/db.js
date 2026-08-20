const DB_NAME = 'shopify-price-entry'
const DB_VERSION = 1
const STORE_SESSIONS = 'sessions' // données du fichier (headers, rows) - écrit une fois par fichier
const STORE_PRICES = 'prices' // prix saisis - écrit à chaque saisie
const LAST_SIGNATURE_KEY = 'priceapp:lastSignature'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'signature' })
      }
      if (!db.objectStoreNames.contains(STORE_PRICES)) {
        db.createObjectStore(STORE_PRICES, { keyPath: 'signature' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName)
}

export async function saveSession(signature, fileName, headers, rows) {
  const db = await openDb()
  await new Promise((resolve, reject) => {
    const store = tx(db, STORE_SESSIONS, 'readwrite')
    const req = store.put({ signature, fileName, headers, rows, savedAt: Date.now() })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
  localStorage.setItem(LAST_SIGNATURE_KEY, signature)
}

export async function loadSession(signature) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_SESSIONS, 'readonly')
    const req = store.get(signature)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function savePrices(signature, prices) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_PRICES, 'readwrite')
    const req = store.put({ signature, prices, updatedAt: Date.now() })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function loadPrices(signature) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_PRICES, 'readonly')
    const req = store.get(signature)
    req.onsuccess = () => resolve(req.result ? req.result.prices : {})
    req.onerror = () => reject(req.error)
  })
}

export function getLastSignature() {
  return localStorage.getItem(LAST_SIGNATURE_KEY)
}

export async function clearAll() {
  const db = await openDb()
  await Promise.all([
    new Promise((resolve, reject) => {
      const req = tx(db, STORE_SESSIONS, 'readwrite').clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    }),
    new Promise((resolve, reject) => {
      const req = tx(db, STORE_PRICES, 'readwrite').clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    }),
  ])
  localStorage.removeItem(LAST_SIGNATURE_KEY)
}
