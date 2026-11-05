const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

function company(phase = 15, count = 500, options = {}) {
  const h = harness(undefined, options);
  const g = h.fresh(phase);
  g.ceoMode = 'scale';
  g.cash = 1e11;
  g.tokens = 1e9;
  g.totalTasksDone = 1e9;
  g.aiWorkerShutdown = true;
  g.purchasedUpgrades.push('ceo_full_fit', 'ceo_continuous', 'ceo_parallel_clusters');
  if (phase >= 15) h.prepareUpgrade('retire_unlock');
  for (let index = 0; index < count; index++) h.fullCluster().tank = 4000;
  h.api.checkMilestones();
  h.dismiss();
  return h;
}

function saleButton(h, id) {
  return h.window.document.querySelector('[onclick="GAME.buy(\'' + id + '\')"]');
}

test('manual provisioning placeholders and newly built clusters take the first position in Phases 9 and 10', () => {
  for (const phase of [10, 11]) {
    const h = harness();
    try {
      const g = h.fresh(phase);
      g.cash = 1e9;
      g.totalTasksDone = 1e9;
      g.ceoMode = phase === 11 ? 'manage' : 'off';
      g.purchasedUpgrades.push('cluster_capacity_2', 'cluster_capacity_3');
      const original = h.fullCluster();
      h.api.checkMilestones();
      h.dismiss();
      h.api.renderClusterSection();
      const grid = h.window.document.querySelector('#cluster-list .node-grid');
      assert.equal(grid.firstElementChild.classList.contains('provision-card'), true);
      assert.equal(grid.children[1].dataset.clusterId, original.id);
      h.window.GAME.openCluster();
      const newest = g.clusters.at(-1);
      h.api.renderClusterSection();
      assert.equal(grid.firstElementChild.dataset.clusterId, newest.id);
      assert.equal(grid.children[1].dataset.clusterId, original.id);
      assert.equal(grid.querySelector('.provision-card'), null);
      h.api.tickConstruction(newest.buildRemaining);
      while (newest.workerAgentIds.length < newest.workerSlotsMax) h.api.buyNextClusterWorker(newest.id);
      h.api.tickConstruction(Math.max(...g.agents.map(agent => agent.provisionRemaining)));
      h.api.renderClusterSection();
      assert.equal(grid.firstElementChild.classList.contains('provision-card'), true);
      assert.equal(grid.children[1].dataset.clusterId, newest.id);
      assert.equal(grid.children[2].dataset.clusterId, original.id);
      assert.equal(g.clusters[0].id, original.id);
      assert.equal(h.api.validSave(g), true);
    } finally {
      h.close();
    }
  }
});

test('Phases 11 through 13 put planning and newest clusters first throughout construction', () => {
  for (const phase of [12, 13, 14]) {
    const h = company(phase, 3);
    try {
      const g = h.window.GAME.state;
      const originalOrder = g.clusters.map(cluster => cluster.id);
      h.api.openCluster();
      const building = g.clusters.at(-1);
      h.api.renderClusterSection();
      const grid = h.window.document.querySelector('#cluster-list .node-grid');
      assert.equal(grid.firstElementChild.querySelector('strong').textContent, phase === 12 ? 'Cluster 4' : 'Cluster 5');
      assert.equal(grid.querySelector('[data-cluster-id]').dataset.clusterId, building.id);
      assert.equal(grid.querySelectorAll('.cluster-capacity').length, 3);
      assert.equal(grid.querySelectorAll('[aria-label="Cluster construction"]').length, 1);
      assert.equal(h.window.document.querySelector('.neocloud'), null);
      h.api.tickConstruction(building.buildRemaining);
      h.api.renderClusterSection();
      assert.equal(grid.querySelector('[data-cluster-id]').dataset.clusterId, building.id);
      assert.equal(grid.querySelectorAll('.cluster-capacity').length, 4);
      assert.equal(grid.firstElementChild.classList.contains('planning-card'), true);
      h.api.openCluster();
      h.api.renderClusterSection();
      assert.equal(grid.firstElementChild.querySelector('strong').textContent, phase === 12 ? 'Cluster 5' : 'Cluster 6');
      assert.deepEqual([...grid.querySelectorAll('[data-cluster-id]')].map(card => card.dataset.clusterId), [...g.clusters].reverse().map(cluster => cluster.id));
      assert.deepEqual(g.clusters.slice(0, 3).map(cluster => cluster.id), originalOrder);
      assert.equal(h.api.validSave(g), true);
      const restored = harness(JSON.stringify(g));
      try {
        assert.deepEqual([...restored.window.document.querySelectorAll('[data-cluster-id]')].map(card => card.dataset.clusterId), [...g.clusters].reverse().map(cluster => cluster.id));
      } finally {
        restored.close();
      }
    } finally {
      h.close();
    }
  }
});

test('Phase 15 groups every cluster into permanent neoclouds of twenty-five', () => {
  const h = company(15, 250);
  try {
    const g = h.window.GAME.state;
    h.api.renderClusterSection();
    const document = h.window.document;
    assert.equal(document.querySelector('#cluster-heading').textContent, 'Neoclouds');
    assert.deepEqual([...document.querySelectorAll('.neocloud')].map(group => Number(group.dataset.neocloud)), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    assert.match(document.querySelector('[data-neocloud="11"]').textContent, /Neocloud 11.*C251.*Planning/);
    const last = g.clusters.at(-1);
    assert.equal(document.querySelector('[data-cluster-id="' + last.id + '"]').closest('.neocloud').dataset.neocloud, '10');
    assert.equal(document.querySelectorAll('[data-neocloud="10"] [data-cluster-id]').length, 25);
    assert.equal(document.querySelector('[data-neocloud="10"] [data-cluster-id] strong').textContent, 'C250');
    assert.match(document.querySelector('[data-neocloud="10"] .neocloud-summary').textContent, /C226–C250 · \$6,000\/s/);
    assert.equal(document.querySelectorAll('.cluster-capacity').length, 0);
    assert.equal(document.querySelectorAll('[data-cluster-id]').length, 250);
    h.api.openCluster();
    const next = g.clusters.at(-1);
    h.api.renderClusterSection();
    assert.equal(document.querySelector('[data-neocloud="11"] .network-grid').firstElementChild.querySelector('strong').textContent, 'C252');
    assert.equal(document.querySelector('[data-neocloud="11"] [data-cluster-id]').dataset.clusterId, next.id);
    h.api.tickConstruction(next.buildRemaining);
    h.api.renderClusterSection();
    assert.equal(document.querySelector('[data-neocloud="11"] [data-cluster-id]').dataset.clusterId, next.id);
    assert.equal(document.querySelector('[data-cluster-id="' + last.id + '"]').closest('.neocloud').dataset.neocloud, '10');
    assert.equal(document.querySelectorAll('[data-cluster-id]').length, 251);
    assert.equal(h.api.validSave(g), true);
    const restored = harness(JSON.stringify(g));
    try {
      assert.equal(restored.window.document.querySelector('[data-cluster-id="' + next.id + '"]').closest('.neocloud').dataset.neocloud, '11');
    } finally {
      restored.close();
    }
  } finally {
    h.close();
  }
});

test('neocloud boundaries retain both simultaneous builds and count only real output', () => {
  const h = company(15, 24);
  try {
    const g = h.window.GAME.state;
    g.clusters[0].tank = 0;
    h.api.openCluster();
    h.api.openCluster();
    h.api.renderClusterSection();
    const document = h.window.document;
    assert.equal(document.querySelectorAll('.neocloud.active').length, 2);
    assert.match(document.querySelector('[data-neocloud="1"] .neocloud-header').textContent, /24 online · 1 building/);
    assert.match(document.querySelector('[data-neocloud="1"] .neocloud-summary').textContent, /\$5,520\/s/);
    assert.match(document.querySelector('[data-neocloud="2"] .neocloud-header').textContent, /0 online · 1 building/);
    g.ceoMode = 'manage';
    g.clusters = g.clusters.filter(cluster => cluster !== g.clusters[1]);
    h.api.renderClusterSection();
    assert.equal(document.querySelector('.planning-card'), null);
    assert.equal(document.querySelector('[data-cluster-id="' + g.clusters.at(-1).id + '"]').closest('.neocloud').dataset.neocloud, '2');
    g.clusters = [];
    h.api.renderClusterSection();
    assert.equal(document.querySelectorAll('.neocloud').length, 0);
  } finally {
    h.close();
  }
});

test('investor talks wait for 500 completed clusters, charge $90k once and unlock Phase 16 on completion', () => {
  const h = company(15, 499);
  try {
    const g = h.window.GAME.state;
    g.cash = 90000;
    h.api.renderUpgradeSection();
    assert.equal(saleButton(h, 'retire_unlock'), null);
    h.api.purchaseUpgrade('retire_unlock');
    assert.equal(g.salePreparation.upgradeId, '');
    h.fullCluster();
    g.cash = 89999;
    h.api.purchaseUpgrade('retire_unlock');
    assert.equal(g.cash, 89999);
    g.cash++;
    h.api.renderUpgradeSection();
    assert.match(saleButton(h, 'retire_unlock').closest('.card').textContent, /Company size requirement met: 500 online/);
    assert.equal(saleButton(h, 'retire_unlock').textContent, '$90.0K');
    h.api.purchaseUpgrade('retire_unlock');
    assert.equal(g.cash, 0);
    assert.equal(g.phase, 15);
    assert.equal(g.salePreparation.remaining, 8);
    h.api.purchaseUpgrade('retire_unlock');
    h.api.purchaseUpgrade('sale_advisor');
    assert.equal(g.cash, 0);
    h.api.tickSalePreparation(4);
    h.api.renderUpgradeSection();
    assert.equal(saleButton(h, 'retire_unlock').textContent, 'In progress');
    assert.equal(saleButton(h, 'retire_unlock').disabled, true);
    assert.equal(h.window.document.querySelector('[aria-label="Sale preparation"]').getAttribute('aria-valuenow'), '50');
    assert.equal(saleButton(h, 'sale_advisor'), null);
    assert.equal(h.api.validSave(g), true);
    h.api.tickSalePreparation(4);
    h.dismiss();
    h.api.renderUpgradeSection();
    assert.equal(g.phase, 16);
    assert.equal(g.purchasedUpgrades.filter(id => id === 'retire_unlock').length, 1);
    assert.equal(g.salePreparation.upgradeId, '');
    assert.match(saleButton(h, 'sale_advisor').closest('.card').textContent, /The investors are interested/);
  } finally {
    h.close();
  }
});

test('sale preparation proceeds in order and survives reload without charging twice', () => {
  const h = company();
  try {
    const g = h.window.GAME.state;
    const ids = ['retire_unlock', 'sale_advisor', 'sale_buyout', 'sale_diligence', 'sale_terms'];
    let expectedCash = g.cash;
    for (const id of ids) {
      const upgrade = h.api.UPGRADES.find(item => item.id === id);
      h.api.renderUpgradeSection();
      assert.equal(h.window.document.querySelectorAll('.sale-card').length, 1);
      assert.equal(saleButton(h, id).disabled, false);
      h.api.purchaseUpgrade('fusion');
      assert.equal(g.retired, false);
      h.api.purchaseUpgrade(id);
      expectedCash -= upgrade.cost;
      assert.equal(g.cash, expectedCash);
      h.api.tickSalePreparation(upgrade.saleDuration / 2);
      assert.equal(h.api.validSave(g), true);
      const restored = harness(JSON.stringify(g));
      try {
        const state = restored.window.GAME.state;
        assert.equal(state.salePreparation.remaining, upgrade.saleDuration / 2);
        restored.api.applyOfflineProgress();
        assert.equal(state.salePreparation.remaining, upgrade.saleDuration / 2);
        restored.api.purchaseUpgrade(id);
        assert.equal(state.cash, expectedCash);
        restored.api.tickSalePreparation(upgrade.saleDuration / 2);
        assert.ok(state.purchasedUpgrades.includes(id));
        assert.equal(restored.api.validSave(state), true);
      } finally {
        restored.close();
      }
      h.api.tickSalePreparation(upgrade.saleDuration / 2);
      h.dismiss();
      assert.ok(g.purchasedUpgrades.includes(id));
    }
    h.api.renderUpgradeSection();
    assert.match(saleButton(h, 'fusion').closest('.card').textContent, /Step 6 of 6/);
    assert.equal(h.api.canSellCompany(), true);
    assert.equal(saleButton(h, 'fusion').disabled, false);
  } finally {
    h.close();
  }
});

test('sale timers pause with dialogs and offline gaps and resume with the game tick', () => {
  const h = company();
  try {
    const g = h.window.GAME.state;
    g.ceoMode = 'manage';
    h.api.purchaseUpgrade('retire_unlock');
    h.api.showPopup('Pause', 'Read this first.');
    h.advance(500);
    h.api.tick();
    assert.equal(g.salePreparation.remaining, 8);
    h.dismiss();
    h.advance(1000);
    h.api.tick();
    assert.equal(g.salePreparation.remaining, 7);
    h.advance(60000);
    h.api.tick();
    assert.equal(g.salePreparation.remaining, 7);
    g.retired = true;
    h.api.tickSalePreparation(20);
    assert.equal(g.salePreparation.remaining, 7);
    g.retired = false;
    h.advance(1000);
    h.api.tick();
    assert.equal(g.salePreparation.remaining, 6);
  } finally {
    h.close();
  }
});

test('save format 17 rejects invalid sale timers and preserves older saves for explicit reset', () => {
  const h = company();
  try {
    const g = h.window.GAME.state;
    assert.equal(g.saveVersion, 17);
    assert.equal(h.api.validSave(g), true);
    for (const preparation of [
      { upgradeId: 'missing', remaining: 1 },
      { upgradeId: 'retire_unlock', remaining: 0 },
      { upgradeId: 'retire_unlock', remaining: 9 },
      { upgradeId: 'retire_unlock', remaining: -1 },
      { upgradeId: '', remaining: 1 },
      { upgradeId: 'sale_terms', remaining: 1 },
    ]) assert.equal(h.api.validSave({...g, salePreparation: preparation}), false);
    h.api.purchaseUpgrade('retire_unlock');
    assert.equal(h.api.validSave(g), true);
    assert.equal(h.api.validSave({...g, retired: true}), false);
    assert.equal(h.api.validSave({...g, phase: 16}), false);
    assert.equal(h.api.validSave({...g, purchasedUpgrades: [...g.purchasedUpgrades, 'retire_unlock']}), false);
    h.api.tickSalePreparation(8);
    assert.equal(h.api.validSave({...g, salePreparation: {upgradeId: 'sale_terms', remaining: 1}}), false);
    const raw = JSON.stringify({...g, saveVersion: 16});
    const restored = harness(raw);
    try {
      assert.equal(restored.window.GAME.state.phase, 1);
      assert.equal(restored.window.localStorage.getItem('ai_empire_save'), raw);
      assert.equal(restored.api.save(), false);
    } finally {
      restored.close();
    }
    g.clusters[0].name = 'Unknown';
    assert.equal(h.api.validSave(g), false);
  } finally {
    h.close();
  }
});

test('sale readiness shows the actual financial and operating blockers', () => {
  const h = company(16);
  try {
    const g = h.window.GAME.state;
    h.prepareUpgrade('fusion');
    g.cash = 4999999999;
    g.techDebt = 10;
    g.incidents = [{resolved: false}];
    for (const cluster of g.clusters) cluster.tank = 0;
    h.api.renderUpgradeSection();
    assert.equal(saleButton(h, 'fusion').disabled, true);
    assert.equal(h.window.document.querySelectorAll('.sale-readiness .waiting').length, 4);
    g.cash++;
    g.techDebt = 9;
    g.incidents = [];
    for (const cluster of g.clusters) cluster.tank = 4000;
    h.api.renderUpgradeSection();
    assert.equal(h.window.document.querySelectorAll('.sale-readiness .ready').length, 4);
    assert.equal(saleButton(h, 'fusion').disabled, false);
  } finally {
    h.close();
  }
});

test('a completed sale freezes the company, fades to black and reveals retirement with its music', () => {
  const h = company(16, 100, { reducedMotion: false });
  try {
    const g = h.window.GAME.state;
    g.phase = 6;
    h.api.unlockMusicPlayback();
    g.phase = 16;
    h.prepareUpgrade('fusion');
    h.api.renderAll();
    const companyHtml = h.window.document.querySelector('#game-container').innerHTML;
    h.api.purchaseUpgrade('fusion');
    const document = h.window.document;
    const state = JSON.stringify(g);
    assert.equal(g.retired, true);
    assert.equal(document.querySelector('#game-container').hidden, false);
    assert.equal(document.querySelector('#game-container').inert, true);
    assert.equal(document.querySelector('#ending-overlay').hidden, true);
    assert.equal(document.querySelector('#sale-transition').hidden, false);
    assert.equal(document.querySelector('#game-container').innerHTML, companyHtml);
    h.advance(500);
    h.api.tick();
    h.api.renderAll();
    assert.equal(JSON.stringify(g), state);
    assert.equal(document.querySelector('#game-container').innerHTML, companyHtml);
    assert.equal(Number(document.querySelector('#sale-transition').style.opacity), 0.5);
    const base = h.audioPlayers.find(player => player.src === 'soundtrack-loop.mp3');
    assert.equal(base.volume, 0.125);
    h.advance(600);
    h.api.renderAll();
    assert.equal(document.querySelector('#game-container').hidden, true);
    assert.equal(document.querySelector('#ending-overlay').hidden, true);
    assert.equal(Number(document.querySelector('#sale-transition').style.opacity), 1);
    assert.equal(base.volume, 0);
    h.advance(900);
    h.api.renderAll();
    assert.equal(document.querySelector('#ending-overlay').hidden, false);
    assert.equal(Number(document.querySelector('#sale-transition').style.opacity), 0.5);
    assert.equal(base.volume, 0.125);
    assert.equal(document.activeElement.id, 'btn-ending-restart');
    h.advance(600);
    h.api.renderAll();
    assert.equal(document.querySelector('#sale-transition').hidden, true);
    assert.equal(base.volume, 0.25);
    assert.ok(h.audioPlayers.filter(player => player !== base).every(player => player.paused));
    assert.equal(JSON.stringify(g), state);
    const restored = harness(JSON.stringify(g), { reducedMotion: false });
    try {
      assert.equal(restored.window.GAME.state.retired, true);
      restored.advance(3000);
      restored.api.renderAll();
      assert.equal(restored.window.document.querySelector('#sale-transition').hidden, true);
    } finally {
      restored.close();
    }
  } finally {
    h.close();
  }
});
