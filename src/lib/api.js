// Client pour l'API backend (Node.js + Express + MySQL), source de vérité
// partagée du catalogue produits et des prix.

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export const apiEnabled = Boolean(API_BASE)

function apiUrl(path) {
  return `${API_BASE}${path}`
}

/** Récupère le catalogue produits (headers + rows) depuis le serveur. */
export async function fetchProducts() {
  const res = await fetch(apiUrl('/api/products'), { cache: 'no-store' })
  if (!res.ok) throw new Error('Impossible de récupérer le catalogue produits depuis le serveur.')
  const data = await res.json()
  return { headers: data.headers, rows: data.rows }
}

/** Envoie un nouveau CSV pour remplacer le catalogue partagé, pour tout le monde. */
export async function uploadProducts(csvText) {
  const res = await fetch(apiUrl('/api/products'), {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv' },
    body: csvText,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || "Impossible d'envoyer le catalogue au serveur.")
  }
}

/** Récupère tous les prix actuels depuis le serveur. */
export async function fetchPrices() {
  const res = await fetch(apiUrl('/api/prices'), { cache: 'no-store' })
  if (!res.ok) throw new Error('Impossible de récupérer les prix depuis le serveur.')
  const data = await res.json()
  return data.prices || {}
}

/** Envoie le nouveau prix d'une ligne au serveur. */
export async function pushPrice(rowIndex, price) {
  await fetch(apiUrl('/api/prices'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rowIndex, price }),
  })
}

/** Récupère la liste des produits signalés "pas encore dans le store". */
export async function fetchRemoved() {
  const res = await fetch(apiUrl('/api/removed'), { cache: 'no-store' })
  if (!res.ok) throw new Error('Impossible de récupérer les produits signalés depuis le serveur.')
  const data = await res.json()
  return data.removed || []
}

/** Signale (ou annule le signalement d') un produit comme absent du store. */
export async function pushRemoved(handle, removed) {
  await fetch(apiUrl('/api/removed'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle, removed }),
  })
}

/**
 * Interroge le serveur à intervalle régulier (synchronisation "quasi temps
 * réel" par polling, fiable même derrière un hébergement mutualisé cPanel).
 */
function poll(fetchFn, onChange, intervalMs) {
  let stopped = false
  const tick = async () => {
    if (stopped) return
    try {
      const data = await fetchFn()
      onChange(data)
    } catch {
      // Ignoré : on retentera au prochain intervalle.
    }
  }
  tick()
  const id = setInterval(tick, intervalMs)
  return () => {
    stopped = true
    clearInterval(id)
  }
}

export function pollPrices(onChange, intervalMs = 4000) {
  return poll(fetchPrices, onChange, intervalMs)
}

export function pollRemoved(onChange, intervalMs = 4000) {
  return poll(fetchRemoved, onChange, intervalMs)
}
