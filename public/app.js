const $=(s)=>document.querySelector(s);

// Helper function to get player photo
function getPlayerPhoto(playerName, playerId = null) {
  // If we have player data with photo, use it
  if (playerId && allPlayers && allPlayers.length > 0) {
    const player = allPlayers.find(p => p.id === playerId);
    if (player && player.photo) {
      return player.photo;
    }
  }
  
  // Otherwise use a consistent photo based on name hash
  const hash = playerName.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const photoIndex = Math.abs(hash) % grandSlamPhotos.length;
  return grandSlamPhotos[photoIndex];
}

function renderTable(container, rows, originalRows = null){
  const tbl=document.createElement('table'); const thead=document.createElement('thead'); const tbody=document.createElement('tbody'); tbl.appendChild(thead); tbl.appendChild(tbody);
  if(!rows||rows.length===0){ container.innerHTML='<p class="small">Sin datos.</p>'; return; }
  const cols=Object.keys(rows[0]); const trh=document.createElement('tr'); cols.forEach(h=>{const th=document.createElement('th'); th.textContent=h; trh.appendChild(th)}); thead.appendChild(trh);
  rows.forEach((r, index)=>{const tr=document.createElement('tr'); cols.forEach(k=>{
    const td=document.createElement('td');
    if (k === 'Jugador') {
      // Create image + text for Jugador column
      const img = document.createElement('img');
      img.src = getPlayerPhoto(r[k], r.playerId);
      img.style.width = '20px';
      img.style.height = '20px';
      img.style.borderRadius = '50%';
      img.style.marginRight = '8px';
      img.style.verticalAlign = 'middle';
      img.style.objectFit = 'cover';
      td.appendChild(img);
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = r[k];
      nameSpan.style.cursor = 'pointer';
      nameSpan.style.color = '#007bff';
      nameSpan.style.textDecoration = 'underline';
      nameSpan.onclick = () => showRoster(r.playerId);
      td.appendChild(nameSpan);
    } else if (k === 'Ganador') {
      // Create image + text for Ganador column
      const img = document.createElement('img');
      const originalRow = originalRows ? originalRows[index] : r;
      img.src = getPlayerPhoto(r[k], originalRow.winnerId);
      img.style.width = '20px';
      img.style.height = '20px';
      img.style.borderRadius = '50%';
      img.style.marginRight = '8px';
      img.style.verticalAlign = 'middle';
      img.style.objectFit = 'cover';
      td.appendChild(img);
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = r[k];
      nameSpan.style.cursor = 'pointer';
      nameSpan.style.color = '#007bff';
      nameSpan.style.textDecoration = 'underline';
      nameSpan.onclick = () => showRoster(originalRow.winnerId);
      td.appendChild(nameSpan);
    } else if (k === 'Perdedor') {
      // Create image + text for Perdedor column
      const img = document.createElement('img');
      const originalRow = originalRows ? originalRows[index] : r;
      img.src = getPlayerPhoto(r[k], originalRow.loserId);
      img.style.width = '20px';
      img.style.height = '20px';
      img.style.borderRadius = '50%';
      img.style.marginRight = '8px';
      img.style.verticalAlign = 'middle';
      img.style.objectFit = 'cover';
      td.appendChild(img);
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = r[k];
      nameSpan.style.cursor = 'pointer';
      nameSpan.style.color = '#007bff';
      nameSpan.style.textDecoration = 'underline';
      nameSpan.onclick = () => showRoster(originalRow.loserId);
      td.appendChild(nameSpan);
    } else {
      td.textContent = r[k];
    }
    tr.appendChild(td);
  }); tbody.appendChild(tr)});
  container.innerHTML=''; container.appendChild(tbl);
}
async function loadStandings(system, target){
  const res=await fetch(`/api/standings?system=${system}`); const data=await res.json();
  const rows=data.map((r,i)=>{
    const position=i+1;
    let medal='';
    if(position===1) medal='🥇';
    else if(position===2) medal='🥈';
    else if(position===3) medal='🥉';
    return {Pos:`${String(position).padStart(2,' ')} ${medal}`,Jugador:r.name,playerId:r.id,PJ:r.pj,PG:r.pg,PP:r.pp,Pts:r.pts};
  });
  renderTable(target, rows);
}
async function loadMatches(target){
  const res=await fetch('/api/matches'); const data=await res.json();
  const rows=data.map(r=>({Fecha:r.date ?? new Date(r.created_at*1000).toISOString().slice(0,10),Ganador:r.winner,winnerId:r.winner_id,Perdedor:r.loser,loserId:r.loser_id,Score:r.score}));
  // Remove the ID columns from display but keep them for photo lookup
  const displayRows = rows.map(r => {
    const {winnerId, loserId, ...displayRow} = r;
    return displayRow;
  });
  renderTable(target, displayRows, rows); // Pass original rows for photo lookup
}
// Grand Slam winners photos mapping - 16 unique tennis player photos from Unsplash
const grandSlamPhotos = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face', // Tennis player 1
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face', // Tennis player 2  
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=face', // Tennis player 3
  'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=300&h=300&fit=crop&crop=face', // Tennis player 4
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop&crop=face', // Tennis player 5
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&h=300&fit=crop&crop=face', // Tennis player 6
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=face', // Tennis player 7
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face', // Tennis player 8
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop&crop=face', // Tennis player 9
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=300&fit=crop&crop=face', // Tennis player 10
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&h=300&fit=crop&crop=face', // Tennis player 11
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=300&h=300&fit=crop&crop=face', // Tennis player 12
  'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=300&h=300&fit=crop&crop=face', // Tennis player 13
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face', // Tennis player 14
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop&crop=face', // Tennis player 15
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face'  // Tennis player 16
];

let allPlayers = [];

async function loadPlayers(target){
  const res=await fetch('/api/players/stats'); const data=await res.json();
  allPlayers = data;
  // Mostrar todos los jugadores al cargar la página
  renderPlayers(target, allPlayers);
}

function renderPlayers(target, players){
  target.innerHTML='';
  if(!players||players.length===0){ 
    target.innerHTML='<p class="small">No se encontraron jugadores que coincidan con la búsqueda.</p>'; 
    return; 
  }
  
  // Ordenar jugadores alfabéticamente por nombre
  const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));
  
  sortedPlayers.forEach((player,index)=>{
    const card=document.createElement('div'); card.className='player-card';
    const photoIndex=index%grandSlamPhotos.length;
    
    // El ranking se basa en los puntos del torneo, no en el orden alfabético
    // Buscar la posición original del jugador en allPlayers (ordenado por puntos)
    const originalIndex = allPlayers.findIndex(p => p.id === player.id);
    const rank = originalIndex + 1;
    
    // Use real photo if available, otherwise use random photo
    const photoSrc = player.photo || grandSlamPhotos[photoIndex];
    
    card.innerHTML=`
      <div class="player-photo">
        <img src="${photoSrc}" alt="${player.name}" loading="lazy">
        <div class="player-rank">#${rank}</div>
      </div>
      <div class="player-info">
        <h4 class="player-name-clickable" onclick="showRoster(${player.id})">${player.name}</h4>
        <div class="player-stats">
          <div class="stat">
            <span class="stat-label" title="Victorias">🏆</span>
            <span class="stat-value wins">${player.wins}</span>
          </div>
          <div class="stat">
            <span class="stat-label" title="Derrotas">❌</span>
            <span class="stat-value losses">${player.losses}</span>
          </div>
          <div class="stat">
            <span class="stat-label" title="% Éxito">📊</span>
            <span class="stat-value percentage">${player.win_percentage}%</span>
          </div>
          <div class="stat">
            <span class="stat-label" title="Partidos Pendientes">⏳</span>
            <span class="stat-value pending">${player.pending_matches}</span>
          </div>
        </div>
      </div>
    `;
    target.appendChild(card);
  });
}

function filterPlayers(searchTerm){
  if(!searchTerm || searchTerm.trim() === ''){
    // Si no hay término de búsqueda, mostrar todos los jugadores
    renderPlayers(document.querySelector('#playersGrid'), allPlayers);
  } else {
    // Filtrar jugadores que coincidan con el término de búsqueda
    const filtered = allPlayers.filter(player => 
      player.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
    renderPlayers(document.querySelector('#playersGrid'), filtered);
  }
}

document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
  if(btn.dataset.tab){ document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    ['standingsA','standingsB','matches','players'].forEach(id=>document.getElementById(id).style.display='none');
    document.getElementById(btn.dataset.tab).style.display='block';
    
    // Si se cambia a la pestaña de jugadores, asegurar que se muestren todos
    if(btn.dataset.tab === 'players' && allPlayers.length > 0){
      const searchInput = document.querySelector('#playerSearch');
      if(!searchInput.value || searchInput.value.trim() === ''){
        renderPlayers(document.querySelector('#playersGrid'), allPlayers);
      }
    }
  }
}));

document.querySelector('#playerSearch').addEventListener('input',(e)=>{
  filterPlayers(e.target.value);
});

// Back button event listener
document.getElementById('backButton').addEventListener('click', goBack);

// ---------- ROSTER FUNCTIONALITY
let currentRosterPlayerId = null;
let previousSection = null;

async function showRoster(playerId) {
  try {
    // Store current section for back button
    const activeSection = document.querySelector('.card:not([style*="display:none"])');
    if (activeSection) {
      previousSection = activeSection.id;
    }
    
    // Hide all sections including tabs
    document.querySelectorAll('.card').forEach(card => {
      card.style.display = 'none';
    });
    
    // Hide tabs navigation
    document.querySelector('.tabs').style.display = 'none';
    
    // Show roster section
    document.getElementById('roster').style.display = 'block';
    
    // Load roster data
    const response = await fetch(`/api/players/${playerId}/roster`);
    if (!response.ok) {
      throw new Error('Player not found');
    }
    
    const rosterData = await response.json();
    currentRosterPlayerId = playerId;
    
    // Populate roster
    populateRoster(rosterData);
    
  } catch (error) {
    console.error('Error loading roster:', error);
    alert('Error al cargar el roster del jugador');
    goBack();
  }
}

function populateRoster(data) {
  const { player, stats, streaks, matches, opponents, not_played_against } = data;
  
  // Player basic info
  document.getElementById('rosterPlayerName').textContent = `Roster de ${player.name}`;
  document.getElementById('rosterPlayerNameLarge').textContent = player.name;
  document.getElementById('rosterPlayerPhoto').src = getPlayerPhoto(player.name, player.id);
  document.getElementById('rosterPlayerPhoto').alt = player.name;
  
  // Join date
  const joinDate = new Date(player.created_at * 1000).toLocaleDateString('es-ES');
  document.getElementById('rosterPlayerJoinDate').textContent = `Miembro desde ${joinDate}`;
  
  // Stats
  document.getElementById('rosterPosition').textContent = `#${stats.position}`;
  document.getElementById('rosterWins').textContent = stats.wins;
  document.getElementById('rosterLosses').textContent = stats.losses;
  document.getElementById('rosterWinPercentage').textContent = `${stats.win_percentage}%`;
  
  // Streaks
  const currentStreakText = streaks.current > 0 ? 
    `${streaks.current} ${streaks.current_type === 'win' ? 'victorias' : 'derrotas'}` : 
    'Sin racha';
  document.getElementById('rosterCurrentStreak').textContent = currentStreakText;
  document.getElementById('rosterCurrentStreak').className = `streak-value ${streaks.current_type}`;
  document.getElementById('rosterBestWinStreak').textContent = streaks.best_win;
  document.getElementById('rosterBestLossStreak').textContent = streaks.best_loss;
  
  // Match history
  renderMatchHistory(matches);
  
  // Opponents
  renderOpponents(opponents, not_played_against);
}

function renderMatchHistory(matches) {
  const container = document.getElementById('rosterMatchesList');
  
  if (!matches || matches.length === 0) {
    container.innerHTML = '<p class="no-data">No hay partidos registrados</p>';
    return;
  }
  
  const matchesHtml = matches.map(match => {
    const date = match.date ? 
      new Date(match.date).toLocaleDateString('es-ES') : 
      new Date(match.created_at * 1000).toLocaleDateString('es-ES');
    
    const resultClass = match.result === 'win' ? 'win' : 'loss';
    const resultIcon = match.result === 'win' ? '🏆' : '❌';
    const resultText = match.result === 'win' ? 'Ganó' : 'Perdió';
    
    return `
      <div class="match-item ${resultClass}">
        <div class="match-date">${date}</div>
        <div class="match-opponent">
          <img src="${getPlayerPhoto(match.opponent_name, match.opponent_id)}" alt="${match.opponent_name}" class="opponent-photo-small">
          <span class="opponent-name" onclick="showRoster(${match.opponent_id})">${match.opponent_name}</span>
        </div>
        <div class="match-result">
          <span class="result-icon">${resultIcon}</span>
          <span class="result-text">${resultText}</span>
        </div>
        <div class="match-score">${match.score}</div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = matchesHtml;
}

function renderOpponents(opponents, notPlayedAgainst) {
  // Opponents played
  const opponentsContainer = document.getElementById('rosterOpponentsList');
  if (opponents && opponents.length > 0) {
    const opponentsHtml = opponents.map(opponent => `
      <div class="opponent-item" onclick="showRoster(${opponent.opponent_id})">
        <img src="${getPlayerPhoto(opponent.opponent_name, opponent.opponent_id)}" alt="${opponent.opponent_name}" class="opponent-photo-small">
        <span class="opponent-name">${opponent.opponent_name}</span>
        <span class="times-played">${opponent.times_played} partido${opponent.times_played > 1 ? 's' : ''}</span>
      </div>
    `).join('');
    opponentsContainer.innerHTML = opponentsHtml;
  } else {
    opponentsContainer.innerHTML = '<p class="no-data">No ha jugado contra nadie</p>';
  }
  
  // Opponents not played against
  const pendingContainer = document.getElementById('rosterPendingOpponents');
  if (notPlayedAgainst && notPlayedAgainst.length > 0) {
    const pendingHtml = notPlayedAgainst.map(opponent => `
      <div class="opponent-item" onclick="showRoster(${opponent.id})">
        <img src="${getPlayerPhoto(opponent.name, opponent.id)}" alt="${opponent.name}" class="opponent-photo-small">
        <span class="opponent-name">${opponent.name}</span>
        <span class="pending-badge">Pendiente</span>
      </div>
    `).join('');
    pendingContainer.innerHTML = pendingHtml;
  } else {
    pendingContainer.innerHTML = '<p class="no-data">Ha jugado contra todos</p>';
  }
}

function goBack() {
  // Hide roster
  document.getElementById('roster').style.display = 'none';
  
  // Show tabs navigation
  document.querySelector('.tabs').style.display = 'flex';
  
  // Show previous section
  if (previousSection) {
    document.getElementById(previousSection).style.display = 'block';
  } else {
    // Default to standings A
    document.getElementById('standingsA').style.display = 'block';
  }
  
  currentRosterPlayerId = null;
  previousSection = null;
}

// Make functions global
window.showRoster = showRoster;
window.goBack = goBack;

loadStandings('A', document.querySelector('#tblA')); loadStandings('B', document.querySelector('#tblB')); loadMatches(document.querySelector('#tblM')); loadPlayers(document.querySelector('#playersGrid'));
