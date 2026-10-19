/* Season 2 stat leaders — served by two Apps Script endpoints (unchanged). */
(function () {
  const { esc, $, message } = window.NC;
  const PANELS = "https://script.google.com/macros/s/AKfycbzOBMBo6EhZUTn6o7xYuER_l0dplhP3StR6BAPFeM4OU4GPjKkQxjf6BrTlOKn0-70/exec";
  const DETAIL = "https://script.google.com/macros/s/AKfycbyjbWm90zJL05BuLRY9uKycdxirHbL1CMY3DZCnhEz8S0Lk4F4CQCWPkd4vdeTlJIMj-g/exec?panel=";
  const host = $("#panels"), dlg = $("#detail"), body = $("#detail-body");
  const fmt = (v) => (typeof v === "number" ? v.toFixed(1) : v ?? "");

  fetch(PANELS).then((r) => r.json()).then((data) => {
    let html = "", idx = 0;
    for (let row = 0; row <= 8; row += 4) for (let col = 0; col < 8; col += 2) {
      const title = data[row]?.[col]?.value ?? "";
      let rows = "";
      for (let i = 1; i <= 3; i++) rows += `<tr><th scope="row">${esc(fmt(data[row + i]?.[col]?.value))}</th><td class="num">${esc(fmt(data[row + i]?.[col + 1]?.value))}</td></tr>`;
      html += `<button class="leader" data-i="${idx++}"><span class="panel" style="display:block">
        <span class="panel__title" style="display:block">${esc(title)}</span>
        <table class="table"><tbody>${rows}</tbody></table>
        <span class="ref__go">Full list</span></span></button>`;
    }
    host.innerHTML = html;
  }).catch(() => message(host, "Season 2 stats didn't load. Refresh to try again.", "error"));

  host.addEventListener("click", (e) => {
    const b = e.target.closest(".leader"); if (!b) return;
    body.innerHTML = '<div class="skeleton"></div>';
    dlg.showModal();
    fetch(DETAIL + b.dataset.i).then((r) => r.json()).then((d) => {
      if (!Array.isArray(d) || !d.length) { message(body, "No detail for this stat.", "info"); return; }
      body.innerHTML = `<h2>${esc(d[0]?.[0]?.value || "Detail")}</h2><div class="table-wrap"><table class="table"><tbody>${
        d.slice(1).map((r, i) => `<tr><td class="num muted">${i + 1}</td><th scope="row">${esc(fmt(r[0]?.value))}</th><td class="num">${esc(fmt(r[1]?.value))}</td></tr>`).join("")
      }</tbody></table></div>`;
    }).catch(() => message(body, "Detail didn't load.", "error"));
  });
  $("#detail-close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
})();
