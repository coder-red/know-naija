# Image sourcing plan — 120 real Naija photos

v0 ships with stylised emoji placeholders so mechanics are playable offline.
To go live with real "Where is this?" pics:

1. **Source (licensed):** Wikimedia Commons only. Each `questions.json` entry has
   a `commonsHint`. Resolve via `https://commons.wikimedia.org/wiki/Special:FilePath/<name>?width=800`
   and set `imageUrl`. Keep author + license in `data/credits.json` (TODO).
2. **Quota:** 40 Lagos / 30 Abuja-FCT / 20 PH + Rivers / 30 rest (one per state
   minimum so diaspora + locals both feel seen).
3. **Anti-cheat crop:** strip sign text, use odd angles, 3+ angles per famous spot,
   rotate bank monthly. 10s timer + speed scoring already in `app.js`.
4. **Fallback:** if a photo 404s the client renders the emoji placeholder —
   game never breaks.
5. **Ask permission** for player-submitted hood pics (v1 "Stump the room" mode):
   store uploader + consent, moderate before going live.

Target: replace all 12 starter `imageUrl: null` before sharing beyond friends.
