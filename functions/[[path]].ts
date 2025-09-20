import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  ADMIN_USER: string
  ADMIN_PASS_HASH: string
}

const app = new Hono<{ Bindings: Bindings }>()

// ---------- sanity check
app.get('/api/ping', (c) => c.json({ ok: true }))

// ---------- helpers
async function resolvePlayer(db: D1Database, rawName: string) {
  const name = rawName.trim()
  
  // First check if it's a numeric ID
  if (/^\d+$/.test(name)) {
    const row = await db.prepare(`SELECT id, name FROM players WHERE id=?`).bind(parseInt(name)).first()
    if (row) return row
  }
  
  // Then check aliases
  let row = await db.prepare(
    `SELECT p.id, p.name FROM aliases a JOIN players p ON p.id=a.player_id WHERE a.name=?`
  ).bind(name).first()
  if (row) return row
  
  // Then check direct name match
  row = await db.prepare(`SELECT id, name FROM players WHERE name=?`).bind(name).first()
  if (row) return row
  
  // If not found, create new player
  await db.prepare(`INSERT INTO players(name) VALUES (?)`).bind(name).run()
  return await db.prepare(`SELECT id, name FROM players WHERE name=?`).bind(name).first()
}

// ---------- PUBLIC API
app.get('/api/matches', async (c) => {
  const playerId = c.req.query('player')
  let query = `SELECT m.id, w.name as winner, l.name as loser, m.score, m.date, m.created_at
               FROM matches m
               JOIN players w ON w.id=m.winner_id
               JOIN players l ON l.id=m.loser_id`
  
  if (playerId) {
    query += ` WHERE m.winner_id=? OR m.loser_id=?`
    query += ` ORDER BY coalesce(m.date, datetime(m.created_at,'unixepoch')) DESC, m.id DESC`
    const { results } = await c.env.DB.prepare(query).bind(playerId, playerId).all()
    return c.json(results)
  } else {
    query += ` ORDER BY coalesce(m.date, datetime(m.created_at,'unixepoch')) DESC, m.id DESC`
    const { results } = await c.env.DB.prepare(query).all()
    return c.json(results)
  }
})

app.get('/api/standings', async (c) => {
  const system = (c.req.query('system') || 'A').toUpperCase()
  const { results } = await c.env.DB.prepare(
    `WITH allp AS (SELECT id,name FROM players),
     wins AS (SELECT winner_id pid, COUNT(*) pg FROM matches GROUP BY winner_id),
     losses AS (SELECT loser_id pid, COUNT(*) pp FROM matches GROUP BY loser_id),
     j AS (SELECT a.id, a.name,
                  COALESCE(w.pg,0) pg, COALESCE(l.pp,0) pp,
                  COALESCE(w.pg,0)+COALESCE(l.pp,0) pj
           FROM allp a
           LEFT JOIN wins w ON a.id=w.pid
           LEFT JOIN losses l ON a.id=l.pid)
     SELECT id, name, pj, pg, pp,
            CASE ?
              WHEN 'A' THEN pg * 1
              WHEN 'B' THEN pg * 3 + pp * 1
              ELSE pg * 1
            END AS pts
     FROM j
     ORDER BY pts DESC, pg DESC, name ASC`
  ).bind(system).all()
  return c.json(results)
})

app.get('/api/players', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT DISTINCT p.id, p.name, p.photo FROM players p ORDER BY p.name ASC`
  ).all()
  return c.json(results)
})

app.get('/api/players/stats', async (c) => {
  const { results } = await c.env.DB.prepare(
    `WITH player_stats AS (
      SELECT 
        p.id,
        p.name,
        p.photo,
        COALESCE(wins.win_count, 0) as wins,
        COALESCE(losses.loss_count, 0) as losses,
        COALESCE(wins.win_count, 0) + COALESCE(losses.loss_count, 0) as total_matches
      FROM players p
      LEFT JOIN (
        SELECT winner_id, COUNT(*) as win_count 
        FROM matches 
        GROUP BY winner_id
      ) wins ON p.id = wins.winner_id
      LEFT JOIN (
        SELECT loser_id, COUNT(*) as loss_count 
        FROM matches 
        GROUP BY loser_id
      ) losses ON p.id = losses.loser_id
    ),
    total_players AS (
      SELECT COUNT(*) as player_count FROM players
    ),
    final_stats AS (
      SELECT 
        ps.id,
        ps.name,
        ps.photo,
        ps.wins,
        ps.losses,
        ps.total_matches,
        CASE 
          WHEN ps.total_matches > 0 THEN ROUND((ps.wins * 100.0 / ps.total_matches), 1)
          ELSE 0
        END as win_percentage,
        CASE 
          WHEN tp.player_count > 1 THEN (tp.player_count - 1) - ps.total_matches
          ELSE 0
        END as pending_matches
      FROM player_stats ps
      CROSS JOIN total_players tp
    )
    SELECT * FROM final_stats
    ORDER BY wins DESC, win_percentage DESC, name ASC`
  ).all()
  return c.json(results)
})

// ---------- ADMIN (Basic Auth con import perezoso de bcryptjs)
const admin = new Hono<{ Bindings: Bindings }>()
admin.use('*', async (c, next) => {
  const { basicAuth } = await import('hono/basic-auth')
  const { default: bcrypt } = await import('bcryptjs')
  const mw = basicAuth({
    verifyUser: (u, p) => (u === c.env.ADMIN_USER) && bcrypt.compareSync(p, c.env.ADMIN_PASS_HASH),
    realm: 'BALTC-ADMIN'
  })
  return mw(c, next)
})

admin.post('/match', async (c) => {
  const { winner, loser, score, date } = await c.req.json() as any
  if (!winner || !loser || !score) return c.text('Missing fields', 400)
  if (winner.trim() === loser.trim()) return c.text('Players must be different', 400)
  const w = await resolvePlayer(c.env.DB, winner)
  const l = await resolvePlayer(c.env.DB, loser)
  await c.env.DB.prepare(
    `INSERT INTO matches(winner_id,loser_id,score,date) VALUES (?,?,?,?)`
  ).bind(w.id, l.id, String(score).trim(), date || null).run()
  return c.json({ ok: true })
})

admin.delete('/match/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare(`DELETE FROM matches WHERE id=?`).bind(id).run()
  return c.json({ ok: true })
})

admin.post('/import', async (c) => {
  const text = await c.req.text()
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const header = lines.shift()
  if (!header) return c.text('Empty CSV', 400)
  const cols = header.split(',').map(s => s.trim().toLowerCase())
  const iW = cols.indexOf('winner'), iL = cols.indexOf('loser'), iS = cols.indexOf('score'), iD = cols.indexOf('date')
  if (iW < 0 || iL < 0 || iS < 0) return c.text('CSV must contain Winner,Loser,Score[,Date]', 400)
  for (const ln of lines) {
    const parts = ln.split(',')
    const winner = parts[iW]?.trim(), loser = parts[iL]?.trim(), score = parts[iS]?.trim()
    const date = iD >= 0 ? (parts[iD]?.trim() || null) : null
    if (!winner || !loser || !score) continue
    const w = await resolvePlayer(c.env.DB, winner)
    const l = await resolvePlayer(c.env.DB, loser)
    await c.env.DB.prepare(
      `INSERT INTO matches(winner_id,loser_id,score,date) VALUES (?,?,?,?)`
    ).bind(w.id, l.id, score, date).run()
  }
  return c.json({ ok: true })
})

// ---------- PLAYER CRUD
admin.get('/players', async (c) => {
  const sort = c.req.query('sort') || 'name'
  const search = c.req.query('search') || ''
  
  let query = `SELECT p.id, p.name, p.created_at, 
               COUNT(m1.id) as matches_won,
               COUNT(m2.id) as matches_lost,
               COUNT(m1.id) + COUNT(m2.id) as total_matches
               FROM players p
               LEFT JOIN matches m1 ON p.id = m1.winner_id
               LEFT JOIN matches m2 ON p.id = m2.loser_id`
  
  if (search) {
    query += ` WHERE p.name LIKE ?`
    query += ` GROUP BY p.id, p.name, p.created_at`
    
    if (sort === 'name') {
      query += ` ORDER BY p.name ASC`
    } else if (sort === 'created') {
      query += ` ORDER BY p.created_at DESC`
    } else if (sort === 'matches') {
      query += ` ORDER BY total_matches DESC, p.name ASC`
    }
    
    const { results } = await c.env.DB.prepare(query)
      .bind(`%${search}%`)
      .all()
    
    return c.json(results)
  } else {
    query += ` GROUP BY p.id, p.name, p.created_at`
    
    if (sort === 'name') {
      query += ` ORDER BY p.name ASC`
    } else if (sort === 'created') {
      query += ` ORDER BY p.created_at DESC`
    } else if (sort === 'matches') {
      query += ` ORDER BY total_matches DESC, p.name ASC`
    }
    
    const { results } = await c.env.DB.prepare(query).all()
    return c.json(results)
  }
})

admin.post('/players', async (c) => {
  const { name } = await c.req.json() as any
  if (!name || !name.trim()) return c.text('Name is required', 400)
  
  const existing = await c.env.DB.prepare(`SELECT id FROM players WHERE name = ?`)
    .bind(name.trim()).first()
  
  if (existing) return c.text('Player already exists', 400)
  
  const result = await c.env.DB.prepare(`INSERT INTO players(name) VALUES (?)`)
    .bind(name.trim()).run()
  
  return c.json({ id: result.meta.last_row_id, name: name.trim() })
})

// Upload player photo
admin.post('/players/:id/photo', async (c) => {
  const playerId = c.req.param('id')
  
  try {
    const formData = await c.req.formData()
    const file = formData.get('photo') as File
    
    if (!file) {
      return c.text('No file uploaded', 400)
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return c.text('File must be an image', 400)
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return c.text('File too large (max 5MB)', 400)
    }
    
    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    const dataUrl = `data:${file.type};base64,${base64}`
    
    // Update player photo in database
    await c.env.DB.prepare(`UPDATE players SET photo = ? WHERE id = ?`)
      .bind(dataUrl, playerId).run()
    
    return c.json({ success: true, message: 'Photo uploaded successfully' })
  } catch (error) {
    console.error('Error uploading photo:', error)
    return c.text('Error uploading photo', 500)
  }
})

admin.put('/players/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const { name } = await c.req.json() as any
  
  if (!name || !name.trim()) return c.text('Name is required', 400)
  
  const existing = await c.env.DB.prepare(`SELECT id FROM players WHERE name = ? AND id != ?`)
    .bind(name.trim(), id).first()
  
  if (existing) return c.text('Player name already exists', 400)
  
  await c.env.DB.prepare(`UPDATE players SET name = ? WHERE id = ?`)
    .bind(name.trim(), id).run()
  
  return c.json({ ok: true })
})

admin.delete('/players/:id', async (c) => {
  const id = Number(c.req.param('id'))
  
  // Check if player has matches
  const matches = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM matches WHERE winner_id = ? OR loser_id = ?`)
    .bind(id, id).first()
  
  if ((matches as any).count > 0) {
    return c.text('Cannot delete player with existing matches', 400)
  }
  
  await c.env.DB.prepare(`DELETE FROM players WHERE id = ?`).bind(id).run()
  return c.json({ ok: true })
})

// ---------- MATCH CRUD
admin.get('/matches', async (c) => {
  const playerId = c.req.query('player')
  const sort = c.req.query('sort') || 'date'
  
  let query = `SELECT m.id, m.winner_id, m.loser_id, w.name as winner, l.name as loser, 
               m.score, m.date, m.created_at
               FROM matches m
               JOIN players w ON w.id = m.winner_id
               JOIN players l ON l.id = m.loser_id`
  
  if (playerId) {
    query += ` WHERE m.winner_id = ? OR m.loser_id = ?`
    
    if (sort === 'date') {
      query += ` ORDER BY coalesce(m.date, datetime(m.created_at,'unixepoch')) DESC, m.id DESC`
    } else if (sort === 'created') {
      query += ` ORDER BY m.created_at DESC, m.id DESC`
    }
    
    const { results } = await c.env.DB.prepare(query)
      .bind(playerId, playerId)
      .all()
    
    return c.json(results)
  } else {
    if (sort === 'date') {
      query += ` ORDER BY coalesce(m.date, datetime(m.created_at,'unixepoch')) DESC, m.id DESC`
    } else if (sort === 'created') {
      query += ` ORDER BY m.created_at DESC, m.id DESC`
    }
    
    const { results } = await c.env.DB.prepare(query).all()
    return c.json(results)
  }
})

admin.put('/matches/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const { winner, loser, score, date } = await c.req.json() as any
  
  if (!winner || !loser || !score) return c.text('Missing fields', 400)
  if (winner.trim() === loser.trim()) return c.text('Players must be different', 400)
  
  const w = await resolvePlayer(c.env.DB, winner)
  const l = await resolvePlayer(c.env.DB, loser)
  
  await c.env.DB.prepare(
    `UPDATE matches SET winner_id = ?, loser_id = ?, score = ?, date = ? WHERE id = ?`
  ).bind(w.id, l.id, String(score).trim(), date || null, id).run()
  
  return c.json({ ok: true })
})

admin.post('/merge', async (c) => {
  const { fromName, toName } = await c.req.json() as any
  if (!fromName || !toName) return c.text('Missing names', 400)
  const to = await resolvePlayer(c.env.DB, toName)
  await c.env.DB.prepare(`INSERT OR IGNORE INTO aliases(name, player_id) VALUES (?,?)`)
    .bind(fromName.trim(), to.id).run()
  const fromPlayer = await c.env.DB.prepare(`SELECT id FROM players WHERE name=?`)
    .bind(fromName.trim()).first()
  if (fromPlayer) {
    const fromId = (fromPlayer as any).id as number
    await c.env.DB.prepare(`UPDATE matches SET winner_id=? WHERE winner_id=?`).bind(to.id, fromId).run()
    await c.env.DB.prepare(`UPDATE matches SET loser_id=?  WHERE loser_id=?`).bind(to.id, fromId).run()
    await c.env.DB.prepare(`DELETE FROM players WHERE id=?`).bind(fromId).run()
  }
  return c.json({ ok: true })
})

app.route('/api/admin', admin)

// opcional: /admin con challenge nativo
app.get('/admin', async (c) => {
  const auth = c.req.header('Authorization') || ''
  const realm = 'BALTC-ADMIN'

  if (!auth.startsWith('Basic ')) {
    return c.body('Auth required', 401, {
      'WWW-Authenticate': `Basic realm="${realm}"`,
      'Content-Type': 'text/plain; charset=utf-8',
    })
  }

  const b64 = auth.slice(6)
  const [user, pass] = atob(b64).split(':')
  const { default: bcrypt } = await import('bcryptjs')
  const ok =
    user === c.env.ADMIN_USER &&
    bcrypt.compareSync(pass, c.env.ADMIN_PASS_HASH)

  if (!ok) {
    return c.body('Unauthorized', 401, {
      'WWW-Authenticate': `Basic realm="${realm}"`,
    })
  }

  // ✅ si pasó la auth → dejá que Pages sirva el HTML estático
  return c.env.ASSETS.fetch(c.req.raw)
})

export const onRequest: PagesFunction = async (ctx) => {
  const url = new URL(ctx.request.url)

  // Rutas que maneja Hono:
  if (url.pathname.startsWith('/api') || url.pathname === '/admin') {
    return app.fetch(ctx.request, ctx.env, ctx)
  }

  // Para TODO lo demás (/, /style.css, /app.js, /admin.js, etc.)
  // delegar al servidor estático de Pages:
  return ctx.next()
}