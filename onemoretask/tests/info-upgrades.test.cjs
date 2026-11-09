const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');
const previousSaves = require('./fixtures/pre-info-card-saves.json');

const infoIds = ['incident_info'];

for (const id of infoIds) {
  test(`${id} is a free optional card that dismisses once without changing gameplay`, (t) => {
    const h = harness();
    t.after(() => h.close());
    const upgrade = h.api.UPGRADES.find(item => item.id === id);
    const g = h.fresh(upgrade.phase);
    g.totalTasksDone = 1000;
    if (id === 'incident_info') h.api.triggerTutorialIncident();
    h.api.checkMilestones();
    assert.equal(h.api.upgradeVisible(upgrade), true);
    h.api.renderAll();
    const button = h.window.document.querySelector(`[onclick="GAME.buy('${id}')"]`);
    assert.ok(button);
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, '');
    assert.equal(button.getAttribute('aria-label'), upgrade.name);
    assert.equal(upgrade.introductory, true);
    assert.equal(upgrade.optional, true);
    assert.equal(h.api.queue().length, 0);
    const snapshot = JSON.parse(JSON.stringify(g));
    h.api.purchaseUpgrade(id);
    h.api.purchaseUpgrade(id);
    assert.equal(g.purchasedUpgrades.filter(value => value === id).length, 1);
    assert.equal(h.api.upgradeVisible(upgrade), false);
    const after = JSON.parse(JSON.stringify(g));
    delete snapshot.purchasedUpgrades;
    delete snapshot.log;
    delete after.purchasedUpgrades;
    delete after.log;
    assert.deepEqual(after, snapshot);
    assert.equal(h.api.save(), true);
    const restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    t.after(() => restored.close());
    assert.equal(restored.api.validSave(restored.window.GAME.state), true);
    assert.equal(restored.api.upgradeVisible(upgrade), false);
  });

  test(`${id} appears only during its relevant phases and never blocks later purchases`, (t) => {
    const h = harness();
    t.after(() => h.close());
    const upgrade = h.api.UPGRADES.find(item => item.id === id);
    const g = h.fresh(upgrade.phase - 1);
    g.totalIncidents = 1;
    assert.equal(h.api.upgradeVisible(upgrade), false);
    g.phase = upgrade.phase;
    assert.equal(h.api.upgradeVisible(upgrade), true);
    g.phase = upgrade.infoUntilPhase;
    assert.equal(h.api.upgradeVisible(upgrade), true);
    g.phase++;
    assert.equal(h.api.upgradeVisible(upgrade), false);
    g.phase = 2;
    g.cash = 2000;
    g.totalTasksDone = 300;
    h.prepareUpgrade('pro_model');
    g.purchasedUpgrades = g.purchasedUpgrades.filter(value => !infoIds.includes(value));
    h.api.purchaseUpgrade('pro_model');
    assert.equal(g.phase, 3);
    assert.equal(g.tokens, 50);
    assert.equal(h.api.queue().length, 0);
  });
}

test('first incident reveals guidance without blocking repair or pausing time', (t) => {
  const h = harness();
  t.after(() => h.close());
  const g = h.fresh(2);
  g.totalTasksDone = 150;
  const upgrade = h.api.UPGRADES.find(item => item.id === 'incident_info');
  assert.equal(h.api.upgradeVisible(upgrade), false);
  h.api.triggerTutorialIncident();
  assert.equal(h.api.upgradeVisible(upgrade), true);
  h.api.renderAll();
  const elapsed = g.totalPlaytime;
  h.api.resolveIncident(g.incidents[0].id, 'manual');
  for (let i = 0; i < 20; i++) { h.advance(100); h.api.tick(); }
  assert.equal(g.incidents[0].resolved, true);
  assert.ok(g.totalPlaytime > elapsed);
  assert.equal(g.purchasedUpgrades.includes('incident_info'), false);
  assert.equal(h.window.document.querySelector('#game-container').inert, false);
});

test('every formerly modal phase transition preserves its effects without a popup', (t) => {
  const h = harness();
  t.after(() => h.close());
  for (const [id, phase] of [['pro_model', 2], ['acquire_micro_agency', 9], ['ceo_readiness', 10], ['autonomous_nodes', 12], ['replication', 13], ['global_network', 14], ['agi_research', 15], ['retire_unlock', 16]]) {
    const g = h.fresh(phase);
    g.cash = 1e12;
    g.totalTasksDone = 1e9;
    h.prepareUpgrade(id);
    g.purchasedUpgrades = g.purchasedUpgrades.filter(value => !infoIds.includes(value));
    const count = phase === 10 ? 3 : phase === 13 ? 20 : phase === 14 ? 40 : phase >= 15 ? 500 : 0;
    for (let i = 0; i < count; i++) h.fullCluster();
    h.api.purchaseUpgrade(id);
    if (id === 'agi_research') h.api.tickAgi(30);
    if (id === 'retire_unlock') h.api.tickSalePreparation(8);
    assert.equal(g.phase, phase + 1, id);
    assert.equal(h.api.queue().length, 0, id);
    assert.equal(h.api.validSave(g), true, id);
  }
});

test('offline earnings are credited once and logged without a dialog on load and tab return', (t) => {
  const h = harness();
  t.after(() => h.close());
  const g = h.fresh(11);
  g.services = [{ id: 'contract', name: 'Revenue Service', incomeRate: 80, active: true }];
  g.uiRevealed.log = true;
  g.lastTick -= 60000;
  const raw = JSON.stringify(g);
  const restored = harness(raw);
  t.after(() => restored.close());
  const loaded = restored.window.GAME.state;
  assert.equal(loaded.cash, g.cash + 2400);
  assert.equal(loaded.totalCashEarned, g.totalCashEarned + 2400);
  assert.match(loaded.log[0].msg, /Offline earnings: \+\$2\.4K\. Away for 1m\. Contract income \$2\.4K, expenses \$0\./);
  assert.equal(restored.window.document.querySelector('#offline-popup'), null);
  assert.equal(restored.api.queue().length, 0);
  assert.match(restored.window.document.querySelector('#log-panel').textContent, /Offline earnings/);
  restored.api.applyOfflineProgress();
  assert.equal(loaded.cash, g.cash + 2400);
  assert.equal(loaded.log.filter(item => item.msg.startsWith('Offline earnings:')).length, 1);
  restored.advance(60000);
  restored.window.document.dispatchEvent(new restored.window.Event('visibilitychange'));
  assert.equal(loaded.cash, g.cash + 4800);
  assert.equal(loaded.log.filter(item => item.msg.startsWith('Offline earnings:')).length, 2);
  const elapsed = loaded.totalPlaytime;
  restored.advance(100);
  restored.api.tick();
  assert.ok(loaded.totalPlaytime > elapsed);
});

test('version 18 saves from all sixteen phases are preserved for explicit reset', (t) => {
  for (const original of previousSaves) {
    const raw = JSON.stringify(original);
    const h = harness(raw);
    t.after(() => h.close());
    const loaded = h.window.GAME.state;
    assert.equal(h.api.validSave(loaded), true);
    assert.equal(h.api.validSave(original), false);
    assert.equal(h.window.document.querySelector('#save-notice').hidden, false);
    assert.equal(loaded.saveVersion, 20);
    assert.equal(loaded.phase, 1);
    assert.equal(loaded.gameStarted, false);
    assert.equal(h.api.save(), false);
    assert.equal(h.window.localStorage.getItem('ai_empire_save'), raw);
  }
});


test('removed info cards never appear or purchase, and saves that recorded them still load', (t) => {
  for (const id of ['token_info', 'cluster_info', 'network_info']) {
    const h = harness();
    t.after(() => h.close());
    const upgrade = h.api.UPGRADES.find(item => item.id === id);
    const g = h.fresh(upgrade.phase);
    // An unfinished cluster must never disable the information card.
    // The cluster information card is now removed, including during construction.
    if (id === 'cluster_info') h.api.addClusterWithNextName();
    for (let phase = 1; phase <= 17; phase++) {
      g.phase = phase;
      assert.equal(h.api.upgradeVisible(upgrade), false);
      h.api.purchaseUpgrade(id);
      assert.equal(g.purchasedUpgrades.includes(id), false);
      g.uiRevealed.upgrades = true;
      h.api.renderUpgradeSection();
      assert.equal(h.window.document.querySelector(`[onclick="GAME.buy('${id}')"]`), null);
    }
    g.purchasedUpgrades.push(id);
    const restored = harness(JSON.stringify(g));
    t.after(() => restored.close());
    assert.equal(restored.api.validSave(restored.window.GAME.state), true);
    assert.equal(restored.window.document.querySelector('#save-notice').hidden, true);
    assert.ok(restored.window.GAME.state.purchasedUpgrades.includes(id));
    assert.equal(restored.api.upgradeVisible(upgrade), false);
  }
});

test('Your First Incident uses the requested description exactly', (t) => {
  const h = harness();
  t.after(() => h.close());
  assert.equal(h.api.UPGRADES.find(item => item.id === 'incident_info').desc,
    'Automation make mistakes that disrupt work and cost money. Keep on top of fixing them.');
});
