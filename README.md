# Know Naija — Where is this? 👀

Live elimination quiz on Nigerian locations. Built as a Lagos Life mini-game MVP.

- 20 enter a room (you + 19 bots in v0), 7 pics, 10s each, 2 lives
- Fast + streak = more points. City teams: Lagos / Abuja / PH / Diaspora
- Zero-dep Node server + vanilla JS. Browser-first, like Lagos Life.

## Run

```bash
node server.js
# -> http://localhost:3000
```

API:

- `GET /api/questions` — question bank
- `GET /api/leaderboard` — top scores
- `POST /api/score` `{name, team, xp, wins}` — submit score

## Lagos Life plug-in (when API drops)

See `lib/lagoslife.js` — standalone stub. Swap in auth/wallet/leaderboard calls
once Shalom publishes specs. No cash-out: virtual naira has no real value per
their terms.

## Next

- `docs/IMAGES.md` — licensed photo sourcing plan (120 pics)
- Real multiplayer: swap bot engine in `public/app.js` for WebSockets
- Scheduled Sunday Naija Bowl + sponsor billboard in lobby
