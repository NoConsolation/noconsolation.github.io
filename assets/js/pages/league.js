/* League page — used by spl.html (current season) and season.html?s=N. */
(function () {
  const { C, esc, $, $$, season, leagueById, csvUrl, htmlUrl, loadSheet, block, message,
          standingsTable, parseSchedule, matchCard, fillStreamTimes, myTeamPicker, teamByName } = window.NC;

  const isHistory = document.body.dataset.page === "season";
  const n = isHistory ? Number(new URLSearchParams(location.search).get("s")) : C.currentSeason;
  const s = season(n);

  const els = {
    title: $("#season-title"),
    standings: $("#standings"),
    legend: $("#legend"),
    bracket: $("#bracket"),
    schedule: $("#schedule"),
    filters: $("#league-filters"),
    coaches: $("#coaches"),
    extra: $("#extra-links"),
    tools: $("#tools"),
  };

  if (!s) {
    els.title.textContent = "Season not found";
    message(els.standings, "That season isn't in config.js yet. Pick one from the History menu.", "warn");
    ["schedule", "coaches"].forEach((k) => els[k] && (els[k].innerHTML = ""));
    return;
  }

  document.title = `${s.label} · No Consolation`;
  els.title.textContent = isHistory ? s.label : `${s.label} standings`;
  if (els.tools && !isHistory) els.tools.appendChild(myTeamPicker());

  /* ---------- standings ---------- */
  loadSheet(csvUrl(s.sheet, s.gids.standings), (rows) => {
    els.standings.innerHTML = s.standings.tables.map((def) => standingsTable(rows, def, s)).join("");
    if (!isHistory) fillStreamTimes(els.standings);
    if (s.standings.cutLines?.length && els.legend) {
      els.legend.innerHTML = `<span><i style="background:var(--go)"></i>Line under ${ordinal(s.standings.cutLines[0])} place</span>` +
        (s.standings.cutLines[1] ? `<span><i style="background:var(--red)"></i>Line under ${ordinal(s.standings.cutLines[1])} place</span>` : "");
    }
    if (!isHistory) renderCoachesFromTeams();
  }, () => message(els.standings, "Standings didn't load. Check that the sheet is still published to the web, then refresh.", "error"));

  /* ---------- bracket ---------- */
  if (s.bracket && els.bracket) {
    const b = s.bracket;
    const src = htmlUrl(b.sheet || s.sheet, b.gid, b.widget);
    els.bracket.hidden = false;
    els.bracket.innerHTML = `
      <div class="row row--between"><h2>Playoff bracket</h2>
        <a class="btn btn--ghost btn--small" href="${esc(src)}" target="_blank" rel="noopener">Open full bracket</a></div>
      <div class="table-wrap"><div style="position:relative;overflow:hidden;width:${b.width}px;height:${b.height}px;margin-inline:auto;background:#fff">
        <iframe title="Playoff bracket" loading="lazy" src="${esc(src)}"
          style="position:absolute;top:${b.top || 0}px;left:${b.left || 0}px;width:${b.iframeWidth || b.width * 2.3}px;height:${b.iframeHeight || b.height * 2.5}px;border:0;pointer-events:none;zoom:${b.zoom || 1}"></iframe>
      </div></div>`;
  }

  /* ---------- schedule ---------- */
  let activeLeague = "";
  loadSheet(csvUrl(s.sheet, s.gids.schedule), (rows) => {
    const weeks = parseSchedule(rows, s);
    if (!weeks.length) { message(els.schedule, "No matches posted yet.", "info"); return; }
    const current = weeks.find((w) => !w.done) || weeks[weeks.length - 1];
    els.schedule.innerHTML = weeks.map((w) => {
      const tag = w === current && !w.done && !isHistory ? '<span class="week__tag week__tag--now">This week</span>'
        : w.done ? '<span class="week__tag week__tag--done">Final</span>' : "";
      return `<details class="week"${w === current && !isHistory ? " open" : ""} id="${esc(slug(w.name))}">
        <summary>${esc(w.name)} ${tag}</summary>
        <div class="matches">${w.matches.map((m) => matchCard(m, s)).join("")}</div>
      </details>`;
    }).join("");
    applyFilter();
  }, () => message(els.schedule, "Schedule didn't load. Refresh to try again.", "error"));

  /* league filter chips */
  const scheduleLeagues = (s.schedule.leagueOrder || []).map((id) => leagueById(id, s)).filter(Boolean);
  if (els.filters && scheduleLeagues.length > 1) {
    els.filters.innerHTML = `<button class="chip" aria-pressed="true" data-league="">All</button>` +
      scheduleLeagues.map((l) => `<button class="chip" style="--c:${l.color}" aria-pressed="false" data-league="${esc(l.id)}">${esc(l.short || l.name)}</button>`).join("");
    els.filters.addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      activeLeague = b.dataset.league;
      $$(".chip", els.filters).forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      applyFilter();
    });
  }
  function applyFilter() {
    $$(".match", els.schedule).forEach((m) => { m.hidden = !!activeLeague && m.dataset.league !== activeLeague; });
    $$(".standings", els.standings).forEach((t) => {
      t.style.display = activeLeague && t.dataset.league !== activeLeague ? "none" : "";
    });
  }

  /* ---------- coaches ---------- */
  function renderCoachesFromTeams() {
    if (!els.coaches || s.coaches !== "teams") return;
    els.coaches.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th scope="col">Team</th><th scope="col">Coach</th><th scope="col">League</th></tr></thead>
      <tbody>${C.teams.map((t) => {
        const l = leagueById(t.league);
        return `<tr><th scope="row">${esc(t.name)}</th><td>${esc(t.coach)}</td><td><span style="color:${l?.color}">${esc(l?.short || "")}</span></td></tr>`;
      }).join("")}</tbody></table></div>`;
  }
  if (s.coaches && typeof s.coaches === "object") {
    const cfg = s.coaches;
    loadSheet(csvUrl(s.sheet, cfg.gid), (rows) => {
      const b = block(rows, cfg.rows[0], cfg.rows[1] - 1, cfg.cols[0], cfg.cols[1] - 1);
      const [head, ...body] = b;
      const width = Math.max(...b.map((r) => r.length));
      els.coaches.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr>${
        headCells(head, width)}</tr></thead><tbody>${body.filter((r) => r.some(Boolean)).map((r) =>
        `<tr>${r.map((v, i) => i ? `<td>${esc(v)}</td>` : `<th scope="row">${esc(v)}</th>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    });
  } else if (!s.coaches && els.coaches) {
    els.coaches.closest("section")?.remove();
  }

  /* ---------- extra links ---------- */
  if (els.extra && s.extraLinks?.length) {
    els.extra.innerHTML = s.extraLinks.map((l) => `<a class="btn btn--ghost btn--small" href="${esc(l.href)}">${esc(l.label)}</a>`).join("");
  }

  document.addEventListener("nc:myteam", () => location.reload());

  /* ---------- utils ---------- */
  function headCells(head, width) {
    const out = [];
    for (let i = 0; i < width; i++) {
      const v = head[i] || "";
      let span = 1;
      while (v && i + span < width && !head[i + span]) span++;
      out.push(`<th scope="col"${span > 1 ? ` colspan="${span}"` : ""}>${esc(v)}</th>`);
      i += span - 1;
    }
    return out.join("");
  }
  function slug(t) { return "week-" + String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
  function ordinal(k) { return k + (["th", "st", "nd", "rd"][(k % 100 > 10 && k % 100 < 14) ? 0 : k % 10] || "th"); }
})();
