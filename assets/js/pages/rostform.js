/* Weekly roster form. Sends the same fields the Apps Script already expects:
   team, captain, topmid, botmid, def, map1…map8. */
(function () {
  const { C, esc, $, $$, season, csvUrl, loadSheet, parseRosterGrid, teamByName, teamByCoach, myTeam, postScript, toast, message, fitClass } = window.NC;
  const cfg = C.forms.roster;
  const s = season();
  const form = $("#roster-form");

  if (!cfg.enabled) { form.outerHTML = '<p class="note note--warn">Roster submissions are closed right now.</p>'; return; }

  const POS = ["captain", "topmid", "botmid", "def"];
  const MAP_LABELS = ["1st pick", "2nd pick", "3rd pick", "4th pick", "4th ban", "3rd ban", "2nd ban", "1st ban"];
  const teamSel = $("#team");
  const preview = $("#roster-preview");
  const errors = $("#form-errors");
  const submit = $("#submit");
  let rosters = {};

  /* maps */
  $("#maps").innerHTML = MAP_LABELS.map((l, i) => `
    <label class="field${i >= 4 ? " is-ban" : ""}"><span>${esc(l)}</span>
      <select id="map${i + 1}" name="map${i + 1}" required><option value="">Choose a map</option>${
        cfg.maps.map((m) => `<option>${esc(m)}</option>`).join("")}</select></label>`).join("");

  loadSheet(csvUrl(s.sheet, s.gids.rosters), (rows) => {
    rosters = {};
    parseRosterGrid(rows, s.rosterGrid).flat().forEach((b) => {
      const t = teamByName(b.header) || teamByCoach(b.header);
      rosters[t ? t.name : b.header] = b;
    });
    const keep = teamSel.value || myTeam.get();
    teamSel.innerHTML = '<option value="">Choose your team</option>' + C.leagues.map((l) => {
      const ts = C.teams.filter((t) => t.league === l.id && rosters[t.name]);
      return ts.length ? `<optgroup label="${esc(l.name)}">${ts.map((t) => `<option>${esc(t.name)}</option>`).join("")}</optgroup>` : "";
    }).join("") + Object.keys(rosters).filter((k) => !teamByName(k)).map((k) => `<option>${esc(k)}</option>`).join("");
    if (keep && rosters[keep]) { teamSel.value = keep; onTeam(); }
  }, () => message(preview, "Rosters didn't load, so the form can't be filled in. Refresh to try again.", "error"));

  const fitness = (team, player) => {
    const p = rosters[team]?.players.find((x) => x.name === player);
    return p ? parseInt(p.value, 10) : NaN;
  };
  const exhausted = (team, player) => { const f = fitness(team, player); return !isNaN(f) && f < cfg.fitnessCost; };

  function onTeam() {
    const team = teamSel.value;
    const box = rosters[team];
    POS.forEach((id) => { $("#" + id).innerHTML = '<option value="">Choose a player</option>'; });
    if (!box) { preview.innerHTML = '<p class="note">Pick your team to see fitness.</p>'; validate(); return; }
    const opt = (p) => {
      const tired = exhausted(team, p.name);
      return `<option value="${esc(p.name)}"${tired ? " disabled" : ""}>${esc(p.name)} (${esc(p.value || "?")})${tired ? " · tired" : ""}</option>`;
    };
    $("#captain").insertAdjacentHTML("beforeend", box.players.slice(0, 2).map(opt).join(""));
    ["topmid", "botmid", "def"].forEach((id) => $("#" + id).insertAdjacentHTML("beforeend", box.players.slice(2, 7).map(opt).join("")));
    renderPreview();
    validate();
  }

  function renderPreview() {
    const team = teamSel.value, box = rosters[team];
    if (!box) return;
    const picked = POS.map((id) => $("#" + id).value).filter(Boolean);
    preview.innerHTML = `<article class="roster" style="--league:${(C.leagues.find((l) => l.id === teamByName(team)?.league) || {}).color || "var(--volt)"}">
      <div class="roster__head">${esc(team)}<small>${esc(teamByName(team)?.coach || "")}</small></div>
      <table class="table"><thead><tr><th scope="col">Player</th><th class="num" scope="col">Now</th><th class="num" scope="col">Next week</th></tr></thead><tbody>${
        box.players.map((p) => {
          const f = parseInt(p.value, 10);
          let next, cls;
          if (picked.includes(p.name)) {
            const lo = Math.max(f - cfg.fitnessCost, -2), hi = Math.max(f - cfg.fitnessCost + 1, -2);
            next = isNaN(f) ? "?" : `${lo}–${hi}`;
            cls = lo <= -1 ? "tired" : lo <= 1 ? "red" : lo <= 4 ? "yellow" : "blue";
          } else { next = String(cfg.freshFitness); cls = "green"; }
          return `<tr${picked.includes(p.name) ? ' class="is-mine"' : ""}><th scope="row">${esc(p.name)}</th>
            <td class="num"><span class="fit fit--${fitClass(p.value)}">${esc(p.value || "–")}</span></td>
            <td class="num"><span class="fit fit--${cls}">${esc(next)}</span></td></tr>`;
        }).join("")}</tbody></table></article>`;
  }

  function syncMaps() {
    const chosen = $$("#maps select").map((x) => x.value);
    $$("#maps select").forEach((sel) => {
      Array.from(sel.options).forEach((o) => { if (o.value) o.disabled = o.value !== sel.value && chosen.includes(o.value); });
    });
  }

  function validate() {
    const team = teamSel.value;
    const players = POS.map((id) => $("#" + id).value).filter(Boolean);
    const maps = $$("#maps select").map((x) => x.value).filter(Boolean);
    const msgs = [];
    if (!team) msgs.push("Choose your team");
    if (players.length < 4) msgs.push("Fill all four positions");
    if (new Set(players).size !== players.length) msgs.push("Each player can only play one position");
    if (players.some((p) => exhausted(team, p))) msgs.push("A selected player is too tired to play");
    if (maps.length < 8) msgs.push("Rank all eight maps");
    if (new Set(maps).size !== maps.length) msgs.push("Each map can only be used once");
    errors.innerHTML = msgs.map((m) => `<li>${esc(m)}</li>`).join("");
    submit.disabled = msgs.length > 0;
    return msgs.length === 0;
  }

  teamSel.addEventListener("change", () => { if (teamSel.value) myTeam.set(teamSel.value); onTeam(); });
  POS.forEach((id) => $("#" + id).addEventListener("change", () => { renderPreview(); validate(); }));
  $("#maps").addEventListener("change", () => { syncMaps(); validate(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const data = { team: teamSel.value };
    POS.forEach((id) => { data[id] = $("#" + id).value; });
    for (let i = 1; i <= 8; i++) data["map" + i] = $("#map" + i).value;
    submit.disabled = true; submit.querySelector("span").textContent = "Submitting…";
    try {
      await postScript(cfg.endpoint, data);
      toast(`Roster submitted for ${data.team}`);
      $("#done").hidden = false;
      $("#done").innerHTML = `<p class="note note--ok">Roster submitted for <strong>${esc(data.team)}</strong>.</p>`;
    } catch (err) {
      console.error(err);
      toast("Roster didn't submit. Check your connection and try again.", "error");
    } finally {
      submit.querySelector("span").textContent = "Submit roster";
      validate();
    }
  });

  validate();
})();
