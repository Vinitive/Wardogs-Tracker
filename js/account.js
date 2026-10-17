(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const client = window.wardogsSupabase;
  let mode = 'signup';
  let currentUser = null;
  let currentProfile = null;
  const cfg = window.WARDOGS_CONFIG || {};
  const modal = $('#account-modal');
  const msg = (text, error = false) => {
    const el = $('#auth-message');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', error);
  };
  const dashboardMsg = (text, error = false) => {
    const el = $('#dashboard-profile-message');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', error);
  };
  const setMode = next => {
    mode = next;
    $$('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.authMode === mode));
    $('#signup-fields').classList.toggle('hidden', mode !== 'signup');
    $('#auth-password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    $('#auth-submit').innerHTML = mode === 'signup' ? 'CREATE ACCOUNT <span>↗</span>' : 'SIGN IN <span>↗</span>';
    msg('');
  };
  const close = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); };
  const showDashboard = () => {
    close();
    $('#my-account').classList.remove('hidden');
    $('#my-account').scrollIntoView({ behavior:'smooth', block:'start' });
    $('#my-account-nav').classList.remove('hidden');
    $$('.nav-link').forEach(n => n.classList.toggle('active', n.dataset.page === 'my-account'));
    $('.main-nav')?.classList.remove('open');
  };
  const showHub = () => {
    $('#my-account').classList.add('hidden');
    $('#dashboard').scrollIntoView({ behavior:'smooth', block:'start' });
    $$('.nav-link').forEach(n => n.classList.toggle('active', n.dataset.page === 'dashboard'));
  };
  window.wardogsOpenAccount = async (startMode) => {
    if (client && !startMode) {
      const { data: { session } } = await client.auth.getSession();
      if (session?.user) { await refreshAccount(); showDashboard(); return; }
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    if (startMode) setMode(startMode);
    await refreshAccount();
  };
  $$('[data-close-modal]').forEach(el => el.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  $$('.auth-tab').forEach(b => b.addEventListener('click', () => setMode(b.dataset.authMode)));
  $('#account-back-button')?.addEventListener('click', showHub);
  $('#my-account-nav')?.addEventListener('click', e => { e.preventDefault(); showDashboard(); });
  async function loadProfile(user) {
    currentProfile = null;
    const { data, error } = await client.from('community_profiles')
      .select('display_name,steam_id64,steam_verified')
      .eq('user_id', user.id).maybeSingle();
    if (error) {
      dashboardMsg('Profile could not be loaded: ' + error.message, true);
      return null;
    }
    currentProfile = data || null;
    return currentProfile;
  }
  function renderDashboard(user, profile) {
    const displayName = profile?.display_name || 'WARDOGS Player';
    $('#dashboard-display-name').textContent = displayName;
    $('#dashboard-email').textContent = user.email || 'Signed-in operator';
    $('#dashboard-name-input').value = profile?.display_name || '';
    $('#dashboard-steam-id').textContent = profile?.steam_id64 || 'NOT LINKED';
    $('#steam-link-button').textContent = profile?.steam_verified ? 'STEAM ACCOUNT LINKED ✓' : 'LINK STEAM ACCOUNT ↗';
    $('#steam-link-button').disabled = !!profile?.steam_verified;
    $('#dashboard-steam-status').textContent = profile?.steam_verified ? 'VERIFIED' : 'NOT VERIFIED';
    $('#account-button').innerHTML = 'MY ACCOUNT <span>↗</span>';
    $('#my-account-nav').classList.remove('hidden');
  }
  async function refreshAccount() {
    if (!client) {
      $('#account-button').textContent = 'Account setup needed';
      $('#auth-submit').disabled = true;
      msg('Supabase client could not load. Check your connection and config.', true);
      return;
    }
    const { data: { session } } = await client.auth.getSession();
    const signedIn = !!session?.user;
    currentUser = session?.user || null;
    $('#account-button').innerHTML = signedIn ? 'MY ACCOUNT <span>↗</span>' : 'SIGN IN <span>↗</span>';
    $('#auth-form').classList.toggle('hidden', signedIn);
    $('#account-panel').classList.toggle('hidden', !signedIn);
    $('#auth-message').classList.remove('error');
    if (!signedIn) {
      $('#auth-submit').disabled = false;
      $('#my-account-nav').classList.add('hidden');
      $('#my-account').classList.add('hidden');
      return;
    }
    $('#account-greeting').textContent = 'OPERATOR CONNECTED';
    $('#account-email').textContent = session.user.email || 'Signed-in operator';
    $('#account-display-name').value = '';
    const profile = await loadProfile(session.user);
    if (profile) $('#account-display-name').value = profile.display_name || '';
    renderDashboard(session.user, profile);
  }
  $('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!client) { msg('Supabase is not configured. Check js/config.js.', true); return; }
    const submit = $('#auth-submit');
    submit.disabled = true;
    msg('CONTACTING AUTH SERVICE…');
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    try {
      if (mode === 'signup') {
        const displayName = $('#profile-name').value.trim() || 'WARDOGS Player';
        const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
        if (error) throw error;
        if (data.user && data.session) {
          const { error: profileError } = await client.from('community_profiles').upsert(
            { user_id: data.user.id, display_name: displayName },
            { onConflict:'user_id' }
          );
          if (profileError) throw profileError;
          msg('Account created. Your community profile is ready.');
          await refreshAccount();
          showDashboard();
        } else {
          msg('Registration started. Check your email to confirm your account, then sign in. Your profile will be created when you first sign in.');
        }
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        msg('Signed in successfully.');
        await refreshAccount();
        showDashboard();
      }
    } catch (err) {
      msg(err.message || 'Authentication failed. Please try again.', true);
    } finally { submit.disabled = false; }
  });
  $('#profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!client || !currentUser) return;
    const name = $('#account-display-name').value.trim() || 'WARDOGS Player';
    const { error } = await client.from('community_profiles').upsert(
      { user_id: currentUser.id, display_name:name },
      { onConflict:'user_id' }
    );
    if (error) { window.wardogsToast?.(error.message, true); return; }
    await refreshAccount();
    window.wardogsToast?.('Display name saved.');
  });

  $('#steam-link-button').addEventListener('click', async () => {
    const button = $('#steam-link-button');
    const status = $('#steam-link-message');
    if (!client) { status.textContent = 'Supabase is not configured.'; status.classList.add('error'); return; }
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) { status.textContent = 'Sign in again before linking Steam.'; status.classList.add('error'); return; }
    button.disabled = true;
    button.textContent = 'CONNECTING TO STEAM…';
    status.textContent = 'Opening Steam’s official sign-in page…';
    status.classList.remove('error');
    try {
      const response = await fetch(`${cfg.supabaseUrl}/functions/v1/steam-link-start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': cfg.supabasePublishableKey
        },
        body: JSON.stringify({})
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || 'Could not start Steam linking.');
      window.location.assign(result.url);
    } catch (error) {
      status.textContent = error.message || 'Steam linking failed to start.';
      status.classList.add('error');
      button.disabled = false;
      button.textContent = 'LINK STEAM ACCOUNT ↗';
    }
  });

  $('#dashboard-profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!client || !currentUser) { dashboardMsg('Your session expired. Sign in again.', true); return; }
    const name = $('#dashboard-name-input').value.trim() || 'WARDOGS Player';
    dashboardMsg('SAVING PROFILE…');
    const payload = { user_id: currentUser.id, display_name: name };
    const { error } = await client.from('community_profiles').upsert(payload, { onConflict:'user_id' });
    if (error) { dashboardMsg('Could not save profile: ' + error.message, true); return; }
    const { data: { user } } = await client.auth.getUser();
    currentUser = user || currentUser;
    const profile = await loadProfile(currentUser);
    renderDashboard(currentUser, profile);
    dashboardMsg('Account details saved.');
    window.wardogsToast?.('Account details saved.');
  });
  async function signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) { window.wardogsToast?.(error.message, true); return; }
    close();
    $('#my-account').classList.add('hidden');
    await refreshAccount();
    setMode('login');
    showHub();
    window.wardogsToast?.('Signed out successfully.');
  }
  $('#signout-button').addEventListener('click', signOut);
  $('#dashboard-signout-button').addEventListener('click', signOut);
  client?.auth.onAuthStateChange(() => { setTimeout(refreshAccount, 0); });
  refreshAccount();
  const params = new URLSearchParams(window.location.search);
  const steamResult = params.get('steam_link');
  if (steamResult) {
    const detail = params.get('steam_message') || (steamResult === 'success' ? 'Steam account linked.' : 'Steam linking failed.');
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    setTimeout(async () => {
      await refreshAccount();
      showDashboard();
      const status = $('#steam-link-message');
      status.textContent = detail;
      status.classList.toggle('error', steamResult !== 'success');
      if (steamResult === 'success') window.wardogsToast?.('Steam account linked and verified.');
    }, 250);
  }
})();