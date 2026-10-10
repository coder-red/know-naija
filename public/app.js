// Know Naija MVP — always-on room feel via local bots.
// API-ready: questions from /api/questions, scores POST to /api/score.
const $ = (id) => document.getElementById(id);
const SCREENS = ["screen-home", "screen-game", "screen-over"];
function show(id) { SCREENS.forEach((s) => $(s).classList.add("hidden")); $(id).classList.remove("hidden"); }

const HOST_LINES = {
  start: ["No dulling! First pic don land.", "20 enter, few go survive. Na you?", "Diaspora vs home-based — make una show sef."],
  right: ["Na so! Sharp eyes 👀", "Correct! You be real Omo Naija.", "Too fast. NEPA no fit catch you."],
  wrong: ["E remain 1 life o! Focus.", "Wrong! That one na setup.", "Omo — you fall my hand small."],
  elim: ["You don comot, but predict winner for XP.", "Out! No worry, rematch dey."],
  win: ["LASGIDI LEGEND! Take your crown 👑", "You sabi Nigeria pass INEC!"],
};

const BOT_NAMES = ["Tunde_Lekki", "AdaAbuja", "Emeka_PH", "Zainab_Kano", "Seun_Yaba", "Ngozi_London", "Femi_Toronto", "Kemi_Ibadan", "Ibrahim_Kaduna", "Blessing_Uyo", "Yusuf_Sokoto", "Tobi_NYC", "Funke_Oshodi", "Chidi_Enugu", "Aisha_Dubai", "Dapo_Ikeja", "Grace_Benin", "Musa_Jos", "Sade_Houston"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

let QUESTIONS = [];
let state = null;

async function loadQuestions() {
  try {
    const r = await fetch("/api/questions");
    if (r.ok) { QUESTIONS = await r.json(); return; }
  } catch { /* offline fallback below */ }
  QUESTIONS = [];
}

async function loadBoard(elId) {
  const el = $(elId);
  try {
    const r = await fetch("/api/leaderboard");
    const j = await r.json();
    el.innerHTML = j.top.length
      ? j.top.slice(0, 8).map((s, i) => `<li>${i + 1}. <b>${escapeHtml(s.name)}</b> [${escapeHtml(s.team)}] — ${s.xp}xp</li>`).join("")
      : "<li>No legends yet. Be the first.</li>";
  } catch {
    const local = JSON.parse(localStorage.getItem("kn_local_board") || "[]");
    el.innerHTML = local.length
      ? local.slice(0, 8).map((s, i) => `<li>${i + 1}. <b>${escapeHtml(s.name)}</b> — ${s.xp}xp</li>`).join("")
      : "<li>No legends yet. Be the first.</li>";
  }
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function leagueFor(xp) {
  if (xp >= 1500) return "Lasgidi Legend";
  if (xp >= 800) return "Omo Eko";
  if (xp >= 350) return "Area Boy";
  return "Street";
}

function newRoom(player) {
  const bots = shuffle(BOT_NAMES).slice(0, 19).map((n) => ({ name: n, skill: 0.45 + Math.random() * 0.45, alive: true, score: 0 }));
  return {
    player: { ...player, lives: 2, streak: 0, score: 0, alive: true },
    bots,
    rounds: shuffle(QUESTIONS).slice(0, 7),
    idx: 0,
    lock: false,
  };
}

function aliveCount() { return (state.player.alive ? 1 : 0) + state.bots.filter((b) => b.alive).length; }

function renderRoomBoard() {
  const rows = [{ name: state.player.name + " (you)", score: state.player.score, me: true, alive: state.player.alive },
    ...state.bots.map((b) => ({ name: b.name, score: b.score, alive: b.alive }))];
  rows.sort((a, b) => b.score - a.score);
  $("g-roomboard").innerHTML = rows.slice(0, 10).map((r) =>
    `<li>${r.alive ? "🟢" : "🔴"} <b>${escapeHtml(r.name)}</b> — ${r.score}${r.me ? " ←" : ""}</li>`).join("");
  $("pill-players").textContent = `${aliveCount()} alive / 20`;
}

let timerInt = null;
function playRound() {
  state.lock = false;
  const q = state.rounds[state.idx];
  const roundNo = state.idx + 1;
  $("g-round").textContent = roundNo;
  $("g-lives").textContent = state.player.lives;
  $("g-streak").textContent = state.player.streak;
  $("g-score").textContent = state.player.score;
  // stylised placeholder pic (real photos plug into q.imageUrl later)
  $("g-pic").innerHTML = q.imageUrl
    ? `<img src="${q.imageUrl}" alt="mystery location" style="max-width:100%;border-radius:10px;max-height:240px" onerror="this.outerHTML='<div style=&quot;font-size:88px&quot;>${q.emoji}</div>'" /><small>pic ${roundNo} • ${escapeHtml(q.state)}</small>`
    : `<div>${q.emoji}<small>pic ${roundNo} • ${escapeHtml(q.state)} • real photo slot (see docs/IMAGES.md)</small></div>`;
  $("g-clue").textContent = "💡 " + q.clue;
  $("g-feed").textContent = "";
  const opts = $("g-opts");
  opts.innerHTML = "";
  shuffle(q.options).forEach((op) => {
    const b = document.createElement("button");
    b.textContent = op;
    b.onclick = () => answer(op, b);
    opts.appendChild(b);
  });
  renderRoomBoard();
  if (roundNo === 1) $("g-host").textContent = pick(HOST_LINES.start);

  let left = 10.0;
  clearInterval(timerInt);
  const bar = $("g-timerbar");
  const t0 = performance.now();
  timerInt = setInterval(() => {
    left = 10 - (performance.now() - t0) / 1000;
    bar.style.width = Math.max(0, (left / 10) * 100) + "%";
    if (left <= 0) { clearInterval(timerInt); answer(null, null); }
  }, 100);
  state.t0 = t0;
}

function answer(op, btn) {
  if (state.lock) return;
  state.lock = true;
  clearInterval(timerInt);
  const q = state.rounds[state.idx];
  const correct = op === q.answer;
  const secsLeft = Math.max(0, 10 - (performance.now() - state.t0) / 1000);
  const btns = [...$("g-opts").children];
  btns.forEach((b) => {
    b.disabled = true;
    if (b.textContent === q.answer) b.classList.add("right");
    else if (b === btn && !correct) b.classList.add("wrong");
  });

  // player scoring
  if (correct && state.player.alive) {
    const gained = Math.round(100 + secsLeft * 10 + state.player.streak * 25);
    state.player.score += gained;
    state.player.streak += 1;
    $("g-feed").textContent = `+${gained} — ${pick(HOST_LINES.right)}`;
    $("g-host").textContent = pick(HOST_LINES.right);
  } else if (state.player.alive) {
    state.player.lives -= 1;
    state.player.streak = 0;
    if (state.player.lives <= 0) {
      state.player.alive = false;
      $("g-feed").textContent = `Eliminated! Correct: ${q.answer}. ${pick(HOST_LINES.elim)}`;
    } else {
      $("g-feed").textContent = `Wrong! Correct: ${q.answer}. ${pick(HOST_LINES.wrong)}`;
    }
    $("g-host").textContent = $("g-feed").textContent;
  }

  // bots play
  state.bots.forEach((b) => {
    if (!b.alive) return;
    const hits = Math.random() < b.skill * (q.difficulty === "hard" ? 0.7 : 1);
    if (hits) b.score += Math.round(100 + Math.random() * 120 + (state.idx * 8));
    else if (Math.random() < 0.45) b.alive = false; // elimination pressure
  });
  // keep at least 3 bots alive till round 5 for drama
  if (state.idx < 4) {
    let alive = state.bots.filter((b) => b.alive);
    while (alive.length < 3) { const d = state.bots.find((b) => !b.alive); if (!d) break; d.alive = true; alive.push(d); }
  }

  $("g-lives").textContent = Math.max(0, state.player.lives);
  $("g-streak").textContent = state.player.streak;
  $("g-score").textContent = state.player.score;
  renderRoomBoard();

  setTimeout(() => {
    state.idx += 1;
    if (state.idx >= state.rounds.length || (!state.player.alive && aliveCount() <= 1)) endGame();
    else playRound();
  }, 1600);
}

async function endGame() {
  show("screen-over");
  const rank = [{ n: state.player.name + " (you)", s: state.player.score }, ...state.bots.map((b) => ({ n: b.name, s: b.score }))].sort((a, b) => b.s - a.s);
  const pos = rank.findIndex((r) => r.n.endsWith("(you)")) + 1;
  const won = pos === 1;
  const xp = Math.round(state.player.score / 10 + (won ? 150 : 0) + state.player.streak * 5);
  $("o-title").textContent = won ? "You win the room! 👑" : state.player.alive ? `Survived! #${pos} of 20` : `Eliminated — #${pos} of 20`;
  $("o-sub").textContent = won ? pick(HOST_LINES.win) + ` +${xp}xp for ${state.player.team} team.` : `+${xp}xp for ${state.player.team} team. Hit rematch — one more run.`;
  $("o-score").textContent = state.player.score;
  $("o-xp").textContent = xp;
  const totalXp = (Number(localStorage.getItem("kn_xp") || 0)) + xp;
  localStorage.setItem("kn_xp", totalXp);
  $("o-league").textContent = leagueFor(totalXp);
  $("o-board").innerHTML = rank.slice(0, 8).map((r, i) => `<li>${i + 1}. <b>${escapeHtml(r.n)}</b> — ${r.s}</li>`).join("");

  const entry = { name: state.player.name, team: state.player.team, xp, wins: won };
  const local = JSON.parse(localStorage.getItem("kn_local_board") || "[]");
  local.push({ ...entry, xp: totalXp });
  localStorage.setItem("kn_local_board", JSON.stringify(local.slice(-50)));
  try { await fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) }); } catch { /* localhost file fallback ok */ }
  loadBoard("home-board");
}

$("btn-join").onclick = async () => {
  const name = ($("in-name").value || "Anon").trim().slice(0, 24) || "Anon";
  const team = $("in-team").value;
  localStorage.setItem("kn_name", name); localStorage.setItem("kn_team", team);
  if (!QUESTIONS.length) await loadQuestions();
  if (!QUESTIONS.length) { alert("Questions failed to load. Is the server running?"); return; }
  state = newRoom({ name, team });
  show("screen-game");
  playRound();
};
$("btn-again").onclick = () => { state = newRoom({ name: localStorage.getItem("kn_name") || "Anon", team: localStorage.getItem("kn_team") || "Lagos" }); show("screen-game"); playRound(); };
$("btn-home").onclick = () => show("screen-home");
$("btn-board").onclick = () => loadBoard("home-board");

(async () => {
  $("in-name").value = localStorage.getItem("kn_name") || "";
  await loadQuestions();
  loadBoard("home-board");
})();
