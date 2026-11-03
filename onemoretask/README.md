# One More Task

A standalone incremental browser game about freelance work, automation, management, and finally having enough. The complete arc runs from Phase 1 to Phase 15, with an optional prestige cycle or a persistent retirement ending.

## Run

The game has no production dependencies or build step. Serve this directory over HTTP:

```sh
npm run serve
```

Open http://127.0.0.1:4173. Python 3 is needed for this development server. Any static web server works, including the repository's existing GitHub Pages hosting.

## Play

- Start with **Find Work**, then **Do Task**. Once the queue opens, **Work** starts a job. Jobs already in progress do not expire.
- Automated tasks stay on the board for at least two seconds, and completed cards remain visible briefly.
- Buy upgrades as they become available. All eligible upgrades are visible, so optional purchases cannot hide a phase unlock.
- Top up the first AI worker to keep it running. From Phase 4, hire specialists. One reserve token provides one fuel unit, with ten units in a full worker tank; it also explicitly starts one job. **Auto OFF** stops subsequent automatic assignments. Assigned managers override individual automation switches.
- Hire a Manager in Phase 6. A manager distributes fuel to every worker, including AI Worker Pro, and assigns work. **Refill manager** charges only for the missing fuel, using whatever tokens you have.
- Hire a Token Manager in Phase 7 to buy tokens, refill the Manager, and fuel workers. DevOps resolves all incidents automatically. Critical incidents take twice as much response time.
- Phase 9 introduces clusters. The existing team becomes Cluster 1 with a complete management team. Open another empty cluster, buy one Management team ($12K) containing Manager, Token Manager and DevOps, then hire workers ($2.5K each) directly into it. Each cluster has eight worker slots.
- The AI CEO first manages existing clusters. Scale Mode buys management teams, hires workers and opens new clusters. Before abstraction there are up to eight clusters. Expansion costs $50,000, needs a cash reserve, and initially makes one decision every ten seconds.
- Phase 11 sends the CEO on a course, reducing the interval to five seconds. Phase 12 abstracts workers into compact autonomous nodes with no internal controls. Complete nodes initially cost $1M, with the CEO retaining another node cost as reserve. Phase 13 unlocks at 12 managed nodes, cuts node costs by 35%, and expands every two seconds. Phase 14 unlocks at 40 nodes, cuts costs another 40%, and expands every second. The network supports 128 nodes, and 100 are required to retire.
- Recurring service upgrades automatically deploy the advertised capacity. Services earn $80/s each before downtime and upkeep, and appear in the cluster panel.

## Finish

In Phase 15, choose either:

1. **Retire & Restart**: prestige with permanent click power, starting tokens, and the extra starting agent slot. Music preference is retained.
2. Buy **Sell The Company**, then **Walk Away Forever** once reputation is at least 200, debt is below 10, there are at least 100 managed nodes, no unresolved incidents, and estimated income exceeds twice expenses. The sale settles at current cash plus 120 seconds of estimated income. The ending persists on reload and gameplay freezes. Starting a new story requires confirmation.

Income estimates use whole-job throughput rather than the remaining time on a nearly finished job. Empty worker tanks contribute no task income.

## Saves and offline progress

Progress is stored locally in the browser, automatically every ten seconds and when leaving or hiding the page. No accounts, backend, or network saves are required.

**Breaking change:** this release uses save format version 2 and does not migrate version 1 or unversioned saves. Invalid or incompatible saves are preserved until the player explicitly resets them. A visible notice explains the problem. Storage failures remain visible and can be retried.

Offline earnings are limited to recurring services and referral contracts at 50% efficiency, minus expenses, for up to eight hours. Offline losses are forgiven. Busy-worker snapshots do not generate offline income. Returning from a background tab follows the same rule. Story and settings dialogs pause foreground simulation.

## Verify

Use Node.js 22.13 or later (or Node.js 24+) and Python 3:

```sh
npm ci
npm test
npm run coverage
npm run test:balance
npm run test:browser
```

Browser checks use the installed macOS Chrome when available. Else install Playwright Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a Chromium executable. `npm run check` runs syntax, regression, coverage, and browser checks together.

- Regression tests cover automation, cluster scope, purchases, services, incident escalation, retirement, prestige, storage failures, lifecycle timing, and keyboard focus.
- Three deterministic 15-phase playthroughs start from zero cash without cheats or resource grants and reach retirement with 100 nodes. They exercise a very active player, so their timings are a progression regression check, not a prediction of human playtime.
- A separate five-minute Phase 7 simulation verifies sustained automation without manual refills.
- Coverage requires **100% of added or changed executable game lines** relative to release baseline `45bc33c`. The report also displays coverage of the entire legacy game; that is a separate metric. No production code is excluded from instrumentation.
- Chrome checks cover desktop, 320px and 390px portrait phones, landscape, scrolling, keyboard activation/focus, invalid-save reset, and ending persistence. Screenshots are written to ignored `test-results/`.

The fixed coverage baseline keeps the release coverage requirement enforceable after these changes are committed. When establishing a future release baseline, update it deliberately in `tests/coverage-check.cjs`.

## Release

Run `npm run check`, then publish the static runtime files through the repository's normal deployment process:

- `index.html`
- `game.js`
- `favicon.svg`
- `soundtrack-loop.mp3`
- `precursor_kick.mp3`
- `dnb_deep_loop.mp3`

Do not publish `node_modules`, coverage reports, or test artifacts. Tests and tooling are development-only. This work does not require a new hosting service.

The canonical design reference is [the repository design spec](../DESIGN.md). Advanced routing topology, dynamic cluster worker caps, and autonomous CEO strategy customization remain explicitly outside this game's release scope.
