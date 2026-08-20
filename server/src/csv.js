import { readFile } from 'node:fs/promises'
import Papa from 'papaparse'

const PAPA_OPTIONS = {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: false,
  transform: (value) => (value === null || value === undefined ? '' : value),
}

/** Lit et parse le CSV du catalogue produits stocké côté serveur. */
export async function readProductsCsv(path) {
  const text = await readFile(path, 'utf8')
  const { data, meta, errors } = Papa.parse(text, PAPA_OPTIONS)
  return { headers: meta.fields || [], rows: data, errors }
}

function formatPrice(value) {
  const num = parseFloat(String(value).replace(',', '.'))
  if (Number.isNaN(num)) return ''
  return num.toFixed(2)
}

/** Extrait les prix déjà présents dans le CSV (colonne "Variant Price"). */
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
