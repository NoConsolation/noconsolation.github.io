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

/* Pools come from config: each league's draftPool → its coaches in order. */
export const POOLS = Object.fromEntries(C.leagues.map((l) => [
  l.draftPool,
  { color: l.color, name: l.name, coaches: C.teams.filter((t) => t.league === l.id).map((t) => t.draftName || t.coach.replace(/\s+/g, "")) },
]));
export const ALL_COACHES = Object.values(POOLS).flatMap((p) => p.coaches).sort((a, b) => a.localeCompare(b));
export const poolColor = (pool) => POOLS[pool]?.color || "#7f8c8d";

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
  tbody.innerHTML = Object.entries(b).sort((x, y) => y[1] - x[1]).map(([c, v]) =>
    `<tr${c === highlight ? ' class="is-mine"' : ""}><th scope="row">${esc(c)}</th><td class="num">🟡 ${esc(v)}</td></tr>`).join("");
}

/* Board: one column per coach, 2 captain rows then 5 sidekick rows. */
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
  for (let r = 0; r < 7; r++) {
    rows += `<tr${r === 2 ? ' class="split"' : ""}>` + coaches.map((c) => {
      const t = teams[c] || { c: [], s: [] };
      const p = r < 2 ? t.c[r] : t.s[r - 2];
      if (!p) return "<td></td>";
      return p.status === "Restricted"
        ? `<td class="is-restricted">${esc(p.name)} <b>${esc(Math.ceil(p.price))}</b></td>`
        : `<td>${esc(p.name)}${p.price ? ` <span class="muted">${esc(p.price)}</span>` : ""}</td>`;
    }).join("") + "</tr>";
  }
  host.innerHTML = `<div class="table-wrap"><table class="table board" style="--league:${poolColor(pool)}">
    <thead><tr>${coaches.map((c) => `<th scope="col"${c === me ? ' class="is-me"' : ""}>${esc(c)}</th>`).join("")}</tr></thead>
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
