# Upgrade Roadmap

## Principles

1. Keep Cloudflare Pages and Pages Functions.
2. Preserve the existing URL (<https://the-abusement-park.pages.dev/>), historical archive, live standings payload, and competitive tone.
3. Add regression protection before structural refactors.
4. Separate data types by freshness and failure mode.
5. Treat FPL entry IDs and reviewed internal manager IDs as identities; names are labels and aliases.
6. Never fabricate historical or live values.
7. Label stale data and predictions explicitly.
8. Keep every pull request independently testable, deployable, and reversible.

## Revised delivery sequence

### PR 1 — Phase 0 audit and validation baseline — P0

Scope:

- Commit the four Phase 0 documents.
- Add a minimal package manifest and pinned development tooling.
- Add CI checks for formatting/syntax, unit tests, API contract tests, and static-link/asset validation.
- Convert the current GitHub Pages workflow into a validation workflow, or clearly separate static fallback from canonical Cloudflare production.
- Add a production smoke test that checks `/` and `/api/standings` without treating live FPL values as fixtures.

Acceptance criteria:

- CI runs on pull requests and `main`.
- A failing test blocks deployment.
- No production feature or visual output changes.
- Canonical hosting and rollback procedure are documented.

Rollback: revert the workflow/tooling commit; documentation remains safe to retain.

### PR 2 — Modularize without behavior changes — P0

Scope:

- Extract CSS from `index.html`.
- Extract historical datasets and reviewed configuration.
- Extract pure statistics/identity helpers.
- Extract live API client and rendering modules.
- Keep static HTML + JavaScript and Cloudflare Pages; do not adopt a framework.
- Deploy from an explicit site output directory so repository-only files are excluded.

Acceptance criteria:

- Golden fixture tests prove historical statistics are unchanged.
- DOM/screenshot baselines match agreed desktop and mobile states.
- Existing URL, metadata, JSON-LD, modal behavior, share action, and API payload remain compatible.
- No new runtime framework dependency.

Rollback: restore the previous single-file entry point and output path.

### PR 3 — Harden FPL integration and caching — P0

Scope:

- Add request timeouts with `AbortController`.
- Add bounded manager-history concurrency.
- Validate/normalize upstream responses.
- Cache standings, bootstrap events, and manager histories independently.
- Add last-known-good fallback with explicit `fresh`, `stale`, `degraded`, and `fetchedAt` metadata.
- Add structured logging for cache outcome, request duration, upstream counts, and partial failures.
- Preserve `/api/standings` response compatibility or version additive fields only.

Acceptance criteria:

- Tests prove the concurrency ceiling.
- Tests cover timeout, non-2xx, invalid JSON, invalid shape, partial history failure, cache hit/miss, cache expiry, and stale fallback.
- Failed optional manager history does not fail standings.
- Stale data is labeled and never presented as live.
- Upstream call count on an aggregate miss is measurable.

Rollback: revert to aggregate 120-second cache and the previous Function implementation.

### PR 4 — Responsive information architecture and dashboard shell — P0

Scope:

- Introduce navigation for Dashboard, Live League, Managers, Analytics, Hall of Fame, and Predictions placeholders.
- Redesign the dashboard and live leaderboard using existing verified data only.
- Add explicit loading, empty, stale, degraded, and error states.
- Implement accessible mobile navigation.

Acceptance criteria:

- Keyboard navigation, focus visibility, dialog containment, tab behavior, reflow, contrast, and touch targets pass the documented test matrix.
- Historical features remain available.
- No invented live metrics.
- Visual regression coverage exists for core breakpoints and states.

Rollback: restore the prior page shell while keeping modular data/statistics code.

### PR 5 — Live League War Room data foundation — P0

Scope:

- Add separate services/endpoints for manager picks, captaincy, bench, fixtures, transfers, and live event performance.
- Build a gameweek summary and expandable manager detail against those endpoints.
- Keep each endpoint independently cached; do not overload `/api/standings`.

Acceptance criteria:

- Every derived field documents its inputs and formula.
- Confirmed FPL data is visually distinct from projections.
- Endpoint tests include unavailable and partial-upstream states.
- Request volume is bounded and measured.

Rollback: disable War Room navigation and remove its endpoints without affecting standings/history.

### PR 6 — Manager registry, profiles, and historical identity mapping — P1

Scope:

- Add a stable internal manager registry.
- Store display names, aliases, current/past FPL entry IDs, and evidence/provenance.
- Create dedicated manager profiles joining live and verified historical records.
- Present uncertain mappings for manual review rather than auto-merging.

Acceptance criteria:

- Every historical record resolves to one reviewed manager ID or remains explicitly unresolved.
- Rename/alias tests prevent duplicate attribution.
- Existing championship totals remain unchanged unless a correction is approved with evidence.

Rollback: retain registry data but hide profiles; historical name-based views continue.

### PR 7 — Verified advanced analytics — P1

Scope:

- Rank progression.
- Captaincy performance.
- Transfer efficiency.
- Bench-point impact.
- Manager comparison.
- Fixture and differential analysis where supported by source data.

Acceptance criteria:

- Each metric has a documented definition, denominator, edge cases, and fixture test.
- Calculations reconcile against known FPL samples.
- Missing source data yields unavailable, never zero or fabricated values.

Rollback: feature-flag individual analytics panels.

### PR 8 — Historical archive and Hall of Fame modernization — P1

Scope:

- Replace missing-image requests with explicit asset availability.
- Add verified screenshots where available.
- Build trophy cabinets, season timelines, all-time comparisons, and record views from tested historical data.
- Preserve Wall of Shame and the site's personality.

Acceptance criteria:

- No broken image requests.
- Every displayed historical claim comes from reviewed data.
- Archive modal is focus-contained and screen-reader tested.

Rollback: retain data corrections while restoring the previous archive renderer.

### PR 9 — Rivalries and gameweek awards — P2

Scope:

- Head-to-head comparisons and rivalry records from verified identity/data.
- Deterministic gameweek awards with documented rules.
- Shareable result cards with accessible text alternatives.

Acceptance criteria:

- Rules are deterministic and unit-tested.
- Ties and incomplete gameweeks are handled explicitly.
- Awards never mix provisional and final data without labels.

Rollback: disable award generation and rivalry routes.

### PR 10 — Predictions — P2, intentionally deferred

Scope:

- Projected gameweek points and standings.
- Remaining-fixture analysis.
- Championship probabilities.
- Model/data version, assumptions, uncertainty, and last-updated labels.

Entry gate:

- Live inputs and historical identities are reliable.
- Confirmed analytics reconcile against source data.
- Prediction methodology and calibration can be explained.

Acceptance criteria:

- Predictions are visually and semantically separated from confirmed statistics.
- Backtests and calibration metrics are published.
- Missing inputs suppress predictions rather than inventing values.

Rollback: remove the prediction route/feature flag without touching confirmed statistics.

### PR 11 — Production hardening — P0 release gate

Scope:

- WCAG 2.2 AA verification.
- Performance budgets and asset optimization.
- CSP rollout through report-only before enforcement.
- Dependency integrity/vendor policy.
- Error monitoring, synthetic smoke checks, cache telemetry, and rollback runbook.

Acceptance criteria:

- Core Web Vitals/performance budgets are measured on production-like builds.
- Automated accessibility checks pass and documented manual checks are complete.
- Security headers are verified in deployed responses.
- Production deployment and rollback are rehearsed.

Rollback: header/observability changes are independently reversible; never roll back verified data corrections with presentation changes.

## Dependency graph

- PR 1 precedes every implementation PR.
- PR 2 and PR 3 may proceed in parallel only after contracts/fixtures from PR 1 are stable.
- PR 4 depends on PR 2 and the additive API contract from PR 3.
- PR 5 depends on PR 3.
- PR 6 depends on the data-module boundary from PR 2.
- PR 7 depends on PR 5 and PR 6.
- PR 8 depends on PR 2 and reviewed historical data from PR 6.
- PR 9 depends on PR 6 and PR 7.
- PR 10 depends on PR 5–7 and is deliberately after confirmed analytics.
- PR 11 is continuous work, with a final gate after PR 10 or before any major public launch.

## Decision gates

A framework migration should be reconsidered only if the modular static implementation demonstrates a measurable constraint such as route complexity, build-time data generation needs, or maintainability costs that tests and modules cannot address. Supabase or another database should be introduced only when reviewed identity/history data needs authenticated editing, relational queries, or durable computed snapshots. Neither threshold is met by the audited repository today.
