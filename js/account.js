(() => {
  const $ = s => document.querySelector(s);
  const client = window.wardogsSupabase;
  let mode = 'signup';
  const modal = $('#account-modal');
  const msg = (text, error = false) => { const el = $('#auth-message'); el.textContent = text; el.classList.toggle('error', error); };
  const setMode = next => {
    mode = next; $$('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.authMode === mode));
    $('#signup-fields').classList.toggle('hidden', mode !== 'signup');
    $('#auth-password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    $('#auth-submit').innerHTML = mode === 'signup' ? 'CREATE ACCOUNT <span>↗</span>' : 'SIGN IN <span>↗</span>';
    msg('');
  };
  const $$ = s => [...document.querySelectorAll(s)];
  window.wardogsOpenAccount = (startMode) => {
    modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
    if (startMode) setMode(startMode);
    refreshAccount();
  };
  const close = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); };
  $$('[data-close-modal]').forEach(el => el.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  $$('.auth-tab').forEach(b => b.addEventListener('click', () => setMode(b.dataset.authMode)));
  async function refreshAccount() {
    if (!client) { $('#account-button').textContent = 'Account setup needed'; $('#auth-submit').disabled = true; msg('Supabase client could not load. Check your connection and config.', true); return; }
    const { data: { session } } = await client.auth.getSession();
    const signedIn = !!session?.user;
    $('#account-button').innerHTML = signedIn ? 'MY ACCOUNT <span>↗</span>' : 'SIGN IN <span>↗</span>';
    $('#auth-form').classList.toggle('hidden', signedIn);
    $('#account-panel').classList.toggle('hidden', !signedIn);
    $('#auth-message').classList.remove('error');
    if (!signedIn) { $('#auth-submit').disabled = false; return; }
    $('#account-greeting').textContent = 'OPERATOR CONNECTED';
    $('#account-email').textContent = session.user.email || 'Signed-in operator';
    $('#account-display-name').value = '';
    const { data: profile } = await client.from('community_profiles').select('display_name,steam_id64,steam_verified').eq('user_id',session.user.id).maybeSingle();
    if (profile) $('#account-display-name').value = profile.display_name || '';
  }
  $('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!client) { msg('Supabase is not configured. Check js/config.js.', true); return; }
    const submit = $('#auth-submit'); submit.disabled = true; msg('CONTACTING AUTH SERVICE…');
    const email = $('#auth-email').value.trim(); const password = $('#auth-password').value;
    try {
      if (mode === 'signup') {
        const displayName = $('#profile-name').value.trim() || 'WARDOGS Player';
        const steamId = $('#steam-id').value.trim() || null;
        if (steamId && !/^\d{17}$/.test(steamId)) throw new Error('SteamID64 must contain exactly 17 digits.');
        const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
        if (error) throw error;
        if (data.user && data.session) {
          const { error: profileError } = await client.from('community_profiles').insert({ user_id: data.user.id, display_name: displayName, steam_id64: steamId });
          if (profileError) throw profileError;
          msg('Account created. Your community profile is ready.'); await refreshAccount();
        } else {
          msg('Registration started. Check your email to confirm your account, then sign in. Your profile will need to be created after confirmation if email confirmation is enabled.');
        }
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password }); if (error) throw error;
        msg('Signed in successfully.'); await refreshAccount();
      }
    } catch (err) { msg(err.message || 'Authentication failed. Please try again.', true); }
    finally { submit.disabled = false; }
  });
  $('#profile-form').addEventListener('submit', async e => {
    e.preventDefault(); if (!client) return;
    const { data: { user } } = await client.auth.getUser(); if (!user) return;
    const name = $('#account-display-name').value.trim() || 'WARDOGS Player';
    const { error } = await client.from('community_profiles').update({ display_name: name, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    if (error) { window.wardogsToast?.(error.message, true); return; }
    window.wardogsToast?.('Display name saved.');
  });
  $('#signout-button').addEventListener('click', async () => { if (!client) return; const { error } = await client.auth.signOut(); if (error) { window.wardogsToast?.(error.message,true); return; } await refreshAccount(); msg('You are signed out.'); setMode('login'); window.wardogsToast?.('Signed out successfully.'); });
  client?.auth.onAuthStateChange(() => { setTimeout(refreshAccount, 0); });
  refreshAccount();
})();
