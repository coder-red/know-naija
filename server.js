// Know Naija — zero-dependency static + JSON API server.
// Run: node server.js [--port 3000]
// Serves public/ and exposes /api/questions + /api/leaderboard.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

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
    const slim = { scores: (db.scores || []).slice(-200) };
    fs.writeFileSync(DB_FILE, JSON.stringify(slim, null, 2));
  } catch (e) {
    console.error("db write failed", e.message);
  }
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
      const raw = fs.readFileSync(path.join(DATA, "questions.json"), "utf8");
      return send(res, 200, raw, MIME[".json"]);
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

    if (p === "/api/score" && req.method === "POST") {
      const body = await readBody(req);
      let s;
      // BUG FIX: malformed JSON crashed to 500 — now a clean 400.
      try { s = JSON.parse(body || "{}"); } catch { return send(res, 400, JSON.stringify({ error: "bad json" }), MIME[".json"]); }
      if (!s.name || typeof s.xp !== "number") return send(res, 400, JSON.stringify({ error: "name + xp required" }), MIME[".json"]);
      const db = readDb();
      db.scores = db.scores || [];
      db.scores.push({
        name: String(s.name).slice(0, 24),
        team: String(s.team || "Lagos").slice(0, 16),
        xp: Math.max(0, Math.min(999999, Math.round(s.xp))),
        wins: s.wins ? 1 : 0,
        week: weekKey(),
        ts: Date.now(),
      });
      writeDb(db);
      return send(res, 200, JSON.stringify({ ok: true }), MIME[".json"]);
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
