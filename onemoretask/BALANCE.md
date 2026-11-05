# Rough progression landmarks

These are orientation ranges from three deterministic full journeys using seeds 17, 42 and 123 with a player action every half second. They describe an extremely active player, not expected human playtime. Cash is the wallet immediately after paying for the phase unlock, rather than lifetime earnings. Purchases, token packs and incidents can make the wallet fluctuate sharply.

| Phase | Approximate tasks on entry | Approximate cash left on entry | Main savings goals in that phase |
| --- | ---: | ---: | --- |
| 1 | 0 | $0 | First tools: $30–$51 |
| 2 | 150–153 | $264–$323 | Prompt Library $150, Gig Alerts $250, Prompting $450, Marketing $400, Basic subscription $2,000 |
| 3 | 347–370 | $2–$49 | Client Outreach $4,500, then Second AI Subscription $18K to enter Phase 4 |
| 4 | 965–983 | $162–$345 | Inference Tuning $6K, Prompt Refinement $1.5K, Context Pruning $2.5K, then Multi-Agent Licence $25K |
| 5 | 1.32K–1.35K | $48–$176 | Slots and speed, then Tool Use SDK $12K |
| 6 | 1.58K–1.67K | $8–$359 | Tools and sales, Workflow Orchestration $18K, then Manager unlock $12K and Manager purchase $20K |
| 7 | 5.00K–5.02K | $46.18K–$85.31K | Token Manager unlock $40K |
| 8 | 30.16K–30.26K | $85.98K–$150.86K | Operations upgrades, then Ralph-loops $1M |
| 9 | 363.72K–427.88K | $2.09K–$8.19K | Growth $300K, Referrals $500K, Enterprise Pipeline $1M, Project Playbooks $750K, Account Expansion $1.25M, acquisition $1.5M |
| 10 | 1.00M–1.11M | $56.78K–$1.17M | Blueprint $1.5M, Second Permit $2.5M, Third Permit $12M, operations upgrades, then CEO Readiness $35M |
| 11 | 4.25M–4.55M | $62.85K–$383.10K | AI CEO $1M, Pipeline $25M, ninth slots $30M, Faster Provisioning $40M, sixteen slots $50M, Dual Provisioning $75M, Scale Mode $200M |
| 12 | 13.72M–14.63M | $340.39K–$596.69K | Four-Agent Provisioning $100M, Parallel Builds $150M, Preassembled Racks $200M, Rapid Cluster Deployment $300M, Fully Fitted Racks $400M, Autonomous Operating Model $760M |
| 13 | 47.64M–49.63M | $26.28K–$3.00M | Continuous Deployment $150M, then Node Replication $1.5B at 20 or more completed nodes |
| 14 | 122.05M–123.94M | $14.00M–$19.87M | Four concurrent builds, then Global Expansion $2B at 40 completed nodes |
| 15 | 262.50M–264.38M | $1.27M–$7.12M | Neocloud speed upgrades $2B and $2.5B, cost reductions $1B and $1.5B, linear hardware pricing $2B, 25 concurrent builds $2B, 50 concurrent builds $3B, then investor talks after all seven upgrades and 500 completed clusters |
| 16 | 10.46B–11.96B | $5.91B–$6.35B | Advisor $5M, buyout discussion $20M, due diligence $100M, terms $250M, final sale $5B |

The earliest allowed entry can be substantially below these task counts. For example, Phase 9 requires 150,000 tasks, but the sampled players reach that threshold before they can afford all preceding purchases. `chStart9()` uses this minimum; other checkpoint helpers use the task and cash values described below.

## Phase 10 savings goals

The extra spending is concentrated in Phase 10 upgrades and the first two Phase 11 improvements. Agent installation and cluster construction retain their existing prices, preserving the later expansion curve.

| Upgrade | Task milestone | Price |
| --- | ---: | ---: |
| Cluster Operations Blueprint | 1.05M | $1.5M |
| Second Cluster Permit | 1.15M | $2.5M |
| Third Cluster Permit | 1.5M | $12M |
| Cluster Runbooks | 1.75M | $3.5M |
| Cross-Cluster QA Mesh | 2M | $5M |
| Cluster Revenue Platform | 2.25M | $6.5M |
| AI CEO Readiness | 2.5M | $35M |

These task milestones control visibility in the background. Existing staffing requirements still gate purchases. All three sampled journeys need to save for the Third Cluster Permit, CEO Readiness, Provisioning Pipeline and Re-architect Network when first offered. A $9M wallet cannot buy the third permit, $30M cannot buy readiness, and a $40M Phase 11 reserve cannot buy both the $25M Pipeline and $30M network upgrade.

## Checkpoint interpretation

- `chPh0_()` loads 35 tasks with Side Hustle Optimization, Multitasking and Inbox Zero available.
- `chPh3()` loads the transition into Phase 3 with $1,900 cash, leaving $100 to earn for the Basic subscription.
- `chPh4()` loads Phase 3 at 870 tasks and $14,000, just before Second AI Subscription. All earlier upgrades are purchased; another $4,000 funds the subscription.
- `chPh5()` loads the transition into Phase 5 with $1,300 cash. The subscriptions, Inference Tuning, Prompt Refinement and Context Pruning are already purchased; the licence remains a savings goal.

- `chStart9()` loads the beginning of Phase 9 at 150,000 tasks, with its growth upgrades left to play through.
- `chPh9()` loads Phase 8 at 390,000 tasks and $800,000, leaving $200,000 to earn before buying Ralph-loops.
- `chPh10()` loads late Phase 9 at 1M tasks and $1.2M, with ordinary upgrades already purchased and $300K left to earn for the acquisition.
- `chPh11()` loads late Phase 10 at 4.6M tasks, $30M and 3 fully staffed clusters, leaving $5M to earn for AI CEO Readiness.
- `chPh12()` loads late Phase 11 at 27M tasks, $180M and 5 fully staffed clusters, with $20M left to earn for Scale Mode and Phase 12.
- `chPh13()` loads late Phase 12 at 63M tasks, $600M and 21 fully staffed clusters, with $160M left to earn for Autonomous Operating Model.
- Other `chPhN()` shortcuts likewise prepare the transition into that numbered phase. Their injected cash and purchased upgrades are not balance measurements.
- `chRetire()` loads an immediately purchasable Complete Company Sale action, with every preparation step complete.

## Expansion funding

Ordinary CEO expansion requires twice the next cluster price. After Neocloud Construction or Parallel Neoclouds, a construction run requires twice the combined rising prices of the next 25 or 50 clusters. The CEO pays each cluster price individually, respects its concurrency limit and resumes when funding recovers. This budget is the same in Phases 15 and 16; no separate exit reserve is added. Planning shows the current funding target. Sale preparation takes 58 active seconds across five purchases while the company keeps growing. Standardised Construction and Bulk Hardware Contracts each halve every cluster price, including its staffing cost, and the funding target uses those discounted prices. Factory-Direct Hardware ($2B, after Bulk Hardware Contracts and 400 completed clusters) lowers hardware prices by replacing the squared scale factor with ten times the scale factor. Costs then grow linearly. Dedicated Hardware Supply follows at 450 completed clusters; Parallel Neoclouds follows at 500. The three sampled journeys spend 169.5–179.5 seconds in Phase 15 before investor talks appear, enter Phase 16 after 177.5–187.5 seconds with 2,616–2,843 completed clusters, and retire with 3,816–4,043 clusters and 19.936B–22.080B completed tasks. A separate fully upgraded company starts with 500 clusters and zero cash, pays all expansion and operating costs from income, and sustains 22.5 completed clusters per second over a twenty-second steady period after ten seconds of startup. That is approximately one 25-cluster neocloud per second.
