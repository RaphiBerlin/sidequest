# CONTEXT.md — Side/Quest Project

> Paste this file at the top of every new Claude session for instant context.

---

## What is Side/Quest?

Side/Quest is a proximity-based social app with a daily time-limited challenge. At a random moment, everyone gets the same quest. The app finds nearby friends (and friends-of-friends) to complete it with. A photo proves completion. A memory card gets saved. Streaks build habit. Built for a 50–100 person beta test, live at **sidequest.shmul.dev**.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React + Vite (JavaScript) |
| Styling | Tailwind CSS |
| PWA | vite-plugin-pwa (installable, service worker) |
| Backend | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions) |
| Auth | Supabase magic link (no passwords) |
| Hosting | Vercel (auto-deploy from GitHub) |
| Router | React Router v6 |
| Edge Functions | Supabase Deno runtime |
| Maps | Mapbox GL JS |

---

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `dark` | `#1a1612` | Background, primary dark |
| `paper` | `#f4ede0` | Cream text, light backgrounds |
| `rust` | `#c44829` | Primary accent, CTAs, logo |
| `gold` | `#d4a02a` | Secondary accent, streaks, XP |

**Fonts (Google Fonts):**
- `Fraunces` — italic serif, all display/title text
- `JetBrains Mono` — labels, stats, uppercase tracking
- `Bricolage Grotesque` — body text, cards

**Tailwind classes:** `bg-dark`, `text-paper`, `text-rust`, `text-gold`, `border-rust`, `bg-rust`

---

## File Structure

```
src/
  main.jsx                  — BrowserRouter, all Routes, global providers

  screens/
    Login.jsx               — Magic link login (rust logo, dark bg)
    AuthCallback.jsx        — /auth/callback → checks users table → /onboarding or /home
    Onboarding.jsx          — Name input, inserts users row, handles invite code
    Home.jsx                — Greeting, active quest hero, friends bar, memories strip
    QuestDrop.jsx           — Quest reveal card (countdown, SEE WHO'S NEARBY CTA)
    Nearby.jsx              — Mapbox map + party selection
    ActiveQuest.jsx         — Timer, dual camera (BeReal PiP), complete button
    Memory.jsx              — Memory card, photo, XP, reactions, save/share card
    Journal.jsx             — Full quest history, stats, expandable entries
    Feed.jsx                — Friends' completed quest cards with reactions + comments
    Friends.jsx             — Friends list, pending requests, search, invite link
    Settings.jsx            — Profile edit, streak, freeze, sign out, delete account
    JoinViaInvite.jsx       — /join/:code invite landing page

    admin/
      AdminLayout.jsx       — Shared admin shell: auth gate, header, tab nav (Home/Quests/Users/Logs)
      AdminHome.jsx         — Drop controls + scheduled drops + users overview  (/admin)
      AdminQuests.jsx       — Scheduled drops + full quest library CRUD          (/admin/quests)
      AdminUsers.jsx        — Users table (seed, admin toggle) + recent sessions  (/admin/users)
      AdminLogs.jsx         — Unified log: sessions, drops, signups, push         (/admin/logs)
      ScheduledDrops.jsx    — Shared scheduled-drop panel (used in Home + Quests)

  components/
    ProtectedRoute.jsx      — Redirects to / if no session
    TabBar.jsx              — Fixed bottom nav: HOME / FEED / JOURNAL / FRIENDS
    FeedCard.jsx            — Social feed card: gradient cover, reactions, comments (realtime)
    InstallBanner.jsx       — beforeinstallprompt (Android) + iOS instructions
    TimeoutModal.jsx        — Quest expired / streak reset modal with freeze offer
    Skeleton.jsx            — Animated shimmer placeholder
    ErrorCard.jsx           — Error state with retry
    ErrorBoundary.jsx       — React error boundary
    Toast.jsx               — Animated pill toast

  hooks/
    useAuth.js              — { user, session, loading, signOut }
    useQuestDrop.js         — { activeQuest, loading, newDrop, clearNewDrop } — Realtime listener
    useLocation.js          — { location, locationError, locationLoading, requestLocation }
    usePartyInvites.js      — Global Realtime listener for party invite toasts
    usePartySync.js         — Real-time party status during active quest
    useReactions.js         — { myReactions, toggleReaction, grouped } for a sessionId (realtime)
    usePushSubscription.js  — Registers VAPID push subscription on mount
    useOnline.js            — { isOnline }

  lib/
    supabase.js             — createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
    photos.js               — uploadPhoto(), completeSession() → uploads to quest-photos bucket
    location.js             — writePresence(userId), deletePresence(userId)
    proximity.js            — getNearbyUsers(userId, lat, lng) → get_nearby_users RPC
    streak.js               — updateStreak(), checkAndResetStreak(), useFreeze()
    invites.js              — getInviteLink(userId), resolveInvite(code)
    analytics.js            — track(event, properties) → analytics_events table
    cache.js                — cacheGet(key), cacheSet(key, data, ttlMs)
    locationContext.js      — getLocationContext(lat, lng) → { label }
    contacts.js             — Contact matching helpers

  context/
    AppState.jsx            — Global: currentQuestSession, streak, freezeAvailable
    ToastContext.jsx        — Global: showToast(message, type, duration)

public/
  favicon.svg               — Italic "s" copper gradient on dark rounded square
  manifest.json             — PWA manifest
  push-handler.js           — Service worker push event handler
  icons/
    icon-192.png / icon-512.png / icon-1024.png
    logo.svg                — Full 3D copper S logo (used in splash / marketing)
    icon.svg                — Simple S/Q text icon

supabase/
  functions/
    drop-quest/index.ts     — Picks/drops quest, writes active_quest, fires send-push
    send-push/index.ts      — Sends VAPID push to all subscriptions, logs to push_logs
    admin-seed/index.ts     — Seeds test sessions for a user

  SQL migrations (run in order via SQL Editor):
    00_full_migration.sql          — Full base schema
    rls-policies.sql               — All RLS policies
    realtime-setup.sql             — REPLICA IDENTITY FULL for realtime tables
    proximity-function.sql         — get_nearby_users() Haversine RPC
    streak-columns.sql             — streak, last_quest_date, last_freeze_used_at on users
    pip-photo-url.sql              — pip_photo_url column on quest_sessions
    party-invites-table.sql        — party_invites table
    party-status-column.sql        — party_status jsonb on quest_sessions
    analytics-table.sql            — analytics_events table
    comments-table.sql             — comments table
    reactions-rls.sql              — RLS for reactions
    quest-sessions-friends-rls.sql — SELECT policy: see accepted friends' sessions
    push-subscriptions.sql         — push_subscriptions table + RLS
    push-logs.sql                  — push_logs table (run this!)
    quest-schedule.sql             — quest_schedule table
    storage-photos.sql             — quest-photos storage bucket + RLS
    admin-column.sql               — is_admin column on users
    invite-code-column.sql         — invite_code on users
    contact-graph.sql              — contact graph helpers
    indexes.sql                    — Performance indexes
    auto-friends.sql               — Auto-friend on invite resolution
    new-rpcs.sql                   — Additional RPCs
    increment-streak.sql           — increment_streak RPC
```

---

## Supabase Schema

```sql
users            — id (uuid = auth uid), email, name, streak, last_quest_date,
                   last_freeze_used_at, invite_code, is_admin, created_at

friendships      — id, user_id→users, friend_id→users, status (pending/accepted), created_at

quests           — id, title, description, duration_min, xp, context_tags[], created_at

active_quest     — id, quest_id→quests, dropped_at, expires_at

quest_sessions   — id, quest_id, user_id, party_ids[], started_at, completed_at,
                   photo_url, pip_photo_url, elapsed_sec, xp_earned, party_status (jsonb)

quest_schedule   — id, quest_id→quests (null=random), scheduled_at, label,
                   executed, executed_at, created_at

reactions        — id, session_id→quest_sessions, user_id→users, emoji, created_at

comments         — id, session_id→quest_sessions, user_id→users, body, created_at

presence         — user_id (PK)→users, lat, lng, updated_at

party_invites    — id, from_user_id, to_user_id, session_id, status, created_at, expires_at

push_subscriptions — id, user_id→users, endpoint, p256dh, auth, created_at

push_logs        — id, title, body, total, sent, failed, triggered_by, created_at

analytics_events — id, user_id→users, event, properties (jsonb), created_at
```

**Storage bucket:** `quest-photos` (public, 10MB limit, jpeg/png/webp)
Path pattern: `{userId}/{sessionId}-main.jpg` and `{userId}/{sessionId}-pip.jpg`

---

## Routes

| Path | Screen | Notes |
|------|--------|-------|
| `/` | Login | Public |
| `/auth/callback` | AuthCallback | Supabase magic link redirect |
| `/join/:code` | JoinViaInvite | Public invite link |
| `/onboarding` | Onboarding | Protected; redirects to /home if profile exists |
| `/home` | Home | Protected |
| `/quest-drop` | QuestDrop | Protected |
| `/nearby` | Nearby | Protected |
| `/active-quest` | ActiveQuest | Protected |
| `/memory` | Memory | Protected; receives state: { mainPhoto, pipPhoto, sessionId, quest, party, elapsedSec } |
| `/journal` | Journal | Protected |
| `/feed` | Feed | Protected |
| `/friends` | Friends | Protected |
| `/settings` | Settings | Protected |
| `/admin` | AdminHome | Admin-only |
| `/admin/quests` | AdminQuests | Admin-only |
| `/admin/users` | AdminUsers | Admin-only |
| `/admin/logs` | AdminLogs | Admin-only |

---

## Edge Functions

### `drop-quest`
- `{}` or `{ quest_id }` — drop a quest now
- `{ action: "schedule", quest_id?, scheduled_at, label? }` — schedule a future drop
- `{ action: "cancel", id }` — cancel a scheduled drop
- `{ action: "cron" }` — execute overdue scheduled drops (called by Supabase cron)

### `send-push`
- `{ title, body, url?, triggered_by? }` — send VAPID push to all subscriptions, logs to push_logs

### `admin-seed`
- Seeds 3 completed test sessions for a given user

---

## Environment Variables

```
VITE_SUPABASE_URL=https://egphwkiejepvvqrysgix.supabase.co
VITE_SUPABASE_ANON_KEY=
VITE_ADMIN_EMAIL=berlinraphael@gmail.com
VITE_MAPBOX_TOKEN=
VITE_VAPID_PUBLIC_KEY=
VITE_APP_VERSION=1.0.0
```

**Supabase Edge Function secrets (set in Dashboard → Settings → Edge Functions):**
```
SUPABASE_SERVICE_ROLE_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:berlinraphael@gmail.com
```

---

## Deployment

- **Frontend:** Vercel, auto-deploys on push to main
- **Edge Functions:** `npx supabase functions deploy <name> --project-ref egphwkiejepvvqrysgix --no-verify-jwt`
- **Live URL:** https://sidequest.shmul.dev

**Deploy all functions:**
```bash
npx supabase functions deploy drop-quest --project-ref egphwkiejepvvqrysgix --no-verify-jwt
npx supabase functions deploy send-push  --project-ref egphwkiejepvvqrysgix --no-verify-jwt
npx supabase functions deploy admin-seed --project-ref egphwkiejepvvqrysgix --no-verify-jwt
```

---

## What's Built (Complete)

- ✅ Auth — magic link, session persistence, protected routes, sign out
- ✅ Onboarding — name entry, invite code resolution, auto-friend
- ✅ Home — greeting (time of day), active quest hero + countdown, friends floating bar, memories strip
- ✅ Quest drop — reveal card, countdown timer, start quest flow
- ✅ Nearby — Mapbox map, friend pins, party selection
- ✅ Active quest — timer, dual camera (BeReal PiP), complete flow
- ✅ Memory — photo upload to Supabase Storage, memory card, XP, reactions, save/share
- ✅ Journal — session history, stats, expandable cards, load more
- ✅ Feed — friend activity cards, gradient covers for no-photo sessions, reactions (realtime), comments (realtime)
- ✅ Friends — search, add, accept/decline, invite link, live pending request updates
- ✅ Settings — edit name, streak display, freeze, copy invite, how-to-install, delete account
- ✅ Streak system — increment on completion, freeze, reset logic
- ✅ Push notifications — VAPID subscription, send-push edge function, in-app banner
- ✅ Realtime — quest drops, reactions, comments, friend requests, party invites
- ✅ Admin — 4-page panel (Home, Quests, Users, Logs) with tab nav
- ✅ PWA — manifest, service worker, installable, offline cache
- ✅ Favicon — italic "s" copper gradient svg

## Pending / Known Issues

- `push_logs.sql` needs to be run in Supabase SQL Editor
- `send-push` and `drop-quest` edge functions need to be (re)deployed after recent changes
- Playwright tests written but not fully configured with tokens yet
