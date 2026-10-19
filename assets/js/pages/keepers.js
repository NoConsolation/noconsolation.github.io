/* Keepers: pick up to N players (max 1 captain) to protect for next season.
   Sends playername, captain, topmid, botmid, def — same as the old form. */
(function () {
  const { C, esc, $, csvUrl, loadSheet, parseRosterGrid, teamByCoach, postScript, toast, message } = window.NC;
  const cfg = C.forms.keepers;
  const form = $("#keeper-form");
  const preview = $("#roster-preview");

  $("#rule-max").textContent = cfg.maxKeepers;
  $("#rule-markup").textContent = Math.round(cfg.releaseMarkup * 100) + "%";

  if (!cfg.enabled) { form.outerHTML = '<p class="note note--warn">Keeper selection is closed right now.</p>'; return; }

  const SLOTS = ["captain", "topmid", "botmid", "def"];
  let rosters = {};

  loadSheet(csvUrl(cfg.sheet, cfg.gid), (rows) => {
    rosters = {};
    parseRosterGrid(rows, cfg.grid).flat().forEach((b) => { rosters[b.header] = b; });
    const coaches = Object.keys(rosters).sort();
    const keep = $("#playername").value;
    $("#playername").innerHTML = '<option value="">Choose your name</option>' + coaches.map((c) => `<option>${esc(c)}</option>`).join("");
    if (keep && rosters[keep]) { $("#playername").value = keep; onCoach(); }
  }, () => message(preview, "Rosters didn't load. Refresh to try again.", "error"));

  function onCoach() {
    const box = rosters[$("#playername").value];
    SLOTS.forEach((id) => { $("#" + id).innerHTML = `<option value="">${id === "captain" ? "No captain" : "No sidekick"}</option>`; });
    if (!box) { preview.innerHTML = ""; validate(); return; }
    const opt = (p) => `<option>${esc(p.name)}</option>`;
    $("#captain").insertAdjacentHTML("beforeend", box.players.slice(0, 2).map(opt).join(""));
    ["topmid", "botmid", "def"].forEach((id) => $("#" + id).insertAdjacentHTML("beforeend", box.players.slice(2, 7).map(opt).join("")));
    renderPreview();
    validate();
  }

  function renderPreview() {
    const coach = $("#playername").value, box = rosters[coach];
    if (!box) return;
    const picked = SLOTS.map((id) => $("#" + id).value).filter(Boolean);
    const team = teamByCoach(coach);
    preview.innerHTML = `<article class="roster">
      <div class="roster__head">${esc(team ? team.name : coach + "'s roster")}<small>${esc(coach)}</small></div>
      <table class="table"><thead><tr><th scope="col">Player</th><th class="num" scope="col">Value</th></tr></thead><tbody>${
        box.players.map((p, i) => `<tr${picked.includes(p.name) ? ' class="is-mine"' : ""}><th scope="row">${esc(p.name)}${i < 2 ? ' <span class="muted">· C</span>' : ""}</th><td class="num">${esc(p.value)}</td></tr>`).join("")
      }</tbody></table></article>`;
  }

  function validate() {
    const coach = $("#playername").value;
    const picked = SLOTS.map((id) => $("#" + id).value).filter(Boolean);
    const msgs = [];
    if (!coach) msgs.push("Choose your name");
    if (new Set(picked).size !== picked.length) msgs.push("Each player can only be kept once");
    if (picked.length > cfg.maxKeepers) msgs.push(`Keep no more than ${cfg.maxKeepers} players`);
    $("#form-errors").innerHTML = msgs.map((m) => `<li>${esc(m)}</li>`).join("");
    $("#count").textContent = `${picked.length} of ${cfg.maxKeepers} kept`;
    $("#submit").disabled = msgs.length > 0;
    return !msgs.length;
  }

  $("#playername").addEventListener("change", onCoach);
  SLOTS.forEach((id) => $("#" + id).addEventListener("change", () => { renderPreview(); validate(); }));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const data = { playername: $("#playername").value };
    SLOTS.forEach((id) => { data[id] = $("#" + id).value; });
    const btn = $("#submit"); btn.disabled = true; btn.querySelector("span").textContent = "Submitting…";
    try {
      await postScript(cfg.endpoint, data);
      toast("Keepers submitted");
      $("#done").hidden = false;
      $("#done").innerHTML = `<p class="note note--ok">Keepers saved for <strong>${esc(data.playername)}</strong>.</p>`;
    } catch (err) {
      console.error(err);
      toast("Keepers didn't submit. Check your connection and try again.", "error");
    } finally {
      btn.querySelector("span").textContent = "Submit keepers";
      validate();
    }
  });
  validate();
})();
