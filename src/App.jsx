import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Dropzone from './components/Dropzone'
import Toolbar from './components/Toolbar'
import ProductCard from './components/ProductCard'
import { parseCsvFile, groupRowsByHandle, computeFileSignature, buildExportCsv, getInitialPrices } from './lib/csv'
import { saveSession, loadSession, savePrices, loadPrices, getLastSignature, clearAll } from './lib/db'
import { initPrices, mergeRemotePrices, snapshotAllPrices } from './lib/priceStore'
import { initRemoved, mergeRemoteRemoved, isRemoved, subscribeAnyRemoved, getRemovedVersion } from './lib/removedStore'
import {
  initConfirmed,
  mergeRemoteConfirmed,
  isConfirmed,
  subscribeAnyConfirmed,
  getConfirmedVersion,
} from './lib/confirmedStore'
import {
  fetchProducts,
  fetchPrices,
  pushPrice,
  pollPrices,
  fetchRemoved,
  pushRemoved,
  pollRemoved,
  fetchConfirmed,
  pushConfirmed,
  pollConfirmed,
  uploadProducts,
  apiEnabled,
} from './lib/api'

const SAVE_DEBOUNCE_MS = 500
const MANUAL_FLAG_KEY = 'priceapp:manualFile'

export default function App() {
  const [status, setStatus] = useState('idle') // idle | loading | ready
  const [errorMsg, setErrorMsg] = useState('')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [signature, setSignature] = useState('')
  const [search, setSearch] = useState('')
  // Filtrer ~900 cartes est coûteux (montage/démontage DOM) ; on découple la
  // saisie (instantanée) du recalcul de la grille pour que taper reste fluide.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'noImage' | 'removed' | 'confirmed'
  const [mode, setMode] = useState('shared') // 'shared' (API partagée) | 'manual' (fichier local)

  // Se re-rend quand un produit est signalé/désignalé "pas encore dans le store",
  // pour que le filtre et les compteurs restent à jour.
  useSyncExternalStore(subscribeAnyRemoved, getRemovedVersion)
  // Idem pour les confirmations de prix.
  useSyncExternalStore(subscribeAnyConfirmed, getConfirmedVersion)

  const saveTimer = useRef(null)
  const stopPolling = useRef(null)
  const stopPollingRemoved = useRef(null)
  const stopPollingConfirmed = useRef(null)
  const modeRef = useRef('shared')

  const products = useMemo(() => (rows.length ? groupRowsByHandle(rows) : []), [rows])

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(id)
  }, [search])

  const stopSync = useCallback(() => {
    if (stopPolling.current) {
      stopPolling.current()
      stopPolling.current = null
    }
    if (stopPollingRemoved.current) {
      stopPollingRemoved.current()
      stopPollingRemoved.current = null
    }
    if (stopPollingConfirmed.current) {
      stopPollingConfirmed.current()
      stopPollingConfirmed.current = null
    }
  }, [])

  /** Charge le catalogue partagé + les prix depuis l'API, puis démarre la synchro par polling. */
  const loadSharedCatalog = useCallback(async () => {
    setStatus('loading')
    setErrorMsg('')
    stopSync()
    try {
      const { headers: h, rows: r } = await fetchProducts()
      if (!h.includes('Handle') || !h.includes('Variant Price')) {
        throw new Error('Le catalogue reçu du serveur ne ressemble pas à un export Shopify valide.')
      }
      const prices = await fetchPrices()
      initPrices(prices)
      const removedHandles = await fetchRemoved()
      initRemoved(removedHandles)
      const confirmedHandles = await fetchConfirmed()
      initConfirmed(confirmedHandles)
      localStorage.removeItem(MANUAL_FLAG_KEY)
      modeRef.current = 'shared'
      setMode('shared')
      setHeaders(h)
      setRows(r)
      setFileName('Catalogue partagé')
      setSignature('')
      setStatus('ready')
      if (apiEnabled) {
        stopPolling.current = pollPrices((remotePrices) => mergeRemotePrices(remotePrices))
        stopPollingRemoved.current = pollRemoved((remoteRemoved) => mergeRemoteRemoved(remoteRemoved))
        stopPollingConfirmed.current = pollConfirmed((remoteConfirmed) => mergeRemoteConfirmed(remoteConfirmed))
      }
    } catch (err) {
      setErrorMsg(err.message || 'Impossible de contacter le serveur.')
      setStatus('idle')
    }
  }, [stopSync])

  /** Envoie le CSV choisi au serveur pour remplacer le catalogue partagé (visible par tout le monde). */
  const uploadSharedCatalog = useCallback(async (file) => {
    setStatus('loading')
    setErrorMsg('')
    stopSync()
    try {
      const csvText = await file.text()
      const firstLine = csvText.split(/\r?\n/, 1)[0] || ''
      if (!firstLine.includes('Handle') || !firstLine.includes('Variant Price')) {
        throw new Error(
          "Ce fichier ne ressemble pas à un export Shopify valide (colonnes 'Handle' / 'Variant Price' manquantes)."
        )
      }
      await uploadProducts(csvText)
      await loadSharedCatalog()
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de l'envoi du fichier au serveur.")
      setStatus('idle')
    }
  }, [stopSync, loadSharedCatalog])

  /** Import local uniquement (filet de secours quand l'API n'est pas configurée) : reste sur cet appareil. */
  const loadManualFile = useCallback(async (file) => {
    setStatus('loading')
    setErrorMsg('')
    stopSync()
    try {
      const { headers: h, rows: r } = await parseCsvFile(file)
      if (!h.includes('Handle') || !h.includes('Variant Price')) {
        throw new Error(
          "Ce fichier ne ressemble pas à un export Shopify valide (colonnes 'Handle' / 'Variant Price' manquantes)."
        )
      }
      const sig = computeFileSignature(file, r.length)
      const existingPrices = await loadPrices(sig)
      const csvPrices = getInitialPrices(r)
      const mergedPrices = { ...csvPrices, ...(existingPrices || {}) }
      initPrices(mergedPrices)
      initRemoved([])
      initConfirmed([])
      await saveSession(sig, file.name, h, r)
      await savePrices(sig, mergedPrices)
      localStorage.setItem(MANUAL_FLAG_KEY, '1')
      modeRef.current = 'manual'
      setMode('manual')
      setHeaders(h)
      setRows(r)
      setFileName(file.name)
      setSignature(sig)
      setStatus('ready')
    } catch (err) {
      setErrorMsg(err.message || 'Erreur lors de la lecture du fichier.')
      setStatus('idle')
    }
  }, [stopSync])

  const handleFileChosen = apiEnabled ? uploadSharedCatalog : loadManualFile

  // Au démarrage : restaure un fichier importé manuellement s'il y en a un,
  // sinon charge le catalogue partagé (API) avec synchro des prix.
  useEffect(() => {
    ;(async () => {
      const isManual = localStorage.getItem(MANUAL_FLAG_KEY) === '1'
      const last = getLastSignature()
      if (isManual && last) {
        setStatus('loading')
        try {
          const session = await loadSession(last)
          if (session) {
            const prices = await loadPrices(last)
            const csvPrices = getInitialPrices(session.rows)
            initPrices({ ...csvPrices, ...(prices || {}) })
            modeRef.current = 'manual'
            setMode('manual')
            setHeaders(session.headers)
            setRows(session.rows)
            setFileName(session.fileName)
            setSignature(session.signature)
            setStatus('ready')
            return
          }
        } catch {
          // Continue vers le chargement du catalogue partagé ci-dessous.
        }
      }
      await loadSharedCatalog()
    })()
    return () => stopSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePriceChange = useCallback((rowIndex, value) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (modeRef.current === 'manual') {
        savePrices(signature, snapshotAllPrices())
      } else if (apiEnabled) {
        pushPrice(rowIndex, value)
      }
    }, SAVE_DEBOUNCE_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const handleRemovedChange = useCallback((handle, value) => {
    if (modeRef.current === 'shared' && apiEnabled) {
      pushRemoved(handle, value)
    }
  }, [])

  const handleConfirmedChange = useCallback((handle, value) => {
    if (modeRef.current === 'shared' && apiEnabled) {
      pushConfirmed(handle, value)
    }
  }, [])

  const handleClearStorage = useCallback(async () => {
    await clearAll()
    localStorage.removeItem(MANUAL_FLAG_KEY)
    await loadSharedCatalog()
  }, [loadSharedCatalog])

  const handleExport = useCallback(() => {
    const csv = buildExportCsv(headers, rows, snapshotAllPrices())
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const base = mode === 'manual' ? fileName.replace(/\.csv$/i, '') || 'products_export' : 'products_export'
    a.href = url
    a.download = `${base}_prix_maj.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [headers, rows, fileName, mode])

  // Les produits confirmés sortent des vues "Tous" / "Sans image" / "À enlever"
  // pour ne laisser que ce qui reste à vérifier ; ils restent visibles via "Confirmé".
  const unconfirmedProducts = useMemo(
    () => products.filter((p) => !isConfirmed(p.handle)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, getConfirmedVersion()]
  )
  const confirmedCount = useMemo(
    () => products.length - unconfirmedProducts.length,
    [products, unconfirmedProducts]
  )
  const noImageCount = useMemo(() => unconfirmedProducts.filter((p) => !p.image).length, [unconfirmedProducts])
  const removedCount = useMemo(
    () => unconfirmedProducts.filter((p) => isRemoved(p.handle)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unconfirmedProducts, getRemovedVersion()]
  )

  const filteredProducts = useMemo(() => {
    let list
    if (filter === 'confirmed') {
      list = products.filter((p) => isConfirmed(p.handle))
    } else if (filter === 'noImage') {
      list = unconfirmedProducts.filter((p) => !p.image)
    } else if (filter === 'removed') {
      list = unconfirmedProducts.filter((p) => isRemoved(p.handle))
    } else {
      list = unconfirmedProducts
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase()
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q))
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, unconfirmedProducts, debouncedSearch, filter, getRemovedVersion()])

  if (status === 'idle' || status === 'loading') {
    return (
      <Dropzone
        onFile={handleFileChosen}
        loading={status === 'loading'}
        errorMsg={errorMsg}
        apiEnabled={apiEnabled}
      />
    )
  }

  return (
    <div className="app">
      <Toolbar
        fileName={fileName}
        syncEnabled={apiEnabled && mode === 'shared'}
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        totalCount={unconfirmedProducts.length}
        noImageCount={noImageCount}
        removedCount={removedCount}
        confirmedCount={confirmedCount}
        onExport={handleExport}
        onChangeFile={() => {
          stopSync()
          setStatus('idle')
        }}
        onClearStorage={handleClearStorage}
      />
      <main className="grid">
        {filteredProducts.length === 0 && (
          <p className="empty-state">Aucun produit ne correspond à ce filtre.</p>
        )}
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.handle}
            product={product}
            onPriceChange={handlePriceChange}
            onRemovedChange={handleRemovedChange}
            onConfirmedChange={handleConfirmedChange}
          />
        ))}
      </main>
    </div>
  )
}
