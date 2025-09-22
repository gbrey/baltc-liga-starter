import { Hono } from 'hono'

type Bindings = {
  DB: any
  ADMIN_USER: string
  ADMIN_PASS_HASH: string
  ASSETS: any
}

const app = new Hono<{ Bindings: Bindings }>()

// ---------- sanity check
app.get('/api/ping', (c) => c.json({ ok: true }))
app.get('/test', (c) => c.json({ ok: true, message: 'Test endpoint working' }))

// ---------- BOT API
app.get('/api/bot/health', (c) => c.json({ 
  ok: true, 
  message: 'Bot API is running',
  timestamp: new Date().toISOString()
}))

app.post('/api/bot', async (c) => {
  try {
    const body = await c.req.json()
    const { message, player, system = 'A' } = body

    // Respuestas random en joda
    const garcabotResponses = [
      "¿Querés que te diga eso? Depositá primero. Estoy terminando de armar el bot, en unos días estará listo.",
      "Todo tiene un precio, papá. Mandame 10 lucas. Estoy terminando de armar el bot, en unos días estará listo.",
      "Gratis no trabajo. Soy bot, no gil. Estoy terminando de armar el bot, en unos días estará listo.",
      "¿Vos sabés lo que cuesta mantener un bot como yo? Plata, mucha plata. Estoy terminando de armar el bot, en unos días estará listo.",
      "Mirá, te voy a dar la info, pero después me invitas un asado. Estoy terminando de armar el bot, en unos días estará listo.",
      "¿Querés saber eso? Primero pagame la cuota del bot. Estoy terminando de armar el bot, en unos días estará listo.",
      "Che, ¿no tenés un billete de 1000 para un bot pobre? Estoy terminando de armar el bot, en unos días estará listo.",
      "Te doy la data, pero me debés una birra. Estoy terminando de armar el bot, en unos días estará listo.",
      "¿Vos pensás que los bots comemos aire? Plata, necesito plata. Estoy terminando de armar el bot, en unos días estará listo.",
      "Mirá, te ayudo, pero después me compras un café virtual. Estoy terminando de armar el bot, en unos días estará listo."
    ]

    // Seleccionar respuesta random
    const randomResponse = garcabotResponses[Math.floor(Math.random() * garcabotResponses.length)]

    // Intentar obtener datos reales de la liga para respuestas más inteligentes
    let leagueData = null
    try {
      if (c.env && c.env.DB) {
        // Obtener standings
        const standingsSql = `
          WITH p AS (SELECT id, name FROM players),
          wins AS (SELECT winner_id AS id, COUNT(*) c FROM matches GROUP BY winner_id),
          losses AS (SELECT loser_id AS id, COUNT(*) c FROM matches GROUP BY loser_id)
          SELECT p.name,
                 COALESCE(wins.c,0) AS wins,
                 COALESCE(losses.c,0) AS losses,
                 (COALESCE(wins.c,0)+COALESCE(losses.c,0)) AS played
          FROM p
          LEFT JOIN wins ON wins.id = p.id
          LEFT JOIN losses ON losses.id = p.id
          ORDER BY wins DESC, played DESC, p.name ASC
          LIMIT 5
        `
        const standings = await c.env.DB.prepare(standingsSql).all()
        
        // Obtener partidos recientes
        const matchesSql = `
          SELECT m.*, w.name as winner_name, l.name as loser_name
          FROM matches m
          JOIN players w ON m.winner_id = w.id
          JOIN players l ON m.loser_id = l.id
          ORDER BY m.created_at DESC
          LIMIT 5
        `
        const matches = await c.env.DB.prepare(matchesSql).all()
        
        leagueData = {
          standings: standings.results || [],
          recentMatches: matches.results || []
        } as any
      }
    } catch (dbError) {
      console.log('Error getting league data:', dbError)
    }

    // Respuesta inteligente basada en el mensaje
    let intelligentReply = randomResponse
    
    // Test directo
    if (message === 'primero') {
      intelligentReply = `¡TEST EXITOSO! Detecté "primero". El bot está funcionando perfectamente.`
    } else if (message === 'cago') {
      intelligentReply = `¡TEST EXITOSO! Detecté "cago". El bot está funcionando perfectamente.`
    } else if (message === 'partidos') {
      intelligentReply = `¡TEST EXITOSO! Detecté "partidos". El bot está funcionando perfectamente.`
    } else {
      // Para otros mensajes, usar respuestas aleatorias humorísticas
      intelligentReply = randomResponse
    }

    return c.json({
      reply: intelligentReply,
      originalMessage: message,
      player: player,
      system: system,
      hasLeagueData: !!leagueData
    })
  } catch (error) {
    return c.json({ 
      error: 'Error processing request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// ---------- helpers
async function resolvePlayer(db: any, rawName: string) {
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
  let query = `SELECT m.id, w.name as winner, w.id as winner_id, l.name as loser, l.id as loser_id, m.score, m.date, m.created_at
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

// Get detailed roster information for a specific player
app.get('/api/players/:id/roster', async (c) => {
  const playerId = c.req.param('id')
  
  // Get player basic info
  const player = await c.env.DB.prepare(
    `SELECT id, name, photo, created_at FROM players WHERE id = ?`
  ).bind(playerId).first()
  
  if (!player) {
    return c.json({ error: 'Player not found' }, 404)
  }
  
  // Get all matches for this player with opponent info
  const matches = await c.env.DB.prepare(`
    SELECT 
      m.id,
      m.score,
      m.date,
      m.created_at,
      CASE 
        WHEN m.winner_id = ? THEN 'win'
        ELSE 'loss'
      END as result,
      CASE 
        WHEN m.winner_id = ? THEN l.name
        ELSE w.name
      END as opponent_name,
      CASE 
        WHEN m.winner_id = ? THEN l.id
        ELSE w.id
      END as opponent_id,
      CASE 
        WHEN m.winner_id = ? THEN l.photo
        ELSE w.photo
      END as opponent_photo
    FROM matches m
    JOIN players w ON w.id = m.winner_id
    JOIN players l ON l.id = m.loser_id
    WHERE m.winner_id = ? OR m.loser_id = ?
    ORDER BY COALESCE(m.date, datetime(m.created_at, 'unixepoch')) DESC
  `).bind(playerId, playerId, playerId, playerId, playerId, playerId).all()
  
  // Get current standings position
  const standings = await c.env.DB.prepare(`
    WITH player_stats AS (
      SELECT 
        p.id,
        p.name,
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
    ranked_players AS (
      SELECT 
        id,
        name,
        wins,
        losses,
        total_matches,
        ROW_NUMBER() OVER (ORDER BY wins DESC, total_matches DESC, name ASC) as position
      FROM player_stats
    )
    SELECT position, wins, losses, total_matches
    FROM ranked_players 
    WHERE id = ?
  `).bind(playerId).first()
  
  // Calculate streaks
  let currentStreak = 0
  let currentStreakType = 'none'
  let bestWinStreak = 0
  let bestLossStreak = 0
  let tempWinStreak = 0
  let tempLossStreak = 0
  
  if (matches.results && matches.results.length > 0) {
    // Calculate current streak (from most recent match)
    const mostRecent = matches.results[0]
    currentStreakType = mostRecent.result
    
    for (const match of matches.results) {
      if (match.result === currentStreakType) {
        currentStreak++
      } else {
        break
      }
    }
    
    // Calculate best streaks
    for (const match of matches.results) {
      if (match.result === 'win') {
        tempWinStreak++
        tempLossStreak = 0
        bestWinStreak = Math.max(bestWinStreak, tempWinStreak)
      } else {
        tempLossStreak++
        tempWinStreak = 0
        bestLossStreak = Math.max(bestLossStreak, tempLossStreak)
      }
    }
  }
  
  // Get opponents played against
  const opponents = await c.env.DB.prepare(`
    SELECT DISTINCT
      CASE 
        WHEN m.winner_id = ? THEN l.id
        ELSE w.id
      END as opponent_id,
      CASE 
        WHEN m.winner_id = ? THEN l.name
        ELSE w.name
      END as opponent_name,
      CASE 
        WHEN m.winner_id = ? THEN l.photo
        ELSE w.photo
      END as opponent_photo,
      COUNT(*) as times_played
    FROM matches m
    JOIN players w ON w.id = m.winner_id
    JOIN players l ON l.id = m.loser_id
    WHERE m.winner_id = ? OR m.loser_id = ?
    GROUP BY opponent_id, opponent_name, opponent_photo
    ORDER BY times_played DESC
  `).bind(playerId, playerId, playerId, playerId, playerId).all()
  
  // Get players not played against yet
  const notPlayedAgainst = await c.env.DB.prepare(`
    SELECT p.id, p.name, p.photo
    FROM players p
    WHERE p.id != ? 
    AND p.id NOT IN (
      SELECT DISTINCT CASE 
        WHEN m.winner_id = ? THEN m.loser_id
        ELSE m.winner_id
      END
      FROM matches m
      WHERE m.winner_id = ? OR m.loser_id = ?
    )
    ORDER BY p.name
  `).bind(playerId, playerId, playerId, playerId).all()
  
  return c.json({
    player: {
      id: player.id,
      name: player.name,
      photo: player.photo,
      created_at: player.created_at
    },
    stats: {
      position: standings?.position || 0,
      wins: standings?.wins || 0,
      losses: standings?.losses || 0,
      total_matches: standings?.total_matches || 0,
      win_percentage: standings?.total_matches > 0 ? 
        Math.round((standings.wins * 100.0 / standings.total_matches) * 10) / 10 : 0
    },
    streaks: {
      current: currentStreak,
      current_type: currentStreakType,
      best_win: bestWinStreak,
      best_loss: bestLossStreak
    },
    matches: matches.results || [],
    opponents: opponents.results || [],
    not_played_against: notPlayedAgainst.results || []
  })
})

// ---------- ADMIN (Sin middleware automático - solo Basic Auth manual)
const admin = new Hono<{ Bindings: Bindings }>()

// Helper function para verificar autenticación
async function checkAdminAuth(c: any) {
  const auth = c.req.header('Authorization') || ''
  const realm = 'BALTC Liga Admin'

  if (!auth.startsWith('Basic ')) {
    return {
      success: false,
      response: c.body('🔐 Autenticación requerida\n\nUsuario: admin\nContraseña: admin', 401, {
        'WWW-Authenticate': `Basic realm="${realm}"`,
        'Content-Type': 'text/plain; charset=utf-8',
      })
    }
  }

  try {
    const b64 = auth.slice(6)
    const [user, pass] = atob(b64).split(':')
    const { default: bcrypt } = await import('bcryptjs')
    const ok = user === c.env.ADMIN_USER && bcrypt.compareSync(pass, c.env.ADMIN_PASS_HASH)

    if (!ok) {
      return {
        success: false,
        response: c.body('❌ Credenciales incorrectas\n\nUsuario: admin\nContraseña: admin', 401, {
          'WWW-Authenticate': `Basic realm="${realm}"`,
          'Content-Type': 'text/plain; charset=utf-8',
        })
      }
    }

    return { success: true, response: null }
  } catch (error) {
    return {
      success: false,
      response: c.body('❌ Error de autenticación\n\nUsuario: admin\nContraseña: admin', 401, {
        'WWW-Authenticate': `Basic realm="${realm}"`,
        'Content-Type': 'text/plain; charset=utf-8',
      })
    }
  }
}

admin.post('/match', async (c) => {
  const authResult = await checkAdminAuth(c)
  if (!authResult.success) return authResult.response

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
  const authResult = await checkAdminAuth(c)
  if (!authResult.success) return authResult.response

  const id = Number(c.req.param('id'))
  await c.env.DB.prepare(`DELETE FROM matches WHERE id=?`).bind(id).run()
  return c.json({ ok: true })
})

admin.post('/import', async (c) => {
  const authResult = await checkAdminAuth(c)
  if (!authResult.success) return authResult.response

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
  const authResult = await checkAdminAuth(c)
  if (!authResult.success) return authResult.response

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
  const authResult = await checkAdminAuth(c)
  if (!authResult.success) return authResult.response

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
  const authResult = await checkAdminAuth(c)
  if (!authResult.success) return authResult.response

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
  const authResult = await checkAdminAuth(c)
  if (!authResult.success) return authResult.response

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
  const authResult = await checkAdminAuth(c)
  if (!authResult.success) return authResult.response

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
  const authResult = await checkAdminAuth(c)
  if (!authResult.success) return authResult.response

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
  const authResult = await checkAdminAuth(c)
  if (!authResult.success) return authResult.response

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
  const authResult = await checkAdminAuth(c)
  if (!authResult.success) return authResult.response

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
  const realm = 'BALTC Liga Admin'

  if (!auth.startsWith('Basic ')) {
    return c.body('🔐 Autenticación requerida para acceder al panel de administración\n\nUsuario: admin\nContraseña: admin', 401, {
      'WWW-Authenticate': `Basic realm="${realm}"`,
      'Content-Type': 'text/plain; charset=utf-8',
    })
  }

  try {
    const b64 = auth.slice(6)
    const [user, pass] = atob(b64).split(':')
    const { default: bcrypt } = await import('bcryptjs')
    const ok =
      user === c.env.ADMIN_USER &&
      bcrypt.compareSync(pass, c.env.ADMIN_PASS_HASH)

    if (!ok) {
      return c.body('❌ Credenciales incorrectas\n\nUsuario: admin\nContraseña: admin', 401, {
        'WWW-Authenticate': `Basic realm="${realm}"`,
        'Content-Type': 'text/plain; charset=utf-8',
      })
    }

    // ✅ si pasó la auth → dejá que Pages sirva el HTML estático
    return c.env.ASSETS.fetch(c.req.raw)
  } catch (error) {
    return c.body('❌ Error de autenticación\n\nUsuario: admin\nContraseña: admin', 401, {
      'WWW-Authenticate': `Basic realm="${realm}"`,
      'Content-Type': 'text/plain; charset=utf-8',
    })
  }
})

export const onRequest: any = async (ctx: any) => {
  const url = new URL(ctx.request.url)

  // Rutas que maneja Hono:
  if (url.pathname.startsWith('/api') || url.pathname === '/admin' || url.pathname === '/test') {
    return app.fetch(ctx.request, ctx.env, ctx)
  }

  // Para TODO lo demás (/, /style.css, /app.js, /admin.js, etc.)
  // delegar al servidor estático de Pages:
  return ctx.next()
}