/* Shared pieces for the live auction draft (Draft.html) and the
   commissioner console (Commish.html). ES module. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, get, set, update, remove, push, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

export const C = window.NC_CONFIG;
export const NC = window.NC;
export const D = C.draft;
export const app = initializeApp(C.firebase);
export const db = getDatabase(app);
export { ref, get, set, update, remove, push, onValue };

const esc = NC.esc;

/* Mega Draft styles (kept here so site.css doesn't need to change) */
if (!document.getElementById("mega-draft-css")) {
  const st = document.createElement("style");
  st.id = "mega-draft-css";
  st.textContent = `
    .board--mega thead tr.board__leagues th { color: var(--pitch); font: 700 .85rem/1.6 var(--cond); text-align: center; border-bottom: 2px solid var(--pitch); }
    .board--mega thead th { white-space: nowrap; }
    .board--mega td { min-width: 96px; font-size: .9rem; }
    .draft > * { min-width: 0; }
    @media (min-width: 1000px) { .draft { grid-template-columns: 260px minmax(0, 1fr) 300px; } }
    .league-dot { display: inline-block; width: .55rem; height: .55rem; border-radius: 50%; margin-right: .45rem; vertical-align: .05em; }`;
  document.head.appendChild(st);
}

/* Pools come from config.
   • mode "mega": one pool with every coach, in `teams` order (grouped by league).
   • otherwise:   one pool per league (each league's draftPool) — the old way. */
const coachKey = (t) => t.draftName || t.coach.replace(/\s+/g, "");
const leagueOf = (t) => C.leagues.find((l) => l.id === t.league) || {};
export const MEGA = D.mode === "mega";
export const POOLS = MEGA
  ? { [D.mega?.pool || "Mega"]: { color: D.mega?.color || "#FFD60A", name: D.mega?.name || "Mega Draft", coaches: C.teams.map(coachKey) } }
  : Object.fromEntries(C.leagues.map((l) => [
      l.draftPool,
      { color: l.color, name: l.name, coaches: C.teams.filter((t) => t.league === l.id).map(coachKey) },
    ]));
export const ALL_COACHES = Object.values(POOLS).flatMap((p) => p.coaches).sort((a, b) => a.localeCompare(b));
export const poolColor = (pool) => POOLS[pool]?.color || "#7f8c8d";
/* each coach's home league — used to colour the board and budgets */
export const COACH_LEAGUE = Object.fromEntries(C.teams.map((t) => [coachKey(t), leagueOf(t)]));

export const minRestrictedBid = (price) => Math.ceil(Number(price || 0) * (1 + D.restrictedMarkup));

export function budgets(coaches, players) {
  const out = {};
  coaches.forEach((c) => {
    const spent = Object.values(players || {}).filter((p) => p.team === c && p.price).reduce((s, p) => s + Number(p.price || 0), 0);
    out[c] = D.budget - spent;
  });
  return out;
}

export function renderBudgets(tbody, b, highlight) {
  tbody.innerHTML = Object.entries(b).sort((x, y) => y[1] - x[1]).map(([c, v]) => {
    const l = COACH_LEAGUE[c];
    const dot = MEGA && l?.color ? `<span class="league-dot" style="background:${l.color}" title="${esc(l.name || "")}"></span>` : "";
    return `<tr${c === highlight ? ' class="is-mine"' : ""}><th scope="row">${dot}${esc(c)}</th><td class="num">🟡 ${esc(v)}</td></tr>`;
  }).join("");
}

/* Board: one column per coach, captain rows then sidekick rows.
   In the Mega Draft, columns are grouped under their home league. */
export function renderBoard(host, coaches, players, pool, me) {
  const teams = {};
  Object.entries(players || {}).forEach(([name, p]) => {
    if (!p.team) return;
    const t = teams[p.team] || (teams[p.team] = { c: [], s: [] });
    (p.role === "Captain" ? t.c : t.s).push({ name, ...p });
  });
  const restricted = (p) => p.status === "Restricted" || p.status === "Former Restricted";
  const sorter = (a, b) => (restricted(b) - restricted(a)) || ((a.wonTimestamp || 0) - (b.wonTimestamp || 0));
  Object.values(teams).forEach((t) => { t.c.sort(sorter); t.s.sort(sorter); });
  let rows = "";
  const caps = D.captains ?? 2, total = caps + (D.sidekicks ?? 5);
  for (let r = 0; r < total; r++) {
    rows += `<tr${r === caps ? ' class="split"' : ""}>` + coaches.map((c) => {
      const t = teams[c] || { c: [], s: [] };
      const p = r < caps ? t.c[r] : t.s[r - caps];
      if (!p) return "<td></td>";
      return p.status === "Restricted"
        ? `<td class="is-restricted">${esc(p.name)} <b>${esc(Math.ceil(p.price))}</b></td>`
        : `<td>${esc(p.name)}${p.price ? ` <span class="muted">${esc(p.price)}</span>` : ""}</td>`;
    }).join("") + "</tr>";
  }
  // league group header (Mega Draft only): consecutive coaches from the same league
  let groupRow = "";
  if (MEGA) {
    const groups = [];
    coaches.forEach((c) => {
      const l = COACH_LEAGUE[c] || {};
      const last = groups[groups.length - 1];
      if (last && last.l === l) last.n++; else groups.push({ l, n: 1 });
    });
    groupRow = `<tr class="board__leagues">${groups.map((g) =>
      `<th scope="colgroup" colspan="${g.n}" style="background:${g.l.color || "var(--line)"}">${esc(g.l.short || g.l.name || "")}</th>`).join("")}</tr>`;
  }
  host.innerHTML = `<div class="table-wrap"><table class="table board${MEGA ? " board--mega" : ""}" style="--league:${poolColor(pool)}">
    <thead>${groupRow}<tr>${coaches.map((c) => {
      const col = MEGA ? COACH_LEAGUE[c]?.color : "";
      return `<th scope="col"${c === me ? ' class="is-me"' : ""}${col ? ` style="background:${col}"` : ""}>${esc(c)}</th>`;
    }).join("")}</tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

export function renderCharCounts(host, players) {
  const counts = {};
  Object.values(players || {}).forEach((p) => { const k = p.char || "Unknown"; counts[k] = (counts[k] || 0) + 1; });
  host.innerHTML = `<div class="chars">${D.characters.map((ch) =>
    `<div class="chars__cell${counts[ch] ? "" : " is-out"}"><span>${esc(ch)}</span><strong>${counts[ch] || 0}</strong></div>`).join("")}</div>`;
}

const seenBids = new Set();
export function renderBids(host, data) {
  const all = [];
  for (const coach in data || {}) for (const k in data[coach]) {
    const b = data[coach][k];
    all.push({ coach, bid: Number(b.bid), ts: b.timestamp, id: coach + "_" + k });
  }
  all.sort((a, b) => b.bid - a.bid || a.ts - b.ts);
  host.innerHTML = all.length ? all.map((b, i) => {
    const fresh = !seenBids.has(b.id); seenBids.add(b.id);
    return `<div class="bid${i === 0 ? " is-top" : ""}${fresh ? " is-new" : ""}"><span>${esc(b.coach)}</span><strong>🟡 ${esc(b.bid)}</strong></div>`;
  }).join("") : '<p class="muted">No bids yet.</p>';
  return all;
}
export const clearSeenBids = () => seenBids.clear();

export function renderPlayerCard(host, name, p) {
  if (!p) { host.hidden = true; return; }
  host.hidden = false;
  host.classList.toggle("is-restricted", p.status === "Restricted");
  host.innerHTML = `
    <div class="card__head"><h2>${esc(name)}</h2><span class="muted">${esc([p.role, p.char].filter(Boolean).join(" · "))}</span></div>
    ${p.status === "Restricted" ? `<p class="card__restricted">Restricted to ${esc(p.team || "unknown")} · minimum bid 🟡 ${minRestrictedBid(p.price)}</p>` : ""}
    <dl class="card__stats">
      ${[["Games", p.games], ["Win %", p.winp], ["Goals/game", p.goals], ["MS-SS/game", p.msss], ["SI", p.si], ["Impact", p.impact], ["+/-", p.pm]]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v ?? "–")}</dd></div>`).join("")}
    </dl>`;
}
