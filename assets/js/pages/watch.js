/* Watch & listen: Twitch live player, latest YouTube uploads, playlist, podcast. */
(function () {
  const { C, esc, $ } = window.NC;
  const m = C.media;
  const host = location.hostname || "noconsolation.github.io";
  $("#twitch").innerHTML = `<iframe title="No Consolation on Twitch" allowfullscreen loading="lazy"
    src="https://player.twitch.tv/?channel=${esc(m.twitchChannel)}&parent=${esc(host)}&muted=true"></iframe>`;
  const up = "UU" + m.youtubeChannelId.slice(2);
  const lazy = (btn, src, title) => btn.addEventListener("click", () => {
    btn.outerHTML = `<iframe title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture; web-share" allowfullscreen src="${src}"></iframe>`;
  }, { once: true });
  lazy($("#latest"), `https://www.youtube-nocookie.com/embed/videoseries?list=${up}&autoplay=1`, "Latest uploads");
  lazy($("#playlist"), `https://www.youtube-nocookie.com/embed/videoseries?list=${esc(m.youtubePlaylistId)}&autoplay=1`, "Highlights playlist");
  $("#podcast").innerHTML = `<iframe class="spotify" title="No Consolation podcast" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    src="https://open.spotify.com/embed/show/${esc(m.spotifyShowId)}?utm_source=generator&theme=0"></iframe>`;
  $("#suggest").href = m.suggestionForm;
})();
