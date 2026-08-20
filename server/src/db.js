import pg from 'pg'

const { Pool } = pg

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    })

/** Crée les tables (prix + produits signalés absents) si elles n'existent pas encore. */
export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prices (
      row_index INTEGER PRIMARY KEY,
      price VARCHAR(20) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS removed_products (
      handle VARCHAR(255) PRIMARY KEY,
      removed_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `)
}

/** Liste des handles signalés comme "pas encore dans le store". */
export async function getRemovedHandles() {
  const { rows } = await pool.query('SELECT handle FROM removed_products')
  return rows.map((r) => r.handle)
}

/** Signale ou annule le signalement d'un produit (par handle). */
export async function setRemoved(handle, removed) {
  if (removed) {
    await pool.query('INSERT INTO removed_products (handle) VALUES ($1) ON CONFLICT (handle) DO NOTHING', [handle])
  } else {
    await pool.query('DELETE FROM removed_products WHERE handle = $1', [handle])
  }
}

/** Retourne tous les prix sous forme { rowIndex: price }. */
export async function getAllPrices() {
  const { rows } = await pool.query('SELECT row_index, price FROM prices')
  const map = {}
  for (const row of rows) map[row.row_index] = row.price
  return map
}

/** Insère ou met à jour le prix d'une ligne (sans écraser les autres lignes). */
export async function upsertPrice(rowIndex, price) {
  await pool.query(
    `INSERT INTO prices (row_index, price) VALUES ($1, $2)
     ON CONFLICT (row_index) DO UPDATE SET price = EXCLUDED.price`,
    [rowIndex, price]
  )
}

/**
 * Insère les prix de départ (issus du CSV) uniquement pour les lignes qui
 * n'ont pas encore de prix en base — ne jamais écraser une saisie existante.
 */
export async function seedInitialPrices(pricesMap) {
  const entries = Object.entries(pricesMap)
  if (entries.length === 0) return
  const values = []
  const placeholders = entries.map(([rowIndex, price], i) => {
    values.push(Number(rowIndex), price)
    return `($${i * 2 + 1}, $${i * 2 + 2})`
  })
  await pool.query(
    `INSERT INTO prices (row_index, price) VALUES ${placeholders.join(', ')} ON CONFLICT (row_index) DO NOTHING`,
    values
  )
}

export async function countPrices() {
  const { rows } = await pool.query('SELECT COUNT(*) AS n FROM prices')
  return Number(rows[0].n)
}

export default pool
