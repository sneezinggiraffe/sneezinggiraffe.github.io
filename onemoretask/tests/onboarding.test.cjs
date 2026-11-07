const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

test('the whole introduction and gig cards are clickable, including the decorative actions', () => {
  const h = harness();
  let restored;
  try {
    const document = h.window.document;
    const intro = document.querySelector('#intro-overlay');
    assert.equal(intro.tagName, 'BUTTON');
    assert.equal(intro.classList.contains('paper-card'), true);
    assert.equal(intro.querySelector('button, .intro-box'), null);
    assert.equal(intro.querySelector('.task-name').textContent, 'One More Task');
    assert.equal(intro.querySelector('#intro-action').textContent, 'Find Work');
    assert.equal(intro.querySelector('#intro-action').getAttribute('aria-hidden'), 'true');
    assert.equal(document.querySelector('#game-container').inert, false);
    assert.equal(document.querySelector('#top-bar').classList.contains('visible'), false);
    intro.querySelector('#intro-action').click();
    const state = h.window.GAME.state;
    assert.equal(state.tasks.length, 1);
    assert.equal(state.tasks[0].name, 'Deliver a pizza');
    assert.equal(document.querySelector('#prelude-task').textContent, state.tasks[0].name);
    assert.match(document.querySelector('#prelude-pay').textContent, /^Pay: \$/);
    assert.equal(document.querySelector('#prelude-card').disabled, false);
    const id = state.tasks[0].id;
    h.api.prepareOpeningTask();
    assert.equal(state.tasks.length, 1);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.equal(restored.window.GAME.state.tasks[0].id, id);
    assert.equal(restored.window.document.querySelector('#prelude-task').textContent, state.tasks[0].name);
    document.querySelector('#prelude-action').click();
    assert.equal(state.tasks[0].status, 'active');
    assert.equal(state.totalClicks, 1);
    assert.equal(document.querySelector('#prelude-action').hidden, true);
    h.api.prepareOpeningTask();
    assert.equal(state.tasks.length, 1);
    h.api.tickManualWork(10);
    h.api.pruneTasks(h.window.Date.now());
    h.api.renderAll();
    assert.equal(state.totalTasksDone, 1);
    assert.equal(state.tasks.length, 1);
    assert.notEqual(state.tasks[0].id, id);
    assert.equal(state.tasks[0].name, 'Wash a car');
    assert.equal(state.tasks[0].status, 'available');
    assert.equal(document.querySelector('#prelude-task').textContent, state.tasks[0].name);
    assert.equal(document.querySelector('#prelude-action').hidden, true);
    document.querySelector('#prelude-hint').click();
    assert.equal(state.tasks[0].status, 'active');
    assert.equal(state.totalClicks, 2);
  } finally {
    if (restored) restored.close();
    h.close();
  }
});

test('the top resource bar appears only after completing two gigs and remains visible after reload', () => {
  const h = harness();
  let restored;
  try {
    const document = h.window.document;
    const bar = document.querySelector('#top-bar');
    document.querySelector('#intro-overlay').click();
    for (let completed = 0; completed < 2; completed++) {
      assert.equal(bar.classList.contains('visible'), false);
      document.querySelector('#prelude-card').click();
      h.api.tickManualWork(0.1);
      h.api.renderAll();
      assert.equal(bar.classList.contains('visible'), false);
      h.api.tickManualWork(10);
      h.api.pruneTasks(h.window.Date.now());
      h.api.renderAll();
      assert.equal(bar.classList.contains('visible'), completed === 1);
    }
    assert.equal(h.window.GAME.state.totalTasksDone, 2);
    assert.equal(h.window.GAME.state.uiRevealed.topBar, true);
    assert.equal(h.window.GAME.state.uiRevealed.taskQueue, false);
    assert.equal(document.querySelector('#prelude-task').textContent, 'Help write an email');
    assert.equal(document.querySelector('#prelude-action').hidden, true);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.equal(restored.window.document.querySelector('#top-bar').classList.contains('visible'), true);
    assert.equal(restored.window.GAME.state.tasks.filter(task => task.status === 'available').length, 1);
  } finally {
    if (restored) restored.close();
    h.close();
  }
});

test('You completes three everyday gigs before inbox setup opens normal arrivals', () => {
  const h = harness();
  try {
    const g = h.window.GAME.state;
    const document = h.window.document;
    document.querySelector('#intro-overlay').click();
    assert.equal(document.querySelector('#prelude-section').hidden, false);
    assert.equal(document.querySelector('#prelude-details').hidden, false);
    assert.equal(document.querySelector('#section-agents').style.display, 'none');
    assert.equal(document.querySelector('#task-queue-section').style.display, 'none');
    const names = ['Deliver a pizza', 'Wash a car', 'Help write an email'];
    for (let index = 0; index < 3; index++) {
      assert.equal(document.querySelector('#prelude-task').textContent, names[index]);
      assert.equal(document.querySelector('#prelude-action').hidden, index > 0);
      document.querySelector('#prelude-card').click();
      h.api.tickManualWork(0.1); h.api.renderAll();
      assert.equal(document.querySelector('#prelude-card').disabled, true);
      assert.equal(document.querySelector('#prelude-action').hidden, true);
      const progress = Number(document.querySelector('#prelude-progress').getAttribute('aria-valuenow'));
      assert.ok(progress > 0 && progress < 100);
      h.api.tickManualWork(10); h.api.pruneTasks(h.window.Date.now()); h.api.renderAll();
    }
    assert.equal(g.totalTasksDone, 3);
    assert.equal(g.manualTasksCompleted, 3);
    assert.equal(document.querySelector('#you-card, #btn-do-task'), null);
    assert.equal(document.querySelector('#prelude-section').hidden, true);
    assert.equal(document.querySelector('#section-agents').style.display, 'none');
    assert.equal(document.querySelector('#team-heading').textContent, '');
    assert.equal(g.tasks.length, 1);
    assert.equal(g.tasks[0].id, 'setup_inbox');
    assert.equal(h.api.getSpawnInterval(), Infinity);
    assert.equal(document.querySelector('#task-list > .task-card').tagName, 'BUTTON');
    assert.equal(document.querySelector('.task-assignee').textContent, 'Unassigned');
    document.querySelector('[data-task-id="setup_inbox"]').click(); h.api.renderAll();
    assert.equal(g.tasks.length, 3);
    assert.equal(document.querySelector('.task-assignee').textContent, 'You');
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
    for (const count of [105, 130, 149]) {
      restored.window.GAME.state.totalTasksDone = count;
      restored.api.renderAll();
      const button = restored.window.document.querySelector('[onclick="GAME.buy(\'free_ai\')"]');
      assert.equal(button.textContent, '150 tasks');
      assert.equal(button.disabled, true);
      restored.window.GAME.buy('free_ai');
      assert.equal(restored.window.GAME.state.phase, 1);
    }
    restored.window.GAME.state.totalTasksDone = 150;
    restored.api.renderAll();
    assert.equal(restored.window.document.querySelector('[onclick="GAME.buy(\'free_ai\')"]').disabled, false);
    restored.window.GAME.buy('free_ai');
    assert.equal(restored.window.GAME.state.phase, 2);
  } finally {
    if (restored) restored.close();
    h.close();
  }
});


test('Reality Check requires every earlier purchase, including Multitasking, monitors and headphones', () => {
  const h = harness();
  try {
    const g = h.fresh();
    h.prepareUpgrade('reality_check');
    g.totalTasksDone = 85;
    const reality = h.api.UPGRADES.find(upgrade => upgrade.id === 'reality_check');
    const purchased = [...g.purchasedUpgrades];
    for (const missing of purchased) {
      g.purchasedUpgrades = purchased.filter(id => id !== missing);
      assert.equal(h.api.upgradeVisible(reality), false, missing);
      h.api.purchaseUpgrade('reality_check');
      assert.equal(g.purchasedUpgrades.includes('reality_check'), false, missing);
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

for (const id of ['hire_assistant', 'gas_station_coffee', 'sticky_note_system']) {
  test(`There Must Be a Better Way waits for ${id}`, () => {
    const h = harness();
    try {
      const g = h.fresh(); h.prepareUpgrade('ai_hint'); g.totalTasksDone = 130; g.cash = 1000;
      g.purchasedUpgrades = g.purchasedUpgrades.filter(item => item !== id);
      const hint = h.api.UPGRADES.find(item => item.id === 'ai_hint');
      assert.equal(h.api.upgradeVisible(hint), false);
      h.api.purchaseUpgrade('ai_hint'); assert.equal(g.purchasedUpgrades.includes('ai_hint'), false);
      h.api.purchaseUpgrade(id); assert.equal(h.api.upgradeVisible(hint), true);
    } finally { h.close(); }
  });
}
