# The Abusement Park 🏆

Welcome to the official home of **The Abusement Park**, the premier Fantasy Premier League (FPL) mini-league where suffering meets glory.

## About
Founded in 2008, this league has hosted 18 seasons of high-stakes FPL management. This repository contains the source code for our historical dashboard, tracking winners, statistics, and season-by-season performance data.

## Features
- **Dynamic leaderboard** with All Time / Last 5 / Last 10 filters
- **Live league:** position change, chips, captain and vice, players still to play, transfer hits, in-league ownership, and a two-manager comparison
- **Podium**, **timeline**, and cumulative titles chart (Chart.js)
- **Never won** and **longest drought** panels
- **Wall of Shame** fun awards
- **Season archive** with lightbox (← → arrow keys between seasons)
- **Photo avatars** (optional), FPL league link, JSON-LD for SEO

## Setup for Contributors

Edit the reviewed configuration and archive data in `public/scripts/data.js`:

| Field | Purpose |
|--------|---------|
| `LEAGUE_ID` | FPL mini-league ID — shows “View league on FPL” in header |
| `MANAGERS_EXTRA` | Members who have **never won** (not in `seasons` winners) |
| `seasons[]` | `{ year, winner, runnerUp?, img }` per season |
| `managers` (auto) | Built from winners + `MANAGERS_EXTRA`; set `avatarUrl` on extras or winners |

**Runner-up:** Add `runnerUp` on each season to enable the “Bottle” award.

**Avatars:** e.g. `{ name: 'Mac Alvi', avatarUrl: 'images/avatars/mac.png' }` in `MANAGERS_EXTRA` or extend winner entries.

**Screenshots:** Save PNGs in `public/images/` matching each `img` path (e.g. `images/2026.png`). Ten seasons do not have a screenshot yet. Those paths are listed in [`docs/missing-archive-images.md`](docs/missing-archive-images.md) and the lightbox shows “Screenshot not available” without requesting them. Do not add placeholder images.

## Local development and testing

Requirements:

- Node.js 22 LTS
- npm

Install the pinned dependencies and the Chromium browser used by Playwright:

```sh
npm ci
npm run test:e2e:install
```

Run the local Cloudflare Pages application:

```sh
npx wrangler pages dev public
```

Run the validation commands:

```sh
npm run lint
npm run test
npm run test:coverage
npm run test:e2e
SMOKE_BASE_URL=https://your-preview.example npm run test:smoke
npm run build
npm run check
```

This static application has no compilation step. `npm run build` performs static application validation instead of producing a synthetic build artifact. `npm run check` runs the essential non-browser quality gates; browser tests run separately because they start Wrangler and Chromium. `npm run test:smoke` verifies a deployed Cloudflare preview without calling the live FPL upstream.

Tests use small deterministic fixtures under `tests/fixtures/`. CI must not call the live FPL API or assert volatile rankings, deadlines, points, or manager counts. Coverage output is written to `coverage/`, with risk-based thresholds focused on the Cloudflare API Function.

The dedicated `.github/workflows/ci.yml` workflow validates pull requests and `main` without deploying. The legacy GitHub Pages workflow is manual-only because GitHub Pages cannot execute `functions/api/standings.js`; production continues to use Cloudflare Pages. Repository administrators must configure `main` branch protection to require these three checks before merging:

- `Lint, test, and coverage`
- `Browser regression (1/2)`
- `Browser regression (2/2)`

Branch protection itself is a repository setting and is not stored in this repo. The preview smoke check does not run unless the `SMOKE_BASE_URL` repository variable is set to the immutable Cloudflare deployment URL for the commit under test. That hostname is a Cloudflare deployment id, not the git SHA, and resolving it requires the Cloudflare API. This workflow has no Cloudflare credentials, so it does not guess the mutable `https://<branch>.<project>.pages.dev` alias.

Known limitations and the accessibility baseline are documented in [`docs/testing-baseline.md`](docs/testing-baseline.md).

## Cloudflare Pages

The live standings are served by the Pages Function at `/api/standings`. It
fetches league `113546` directly from FPL, validates the response, and caches
successful results at the edge for two minutes. The browser no longer depends
on a public CORS proxy.

Run the complete site locally with:

```sh
npx wrangler pages dev public
```

Then open the URL printed by Wrangler. After authenticating Wrangler, deploy
from the repository root with:

```sh
npx wrangler pages deploy
```

Wrangler 4 reads `pages_build_output_dir` from `wrangler.jsonc` when no directory is passed, so this uploads `public/` and does not upload the rest of the repository. Pages Functions are not taken from inside that directory: `wrangler pages deploy` bundles `./functions` relative to the working directory (this repo’s `functions/api/standings.js`). Run the command from the repository root. Do not pass `.` as the directory; that uploads the repository itself. `npm run deploy` is the same command.

Failed FPL requests display an explicit unavailable state instead of presenting
hard-coded rows as live data. A standings outage serves the last successful
payload with `meta.freshness` set to `stale` and `meta.stale` set to `true`.

`html2canvas` 1.4.1 is vendored at `public/vendor/html2canvas.min.js` (MIT).
`public/_headers` sends a report-only Content Security Policy for Pages static
files. It allows this origin plus Google Fonts and does not enforce yet, so a
report cannot block the page.

## License
MIT License.

---
*Built for the managers of The Abusement Park.*
