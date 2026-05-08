# Web Push Notifications — Setup Guide

## 1. VAPID Keys

Generate keys (already done if `.vapid-private` exists):

```bash
cd /Users/raphaelberlin/Sidequest
npx web-push generate-vapid-keys --non-interactive
```

This prints a **Public Key** and a **Private Key**.

## 2. Frontend env var

Add to `/Users/raphaelberlin/Sidequest/.env`:

```
VITE_VAPID_PUBLIC_KEY=<your_public_key>
```

## 3. Supabase Edge Function secrets

In the Supabase dashboard → Project Settings → Edge Functions → Secrets,
add the following three secrets:

| Secret name      | Value                                     |
|------------------|-------------------------------------------|
| VAPID_PUBLIC_KEY | `<your_public_key>`                       |
| VAPID_PRIVATE_KEY| `<your_private_key>`                      |
| VAPID_SUBJECT    | `mailto:berlinraphael@gmail.com`          |

Or via CLI:

```bash
supabase secrets set VAPID_PUBLIC_KEY=<public_key>
supabase secrets set VAPID_PRIVATE_KEY=<private_key>
supabase secrets set VAPID_SUBJECT=mailto:berlinraphael@gmail.com
```

## 4. Run the SQL migration

In the Supabase dashboard → SQL Editor, run the contents of:
`supabase/push-subscriptions.sql`

Or via CLI:
```bash
supabase db push
```

## 5. Deploy the Edge Function

```bash
supabase functions deploy send-push
```

## 6. Rebuild the frontend

```bash
npm run build
```

## How it works

1. When a logged-in user visits the app, `usePushSubscription` silently subscribes them using the VAPID public key.
2. If notification permission is `'default'` (not yet decided), a subtle "🔔 Enable quest alerts" button appears below the location pill on the Home screen. Clicking it requests permission, then subscribes.
3. Subscriptions are stored in `push_subscriptions` in Supabase with RLS — users can only see their own.
4. When `drop-quest` is called, it fires a non-blocking call to `send-push`, which sends a Web Push notification to every subscriber via the `web-push` npm package.
5. The service worker's `push-handler.js` (imported via workbox `importScripts`) handles the `push` event and calls `showNotification`. Tapping the notification opens `/quest-drop`.
