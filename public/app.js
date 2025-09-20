const $=(s)=>document.querySelector(s);
function renderTable(container, rows){
  const tbl=document.createElement('table'); const thead=document.createElement('thead'); const tbody=document.createElement('tbody'); tbl.appendChild(thead); tbl.appendChild(tbody);
  if(!rows||rows.length===0){ container.innerHTML='<p class="small">Sin datos.</p>'; return; }
  const cols=Object.keys(rows[0]); const trh=document.createElement('tr'); cols.forEach(h=>{const th=document.createElement('th'); th.textContent=h; trh.appendChild(th)}); thead.appendChild(trh);
  rows.forEach(r=>{const tr=document.createElement('tr'); cols.forEach(k=>{const td=document.createElement('td'); td.textContent=r[k]; tr.appendChild(td)}); tbody.appendChild(tr)});
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
    return {Pos:`${String(position).padStart(2,' ')} ${medal}`,Jugador:r.name,PJ:r.pj,PG:r.pg,PP:r.pp,Pts:r.pts};
  });
  renderTable(target, rows);
}
async function loadMatches(target){
  const res=await fetch('/api/matches'); const data=await res.json();
  const rows=data.map(r=>({Fecha:r.date ?? new Date(r.created_at*1000).toISOString().slice(0,10),Ganador:r.winner,Perdedor:r.loser,Score:r.score}));
  renderTable(target, rows);
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
        <h4>${player.name}</h4>
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

loadStandings('A', document.querySelector('#tblA')); loadStandings('B', document.querySelector('#tblB')); loadMatches(document.querySelector('#tblM')); loadPlayers(document.querySelector('#playersGrid'));
