/* About: the crew slides and roster sheet (loaded lazily). */
(function () {
  const { C, $ } = window.NC;
  $("#slides").innerHTML = `<iframe title="The roster" loading="lazy" allowfullscreen src="${C.media.rosterSlides}"></iframe>`;
  $("#sheet").innerHTML = `<iframe title="Roster sheet" loading="lazy" src="${C.media.rosterSheet}" style="width:100%;height:600px;border:0;background:#fff"></iframe>`;
})();
