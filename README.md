# Side / Quest

A BeReal-style daily outdoor challenge app. Every day, a quest drops — you and your friends have a limited window to complete it, take a photo, and post. Miss it and you lose your streak.

---

## Features

### Daily Quests
A new quest drops once a day for everyone. You get a countdown timer to complete it before time runs out. Quests are location-aware — they're tailored to your surroundings (park, beach, city, etc.).

### Dual Camera (BeReal-style)
When completing a quest, you capture both front and rear cameras simultaneously. The result is a picture-in-picture photo showing you and what you're looking at.

### Streaks & Freeze
Complete a quest every day to build a streak. If you miss a day, you can spend a streak freeze to protect it.

### Party Mode
Invite friends to complete a quest together as a party. See live status dots showing who's active, who's finished, and who's dropped out — in real time.

### Nearby
See anonymised dots of other users completing quests near you (within ~0.35 miles). Friends appear highlighted, friends-of-friends show via name. Everyone else is open.

### Friends
Add friends via invite link. The app also lets you find friends from your contacts — it matches hashed phone numbers so raw contact data never leaves your device.

### Journal / Memory
Every completed quest is saved to your journal with the photo, location, and timestamp. Tap any entry to view the full memory.

### Reactions
React to your friends' completed quest photos with emoji reactions, visible in real time.

### Offline Support
The app works offline — cached data is shown when there's no connection, with an offline banner. A service worker pre-caches assets for fast loads.

### PWA
Installable as a Progressive Web App on iOS and Android — add to home screen for a native app feel.

### Admin
A protected admin panel (email-gated) lets you manually trigger a quest drop, view active users, and monitor recent sessions.

---

## Tech Stack

- **Frontend:** React + Vite, Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage, Edge Functions)
- **Auth:** Email OTP via Resend
- **Fonts:** Fraunces (display), Bricolage Grotesque (body), JetBrains Mono (labels)
- **PWA:** vite-plugin-pwa with Workbox

---

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in your Supabase credentials
3. Run the migration: paste `supabase/00_full_migration.sql` into the Supabase SQL Editor
4. `npm install && npm run dev`
