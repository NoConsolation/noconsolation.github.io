/* Rosters: fitness / uses left for every team, grouped by league. */
(function () {
  const { C, esc, $, season, csvUrl, loadSheet, parseRosterGrid, teamByName, myTeam, message, myTeamPicker, fitClass } = window.NC;
  const s = season();
  const host = $("#rosters");
  $("#tools").appendChild(myTeamPicker());

  let last = null;
  function render(rows) {
    last = rows;
    const groups = parseRosterGrid(rows, s.rosterGrid);
    host.innerHTML = groups.map((boxes, g) => {
      const lg = s.leagues[g] || { name: "League " + (g + 1), color: "#fff" };
      return `<section class="section" style="--league:${lg.color}">
        <h2 style="color:var(--league)">${esc(lg.name)}</h2>
        <div class="rosters">${boxes.map((b) => box(b)).join("")}</div>
      </section>`;
    }).join("");
  }
  function box(b) {
    const t = teamByName(b.header);
    return `<article class="roster${myTeam.is(b.header) ? " is-mine" : ""}">
      <div class="roster__head">${esc(b.header)}${t ? `<small>${esc(t.coach)}</small>` : ""}</div>
      <table class="table"><tbody>${b.players.map((p, i) => `<tr${i === 2 ? ' class="split"' : ""}>
        <th scope="row">${esc(p.name)}${i < 2 ? ' <span class="muted">· C</span>' : ""}</th>
        <td class="num"><span class="fit fit--${fitClass(p.value)}">${esc(p.value || "–")}</span></td></tr>`).join("")}
      </tbody></table></article>`;
  }

  loadSheet(csvUrl(s.sheet, s.gids.rosters), render,
    () => message(host, "Rosters didn't load. Refresh to try again.", "error"));
  document.addEventListener("nc:myteam", () => last && render(last));
})();
