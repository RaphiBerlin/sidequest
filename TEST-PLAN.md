# Sidequest — Test Plan

## How to use this
Work through each section top to bottom. Check off each item as you go.
Two accounts are useful for testing social features: **Raphael** (main) and **Alex Test**.

---

## 1. Authentication

| # | Step | Expected |
|---|------|----------|
| 1.1 | Visit the app URL while logged out | Redirected to login screen |
| 1.2 | Sign in with magic link / OAuth | Redirected to `/home` (or `/onboarding` if first time) |
| 1.3 | Refresh the page | Still logged in |
| 1.4 | Settings → Sign out | Redirected to login screen, can't access `/home` |

---

## 2. Onboarding (new account only)

| # | Step | Expected |
|---|------|----------|
| 2.1 | Sign in with a fresh email | Redirected to `/onboarding` |
| 2.2 | Enter a name and tap Continue | Moves to phone step |
| 2.3 | Enter a phone number and tap Continue | Moves to contacts step |
| 2.4 | Tap Skip on contacts | Redirected to `/home` |
| 2.5 | Visit `/onboarding` again while logged in with existing profile | Should redirect to `/home` (not show onboarding again) |

---

## 3. Home Screen

| # | Step | Expected |
|---|------|----------|
| 3.1 | Load home | Shows name initial avatar top-right, streak count, location pill |
| 3.2 | No active quest | Shows "No quest active right now" and next drop time (or "No drops scheduled") |
| 3.3 | Active quest exists | Shows quest title with "Resume →" button |
| 3.4 | Tap "Resume →" | Navigates to `/quest-drop` |
| 3.5 | Complete a quest | Memories strip updates with the session thumbnail |
| 3.6 | Friends have completed quests | Feed shows their cards with photo, name, quest title |
| 3.7 | No friends / friends have no quests | Feed shows "No activity yet" empty state |
| 3.8 | Tap "Enable quest alerts" | Browser notification permission prompt appears |
| 3.9 | Admin drops a quest | Push notification arrives; banner slides in from top |
| 3.10 | Tap the drop banner | Navigates to `/quest-drop` |

---

## 4. Quest Flow

### 4a. Quest Drop
| # | Step | Expected |
|---|------|----------|
| 4.1 | Navigate to `/quest-drop` with active quest | Shows quest title, description, tags |
| 4.2 | No active quest | Shows "No quest active" empty state |
| 4.3 | Tap "Start quest" | Navigates to `/nearby` |

### 4b. Nearby (Map)
| # | Step | Expected |
|---|------|----------|
| 4.4 | Map loads | Mapbox map renders, user location pin visible |
| 4.5 | Friends are also on a quest nearby | Their avatar pins appear on the map |
| 4.6 | Tap "Begin quest" | Navigates to `/active-quest`, timer starts |

### 4c. Active Quest
| # | Step | Expected |
|---|------|----------|
| 4.7 | Timer counts up from 0:00 | Timer ticking correctly |
| 4.8 | Tap camera | Camera opens, can take a photo |
| 4.9 | Party invite shown if friends joined | Party member avatars visible |
| 4.10 | Tap "Complete quest" | Navigates to `/memory` |

### 4d. Memory (Completion)
| # | Step | Expected |
|---|------|----------|
| 4.11 | Memory screen loads | Shows photo taken (or placeholder), quest title, elapsed time |
| 4.12 | Photo is saved | Photo visible on Home memories strip and in Journal |
| 4.13 | XP earned shown | 100 XP displayed |
| 4.14 | Tap "Done" or "Share" | Returns to Home |

---

## 5. Streak

| # | Step | Expected |
|---|------|----------|
| 5.1 | Complete first ever quest | Streak shows 1 on Home and Settings |
| 5.2 | Complete another quest same day | Streak stays at 1 (no double count) |
| 5.3 | Complete a quest the next day | Streak increments to 2 |
| 5.4 | Miss a day, then complete a quest | Streak resets to 1 |
| 5.5 | Settings → "FREEZE READY" badge visible after 7 days | Freeze button shows |
| 5.6 | Tap "❄️ Use freeze" | Toast "Streak frozen for 24h ❄️" appears, button disappears, freeze date updates |

---

## 6. Journal

| # | Step | Expected |
|---|------|----------|
| 6.1 | Open Journal tab | Shows total quests, streak, co-questers stats |
| 6.2 | Completed quests listed | Cards show photo, quest title, date, elapsed time |
| 6.3 | Tap a card to expand | Shows description, full photo, reactions |
| 6.4 | No quests yet | Shows empty state |
| 6.5 | More than 20 quests | "Load more" button appears and works |

---

## 7. Friends

| # | Step | Expected |
|---|------|----------|
| 7.1 | Open Friends tab | Shows accepted friends list with quest counts |
| 7.2 | Friend card shows quest count | e.g. "3 quests" instead of "FRIEND" |
| 7.3 | Type name in "Find someone by name…" and tap Find | Results appear below (excluding existing friends + self) |
| 7.4 | Tap "Add" on a search result | Toast "Friend request sent!", result removed from list |
| 7.5 | Pending request shown (on recipient's account) | Request appears under "Requests" section |
| 7.6 | Accept a friend request | Friend moves to accepted list |
| 7.7 | Decline a friend request | Request disappears |
| 7.8 | Tap "+" (invite button) | Invite link copied / native share sheet opens |
| 7.9 | New user opens invite link | Lands on `/join/:code`, after onboarding they're auto-friended |
| 7.10 | "Find friends from contacts" (mobile) | Contact scan runs, matching users appear |

---

## 8. Feed & Social

| # | Step | Expected |
|---|------|----------|
| 8.1 | Friend completes a quest | Card appears in your Home feed |
| 8.2 | You sent the friend request (you are user_id) | Friend's activity shows ✅ |
| 8.3 | Friend sent you the request (you are friend_id) | Friend's activity ALSO shows ✅ (bug was fixed) |
| 8.4 | Tap a reaction emoji on a feed card | Reaction count updates immediately (optimistic) |
| 8.5 | Tap same reaction again | Reaction toggled off |
| 8.6 | Tap 💬 on a feed card | Comments section expands |
| 8.7 | Type a comment and submit | Comment appears instantly (optimistic) |
| 8.8 | Reload the page | Comment persists from database |

---

## 9. Settings

| # | Step | Expected |
|---|------|----------|
| 9.1 | Open Settings | Shows name, email, streak, freeze status, version |
| 9.2 | Tap "Edit" next to name | Input field opens |
| 9.3 | Edit name and save | Name updates everywhere (Home avatar, Friends list) |
| 9.4 | Toggle location sharing off | Toggle goes grey; location not shared on next quest |
| 9.5 | Tap "Copy invite link" | Toast "Invite link copied!" |
| 9.6 | Tap "How to install" | Modal shows iOS and Android install instructions |
| 9.7 | Tap "Delete my account" | Confirm prompt appears |
| 9.8 | Confirm delete | Account removed from auth + users table; redirected to login |
| 9.9 | Try signing in with deleted email | Should be able to sign up fresh (auth record gone) |

---

## 10. Admin Panel

| # | Step | Expected |
|---|------|----------|
| 10.1 | Visit `/admin` as admin user | Admin panel loads |
| 10.2 | Visit `/admin` as non-admin | Blocked / redirected |
| 10.3 | Quests list shows all quests | Titles, descriptions visible |
| 10.4 | Edit a quest and save | Changes persist on refresh |
| 10.5 | "Drop Now" button | Quest drops immediately, active_quest updates |
| 10.6 | Schedule a future drop (set datetime, tap Schedule) | Appears in Scheduled Drops list |
| 10.7 | Cancel a scheduled drop | Removed from list |
| 10.8 | Wait for scheduled time (or set 1 min in future) | Quest auto-drops via cron |
| 10.9 | Users section shows all users | Names, emails, quest counts listed |
| 10.10 | Tap "+3" seed button next to a user | 3 completed sessions added; confirm in Journal |

---

## 11. Push Notifications

| # | Step | Expected |
|---|------|----------|
| 11.1 | Grant notification permission on Home | Permission accepted |
| 11.2 | Admin drops a quest | Push notification arrives on device within seconds |
| 11.3 | Tap notification | App opens to `/quest-drop` |
| 11.4 | App is in foreground when quest drops | In-app banner slides in from top |

---

## 12. PWA / Install

| # | Step | Expected |
|---|------|----------|
| 12.1 | Open on iPhone Safari | "Add to Home Screen" option available |
| 12.2 | Install to home screen | Launches full-screen without browser chrome |
| 12.3 | Open on Android Chrome | "Add to Home screen" prompt appears |
| 12.4 | Offline (no network) | App shows cached content rather than blank screen |

---

## Known limitations (not bugs)
- Streak freeze lasts 24h but the reset logic runs on next quest completion, not on a timer — so if you miss 2 days and haven't quested since using freeze, it resets on your next completion.
- Contact matching requires the Contacts API, which is only available on mobile browsers.
- Camera access requires HTTPS.
