# One More Task

A standalone incremental browser game about freelance work, automation, management, and finally having enough. The complete arc runs from Phase 1 to Phase 15, with an optional prestige cycle or a persistent retirement ending.

## Run

The game has no production dependencies or build step. Serve this directory over HTTP:

```sh
npm run serve
```

Open http://127.0.0.1:4173. Python 3 is needed for this development server. Any static web server works, including the repository's existing GitHub Pages hosting.

## Play

- Start with **Find Work**, then **Do Task**. Once the queue opens, **Work** starts a job. Post-It Notes, GTD Workflow and Noise-Cancelling Headphones let one click start 2, 5 and 10 jobs respectively through Phase 3. Those jobs work in parallel at the normal per-job manual speed, retain their individual pay and progress, do not expire, and survive reloads. Buttons show **Work on N** and **Working...**. A session starts only jobs already available; another click starts the next session after the current jobs finish.
- Up to three ordinary upgrades reveal together, including unaffordable purchases to save towards. **Discover Free-Tier AI** appears alongside them with **50 tasks** and an **Unlock** button. It becomes usable at 50 completed tasks with no cash cost or earlier upgrade requirements, guaranteeing at most 50 work clicks before AI even when skipping productivity upgrades. Buying those upgrades reduces the click count further. AI keeps taking jobs automatically while its tokens last. Phase 2's own upgrades begin at 200 tasks with Few-Shot Prompting and Marketing Campaign; the $2,500 Upgrade to AI 2000 Basic requires 300. Later phase transitions and the second subscription require all preceding upgrades. Phase 3 groups begin at 350, 425 and 500 tasks. Second AI Subscription costs $18K and requires 650 tasks; the $25K licence requires 750 tasks. Reputation has been removed.
- Phase 3 begins with a 50-token starter grant and requires **Second AI Subscription** before the **Multi-Agent Licence** becomes available. Both subscriptions need manual top-ups. Basic has a 40-token tank; Pro has 100 and uses 12 tokens per working second before efficiency upgrades in Phase 3. Pro's bar falls slightly faster despite its larger tank. The licence preserves those capacities, loaded tokens and current jobs. Basic becomes an explicitly labelled older, slower model that can be sold and replaced. Both subscriptions use matching token bars and Top-up tokens buttons. The Agents heading has no subscription-status or slot-count label.
- Every agent and Manager uses **Top-up tokens**. Partial top-ups deduct exactly the missing amount from reserve tokens, even with a Manager online. The bar shows tokens loaded into that agent. Top-up buttons always stay enabled. Token amounts are whole numbers, and tok/s is a five-second smoothed average of actual consumption, displayed with a minus sign. Workers have Sell buttons and no Auto toggle.
- Worker capacity and consumption rise through Phase 6. Eight continuously working Phase 6 agents use about 29,000 tokens per minute after all efficiency upgrades. Managers hold 4,000 tokens and distribute them in small increments while continuing to assign jobs. An empty Manager continues assigning work while agents have tokens left.
- The Phase 7 unlock adds a dedicated Token Manager slot first. A purchased Manager is required to enter this phase. The additional agent slot appears in Phase 8. The Token Manager buys token packs with cash and distributes them automatically. The top bar label is Tokens. Empty agent tanks pulse like the token warning. All currency-per-second displays use whole dollar amounts; agent role labels sit beside names.
- Token pack quantities scale with workload. Token prices rise by 2% of the base price per pack bought, including automatic purchases. New incident costs scale with lifetime earnings. DevOps resolves all incidents automatically; critical incidents take twice the response time.
- Manager and Token Manager cards have a slightly lighter background. DevOps and its purchase button live at the top of Incidents. Empty task and upgrade sections have no explanatory placeholder text; empty upgrades reserve one card of vertical space.
- Phase 8 uses simpler agent cards. The Phase 9 acquisition costs $1.5M. Tasks completed appears first in the top bar; there is no dashboard panel.
- Phase 9 requires one million completed tasks. The existing team becomes Cluster 1. The Operations Blueprint precedes the Second Cluster Permit; the Third Cluster Permit requires a full second cluster. Three full clusters are required before Phase 10. Full-cluster visibility gates apply only in Phase 9, so upgrades stay visible during CEO expansion.
- Every subsequent provision costs more. Fully staffed spare clusters can be sold using Sell. Sales do not reset provisioning prices.
- CEO training halves construction time and the CEO decision interval. New shells show a construction progress bar; later Continuous Deployment completes two fully fitted clusters every two seconds. DevOps automatically reduces technical debt; there is no Pay Down Tech Debt button.
- The $1M AI CEO is a dashed purchase card above the clusters, not an upgrade-list item. Buying it expands every cluster from eight to sixteen slots. It provisions one agent every five seconds; Provisioning Pipeline ($600K) halves that interval. Agent batching upgrades follow Scale Mode. Scale Mode halves the interval again and takes over new cluster creation. Manual provisioning disappears.
- Phase 12 introduces compact autonomous nodes. Scale Mode continues provisioning and staffing automatically. Replication requires twenty online nodes and at least nine additional nodes during Phase 12, reduces costs by 35%. Global Expansion begins at forty completed nodes and reduces costs another 40%. Dense cards show C1, C2 and so on, with no fixed node cap.
- Client retainer upgrades deploy contracts automatically, each earning $80/s before downtime and $2/s upkeep. The cluster footer shows the active contract count and current income after downtime. Two managed clusters increase agent task speed by 50%; three or more double it.
- Layered music adds a bright D4 + F4 synth motif from Phase 5: both notes sound together in two five-hit phrases per 4/4 bar, with each phrase lasting two beats. The 125 ms plucks have a slightly stronger middle hit, subtle stereo chorus and a light reverb tail. It fades in over eight seconds at a quiet background level. Music: On plays the base soundtrack; Music: Off silences every layer.
- Phase 8 restores the original 172 BPM DnB groove with its own D4 + F4 hook, premixed into one seamless sixteen-bar WAV. One broad five-hit phrase per DnB bar keeps the hook locked to the faster drums. The drum component is mixed 15% lower while the hook retains its level. Once the mix is ready, it enters on the next drum downbeat; the earlier kick and standalone synth fade out together over three bars, about 6.3 seconds.

## Early automation and hiring checkpoints

The original agent is AI 2000 Free in Phase 2. Upgrade to AI 2000 Basic renames it in Phase 3, where the lifestyle is Coffee Shop Regular. The second subscription is AI 2000 Pro. The income estimate includes the original agent using the same work-rate calculation as its production loop; empty tanks and idle agents add no estimated task income.

The first incident, whether triggered by a random failure or the twenty-second tutorial timer, introduces incidents exactly once. A timed introduction cannot also create a random incident in that tick. Prompt Engineering 101 appears in Phase 4 after at least three incidents have occurred, costs $3,200, and reduces failure rate by 20%.

The initial licence has three total slots. Buying the third specialist and buying Task Templates exposes the four-slot expansion, priced at $5,000. Parallel Prompting ($3,800, +15% speed) and Response Streaming ($5,200, +20% speed) follow that expansion and are required before six slots. Specialist roles may be bought repeatedly; Manager, Token Manager and DevOps remain unique. DevOps has its own slot in Incidents and does not consume shared agent capacity. This makes every advertised specialist slot usable.

Unlocked empty Manager and Token Manager positions are dashed purchase cards at the top of Agents. Those positions are reserved until bought. Each other empty slot has its own dashed card with direct buttons for buying each specialist type. Unaffordable purchases remain disabled. Buying a Manager costs $20,000, separately from its unlock upgrade.

Phase-entry task minimums are 50, 300, 750, 1,150, 5,000, 30,000, 150,000, 1,000,000, 1,200,000, 1,500,000 and 2,000,000 for Phases 2 through 12. Later transitions use node requirements.

Phase 5 gives its tools and operations upgrades more room: Web Search Tool costs $7,500, Sales Playbook $12,000, Code Execution Tool $16,000 and Revenue Ops System $28,000. Bulk Processing ($9,000) delivers ten tasks per job. The active-player simulation spends over a minute in Phase 5. This is a comparative pacing check, not a human playtime target.

Empty agent slots offer one-click Buy Writer, Buy Researcher, Buy Coder, Buy Analyst and Buy Support buttons, with Buy Sales appearing in Phase 8. The card shows the per-agent price; each purchase button is disabled when unaffordable. There is no role dropdown. DevOps has a matching dashed Buy DevOps placeholder with its price and a Dedicated incident slot label. Full shared capacity cannot block that purchase.

Before clusters, player-facing actions use Buy for agents. Clusters use Bring cluster online and Provision agent. The Token Manager upgrade description is “Automatically buy tokens when they run out.” Purchasing now happens before tank transfers, with enough headroom to keep tokens above the 4,000-token warning threshold when cash is available. DevOps has a separate $28K unlock upgrade in Phase 7.

## Batch throughput and progression

The Multi-Agent Licence description is “More agents, more work.” Four-slot and six-slot expansions block later upgrades until purchased. Bulk Processing starts ten-task jobs in Phase 5, Auto-Assign Playbooks raises batches to 100 in Phase 6, Revenue Optimization to 500 in Phase 7, and Growth Marketing to 2,000 in Phase 8. Every job stores its batch size when created. Completion adds that many tasks without multiplying its cash payout. Job difficulty stops growing after the early fatigue ramp. No free task-count grants are used to reach one million before Cluster 1.

Cluster expenses are labelled Server power & cooling. Cluster construction includes management agents, then empty slots provision identical agents with an installation progress bar. No specialist-role purchase buttons appear inside clusters.

## CEO scaling upgrades

After Scale Mode, upgrades stay available throughout construction and staffing. Faster AI Provisioning ($40M) speeds both coordination and agent installation by 50%; Dual Agent Provisioning ($75M) installs two agents per cycle, followed by Four-Agent Provisioning ($100M). Parallel Cluster Builds ($150M) allows two concurrent builds. Preassembled Server Racks ($200M) halves construction time. Their costs spread purchases across the scaling phase instead of allowing the entire chain to be bought immediately.

Phase 11 adds Fully Fitted Racks ($80M): all sixteen agents install during construction, with their $40K cost included in each new cluster purchase. Phase 12 adds Continuous Deployment ($150M), completing two fully fitted clusters every two seconds when funds permit. Construction consumes real cash, respects its concurrency limit, and stays visible in the existing progress cards. Buying these upgrades uses the existing save-format-8 upgrade list and requires no new save schema.

Node-based progression counts fully completed clusters. A new construction project cannot disable an otherwise satisfied node target. Compact-node conversion preserves ongoing fully fitted rack construction without prematurely producing tasks.

## Company leadership and delivery

From Phase 10, token purchasing becomes one company-wide Token Manager service, shown beside the AI CEO in agent cards above the cluster grid. Cluster managers and DevOps remain local to each team. The Token Manager automatically supplies every managed cluster and shows reserve tokens, smoothed consumption and its latest purchase. Transfers continue in small increments: up to 250 tokens into each cluster and 25 into each agent per 100ms tick. Purchases still deduct cash and follow the existing pack-price curve. There is no additional manual Manager-refill requirement.

Cluster work capacity scales with the company: twelve task spaces and one arrival per spawn interval for each managed cluster. This removes the old twelve-task ceiling across the entire company. A three-cluster Phase 10 regression scenario consumes over 25,000 tokens in one minute while conserving total tokens across reserve, cluster and agent tanks.

An outlined Bring cluster online card occupies the next free grid position. It is disabled when unaffordable and hidden during construction, at capacity, or after Scale Mode is bought. Manual Cluster 4 appears once the original three clusters have at least twelve agents each. Cluster 5 follows when the existing clusters are fully online. Both must be full before Scale Mode appears. Cluster sale controls read Sell.

At two managed clusters, the board adds a Delivery panel with a ten-second smoothed completion rate, queued and in-progress counts, and three recent completions. Tasks remain expanded by default. A right-aligned Hide tasks / Show tasks chevron toggles detail and keeps keyboard focus. A phase change restores expanded tasks. From Phase 12 the panel shows the delivery rate, managed-node count and delivery revenue without individual task controls. Observation history and the expanded-list preference are session-only, reset on a new story, and do not alter the save schema.

## Finish

In Phase 15, buy **Sell the Company and Retire Early!** when debt is below 10, there are at least 100 managed nodes, no unresolved incidents remain, and estimated income exceeds twice expenses. The sale settles at current cash plus 120 seconds of estimated income, freezes the company, and opens a separate golf-and-health ending screen.

Choose on that screen:

1. **Interesting, there's another model out…** starts again with permanent click power, starting tokens, and the earned extra starting agent slot. The introduction and first manual task return with different story text. Music stops, while its preference is retained.
2. **Actually retire** completes the permanent ending. Starting a new story from there requires confirmation.

Both ending stages persist on reload. There is no restart or retirement choice before selling the company.

Income estimates use whole-job throughput rather than the remaining time on a nearly finished job. Empty agent tanks contribute no task income.

## Saves and offline progress

Progress is stored locally in the browser, automatically every ten seconds and when leaving or hiding the page. No accounts, backend, or network saves are required.

**Breaking change:** this release uses save format version 8 and does not migrate earlier saves. Invalid or incompatible saves are preserved until the player explicitly resets them. A visible notice explains the problem. Storage failures remain visible and can be retried.

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
- Three deterministic 15-phase playthroughs start from zero cash without cheats or resource grants and reach retirement with more than 100 nodes. They verify that free AI takes at most 50 work clicks and no cash, while Basic, the second AI and the multi-agent licence remain savings goals. Separate opening checks verify the click limit with and without productivity upgrades. They exercise a very active player, so their timings are a progression regression check, not a prediction of human playtime.
- A separate five-minute Phase 7 simulation verifies sustained automation without manual refills.
- Coverage requires **100% of added or changed executable game lines** relative to release baseline `45bc33c`. The report also displays coverage of the entire legacy game; that is a separate metric. No production code is excluded from instrumentation.
- Chrome checks cover desktop, 320px and 390px portrait phones, landscape, scrolling, keyboard activation/focus, invalid-save reset, and ending persistence. Screenshots are written to ignored `test-results/`.

Balance checks record the first visible cash, price and task count for every one-time upgrade. The journey represents an extremely active player and is a progression check, not a human playtime target. Major upgrades now cost $4M for CEO readiness, $100M for training, $75M for autonomous nodes, $50M for replication, $250M for global expansion, $2B for the retirement unlock and $5B for sale.

The fixed coverage baseline keeps the release coverage requirement enforceable after these changes are committed. When establishing a future release baseline, update it deliberately in `tests/coverage-check.cjs`.

## Console checkpoints

`chPh2()` through `chPh12()` build the preceding phase with the required upgrades, a staffed team and enough cash for the next transition, then stop three tasks before its task threshold. For example, `chPh6()` loads Phase 5 at 4,997 tasks with $40,000; complete three tasks and buy Manager Agent to enter Phase 6.

`chPh13()`, `chPh14()` and `chPh15()` load 19, 39 and 99 staffed nodes respectively. Provision and staff the next node to reach the replication, global expansion or retirement-unlock checkpoint. `chPh1()` loads just before Reality Check, while `chPh0_1()`, `chPh0_2()` and `chPh0_3()` cover the beginning, pressure and initial upgrade reveals. Helpers replace the current saved game and also work from the retirement screen. They use real upgrade and hiring logic, and are regression-tested for valid saves and successful next-phase purchases.

## Release

Run `npm run check`, then publish the static runtime files through the repository's normal deployment process:

- `index.html`
- `game.js`
- `favicon.svg`
- `soundtrack-loop.mp3`
- `precursor_kick.mp3`
- `synth_d4_loop.mp3`
- `dnb_synth_loop.wav`

Do not publish `node_modules`, coverage reports, or test artifacts. Tests and tooling are development-only. This work does not require a new hosting service.

This is a public repository. Do not commit credentials, API keys, passwords, access tokens, private keys, personal contact details, private service URLs, machine-specific filesystem paths, or confidential internal information. Use placeholders in documentation and examples.

The canonical design reference is [the repository design spec](../DESIGN.md). Advanced routing topology, dynamic cluster agent caps, and autonomous CEO strategy customization remain explicitly outside this game's release scope.
