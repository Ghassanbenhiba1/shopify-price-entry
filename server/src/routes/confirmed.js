import { Router } from 'express'
import { getConfirmedHandles, setConfirmed } from '../db.js'

const router = Router()

router.get('/confirmed', async (req, res) => {
  try {
    const handles = await getConfirmedHandles()
    res.json({ confirmed: handles })
  } catch (err) {
    res.status(500).json({ error: 'Impossible de lire les produits confirmés.', detail: err.message })
  }
})

router.post('/confirmed', async (req, res) => {
  const { handle, confirmed } = req.body || {}
  if (typeof handle !== 'string' || handle.trim() === '') {
    return res.status(400).json({ error: "Paramètre 'handle' invalide." })
  }
  try {
    await setConfirmed(handle, Boolean(confirmed))
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: "Impossible d'enregistrer la confirmation.", detail: err.message })
  }
})

export default router
