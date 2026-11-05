const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

function hire(h, multitasking = false) {
  const g = h.fresh();
  g.uiRevealed.taskQueue = true; g.totalTasksDone = multitasking ? 35 : 7; g.cash = 1000;
  h.api.purchaseUpgrade('tools_of_trade'); h.api.purchaseUpgrade('hire_assistant');
  h.api.purchaseUpgrade('gas_station_coffee'); h.api.purchaseUpgrade('sticky_note_system');
  if (multitasking) { h.api.purchaseUpgrade('assistant_settling'); h.api.purchaseUpgrade('assistant_routine'); h.api.purchaseUpgrade('ai_hint'); h.api.purchaseUpgrade('multitasking'); }
  return g;
}
function tasks(h, count = 5) {
  return Array.from({ length: count }, () => {
    h.advance(1); const task = h.task(); task.workRequired = 8; task.pay = 10; return task;
  });
}

test('hiring enables automatic sequential work, with fees and no controls or clicks', () => {
  const h = harness();
  try {
    const g = hire(h); g.payMult = 1; const jobs = tasks(h); const cash = g.cash;
    h.api.tickAssistant(1); h.api.renderAll();
    assert.equal(g.totalClicks, 0);
    assert.deepEqual(Array.from(g.assistant.taskIds), [jobs[0].id]);
    assert.equal(jobs[0].workDone, 2); assert.equal(jobs[1].workDone, 0);
    assert.equal(h.api.getIncomeRate(), 8.5 / 4.4);
    assert.equal(h.window.document.querySelector('[data-assistant] button'), null);
    assert.equal(h.window.GAME.assignAssistantWork, undefined);
    assert.match(h.window.document.querySelector('[data-assistant]').textContent, /Working on/);
    assert.equal(h.window.document.querySelector('[data-assistant] [role="progressbar"]'), null);
    assert.equal(h.window.document.querySelector('.assistant-break-status'), null);
    h.api.tickAssistant(3);
    assert.equal(g.cash, cash + 8.5); assert.equal(g.assistant.tasksCompleted, 1);
    assert.equal(jobs[0].status, 'done'); assert.equal(jobs[1].status, 'available');
    h.api.tickAssistant(1); assert.equal(jobs[1].status, 'assistant');
    assert.equal(h.api.validSave(g), true);
  } finally { h.close(); }
});

test('five completions trigger each random break label, then work resumes automatically', () => {
  for (const [index, label] of ['Break time', 'Lunch', 'Dentist', 'Sleeping'].entries()) {
    const h = harness();
    try {
      const g = hire(h); const jobs = tasks(h, 6);
      h.window.Math.random = () => (index + 0.5) / 4;
      h.api.tickAssistant(20);
      assert.equal(g.assistant.tasksCompleted, 5); assert.equal(g.assistant.cycleCompleted, 0);
      assert.equal(g.assistant.breakRemaining, 2); assert.equal(g.assistant.breakLabel, label);
      assert.equal(jobs[5].status, 'available');
      assert.equal(h.api.getIncomeRate(), h.api.getTaskCashPayout(jobs[5], 'assistant', null) / 4.4);
      assert.equal(h.api.validSave(g), true); h.api.renderAll();
      assert.match(h.window.document.querySelector('[data-assistant]').textContent, new RegExp(label));
      h.api.tickAssistant(1); h.api.renderAll();
      assert.equal(h.window.document.querySelector('[data-assistant] [role="progressbar"]'), null);
      assert.equal(h.window.document.querySelector('[data-assistant] .task-bar'), null);
      assert.equal(h.window.document.querySelector('.assistant-break-status').textContent, label + ' - Back in 1s');
      assert.equal(h.window.document.querySelectorAll('[data-assistant] .text-sm').length, 1);
      assert.equal(h.window.document.querySelector('.assistant-break-status').classList.contains('text-sm'), true);
      assert.equal(h.window.document.querySelector('[data-assistant]').classList.contains('assistant-on-break'), true);
      h.api.tickAssistant(1.5);
      assert.equal(g.assistant.breakLabel, ''); assert.equal(jobs[5].workDone, 1);
      h.api.tickAssistant(3.5); h.api.renderAll();
      assert.equal(g.assistant.tasksCompleted, 6); assert.equal(g.assistant.cycleCompleted, 1);
      assert.match(h.window.document.querySelector('[data-assistant]').textContent, /Waiting for work/);
      assert.equal(h.window.document.querySelector('[data-assistant] [role="progressbar"]'), null);
      assert.equal(h.api.validSave(g), true);
    } finally { h.close(); }
  }
});

test('work, cycle counts and break timers survive reload; reserved work cannot expire', () => {
  const h = harness(); let restored;
  try {
    const g = hire(h); tasks(h, 6); h.api.tickAssistant(17);
    g.taskExpiryEnabled = true; h.advance(31000); h.api.pruneTasks(h.window.Date.now());
    assert.equal(g.tasks.length, 1); assert.equal(g.tasks[0].status, 'assistant');
    restored = harness(JSON.stringify(g));
    let loaded = restored.window.GAME.state;
    assert.equal(loaded.assistant.cycleCompleted, 4); assert.equal(loaded.tasks[0].workDone, 2);
    restored.api.tickAssistant(3.5); assert.equal(loaded.assistant.breakRemaining, 1.5);
    const saved = JSON.stringify(loaded); restored.close(); restored = harness(saved);
    loaded = restored.window.GAME.state;
    const job = restored.task(); job.workRequired = 8;
    restored.api.tickAssistant(2.5);
    assert.equal(job.workDone, 2); assert.equal(loaded.assistant.breakRemaining, 0);
    assert.equal(restored.api.validSave(loaded), true);
  } finally { if (restored) restored.close(); h.close(); }
});

test('speed upgrades shorten sequential work without changing manual or AI speed', () => {
  const h = harness();
  try {
    const g = hire(h); const jobs = tasks(h, 5);
    const power = g.clickPower; const ai = h.api.originalAiWorkRate();
    assert.equal(h.api.assistantTaskSeconds(), 4);
    for (const [id, seconds] of [['assistant_settling', 3.2], ['assistant_routine', 2.56]]) {
      h.prepareUpgrade(id); g.totalTasksDone = 50; g.cash = 1000;
      h.api.purchaseUpgrade(id); assert.ok(g.purchasedUpgrades.includes(id));
      assert.equal(h.api.assistantTaskSeconds(), seconds);
      h.api.tickAssistant(seconds);
    }
    assert.equal(g.assistant.tasksCompleted, 2); assert.equal(jobs[2].workDone, 0);
    assert.equal(g.clickPower, power); assert.equal(h.api.originalAiWorkRate(), ai);
    g.phase = 3; g.totalTasksDone = 425; g.cash = 2000;
    h.prepareUpgrade('faster_inference'); g.assistant.dismissed = false;
    h.api.purchaseUpgrade('faster_inference');
    assert.equal(h.api.assistantTaskSeconds(), 2.56);
  } finally { h.close(); }
});

test('manual work and AI share the queue without taking the assistant task; Pro preserves its progress', () => {
  const h = harness();
  try {
    const g = hire(h, true); const jobs = tasks(h, 5);
    h.api.tickAssistant(0.64); h.api.doWork();
    assert.equal(jobs[0].status, 'assistant'); assert.equal(jobs[1].status, 'active'); assert.equal(jobs[2].status, 'active');
    assert.equal(g.totalClicks, 1);
    g.phase = 2; g.aiFailMult = 0; h.api.topUpAiWorker(); h.api.tickAiWorker(0.1);
    assert.equal(jobs[3].status, 'ai');
    g.phase = 3; g.totalTasksDone = 650; g.cash = 20000;
    h.prepareUpgrade('second_ai'); g.assistant.dismissed = false;
    h.advance(60000); h.api.purchaseUpgrade('second_ai');
    assert.equal(g.assistant.dismissed, true); assert.equal(g.assistant.taskIds.length, 0);
    assert.equal(jobs[0].status, 'available'); assert.equal(jobs[0].workDone, 2);
    assert.equal(jobs[0].createdAt, h.window.Date.now());
    h.api.renderAll(); assert.equal(h.window.document.querySelector('[data-assistant]'), null);
    assert.equal(h.window.document.querySelector('#team-heading').textContent, 'Agents');
    h.api.tickAssistant(10); assert.equal(jobs[0].workDone, 2);
    assert.equal(h.api.validSave(g), true);
  } finally { h.close(); }
});

test('guards and save validation reject inconsistent assistant ownership and cycles', () => {
  const h = harness();
  try {
    h.api.doWork(); h.api.tickAssistant(1);
    h.fresh(); h.api.tickAssistant(1); h.api.dismissAssistant();
    const g = hire(h); h.api.tickAssistant(1); assert.equal(g.assistant.taskIds.length, 0);
    const jobs = tasks(h, 2);
    g.retired = true; h.api.tickAssistant(1); h.api.dismissAssistant(); h.api.doWork();
    g.retired = false; g.gameStarted = false; h.api.tickAssistant(1);
    assert.equal(jobs[0].workDone, 0);
    g.gameStarted = true; h.api.tickAssistant(1); h.api.dismissAssistant();
    const valid = JSON.stringify(g);
    for (const mutate of [
      s => { s.assistant.taskIds = 'bad'; }, s => { s.assistant.dismissed = 'bad'; },
      s => { s.assistant.taskIds = []; }, s => { s.assistant.taskIds[0] = 'missing'; },
      s => { s.assistant.dismissed = true; }, s => { s.purchasedUpgrades = []; },
      s => { s.assistant.taskIds.push(s.tasks[1].id); s.tasks[1].status = 'assistant'; },
      s => { s.tasks[0].status = 'available'; }, s => { s.tasks[1].status = 'assistant_queued'; },
      s => { s.assistant.cycleCompleted = 5; }, s => { s.assistant.cycleCompleted = 1.5; },
      s => { s.assistant.breakRemaining = 4; }, s => { s.assistant.breakRemaining = 1; s.assistant.breakLabel = 'Lunch'; },
      s => { s.assistant.breakLabel = 'Lunch'; },
      s => { s.assistant.taskIds = []; for (const task of s.tasks) task.status = 'active'; }
    ]) { const invalid = JSON.parse(valid); mutate(invalid); assert.equal(h.api.validSave(invalid), false); }
    h.api.tickAssistant(19);
    g.assistant.breakRemaining = 1; g.assistant.cycleCompleted = 0; g.assistant.breakLabel = 'Lunch';
    assert.equal(h.api.validSave(g), true);
    g.assistant.breakLabel = 'invalid'; assert.equal(h.api.validSave(g), false);
    g.assistant.breakLabel = 'Lunch'; g.assistant.cycleCompleted = 1; assert.equal(h.api.validSave(g), false);
    g.assistant.cycleCompleted = 0; g.purchasedUpgrades.push('second_ai'); h.api.dismissAssistant(); h.api.dismissAssistant();
    assert.equal(g.assistant.breakRemaining, 0); assert.equal(g.assistant.breakLabel, '');
    assert.equal(h.api.validSave(g), true);
  } finally { h.close(); }
});

test('hiring supplies a useful queue of individual tasks without changing later AI arrival rates', () => {
  const h = harness();
  try {
    const g = h.fresh(); g.totalTasksDone = 7; g.uiRevealed.taskQueue = true; g.cash = 1000;
    const interval = h.api.getSpawnInterval(); assert.equal(h.api.getMaxTasks(), 3);
    h.api.purchaseUpgrade('tools_of_trade'); h.api.purchaseUpgrade('hire_assistant');
    assert.equal(h.api.getSpawnInterval(), interval / 3); assert.equal(h.api.getMaxTasks(), 8);
    for (let index = 0; index < 12; index++) h.api.spawnTask();
    assert.equal(g.tasks.length, 8); assert.ok(g.tasks.every(task => task.batchSize === 1));
    g.totalTasksDone = 100; assert.equal(h.api.getMaxTasks(), 12);
    g.phase = 2; const aiInterval = h.api.getSpawnInterval();
    g.purchasedUpgrades = []; assert.equal(h.api.getSpawnInterval(), aiInterval);
  } finally { h.close(); }
});

test('one Multitasking click starts two unassigned jobs and counts completed manual work across reloads', () => {
  const h = harness(); let restored;
  try {
    const g = hire(h, true); const jobs = tasks(h, 7);
    h.api.tickAssistant(0.64);
    const clicks = g.totalClicks;
    h.window.GAME.doWork();
    assert.equal(g.totalClicks, clicks + 1);
    assert.deepEqual(Array.from(g.tasks.filter(task => task.status === 'active'), task => task.id), jobs.slice(1, 3).map(task => task.id));
    h.window.GAME.doWork(); assert.equal(g.totalClicks, clicks + 1);
    assert.equal(jobs[3].status, 'available'); assert.equal(jobs[0].status, 'assistant');
    assert.equal(g.manualTasksCompleted, 0);
    h.api.tickManualWork(2);
    assert.equal(g.manualTasksCompleted, 2);
    h.api.completeTask(jobs[1], 'manual'); assert.equal(g.manualTasksCompleted, 2);
    h.api.tickAssistant(2); assert.equal(g.manualTasksCompleted, 2);
    h.api.renderAll(); assert.equal(h.window.document.querySelector('#you-delivered').textContent, '2 tasks delivered');
    restored = harness(JSON.stringify(g));
    assert.equal(restored.window.GAME.state.manualTasksCompleted, 2);
    assert.equal(restored.window.document.querySelector('#you-delivered').textContent, '2 tasks delivered');
    const loaded = restored.window.GAME.state;
    loaded.tasks = loaded.tasks.filter(task => task.status !== 'available');
    const last = restored.task();
    restored.window.GAME.doWork(); assert.equal(last.status, 'active');
    restored.api.tickManualWork(100); assert.equal(loaded.manualTasksCompleted, 3);
  } finally { if (restored) restored.close(); h.close(); }
});

test('You shows the same delivery-count format as the assistant, including a singular completion', () => {
  const h = harness();
  try {
    const g = hire(h); tasks(h, 1); h.api.doWork(); h.api.tickManualWork(10); h.api.renderAll();
    assert.equal(h.window.document.querySelector('#you-delivered').textContent, '1 task delivered');
    const assistant = h.window.document.querySelector('[data-assistant]');
    assert.equal(assistant.querySelector('small').textContent, '0 tasks delivered · 15% task fee');
    assert.equal(assistant.querySelector('button'), null);
    assert.equal(g.manualTasksCompleted, 1); assert.equal(h.api.validSave(g), true);
  } finally { h.close(); }
});

test('Marketing Campaign arrives at 200 tasks for $400 and increases demand before the Basic handover', () => {
  const h = harness();
  try {
    const g = h.fresh(2); h.prepareUpgrade('marketing_campaign');
    const upgrade = h.api.UPGRADES.find(item => item.id === 'marketing_campaign');
    g.totalTasksDone = 199; g.cash = 400; assert.equal(h.api.upgradeVisible(upgrade), false);
    g.totalTasksDone = 200; assert.equal(h.api.upgradeVisible(upgrade), true);
    g.cash = 399; h.api.purchaseUpgrade('marketing_campaign'); assert.equal(g.purchasedUpgrades.includes('marketing_campaign'), false);
    g.cash = 400; const delay = h.api.getSpawnInterval(); h.api.purchaseUpgrade('marketing_campaign');
    assert.equal(g.cash, 0); assert.equal(g.taskSpawnMult, 1.75);
    assert.equal(h.api.getSpawnInterval(), delay / 1.75);
    assert.equal(g.phase, 2); assert.equal(g.payMult, 1.6);
  } finally { h.close(); }
});

test('human icons and all AI top-ups share the primary action style without dismissal controls', () => {
  const h = harness();
  try {
    const g = hire(h);
    for (const phase of [2, 3, 5, 7]) {
      g.phase = phase;
      h.api.renderAll();
      for (const selector of ['#you-card', '[data-assistant]']) {
        assert.ok(h.window.document.querySelector(selector + ' > .agent-icon').textContent);
        assert.equal(h.window.document.querySelector(selector + ' > .agent-icon').getAttribute('aria-hidden'), 'true');
      }
      const worker = h.worker('researcher');
      const manager = h.worker('manager');
      for (const html of [h.api.renderAiWorkerCard(), h.api.renderAgentCard(worker), h.api.renderAgentCard(manager)]) {
        assert.match(html, /btn btn-primary btn-sm/);
        assert.doesNotMatch(html, /btn-purple/);
      }
      assert.doesNotMatch(h.window.document.querySelector('[data-assistant]').textContent, /Dismiss/);
      g.agents = [];
    }
  } finally { h.close(); }
});

test('Billboard costs exactly $2,000 and the Pro subscription restores its original title', () => {
  const h = harness();
  try {
    const g = h.fresh(3); h.prepareUpgrade('billboard_campaign'); g.totalTasksDone = 500;
    g.cash = 1999; h.api.purchaseUpgrade('billboard_campaign');
    assert.equal(g.purchasedUpgrades.includes('billboard_campaign'), false);
    g.cash = 2000; const pay = g.payMult; h.api.purchaseUpgrade('billboard_campaign');
    assert.equal(g.cash, 0); assert.equal(g.payMult, pay * 2);
    const pro = h.api.UPGRADES.find(upgrade => upgrade.id === 'second_ai');
    assert.equal(pro.name, 'Second AI Subscription');
    assert.equal(pro.desc, 'Replace your assistant with AI 2000 Pro');
  } finally { h.close(); }
});

test('opening, manual work and AI assist never create floating click rewards', () => {
  const h = harness();
  try {
    const g = h.fresh();
    const event = { clientX: 100, clientY: 100 };
    h.api.doWork(event);
    assert.equal(h.window.document.querySelector('.click-reward'), null);
    h.api.tickManualWork(10);
    g.uiRevealed.taskQueue = true;
    const task = h.task(); task.workRequired = 100;
    h.api.clickTask(task.id, event);
    assert.equal(h.window.document.querySelector('.click-reward'), null);
    g.phase = 2;
    h.api.aiAssistTask(task.id, event);
    assert.equal(h.window.document.querySelector('.click-reward'), null);
  } finally { h.close(); }
});

test('assistant pricing and concise copy are reflected in the cards', () => {
  const h = harness();
  try {
    const g = h.fresh(); g.totalTasksDone = 7; g.uiRevealed.taskQueue = true;
    h.api.purchaseUpgrade('tools_of_trade');
    g.cash = 29; h.api.purchaseUpgrade('hire_assistant');
    assert.equal(h.api.assistantAvailable(), false);
    g.cash = 30; h.api.purchaseUpgrade('hire_assistant');
    assert.equal(g.cash, 0); assert.equal(h.api.assistantAvailable(), true);
    const upgrade = id => h.api.UPGRADES.find(item => item.id === id);
    assert.equal(upgrade('hire_assistant').desc, 'Delegate easier tasks');
    assert.equal(upgrade('multitasking').desc, 'Do one task with each hand');
    tasks(h); h.api.tickAssistant(0.1); h.api.renderAll();
    const assistant = h.window.document.querySelector('[data-assistant]');
    assert.match(assistant.textContent, /Working on/);
    assert.doesNotMatch(assistant.textContent, /queued/);
    g.phase = 2; h.api.renderAll();
    const ai = h.window.document.querySelector('[data-agent-slot="0"]');
    assert.match(ai.textContent, /Add tokens/);
    assert.doesNotMatch(ai.textContent, /Automatically takes the next task|Top-up tokens/);
  } finally { h.close(); }
});

test('Pro starts Phase 4 without changing workload, tanks or starter tokens; the licence starts Phase 5', () => {
  const h = harness();
  try {
    h.window.chPh4();
    const g = h.window.GAME.state;
    assert.equal(g.phase, 3);
    const transitions = h.api.UPGRADES.filter(upgrade => upgrade.unlockPhase);
    assert.deepEqual(Array.from(transitions, upgrade => upgrade.unlockPhase), Array.from({ length: 15 }, (_, index) => index + 2));
    assert.equal(h.window.chPh3_1, undefined);
    assert.equal(h.window.chStart8, undefined);
    assert.equal(typeof h.window.chStart9, 'function');
    g.cash = 18000;
    const tokens = g.tokens;
    const capacity = h.api.workerTokenCapacity();
    const rate = h.api.workerTokenRate();
    const interval = h.api.getSpawnInterval();
    h.api.purchaseUpgrade('second_ai');
    assert.equal(g.phase, 4); assert.equal(g.tokens, tokens);
    assert.equal(h.api.workloadTier(4), h.api.workloadTier(3));
    assert.equal(h.api.workerTokenCapacity(), capacity);
    assert.equal(h.api.workerTokenRate(), rate);
    assert.equal(h.api.workerTokenCapacity(g.agents[0]), 100);
    assert.equal(h.api.getSpawnInterval(), interval);
    assert.equal(h.api.validSave(g), true);
    const restored = harness(JSON.stringify(g));
    try {
      assert.equal(restored.window.GAME.state.phase, 4);
      assert.equal(restored.window.GAME.state.agents[0].name, 'AI 2000 Pro');
    } finally { restored.close(); }
    h.window.chPh5();
    const licensed = h.window.GAME.state;
    assert.equal(licensed.phase, 4);
    licensed.cash = 25000; licensed.totalTasksDone = 1000;
    h.api.purchaseUpgrade('multi_bot');
    assert.equal(licensed.phase, 5);
    assert.equal(h.api.workerTokenCapacity(licensed.agents.find(agent => agent.name === 'AI 2000 Pro')), 200);
    assert.equal(h.api.validSave(licensed), true);
  } finally { h.close(); }
});

test('assistant timing is independent of tick size and preserves partially completed work', () => {
  const fast = harness(); const small = harness();
  try {
    const a = hire(fast); const b = hire(small);
    tasks(fast, 20); tasks(small, 20);
    a.tasks[0].workDone = 4; b.tasks[0].workDone = 4;
    fast.api.tickAssistant(62);
    for (let tick = 0; tick < 620; tick++) small.api.tickAssistant(0.1);
    assert.equal(a.assistant.tasksCompleted, 15);
    assert.equal(b.assistant.tasksCompleted, a.assistant.tasksCompleted);
    assert.equal(a.assistant.breakRemaining, 2);
    assert.ok(Math.abs(b.assistant.breakRemaining - a.assistant.breakRemaining) < 1e-8);
    assert.equal(b.cash, a.cash);
    assert.equal(fast.api.validSave(a), true); assert.equal(small.api.validSave(b), true);
  } finally { fast.close(); small.close(); }
});

test('speed upgrades are affordable early purchases and both gate the next upgrade group', () => {
  const h = harness();
  try {
    const g = hire(h);
    for (const [id, threshold, cost, seconds] of [['assistant_settling', 8, 10, 3.2], ['assistant_routine', 12, 15, 2.56]]) {
      const upgrade = h.api.UPGRADES.find(item => item.id === id);
      g.totalTasksDone = threshold - 1;
      assert.equal(h.api.upgradeVisible(upgrade), false);
      g.totalTasksDone = threshold; g.cash = cost - 1;
      assert.equal(h.api.upgradeVisible(upgrade), true);
      h.api.purchaseUpgrade(id); assert.equal(g.purchasedUpgrades.includes(id), false);
      g.cash = cost; h.api.purchaseUpgrade(id);
      assert.equal(g.cash, 0); assert.equal(h.api.assistantTaskSeconds(), seconds);
      assert.match(upgrade.desc, /25% faster/);
      assert.doesNotMatch(upgrade.desc, /seconds|\d+s\b/);
    }
    g.totalTasksDone = 35;
    const hint = h.api.UPGRADES.find(item => item.id === 'ai_hint');
    assert.equal(h.api.upgradeVisible(hint), true);
    for (const id of ['assistant_settling', 'assistant_routine']) {
      g.purchasedUpgrades = g.purchasedUpgrades.filter(item => item !== id);
      assert.equal(h.api.upgradeVisible(hint), false);
      g.purchasedUpgrades.push(id);
    }
  } finally { h.close(); }
});

test('income estimates include breaks and completions without inventing income when the queue is empty', () => {
  const h = harness();
  try {
    const g = hire(h, true); g.payMult = 1;
    assert.equal(h.api.getIncomeRate(), 0);
    tasks(h, 6);
    h.api.tickAssistant(2.56);
    assert.equal(g.assistant.taskIds.length, 0);
    assert.equal(h.api.getIncomeRate(), 8.5 / 2.96);
    h.api.tickAssistant(10.24);
    assert.equal(g.assistant.breakRemaining, 2);
    assert.equal(h.api.getIncomeRate(), 8.5 / 2.96);
    h.api.tickAssistant(4.56);
    assert.equal(g.assistant.tasksCompleted, 6);
    assert.equal(h.api.getIncomeRate(), 0);
  } finally { h.close(); }
});
