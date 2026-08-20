import Papa from 'papaparse'

// Colonnes attendues dans un export Shopify standard.
export const REQUIRED_COLUMNS = ['Handle', 'Title', 'Variant SKU', 'Variant Price', 'Image Src']

const PAPA_OPTIONS = {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: false,
  transform: (value) => (value === null || value === undefined ? '' : value),
}

/**
 * Parse un CSV (fichier importé par l'utilisateur ou texte déjà en mémoire)
 * côté client avec PapaParse. Retourne { headers, rows, errors }.
 */
function parseWithPapa(input) {
  return new Promise((resolve, reject) => {
    Papa.parse(input, {
      ...PAPA_OPTIONS,
      complete: (results) => {
        const headers = results.meta.fields || []
        const rows = results.data
        resolve({ headers, rows, errors: results.errors || [] })
      },
      error: (err) => reject(err),
    })
  })
}

/** Parse un fichier CSV importé par l'utilisateur (objet File). */
export function parseCsvFile(file) {
  return parseWithPapa(file)
}

/** Parse un CSV déjà chargé en mémoire sous forme de texte. */
export function parseCsvText(text) {
  return parseWithPapa(text)
}

/**
 * Regroupe les lignes du CSV par Handle.
 * Chaque groupe = un produit, avec son titre, son image et la liste
 * des lignes "variante" (celles qui portent un SKU et/ou des valeurs d'option).
 */
export function groupRowsByHandle(rows) {
  const order = []
  const map = new Map()

  rows.forEach((row, rowIndex) => {
    const handle = (row.Handle || '').trim()
    if (!handle) return

    let group = map.get(handle)
    if (!group) {
      group = { handle, title: '', image: '', variants: [] }
      map.set(handle, group)
      order.push(handle)
    }

    if (!group.title && row.Title && row.Title.trim()) {
      group.title = row.Title.trim()
    }

    const imgSrc = (row['Image Src'] || '').trim()
    if (imgSrc) {
      const pos = (row['Image Position'] || '').trim()
      if (pos === '1' || !group.image) {
        group.image = imgSrc
      }
    }

    const sku = (row['Variant SKU'] || '').trim()
    const opt1 = (row['Option1 Value'] || '').trim()
    const opt2 = (row['Option2 Value'] || '').trim()
    const opt3 = (row['Option3 Value'] || '').trim()
    const isVariantRow = sku !== '' || opt1 !== ''

    if (isVariantRow) {
      group.variants.push({ rowIndex, sku, opt1, opt2, opt3 })
    }
  })

  return order.map((h) => map.get(h))
}

/** Construit un libellé lisible pour une variante (options combinées, sinon SKU). */
export function variantLabel(variant, index) {
  const parts = [variant.opt1, variant.opt2, variant.opt3].filter(Boolean)
  if (parts.length > 0) return parts.join(' / ')
  if (variant.sku) return variant.sku
  return `Variante ${index + 1}`
}

/**
 * Extrait les prix déjà présents dans le CSV importé (colonne "Variant Price"
 * déjà remplie) pour pré-remplir automatiquement les champs correspondants.
 * Retourne une carte rowIndex -> prix formaté (string).
 */
export function getInitialPrices(rows) {
  const prices = {}
  rows.forEach((row, rowIndex) => {
    const raw = (row['Variant Price'] || '').trim()
    if (raw === '') return
    const formatted = formatPrice(raw)
    if (formatted !== '') prices[rowIndex] = formatted
  })
  return prices
}

/**
 * Calcule une signature simple pour associer la progression sauvegardée
 * à un fichier CSV précis (nom + taille + nombre de lignes).
 */
export function computeFileSignature(file, rowCount) {
  return `${file.name}::${file.size}::${rowCount}`
}

/**
 * Régénère le CSV complet à partir des lignes d'origine, de la carte de prix
 * saisis (rowIndex -> prix string) et des produits signalés comme "pas encore
 * dans le store" (Set de handles) : leur Status passe à "draft" (uniquement
 * sur la ligne où Status est déjà renseigné, comme dans l'export Shopify
 * d'origine). Conserve colonnes et ordre.
 */
export function buildExportCsv(headers, rows, prices, removedHandles = new Set()) {
  const outRows = rows.map((row, rowIndex) => {
    let outRow = row

    if (Object.prototype.hasOwnProperty.call(prices, rowIndex)) {
      const price = prices[rowIndex]
      if (price !== undefined && price !== null && String(price).trim() !== '') {
        outRow = { ...outRow, 'Variant Price': formatPrice(price) }
      }
    }

    if (removedHandles.has((row.Handle || '').trim()) && (row.Status || '').trim() !== '') {
      outRow = { ...outRow, Status: 'draft' }
    }

    return outRow
  })

  return Papa.unparse(
    { fields: headers, data: outRows },
    { newline: '\r\n' }
  )
}

export function formatPrice(value) {
  const num = parseFloat(String(value).replace(',', '.'))
  if (Number.isNaN(num)) return ''
  return num.toFixed(2)
}
