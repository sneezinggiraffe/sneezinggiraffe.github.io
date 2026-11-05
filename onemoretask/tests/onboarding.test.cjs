const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

test('You starts three gigs before inbox setup opens normal arrivals', () => {
  const h = harness();
  try {
    const g = h.window.GAME.state;
    h.window.document.querySelector('#btn-start-game').click();
    assert.equal(h.window.document.querySelector('#prelude-section').hidden, false);
    assert.equal(h.window.document.querySelector('#prelude-details').hidden, true);
    assert.equal(h.window.document.querySelector('#btn-do-task').textContent, 'Do Task');
    assert.equal(h.window.document.querySelector('#btn-do-task').parentElement.id, 'prelude-controls');
    assert.equal(h.window.document.querySelector('#section-agents').style.display, 'none');
    assert.equal(h.window.document.querySelector('#task-queue-section').style.display, 'none');
    for (let index = 0; index < 3; index++) {
      h.window.document.querySelector('#btn-do-task').click();
      h.api.tickManualWork(0.1); h.api.renderAll();
      assert.equal(h.window.document.querySelector('#btn-do-task').disabled, true);
      assert.match(h.window.document.querySelector('#prelude-task').textContent, new RegExp(g.tasks.find(task => task.status === 'active').name));
      const progress = Number(h.window.document.querySelector('#prelude-progress').getAttribute('aria-valuenow'));
      assert.ok(progress > 0 && progress < 100);
      h.api.tickManualWork(10); h.api.pruneTasks(h.window.Date.now()); h.api.renderAll();
    }
    assert.equal(g.totalTasksDone, 3);
    assert.equal(g.manualTasksCompleted, 3);
    assert.equal(h.window.document.querySelector('#you-delivered').textContent, '3 tasks delivered');
    assert.equal(h.window.document.querySelector('#btn-do-task').textContent, 'Do work');
    assert.equal(h.window.document.querySelector('#prelude-section').hidden, true);
    assert.equal(h.window.document.querySelector('#btn-do-task').parentElement.id, 'you-controls');
    assert.equal(h.window.document.querySelector('#team-heading').textContent, '');
    assert.equal(g.tasks.length, 1);
    assert.equal(g.tasks[0].id, 'setup_inbox');
    assert.equal(h.api.getSpawnInterval(), Infinity);
    assert.equal(h.window.document.querySelector('#task-list button'), null);
    assert.equal(h.window.document.querySelector('.task-assignee').textContent, 'Unassigned');
    h.window.document.querySelector('#btn-do-task').click(); h.api.renderAll();
    assert.equal(g.tasks.length, 3);
    assert.equal(h.window.document.querySelector('.task-assignee').textContent, 'You');
    h.api.tickManualWork(10);
    assert.equal(g.totalTasksDone, 4);
    assert.equal(h.api.validSave(g), true);
  } finally { h.close(); }
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
    assert.equal(g.uiRevealed.log, false);
    assert.equal(h.window.document.querySelector("#section-log").style.display, "none");
    assert.equal(g.taskExpiryEnabled, true);
    assert.deepEqual(Array.from(h.api.UPGRADES.filter(h.api.upgradeVisible), upgrade => upgrade.id), ['tools_of_trade']);
    assert.equal(h.window.document.querySelectorAll('#upgrade-list .upgrade-card').length, 1);
    const first = h.window.document.querySelector('#upgrade-list .upgrade-card');
    assert.match(first.textContent, /Tools of the Trade/);
    assert.equal(first.querySelector('button').textContent, '');
    assert.equal(first.querySelector('button').disabled, false);
    g.cash = 1000;
    h.api.purchaseUpgrade('hire_assistant');
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
    before.uiRevealed.log = true;
    assert.equal(h.window.document.querySelector('#section-log').style.display, '');
    before.log = JSON.parse(JSON.stringify(g.log));
    assert.deepEqual(JSON.parse(JSON.stringify(g)), before);
    const paid = ['hire_assistant', 'gas_station_coffee', 'sticky_note_system'];
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
    assert.equal(card.querySelector('button').textContent, '');
    assert.equal(card.querySelector('button').disabled, false);
    g.totalTasksDone = 105;
    g.cash = 1000;
    for (const id of ['side_hustle', 'focus_timer', 'free_ai']) h.api.purchaseUpgrade(id);
    assert.equal(g.cash, 1000);
    assert.deepEqual(Array.from(h.api.UPGRADES.filter(h.api.upgradeVisible), upgrade => upgrade.id), ['ai_hint', 'reality_check']);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.deepEqual(Array.from(restored.api.UPGRADES.filter(restored.api.upgradeVisible), upgrade => upgrade.id), ['ai_hint', 'reality_check']);
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
    const later = ['side_hustle', 'multitasking', 'inbox_zero'];
    assert.deepEqual(Array.from(h.api.UPGRADES.filter(h.api.upgradeVisible), upgrade => upgrade.id), later);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.deepEqual(Array.from(restored.api.UPGRADES.filter(restored.api.upgradeVisible), upgrade => upgrade.id), later);
  } finally {
    if (restored) restored.close();
    h.close();
  }
});

test('Reality Check replaces its modal at 85 tasks and gates free AI without changing expenses', () => {
  const h = harness();
  let restored;
  try {
    const g = h.fresh();
    h.prepareUpgrade('reality_check');
    const upgrade = id => h.api.UPGRADES.find(item => item.id === id);
    g.totalTasksDone = 84;
    h.api.checkMilestones();
    assert.equal(g.expensesRevealed, false);
    assert.equal(h.api.upgradeVisible(upgrade('reality_check')), false);
    assert.equal(h.api.upgradeVisible(upgrade('free_ai')), false);
    g.totalTasksDone = 85;
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
    assert.equal(card.querySelector('button').textContent, '');
    assert.equal(card.querySelector('button').disabled, false);
    g.totalTasksDone = 105;
    h.window.GAME.buy('free_ai');
    assert.equal(g.phase, 1);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.deepEqual(Array.from(restored.api.UPGRADES.filter(restored.api.upgradeVisible), item => item.id), ['reality_check']);
    restored.close();
    restored = undefined;
    g.totalTasksDone = 85;
    const before = JSON.parse(JSON.stringify(g));
    h.window.GAME.buy('reality_check');
    before.purchasedUpgrades.push('reality_check');
    before.log = JSON.parse(JSON.stringify(g.log));
    assert.deepEqual(JSON.parse(JSON.stringify(g)), before);
    assert.equal(h.api.queue().length, 0);
    assert.equal(h.api.upgradeVisible(upgrade('free_ai')), false);
    g.totalTasksDone = 104;
    assert.equal(h.api.upgradeVisible(upgrade('free_ai')), false);
    h.window.GAME.buy('free_ai');
    assert.equal(g.phase, 1);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.deepEqual(Array.from(restored.api.UPGRADES.filter(restored.api.upgradeVisible), item => item.id), []);
    restored.window.GAME.state.totalTasksDone = 105;
    assert.equal(restored.api.upgradeVisible(upgrade('free_ai')), true);
    restored.window.GAME.buy('free_ai');
    assert.equal(restored.window.GAME.state.phase, 2);
  } finally {
    if (restored) restored.close();
    h.close();
  }
});


test('Reality Check appears at 85 even with earlier purchases missing; free AI still requires them', () => {
  const h = harness();
  try {
    const g = h.fresh();
    h.prepareUpgrade('reality_check');
    g.totalTasksDone = 85;
    const reality = h.api.UPGRADES.find(upgrade => upgrade.id === 'reality_check');
    const purchased = [...g.purchasedUpgrades];
    for (const missing of purchased.filter(id => !h.api.UPGRADES.find(item => item.id === id).optional)) {
      g.purchasedUpgrades = purchased.filter(id => id !== missing);
      assert.equal(h.api.upgradeVisible(reality), true, missing);
      h.api.purchaseUpgrade('reality_check');
      assert.equal(g.purchasedUpgrades.includes('reality_check'), true, missing);
      g.totalTasksDone = 105;
      assert.equal(h.api.upgradeVisible(h.api.UPGRADES.find(item => item.id === 'free_ai')), false, missing);
      g.totalTasksDone = 85;
    }
    g.purchasedUpgrades = purchased;
    assert.equal(h.api.upgradeVisible(reality), true);
    h.api.purchaseUpgrade('reality_check');
    assert.equal(g.purchasedUpgrades.includes('reality_check'), true);
  } finally {
    h.close();
  }
});
