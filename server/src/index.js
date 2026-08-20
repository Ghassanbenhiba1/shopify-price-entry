import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { ensureSchema } from './db.js'
import productsRouter from './routes/products.js'
import pricesRouter from './routes/prices.js'
import removedRouter from './routes/removed.js'
import confirmedRouter from './routes/confirmed.js'

const app = express()

const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map((o) => o.trim())
app.use(
  cors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
  })
)
app.use(express.json())
app.use(express.text({ type: 'text/csv', limit: '15mb' }))

app.get('/api/health', (req, res) => res.json({ ok: true }))
app.use('/api', productsRouter)
app.use('/api', pricesRouter)
app.use('/api', removedRouter)
app.use('/api', confirmedRouter)

const port = process.env.PORT || 3001

ensureSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`API en écoute sur le port ${port}`)
    })
  })
  .catch((err) => {
    console.error('Échec de connexion à la base de données MySQL :', err.message)
    process.exit(1)
  })
