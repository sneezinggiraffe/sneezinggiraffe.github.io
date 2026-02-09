# PLAN-MERGED
Date: 2026-02-09
Scope: `onemoretask/index.html`, `onemoretask/game.js`
Inputs merged: `PLAN-CODEX.md`, `PLAN-CLAUDE.md`

## Objective
Deliver a clear narrative curve:
- Start tiny (`Find Work`, then `Do Task`)
- Let backlog pressure grow gradually
- Introduce optimization tactics
- Transition to AI and delegation
- End in management overload where the system itself becomes the work

## Shared Diagnosis
- Current build has strong systems depth but weak early onboarding.
- Too much UI and too many concepts appear too early.
- Expense pressure starts too soon.
- Incidents are mechanically present but not taught.
- Progression is phase/upgrade heavy, not milestone-story heavy.

## Consolidated SWOT

### Strengths
- Strong thematic fit with the premise.
- Mature core systems already implemented.
- Data-driven balancing model.
- Good long-tail motivation from prestige and True Retire conditions.

### Weaknesses
- Early cognitive overload and context-switching.
- Opening flow misaligned with intended story arc.
- Early economy feels punitive.
- Incidents lack onboarding clarity.
- At least one no-op upgrade (`premium_clients`).
- Task expiry is harsh for early learning.
- New onboarding work needs save migration support.

### Opportunities
- Milestone-driven progression can create strong authored pacing.
- Two-pane design can keep work visible while management grows.
- Expense and incident popups can become narrative beats.
- Better feedback and reveal messaging can raise perceived fairness.

### Threats
- Early churn from overwhelm.
- Cash-zero dead states if no recovery path.
- Rework scope spans state, UI, pacing, and balance.
- Hidden reveals can feel random without clear unlock messaging.

## Decision Matrix

### Remove (or defer)
- Full tab-nav exposure at start.
- Triple starting task spawn.
- Immediate recurring expenses.
- Upgrades with empty effects.

### Change
- Intro flow to `Find Work` then single-action `Do Task`.
- Spawn and backlog growth to milestone-based ramp.
- Expenses to delayed reveal with smoother early curve.
- Early upgrades to human optimization (post-it notes, coffee, inbox zero, GTD) before AI.
- Incidents to scripted first tutorial, then random generation.
- Resource and panel visibility to progressive disclosure.
- Click reward position to pointer-based placement.
- Early task expiry off; later on with explicit countdown UX.

### Keep
- Task completion loop and reward structure.
- Agent traits/specialty/reliability model.
- Stress, debt, incidents, schedules, services as late-game complexity.
- Prestige and True Retire goals.

## Recommended Target Layout

### Desktop
- Left pane: work stream, always visible.
- Right pane: control panel cards, progressively unlocked.
- Right pane grows over time; left pane compresses but remains primary interaction.

### Mobile
- Vertical stack with work stream first.
- Control cards collapse/expand to reduce clutter.

## Pacing Model (Milestone-Oriented)

### Stage 0 (task 0)
- Premise only
- Button: `Find Work`

### Stage 1 (tasks 0-2)
- Single `Do Task` button
- Cash-only feedback

### Stage 2 (tasks 3-9)
- Queue appears
- Slow auto-spawn begins (suggested ~12s)
- Max visible tasks low (suggested 3)

### Stage 3 (tasks 10-19)
- Backlog ramps (suggested ~8s)
- Reputation then stress reveal in sequence

### Stage 4 (tasks 20-34)
- Right pane appears
- First manual productivity upgrades
- Max visible tasks grows (suggested 5-6)

### Stage 5 (tasks 35-49)
- Expense story popup
- Gentle initial drain (suggested ~0.15/s)

### Stage 6 (tasks 50-79)
- Personal optimization upgrades expand
- Backlog pressure continues to rise
- Phase 1 drain can approach current baseline (~0.30/s)

### Stage 7 (tasks 80+)
- AI discovery and first-use teaching

### Stage 8 (tasks 120+)
- Scripted first incident tutorial after several AI assists
- Incident system explained and then randomized

### Stage 9 (tasks 180+ / phase 3-4)
- Delegation and agents
- Management burden becomes central

### Stage 10+ (mid and late game)
- Existing phase chain largely retained
- Modules reveal in place inside control panel
- Retire/prestige arc preserved

## Implementation Plan (Merged)

1. State and migration foundation
- Add onboarding flags, milestone tracking, tutorial flags, and save version.
- Implement migration that fast-forwards existing advanced saves.

2. Milestone engine
- Define milestone table and trigger dispatcher.
- Standardize unlock notification copy.

3. UI shell refactor
- Replace tab model with two-pane progressive layout.
- Keep one-screen management goal across desktop/mobile.

4. Early gameplay pacing
- Remove triple spawn start.
- Add staged spawn intervals and queue caps.
- Keep early loop low-friction and legible.

5. Economy and safety
- Gate expenses behind milestone reveal.
- Smooth early expense curve.
- Add anti-soft-lock behavior at zero cash.

6. Upgrade lane cleanup
- Insert early human optimization upgrades.
- Shift AI upgrades later.
- Implement or remove no-op upgrades.

7. Incident onboarding
- Script first incident after meaningful AI activity.
- Explain cause, effects, and resolution options.
- Enable random incidents only after tutorial.

8. UX polish
- Click reward anchored to click location.
- Late-enable expiry with visible countdown.
- Keep reveals explicit and understandable.

9. Verification
- Fresh save walkthrough by milestone bands.
- Existing save migration checks.
- Economy recovery checks at low-cash states.
- Mobile layout and progressive reveal checks.

## Verification Checklist
- New run starts with only premise and `Find Work`.
- `Do Task` is the only early action.
- Queue and management surface reveal progressively.
- Expense reveal occurs in target milestone band.
- First incident is tutorialized before RNG incidents.
- Old saves remain playable and sensibly mapped.
- No hard dead state when cash reaches zero.

## Final Guidance
- Use incremental delivery by milestone bands.
- Rebalance after each band before moving deeper.
- Keep existing deep systems; focus first on sequence, visibility, and pacing.
