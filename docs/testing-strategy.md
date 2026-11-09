# Testing Strategy

## Current baseline

No automated application tests, test runner, package manifest, lockfile, lint configuration, or dedicated Cloudflare test configuration are tracked at `c9b768d`. The GitHub workflow deploys but does not validate (`.github/workflows/static.yml:24-43`).

Production site: <https://the-abusement-park.pages.dev/>.

Checks executed during Phase 0:

| Check | Result |
| --- | --- |
| Clean `main` aligned with `origin/main` before audit branch | Pass |
| `git diff --check` | Pass |
| Inline JavaScript parsed by Node.js 22.22.3 | Pass |
| `npx wrangler pages dev . --port 8788` compilation | Pass with Wrangler 4.151.1 |
| Local `/` response | HTTP 200 |
| Local `/api/standings` response | HTTP 200 |
| Local API shape sample | 26 standings, 0 new entries, 26 manager metrics |
| Production `/` response | HTTP 200 |
| Production `/api/standings` response | HTTP 200 |
| Production API headers | `Cache-Control: public, max-age=120`; `X-FPL-Cache: MISS` |
| Static live-page extraction | Live standings and historical dashboard content present |
| Full interactive browser pass | Blocked by unavailable remote browser and locked local Chrome profile |

The live FPL payload is not a stable fixture. Tests must capture representative sanitized fixtures and avoid asserting current ranks, names, scores, or deadlines in CI.

## Test architecture

### 1. Pure unit tests

Extract pure functions first, then cover:

Historical calculations:

- Season filtering: all, last five, last ten.
- Title tallies and deterministic tie ordering.
- Trailing streak and longest streak.
- Seasons since last win and membership start date.
- Runner-up totals and chief-bottler selection.
- Never-won and drought calculations.
- Comeback gap calculation.
- Empty, one-season, ties, aliases, and incomplete runner-up data.

Current code locations: `index.html:987-1125`.

Manager calculations:

- `currentMonthEventIds()` across UTC month/year boundaries.
- `nextDeadline()` with `is_next`, fallback sorting, invalid dates, and no future event.
- `formatPercentage()` rounding.
- `careerProfile()` with missing, malformed, tied, and partial historical rows.

Current code locations: `functions/api/standings.js:26-80`.

Identity behavior:

- Alias normalization.
- Stable manager-ID lookup.
- Duplicate/ambiguous alias rejection.
- Entry-ID reassignment and historical entry retention.

Current provisional name-based logic: `index.html:934-963`.

### 2. API contract and resilience tests

Run the Pages Function with mocked `fetch`, cache, and `waitUntil`.

Required cases:

- Cache hit skips every upstream call and emits `X-FPL-Cache: HIT`.
- Cache miss returns validated standings and writes one aggregate response.
- Non-GET returns 405 with `Allow: GET`.
- Standings network failure returns 502/no-store.
- Standings non-2xx returns 502/no-store.
- Invalid JSON returns 502/no-store.
- Missing mandatory arrays returns 502/no-store.
- Bootstrap failure retains standings and sets deadline unavailable/degraded.
- One manager-history failure yields null fields only for that manager.
- Manager request concurrency never exceeds the configured bound.
- Timeout aborts upstream work within the configured budget.
- Independent caches honor their data-specific TTLs.
- Last-known-good fallback includes accurate `stale` and age metadata.
- Output does not leak unexpected upstream fields after normalization.

Current endpoint behavior: `functions/api/standings.js:82-203`.

### 3. DOM/component tests

Use a DOM environment for rendering and interaction logic:

- Historical filters update selected tab and content.
- Podium and standings render safely with escaped names.
- Empty historical data does not throw.
- Live loading, empty, error, degraded, stale, and success states.
- Live metric selector updates values and accessible labels.
- Expand/collapse state and `aria-expanded` remain synchronized.
- Missing archive image shows explicit fallback.
- Modal opens, closes, restores focus, and blocks focus escape after remediation.
- Archive cards activate with Enter and Space.
- Share failure restores the button and visual state.
- Third-party script unavailable produces a usable fallback.

### 4. End-to-end browser tests

Run against `wrangler pages dev` with deterministic API interception/fixtures.

Viewport matrix:

- 320 × 568
- 375 × 667
- 390 × 844
- 768 × 1024
- 1280 × 800
- 1440 × 900

Critical journeys:

1. Load dashboard and see historical content before/while live data resolves.
2. Switch All Time / Last 5 / Last 10 using pointer and keyboard.
3. Change live period, expand/collapse managers, and open an FPL profile.
4. Open an available archive image, navigate next/previous, close, and regain focus.
5. Open a missing archive image and receive the unavailable state.
6. Generate/share the podium artifact or receive a recoverable failure.
7. Exercise API timeout, 502, invalid payload, stale fallback, and offline states.

Browser assertions:

- No uncaught console errors.
- No unintended horizontal page overflow.
- No broken asset requests other than deliberately tested missing fixtures.
- External links use the intended destination and security attributes.
- Dynamic states have accessible names and announcements.

### 5. Accessibility testing

Automated:

- axe-core on every critical route/state and breakpoint.
- HTML validation.
- Color-contrast checks for normal, hover, focus, stale, error, and disabled states.

Manual WCAG 2.2 AA checks:

- Keyboard-only operation and logical focus order.
- Visible focus for every control.
- Native/expected tablist arrow navigation.
- Modal focus containment, Escape, and focus return.
- 200% browser zoom and 400% text/reflow where applicable.
- 320 CSS-pixel reflow without two-dimensional scrolling for ordinary content.
- VoiceOver + Safari reading order, labels, table/list semantics, and status announcements.
- Touch targets and spacing on mobile.
- Reduced-motion preference.

Do not report “WCAG pass” from source review or axe alone. Record browser, OS, assistive technology, viewport, date, and tester for manual evidence.

### 6. Visual regression

Capture approved baselines for:

- Dashboard desktop/mobile.
- Live success/loading/error/stale states.
- All three historical filters.
- Modal available/missing screenshot states.
- Long manager/team names and tied statistics.

Mask only genuinely volatile values such as current points and timestamp text. Do not mask layout containers or status labels.

### 7. Performance and resilience budgets

Measure production-like output, not source estimates:

- Initial HTML/CSS/JS transfer and parse cost.
- Largest Contentful Paint, Interaction to Next Paint, and Cumulative Layout Shift.
- Live API p50/p95 duration.
- Aggregate and per-data-type cache hit rate.
- Upstream calls per request.
- Maximum concurrent FPL requests.
- Partial-history failure count.
- Stale-response count and age.

Initial engineering budgets should be committed only after the first reproducible measurement. The hard invariant before then is bounded concurrency and no unbounded dependency fan-out.

### 8. Security checks

- Dependency audit after a lockfile exists.
- Secret scanning; no credentials belong in client code or fixtures.
- CSP in report-only mode before enforcement.
- SRI or vendoring for externally executed scripts.
- Response-header verification on both static and Function responses.
- Fuzz/contract tests for hostile strings in names/team names.
- Confirm API emits only public FPL data intended for browser use.

## CI pipeline

Recommended required jobs:

1. `static`: formatting, HTML validation, JavaScript lint/type checks, asset-reference validation.
2. `unit`: statistics, identity, and API helper tests.
3. `api`: Pages Function contract/cache/resilience tests.
4. `browser`: deterministic smoke journeys against local Wrangler.
5. `a11y`: axe scans on critical states.
6. `build`: assemble an explicit deploy directory and reject repository-only files.
7. `deploy-preview-smoke`: check preview `/` and `/api/standings` before production promotion.

Pin the Node version, package manager, lockfile, Wrangler version, test runner, and browser version. Do not use the live FPL service for deterministic CI; reserve live probes for a non-blocking or rate-limited contract monitor.

## Fixture policy

Store sanitized fixtures for:

- Valid 26-manager standings.
- Empty `new_entries`.
- Partial manager history.
- Invalid standings shape.
- Bootstrap with next deadline and with no next event.
- Month crossing UTC year boundary.
- Historical archive with ties, missing runner-up, aliases, and missing screenshots.

Every fixture must record its source endpoint, capture date, redaction status, and purpose. Update fixtures intentionally through review; never overwrite them automatically from production.

## Release evidence required per PR

Each implementation PR should include:

1. Summary and changed files.
2. Technical rationale and affected contracts.
3. Exact commands and results.
4. Screenshots for changed UI states at desktop and mobile.
5. Accessibility evidence for changed interactions.
6. Performance impact and upstream call-count impact.
7. Known limitations.
8. Rollback instructions.

No automatic merge is part of this strategy.
