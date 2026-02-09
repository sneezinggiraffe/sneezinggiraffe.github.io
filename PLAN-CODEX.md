# PLAN-CODEX
Date: 2026-02-09
Scope reviewed: `onemoretask/index.html`, `onemoretask/game.js`

## Integration Note
This version integrates actionable learnings from `PLAN-CLAUDE.md` into the original Codex plan.

## Current State Snapshot
- Systems depth is strong: tasks, AI assist, upgrades, agents, schedules, incidents, services, stress, debt, prestige.
- Early UX is overloaded: full top bar, tabs, multiple panels, upgrades, and several tasks appear too soon.
- Progression relies on upgrade-driven phase jumps more than authored narrative milestones.
- Expenses drain from second zero, before users understand earning cadence.

## Key Learnings Integrated From PLAN-CLAUDE
- Move from tab-first flow to a two-pane progressive layout.
- Add save versioning and migration strategy before introducing onboarding fields.
- Add anti-soft-lock economy behavior when cash hits zero.
- Replace instant 3-task spawn with milestone-driven backlog ramp.
- Disable early task expiry, then re-enable later with clear UX.
- Script first incident tutorial (after meaningful AI usage) before enabling random incident pressure.
- Tie click feedback to pointer coordinates, not random screen position.
- Fix or remove no-op upgrades (notably `premium_clients` with empty effect).

## SWOT

### Strengths
- Theme and mechanics already align with the premise: automation creates management burden.
- Data-driven constants make pacing rework feasible without architecture rewrite.
- Existing stress/incidents/debt loops are strong foundations for late-game pressure.
- Prestige and True Retire conditions provide a clear long-term arc.

### Weaknesses
- Early cognitive overload breaks onboarding.
- Opening flow does not match intended story curve (`Find Work` -> `Do Task` -> overload).
- Early expenses are too punitive.
- Incident system lacks first-time explanation.
- Some content is effectively placeholder (`premium_clients` no effect).
- Task expiry at 60s can punish learning players.
- No explicit save migration strategy for new onboarding state fields.

### Opportunities
- Create a strong authored funnel with task-count milestones.
- Deliver one-screen management feel with progressive right-pane reveal.
- Turn expense and incident introductions into memorable narrative beats.
- Improve tactile feedback and perceived fairness with better click and economy behavior.

### Threats
- Early churn from overwhelm and punitive drain.
- Soft-lock risk at cash zero without recovery path.
- Scope creep from touching state model, layout, pacing, and progression at once.
- Hidden mechanic reveals may confuse users unless unlock messaging is explicit.

## Remove / Change / Approve

### Remove (or defer from early game)
- Full tab-navigation visibility at start (`#nav`).
- Triple `spawnTask()` on game start.
- Immediate recurring expense pressure in opening minutes.
- Any upgrade with no gameplay effect unless implemented.

### Change
- Start flow to: premise -> `Find Work` -> single `Do Task` interaction.
- Backlog ramp to milestone pacing (not immediate timer pressure).
- Introduce expenses as a popup event around 30-50 completed tasks.
- Re-sequence upgrades so scrappy personal optimization appears before AI systems.
- Script first incident tutorial before random incidents.
- Progressively reveal resources and control surfaces as they become actionable.
- Replace random click-reward position with cursor-based placement.

### Approve
- Core click and completion loop.
- Agent/trait/specialty architecture.
- Incident concept (with better onboarding and pacing).
- Stress and tech debt pressure systems.
- Prestige and True Retire conditions.

## Incident Recommendation
- Keep incidents as a core mechanic.
- Reframe incidents as operational cost of delegation, not random punishment.
- Gate incidents until player has AI/delegation context and at least one mitigation action.
- Add first-incident explanation modal and keep an always-available plain-language description.

## Expense Recommendation
- Target opening pacing:
  - Tasks 0-29: no recurring expense or symbolic near-zero expense.
  - Tasks 30-50: expense reveal popup, then gentle drain.
  - Later: ramp by milestones and unlocks.
- Add recovery behavior to avoid dead states (for example: reduced burn at zero cash or guaranteed solvable work).

## Proposed Plan (No Code Yet)

1. State model and migration
- Add onboarding and reveal flags (`onboardingStage`, `uiRevealed`, `expensesRevealed`, `incidentsExplained`, `aiAssistCount`, etc.).
- Add save version field and migration path for existing saves.

2. Layout and onboarding restructure
- Replace tab-first UX with two-pane shell.
- Left pane: work stream always visible.
- Right pane: control modules reveal progressively.
- Mobile: stacked layout preserving work-first priority.

3. Milestone engine
- Add centralized milestone table keyed by `totalTasksDone` and key events.
- Fire unlock notifications, popups, and UI reveals from this table.

4. Early pacing and backlog
- Start with one action only.
- Ramp spawn interval and max queue by milestone bands.
- Keep early backlog as trickle, then escalate to overload.

5. Economy balancing
- Delay expense onset.
- Smooth early expense curve.
- Add anti-soft-lock safeguards.

6. Upgrade lane sequencing
- Stage 1: post-it notes / coffee / inbox zero / GTD style upgrades.
- Stage 2: AI discovery and stabilization.
- Stage 3: delegation and operational tooling.
- Resolve no-op upgrades by either implementing effects or removing them.

7. Incident onboarding
- Script first incident after meaningful AI usage (for example, after several AI assists).
- Enable RNG incidents only after tutorial completion.

8. UX polish and feedback
- Bind click rewards to click coordinates.
- Provide explicit "new system unlocked" messaging.
- Introduce late-game task expiry only when player is equipped to handle it.

9. Validation pass
- Playtest first 10 minutes for pacing and comprehension.
- Verify old saves migrate correctly.
- Verify no soft-lock at zero cash.

## Gameplay Progression List (Updated)

0. Cold open
- Premise text only.
- Button: `Find Work`.

1. First loop (tasks 0-5)
- Single `Do Task` action.
- Cash feedback only.

2. Trickle backlog (tasks 5-20)
- Queue appears gradually.
- Spawn begins slowly.

3. Overload and self-optimization (tasks 20-50)
- Backlog growth increases.
- Early manual productivity upgrades appear.
- Right pane begins to reveal.

4. Expenses arrive (tasks 30-50)
- Popup explains burn.
- Gentle drain starts.

5. AI introduction (tasks 70+)
- AI assist unlock.
- First-use explanation and risk framing.

6. Incident tutorial and delegation (tasks 100+)
- First scripted incident explains system.
- Agents and assignment tools unlock.

7. Management burden arc (mid to late game)
- Dashboard modules appear in pieces.
- Player shifts from doing tasks to managing systems.

8. Endgame
- Stabilize income, incidents, debt.
- Reach retire/prestige outcomes.

## Notes for Next Coding Pass
- Preserve existing systems where possible.
- Prioritize gating, sequencing, and balance over full mechanical rewrite.
- Implement incrementally by milestone band, then rebalance after each band.
