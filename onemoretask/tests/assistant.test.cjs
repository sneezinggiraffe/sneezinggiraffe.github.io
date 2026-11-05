const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

function hire(h, multitasking = false) {
  const g = h.fresh();
  g.uiRevealed.taskQueue = true; g.totalTasksDone = multitasking ? 35 : 7; g.cash = 1000;
  h.api.purchaseUpgrade('tools_of_trade'); h.api.purchaseUpgrade('hire_assistant');
  if (multitasking) { h.api.purchaseUpgrade('ai_hint'); h.api.purchaseUpgrade('multitasking'); }
  return g;
}
function tasks(h, count = 4) {
  return Array.from({ length: count }, () => {
    h.advance(1); const task = h.task(); task.workRequired = 8; task.pay = 10; return task;
  });
}

test('one assignment reserves three individual tasks, pays each completion and then waits', () => {
  const h = harness(); let restored;
  try {
    const g = hire(h); const jobs = tasks(h); const cash = g.cash;
    h.api.renderAll(); assert.equal(h.window.document.querySelector('#task-list button'), null);
    assert.equal(h.window.document.querySelector('#team-heading').textContent, 'Team');
    h.window.GAME.assignAssistantWork(); h.api.assignAssistantWork();
    assert.equal(g.totalClicks, 1); assert.equal(g.tasks.length, 4);
    assert.deepEqual(Array.from(g.assistant.taskIds), jobs.slice(0, 3).map(job => job.id));
    h.api.renderAll();
    assert.deepEqual(Array.from(h.window.document.querySelectorAll('.task-assignee'), el => el.textContent), ['Assistant', 'Assistant · queued', 'Assistant · queued', 'Unassigned']);
    assert.equal(h.api.getIncomeRate(), 8.5 * 4 / 8);
    h.api.tickAssistant(1); assert.equal(jobs[0].workDone, 4); assert.equal(jobs[1].workDone, 0);
    assert.equal(g.cash, cash); assert.equal(h.api.validSave(g), true);
    g.taskExpiryEnabled = true; h.advance(31000); h.api.pruneTasks(h.window.Date.now());
    assert.equal(g.tasks.length, 3);
    restored = harness(JSON.stringify(g)); const loaded = restored.window.GAME.state;
    restored.api.tickAssistant(1);
    assert.equal(loaded.totalTasksDone, 8); assert.equal(loaded.cash, cash + 8.5);
    assert.equal(loaded.tasks[1].status, 'assistant');
    restored.api.tickAssistant(2); restored.api.tickAssistant(2);
    assert.equal(loaded.totalTasksDone, 10); assert.equal(loaded.cash, cash + 25.5);
    assert.equal(loaded.assistant.tasksCompleted, 3); assert.equal(loaded.assistant.taskIds.length, 0);
    restored.api.pruneTasks(restored.window.Date.now());
    const unassigned = restored.task(); restored.api.tickAssistant(100);
    assert.equal(unassigned.status, 'available');
    restored.api.renderAll();
    assert.match(restored.window.document.querySelector('[data-assistant]').textContent, /Waiting for work/);
    assert.equal(restored.api.validSave(loaded), true);
  } finally { if (restored) restored.close(); h.close(); }
});

test('manual work has one slot; Multitasking opens two slots for each person without increasing per-task speed', () => {
  const h = harness();
  try {
    const g = hire(h); const jobs = tasks(h, 7);
    h.api.assignAssistantWork(); h.window.GAME.doWork(); h.window.GAME.doWork();
    assert.equal(jobs[3].status, 'active'); assert.equal(jobs[4].status, 'available');
    assert.equal(g.totalClicks, 2); h.api.renderAll();
    assert.equal(h.window.document.querySelector('#btn-do-task').disabled, true);
    assert.equal(h.window.document.querySelector('#you-status').textContent, 'Working on 1 task');
    g.totalTasksDone = 35; h.api.purchaseUpgrade('ai_hint'); h.api.purchaseUpgrade('multitasking');
    assert.equal(jobs[1].status, 'assistant'); assert.equal(jobs[2].status, 'assistant_queued');
    h.api.renderAll(); assert.equal(h.window.document.querySelector('#btn-do-task').disabled, false);
    h.window.GAME.doWork(); h.window.GAME.doWork();
    assert.equal(jobs[4].status, 'active'); assert.equal(jobs[5].status, 'available');
    h.api.renderAll(); assert.equal(h.window.document.querySelector('#you-status').textContent, 'Working on 2 tasks');
    h.api.tickAssistant(1); h.api.tickManualWork(0.6);
    assert.equal(jobs[0].workDone, 4); assert.equal(jobs[1].workDone, 4);
    assert.equal(jobs[2].workDone, 0); assert.equal(jobs[3].workDone, 4); assert.equal(jobs[4].workDone, 4);
    h.api.tickAssistant(1); assert.equal(jobs[2].status, 'assistant');
    assert.equal(g.assistant.tasksCompleted, 2);
    h.api.tickManualWork(1); h.api.renderAll(); assert.equal(h.window.document.querySelector('#btn-do-task').disabled, false);
    assert.equal(h.api.validSave(g), true);
  } finally { h.close(); }
});

test('AI and assistant work together; Pro replaces the assistant and preserves unfinished tasks', () => {
  const h = harness();
  try {
    const g = hire(h, true); const jobs = tasks(h, 5);
    for (const job of jobs) job.workRequired = 100;
    h.api.assignAssistantWork();
    g.phase = 2; g.aiFailMult = 0; g.incidentsExplained = true;
    h.api.topUpAiWorker(); h.api.tickAssistant(1); h.api.tickAiWorker(1);
    assert.ok(jobs[3].workDone > jobs[0].workDone * 4);
    h.api.renderAll();
    assert.deepEqual(Array.from(h.window.document.querySelectorAll('#section-agents .name'), el => el.textContent.trim()), ['You', 'Assistant Part-time', 'AI 2000 Free']);
    assert.equal(h.window.document.querySelector('#team-heading').textContent, 'Team');
    const reserved = [...g.assistant.taskIds];
    g.phase = 3; g.totalTasksDone = 650; g.cash = 20000;
    h.prepareUpgrade('second_ai'); g.assistant.dismissed = false;
    h.advance(60000); h.api.purchaseUpgrade('second_ai');
    assert.equal(g.assistant.dismissed, true); assert.equal(g.assistant.taskIds.length, 0);
    for (const id of reserved) {
      const task = g.tasks.find(item => item.id === id);
      assert.equal(task.status, 'available'); assert.equal(task.createdAt, h.window.Date.now());
    }
    assert.equal(jobs[0].workDone, 4); assert.equal(jobs[1].workDone, 4);
    assert.equal(g.agents.at(-1).name, 'AI 2000 Pro');
    h.api.renderAll(); assert.equal(h.window.document.querySelector('[data-assistant]'), null);
    assert.equal(h.window.document.querySelector('#team-heading').textContent, 'Agents');
    assert.equal(h.window.document.querySelector('#you-card').hidden, false);
    const cash = g.cash; h.api.purchaseUpgrade('second_ai'); assert.equal(g.cash, cash);
    h.api.assignAssistantWork(); assert.equal(g.assistant.taskIds.length, 0);
    assert.equal(h.api.validSave(g), true);
  } finally { h.close(); }
});

test('Faster Inference improves AI speed without changing manual or assistant speed', () => {
  const h = harness();
  try {
    const g = hire(h); g.phase = 3; g.totalTasksDone = 425; g.cash = 2000;
    h.prepareUpgrade('faster_inference'); g.assistant.dismissed = false;
    const jobs = tasks(h, 5); for (const task of jobs) task.workRequired = 100;
    h.api.assignAssistantWork(); h.api.doWork();
    const aiSpeed = h.api.originalAiWorkRate(); const manualPower = g.clickPower;
    h.api.purchaseUpgrade('faster_inference');
    assert.equal(h.api.originalAiWorkRate(), aiSpeed * 2); assert.equal(g.clickPower, manualPower);
    h.api.tickAssistant(1); h.api.tickManualWork(0.6);
    assert.equal(jobs[0].workDone, 4); assert.equal(jobs[3].workDone, 4);
    assert.equal(h.api.UPGRADES.some(upgrade => ['step_back', 'hire_second_assistant', 'batch_processing'].includes(upgrade.id)), false);
  } finally { h.close(); }
});

test('assignment guards and invalid reservations protect ownership; dismissal releases the entire set', () => {
  const h = harness();
  try {
    let g = h.window.GAME.state; h.api.doWork(); assert.equal(g.tasks.length, 0);
    g = h.fresh(); h.api.assignAssistantWork(); h.api.dismissAssistant();
    g = hire(h); h.api.assignAssistantWork(); assert.equal(g.assistant.taskIds.length, 0);
    tasks(h); g.retired = true; h.api.assignAssistantWork(); h.api.dismissAssistant(); h.api.doWork();
    g.retired = false; g.gameStarted = false; h.api.assignAssistantWork();
    g.gameStarted = true; h.api.assignAssistantWork(); h.api.dismissAssistant();
    assert.equal(g.assistant.dismissed, false);
    const valid = JSON.stringify(g);
    for (const mutate of [
      s => { s.assistant.taskIds = 'bad'; }, s => { s.assistant.dismissed = 'bad'; },
      s => { s.assistant.taskIds = []; }, s => { s.assistant.taskIds[0] = 'missing'; },
      s => { s.assistant.dismissed = true; }, s => { s.purchasedUpgrades = []; },
      s => { s.assistant.taskIds[1] = s.assistant.taskIds[0]; },
      s => { s.assistant.taskIds.push(s.tasks[3].id); s.tasks[3].status = 'assistant_queued'; },
      s => { s.tasks[1].status = 'assistant'; }, s => { s.tasks[0].status = 'assistant_queued'; },
      s => { s.tasks[3].status = 'assistant'; },
      s => { s.assistant.taskIds = []; for (const task of s.tasks) task.status = 'active'; }
    ]) { const invalid = JSON.parse(valid); mutate(invalid); assert.equal(h.api.validSave(invalid), false); }
    g.phase = 2; h.api.dismissAssistant(); h.api.dismissAssistant();
    assert.equal(g.assistant.dismissed, true); assert.equal(g.assistant.taskIds.length, 0);
    assert.ok(g.tasks.every(task => task.status === 'available'));
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
    h.api.assignAssistantWork();
    const clicks = g.totalClicks;
    h.window.GAME.doWork();
    assert.equal(g.totalClicks, clicks + 1);
    assert.deepEqual(Array.from(g.tasks.filter(task => task.status === 'active'), task => task.id), jobs.slice(3, 5).map(task => task.id));
    h.window.GAME.doWork(); assert.equal(g.totalClicks, clicks + 1);
    assert.equal(jobs[5].status, 'available'); assert.equal(jobs[0].status, 'assistant');
    assert.equal(g.manualTasksCompleted, 0);
    h.api.tickManualWork(2);
    assert.equal(g.manualTasksCompleted, 2);
    h.api.completeTask(jobs[3], 'manual'); assert.equal(g.manualTasksCompleted, 2);
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
    assert.equal(assistant.querySelector('small').textContent, '0 tasks delivered');
    assert.equal(assistant.querySelector('button').className, h.window.document.querySelector('#btn-do-task').className);
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
