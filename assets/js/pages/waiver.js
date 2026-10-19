/* Waivers: shows order + free agents per league, submits a claim.
   Sends team, option1, option2, droppedPlayer (form-encoded, as before). */
(function () {
  const { C, esc, $, season, csvUrl, fetchSheet, parseRosterGrid, teamByName, teamByCoach, myTeam, postScript, toast, message } = window.NC;
  const cfg = C.forms.waiver;
  const s = season();
  const form = $("#waiver-form");
  const boards = $("#boards");

  if (!cfg.enabled) { form.outerHTML = '<p class="note note--warn">Waivers are closed right now.</p>'; }

  const col = (rows, c, r0, r1) => {           // 1-based inclusive rows, like the sheet
    const out = [];
    for (let r = r0 - 1; r < r1; r++) { const v = (rows[r]?.[c] || "").trim(); if (v) out.push(v); }
    return out;
  };

  let freeAgents = {}, rosters = {};

  Promise.all([fetchSheet(csvUrl(s.sheet, s.gids.waivers)), fetchSheet(csvUrl(s.sheet, s.gids.rosters))])
    .then(([w, r]) => {
      boards.innerHTML = C.leagues.map((l) => {
        const b = cfg.byLeague[l.id];
        if (!b) return "";
        const order = col(w, cfg.orderCol, ...b.orderRows);
        const fa = col(w, cfg.claimCol, ...b.claimRows);
        freeAgents[l.id] = fa;
        return `<section class="panel" style="--league:${l.color}">
          <h3 class="panel__title">${esc(l.name)}</h3>
          <div class="grid grid--2" style="gap:1rem">
            <div><h4 class="muted" style="margin:.25rem 0">Waiver order</h4>
              <ol class="order">${order.map((t) => `<li${myTeam.is(t) ? ' class="is-mine"' : ""}>${esc(t)}</li>`).join("") || "<li class='muted'>Not set</li>"}</ol></div>
            <div><h4 class="muted" style="margin:.25rem 0">Free agents</h4>
              <ul class="order order--plain">${fa.map((p) => `<li>${esc(p)}</li>`).join("") || "<li class='muted'>None available</li>"}</ul></div>
          </div></section>`;
      }).join("");

      parseRosterGrid(r, s.rosterGrid).flat().forEach((b) => {
        const t = teamByName(b.header) || teamByCoach(b.header);
        rosters[t ? t.name : b.header] = b;
      });

      if (!cfg.enabled) return;
      const keep = myTeam.get();
      $("#team").innerHTML = '<option value="">Choose your team</option>' + C.leagues.map((l) =>
        `<optgroup label="${esc(l.name)}">${C.teams.filter((t) => t.league === l.id).map((t) => `<option>${esc(t.name)}</option>`).join("")}</optgroup>`).join("");
      if (keep) { $("#team").value = keep; onTeam(); }
    })
    .catch(() => message(boards, "Waiver info didn't load. Refresh to try again.", "error"));

  function onTeam() {
    const team = $("#team").value;
    const t = teamByName(team);
    const fa = t ? freeAgents[t.league] || [] : [];
    ["option1", "option2"].forEach((id, i) => {
      $("#" + id).innerHTML = `<option value="">${i ? "No second choice" : "Choose a player"}</option>` + fa.map((p) => `<option>${esc(p)}</option>`).join("");
    });
    const players = [...new Set((rosters[team]?.players || []).map((p) => p.name))].slice(-cfg.droppableCount);
    $("#droppedPlayer").innerHTML = '<option value="">Choose a player to drop</option>' + players.map((p) => `<option>${esc(p)}</option>`).join("");
    validate();
  }

  function validate() {
    const team = $("#team").value, o1 = $("#option1").value, o2 = $("#option2").value, d = $("#droppedPlayer").value;
    const msgs = [];
    if (!team) msgs.push("Choose your team");
    if (!o1) msgs.push("Choose your first claim");
    if (o1 && o1 === o2) msgs.push("Your two claims must be different players");
    if (!d) msgs.push("Choose who you'd drop");
    $("#form-errors").innerHTML = msgs.map((m) => `<li>${esc(m)}</li>`).join("");
    $("#submit").disabled = msgs.length > 0;
    return !msgs.length;
  }

  if (!cfg.enabled) return;
  $("#team").addEventListener("change", () => { if ($("#team").value) myTeam.set($("#team").value); onTeam(); });
  ["option1", "option2", "droppedPlayer"].forEach((id) => $("#" + id).addEventListener("change", validate));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const data = { team: $("#team").value, option1: $("#option1").value, option2: $("#option2").value, droppedPlayer: $("#droppedPlayer").value };
    const btn = $("#submit"); btn.disabled = true; btn.querySelector("span").textContent = "Submitting…";
    try {
      await postScript(cfg.endpoint, data, true);
      toast("Waiver claim submitted");
      $("#done").hidden = false;
      $("#done").innerHTML = `<p class="note note--ok">Claim submitted for <strong>${esc(data.team)}</strong>: ${esc(data.option1)}${data.option2 ? " then " + esc(data.option2) : ""}, dropping ${esc(data.droppedPlayer)}.</p>`;
    } catch (err) {
      console.error(err);
      toast("Claim didn't submit. Check your connection and try again.", "error");
    } finally {
      btn.querySelector("span").textContent = "Submit claim";
      validate();
    }
  });
  validate();
})();
