# Rough progression landmarks

These are orientation ranges from three deterministic full journeys using seeds 17, 42 and 123 with a player action every half second. They describe an extremely active player, not expected human playtime. Cash is the wallet immediately after paying for the phase unlock, rather than lifetime earnings. Purchases, token packs and incidents can make the wallet fluctuate sharply.

| Phase | Approximate tasks on entry | Approximate cash left on entry | Main savings goals in that phase |
| --- | ---: | ---: | --- |
| 1 | 0 | $0 | First tools: $34–$51 |
| 2 | 106 | $26–$51 | Prompt Library $150, Gig Alerts $250, Prompting $450, Marketing $650, Basic subscription $2,000 |
| 3 | 371–385 | $0–$6 | Client Outreach $4,500, Second subscription $18K, Inference Tuning $6K, Prompt Refinement $1.5K, Context Pruning $2.5K, Multi-Agent Licence $25K |
| 4 | 1,350–1,415 | $138–$414 | Slots and speed, then Tool Use SDK $12K |
| 5 | 1,595–1,710 | $262–$14.1K | Tools and sales, Workflow Orchestration $18K, then Manager unlock $12K and Manager purchase $20K |
| 6 | 5,000–5,035 | $57K–$107K | Token Manager unlock $40K |
| 7 | 30,145–30,400 | $130K–$209K | Operations upgrades, then Ralph-loops $1M |
| 8 | 318,000–369,000 | $5.9K–$9.2K | Growth $300K, Referrals $500K, Enterprise Pipeline $1M, Project Playbooks $750K, Account Expansion $1.25M, acquisition $1.5M |
| 9 | 1.002M–1.006M | $597K–$2.11M | Blueprint $1.5M, Second Permit $2.5M, Third Permit $12M, operations upgrades, then CEO Readiness $35M |
| 10 | 3.83M–4.33M | $3.8K–$153K | AI CEO $1M, Pipeline $25M, ninth slots $30M, Faster Provisioning $40M, sixteen slots $50M, Dual Provisioning $75M, Scale Mode $200M |
| 11 | 11.9M–13.9M | $233K–$1.58M | Four-Agent Provisioning $100M, Parallel Builds $150M, Preassembled Racks $200M, Rapid Cluster Deployment $300M, Fully Fitted Racks $400M, Autonomous Operating Model $760M |
| 12 | 43M–48.2M | $152K–$6.49M | Continuous Deployment $150M, then Node Replication $1.5B at 20 or more completed nodes |
| 13 | 117M–123M | $14.1M–$18.2M | Four concurrent builds, then Global Expansion $2B at 40 completed nodes |
| 14 | 258M–263M | $1.4M–$5.71M | Neocloud speed upgrades $350M and $750M, 25 concurrent builds $500M, 50 concurrent builds $1B, then investor talks at 200 completed clusters |
| 15 | 674M–680M | $1.309B–$1.314B | Advisor $5M, buyout discussion $20M, due diligence $100M, terms $250M, final sale $5B; sampled retirement at 1.705B–1.713B tasks |

The earliest allowed entry can be substantially below these task counts. For example, Phase 8 requires 150,000 tasks, but the sampled players reach that threshold before they can afford all preceding purchases. `chStart8()` uses this minimum; other checkpoint helpers use the task and cash values described below.

## Phase 9 savings goals

The extra spending is concentrated in Phase 9 upgrades and the first two Phase 10 improvements. Agent installation and cluster construction retain their existing prices, preserving the later expansion curve.

| Upgrade | Task milestone | Price |
| --- | ---: | ---: |
| Cluster Operations Blueprint | 1.05M | $1.5M |
| Second Cluster Permit | 1.15M | $2.5M |
| Third Cluster Permit | 1.5M | $12M |
| Cluster Runbooks | 1.75M | $3.5M |
| Cross-Cluster QA Mesh | 2M | $5M |
| Cluster Revenue Platform | 2.25M | $6.5M |
| AI CEO Readiness | 2.5M | $35M |

These task milestones control visibility in the background. Existing staffing requirements still gate purchases. All three sampled journeys need to save for the Third Cluster Permit, CEO Readiness, Provisioning Pipeline and Re-architect Network when first offered. A $9M wallet cannot buy the third permit, $30M cannot buy readiness, and a $40M Phase 10 reserve cannot buy both the $25M Pipeline and $30M network upgrade.

## Checkpoint interpretation

- `chPh0_2()` loads seven tasks with the first three upgrades available.
- `chPh0_3()` loads 35 tasks with Side Hustle Optimization, Inbox Zero and GTD Workflow available.
- `chPh0_4()` loads 100 tasks with Discover Free-Tier AI visible; one five-task manual session reaches its 105-task requirement.
- `chPh3()` loads the transition into Phase 3 with $1,900 cash, leaving $100 to earn for the Basic subscription.
- `chPh3_1()` loads Phase 3 at 870 tasks and $14,000, just before Second AI Subscription. All earlier upgrades are purchased; another $4,000 funds the subscription.
- `chPh4()` loads the transition into Phase 4 with $1,300 cash. The subscriptions, Inference Tuning, Prompt Refinement and Context Pruning are already purchased; the licence remains a savings goal.

- `chStart8()` loads the beginning of Phase 8 at 150,000 tasks, with its growth upgrades left to play through.
- `chPh8()` loads Phase 7 at 390,000 tasks and $800,000, leaving $200,000 to earn before buying Ralph-loops.
- `chPh9()` loads late Phase 8 at 1M tasks and $1.2M, with ordinary upgrades already purchased and $300K left to earn for the acquisition.
- `chPh10()` loads late Phase 9 at 4.6M tasks, $30M and 3 fully staffed clusters, leaving $5M to earn for AI CEO Readiness.
- `chPh11()` loads late Phase 10 at 27M tasks, $180M and 5 fully staffed clusters, with $20M left to earn for Scale Mode and Phase 11.
- Other `chPhN()` shortcuts likewise prepare the transition into that numbered phase. Their injected cash and purchased upgrades are not balance measurements.
- `chRetire()` loads an immediately purchasable Complete Company Sale action, with every preparation step complete.

## Expansion funding

Ordinary CEO expansion requires twice the next cluster price. After Neocloud Construction or Parallel Neoclouds, a construction run requires twice the combined rising prices of the next 25 or 50 clusters. The CEO pays each cluster price individually, respects its concurrency limit and resumes when funding recovers. This budget is the same in Phases 14 and 15; no separate exit reserve is added. Planning shows the current funding target. Sale preparation takes 58 active seconds across five purchases while the company keeps growing. The three sampled journeys retire with 441–442 clusters and 1.705B–1.713B completed tasks.
