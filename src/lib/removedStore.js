// Store en mémoire (pub/sub) des produits signalés "pas encore dans le store",
// même principe que priceStore.js mais indexé par handle plutôt que par ligne.

const removed = new Set()
const listeners = new Map() // handle -> Set<() => void>
const globalListeners = new Set() // écoute tout changement, quel que soit le handle
let version = 0

export function isRemoved(handle) {
  return removed.has(handle)
}

function notify(handle) {
  version += 1
  const subs = listeners.get(handle)
  if (subs) subs.forEach((fn) => fn())
  globalListeners.forEach((fn) => fn())
}

export function setRemovedLocal(handle, value) {
  const was = removed.has(handle)
  if (value === was) return
  if (value) removed.add(handle)
  else removed.delete(handle)
  notify(handle)
}

/** Remplace tout le contenu du store (chargement d'un nouveau catalogue). */
export function initRemoved(handles) {
  removed.clear()
  handles.forEach((h) => removed.add(h))
  version += 1
  listeners.forEach((subs) => subs.forEach((fn) => fn()))
  globalListeners.forEach((fn) => fn())
}

/** Fusionne une liste de handles distants (venant du serveur) sans tout écraser. */
export function mergeRemoteRemoved(handles) {
  const nextSet = new Set(handles)
  const allHandles = new Set([...removed, ...nextSet])
  allHandles.forEach((h) => setRemovedLocal(h, nextSet.has(h)))
}

export function subscribeRemoved(handle, cb) {
  let subs = listeners.get(handle)
  if (!subs) {
    subs = new Set()
    listeners.set(handle, subs)
  }
  subs.add(cb)
  return () => {
    subs.delete(cb)
    if (subs.size === 0) listeners.delete(handle)
  }
}

/** S'abonne à tout changement du store, pour filtrer/compter au niveau de l'app. */
export function subscribeAnyRemoved(cb) {
  globalListeners.add(cb)
  return () => globalListeners.delete(cb)
}

/** Nombre de changements survenus depuis le début (snapshot stable pour useSyncExternalStore). */
export function getRemovedVersion() {
  return version
}

export function snapshotRemoved() {
  return new Set(removed)
}
