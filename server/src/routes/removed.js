import { Router } from 'express'
import { getRemovedHandles, setRemoved } from '../db.js'

const router = Router()

router.get('/removed', async (req, res) => {
  try {
    const handles = await getRemovedHandles()
    res.json({ removed: handles })
  } catch (err) {
    res.status(500).json({ error: 'Impossible de lire les produits signalés.', detail: err.message })
  }
})

router.post('/removed', async (req, res) => {
  const { handle, removed } = req.body || {}
  if (typeof handle !== 'string' || handle.trim() === '') {
    return res.status(400).json({ error: "Paramètre 'handle' invalide." })
  }
  try {
    await setRemoved(handle, Boolean(removed))
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: "Impossible d'enregistrer le signalement.", detail: err.message })
  }
})

export default router
