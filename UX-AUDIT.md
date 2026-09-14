# OpenReply UX and performance audit — 14 September 2026

Scope: authenticated campaign list and Instagram Overview inspected in the live desktop browser; dashboard, navigation, campaign detail, builder data requests, inbox cache, and related APIs inspected in source. Read-only audit of application behavior; no application changes or deployment. No controlled latency benchmark, mobile browser run, or complete keyboard/assistive-technology test was performed. Findings about latency identify request structure, not measured seconds or a proven hosting bottleneck.

## Assessment

Implementation integrity: needs work. The restrained visual system is coherent, but navigation titles, account scope, error states, and operational status do not consistently describe what the application is doing. Impeccable's mechanical detector returned no findings for the four inspected shell/list/dashboard files; the issues below were independently verified in source or live UI. A clean detector result is not a clean UX audit.

Provisional scores for inspected scope, not a WCAG certification:

| Dimension | Score / 4 | Evidence |
|---|---:|---|
| Accessibility | 2 | Global focus treatment exists; campaign navigation is a clickable div, switches lack names/state, small controls |
| Performance | 1 | Repeated full-data fetches, seven serial chart queries, per-post live insights blocking Overview |
| Responsive design | 2 | Responsive grids, drawer, safe-area and input-size handling exist; compact action targets need device verification |
| Theming | 3 | Shared light-theme tokens and consistent panels; some direct zinc colors remain |
| Implementation integrity | 2 | Account scope and error displays can misrepresent reality |
| Total | 10 / 20 | Significant improvements needed |

Nine grouped findings: seven P1, two P2. No new P0 confirmed during this inspection.

## Findings, in implementation order

1. **P1 — Failed reads can look like missing data.** `app/(dashboard)/campaigns/page.tsx`, `fetchAutomations`, logs errors and clears loading without rendering an error; the empty array then produces “No campaigns yet.” Campaign detail turns unsuccessful responses and network errors into “not found.” Dashboard silently falls back to zeros. Preserve the last successful result and render an explicit error with Retry. Distinguish success with zero records, unavailable data, unauthorized access, and a real 404. This is particularly important after the earlier data-loss incident. Command: `impeccable harden`.

2. **P1 — Read and update status needs to be trustworthy.** Campaign list and detail toggles await fetch but do not check HTTP success before updating local active state. A server rejection can appear successful. Add pending state, validate responses, and restore the previous state on failure. The current Active badge describes `isActive`, not whether Instagram credentials or the worker are healthy. Show campaign enablement separately from connection/delivery health and provide an account-specific Reconnect action when needed. A nonempty token is not proof of validity. Command: `impeccable harden`.

3. **P1 — Overview waits for expensive external work.** `app/api/instagram/overview/route.ts` loads media, fetches insights for each post with concurrency eight, then loads accounts and follower history before returning. Default is 50 posts; All time caps at 500. The client has no overview cache and replaces its content and controls with skeletons on account/range changes. Persist account-scoped snapshots, show last-updated time, refresh in the background, and load post details incrementally. Keep controls visible. Honor refresh limits and invalidate appropriately. Command: `impeccable optimize`.

4. **P1 — Navigation repeatedly requests more data than needed.** Campaign list and builder call `/api/dashboard/stats` for accounts even though `/api/instagram/accounts` exists. Stats runs a large parallel query group followed by seven sequential daily counts. Campaign detail downloads all campaigns and their analytics to find one ID. The list endpoint aggregates workspace-wide history even when filtering one account. Use the lightweight account endpoint, a single grouped daily-count query, account-scoped analytics, and a workspace-authorized single-campaign read. Reuse the existing client cache for immediate return visits with invalidation after edits/imports; never hide new writes behind stale data. Command: `impeccable optimize`.

5. **P1 — Overview's account label misstates the scope.** Live UI says “All accounts” while showing “50 posts from @yusufsuhair.” `getWorkspaceInstagramAccount` chooses one account for the all value. Use a concrete selected account on single-account analytics, or implement a genuine combined view. Do not present one account as a combined total. Command: `impeccable clarify`.

6. **P1 — Location and context are lost between pages.** `components/top-bar.tsx` lacks Overview, Inbox, and dynamic campaign paths, falling back to Dashboard. This is visible on Overview. Campaign search/status/account are local state; Dashboard and Logs also initialize account to all, so the user's account context is not shared. Correct titles, add campaign breadcrumbs, persist filters in the URL and restore list position after returning. Suggested navigation: Home, Campaigns, Inbox, Analytics, Activity; move Diagnostics under Settings. Treat labels/grouping as a proposal, not an implemented change. Commands: `impeccable clarify`, `impeccable distill`.

7. **P1 — Campaign controls need accessible semantics.** Cards use `div onClick` for detail navigation; they are not native keyboard links. Toggle buttons have no accessible name or checked state. Live accessibility output shows unnamed buttons. Use an actual campaign-title Link, labelled switches with state, accessible menus, and focus management for the mobile drawer and video dialog. Check WCAG 2.1.1 and 4.1.2. Command: `impeccable harden`.

8. **P2 — Campaign cards are expensive to scan.** In the 1920×963 live viewport, roughly three full cards are visible. Each repeats account/status, multiple keyword case variants, DM body, raw tracking URL, six metrics, and keyword counts. Use compact rows with title/post, account, state, sent, clicks, and failures; move message, full URLs, and keyword breakdown into details or an expandable section. Keep filtering visible while scrolling and make failures an actionable link to filtered activity. Do not merge keyword variants until matching semantics are verified. Command: `impeccable distill`.

9. **P2 — Small secondary controls and inconsistent loading feedback.** Campaign switches are 24px high; menu and copy controls are compact. Navigation has no dedicated route loading boundaries in the inspected app, though several pages have local skeletons. Enlarge hit areas while keeping visuals compact; preserve the shell and page controls during loading; announce pending/error states. A 44px touch target is a practical target, not a claim that every smaller control automatically violates WCAG AA. Verify drawer behavior and content overflow on real mobile sizes. Commands: `impeccable adapt`, `impeccable polish`.

## What to keep

- Simple light palette, consistent panels, and minimal decorative effects.
- Sidebar already uses Next Link and marks the active page; preserve that instead of replacing it wholesale.
- Inbox already has cached content with background revalidation, useful as an incumbent pattern.
- Responsive grids, dynamic viewport height, safe-area padding, and mobile input sizing show deliberate mobile support.
- Bounded concurrency for insights prevents unbounded requests; optimize around it rather than removing the limit.

## Suggested delivery sequence and verification

1. Correct misleading errors, mutation feedback, account scope, and page titles (`impeccable harden` / `clarify`).
2. Reduce unnecessary requests and preserve content during navigation (`impeccable optimize`). Measure cold and warm navigation separately, endpoint durations, and number of calls before/after. Do not promise a speedup percentage before this baseline.
3. Compact campaign scanning and preserve filter/location context (`impeccable distill`).
4. Verify keyboard and mobile flows (`impeccable adapt`), then finish with `impeccable polish`.

Acceptance checks: rejected reads never display an empty database; rejected toggles never display success; All accounts means an actual aggregate; returning to a campaign list preserves account/search/status/position; cached data updates after creation/import/edit; overview controls remain usable while refreshing; every campaign can be opened and controlled with a keyboard. Refresh failures must leave a visible stale-data warning.

These changes can be run individually or together. Re-run the scoped audit after implementation to assess progress.
