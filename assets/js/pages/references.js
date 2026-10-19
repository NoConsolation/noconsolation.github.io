/* References hub — cards come straight from config.references. */
(function () {
  const { C, esc, $, season } = window.NC;
  const s = season();
  const extra = [
    { title: `${s.label} league sheet`, description: "Standings, schedule and rosters as published from the league sheet.",
      href: `https://docs.google.com/spreadsheets/d/e/${s.sheet}/pubhtml` },
  ];
  $("#refs").innerHTML = [...C.references, ...extra].map((r) => {
    const soon = !r.href;
    const inner = `<div class="panel" style="height:100%;display:flex;flex-direction:column;gap:.5rem">
      <h2 class="panel__title">${esc(r.title)}</h2>
      <p>${esc(r.description || "")}</p>
      ${r.updated ? `<p class="muted" style="font-size:.9rem">Updated ${esc(r.updated)}</p>` : ""}
      <span class="ref__go">${soon ? "Coming soon" : "Open"}</span></div>`;
    return soon ? `<div class="ref is-soon">${inner}</div>`
      : `<a class="ref" href="${esc(r.href)}" target="_blank" rel="noopener">${inner}</a>`;
  }).join("");
})();
