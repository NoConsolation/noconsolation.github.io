/* Draft room for coaches. Read-only except for placing bids; all draft state
   changes (locking, awarding, timers) happen on the commissioner console. */
import { C, NC, D, db, ref, get, push, onValue, POOLS, ALL_COACHES, poolColor, budgets, renderBudgets,
         renderBoard, renderCharCounts, renderBids, renderPlayerCard, minRestrictedBid } from "./common.js";

const { $, esc, toast } = NC;
const els = {
  coach: $("#coach"), bid: $("#bid"), form: $("#bid-form"), submit: $("#submit"), hint: $("#bid-hint"),
  clock: $("#clock"), rclock: $("#rclock"), rwrap: $("#rclock-wrap"), pool: $("#pool-name"),
  board: $("#board"), chars: $("#chars"), budgets: $("#budgets tbody"), bids: $("#bids"),
  card: $("#player-card"), available: $("#available"),
};

/* --- who am I --- */
let me = "";
try { me = localStorage.getItem("lastCoach") || ""; } catch (_) {}
els.coach.innerHTML = '<option value="">Choose your name</option>' + ALL_COACHES.map((c) => `<option${c === me ? " selected" : ""}>${esc(c)}</option>`).join("");
els.coach.addEventListener("change", () => {
  me = els.coach.value;
  try { localStorage.setItem("lastCoach", me); } catch (_) {}
  refresh();
});

/* --- live state --- */
let pool = null, players = {}, timer = null, selected = null, bidsData = {};
let unsubPlayers = null;

onValue(ref(db, "currentLeague"), (snap) => {
  pool = snap.val();
  els.pool.textContent = pool ? `${POOLS[pool]?.name || pool} draft` : "Waiting for the commissioner";
  document.documentElement.style.setProperty("--league", poolColor(pool));
  if (unsubPlayers) unsubPlayers();
  if (!pool) return;
  unsubPlayers = onValue(ref(db, `players/${pool}`), (s) => { players = s.val() || {}; refresh(); });
});
onValue(ref(db, "selectedPlayer"), (s) => { selected = s.val(); refresh(); });
onValue(ref(db, "bids"), (s) => { bidsData = s.val() || {}; renderBids(els.bids, bidsData); });
onValue(ref(db, "timer"), (s) => { timer = s.val(); tick(); });

function refresh() {
  const coaches = POOLS[pool]?.coaches || [];
  renderBoard(els.board, coaches, players, pool, me);
  renderCharCounts(els.chars, Object.fromEntries(Object.entries(players).filter(([, p]) => p.status !== "Locked")));
  renderBudgets(els.budgets, budgets(coaches, players), me);
  const avail = Object.entries(players).filter(([, p]) => !p.team).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  els.available.innerHTML = avail.map(([n, p]) => `<li${selected?.name === n ? ' class="is-on"' : ""}>${esc(n)} <span class="muted">${esc(p.role || "")}</span></li>`).join("") || '<li class="muted">Everyone is drafted.</li>';
  const sp = selected && selected.league === pool ? players[selected.name] : null;
  renderPlayerCard(els.card, selected?.name, sp);
  hint();
}

/* --- timer display --- */
setInterval(tick, 250);
function tick() {
  const running = timer?.running;
  const elapsed = running ? Math.floor((Date.now() - timer.startTime) / 1000) : 0;
  const left = running ? Math.max(0, D.countdownSeconds - elapsed) : D.countdownSeconds;
  els.clock.textContent = left;
  els.clock.classList.toggle("is-low", running && left <= 10);
  const sp = selected ? players[selected.name] : null;
  const anyBid = Object.values(bidsData).some((b) => Object.keys(b || {}).length);
  const showR = running && sp?.status === "Restricted" && !anyBid;
  els.rwrap.hidden = !showR;
  if (showR) els.rclock.textContent = Math.max(0, D.restrictedWindowSeconds - elapsed) + "s";
  els.submit.disabled = !(running && left > 0);
}

function hint() {
  if (!me) { els.hint.textContent = "Choose your name to bid."; return; }
  const coaches = POOLS[pool]?.coaches || [];
  const left = budgets([me], players)[me];
  const sp = selected ? players[selected.name] : null;
  const parts = [];
  if (pool && !coaches.includes(me)) parts.push(`You're not listed in the ${POOLS[pool]?.name || pool} pool.`);
  parts.push(`Budget left: 🟡 ${left}`);
  if (sp?.status === "Restricted") parts.push(`Minimum bid 🟡 ${minRestrictedBid(sp.price)}`);
  els.hint.textContent = parts.join(" · ");
}

/* --- bidding --- */
els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!me) { toast("Choose your name first", "error"); els.coach.focus(); return; }
  const bid = Number(els.bid.value);
  if (els.bid.value === "" || !Number.isFinite(bid) || bid < 0) { toast("Enter a bid", "error"); return; }
  try {
    const sel = (await get(ref(db, "selectedPlayer"))).val();
    if (!sel) { toast("No player is up yet", "error"); return; }
    const p = (await get(ref(db, `players/${sel.league}/${sel.name}`))).val();
    if (!p) { toast("That player wasn't found", "error"); return; }
    if (p.status === "Restricted" && bid < minRestrictedBid(p.price)) {
      toast(`Restricted player: minimum bid is ${minRestrictedBid(p.price)}`, "error"); return;
    }
    const left = budgets([me], players)[me];
    if (bid > left) { toast(`That's more than your remaining budget (${left})`, "error"); return; }
    await push(ref(db, `bids/${me}`), { bid, timestamp: Date.now() });
    els.form.reset();
    els.bid.focus();
  } catch (err) {
    console.error(err);
    toast("Bid didn't go through. Try again.", "error");
  }
});
