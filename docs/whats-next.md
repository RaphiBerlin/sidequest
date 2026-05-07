# Side/Quest — Post-Test Decision Framework

## How to Use This

After the first quest drop and feedback form results are in, use this document to decide what to build next. Follow the signal, not your gut. The framework is structured as a decision tree: find the metric that describes your situation, then follow the branch.

---

## COMPLETION RATE

### HIGH COMPLETION RATE (>60% of sessions have `completed_at`)

The core loop is working. People are going outside and finishing the quest. This is the most important signal you can get this early.

**What to build next:**
- More quests. The quest pool is the product at this stage — variety and quality of quest design is what keeps people coming back
- Streak system polish (if not already tuned) — high completion means people are motivated, so the streak freeze and reset mechanics are worth investing in
- Memory card sharing — give completers a way to show off. This is your organic growth lever
- Start thinking about Day 7 retention, not just Day 2

**Do not:** Over-invest in the social/nearby layer yet. Prove solo retention first.

---

### LOW COMPLETION RATE (<30% of sessions have `completed_at`)

People are opening the quest but not finishing. The top of the funnel is fine; something is breaking in the middle.

**What to diagnose first:**
1. Check median elapsed time on completed sessions — if it's under 5 minutes, people are bailing fast (confusion, not difficulty)
2. Check if camera permissions are failing — if users hit a wall trying to enable the camera, they drop off silently
3. Check if the quest itself was too hard, too weird, or geographically impossible for some users

**What to fix:**
- If confusion: rewrite the quest description to be a single clear instruction. Remove all ambiguity.
- If camera: add a clearer camera permission gate and a "skip photo" fallback that still lets you "complete" the quest
- If quest design: pick easier, more universally achievable quests for the next 3 drops before iterating on harder content

**Do not:** Add more features. Fix the leaky bucket first.

---

## SOCIAL BEHAVIOR

### HIGH SOLO RATE (>70% of sessions have empty `party_ids`)

Most people did the quest alone. This isn't necessarily a failure — it means the solo experience has to be strong enough to sustain the product — but it does mean the social layer is either invisible or not providing enough pull.

**What it means:**
- People might not know the co-op mode exists (onboarding/discovery problem)
- Friends weren't nearby at the same time (coordination problem — 45 minutes is a short window)
- The incentive to go with someone isn't strong enough (reward problem)

**What to do:**
- Add explicit UI on the quest drop screen: "X friends are nearby right now — tap to see them"
- Consider a pre-quest opt-in: "Want to be notified when a friend starts this quest?"
- Test a longer quest window (90 minutes) and see if party rate goes up
- Don't add a "join a stranger" feature yet — the cold start problem is already real within friend networks

---

### HIGH PARTY RATE (>50% of sessions include at least one party member)

People are finding each other and doing quests together. The social mechanic is working. This is a rare and valuable signal — most apps never get here.

**What to build next:**
- Party-specific memory cards: a combined card showing both participants' photos side by side
- Post-quest reactions between party members: a quick emoji exchange after the session
- "Quest with [Name] again" shortcut on the memory card — reduce friction for repeat co-op
- Friends list / connection graph: if people are repeatedly questing together, let them mark each other as "crew"
- Push notifications for when a friend is actively on a quest nearby

**The big question to answer:** Are the same pairs questing together repeatedly, or is it random? If repeated pairs, you have the seed of a strong social graph. If random, the "nearby" mechanic is doing the work but isn't building lasting relationships.

---

## RETENTION

### LOW DAY 2 RETENTION (<30% of Day 1 users return)

The first experience wasn't compelling enough to pull people back. This is a serious signal — Day 2 retention is the leading indicator of whether you have a product or a demo.

**What to diagnose:**
- Was Day 1 completion rate also low? If so, the whole session failed — fix completion first
- Was Day 1 completion rate high but Day 2 still low? The quest was fine but there's no pull to return — the loop isn't closed
- Did you send a Day 2 notification or reminder? If not, the absence of a nudge might be the entire explanation

**What to fix:**
- Streak notification: a single push notification at quest drop time ("Your quest just dropped — 45 minutes") is likely the highest-leverage fix
- The memory card needs to feel more worth revisiting: add a way to see friends' memory cards from the same quest
- Make the next quest's theme visible before it drops: "Tomorrow: something about color" creates anticipation
- Send the 48-hour follow-up message from `invite-messages.md` to everyone who didn't return — ask them directly what happened

---

### HIGH DAY 2 RETENTION (>50% of Day 1 users return)

You have a real product. People are coming back on their own. This is when you scale — not before.

**When you know you're ready to scale:**
- Day 2 retention >50% across at least 2 consecutive quest drops
- At least one person has done 5+ quests without being prompted
- Qualitative feedback includes at least one "I looked forward to this"

**What to build before scaling:**
- Referral/invite flow: the current testers become your acquisition channel
- Custom invite link (Task 32): each user gets a link that pre-fills their name in the new user's connection graph
- Fix every bug that appeared in the test — you only get one first impression with the next wave
- Make sure the admin panel can handle dropping quests at scale without manual SQL fallbacks

**What not to do:** Don't add new features to impress the next cohort. The people who love it already will bring more people. Focus on making the thing they love work perfectly.

---

## QUALITATIVE SIGNALS FROM FEEDBACK

### "I forgot it existed"

**Problem:** Notification problem.

The app is not in anyone's mental stack. You are competing with every other app on their phone for attention, and losing.

**Fix:**
- Implement push notifications (web push via service worker — the PWA already has a service worker)
- Send the quest drop notification at a consistent time every day so people build an expectation
- Consider a daily "quest preview" notification the evening before: "Tomorrow's quest: [theme]"

---

### "I wanted to but no one was nearby"

**Problem:** Proximity / friend graph problem.

The social layer requires friends to be in the same area at the same moment. That's a hard coordination problem, especially in the early days when your network is small.

**Fix:**
- Add a "going solo" first-class mode with its own UI so people who can't find a friend still feel like they're making the right choice, not a fallback choice
- Explore a "quest window" that's longer (90–120 minutes) so the coordination window is bigger
- Add friend pre-commitment: "I'm planning to quest at 5pm — who's in?" as a lightweight scheduling feature
- Long term: the friends-of-friends graph (Task 33) expands the pool of potential nearby questers beyond close friends

---

### "The quest felt lame"

**Problem:** Quest design problem.

The mechanic is fine but the content isn't compelling enough to make people move. This is a content problem, not an engineering problem.

**Fix:**
- Audit the quest pool with fresh eyes — apply the first-quest criteria to every quest: achievable solo, universally doable, visually interesting, worth a photo
- Add quest difficulty tiers and test harder quests once Day 2 retention is established
- Collect quest ratings directly in the memory card screen: a single 👍/👎 on each quest
- Consider community-submitted quests long term — but not yet

---

### "I didn't understand what to do"

**Problem:** Onboarding problem.

The quest mechanic isn't self-explanatory. People are landing on the quest drop screen without enough context to know what they're supposed to do.

**Fix:**
- Add a one-time walkthrough tooltip sequence on first quest drop (not before — show it in context)
- Rewrite the quest drop screen CTA: instead of "Start Quest", add a single line explaining the mechanic in plain English
- Add a "how it works" section to the onboarding flow (after magic link, before home screen): three screens, one sentence each

---

### "I loved it but my friends didn't"

**Problem:** Cold start problem.

You have a motivated early adopter inside an unmotivated network. This is the hardest problem in social apps. The product works for them but not for the people they need it to work with.

**Fix:**
- Talk to this person directly. They are your best user and your best distribution channel.
- Give them a personalized invite link that shows their name to the person they're inviting: "Join [Name]'s quest crew"
- Don't try to fix the cold start problem with features — fix it with personal outreach. The motivated user needs to bring one specific friend in, not broadcast to everyone.
- If multiple testers report this, it means the product isn't compelling enough for someone who wasn't personally recruited. That's an onboarding and first-impression problem to solve before scaling.

---

## THE ONE METRIC THAT MATTERS IN MONTH 1

**Day 2 Retention.**

Not install count. Not completion rate. Not social party rate. Not feedback form scores.

Day 2 retention tells you whether the experience was good enough that someone chose to return without being asked. Everything else is a diagnostic to help you understand why retention is where it is.

A product with 60% Day 2 retention and 30 users is more valuable than a product with 20% Day 2 retention and 300 users. The first has something real. The second has a leaky bucket that more users will not fix.

**You are ready to scale when:**
- Day 2 retention is above 50% across two consecutive drops
- You understand *why* it's above 50% (not just that it is)
- The experience for the next 50 users is at least as good as it was for the first 50

Until then: talk to your testers, fix what's broken, and drop another quest.
