# Side/Quest — Feedback Form Spec

## Purpose

Learn whether the core loop is working before building anything else. This form goes out approximately 2 hours after the first quest window closes, via the feedback form message in `invite-messages.md`.

---

## Form Intro Paragraph

*(Shown at the top of the Google Form, before any questions)*

> You just did (or didn't do) the first Side/Quest. Either way, your experience is useful data. This is a 5-question form — it takes about 2 minutes and will directly shape what gets built next. There are no wrong answers. Honest beats polite every time.

---

## Question 1 — Quest Drop Timing

**Question text:** When did you find out a quest had dropped today?

**Type:** Multiple choice (single select)

**Options:**
- Right away — I got a notification and opened it immediately
- Within 30 minutes — I saw it before much time had passed
- More than 30 minutes in — I almost missed the window
- After the window closed — I found out too late
- I didn't know there was a quest today

**Why it matters:** Measures whether the drop notification is landing — if most people find out late or not at all, the scarcity mechanic is broken before it even starts.

---

## Question 2 — Did They Actually Go Outside?

**Question text:** What did you actually do when the quest dropped?

**Type:** Multiple choice (single select)

**Options:**
- I went outside and completed it
- I started but didn't finish (ran out of time or gave up)
- I thought about it but didn't go
- I didn't see the quest in time
- I skipped it on purpose

**Why it matters:** This is the single most important signal — the drop notification and app experience have failed if people aren't converting to outside action.

---

## Question 3 — Nearby Friends Experience

**Question text:** How did the "find nearby friends" part feel?

**Type:** Multiple choice (single select)

**Options:**
- I quested with someone nearby — it was great
- I tried to find someone nearby but nobody showed up
- I went solo and didn't try to find anyone
- I didn't know you could quest with friends
- I tried but the nearby feature felt broken or weird

**Why it matters:** If people are going solo at high rates (or don't know co-op exists), the social layer isn't landing — which is the core differentiator from just taking a photo outside.

---

## Question 4 — Memory Card Reaction

**Question text:** After you took the photo, how did the memory card feel?

**Type:** Multiple choice (single select)

**Options:**
- It felt like a real memento — I actually liked it
- It was fine, nothing special
- I didn't really look at it
- I didn't get that far
- I found it confusing or clunky

**Why it matters:** The memory card is the reward artifact — if it doesn't feel worth it, there's no trophy at the end of the loop, which kills repeat motivation.

---

## Question 5 — Day 2 Retention Signal

**Question text:** How likely are you to do tomorrow's quest?

**Type:** Linear scale (1–5)

**Scale labels:**
- 1 — Definitely not, I'm done
- 3 — Maybe, depends on what it is
- 5 — Already looking forward to it

**Why it matters:** This is the most direct leading indicator of Day 2 retention — the single metric that matters most in month 1.

---

## Optional Question 6 — Open Qualitative

**Question text:** What was the most awkward or confusing moment? (optional)

**Type:** Short text (paragraph)

**Why it matters:** Often surfaces the thing you'd never think to ask about — the specific UX moment where people nearly dropped off.

---

## Thank-You Message

*(Shown after form submission)*

> Thank you — this genuinely helps. I'll share what I learn from the first round of data with everyone who tested. If you have more to say, just reply to the message I sent you. The whole point of this test is to find out what's actually broken before building more.

---

## Google Forms Setup Notes

- Title: **Side/Quest — First Quest Feedback**
- Description: Use the intro paragraph above
- Collect email addresses: **off** (keep it low-friction and anonymous)
- Response destination: Google Sheets (create a linked sheet for easy filtering)
- Progress bar: **on**
- Shuffle question order: **off** (question order is intentional)
- Confirmation message: Use the thank-you message above
