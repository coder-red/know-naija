// Lagos Life API adapter (STUB).
// The Lagos Life third-party API is announced but not published (as of Oct 2026).
// Build the game standalone now; plug these functions in when specs drop.
// Expected surface (guess, keep isolated):
//   - auth: verify Lagos Life player token -> { id, nickname, avatar }
//   - wallet: read/spend/award virtual naira (NO cash-out — terms forbid it)
//   - presence: join in-world room / lobby billboard
//   - leaderboard: push scores to Lagos Life boards
const adapter = {
  mode: "standalone",
  async verifyPlayer(token) {
    void token;
    return null; // TODO: call Lagos Life /auth/verify when docs land
  },
  async awardNaira(playerId, amount) {
    void playerId; void amount;
    return { ok: false, reason: "lagos-life-api-not-connected" };
  },
  async pushScore(entry) {
    void entry;
    return { ok: false, reason: "lagos-life-api-not-connected" };
  },
};

module.exports = adapter;
