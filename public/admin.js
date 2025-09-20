const $=(s)=>document.querySelector(s);
async function authFetch(url, opts={}){ return fetch(url, opts); }
async function reloadMatches(){
  const res=await authFetch('/api/matches'); const data=await res.json(); const container=$('#adminMatches');
  const tbl=document.createElement('table'); tbl.innerHTML='<thead><tr><th>ID</th><th>Fecha</th><th>Ganador</th><th>Perdedor</th><th>Score</th><th></th></tr></thead>';
  const tb=document.createElement('tbody');
  data.forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.id}</td><td>${r.date ?? new Date(r.created_at*1000).toISOString().slice(0,10)}</td><td>${r.winner}</td><td>${r.loser}</td><td>${r.score}</td><td><button data-id="${r.id}" class="tab">Borrar</button></td>`; tb.appendChild(tr); });
  tbl.appendChild(tb); container.innerHTML=''; container.appendChild(tbl);
  container.querySelectorAll('button[data-id]').forEach(btn=>btn.addEventListener('click', async ()=>{ if(confirm('¿Borrar partido?')){ await authFetch(`/api/admin/match/${btn.dataset.id}`,{method:'DELETE'}); await reloadMatches(); } }));
}
document.querySelector('#matchForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const payload={winner:$('#winner').value.trim(), loser:$('#loser').value.trim(), score:$('#score').value.trim(), date:$('#date').value.trim()||undefined};
  const res=await authFetch('/api/admin/match',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  document.querySelector('#saveMsg').textContent=res.ok?'Guardado ✅':'Error ❌'; if(res.ok){ e.target.reset(); await reloadMatches(); }
});
document.querySelector('#mergeForm').addEventListener('submit', async (e)=>{
  e.preventDefault(); const payload={fromName:$('#fromName').value.trim(), toName:$('#toName').value.trim()};
  const res=await authFetch('/api/admin/merge',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  document.querySelector('#mergeMsg').textContent=res.ok?'Unificación aplicada ✅':'Error ❌';
});
document.querySelector('#btnImport').addEventListener('click', async ()=>{
  const txt=document.querySelector('#csvText').value; const res=await authFetch('/api/admin/import',{method:'POST', body:txt});
  document.querySelector('#impMsg').textContent=res.ok?'Importado ✅':'Error ❌'; if(res.ok) await reloadMatches();
});
reloadMatches();
