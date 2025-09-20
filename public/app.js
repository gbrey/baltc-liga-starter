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
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
  if(btn.dataset.tab){ document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    ['standingsA','standingsB','matches'].forEach(id=>document.getElementById(id).style.display='none');
    document.getElementById(btn.dataset.tab).style.display='block';
  }
}));
loadStandings('A', document.querySelector('#tblA')); loadStandings('B', document.querySelector('#tblB')); loadMatches(document.querySelector('#tblM'));
