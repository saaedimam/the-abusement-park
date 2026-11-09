# Feature Inventory

## Purpose

This inventory records behavior present on `main` at `c9b768d`. “Implemented” means supported by repository evidence. “Observed live” means the production response was inspected during the audit. Items not listed as observed still require browser regression coverage before refactoring.

## Historical dashboard

| Feature | Status | Evidence |
| --- | --- | --- |
| 18-season archive, 2008/09–2025/26 | Implemented and observed live | `index.html:862-881` |
| All-time, last-five, and last-ten title filters | Implemented | `index.html:777-782,987-991,1166-1175` |
| Dynamic title leaderboard | Implemented and observed live | `index.html:1197-1220` |
| Top-three podium | Implemented and observed live | `index.html:1128-1145` |
| Trophy years per manager | Implemented and observed live | `index.html:1201-1218` |
| Trailing championship streak badge | Implemented | `index.html:993-999,1201-1217` |
| Summary metrics: seasons, champions, reigning champion, chief bottler, most titles, original members | Implemented | `index.html:1043-1125,1179-1194` |
| Wall of Shame awards | Implemented and observed live | `index.html:1082-1125,1147-1155` |
| “Never won” and drought calculations | Implemented | `index.html:1016-1025,1049-1059` |
| Historical manager links to current FPL profiles | Implemented for manually mapped identities | `index.html:890-911,934-963` |
| Archive cards with latest-season label | Implemented and observed live | `index.html:1321-1342` |
| Archive screenshot modal | Implemented | `index.html:840-850,1223-1275` |
| Previous/next/Escape keyboard navigation in modal | Implemented | `index.html:1271-1275,1543-1554` |
| Missing screenshot fallback | Implemented | `index.html:1228-1245` |
| Share/download podium image | Implemented through html2canvas | `index.html:22,1499-1528` |
| League link to official FPL site | Implemented | `index.html:831-837,1302-1307` |
| SportsOrganization and champion ItemList JSON-LD | Implemented | `index.html:1277-1300` |
| Social metadata and social image | Implemented | `index.html:6-18` |

## Live league

| Feature | Status | Evidence |
| --- | --- | --- |
| Current classic-league standings | Implemented and observed live | `functions/api/standings.js:1-2,133-167`; `index.html:1431-1496` |
| Current and new league entries | Implemented | `functions/api/standings.js:82-86,162-167`; `index.html:1447-1483` |
| Rank movement indicator | Implemented and observed live | `index.html:1377-1385` |
| Current gameweek points | Implemented | `functions/api/standings.js:93-103`; `index.html:1458-1462` |
| Current calendar-month points | Implemented | `functions/api/standings.js:26-35,88-103`; `index.html:1460` |
| Season points | Implemented | `functions/api/standings.js:100-103`; `index.html:1462` |
| Career season count | Implemented | `functions/api/standings.js:58-79`; `index.html:1392` |
| Career-best rank percentile and season | Implemented | `functions/api/standings.js:58-79`; `index.html:1393-1394` |
| Career-average rank percentile | Implemented | `functions/api/standings.js:58-79`; `index.html:1395` |
| Next-gameweek deadline | Implemented and observed live | `functions/api/standings.js:37-49,169-185`; `index.html:1357-1375` |
| Metric selector: October/gameweek/season | Implemented | `index.html:1405-1429` |
| Collapsed initial list with expand control | Implemented and observed live | `index.html:1411-1428,1485-1491` |
| FPL profile links for live managers | Implemented and observed live | `index.html:1388` |
| Explicit unavailable state | Implemented | `index.html:1492-1496` |
| Data freshness timestamp | API emits `fetchedAt`; client renders “Last updated” | `functions/api/standings.js:181-185`; `index.html:1484-1491` |

## Backend and delivery

| Capability | Status | Evidence |
| --- | --- | --- |
| Cloudflare Pages static hosting | Live at <https://the-abusement-park.pages.dev/> | `wrangler.jsonc:1-6` |
| Pages Function routing restricted to `/api/*` | Configured | `_routes.json:1-5` |
| Server-side FPL requests | Implemented | `functions/api/standings.js:18-23,133-177` |
| Edge cache | Implemented with 120-second aggregate TTL | `functions/api/standings.js:5,122-131,188-195` |
| Cache outcome header | Implemented | `functions/api/standings.js:127-130,188-191` |
| Invalid status/JSON/top-level-shape handling | Implemented | `functions/api/standings.js:133-167` |
| Optional event-schedule degradation | Implemented | `functions/api/standings.js:169-175` |
| Optional per-manager-history degradation | Implemented | `functions/api/standings.js:90-116` |
| Non-GET rejection with 405 and `Allow: GET` | Implemented | `functions/api/standings.js:198-203` |
| GitHub Pages deployment | Configured, but static-only and not equivalent to Cloudflare production | `.github/workflows/static.yml:1-43` |

## Data sources and ownership

### Historical source of truth

The `seasons` array stores season, winner, runner-up, and screenshot path (`index.html:862-881`). It is manually curated and has no provenance field. `MANAGERS_EXTRA` adds known titleless managers (`index.html:856-860`).

### Live source of truth

The Function consumes these public FPL endpoints:

- `/api/leagues-classic/113546/standings/`
- `/api/bootstrap-static/`
- `/api/entry/{entry}/history/`

See `functions/api/standings.js:1-4`.

### Duplicate/manual live metadata

`CURRENT_LEAGUE_PLAYERS` stores 20 manually maintained current-player profiles (`index.html:890-910`). Its career fields override API-derived history (`index.html:1447-1457`). This table is useful as identity evidence but should not remain an authoritative metric source.

## Missing archive assets

Configured but not tracked:

- `images/2009.png`
- `images/2010.png`
- `images/2011.png`
- `images/2012.png`
- `images/2013.png`
- `images/2014.png`
- `images/2015.png`
- `images/2017.png`
- `images/2019.png`
- `images/2021.png`

Tracked archive screenshots exist for 2016, 2018, 2020, and 2022–2026.

## Explicitly missing product capabilities

The repository contains no implementation for:

- Manager squad/picks endpoint.
- Captain and vice-captain analytics.
- Bench selections or bench-point loss.
- Transfer history or transfer efficiency.
- Fixture and difficulty analysis.
- Live player/event performance.
- Effective ownership or differential calculations.
- Projected points, projected standings, or championship probabilities.
- Manager profile routes.
- Head-to-head or rivalry records.
- Stable historical-manager identity registry.
- Automated gameweek awards.
- Client-side navigation for Dashboard, Live League, Managers, Analytics, Hall of Fame, and Predictions.

These are missing features, not defects in the present historical dashboard. They should be delivered as separate, cache-aware slices after the foundation and API-hardening work.

## Accessibility and responsive inventory

Implemented in source:

- English document language and mobile viewport (`index.html:2-5`).
- Mobile breakpoint at 640 px (`index.html:489-539,634-665`).
- Reduced-motion override (`index.html:541-548`).
- Native buttons for filters, modal controls, sharing, and live expansion.
- Tab semantics and selected states (`index.html:777-782,1166-1175`).
- Dialog role, modal state, label association, Escape key, and focus restoration (`index.html:840-850,1247-1275`).
- Keyboard activation for archive cards (`index.html:1321-1342`).

Still requiring observed validation:

- 320 CSS-pixel reflow and 200%/400% zoom.
- Keyboard-only traversal and visible focus across every control.
- Tablist arrow-key behavior.
- Modal focus containment.
- Screen-reader reading order and dynamic announcements.
- Contrast in all glass/gradient states.
- Touch-target sizing.
- Error, empty, slow-network, missing-image, and script-failure flows.

## External runtime dependencies

- Google Fonts: Bebas Neue, JetBrains Mono, DM Sans (`index.html:19-21`).
- html2canvas 1.4.1 from cdnjs (`index.html:22`).
- Public FPL endpoints (`functions/api/standings.js:1-4`).
- Browser support for `IntersectionObserver`, `Intl.DateTimeFormat`, Fetch, and modern DOM APIs (`index.html:1309-1319,1366-1374,1431-1496`).

Chart.js is described in the README (`README.md:10`) but is not loaded or used in the audited `index.html`; it appears to be stale documentation rather than a current runtime dependency.
