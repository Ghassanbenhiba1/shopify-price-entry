// Store en mémoire (pub/sub) des produits dont le prix a été vérifié/confirmé,
// même principe que removedStore.js.

const confirmed = new Set()
const listeners = new Map() // handle -> Set<() => void>
const globalListeners = new Set() // écoute tout changement, quel que soit le handle
let version = 0

export function isConfirmed(handle) {
  return confirmed.has(handle)
}

function notify(handle) {
  version += 1
  const subs = listeners.get(handle)
  if (subs) subs.forEach((fn) => fn())
  globalListeners.forEach((fn) => fn())
}

export function setConfirmedLocal(handle, value) {
  const was = confirmed.has(handle)
  if (value === was) return
  if (value) confirmed.add(handle)
  else confirmed.delete(handle)
  notify(handle)
}

/** Remplace tout le contenu du store (chargement d'un nouveau catalogue). */
export function initConfirmed(handles) {
  confirmed.clear()
  handles.forEach((h) => confirmed.add(h))
  version += 1
  listeners.forEach((subs) => subs.forEach((fn) => fn()))
  globalListeners.forEach((fn) => fn())
}

/** Fusionne une liste de handles distants (venant du serveur) sans tout écraser. */
export function mergeRemoteConfirmed(handles) {
  const nextSet = new Set(handles)
  const allHandles = new Set([...confirmed, ...nextSet])
  allHandles.forEach((h) => setConfirmedLocal(h, nextSet.has(h)))
}

export function subscribeConfirmed(handle, cb) {
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
export function subscribeAnyConfirmed(cb) {
  globalListeners.add(cb)
  return () => globalListeners.delete(cb)
}

/** Nombre de changements survenus depuis le début (snapshot stable pour useSyncExternalStore). */
export function getConfirmedVersion() {
  return version
}

export function snapshotConfirmed() {
  return new Set(confirmed)
}
