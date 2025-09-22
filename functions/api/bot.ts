export const onRequestGet = async (context: any) => {
  const url = new URL(context.request.url)
  
  if (url.pathname === '/api/bot/health') {
    return new Response(JSON.stringify({ 
      ok: true, 
      message: 'Bot API is running',
      timestamp: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json" }
    })
  }
  
  return new Response('Not Found', { status: 404 })
}

export const onRequest = async (context: any) => {
  const url = new URL(context.request.url)
  
  if (url.pathname === '/api/bot/health') {
    return new Response(JSON.stringify({ 
      ok: true, 
      message: 'Bot API is running',
      timestamp: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json" }
    })
  }
  
  return new Response('Not Found', { status: 404 })
}

export const onRequestPost = async (context: any) => {
  const url = new URL(context.request.url)
  
  if (url.pathname === '/api/bot' || url.pathname === '/api/bot/') {
    try {
      const body = await context.request.json()
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
        if (context.env && context.env.DB) {
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
          const standings = await context.env.DB.prepare(standingsSql).all()
          
          // Obtener partidos recientes
          const matchesSql = `
            SELECT m.*, w.name as winner_name, l.name as loser_name
            FROM matches m
            JOIN players w ON m.winner_id = w.id
            JOIN players l ON m.loser_id = l.id
            ORDER BY m.created_at DESC
            LIMIT 5
          `
          const matches = await context.env.DB.prepare(matchesSql).all()
          
          leagueData = {
            standings: standings.results || [],
            recentMatches: matches.results || []
          }
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

      return new Response(JSON.stringify({
        reply: intelligentReply,
        originalMessage: message,
        player: player,
        system: system,
        hasLeagueData: !!leagueData
      }), {
        headers: { "Content-Type": "application/json" }
      })
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Error processing request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    }
  }
  
  return new Response('Not Found', { status: 404 })
}
