// Validates data/questions.json — run: node scripts/validate-bank.mjs
// Catches the exact failure modes of AI-generated banks: dup ids,
// decoy counts, answer missing from options, bad difficulty, missing state.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "questions.json");
const bank = JSON.parse(fs.readFileSync(file, "utf8"));
const errs = [];
const seen = new Set();

for (const [i, q] of bank.entries()) {
  const tag = `questions[${i}]${q.id ? ` (${q.id})` : ""}`;
  if (!q.id) errs.push(`${tag}: missing id`);
  else if (seen.has(q.id)) errs.push(`${tag}: duplicate id`);
  else seen.add(q.id);
  if (!q.answer) errs.push(`${tag}: missing answer`);
  if (!Array.isArray(q.options) || q.options.length !== 4) errs.push(`${tag}: need exactly 4 options`);
  else {
    if (new Set(q.options).size !== 4) errs.push(`${tag}: duplicate options`);
    if (q.answer && !q.options.includes(q.answer)) errs.push(`${tag}: answer not in options`);
  }
  if (!["easy", "medium", "hard"].includes(q.difficulty)) errs.push(`${tag}: bad difficulty`);
  if (!q.state) errs.push(`${tag}: missing state`);
  if (!q.clue) errs.push(`${tag}: missing clue`);
  if (q.verified !== true && !q.commonsHint && !q.imageUrl) errs.push(`${tag}: unverified and no image lead`);
}

const verified = bank.filter((q) => q.verified === true).length;
console.log(`bank: ${bank.length} questions, ${verified} verified with photos`);
if (verified < 7) errs.push(`only ${verified} verified — rooms need 7, verify more before sharing`);

if (errs.length) {
  console.error("INVALID:\n- " + errs.join("\n- "));
  process.exit(1);
}
console.log("VALID ✓");
