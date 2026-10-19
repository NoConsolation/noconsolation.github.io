/* =====================================================================
   NO CONSOLATION — SITE CONFIG
   ---------------------------------------------------------------------
   This is the ONE file to edit each season. Everything on the site
   (nav, standings, forms, draft, references) reads from here.

   Quick guide (full version in README.md):
   • New season?           Add a block to `seasons`, bump `currentSeason`.
   • Preds / predictions?  Edit the `references` list.
   • Banner across the top? Set `announcement.enabled = true`.
   • Teams or coaches?     Edit `teams`.
   • Open/close a form?    Flip `enabled` under `forms`.

   Edit on GitHub: open this file → pencil icon → Commit changes.
   The site updates in about a minute.
   ===================================================================== */

window.NC_CONFIG = {

  currentSeason: 6,

  /* ---------- Scrolling banner at the top of every page ---------- */
  announcement: {
    enabled: false,
    text: "All-Star voting is open",
    href: "AllStar.html",
  },

  /* ---------- References hub (references.html) ----------
     Add, remove or reorder freely. Leave `href` empty to show the card
     as "Coming soon". `updated` is optional free text.               */
  references: [
    {
      title: "SPL references",
      description: "The master sheet: rules, characters, maps and league history.",
      href: "https://docs.google.com/spreadsheets/d/1KZlY1RoGfuPpEX2zRT2EjZQVT_PEk-OdKyUAOBkPBfI/edit?gid=1572314173#gid=1572314173",
      updated: "",
    },
    {
      title: "Preds",
      description: "This season's preds.",
      href: "https://docs.google.com/spreadsheets/d/15WUeWBMedBRTRzEkH5KpmkIHa3Wu_UF7SDpRNyJYQFo/edit?usp=drivesdk",
      updated: "",
    },
    {
      title: "Season Spreadsheet",
      description: "Season specific stats, standings, and schedule.",
      href: "https://docs.google.com/spreadsheets/d/1AVjOb4M8eHHUd0R5U9PpcTwZwj2sqFuiS6fTNd4NA5Q/edit?usp=drivesdk",
      updated: "",
    },
  ],

  /* ---------- Leagues for the current season ----------
     `draftPool` is the key the live draft uses in Firebase. Don't
     change it mid-draft.                                             */
  leagues: [
    { id: "esl", name: "Elite Strikers League",       short: "ESL", color: "#B44CFF", streamKey: "League 1", draftPool: "Two"  },
    { id: "gsc", name: "Galactic Strikers Conference", short: "GSC", color: "#2FA8FF", streamKey: "League 2", draftPool: "One"  },
    { id: "bs",  name: "Biker Strikers",              short: "BS",  color: "#3DFF7A", streamKey: "League 3", draftPool: "Bike" },
  ],

  /* ---------- Teams (current season) ----------
     `draftName` is only needed when the draft uses a different spelling
     than `coach` (e.g. "EricA"). Order inside a league = draft board
     column order.                                                     */
  teams: [
    // Elite Strikers League
    { name: "Wicked Inc.",             coach: "Austin",  league: "esl" },
    { name: "Hubris Manifest",         coach: "Garrett", league: "esl" },
    { name: "Shy Bonka Koopa",         coach: "Brandon", league: "esl" },
    { name: "Fiery Flounders",         coach: "Eric A",  league: "esl", draftName: "EricA" },
    { name: "Skull Island",            coach: "Tanya",   league: "esl" },
    { name: "Brad",                    coach: "Brad",    league: "esl" },
    // Galactic Strikers Conference
    { name: "Wariors FC",              coach: "Colin",   league: "gsc" },
    { name: "New York Red Boos",       coach: "Eric P",  league: "gsc", draftName: "EricP" },
    { name: "Ferb Fletcher",           coach: "Jake",    league: "gsc" },
    { name: "Halloween Town Horrors",  coach: "Ben",     league: "gsc" },
    { name: "Come on Mr. Monty",       coach: "Jaco",    league: "gsc" },
    { name: "Spread Triple Option",    coach: "Danny",   league: "gsc" },
    // Biker Strikers
    { name: "Anchors Down",            coach: "Hamilton", league: "bs" },
    { name: "Reid Hot Chili Strikers", coach: "Reid",     league: "bs" },
    { name: "Snout Talk",              coach: "Teddy",    league: "bs" },
    { name: "Kongquerors FC",          coach: "Charlie",  league: "bs" },
    { name: "Mont-O and the Gals",     coach: "Dave",     league: "bs" },
    { name: "Fredchester United",      coach: "Freddy",   league: "bs" },
  ],

  /* ---------- Seasons ----------
     `sheet` is the "published to web" ID: the part after /d/e/ in a
     File → Share → Publish to web link. Row/column numbers below are
     0-based (row 1 in Sheets = 0 here), matching the old site exactly. */
  seasons: {
    6: {
      label: "Season 6",
      sheet: "2PACX-1vSgCY7AFJxG4_LzuYyuQUgE5GHw_aYk9lW9Ua3UKFTb8iiipRxXJSb0TYGrsP5rWgNrfCT9uFX3GKf7",
      gids: { standings: 1520901699, schedule: 1001386983, rosters: 1896446593, waivers: 1166432758 },
      standings: {
        columns: [0, 1, 3, 4, 7, 5, 6],          // Team, Pts, W, L, GD, GF, GA
        cutLines: [1, 4],                         // draw a line under these places
        tables: [
          { league: "esl", headerRow: 1,  rows: [2, 8]   },
          { league: "gsc", headerRow: 9,  rows: [10, 16] },
          { league: "bs",  headerRow: 17, rows: [18, 24] },
        ],
      },
      schedule: { rows: [41, 221], matchesPerLeague: 3, leagueOrder: ["esl", "gsc", "bs"] },
      rosterGrid: { startRow: 1, startCol: 1, groups: 3, perGroup: 6, boxHeight: 8 },
      bracket: null,                              // add once playoffs start (see season 5 for shape)
      coaches: "teams",                           // build the coach table from `teams` above
    },

    5: {
      label: "Season 5",
      sheet: "2PACX-1vTTBbsAmgDrEaexoEf4m2B4RDnw_vfzMtgXx111Pxz5GqLKivFdaB-SgBmiJs0-AB3SfZyl8oANoWLA",
      gids: { standings: 1520901699, schedule: 1001386983 },
      leagues: [
        { id: "spl", name: "SPL", color: "#FF5A1F" },
        { id: "mls", name: "MLS", color: "#19D3C5" },
      ],
      standings: {
        columns: [0, 1, 3, 4, 7, 5, 6],
        cutLines: [1, 4],
        tables: [
          { league: "spl", headerRow: 1, rows: [2, 8] },
          { league: "mls", headerRow: 9, rows: [10, 16] },
        ],
      },
      schedule: { rows: [29, 149], matchesPerLeague: 3, leagueOrder: ["mls", "spl"] },
      bracket: { gid: 1815967254, width: 1300, height: 800, zoom: 1.2, top: -30, left: -4 },
      coaches: { gid: 1520901699, rows: [33, 46], cols: [13, 17] },
    },

    4: {
      label: "Season 4",
      sheet: "2PACX-1vQ6sNy5NcDFMQJC32VQTJlrnNR-zd5_Jk-cAUGVkLhSUGBUoQywXBZHnyIXeLgJ5lLflK--_CEx0E_u",
      gids: { standings: 1520901699, schedule: 1001386983 },
      leagues: [
        { id: "spl", name: "SPL", color: "#FF5A1F" },
        { id: "mls", name: "MLS", color: "#19D3C5" },
      ],
      standings: {
        columns: [0, 1, 3, 4, 7, 5, 6],
        cutLines: [1, 4],
        tables: [
          { league: "spl", headerRow: 1, rows: [2, 8] },
          { league: "mls", headerRow: 9, rows: [10, 16] },
        ],
      },
      schedule: { rows: [29, 149], matchesPerLeague: 3, leagueOrder: ["mls", "spl"] },
      // The old page showed Season 3's bracket here. Pointing at Season 4's own sheet;
      // if that tab doesn't exist, replace `gid` or set `sheet` to Season 3's ID.
      bracket: { gid: 1815967254, width: 900, height: 800, zoom: 1.2, top: -30, left: -4 },
      coaches: null,
    },

    3: {
      label: "Season 3",
      sheet: "2PACX-1vS-bZX5wR8VLB1uNQmIVTkq9VImHnh1v4sKFKroFPxkfWsi0QGiCDXUrqT1FgDQOTEJwFWZ8-_Wha8O",
      gids: { standings: 1520901699, schedule: 1001386983 },
      leagues: [
        { id: "spl", name: "SPL", color: "#FF5A1F" },
        { id: "mls", name: "MLS", color: "#19D3C5" },
      ],
      standings: {
        columns: [0, 1, 3, 4, 7, 5, 6],
        cutLines: [1, 4],
        tables: [
          { league: "spl", headerRow: 1, rows: [2, 8] },
          { league: "mls", headerRow: 9, rows: [10, 16] },
        ],
      },
      schedule: { rows: [29, 149], matchesPerLeague: 3, leagueOrder: ["mls", "spl"] },
      bracket: { gid: 1815967254, width: 900, height: 800, zoom: 1.2, top: -30, left: -4 },
      coaches: null,
    },

    2: {
      label: "Season 2",
      sheet: "2PACX-1vTeC5HfoWoUQxwN42AtBg72omZBULnVWAmzgEAvh5E0NYrQhwBLeG22SKvrXfgr1UKDQF82t8KvHxQk",
      gids: { standings: 1520901699, schedule: 1001386983 },
      leagues: [
        { id: "spellcasters", name: "SpellCasters", color: "#FF5A1F" },
        { id: "mfmk",         name: "The MFMK",     color: "#19D3C5" },
      ],
      standings: {
        columns: [0, 2, 4, 7, 5],
        cutLines: [],
        tables: [
          { league: "spellcasters", headerRow: 1, rows: [2, 8] },
          { league: "mfmk",         headerRow: 9, rows: [10, 16] },
        ],
      },
      schedule: { rows: [29, 125], matchesPerLeague: null, leagueOrder: [] },
      bracket: { gid: 269961088, width: 1200, height: 500, zoom: 1, top: -30, left: -2, widget: true },
      coaches: null,
      extraLinks: [{ label: "Season 2 stats", href: "spl-statsszn2.html" }],
    },
  },

  /* ---------- Forms ----------
     `enabled: false` hides a form from the menu and shows a
     "closed" message on its page.                                    */
  forms: {
    roster: {
      enabled: true,
      endpoint: "https://script.google.com/macros/s/AKfycbyfFNi0MfKTLcADvpYXP33Cz2iZjg601p3tg7mIXhvvr5UrUrm5ktsTLSF5Z-NVXMJu/exec",
      maps: ["Vanilla", "Thunder Island", "Crystal Canyon", "Lava Pit", "Wastelands", "Dump", "Stormship", "Sand Tomb"],
      fitnessCost: 3,      // fitness a player loses when selected
      freshFitness: 7,     // fitness shown for players who sit out
    },
    waiver: {
      enabled: true,
      endpoint: "https://script.google.com/macros/s/AKfycbwmeu8aPdMrIrFEhBbXubYfhn6-WZkFvEwa5oOenPCCGNwJeQohHF97IKjxjkCzXllESw/exec",
      claimCol: 26,        // 0-based column index of free agents (value the old page used)
      orderCol: 38,        // 0-based column index of waiver order
      // 1-based sheet rows, same as Google Sheets
      byLeague: {
        esl: { orderRows: [2, 7],   claimRows: [2, 3] },
        gsc: { orderRows: [9, 14],  claimRows: [5, 6] },
        bs:  { orderRows: [16, 21], claimRows: [8, 9] },
      },
      droppableCount: 5,   // last N players on a roster can be dropped
    },
    keepers: {
      enabled: false,
      endpoint: "https://script.google.com/macros/s/AKfycby9HM8MHUemXDt34LlTRVgL--qwuefkKDsTDfUZEMHHq_w97ir1b6f3AGO8xetj95e17w/exec",
      sheet: "2PACX-1vQ6sNy5NcDFMQJC32VQTJlrnNR-zd5_Jk-cAUGVkLhSUGBUoQywXBZHnyIXeLgJ5lLflK--_CEx0E_u",
      gid: 1896446593,
      grid: { startRow: 66, startCol: 1, groups: 2, perGroup: 6, boxHeight: 8 },
      maxKeepers: 3,
      releaseMarkup: 0.10,
    },
    allstar: {
      enabled: false,
      title: "Season 6 All-Star voting",
      sheetUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTVd-CJBsAaw-2nKJsf9oxdNY6E2VP33gI78e0xEI38RMSFxT_9SJjxoZRGR05HFpNXozppwABGNq8Z/pub?gid=1784266098&single=true&output=csv",
      endpoint: "https://script.google.com/macros/s/AKfycbwwI5EFyAuMHfNynzALfay0iqIDX9OfNIn1REf__CmDaV5VFm_CvjYzrE-caH1peArh/exec",
    },
  },

  /* ---------- Live auction draft ---------- */
  draft: {
    live: false,               // true shows "Draft" in the nav for everyone
    budget: 105,
    countdownSeconds: 40,
    restrictedWindowSeconds: 20,
    restrictedMarkup: 0.10,    // restricted players need a bid ≥ price × 1.1
    saveEndpoint: "https://script.google.com/macros/s/AKfycbzvmd89eiZCAeMFvLf_MkChORjZLF6ZDf-WXNE0J4TjdXhkKjgL3ZXAMIYhd1KvuLDUCQ/exec",
    characters: ["BJ","Bowser","Daisy","Diddy","DK","Luigi","Mario","Peach","Petey","Wario","Waluigi","Yoshi",
                 "Birdo","Dry Bones","Boo","Koopa","Hammer Bro","Monty","Shy Guy","Toad"],
  },

  /* ---------- Who can open the commissioner console ----------
     Google accounts. This hides the controls in the browser; the
     database rules (database.rules.json) are what actually enforce it. */
  admins: [
    // "commish@gmail.com",
  ],

  /* ---------- Firebase (public by design — security lives in the rules) ---------- */
  firebase: {
    apiKey: "AIzaSyBdFLO9Pt8toDPfq3VUFEjMSfghi47tdio",
    authDomain: "spldraft.firebaseapp.com",
    databaseURL: "https://spldraft-default-rtdb.firebaseio.com",
    projectId: "spldraft",
    storageBucket: "spldraft.firebasestorage.app",
    messagingSenderId: "151054562933",
    appId: "1:151054562933:web:a294092e46475fa627ea3c",
  },

  /* ---------- Media & socials ---------- */
  media: {
    youtubeChannelId: "UCE0Y9Niy6KNT27yO7pVjFtw",
    youtubePlaylistId: "PLvZQiW1fJARIncO8u9JMVeeJHMiZZXL2L",
    twitchChannel: "noconsolation",
    spotifyShowId: "5CCgIC9e6ULAosE6sSSrPx",
    suggestionForm: "https://docs.google.com/forms/d/e/1FAIpQLSeaPBEMQ349MuLmaHvUqy4OzUyS_P6xugEFxLkQj-2VnFVdZw/viewform?usp=header",
    rosterSlides: "https://docs.google.com/presentation/d/e/2PACX-1vROfuRdWp1nlam1LwMpkUOaBJt6cg9-ovCCkdp0AMhtxg68dRQ7G7XWGkH7Z7yVk8E32wJG7VGQPjzw/embed?start=false&loop=false&delayms=3000",
    rosterSheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSxpAAvDpSKaUK3B8m3MfWQrS8Ic_yGuXPo_YS2aN_A5pbeH62mPjQDzFYy_oXoMypPUXeAPiiGBecu/pubhtml?gid=0&single=true&widget=true&headers=false",
  },
  socials: {
    discord: "https://discord.gg/dzEZA3Jwm5",
    twitch:  "https://twitch.tv/noconsolation",
    youtube: "https://www.youtube.com/@thereisnoconsolation",
    tiktok:  "https://www.tiktok.com/@noconsolation",
    twitter: "https://twitter.com/NoConsolation_",
  },
};
