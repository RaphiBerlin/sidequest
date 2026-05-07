# CONTEXT.md — Side/Quest Project

> Paste this file at the top of every new Claude session for instant context.
> Update the build status checklist as you complete tasks.

---

## What is Side/Quest?

Side/Quest is a proximity-based social app with a daily time-limited challenge. At a random moment, everyone gets the same quest. The app finds nearby friends (and friends-of-friends) to complete it with. A photo proves completion. A memory card gets saved. Streaks build habit. It's built for a 50–100 person beta test.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React + Vite (JavaScript) |
| Styling | Tailwind CSS |
| PWA | vite-plugin-pwa (installable, service worker) |
| Backend | Supabase (Postgres + Auth + Realtime + Storage) |
| Auth | Supabase magic link (no passwords) |
| Hosting | Vercel (auto-deploy from GitHub) |
| Router | React Router v6 |
| Edge Functions | Supabase Deno runtime |

---

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `dark` | `#1a1612` | Background, primary dark |
| `paper` | `#f4ede0` | Cream text, light backgrounds |
| `rust` | `#c44829` | Primary accent, CTAs, logo |
| `gold` | `#d4a02a` | Secondary accent, streaks, FoF |

**Fonts (Google Fonts):**
- `Fraunces` — italic serif, used for all display/title text
- `JetBrains Mono` — labels, stats, uppercase tracking
- `Bricolage Grotesque` — body text, cards

**Tailwind classes:** `bg-dark`, `text-paper`, `text-rust`, `text-gold`, `border-rust`, `bg-rust`

---

## File Structure

```
src/
  main.jsx              — BrowserRouter, all Routes, global providers
  index.css             — Tailwind directives + @keyframes

  screens/
    Login.jsx           — Magic link login form (rust logo, dark bg)
    AuthCallback.jsx    — Handles /auth/callback, checks users table, routes to /onboarding or /home
    Onboarding.jsx      — Name input, inserts users row, handles invite code
    Home.jsx            — Full home screen: quest status, streak, journal strip, location pill
    QuestDrop.jsx       — Quest reveal card (tilted, countdown, SEE WHO'S NEARBY CTA)
    Nearby.jsx          — Map canvas + party selection list
    ActiveQuest.jsx     — Timer, camera, shutter, party status
    Memory.jsx          — Memory card, photo, reactions, save card
    Journal.jsx         — Full quest journal, stats, expandable entries
    Friends.jsx         — Friends list, pending requests, invite button
    Settings.jsx        — Profile edit, preferences, streak, sign out
    Admin.jsx           — Quest drop controls, user table (admin-only)
    JoinViaInvite.jsx   — /join/:code invite landing page

  hooks/
    useAuth.js          — { user, session, loading, signOut }
    useQuestDrop.js     — { activeQuest, loading } — Realtime INSERT listener
    useLocation.js      — { location, locationError, locationLoading, requestLocation }
    usePartyInvites.js  — Global Realtime listener for party invite toasts
    usePartySync.js     — Real-time party status during active quest
    useReactions.js     — { reactions, myReactions, toggleReaction } for a sessionId
    useOnline.js        — { isOnline } — network status

  lib/
    supabase.js         — createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
    location.js         — writePresence(userId), deletePresence(userId)
    proximity.js        — getNearbyUsers(userId, lat, lng) → calls get_nearby_users RPC
    photos.js           — uploadPhoto(blob, userId, sessionId, type), completeSession(...)
    streak.js           — updateStreak(userId), checkAndResetStreak(userId), useFreeze(userId)
    invites.js          — getInviteLink(userId), resolveInvite(code)
    analytics.js        — track(event, properties)
    cache.js            — set(key, data, ttlMs), get(key), clear(key)
    locationContext.js  — getLocationContext(lat, lng) → { contexts, label }

  components/
    ProtectedRoute.jsx  — Redirects to / if no session; shows spinner while loading
    TabBar.jsx          — Fixed bottom nav: HOME / JOURNAL / FRIENDS
    InstallBanner.jsx   — beforeinstallprompt (Android) + iOS share instructions
    TimeoutModal.jsx    — Quest expired / streak reset modal with freeze offer
    Skeleton.jsx        — Animated shimmer placeholder (width, height, borderRadius props)
    ErrorCard.jsx       — Error state with retry button
    ErrorBoundary.jsx   — React error boundary wrapping the whole app
    Toast.jsx           — Animated pill toast component

  context/
    AppState.jsx        — Global: currentQuestSession, streak, freezeAvailable
    ToastContext.jsx    — Global: showToast(message, type, duration)

supabase/
  functions/
    drop-quest/
      index.ts          — Edge Function: picks random quest, writes to active_quest
  config.toml           — Cron: 47 13 * * * (13:47 UTC daily)
  rls-policies.sql      — All RLS policies (run after schema migration)
  realtime-setup.sql    — ALTER TABLE active_quest REPLICA IDENTITY FULL
  proximity-function.sql — get_nearby_users() Haversine SQL function
  streak-columns.sql    — ALTER TABLE users ADD streak, last_quest_date, last_freeze_used_at
  pip-photo-url.sql     — ALTER TABLE quest_sessions ADD pip_photo_url
  party-invites-table.sql — CREATE TABLE party_invites
  analytics-table.sql   — CREATE TABLE analytics_events
  indexes.sql           — Performance indexes
```

---

## Supabase Schema

```sql
users         — id (uuid PK = auth uid), email, name, avatar_color, streak, last_quest_date, last_freeze_used_at, invite_code, created_at
friendships   — id, user_id→users, friend_id→users, status (pending/accepted), tier (friend/fof), created_at
quests        — id, title, description, duration_min, xp, context_tags[], created_at
active_quest  — id, quest_id→quests, dropped_at, expires_at
quest_sessions — id, quest_id, user_id, party_ids[], started_at, completed_at, photo_url, pip_photo_url, elapsed_sec, xp_earned, party_status (jsonb)
reactions     — id, session_id→quest_sessions, user_id→users, emoji, created_at
presence      — user_id (PK)→users, lat, lng, updated_at
party_invites — id, from_user_id, to_user_id, session_id, status, created_at, expires_at
analytics_events — id, user_id, event, properties (jsonb), created_at
```

**Storage bucket:** `quest-photos` (public, 5MB limit, jpeg/png/webp)

---

## Environment Variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ADMIN_EMAIL=
VITE_APP_VERSION=1.0.0
```

---

## Build Status

### Phase 1 — Setup
- [x] Task 01 · Create Supabase project & schema (Friend)
- [x] Task 02 · Scaffold React + Vite + Supabase + Tailwind
- [x] Task 03 · Deploy to Vercel (Friend)
- [x] Task 04 · Magic link auth
- [x] Task 05 · Session persistence + protected routes
- [x] Task 06 · Onboarding — name + profile creation
- [x] Task 07 · PWA manifest + install prompt

### Phase 2 — Backend
- [x] Task 08 · Quest pool seed SQL (25 quests)
- [x] Task 09 · drop-quest Edge Function + cron
- [x] Task 10 · Supabase Realtime quest drop listener
- [x] Task 11 · Row Level Security policies
- [ ] Task 12 · Photo storage bucket (Friend — manual)
- [x] Task 13 · Presence table — write + delete location
- [x] Task 14 · Proximity query — get_nearby_users SQL function

### Phase 3 — Core Loop
- [x] Task 15 · Home screen — full UI
- [x] Task 16 · Quest drop screen
- [x] Task 17 · Nearby map screen
- [ ] Task 18 · Active quest screen — layout + timer
- [ ] Task 19 · Camera — single capture with flash
- [ ] Task 20 · Dual camera (BeReal PiP)
- [x] Task 21 · Photo upload (src/lib/photos.js)
- [x] Task 22 · Memory card screen
- [x] Task 23 · Quest journal screen
- [x] Task 24 · Streak system
- [ ] Task 25 · Timeout modal + AppState context
- [ ] Task 26 · Tab bar navigation
- [x] Task 27 · CONTEXT.md ← this file

### Phase 4 — Social
- [ ] Task 28–36 (pending)

### Phase 5 — Polish
- [ ] Task 37–43 (pending)

### Phase 6 — Launch
- [ ] Task 45–50 (pending)

---

## Known Issues

_Fill this in as you find them:_

---

## What to Tell Claude Each Session

> Always paste this file first, then describe the specific task.
> Example: "See CONTEXT.md above. Now build Task 28 — the Friends list screen."
