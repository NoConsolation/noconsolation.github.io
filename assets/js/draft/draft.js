/* Draft room for coaches. Read-only except for placing bids; all draft state
   changes (locking, awarding, timers) happen on the commissioner console. */
import { C, NC, D, db, ref, get, push, onValue, POOLS, ALL_COACHES, poolColor, budgets, renderBudgets,
         renderBoard, renderCharCounts, renderBids, renderPlayerCard, minRestrictedBid, watchPlayers, playerPath } from "./common.js";

const { $, esc, toast } = NC;
const els = {
  coach: $("#coach"), bid: $("#bid"), form: $("#bid-form"), submit: $("#submit"), hint: $("#bid-hint"),
  clock: $("#clock"), rclock: $("#rclock"), rwrap: $("#rclock-wrap"), pool: $("#pool-name"),
  board: $("#board"), chars: $("#chars"), budgets: $("#budgets tbody"), bids: $("#bids"),
  card: $("#player-card"), available: $("#available"),
};

/* --- sticky mini bar for phones: clock, player up, top bid --- */
const mini = document.createElement("button");
mini.type = "button";
mini.className = "draft-mini";
mini.setAttribute("aria-label", "Jump to bidding");
mini.innerHTML = `
  <span class="draft-mini__clock" data-clock>–</span>
  <span class="draft-mini__who"><strong data-name>Waiting for a player</strong><small data-meta></small></span>
  <span class="draft-mini__bid"><small>Top bid</small><strong data-top>–</strong></span>`;
document.body.appendChild(mini);
mini.addEventListener("click", () => {
  els.form.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => els.bid.focus({ preventScroll: true }), 350);
});
const miniStyle = document.createElement("style");
miniStyle.textContent = `
  .draft-mini { display: none; }
  @media (max-width: 999px) {
    .draft-mini {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 60;
      display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .8rem;
      padding: .55rem 1rem calc(.55rem + env(safe-area-inset-bottom)); border: 0; text-align: left; cursor: pointer;
      color: var(--text); background: rgba(26, 18, 64, .96); border-top: 2px solid var(--league, var(--volt));
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); font: inherit;
      box-shadow: 0 -8px 24px rgba(0, 0, 0, .35);
    }
    body { padding-bottom: calc(76px + env(safe-area-inset-bottom)); }
    #toasts { bottom: calc(86px + env(safe-area-inset-bottom)); }
  }
  .draft-mini__clock {
    min-width: 3.3rem; padding: .3rem .4rem; text-align: center; font: 400 1.9rem/1 var(--display);
    border: 2px solid var(--red); background: var(--panel); color: #fff;
  }
  .draft-mini__clock.is-low { color: var(--red); animation: pulse .8s infinite; }
  .draft-mini__clock.is-restricted { border-color: var(--sky); }
  .draft-mini__clock.is-idle { color: var(--muted); border-color: var(--line); }
  .draft-mini__who { min-width: 0; display: grid; }
  .draft-mini__who strong { font: 700 1.05rem/1.2 var(--cond); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .draft-mini__who small { color: var(--muted); font-size: .85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .draft-mini__bid { display: grid; text-align: right; }
  .draft-mini__bid small { color: var(--muted); font-size: .75rem; }
  .draft-mini__bid strong { font: 700 1.15rem/1.1 var(--cond); color: var(--volt); white-space: nowrap; }`;
document.head.appendChild(miniStyle);
const miniEl = (k) => mini.querySelector(`[data-${k}]`);

function updateMini() {
  const sp = selected && players[selected.name];
  miniEl("name").textContent = sp ? selected.name : "Waiting for a player";
  miniEl("meta").textContent = sp
    ? [sp.char, sp.role, sp.status === "Restricted" ? `Restricted · min 🟡 ${minRestrictedBid(sp.price)}` : ""].filter(Boolean).join(" · ")
    : "";
  let top = null;
  for (const c in bidsData) for (const k in bidsData[c]) {
    const b = bidsData[c][k];
    if (!top || Number(b.bid) > top.bid || (Number(b.bid) === top.bid && b.timestamp < top.ts)) top = { coach: c, bid: Number(b.bid), ts: b.timestamp };
  }
  miniEl("top").textContent = top ? `${top.bid} · ${top.coach}` : "–";
}

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
  els.pool.textContent = pool ? (/draft$/i.test(POOLS[pool]?.name || "") ? POOLS[pool].name : `${POOLS[pool]?.name || pool} draft`) : "Waiting for the commissioner";
  document.documentElement.style.setProperty("--league", poolColor(pool));
  if (unsubPlayers) unsubPlayers();
  if (!pool) return;
  unsubPlayers = watchPlayers(pool, (p) => { players = p; refresh(); });
});
onValue(ref(db, "selectedPlayer"), (s) => { selected = s.val(); refresh(); });
onValue(ref(db, "bids"), (s) => { bidsData = s.val() || {}; renderBids(els.bids, bidsData); updateMini(); });
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
  updateMini();
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
  const mc = miniEl("clock");
  mc.textContent = running ? left : "–";
  mc.classList.toggle("is-low", running && left <= 10);
  mc.classList.toggle("is-idle", !running);
  mc.classList.toggle("is-restricted", showR);
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
    const p = (await get(ref(db, playerPath(sel.league, sel.name)))).val();
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