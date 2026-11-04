# One More Task

A standalone incremental browser game about freelance work, automation, management, and finally having enough. The complete arc runs from Phase 1 to Phase 15, with an optional prestige cycle or a persistent retirement ending.

## Run

The game has no production dependencies or build step. Serve this directory over HTTP:

```sh
npm run serve
```

Open http://127.0.0.1:4173. Python 3 is needed for this development server. Any static web server works, including the repository's existing GitHub Pages hosting.

## Play

- Start with **Find Work**, then **Do Task**. Once the queue opens, **Work** starts a job. Completed cards disappear immediately, keeping the next Work button in place. Jobs already in progress do not expire.
- Up to three ordinary upgrades reveal together, including unaffordable purchases to save towards. Major phase transitions and the second subscription require all preceding upgrades. Free AI requires all earlier upgrades and 150 tasks, after Reality Check. Phase 2 starts with no upgrades; Few-Shot Prompting and Marketing Campaign appear together at 200 tasks, and the $3,500 Upgrade to AI 2000 Basic requires 300. Phase 3 groups begin at 350, 425 and 500 tasks. Second AI Subscription costs $18K and requires 650 tasks; the $25K licence requires 750 tasks. Every phase transition requires the preceding upgrades. Reputation has been removed.
- Phase 3 requires **Second AI Subscription** before the **Multi-Agent Licence** becomes available. Both subscriptions need manual top-ups. The licence converts them into normal agent cards, preserving loaded tokens and current jobs. The original AI 2000 Basic becomes an explicitly labelled older, slower model that can be sold and replaced. AI 2000 Basic and AI 2000 Pro use matching token bars and Top-up tokens buttons through Phase 4.
- Every agent and Manager uses **Top-up tokens**. Partial top-ups deduct exactly the missing amount from reserve tokens, even with a Manager online. The bar shows tokens loaded into that agent. Top-up buttons always stay enabled. Token amounts are whole numbers, and tok/s is a five-second smoothed average of actual consumption. Workers have Sell buttons and no Auto toggle.
- Worker capacity and consumption rise through Phase 6. Eight continuously working Phase 6 agents use about 29,000 tokens per minute after all efficiency upgrades. Managers hold 4,000 tokens and distribute them in small increments while continuing to assign jobs. An empty Manager continues assigning work while agents have tokens left.
- The Phase 7 unlock adds a dedicated Token Manager slot first. A purchased Manager is required to enter this phase. The additional agent slot appears in Phase 8. The Token Manager buys token packs with cash and distributes them automatically. The top bar shows reserve tokens and current consumption.
- Token pack quantities scale with workload. Token prices rise by 2% of the base price per pack bought, including automatic purchases. New incident costs scale with lifetime earnings. DevOps resolves all incidents automatically; critical incidents take twice the response time.
- Manager and Token Manager cards have a slightly lighter background. DevOps and its purchase button live at the top of Incidents. Empty task and upgrade sections have no explanatory placeholder text; empty upgrades reserve one card of vertical space.
- Phase 8 uses simpler agent cards. The Phase 9 acquisition costs $1.5M. Tasks completed appears first in the top bar; there is no dashboard panel.
- In Phase 9, the existing team becomes Cluster 1. The Operations Blueprint precedes the Second Cluster Permit, which unlocks **Provision cluster**. A later permit requires a fully staffed second cluster and allows a third cluster. All three must be full before Phase 10. Cluster upgrades require every existing cluster to be built and fully staffed, except the two CEO provisioning upgrades, which remain available while staffing. Provisioning builds an empty shell over 12 seconds; buy its management team for $12K, then buy agents for $2.5K each. All eight agent slots remain visible once construction finishes, including under CEO management. Part-filled automated clusters say Scaling; full clusters say Operating or Awaiting tokens. Cluster cards use a grid before the CEO is bought.
- Every subsequent provision costs more. Fully staffed spare clusters can be sold using Sell. Sales do not reset provisioning prices.
- CEO training cuts construction from 12 to 6 seconds and halves the CEO decision interval. New shells show a construction progress bar; Phase 14 cuts construction to 2 seconds. DevOps automatically reduces technical debt; there is no Pay Down Tech Debt button.
- AI CEO **Manage Mode** staffs existing clusters and changes the status display. Provisioning Pipeline ($600K) halves its decision interval; Batch Onboarding ($1.2M) hires two agents per round. **Scale Mode** additionally provisions more clusters, with no eight-cluster cap. Phase 10 cards simplify when the CEO is hired.
- Phase 12 introduces compact nodes. Provision each one manually; the CEO automatically employs its team. Phase 13 unlocks automatic replication after reaching at least twenty online nodes and adding at least nine nodes during Phase 12. Its upgrade is hidden until twenty shells exist, then waits for all required nodes to be online and reduces provision costs by 35%. Phase 14 unlocks at forty nodes, reduces costs another 40%, and uses dense `C1`, `C2`, etc. boxes. There is no fixed node cap; prices continue rising.
- Client retainer upgrades deploy contracts automatically, each earning $80/s before downtime and $2/s upkeep. The cluster footer shows the active contract count and current income after downtime. Two managed clusters increase agent task speed by 50%; three or more double it.
- Layered music adds a bright D4 + F4 synth motif from Phase 5: both notes sound together in two five-hit phrases per 4/4 bar, with each phrase lasting two beats. The 125 ms plucks have a slightly stronger middle hit, subtle stereo chorus and a light reverb tail. It fades in over eight seconds at a quiet background level and continues alongside the later drum layer. Music: On plays the base soundtrack; Music: Off silences every layer.

## Early automation and hiring checkpoints

The original agent is AI 2000 Free in Phase 2. Upgrade to AI 2000 Basic renames it in Phase 3, where the lifestyle is Coffee Shop Regular. The second subscription is AI 2000 Pro. The income estimate includes the original agent using the same work-rate calculation as its production loop; empty tanks and idle agents add no estimated task income.

The first incident, whether triggered by a random failure or the twenty-second tutorial timer, introduces incidents exactly once. A timed introduction cannot also create a random incident in that tick. Prompt Engineering 101 appears in Phase 4 after at least three incidents have occurred, costs $3,200, and reduces failure rate by 20%.

The initial licence has three total slots. Buying the third specialist and buying Task Templates exposes the four-slot expansion, priced at $5,000. Parallel Prompting ($3,800, +15% speed) and Response Streaming ($5,200, +20% speed) follow that expansion and are required before six slots. Specialist roles may be bought repeatedly; Manager, Token Manager and DevOps remain unique. DevOps has its own slot in Incidents and does not consume shared agent capacity. This makes every advertised specialist slot usable.

Unlocked empty Manager and Token Manager positions are dashed purchase cards at the top of Agents. Those positions are reserved until bought. Each other empty slot has its own dashed card with direct buttons for buying each specialist type. Unaffordable purchases remain disabled. Buying a Manager costs $20,000, separately from its unlock upgrade.

Phase-entry task minimums are 150, 300, 750, 1,150, 1,350, 1,550, 1,750, 2,000, 2,400, 2,800 and 3,200 for Phases 2 through 12. Later transitions use node requirements.

Phase 5 gives its tools and operations upgrades more room: Web Search Tool costs $7,500, Sales Playbook $12,000, Code Execution Tool $16,000 and Revenue Ops System $28,000. In the seed-17 active-player simulation, the phase lasts 41.5 seconds rather than 17.5 seconds. This is a comparative pacing check, not a human playtime target.

Empty agent slots offer one-click Buy Writer, Buy Researcher, Buy Coder, Buy Analyst and Buy Support buttons, with Buy Sales appearing in Phase 8. The card shows the per-agent price; each purchase button is disabled when unaffordable. There is no role dropdown. DevOps has a matching dashed Buy DevOps placeholder with its price and a Dedicated incident slot label. Full shared capacity cannot block that purchase.

Player-facing actions use Buy for agents and management teams, and Provision cluster for infrastructure. The Token Manager upgrade description is “Automatically buy tokens when they run out.” Its existing automatic purchasing and distribution behaviour is retained.

## Company leadership and delivery

From Phase 10, token purchasing becomes one company-wide Token Manager service, shown beside the AI CEO in agent cards above the cluster grid. Cluster managers and DevOps remain local to each team. The Token Manager automatically supplies every managed cluster and shows reserve tokens, smoothed consumption and its latest purchase. Transfers continue in small increments: up to 250 tokens into each cluster and 25 into each agent per 100ms tick. Purchases still deduct cash and follow the existing pack-price curve. There is no additional manual Manager-refill requirement.

Cluster work capacity scales with the company: twelve task spaces and one arrival per spawn interval for each managed cluster. This removes the old twelve-task ceiling across the entire company. A three-cluster Phase 10 regression scenario consumes over 60,000 tokens in one minute while conserving total tokens across reserve, cluster and agent tanks.

An outlined, dashed Provision cluster card occupies the next free position in the grid. It shows the price, remains disabled when unaffordable, and disappears at the current cluster limit. Cluster sale controls read Sell. Provisioning still needs the relevant permit or CEO scale mode; Phase 12 remains manual until replication.

At two managed clusters, the task board defaults to a compact Delivery panel: a ten-second smoothed completion rate shown per minute, queued and in-progress counts, and the last three completed tasks. Show tasks expands the existing interactive task list. A phase change returns to the compact view. From Phase 12 the panel shows the delivery rate, managed-node count and delivery revenue without individual task controls. Observation history and the expanded-list preference are session-only, reset on a new story, and do not alter the save schema.

## Finish

In Phase 15, buy **Sell the Company and Retire Early!** when debt is below 10, there are at least 100 managed nodes, no unresolved incidents remain, and estimated income exceeds twice expenses. The sale settles at current cash plus 120 seconds of estimated income, freezes the company, and opens a separate golf-and-health ending screen.

Choose on that screen:

1. **Interesting, there's another model out…** starts again with permanent click power, starting tokens, and the earned extra starting agent slot. The introduction and first manual task return with different story text. Music stops, while its preference is retained.
2. **Actually retire** completes the permanent ending. Starting a new story from there requires confirmation.

Both ending stages persist on reload. There is no restart or retirement choice before selling the company.

Income estimates use whole-job throughput rather than the remaining time on a nearly finished job. Empty agent tanks contribute no task income.

## Saves and offline progress

Progress is stored locally in the browser, automatically every ten seconds and when leaving or hiding the page. No accounts, backend, or network saves are required.

**Breaking change:** this release uses save format version 7 and does not migrate earlier saves. Invalid or incompatible saves are preserved until the player explicitly resets them. A visible notice explains the problem. Storage failures remain visible and can be retried.

Offline earnings are limited to recurring services and referral contracts at 50% efficiency, minus expenses, for up to eight hours. Offline losses are forgiven. Busy-agent snapshots do not generate offline income. Returning from a background tab follows the same rule. Story and settings dialogs pause foreground simulation.

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
- Three deterministic 15-phase playthroughs start from zero cash without cheats or resource grants and reach retirement with more than 100 nodes. They also verify that the subscription, second AI and multi-agent licence are initially unaffordable when first offered. They exercise a very active player, so their timings are a progression regression check, not a prediction of human playtime.
- A separate five-minute Phase 7 simulation verifies sustained automation without manual refills.
- Coverage requires **100% of added or changed executable game lines** relative to release baseline `45bc33c`. The report also displays coverage of the entire legacy game; that is a separate metric. No production code is excluded from instrumentation.
- Chrome checks cover desktop, 320px and 390px portrait phones, landscape, scrolling, keyboard activation/focus, invalid-save reset, and ending persistence. Screenshots are written to ignored `test-results/`.

Balance checks record the first visible cash, price and task count for every one-time upgrade. The journey represents an extremely active player and is a progression check, not a human playtime target. Major upgrades now cost $4M for CEO readiness, $8M for training, $30M for autonomous nodes, $50M for replication, $250M for global expansion, $2B for the retirement unlock and $5B for sale.

The fixed coverage baseline keeps the release coverage requirement enforceable after these changes are committed. When establishing a future release baseline, update it deliberately in `tests/coverage-check.cjs`.

## Console checkpoints

`chPh2()` through `chPh12()` build the preceding phase with the required upgrades, a staffed team and enough cash for the next transition, then stop three tasks before its task threshold. For example, `chPh6()` loads Phase 5 at 1,347 tasks with $40,000; complete three tasks and buy Manager Agent to enter Phase 6.

`chPh13()`, `chPh14()` and `chPh15()` load 19, 39 and 99 staffed nodes respectively. Provision and staff the next node to reach the replication, global expansion or retirement-unlock checkpoint. `chPh1()` loads just before Reality Check, while `chPh0_1()`, `chPh0_2()` and `chPh0_3()` cover the beginning, pressure and initial upgrade reveals. Helpers replace the current saved game and also work from the retirement screen. They use real upgrade and hiring logic, and are regression-tested for valid saves and successful next-phase purchases.

## Release

Run `npm run check`, then publish the static runtime files through the repository's normal deployment process:

- `index.html`
- `game.js`
- `favicon.svg`
- `soundtrack-loop.mp3`
- `precursor_kick.mp3`
- `synth_d4_loop.mp3`
- `dnb_deep_loop.mp3`

Do not publish `node_modules`, coverage reports, or test artifacts. Tests and tooling are development-only. This work does not require a new hosting service.

This is a public repository. Do not commit credentials, API keys, passwords, access tokens, private keys, personal contact details, private service URLs, machine-specific filesystem paths, or confidential internal information. Use placeholders in documentation and examples.

The canonical design reference is [the repository design spec](../DESIGN.md). Advanced routing topology, dynamic cluster agent caps, and autonomous CEO strategy customization remain explicitly outside this game's release scope.
