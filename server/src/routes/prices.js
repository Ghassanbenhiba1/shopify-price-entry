import { Router } from 'express'
import { getAllPrices, upsertPrice, seedInitialPrices, countPrices } from '../db.js'
import { readProductsCsv, getInitialPrices } from '../csv.js'

const router = Router()
const CSV_PATH = new URL('../../data/products_export.csv', import.meta.url)

// Au tout premier appel (table vide), on amorce la base avec les prix déjà
// présents dans le CSV, pour ne pas repartir de zéro.
async function ensureSeeded() {
  const existing = await countPrices()
  if (existing > 0) return
  const { rows } = await readProductsCsv(CSV_PATH)
  const initial = getInitialPrices(rows)
  await seedInitialPrices(initial)
}

router.get('/prices', async (req, res) => {
  try {
    await ensureSeeded()
    const prices = await getAllPrices()
    res.json({ prices })
  } catch (err) {
    res.status(500).json({ error: 'Impossible de lire les prix.', detail: err.message })
  }
})

router.post('/prices', async (req, res) => {
  const { rowIndex, price } = req.body || {}
  if (rowIndex === undefined || rowIndex === null || Number.isNaN(Number(rowIndex))) {
    return res.status(400).json({ error: "Paramètre 'rowIndex' invalide." })
  }
  if (typeof price !== 'string') {
    return res.status(400).json({ error: "Paramètre 'price' invalide." })
  }
  try {
    await upsertPrice(Number(rowIndex), price)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: "Impossible d'enregistrer le prix.", detail: err.message })
  }
})

export default router
