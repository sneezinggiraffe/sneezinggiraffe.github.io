# One More Task - Design Spec (Current + Target)

Date: 2026-02-12
Scope: `onemoretask/index.html`, `onemoretask/game.js`

## Purpose
This document is the canonical game design reference. It captures:
1. The current implemented state.
2. The target narrative and systems arc.
3. Locked decisions for phase progression from Phase 4 onward.
4. Design constraints to preserve when implementing changes.

## Current State Snapshot (Implemented)

### High-level
1. Core systems are already deep and functional: tasks, AI assist, upgrades, agents, incidents, schedules, services, stress, debt, prestige.
2. Two-pane layout and progressive reveals are already in place.
3. Progression is still mostly upgrade phase-gated.

### Current-system clarifications from review
1. Daily Job scheduling has been removed in favor of per-agent auto-assign controls.
2. Compute slots have been removed from the active progression path.
3. DevOps now performs active incident-response progress on unresolved incidents.
4. Late-game progression has been condensed to a max phase of 11 with stronger phase identity.

### Current unlock chain (implemented in code)
1. `free_ai` (P1 -> P2)
2. `pro_model` (P2 -> P3)
3. `multi_bot` (P3 -> P4)
4. `tool_use` (P4 -> P5)
5. `manager_agent` (P5 -> P6)
6. `token_manager_unlock` (P6 -> P7)
7. `ops_flywheel` (P7 -> P8)
8. `acquire_micro_agency` (P8 -> P9)
9. `ceo_readiness` (P9 -> P10)
10. `retire_unlock` (P10 -> P11)

### Known progression mismatch
1. AI CEO currently focuses on assignment orchestration; richer two-step cluster control depth is still pending.

## Consolidated Valuable Guidance (Retained From Prior Plans)

### Keep as core principles
1. Theme: every layer of automation creates a new management burden.
2. Preserve the intimate burnout arc before corporate scale-up.
3. Progressive disclosure over front-loaded complexity.
4. Work stream should stay visible while management depth grows.

### Keep as system-level requirements
1. Milestone-driven onboarding and unlock communication.
2. Incident onboarding: first incident explained before full random pressure.
3. Anti-soft-lock economy behavior when cash is low.
4. Mobile and desktop both first-class.

### Release assumption (locked)
1. No migration plan is required for this redesign pass because there are no active users and browser caches/saves will be cleared before return.

### Keep as UX requirements
1. Two-pane shell, with control panel growing over time.
2. Clear "new system unlocked" feedback.
3. Task and management information should remain legible as density increases.
4. Click feedback should stay tied to user action location.

## Target Experience Statement
From Phase 4 onward, the player journey should be:
1. Delegate work.
2. Feel operational friction from scale.
3. Add management automation to stabilize.
4. Run a mostly self-managing operation with occasional intervention.
5. Enter growth marketing and referrals.
6. Re-organize into clusters for scalability.
7. Hand cluster operations to an AI CEO.
8. Sell and retire.

## Target Phase Architecture (Locked)

### Phase count
1. Target maximum phase is **11**.
2. Phase 11 is retirement and exit.

### Phase identity map
1. Phases 1-4: Keep current arc and pacing as baseline.
2. Phase 5: Short tooling upgrade sprint leading to Manager unlock.
3. Phase 6: Manager-led operations (auto-approval and assignment).
4. Phase 7: Token-stable autopilot and operations balance.
5. Phase 8: Growth marketing and referral income. Include a clusterization hint upgrade (for example, acquire a smaller company).
6. Phase 9: Clusterization and re-org for scalability.
7. Phase 10: AI CEO era (first manage existing clusters, then scale them).
8. Phase 11: Retire flow (sell all, walk away).

## Cluster Design (Locked)

### Cluster model
1. Clusterization begins at Phase 9.
2. Each cluster has a fixed maximum of **8 worker agents**.
3. Manager and token manager are separate control slots and do not consume worker slots.

### Cluster UX shape
1. A cluster card is the primary unit.
2. Top row: manager control block and token manager square (token manager appears once unlocked).
3. Second row: 8 small worker squares that fit in one row.
4. Phase 9+ view supports multiple cluster cards.
5. This shape should hint at future "many clusters" operation even before full large-scale automation.
6. When clusters are visible (Phase 9+), the cluster section **replaces** the agent section entirely:
- Manager Console and utility hire buttons appear at the top of the cluster section.
- Cluster cards with worker slots appear in the middle.
- A "Global Utility Roles" section at the bottom shows manager/token_mgr/devops agent cards with status and shutdown buttons.

## System Behavior by Late Arc

### Phase 5-7 (operations burden and stabilization)
1. Phase 5 is short and purposeful: two cheap tooling upgrades (web_browse, code_exec) are immediately available, then the player saves for the Manager Agent ($3,500, cost-gated only). Phase 5 should last ~50 tasks.
2. Hiring the Manager triggers a burst-assign of all idle workers, giving immediate visible impact.
3. Manager base assignment budget is 2/tick (3 with smart routing).
4. Manager automation in Phase 6 should reduce approval and assignment friction. Scheduling and smart_routing are cost-gated only (no reqTasks).
5. Token manager in Phase 7 should reduce token starvation and stabilize loops.
6. Operation should feel mostly self-running by late Phase 7, but not fully hands-off.
7. "Daily Job" schedules are removed in favor of per-agent automation controls:
- Each worker agent gets explicit automation state in UI.
- Manager automation supersedes per-agent manual toggling once unlocked.

### Phase 8 (growth)
1. Referral income starts here.
2. Growth upgrades should increase demand and passive growth flows.
3. Include one explicit upgrade that narratively foreshadows clusterization.

### Phase 9 (clusterization)
1. Move from one operational unit to multiple clusters.
2. Introduce cluster overhead and coordination burden.
3. Create pressure that makes AI CEO adoption feel necessary.
4. If a compute-like resource is retained, repurpose it only here as a clear cluster-era capacity concept (for example, "Ops Bandwidth"), not as hidden schedule gating.

### Phase 10 (AI CEO)
1. Stage 1: AI CEO takes over management of existing clusters.
2. Stage 2: AI CEO can scale clusters and grow network capacity.
3. Profit curve should rise faster than in Phase 9, but avoid immediate runaway.

### Phase 11 (retire)
1. Retirement is an explicit endpoint for this arc.
2. Player should be able to sell and walk away with thematic closure.

## Upgrade Pacing (Locked)

### reqTasks spacing principle
1. No gap > 40 tasks between a phase capstone and the next phase's first upgrade.
2. Within a phase, upgrades are spaced ~40-60 tasks apart.
3. Phase 5 upgrades (web_browse, code_exec) have no reqTasks -- they are cost-gated only.
4. Phase 6 scheduling and smart_routing have no reqTasks -- they are cost-gated only.

### Current reqTasks breakpoints (Phase 6+)
- Phase 6: neural_boost 580, token_manager_unlock 650
- Phase 7: 670, 720, 770, 830
- Phase 8: 860, 920, 980
- Phase 9: 1020, 1060, 1120, 1160, 1200, 1280
- Phase 10: 1320, 1400, 1440, 1520
- Phase 11: 1600

## Economy and Risk Design Constraints
1. Growth should be meaningful but not erase operational risk instantly.
2. Cluster overhead must be felt before AI CEO removes it.
3. Incidents should remain the "cost of delegation/automation" loop.
4. Stabilization tools should appear before severe late-game pressure systems.

## Role and Upgrade Intent Clarifications
1. `code_agents` must be repurposed to a clear, observable mechanic:
- It should not exist as a pure phase gate.
- It should directly unlock visible automation capability tied to cluster operation.
2. Incident response must have agent-based support:
- Repurpose `devops` as the incident responder role.
- DevOps should auto-handle warning incidents and reduce severity/time-cost of critical incidents.
- Player remains responsible for final escalation choices on high-severity incidents.

## In Scope / Out of Scope

### In scope
1. Re-sequencing phases and unlock chain from Phase 4 onward.
2. Cluster card UX and fixed 8-worker model.
3. AI CEO two-step behavior in Phase 10.
4. Retirement placement at Phase 11.

### Out of scope for first pass
1. Dynamic per-cluster worker caps.
2. Full inter-cluster routing simulation with advanced topology.
3. Deep autonomous strategy customization for AI CEO beyond manage-first then scale.
