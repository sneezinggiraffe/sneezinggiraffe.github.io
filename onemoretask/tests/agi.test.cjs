const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

test('an explicit AGI checkpoint replaces an incompatible save and restores saving', () => {
  const h = harness(JSON.stringify({ saveVersion: 18 }));
  try {
    assert.equal(h.api.save(), false);
    h.window.chPh16();
    assert.equal(h.window.document.querySelector('#save-notice').hidden, true);
    assert.equal(h.api.save(), true);
    const saved = JSON.parse(h.window.localStorage.getItem('ai_empire_save'));
    assert.equal(saved.saveVersion, 20);
    assert.equal(saved.phase, 15);
    assert.equal(h.api.validSave(saved), true);
  } finally {
    h.close();
  }
});

function company(t, before = 'agi_research', options = {}) {
  const h = harness(undefined, options);
  t.after(() => h.close());
  const g = h.fresh(before === 'agi_research' ? 15 : 16);
  g.cash = 1e12;
  g.tokens = 1e9;
  g.totalTasksDone = 1e9;
  g.aiWorkerShutdown = true;
  g.ceoMode = 'scale';
  h.prepareUpgrade(before);
  for (let index = 0; index < 500; index++) h.fullCluster().tank = 4000;
  h.api.checkMilestones();
  h.dismiss();
  h.api.renderAll();
  return h;
}

function upgrade(h, id) {
  return h.api.UPGRADES.find(item => item.id === id);
}

function readyCompany(t, options) {
  const h = company(t, 'retire_unlock', options);
  h.window.GAME.state.agi.route = '';
  h.api.renderAll();
  return h;
}

test('research review pauses for a decision and charges only on confirmation', t => {
  const h = company(t);
  const g = h.window.GAME.state;
  const document = h.window.document;
  const dialog = document.querySelector('#agi-research-dialog');
  const review = document.querySelector('#next-phase-upgrade button');
  const back = document.querySelector('#btn-agi-research-back');
  const start = document.querySelector('#btn-agi-research-start');
  const item = upgrade(h, 'agi_research');
  g.cash = item.cost - 1;
  h.api.renderAll();
  assert.equal(review.disabled, true);
  h.window.GAME.reviewAgiResearch();
  start.click();
  assert.equal(dialog.classList.contains('show'), false);
  assert.equal(g.agi.projectId, '');
  g.cash++;
  h.api.renderAll();
  review.focus();
  h.window.GAME.reviewAgiResearch();
  assert.equal(dialog.classList.contains('show'), true);
  assert.equal(document.activeElement, back);
  assert.match(dialog.textContent, /30 seconds/);
  document.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(document.activeElement, review);
  assert.equal(g.cash, item.cost);
  h.window.GAME.reviewAgiResearch();
  back.click();
  assert.equal(g.agi.projectId, '');
  h.window.GAME.reviewAgiResearch();
  start.click();
  start.click();
  assert.equal(g.agi.projectId, item.id);
  assert.equal(g.agi.remaining, item.agiDuration);
  assert.equal(g.cash, 0);
  assert.equal(review.disabled, true);
});

test('AGI research and computer use charge once, finish in order and persist active work', t => {
  const h = company(t);
  const g = h.window.GAME.state;
  assert.equal(h.window.document.querySelector('#section-agi').hidden, true);
  assert.equal(h.api.upgradeVisible(upgrade(h, 'retire_unlock')), false);
  assert.equal(h.api.agiNextUpgrade(), null);
  h.api.resumeAgi();
  h.api.takeAgiControl();
  assert.equal(g.agi.paused, false);
  for (const id of ['agi_research', 'agi_computer_use']) {
    const item = upgrade(h, id);
    const before = g.cash;
    h.api.purchaseUpgrade(id);
    assert.equal(g.phase, item.phase, 'Starting a project does not advance its phase');
    assert.equal(g.cash, before - item.cost);
    assert.equal(g.agi.projectId, id);
    assert.equal(g.agi.remaining, item.agiDuration);
    h.api.purchaseUpgrade(id);
    assert.equal(g.cash, before - item.cost);
    h.api.renderAll();
    assert.equal(h.window.document.querySelector('#section-agi').hidden, false);
    assert.match(h.window.document.querySelector('#agi-status').textContent, /remaining/);
    assert.ok(h.window.document.querySelector('progress[aria-label="AGI project"]'));
    h.api.tickAgi(item.agiDuration / 2);
    assert.equal(g.agi.remaining, item.agiDuration / 2);
    assert.equal(g.phase, item.phase);
    assert.equal(h.api.validSave(g), true);
    const restored = harness(JSON.stringify(g));
    try {
      const saved = restored.window.GAME.state;
      assert.equal(saved.agi.remaining, item.agiDuration / 2);
      assert.equal(saved.phase, item.phase);
      restored.advance(60000);
      restored.api.applyOfflineProgress();
      assert.equal(saved.agi.remaining, item.agiDuration / 2);
      restored.api.tickAgi(item.agiDuration / 2);
      assert.ok(saved.purchasedUpgrades.includes(id));
      assert.equal(saved.phase, 16);
      restored.api.renderAll();
      assert.equal(restored.window.document.querySelector('#phase-label').textContent, 'Phase 16: AGI');
      assert.equal(restored.api.validSave(saved), true);
    } finally {
      restored.close();
    }
    h.api.tickAgi(item.agiDuration / 2);
    assert.equal(g.agi.projectId, '');
    assert.equal(g.agi.remaining, 0);
    assert.ok(g.purchasedUpgrades.includes(id));
    assert.equal(g.phase, 16);
    h.api.renderAll();
    assert.equal(h.window.document.querySelector('#phase-label').textContent, 'Phase 16: AGI');
  }
});

test('AGI project and simulation timers pause in dialogs, hidden tabs and offline gaps', t => {
  const h = company(t);
  const g = h.window.GAME.state;
  h.api.purchaseUpgrade('agi_research');
  h.api.openSettingsPopup();
  h.advance(1000);
  h.api.tick();
  h.api.tickAgi(10);
  assert.equal(g.agi.remaining, 30);
  h.api.closeSettingsPopup();
  Object.defineProperty(h.window.document, 'hidden', { configurable: true, value: true });
  h.api.tickAgi(10);
  h.advance(1000);
  h.api.tick();
  assert.equal(g.agi.remaining, 30);
  Object.defineProperty(h.window.document, 'hidden', { configurable: true, value: false });
  h.advance(60000);
  h.api.tick();
  assert.equal(g.agi.remaining, 30);
  h.advance(1000);
  h.api.tick();
  assert.equal(g.agi.remaining, 29);
  g.retired = true;
  h.api.tickAgi(10);
  assert.equal(g.agi.remaining, 29);
});

test('AGI runs three checks and waits for one funded founder approval', t => {
  const h = company(t, 'agi_authority');
  const g = h.window.GAME.state;
  const document = h.window.document;
  const control = document.querySelector('#btn-agi-control');
  const item = upgrade(h, 'agi_authority');
  assert.equal(h.api.agiUpgradeReady(item), false);
  h.api.purchaseUpgrade(item.id);
  assert.equal(g.purchasedUpgrades.includes(item.id), false);
  h.api.renderAll();
  assert.match(document.querySelector('#agi-progress').textContent, /Checks complete · 0 \/ 3/);
  assert.equal(h.api.agiCanDrive(), true);
  assert.equal(control.textContent, 'Take control');
  h.api.tickAgi(2);
  assert.equal(h.api.agiMotionState().clicking, false);
  h.api.renderAgiPointer();
  assert.equal(document.body.classList.contains('agi-driving'), true);
  assert.equal(document.querySelector('#agi-cursors').hidden, false);
  document.dispatchEvent(new h.window.Event('pointermove'));
  assert.equal(g.agi.paused, false);
  control.click();
  assert.equal(g.agi.paused, true);
  assert.equal(document.body.classList.contains('agi-driving'), false);
  assert.equal(document.querySelector('#agi-cursors').hidden, true);
  assert.equal(document.querySelector('#agi-status').textContent, 'You have control');
  assert.equal(control.textContent, 'Resume AGI');
  h.api.tickAgi(20);
  assert.equal(g.agi.checks, 0);
  control.click();
  assert.equal(g.agi.paused, false);
  for (let index = 0; index < 3; index++) h.api.tickAgi(4);
  assert.equal(g.agi.checks, 3);
  g.cash = item.cost - 1;
  h.api.renderAll();
  assert.match(document.querySelector('#agi-status').textContent, /Checks complete. Saving for approval/);
  assert.equal(document.querySelector('#upgrade-list .input-needed'), null);
  h.api.tickAgi(20);
  assert.equal(g.agi.checks, 3, 'Supervised checks stop at the authority handover');
  assert.equal(g.agi.purchases, 0);
  g.cash++;
  h.api.renderAll();
  const approval = document.querySelector('[onclick="GAME.buy(\'agi_authority\')"]');
  assert.equal(approval.disabled, false);
  assert.match(approval.closest('.upgrade-card').textContent, /Allow AGI to buy upgrades.*Input needed.*Approve/);
  assert.equal(h.api.expansionReserve(), item.cost);
  assert.equal(h.api.agiFounderDecision(), item.id);
  assert.equal(document.querySelector('#agi-cursors').hidden, true);
  assert.equal(control.hidden, true);
  assert.equal(h.api.agiUpgradeReady(item), true);
  h.api.purchaseUpgrade(item.id);
  assert.equal(g.cash, 0);
  assert.ok(g.purchasedUpgrades.includes(item.id));
  assert.equal(g.agi.baselineNodes, 500);
  assert.equal(g.agi.baselineTasks, 1e9);
  assert.equal(h.api.agiMotionState().target, '', 'Authority resets the pending approval target');
  assert.equal(h.api.validSave(g), true);
  g.retired = true;
  h.api.takeAgiControl();
  h.api.resumeAgi();
  assert.equal(g.agi.paused, false);
});

test('AGI waits for funds, purchases a contract and proves new expansion, delivery and operations', t => {
  const h = company(t, 'agi_authority');
  const g = h.window.GAME.state;
  g.agi.checks = 3;
  h.api.purchaseUpgrade('agi_authority');
  g.cash = 1;
  h.api.tickAgi(1);
  assert.match(h.api.agiMotionState().status, /Saving for Enterprise Capacity Contracts/);
  h.api.tickAgi(3);
  assert.equal(g.agi.purchases, 0);
  g.cash = 1e12;
  h.api.tickAgi(1);
  assert.equal(h.api.agiMotionState().target, 'agi_contracts');
  h.api.renderAll();
  assert.ok(h.api.agiPointerTarget());
  h.api.tickAgi(3);
  assert.equal(g.agi.projectId, 'agi_contracts');
  assert.equal(g.agi.purchases, 1);
  assert.equal(h.api.agiNextUpgrade(), null);
  const payBefore = g.payMult;
  h.api.tickAgi(30);
  assert.ok(g.purchasedUpgrades.includes('agi_contracts'));
  assert.equal(g.payMult, payBefore * 1.25);
  const independence = upgrade(h, 'agi_independence');
  assert.equal(h.api.agiUpgradeReady(independence), false);
  h.api.tickAgi(1);
  assert.equal(h.api.agiMotionState().status, 'Proving independent operations');
  h.api.purchaseUpgrade('agi_independence');
  assert.equal(g.agi.projectId, '');
  g.agi.paused = true;
  g.techDebt = 20;
  const healthyBefore = g.agi.healthySeconds;
  h.api.tickAgi(1);
  assert.equal(g.agi.healthySeconds, healthyBefore);
  g.techDebt = 0;
  h.api.tickAgi(30);
  for (let index = 0; index < 500; index++) h.fullCluster().tank = 4000;
  g.clusters.at(-1).buildRemaining = 1;
  g.totalTasksDone += 100000000;
  assert.equal(h.api.agiUpgradeReady(independence), false);
  h.api.tickConstruction(1);
  assert.equal(h.api.agiUpgradeReady(independence), true);
  h.api.renderAll();
  assert.match(h.window.document.querySelector('#agi-progress').textContent, /New clusters: 500 \/ 500/);
  assert.match(h.window.document.querySelector('#agi-progress').textContent, /Tasks delivered: 100,000,000 \/ 100,000,000/);
  h.api.resumeAgi();
  h.api.tickAgi(4);
  assert.equal(g.agi.projectId, 'agi_independence');
  h.api.tickAgi(45);
  assert.ok(g.purchasedUpgrades.includes('agi_independence'));
  assert.equal(h.api.agiRouteReady(), true);
  h.api.renderAll();
  assert.match(h.window.document.querySelector('#agi-status').textContent, /Input needed/);
  assert.equal(h.window.document.querySelector('#agi-route-choices').hidden, false);
  assert.equal(h.api.upgradeVisible(upgrade(h, 'retire_unlock')), false);
});

test('AGI never commits an ending and buyout preserves the human final sale decision', t => {
  const h = readyCompany(t);
  const g = h.window.GAME.state;
  const talks = upgrade(h, 'retire_unlock');
  assert.equal(h.api.agiNextUpgrade(), null);
  h.api.tickAgi(4);
  assert.equal(g.agi.route, '');
  assert.equal(g.salePreparation.upgradeId, '');
  h.window.document.querySelector('#btn-agi-buyout').click();
  assert.equal(g.agi.route, 'buyout');
  assert.equal(h.api.agiRouteReady(), false);
  assert.equal(h.api.upgradeVisible(talks), true);
  h.api.requestKeepScaling();
  h.api.confirmKeepScaling();
  assert.equal(g.agi.route, 'buyout');
  h.api.purchaseUpgrade('retire_unlock');
  h.api.tickSalePreparation(8);
  assert.equal(g.phase, 17);
  h.api.renderAll();
  assert.equal(h.window.document.querySelector('#phase-label').textContent, 'Phase 17: Buyout');
  for (const id of ['sale_advisor', 'sale_buyout', 'sale_diligence', 'sale_terms']) {
    h.api.tickAgi(4);
    assert.equal(g.salePreparation.upgradeId, id);
    assert.equal(h.api.agiNextUpgrade(), null);
    h.api.tickSalePreparation(upgrade(h, id).saleDuration);
  }
  assert.equal(g.agi.purchases, 4);
  assert.equal(h.api.agiNextUpgrade(), null);
  h.api.tickAgi(20);
  assert.equal(g.retired, false);
  assert.equal(g.purchasedUpgrades.includes('fusion'), false);
  assert.equal(h.api.canSellCompany(), true);
  h.api.purchaseUpgrade('fusion');
  assert.equal(g.retired, true);
  assert.equal(g.agi.ended, false);
  assert.equal(h.window.document.querySelector('#ending-title').textContent, 'You retired early!');
  assert.equal(h.api.validSave(g), true);
});

test('oversight warning supports cancel, Escape, focus and an explicit permanent scaling decision', t => {
  const h = readyCompany(t);
  const g = h.window.GAME.state;
  h.api.confirmKeepScaling();
  assert.equal(g.agi.route, '');
  h.window.document.querySelector('#btn-agi-scaling').click();
  const dialog = h.window.document.querySelector('#agi-warning');
  assert.equal(dialog.classList.contains('show'), true);
  assert.equal(h.window.document.querySelector('#game-container').inert, true);
  assert.equal(h.window.document.activeElement.id, 'btn-agi-cancel');
  h.advance(1000);
  h.api.tick();
  assert.equal(g.agi.runawaySeconds, 0);
  h.window.document.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(dialog.classList.contains('show'), false);
  assert.equal(g.agi.route, '');
  h.api.requestKeepScaling();
  h.window.document.querySelector('#btn-agi-cancel').click();
  assert.equal(g.agi.route, '');
  h.api.requestKeepScaling();
  h.window.document.querySelector('#btn-agi-confirm').click();
  assert.equal(g.agi.route, 'scaling');
  assert.equal(g.phase, 16, 'The scaling ending stays in the AGI phase');
  assert.equal(g.agi.paused, false);
  assert.equal(dialog.classList.contains('show'), false);
  assert.equal(h.api.agiNextUpgrade(), null);
  assert.equal(h.api.upgradeVisible(upgrade(h, 'retire_unlock')), false);
  h.api.positionForBuyout();
  h.api.purchaseUpgrade('retire_unlock');
  assert.equal(g.agi.route, 'scaling');
  assert.equal(g.salePreparation.upgradeId, '');
  assert.equal(h.api.validSave(g), true);
});

test('runaway scaling escalates cursors, persists progress and ends in a frozen restartable run', t => {
  const h = readyCompany(t, { reducedMotion: false });
  const g = h.window.GAME.state;
  h.api.requestKeepScaling();
  h.api.confirmKeepScaling();
  const startingTasks = g.totalTasksDone;
  h.api.tickAgi(6);
  h.api.renderAll();
  assert.equal(g.agi.replicas, 4);
  assert.ok(g.totalTasksDone > startingTasks);
  assert.equal(h.window.document.body.classList.contains('agi-runaway'), true);
  assert.equal(h.window.document.querySelector('#agi-runaway-panel').hidden, false);
  assert.equal(h.window.document.querySelectorAll('.agi-cursor:not([hidden])').length, 2);
  assert.match(h.window.document.querySelector('#agi-replication-count').textContent, /4 AGI instances/);
  h.window.document.querySelector('#btn-agi-control').click();
  assert.equal(g.agi.paused, true);
  assert.equal(h.window.document.body.classList.contains('agi-driving'), false);
  assert.equal(h.window.document.querySelector('#agi-cursors').hidden, false);
  h.api.renderAll();
  assert.equal(h.window.document.querySelector('#agi-cursors').hidden, false, 'Replica cursors keep moving after human control returns');
  h.api.tickAgi(6);
  h.api.renderAll();
  assert.match(h.window.document.querySelector('#agi-runaway-status').textContent, /Internal demand/);
  assert.equal(h.window.document.querySelectorAll('.agi-cursor:not([hidden])').length, 3);
  const restored = harness(JSON.stringify(g), { reducedMotion: false });
  try {
    assert.equal(restored.window.GAME.state.agi.runawaySeconds, 12);
    restored.api.applyOfflineProgress();
    assert.equal(restored.window.GAME.state.agi.runawaySeconds, 12);
  } finally {
    restored.close();
  }
  h.api.tickAgi(12);
  h.api.renderAll();
  assert.equal(h.window.document.body.dataset.agiStage, '3');
  assert.equal(h.window.document.querySelectorAll('.agi-cursor:not([hidden])').length, 4);
  assert.match(h.window.document.querySelector('#agi-runaway-status').textContent, /Additional management/);
  h.api.tickAgi(12);
  h.api.renderAll();
  assert.match(h.window.document.querySelector('#agi-runaway-status').textContent, /All available space/);
  h.api.tickAgi(9);
  assert.equal(g.agi.ended, true);
  assert.equal(g.retired, true);
  assert.equal(h.api.validSave(g), true);
  const document = h.window.document;
  const fade = document.querySelector('#ending-transition');
  const companyView = document.querySelector('#game-container');
  const ending = document.querySelector('#ending-overlay');
  const cursors = document.querySelector('#agi-cursors');
  assert.equal(fade.hidden, false);
  assert.equal(ending.hidden, true);
  assert.equal(companyView.hidden, false);
  assert.equal(companyView.inert, true);
  assert.equal(document.body.classList.contains('agi-runaway'), true);
  assert.equal(cursors.hidden, false);
  assert.equal(h.api.canPrestige(), false);
  assert.equal(h.api.canTrueRetire(), false);
  const frozen = JSON.stringify(g);
  h.advance(500);
  h.api.tick();
  h.api.renderAll();
  assert.equal(Number(fade.style.opacity), 0.5);
  assert.equal(companyView.hidden, false);
  h.advance(600);
  h.api.renderAll();
  assert.equal(Number(fade.style.opacity), 1);
  assert.equal(ending.hidden, true);
  assert.equal(companyView.hidden, false);
  h.advance(300);
  h.api.renderAll();
  assert.equal(companyView.hidden, true);
  assert.equal(cursors.hidden, true);
  assert.equal(ending.hidden, false);
  assert.equal(document.querySelector('#ending-title').textContent, 'There is always one more task.');
  assert.equal(document.querySelector('#ending-choices').hidden, true);
  assert.equal(document.activeElement.id, 'btn-ending-reset');
  h.advance(1200);
  h.api.renderAll();
  assert.equal(fade.hidden, true);
  h.window.GAME.addCash(100);
  h.api.tickAgi(5);
  assert.equal(JSON.stringify(g), frozen);
  const ended = harness(frozen);
  try {
    assert.equal(ended.window.document.querySelector('#ending-title').textContent, 'There is always one more task.');
    assert.equal(ended.window.document.querySelector('#ending-overlay').hidden, false);
    assert.equal(ended.window.document.querySelector('#ending-transition').hidden, true);
  } finally {
    ended.close();
  }
  h.window.document.querySelector('#btn-ending-reset').click();
  const reset = harness(h.window.localStorage.getItem('ai_empire_save'));
  try {
    assert.equal(reset.window.GAME.state.phase, 1);
    assert.equal(reset.window.GAME.state.agi.route, '');
    assert.equal(reset.window.document.body.classList.contains('agi-runaway'), false);
  } finally {
    reset.close();
  }
});

test('AGI varies its time at visible metrics and scrolls once for a purchase', t => {
  const h = company(t, 'agi_contracts');
  const document = h.window.document;
  const motion = h.api.agiMotionState();
  motion.target = 'cash';
  const panel = document.querySelector('#control-panel');
  const cash = document.querySelector('#res-cash');
  const expense = document.querySelector('#expense-rate');
  panel.getBoundingClientRect = () => ({ top: 60, bottom: 700, left: 600, width: 600, height: 640 });
  document.querySelector('#income-rate').getBoundingClientRect = () => ({ top: 1100, left: 600, width: 500, height: 100 });
  cash.getBoundingClientRect = () => ({ top: 160, left: 300, width: 100, height: 30 });
  expense.getBoundingClientRect = () => ({ top: 20, left: h.window.innerWidth - 40, width: 20, height: 20 });
  h.api.renderAgiPointer();
  const cursor = document.querySelector('#agi-cursor');
  assert.equal(h.api.agiPointerTarget(), cash);
  assert.equal(cursor.style.left, '350px');
  assert.equal(panel.scrollTop, 0);
  motion.elapsed = 1.8;
  h.api.renderAgiPointer();
  assert.equal(h.api.agiPointerTarget(), expense);
  assert.equal(cursor.style.left, `${h.window.innerWidth - 75}px`);
  motion.visits = 1;
  h.api.renderAgiPointer();
  assert.equal(h.api.agiPointerTarget(), cash, 'A later inspection holds its first target longer');
  motion.elapsed = 3;
  assert.equal(h.api.agiPointerTarget(), expense);
  assert.equal(panel.scrollTop, 0);
  motion.target = 'agi_contracts';
  const purchase = document.querySelector('[onclick="GAME.buy(\'agi_contracts\')"]');
  purchase.closest('.upgrade-card').getBoundingClientRect = () => ({ top: 1100, bottom: 1200, height: 100 });
  h.api.renderAgiPointer();
  assert.equal(panel.scrollTop, 1024);
  h.api.renderAgiPointer();
  assert.equal(panel.scrollTop, 1024);
  motion.target = 'missing';
  h.api.renderAgiPointer();
  assert.equal(h.api.agiPointerTarget(), null);
  const oldMotion = motion;
  h.fresh();
  assert.notEqual(h.api.agiMotionState(), oldMotion);
  h.api.renderAgiPointer();
  assert.equal(document.querySelector('#agi-cursors').hidden, true);
});

test('AGI visits operations and reads farther down the event log once per visit', t => {
  const h = company(t, 'agi_contracts', { reducedMotion: false });
  const g = h.window.GAME.state;
  g.cash = 0;
  const document = h.window.document;
  const panel = document.querySelector('#control-panel');
  const health = document.querySelector('#operations-health');
  const events = document.querySelector('#log-panel');
  const scrolls = [];
  for (const element of [panel, events]) {
    element.scrollTo = ({ top, behavior }) => {
      scrolls.push([element.id, behavior]);
      element.scrollTop = top;
    };
  }
  panel.getBoundingClientRect = () => ({ top: 60, bottom: 700 });
  health.getBoundingClientRect = () => ({ top: 1100 - panel.scrollTop, bottom: 1124 - panel.scrollTop, height: 24, left: 400, width: 220 });
  events.getBoundingClientRect = () => ({ top: 1800 - panel.scrollTop, bottom: 1950 - panel.scrollTop, height: 150, left: 400, width: 220 });
  Object.defineProperty(events, 'clientHeight', { value: 150 });
  Object.defineProperty(events, 'scrollHeight', { value: 450 });

  h.api.tickAgi(4);
  h.api.tickAgi(1);
  h.api.renderAgiPointer();
  assert.equal(h.api.agiPointerTarget(), health);
  assert.ok(panel.scrollTop > 0);
  h.api.renderAgiPointer();
  assert.deepEqual(scrolls, [['control-panel', 'smooth']]);
  for (let index = 0; index < 3; index++) h.api.tickAgi(4);
  h.api.tickAgi(1);
  h.api.renderAgiPointer();
  assert.equal(h.api.agiPointerTarget(), events);
  assert.equal(events.scrollTop, 0);
  h.api.tickAgi(1);
  h.api.renderAgiPointer();
  assert.equal(events.scrollTop, 75);
  h.api.renderAgiPointer();
  assert.deepEqual(scrolls, [['control-panel', 'smooth'], ['control-panel', 'smooth'], ['log-panel', 'smooth']]);
});

test('AGI save validation rejects impossible projects, routes and terminal states', t => {
  const h = readyCompany(t);
  const source = h.window.GAME.state;
  const mutations = [
    state => { state.agi.route = 'other'; },
    state => { state.agi.checks = 1.5; },
    state => { state.agi.purchases = 1.5; },
    state => { state.agi.replicas = 0; },
    state => { state.agi.projectId = 'missing'; state.agi.remaining = 1; },
    state => { state.agi.remaining = 1; },
    state => { state.agi.route = 'buyout'; state.purchasedUpgrades = state.purchasedUpgrades.filter(id => id !== 'agi_independence'); },
    state => { state.agi.route = 'scaling'; state.phase = 17; },
    state => { state.agi.route = 'scaling'; state.salePreparation.upgradeId = 'retire_unlock'; },
    state => { state.agi.route = 'scaling'; state.purchasedUpgrades.push('retire_unlock'); },
    state => { state.agi.ended = true; },
    state => { state.agi.route = 'scaling'; state.agi.ended = true; state.agi.runawaySeconds = 45; },
    state => { state.agi.route = 'scaling'; state.agi.ended = true; state.retired = true; state.agi.runawaySeconds = 20; },
    state => { state.agi.runawaySeconds = 46; },
    state => { state.agi.runawaySeconds = 1; },
    state => { state.agi.replicas = 2; },
    state => { state.agi.route = 'scaling'; state.retired = true; },
    state => { state.agi.route = 'scaling'; state.agi.runawaySeconds = 45; },
  ];
  for (const mutate of mutations) {
    const state = JSON.parse(JSON.stringify(source));
    mutate(state);
    assert.equal(h.api.validAgiSave(state), false, mutate.toString());
    assert.equal(h.api.validSave(state), false, mutate.toString());
  }
  const working = JSON.parse(JSON.stringify(source));
  working.phase = 15;
  working.purchasedUpgrades = working.purchasedUpgrades.filter(id => !id.startsWith('agi_'));
  working.agi.projectId = 'agi_research';
  working.agi.remaining = 15;
  assert.equal(h.api.validSave(working), true);
  for (const mutate of [
    state => { state.phase = 16; },
    state => { state.retired = true; },
    state => { state.agi.route = 'buyout'; },
    state => { state.agi.remaining = 0; },
    state => { state.agi.remaining = 31; },
    state => { state.purchasedUpgrades.push('agi_research'); },
    state => { state.purchasedUpgrades = state.purchasedUpgrades.filter(id => id !== 'parallel_neoclouds'); },
  ]) {
    const state = JSON.parse(JSON.stringify(working));
    mutate(state);
    assert.equal(h.api.validAgiSave(state), false, mutate.toString());
  }
});

test('new checkpoints expose the AGI progression, route choice and investor talks', t => {
  const h = harness();
  t.after(() => h.close());
  assert.equal(h.window.chPh15Agi, undefined);
  assert.equal(h.window.chPh15Choice, undefined);
  const original = h.window.GAME.state;
  h.window.GAME.cheat('15_agi');
  h.window.GAME.cheat('15_choice');
  assert.equal(h.window.GAME.state, original);
  h.window.chPh16();
  let g = h.window.GAME.state;
  assert.equal(g.phase, 15);
  assert.ok(g.purchasedUpgrades.includes('parallel_neoclouds'));
  assert.equal(g.cash, 8000000000);
  assert.equal(h.window.document.querySelector('#phase-label').textContent, 'Phase 15: Global Expansion');
  assert.equal(g.purchasedUpgrades.includes('agi_research'), false);
  assert.equal(h.api.validSave(g), true);
  h.window.chPh16Choice();
  g = h.window.GAME.state;
  assert.equal(g.phase, 16);
  assert.equal(h.window.document.querySelector('#phase-label').textContent, 'Phase 16: AGI');
  assert.equal(h.api.agiRouteReady(), true);
  assert.equal(h.api.validSave(g), true);
  h.window.chPh17();
  g = h.window.GAME.state;
  assert.equal(g.phase, 16);
  assert.equal(g.agi.route, 'buyout');
  assert.equal(h.api.upgradeVisible(upgrade(h, 'retire_unlock')), true);
  assert.equal(h.api.validSave(g), true);
});

test('a funded checkpoint reaches independence and a buyout through real production and AGI purchases', t => {
  const h = harness();
  t.after(() => h.close());
  h.window.chPh16();
  const g = h.window.GAME.state;
  const startingCash = g.cash;
  const startingTasks = g.totalTasksDone;
  const started = new Map();
  let choiceSeconds = null;
  let endingSeconds = null;
  for (let step = 0; step < 6000; step++) {
    h.advance(100);
    if (step % 5 === 0) {
      for (const id of ['agi_research', 'agi_computer_use', 'agi_authority']) {
        const item = upgrade(h, id);
        if (!g.purchasedUpgrades.includes(id) && !g.agi.projectId && h.api.upgradeVisible(item) && h.api.agiUpgradeReady(item) && g.cash >= item.cost) {
          h.api.purchaseUpgrade(id);
          started.set(id, step / 10);
        }
      }
      if (h.api.agiRouteReady()) {
        choiceSeconds = step / 10;
        assert.equal(g.agi.purchases, 2, 'AGI funds its own contracts and founder handover');
        assert.ok(h.api.completedClusterCount() - g.agi.baselineNodes >= 500);
        assert.ok(g.totalTasksDone - g.agi.baselineTasks >= 100000000);
        assert.equal(g.agi.healthySeconds, 30);
        assert.equal(h.api.validSave(g), true);
        h.api.positionForBuyout();
        h.api.purchaseUpgrade('retire_unlock');
      }
      if (h.api.canSellCompany() && g.cash >= upgrade(h, 'fusion').cost) {
        assert.equal(g.retired, false, 'AGI leaves final settlement to the player');
        assert.equal(g.agi.purchases, 6);
        h.api.purchaseUpgrade('fusion');
      }
    }
    h.api.tick();
    if (g.retired) {
      endingSeconds = step / 10;
      break;
    }
  }
  assert.equal(startingCash, upgrade(h, 'agi_research').cost, 'The checkpoint funds the first research purchase');
  assert.equal(started.get('agi_research'), 0);
  assert.ok(started.get('agi_computer_use') - started.get('agi_research') >= 30);
  assert.ok(started.get('agi_authority') - started.get('agi_computer_use') >= 30);
  assert.ok(choiceSeconds >= 150 && choiceSeconds <= 420, `AGI progression reaches its choice in ${choiceSeconds}s`);
  assert.ok(endingSeconds > choiceSeconds + 58 && endingSeconds < 600, `Sale completes in ${endingSeconds}s`);
  assert.ok(g.totalTasksDone > startingTasks + 100000000);
  assert.equal(g.phase, 17);
  assert.equal(g.agi.route, 'buyout');
  assert.equal(g.agi.ended, false);
  assert.equal(h.api.validSave(g), true);
  t.diagnostic(`AGI choice at ${choiceSeconds}s; retirement at ${endingSeconds}s; ${g.clusters.length} clusters; ${g.agi.purchases} autonomous purchases`);
});

test('runaway ticks autosave before the ending and resume the saved replication stage', t => {
  const h = readyCompany(t);
  h.api.requestKeepScaling();
  h.api.confirmKeepScaling();
  const g = h.window.GAME.state;
  const initialSave = h.window.localStorage.getItem('ai_empire_save');
  for (let step = 0; step < 110; step++) {
    h.advance(100);
    h.api.tick();
  }
  assert.ok(g.agi.runawaySeconds > 10 && g.agi.runawaySeconds < 12);
  const currentSave = h.window.localStorage.getItem('ai_empire_save');
  assert.notEqual(currentSave, initialSave);
  const saved = JSON.parse(currentSave);
  assert.ok(saved.agi.runawaySeconds > 10 && saved.agi.runawaySeconds <= g.agi.runawaySeconds);
  assert.equal(saved.agi.route, 'scaling');
  assert.equal(saved.retired, false);
  assert.equal(h.api.validSave(saved), true);
  const restored = harness(currentSave);
  try {
    const state = restored.window.GAME.state;
    assert.equal(state.agi.runawaySeconds, saved.agi.runawaySeconds);
    restored.advance(1000);
    restored.api.tick();
    assert.ok(state.agi.runawaySeconds > saved.agi.runawaySeconds);
    assert.equal(state.agi.route, 'scaling');
    assert.equal(restored.api.validSave(state), true);
  } finally {
    restored.close();
  }
});

test('Escape closes settings without reading a cleared active dialog during AGI play', t => {
  const h = readyCompany(t);
  h.api.openSettingsPopup();
  h.api.syncDialogFocus();
  assert.equal(h.window.document.querySelector('#settings-popup').classList.contains('show'), true);
  assert.doesNotThrow(() => h.api.handleDialogKey({ key: 'Escape' }));
  assert.equal(h.window.document.querySelector('#settings-popup').classList.contains('show'), false);
  assert.equal(h.window.document.querySelector('#game-container').inert, false);
});

test('AGI yields at each founder decision and resumes for the sale projects', t => {
  const h = readyCompany(t);
  const g = h.window.GAME.state;
  h.api.tickAgi(1);
  assert.equal(h.api.agiFounderDecision(), 'route');
  assert.equal(h.api.agiCanDrive(), false);
  assert.equal(h.window.document.querySelector('#section-upgrades #agi-route-choices').hidden, false);
  const checks = g.agi.checks;
  h.api.tickAgi(20);
  assert.equal(g.agi.checks, checks);
  assert.equal(g.agi.route, '');
  assert.equal(h.window.document.querySelector('#agi-cursors').hidden, true);
  h.api.positionForBuyout();
  h.api.tickAgi(1);
  h.api.renderAll();
  assert.equal(h.api.agiFounderDecision(), 'retire_unlock');
  h.api.tickAgi(20);
  assert.equal(g.salePreparation.upgradeId, '');
  h.api.purchaseUpgrade('retire_unlock');
  h.api.tickAgi(4);
  assert.equal(h.api.agiCanDrive(), true);
  h.api.tickSalePreparation(8);
  h.api.tickAgi(0.1);
  assert.equal(h.api.agiMotionState().target, 'sale_advisor', 'Completed investor talks start the next AGI purchase');
  for (const id of ['sale_advisor', 'sale_buyout', 'sale_diligence', 'sale_terms']) {
    h.api.tickAgi(4);
    assert.equal(g.salePreparation.upgradeId, id);
    h.api.tickSalePreparation(upgrade(h, id).saleDuration);
  }
  h.api.tickAgi(1);
  h.api.renderAll();
  assert.equal(h.api.agiFounderDecision(), 'fusion');
  assert.equal(h.window.document.querySelector('#agi-cursors').hidden, true);
  const purchases = g.agi.purchases;
  h.api.tickAgi(30);
  assert.equal(g.agi.purchases, purchases);
  assert.equal(g.retired, false);
  assert.equal(h.api.validSave(g), true);
});

test('AGI keeps both ending choices visible inside a short mobile control panel', t => {
  const h = company(t, 'retire_unlock');
  const document = h.window.document;
  Object.defineProperty(h.window, 'innerWidth', { configurable: true, value: 320 });
  Object.defineProperty(h.window, 'innerHeight', { configurable: true, value: 568 });
  const panel = document.querySelector('#control-panel');
  const choices = document.querySelector('#agi-route-choices');
  const bounds = { top: 400, bottom: 550, left: 10, width: 300, height: 150 };
  panel.getBoundingClientRect = () => bounds;
  Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 900 });
  Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 150 });
  document.querySelector('#top-bar').getBoundingClientRect = () => ({ top: 0, bottom: 118, left: 0, width: 320, height: 118 });
  choices.getBoundingClientRect = () => ({ top: 750 - panel.scrollTop, bottom: 850 - panel.scrollTop, left: 10, width: 300, height: 100 });
  h.window.GAME.state.agi.route = '';
  h.api.renderAll();
  assert.equal(h.api.agiFounderDecision(), 'route');
  for (const [index, id] of ['btn-agi-buyout', 'btn-agi-scaling'].entries()) {
    document.querySelector('#' + id).getBoundingClientRect = () => ({ top: 795 - panel.scrollTop, bottom: 838 - panel.scrollTop, left: 10 + index * 150, width: 145, height: 43 });
  }
  assert.ok(panel.scrollTop >= 0 && panel.scrollTop <= panel.scrollHeight - panel.clientHeight);
  for (const element of [choices, document.querySelector('#btn-agi-buyout'), document.querySelector('#btn-agi-scaling')]) {
    const rect = element.getBoundingClientRect();
    assert.ok(rect.top >= bounds.top, element.id + ' stays below the panel top');
    assert.ok(rect.bottom <= bounds.bottom, element.id + ' stays above the panel bottom');
  }
  const settledScroll = panel.scrollTop;
  h.api.renderAgiPointer();
  assert.equal(panel.scrollTop, settledScroll, 'The handover stays stable after its initial scroll');
});
