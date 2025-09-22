const $ = (s) => document.querySelector(s)
const $$ = (s) => document.querySelectorAll(s)

// ---------- AUTH & UTILS
let isAuthenticated = false

async function authFetch(url, opts = {}) {
  // Get credentials from localStorage
  let credentials = localStorage.getItem('admin_credentials')
  
  if (!credentials || !isAuthenticated) {
    throw new Error('No autenticado')
  }
  
  const headers = {
    'Authorization': `Basic ${credentials}`,
    ...opts.headers
  }
  
  const response = await fetch(url, { ...opts, headers })
  
  // If unauthorized, clear credentials and show login
  if (response.status === 401) {
    localStorage.removeItem('admin_credentials')
    isAuthenticated = false
    showLoginModal()
    throw new Error('Credenciales inválidas')
  }
  
  return response
}

function showLoginModal() {
  $('#loginModal').classList.add('active')
  $('#loginUsername').focus()
}

function hideLoginModal() {
  $('#loginModal').classList.remove('active')
}

async function handleLogin(username, password) {
  try {
    const credentials = btoa(`${username}:${password}`)
    const response = await fetch('/api/admin/players', {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    })
    
    if (response.ok) {
      localStorage.setItem('admin_credentials', credentials)
      isAuthenticated = true
      hideLoginModal()
      showMessage('#loginMsg', 'Login exitoso ✅')
      
      // Load initial data after a short delay
      setTimeout(() => {
        loadPlayers()
        loadPlayersForDropdowns()
      }, 100)
    } else {
      showMessage('#loginMsg', 'Credenciales inválidas ❌', true)
    }
  } catch (error) {
    showMessage('#loginMsg', 'Error de conexión ❌', true)
  }
}

function showMessage(elementId, message, isError = false) {
  const element = $(elementId)
  element.textContent = message
  element.className = `status-message ${isError ? 'status-error' : 'status-success'}`
  setTimeout(() => {
    element.textContent = ''
    element.className = ''
  }, 3000)
}

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('es-ES')
}

// ---------- NAVIGATION
function initNavigation() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section
      
      // Update active nav button
      $$('.nav-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      
      // Show/hide sections
      $$('.admin-section').forEach(s => s.classList.remove('active'))
      $(`#${section}-section`).classList.add('active')
      
      // Load section data
      if (section === 'players') {
        loadPlayers()
      } else if (section === 'matches') {
        loadMatches()
      } else if (section === 'bot-dashboard') {
        loadBotDashboard()
      }
    })
  })
}

// ---------- PLAYERS MANAGEMENT
let allPlayers = []
let editingPlayerId = null
let playerStats = {} // Para almacenar estadísticas de jugadores

async function loadPlayers() {
  const sort = $('#playerSort').value || 'name' // Default to name if not set
  const search = $('#playerSearch').value
  
  try {
    const url = `/api/admin/players?sort=${sort}&search=${encodeURIComponent(search)}`
    const res = await authFetch(url)
    const data = await res.json()
    
    allPlayers = data
    renderPlayers(data)
  } catch (error) {
    console.error('Error loading players:', error)
    showMessage('#playerMsg', 'Error al cargar jugadores', true)
  }
}

function renderPlayers(players) {
  const container = $('#playersList')
  
  if (!players || players.length === 0) {
    container.innerHTML = '<p class="small">No se encontraron jugadores</p>'
    return
  }
  
  const table = document.createElement('table')
  table.innerHTML = `
    <thead>
      <tr>
        <th>ID</th>
        <th>Nombre</th>
        <th>Partidos Ganados</th>
        <th>Partidos Perdidos</th>
        <th>Total Partidos</th>
        <th>Fecha Creación</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody></tbody>
  `
  
  const tbody = table.querySelector('tbody')
  
  players.forEach(player => {
    const row = document.createElement('tr')
    row.innerHTML = `
      <td>${player.id}</td>
      <td>${player.name}</td>
      <td>${player.matches_won || 0}</td>
      <td>${player.matches_lost || 0}</td>
      <td>${player.total_matches || 0}</td>
      <td>${formatDate(player.created_at)}</td>
      <td>
        <button class="btn-secondary" onclick="editPlayer(${player.id})">✏️ Editar</button>
        <button class="btn-secondary" onclick="uploadPhoto(${player.id}, '${player.name}')">📸 Foto</button>
        <button class="btn-danger" onclick="deletePlayer(${player.id})" ${player.total_matches > 0 ? 'disabled title="No se puede borrar un jugador con partidos"' : ''}>🗑️ Borrar</button>
      </td>
    `
    tbody.appendChild(row)
  })
  
  container.innerHTML = ''
  container.appendChild(table)
}

async function addPlayer() {
  editingPlayerId = null
  $('#playerModalTitle').textContent = 'Nuevo Jugador'
  $('#playerName').value = ''
  $('#playerModal').classList.add('active')
}

async function editPlayer(id) {
  const player = allPlayers.find(p => p.id === id)
  if (!player) return
  
  editingPlayerId = id
  $('#playerModalTitle').textContent = 'Editar Jugador'
  $('#playerName').value = player.name
  $('#playerModal').classList.add('active')
}

async function savePlayer() {
  const name = $('#playerName').value.trim()
  if (!name) {
    showMessage('#playerMsg', 'El nombre es requerido', true)
    return
  }
  
  try {
    const url = editingPlayerId ? `/api/admin/players/${editingPlayerId}` : '/api/admin/players'
    const method = editingPlayerId ? 'PUT' : 'POST'
    
    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    
    if (res.ok) {
      showMessage('#playerMsg', editingPlayerId ? 'Jugador actualizado ✅' : 'Jugador creado ✅')
      closePlayerModal()
      loadPlayers()
    } else {
      const error = await res.text()
      showMessage('#playerMsg', error, true)
    }
  } catch (error) {
    console.error('Error saving player:', error)
    showMessage('#playerMsg', 'Error al guardar jugador', true)
  }
}

async function deletePlayer(id) {
  if (!confirm('¿Estás seguro de que quieres borrar este jugador?')) return
  
  try {
    const res = await authFetch(`/api/admin/players/${id}`, { method: 'DELETE' })
    
    if (res.ok) {
      showMessage('#playerMsg', 'Jugador borrado ✅')
      loadPlayers()
    } else {
      const error = await res.text()
      showMessage('#playerMsg', error, true)
    }
  } catch (error) {
    console.error('Error deleting player:', error)
    showMessage('#playerMsg', 'Error al borrar jugador', true)
  }
}

function closePlayerModal() {
  $('#playerModal').classList.remove('active')
  editingPlayerId = null
}

// ---------- MATCHES MANAGEMENT
let allMatches = []
let editingMatchId = null

async function loadMatches() {
  const playerId = $('#matchPlayerFilter').value
  const sort = $('#matchSort').value
  
  try {
    let url = `/api/admin/matches?sort=${sort}`
    if (playerId) url += `&player=${playerId}`
    
    const res = await authFetch(url)
    const data = await res.json()
    
    allMatches = data
    renderMatches(data)
  } catch (error) {
    console.error('Error loading matches:', error)
    showMessage('#matchMsg', 'Error al cargar partidos', true)
  }
}

function renderMatches(matches) {
  const container = $('#matchesList')
  
  if (!matches || matches.length === 0) {
    container.innerHTML = '<p class="small">No se encontraron partidos</p>'
    return
  }
  
  const table = document.createElement('table')
  table.innerHTML = `
    <thead>
      <tr>
        <th>ID</th>
        <th>Fecha</th>
        <th>Ganador</th>
        <th>Perdedor</th>
        <th>Score</th>
        <th>Fecha Creación</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody></tbody>
  `
  
  const tbody = table.querySelector('tbody')
  
  matches.forEach(match => {
    const row = document.createElement('tr')
    row.innerHTML = `
      <td>${match.id}</td>
      <td>${formatDate(match.date)}</td>
      <td>${match.winner}</td>
      <td>${match.loser}</td>
      <td>${match.score}</td>
      <td>${formatDate(match.created_at)}</td>
      <td>
        <button class="btn-secondary" onclick="editMatch(${match.id})">✏️ Editar</button>
        <button class="btn-danger" onclick="deleteMatch(${match.id})">🗑️ Borrar</button>
      </td>
    `
    tbody.appendChild(row)
  })
  
  container.innerHTML = ''
  container.appendChild(table)
}

async function addMatch() {
  editingMatchId = null
  $('#matchModalTitle').textContent = 'Nuevo Partido'
  $('#winner').value = ''
  $('#loser').value = ''
  $('#score').value = ''
  $('#date').value = new Date().toISOString().slice(0, 10)
  $('#matchModal').classList.add('active')
  
  // Wait for modal to be fully rendered, then load players and matches
  setTimeout(async () => {
    console.log('Loading players and matches for new match modal...')
    await Promise.all([
      loadPlayersForDropdowns(),
      loadMatches() // Load matches to check for existing matchups
    ])
    
    // Remove any existing event listeners first, then add new ones
    clearMatchEventListeners()
    const winnerSelect = $('#winner')
    const loserSelect = $('#loser')
    if (winnerSelect) {
      winnerSelect.addEventListener('change', onWinnerChange)
    }
    if (loserSelect) {
      loserSelect.addEventListener('change', onLoserChange)
    }
  }, 200)
}

async function editMatch(id) {
  const match = allMatches.find(m => m.id === id)
  if (!match) return
  
  editingMatchId = id
  $('#matchModalTitle').textContent = 'Editar Partido'
  $('#score').value = match.score
  $('#date').value = match.date || ''
  $('#matchModal').classList.add('active')
  
  // Wait a bit for modal to be fully rendered, then load players and matches
  setTimeout(async () => {
    await Promise.all([
      loadPlayersForDropdowns(),
      loadMatches() // Load matches to check for existing matchups
    ])
    
    // Remove any existing event listeners first, then add new ones
    clearMatchEventListeners()
    const winnerSelect = $('#winner')
    const loserSelect = $('#loser')
    if (winnerSelect) {
      winnerSelect.addEventListener('change', onWinnerChange)
    }
    if (loserSelect) {
      loserSelect.addEventListener('change', onLoserChange)
    }
    
    // Set values after dropdowns are loaded
    setTimeout(() => {
      $('#winner').value = match.winner_id
      $('#loser').value = match.loser_id
      // Trigger winner change to populate loser dropdown correctly
      onWinnerChange()
    }, 50)
  }, 100)
}

async function saveMatch() {
  const winner = $('#winner').value
  const loser = $('#loser').value
  const score = $('#score').value.trim()
  const date = $('#date').value
  
  if (!winner || !loser || !score) {
    showMessage('#matchMsg', 'Todos los campos son requeridos', true)
    return
  }
  
  if (winner === loser) {
    showMessage('#matchMsg', 'El ganador y perdedor deben ser diferentes', true)
    return
  }
  
  try {
    const url = editingMatchId ? `/api/admin/matches/${editingMatchId}` : '/api/admin/match'
    const method = editingMatchId ? 'PUT' : 'POST'
    
    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winner, loser, score, date })
    })
    
    if (res.ok) {
      showMessage('#matchMsg', editingMatchId ? 'Partido actualizado ✅' : 'Partido creado ✅')
      closeMatchModal()
      loadMatches()
    } else {
      const error = await res.text()
      showMessage('#matchMsg', error, true)
    }
  } catch (error) {
    console.error('Error saving match:', error)
    showMessage('#matchMsg', 'Error al guardar partido', true)
  }
}

async function deleteMatch(id) {
  if (!confirm('¿Estás seguro de que quieres borrar este partido?')) return
  
  try {
    const res = await authFetch(`/api/admin/match/${id}`, { method: 'DELETE' })
    
    if (res.ok) {
      showMessage('#matchMsg', 'Partido borrado ✅')
      loadMatches()
    } else {
      const error = await res.text()
      showMessage('#matchMsg', 'Error al borrar partido', true)
    }
  } catch (error) {
    console.error('Error deleting match:', error)
    showMessage('#matchMsg', 'Error al borrar partido', true)
  }
}

function closeMatchModal() {
  $('#matchModal').classList.remove('active')
  editingMatchId = null
  
  // Remove event listeners to prevent memory leaks
  clearMatchEventListeners()
}

// ---------- LOAD PLAYERS FOR DROPDOWNS
async function loadPlayersForDropdowns() {
  try {
    console.log('Loading players for dropdowns...')
    
    // Load players and their stats
    const [playersRes, statsRes] = await Promise.all([
      fetch('/api/players'),
      fetch('/api/players/stats')
    ])
    
    if (!playersRes.ok || !statsRes.ok) {
      throw new Error(`HTTP error! status: ${playersRes.status} / ${statsRes.status}`)
    }
    
    const players = await playersRes.json()
    const stats = await statsRes.json()
    
    // Store stats for later use
    playerStats = {}
    stats.forEach(stat => {
      playerStats[stat.id] = stat
    })
    
    console.log('Players loaded:', players)
    console.log('Stats loaded:', playerStats)
    
    // Populate match player filter
    const matchFilter = $('#matchPlayerFilter')
    if (matchFilter) {
      matchFilter.innerHTML = '<option value="">Todos los jugadores</option>'
      players.forEach(player => {
        const option = document.createElement('option')
        option.value = player.id
        option.textContent = player.name
        matchFilter.appendChild(option)
      })
    }
    
    // Populate winner/loser dropdowns in match modal
    const winnerSelect = $('#winner')
    const loserSelect = $('#loser')
    
    if (winnerSelect && loserSelect) {
      // Clear and populate winner dropdown
      winnerSelect.innerHTML = '<option value="">Seleccionar ganador...</option>'
      players.forEach(player => {
        const option = document.createElement('option')
        option.value = player.id
        option.textContent = player.name
        winnerSelect.appendChild(option)
      })
      
      // Clear loser dropdown (will be populated when winner is selected)
      loserSelect.innerHTML = '<option value="">Primero selecciona el ganador</option>'
      loserSelect.disabled = true
      
      console.log('Dropdowns populated with', players.length, 'players')
    }
  } catch (error) {
    console.error('Error loading players for dropdowns:', error)
    showMessage('#matchMsg', 'Error al cargar jugadores para el formulario', true)
  }
}

// ---------- MATCH DROPDOWN LOGIC
function populateLoserDropdown(winnerId) {
  const loserSelect = $('#loser')
  if (!loserSelect) return
  
  // Clear current options
  loserSelect.innerHTML = '<option value="">Seleccionar perdedor...</option>'
  
  // Get all players except the winner
  const allPlayers = Object.keys(playerStats).map(id => ({
    id: parseInt(id),
    name: playerStats[id].name,
    stats: playerStats[id]
  }))
  
  // Filter out the winner and add valid opponents
  const validOpponents = allPlayers.filter(player => {
    if (player.id === winnerId) return false
    
    // Check if they have pending matches
    if (player.stats.pending_matches <= 0) return false
    
    // Check if they haven't played against the winner
    return !hasPlayedAgainst(winnerId, player.id)
  })
  
  // Add valid opponents to dropdown
  validOpponents.forEach(player => {
    const option = document.createElement('option')
    option.value = player.id
    option.textContent = `${player.name} (${player.stats.pending_matches} pendientes)`
    loserSelect.appendChild(option)
  })
  
  console.log(`Found ${validOpponents.length} valid opponents for winner ${winnerId}`)
  
  // Enable dropdown if there are valid opponents
  loserSelect.disabled = validOpponents.length === 0
  if (validOpponents.length === 0) {
    loserSelect.innerHTML = '<option value="">No hay oponentes válidos</option>'
  }
}

function hasPlayedAgainst(player1Id, player2Id) {
  // Check if these players have already played against each other
  return allMatches.some(match => 
    (match.winner_id === player1Id && match.loser_id === player2Id) ||
    (match.winner_id === player2Id && match.loser_id === player1Id)
  )
}

function onWinnerChange() {
  const winnerId = parseInt($('#winner').value)
  const loserSelect = $('#loser')
  
  // Clear loser selection when winner changes
  loserSelect.value = ''
  
  if (!winnerId) {
    // No winner selected, disable loser dropdown
    loserSelect.innerHTML = '<option value="">Primero selecciona el ganador</option>'
    loserSelect.disabled = true
    return
  }
  
  // Check if winner has pending matches
  const winnerStats = playerStats[winnerId]
  if (!winnerStats || winnerStats.pending_matches <= 0) {
    loserSelect.innerHTML = '<option value="">El ganador no tiene partidos pendientes</option>'
    loserSelect.disabled = true
    return
  }
  
  // Populate loser dropdown with valid opponents
  populateLoserDropdown(winnerId)
}

function onLoserChange() {
  // This function can be used for additional validation if needed
  console.log('Loser changed to:', $('#loser').value)
}

function clearMatchEventListeners() {
  const winnerSelect = $('#winner')
  const loserSelect = $('#loser')
  if (winnerSelect) {
    winnerSelect.removeEventListener('change', onWinnerChange)
  }
  if (loserSelect) {
    loserSelect.removeEventListener('change', onLoserChange)
  }
}

// ---------- PHOTO UPLOAD
let uploadingPlayerId = null

function uploadPhoto(playerId, playerName) {
  uploadingPlayerId = playerId
  $('#photoModalTitle').textContent = `Subir Foto de ${playerName}`
  $('#photoInput').value = ''
  $('#photoModal').classList.add('active')
  $('#photoInput').focus()
}

function closePhotoModal() {
  $('#photoModal').classList.remove('active')
  uploadingPlayerId = null
}

async function savePhoto() {
  const fileInput = $('#photoInput')
  const file = fileInput.files[0]
  
  if (!file) {
    showMessage('#photoMsg', 'Por favor selecciona una imagen', true)
    return
  }
  
  if (!file.type.startsWith('image/')) {
    showMessage('#photoMsg', 'El archivo debe ser una imagen', true)
    return
  }
  
  if (file.size > 5 * 1024 * 1024) {
    showMessage('#photoMsg', 'La imagen es demasiado grande (máximo 5MB)', true)
    return
  }
  
  try {
    const formData = new FormData()
    formData.append('photo', file)
    
    const response = await authFetch(`/api/admin/players/${uploadingPlayerId}/photo`, {
      method: 'POST',
      body: formData
    })
    
    if (response.ok) {
      showMessage('#photoMsg', 'Foto subida exitosamente ✅')
      closePhotoModal()
      // Recargar la lista de jugadores para mostrar la nueva foto
      setTimeout(() => {
        loadPlayers()
      }, 1000)
    } else {
      const errorText = await response.text()
      showMessage('#photoMsg', `Error: ${errorText}`, true)
    }
  } catch (error) {
    console.error('Error uploading photo:', error)
    showMessage('#photoMsg', 'Error al subir la foto', true)
  }
}

// ---------- TOOLS
async function mergePlayers() {
  const fromName = $('#fromName').value.trim()
  const toName = $('#toName').value.trim()
  
  if (!fromName || !toName) {
    showMessage('#mergeMsg', 'Ambos nombres son requeridos', true)
    return
  }
  
  try {
    const res = await authFetch('/api/admin/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromName, toName })
    })
    
    if (res.ok) {
      showMessage('#mergeMsg', 'Unificación aplicada ✅')
      $('#fromName').value = ''
      $('#toName').value = ''
    } else {
      const error = await res.text()
      showMessage('#mergeMsg', error, true)
    }
  } catch (error) {
    console.error('Error merging players:', error)
    showMessage('#mergeMsg', 'Error al unificar jugadores', true)
  }
}

async function importCSV() {
  const csvText = $('#csvText').value.trim()
  
  if (!csvText) {
    showMessage('#impMsg', 'El texto CSV es requerido', true)
    return
  }
  
  try {
    const res = await authFetch('/api/admin/import', {
      method: 'POST',
      body: csvText
    })
    
    if (res.ok) {
      showMessage('#impMsg', 'Importado ✅')
      $('#csvText').value = ''
    } else {
      const error = await res.text()
      showMessage('#impMsg', error, true)
    }
  } catch (error) {
    console.error('Error importing CSV:', error)
    showMessage('#impMsg', 'Error al importar CSV', true)
  }
}

// ---------- EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {
  // Check if already authenticated
  const credentials = localStorage.getItem('admin_credentials')
  if (credentials) {
    isAuthenticated = true
    hideLoginModal()
  // Load data after a short delay to ensure DOM is ready
  setTimeout(() => {
    loadPlayersForDropdowns()
    loadPlayers()
  }, 100)
  
  // Dashboard refresh button
  $('#refreshDashboardBtn')?.addEventListener('click', () => {
    loadBotDashboard()
  })
  } else {
    showLoginModal()
  }
  
  // Login form
  $('#loginForm').addEventListener('submit', (e) => {
    e.preventDefault()
    const username = $('#loginUsername').value.trim()
    const password = $('#loginPassword').value.trim()
    if (username && password) {
      handleLogin(username, password)
    }
  })
  
  // Navigation
  initNavigation()
  
  // Players section
  $('#addPlayerBtn').addEventListener('click', addPlayer)
  $('#playerSort').addEventListener('change', loadPlayers)
  $('#playerSearch').addEventListener('input', loadPlayers)
  
  // Player modal
  $('#playerForm').addEventListener('submit', (e) => {
    e.preventDefault()
    savePlayer()
  })
  $('#closePlayerModal').addEventListener('click', closePlayerModal)
  $('#cancelPlayerModal').addEventListener('click', closePlayerModal)
  
  // Photo modal
  $('#photoForm').addEventListener('submit', (e) => {
    e.preventDefault()
    savePhoto()
  })
  $('#closePhotoModal').addEventListener('click', closePhotoModal)
  $('#cancelPhotoModal').addEventListener('click', closePhotoModal)
  
  // Matches section
  $('#addMatchBtn').addEventListener('click', addMatch)
  $('#matchPlayerFilter').addEventListener('change', loadMatches)
  $('#matchSort').addEventListener('change', loadMatches)
  
  // Match modal
  $('#matchForm').addEventListener('submit', (e) => {
    e.preventDefault()
    saveMatch()
  })
  $('#closeMatchModal').addEventListener('click', closeMatchModal)
  $('#cancelMatchModal').addEventListener('click', closeMatchModal)
  
  // Tools
  $('#mergeBtn').addEventListener('click', mergePlayers)
  $('#btnImport').addEventListener('click', importCSV)
  
  // Modal close on outside click
  $('#playerModal').addEventListener('click', (e) => {
    if (e.target === $('#playerModal')) closePlayerModal()
  })
  $('#matchModal').addEventListener('click', (e) => {
    if (e.target === $('#matchModal')) closeMatchModal()
  })
  $('#photoModal').addEventListener('click', (e) => {
    if (e.target === $('#photoModal')) closePhotoModal()
  })
})

// ---------- BOT DASHBOARD
async function loadBotDashboard() {
  try {
    // Show loading state
    $('#botStats').innerHTML = '<div class="loading">🔄 Cargando estadísticas del bot...</div>'
    $('#topUsers').innerHTML = '<div class="loading">🔄 Cargando usuarios...</div>'
    $('#leagueStats').innerHTML = '<div class="loading">🔄 Cargando estadísticas de la liga...</div>'
    $('#topPlayers').innerHTML = '<div class="loading">🔄 Cargando jugadores...</div>'
    
    const response = await authFetch('/api/admin/bot-dashboard')
    const data = await response.json()
    
    if (data.success) {
      renderBotStats(data.data.botUsage)
      renderTopUsers(data.data.botUsage.topUsers)
      renderLeagueStats(data.data.leagueData)
      renderTopPlayers(data.data.leagueData.topPlayers)
    } else {
      throw new Error(data.error || 'Error al cargar dashboard')
    }
  } catch (error) {
    console.error('Error loading bot dashboard:', error)
    $('#botStats').innerHTML = `<div class="status-error">❌ Error: ${error.message}</div>`
    $('#topUsers').innerHTML = `<div class="status-error">❌ Error: ${error.message}</div>`
    $('#leagueStats').innerHTML = `<div class="status-error">❌ Error: ${error.message}</div>`
    $('#topPlayers').innerHTML = `<div class="status-error">❌ Error: ${error.message}</div>`
  }
}

function renderBotStats(stats) {
  const statsHtml = `
    <div class="stat-card">
      <div class="stat-number">${stats.totalUsers}</div>
      <div class="stat-label">Total Usuarios</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${stats.activeUsers}</div>
      <div class="stat-label">Usuarios Activos (7 días)</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${stats.totalConversations}</div>
      <div class="stat-label">Conversaciones Totales</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${stats.totalMessages}</div>
      <div class="stat-label">Mensajes Totales</div>
    </div>
  `
  $('#botStats').innerHTML = statsHtml
}

function renderTopUsers(users) {
  if (users.length === 0) {
    $('#topUsers').innerHTML = '<p style="text-align: center; color: #6b7280;">No hay usuarios registrados</p>'
    return
  }
  
  const usersHtml = users.map((user, index) => `
    <div class="top-user-item">
      <div class="user-name">${index + 1}. ${user.playerId}</div>
      <div class="user-stats">
        ${user.conversationCount} conversaciones | 
        Última vez: ${formatDate(user.lastSeen)}
      </div>
    </div>
  `).join('')
  
  $('#topUsers').innerHTML = usersHtml
}

function renderLeagueStats(stats) {
  const statsHtml = `
    <div class="stat-card">
      <div class="stat-number">${stats.totalPlayers}</div>
      <div class="stat-label">Jugadores Registrados</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${stats.totalMatches}</div>
      <div class="stat-label">Partidos Totales</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${stats.monthlyMatches}</div>
      <div class="stat-label">Partidos Este Mes</div>
    </div>
  `
  $('#leagueStats').innerHTML = statsHtml
}

function renderTopPlayers(players) {
  if (players.length === 0) {
    $('#topPlayers').innerHTML = '<p style="text-align: center; color: #6b7280;">No hay datos de partidos</p>'
    return
  }
  
  const playersHtml = players.map((player, index) => `
    <div class="top-player-item">
      <div class="player-name">${index + 1}. ${player.name}</div>
      <div class="player-stats">${player.victories} victorias</div>
    </div>
  `).join('')
  
  $('#topPlayers').innerHTML = playersHtml
}


// Make functions global for onclick handlers
window.editPlayer = editPlayer
window.deletePlayer = deletePlayer
window.uploadPhoto = uploadPhoto
window.editMatch = editMatch
window.deleteMatch = deleteMatch

