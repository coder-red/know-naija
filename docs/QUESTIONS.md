# Question bank policy — AI drafts, humans verify

## Short answer to "should AI generate questions?"

Yes for **scale**, no as **source of truth**. AI models hallucinate Nigerian
places with total confidence ("Kainji Waterfall, Sokoto" sounds right, doesn't
exist). One wrong answer in a competitive quiz kills trust instantly.

Rule we follow:

- ✅ AI may draft: decoy options, pidgin clues, new candidate locations
- 🚫 AI may NOT: set the final answer, write the image URL, mark `verified: true`
- 👀 A human confirms every question against its Wikipedia/Commons link before
  flipping `verified: false` → `true` (rooms prefer verified; they need 7+)

## Entry format (`data/questions.json`)

```json
{
  "id": "shere-hills",
  "prompt": "Where is this?",
  "answer": "Shere Hills, Plateau",
  "options": ["...", "...", "...", "..."],
  "state": "Plateau",
  "difficulty": "easy | medium | hard",
  "emoji": "🏔️",
  "clue": "No place names that give it away.",
  "verified": false,
  "imageUrl": null,
  "commonsHint": "Special:FilePath/Shere Hills"
}
```

Photos: Wikimedia Commons 800px thumbs only, credit kept in
`data/credits.json` + shown under each pic in-game.

## Anti-cheat contract

Answers live **only** in `data/questions.json` on the server and are **never**
sent to clients:

- `GET /api/questions` and `POST /api/room` strip `answer`, `creditUrl`
  (article slug leaks it) and `commonsHint` before responding
- The photo credit link never renders during a round — plain
  "Photo: Wikimedia Commons" text appears only after the answer is revealed
- Grading happens in `POST /api/answer` (once per round; retries replay state)
- XP and leaderboard writes happen in `POST /api/finish`, computed from
  server-graded score, streak, survival, flawless bonus, streak and quest —
  there is no client-submitted XP endpoint (old `POST /api/score` is gone,
  returns 410)

## Validate

```bash
node scripts/validate-bank.mjs
```

Checks: unique ids, exactly 4 unique options, answer ∈ options, difficulty
enum, state + clue present, ≥7 verified for a full room.
