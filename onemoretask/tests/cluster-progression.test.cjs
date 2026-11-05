const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

function expansionCompany(phase, count) {
  const h = harness();
  const g = h.fresh(phase);
  g.cash = 1e12;
  g.tokens = 1e9;
  g.totalTasksDone = 1e9;
  g.ceoMode = 'scale';
  g.aiWorkerShutdown = true;
  h.prepareUpgrade(phase >= 14 ? 'neocloud_pipeline' : 'replication');
  for (let index = 0; index < count; index++) h.fullCluster().tank = 4000;
  h.api.checkMilestones();
  h.dismiss();
  return h;
}

test('four-character agent IDs resolve collisions, retain leading zeroes and wrap from ffff to 0000', () => {
  const h = harness();
  try {
    const g = h.fresh(9);
    h.window.Math.random = () => 0xffff / 0x10000;
    assert.equal(h.api.newClusterAgentName(), 'ffff');
    g.agents = [{name: 'ffff'}];
    assert.equal(h.api.newClusterAgentName(), '0000');
    g.agents.push({name: '0000'});
    assert.equal(h.api.newClusterAgentName(), '0001');
    h.window.Math.random = () => 0;
    assert.equal(h.api.newClusterAgentName(), '0001');
    g.agents = Array.from({length: 0x10000}, (_, index) => ({name: index.toString(16).padStart(4, '0')}));
    assert.throws(() => h.api.newClusterAgentName(), {name: 'RangeError', message: 'All four-character agent IDs are in use.'});
  } finally {
    h.close();
  }
});

test('Scale Mode enters Phase 11 with an explicit automatic expansion unlock', () => {
  const h = harness();
  try {
    h.window.chPh11();
    const g = h.window.GAME.state;
    assert.equal(g.phase, 10);
    assert.equal(g.ceoMode, 'manage');
    assert.equal(g.clusters.length, 5);
    assert.equal(g.cash, 180000000);
    const scale = h.api.UPGRADES.find(upgrade => upgrade.id === 'server_1');
    assert.equal(scale.unlockPhase, 11);
    assert.match(scale.desc, /create and staff new clusters automatically/);
    h.api.purchaseUpgrade('server_1');
    assert.equal(g.phase, 10);
    g.cash += 20000000;
    h.api.purchaseUpgrade('server_1');
    assert.equal(g.phase, 11);
    assert.equal(g.ceoMode, 'scale');
    assert.equal(h.api.canManuallyProvisionCluster(), false);
    g.cash = 1e12;
    h.api.tickAiCeo();
    assert.equal(g.clusters.length, 6);
    assert.equal(g.clusters[5].buildRemaining, 12);
    assert.equal(h.api.UPGRADES.find(upgrade => upgrade.id === 'ceo_course').unlockPhase, undefined);
  } finally {
    h.close();
  }
});

test('the Phase 11 speed upgrade halves construction and CEO coordination without changing phase', () => {
  const h = expansionCompany(11, 5);
  try {
    const g = h.window.GAME.state;
    g.purchasedUpgrades = g.purchasedUpgrades.filter(id => !['ceo_course', 'ceo_full_fit', 'ceo_continuous'].includes(id));
    const duration = h.api.clusterBuildDuration();
    assert.equal(duration, 6);
    assert.equal(h.api.UPGRADES.find(upgrade => upgrade.id === 'ceo_course').name, 'Rapid Cluster Deployment');
    h.api.purchaseUpgrade('ceo_course');
    assert.equal(g.phase, 11);
    assert.equal(h.api.clusterBuildDuration(), duration / 2);
    assert.equal(h.api.queue().length, 0);
    g.lastCeoAction = h.window.Date.now();
    g.ceoMode = 'manage';
    h.advance(900);
    h.api.tickAiCeo();
    assert.equal(g.lastCeoAction, h.window.Date.now());
    g.purchasedUpgrades = g.purchasedUpgrades.filter(id => id !== 'ceo_course');
    g.lastCeoAction = h.window.Date.now();
    h.advance(900);
    h.api.tickAiCeo();
    assert.notEqual(g.lastCeoAction, h.window.Date.now());
  } finally {
    h.close();
  }
});

test('replication expands two concurrent builds to four and pays for independent replacements', () => {
  const h = expansionCompany(12, 20);
  try {
    const g = h.window.GAME.state;
    h.api.tickAiCeo();
    assert.equal(g.clusters.filter(cluster => cluster.buildRemaining > 0).length, 2);
    h.api.purchaseUpgrade('replication');
    assert.equal(g.phase, 13);
    const initial = g.cash;
    const existing = g.clusters.length;
    h.api.tickAiCeo();
    assert.equal(g.clusters.length, existing + 2);
    assert.equal(initial - g.cash, g.clusters.slice(existing).reduce((sum, cluster) => sum + cluster.invested, 0));
    const cohort = g.clusters.slice(-4);
    let independentRefill = false;
    for (let tick = 0; tick < 60; tick++) {
      h.api.tickConstruction(0.1);
      h.advance(100);
      h.api.tickAiCeo();
      assert.equal(g.clusters.filter(cluster => cluster.buildRemaining > 0).length, 4);
      if (cohort[0].buildRemaining === 0 && cohort[1].buildRemaining > 0) independentRefill = true;
    }
    assert.equal(independentRefill, true);
    g.cash = 0;
    const count = g.clusters.length;
    h.api.tickConstruction(5);
    h.api.tickAiCeo();
    assert.equal(g.clusters.length, count);
    assert.equal(h.api.validSave(g), true);
  } finally {
    h.close();
  }
});

test('Phase 14 upgrades require completed clusters and cash, then unlock speed, cost reductions and whole neoclouds', () => {
  const h = expansionCompany(14, 99);
  try {
    const g = h.window.GAME.state;
    for (const [id, nodes, cost, concurrency, faster, cheaper] of [
      ['neocloud_pipeline', 100, 2000000000, 4, true, false],
      ['standardised_construction', 125, 1000000000, 4, false, true],
      ['neocloud_batch', 150, 2000000000, 25, false, false],
      ['bulk_hardware', 200, 1500000000, 25, false, true],
      ['factory_direct', 400, 2000000000, 25, false, false],
      ['neocloud_supply_chain', 450, 2500000000, 25, true, false],
      ['parallel_neoclouds', 500, 3000000000, 50, false, false],
    ]) {
      while (g.clusters.length < nodes - 1) h.fullCluster();
      const upgrade = h.api.UPGRADES.find(item => item.id === id);
      assert.equal(upgrade.cost, cost);
      assert.equal(h.api.upgradeVisible(upgrade), true);
      g.cash = upgrade.cost;
      h.api.purchaseUpgrade(id);
      assert.equal(g.purchasedUpgrades.includes(id), false);
      h.fullCluster();
      g.cash = upgrade.cost - 1;
      h.api.purchaseUpgrade(id);
      assert.equal(g.purchasedUpgrades.includes(id), false);
      const duration = h.api.clusterBuildDuration();
      const price = h.api.provisionCost();
      g.cash = upgrade.cost;
      h.api.purchaseUpgrade(id);
      assert.equal(g.cash, 0);
      assert.equal(g.purchasedUpgrades.includes(id), true);
      assert.equal(h.api.clusterBuildConcurrency(), concurrency);
      assert.equal(h.api.clusterBuildDuration(), faster ? duration / 2 : duration);
      if (id === 'factory_direct') assert.ok(h.api.provisionCost() < price);
      else assert.equal(h.api.provisionCost(), cheaper ? Math.ceil(price / 2) : price);
      h.api.purchaseUpgrade(id);
      assert.equal(g.cash, 0);
      assert.equal(g.purchasedUpgrades.filter(item => item === id).length, 1);
    }
    const duration = h.api.clusterBuildDuration();
    g.purchasedUpgrades = g.purchasedUpgrades.filter(id => id !== 'ceo_continuous');
    assert.ok(h.api.clusterBuildDuration() < duration);
    assert.equal(h.api.validSave(g), true);
  } finally {
    h.close();
  }
});

test('construction discounts halve every rising price and funding target, survive reload and remain active in Phase 15', () => {
  const h = expansionCompany(14, 300);
  let restored;
  try {
    const g = h.window.GAME.state;
    h.prepareUpgrade('retire_unlock');
    g.purchasedUpgrades = g.purchasedUpgrades.filter(id => !['standardised_construction', 'bulk_hardware'].includes(id));
    const originalPrices = Array.from({length: 50}, (_, index) => h.api.provisionCost(g.clustersProvisioned + index));
    const investments = g.clusters.map(cluster => cluster.invested);
    const duration = h.api.clusterBuildDuration();
    const income = h.api.networkIncomeRate();
    for (const [id, discount] of [['standardised_construction', 0.5], ['bulk_hardware', 0.25]]) {
      h.api.purchaseUpgrade(id);
      const prices = originalPrices.map(price => Math.ceil(price * discount));
      assert.deepEqual(Array.from({length: 50}, (_, index) => h.api.provisionCost(g.clustersProvisioned + index)), prices);
      assert.equal(h.api.expansionFundingTarget(), prices.reduce((sum, price) => sum + price, 0) * 2);
      assert.deepEqual(g.clusters.map(cluster => cluster.invested), investments);
      assert.equal(h.api.clusterBuildDuration(), duration);
      assert.equal(h.api.networkIncomeRate(), income);
    }
    g.cash = h.api.expansionFundingTarget();
    const cash = g.cash;
    h.api.tickAiCeo();
    assert.deepEqual([...g.clusters.slice(300)].map(cluster => cluster.invested), originalPrices.map(price => Math.ceil(price / 4)));
    assert.equal(g.cash, cash / 2);
    assert.equal(h.api.validSave(g), true);
    assert.equal(h.api.save(), true);
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.equal(restored.api.provisionCost(), h.api.provisionCost());
    assert.equal(restored.api.expansionFundingTarget(), h.api.expansionFundingTarget());
    restored.window.GAME.state.phase = 15;
    assert.equal(restored.api.provisionCost(), h.api.provisionCost());
    assert.equal(restored.api.expansionFundingTarget(), h.api.expansionFundingTarget());
  } finally {
    if (restored) restored.close();
    h.close();
  }
});

test('Factory-Direct Hardware lowers costs, makes price increases linear and persists without changing speed or investments', () => {
  const h = expansionCompany(14, 400);
  let restored;
  try {
    const g = h.window.GAME.state;
    h.prepareUpgrade('factory_direct');
    g.clusters[0].invested = 35000000;
    const before = h.api.provisionCost();
    const investments = g.clusters.map(cluster => cluster.invested);
    const duration = h.api.clusterBuildDuration();
    h.api.purchaseUpgrade('factory_direct');
    assert.ok(h.api.provisionCost() < before);
    assert.equal(h.api.nodeCost(), 42900000);
    const prices = [400, 800, 1200].map(count => h.api.provisionCost(count));
    assert.equal(prices[2] - prices[1], prices[1] - prices[0]);
    assert.equal(h.api.clusterBuildDuration(), duration);
    assert.deepEqual(g.clusters.map(cluster => cluster.invested), investments);
    assert.equal(h.api.expansionFundingTarget(), Array.from({length: 25}, (_, index) => h.api.provisionCost(400 + index)).reduce((sum, price) => sum + price, 0) * 2);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.equal(restored.api.provisionCost(), prices[0]);
    restored.window.GAME.state.phase = 15;
    assert.equal(restored.api.provisionCost(), prices[0]);
    assert.equal(restored.api.validSave(restored.window.GAME.state), true);
  } finally {
    if (restored) restored.close();
    h.close();
  }
});

test('the final Phase 14 company funds approximately one neocloud per second from its own income', () => {
  const h = harness();
  try {
    h.window.chRetire();
    const g = h.window.GAME.state;
    g.phase = 14;
    g.cash = 0;
    const samples = [];
    for (let second = 0; second < 30; second++) {
      for (let tick = 0; tick < 10; tick++) {
        h.advance(100);
        h.api.tick();
        assert.ok(g.cash >= 0);
      }
      samples.push(h.api.completedClusterCount());
    }
    const rate = (samples.at(-1) - samples[9]) / 20;
    assert.ok(rate >= 20 && rate <= 30, 'completed clusters per second: ' + rate);
    for (let index = 12; index < samples.length; index++) {
      assert.ok(samples[index] > samples[index - 3], 'construction resumes within three seconds throughout the steady run');
    }
    assert.equal(h.api.validSave(g), true);
  } finally {
    h.close();
  }
});

for (const concurrency of [25, 50]) {
  test(`${concurrency} neocloud builds pay every price, overlap, preserve order and resume after reload`, () => {
    const count = concurrency === 25 ? 75 : 125;
    const h = expansionCompany(14, count);
    let restored;
    try {
      const g = h.window.GAME.state;
      h.prepareUpgrade(concurrency === 25 ? 'neocloud_supply_chain' : 'retire_unlock');
      const initial = g.cash;
      const nextPrice = h.api.provisionCost();
      h.api.tickAiCeo();
      const builds = g.clusters.slice(count);
      assert.equal(builds.length, concurrency);
      assert.equal(builds[0].invested, nextPrice);
      assert.equal(initial - g.cash, builds.reduce((sum, cluster) => sum + cluster.invested, 0));
      assert.ok(builds.every(cluster => cluster.workforce === 16 && !cluster.managerAssigned));
      assert.ok(builds.at(-1).buildRemaining < builds[0].buildDuration * 1.5);
      assert.ok(builds.at(-1).invested > builds[0].invested);
      h.api.renderClusterSection();
      const document = h.window.document;
      assert.deepEqual([...document.querySelectorAll('[data-cluster-id]')].map(card => card.dataset.clusterId), [...g.clusters].reverse().map(cluster => cluster.id));
      assert.equal(document.querySelectorAll('.neocloud:has([aria-label="Cluster construction"])').length, concurrency / 25);
      assert.equal(h.api.completedClusterCount(), count);
      g.cash = 0;
      assert.equal(h.api.save(), true);
      restored = harness(h.window.localStorage.getItem('ai_empire_save'));
      assert.equal(restored.api.clusterBuildConcurrency(), concurrency);
      assert.deepEqual([...restored.window.GAME.state.clusters.slice(count)].map(cluster => cluster.buildRemaining), [...builds].map(cluster => cluster.buildRemaining));
      restored.api.tickConstruction(2);
      restored.api.tickAiCeo();
      assert.equal(restored.window.GAME.state.clusters.length, count + concurrency);
      assert.equal(restored.api.completedClusterCount(), count + concurrency);
      assert.equal(restored.api.validSave(restored.window.GAME.state), true);
    } finally {
      if (restored) restored.close();
      h.close();
    }
  });
}

test('whole-neocloud expansion saves for its full budget and resumes when cash recovers', () => {
  const h = expansionCompany(14, 125);
  try {
    const g = h.window.GAME.state;
    h.prepareUpgrade('retire_unlock');
    g.cash = h.api.provisionCost() * 2;
    h.api.tickAiCeo();
    assert.equal(g.clusters.length, 125);
    const budget = Array.from({length: 50}, (_, index) => h.api.provisionCost(g.clustersProvisioned + index)).reduce((sum, price) => sum + price, 0);
    assert.equal(h.api.expansionFundingTarget(), budget * 2);
    g.cash = budget * 2;
    h.api.tickAiCeo();
    assert.equal(g.clusters.length, 175);
    assert.equal(g.cash, budget);
    g.cash = 0;
    h.api.tickConstruction(2);
    h.api.tickAiCeo();
    assert.equal(g.clusters.length, 175);
    g.cash = 1e12;
    h.api.tickAiCeo();
    assert.equal(g.clusters.length, 225);
    assert.equal(g.clusters.filter(cluster => cluster.buildRemaining > 0).length, 50);
  } finally {
    h.close();
  }
});
