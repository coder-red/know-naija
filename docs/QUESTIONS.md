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

## Validate

```bash
node scripts/validate-bank.mjs
```

Checks: unique ids, exactly 4 unique options, answer ∈ options, difficulty
enum, state + clue present, ≥7 verified for a full room.
