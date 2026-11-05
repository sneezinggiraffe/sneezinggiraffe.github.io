const { harness } = require('./harness.cjs');

function earlyPacing(seed, delegateOnly = false) {
  const h = harness(undefined, { seed });
  const g = h.fresh();
  const milestones = [];
  let phase = 1;
  try {
    for (let step = 0; step < 18000; step++) {
      h.advance(100); h.dismiss();
      if (step % 5 === 0) {
        if (!g.uiRevealed.taskQueue || !delegateOnly || !h.api.assistantAvailable()) h.api.doWork();
        if (g.phase === 2 && g.aiWorkerTokenTank < 1) h.api.topUpAiWorker();
        for (const upgrade of h.api.UPGRADES.filter(item => item.oneTime && item.phase <= 2)) {
          h.api.purchaseUpgrade(upgrade.id);
          if (g.phase !== phase) break;
        }
      }
      h.api.tick();
      if (g.phase !== phase) {
        milestones.push({ phase: g.phase, seconds: step / 10, tasks: g.totalTasksDone, cash: Math.round(g.cash), earned: Math.round(g.totalCashEarned), clicks: g.totalClicks });
        phase = g.phase;
      }
      if (phase === 3) return milestones;
    }
    throw new Error('Basic AI was not reached within 30 minutes');
  } finally { h.close(); }
}

if (require.main === module) {
  for (const delegateOnly of [false, true]) for (const seed of [17, 42, 123]) console.log(JSON.stringify({ seed, delegateOnly, milestones: earlyPacing(seed, delegateOnly) }));
}
module.exports = { earlyPacing };
