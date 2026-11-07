# One More Task

A standalone incremental browser game about freelance work, automation, management, and finally having enough. The complete arc runs from Phase 1 to Phase 16, with an optional prestige cycle or a persistent retirement ending.

## Run

Open `index.html` directly in your browser. Keep `game.js`, `themes.css`, `layouts.css` and the other runtime assets beside it. The game has no production dependencies or build step.

A static server is optional. Automated browser checks start one only for the test run:

```sh
npm run serve
```

That command serves http://127.0.0.1:4173 and can be stopped with Ctrl+C. Python 3 is needed for the optional server. Any static web server also works, including the repository's GitHub Pages hosting.

## Appearance and views

Cut & Paste (the former theme 3) is the final appearance. The theme selector, theme name, layout name and visible Layout label have been removed. The top-right controls are **V**, **H** and **Settings**, with a small gap before Settings.

| Button | View | Arrangement |
| --- | --- | --- |
| V | Vertical | In Tray: a compressed task stack beside the team and operations |
| H | Horizontal, the default | Desk Scatter: task notes in rows beside the control panel on desktop |

Switching views keeps all game progress. The URL remembers the selected view, including when opening the HTML file directly: `index.html#layout=3` for H or `index.html#layout=4` for V.

Upgrades, Team and Event Log share one scrollable control panel beside the task stream on desktop. On mobile, the stream and controls share the viewport vertically. The page and task stream do not scroll; tasks beyond the desk edge remain queued. Scroll the control panel to reach every agent slot, upgrade and the event log. Event Log retains its own scrollbar. Automatic workers take the first eligible, fully visible task in displayed order. Manual task selection uses the same visibility rule, including the second Multitasking slot. Starting work rechecks the space as active notes expand. Tasks already started continue after resizing. From the aggregate cluster delivery stage, individual card visibility no longer limits company operations.

Task cards use their original dimensions: 148 pixels tall in H on desktop, 158 pixels in H on mobile, and 152 pixels in V. Widths follow the original responsive grid and wider vertical queue column. Each card has a stable slant anywhere from -2° to 2.4°. Both views show actual arrivals as new notes. A completed note is crossed off, pauses for 100ms, then clears from the desk over 400ms to reveal the work beneath it. Surviving cards stay attached in place so completion does not restart their arrival animations or make the list flicker. These brief visual copies do not count as queued tasks, trigger extra payouts or enter saved progress. Expired tasks leave without a completion stamp. Reduced-motion mode shows a static completion mark. V has no tray outline or bottom border; a long stack continues below the viewport, with partially visible notes at the bottom. The queue retains its gentle opening ramp and now allows 30 jobs at its full capacity, growing further for managed clusters. The queued-task count label has been removed, and Tasks Complete uses the same heading style as Team, Upgrades and Event Log. Settings uses the same paper material, tape, border and shadow as the opening cards. Hiring controls stay filled and raised; routine token refills stay outlined. The retirement screen keeps its existing presentation.

**Breaking presentation change:** theme selection and layouts 1, 2 and 5 have been removed. Theme URL parameters no longer affect the appearance. Removed layout IDs start with H; no compatibility aliases are provided.

## Play

- Start with a single task card near the top containing the **One More Task** title, the introduction and a decorative **Find Work** prompt. Click anywhere on the card, including the prompt, or activate it with Enter or Space. The first gig, **Deliver a pizza**, shows a decorative **Do Task** prompt that disappears as soon as work starts. Subsequent cards have no action prompt. Every opening card uses its full surface as the work control. **Wash a car** and **Help write an email** follow, each with its own description and pay. The next gig is ready as soon as the current one finishes. The top resource bar appears only after two gigs are complete. Complete three quick gigs before the inbox opens; progress and the reward appear inside the working card. The task list then opens with **Set Up Your Inbox**, paying $0. Manual work starts directly from task cards; there is no separate **You** card or **Do work** button. Team stays hidden until hired help is present. The assistant shows its delivered-task total. Assigning inbox setup starts incoming work. Click an available task card, or activate it with Enter or Space, to start that task. Multitasking fills the remaining work slot with another available task. Cards disable when manual work slots are full or a manual incident repair is in progress. Task cards have one assignment label: **Unassigned**, **You**, **Assistant**, or the AI's name. Early jobs remain individual tasks with separate completion payouts. Starting work does not display floating click rewards.
- **Hire a Part-Time Assistant** costs $30 after Tools of the Trade and immediately starts automatic work. The assistant completes one task at a time, initially in four seconds, then takes a two-second break after every five completed tasks. Each break randomly shows **Break time**, **Lunch**, **Dentist**, or **Sleeping**. There is no Assign work button or token requirement. The card has no progress bar. Breaks show a pause icon and one orange status line such as “Lunch - Back in 2s”, with the normal card border; each completion retains its 15% fee. The current task, five-task cycle and break survive reloads. Reserved work cannot expire or be taken by You or AI. Hiring still increases early arrival frequency and queue capacity.
- You initially work on one task. **Multitasking**, described as “Do one task with each hand”, costs $61 and appears after There Must Be a Better Way at 35 tasks. One task-card click fills both available manual slots, prioritising the clicked task and counting as one action. The assistant remains sequential: **Settling In** ($10, eight tasks) makes the assistant 25% faster (3.2 seconds per task), and **Knows the Routine** ($15, twelve tasks) adds another 25% speed (2.56 seconds per task). These early speed upgrades replace the old four-task concurrency and are required before There Must Be a Better Way. Breaks stay two seconds. These deliberately modest bonuses slow progression compared with the old concurrent assistant. Three-seed simulations reach Basic AI in about 2.7 minutes with active play or nine minutes with delegated play; tests guard against stalled progression and compare task counts and earnings against the earlier baseline. **Faster Inference** at 425 tasks doubles the original AI subscription speed without changing human speed.
- Free AI starts with tokens and works alongside the assistant; upgrading it to Basic keeps the assistant. **Second AI Subscription** starts Phase 4 and hires AI 2000 Pro alongside Basic and dismisses the assistant. Unfinished tasks return to the queue with progress preserved and no assistant completion fee. The assistant cannot be dismissed separately; only the Pro upgrade releases them. The team section appears as **Team** with the assistant, then becomes **Agents** after Pro replaces them. Manual work remains available through task cards; there is no early Step Back upgrade.
- At seven tasks, **Tools of the Trade** appears alone. Clicking its card reveals the event log and first paid upgrades at their existing prices. Up to three ordinary upgrades reveal together, including unaffordable purchases to save towards. **Discover Free-Tier AI** requires all earlier Phase 1 purchases and at least 150 completed tasks. It previews from 105 tasks after those purchases. Its label contains **150 tasks**; cash upgrades show their price in the same position. The whole upgrade card is clickable, with no separate button styling; free upgrades have an empty label. Prices and background task-reveal thresholds have no separate labels. AI keeps taking jobs automatically while its tokens last. Side Hustle Optimization and Inbox Zero reveal at 35 tasks. Phase 2 adds Prompt Library ($150, 115 tasks) and Gig Alerts ($250, 145 tasks), followed by Few-Shot Prompting at 175 and Marketing Campaign ($400) at 200. The $2,000 Upgrade to AI 2000 Basic requires 300. Later phase transitions and the second subscription require all mandatory preceding upgrades. Phase 3 groups begin at 350, 425 and 500 tasks. Billboard costs $2,000. Client Outreach ($4,500) doubles task arrivals at 650 tasks. Second AI Subscription stays visible alongside it but requires Outreach before purchase, costs $18K and requires 650 tasks. Inference Tuning ($6,000) follows at 900 tasks, making both subscriptions work 15% faster without raising token consumption per second. Prompt Refinement ($1,500, 925 tasks) then adds 5% speed to both subscriptions; Context Pruning ($2,500, 950 tasks) reduces their token use by 5%. The $25K licence appears after tuning and 1,000 tasks, and remains disabled until both smaller upgrades are purchased. Reputation has been removed.
- Phases 2 through 4 receive tasks individually at variable intervals. Closely spaced arrivals create busy spells; occasional longer gaps let the queue dry up. The next interval is sampled once per arrival and survives reloads. Demand upgrades shorten these intervals. A full queue or a long time jump cannot trigger a catch-up batch.
- Phase 3 begins with a 50-token starter grant. Second AI Subscription enters Phase 4, where **Inference Tuning**, **Prompt Refinement** and **Context Pruning** precede the **Multi-Agent Licence** and Phase 5. Both subscriptions need manual top-ups. Basic has a 40-token tank; Pro has 100 and uses 12 tokens per working second before efficiency upgrades in Phase 4. The licence preserves loaded tokens and current jobs. Basic retains its 40-token tank and works at one quarter of its former licensed speed, making its older model visibly slow. Pro joins the standard worker capacity curve of 200, 500 and 1,500 tokens through Phases 5 to 7 and consumes tokens at the normal worker rate. It remains a useful researcher alongside newer named agents. Both subscriptions use matching token bars and Add tokens buttons. Agent top-up buttons use a quiet outlined style; hiring controls use filled, raised purchase styling. Selling a worker leaves that exact slot vacant, including Basic's first slot. Other workers keep their positions, and role purchases fill the selected vacancy. Slot identities persist through reloads. The Agents heading has no subscription-status or slot-count label.
- Unmanaged workers and the Manager use **Add tokens**. Partial manual top-ups deduct exactly the missing amount from reserve tokens. Workers show a **Managed** status while their Manager is online; manual top-ups resume if the Manager is sold. The bar shows tokens loaded into that agent. Manual top-up buttons stay enabled even with no reserve tokens. Token amounts are whole numbers, and tok/s is a five-second smoothed average of actual consumption, displayed with a minus sign. Workers have Sell buttons and no Auto toggle.
- Worker capacity and consumption rise through Phase 7. Phase 6 uses 60 tokens per working second before efficiency, giving a standard fully busy worker about 21 seconds per refill after the three early efficiency upgrades. Eight continuously working Phase 7 agents use about 29,000 tokens per minute after those upgrades. Managers hold 4,000 tokens and let worker tanks drain to 10% before refilling them from their available supply, while continuing to assign jobs. This also applies to cluster workers and the initial AI. An empty Manager continues assigning work while agents have tokens left.
- The Phase 8 unlock adds a dedicated Token Manager slot first. A purchased Manager is required to enter this phase. The additional agent slot appears in Phase 9. The Token Manager buys token packs with cash and distributes them automatically. The top bar label is Tokens. Empty agent tanks show an **Empty** label and a static warning. Low reserve tokens show a static **Low** warning. All currency-per-second displays use whole dollar amounts; agent role labels sit beside names.
- Token pack quantities scale with workload. Token prices rise by 2% of the base price per pack bought, including automatic purchases. New incident costs scale with lifetime earnings. DevOps resolves all incidents automatically at the same rate, oldest first. All incidents use a red attention background and border that soften during manual or DevOps repair. From clusters onward, a compact **Operations healthy** status explains that DevOps is included in each cluster. Incident headings and details appear only while incidents are active.
- Manager and Token Manager cards have a slightly lighter background. DevOps and its purchase button live at the top of Incidents. Empty task and upgrade sections have no explanatory placeholder text; empty upgrades preserve the exact height and bottom spacing of the last visible upgrade card, with a 68px card-height default before any card has been measured.
- Phase 9 uses simpler agent cards. Growth Marketing ($300K) reveals at 175,000 tasks, Referral Partnerships ($500K) at 350,000 and Enterprise Sales Pipeline ($1M, +25% demand and revenue) at 600,000. Long-Running Project Playbooks ($750K, +25% agent speed) appears at 720,000 tasks, then Account Expansion ($1.25M, +20% demand and +30% revenue) at 860,000. Both precede the $1.5M Phase 10 acquisition. Tasks completed appears first in the top bar; there is no dashboard panel.
- Phase 10 requires one million completed tasks. The existing team becomes Cluster 1. Paid upgrades reveal between 1.05M and 2.5M tasks. The $1.5M Operations Blueprint precedes the $2.5M Second Cluster Permit; the $12M Third Cluster Permit requires a full second cluster. Three full clusters, 2.5M tasks and $35M CEO Readiness are required before Phase 11. Upgrade cards remain visible while clusters build or staff up. Phase 10 purchases that need full staffing stay disabled until staffing is complete. The next manual cluster can only be ordered when the existing clusters are fully online.
- Every subsequent provision costs more. Fully staffed spare clusters can be sold using Sell. Sales do not reset provisioning prices.
- **AI CEO Scale Mode** costs $200M and now enters Phase 12, where the CEO creates and staffs clusters automatically. **Rapid Cluster Deployment** is a regular $300M Phase 12 upgrade that halves construction time and doubles CEO coordination speed. New shells show construction progress with space below the stage text. Continuous Deployment later builds fully fitted clusters in two seconds each. Ralph-loops and Scale Mode do not open transition modals. DevOps automatically reduces technical debt.
- The $1M AI CEO is a filled purchase card above the clusters, not an upgrade-list item. Buying it starts automatic staffing at the existing eight-slot capacity. Re-architect Network ($30M) adds a ninth slot; High-Density Clusters ($50M) separately expands clusters to sixteen slots. Task detail folds when Cluster 2 is ordered and can be reopened manually. An initial agent installation takes four seconds; Provisioning Pipeline ($25M) halves installation duration. The initial pipeline permits one installation, while Dual and Four-Agent Provisioning raise that company-wide limit to two and four. Slots refill independently on the next game tick when capacity and funds allow. Faster AI Provisioning ($40M) precedes the sixteen-slot expansion; Dual Agent Provisioning ($75M) follows it. Both work in Manage Mode before the $200M Scale Mode, which takes over new cluster creation. Manual provisioning disappears.
- Phase 13 introduces autonomous nodes with unnamed agent tiles in a 4×4 grid, retaining Phase 12's smaller dimensions. From Phase 10 onward, available provisioning or Planning placeholders occupy the top-left position, followed by clusters from newest to oldest. New clusters push existing cards right and down, with no ordering change at Phase 13. Replication requires twenty online nodes and at least nine additional nodes during Phase 13, unlocks four concurrent cluster builds in Phase 14 and reduces cluster costs by 35%. The $2B Global Expansion requires forty completed nodes, reduces costs another 40% and introduces neoclouds in Phase 15. Each neocloud permanently groups 25 cluster numbers. Phase 15 adds two construction-speed upgrades, two upgrades that each halve cluster prices, and capacity for 25 and 50 simultaneous builds. Investor talks appear after all six upgrades and 500 completed clusters.
- Client retainer upgrades deploy contracts automatically, each earning $80/s before downtime and $2/s upkeep. Their income contributes to the normal income estimate; there is no separate cluster footer label. Two managed clusters increase agent task speed by 50%; three or more double it.
- Layered music adds a bright D4 + F4 synth motif from Phase 6: both notes sound together in two five-hit phrases per 4/4 bar, with each phrase lasting two beats. The 125 ms plucks have a slightly stronger middle hit, subtle stereo chorus and a light reverb tail. It fades in over eight seconds at a quiet background level. Music: On plays the full layered soundtrack; Music: Off silences every layer. Retirement restores the original soundtrack and stops the pressure layers, while keeping the saved music preference. Restarting through prestige stops all music until the new story begins.
- Breaking save change: the removed `layered` music setting is no longer accepted. Existing saves with that value are preserved but cannot load and require a reset. Saves with `on` or `off` remain valid.
- Phase 9 restores the original 172 BPM DnB groove with its own D4 + F4 hook, premixed into one seamless sixteen-bar WAV. One broad five-hit phrase per DnB bar keeps the hook locked to the faster drums. The drum component is mixed 15% lower while the hook retains its level. Once the mix is ready, it enters on the next drum downbeat; the earlier kick and standalone synth fade out together over three bars, about 6.3 seconds.

## Early automation and hiring checkpoints

Phases 2 and 3 receive variable bursts of five to ten jobs, with quiet intervals for the AI to catch up. The free AI works at half its former speed and drains 2.4 tokens per working second, so its ten-token tank lasts about 4.2 seconds of continuous work. Basic retains its existing work speed and token drain. The redundant AI Agent introduction modal, Pressure Building modal, Tool Use SDK modal and Manager Agent modal are removed. Their underlying unlocks still apply.

The original agent is AI 2000 Free in Phase 2. Upgrade to AI 2000 Basic renames it in Phase 3, where the lifestyle is Coffee Shop Regular. The second subscription is AI 2000 Pro. The income estimate includes the original agent using the same work-rate calculation as its production loop; empty tanks and idle agents add no estimated task income.

The first incident, whether triggered by a random failure or the twenty-second tutorial timer, introduces incidents exactly once. A timed introduction cannot also create a random incident in that tick. Prompt Engineering 101 appears in Phase 5 after at least three incidents have occurred, costs $3,200, and reduces failure rate by 20%.

The initial licence has three total slots, or four after prestige. The prestige bonus remains additive through subsequent capacity upgrades. Buying the third specialist and Task Templates exposes **Additional Agent Slot**, priced at $5,000. **Two More Agent Slots** adds another two after the speed upgrades. Parallel Prompting ($3,800, +15% speed) and Response Streaming ($5,200, +20% speed) follow that expansion and are required before six slots, or seven after prestige. Specialist roles may be bought repeatedly; Manager, Token Manager and DevOps remain unique. DevOps has its own slot in Incidents and does not consume shared agent capacity. This makes every advertised specialist slot usable.

Unlocked empty Manager and Token Manager positions are filled purchase cards at the top of Agents. Those positions are reserved until bought. Each other empty slot has a bordered card with filled buttons for buying each specialist type. Unaffordable purchases remain disabled. Buying a Manager costs $20,000, separately from its unlock upgrade.

Phase-entry task minimums are 105, 300, 750, 1,150, 5,000, 30,000, 150,000 and 1,000,000 for Phases 2 through 10. Phase 11 requires 2.5M tasks; later transitions add their own task or node requirements.

Phase 6 gives its tools and operations upgrades more room: Web Search Tool costs $7,500, Sales Playbook $12,000, Code Execution Tool $16,000 and Revenue Ops System $28,000. Bulk Processing ($9,000) targets ten tasks per job. Workflow Orchestration ($18,000) reveals at 3,500 tasks before Manager Agent, adding 25% more task arrivals and 20% agent speed. The active-player simulation checks that this phase gives its upgrades time to matter. This is a comparative pacing check, not a human playtime target.

Phase 8 keeps task-reveal milestones in the background. DevOps appears first, while later upgrades reveal as their task milestones are reached. Purchases still require enough cash. Its savings goals are Revenue Optimization ($150K, 45,000 tasks), DevOps Slot ($60K, 28,000-task background threshold, available immediately on entering Phase 8), Incident Runbooks ($175K, 65,000 tasks), Delivery Pipeline ($250K, 90,000 tasks, +25% agent speed) and Premium Client Contracts ($350K, 115,000 tasks, +35% task pay). Ralph-loops costs $1M and requires all preceding upgrades and at least 150,000 tasks. The deterministic journeys verify paid purchases throughout this phase before entering growth.

Empty agent slots offer one-click Buy Writer, Buy Researcher, Buy Coder, Buy Analyst and Buy Support buttons, with Buy Sales appearing in Phase 9. The card shows the per-agent price; each purchase button is disabled when unaffordable. There is no role dropdown. DevOps has a matching filled Buy DevOps purchase card with its price and a Dedicated incident slot label. Full shared capacity cannot block that purchase.

Before clusters, player-facing actions use Buy for agents. Clusters use Bring cluster online and Provision agent. The Token Manager upgrade description is “Automatically buy tokens when they run out.” Purchasing now happens before tank transfers, with enough headroom to keep tokens above the 4,000-token warning threshold when cash is available. DevOps has a separate $60K unlock upgrade in Phase 8.

## Batch throughput and progression

The Multi-Agent Licence description is “More agents, more work.” Four-slot and six-slot expansions block later upgrades until purchased. Bulk Processing targets ten tasks per job in Phase 6, Auto-Assign Playbooks raises the target to 100 in Phase 7, Revenue Optimization to 500 in Phase 8, and Growth Marketing to 2,000 in Phase 9. Each batched job varies by ±20% around its target and stores its actual batch size when created. Phase 7 jobs deliver 80–120 tasks, so the completion counter's final digits change naturally. Completion adds the actual count without multiplying its cash payout. Job difficulty stops growing after the early fatigue ramp. No free task-count grants are used to reach one million before Cluster 1.

Cluster expenses are labelled Server power & cooling. Cluster construction includes management agents, then empty slots provision identical agents with an installation progress bar. Agent tiles and task buttons use the same four-character lowercase hexadecimal ID, such as 0a7f. Active agents never share an ID. Empty purchasable slots show +, and each slot requires its own purchase. There is no separate agent-count line. Eligible **Sell** buttons sit in the top-right card header. Empty clusters say **Needs Agents** in orange; partly staffed clusters say **Partially Operational**; **Installing agents** appears only during a real installation. No specialist-role purchase buttons appear inside clusters.

Once the overview contains four cluster or purchase cards, its cards become denser. The grid grows within the main control panel, with no internal vertical scrollbar. Card widths, padding, gaps and agent-slot heights decrease as more clusters are added. Status and construction progress stay visible. Eight-slot clusters use four columns, Re-architect Network adds a 3×3 grid and High-Density Clusters expands it to 4×4. Phases 13 and 14 use the same card and agent-slot dimensions as Phase 12, with agent names hidden. Phase 15 switches to compact cluster tiles inside neoclouds. Clusters and neoclouds run newest first throughout, with available placeholders ahead of them. The Tasks Complete heading uses comma-separated totals.

Neocloud 1 contains C1–C25, Neocloud 2 contains C26–C50, and so on. Historical cluster sales leave gaps without moving other clusters between groups. Neoclouds and their cluster tiles run newest first. The newest group and groups with active construction use the full panel width; older groups form a compact grid. Each group shows completed-node count, active builds and delivery income. Planning appears before the latest cluster in its eventual neocloud. Building and completed tiles retain their positions.

The opening upgrade panel shows only **Tools of the Trade** after seven completed tasks. Clicking anywhere on it dismisses the card and reveals the paid upgrades without changing resources or stats. The former Incoming and Tools of the Trade dialogs no longer appear.

## CEO scaling upgrades

Provisioning upgrades stay available throughout construction and staffing. Faster AI Provisioning ($40M) speeds coordination and agent installation by 50% and precedes High-Density Clusters ($50M). Dual Agent Provisioning ($75M) maintains two installations before the $200M Scale Mode purchase enters Phase 12. Phase 12 then adds Four-Agent Provisioning ($100M), Parallel Cluster Builds ($150M), Preassembled Server Racks ($200M), the expansion desk ($2.5M), Rapid Cluster Deployment ($300M), Fully Fitted Racks ($400M) and the Autonomous Operating Model ($760M). Fully fitted racks include the $40K cost of all sixteen agents in each new cluster purchase.

CEO prices remain fixed independently of the player's wallet. Provisioning Pipeline ($25M) and Re-architect Network ($30M) make the first two upgrades separate savings goals, including for a player entering Phase 11 with $40M. Regression simulations check action intervals of 0.5, 5 and 10 seconds and retain the later scaling savings goals. These are deterministic pacing comparisons, not human playtime predictions. Dual Agent Provisioning has one definition and one rendered purchase; Parallel Cluster Builds is a separate construction upgrade.

Phase 13 adds Continuous Deployment ($150M), improving construction from three seconds to two, with two independently refilled builds. Phase 14 expands that limit to four. From Phase 15, construction accelerates from 1x at forty completed nodes to 4x at one hundred. Phase 15 then offers this upgrade sequence:

| Upgrade | Cost | Completed clusters | Effect |
| --- | ---: | ---: | --- |
| Neocloud Deployment Pipeline | $2B | 100 | Halve construction time |
| Standardised Construction | $1B | 125 | Halve each new cluster's full price |
| Neocloud Construction | $2B | 150 | Build 25 clusters concurrently |
| Bulk Hardware Contracts | $1.5B | 200 | Halve each new cluster's full price again |
| Factory-Direct Hardware | $2B | 400 | Lower hardware costs and replace quadratic price growth with linear scaling |
| Dedicated Hardware Supply | $2.5B | 450 | Halve construction time again |
| Parallel Neoclouds | $3B | 500 | Build 50 clusters concurrently |

Standardised Construction and Bulk Hardware Contracts stack to a 75% discount. Factory-Direct Hardware then replaces the quadratic hardware price with a lower linear curve. These reductions apply to every rising price within a construction run and its funding target, and remain active in Phase 16. A fully upgraded company starting at 500 completed clusters with no cash sustains 22.5 completed clusters per second after its initial funding period, close to one 25-cluster neocloud per second. Existing investments retain their original amounts. Large runs compress their staggered starts so the whole cohort overlaps in construction. Earlier starts remain 300–400ms apart. Remaining times include queued start delays; progress stays at zero until each start, and reloads preserve timing. Construction consumes cash at the rising price for each cluster. Network task throughput remains 2x, 3x and 7x in Phases 13, 14 and 15 onwards, without multiplying cash payouts or token drain.

Node-based progression counts fully completed clusters. Upgrade descriptions omit parenthesized node counts; node requirements still gate purchases. A new construction project cannot disable an otherwise satisfied node target. Compact-node conversion preserves ongoing fully fitted rack construction without prematurely producing tasks.

## Company leadership and delivery

From Phase 11, token purchasing becomes one company-wide Token Manager service, shown beside the AI CEO in agent cards above the cluster grid. Cluster managers and DevOps remain local to each team. The Token Manager automatically supplies every managed cluster and shows reserve tokens, smoothed consumption and its latest purchase. The Token Manager transfers up to 250 tokens into each cluster per 100ms tick. Cluster managers refill worker tanks when they reach 10%, using only the tokens currently in the cluster tank. Purchases still deduct cash and follow the existing pack-price curve. There is no additional manual Manager-refill requirement.

Cluster work capacity scales with the company: twelve task spaces and one arrival per spawn interval for each managed cluster. This removes the old twelve-task ceiling across the entire company. A three-cluster Phase 11 regression scenario consumes over 25,000 tokens in one minute while conserving total tokens across reserve, cluster and agent tanks.

An outlined Bring cluster online card occupies the first grid position, ahead of existing clusters. It is disabled when unaffordable and hidden during construction, at capacity or after Scale Mode is bought. Manual orders require all existing clusters to be fully online. Five full clusters are needed before Scale Mode appears. In Scale Mode, a noninteractive Planning card previews the next cluster after the latest cluster has nine to twelve agents online. From Phase 13, Planning remains visible before the newest cluster, including during construction. It shows land searching, council negotiations, lease drafting or the next funding target. Ordinary expansion requires twice the next cluster price. Whole-neocloud construction requires twice the combined rising prices of the next 25 or 50 clusters before starting a run. This budget applies in Phases 15 and 16 and includes no separate exit reserve. Expansion has no fixed cluster-count limit.

At two managed clusters, the board adds a Delivery panel with a ten-second smoothed completion rate, queued and in-progress counts, and three recent completions. Fixed grid columns and tabular numerals keep the queue and work counts from shifting as delivery grows. The task-heading row has no duplicate Delivery label. Tasks fold immediately when Cluster 2 is ordered, including while it is under construction. Buying the CEO preserves a manual reopening. A right-aligned Hide tasks / Show tasks chevron toggles detail and keeps keyboard focus; manual reopening persists through later phase changes in the current session. Reloading a CEO-led company starts with tasks folded. From Phase 13 the panel shows the delivery rate, managed-node count and delivery revenue without individual task controls. Observation history and the expanded-list preference are session-only, reset on a new story, and do not alter the save schema.

## Finish

After all seven Phase 15 expansion upgrades and 500 completed clusters, **Host Investor Talks** appears for $90K and takes eight seconds. Completing the talks enters Phase 16. Its company-size condition is already satisfied when the card appears. Three deterministic active-player journeys spend about three minutes in Phase 15 before talks become available.

The sale then proceeds one step at a time:

| Action | Cost | Active preparation time |
| --- | ---: | ---: |
| Host Investor Talks | $90K | 8 seconds |
| Appoint a Sale Advisor | $5M | 10 seconds |
| Discuss a Management Buyout | $20M | 12 seconds |
| Complete Due Diligence | $100M | 18 seconds |
| Agree Sale Terms | $250M | 10 seconds |
| Complete Company Sale | $5B | Immediate settlement |

Each preparation step charges once when started, shows its activity and progress, and unlocks the next action only on completion. Remaining preparation time survives reloads and pauses with dialogs, hidden tabs and offline gaps. Company operations and expansion continue during preparation. Completed steps provide the next piece of the sale story.

The final action requires debt below 10, at least 100 completed nodes, no unresolved incidents, and estimated income above twice expenses. A live checklist explains the cash and operating conditions. The sale settles at current cash plus 120 seconds of estimated income and immediately freezes the company. The company and pressure music fade to black over one second, followed by a 400ms black pause and a 1.2-second reveal of the golf-and-health retirement screen and original soundtrack. Reduced motion skips the transition. Reloading resumes the transition from the saved sale time, or opens retirement directly when it has finished.

Choose on that screen:

1. **Interesting, there's another model out…** starts again with permanent click power, starting tokens, and the earned extra starting agent slot. The introduction and central opening return with different story text. Music stops, while its preference is retained.
2. **Actually retire** completes the permanent ending. Starting a new story from there requires confirmation.

Both ending stages persist on reload. There is no restart or retirement choice before selling the company.

Income estimates use whole-job throughput rather than the remaining time on a nearly finished job. Empty agent tanks contribute no task income.

## Saves and offline progress

Progress is stored locally in the browser, automatically every ten seconds and when leaving or hiding the page. No accounts, backend, or network saves are required.

**Breaking change:** this release uses save format version 18 for the automatic assistant cycle and break state. It does not migrate earlier saves, including version 17. Incompatible saves are preserved until the player explicitly resets them; a visible notice explains the problem. Current saves persist assistant work and breaks, sale preparation, construction, worker slots and task-arrival delays. Storage failures remain visible and can be retried.

Offline earnings are limited to recurring services and referral contracts at 50% efficiency, minus expenses, for up to eight hours. Offline losses are forgiven. Busy-agent snapshots do not generate offline income. Returning from a background tab follows the same rule. Settings dialogs pause foreground simulation. Phase transitions and the first incident do not open dialogs. Your First Incident appears as an optional free info upgrade that dismisses on click without changing resources or blocking progress. It disappears after Phase 9. Keeping AI Running, Your First Cluster and Running an Autonomous Network no longer appear; their upgrade IDs remain valid in saved progress. Portrait play has no rotation prompt. Offline earnings are credited immediately and recorded in the event log without a Collect dialog. The save version and required fields are unchanged; existing version 18 saves retain their progress.

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
- Three deterministic 16-phase playthroughs start from zero cash without cheats or resource grants and reach retirement with more than 100 nodes. They verify that free AI requires the preceding paid tools, while Basic, the second AI and the multi-agent licence remain savings goals. Separate opening checks verify that skipping the tools prevents the unlock. They exercise a very active player, so their timings are a progression regression check, not a prediction of human playtime.
- Three additional playthroughs test CEO saving goals at 0.5, 5 and 10-second action intervals, including separate Pipeline and network-density purchases and larger Scale Mode and agent-batching goals.
- A separate five-minute Phase 8 simulation verifies sustained automation without manual refills.
- Coverage requires **100% of added or changed executable game lines** relative to release baseline `45bc33c`. The report also displays coverage of the entire legacy game; that is a separate metric. No production code is excluded from instrumentation.
- Chrome checks cover desktop, 320px and 390px portrait phones, landscape, scrolling, keyboard activation/focus, invalid-save reset, and ending persistence. Screenshots are written to ignored `test-results/`.

Balance checks record the first visible cash, price, task count and completed-cluster count for every one-time upgrade. The journey represents an extremely active player and is a progression check, not a human playtime target. Major upgrades now cost $35M for CEO readiness, $300M for Rapid Cluster Deployment, $760M for autonomous nodes, $1.5B for replication and $2B for global expansion. The sale process begins with $90K investor talks, followed by $5M, $20M, $100M and $250M preparation steps, and the final $5B sale action.

The fixed coverage baseline keeps the release coverage requirement enforceable after these changes are committed. When establishing a future release baseline, update it deliberately in `tests/coverage-check.cjs`.

## Console checkpoints

Use `chPh0()` to immediately clear saved progress and reload to a fresh game, including from retirement. It calls `GAME.resetSave()` without a confirmation prompt.

Use `chStart9()` to play Phase 9 from its entry, with growth upgrades still unpurchased. `chPh10()` is an end-of-Phase-9 checkpoint with 1M tasks and $1.2M, including the growth purchases and leaving $300K to earn for the acquisition. `chPh11()` prepares late Phase 10 with 4.6M tasks, $30M and 3 fully staffed clusters, leaving $5M to earn for AI CEO Readiness. `chPh12()` prepares late Phase 11 with 27M tasks, $180M and 5 fully staffed clusters, leaving $20M to earn for Scale Mode and Phase 12. See [balance landmarks](BALANCE.md) for rough task and cash ranges during ordinary play.

`chRetire()` replaces the current save with Phase 16, one billion tasks, five hundred fully staffed nodes, all five preparation steps complete, sufficient cash, healthy operations and an immediately usable **Complete Company Sale** action. Clicking its $5B button begins the ending fade.

`chPh2()` through `chPh13()` build the preceding phase with the required upgrades and a staffed team, usually three tasks before the next transition. `chPh13()` prepares late Phase 12 with 63M tasks, $600M and 21 fully staffed clusters, leaving $160M to earn for Autonomous Operating Model. `chPh3()` and `chPh5()` retain their $1,900 and $1,300 savings goals. `chPh4()` prepares Second AI Subscription at 870 tasks and $14,000, with all earlier purchases complete and the second subscription still unpurchased. `chPh9()` prepares Ralph-loops at 390,000 tasks and $800,000, leaving $200,000 to earn. For example, `chPh7()` loads Phase 6 at 4,997 tasks with $40,000; complete three tasks and buy Manager Agent to enter Phase 7.

`chPh14()` and `chPh15()` load 19 and 39 staffed nodes respectively. Provision and staff the next node to reach the replication or global expansion checkpoint. `chPh16()` loads 500 staffed nodes with the seven expansion upgrades purchased, ready for investor talks. Completing the eight-second investor event enters Phase 16 and begins the remaining sale journey. `chPh1()` loads 50 tasks with Dual Monitors and Noise-Cancelling Headphones still unpurchased, while `chPh0_()` loads 35 tasks with Side Hustle Optimization and Inbox Zero available. Helpers replace the current saved game and also work from the retirement screen. They use real upgrade and hiring logic, and are regression-tested for valid saves and successful next-phase purchases.

## Release

Run `npm run check`, then publish the static runtime files through the repository's normal deployment process:

- `index.html`
- `themes.css`
- `game.js`
- `favicon.svg`
- `soundtrack-loop.mp3`
- `precursor_kick.mp3`
- `synth_d4_loop.mp3`
- `dnb_synth_loop.wav`

Do not publish `node_modules`, coverage reports, or test artifacts. Tests and tooling are development-only. This work does not require a new hosting service.

This is a public repository. Do not commit credentials, API keys, passwords, access tokens, private keys, personal contact details, private service URLs, machine-specific filesystem paths, or confidential internal information. Use placeholders in documentation and examples.

The canonical design reference is [the repository design spec](../DESIGN.md). Advanced routing topology, dynamic cluster agent caps, and autonomous CEO strategy customization remain explicitly outside this game's release scope.

**Breaking phase and cheat change:** Second AI Subscription now starts Phase 4; every former Phase 4–15 becomes Phase 5–16. `chPh4()` replaces `chPh3_1()`, later numbered cheats move up one, and `chStart9()` replaces `chStart8()`. No old aliases are retained.

**Breaking debug API change:** manual provisioning now requires `GAME.buyClusterWorker(clusterId, slotIndex)`, with a zero-based slot index. A slot can only purchase itself, in order. The former cluster-only manual call no longer provisions an agent.

Reality Check appears from 85 completed tasks after all earlier upgrades, including Dual Monitors and Noise-Cancelling Headphones, are purchased. Expenses start at 85 tasks. Discover Free-Tier AI appears from 105 completed tasks after Reality Check and all earlier purchases. It displays a 150-task requirement and remains disabled until 150 tasks are complete.
