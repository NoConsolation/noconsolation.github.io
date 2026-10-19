/* All-Star voting. Table layout mirrors the voting sheet; payload keys match
   the old page exactly (esl_st_1 … bs_util_row6, voter). */
(function () {
  const { C, esc, $, $$, loadSheet, postScript, message, toast } = window.NC;
  const cfg = C.forms.allstar;
  const host = $("#ballot");

  $("#title").textContent = cfg.title;
  document.title = cfg.title + " · No Consolation";
  if (!cfg.enabled) { host.innerHTML = '<p class="note note--warn">All-Star voting is closed right now.</p>'; $("#vote-bar").hidden = true; return; }

  const POS = {
    ST:  { label: "Striker",  color: "#FF2E4D" },
    TM:  { label: "Top mid",  color: "#3DFF7A", split: true },
    BM:  { label: "Bot mid",  color: "#2FA8FF", split: true },
    DEF: { label: "Defense",  color: "#FFD60A", split: true },
    Util:{ label: "Utility",  color: "#ADA4D9", utility: true },
    MGR: { label: "Manager",  color: "#ADA4D9" },
  };
  // [rowStart, rowEnd) and [colStart, colEnd) per block — copied from the old page.
  const LAYOUT = {
    ESL: { ST: [3, 9, 1, 9],  TM: [11, 23, 1, 9],  BM: [25, 37, 1, 9],  DEF: [39, 51, 1, 9],  Util: [53, 59, 1, 10],  MGR: [61, 67, 0, 8] },
    GSC: { ST: [3, 9, 11, 19], TM: [11, 23, 11, 19], BM: [25, 37, 11, 19], DEF: [39, 51, 11, 19], Util: [53, 59, 10, 19], MGR: [61, 67, 10, 18] },
    BS:  { ST: [3, 9, 21, 29], TM: [11, 23, 21, 29], BM: [25, 37, 21, 29], DEF: [39, 51, 21, 29], Util: [53, 59, 20, 29], MGR: [61, 67, 20, 28] },
  };
  const LEAGUE_COLOR = { ESL: C.leagues[0]?.color, GSC: C.leagues[1]?.color, BS: C.leagues[2]?.color };
  const HEAD = {
    MGR: ["Coach", "Team", "Points", "Win%", "GF/g", "GA/g", "GD", "Snipes"],
    Util: ["Player", "Series", "Coach", "Win %", "Goals/g", "Striker Index", "Impact", "+/-", "Vote"],
    def: ["Player", "Team", "Series", "Win %", "Goals/g", "Striker Index", "Impact", "+/-"],
  };

  loadSheet(cfg.sheetUrl, (rows) => {
    host.innerHTML = Object.entries(LAYOUT).map(([lg, blocks]) => `
      <section class="section" style="--league:${LEAGUE_COLOR[lg] || "#fff"}">
        <h2 style="color:var(--league)">${esc(lg)}</h2>
        ${Object.entries(blocks).map(([pos, r]) => blockHTML(lg, pos, r, rows)).join("")}
      </section>`).join("");
  }, () => message(host, "The ballot didn't load. Refresh to try again.", "error"));

  function blockHTML(lg, pos, [r0, r1, c0, c1], rows) {
    const id = `${lg}_${pos}`.toLowerCase();
    const P = POS[pos];
    const data = rows.slice(r0, r1);
    const heads = HEAD[pos] || HEAD.def;
    let body = "", names = [];
    if (P.utility) {
      body = data.map((row, i) => `<tr>${range(c0, c1 - 1).map((c) => `<td>${esc(row[c])}</td>`).join("")}
        <td><select name="${id}_row${i}" aria-label="Vote for ${esc(row[c0])}"><option value="">–</option><option>Yes</option><option>No</option></select></td></tr>`).join("");
    } else if (P.split) {
      for (let i = 0; i < data.length; i += 2) {
        const a = data[i] || [], b = data[i + 1] || [];
        if (a[c0]) names.push(a[c0]);
        body += `<tr class="pair-top">${range(c0, c1).map((c) => c < c0 + 2
          ? `<td rowspan="2">${esc(a[c])}</td>` : `<td style="color:${P.color}">${esc(a[c])}</td>`).join("")}</tr>
          <tr class="pair-bottom">${range(c0 + 2, c1).map((c) => `<td><strong>${esc(b[c])}</strong></td>`).join("")}</tr>`;
      }
    } else {
      names = data.map((r) => r[c0] || "").filter(Boolean);
      body = data.map((row) => `<tr>${range(c0, c1).map((c) => `<td>${esc(row[c])}</td>`).join("")}</tr>`).join("");
    }
    const picks = P.utility ? "" : `<div class="form-grid" style="margin-top:1rem">${["First choice", "Second choice", "Third choice"].map((l, i) =>
      `<label class="field"><span>${l}</span><select name="${id}_${i + 1}"><option value="">Choose</option>${
        names.map((n) => `<option>${esc(n)}</option>`).join("")}</select></label>`).join("")}</div>`;
    return `<div class="panel" style="--league:${P.color};margin-bottom:1.25rem">
      <h3 class="panel__title">${esc(P.label)} · ${esc(lg)}</h3>
      ${P.utility ? '<p class="panel__sub">For each player, vote yes if they deserve to be an All-Star.</p>' : ""}
      <div class="table-wrap"><table class="table table--ballot"><thead><tr>${heads.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${body}</tbody></table></div>${picks}</div>`;
  }
  const range = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);

  /* keep the three picks in a block unique */
  host.addEventListener("change", (e) => {
    const m = e.target.name?.match(/^(.*)_[123]$/);
    if (!m) return;
    const group = $$(`select[name^="${m[1]}_"]`, host).filter((s) => /_[123]$/.test(s.name));
    const chosen = group.map((s) => s.value);
    group.forEach((s) => Array.from(s.options).forEach((o) => { if (o.value) o.disabled = o.value !== s.value && chosen.includes(o.value); }));
  });

  $("#submit").addEventListener("click", async () => {
    const voter = $("#voter").value.trim();
    if (!voter) { toast("Add your name before submitting", "error"); $("#voter").focus(); return; }
    const data = { voter };
    $$("select", host).forEach((s) => { data[s.name] = s.value || "Missing"; });
    const btn = $("#submit"); btn.disabled = true; btn.querySelector("span").textContent = "Submitting…";
    try {
      const t = await postScript(cfg.endpoint, data);
      if (t.trim() === "Success") toast("Vote submitted"); else toast("Vote didn't go through: " + t, "error");
    } catch (err) {
      toast("Vote didn't submit. Check your connection and try again.", "error");
    } finally {
      btn.disabled = false; btn.querySelector("span").textContent = "Submit vote";
    }
  });
})();
