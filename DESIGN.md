# One More Task: design and release specification

Date: 2026-11-02
Scope: `onemoretask/index.html`, `onemoretask/game.js`

This is the current agreed design, including the phase, fuel, cluster and network revisions. It replaces the earlier eleven-phase target.

## Experience

Start with manual freelance work, delegate to AI, feel the cost of keeping it running, hire management, reorganise into clusters, then let the CEO build a network of more than one hundred nodes before retiring. Reveal controls gradually. Tasks must stay visibly in progress during the early automation phases. Desktop and mobile are both supported.

## Phase progression

| Phase | Identity | Entry upgrade |
| --- | --- | --- |
| 1 | Manual freelance work | Start |
| 2 | Free AI | free_ai |
| 3 | AI Worker Pro and paid fuel | pro_model |
| 4 | Specialist workers | multi_bot |
| 5 | Tools and preparation for management | tool_use |
| 6 | Manager-led operation | manager_agent |
| 7 | Token purchasing and incident automation | token_manager_unlock |
| 8 | Growth marketing and referrals | ops_flywheel |
| 9 | Managed clusters | acquire_micro_agency |
| 10 | AI CEO: manage, then scale | ceo_readiness |
| 11 | CEO training | ceo_course |
| 12 | Compact autonomous nodes | autonomous_nodes |
| 13 | Node replication | replication |
| 14 | Global expansion | global_network |
| 15 | Sale, retirement or prestige | retire_unlock |

## Tasks and fuel

1. Automated work takes at least two seconds. Completed cards remain for 1.5 seconds. Started tasks do not expire.
2. Reserve tokens and loaded fuel are separate. One reserve token becomes exactly one fuel unit. Workers hold ten units and the Manager holds one hundred.
3. Phase 2 top-ups are free. Phase 3 grants two hundred starter reserve tokens once, explicitly logged. Upgrade grants and Token Manager purchases also name their source in the log.
4. The Manager supplies AI Worker Pro and all specialist workers, as well as assigning work. Transfers deduct the actual amount from its tank. Hiring a Manager loads from the reserve, without minting fuel.
5. The Token Manager buys packs using cash, refills management tanks, and can fuel workers directly when no Manager exists. Unlocking the role alone does not hire it or enable purchases.
6. Before clusters, list hired roles in this order: Manager, Token Manager, DevOps, then workers. Locked roles have no cards or placeholders. One hire row shows available unowned roles.
7. Auto OFF prevents self-assignment. Explicit worker top-up starts a job; a Manager controls assignment once present.
8. Quality affects cash and reputation, reliability affects time-based failures, and token traits and efficiency affect consumption.

## DevOps

DevOps resolves warning and critical incidents automatically. Critical incidents consume twice the response time. There is no final player approval step. Manual and paid fixes remain optional shortcuts. A cluster management team includes its own DevOps response capacity.

## Clusters, Phase 9 through 11

1. The existing workforce, including AI Worker Pro, becomes Cluster 1. Acquisition includes a complete management team. Individual utility cards become part of the team.
2. Opening another cluster creates an empty shell. A single $12,000 Management team purchase supplies Manager, Token Manager and DevOps. No workers can be hired before that purchase.
3. Workers cost $2,500 each and are hired directly into a named cluster, up to eight workers. The team's utility roles consume no worker slots.
4. Each team's fuel tank serves its own workers. There is no unmanaged-worker panel, global utility section, individual firing, or control-slot reassignment.
5. Empty clusters cost $50,000. A one-time discounted lease is available in the shop. There are at most eight detailed clusters.
6. The CEO's Scale Mode requires Manage Mode. It purchases missing management, fills worker capacity, then opens more clusters. Initially it acts every ten seconds; the training course reduces that to five seconds.
7. Services remain visible as recurring contracts. Each earns $80/s before downtime and $2/s upkeep.

## Autonomous network, Phase 12 onward

1. Three managed clusters and 1,600 completed tasks unlock the autonomous operating model. Existing workers become each node's workforce count and their loaded fuel transfers to its tank.
2. Nodes appear as small boxes with workforce and operating status. They contain no player controls. Aggregate simulation replaces individual task and worker objects.
3. Node production consumes fuel; production stops when fuel runs out. Token Managers continue paid reserve purchases and distribution.
4. The CEO finishes any partially staffed nodes, then buys complete eight-worker nodes with management. Initial complete-node cost is $1M. New-node purchases require cash equal to twice their price.
5. At twelve managed nodes, Replication reduces node costs by 35% and the expansion interval to two seconds.
6. At forty managed nodes, Global Expansion reduces costs by another 40% and the interval to one second. Complete nodes then cost $390,000.
7. The network supports 128 nodes. Golden Parachute requires at least one hundred managed nodes and unlocks Phase 15.
8. Later upgrades increase pay, and the dashboard reports the aggregate workforce rather than zero individual agents.

## Ending

Buy Sell The Company, then Walk Away Forever when there are at least one hundred managed nodes, reputation is at least two hundred, debt is below ten, no unresolved incidents remain, and estimated income is greater than twice expenses. Settlement is current cash plus 120 seconds of estimated income.

The ending persists on reload and freezes gameplay. A confirmed new story resets it. Alternatively, Phase 15 offers prestige with permanent click power, starting tokens and the earned extra starting slot. Music preference survives prestige.

## Persistence and interaction

- Save format version 2 is a breaking change. There is no migration. Older or invalid saves are preserved until the player explicitly resets them. Storage errors have visible recovery controls.
- Offline earnings include recurring services and referral contracts at half efficiency, minus expenses, for up to eight hours. Losses are forgiven. Saved busy workers and aggregate nodes do not generate offline production. Offline awards are immediately saved.
- Story and settings dialogs pause foreground play. Background gaps follow the offline policy.
- Keyboard activation, stable focus during live updates, dialog focus management, zoom, reduced motion and small-screen scrolling are supported.
- Reset affects only this game's save. Page-exit autosave cannot recreate a deleted save.

## Completion and validation

The fifteen-phase arc must reach its persistent ending from a fresh state. Tests cover three deterministic journeys with no cheats or injected cash, sustained autopilot, fuel conservation, task visibility, managed-cluster purchases, one hundred or more nodes, retirement, storage failures, and lifecycle behavior. Browser tests cover actual purchase controls and desktop, portrait and landscape layouts.

Require 100% coverage of changed executable game lines relative to the documented release baseline. Run the relevant regression and browser checks, inspect screenshots, and complete three consecutive review iterations with no further fixes. See `onemoretask/README.md` for commands and release files.

Advanced inter-node routing topology, dynamic worker caps and custom CEO strategies remain outside this agreed release scope.
