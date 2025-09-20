
import { Hono } from 'hono'
import { basicAuth } from 'hono/basic-auth'
import bcrypt from 'bcryptjs'
type Bindings = { DB: D1Database, ADMIN_USER: string, ADMIN_PASS_HASH: string }
const app = new Hono<{ Bindings: Bindings }>()

async function resolvePlayer(db: D1Database, rawName: string) {
  const name = rawName.trim()
  let row = await db.prepare(`SELECT p.id, p.name FROM aliases a JOIN players p ON p.id=a.player_id WHERE a.name=?`).bind(name).first()
  if (row) return row
  row = await db.prepare(`SELECT id, name FROM players WHERE name=?`).bind(name).first()
  if (row) return row
  await db.prepare(`INSERT INTO players(name) VALUES (?)`).bind(name).run()
  const created = await db.prepare(`SELECT id, name FROM players WHERE name=?`).bind(name).first()
  return created!
}

app.get('/api/matches', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT m.id, w.name as winner, l.name as loser, m.score, m.date, m.created_at
     FROM matches m JOIN players w ON w.id=m.winner_id JOIN players l ON l.id=m.loser_id
     ORDER BY coalesce(m.date, datetime(m.created_at,'unixepoch')) DESC, m.id DESC`
  ).all()
  return c.json(results)
})

app.get('/api/standings', async (c) => {
  const system = (c.req.query('system') || 'A').toUpperCase()
  const { results } = await c.env.DB.prepare(
    `WITH allp AS (SELECT id,name FROM players),
     wins AS (SELECT winner_id pid, COUNT(*) pg FROM matches GROUP BY winner_id),
     losses AS (SELECT loser_id pid, COUNT(*) pp FROM matches GROUP BY loser_id),
     j AS (SELECT a.id, a.name, COALESCE(w.pg,0) pg, COALESCE(l.pp,0) pp, COALESCE(w.pg,0)+COALESCE(l.pp,0) pj
           FROM allp a LEFT JOIN wins w ON a.id=w.pid LEFT JOIN losses l ON a.id=l.pid)
     SELECT id, name, pj, pg, pp,
            CASE ? WHEN 'A' THEN pg*1 WHEN 'B' THEN pg*3+pp*1 ELSE pg*1 END pts
     FROM j ORDER BY pts DESC, pg DESC, name ASC`
  ).bind(system).all()
  return c.json(results)
})

const admin = new Hono<{ Bindings: Bindings }>()
admin.use('*', async (c, next) => {
  const auth = basicAuth({
    verifyUser: async (u, p) => (u===c.env.ADMIN_USER) && bcrypt.compareSync(p, c.env.ADMIN_PASS_HASH),
    realm: 'BALTC-ADMIN'
  })
  return auth(c, next)
})

admin.post('/match', async (c) => {
  const body = await c.req.json()
  const { winner, loser, score, date } = body
  if (!winner || !loser || !score) return c.text('Missing fields', 400)
  if (winner.trim()===loser.trim()) return c.text('Players must be different', 400)
  const w = await resolvePlayer(c.env.DB, winner)
  const l = await resolvePlayer(c.env.DB, loser)
  await c.env.DB.prepare(`INSERT INTO matches(winner_id,loser_id,score,date) VALUES (?,?,?,?)`).bind(w.id,l.id, String(score).trim(), date??null).run()
  return c.json({ok:true})
})

admin.delete('/match/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare(`DELETE FROM matches WHERE id=?`).bind(id).run()
  return c.json({ok:true})
})

admin.post('/import', async (c) => {
  const text = await c.req.text()
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
  const header = lines.shift()
  if(!header) return c.text('Empty CSV', 400)
  const cols = header.split(',').map(s=>s.trim().toLowerCase())
  const iW = cols.indexOf('winner'), iL = cols.indexOf('loser'), iS = cols.indexOf('score'), iD = cols.indexOf('date')
  if(iW<0 || iL<0 || iS<0) return c.text('CSV must contain Winner,Loser,Score[,Date]', 400)
  for(const ln of lines){
    const parts = ln.split(',')
    const winner = parts[iW]?.trim(), loser = parts[iL]?.trim(), score = parts[iS]?.trim()
    const date = iD>=0 ? (parts[iD]?.trim() || null) : null
    if(!winner || !loser || !score) continue
    const w = await resolvePlayer(c.env.DB, winner)
    const l = await resolvePlayer(c.env.DB, loser)
    await c.env.DB.prepare(`INSERT INTO matches(winner_id,loser_id,score,date) VALUES (?,?,?,?)`).bind(w.id,l.id,score,date).run()
  }
  return c.json({ok:true})
})

admin.post('/merge', async (c)=>{
  const { fromName, toName } = await c.req.json()
  if(!fromName || !toName) return c.text('Missing names', 400)
  const to = await resolvePlayer(c.env.DB, toName)
  await c.env.DB.prepare(`INSERT OR IGNORE INTO aliases(name, player_id) VALUES (?,?)`).bind(fromName.trim(), to.id).run()
  const fromPlayer = await c.env.DB.prepare(`SELECT id FROM players WHERE name=?`).bind(fromName.trim()).first()
  if(fromPlayer){
    const fromId = fromPlayer.id
    await c.env.DB.prepare(`UPDATE matches SET winner_id=? WHERE winner_id=?`).bind(to.id, fromId).run()
    await c.env.DB.prepare(`UPDATE matches SET loser_id=? WHERE loser_id=?`).bind(to.id, fromId).run()
    await c.env.DB.prepare(`DELETE FROM players WHERE id=?`).bind(fromId).run()
  }
  return c.json({ok:true})
})

app.route('/api/admin', admin)
export default app
