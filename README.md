# WARDOGS Community Hub

A static, GitHub Pages-ready community dashboard using the WARDOGS dark tactical / neon-lime visual style. It reads public player leaderboards from `wardogstracker.gg`, server status from `wardogsnow.com`, and uses your existing Supabase project for email/password accounts and community profiles.

## Included

- Dashboard with community metrics, cash/gold/level leaderboard tabs, player search, and server status.
- Official WARDOGS logo image sourced from the game's official website, with a text-only fallback if the image host is unavailable.
- In-site player profile panels showing public stats, role progression, and unlocks without redirecting users away from this site.
- Leaderboard tabs for cash, gold, level, career XP, and unlock count.
- Email/password sign-up, sign-in, sign-out, and display-name profile updates.
- Optional SteamID64 input (must be 17 digits).
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

## Important Steam verification limitation

Typing a SteamID64 is **not** proof that a user owns that Steam account. This form stores an unverified ID only. To securely verify Steam ownership, add a server-side Steam OpenID callback (for example a Supabase Edge Function) that validates the Steam response and then marks the profile verified. Do not let the browser set `steam_verified = true`.

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
