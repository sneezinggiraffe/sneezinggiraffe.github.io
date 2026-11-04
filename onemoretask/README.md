# One More Task

A standalone incremental browser game about freelance work, automation, management, and finally having enough. The complete arc runs from Phase 1 to Phase 15, with an optional prestige cycle or a persistent retirement ending.

## Run

The game has no production dependencies or build step. Serve this directory over HTTP:

```sh
npm run serve
```

Open http://127.0.0.1:4173. Python 3 is needed for this development server. Any static web server works, including the repository's existing GitHub Pages hosting.

## Play

- Start with **Find Work**, then **Do Task**. Once the queue opens, **Work** starts a job. Post-It Notes and GTD Workflow let one click start 2 and 5 jobs respectively through Phase 3. Five is the manual limit. Noise-Cancelling Headphones instead reduce work by 10% for manual and AI jobs. Manual groups work in parallel at the normal per-job speed, retain individual pay and progress, do not expire, and survive reloads. Buttons show **Work on N** and **Working...**. A session starts only jobs already available; another click starts the next session after the current jobs finish.
- The first paid upgrades appear at seven tasks, at their existing prices. Up to three ordinary upgrades reveal together, including unaffordable purchases to save towards. **Discover Free-Tier AI** requires all earlier Phase 1 purchases and at least 105 completed tasks. Its button contains **105 tasks**; cash upgrade buttons contain their price. Prices and background task-reveal thresholds have no separate labels. AI keeps taking jobs automatically while its tokens last. Side Hustle Optimization, Inbox Zero and GTD Workflow reveal at 35 tasks. Phase 2 adds Prompt Library ($150, 115 tasks) and Gig Alerts ($250, 145 tasks), followed by Few-Shot Prompting at 175 and Marketing Campaign at 225. The $2,000 Upgrade to AI 2000 Basic requires 300. Later phase transitions and the second subscription require all preceding upgrades. Phase 3 groups begin at 350, 425 and 500 tasks. Client Outreach ($4,500) doubles task arrivals at 650 tasks. Second AI Subscription stays visible alongside it but requires Outreach before purchase, costs $18K and requires 650 tasks. Inference Tuning ($6,000) follows at 900 tasks, making both subscriptions work 15% faster without raising token consumption per second. Prompt Refinement ($1,500, 925 tasks) then adds 5% speed to both subscriptions; Context Pruning ($2,500, 950 tasks) reduces their token use by 5%. The $25K licence appears after tuning and 1,000 tasks, and remains disabled until both smaller upgrades are purchased. Reputation has been removed.
- Phase 3 begins with a 50-token starter grant and requires **Second AI Subscription**, **Inference Tuning**, **Prompt Refinement** and **Context Pruning** before the **Multi-Agent Licence** can be purchased. Both subscriptions need manual top-ups. Basic has a 40-token tank; Pro has 100 and uses 12 tokens per working second before efficiency upgrades in Phase 3. The licence preserves loaded tokens and current jobs. Basic retains its 40-token tank and works at one quarter of its former licensed speed, making its older model visibly slow. Pro joins the standard worker capacity curve of 200, 500 and 1,500 tokens through Phases 4 to 6 and consumes tokens at the normal worker rate. It remains a useful researcher alongside newer named agents. Both subscriptions use matching token bars and Top-up tokens buttons. The Agents heading has no subscription-status or slot-count label.
- Unmanaged workers and the Manager use **Top-up tokens**. Partial manual top-ups deduct exactly the missing amount from reserve tokens. Workers show a disabled **Managed** button while their Manager is online; manual top-ups resume if the Manager is sold. The bar shows tokens loaded into that agent. Manual top-up buttons stay enabled even with no reserve tokens. Token amounts are whole numbers, and tok/s is a five-second smoothed average of actual consumption, displayed with a minus sign. Workers have Sell buttons and no Auto toggle.
- Worker capacity and consumption rise through Phase 6. Phase 5 uses 60 tokens per working second before efficiency, giving a standard fully busy worker about 21 seconds per refill after the three early efficiency upgrades. Eight continuously working Phase 6 agents use about 29,000 tokens per minute after those upgrades. Managers hold 4,000 tokens and let worker tanks drain to 10% before refilling them from their available supply, while continuing to assign jobs. This also applies to cluster workers and the initial AI. An empty Manager continues assigning work while agents have tokens left.
- The Phase 7 unlock adds a dedicated Token Manager slot first. A purchased Manager is required to enter this phase. The additional agent slot appears in Phase 8. The Token Manager buys token packs with cash and distributes them automatically. The top bar label is Tokens. Empty agent tanks pulse like the token warning. All currency-per-second displays use whole dollar amounts; agent role labels sit beside names.
- Token pack quantities scale with workload. Token prices rise by 2% of the base price per pack bought, including automatic purchases. New incident costs scale with lifetime earnings. DevOps resolves all incidents automatically; critical incidents take twice the response time. From clusters onward, a compact **Operations healthy** status explains that DevOps is included in each cluster. Incident headings and details appear only while incidents are active.
- Manager and Token Manager cards have a slightly lighter background. DevOps and its purchase button live at the top of Incidents. Empty task and upgrade sections have no explanatory placeholder text; empty upgrades preserve the exact height and bottom spacing of the last visible upgrade card, with a 68px card-height default before any card has been measured.
- Phase 8 uses simpler agent cards. Growth Marketing ($300K) reveals at 175,000 tasks, Referral Partnerships ($500K) at 350,000 and Enterprise Sales Pipeline ($1M, +25% demand and revenue) at 600,000. Long-Running Project Playbooks ($750K, +25% agent speed) appears at 720,000 tasks, then Account Expansion ($1.25M, +20% demand and +30% revenue) at 860,000. Both precede the $1.5M Phase 9 acquisition. Tasks completed appears first in the top bar; there is no dashboard panel.
- Phase 9 requires one million completed tasks. The existing team becomes Cluster 1. The Operations Blueprint precedes the Second Cluster Permit; the Third Cluster Permit requires a full second cluster. Three full clusters are required before Phase 10. Upgrade cards remain visible while clusters build or staff up. Phase 9 purchases that need full staffing stay disabled until staffing is complete. The next manual cluster can only be ordered when the existing clusters are fully online.
- Every subsequent provision costs more. Fully staffed spare clusters can be sold using Sell. Sales do not reset provisioning prices.
- **AI Expansion Optimisation** costs $300M, follows the $200M Scale Mode and halves construction time and the CEO decision interval. New shells show a construction progress bar; later Continuous Deployment builds two fully fitted clusters concurrently in two seconds each, with staggered starts. Neither Ralph-loops nor AI Expansion Optimisation opens a transition modal. DevOps automatically reduces technical debt; there is no Pay Down Tech Debt button.
- The $1M AI CEO is a dashed purchase card above the clusters, not an upgrade-list item. Buying it starts automatic staffing at the existing eight-slot capacity. Re-architect Network ($15M) adds a ninth slot; High-Density Clusters ($50M) separately expands clusters to sixteen slots. Task detail folds when Cluster 2 is ordered and can be reopened manually. An initial agent installation takes four seconds; Provisioning Pipeline ($10M) halves installation duration. The initial pipeline permits one installation, while Dual and Four-Agent Provisioning raise that company-wide limit to two and four. Slots refill independently on the next game tick when capacity and funds allow. Faster AI Provisioning ($40M) precedes the sixteen-slot expansion; Dual Agent Provisioning ($75M) follows it. Both work in Manage Mode before the $200M Scale Mode, which takes over new cluster creation. Manual provisioning disappears.
- Phase 12 introduces compact autonomous nodes. Scale Mode continues provisioning and staffing automatically. Replication requires twenty online nodes and at least nine additional nodes during Phase 12, reduces costs by 35%. Global Expansion begins at forty completed nodes and reduces costs another 40%. Dense cards show C1, C2 and so on, with no fixed node cap.
- Client retainer upgrades deploy contracts automatically, each earning $80/s before downtime and $2/s upkeep. Their income contributes to the normal income estimate; there is no separate cluster footer label. Two managed clusters increase agent task speed by 50%; three or more double it.
- Layered music adds a bright D4 + F4 synth motif from Phase 5: both notes sound together in two five-hit phrases per 4/4 bar, with each phrase lasting two beats. The 125 ms plucks have a slightly stronger middle hit, subtle stereo chorus and a light reverb tail. It fades in over eight seconds at a quiet background level. Music: On plays the base soundtrack; Music: Off silences every layer. Retirement restores the original soundtrack and stops the pressure layers, while keeping the saved music preference. Restarting through prestige stops all music until the new story begins.
- Phase 8 restores the original 172 BPM DnB groove with its own D4 + F4 hook, premixed into one seamless sixteen-bar WAV. One broad five-hit phrase per DnB bar keeps the hook locked to the faster drums. The drum component is mixed 15% lower while the hook retains its level. Once the mix is ready, it enters on the next drum downbeat; the earlier kick and standalone synth fade out together over three bars, about 6.3 seconds.

## Early automation and hiring checkpoints

Phases 2 and 3 receive variable bursts of five to ten jobs, with quiet intervals for the AI to catch up. The free AI works at half its former speed and drains 2.4 tokens per working second, so its ten-token tank lasts about 4.2 seconds of continuous work. Basic retains its existing work speed and token drain. The redundant AI Agent introduction modal, Pressure Building modal, Tool Use SDK modal and Manager Agent modal are removed. Their underlying unlocks still apply.

The original agent is AI 2000 Free in Phase 2. Upgrade to AI 2000 Basic renames it in Phase 3, where the lifestyle is Coffee Shop Regular. The second subscription is AI 2000 Pro. The income estimate includes the original agent using the same work-rate calculation as its production loop; empty tanks and idle agents add no estimated task income.

The first incident, whether triggered by a random failure or the twenty-second tutorial timer, introduces incidents exactly once. A timed introduction cannot also create a random incident in that tick. Prompt Engineering 101 appears in Phase 4 after at least three incidents have occurred, costs $3,200, and reduces failure rate by 20%.

The initial licence has three total slots, or four after prestige. The prestige bonus remains additive through subsequent capacity upgrades. Buying the third specialist and Task Templates exposes **Additional Agent Slot**, priced at $5,000. **Two More Agent Slots** adds another two after the speed upgrades. Parallel Prompting ($3,800, +15% speed) and Response Streaming ($5,200, +20% speed) follow that expansion and are required before six slots, or seven after prestige. Specialist roles may be bought repeatedly; Manager, Token Manager and DevOps remain unique. DevOps has its own slot in Incidents and does not consume shared agent capacity. This makes every advertised specialist slot usable.

Unlocked empty Manager and Token Manager positions are dashed purchase cards at the top of Agents. Those positions are reserved until bought. Each other empty slot has its own dashed card with direct buttons for buying each specialist type. Unaffordable purchases remain disabled. Buying a Manager costs $20,000, separately from its unlock upgrade.

Phase-entry task minimums are 105, 300, 750, 1,150, 5,000, 30,000, 150,000, 1,000,000, 1,200,000, 1,500,000 and 2,000,000 for Phases 2 through 12. Later transitions use node requirements.

Phase 5 gives its tools and operations upgrades more room: Web Search Tool costs $7,500, Sales Playbook $12,000, Code Execution Tool $16,000 and Revenue Ops System $28,000. Bulk Processing ($9,000) targets ten tasks per job. Workflow Orchestration ($18,000) reveals at 3,500 tasks before Manager Agent, adding 25% more task arrivals and 20% agent speed. The active-player simulation checks that this phase gives its upgrades time to matter. This is a comparative pacing check, not a human playtime target.

Phase 7 keeps task-reveal milestones in the background. DevOps appears first, while later upgrades reveal as their task milestones are reached. Purchases still require enough cash. Its savings goals are Revenue Optimization ($150K, 45,000 tasks), DevOps Slot ($60K, 28,000-task background threshold, available immediately on entering Phase 7), Incident Runbooks ($175K, 65,000 tasks), Delivery Pipeline ($250K, 90,000 tasks, +25% agent speed) and Premium Client Contracts ($350K, 115,000 tasks, +35% task pay). Ralph-loops costs $1M and requires all preceding upgrades and at least 150,000 tasks. The deterministic journeys verify paid purchases throughout this phase before entering growth.

Empty agent slots offer one-click Buy Writer, Buy Researcher, Buy Coder, Buy Analyst and Buy Support buttons, with Buy Sales appearing in Phase 8. The card shows the per-agent price; each purchase button is disabled when unaffordable. There is no role dropdown. DevOps has a matching dashed Buy DevOps placeholder with its price and a Dedicated incident slot label. Full shared capacity cannot block that purchase.

Before clusters, player-facing actions use Buy for agents. Clusters use Bring cluster online and Provision agent. The Token Manager upgrade description is “Automatically buy tokens when they run out.” Purchasing now happens before tank transfers, with enough headroom to keep tokens above the 4,000-token warning threshold when cash is available. DevOps has a separate $60K unlock upgrade in Phase 7.

## Batch throughput and progression

The Multi-Agent Licence description is “More agents, more work.” Four-slot and six-slot expansions block later upgrades until purchased. Bulk Processing targets ten tasks per job in Phase 5, Auto-Assign Playbooks raises the target to 100 in Phase 6, Revenue Optimization to 500 in Phase 7, and Growth Marketing to 2,000 in Phase 8. Each batched job varies by ±20% around its target and stores its actual batch size when created. Phase 6 jobs deliver 80–120 tasks, so the completion counter's final digits change naturally. Completion adds the actual count without multiplying its cash payout. Job difficulty stops growing after the early fatigue ramp. No free task-count grants are used to reach one million before Cluster 1.

Cluster expenses are labelled Server power & cooling. Cluster construction includes management agents, then empty slots provision identical agents with an installation progress bar. Agent tiles and task buttons use the same short name, chosen from a pool of 272 names without repeats until the pool is exhausted. Empty purchasable slots show +, and each slot requires its own purchase. There is no separate agent-count line. Eligible **Sell** buttons sit in the top-right card header. Empty clusters say **Needs Agents** in orange; partly staffed clusters say **Partially Operational**; **Installing agents** appears only during a real installation. No specialist-role purchase buttons appear inside clusters.

Once the overview contains four cluster or purchase cards, its cards become denser. The grid grows naturally within the main control panel, with no internal vertical scrollbar. Card widths, padding, gaps and agent-slot heights decrease as more clusters are added. Named agent slots, status and construction progress remain visible without expandable details. Vertical scrolling handles larger groups once the cards reach their readable minimum. Eight-slot clusters use four columns, Re-architect Network adds a 3×3 grid after the AI CEO is available, and High-Density Clusters expands them to 4×4. Phase 12 retains the aggregate-node presentation. The Tasks Complete heading uses comma-separated totals throughout.

## CEO scaling upgrades

Provisioning upgrades stay available throughout construction and staffing. Faster AI Provisioning ($40M) speeds both coordination and agent installation by 50% and is required before High-Density Clusters ($50M). Dual Agent Provisioning ($75M) follows the capacity increase and maintains up to two agent installations before Scale Mode ($200M). Four-Agent Provisioning ($100M) follows Scale Mode. Parallel Cluster Builds ($150M) allows two concurrent builds. Preassembled Server Racks ($200M) halves construction time. Their costs spread purchases across the scaling phase instead of allowing the entire chain to be bought immediately.

CEO prices mix quick improvements with larger savings goals and remain fixed independently of the player's wallet. Regression simulations check action intervals of 0.5, 5 and 10 seconds. Provisioning Pipeline remains a quick improvement; the larger scaling upgrades retain savings periods. These are deterministic pacing comparisons, not human playtime predictions. Dual Agent Provisioning has one definition and one rendered purchase; Parallel Cluster Builds is a separate construction upgrade.

Phase 11 adds Fully Fitted Racks ($400M): all sixteen agents install during construction, with their $40K cost included in each new cluster purchase. Phase 12 adds Continuous Deployment ($150M), improving deployment speed by 50% from three-second builds to two-second builds, with two builds running concurrently when funds permit. From Phase 14, construction and CEO decisions accelerate gradually from 1x at forty completed nodes to 4x at one hundred, reducing Continuous Deployment construction to half a second. Expansion keeps the usual funding threshold of twice the next cluster price, with no extra exit reserve. The player can buy Golden Parachute whenever its conditions and $5B price are met. Network throughput increases to 2x, 3x and 7x its former task rate in Phases 12, 13 and 14 onwards, without increasing cash payouts or token drain, targeting roughly one billion tasks at retirement. Parallel cluster and agent starts are spaced by 300–400ms. Each free slot refills independently, preserving the stagger across cycles at the existing 100ms game tick and 200ms render cadence. Saved remaining times include any queued start delay, while duration records the actual build time; queued progress stays at zero. Reloading preserves those delays without changing save format 8. Fully Fitted Racks installs its agents within the cluster build. Construction consumes real cash, respects its concurrency limit, and stays visible in the existing progress cards. Buying these upgrades uses the existing save-format-8 upgrade list and requires no new save schema.

Node-based progression counts fully completed clusters. Upgrade descriptions omit parenthesized node counts; node requirements still gate purchases. A new construction project cannot disable an otherwise satisfied node target. Compact-node conversion preserves ongoing fully fitted rack construction without prematurely producing tasks.

## Company leadership and delivery

From Phase 10, token purchasing becomes one company-wide Token Manager service, shown beside the AI CEO in agent cards above the cluster grid. Cluster managers and DevOps remain local to each team. The Token Manager automatically supplies every managed cluster and shows reserve tokens, smoothed consumption and its latest purchase. The Token Manager transfers up to 250 tokens into each cluster per 100ms tick. Cluster managers refill worker tanks when they reach 10%, using only the tokens currently in the cluster tank. Purchases still deduct cash and follow the existing pack-price curve. There is no additional manual Manager-refill requirement.

Cluster work capacity scales with the company: twelve task spaces and one arrival per spawn interval for each managed cluster. This removes the old twelve-task ceiling across the entire company. A three-cluster Phase 10 regression scenario consumes over 25,000 tokens in one minute while conserving total tokens across reserve, cluster and agent tanks.

An outlined Bring cluster online card occupies the next free grid position. It is disabled when unaffordable and hidden during construction, at capacity, or after Scale Mode is bought. Every manual cluster requires the existing clusters to be fully online. Five full clusters are needed before Scale Mode appears. Cluster sale controls read Sell. In Scale Mode a dashed, noninteractive **Planning** card previews the next cluster after the current cluster has between nine and twelve agents online, with a stable random threshold per cluster. It shows land searching, council negotiations or lease drafting, with the funding amount shown when the CEO needs more cash. The funding target is twice the next cluster price, including in Phase 15. There is no additional exit reserve. There is no cap at Cluster 331 or any other fixed cluster count, and expansion resumes once the cash target is met. This preview adds no artificial construction delay.

At two managed clusters, the board adds a Delivery panel with a ten-second smoothed completion rate, queued and in-progress counts, and three recent completions. Fixed grid columns and tabular numerals keep the queue and work counts from shifting as delivery grows. The task-heading row has no duplicate Delivery label. Tasks fold immediately when Cluster 2 is ordered, including while it is under construction. Buying the CEO preserves a manual reopening. A right-aligned Hide tasks / Show tasks chevron toggles detail and keeps keyboard focus; manual reopening persists through later phase changes in the current session. Reloading a CEO-led company starts with tasks folded. From Phase 12 the panel shows the delivery rate, managed-node count and delivery revenue without individual task controls. Observation history and the expanded-list preference are session-only, reset on a new story, and do not alter the save schema.

## Finish

At one hundred nodes, **Prepare Company Sale** unlocks Phase 15 for $2B. In Phase 15, buy the $5B **Golden Parachute** when debt is below 10, there are at least 100 managed nodes, no unresolved incidents remain, and estimated income exceeds twice expenses. The sale settles at current cash plus 120 seconds of estimated income, freezes the company, and opens a separate golf-and-health ending screen.

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
- Three deterministic 15-phase playthroughs start from zero cash without cheats or resource grants and reach retirement with more than 100 nodes. They verify that free AI requires the preceding paid tools, while Basic, the second AI and the multi-agent licence remain savings goals. Separate opening checks verify that skipping the tools prevents the unlock. They exercise a very active player, so their timings are a progression regression check, not a prediction of human playtime.
- Three additional playthroughs test CEO saving goals at 0.5, 5 and 10-second action intervals, including quick Pipeline purchases and larger Scale Mode and agent-batching goals.
- A separate five-minute Phase 7 simulation verifies sustained automation without manual refills.
- Coverage requires **100% of added or changed executable game lines** relative to release baseline `45bc33c`. The report also displays coverage of the entire legacy game; that is a separate metric. No production code is excluded from instrumentation.
- Chrome checks cover desktop, 320px and 390px portrait phones, landscape, scrolling, keyboard activation/focus, invalid-save reset, and ending persistence. Screenshots are written to ignored `test-results/`.

Balance checks record the first visible cash, price and task count for every one-time upgrade. The journey represents an extremely active player and is a progression check, not a human playtime target. Major upgrades now cost $4M for CEO readiness, $300M for AI Expansion Optimisation, $760M for autonomous nodes, $1.5B for replication, $3B for global expansion, $2B for the retirement unlock and $5B for sale.

The fixed coverage baseline keeps the release coverage requirement enforceable after these changes are committed. When establishing a future release baseline, update it deliberately in `tests/coverage-check.cjs`.

## Console checkpoints

Use `chStart8()` to play Phase 8 from its entry, with growth upgrades still unpurchased. `chPh9()` is an end-of-Phase-8 checkpoint and intentionally includes those purchases. See [balance landmarks](BALANCE.md) for rough task and cash ranges during ordinary play.

`chRetire()` replaces the current save with Phase 15, one billion tasks, one hundred fully staffed nodes, sufficient cash, healthy operations and an immediately usable **Golden Parachute**. Clicking its $5B button opens the retirement ending in one action.

`chPh2()` through `chPh12()` build the preceding phase with the required upgrades and a staffed team, usually three tasks before the next transition. `chPh3_1()` prepares Second AI Subscription at 870 tasks and $14,000, with all earlier purchases complete and the second subscription still unpurchased. `chPh8()` prepares Ralph-loops at 390,000 tasks and $800,000, leaving $200,000 to earn. For example, `chPh6()` loads Phase 5 at 4,997 tasks with $40,000; complete three tasks and buy Manager Agent to enter Phase 6.

`chPh13()`, `chPh14()` and `chPh15()` load 19, 39 and 99 staffed nodes respectively. Provision and staff the next node to reach the replication, global expansion or retirement-unlock checkpoint. `chPh1()` loads just before Reality Check, while `chPh0_1()` loads the beginning. `chPh0_2()` loads seven tasks with the first three upgrades unpurchased, `chPh0_3()` loads 35 tasks with Side Hustle Optimization, Inbox Zero and GTD Workflow available, and `chPh0_4()` loads 100 tasks with Discover Free-Tier AI visible and five more tasks needed. Helpers replace the current saved game and also work from the retirement screen. They use real upgrade and hiring logic, and are regression-tested for valid saves and successful next-phase purchases.

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

**Breaking debug API change:** manual provisioning now requires `GAME.buyClusterWorker(clusterId, slotIndex)`, with a zero-based slot index. A slot can only purchase itself, in order. The former cluster-only manual call no longer provisions an agent.
