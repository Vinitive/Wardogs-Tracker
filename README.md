# WARDOGS Community Hub

A static, GitHub Pages-ready community dashboard using the WARDOGS dark tactical / neon-lime visual style. It reads public player leaderboards from `wardogstracker.gg`, server status from `wardogsnow.com`, and uses your existing Supabase project for email/password accounts and community profiles.

## Included

- Dashboard with community metrics, cash/gold/level leaderboard tabs, player search, and server status.
- Official WARDOGS logo image sourced from the game's official website, with a text-only fallback if the image host is unavailable.
- In-site player profile panels showing public stats, role progression, and unlocks without redirecting users away from this site.
- Leaderboard tabs for cash, gold, level, career XP, and unlock count.
- Email/password sign-up, sign-in, sign-out, and display-name profile updates.
- Secure Steam account linking through Steam OpenID 2.0, verified server-side by Supabase Edge Functions.
- Responsive desktop/mobile layout.
- Static deployment; no build step required.

## Deploy with GitHub Pages

This project is stored in the `Vinitive/Wardogs-Tracker` repository. The entry point is `index.html` at the repository root.

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
3. Wait for GitHub Pages to publish the site, then open the URL shown in the Pages settings.
4. In Supabase, open **Authentication → URL Configuration**. Set **Site URL** to the published site URL and add that exact URL to **Redirect URLs**. For a project site, use the full published URL including its repository path.

## Supabase setup

This build is configured to use the existing project URL and publishable key in `js/config.js`. Publishable keys are intended for browser use; **never** put a Supabase service-role key, database password, or secret API token in frontend files.

The current schema expected by the account UI is `public.community_profiles` with these fields:

- `user_id` (UUID, primary key, references `auth.users.id`)
- `display_name` (text)
- `steam_id64` (text, nullable)
- `steam_verified` (boolean, default false)
- `stats_json` (jsonb, default `{}`)
- `stats_synced_at` (timestamptz, nullable)
- `created_at` and `updated_at` (timestamptz)

The SQL already run for this project should provide these fields and RLS policies. Keep Row Level Security enabled. The frontend intentionally does not write `steam_verified` or trusted game stats.

### Email confirmation note

If Supabase requires email confirmation, a newly registered user may not have a session immediately. This starter build tells the user to confirm their email and sign in. Depending on your RLS rules, the profile insert may need to be created after first sign-in; if that happens, we should add a safe `ensure profile` step or database trigger. Do not disable RLS just to bypass this.

## Steam account linking

The repository includes two Supabase Edge Functions:

- `steam-link-start`: requires a valid signed-in Supabase user and creates a short-lived signed state before redirecting to Steam.
- `steam-link-callback`: validates the OpenID response directly with Steam, extracts the 17-digit SteamID64, rejects IDs already linked to another community account, and marks the profile verified using a server-side service-role client.

**The functions must be deployed and configured in Supabase before the button can work.**

1. Install the Supabase CLI and sign in: `supabase login`.
2. Link this repository to the project: `supabase link --project-ref rizubtsdkjwbvtbnnhyi`.
3. Set `SITE_URL` to the exact published GitHub Pages URL (including the repository path if applicable), and set `STEAM_LINK_SECRET` to a long random secret. Keep these as server-side secrets only:
   `supabase secrets set SITE_URL="https://YOUR-PUBLISHED-SITE-URL" STEAM_LINK_SECRET="A-LONG-RANDOM-SECRET"`
4. Deploy both functions:
   `supabase functions deploy steam-link-start`
   `supabase functions deploy steam-link-callback`
5. Ensure `community_profiles` has `user_id` (unique/primary key), `display_name`, `steam_id64` (unique when not null), `steam_verified`, and `updated_at`. Keep RLS enabled. Only the callback function may set `steam_verified = true`.

Steam linking verifies ownership of the Steam account, but does not itself provide WARDOGS game stats. Stats still depend on the public WARDOGS tracker API.

## Data/API notes

- Public leaderboard requests use `https://wardogstracker.gg/api/v1/leaderboard?sort=cash|gold|level&limit=100&offset=0`.
- Server status requests use `https://wardogsnow.com/api/public/v1/status`.
- API availability, response fields, and cross-origin browser access are controlled by those services. If their field names or CORS policies differ, update `js/app.js` accordingly.
- The directory currently shows public tracker leaderboard records, not a verified-only Supabase community directory. Clicking a player opens their public stats inside this site. Data is read from the WARDOGS Tracker API, respects its public/private profile settings, and should be credited to WARDOGS Tracker.
- This site does not yet provide cheat-report submissions, anti-cheat verdicts, private Steam inventory access, or automatic stats syncing into Supabase.

## Files

```text
index.html
css/styles.css
js/config.js
js/supabase.js
js/app.js
js/account.js
README.md
```
