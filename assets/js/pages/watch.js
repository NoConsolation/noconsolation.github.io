/* Watch & listen: YouTube live player (shown while the channel is live),
   latest uploads, Shorts link, podcast. */
(function () {
  const { C, esc, $, streamTimes, formatStream } = window.NC;
  const m = C.media;
  const live = m.youtubeLive || {};
  const channelId = m.youtubeChannelId;
  const channelUrl = (C.socials.youtube || `https://www.youtube.com/channel/${channelId}`).replace(/\/$/, "");
  const uploads = "UU" + channelId.slice(2);

  const els = { box: $("#live"), title: $("#live-title"), badge: $("#live-badge"), open: $("#open-live") };

  /* ---------- live player ---------- */
  let shownKey = "";                       // avoid restarting the player on every check

  function player(src, title) {
    return `<iframe title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture; web-share" allowfullscreen
      src="${esc(src)}"></iframe>`;
  }

  function setHeader(state, when) {
    els.badge.hidden = state !== "live" && state !== "upcoming";
    els.badge.classList.toggle("is-upcoming", state === "upcoming");
    els.badge.textContent = state === "upcoming" ? (when ? `Starts ${when}` : "Upcoming") : "Live";
    els.title.textContent = state === "live" ? "Live now on YouTube"
      : state === "upcoming" ? "Next stream on YouTube" : "Live on YouTube";
  }

  function showVideo(id, state, when) {
    const key = state + ":" + id;
    setHeader(state, when);
    els.open.href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
    if (key === shownKey) return;
    shownKey = key;
    els.box.classList.remove("embed--off");
    els.box.innerHTML = player(`https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&playsinline=1`,
      state === "live" ? "No Consolation live on YouTube" : "Upcoming No Consolation stream");
  }

  function showOffline() {
    setHeader("off");
    els.open.href = channelUrl;
    if (shownKey === "off") return;
    shownKey = "off";
    els.box.classList.add("embed--off");
    els.box.innerHTML = `<div class="live-off">
      <span class="live-off__dot" aria-hidden="true"></span>
      <h3>We're not live right now</h3>
      <ul class="live-off__times" id="live-times"><li class="muted">Checking the stream schedule…</li></ul>
      <div class="row" style="justify-content:center">
        <a class="btn btn--small" href="${esc(channelUrl)}?sub_confirmation=1" target="_blank" rel="noopener"><span>Subscribe for live alerts</span></a>
        <a class="btn btn--ghost btn--small" href="${esc(channelUrl)}/streams" target="_blank" rel="noopener"><span>Past streams</span></a>
      </div>
    </div>`;
    streamTimes().then((all) => {
      const list = $("#live-times");
      if (!list) return;
      const rows = C.leagues.map((l) => ({ l, t: formatStream(all?.[l.streamKey]) })).filter((r) => r.t);
      list.innerHTML = rows.length
        ? rows.map((r) => `<li><span style="color:${r.l.color}">${esc(r.l.name)}</span><strong>${esc(r.t)}</strong></li>`).join("")
        : `<li class="muted">Next stream times will be posted here.</li>`;
    });
  }

  function showChannelPlayer() {
    // No API key: YouTube's channel live player (shows YouTube's own message when offline).
    setHeader("off");
    els.open.href = channelUrl + "/live";
    shownKey = "channel";
    els.box.innerHTML = player(`https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channelId)}&autoplay=1&mute=1`,
      "No Consolation live on YouTube");
  }

  /* Live check: 2 API units per check (uploads playlist + video details).
     Live and scheduled streams appear in the channel's uploads list. */
  async function checkLive() {
    const key = live.apiKey;
    const cacheKey = "nc:yt-live";
    try {
      const hit = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
      if (hit && Date.now() - hit.t < 60 * 1000) return hit.v;
    } catch (_) {}
    const api = "https://www.googleapis.com/youtube/v3/";
    const pl = await fetch(`${api}playlistItems?part=contentDetails&maxResults=10&playlistId=${uploads}&key=${encodeURIComponent(key)}`)
      .then((r) => { if (!r.ok) throw new Error("YouTube API " + r.status); return r.json(); });
    const ids = (pl.items || []).map((i) => i.contentDetails.videoId).filter(Boolean);
    let v = { state: "off" };
    if (ids.length) {
      const vids = await fetch(`${api}videos?part=snippet,liveStreamingDetails&id=${ids.join(",")}&key=${encodeURIComponent(key)}`)
        .then((r) => { if (!r.ok) throw new Error("YouTube API " + r.status); return r.json(); });
      const items = vids.items || [];
      const now = items.find((x) => x.snippet?.liveBroadcastContent === "live");
      const soon = items
        .filter((x) => x.snippet?.liveBroadcastContent === "upcoming" && x.liveStreamingDetails?.scheduledStartTime)
        .map((x) => ({ id: x.id, at: new Date(x.liveStreamingDetails.scheduledStartTime) }))
        .filter((x) => x.at - Date.now() < 24 * 3600 * 1000 && x.at - Date.now() > -6 * 3600 * 1000)
        .sort((a, b) => a.at - b.at)[0];
      if (now) v = { state: "live", id: now.id };
      else if (soon) v = { state: "upcoming", id: soon.id, at: soon.at.toISOString() };
    }
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), v })); } catch (_) {}
    return v;
  }

  async function refresh() {
    try {
      const v = await checkLive();
      if (v.state === "live") showVideo(v.id, "live");
      else if (v.state === "upcoming") {
        const at = new Date(v.at);
        showVideo(v.id, "upcoming", at.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }));
      } else showOffline();
    } catch (err) {
      console.error("Live check failed:", err);
      if (!shownKey) showChannelPlayer();   // fall back rather than leave the box empty
    }
  }

  if (live.manualVideoId) {
    showVideo(live.manualVideoId, "live");
  } else if (live.apiKey) {
    refresh();
    const every = Math.max(1, Number(live.checkEveryMinutes) || 2) * 60 * 1000;
    setInterval(() => { if (document.visibilityState === "visible") refresh(); }, every);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });
  } else {
    showChannelPlayer();
  }

  /* ---------- latest uploads (click to load) ---------- */
  const latest = $("#latest");
  latest.addEventListener("click", () => {
    latest.outerHTML = player(`https://www.youtube-nocookie.com/embed/videoseries?list=${uploads}&autoplay=1`, "Latest uploads");
  }, { once: true });

  /* ---------- Shorts ---------- */
  $("#shorts").href = m.youtubeShorts || channelUrl + "/shorts";

  /* ---------- podcast + suggestions ---------- */
  $("#podcast").innerHTML = `<iframe class="spotify" title="No Consolation podcast" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    src="https://open.spotify.com/embed/show/${esc(m.spotifyShowId)}?utm_source=generator&theme=0"></iframe>`;
  $("#suggest").href = m.suggestionForm;
})();
