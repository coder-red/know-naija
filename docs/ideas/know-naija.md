# Know Naija

## Problem Statement
How Might We make locals + diaspora duel for 3 minutes on Naija location knowledge and immediately hit rematch?

## Recommended Direction
Always-on 20-person survival rooms: 7 pics, 10s each, 2 lives, speed + streak scoring, city-team points (Lagos/Abuja/PH/Diaspora). Bots fill rooms in v0 so a solo dev can ship the addictive loop now; real multiplayer + Lagos Life API plug-in later.

## Key Assumptions to Validate
- [ ] Async rooms satisfy (not just scheduled HQ shows) — test 20 friends across timezones
- [ ] 10s timer + cropped pics stops google-cheating — log perfect-score rate on hard pics
- [ ] Lagos Life players click out to a mini-game — measure link click→join rate

## MVP Scope
In: nickname + team, 7-round elimination, live room board, XP + leagues, local + server leaderboard, pidgin host bot, PWA shell.
Out: scheduled shows, real-money cash-out, voice chat, native apps, in-world 3D.

## Not Doing (and Why)
- Scheduled live shows — ops hell for solo v0
- Lagos Life 3D integration — wait for API specs (`lib/lagoslife.js` stub)
- Cash-out — forbidden by their terms, legal risk
- Voice chat — moderation cost

## Open Questions
- Official API auth shape (token? iframe? redirect?) — watch Shalom announcements
- Photo licensing credits file (`data/credits.json`)
- Sponsor billboard pricing for lobby
