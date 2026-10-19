# No Consolation

Home of the Strikers Premier League — https://noconsolation.github.io

Plain HTML, CSS and JavaScript. No build step: edit a file on GitHub, commit, and the site updates in about a minute.

## The one file you edit: `config.js`

| I want to… | Change this in `config.js` |
|---|---|
| Update preds / predictions / reference links | `references` — paste the link into `href`. Empty `href` shows "Coming soon". |
| Put a banner across the top of every page | `announcement.enabled = true`, set `text` and `href` |
| Open or close a form | `forms.roster.enabled`, `forms.waiver.enabled`, `forms.keepers.enabled`, `forms.allstar.enabled` |
| Show "Draft" in the nav | `draft.live = true` |
| Change teams, coaches or leagues | `teams` and `leagues` |
| Give someone commissioner access | `admins` (and the database, see below) |
| Set next stream times | Commissioner page → **Stream times** tab (no file edit needed) |

## Starting a new season

1. In Google Sheets, publish the new season's sheet: **File → Share → Publish to web → Entire document**. Copy the long ID after `/d/e/` in the link.
2. In `config.js`, copy the season 6 block, paste it above as `7: { … }`, and update `label`, `sheet` and any `gids` that changed. The `gid` is the number after `gid=` in each tab's URL.
3. Update `leagues` and `teams` for the new season.
4. Set `currentSeason: 7`.
5. Commit. Season 6 automatically moves into the History menu.

Row and column numbers in `config.js` are **0-based** (row 1 in Sheets is `0`). They match what the old pages used, so you only need to touch them if the sheet layout changes.

When playoffs start, fill in `bracket` for the current season (copy the shape from season 5).

## Pages

| Page | What it does |
|---|---|
| `index.html` | Home: league streams, this week's matchups, latest uploads |
| `spl.html` | Current standings, schedule (with league filter), coaches |
| `season.html?s=N` | Any past season (old `splszn2`–`5.html` links redirect here) |
| `spl-stats.html` | Sortable player stats + team totals (from Firebase `p_stats`) |
| `spl-rosters.html` | Every roster with fitness left |
| `rostform.html` | Weekly lineup + map picks |
| `waiver.html` | Waiver order, free agents, claim form |
| `keeperform.html` | Keeper selection |
| `AllStar.html` | All-Star ballot |
| `streaming.html` | Twitch, YouTube and podcast (old `podcasts`, `twitch`, `youtube` pages redirect here) |
| `references.html` | SPL references, preds, predictions |
| `roster.html` | About the crew |
| `Draft.html` | Coaches' draft room — bids only |
| `Commish.html` | Commissioner console — sign-in required |

Code lives in `assets/`: one stylesheet (`assets/css/site.css`), the shared header/footer and helpers (`assets/js/core.js`), one script per page (`assets/js/pages/`), and the draft code (`assets/js/draft/`).

Forms post to the same Google Apps Script endpoints as before, with the same field names, so the scripts don't need changes.

## Commissioner login setup (one time)

Until this is done, the database is as open as it was before.

1. **Firebase console → Authentication → Sign-in method** → enable **Google**.
2. **Authentication → Settings → Authorized domains** → add `noconsolation.github.io`.
3. **Realtime Database → Data** → add a top-level key `admins`. Under it add one entry per commissioner: the email with every `.` replaced by `,`, value `true`.
   Example: `commish@gmail.com` → `commish@gmail,com : true`
4. Add the same emails (normal form) to `admins` in `config.js`.
5. **Check before step 6:** if a Google Apps Script writes `players` or `p_stats` into Firebase, make sure it authenticates (a database secret or service account). Unauthenticated writes will be blocked by the new rules.
6. **Realtime Database → Rules** → paste in `database.rules.json` → Publish.

After that, coaches can only add bids while the clock is running, and only signed-in admins can change players, timers, stream times or stats.

## Draft day checklist

- `draft.live = true` in `config.js` so coaches see the Draft link.
- Commissioner opens `Commish.html`, signs in, picks the pool.
- Click a player → **Start clock** → **Award to top bid** when the clock ends.
- Restricted-player unlocks and auto-locks run from the commissioner page, so keep it open for the whole draft.
