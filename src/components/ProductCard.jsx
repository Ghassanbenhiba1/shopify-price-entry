import { memo, useCallback, useSyncExternalStore } from 'react'
import { formatPrice, variantLabel } from '../lib/csv'
import { getPrice, setPrice, subscribe } from '../lib/priceStore'
import { isRemoved, setRemovedLocal, subscribeRemoved } from '../lib/removedStore'

function PriceField({ rowIndex, label, onCommit }) {
  const value = useSyncExternalStore(
    useCallback((cb) => subscribe(rowIndex, cb), [rowIndex]),
    useCallback(() => getPrice(rowIndex), [rowIndex])
  )

  const handleChange = (e) => {
    const raw = e.target.value
    setPrice(rowIndex, raw)
    onCommit(rowIndex, raw)
  }

  const handleBlur = () => {
    const current = getPrice(rowIndex)
    if (current === '') return
    const formatted = formatPrice(current)
    if (formatted === '' || formatted === current) return
    setPrice(rowIndex, formatted)
    onCommit(rowIndex, formatted)
  }

  return (
    <div className="card__price-field">
      {label && <span className="card__variant-label">{label}</span>}
      <div className="card__price-input">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        <span className="card__currency">€</span>
      </div>
    </div>
  )
}

/** Vrai si toutes les variantes du produit ont un prix, mis à jour en direct. */
function useAllFilled(variants) {
  const subscribeAll = useCallback(
    (cb) => {
      const unsubs = variants.map((v) => subscribe(v.rowIndex, cb))
      return () => unsubs.forEach((u) => u())
    },
    [variants]
  )
  const getSnapshot = useCallback(
    () => variants.length > 0 && variants.every((v) => String(getPrice(v.rowIndex)).trim() !== ''),
    [variants]
  )
  return useSyncExternalStore(subscribeAll, getSnapshot)
}

function ProductCard({ product, onPriceChange, onRemovedChange }) {
  const { title, image, variants, handle } = product
  const allFilled = useAllFilled(variants)
  const removed = useSyncExternalStore(
    useCallback((cb) => subscribeRemoved(handle, cb), [handle]),
    useCallback(() => isRemoved(handle), [handle])
  )

  const toggleRemoved = () => {
    const next = !removed
    setRemovedLocal(handle, next)
    onRemovedChange(handle, next)
  }

  return (
    <div className={`card ${allFilled ? 'card--done' : ''} ${removed ? 'card--removed' : ''}`}>
      <div className="card__image">
        {image ? (
          <img src={image} alt={title || handle} loading="lazy" />
        ) : (
          <div className="card__placeholder">Pas d'image</div>
        )}
      </div>
      <div className="card__body">
        <h3 className="card__title" title={title || handle}>
          {title || handle}
        </h3>

        {removed && <p className="card__removed-tag">🚫 Signalé : pas encore dans le store</p>}

        {variants.length > 1 ? (
          <div className="card__variants">
            {variants.map((v, i) => (
              <PriceField key={v.rowIndex} rowIndex={v.rowIndex} label={variantLabel(v, i)} onCommit={onPriceChange} />
            ))}
          </div>
        ) : variants.length === 1 ? (
          <PriceField rowIndex={variants[0].rowIndex} onCommit={onPriceChange} />
        ) : (
          <p className="card__no-variant">Aucune ligne de variante détectée.</p>
        )}

        <button type="button" className="card__remove-btn" onClick={toggleRemoved}>
          {removed ? 'Annuler le signalement' : 'Enlever — pas encore dans le store'}
        </button>
      </div>
    </div>
  )
}

export default memo(ProductCard)
