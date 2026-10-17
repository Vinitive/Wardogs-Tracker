(() => {
  const cfg = window.WARDOGS_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const state = { sort: 'cash', players: [], serverData: null };
  const number = (v) => { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'; };
  const safe = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pick = (obj, keys, fallback = '') => { for (const k of keys) if (obj?.[k] !== undefined && obj?.[k] !== null) return obj[k]; return fallback; };
  window.wardogsToast = (msg, error = false) => { const t = $('#toast'); if (!t) return; t.textContent = msg; t.style.borderColor = error ? '#8b443a' : ''; t.classList.add('show'); clearTimeout(window.__wardogsToastTimer); window.__wardogsToastTimer = setTimeout(() => t.classList.remove('show'), 4800); };
  function listFrom(data) { if (Array.isArray(data)) return data; for (const k of ['players','data','results','leaderboard','items']) if (Array.isArray(data?.[k])) return data[k]; return []; }
  async function fetchJson(url) { const res = await fetch(url, { headers: { Accept: 'application/json' } }); if (!res.ok) throw new Error(`Request failed (${res.status})`); return res.json(); }
  async function loadLeaderboard(sort = state.sort) {
    state.sort = sort;
    $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.sort === sort));
    const heading = $('#rank-value-heading'); if (heading) heading.textContent = ({cash:'CASH BALANCE',gold:'GOLD RESERVE',level:'PLAYER LEVEL'})[sort];
    const body = $('#leaderboard-body'); body.innerHTML = '<tr><td colspan="4" class="empty-cell">SYNCING TRACKER DATA…</td></tr>';
    try {
      const data = await fetchJson(`${cfg.playerApiBase}/leaderboard?sort=${encodeURIComponent(sort)}&limit=100&offset=0`);
      const rows = listFrom(data); state.players = rows;
      renderLeaderboard(rows, sort); renderDirectory(rows); updateMetrics(sort, rows);
      $('#leaderboard-status').textContent = `TRACKER SYNC COMPLETE / ${rows.length} RECORDS`;
    } catch (err) {
      body.innerHTML = '<tr><td colspan="4" class="empty-cell">TRACKER FEED UNAVAILABLE. TRY AGAIN LATER.</td></tr>';
      $('#leaderboard-status').textContent = 'FEED OFFLINE / RETRY LATER';
      if (!state.players.length) { $('#player-grid').innerHTML = '<div class="empty-card">The public tracker feed could not be reached. Community profiles are managed separately.</div>'; }
    }
  }
  function renderLeaderboard(rows, sort) {
    const body = $('#leaderboard-body');
    if (!rows.length) { body.innerHTML = '<tr><td colspan="4" class="empty-cell">NO PUBLIC RECORDS RETURNED.</td></tr>'; return; }
    body.innerHTML = rows.slice(0, 10).map((p, i) => {
      const name = pick(p,['displayName','display_name','username','name','playerName','steamName'],'Unknown Operator');
      const value = pick(p, sort === 'cash' ? ['cash','money','balance','cashBalance','value'] : sort === 'gold' ? ['gold','goldBalance','gold_balance','value'] : ['level','playerLevel','player_level','value'], null);
      const id = pick(p,['steamId','steamID','steam_id','steamId64','id'],'');
      return `<tr><td><span class="rank-number ${i < 3 ? 'top' : ''}">#${String(i+1).padStart(2,'0')}</span></td><td><div class="operator-cell"><span class="operator-avatar">${safe(String(name).trim().charAt(0).toUpperCase() || 'W')}</span><span>${safe(name)}</span></div></td><td class="value-cell">${number(value)}</td><td><span class="online-tag">${id ? '● TRACKED' : '● PUBLIC'}</span></td></tr>`;
    }).join('');
  }
  function renderDirectory(rows) {
    const q = ($('#player-search')?.value || '').trim().toLowerCase();
    const filtered = rows.filter(p => String(pick(p,['displayName','display_name','username','name','playerName','steamName'],'Unknown Operator')).toLowerCase().includes(q));
    const grid = $('#player-grid');
    if (!filtered.length) { grid.innerHTML = '<div class="empty-card">No matching public operators found.</div>'; return; }
    grid.innerHTML = filtered.slice(0, 30).map(p => {
      const name = pick(p,['displayName','display_name','username','name','playerName','steamName'],'Unknown Operator');
      const level = pick(p,['level','playerLevel','player_level'],null);
      const cash = pick(p,['cash','money','balance','cashBalance'],null);
      const gold = pick(p,['gold','goldBalance','gold_balance'],null);
      return `<article class="player-card"><span class="operator-avatar">${safe(String(name).trim().charAt(0).toUpperCase() || 'W')}</span><div class="player-info"><b>${safe(name)}</b><small>${cash !== null ? `$${number(cash)} CASH` : 'PUBLIC TRACKER'}${gold !== null ? ` · ${number(gold)} GOLD` : ''}</small></div><span class="player-level">${level !== null ? `L${safe(level)}` : 'WG'}</span></article>`;
    }).join('');
  }
  function updateMetrics(sort, rows) {
    $('#metric-players').textContent = number(rows.length);
    const metricKey = sort === 'cash' ? 'metric-cash' : sort === 'gold' ? 'metric-gold' : null;
    if (metricKey && rows.length) {
      const p = rows[0]; const v = pick(p, sort === 'cash' ? ['cash','money','balance','cashBalance','value'] : ['gold','goldBalance','gold_balance','value'], null);
      $(`#${metricKey}`).textContent = v === null ? '—' : (sort === 'cash' ? '$' : '') + number(v);
    }
    // Use the current leaderboard as a fallback for the opposite metric only if its field is present.
    if (rows.length) {
      const p = rows[0];
      if (sort !== 'cash') { const v = pick(p,['cash','money','balance','cashBalance'],null); if (v !== null) $('#metric-cash').textContent = '$'+number(v); }
      if (sort !== 'gold') { const v = pick(p,['gold','goldBalance','gold_balance'],null); if (v !== null) $('#metric-gold').textContent = number(v); }
    }
  }
  async function loadServers() {
    try {
      const data = await fetchJson(`${cfg.serverApiBase}/status`); state.serverData = data;
      const servers = Array.isArray(data) ? data : pick(data,['servers','data','results'],null);
      const entries = Array.isArray(servers) ? servers : [data];
      const valid = entries.filter(s => s && typeof s === 'object');
      $('#metric-servers').textContent = number(valid.filter(s => pick(s,['online','isOnline','is_online','status'],false) === true || String(pick(s,['status','state'],'')).toLowerCase() === 'online').length);
      $('#server-list').innerHTML = valid.slice(0,5).map(s => {
        const name = pick(s,['name','serverName','server_name','title'],'WARDOGS SERVER');
        const statusRaw = pick(s,['status','state'], pick(s,['online','isOnline','is_online'],null) === true ? 'online' : 'unknown');
        const online = statusRaw === true || String(statusRaw).toLowerCase() === 'online' || String(statusRaw).toLowerCase() === 'up';
        const down = statusRaw === false || ['offline','down','unavailable'].includes(String(statusRaw).toLowerCase());
        const players = pick(s,['players','playerCount','player_count','onlinePlayers'],null);
        const max = pick(s,['maxPlayers','max_players','capacity'],null);
        return `<div class="server-row"><span class="server-symbol">⌁</span><div><b>${safe(name)}</b><small>${players !== null ? `${number(players)}${max !== null ? ` / ${number(max)}` : ''} OPERATORS` : 'COMMUNITY SERVER'}</small></div><span class="server-state ${down?'state-down':!online?'state-wait':''}">${online?'ONLINE':down?'OFFLINE':'STATUS N/A'}</span></div>`;
      }).join('') || '<div class="server-row"><span class="server-symbol">⌁</span><div><b>No server records</b><small>STATUS DATA EMPTY</small></div><span class="server-state state-wait">UNKNOWN</span></div>';
    } catch (_) {
      $('#metric-servers').textContent = '—';
      $('#server-list').innerHTML = '<div class="server-row"><span class="server-symbol">⌁</span><div><b>Status feed unavailable</b><small>TRY AGAIN LATER</small></div><span class="server-state state-wait">UNKNOWN</span></div>';
    }
  }
  $$('.tab').forEach(b => b.addEventListener('click', () => loadLeaderboard(b.dataset.sort)));
  $('#player-search')?.addEventListener('input', () => renderDirectory(state.players));
  $$('.nav-link').forEach(a => a.addEventListener('click', () => { $$('.nav-link').forEach(n => n.classList.toggle('active', n === a)); $('.main-nav')?.classList.remove('open'); }));
  $('#mobile-menu')?.addEventListener('click', () => $('.main-nav')?.classList.toggle('open'));
  $('#join-button')?.addEventListener('click', () => window.wardogsOpenAccount?.('signup'));
  $('#account-button')?.addEventListener('click', () => window.wardogsOpenAccount?.());
  window.wardogsLoadLeaderboard = loadLeaderboard;
  loadLeaderboard('cash'); loadServers();
})();
