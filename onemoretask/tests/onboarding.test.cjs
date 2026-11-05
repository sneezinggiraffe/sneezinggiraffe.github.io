const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

test('five central gigs precede the lone inbox task, which starts normal work and arrivals when clicked', () => {
  const h = harness();
  let restored;
  try {
    const g = h.window.GAME.state;
    assert.equal(g.gameStarted, false);
    assert.equal(h.window.document.querySelector('#intro-overlay').classList.contains('hidden'), false);
    h.window.document.querySelector('#btn-do-task').click();
    assert.equal(g.tasks.length, 0);
    h.window.document.querySelector('#btn-start-game').click();
    g.retired = true;
    h.window.document.querySelector('#btn-do-task').click();
    assert.equal(g.tasks.length, 0);
    g.retired = false;
    for (let index = 0; index < 5; index++) {
      assert.equal(g.uiRevealed.taskQueue, false);
      h.api.renderAll();
      assert.equal(h.window.document.querySelector('#early-task-section').style.display, '');
      assert.equal(h.window.document.querySelector('#btn-do-task').textContent, 'Do Task');
      h.window.document.querySelector('#btn-do-task').click();
      h.api.doEarlyTask();
      h.api.tickManualWork(0.1);
      h.api.renderAll();
      assert.equal(h.window.document.querySelector('#btn-do-task').textContent, 'Working...');
      assert.notEqual(h.window.document.querySelector('#early-task-bar').style.width, '0%');
      h.api.tickManualWork(10);
      h.api.pruneTasks(h.window.Date.now());
    }
    assert.equal(h.window.document.querySelector('#early-task-section').style.display, 'none');
    h.api.doEarlyTask();
    h.api.renderAll();
    assert.equal(g.totalTasksDone, 5);
    assert.equal(g.uiRevealed.taskQueue, true);
    assert.equal(h.window.document.querySelector('#early-task-section').style.display, 'none');
    assert.equal(h.window.document.querySelectorAll('#task-list .task-card').length, 1);
    const inbox = g.tasks[0];
    assert.equal(inbox.id, 'setup_inbox');
    assert.equal(inbox.name, 'Set Up Your Inbox');
    assert.equal(inbox.status, 'available');
    assert.equal(inbox.pay, 0);
    assert.match(h.window.document.querySelector('#task-list').textContent, /Pay: \$0/);
    assert.equal(h.api.queue().length, 0);
    assert.equal(h.api.getSpawnInterval(), Infinity);
    h.advance(60000);
    h.api.tickTaskSpawn();
    assert.equal(g.tasks.length, 1);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.equal(restored.api.getSpawnInterval(), Infinity);
    assert.equal(restored.window.GAME.state.tasks.length, 1);
    restored.close();
    restored = undefined;

    const cash = g.cash;
    h.window.GAME.clickTask(inbox.id);
    h.api.renderAll();
    assert.equal(inbox.status, 'active');
    assert.equal(inbox.workDone, 0);
    assert.equal(g.tasks.length, 3);
    assert.equal(g.cash, cash);
    assert.equal(g.totalTasksDone, 5);
    assert.ok(Number.isFinite(h.api.getSpawnInterval()));
    assert.equal(h.window.document.querySelectorAll('#task-list .task-card').length, 3);
    assert.equal(h.window.document.querySelector('#task-list button').textContent, 'Working...');
    h.api.tickManualWork(0.5);
    assert.ok(inbox.workDone > 0 && inbox.workDone < inbox.workRequired);
    assert.equal(g.totalTasksDone, 5);
    h.window.GAME.clickTask(inbox.id);
    assert.equal(g.tasks.length, 3);
    assert.equal(g.totalClicks, 6);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    const loaded = restored.window.GAME.state;
    assert.equal(loaded.tasks[0].workDone, inbox.workDone);
    assert.ok(Number.isFinite(restored.api.getSpawnInterval()));
    restored.api.tickManualWork(2);
    assert.equal(loaded.tasks[0].status, 'done');
    assert.equal(loaded.cash, cash);
    assert.equal(loaded.totalTasksDone, 6);
    restored.api.pruneTasks(restored.window.Date.now());
    restored.advance(g.lastTaskSpawn - restored.window.Date.now() + 2000);
    restored.api.tickTaskSpawn();
    assert.equal(loaded.tasks.length, 3);
    assert.equal(restored.api.validSave(loaded), true);
  } finally {
    if (restored) restored.close();
    h.close();
  }
});

test('Tools of the Trade appears alone and dismissing it reveals the paid upgrades without a gameplay bonus', () => {
  const h = harness();
  let restored;
  try {
    const g = h.fresh();
    g.totalTasksDone = 6;
    const intro = h.api.UPGRADES.find(upgrade => upgrade.id === 'tools_of_trade');
    assert.equal(h.api.upgradeVisible(intro), false);
    g.totalTasksDone = 7;
    h.api.checkMilestones();
    h.api.renderAll();
    assert.equal(h.api.queue().length, 0);
    assert.equal(g.uiRevealed.upgrades, true);
    assert.equal(g.uiRevealed.log, true);
    assert.equal(g.taskExpiryEnabled, true);
    assert.deepEqual(Array.from(h.api.UPGRADES.filter(h.api.upgradeVisible), upgrade => upgrade.id), ['tools_of_trade']);
    assert.equal(h.window.document.querySelectorAll('#upgrade-list .upgrade-card').length, 1);
    const first = h.window.document.querySelector('#upgrade-list .upgrade-card');
    assert.match(first.textContent, /Tools of the Trade/);
    assert.equal(first.querySelector('button').textContent, 'Free');
    assert.equal(first.querySelector('button').disabled, false);
    g.cash = 1000;
    h.api.purchaseUpgrade('post_it_notes');
    assert.equal(g.cash, 1000);
    assert.equal(g.purchasedUpgrades.length, 0);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.deepEqual(Array.from(restored.api.UPGRADES.filter(restored.api.upgradeVisible), upgrade => upgrade.id), ['tools_of_trade']);
    restored.close();
    restored = undefined;
    const before = JSON.parse(JSON.stringify(g));
    h.window.GAME.buy('tools_of_trade');
    h.api.renderAll();
    assert.equal(h.api.upgradeVisible(intro), false);
    assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent, /Tools of the Trade/);
    assert.equal(h.api.queue().length, 0);
    before.purchasedUpgrades.push('tools_of_trade');
    before.log = JSON.parse(JSON.stringify(g.log));
    assert.deepEqual(JSON.parse(JSON.stringify(g)), before);
    const paid = ['post_it_notes', 'gas_station_coffee', 'sticky_note_system'];
    assert.deepEqual(Array.from(h.api.UPGRADES.filter(h.api.upgradeVisible), upgrade => upgrade.id), paid);
    assert.equal(h.window.document.querySelectorAll('#upgrade-list .upgrade-card').length, 3);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.deepEqual(Array.from(restored.api.UPGRADES.filter(restored.api.upgradeVisible), upgrade => upgrade.id), paid);
  } finally {
    if (restored) restored.close();
    h.close();
  }
});

test('better way is a free upgrade at 35 tasks that gates later upgrades and persists across reloads', () => {
  const h = harness();
  let restored;
  try {
    const g = h.fresh();
    h.prepareUpgrade('ai_hint');
    const intro = h.api.UPGRADES.find(upgrade => upgrade.id === 'ai_hint');
    g.totalTasksDone = 34;
    h.api.checkMilestones();
    assert.equal(h.api.upgradeVisible(intro), false);
    g.totalTasksDone = 35;
    h.api.checkMilestones();
    h.api.renderAll();
    assert.equal(h.api.queue().length, 0);
    assert.deepEqual(Array.from(h.api.UPGRADES.filter(h.api.upgradeVisible), upgrade => upgrade.id), ['ai_hint']);
    const card = h.window.document.querySelector('#upgrade-list .upgrade-card');
    assert.match(card.textContent, /There Must Be a Better Way/);
    assert.equal(card.querySelector('button').textContent, 'Free');
    assert.equal(card.querySelector('button').disabled, false);
    g.totalTasksDone = 105;
    g.cash = 1000;
    for (const id of ['side_hustle', 'focus_timer', 'free_ai']) h.api.purchaseUpgrade(id);
    assert.equal(g.cash, 1000);
    assert.deepEqual(Array.from(h.api.UPGRADES.filter(h.api.upgradeVisible), upgrade => upgrade.id), ['ai_hint']);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.deepEqual(Array.from(restored.api.UPGRADES.filter(restored.api.upgradeVisible), upgrade => upgrade.id), ['ai_hint']);
    restored.close();
    restored = undefined;
    g.totalTasksDone = 35;
    g.cash = 0;
    const before = JSON.parse(JSON.stringify(g));
    // The harness does not execute inline handlers, so use the same public action.
    h.window.GAME.buy('ai_hint');
    before.purchasedUpgrades.push('ai_hint');
    before.log = JSON.parse(JSON.stringify(g.log));
    assert.deepEqual(JSON.parse(JSON.stringify(g)), before);
    assert.equal(h.api.queue().length, 0);
    const later = ['side_hustle', 'inbox_zero', 'gtd_workflow'];
    assert.deepEqual(Array.from(h.api.UPGRADES.filter(h.api.upgradeVisible), upgrade => upgrade.id), later);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.deepEqual(Array.from(restored.api.UPGRADES.filter(restored.api.upgradeVisible), upgrade => upgrade.id), later);
  } finally {
    if (restored) restored.close();
    h.close();
  }
});

test('Reality Check replaces its modal at 90 tasks and gates free AI without changing expenses', () => {
  const h = harness();
  let restored;
  try {
    const g = h.fresh();
    h.prepareUpgrade('reality_check');
    const upgrade = id => h.api.UPGRADES.find(item => item.id === id);
    g.totalTasksDone = 89;
    h.api.checkMilestones();
    assert.equal(g.expensesRevealed, false);
    assert.equal(h.api.upgradeVisible(upgrade('reality_check')), false);
    assert.equal(h.api.upgradeVisible(upgrade('free_ai')), false);
    g.totalTasksDone = 90;
    h.api.checkMilestones();
    h.api.renderAll();
    assert.equal(g.expensesRevealed, true);
    assert.equal(g.uiRevealed.expenseCard, true);
    assert.equal(g.uiRevealed.expenses, true);
    assert.equal(h.api.queue().length, 0);
    assert.deepEqual(Array.from(h.api.UPGRADES.filter(h.api.upgradeVisible), item => item.id), ['reality_check']);
    const card = h.window.document.querySelector('#upgrade-list .upgrade-card');
    assert.match(card.textContent, /Reality Check/);
    assert.match(card.textContent, /Bills are now draining your cash/);
    assert.equal(card.querySelector('button').textContent, 'Free');
    assert.equal(card.querySelector('button').disabled, false);
    g.totalTasksDone = 105;
    h.window.GAME.buy('free_ai');
    assert.equal(g.phase, 1);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.deepEqual(Array.from(restored.api.UPGRADES.filter(restored.api.upgradeVisible), item => item.id), ['reality_check']);
    restored.close();
    restored = undefined;
    g.totalTasksDone = 90;
    const before = JSON.parse(JSON.stringify(g));
    h.window.GAME.buy('reality_check');
    before.purchasedUpgrades.push('reality_check');
    before.log = JSON.parse(JSON.stringify(g.log));
    assert.deepEqual(JSON.parse(JSON.stringify(g)), before);
    assert.equal(h.api.queue().length, 0);
    assert.equal(h.api.upgradeVisible(upgrade('free_ai')), true);
    h.window.GAME.buy('free_ai');
    assert.equal(g.phase, 1);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.deepEqual(Array.from(restored.api.UPGRADES.filter(restored.api.upgradeVisible), item => item.id), ['free_ai']);
    restored.window.GAME.state.totalTasksDone = 105;
    restored.window.GAME.buy('free_ai');
    assert.equal(restored.window.GAME.state.phase, 2);
  } finally {
    if (restored) restored.close();
    h.close();
  }
});
