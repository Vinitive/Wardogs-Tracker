import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const siteOrigin = (() => { try { return new URL(Deno.env.get("SITE_URL") || "").origin; } catch { return "*"; } })();
const corsHeaders = {
  "Access-Control-Allow-Origin": siteOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signState(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST to start Steam linking." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const secret = Deno.env.get("STEAM_LINK_SECRET");
  const siteUrl = Deno.env.get("SITE_URL");
  if (!supabaseUrl || !anonKey || !secret || !siteUrl) {
    return json({ error: "Steam linking is not configured on the server yet." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Sign in before linking Steam." }, 401);
  const token = authHeader.slice(7);
  const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return json({ error: "Your session is invalid or expired. Sign in again." }, 401);

  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    user_id: user.id,
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce: crypto.randomUUID(),
  })));
  const signature = await signState(payload, secret);
  const state = payload + "." + signature;
  const callback = new URL("/functions/v1/steam-link-callback", supabaseUrl);
  callback.searchParams.set("state", state);
  const realm = new URL(supabaseUrl).origin;

  const steam = new URL("https://steamcommunity.com/openid/login");
  steam.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
  steam.searchParams.set("openid.mode", "checkid_setup");
  steam.searchParams.set("openid.return_to", callback.toString());
  steam.searchParams.set("openid.realm", realm);
  steam.searchParams.set("openid.identity", "http://specs.openid.net/auth/2.0/identifier_select");
  steam.searchParams.set("openid.claimed_id", "http://specs.openid.net/auth/2.0/identifier_select");

  return json({ url: steam.toString() });
});
