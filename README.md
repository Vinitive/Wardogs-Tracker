# WARDOGS Community Hub

A static, GitHub Pages-ready community dashboard using the WARDOGS dark tactical / neon-lime visual style. It reads public player leaderboards from `wardogstracker.gg`, server status from `wardogsnow.com`, and uses your existing Supabase project for email/password accounts and community profiles.

## Included

- Dashboard with community metrics, cash/gold/level leaderboard tabs, player search, and server status.
- Email/password sign-up, sign-in, sign-out, and display-name profile updates.
- Optional SteamID64 input (must be 17 digits).
- Responsive desktop/mobile layout.
- Static deployment; no build step required.

## Deploy to a new GitHub repository

1. Create a new repository on GitHub, for example `wardogs-community-hub`. Do **not** reuse the original repository if you want this to stay separate.
2. Upload the contents of this folder to the repository root. `index.html` must be at the root.
3. Open **Settings → Pages**, select **Deploy from a branch**, choose `main` and `/ (root)`, and save.
4. Wait for GitHub Pages to publish the site, then copy its exact URL.
5. In Supabase, open **Authentication → URL Configuration**. Set **Site URL** to the published site URL and add that URL to **Redirect URLs**. For a GitHub Pages project site, add the project URL and its auth callback path as needed; use the exact published origin/path rather than a guessed URL.

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
- The directory currently shows public tracker leaderboard records, not a verified-only Supabase community directory. It does not claim that a public tracker account is verified.
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
