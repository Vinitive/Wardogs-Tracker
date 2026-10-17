(() => {
  const cfg = window.WARDOGS_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const state = { sort: 'cash', players: [], allPlayers: [], serverData: null, directoryLoading: false, directoryLoaded: false, apiTotal: null };
  const number = (v) => { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'; };
  const safe = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pick = (obj, keys, fallback = '') => { for (const k of keys) if (obj?.[k] !== undefined && obj?.[k] !== null) return obj[k]; return fallback; };
  const playerName = (p) => pick(p,['name','displayName','display_name','username','playerName','steamName'],'Unknown Operator');
  const steamId = (p) => String(pick(p,['steamId','steamID','steam_id','steamId64','steam_id64'],'') || '');
  const playerLevel = (p) => pick(p,['wardogLevel','level','playerLevel','player_level'],null);
  window.wardogsToast = (msg, error = false) => { const t = $('#toast'); if (!t) return; t.textContent = msg; t.style.borderColor = error ? '#8b443a' : ''; t.classList.add('show'); clearTimeout(window.__wardogsToastTimer); window.__wardogsToastTimer = setTimeout(() => t.classList.remove('show'), 4800); };
  function listFrom(data) { if (Array.isArray(data)) return data; for (const k of ['players','data','results','leaderboard','items']) if (Array.isArray(data?.[k])) return data[k]; return []; }
  async function fetchJson(url) { const res = await fetch(url, { headers: { Accept: 'application/json' } }); if (!res.ok) throw new Error(`Request failed (${res.status})`); return res.json(); }
  async function loadLeaderboard(sort = state.sort) {
    state.sort = sort;
    $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.sort === sort));
    const heading = $('#rank-value-heading'); if (heading) heading.textContent = ({cash:'CASH BALANCE',gold:'GOLD RESERVE',level:'PLAYER LEVEL',xp:'CAREER XP',unlocks:'UNLOCKS'})[sort];
    const body = $('#leaderboard-body'); body.innerHTML = '<tr><td colspan="4" class="empty-cell">SYNCING TRACKER DATA…</td></tr>';
    try {
      const data = await fetchJson(`${cfg.playerApiBase}/leaderboard?sort=${encodeURIComponent(sort)}&limit=100&offset=0`);
      const rows = listFrom(data); state.players = rows; state.apiTotal = Number(data.total) || rows.length;
      renderLeaderboard(rows, sort); updateMetrics(sort, rows);
      $('#leaderboard-status').textContent = `TRACKER SYNC COMPLETE / ${number(data.total ?? rows.length)} PUBLIC RECORDS`;
      if (!state.directoryLoaded && !state.directoryLoading) loadAllTrackedPlayers(data);
      else renderDirectory(state.allPlayers.length ? state.allPlayers : rows);
    } catch (err) {
      body.innerHTML = '<tr><td colspan="4" class="empty-cell">TRACKER FEED UNAVAILABLE. TRY AGAIN LATER.</td></tr>';
      $('#leaderboard-status').textContent = 'FEED OFFLINE / RETRY LATER';
      if (!state.players.length) $('#player-grid').innerHTML = '<div class="empty-card">The public tracker feed could not be reached. Try again later.</div>';
    }
  }
  async function loadAllTrackedPlayers(firstPageData) {
    state.directoryLoading = true;
    const grid = $('#player-grid');
    grid.innerHTML = '<div class="empty-card">Loading the public tracked-player index…</div>';
    try {
      const total = Math.max(0, Number(firstPageData?.total) || listFrom(firstPageData).length);
      // Start with the level-sorted first page so the directory is a consistent, deduplicated index.
      const first = await fetchJson(`${cfg.playerApiBase}/leaderboard?sort=level&limit=100&offset=0`);
      const collected = listFrom(first).slice();
      // The API pages public profiles only. Load sequentially and stay below the provider's rate limit.
      for (let offset = collected.length; offset < total; offset += 100) {
        const page = await fetchJson(`${cfg.playerApiBase}/leaderboard?sort=level&limit=100&offset=${offset}`);
        const rows = listFrom(page);
        if (!rows.length) break;
        collected.push(...rows);
        $('#directory-count').textContent = `LOADING PUBLIC TRACKER INDEX / ${number(collected.length)} OF ${number(total)}`;
      }
      const unique = new Map();
      for (const p of collected) {
        const id = steamId(p);
        const key = id || `${playerName(p).toLowerCase()}-${playerLevel(p) ?? ''}`;
        if (!unique.has(key)) unique.set(key, p);
      }
      state.allPlayers = [...unique.values()];
      state.directoryLoaded = true;
      renderDirectory(state.allPlayers);
    } catch (err) {
      // Keep the first leaderboard page useful if a later page fails.
      state.allPlayers = state.players.slice();
      renderDirectory(state.allPlayers);
      $('#directory-count').textContent = `PARTIAL INDEX / ${number(state.allPlayers.length)} PUBLIC RECORDS`;
      $('#player-grid').insertAdjacentHTML('beforeend','<p class="directory-help">Some pages could not be loaded. Try again later for a fuller index.</p>');
    } finally { state.directoryLoading = false; }
  }
  function renderLeaderboard(rows, sort) {
    const body = $('#leaderboard-body');
    if (!rows.length) { body.innerHTML = '<tr><td colspan="4" class="empty-cell">NO PUBLIC RECORDS RETURNED.</td></tr>'; return; }
    body.innerHTML = rows.slice(0, 10).map((p, i) => {
      const name = playerName(p);
      const value = pick(p, sort === 'cash' ? ['cash','money','balance','cashBalance','value'] : sort === 'gold' ? ['gold','goldBalance','gold_balance','value'] : sort === 'xp' ? ['careerXp','career_xp','xp','value'] : sort === 'unlocks' ? ['unlocks','unlockCount','unlock_count','value'] : ['wardogLevel','level','playerLevel','player_level','value'], null);
      const id = steamId(p);
      return `<tr><td><span class="rank-number ${i < 3 ? 'top' : ''}">#${String(p.rank ?? i+1).padStart(2,'0')}</span></td><td><div class="operator-cell"><span class="operator-avatar">${safe(String(name).trim().charAt(0).toUpperCase() || 'W')}</span><span>${safe(name)}</span></div></td><td class="value-cell">${sort === 'cash' && value !== null ? '$' : ''}${number(value)}</td><td><span class="online-tag">● ${id ? 'TRACKED' : 'PUBLIC'}</span></td></tr>`;
    }).join('');
  }
  function renderDirectory(rows) {
    const q = ($('#player-search')?.value || '').trim().toLowerCase();
    const filtered = rows.filter(p => playerName(p).toLowerCase().includes(q) || steamId(p).includes(q));
    const grid = $('#player-grid');
    const count = $('#directory-count');
    if (count && state.directoryLoaded) count.textContent = `${number(state.allPlayers.length)} PUBLIC TRACKER PROFILES INDEXED`;
    if (!filtered.length) { grid.innerHTML = `<div class="empty-card">${q ? 'No matching public tracked player found. Check the spelling or SteamID64.' : 'No public records are currently available.'}</div>`; return; }
    const visible = filtered.slice(0, 60);
    grid.innerHTML = visible.map(p => {
      const name = playerName(p);
      const level = playerLevel(p);
      const cash = pick(p,['cash','money','balance','cashBalance'],null);
      const gold = pick(p,['gold','goldBalance','gold_balance'],null);
      const id = steamId(p);
      const avatar = pick(p,['avatarUrl','avatar_url'],'');
      const details = [level !== null ? `LVL ${number(level)}` : '', cash !== null ? `$${number(cash)}` : '', gold !== null ? `${number(gold)} GOLD` : ''].filter(Boolean).join(' · ');
      const avatarHtml = avatar ? `<img class="player-avatar-img" src="${safe(avatar)}" alt="" loading="lazy" onerror="this.style.display='none'">` : `<span class="operator-avatar">${safe(String(name).trim().charAt(0).toUpperCase() || 'W')}</span>`;
      return `<article class="player-card" ${id ? `role="button" tabindex="0" data-player-id="${safe(id)}" aria-label="View stats for ${safe(name)}"` : ''}>${avatarHtml}<div class="player-info"><b>${safe(name)}</b><small>${safe(details || (id ? 'VIEW PLAYER STATS' : 'PUBLIC TRACKER PROFILE'))}</small>${id ? `<small>STEAMID64 ${safe(id)}</small>` : ''}</div><span class="player-level">${level !== null ? `L${safe(level)}` : 'WG'}</span></article>`;
    }).join('') + (filtered.length > visible.length ? `<div class="empty-card">Showing ${number(visible.length)} of ${number(filtered.length)} matches. Refine your search to narrow the results.</div>` : '');
    grid.querySelectorAll('[data-player-id]').forEach(card => {
      const open = () => showPlayerProfile(card.dataset.playerId);
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }
  function ensureProfileModal() {
    let modal = $('#player-profile-modal');
    if (modal) return modal;
    document.body.insertAdjacentHTML('beforeend', `<div class="profile-modal-backdrop" id="player-profile-modal" hidden><section class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-name"><button class="profile-modal-close" type="button" aria-label="Close player profile">×</button><div id="profile-modal-content"><div class="empty-card">Loading operator profile…</div></div><p class="profile-attribution">Public stats provided by <a href="https://wardogstracker.gg" target="_blank" rel="noopener noreferrer">WARDOGS Tracker</a>.</p></section></div>`);
    modal = $('#player-profile-modal');
    modal.querySelector('.profile-modal-close').addEventListener('click', () => { modal.hidden = true; document.body.classList.remove('profile-modal-open'); });
    modal.addEventListener('click', e => { if (e.target === modal) { modal.hidden = true; document.body.classList.remove('profile-modal-open'); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) { modal.hidden = true; document.body.classList.remove('profile-modal-open'); } });
    return modal;
  }
  async function showPlayerProfile(id) {
    if (!/^\\d{17}$/.test(String(id))) return;
    const modal = ensureProfileModal();
    const content = $('#profile-modal-content');
    modal.hidden = false;
    document.body.classList.add('profile-modal-open');
    content.innerHTML = '<div class="empty-card">SYNCING OPERATOR RECORD…</div>';
    try {
      const data = await fetchJson(`${cfg.playerApiBase}/players/${encodeURIComponent(id)}`);
      const p = data.player || data;
      const stats = p.stats || {};
      const roles = stats.roles && typeof stats.roles === 'object' ? Object.entries(stats.roles) : [];
      const statCard = (label, value) => `<div class="profile-stat"><small>${label}</small><b>${value}</b></div>`;
      const cash = stats.cash == null ? 'Private' : '$' + number(stats.cash);
      const gold = stats.gold == null ? 'Private' : number(stats.gold);
      const avatar = p.avatarUrl ? `<img class="profile-avatar" src="${safe(p.avatarUrl)}" alt="" onerror="this.style.display='none'">` : '';
      const roleMarkup = roles.length ? `<section class="profile-section"><h3>ROLE PROGRESSION</h3><div class="profile-role-grid">${roles.map(([key,val]) => `<div class="profile-role"><span>${safe(key)}</span><b>LVL ${number(val?.level)}</b><small>${number(val?.xp)} XP</small></div>`).join('')}</div></section>` : '';
      content.innerHTML = `<div class="profile-hero">${avatar}<div><span class="profile-eyebrow">WARDOGS OPERATOR PROFILE</span><h2 id="profile-modal-name">${safe(p.name || 'Unknown Operator')}</h2><p>STEAMID64 ${safe(p.steamId || id)}</p><span class="profile-rank">${p.leaderboardRank ? 'GLOBAL RANK #' + number(p.leaderboardRank) : 'PUBLIC TRACKER PROFILE'}</span></div></div><div class="profile-stat-grid">${statCard('WARDOG LEVEL',number(stats.wardogLevel))}${statCard('CAREER XP',number(stats.careerXp))}${statCard('CASH',cash)}${statCard('GOLD',gold)}${statCard('UNLOCKS',number(stats.unlocks))}${statCard('ACHIEVEMENTS',number(p.achievements))}</div>${roleMarkup}<section class="profile-section"><h3>UNLOCKED ITEMS</h3><div id="profile-unlocks" class="profile-unlocks"><div class="empty-card">Loading unlock list…</div></div></section><div class="profile-updated">Last synced: ${stats.syncedAt ? safe(new Date(stats.syncedAt).toLocaleString()) : 'Not available'}</div>`;
      try {
        const unlockData = await fetchJson(`${cfg.playerApiBase}/players/${encodeURIComponent(id)}/unlocks`);
        const unlocks = unlockData.unlocks;
        const unlockEl = $('#profile-unlocks');
        if (!unlocks || !Array.isArray(unlocks.items) || !unlocks.items.length) {
          unlockEl.innerHTML = '<p class="profile-muted">Unlock list is private or not available.</p>';
        } else {
          unlockEl.innerHTML = `<div class="unlock-summary">${number(unlocks.total)} total · ${number(unlocks.matched)} identified</div><div class="unlock-chip-grid">${unlocks.items.slice(0,60).map(item => `<span class="unlock-chip">${safe(item.item?.name || String(item.gameId || 'Unknown item').split('.').pop())}</span>`).join('')}${unlocks.items.length > 60 ? `<span class="unlock-chip">+${number(unlocks.items.length-60)} more</span>` : ''}</div>`;
        }
      } catch (_) {
        const unlockEl = $('#profile-unlocks');
        if (unlockEl) unlockEl.innerHTML = '<p class="profile-muted">Unlock data is private or temporarily unavailable.</p>';
      }
    } catch (_) {
      content.innerHTML = '<div class="empty-card">This player profile is private, unavailable, or has not synced stats yet.</div>';
    }
  }
  function updateMetrics(sort, rows) {
    $('#metric-players').textContent = number(state.apiTotal || state.allPlayers.length || rows.length);
    const metricKey = sort === 'cash' ? 'metric-cash' : sort === 'gold' ? 'metric-gold' : null;
    if (metricKey && rows.length) {
      const p = rows[0]; const v = pick(p, sort === 'cash' ? ['cash','money','balance','cashBalance','value'] : ['gold','goldBalance','gold_balance','value'], null);
      $(`#${metricKey}`).textContent = v === null ? '—' : (sort === 'cash' ? '$' : '') + number(v);
    }
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
  $('#player-search')?.addEventListener('input', () => renderDirectory(state.allPlayers.length ? state.allPlayers : state.players));
  $$('.nav-link').forEach(a => a.addEventListener('click', () => { $$('.nav-link').forEach(n => n.classList.toggle('active', n === a)); $('.main-nav')?.classList.remove('open'); }));
  $('#mobile-menu')?.addEventListener('click', () => $('.main-nav')?.classList.toggle('open'));
  $('#join-button')?.addEventListener('click', () => window.wardogsOpenAccount?.('signup'));
  $('#account-button')?.addEventListener('click', () => window.wardogsOpenAccount?.());
  window.wardogsLoadLeaderboard = loadLeaderboard;
  loadLeaderboard('cash'); loadServers();
})();
