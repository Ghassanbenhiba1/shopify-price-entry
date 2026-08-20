import { Router } from 'express'
import { writeFile } from 'node:fs/promises'
import { readProductsCsv, getInitialPrices } from '../csv.js'
import { seedInitialPrices } from '../db.js'

const router = Router()
const CSV_PATH = new URL('../../data/products_export.csv', import.meta.url)

// Toujours relu depuis le disque : remplacer le fichier sur le serveur suffit
// à mettre à jour le catalogue, sans redémarrer l'application.
router.get('/products', async (req, res) => {
  try {
    const { headers, rows, errors } = await readProductsCsv(CSV_PATH)
    res.json({ headers, rows, errors: errors.length })
  } catch (err) {
    res.status(500).json({ error: 'Impossible de lire le catalogue produits.', detail: err.message })
  }
})

// Remplace le catalogue partagé par le CSV envoyé, pour tous les visiteurs.
router.post('/products', async (req, res) => {
  const csvText = req.body
  if (typeof csvText !== 'string' || !csvText.trim()) {
    return res.status(400).json({ error: 'Fichier CSV vide ou invalide.' })
  }
  const firstLine = csvText.split(/\r?\n/, 1)[0] || ''
  if (!firstLine.includes('Handle') || !firstLine.includes('Variant Price')) {
    return res.status(400).json({
      error: "Ce fichier ne ressemble pas à un export Shopify valide (colonnes 'Handle' / 'Variant Price' manquantes).",
    })
  }
  try {
    await writeFile(CSV_PATH, csvText, 'utf-8')
    const { rows } = await readProductsCsv(CSV_PATH)
    await seedInitialPrices(getInitialPrices(rows))
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: "Impossible d'enregistrer le catalogue produits.", detail: err.message })
  }
})

export default router
