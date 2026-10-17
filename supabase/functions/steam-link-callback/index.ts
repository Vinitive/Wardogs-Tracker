import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function redirect(siteUrl: string, status: string, detail?: string) {
  const url = new URL(siteUrl);
  url.searchParams.set("steam_link", status);
  if (detail) url.searchParams.set("steam_message", detail);
  url.hash = "my-account";
  return Response.redirect(url.toString(), 303);
}

Deno.serve(async (req) => {
  const siteUrl = Deno.env.get("SITE_URL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secret = Deno.env.get("STEAM_LINK_SECRET");
  if (!siteUrl || !supabaseUrl || !serviceKey || !secret) {
    return new Response("Steam linking is not configured on the server.", { status: 500 });
  }
  if (req.method !== "GET") return redirect(siteUrl, "error", "Steam returned an unsupported request.");

  const requestUrl = new URL(req.url);
  const state = requestUrl.searchParams.get("state") || "";
  const parts = state.split(".");
  if (parts.length !== 2) return redirect(siteUrl, "error", "The Steam link session was invalid. Try again.");
  const [payload, signature] = parts;
  const expected = await signState(payload, secret);
  if (signature.length !== expected.length) return redirect(siteUrl, "error", "The Steam link session was invalid. Try again.");
  const sigBytes = new TextEncoder().encode(signature);
  const expectedBytes = new TextEncoder().encode(expected);
  let diff = 0;
  for (let i = 0; i < sigBytes.length; i++) diff |= sigBytes[i] ^ expectedBytes[i];
  if (diff !== 0) return redirect(siteUrl, "error", "The Steam link session was invalid. Try again.");

  let stateData: { user_id: string; exp: number; nonce: string };
  try {
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - payload.length % 4) % 4));
    stateData = JSON.parse(decoded);
  } catch {
    return redirect(siteUrl, "error", "The Steam link session was invalid. Try again.");
  }
  if (!stateData.user_id || !stateData.exp || stateData.exp < Math.floor(Date.now() / 1000)) {
    return redirect(siteUrl, "error", "This Steam link session expired. Please try again.");
  }

  const claimedId = requestUrl.searchParams.get("openid.claimed_id") || "";
  const identity = requestUrl.searchParams.get("openid.identity") || "";
  const steamMatch = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
  if (!steamMatch || identity !== claimedId) {
    return redirect(siteUrl, "error", "Steam did not return a valid SteamID64.");
  }

  const openid = new URLSearchParams(requestUrl.searchParams);
  openid.set("openid.mode", "check_authentication");
  openid.delete("state");
  let verification: Response;
  try {
    verification = await fetch("https://steamcommunity.com/openid/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: openid.toString(),
    });
  } catch {
    return redirect(siteUrl, "error", "Could not verify the response with Steam. Please retry.");
  }
  const verificationText = await verification.text();
  if (!verification.ok || !/^is_valid:true\s*$/m.test(verificationText)) {
    return redirect(siteUrl, "error", "Steam ownership verification failed. Please try again.");
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const steamId = steamMatch[1];
  const { data: existing, error: readError } = await supabase
    .from("community_profiles").select("user_id,display_name")
    .eq("steam_id64", steamId).maybeSingle();
  if (readError) return redirect(siteUrl, "error", "Could not check existing Steam links. Contact the site administrator.");
  if (existing && existing.user_id !== stateData.user_id) {
    return redirect(siteUrl, "error", "This Steam account is already linked to another WARDOGS account.");
  }

  const { data: profile } = await supabase.from("community_profiles")
    .select("display_name").eq("user_id", stateData.user_id).maybeSingle();
  const { error: saveError } = await supabase.from("community_profiles").upsert({
    user_id: stateData.user_id,
    display_name: profile?.display_name || "WARDOGS Player",
    steam_id64: steamId,
    steam_verified: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (saveError) return redirect(siteUrl, "error", "Steam was verified, but the profile could not be updated. Check the community_profiles table and permissions.");
  return redirect(siteUrl, "success", "Steam account verified and linked.");
});
