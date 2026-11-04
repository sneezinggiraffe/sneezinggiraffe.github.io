# Rough progression landmarks

These are orientation ranges from three deterministic full journeys using seeds 17, 42 and 123 with a player action every half second. They describe an extremely active player, not expected human playtime. Cash is the wallet immediately after paying for the phase unlock, rather than lifetime earnings. Purchases, token packs and incidents can make the wallet fluctuate sharply.

| Phase | Approximate tasks on entry | Approximate cash left on entry | Main savings goals in that phase |
| --- | ---: | ---: | --- |
| 1 | 0 | $0 | First tools: $34–$51 |
| 2 | 100 | $5–$15 | Prompting $450, Marketing $650, Basic subscription $2,500 |
| 3 | 360–375 | $5–$25 | Second subscription $18K, Multi-Agent Licence $25K |
| 4 | 1,200–1,300 | $70–$160 | Slots and speed, then Tool Use SDK $12K |
| 5 | 1,500–1,650 | $180–$820 | Tools and sales, then Manager unlock $12K and Manager purchase $20K |
| 6 | 5,000 | $14K–$100K | Token Manager unlock $40K |
| 7 | 30,000 | $20K–$160K | Operations upgrades, then Operations Flywheel $1M |
| 8 | 370,000–570,000 | $0–$6K | Growth $300K, Referrals $500K, Enterprise Pipeline $1M, acquisition $1.5M |
| 9 | 1.0M–1.2M | $15K–$1.7M | Cluster permits and staffing, then CEO readiness $4M |
| 10 | 1.8M–2.0M | $2.6M–$8M | AI CEO $1M, ninth slots $15M, sixteen slots $50M, Scale Mode $200M |
| 11 | 36M–42M | $1.3M–$4.8M | Fully Fitted Racks $400M, Autonomous Operating Model $750M |
| 12 | 56M–63M | $0.5M–$4.5M | Continuous Deployment $150M, then replication at 20 or more completed nodes |
| 13 | 68M–75M | $0.15M–$6.7M | Global Expansion $250M at 40 completed nodes |
| 14 | 85M–92M | $4M–$10M | Reach 100 completed nodes and prepare the sale for $2B |
| 15 | 440M–460M | $0.2M–$30M | Save $5B for Golden Parachute; retire at roughly 1.02B completed tasks |

The earliest allowed entry can be substantially below these task counts. For example, Phase 8 requires 150,000 tasks, but the sampled players reach that threshold before they can afford all preceding purchases. The phase-entry cheat uses the minimum rather than these sampled totals.

## Checkpoint interpretation

- `chStart8()` loads the beginning of Phase 8 at 150,000 tasks, with its growth upgrades left to play through.
- `chPh8()` loads just before unlocking Phase 8.
- `chPh9()` loads late Phase 8, with ordinary upgrades already purchased, just before the acquisition.
- Other `chPhN()` shortcuts likewise prepare the transition into that numbered phase. Their injected cash and purchased upgrades are not balance measurements.
- `chRetire()` loads an immediately purchasable Golden Parachute.

## Expansion funding

CEO expansion keeps cash equal to twice the next cluster price before opening a new project. In Phase 15 it also keeps $5B for the exit. Funding pauses are expected and automatically end when sufficient cash is available. There is no hard cluster-count limit. The Planning card shows the cluster funding amount and explains the exit reserve when applicable.
