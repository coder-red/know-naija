// Know Naija — always-on elimination rooms.
// Retention loop (HQ + Duolingo lessons): ramp difficulty, savage finale,
// one-chance spare, survival XP for losers, predict-while-spectating,
// daily streak + freeze, daily quest, PB + confetti.
const $ = (id) => document.getElementById(id);
const SCREENS = ["screen-home", "screen-game", "screen-over"];
function show(id) {
  SCREENS.forEach((s) => $(s).classList.add("hidden"));
  $(id).classList.remove("hidden");
  document.body.dataset.screen = id.replace("screen-", ""); // home | game | over — drives shell layout
}

const HOST_LINES = {
  start: ["No dulling. First pic don land.", "20 enter, few go survive. Na you?", "Home vs diaspora. Show yourself."],
  right: ["Na so. Sharp eyes.", "Correct. You be real Omo Naija.", "Too fast. NEPA no fit catch you."],
  wrong: ["One life left. Focus.", "Wrong. That one na setup.", "You fall my hand small."],
  spare: ["HOST SPARES YOU. One Chance used. No more shakara."],
  elim: ["Eliminated. Predict the winner for +50 XP.", "Out. Call the winner, still chop XP."],
  win: ["NAIJA LEGEND. Take the crown.", "You sabi Nigeria well well."],
  savage: ["SAVAGE ROUND. Last pic, DOUBLE points. No fear."],
};

const GUEST_POOL = ["DanfoStar", "AmalaAce", "NEPAProof", "OwambePro", "SuyaSavant", "JapaDream", "MolueMind", "AsoRocky", "LekkiGhost", "ZumaZoom"];
const BOT_NAMES = ["Tunde_Lekki", "AdaAbuja", "Emeka_PH", "Zainab_Kano", "Seun_Yaba", "Ngozi_London", "Femi_Toronto", "Kemi_Ibadan", "Ibrahim_Kaduna", "Blessing_Uyo", "Yusuf_Sokoto", "Tobi_NYC", "Funke_Oshodi", "Chidi_Enugu", "Aisha_Dubai", "Dapo_Ikeja", "Grace_Benin", "Musa_Jos", "Sade_Houston"];
const ROOM_NAMES = ["lasgidi-1", "yaba-2", "owambe-3", "danfo-4", "surulere-5", "obalende-6"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

let QUESTIONS = [];
let state = null;
let session = 0; // bumped on join/quit — stale timers check this before acting

function goHome() {
  session += 1;
  clearInterval(timerInt);
  state = null;
  $("pill-players").textContent = "20 in room";
  show("screen-home");
  refreshMeta();
  loadBoards();
}

function myHandle() {
  let h = localStorage.getItem("kn_name");
  if (!h) {
    h = `${pick(GUEST_POOL)}-${Math.floor(100 + Math.random() * 900)}`;
    localStorage.setItem("kn_name", h);
  }
  return h;
}

// ---- daily streak + freeze (Duolingo rules, simplified) ----
function localDay(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function dayDiff(a, b) { // days from a -> b (local midnights)
  const pa = a.split("-").map(Number), pb = b.split("-").map(Number);
  return Math.round((new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / 864e5);
}
function streakInfo() {
  return { streak: Number(localStorage.getItem("kn_daystreak") || 0), freeze: Number(localStorage.getItem("kn_freeze") || 0), last: localStorage.getItem("kn_lastday") || "" };
}
// Called at end of every room. Returns {streak, froze, bonus}.
function extendStreak() {
  const today = localDay();
  let { streak, freeze, last } = streakInfo();
  let froze = false;
  if (last === today) return { streak, froze, bonus: 0 };
  const gap = last ? dayDiff(last, today) : 99;
  if (gap === 1) streak += 1;
  else if (gap === 2 && freeze > 0) { freeze -= 1; streak += 1; froze = true; } // freeze burns instead of the streak
  else streak = 1;
  if (streak % 7 === 0) freeze = Math.min(2, freeze + 1); // earn a freeze weekly
  localStorage.setItem("kn_daystreak", streak);
  localStorage.setItem("kn_freeze", freeze);
  localStorage.setItem("kn_lastday", today);
  return { streak, froze, bonus: Math.min(50, streak * 5) };
}
// ---- daily quest: survive 3 rounds ----
function questProg() { return JSON.parse(localStorage.getItem("kn_quest") || '{"date":"","best":0,"done":false}'); }
function questBump(survived) {
  const today = localDay();
  const q = questProg();
  if (q.date !== today) { q.date = today; q.best = 0; q.done = false; }
  q.best = Math.max(q.best, survived);
  let bonus = 0;
  if (!q.done && q.best >= 3) { q.done = true; bonus = 30; }
  localStorage.setItem("kn_quest", JSON.stringify(q));
  return { bonus, done: q.done, best: q.best };
}
function refreshMeta() {
  const { streak, freeze } = streakInfo();
  $("me-streak").textContent = streak > 0 ? `${streak}-day streak` : "No streak yet — play a room to start one";
  $("me-freeze").textContent = freeze > 0 ? `${freeze} freeze banked` : "";
  const q = questProg();
  const fresh = q.date === localDay();
  $("me-quest").textContent = fresh && q.done ? `done today (best ${q.best}/7)` : `survive 3 rounds (+30 XP)${fresh ? ` — best today ${q.best}/7` : ""}`;
}

async function loadQuestions() {
  try {
    const r = await fetch("/api/questions");
    if (r.ok) { QUESTIONS = await r.json(); return; }
  } catch { /* offline */ }
  QUESTIONS = [];
}
// HQ lesson: ramp easy -> hard so round 1 hooks and the finale is savage.
function roomPool() {
  const v = QUESTIONS.filter((q) => q.verified !== false);
  const pool = v.length >= 7 ? v : QUESTIONS;
  const by = { easy: [], medium: [], hard: [] };
  shuffle(pool).forEach((q) => (by[q.difficulty] || by.medium).push(q));
  const plan = ["easy", "easy", "medium", "medium", "medium", "hard", "hard"];
  const out = [];
  for (const d of plan) out.push(by[d].pop() || by.easy.pop() || by.medium.pop() || by.hard.pop());
  return out.filter(Boolean).slice(0, 7);
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
// Monogram tile for missing/failed photos — no emoji, no leaks.
function stateCode(s) { return String(s || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(); }
function setPic(q) {
  const box = $("g-pic");
  const tile = `<div class="photile"><span>${stateCode(q.state)}</span><small>${escapeHtml(q.state)} · photo coming soon</small></div>`;
  box.innerHTML = tile; // tile doubles as the loading state
  if (!q.imageUrl) return;
  const im = new Image();
  im.alt = "Where is this?";
  im.onload = () => { box.innerHTML = ""; box.appendChild(im); };
  im.src = q.imageUrl;
}
// League ladder is national, not Lagos-only: JJC -> Hustler -> Omo Naija -> Naija Legend.
function leagueFor(xp) {
  if (xp >= 1500) return "Naija Legend";
  if (xp >= 800) return "Omo Naija";
  if (xp >= 350) return "Hustler";
  return "JJC";
}

function renderCities(el, cities) {
  if (!cities || !cities.length) { el.innerHTML = "<p class='tiny'>No points yet. Be the first.</p>"; return; }
  const max = Math.max(1, ...cities.map((c) => c.xp));
  el.innerHTML = cities.map((c, i) =>
    `<div class="cityrow"><span class="cityname"><span class="crank r${i + 1}">${i + 1}</span> ${escapeHtml(c.team)}</span>` +
    `<div class="citybar"><div style="width:${Math.max(3, Math.round((c.xp / max) * 100))}%"></div></div>` +
    `<span class="cityxp">${c.xp}xp · ${c.players} players</span></div>`).join("");
}

async function loadBoards() {
  try {
    const r = await fetch("/api/leaderboard");
    const j = await r.json();
    $("home-board").innerHTML = j.top.length
      ? j.top.slice(0, 8).map((s, i) => `<li>${i + 1}. <b>${escapeHtml(s.name)}</b> [${escapeHtml(s.team)}] — ${s.xp}xp</li>`).join("")
      : "<li>No legends yet. Be the first.</li>";
    renderCities($("home-cities"), j.cities);
    $("home-week").textContent = j.week ? `· this week (${j.week}, resets Mon)` : "";
    return j;
  } catch {
    const local = JSON.parse(localStorage.getItem("kn_local_board") || "[]");
    $("home-board").innerHTML = local.length
      ? [...local].sort((a, b) => b.xp - a.xp).slice(0, 8).map((s, i) => `<li>${i + 1}. <b>${escapeHtml(s.name)}</b> — ${s.xp}xp</li>`).join("")
      : "<li>No legends yet. Be the first.</li>";
    $("home-cities").innerHTML = "<p class='tiny'>City battle needs connection.</p>";
    return null;
  }
}

function newRoom(player) {
  const bots = shuffle(BOT_NAMES).slice(0, 19).map((n) => ({ name: n, skill: 0.45 + Math.random() * 0.45, alive: true, score: 0 }));
  return {
    player: { ...player, lives: 2, spare: true, streak: 0, maxStreak: 0, score: 0, alive: true, correct: 0, answered: 0, predict: null },
    bots,
    rounds: roomPool(),
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
    `<li><span class="mdot ${r.alive ? "on" : "off"}"></span><b>${escapeHtml(r.name)}</b> — ${r.score}${r.me ? " ←" : ""}</li>`).join("");
  $("pill-players").textContent = `${aliveCount()} alive / 20`;
}

let timerInt = null;
function playRound() {
  state.lock = false;
  const q = state.rounds[state.idx];
  const roundNo = state.idx + 1;
  const isSavage = state.idx === state.rounds.length - 1;
  document.querySelector(".picwrap").classList.toggle("savage", isSavage);
  $("g-round").textContent = roundNo;
  $("g-picnum").textContent = roundNo + " / " + state.rounds.length;
  $("g-lives").textContent = state.player.lives;
  $("g-streak").textContent = state.player.streak;
  $("g-score").textContent = state.player.score;
  setPic(q);
  // Anti-cheat: no credit link while answering (the article title gives it away).
  // Plain-text credit appears only after the answer is revealed — see answer().
  $("g-credit").textContent = "";
  $("g-clue").textContent = (isSavage ? "SAVAGE · 2x points — " : "") + q.clue;
  $("g-feed").textContent = isSavage ? pick(HOST_LINES.savage) : "";
  $("g-predict").classList.add("hidden");
  $("g-predict").innerHTML = "";
  const opts = $("g-opts");
  opts.innerHTML = "";
  // Kahoot lesson: shape + color coding (▲ red ◆ blue ● gold ■ green) — iconic, colorblind-safe.
  const shapes = [["s0", "▲"], ["s1", "◆"], ["s2", "●"], ["s3", "■"]];
  shuffle(q.options).forEach((op, i) => {
    const b = document.createElement("button");
    b.dataset.opt = op;
    b.className = shapes[i][0];
    b.innerHTML = `<span class="opt-shape">${shapes[i][1]}</span><span>${escapeHtml(op)}</span>`;
    b.onclick = () => answer(op, b);
    opts.appendChild(b);
  });
  $("g-dots").innerHTML = state.rounds.map((_, i) =>
    `<span class="${i < state.idx ? "done" : i === state.idx ? "now" : ""}"></span>`).join("");
  renderRoomBoard();
  if (roundNo === 1) $("g-host").textContent = pick(HOST_LINES.start);

  clearInterval(timerInt);
  const bar = $("g-timerbar");
  const t0 = performance.now();
  const mySession = session;
  timerInt = setInterval(() => {
    if (mySession !== session) { clearInterval(timerInt); return; }
    const left = 10 - (performance.now() - t0) / 1000;
    bar.style.width = Math.max(0, (left / 10) * 100) + "%";
    bar.classList.toggle("danger", left < 3);
    if (left <= 0) { clearInterval(timerInt); answer(null, null); }
  }, 100);
  state.t0 = t0;
}

// Eliminated players pick a winner — keeps them watching instead of quitting.
function offerPredict() {
  const box = $("g-predict");
  const cands = [...state.bots].filter((b) => b.alive).sort((a, b) => b.score - a.score).slice(0, 3);
  if (!cands.length) return;
  box.innerHTML = `<span>Eliminated? Call the winner (+50 XP if you are right)</span>` +
    cands.map((b) => `<button data-n="${escapeHtml(b.name)}">${escapeHtml(b.name)}</button>`).join("");
  box.classList.remove("hidden");
  box.querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => {
      state.player.predict = btn.dataset.n;
      box.classList.add("hidden");
      $("g-feed").textContent = `Locked: ${state.player.predict} to win.`;
    };
  });
}

function answer(op, btn) {
  if (state.lock) return;
  state.lock = true;
  clearInterval(timerInt);
  const q = state.rounds[state.idx];
  const correct = op === q.answer;
  const secsLeft = Math.max(0, 10 - (performance.now() - state.t0) / 1000);
  const savageMult = state.idx === state.rounds.length - 1 ? 2 : 1;
  const btns = [...$("g-opts").children];
  btns.forEach((b) => {
    b.disabled = true;
    if (b.dataset.opt === q.answer) b.classList.add("right");
    else if (b === btn && !correct) { b.classList.add("wrong", "shake"); }
  });
  // Answer is out — safe to show the plain-text photo credit (never a link).
  $("g-credit").textContent = q.imageUrl ? "Photo: Wikimedia Commons" : "";

  if (correct && state.player.alive) {
    const gained = Math.round((100 + secsLeft * 10 + state.player.streak * 25) * savageMult);
    state.player.score += gained;
    state.player.streak += 1;
    state.player.maxStreak = Math.max(state.player.maxStreak, state.player.streak);
    state.player.correct += 1;
    state.player.answered += 1;
    $("g-feed").textContent = `+${gained} — ${pick(HOST_LINES.right)}`;
    $("g-host").textContent = pick(HOST_LINES.right);
  } else if (state.player.alive) {
    state.player.answered += 1;
    state.player.lives -= 1;
    state.player.streak = 0;
    if (state.player.lives <= 0 && state.player.spare) {
      // One Chance: HQ's extra-life mechanic — spares you once per room.
      state.player.spare = false;
      state.player.lives = 1;
      $("g-feed").textContent = `Correct: ${q.answer}. ${pick(HOST_LINES.spare)}`;
      $("g-host").textContent = pick(HOST_LINES.spare);
    } else if (state.player.lives <= 0) {
      state.player.alive = false;
      $("g-feed").textContent = `Eliminated! Correct: ${q.answer}. ${pick(HOST_LINES.elim)}`;
      $("g-host").textContent = $("g-feed").textContent;
      offerPredict();
    } else {
      $("g-feed").textContent = `Wrong! Correct: ${q.answer}. ${pick(HOST_LINES.wrong)}`;
      $("g-host").textContent = $("g-feed").textContent;
    }
  }

  state.bots.forEach((b) => {
    if (!b.alive) return;
    const hits = Math.random() < b.skill * (q.difficulty === "hard" ? 0.7 : 1);
    if (hits) b.score += Math.round((100 + Math.random() * 120 + (state.idx * 8)) * (state.idx === state.rounds.length - 1 ? 2 : 1));
    else if (Math.random() < 0.45) b.alive = false;
  });
  if (state.idx < 4) {
    const alive = state.bots.filter((b) => b.alive);
    let guard = 0;
    while (alive.length < 3 && guard++ < 20) { const d = state.bots.find((b) => !b.alive); if (!d) break; d.alive = true; alive.push(d); }
  }

  $("g-lives").textContent = Math.max(0, state.player.lives);
  $("g-streak").textContent = state.player.streak;
  $("g-score").textContent = state.player.score;
  renderRoomBoard();

  const mySession = session;
  setTimeout(() => {
    if (mySession !== session) return; // user quit — stay home
    state.idx += 1;
    if (state.idx >= state.rounds.length || (!state.player.alive && aliveCount() <= 1)) endGame();
    else playRound();
  }, state.player.alive ? 1600 : 2600); // spectating? slower pace, time to predict
}

// Paper confetti in brand colors — no emoji rain.
function confetti(n = 30) {
  const cols = ["#22c55e", "#f5a30b", "#e21b3c", "#1368ce", "#ffffff"];
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.className = "confetti";
    const size = 7 + Math.random() * 8;
    s.style.width = size + "px";
    s.style.height = (Math.random() < 0.45 ? size : size * 0.45) + "px";
    if (Math.random() < 0.4) s.style.borderRadius = "50%";
    s.style.background = pick(cols);
    s.style.left = Math.random() * 100 + "%";
    s.style.animationDelay = (Math.random() * 0.8) + "s";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 3200);
  }
}

async function endGame() {
  show("screen-over");
  const rank = [{ n: state.player.name + " (you)", s: state.player.score }, ...state.bots.map((b) => ({ n: b.name, s: b.score }))].sort((a, b) => b.s - a.s);
  const pos = rank.findIndex((r) => r.n.endsWith("(you)")) + 1;
  const won = pos === 1;
  $("o-rank").textContent = "#" + pos;
  $("o-rank").dataset.tier = won ? "gold" : pos <= 3 ? "top3" : "rest";
  const survived = state.player.alive ? state.rounds.length : Math.max(0, state.idx);
  // HQ lesson: losers must progress too — survival XP + accuracy + bonuses.
  const oracle = state.player.predict && rank[0].n === state.player.predict ? 50 : 0;
  const { streak, froze, bonus: streakBonus } = extendStreak();
  const { bonus: questBonus } = questBump(survived);
  const xp = Math.round(state.player.score / 10 + (won ? 150 : 0) + state.player.maxStreak * 5 + survived * 10 + oracle + streakBonus + questBonus);
  const acc = state.player.answered ? Math.round((state.player.correct / state.player.answered) * 100) : 0;

  $("o-title").textContent = won ? "You win the room!" : state.player.alive ? `Survived! #${pos} of 20` : `Eliminated — #${pos} of 20`;
  let sub = won ? pick(HOST_LINES.win) + ` +${xp} XP for Team ${state.player.team}.` : `+${xp} XP for Team ${state.player.team}. Hit rematch — one more run.`;
  if (oracle) sub += " Called the winner. Oracle +50 XP.";
  if (froze) sub += " Freeze saved your streak.";
  if (questBonus) sub += " Daily quest done. +30 XP.";
  $("o-sub").textContent = sub;
  $("o-stats").textContent = `Accuracy ${acc}% · Best combo x${state.player.maxStreak} · Survived ${survived}/${state.rounds.length} · ${streak}-day streak`;
  $("o-score").textContent = state.player.score;
  $("o-xp").textContent = xp;

  const prevBest = Number(localStorage.getItem("kn_best") || 0);
  const isPB = state.player.score > prevBest && state.player.score > 0;
  if (isPB) {
    localStorage.setItem("kn_best", state.player.score);
    $("o-stats").textContent += " · NEW PERSONAL BEST";
  }
  if (won || isPB) confetti();

  const totalXp = Number(localStorage.getItem("kn_xp") || 0) + xp;
  localStorage.setItem("kn_xp", totalXp);
  $("o-league").textContent = leagueFor(totalXp);
  $("o-board").innerHTML = rank.slice(0, 8).map((r, i) => `<li>${i + 1}. <b>${escapeHtml(r.n)}</b> — ${r.s}</li>`).join("");

  const entry = { name: state.player.name, team: state.player.team, xp, wins: won };
  // BUG FIX: local board stored lifetime totals next to server per-game scores — now per-game both sides.
  const local = JSON.parse(localStorage.getItem("kn_local_board") || "[]");
  local.push(entry);
  localStorage.setItem("kn_local_board", JSON.stringify(local.slice(-50)));
  let boards = null;
  try {
    await fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) });
    const r = await fetch("/api/leaderboard");
    boards = await r.json();
  } catch { /* offline */ }
  if (boards) {
    renderCities($("o-cities"), boards.cities);
    loadBoards();
  } else {
    $("o-cities").innerHTML = "<p class='tiny'>City battle needs connection.</p>";
  }
  refreshMeta();
}

$("btn-join").onclick = async () => {
  const team = $("in-team").value;
  localStorage.setItem("kn_team", team);
  if (!QUESTIONS.length) await loadQuestions();
  if (!QUESTIONS.length) { alert("Questions failed to load. Is the server running?"); return; }
  session += 1;
  state = newRoom({ name: myHandle(), team });
  $("pill-room").textContent = "room: " + pick(ROOM_NAMES);
  show("screen-game");
  playRound();
};
$("btn-again").onclick = () => { session += 1; state = newRoom({ name: myHandle(), team: localStorage.getItem("kn_team") || "Lagos" }); $("pill-room").textContent = "room: " + pick(ROOM_NAMES); show("screen-game"); playRound(); };
$("btn-home").onclick = goHome;
$("btn-quit").onclick = goHome;
$("nav-home").onclick = goHome;
$("nav-brand").onclick = goHome;
$("btn-board").onclick = () => loadBoards();

(async () => {
  $("me-handle").textContent = myHandle();
  $("in-team").value = localStorage.getItem("kn_team") || "Lagos";
  await loadQuestions();
  refreshMeta();
  loadBoards();
})();
