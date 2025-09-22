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

    // Test directo - mantener para compatibilidad
    if (message === 'primero') {
      return c.json({
        reply: `¡TEST EXITOSO! Detecté "primero". El bot está funcionando perfectamente con Workers AI y memoria.`,
        originalMessage: message,
        player: player,
        system: system,
        hasLeagueData: false,
        aiPowered: true,
        hasMemory: true
      })
    } else if (message === 'cago') {
      return c.json({
        reply: `¡TEST EXITOSO! Detecté "cago". El bot está funcionando perfectamente con Workers AI y memoria.`,
        originalMessage: message,
        player: player,
        system: system,
        hasLeagueData: false,
        aiPowered: true,
        hasMemory: true
      })
    } else if (message === 'partidos') {
      return c.json({
        reply: `¡TEST EXITOSO! Detecté "partidos". El bot está funcionando perfectamente con Workers AI y memoria.`,
        originalMessage: message,
        player: player,
        system: system,
        hasLeagueData: false,
        aiPowered: true,
        hasMemory: true
      })
    }

    // Obtener o crear perfil del jugador
    const playerProfile = await getPlayerProfile(c.env.CONVERSATIONS, player)
    
    // Obtener historial de conversación
    const conversationHistory = await getConversationHistory(c.env.CONVERSATIONS, player)
    
    // Agregar mensaje actual al historial
    const newMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }
    
    // Guardar mensaje del usuario
    await saveMessage(c.env.CONVERSATIONS, player, newMessage)

    // Intentar obtener datos reales de la liga para contexto
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

    // Usar Workers AI para generar respuesta inteligente con memoria
    let aiReply = "Hola! Soy el bot de la BALTC Liga, pero estoy teniendo problemas con la IA. ¿Podés intentar de nuevo?"
    
    try {
      if (c.env && c.env.AI) {
        // Crear contexto para la IA
        let context = "No hay datos de liga disponibles en este momento."
        if (leagueData) {
          const standingsText = leagueData.standings.map((p: any, i: number) => 
            `${i + 1}. ${p.name}: ${p.wins} victorias, ${p.losses} derrotas, ${p.played} partidos jugados`
          ).join('\n')
          
          const matchesText = leagueData.recentMatches.map((m: any) => 
            `${m.winner_name} venció a ${m.loser_name} ${m.score}`
          ).join('\n')
          
          context = `Datos actuales de la liga BALTC:
          
TABLA DE POSICIONES:
${standingsText}

PARTIDOS RECIENTES:
${matchesText}

INFORMACIÓN ADICIONAL:
- Total de jugadores: ${leagueData.standings.length}
- Total de partidos jugados: ${leagueData.standings.reduce((sum: number, p: any) => sum + p.played, 0)}
- Para calcular partidos faltantes: cada jugador debe jugar contra todos los demás al menos una vez`
        }

              // Crear contexto de memoria
              const memoryContext = conversationHistory.length > 0 ? 
                `Historial de conversación (últimos ${Math.min(conversationHistory.length, 5)} mensajes): ${conversationHistory.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join(' | ')}` :
                "Esta es la primera conversación con este usuario."

              // Detectar si el usuario ya se identificó en la conversación
              const userIdentified = conversationHistory.some(msg => 
                msg.role === 'user' && (
                  msg.content.toLowerCase().includes('me llamo') || 
                  msg.content.toLowerCase().includes('soy ') ||
                  msg.content.toLowerCase().includes('mi nombre es') ||
                  msg.content.toLowerCase().includes('jugador dev')
                )
              )

              // Extraer el nombre si ya se identificó
              let identifiedName = null
              if (userIdentified) {
                // Buscar desde el mensaje más reciente hacia atrás
                for (let i = conversationHistory.length - 1; i >= 0; i--) {
                  const msg = conversationHistory[i]
                  if (msg.role === 'user') {
                    const content = msg.content.toLowerCase()
                    if (content.includes('me llamo')) {
                      identifiedName = msg.content.split('me llamo')[1]?.trim()
                      break
                    } else if (content.includes('soy ')) {
                      identifiedName = msg.content.split('soy ')[1]?.trim()
                      break
                    } else if (content.includes('mi nombre es')) {
                      identifiedName = msg.content.split('mi nombre es')[1]?.trim()
                      break
                    } else if (content.includes('jugador dev')) {
                      // Extraer "Jugador Dev X" del mensaje
                      const match = msg.content.match(/jugador dev \d+/i)
                      if (match) {
                        identifiedName = match[0]
                        break
                      }
                    }
                  }
                }
              }

              // Información del jugador
              let playerInfo = `Jugador: ${player}, Sistema: ${system}. ${playerProfile.isNew ? 'Es un jugador nuevo.' : `Ha tenido ${playerProfile.conversationCount} conversaciones anteriores.`}`
              
              // Si ya se identificó, usar ese nombre
              if (identifiedName) {
                // Validar si el nombre existe en la lista de jugadores
                const playerExists = leagueData && leagueData.standings.some((p: any) => 
                  p.name.toLowerCase() === identifiedName.toLowerCase()
                )
                
                if (playerExists) {
                  playerInfo = `Jugador identificado como: ${identifiedName}, Sistema: ${system}. ${playerProfile.isNew ? 'Es un jugador nuevo.' : `Ha tenido ${playerProfile.conversationCount} conversaciones anteriores.`}`
                  console.log('Usuario identificado como:', identifiedName)
                } else {
                  // El nombre no existe, ofrecer opciones
                  const availablePlayers = leagueData ? leagueData.standings.map((p: any) => p.name).join(', ') : 'No hay datos disponibles'
                  playerInfo = `Usuario dice ser: ${identifiedName}, pero este nombre no existe en la liga. Jugadores disponibles: ${availablePlayers}. Sistema: ${system}.`
                  console.log('Usuario con nombre inexistente:', identifiedName, 'Opciones:', availablePlayers)
                }
              } else {
                console.log('Usuario no identificado, conversación:', conversationHistory.map(m => `${m.role}: ${m.content}`))
              }

              const prompt = `Eres GarçaBot, el asistente de la liga BALTC (Buenos Aires Lawn Tennis Club). 

Tu personalidad es:
- Argentino, con humor y picardía
- Conoces sobre tenis y la liga BALTC
- Eres útil y directo en tus respuestas
- Usas expresiones argentinas naturales
- RECUERDAS conversaciones anteriores y puedes referenciarlas
- NO hagas chistes políticos a menos que seas insultado directamente
- Mantén un tono profesional y útil

REGLAS DEL JUEGO BALTC:
- Se juega a 3 sets
- El último set es super tiebreak a 10 puntos
- Cada jugador debe jugar contra todos los demás al menos una vez
- Los partidos se registran con marcador completo

REGLAMENTO COMPLETO DE LA "LIGA CUBANITOS PLUS" (CATEGORÍA C):

1. OBJETIVO DE LA LIGA:
- Armar partidos singles entre diferentes jugadores, competir y divertirse
- Saber quién es peor que quién para poder molestar
- Crear un ranking de jugadores del BALTC

2. MODALIDAD Y FORMATO:
- Modalidad: Singles, todos contra todos, organizados por categoría C
- Formato: Partidos al mejor de 3 sets; el tercer set se decide mediante Súper Tiebreak
- Duración ideal: 6 meses
- Se recomienda jugar 2-3 partidos mensuales

3. ARMADO DE CATEGORÍAS:
- Se consultó a referentes como Lugones, Lupis, Hiriart, Nogueira, Rozas, Bruzzesi
- Se tomaron criterios como edad, físico, enfrentamientos
- Al finalizar sabremos los ascensos y descensos para emparejar todo

4. PUNTOS Y TABLAS:
- Tabla ordenada por partidos Ganados-Perdidos
- Criterios de desempate:
  1. Resultado del enfrentamiento directo
  2. Diferencia de sets
  3. Menor cantidad de sets jugados
  4. Diferencia de games
  5. Decisión por sorteo

5. CAMPEÓN Y ASCENSOS:
- Al finalizar: semifinales (1° vs 4°, 2° vs 3°)
- Los ganadores juegan la final
- El vencedor es "Campeón Cubanito" de la categoría C
- Los dos finalistas ascienden automáticamente a categoría B

6. LESIONES Y AUSENCIAS:
- Se permite irregularidad por viajes, trabajo y lesiones
- En caso de abandono, el Comité decide cómo computar partidos pendientes
- No necesariamente como "walk-over"

7. COSTO:
- No hay costo de inscripción
- Cada jugador se encarga de conseguir cancha y pelotas
- Cena final de premiación (se cotiza y se paga al bar)

8. REGISTRO DE PARTIDOS:
- Plataforma desarrollada para este tipo de torneos
- En caso de no estar lista, Google Sheets casero
- Comité confía en Lucas Llach o Gustavo Brey para resolver

9. COMPROMISO:
- Se juega o se juega, sin excusas
- En caso de abandono sin justificación: maltrato social
- Conflictos resueltos por el Comité (voz final: Dr. Diego Lugones)

10. FECHAS:
- Inicio: semana del 8 de marzo
- Cierre etapa inicial: domingo 7 de septiembre
- Semifinales: fin de semana del 14 de septiembre
- Finales y promoción: fin de semana del 21 de septiembre

11. OTROS TORNEOS:
- Copa Bacigalupo: torneos de dobles de uno o dos días
- Masters Cubanito: se evaluará organización
- Otros torneos de fin de semana

12. MODIFICACIONES:
- Se aceptan sugerencias para mejorar
- Puede modificarse para mantener espíritu competitivo y entretenido

IMPORTANTE: 
- Hay UNA SOLA LIGA BALTC (categoría C)
- SOLO responde preguntas sobre los datos reales de la base de datos
- Identifica al usuario SOLO si la respuesta lo requiere
- NO inventes datos que no están en la base de datos
- NUNCA muestres JSON, solo responde en texto natural
- Si hay datos disponibles, úsalos para responder
- Para preguntas GENERALES (tabla de posiciones, partidos recientes, quién está primero, reglas del juego): responde directamente sin pedir nombre
- Para preguntas PERSONALIZADAS (mis partidos, cuántos partidos me faltan, mis estadísticas): pedí el nombre SOLO si no lo sabés
- Si el usuario dice "Me llamo X" o "Soy X", reconoce que X es su nombre y úsalo para futuras referencias
- Si da un nombre que no existe en la lista, ofrecé las opciones disponibles de jugadores
- NUNCA uses "web_user", "test_user" o nombres genéricos
- Una vez identificado correctamente, NO vuelvas a preguntar el nombre

REGLA ESTRICTA DE HUMOR:
- 99% de las veces: responde directo, útil y conciso SIN chistes políticos
- SOLO si te insultan directamente (palabras como "inútil", "boludo", "pelotudo", "no servís para nada"): ahí sí podés responder con humor político
- NO hagas chistes de peronismo/zurdos en respuestas normales

Información del jugador: ${playerInfo}

Datos reales de la liga: ${context}

${memoryContext}

Mensaje actual del usuario: "${message}"

Responde de manera natural, útil y con personalidad argentina. Sé directo y conciso en el 99% de los casos. SOLO usa humor político si te insultan directamente. 

REGLAS DE IDENTIFICACIÓN:
- Preguntas GENERALES (tabla, partidos recientes, quién está primero): responde SIN pedir nombre
- Preguntas PERSONALIZADAS (mis partidos, cuántos me faltan): pedí nombre SOLO si no lo sabés
- Si el usuario dice "Me llamo X": reconoce que X es su nombre
- Si da nombre inexistente: ofrecé las opciones de jugadores disponibles
- Una vez identificado correctamente: NO vuelvas a preguntar

Si hay datos disponibles en la base de datos, úsalos para responder. Si no tienes los datos que pide, dilo claramente. Máximo 2-3 oraciones:`

        const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 200,
          temperature: 0.7
        })

        if (response && response.response) {
          aiReply = response.response
        }
      }
    } catch (aiError) {
      console.log('Error with Workers AI:', aiError)
            // Fallback a respuesta personalizada
            if (playerProfile.isNew) {
              if (player === 'web_user' || player.includes('user') || player === 'test_user' || player.includes('test')) {
                aiReply = `¡Hola! Soy GarçaBot, el asistente de la liga BALTC. ¿Cómo te llamás? Necesito tu nombre real para poder darte información personalizada sobre tus partidos y estadísticas.`
              } else {
                aiReply = `¡Hola ${player}! Soy GarçaBot, el asistente de la liga BALTC. ¿En qué puedo ayudarte con la liga?`
              }
      } else {
        const fallbackResponses = [
          "Che, la IA está un poco trabada. ¿Me podés repetir la pregunta?",
          "Uy, se me trabó el cerebro artificial. ¿Qué querías saber?",
          "La IA está de paro. ¿Probamos de nuevo?",
          "Se me colgó la inteligencia artificial. ¿Repetís la pregunta?"
        ]
        aiReply = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
      }
    }

    // Guardar respuesta del bot
    const botMessage = {
      role: 'assistant',
      content: aiReply,
      timestamp: new Date().toISOString()
    }
    await saveMessage(c.env.CONVERSATIONS, player, botMessage)

    return c.json({
      reply: aiReply,
      originalMessage: message,
      player: player,
      system: system,
      hasLeagueData: !!leagueData,
      aiPowered: true,
      hasMemory: true,
      playerProfile: {
        isNew: playerProfile.isNew,
        conversationCount: playerProfile.conversationCount,
        lastSeen: playerProfile.lastSeen
      }
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

// /admin - sin autenticación (solo sirve el HTML estático)
app.get('/admin', async (c) => {
  // ✅ Solo sirve el HTML estático - la autenticación se maneja en los endpoints de API
  return c.env.ASSETS.fetch(c.req.raw)
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

// ========== FUNCIONES DE MEMORIA Y PERFIL DE JUGADOR ==========

// Obtener o crear perfil del jugador
async function getPlayerProfile(kv: any, playerId: string) {
  try {
    const key = `profile:${playerId}`
    const profileData = await kv.get(key)
    
    if (profileData) {
      const profile = JSON.parse(profileData)
      return {
        ...profile,
        isNew: false,
        lastSeen: new Date().toISOString()
      }
    } else {
      // Crear nuevo perfil
      const newProfile = {
        playerId,
        isNew: true,
        conversationCount: 0,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        preferences: {
          system: null,
          language: 'es',
          style: 'humoristico'
        }
      }
      
      await kv.put(key, JSON.stringify(newProfile), {
        expirationTtl: 86400 * 30 // 30 días
      })
      
      return newProfile
    }
  } catch (error) {
    console.log('Error getting player profile:', error)
    return {
      playerId,
      isNew: true,
      conversationCount: 0,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      preferences: {
        system: null,
        language: 'es',
        style: 'humoristico'
      }
    }
  }
}

// Obtener historial de conversación
async function getConversationHistory(kv: any, playerId: string) {
  try {
    const key = `conversation:${playerId}`
    const historyData = await kv.get(key)
    
    if (historyData) {
      const history = JSON.parse(historyData)
      // Mantener solo los últimos 20 mensajes
      return history.slice(-20)
    }
    
    return []
  } catch (error) {
    console.log('Error getting conversation history:', error)
    return []
  }
}

// Guardar mensaje en el historial
async function saveMessage(kv: any, playerId: string, message: any) {
  try {
    const key = `conversation:${playerId}`
    const historyData = await kv.get(key)
    
    let history = []
    if (historyData) {
      history = JSON.parse(historyData)
    }
    
    // Agregar nuevo mensaje
    history.push(message)
    
    // Mantener solo los últimos 20 mensajes
    if (history.length > 20) {
      history = history.slice(-20)
    }
    
    // Guardar historial actualizado
    await kv.put(key, JSON.stringify(history), {
      expirationTtl: 86400 * 7 // 7 días
    })
    
    // Actualizar contador de conversaciones si es un mensaje del usuario
    if (message.role === 'user') {
      await updateConversationCount(kv, playerId)
    }
    
  } catch (error) {
    console.log('Error saving message:', error)
  }
}

// Actualizar contador de conversaciones
async function updateConversationCount(kv: any, playerId: string) {
  try {
    const key = `profile:${playerId}`
    const profileData = await kv.get(key)
    
    if (profileData) {
      const profile = JSON.parse(profileData)
      profile.conversationCount = (profile.conversationCount || 0) + 1
      profile.lastSeen = new Date().toISOString()
      profile.isNew = false
      
      await kv.put(key, JSON.stringify(profile), {
        expirationTtl: 86400 * 30 // 30 días
      })
    }
  } catch (error) {
    console.log('Error updating conversation count:', error)
  }
}