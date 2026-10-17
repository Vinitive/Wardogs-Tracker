(() => {
  const cfg = window.WARDOGS_CONFIG || {};
  window.wardogsSupabase = null;
  if (window.supabase?.createClient && cfg.supabaseUrl && cfg.supabasePublishableKey) {
    window.wardogsSupabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
})();
