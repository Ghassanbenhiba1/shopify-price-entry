// Petit store en mémoire (pub/sub) partagé par tous les champs de prix.
// Permet à un composant ProductCard de se mettre à jour instantanément
// quand un prix change ailleurs (saisie locale ou mise à jour distante
// reçue via Firestore), sans faire re-rendre toute la grille de produits.

const values = new Map() // rowIndex (number) -> prix (string)
const listeners = new Map() // rowIndex (number) -> Set<() => void>

export function getPrice(rowIndex) {
  return values.get(rowIndex) ?? ''
}

export function setPrice(rowIndex, value) {
  if (values.get(rowIndex) === value) return
  values.set(rowIndex, value)
  const subs = listeners.get(rowIndex)
  if (subs) subs.forEach((fn) => fn())
}

/** Remplace tout le contenu du store (chargement d'un nouveau fichier). */
export function initPrices(map) {
  values.clear()
  Object.entries(map).forEach(([k, v]) => values.set(Number(k), v))
  listeners.forEach((subs) => subs.forEach((fn) => fn()))
}

/** Fusionne des prix distants sans écraser les lignes non concernées. */
export function mergeRemotePrices(map) {
  Object.entries(map).forEach(([k, v]) => setPrice(Number(k), v))
}

export function subscribe(rowIndex, cb) {
  let subs = listeners.get(rowIndex)
  if (!subs) {
    subs = new Set()
    listeners.set(rowIndex, subs)
  }
  subs.add(cb)
  return () => {
    subs.delete(cb)
    if (subs.size === 0) listeners.delete(rowIndex)
  }
}

/** Instantané complet du store (utilisé pour l'export CSV et la sauvegarde locale). */
export function snapshotAllPrices() {
  return Object.fromEntries(values.entries())
}
