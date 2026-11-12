# SignedOn Social

The social network that remembers when the internet was fun: customizable profiles, profile songs, Top Friends,
guestbooks, an MSN-style messenger with nudges, blogs, bulletins, communities — and a chronological friends feed.

Next.js 15 (App Router, TypeScript, Tailwind v4) + Supabase (Postgres, Auth, Storage, Realtime). Adults 18+ only.

---

## Run it on your computer

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + keys (see below)
npm run dev                  # http://localhost:3000
```

## Set up Supabase (one time)

1. **Create a project** at supabase.com (or use the one Claude created for you).
2. **Run the migrations, in order**, in the SQL editor (or `npx supabase db push` with the CLI linked to the project):
   ```
   supabase/migrations/20261109000100_core.sql
   supabase/migrations/20261109000200_nostalgia.sql
   supabase/migrations/20261109000300_messenger.sql
   supabase/migrations/20261109000350_storage.sql
   supabase/migrations/20261109000400_community.sql
   supabase/migrations/20261109000500_moderation.sql
   ```
3. **Auth settings** (Dashboard → Authentication):
   - URL Configuration → Site URL: `https://signedon.social` (or `http://localhost:3000` while testing)
   - Redirect URLs: add `https://signedon.social/auth/callback` and `http://localhost:3000/auth/callback`
   - Providers → Email: keep **Confirm email** ON.
   - Before launch, set up custom SMTP (Resend, Postmark, etc.). Supabase's built-in email is rate-limited and meant for testing.
4. **Keys** (Dashboard → Project Settings → API) go in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # anon / publishable key (safe for the browser)
   SUPABASE_SERVICE_ROLE_KEY=...            # SERVER ONLY. Only used for account deletion.
   NEXT_PUBLIC_SITE_URL=https://signedon.social
   ```
5. **Make yourself a moderator** (SQL editor, after you sign up):
   ```sql
   insert into public.moderators (user_id) select id from public.profiles where username = 'YOUR_USERNAME';
   ```
   Moderators get a "Moderation" link in the account menu (`/mod`).

## Deploy (Vercel, free tier)

1. Push this folder to a GitHub repo.
2. vercel.com → Add New Project → import the repo.
3. Add the four environment variables above (Production + Preview).
4. Deploy, then add the domain `signedon.social` in Vercel → Settings → Domains, and point Namecheap's DNS at it
   (Vercel shows the exact records: usually an A record `76.76.21.21` for `@` and a CNAME `cname.vercel-dns.com` for `www`).
5. Update Supabase Auth Site URL + redirect URLs to the real domain.

## What's in it

| Area | Highlights |
| --- | --- |
| Accounts | Email + password, email confirmation, password reset, 18+ check enforced in the database, reserved usernames |
| Profiles | Live theme editor (10 presets, colors, fonts, patterns, background image, corners, shadows), section reordering, banner + avatar uploads, mood, profile song (Spotify / YouTube / Apple Music / SoundCloud, click-to-play, never autoplays) |
| Top Friends | Top 4/8/12/16, drag (mouse, touch or keyboard) to rank, hide the order, notifications when you're added |
| Guestbook | Text, stickers, pictures, replies, likes; owner can hide/delete; friends-only / anyone / closed |
| Visitors | Once-a-day visit log, hit counter, reciprocal private browsing (browse privately = you can't see your own visitors) |
| Feed | Friends only, newest first, "you're all caught up"; Friends / Top Friends / Public posts; photos, likes, comments, reposts; separate opt-in Discover tab |
| Messenger | Buddy list with presence, status + now playing, away messages with auto-reply, typing, read receipts (both sides must allow), nudges (rate-limited, can be disabled), photos, voice notes, group chats, desktop alerts, mute |
| Community | Blogs (rich editor, drafts, private journal entries), bulletins, polls, communities (public/private, mods), theme gallery, gifts, badges, discovery by interest/region, Profile of the Week, friendship milestones, Memories |
| Safety | Block, report everything, moderation queue (remove / suspend), data export, account deletion |

## Security model

- Every table has Row Level Security. Nothing is readable or writable through the API unless a policy allows it.
- Tables start with **no** API privileges; each migration grants only the columns that may be written.
- Privileged logic lives in `security definer` functions with a fixed `search_path`; helpers sit in the private `app` schema the API doesn't expose.
- Blog HTML is generated server-side from structured JSON and sanitized again. Profile themes are validated tokens, never raw CSS.
- Photos are resized and re-encoded in the browser before upload, which strips location (EXIF) data.
- Messenger media is in a private bucket, read only through short-lived signed URLs.
- Content-Security-Policy and other security headers are set in `next.config.ts`.

## Tests

The `tests/` folder has database/security tests (`tests/phase*.test.mjs`) and browser tests (`tests/e2e/`), including an
accessibility scan and a "monkey" test that clicks and types junk across every page. They were run against a local
Supabase-compatible stack (Postgres + PostgREST + Supabase Auth). See `scripts/` for the local helpers.

## Not done yet / ideas

- GIF search in guestbooks and chat needs a GIF provider key (Giphy/Tenor) — easy to add.
- In-app song search needs Spotify's extended API access; paste-a-link works today.
- Custom CSS for power users (planned: sandboxed, allow-listed properties).
- Push notifications on phones (PWA) and a native app wrapper.
