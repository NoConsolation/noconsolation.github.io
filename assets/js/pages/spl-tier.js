/* Strikers Premier League — the championship tier.
   Used by spl.html (current season) and season.html?s=N. Renders only if the
   season in config.js has an `spl` block. Reads ONLY the cells listed there
   (A1 notation, e.g. "K9:N20"), so leftover cells elsewhere on the tab never
   show up on the site. */
(function () {
  const { C, esc, $, season, csvUrl, loadSheet, message, myTeam } = window.NC;

  const isHistory = document.body.dataset.page === "season";
  const n = isHistory ? Number(new URLSearchParams(location.search).get("s")) : C.currentSeason;
  const s = season(n);
  const host = $("#spl-tier");
  if (!host || !s || !s.spl) return;
  const cfg = s.spl;

  /* ---------- A1 helpers ---------- */
  const colIndex = (letters) =>
    [...letters.toUpperCase()].reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
  const ref = (a1) => {
    const m = /^([A-Z]+)(\d+)$/i.exec(String(a1).trim());
    if (!m) throw new Error("Bad cell reference in config.js: " + a1);
    return { r: Number(m[2]) - 1, c: colIndex(m[1]) };
  };
  const cell = (rows, a1) => { const { r, c } = ref(a1); return (rows[r]?.[c] ?? "").trim(); };
  const range = (rows, a1range) => {
    const [a, b] = a1range.split(":").map(ref);
    const out = [];
    for (let r = a.r; r <= b.r; r++) {
      const line = [];
      for (let c = a.c; c <= b.c; c++) line.push((rows[r]?.[c] ?? "").trim());
      out.push(line);
    }
    return out;
  };
  const num = (v) => (v === "" || isNaN(Number(v)) ? null : Number(v));

  /* Games actually played: both scores present, and nothing after a team clinches
     (hidden zeros in an unplayed game 3 are ignored). */
  function playedGames(a, b, bestOf) {
    const need = Math.ceil(bestOf / 2);
    const games = [];
    let wa = 0, wb = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (wa >= need || wb >= need) break;
      const x = num(a[i]), y = num(b[i]);
      if (x === null || y === null) continue;
      games.push([x, y]);
      if (x > y) wa++; else if (y > x) wb++;
    }
    return { games, wins: [wa, wb], decided: wa >= need || wb >= need };
  }

  function readSeries(rows, def) {
    const names = def.teams.map((t) => cell(rows, t.name));
    const scores = def.teams.map((t) => range(rows, t.games)[0]);
    const { games, wins, decided } = playedGames(scores[0], scores[1], def.bestOf);
    const winnerCell = def.winner ? cell(rows, def.winner) : "";
    return {
      title: def.title ? cell(rows, def.title) : "",
      teams: names.map((name, i) => ({
        name, wins: wins[i], games: games.map((g) => g[i]),
        seed: def.teams[i].seed ? cell(rows, def.teams[i].seed) : "",
      })),
      winner: winnerCell || (decided ? names[wins[0] > wins[1] ? 0 : 1] : ""),
      decided: decided || !!winnerCell,
    };
  }

  function readAll(rows) {
    const st = range(rows, cfg.standings);
    const [header, ...body] = st;
    const standings = { header, rows: body.filter((r) => r[0]) };

    const blk = range(rows, cfg.groupSeries.range);
    const groupSeries = [];
    for (let i = 0; i + 1 < blk.length; i += 2) {
      const ta = blk[i], tb = blk[i + 1];
      if (!ta[0] || !tb[0]) continue;
      const { games, wins, decided } = playedGames(ta.slice(1), tb.slice(1), cfg.groupSeries.bestOf);
      groupSeries.push({
        teams: [{ name: ta[0], wins: wins[0], games: games.map((g) => g[0]) },
                { name: tb[0], wins: wins[1], games: games.map((g) => g[1]) }],
        decided,
      });
    }
    return {
      standings, groupSeries,
      playIn: cfg.playIn ? readSeries(rows, cfg.playIn) : null,
      finals: cfg.finals ? readSeries(rows, cfg.finals) : null,
    };
  }

  /* ---------- rendering ---------- */
  const SHORT = { Team: "Team", "Series Wins": "SW", "Series Losses": "SL", "Game Diff": "GmD", Points: "Pts", "Goal Diff": "GD" };

  function standingsHTML(st) {
    const th = st.header.map((h, i) =>
      `<th scope="col"${i ? ' class="num"' : ""}><span class="full">${esc(h)}</span><span class="short" aria-hidden="true">${esc(SHORT[h] || h.slice(0, 3))}</span></th>`).join("");
    const tr = st.rows.map((r, i) => `<tr${myTeam.is(r[0]) ? ' class="is-mine"' : ""}${i === 0 ? ' data-top="1"' : ""}>${
      r.map((v, j) => j === 0
        ? `<th scope="row"><span class="rank">${i + 1}</span>${esc(v)}</th>`
        : `<td class="num">${esc(v)}</td>`).join("")}</tr>`).join("");
    return `<section class="panel standings spl-panel">
      <h3 class="panel__title">Standings</h3>
      <div class="table-wrap"><table class="table table--standings">
        <thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>
    </section>`;
  }

  function seriesCard(sr, { label = "", showSeed = false, big = false, cols = 0, header = false } = {}) {
    const n = Math.max(1, cols, ...sr.teams.map((t) => t.games.length));
    const grid = `--n:${n}`;
    const winIdx = sr.decided ? (sr.teams[0].wins > sr.teams[1].wins ? 0 : 1) : -1;
    const row = (t, i) => {
      const o = sr.teams[1 - i];
      return `<div class="match__team${i === winIdx ? " is-win" : ""}${myTeam.is(t.name) ? " is-mine" : ""}" style="${grid}">
        <span class="match__name">${showSeed && t.seed ? `<span class="spl-seed">${esc(t.seed)}</span>` : ""}${esc(t.name)}</span>
        ${Array.from({ length: n }, (_, g) => {
          const v = t.games[g], w = o.games[g];
          return `<span class="match__g${v != null && w != null && v > w ? " is-high" : ""}">${v ?? ""}</span>`;
        }).join("")}
        <span class="spl-wins">${t.wins}</span>
      </div>`;
    };
    return `<article class="match spl-match${big ? " spl-match--big" : ""}${sr.decided ? " is-done" : ""}">
      ${label ? `<header class="spl-match__label">${esc(label)}</header>` : ""}
      ${header ? `<div class="spl-match__head" style="${grid}" aria-hidden="true"><span></span>${
        Array.from({ length: n }, (_, g) => `<span>G${g + 1}</span>`).join("")}<span>W</span></div>` : ""}
      ${row(sr.teams[0], 0)}${row(sr.teams[1], 1)}
    </article>`;
  }

  function render(d) {
    const champ = d.finals && d.finals.decided ? d.finals.winner : "";
    host.innerHTML = `
      <div class="spl-head">
        <p class="spl-kicker">${esc(s.label)} · Championship tier</p>
        <h2 class="spl-title">${esc(cfg.name || "Strikers Premier League")}</h2>
      </div>
      ${champ ? `<div class="spl-champ" role="status">
        <span class="spl-champ__trophy" aria-hidden="true">🏆</span>
        <div><span class="spl-champ__label">${esc(s.label)} champions</span>
        <strong class="spl-champ__name">${esc(champ)}</strong></div></div>` : ""}

      <div class="grid grid--2 spl-grid">
        ${standingsHTML(d.standings)}
        <section class="panel spl-panel">
          <h3 class="panel__title">Playoffs</h3>
          ${d.playIn ? `<h4 class="spl-sub">${esc(d.playIn.title || "Play-in")}</h4>${seriesCard(d.playIn, { header: true })}` : ""}
          ${d.finals ? `<h4 class="spl-sub">${esc(d.finals.title || "Grand Finals")}</h4>${seriesCard(d.finals, { showSeed: true, big: true, header: true })}` : ""}
        </section>
      </div>

      ${d.groupSeries.length ? `<h3 class="spl-sub spl-sub--section">Group stage</h3>
      <div class="matches spl-matches">${d.groupSeries.map((sr) => seriesCard(sr, { cols: cfg.groupSeries.bestOf })).join("")}</div>` : ""}`;
    host.hidden = false;
  }

  host.hidden = false;
  host.innerHTML = `<div class="skeleton"></div>`;
  loadSheet(csvUrl(cfg.sheet || s.sheet, cfg.gid), (rows) => {
    try { render(readAll(rows)); }
    catch (e) { console.error(e); message(host, "The SPL table couldn't be read. Check the cell ranges under `spl` in config.js.", "error"); }
  }, () => message(host, "The SPL table didn't load. Check that the sheet is still published to the web, then refresh.", "error"));
  // "My team" changes reload the page via league.js, which every SPL page also loads.
})();
