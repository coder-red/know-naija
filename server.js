// Know Naija — zero-dependency static + JSON API server.
// Run: node server.js [--port 3000]
// Serves public/ and exposes /api/questions + /api/leaderboard.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data");
const DB_FILE = path.join(DATA, "db.json");

const args = process.argv.slice(2);
let PORT = Number(process.env.PORT || 3000);
const pi = args.indexOf("--port");
if (pi !== -1 && args[pi + 1]) PORT = Number(args[pi + 1]);

function ensureDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ scores: [] }, null, 2));
    }
  } catch (e) {
    console.error("db init failed", e.message);
  }
}

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return { scores: [] };
  }
}

function writeDb(db) {
  try {
    // Prune streak records idle 60+ days so the file stays small.
    const players = db.players || {};
    const cutoff = Date.now() - 60 * 864e5;
    for (const k of Object.keys(players)) {
      if (!players[k].seen && players[k].last && new Date(players[k].last).getTime() < cutoff) delete players[k];
    }
    const slim = { scores: (db.scores || []).slice(-200), players };
    fs.writeFileSync(DB_FILE, JSON.stringify(slim, null, 2));
  } catch (e) {
    console.error("db write failed", e.message);
  }
}

function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

// BUG FIX: photos were served as application/octet-stream; some browsers refuse to render that.
function send(res, code, body, type = "text/plain; charset=utf-8", cache) {
  const h = { "Content-Type": type };
  if (cache) h["Cache-Control"] = cache;
  res.writeHead(code, h);
  res.end(body);
}

// ISO week key, e.g. "2026-W41" — city battle resets every Monday (fresh aspiration, Duolingo-style).
function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fday = (first.getUTCDay() + 6) % 7;
  first.setUTCDate(first.getUTCDate() - fday + 3);
  return t.getUTCFullYear() + "-W" + String(1 + Math.round((t - first) / 6048e5)).padStart(2, "0");
}

// ---- authoritative question bank: answers live ONLY here, never sent to clients ----
const BANK = JSON.parse(fs.readFileSync(path.join(DATA, "questions.json"), "utf8"));
const BANK_BY_ID = new Map(BANK.map((q) => [q.id, q]));
// Strip every field a cheater could use: the answer AND the credit URL (article slug leaks it).
function publicQuestion(q) {
  const { answer, creditUrl, commonsHint, ...safe } = q;
  return safe;
}
function dealRoom() {
  const v = BANK.filter((q) => q.verified !== false);
  const pool = v.length >= 7 ? v : BANK;
  const by = { easy: [], medium: [], hard: [] };
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  shuffled.forEach((q) => (by[q.difficulty] || by.medium).push(q));
  const plan = ["easy", "easy", "medium", "medium", "medium", "hard", "hard"];
  const out = [];
  for (const d of plan) out.push(by[d].pop() || by.easy.pop() || by.medium.pop() || by.hard.pop());
  return out.filter(Boolean).slice(0, 7);
}

// ---- sessions: one per room join. Server owns score/streak/lives — clients render. ----
const sessions = new Map(); // token -> session
function newSession(name, team) {
  if (sessions.size > 500) sessions.delete(sessions.keys().next().value); // bounded memory
  const token = crypto.randomUUID();
  const rounds = dealRoom();
  sessions.set(token, {
    token, name: String(name).slice(0, 24), team: ["Lagos", "Abuja", "PH", "Diaspora"].includes(team) ? team : "Lagos",
    rounds, idx: 0, gradedIdx: -1,
    score: 0, streak: 0, maxStreak: 0, correct: 0, answered: 0, wrongs: 0,
    lives: 2, spare: true, alive: true, finished: false, started: Date.now(),
  });
  return sessions.get(token);
}
function gradeAnswer(s, choice, msLeft) {
  if (s.finished || s.idx >= s.rounds.length) return { error: "room over" };
  const q = s.rounds[s.idx];
  if (s.gradedIdx === s.idx) { // double submit (retry/lag) — replay state, count nothing twice
    return snapshot(s, q, false);
  }
  s.gradedIdx = s.idx;
  const ms = Math.max(0, Math.min(10, Number(msLeft) || 0));
  const savage = s.idx === s.rounds.length - 1;
  const correct = choice === q.answer;
  let gained = 0, spared = false;
  if (s.alive) {
    s.answered += 1;
    if (correct) {
      gained = Math.round((100 + ms * 10 + s.streak * 25) * (savage ? 2 : 1));
      s.score += gained;
      s.streak += 1;
      s.maxStreak = Math.max(s.maxStreak, s.streak);
      s.correct += 1;
    } else {
      s.wrongs += 1;
      s.lives -= 1;
      s.streak = 0;
      if (s.lives <= 0 && s.spare) { s.spare = false; s.lives = 1; spared = true; }
      else if (s.lives <= 0) s.alive = false;
    }
  }
  const out = snapshot(s, q, true);
  out.correct = correct;
  out.gained = gained;
  out.spared = spared;
  s.idx += 1;
  return out;
}
function snapshot(s, q, graded) {
  return {
    graded, answer: q.answer, // reveal ONLY at grade time, never before
    score: s.score, streak: s.streak, maxStreak: s.maxStreak,
    lives: Math.max(0, s.lives), spare: s.spare, alive: s.alive,
    answered: s.answered, correctCount: s.correct, idx: s.idx,
  };
}
// Server-side daily streak + quest (keyed by handle; day is the PLAYER's local date).
function extendStreakServer(db, name, day) {
  db.players = db.players || {};
  const p = db.players[name] || { streak: 0, last: "", freeze: 0, qdate: "", qbest: 0, qdone: false };
  let froze = false;
  if (p.last !== day) {
    const gap = p.last ? Math.round((new Date(day) - new Date(p.last)) / 864e5) : 99;
    if (gap === 1) p.streak += 1;
    else if (gap === 2 && p.freeze > 0) { p.freeze -= 1; p.streak += 1; froze = true; }
    else p.streak = 1;
    if (p.streak % 7 === 0) p.freeze = Math.min(2, p.freeze + 1);
    p.last = day;
  }
  p.seen = Date.now();
  db.players[name] = p;
  return { streak: p.streak, freeze: p.freeze, froze, bonus: Math.min(50, p.streak * 5) };
}
function questBumpServer(db, name, day, survived) {
  const p = db.players[name];
  if (p.qdate !== day) { p.qdate = day; p.qbest = 0; p.qdone = false; }
  p.qbest = Math.max(p.qbest, survived);
  let bonus = 0;
  if (!p.qdone && p.qbest >= 3) { p.qdone = true; bonus = 30; }
  return { bonus, done: p.qdone, best: p.qbest };
}

function serveStatic(reqPath, res) {
  let rel = decodeURIComponent(reqPath.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return send(res, 403, "forbidden");
  // BUG FIX: photos re-downloaded every room — cache vendored images immutably.
  const cache = rel.startsWith("/img/") ? "public, max-age=31536000, immutable" : "public, max-age=600";
  fs.readFile(file, (err, buf) => {
    if (err) {
      // SPA fallback for unknown non-api routes
      if (!path.extname(rel)) {
        fs.readFile(path.join(PUBLIC, "index.html"), (e2, b2) =>
          e2 ? send(res, 404, "not found") : send(res, 200, b2, MIME[".html"])
        );
      } else send(res, 404, "not found");
      return;
    }
    send(res, 200, buf, MIME[path.extname(file).toLowerCase()] || "application/octet-stream", cache);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let s = "";
    req.on("data", (c) => { s += c; if (s.length > 1e6) req.destroy(); });
    req.on("end", () => resolve(s));
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const p = u.pathname;

  // CORS for future Lagos Life iframe embedding
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  try {
    if (p === "/api/health") return send(res, 200, JSON.stringify({ ok: true, game: "know-naija", ts: Date.now() }), MIME[".json"]);

    if (p === "/api/questions" && req.method === "GET") {
      // Answers + credit URLs stripped — view-source shows nothing usable.
      return send(res, 200, JSON.stringify(BANK.map(publicQuestion)), MIME[".json"], "no-store");
    }

    if (p === "/api/leaderboard" && req.method === "GET") {
      const db = readDb();
      const scores = db.scores || [];
      const top = [...scores].sort((a, b) => b.xp - a.xp).slice(0, 20);
      const TEAMS = ["Lagos", "Abuja", "PH", "Diaspora"];
      const wk = weekKey();
      const tally = (list) => TEAMS.map((team) => {
        const mine = list.filter((s) => s.team === team);
        return {
          team,
          xp: mine.reduce((n, s) => n + (s.xp || 0), 0),
          // BUG FIX: was counting games as "players" — dedupe by name.
          players: new Set(mine.map((s) => s.name)).size,
          wins: mine.reduce((n, s) => n + (s.wins ? 1 : 0), 0),
        };
      }).sort((a, b) => b.xp - a.xp);
      return send(res, 200, JSON.stringify({
        top, count: scores.length,
        week: wk,
        cities: tally(scores.filter((s) => s.week === wk)), // resets every Monday
        citiesAllTime: tally(scores),
      }, null, 0), MIME[".json"], "no-store");
    }

    // REMOVED: blind POST /api/score (clients could post any XP). Scores now
    // originate from server-graded sessions via POST /api/finish below.

    if (p === "/api/room" && req.method === "POST") {
      const body = await readBody(req);
      let b;
      try { b = JSON.parse(body || "{}"); } catch { return send(res, 400, JSON.stringify({ error: "bad json" }), MIME[".json"]); }
      if (!b.name) return send(res, 400, JSON.stringify({ error: "name required" }), MIME[".json"]);
      const s = newSession(b.name, b.team);
      return send(res, 200, JSON.stringify({ token: s.token, rounds: s.rounds.map(publicQuestion) }), MIME[".json"], "no-store");
    }

    if (p === "/api/answer" && req.method === "POST") {
      const body = await readBody(req);
      let b;
      try { b = JSON.parse(body || "{}"); } catch { return send(res, 400, JSON.stringify({ error: "bad json" }), MIME[".json"]); }
      const s = sessions.get(b.token);
      if (!s) return send(res, 404, JSON.stringify({ error: "unknown room — rejoin" }), MIME[".json"]);
      const out = gradeAnswer(s, typeof b.choice === "string" ? b.choice : null, b.msLeft);
      if (out.error) return send(res, 410, JSON.stringify(out), MIME[".json"]);
      return send(res, 200, JSON.stringify(out), MIME[".json"], "no-store");
    }

    if (p === "/api/finish" && req.method === "POST") {
      const body = await readBody(req);
      let b;
      try { b = JSON.parse(body || "{}"); } catch { return send(res, 400, JSON.stringify({ error: "bad json" }), MIME[".json"]); }
      const s = sessions.get(b.token);
      if (!s) return send(res, 404, JSON.stringify({ error: "unknown room" }), MIME[".json"]);
      if (!s.finished) {
        s.finished = true;
        const survived = s.alive ? s.rounds.length : Math.max(0, s.idx);
        const accuracy = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
        const flawless = s.answered > 0 && s.wrongs === 0;
        const db = readDb();
        const day = /^\d{4}-\d{2}-\d{2}$/.test(b.day || "") ? b.day : localDayKey();
        const st = extendStreakServer(db, s.name, day);
        const qu = questBumpServer(db, s.name, day, survived);
        const xp = Math.round(s.score / 10 + s.maxStreak * 5 + survived * 10 + (flawless ? 150 : 0) + st.bonus + qu.bonus);
        db.scores = db.scores || [];
        db.scores.push({ name: s.name, team: s.team, xp, wins: 0, week: weekKey(), ts: Date.now() });
        writeDb(db);
        s.receipt = { xp, survived, accuracy, flawless, streak: st.streak, freeze: st.freeze, froze: st.froze, streakBonus: st.bonus, questBonus: qu.bonus, qdone: qu.done, qbest: qu.best, week: weekKey() };
        sessions.delete(s.token); // single-use receipt — replaying finish changes nothing
      }
      return send(res, 200, JSON.stringify(s.receipt), MIME[".json"], "no-store");
    }

    if (p === "/api/score" && req.method === "POST") {
      return send(res, 410, JSON.stringify({ error: "gone — scores come from POST /api/finish" }), MIME[".json"]);
    }

    return serveStatic(p, res);
  } catch (e) {
    console.error(e);
    return send(res, 500, "server error");
  }
});

ensureDb();
server.listen(PORT, () => {
  console.log(`Know Naija live on http://localhost:${PORT}`);
});
