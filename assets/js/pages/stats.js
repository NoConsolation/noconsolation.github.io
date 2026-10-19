/* Stats: full sortable player table + team totals, from Firebase p_stats. */
(function () {
  const { C, esc, $, $$, message, myTeam } = window.NC;

  const STATS = [
    { key: "games", label: "Games", short: "GP" },
    { key: "goals", label: "Goals", short: "G" },
    { key: "goalspergame", label: "Goals/game", short: "G/GP" },
    { key: "wins", label: "Wins", short: "W" },
    { key: "winper", label: "Win %", short: "W%" },
    { key: "msss", label: "Megastrikes", short: "MS" },
    { key: "ssa", label: "Skill shot assists", short: "SSA" },
    { key: "si", label: "Strikers Index", short: "SI" },
    { key: "impact", label: "Impact", short: "IMP" },
    { key: "plusminus", label: "+/-", short: "+/-" },
  ];

  const state = { view: "players", sort: "goals", dir: -1, league: "", role: "", team: "", q: "" };
  let players = [];

  const num = (v) => {
    if (v === null || v === undefined || v === "") return NaN;
    return parseFloat(String(v).replace("%", ""));
  };

  /* view tabs */
  $$("[data-view]").forEach((b) => b.addEventListener("click", () => {
    state.view = b.dataset.view;
    $$("[data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $("#player-filters").hidden = state.view !== "players";
    render();
  }));

  ["league", "role", "team"].forEach((k) => $("#f-" + k).addEventListener("change", (e) => { state[k] = e.target.value; render(); }));
  $("#f-q").addEventListener("input", (e) => { state.q = e.target.value.trim().toLowerCase(); render(); });

  fetch(`${C.firebase.databaseURL}/p_stats.json`)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      players = Object.entries(data || {}).map(([name, s]) => ({ name, ...s }));
      if (!players.length) { message($("#stats"), "No stats yet this season.", "info"); return; }
      fill("#f-league", [...new Set(players.map((p) => p.league).filter(Boolean))].sort());
      fill("#f-team", [...new Set(players.map((p) => p.team).filter(Boolean))].sort());
      render();
    })
    .catch(() => message($("#stats"), "Stats didn't load. Refresh to try again.", "error"));

  function fill(sel, values) {
    $(sel).insertAdjacentHTML("beforeend", values.map((v) => `<option>${esc(v)}</option>`).join(""));
  }

  function sortRows(rows, key) {
    return rows.sort((a, b) => {
      const x = num(a[key]), y = num(b[key]);
      if (!isNaN(x) || !isNaN(y)) return ((isNaN(x) ? -Infinity : x) - (isNaN(y) ? -Infinity : y)) * state.dir;
      return String(a[key] ?? "").localeCompare(String(b[key] ?? "")) * state.dir;
    });
  }

  function header(cols, first) {
    return `<thead><tr><th scope="col">${first}</th>${cols.map((c) => {
      const on = state.sort === c.key;
      return `<th scope="col" class="num" aria-sort="${on ? (state.dir < 0 ? "descending" : "ascending") : "none"}">
        <button class="sort${on ? " is-on" : ""}" data-sort="${c.key}" title="${esc(c.label)}">${esc(c.short)}${on ? (state.dir < 0 ? " ▾" : " ▴") : ""}</button></th>`;
    }).join("")}</tr></thead>`;
  }

  function render() {
    const host = $("#stats");
    if (!players.length) return;
    if (state.view === "players") {
      if (!STATS.some((c) => c.key === state.sort)) state.sort = "goals";
      const rows = sortRows(players.filter((p) =>
        (!state.league || p.league == state.league) &&
        (!state.role || p.role == state.role) &&
        (!state.team || p.team == state.team) &&
        (!state.q || p.name.toLowerCase().includes(state.q))), state.sort);
      $("#count").textContent = `${rows.length} player${rows.length === 1 ? "" : "s"}`;
      host.innerHTML = `<div class="table-wrap stats-wrap"><table class="table table--stats">${header(STATS, "Player")}<tbody>${
        rows.map((p) => `<tr${myTeam.is(p.team) ? ' class="is-mine"' : ""}><th scope="row">${esc(p.name)}<small>${esc([p.role, p.team].filter(Boolean).join(" · "))}</small></th>${
          STATS.map((c) => `<td class="num">${esc(fmt(p[c.key]))}</td>`).join("")}</tr>`).join("")
      }</tbody></table></div>`;
    } else {
      const teams = {};
      players.forEach((p) => {
        if (!p.team) return;
        const t = teams[p.team] || (teams[p.team] = { name: p.team, league: p.league, players: 0, goals: 0, msss: 0, ssa: 0, si: [], impact: [], plusminus: 0 });
        t.players++;
        ["goals", "msss", "ssa", "plusminus"].forEach((k) => { const v = num(p[k]); if (!isNaN(v)) t[k] += v; });
        ["si", "impact"].forEach((k) => { const v = num(p[k]); if (!isNaN(v)) t[k].push(v); });
      });
      const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
      const list = Object.values(teams).map((t) => ({ ...t, si: avg(t.si), impact: avg(t.impact) }));
      const cols = [
        { key: "players", label: "Players used", short: "Players" },
        { key: "goals", label: "Goals (sum)", short: "G" },
        { key: "msss", label: "Megastrikes (sum)", short: "MS" },
        { key: "ssa", label: "Skill shot assists (sum)", short: "SSA" },
        { key: "si", label: "Strikers Index (avg)", short: "SI avg" },
        { key: "impact", label: "Impact (avg)", short: "IMP avg" },
        { key: "plusminus", label: "+/- (sum)", short: "+/-" },
      ];
      if (!cols.some((c) => c.key === state.sort)) state.sort = "goals";
      sortRows(list, state.sort);
      $("#count").textContent = `${list.length} teams · totals and averages from player stats`;
      host.innerHTML = `<div class="table-wrap stats-wrap"><table class="table table--stats">${header(cols, "Team")}<tbody>${
        list.map((t) => `<tr${myTeam.is(t.name) ? ' class="is-mine"' : ""}><th scope="row">${esc(t.name)}<small>${esc(t.league || "")}</small></th>${
          cols.map((c) => `<td class="num">${esc(fmt(t[c.key]))}</td>`).join("")}</tr>`).join("")
      }</tbody></table></div>`;
    }
    $$(".sort", host).forEach((b) => b.addEventListener("click", () => {
      if (state.sort === b.dataset.sort) state.dir *= -1; else { state.sort = b.dataset.sort; state.dir = -1; }
      render();
    }));
  }

  function fmt(v) {
    if (v === undefined || v === null || v === "") return "–";
    if (typeof v === "number" && !Number.isInteger(v)) return v.toFixed(2);
    return v;
  }
})();
