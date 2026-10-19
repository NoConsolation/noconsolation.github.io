/* Commissioner console. Requires Google sign-in; the database rules decide
   who can actually write. Draft controls behave exactly like the old page. */
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { C, NC, D, app, db, ref, get, set, update, remove, onValue, POOLS, poolColor, budgets, renderBudgets,
         renderBoard, renderCharCounts, renderBids, clearSeenBids, renderPlayerCard, minRestrictedBid } from "./common.js";

const { $, $$, esc, toast } = NC;
const auth = getAuth(app);
const gate = $("#gate"), consoleEl = $("#console");

/* ---------------- auth gate ---------------- */
$("#sign-in").addEventListener("click", () =>
  signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => toast("Sign-in failed: " + e.message, "error")));
$("#sign-out").addEventListener("click", () => signOut(auth));

let started = false;
onAuthStateChanged(auth, (user) => {
  const admins = (C.admins || []).map((a) => a.toLowerCase());
  const allowed = user && (admins.length === 0 || admins.includes((user.email || "").toLowerCase()));
  $("#who").textContent = user ? user.email : "";
  $("#gate-msg").innerHTML = user && !allowed
    ? `<p class="note note--error">${esc(user.email)} isn't on the commissioner list. Ask an admin to add you in config.js and the database.</p>` : "";
  $("#admin-warning").hidden = admins.length > 0;
  gate.hidden = !!allowed;
  consoleEl.hidden = !allowed;
  if (allowed && !started) { started = true; start(); }
});

/* ---------------- console ---------------- */
function start() {
  const els = {
    pool: $("#pool"), list: $("#player-list"), budgets: $("#budgets tbody"), bids: $("#bids"),
    board: $("#board"), chars: $("#chars"), card: $("#player-card"),
    clock: $("#clock"), rclock: $("#rclock"), rwrap: $("#rclock-wrap"),
    start: $("#start"), award: $("#award"), clear: $("#clear-bids"), stop: $("#stop"),
  };
  let pool = null, players = {}, selected = null, timer = null, bidsData = {}, unsub = null;

  els.pool.innerHTML = '<option value="">No draft running</option>' +
    Object.entries(POOLS).map(([k, p]) => `<option value="${esc(k)}">${esc(p.name)} (${esc(k)})</option>`).join("");
  els.pool.addEventListener("change", () => guard(set(ref(db, "currentLeague"), els.pool.value)));

  onValue(ref(db, "currentLeague"), (s) => {
    pool = s.val();
    els.pool.value = pool || "";
    document.documentElement.style.setProperty("--league", poolColor(pool));
    if (unsub) unsub();
    players = {};
    if (pool) unsub = onValue(ref(db, `players/${pool}`), (x) => { players = x.val() || {}; refresh(); });
    refresh();
  });
  onValue(ref(db, "selectedPlayer"), (s) => { selected = s.val(); refresh(); });
  onValue(ref(db, "bids"), (s) => { bidsData = s.val() || {}; renderBids(els.bids, bidsData); });
  onValue(ref(db, "timer"), (s) => { timer = s.val(); });

  function refresh() {
    const coaches = POOLS[pool]?.coaches || [];
    const available = Object.entries(players).filter(([, p]) => p.status !== "Locked").sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
    els.list.innerHTML = available.map(([n, p]) => `<li><button class="pick${selected?.name === n ? " is-on" : ""}" data-name="${esc(n)}">
      ${esc(n)} <span class="muted">${esc([p.role, p.status === "Restricted" ? "Restricted" : ""].filter(Boolean).join(" · "))}</span></button></li>`).join("")
      || '<li class="muted">No players available.</li>';
    renderBudgets(els.budgets, budgets(coaches, players));
    renderBoard(els.board, coaches, players, pool);
    renderCharCounts(els.chars, Object.fromEntries(available));
    renderPlayerCard(els.card, selected?.name, selected && selected.league === pool ? players[selected.name] : null);
    els.start.disabled = !selected || selected.league !== pool;
  }

  els.list.addEventListener("click", (e) => {
    const b = e.target.closest(".pick"); if (!b || !pool) return;
    guard(set(ref(db, "selectedPlayer"), { league: pool, name: b.dataset.name }));
  });

  els.start.addEventListener("click", () => {
    if (!selected) return;
    guard(set(ref(db, "timer"), { league: pool, player: selected.name, startTime: Date.now(), running: true }));
  });
  els.stop.addEventListener("click", () => guard(update(ref(db, "timer"), { running: false })));

  /* award to highest bid (earliest wins ties), log to Sheets, clear bids */
  els.award.addEventListener("click", async () => {
    if (!pool) return;
    els.award.disabled = true; els.award.querySelector("span").textContent = "Saving…";
    try {
      const drafts = (await get(ref(db, "bids"))).val() || {};
      let hi = -Infinity, winner = null, ts = Infinity;
      const all = [];
      for (const coach in drafts) for (const k in drafts[coach]) {
        const v = Number(drafts[coach][k].bid), t = drafts[coach][k].timestamp;
        all.push({ coach, bid: drafts[coach][k].bid });
        if (v > hi || (v === hi && t < ts)) { hi = v; winner = coach; ts = t; }
      }
      if (!winner) throw new Error("There are no bids to award.");
      const sel = (await get(ref(db, "selectedPlayer"))).val();
      if (!sel) throw new Error("No player is selected.");
      if (!confirm(`Award ${sel.name} to ${winner} for ${hi}?`)) return;
      await update(ref(db, `players/${pool}/${sel.name}`), { team: winner, status: "Locked", price: hi, wonTimestamp: Date.now() });
      fetch(D.saveEndpoint, { method: "POST", body: JSON.stringify({ league: pool, player: { name: sel.name, role: players[sel.name]?.role || sel.role }, bids: all }) })
        .then((r) => r.text()).then(console.log).catch(console.error);
      await remove(ref(db, "bids"));
      await remove(ref(db, "selectedPlayer"));
      await update(ref(db, "timer"), { running: false });
      clearSeenBids();
      toast(`${sel.name} → ${winner} for ${hi}`);
    } catch (err) {
      toast(err.message || String(err), "error");
    } finally {
      els.award.disabled = false; els.award.querySelector("span").textContent = "Award to top bid";
    }
  });

  els.clear.addEventListener("click", async () => {
    if (!confirm("Clear all bids?")) return;
    await guard(remove(ref(db, "bids")));
    clearSeenBids();
  });

  /* clock + restricted-player logic (runs only here, once) */
  let busy = false;
  setInterval(async () => {
    const running = timer?.running;
    const elapsed = running ? Math.floor((Date.now() - timer.startTime) / 1000) : 0;
    const left = running ? Math.max(0, D.countdownSeconds - elapsed) : D.countdownSeconds;
    els.clock.textContent = left;
    els.clock.classList.toggle("is-low", running && left <= 10);
    const sel = selected, p = sel ? players[sel.name] : null;
    if (!running || !p || p.status !== "Restricted") { els.rwrap.hidden = true; return; }

    let highest = 0;
    for (const c in bidsData) for (const k in bidsData[c]) highest = Math.max(highest, Number(bidsData[c][k].bid));
    const rLeft = Math.max(0, D.restrictedWindowSeconds - elapsed);
    els.rwrap.hidden = false;
    els.rclock.textContent = rLeft + "s";
    if (busy) return;
    if (highest >= minRestrictedBid(p.price)) {
      busy = true;
      await guard(update(ref(db, `players/${sel.league}/${sel.name}`), { status: "Free", team: "", price: "" }));
      busy = false;
    } else if (rLeft === 0 && highest === 0) {
      busy = true;
      await guard(update(ref(db, `players/${sel.league}/${sel.name}`), { status: "Locked" }));
      await guard(update(ref(db, "timer"), { running: false }));
      busy = false;
    }
  }, 500);

  /* ---------------- stream times ---------------- */
  const sHost = $("#stream-times");
  sHost.innerHTML = C.leagues.map((l) => `
    <form class="panel stream-form" style="--league:${l.color}" data-key="${esc(l.streamKey)}">
      <h3 class="panel__title">${esc(l.name)}</h3>
      <p class="panel__sub" data-current>Loading…</p>
      <div class="form-grid">
        <label class="field"><span>Day</span><select name="day"><option value="">–</option>${
          ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => `<option>${d}</option>`).join("")}</select></label>
        <label class="field"><span>Date</span><input type="date" name="date"></label>
        <label class="field"><span>Time</span><input type="time" name="time"></label>
      </div>
      <div class="form-actions"><button class="btn btn--small" type="submit"><span>Save</span></button>
        <button class="btn btn--ghost btn--small" type="button" data-clear>Set to TBD</button></div>
    </form>`).join("");
  $$(".stream-form", sHost).forEach((f) => {
    const key = f.dataset.key;
    onValue(ref(db, `stream_times/${key}`), (s) => {
      const v = s.val();
      f.querySelector("[data-current]").textContent = "Showing on site: " + (NC.formatStream(v) || "TBD");
      if (v) { f.day.value = v.day || ""; f.date.value = /^\d{4}-\d{2}-\d{2}/.test(v.date || "") ? v.date.slice(0, 10) : ""; f.time.value = /^\d{1,2}:\d{2}$/.test(v.time || "") ? v.time.padStart(5, "0") : ""; }
    });
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      let day = f.day.value;
      if (!day && f.date.value) { const [y, m, d] = f.date.value.split("-").map(Number); day = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" }); }
      guard(set(ref(db, `stream_times/${key}`), { day, date: f.date.value, time: f.time.value }).then(() => toast("Stream time saved")));
    });
    f.querySelector("[data-clear]").addEventListener("click", () => guard(remove(ref(db, `stream_times/${key}`))));
  });

  /* tabs */
  $$("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    $$("[data-tab]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $$("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.tab; });
  }));
}

async function guard(promise) {
  try { return await promise; }
  catch (err) {
    console.error(err);
    toast(/permission/i.test(err.message) ? "Permission denied: your account isn't an admin in the database rules." : err.message, "error");
  }
}
