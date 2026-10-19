/* No Consolation — shared core.
   Loaded on every page after config.js. Builds the header/footer,
   loads Google Sheets CSVs (with a short cache), and exposes helpers
   on window.NC. No build step, no dependencies. */
(function () {
  "use strict";

  const C = window.NC_CONFIG;
  if (!C) { console.error("config.js did not load"); return; }

  /* ---------------- helpers ---------------- */
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const season = (n = C.currentSeason) => {
    const s = C.seasons[n];
    if (!s) return null;
    // Current season inherits leagues from the top level.
    return { number: Number(n), leagues: C.leagues, ...s };
  };

  const leagueById = (id, s = season()) => (s?.leagues || C.leagues).find((l) => l.id === id);
  const teamByName = (name) => C.teams.find((t) => t.name.trim().toLowerCase() === String(name).trim().toLowerCase());
  const teamByCoach = (coach) => C.teams.find((t) => t.coach.toLowerCase() === String(coach).trim().toLowerCase()
    || (t.draftName || "").toLowerCase() === String(coach).trim().toLowerCase());

  const csvUrl = (sheet, gid) =>
    `https://docs.google.com/spreadsheets/d/e/${sheet}/pub?gid=${gid}&single=true&output=csv`;
  const htmlUrl = (sheet, gid, widget) =>
    `https://docs.google.com/spreadsheets/d/e/${sheet}/pubhtml?gid=${gid}&single=true${widget ? "&widget=true&headers=false" : ""}`;

  /* RFC 4180 CSV parser — handles quoted commas, quotes and newlines,
     which the old split(',') approach broke on. */
  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", i = 0, q = false;
    text = text.replace(/\r\n?/g, "\n");
    while (i < text.length) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { q = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  /* Load a published CSV. Calls onData immediately with a cached copy
     (if any, < 10 min old) and again when fresh data arrives and differs. */
  function loadSheet(url, onData, onError) {
    const key = "nc:csv:" + url;
    let cachedText = null;
    try {
      const hit = JSON.parse(sessionStorage.getItem(key) || "null");
      if (hit && Date.now() - hit.t < 10 * 60 * 1000) {
        cachedText = hit.text;
        onData(parseCSV(hit.text), { cached: true });
      }
    } catch (_) { /* storage blocked — fine */ }

    return fetch(url, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("Sheet returned " + r.status); return r.text(); })
      .then((text) => {
        try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), text })); } catch (_) {}
        if (text !== cachedText) onData(parseCSV(text), { cached: false });
      })
      .catch((err) => {
        console.error("Sheet load failed:", url, err);
        if (!cachedText && onError) onError(err);
      });
  }

  /* Promise version for pages that need several sheets at once. */
  function fetchSheet(url) {
    return new Promise((resolve, reject) => {
      let done = false;
      loadSheet(url, (rows, meta) => { if (!meta.cached || !done) { done = true; resolve(rows); } }, reject);
    });
  }

  /* Pull a block of cells: rows [r0, r1] and cols [c0, c1], inclusive. */
  const block = (rows, r0, r1, c0, c1) =>
    rows.slice(r0, r1 + 1).map((r) => (r || []).slice(c0, c1 + 1).map((v) => (v ?? "").trim()));

  /* Parse the roster grid (boxes of 2 columns × N rows, header = team). */
  function parseRosterGrid(rows, grid) {
    const out = [];
    for (let g = 0; g < grid.groups; g++) {
      const group = [];
      for (let b = 0; b < grid.perGroup; b++) {
        const c0 = grid.startCol + b * 2;
        const r0 = grid.startRow + g * grid.boxHeight;
        const box = block(rows, r0, r0 + grid.boxHeight - 1, c0, c0 + 1);
        const header = box[0]?.[0];
        if (!header) continue;
        group.push({
          header,
          players: box.slice(1).filter((r) => r[0]).map((r, i) => ({ name: r[0], value: r[1], slot: i + 1 })),
        });
      }
      out.push(group);
    }
    return out;
  }

  /* My team — highlights your team across the site. */
  const myTeam = {
    get() { try { return localStorage.getItem("nc:myTeam") || ""; } catch (_) { return ""; } },
    set(v) {
      try { v ? localStorage.setItem("nc:myTeam", v) : localStorage.removeItem("nc:myTeam"); } catch (_) {}
      document.dispatchEvent(new CustomEvent("nc:myteam", { detail: v }));
    },
    is(name) { const m = this.get(); return !!m && m.toLowerCase() === String(name).trim().toLowerCase(); },
  };

  function myTeamPicker() {
    const current = myTeam.get();
    const opts = C.leagues.map((l) => `<optgroup label="${esc(l.name)}">${
      C.teams.filter((t) => t.league === l.id).map((t) =>
        `<option value="${esc(t.name)}"${t.name === current ? " selected" : ""}>${esc(t.name)}</option>`).join("")
    }</optgroup>`).join("");
    const wrap = document.createElement("label");
    wrap.className = "myteam";
    wrap.innerHTML = `<span>My team</span><select><option value="">None</option>${opts}</select>`;
    wrap.querySelector("select").addEventListener("change", (e) => myTeam.set(e.target.value));
    return wrap;
  }

  /* Fitness / uses-left colour bucket. */
  function fitClass(v) {
    const n = parseInt(v, 10);
    if (v === "" || v === undefined || isNaN(n)) return "na";
    if (n <= 2) return "red";
    if (n <= 4) return "yellow";
    if (n <= 6) return "blue";
    return "green";
  }

  /* Status / empty / error messages. */
  function message(el, text, kind = "info") {
    if (!el) return;
    el.innerHTML = `<p class="note note--${kind}">${esc(text)}</p>`;
  }

  function toast(text, kind = "ok") {
    let host = $("#toasts");
    if (!host) {
      host = document.createElement("div");
      host.id = "toasts"; host.setAttribute("role", "status"); host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    const t = document.createElement("div");
    t.className = "toast toast--" + kind;
    t.textContent = text;
    host.appendChild(t);
    setTimeout(() => t.classList.add("is-out"), 4200);
    setTimeout(() => t.remove(), 4700);
  }

  /* POST JSON to a Google Apps Script web app (text/plain avoids a CORS preflight). */
  async function postScript(url, data, asForm = false) {
    const body = asForm ? new URLSearchParams(data) : JSON.stringify(data);
    const res = await fetch(url, { method: "POST", body });
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(text || "Request failed (" + res.status + ")");
    return text;
  }

  /* ---------------- layout ---------------- */
  const page = document.body.dataset.page || "";
  const section = document.body.dataset.section || "";

  const forms = C.forms;
  const submitItems = [
    forms.roster.enabled && { href: "rostform.html", label: "Weekly roster", id: "rostform" },
    forms.waiver.enabled && { href: "waiver.html", label: "Waiver claim", id: "waiver" },
    forms.keepers.enabled && { href: "keeperform.html", label: "Keepers", id: "keeperform" },
    forms.allstar.enabled && { href: "AllStar.html", label: "All-Star vote", id: "allstar" },
  ].filter(Boolean);

  const navItems = [
    { href: "index.html", label: "Home", id: "home" },
    { href: "spl.html", label: "League", id: "league", section: "league" },
    submitItems.length && { label: "Submit", id: "submit", children: submitItems },
    { href: "streaming.html", label: "Watch", id: "watch" },
    { href: "references.html", label: "References", id: "references" },
    { href: "roster.html", label: "About", id: "about" },
    C.draft.live && { href: "Draft.html", label: "Draft", id: "draft", hot: true },
  ].filter(Boolean);

  function navLink(item) {
    const active = item.id === page || (item.section && item.section === section);
    if (item.children) {
      const childActive = item.children.some((c) => c.id === page);
      return `<li class="nav__item nav__item--menu">
        <button class="nav__link${childActive ? " is-active" : ""}" aria-expanded="false" aria-haspopup="true">${esc(item.label)}<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
        <ul class="nav__sub">${item.children.map((c) =>
          `<li><a href="${c.href}"${c.id === page ? ' aria-current="page"' : ""}>${esc(c.label)}</a></li>`).join("")}</ul>
      </li>`;
    }
    return `<li class="nav__item"><a class="nav__link${active ? " is-active" : ""}${item.hot ? " nav__link--hot" : ""}" href="${item.href}"${active ? ' aria-current="page"' : ""}>${esc(item.label)}</a></li>`;
  }

  function renderHeader() {
    const host = $("#site-header") || document.body.insertBefore(document.createElement("header"), document.body.firstChild);
    host.id = "site-header";
    host.className = "site-header";
    const a = C.announcement;
    host.innerHTML = `
      <a class="skip" href="#main">Skip to content</a>
      ${a && a.enabled ? `<a class="ticker" href="${esc(a.href)}"><span class="ticker__track">${
        Array(8).fill(`<span>${esc(a.text)}</span>`).join("")}</span></a>` : ""}
      <div class="bar">
        <a class="brand" href="index.html" aria-label="No Consolation home">
          <img src="images/nc-logo.webp" alt="" width="40" height="40">
          <span>No Consolation</span>
        </a>
        <button class="nav-toggle" aria-expanded="false" aria-controls="site-nav">
          <span class="nav-toggle__bars" aria-hidden="true"></span><span class="sr">Menu</span>
        </button>
        <nav id="site-nav" class="nav" aria-label="Main">
          <ul class="nav__list">${navItems.map(navLink).join("")}</ul>
          <a class="btn btn--small" href="${esc(C.socials.discord)}" target="_blank" rel="noopener"><span>Join the Discord</span></a>
        </nav>
      </div>
      ${section === "league" ? leagueSubnav() : ""}`;

    const toggle = $(".nav-toggle", host);
    const nav = $("#site-nav", host);
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
    });
    $$(".nav__item--menu > button", host).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = btn.getAttribute("aria-expanded") !== "true";
        $$(".nav__item--menu > button", host).forEach((b) => b.setAttribute("aria-expanded", "false"));
        btn.setAttribute("aria-expanded", String(open));
      });
    });
    document.addEventListener("click", () =>
      $$(".nav__item--menu > button", host).forEach((b) => b.setAttribute("aria-expanded", "false")));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $$(".nav__item--menu > button", host).forEach((b) => b.setAttribute("aria-expanded", "false"));
    });
  }

  function leagueSubnav() {
    const viewing = Number(new URLSearchParams(location.search).get("s")) || null;
    const past = Object.keys(C.seasons).map(Number).filter((n) => n !== C.currentSeason).sort((a, b) => b - a);
    const tab = (href, label, id) =>
      `<a class="tab${page === id ? " is-active" : ""}" href="${href}"${page === id ? ' aria-current="page"' : ""}>${label}</a>`;
    return `<div class="subnav" role="navigation" aria-label="League">
      <div class="subnav__inner">
        ${tab("spl.html", "Standings &amp; schedule", "spl")}
        ${tab("spl-stats.html", "Stats", "stats")}
        ${tab("spl-rosters.html", "Rosters", "rosters")}
        <label class="subnav__history${page === "season" ? " is-active" : ""}">
          <span class="sr">Past seasons</span>
          <select onchange="if(this.value) location.href='season.html?s='+this.value">
            <option value="">History</option>
            ${past.map((n) => `<option value="${n}"${viewing === n ? " selected" : ""}>${esc(C.seasons[n].label)}</option>`).join("")}
          </select>
        </label>
      </div>
    </div>`;
  }

  function renderFooter() {
    const f = document.createElement("footer");
    f.className = "site-footer";
    const s = C.socials;
    f.innerHTML = `
      <div class="site-footer__inner">
        <div class="site-footer__brand">
          <img src="images/nc-logo.webp" alt="" width="56" height="56" loading="lazy">
          <p>A ruthless competition amongst friends.<br>Home of the Strikers Premier League.</p>
        </div>
        <nav class="site-footer__cols" aria-label="Footer">
          <div><h2>League</h2>
            <a href="spl.html">Standings</a><a href="spl-stats.html">Stats</a>
            <a href="spl-rosters.html">Rosters</a><a href="references.html">References</a></div>
          <div><h2>Submit</h2>${submitItems.map((i) => `<a href="${i.href}">${esc(i.label)}</a>`).join("") || "<span>Nothing open</span>"}</div>
          <div><h2>Follow</h2>
            <a href="${esc(s.discord)}" target="_blank" rel="noopener">Discord</a>
            <a href="${esc(s.twitch)}" target="_blank" rel="noopener">Twitch</a>
            <a href="${esc(s.youtube)}" target="_blank" rel="noopener">YouTube</a>
            <a href="${esc(s.tiktok)}" target="_blank" rel="noopener">TikTok</a>
            <a href="${esc(s.twitter)}" target="_blank" rel="noopener">X / Twitter</a></div>
        </nav>
      </div>
      <p class="site-footer__legal">© ${new Date().getFullYear()} No Consolation · <a href="Commish.html">Commissioner</a></p>`;
    document.body.appendChild(f);
  }

  /* ---------------- shared league rendering ---------------- */

  const SHORT = { "Team Names": "Team", Team: "Team", Points: "Pts", Wins: "W", Losses: "L", GD: "GD", GF: "GF", GA: "GA", Ties: "T", Draws: "D" };

  function standingsTable(rows, def, s) {
    const lg = leagueById(def.league, s) || { name: def.league, color: "#fff" };
    const header = rows[def.headerRow] || [];
    const cols = s.standings.columns;
    const body = rows.slice(def.rows[0], def.rows[1]).filter((r) => (r[cols[0]] || "").trim());
    const cuts = s.standings.cutLines || [];
    const th = cols.map((c, i) => {
      const full = (header[c] || "").trim();
      const short = SHORT[full] || full.slice(0, 3);
      return `<th scope="col"${i ? ' class="num"' : ""}><span class="full">${esc(full)}</span><span class="short" aria-hidden="true">${esc(short)}</span></th>`;
    }).join("");
    const tr = body.map((r, i) => {
      const team = (r[cols[0]] || "").trim();
      const k = cuts.indexOf(i + 1);
      const cls = [k > -1 ? "cut--" + Math.min(k, 1) : "", myTeam.is(team) ? "is-mine" : ""].filter(Boolean).join(" ");
      return `<tr${cls ? ` class="${cls}"` : ""}>${cols.map((c, j) =>
        j === 0 ? `<th scope="row"><span class="rank">${i + 1}</span>${esc(r[c])}</th>` : `<td class="num">${esc(r[c])}</td>`).join("")}</tr>`;
    }).join("");
    return `<section class="panel standings" style="--league:${lg.color}" data-league="${esc(lg.id || def.league)}">
      <h3 class="panel__title">${esc(lg.name)}</h3>
      <div class="next-stream" data-stream="${esc(lg.streamKey || "")}"></div>
      <div class="table-wrap"><table class="table table--standings">
        <thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>
    </section>`;
  }

  /* Schedule rows come in pairs: [week, ?, team, g1, g2, g3]. */
  function parseSchedule(rows, s) {
    const sc = s.schedule;
    const slice = rows.slice(sc.rows[0], sc.rows[1]);
    const weeks = [];
    const byName = {};
    for (let i = 0; i < slice.length - 1; i += 2) {
      const a = slice[i] || [], b = slice[i + 1] || [];
      const week = (a[0] || "").trim();
      if (!week || !(a[2] || "").trim()) continue;
      if (!byName[week]) { byName[week] = { name: week, matches: [] }; weeks.push(byName[week]); }
      const w = byName[week];
      const idx = w.matches.length;
      const league = sc.matchesPerLeague && sc.leagueOrder.length
        ? sc.leagueOrder[Math.floor(idx / sc.matchesPerLeague)] || null : null;
      const games = [3, 4, 5].map((c) => [parseInt(a[c], 10), parseInt(b[c], 10)]);
      const played = games.filter(([x, y]) => !isNaN(x) && !isNaN(y));
      const winsA = played.filter(([x, y]) => x > y).length;
      const winsB = played.filter(([x, y]) => y > x).length;
      w.matches.push({
        league,
        teams: [{ name: a[2].trim(), scores: [3, 4, 5].map((c) => (a[c] || "").trim()), wins: winsA },
                { name: (b[2] || "").trim(), scores: [3, 4, 5].map((c) => (b[c] || "").trim()), wins: winsB }],
        games,
        played: played.length,
        done: winsA >= 2 || winsB >= 2 || played.length === 3,
      });
    }
    weeks.forEach((w) => { w.done = w.matches.every((m) => m.done); w.started = w.matches.some((m) => m.played > 0); });
    return weeks;
  }

  function matchCard(m, s) {
    const lg = m.league ? leagueById(m.league, s) : null;
    const row = (t, oi) => {
      const o = m.teams[oi];
      const win = t.wins > o.wins;
      return `<div class="match__team${win ? " is-win" : ""}${myTeam.is(t.name) ? " is-mine" : ""}">
        <span class="match__name">${esc(t.name)}</span>
        ${t.scores.map((v, g) => {
          const x = parseInt(v, 10), y = parseInt(o.scores[g], 10);
          return `<span class="match__g${!isNaN(x) && !isNaN(y) && x > y ? " is-high" : ""}">${esc(v)}</span>`;
        }).join("")}
      </div>`;
    };
    return `<article class="match${m.done ? " is-done" : ""}" data-league="${esc(m.league || "")}"${lg ? ` style="--league:${lg.color}"` : ""}>
      ${row(m.teams[0], 1)}${row(m.teams[1], 0)}
    </article>`;
  }

  /* ---------------- stream times (Firebase REST, no SDK needed) ---------------- */
  function formatStream(d) {
    if (!d) return "";
    let dateStr = "";
    if (d.date) {
      const m = String(d.date).match(/^(\d{4})-(\d{2})-(\d{2})/);
      const dt = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d.date);
      if (!isNaN(dt)) dateStr = `${dt.getMonth() + 1}/${dt.getDate()}`;
    }
    let timeStr = "";
    if (d.time) {
      const hm = String(d.time).match(/^(\d{1,2}):(\d{2})$/);
      if (hm) {
        const dt = new Date(); dt.setHours(+hm[1], +hm[2], 0, 0);
        timeStr = dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      } else {
        const t = new Date(d.time);
        timeStr = isNaN(t) ? String(d.time) : t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }
    }
    const out = [d.day, dateStr, timeStr].filter(Boolean).join(" ");
    return out || "";
  }

  let streamPromise = null;
  function streamTimes() {
    if (!streamPromise) {
      streamPromise = fetch(`${C.firebase.databaseURL}/stream_times.json`)
        .then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    }
    return streamPromise;
  }

  function fillStreamTimes(root = document) {
    const els = $$("[data-stream]", root).filter((e) => e.dataset.stream);
    if (!els.length) return;
    streamTimes().then((all) => {
      els.forEach((el) => {
        const txt = formatStream(all?.[el.dataset.stream]);
        el.innerHTML = `<span class="dot${txt ? " is-live" : ""}" aria-hidden="true"></span>Next stream: <strong>${esc(txt || "TBD")}</strong>`;
      });
    });
  }

  /* ---------------- boot ---------------- */
  renderHeader();
  renderFooter();
  document.documentElement.classList.add("js");

  window.NC = {
    C, esc, $, $$, season, leagueById, teamByName, teamByCoach,
    csvUrl, htmlUrl, parseCSV, loadSheet, fetchSheet, block, parseRosterGrid,
    myTeam, myTeamPicker, fitClass, message, toast, postScript,
    standingsTable, parseSchedule, matchCard, formatStream, streamTimes, fillStreamTimes,
  };
})();
