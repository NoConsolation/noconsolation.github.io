/* Home: league lanes with next stream, this week's matchups, latest video. */
(function () {
  const { C, esc, $, season, csvUrl, loadSheet, parseSchedule, matchCard, fillStreamTimes, myTeamPicker, message } = window.NC;
  const s = season();

  /* league lanes */
  $("#lanes").innerHTML = C.leagues.map((l) => `
    <a class="lane" href="spl.html" style="--league:${l.color}">
      <div class="panel">
        <h3 class="panel__title">${esc(l.name)}</h3>
        <div class="next-stream" data-stream="${esc(l.streamKey || "")}"></div>
        <span class="lane__go">Standings and schedule</span>
      </div>
    </a>`).join("");
  fillStreamTimes($("#lanes"));

  /* this week */
  $("#week-tools").appendChild(myTeamPicker());
  const host = $("#this-week");
  function render(rows) {
    const weeks = parseSchedule(rows, s);
    if (!weeks.length) { message(host, "The schedule hasn't been posted yet.", "info"); return; }
    const w = weeks.find((x) => !x.done) || weeks[weeks.length - 1];
    $("#week-name").textContent = w.name;
    host.innerHTML = `<div class="matches">${w.matches.map((m) => matchCard(m, s)).join("")}</div>`;
  }
  let lastRows = null;
  loadSheet(csvUrl(s.sheet, s.gids.schedule), (rows) => { lastRows = rows; render(rows); },
    () => message(host, "This week's matchups didn't load. The full schedule is on the League page.", "error"));
  document.addEventListener("nc:myteam", () => lastRows && render(lastRows));

  /* latest uploads — uses the channel's uploads playlist, no API key needed */
  const up = "UU" + C.media.youtubeChannelId.slice(2);
  const btn = $("#latest-video");
  btn.addEventListener("click", () => {
    btn.outerHTML = `<iframe title="Latest No Consolation uploads" allow="autoplay; encrypted-media; picture-in-picture; web-share" allowfullscreen
      src="https://www.youtube-nocookie.com/embed/videoseries?list=${up}&autoplay=1"></iframe>`;
  }, { once: true });
})();
