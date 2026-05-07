# Side/Quest — Launch Day Runbook

## First Real Quest Drop with 50 Friends

This document is a step-by-step playbook for the day of the first real quest drop. Keep it open alongside the Supabase dashboard.

---

## THE DAY BEFORE THE DROP

### Confirm Installation Numbers

1. Open the Supabase dashboard → Table Editor → `users` table
2. Count rows with `created_at` within the last 7 days
3. **Target: 30+ installed users before you drop anything**
4. Cross-reference against the group chat — who said they installed but doesn't appear in the table? (They probably didn't finish onboarding)

**If fewer than 30 people have installed:**
- Don't drop yet. Delay by 24 hours.
- Send a direct message to everyone who said "I'll do it" but hasn't appeared in the users table. Keep it short: "Hey, you said you'd try Side/Quest — here's the link again: [INSTALL_LINK]. Takes 30 seconds. The first quest drops tomorrow."
- Post one more reminder in the group chat (use the Group Chat Version from `invite-messages.md`)
- Re-check the users table the next morning before proceeding

### Pick the Right First Quest

The first quest sets the tone. It should be:
- **Achievable solo** — don't make the first one require a partner. People need a win before they understand the social layer.
- **Universally doable** — no quest that requires a specific location (beach, park, transit). Assume people are in cities and suburbs.
- **Visually interesting** — the memory card photo should be worth keeping. "Find the best piece of handwriting you can see" beats "take a photo of a tree."
- **Low-stakes** — this is not the time for a weird or challenging quest. It's the time for something that makes people smile and say "oh, that's a fun idea."

Good first quests from the seed data: anything in the "observation" or "small wonder" category.

### Pre-Write the Launch Message

Draft the message you'll send to the group chat the moment the quest drops. Have it ready to paste — do not write it in the moment.

Template:
> Quest is live. You have 45 minutes. [brief one-line description of the quest without spoiling it]. Get outside. [INSTALL_LINK] if you haven't installed yet.

### Checklist for the Night Before

- [ ] 30+ users in the `users` table
- [ ] Quest selected and confirmed in the `quests` table (note its `id`)
- [ ] Launch message drafted and saved
- [ ] Feedback form link ready (from `feedback-form.md`)
- [ ] Supabase dashboard bookmarked: `active_quest` table, `quest_sessions` table, `analytics_events` table
- [ ] Phone charged

---

## LAUNCH MORNING

### Setup (30 minutes before drop)

1. Open Supabase dashboard in one browser tab — keep it open all morning
2. Open the admin panel (`/admin` route) in a second tab
3. Verify the `active_quest` table is empty (no current active quest)
4. Verify the quest you selected yesterday is in the `quests` table and has `is_active = false`

### Trigger the Drop

Use the admin panel to manually trigger the quest drop:
1. Navigate to `/admin`
2. Select the quest from the dropdown
3. Click "Drop Quest" — this inserts a row into `active_quest` with `expires_at` set to now + 45 minutes
4. Immediately check the `active_quest` table in Supabase to confirm the row was inserted

**The moment the row appears in `active_quest`:**
- The Realtime listener in every user's app will fire
- The quest drop screen will appear on their phones
- The 45-minute countdown begins

Post the launch message to the group chat **immediately** after confirming the row is in the table.

### What "Success" Looks Like in the First 10 Minutes

Watch the `quest_sessions` table. Within 10 minutes of the drop, you should see:
- At least 3–5 rows inserted (people who started the quest)
- `started_at` timestamps clustering around the drop time
- No error patterns (all rows should have valid `user_id` and `quest_id`)

If you see zero rows after 10 minutes: something is wrong. See "Fallback" below.

---

## DURING THE DROP WINDOW (45 minutes)

### Timing

- **T+0:** Quest drops, launch message sent to group chat
- **T+10:** Check quest_sessions — expect 5+ rows
- **T+20:** Post a second message in group chat: "Quest is still live for [X] more minutes — who's out there?" (optional, use judgment)
- **T+30:** Check quest_sessions again — completion rate starting to form
- **T+45:** Window closes, `active_quest` row expires

### Live Metrics to Watch

In Supabase, watch these tables:

| Table | What to look for |
|---|---|
| `active_quest` | Row present with future `expires_at` |
| `quest_sessions` | Growing row count, `completed_at` being set |
| `analytics_events` | `quest_drop_seen`, `quest_started`, `quest_completed` events appearing |
| `presence` | Users with active location = people currently on the quest |

**Healthy signal:** `quest_completed` events should be 40–70% of `quest_started` events within the window.

### Handling a Bug in Real Time

If users report something broken:
1. Ask them to describe exactly what screen they're on and what they saw
2. Check the Supabase logs (dashboard → Logs → API) for 4xx/5xx errors
3. If it's a data issue (e.g., quest details not loading), check the `quests` table row directly
4. If it's widespread: post in group chat "We're seeing an issue — working on it. Hang tight." Do NOT go silent.
5. Do not push a code fix during the live window unless it's a complete blocker — bugs that affect <20% of users can be fixed after the window

### Fallback: Quest Didn't Drop (Manual SQL)

If the admin panel fails or the Edge Function didn't fire, manually insert into `active_quest` via the Supabase SQL Editor:

```sql
INSERT INTO active_quest (quest_id, dropped_at, expires_at)
VALUES (
  '<YOUR_QUEST_ID>',
  now(),
  now() + interval '45 minutes'
);
```

Replace `<YOUR_QUEST_ID>` with the `id` from the `quests` table row you selected. This will trigger the Realtime listener for all connected clients within seconds.

---

## AFTER THE DROP

### Send the Feedback Form (T+2 hours)

Two hours after the drop window closes, send the feedback form message from `invite-messages.md` to everyone in the tester group. Do this even if turnout was low — you want data from people who didn't complete the quest as much as those who did.

### What the Data Should Look Like If It's Working

| Metric | Healthy range |
|---|---|
| quest_sessions rows | 30–50 (60–100% of installed users) |
| completion rate | >50% of sessions have `completed_at` set |
| median elapsed time | 10–30 minutes (too fast = quest too easy, too slow = confusion) |
| photo uploads | >80% of completed sessions have `photo_url` set |
| analytics: quest_drop_seen | Should roughly equal number of users |

### Red Flags — Numbers to Worry About

- **Fewer than 15 quest_sessions:** The notification/drop mechanic didn't reach people. Timing or notifications problem.
- **Completion rate below 30%:** People started but gave up. Quest difficulty, camera UX, or timer pressure.
- **Zero party_ids in any session:** The social layer is invisible. Nobody found or invited a nearby friend.
- **photo_url null on >40% of completed sessions:** Upload is failing silently. Check Supabase Storage logs.
- **analytics_events missing:** The analytics.js track() calls aren't firing or the table has an RLS issue.

---

## THE DAY AFTER

### Read the Day 2 Retention Metric

Day 2 retention = the percentage of users who open the app (or do a quest) on the day after the first drop.

Check `analytics_events` for `app_opened` events with `created_at` >= 24 hours after the drop:

```sql
SELECT COUNT(DISTINCT user_id)
FROM analytics_events
WHERE event = 'app_opened'
AND created_at >= '<drop_time>' + interval '20 hours'
AND created_at <= '<drop_time>' + interval '48 hours';
```

Divide by total users. **Above 40% is a strong signal. Below 20% is a problem worth investigating before the next drop.**

### Follow Up with People Who Didn't Open

Use the 48-hour follow-up message from `invite-messages.md`. Send individually — not as a group blast. Ask if the timing was the issue or if something broke.

### What to Iterate on First

Prioritize based on where the drop-off happened:

1. **Low awareness (quest_drop_seen << user count):** Fix notifications / messaging before the next drop
2. **High awareness, low starts:** The quest itself or the quest drop screen isn't compelling
3. **High starts, low completions:** Camera UX, timer pressure, or quest difficulty
4. **High completions, low Day 2:** The reward (memory card, streak) isn't pulling people back

Do not attempt to fix everything at once. Pick the biggest drop-off point and fix that before the next drop.
