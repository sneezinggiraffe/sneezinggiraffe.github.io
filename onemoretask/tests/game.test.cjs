const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');
const { play } = require('./simulate.cjs');

function provisioningFixture(phase, capacity = 2) {
  const h = harness();
  const g = h.fresh(phase);
  g.cash = 1e12;
  g.tokens = 1e9;
  g.aiWorkerShutdown = true;
  g.incidentsExplained = true;
  g.lastTaskSpawn = h.window.Date.now() + 1e9;
  g.totalTasksDone = 2e6;
  g.ceoMode = phase >= 11 ? 'scale' : 'manage';
  g.purchasedUpgrades.push('ceo_batch');
  if (capacity === 4) g.purchasedUpgrades.push('ceo_quad_batch');
  if (phase >= 11) {
    g.purchasedUpgrades.push('ceo_full_fit', 'ceo_parallel_clusters', 'ceo_fast_builds');
    if (phase >= 12) g.purchasedUpgrades.push('ceo_continuous');
    h.fullCluster();
  } else {
    for (let index = 0; index < 2; index++) {
      const cluster = h.api.addClusterWithNextName();
      cluster.managerAssigned = true;
      cluster.tokenManagerAssigned = true;
    }
  }
  h.api.checkMilestones();
  h.dismiss();
  h.api.tickAiCeo();
  return h;
}

function provisioningTick(h, step) {
  h.advance(100);
  h.api.tick();
  if (step % 2 === 0) h.api.renderAll();
}

for (const capacity of [2, 4]) {
  test(`${capacity} installation slots stay staggered at 100ms ticks and 200ms renders`, () => {
    const h = provisioningFixture(10, capacity);
    try {
      const g = h.window.GAME.state;
      const first = g.agents.slice();
      assert.equal(first.length, capacity);
      assert.equal(first[0].provisionRemaining, 4);
      for (let index = 1; index < first.length; index++) {
        const gap = first[index].provisionRemaining - first[index - 1].provisionRemaining;
        assert.ok(gap >= 0.3 && gap <= 0.4);
      }
      const completed = new Map();
      let independentlyRefilled = false;
      for (let step = 1; step <= 200; step++) {
        provisioningTick(h, step);
        const installing = h.api.provisioningAgents();
        assert.ok(installing.length <= capacity);
        if (first[0].status !== 'provisioning' && first[1].status === 'provisioning') {
          assert.equal(installing.length, capacity);
          assert.ok(g.agents.length > capacity);
          independentlyRefilled = true;
        }
        if (step === 14) {
          const bars = [...h.window.document.querySelectorAll('.capacity-slot.provisioning')];
          assert.equal(bars.length, capacity);
          assert.equal(new Set(bars.map(bar => bar.getAttribute('aria-valuenow'))).size, capacity);
        }
        for (const agent of g.agents) {
          if (agent.status !== 'provisioning' && !completed.has(agent.id)) completed.set(agent.id, Math.ceil(step / 2) * 200);
        }
      }
      assert.equal(independentlyRefilled, true);
      assert.ok(completed.size >= capacity * 3);
      assert.equal(new Set(completed.values()).size, completed.size);
      assert.ok(g.clusters[1].workerAgentIds.length > 0);
      assert.equal(h.api.validSave(g), true);
    } finally {
      h.close();
    }
  });
}

for (const phase of [10, 11, 12]) {
  test(`queued starts and independent refills survive save/reload in Phase ${phase}`, () => {
    const h = provisioningFixture(phase, 4);
    let restored;
    try {
      provisioningTick(h, 1);
      provisioningTick(h, 2);
      const g = h.window.GAME.state;
      const jobs = phase === 10 ? g.agents.slice() : g.clusters.slice(1);
      const remaining = phase === 10 ? 'provisionRemaining' : 'buildRemaining';
      const duration = phase === 10 ? 'provisionDuration' : 'buildDuration';
      assert.ok(jobs.some(job => job[remaining] > job[duration]));
      assert.equal(h.api.save(), true);
      restored = harness(h.window.localStorage.getItem('ai_empire_save'), {seed: 8675309});
      const loaded = restored.window.GAME.state;
      const loadedJobs = jobs.map(job => (phase === 10 ? loaded.agents : loaded.clusters).find(item => item.id === job.id));
      assert.deepEqual(loadedJobs.map(job => job[remaining]), jobs.map(job => job[remaining]));
      const completionFrames = [new Map(), new Map()];
      let independentlyRefilled = false;
      for (let step = 1; step <= 100; step++) {
        for (const [index, engine, tracked] of [[0, h, jobs], [1, restored, loadedJobs]]) {
          provisioningTick(engine, step);
          const state = engine.window.GAME.state;
          for (const job of tracked) {
            if (job[remaining] === 0 && !completionFrames[index].has(job.id)) completionFrames[index].set(job.id, Math.ceil(step / 2) * 200);
          }
          if (phase >= 11) {
            assert.ok(state.clusters.filter(cluster => cluster.buildRemaining > 0).length <= 2);
            if (tracked[0].buildRemaining === 0 && tracked[1].buildRemaining > 0) {
              assert.ok(state.clusters.length > 3);
              independentlyRefilled = true;
            }
          }
          if (step % 2 === 0) {
            const bars = [...engine.window.document.querySelectorAll('[role="progressbar"]')];
            assert.ok(bars.every(bar => Number(bar.getAttribute('aria-valuenow')) >= 0));
          }
        }
      }
      assert.deepEqual([...completionFrames[1]], [...completionFrames[0]]);
      assert.equal(completionFrames[0].size, jobs.length);
      assert.equal(new Set(completionFrames[0].values()).size, jobs.length);
      if (phase >= 11) assert.equal(independentlyRefilled, true);
      assert.equal(h.api.validSave(loaded), true);
    } finally {
      if (restored) restored.close();
      h.close();
    }
  });
}

test('speed upgrades retain queued start separation and funding pauses refills', () => {
  const h = provisioningFixture(10, 4);
  try {
    const g = h.window.GAME.state;
    const queued = g.agents[1];
    const delay = queued.provisionRemaining - queued.provisionDuration;
    h.prepareUpgrade('ceo_recruitment');
    h.api.purchaseUpgrade('ceo_recruitment');
    assert.equal(queued.provisionDuration, 2);
    assert.equal(queued.provisionRemaining - queued.provisionDuration, delay);
    h.prepareUpgrade('ceo_deploy_speed');
    h.api.purchaseUpgrade('ceo_deploy_speed');
    assert.equal(queued.provisionDuration, 2 / 1.5);
    assert.equal(queued.provisionRemaining - queued.provisionDuration, delay);
    g.cash = 0;
    h.api.tickConstruction(10);
    h.api.tickAiCeo();
    assert.equal(g.agents.length, 4);
  } finally {
    h.close();
  }
});

test('Ralph-loops and Scale Mode advance without modals while the operating model keeps concise copy', () => {
  const h = harness();
  try {
    for (const [id, phase] of [['ops_flywheel', 7], ['server_1', 10], ['autonomous_nodes', 11]]) {
      const g = h.fresh(phase);
      g.cash = 1e12;
      g.totalTasksDone = 2e6;
      h.prepareUpgrade(id);
      if (id === 'server_1') for (let index = 0; index < 5; index++) h.fullCluster();
      h.api.checkMilestones();
      h.dismiss();
      h.api.purchaseUpgrade(id);
      assert.equal(g.phase, phase + 1);
      assert.equal(h.api.queue().length, id === 'autonomous_nodes' ? 1 : 0);
      if (id === 'ops_flywheel') {
        const upgrade = h.api.UPGRADES.find(item => item.id === id);
        assert.equal(upgrade.name, 'Ralph-loops');
        assert.equal(upgrade.desc, 'Agents work for longer and check their work.');
      }
      if (id === 'autonomous_nodes') {
        assert.match(h.window.document.querySelector('#milestone-popup-msg').textContent, /Your CEO now operates the nodes/);
        assert.doesNotMatch(h.window.document.querySelector('#milestone-popup-msg').textContent, /100 managed nodes/);
      }
      assert.equal(h.api.validSave(g), true);
    }
  } finally {
    h.close();
  }
});

test('Phase 8 additions apply paid improvements and gate acquisition until both are purchased', () => {
  const h = harness();
  try {
    const g = h.fresh(8);
    g.cash = 1e7;
    g.totalTasksDone = 1e6;
    h.prepareUpgrade('project_playbooks');
    const acquisition = h.api.UPGRADES.find(item => item.id === 'acquire_micro_agency');
    assert.equal(h.api.upgradeVisible(acquisition), false);
    const speed = g.agentSpeedMult;
    h.api.purchaseUpgrade('project_playbooks');
    assert.equal(g.cash, 1e7 - 750000);
    assert.equal(g.agentSpeedMult, speed * 1.25);
    assert.equal(h.api.upgradeVisible(acquisition), false);
    const pay = g.payMult;
    const demand = g.taskSpawnMult;
    h.api.purchaseUpgrade('account_expansion');
    assert.equal(g.cash, 1e7 - 2000000);
    assert.equal(g.payMult, pay * 1.3);
    assert.equal(g.taskSpawnMult, demand * 1.2);
    assert.equal(h.api.upgradeVisible(acquisition), true);
    h.api.purchaseUpgrade('acquire_micro_agency');
    assert.equal(g.phase, 9);
  } finally {
    h.close();
  }
});

test('Phase 9 milestones spread purchases across millions of tasks and require the new savings goals', () => {
  const h = harness();
  try {
    for (const [id, tasks, cost, savings] of [
      ['code_agents', 1050000, 1500000],
      ['cluster_capacity_2', 1150000, 2500000],
      ['cluster_capacity_3', 1500000, 12000000, 9000000],
      ['testing', 1750000, 3500000],
      ['code_review', 2000000, 5000000],
      ['deploy', 2250000, 6500000],
      ['ceo_readiness', 2500000, 35000000, 30000000],
    ]) {
      const g = h.fresh(9);
      g.uiRevealed.upgrades = true;
      h.prepareUpgrade(id);
      const count = id === 'ceo_readiness' ? 3 : id === 'cluster_capacity_3' ? 2 : 1;
      for (let index = 0; index < count; index++) h.fullCluster();
      const upgrade = h.api.UPGRADES.find(item => item.id === id);
      g.totalTasksDone = tasks - 1;
      g.cash = cost;
      assert.equal(h.api.upgradeVisible(upgrade), false, id);
      h.api.purchaseUpgrade(id);
      assert.equal(g.cash, cost);
      assert.equal(g.purchasedUpgrades.includes(id), false);
      g.totalTasksDone = tasks;
      g.cash = savings ?? cost - 1;
      assert.equal(h.api.upgradeVisible(upgrade), true, id);
      h.api.renderUpgradeSection();
      const button = h.window.document.querySelector('[onclick="GAME.buy(\'' + id + '\')"]');
      assert.equal(button.disabled, true, id);
      assert.equal(button.textContent, '$' + (cost / 1e6).toFixed(2) + 'M');
      h.api.purchaseUpgrade(id);
      assert.equal(g.cash, savings ?? cost - 1);
      assert.equal(g.purchasedUpgrades.includes(id), false);
      g.cash = cost;
      h.api.renderUpgradeSection();
      assert.equal(button.disabled, false, id);
      h.api.purchaseUpgrade(id);
      assert.equal(g.cash, 0, id);
      assert.equal(g.purchasedUpgrades.includes(id), true);
      assert.equal(g.phase, id === 'ceo_readiness' ? 10 : 9);
    }
  } finally {
    h.close();
  }
});

test('a $40M Phase 10 reserve buys the CEO and Pipeline but needs more saving for network density', () => {
  const h = harness();
  try {
    const g = h.fresh(10);
    g.cash = 40000000;
    g.totalTasksDone = 2500000;
    g.uiRevealed.upgrades = true;
    h.prepareUpgrade('ai_ceo');
    for (let index = 0; index < 3; index++) h.fullCluster();
    h.api.purchaseUpgrade('ai_ceo');
    h.api.purchaseUpgrade('ceo_recruitment');
    assert.equal(g.ceoMode, 'manage');
    assert.equal(g.purchasedUpgrades.includes('ceo_recruitment'), true);
    assert.equal(g.cash, 14000000);
    h.api.renderUpgradeSection();
    const button = h.window.document.querySelector('[onclick="GAME.buy(\'network_density\')"]');
    assert.equal(button.textContent, '$30.00M');
    assert.equal(button.disabled, true);
    h.api.purchaseUpgrade('network_density');
    assert.equal(g.cash, 14000000);
    assert.ok(g.clusters.every(cluster => cluster.workerSlotsMax === 8));
    g.cash += 16000000;
    h.api.purchaseUpgrade('network_density');
    assert.equal(g.cash, 0);
    assert.ok(g.clusters.every(cluster => cluster.workerSlotsMax === 9));
  } finally {
    h.close();
  }
});

test('node requirements still gate purchases without appearing in upgrade descriptions', () => {
  const h = harness();
  try {
    for (const id of ['replication', 'global_network', 'fusion']) {
      const upgrade = h.api.UPGRADES.find(item => item.id === id);
      const g = h.fresh(upgrade.phase);
      g.cash = 1e12;
      g.totalTasksDone = 1e9;
      g.uiRevealed.upgrades = true;
      h.prepareUpgrade(id);
      const target = h.api.nodeRequirement(upgrade);
      for (let index = 0; index < target - 1; index++) h.fullCluster();
      if (id === 'replication') h.api.addClusterWithNextName();
      h.api.renderUpgradeSection();
      const button = h.window.document.querySelector('[onclick="GAME.buy(\'' + id + '\')"]');
      assert.equal(button.disabled, true);
      assert.equal(button.closest('.card').querySelector('.desc').textContent, upgrade.desc);
      assert.doesNotMatch(button.closest('.card').querySelector('.desc').textContent, /\(\d+ nodes\)/);
    }
    const continuous = h.api.UPGRADES.find(item => item.id === 'ceo_continuous');
    assert.equal(continuous.desc, 'Improve deployment speed by 50%.');
  } finally {
    h.close();
  }
});

test('forming Cluster 1 gives existing agents the same short names in cards and running tasks', () => {
  const h = harness();
  try {
    const g = h.fresh(8);
    g.cash = 1e9;
    g.totalTasksDone = 1e6;
    h.prepareUpgrade('acquire_micro_agency');
    const agent = h.worker('researcher');
    agent.name = 'AI 2000 Pro';
    agent.tokenCost = 3;
    const task = h.task();
    task.status = 'agent';
    task.assignedAgent = agent.id;
    agent.status = 'working';
    agent.currentTask = task.id;
    h.api.purchaseUpgrade('acquire_micro_agency');
    assert.equal(g.phase, 9);
    assert.match(agent.name, /^[0-9a-f]{4}$/);
    assert.equal(h.api.workerTokenCost(agent), 1);
    g.uiRevealed.clusters = true;
    h.api.renderClusterSection();
    h.api.renderTaskQueue();
    assert.equal(h.window.document.querySelector('.capacity-slot.filled').textContent, agent.name);
    assert.equal(h.window.document.querySelector('#task-list .task-action-btn').textContent, agent.name);
    assert.equal(h.api.validSave(g), true);
  } finally {
    h.close();
  }
});

test('short hexadecimal agent IDs are unique and match task labels', () => {
  const h = harness();
  try {
    const g = h.fresh(9);
    const names = new Set();
    for (let index = 0; index < 512; index++) {
      const agent = h.worker();
      agent.name = h.api.newClusterAgentName();
      assert.match(agent.name, /^[0-9a-f]{4}$/);
      assert.equal(names.has(agent.name), false);
      names.add(agent.name);
    }
    assert.equal(names.has(h.api.newClusterAgentName()), false);
    const agent = g.agents[0];
    const task = h.task();
    task.status = 'agent';
    task.assignedAgent = agent.id;
    task.workDone = task.workRequired / 2;
    h.api.renderTaskQueue();
    const button = h.window.document.querySelector('#task-list .task-action-btn');
    assert.equal(button.textContent, agent.name);
    assert.doesNotMatch(button.textContent, /%/);
    task.status = 'ai';
    h.api.renderTaskQueue();
    assert.equal(h.window.document.querySelector('#task-list .task-action-btn').textContent, 'AI 2000 Basic');
  } finally {
    h.close();
  }
});

test('manual plus buttons buy only their own next slot and cannot fill a cluster from its last slot', () => {
  const h = harness();
  try {
    const g = h.fresh(9);
    g.cash = 1e6;
    g.uiRevealed.clusters = true;
    h.api.openCluster();
    const cluster = g.clusters[0];
    h.api.tickConstruction(12.1);
    h.api.renderClusterSection();
    const slots = [...h.window.document.querySelectorAll('.provision-agent')];
    assert.equal(slots.length, 8);
    assert.ok(slots.every(slot => slot.textContent === '+'));
    assert.equal(slots[0].disabled, false);
    assert.ok(slots.slice(1).every(slot => slot.disabled));
    const before = g.cash;
    h.window.GAME.buyClusterWorker(cluster.id, 7);
    h.window.GAME.buyClusterWorker('missing', 0);
    assert.equal(cluster.workerAgentIds.length, 0);
    for (let index = 0; index < 8; index++) {
      h.window.GAME.buyClusterWorker(cluster.id, index);
      h.window.GAME.buyClusterWorker(cluster.id, index);
      assert.equal(cluster.workerAgentIds.length, index + 1);
    }
    assert.equal(g.cash, before - 8 * 2500);
    assert.equal(new Set(g.agents.map(agent => agent.name)).size, 8);
    h.api.tickConstruction(12);
    h.api.renderClusterSection();
    assert.deepEqual([...h.window.document.querySelectorAll('.capacity-slot')].map(slot => slot.textContent), Array.from(g.agents, agent => agent.name));
  } finally {
    h.close();
  }
});

test('cluster builds keep upgrades visible and collapse task detail immediately when Cluster 2 is ordered', () => {
  const h = harness();
  try {
    const g = h.fresh(9);
    g.cash = 1e9;
    g.totalTasksDone = 1.5e6;
    g.uiRevealed.clusters = true;
    g.uiRevealed.upgrades = true;
    g.uiRevealed.taskQueue = true;
    h.fullCluster();
    h.prepareUpgrade('cluster_capacity_2');
    h.api.purchaseUpgrade('cluster_capacity_2');
    h.api.renderWorkStream();
    assert.equal(h.window.document.querySelector('#task-list').hidden, false);
    assert.equal(h.api.canManuallyProvisionCluster(), true);
    h.window.GAME.openCluster();
    h.api.renderAll();
    assert.equal(h.window.document.querySelector('#task-list').hidden, true);
    const permit = h.window.document.querySelector('[onclick="GAME.buy(\'cluster_capacity_3\')"]');
    assert.ok(permit);
    assert.equal(permit.disabled, true);
    h.api.purchaseUpgrade('cluster_capacity_3');
    assert.equal(h.api.clusterCapacity(), 2);
    assert.equal(h.api.canManuallyProvisionCluster(), false);
    h.api.tickConstruction(12.1);
    for (let index = 0; index < 8; index++) h.api.buyClusterWorker(g.clusters[1].id, index);
    h.api.tickConstruction(12);
    h.api.renderUpgradeSection();
    assert.equal(permit.disabled, false);
    h.api.toggleDeliveryTasks();
    assert.equal(h.window.document.querySelector('#task-list').hidden, false);
  } finally {
    h.close();
  }
});

test('provisioning speed upgrades shorten builds and do not overlap single-agent installations', () => {
  const h = harness();
  try {
    const g = h.fresh(10);
    g.cash = 1e9;
    g.totalTasksDone = 2e6;
    g.ceoMode = 'manage';
    h.prepareUpgrade('ceo_recruitment');
    const cluster = h.api.addClusterWithNextName();
    cluster.managerAssigned = true;
    cluster.tokenManagerAssigned = true;
    h.api.tickAiCeo();
    const first = g.agents[0];
    const firstDuration = first.provisionDuration;
    assert.ok(firstDuration >= 4 && firstDuration <= 4.1);
    h.api.purchaseUpgrade('ceo_recruitment');
    assert.equal(first.provisionDuration, firstDuration / 2);
    assert.equal(first.provisionRemaining, firstDuration / 2);
    h.advance(2500);
    h.api.tickAiCeo();
    assert.equal(g.agents.length, 1);
    h.api.tickConstruction(2.1);
    h.advance(2500);
    h.api.tickAiCeo();
    assert.equal(g.agents.length, 2);
    const secondDuration = g.agents[1].provisionDuration;
    assert.ok(secondDuration >= 2 && secondDuration <= 2.1);
    h.prepareUpgrade('ceo_deploy_speed');
    h.api.purchaseUpgrade('ceo_deploy_speed');
    assert.equal(first.status, 'idle');
    assert.equal(g.agents[1].provisionDuration, secondDuration / 1.5);
    assert.equal(h.api.validSave(g), true);
  } finally {
    h.close();
  }
});

test('agent installation capacity stays global across clusters and refills independently', () => {
  const h = harness();
  try {
    const g = h.fresh(10);
    g.ceoMode = 'manage';
    g.cash = 1e9;
    const first = h.fullCluster();
    const installing = g.agents.at(-1);
    installing.status = 'provisioning';
    installing.provisionDuration = 4;
    installing.provisionRemaining = 4;
    const second = h.api.addClusterWithNextName();
    second.managerAssigned = true;
    second.tokenManagerAssigned = true;
    h.api.tickAiCeo();
    assert.equal(second.workerAgentIds.length, 0);
    g.purchasedUpgrades.push('ceo_parallel_clusters');
    h.advance(5000);
    h.api.tickAiCeo();
    assert.equal(second.workerAgentIds.length, 0);
    h.api.tickConstruction(4);
    h.api.tickAiCeo();
    assert.equal(second.workerAgentIds.length, 1);
    h.advance(5000);
    h.api.tickAiCeo();
    assert.equal(second.workerAgentIds.length, 1);
    h.api.tickConstruction(12);
    h.advance(5000);
    h.api.tickAiCeo();
    assert.equal(first.workerAgentIds.length, 8);
    assert.equal(second.workerAgentIds.length, 2);
  } finally {
    h.close();
  }
});

test('planning waits for staffing before autonomy and stays visible from Phase 12', () => {
  const h = harness();
  try {
    for (const clusterId of ['a', 'b', 'c', 'd']) {
      const g = h.fresh(10);
      g.ceoMode = 'scale';
      const cluster = h.fullCluster();
      cluster.id = clusterId;
      const threshold = 9 + parseInt(clusterId, 36) % 4;
      for (let index = threshold - 1; index < g.agents.length; index++) {
        g.agents[index].status = 'provisioning';
        g.agents[index].provisionDuration = 1;
        g.agents[index].provisionRemaining = 1;
      }
      assert.equal(h.api.canPlanNextCluster(), false);
      g.agents[threshold - 1].status = 'idle';
      assert.equal(h.api.canPlanNextCluster(), true);
      const restored = harness(JSON.stringify(g));
      try {
        assert.equal(restored.api.canPlanNextCluster(), true);
      } finally {
        restored.close();
      }
      g.phase = 12;
      cluster.workerAgentIds = [];
      g.agents = [];
      cluster.workforce = threshold - 1;
      assert.equal(h.api.canPlanNextCluster(), true);
      cluster.workforce++;
      assert.equal(h.api.canPlanNextCluster(), true);
      cluster.buildDuration = 1;
      cluster.buildRemaining = 0.5;
      assert.equal(h.api.canPlanNextCluster(), true);
    }
  } finally {
    h.close();
  }
});

test('funding excludes an exit reserve and expansion resumes beyond Cluster 331 without a cap', () => {
  const h = harness();
  try {
    const g = h.fresh(15);
    g.ceoMode = 'scale';
    g.uiRevealed.clusters = true;
    h.fullCluster();
    g.clustersProvisioned = 331;
    const target = h.api.expansionFundingTarget();
    assert.equal(target, h.api.provisionCost() * 2);
    g.cash = target - 1;
    h.api.tickAiCeo();
    assert.equal(g.clusters.length, 1);
    h.api.renderClusterSection();
    assert.match(h.window.document.querySelector('.planning-card').textContent, /Securing \$[\d.]+M funding/);
    assert.doesNotMatch(h.window.document.querySelector('.planning-card').textContent, /kept for your exit/);
    g.cash = target;
    h.advance(1000);
    h.api.tickAiCeo();
    assert.equal(g.clusters.length, 2);
    assert.equal(g.clusters[1].name, 'Cluster 332');
  } finally {
    h.close();
  }
});

test('the Phase 8 entry cheat leaves growth upgrades to play through and late infrastructure has meaningful prices', () => {
  const h = harness();
  try {
    h.window.chStart8();
    const g = h.window.GAME.state;
    assert.equal(g.phase, 8);
    assert.equal(g.totalTasksDone, 150000);
    assert.equal(g.purchasedUpgrades.includes('growth_marketing'), false);
    assert.equal(g.purchasedUpgrades.includes('management'), false);
    assert.equal(g.purchasedUpgrades.includes('enterprise_pipeline'), false);
    assert.equal(h.api.validSave(g), true);
    g.cash = 1e9;
    for (const [tasks, id] of [[175000, 'growth_marketing'], [350000, 'management'], [600000, 'enterprise_pipeline'], [720000, 'project_playbooks'], [860000, 'account_expansion']]) {
      g.totalTasksDone = tasks - 1;
      const upgrade = h.api.UPGRADES.find(item => item.id === id);
      assert.equal(h.api.upgradeVisible(upgrade), false);
      g.totalTasksDone = tasks;
      assert.equal(h.api.upgradeVisible(upgrade), true);
      h.api.purchaseUpgrade(id);
      assert.ok(g.purchasedUpgrades.includes(id));
    }
    assert.equal(h.api.UPGRADES.find(upgrade => upgrade.id === 'ceo_full_fit').cost, 400000000);
    const operatingModel = h.api.UPGRADES.find(upgrade => upgrade.id === 'autonomous_nodes');
    assert.equal(operatingModel.cost, 760000000);
    assert.equal(h.api.UPGRADES.find(upgrade => upgrade.id === 'replication').cost, 1500000000);
    assert.equal(h.api.UPGRADES.find(upgrade => upgrade.id === 'global_network').cost, 2000000000);
    assert.equal(h.api.nodeRequirement(operatingModel), 0);
  } finally {
    h.close();
  }
});

test('task headings use comma separators in the queue and compact delivery views', () => {
  const h = harness();
  try {
    for (const phase of [3, 10, 14]) {
      const g = h.fresh(phase);
      g.uiRevealed.taskQueue = true;
      g.totalTasksDone = 1234567890;
      h.api.renderWorkStream();
      assert.equal(h.window.document.querySelector('#tasks-complete-count').textContent, '1,234,567,890');
    }
  } finally {
    h.close();
  }
});

test('cluster capacity advances from eight to nine to sixteen only after the CEO takes over', () => {
  const h = harness();
  try {
    const g = h.fresh(9);
    g.cash = 1e9;
    g.totalTasksDone = 1.5e6;
    g.uiRevealed.clusters = true;
    const first = h.fullCluster();
    h.prepareUpgrade('code_agents');
    h.api.purchaseUpgrade('code_agents');
    h.api.purchaseUpgrade('network_density');
    assert.equal(first.workerSlotsMax, 8);
    h.api.purchaseUpgrade('cluster_capacity_2');
    h.api.openCluster();
    const second = g.clusters[1];
    assert.equal(second.workerSlotsMax, 8);
    h.api.tickConstruction(12.1);
    for (let index = 0; index < 8; index++) h.api.buyClusterWorker(second.id, index);
    h.api.tickConstruction(12);
    g.phase = 10;
    h.prepareUpgrade('ai_ceo');
    h.api.purchaseUpgrade('ai_ceo');
    assert.ok(g.clusters.every(cluster => cluster.workerSlotsMax === 8));
    const before = g.cash;
    h.api.purchaseUpgrade('network_density');
    assert.equal(g.cash, before - 30000000);
    assert.ok(g.clusters.every(cluster => cluster.workerSlotsMax === 9));
    h.api.renderClusterSection();
    const card = h.window.document.querySelector('.cluster-card');
    assert.equal(card.querySelector('.cluster-capacity').style.getPropertyValue('--cluster-columns'), '3');
    assert.equal(card.querySelectorAll('.capacity-slot').length, 9);
    assert.equal(card.querySelector('.capacity-slot.empty').textContent, '+');
    h.api.purchaseUpgrade('ceo_deploy_speed');
    h.api.purchaseUpgrade('cluster_capacity_16');
    assert.ok(g.clusters.every(cluster => cluster.workerSlotsMax === 16));
    assert.equal(h.api.createCluster('Next').workerSlotsMax, 16);
    h.api.renderClusterSection();
    assert.equal(card.querySelector('.cluster-capacity').style.getPropertyValue('--cluster-columns'), '4');
    assert.equal(card.querySelectorAll('.capacity-slot').length, 16);
    assert.equal(h.api.validSave(g), true);
    const restored = harness(JSON.stringify(g));
    try {
      assert.equal(restored.window.GAME.state.clusters[0].workerSlotsMax, 16);
    } finally {
      restored.close();
    }
  } finally {
    h.close();
  }
});

function scenario(name, run) {
  test(name, () => { const h = harness(); try { run(h); } finally { h.close(); } });
}

test('the quiet Phase 5 synth waits for interaction, fades in and survives the drum change', () => {
  const intervals = new Map();
  let nextInterval = 0;
  const h = harness(undefined, { before(window) {
    window.setInterval = (fn, delay) => { const id = ++nextInterval; intervals.set(id, { fn, delay }); return id; };
    window.clearInterval = (id) => intervals.delete(id);
  } });
  const advanceFades = (ms) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      for (const [id, timer] of [...intervals]) if (timer.delay === 50 && intervals.has(id)) timer.fn();
    }
  };
  try {
    const g = h.fresh(5);
    g.totalTasksDone = 12;
    h.api.syncMusicPlayback();
    assert.equal(h.audioPlayers.length, 2);
    assert.ok(h.audioPlayers.every(player => player.paused));
    g.phase = 4;
    h.api.unlockMusicPlayback();
    assert.equal(h.audioPlayers.length, 2);
    g.cash = 12000;
    g.totalTasksDone = 1150;
    h.prepareUpgrade('tool_use');
    h.api.purchaseUpgrade('tool_use');
    assert.equal(g.phase, 5);
    const synth = h.audioPlayers.find(player => player.src === 'synth_d4_loop.mp3');
    assert.ok(synth);
    assert.equal(synth.preload, 'auto');
    assert.equal(synth.loop, true);
    assert.equal(synth.paused, false);
    assert.equal(synth.volume, 0);
    const timerCount = nextInterval;
    h.api.syncMusicPlayback();
    assert.equal(nextInterval, timerCount);
    advanceFades(4000);
    assert.equal(synth.volume, 0.03645);
    h.api.syncMusicPlayback();
    assert.equal(synth.volume, 0.03645);
    advanceFades(4000);
    assert.equal(synth.volume, 0.0729);
    synth.currentTime = 1.5;
    synth.pause();
    h.api.syncMusicPlayback();
    assert.equal(synth.paused, false);
    assert.equal(synth.volume, 0.0729);
    g.phase = 8;
    h.api.syncMusicPlayback();
    advanceFades(2000);
    assert.equal(h.audioPlayers.filter(player => player.src === 'synth_d4_loop.mp3').length, 1);
    assert.equal(synth.currentTime, 1.5);
    assert.equal(synth.paused, false);
    assert.equal(synth.volume, 0.0729);
    g.phase = 4;
    h.api.syncMusicPlayback();
    assert.equal(synth.paused, true);
    assert.equal(synth.currentTime, 0);
    assert.equal(synth.volume, 0);
    g.phase = 5;
    h.api.syncMusicPlayback();
    advanceFades(1000);
    assert.ok(synth.volume > 0 && synth.volume < 0.0729);
    g.musicMode = 'off';
    h.api.syncMusicPlayback();
    advanceFades(10000);
    assert.equal(synth.paused, true);
    assert.equal(synth.volume, 0);
    assert.ok(h.audioPlayers.every(player => player.paused));
    g.musicMode = 'on';
    h.api.syncMusicPlayback();
    advanceFades(8000);
    assert.equal(synth.volume, 0.0729);
    for (const change of [() => { g.musicMode = 'off'; }, () => { g.totalTasksDone = 0; }, () => { g.gameStarted = false; }, () => { g.retired = true; }]) {
      change();
      h.api.syncMusicPlayback();
      assert.equal(synth.paused, true);
      assert.equal(synth.currentTime, 0);
      assert.equal(synth.volume, 0);
      g.musicMode = 'on'; g.totalTasksDone = 12; g.gameStarted = true; g.retired = false;
      h.api.syncMusicPlayback();
      assert.equal(synth.paused, false);
      advanceFades(1000);
    }
    g.phase = 15;
    h.api.sellCompany();
    assert.ok(h.audioPlayers.some(player => player.src === 'soundtrack-loop.mp3' && !player.paused));
    assert.ok(h.audioPlayers.filter(player => player.src !== 'soundtrack-loop.mp3').every(player => player.paused));
    assert.equal(synth.volume, 0);
    h.window.GAME.prestige();
    assert.ok(h.audioPlayers.every(player => player.paused));
    assert.equal(synth.volume, 0);
  } finally {
    h.close();
  }
});

scenario('DnB source changes stay silent until music is unlocked', (h) => {
  const g = h.fresh(7);
  g.totalTasksDone = 12;
  h.api.syncMusicPlayback();
  g.phase = 8;
  h.api.syncMusicPlayback();
  assert.ok(h.audioPlayers.every(player => player.paused));
  h.api.unlockMusicPlayback();
  assert.ok(h.audioPlayers.some(player => player.src === 'dnb_synth_loop.wav' && !player.paused));
});

scenario('a game already in DnB mode plays only the premix and base soundtrack', (h) => {
  const g = h.fresh(8);
  g.totalTasksDone = 12;
  h.api.unlockMusicPlayback();
  assert.equal(h.audioPlayers.length, 2);
  assert.ok(h.audioPlayers.some(player => player.src === 'dnb_synth_loop.wav' && !player.paused));
  assert.ok(h.audioPlayers.every(player => player.src !== 'synth_d4_loop.mp3'));
  g.musicMode = 'off';
  h.api.syncMusicPlayback();
  assert.ok(h.audioPlayers.every(player => player.paused));
});

test('DnB waits for a downbeat and hands the standalone hook to the premixed track', () => {
  const intervals = new Map();
  let nextInterval = 0;
  const h = harness(undefined, { before(window) {
    window.setInterval = (fn, delay) => { const id = ++nextInterval; intervals.set(id, { fn, delay }); return id; };
    window.clearInterval = (id) => intervals.delete(id);
  } });
  const advanceFades = (ms) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      for (const [id, timer] of [...intervals]) if (timer.delay === 50 && intervals.has(id)) timer.fn();
    }
  };
  try {
    const g = h.fresh(7);
    g.totalTasksDone = 12;
    h.api.unlockMusicPlayback();
    advanceFades(10000);
    const kick = h.audioPlayers.find(player => player.src === 'precursor_kick.mp3');
    const synth = h.audioPlayers.find(player => player.src === 'synth_d4_loop.mp3');
    kick.currentTime = 5.1;
    synth.currentTime = 2.5;
    g.phase = 8;
    h.api.syncMusicPlayback();
    const dnb = h.audioPlayers.find(player => player.src === 'dnb_synth_loop.wav');
    assert.equal(dnb.paused, true);
    h.api.syncMusicPlayback();
    assert.equal(dnb.paused, true);
    assert.equal(kick.paused, false);
    dnb.dispatchEvent(new h.window.Event('canplay'));
    h.advance(1100);
    assert.equal(dnb.paused, true);
    h.advance(71);
    assert.equal(dnb.volume, 0);
    assert.equal(dnb.paused, false);
    assert.equal(synth.currentTime, 2.5);
    const timers = nextInterval;
    h.api.syncMusicPlayback();
    assert.equal(nextInterval, timers);
    advanceFades(2000);
    assert.ok(Math.abs(dnb.volume - 0.18 * 2000 / 6270) < 1e-9);
    assert.ok(Math.abs(kick.volume - 0.18 * (1 - 2000 / 6270)) < 1e-9);
    assert.ok(Math.abs(synth.volume - 0.0729 * (1 - 2000 / 6270)) < 1e-9);
    h.api.syncMusicPlayback();
    assert.ok(Math.abs(synth.volume - 0.0729 * (1 - 2000 / 6270)) < 1e-9);
    assert.equal(kick.paused, false);
    advanceFades(2200);
    assert.ok(dnb.volume < 0.18);
    assert.equal(kick.paused, false);
    assert.equal(synth.paused, false);
    advanceFades(2100);
    assert.equal(dnb.volume, 0.18);
    assert.equal(kick.paused, true);
    assert.equal(kick.currentTime, 0);
    assert.equal(kick.volume, 0);
    assert.equal(synth.currentTime, 0);
    assert.equal(synth.paused, true);
    assert.equal(synth.volume, 0);
    h.api.syncMusicPlayback();
    assert.equal(synth.paused, true);
    g.phase = 7;
    h.api.syncMusicPlayback();
    const stoppedKick = h.audioPlayers[h.audioPlayers.length - 1];
    g.musicMode = 'off';
    h.api.syncMusicPlayback();
    stoppedKick.dispatchEvent(new h.window.Event('canplay'));
    assert.equal(stoppedKick.currentTime, 0);
    advanceFades(5000);
    assert.ok(h.audioPlayers.every(player => player.paused));
    assert.ok(h.audioPlayers.filter(player => player.src !== 'soundtrack-loop.mp3').every(player => player.volume === 0));
    g.musicMode = 'on';
    h.api.syncMusicPlayback();
    stoppedKick.currentTime = 1.3;
    g.phase = 8;
    h.api.syncMusicPlayback();
    const obsoleteDnb = h.audioPlayers[h.audioPlayers.length - 1];
    g.phase = 7;
    h.api.syncMusicPlayback();
    obsoleteDnb.currentTime = 0;
    obsoleteDnb.dispatchEvent(new h.window.Event('canplay'));
    assert.equal(obsoleteDnb.currentTime, 0);
    const zeroKick = h.audioPlayers[h.audioPlayers.length - 1];
    obsoleteDnb.currentTime = 0;
    zeroKick.dispatchEvent(new h.window.Event('canplay'));
    assert.equal(zeroKick.paused, false);
    zeroKick.currentTime = 1.3;
    g.phase = 8;
    h.api.syncMusicPlayback();
    const cancelledDnb = h.audioPlayers[h.audioPlayers.length - 1];
    cancelledDnb.dispatchEvent(new h.window.Event('canplay'));
    g.musicMode = 'off';
    h.api.syncMusicPlayback();
    assert.equal(cancelledDnb.paused, true);
    g.musicMode = 'on';
    h.api.syncMusicPlayback();
    const resumedTimers = nextInterval;
    h.advance(2200);
    assert.equal(nextInterval, resumedTimers);
    g.musicMode = 'on';
    g.phase = 7;
    h.api.syncMusicPlayback();
    h.audioPlayers[h.audioPlayers.length - 1].currentTime = 1.7;
    g.phase = 8;
    h.api.syncMusicPlayback();
    const replacedDnb = h.audioPlayers[h.audioPlayers.length - 1];
    replacedDnb.dispatchEvent(new h.window.Event('canplay'));
    g.phase = 7;
    h.api.syncMusicPlayback();
    h.advance(2200);
    assert.equal(replacedDnb.paused, true);
  } finally {
    h.close();
  }
});

scenario('music toggles only between full layered On and silent Off and saves the choice', (h) => {
  const g = h.fresh(5);
  g.totalTasksDone = 12;
  h.api.unlockMusicPlayback();
  const button = h.window.document.querySelector('#btn-settings-music');
  assert.equal(g.musicMode, 'on');
  assert.equal(button.textContent, 'Music: On');
  for (const mode of ['off', 'on', 'off', 'on']) {
    button.click();
    assert.equal(g.musicMode, mode);
    assert.equal(button.textContent, mode === 'on' ? 'Music: On' : 'Music: Off');
    assert.equal(JSON.parse(h.window.localStorage.getItem('ai_empire_save')).musicMode, mode);
    assert.equal(h.api.validSave(g), true);
    if (mode === 'off') assert.ok(h.audioPlayers.every(player => player.paused));
    else {
      for (const src of ['soundtrack-loop.mp3', 'synth_d4_loop.mp3']) {
        assert.ok(h.audioPlayers.some(player => player.src === src && !player.paused));
      }
      assert.ok(h.audioPlayers.filter(player => !player.paused).length >= 3);
    }
  }
  assert.equal(h.api.validSave({...g, musicMode: 'layered'}), false);
});

scenario('onboarding, manual work, keyboard action and rendering', (h) => {
  h.window.document.querySelector('#btn-start-game').click();
  h.window.document.querySelector('#btn-do-task').click();
  h.api.tickManualWork(10);
  assert.equal(h.window.GAME.state.totalTasksDone, 1);
  h.advance(1000);
  for (let i = 0; i < 20; i++) { const task = h.task(); h.api.clickTask(task.id); h.api.tickManualWork(10); h.advance(1000); }
  h.dismiss(); h.task(); h.api.renderAll();
  assert.equal(h.window.GAME.state.uiRevealed.upgrades, true);
  assert.ok(h.window.document.querySelector('#task-list').innerHTML.includes('onclick'));
});

scenario('free AI requires prior purchases and shows its task requirement inside the button', (h) => {
  const g = h.fresh();
  g.uiRevealed.upgrades = true;
  g.totalTasksDone = 104;
  h.api.renderUpgradeSection();
  assert.equal(h.window.document.querySelector('[onclick="GAME.buy(\'free_ai\')"]'), null);
  g.totalTasksDone = 105;
  h.api.purchaseUpgrade('free_ai');
  assert.equal(g.phase, 1);
  h.prepareUpgrade('free_ai');
  g.totalTasksDone = 104;
  h.api.renderUpgradeSection();
  const button = h.window.document.querySelector('[onclick="GAME.buy(\'free_ai\')"]');
  assert.equal(button.textContent, '105 tasks');
  assert.equal(button.disabled, true);
  assert.equal(h.window.document.querySelector('.upgrade-cost'), null);
  h.api.purchaseUpgrade('free_ai');
  assert.equal(g.phase, 1);
  g.totalTasksDone = 105;
  h.api.renderUpgradeSection();
  assert.equal(button.disabled, false);
  h.api.purchaseUpgrade('free_ai');
  assert.equal(g.phase, 2);
  assert.equal(g.cash, 0);
  assert.equal(g.tokens, 0);
  assert.ok(g.purchasedUpgrades.includes('free_ai'));
  assert.equal(h.api.upgradeVisible(h.api.UPGRADES.find(upgrade => upgrade.id === 'free_ai')), false);
});

scenario('Post-It Notes work on two jobs in parallel, preserve pay and survive a reload', (h) => {
  const g = h.fresh();
  g.purchasedUpgrades.push('post_it_notes');
  const first = h.task();
  const selected = h.task();
  const waiting = h.task();
  for (const task of g.tasks) { task.workRequired = 6; task.pay = 10; }
  h.api.renderTaskQueue();
  assert.match(h.window.document.querySelector('#task-list').textContent, /Work on 2/);
  h.api.clickTask(selected.id);
  assert.equal(g.totalClicks, 1);
  assert.equal(waiting.status, 'available');
  h.api.clickTask(waiting.id);
  h.api.clickTask('missing');
  assert.equal(g.totalClicks, 1);
  h.api.tickManualWork(0);
  h.api.tickManualWork(0.3);
  assert.equal(selected.workDone, 2);
  assert.equal(first.workDone, 2);
  assert.equal(g.activeTaskId, selected.id);
  assert.equal(g.stress, 1.2);
  h.api.renderTaskQueue();
  const buttons = [...h.window.document.querySelectorAll('#task-list button')];
  assert.deepEqual(buttons.map(button => button.textContent), ['Working...', 'Working...', 'Work']);
  assert.ok(buttons.every(button => button.disabled));
  g.taskExpiryEnabled = true;
  h.advance(31000);
  h.api.pruneTasks(h.window.Date.now());
  assert.equal(g.tasks.length, 2);
  assert.equal(h.api.validSave(g), true);
  const restored = harness(JSON.stringify(g));
  try {
    const state = restored.window.GAME.state;
    restored.api.tickManualWork(0.3);
    assert.equal(state.totalTasksDone, 0);
    assert.equal(state.cash, 0);
    assert.equal(state.tasks.find(task => task.id === first.id).workDone, 4);
    assert.equal(state.tasks.find(task => task.id === selected.id).workDone, 4);
    restored.api.tickManualWork(0.3);
    assert.equal(state.totalTasksDone, 2);
    assert.equal(state.cash, 20);
    assert.equal(state.activeTaskId, null);
    assert.equal(state.totalClicks, 1);
    assert.equal(restored.api.validSave(state), true);
  } finally {
    restored.close();
  }
});

scenario('manual work stops at five tasks and Headphones reduce work for manual and AI jobs', (h) => {
  const g = h.fresh();
  g.cash = 10000;
  g.totalTasksDone = 50;
  h.prepareUpgrade('gtd_workflow');
  h.api.purchaseUpgrade('gtd_workflow');
  assert.equal(h.api.getManualQueueSize(), 5);
  assert.equal(g.clickPower, 1);
  assert.equal(g.batchSize, 1);
  for (let i = 0; i < 11; i++) h.task();
  h.api.clickTask(g.tasks[0].id);
  assert.equal(g.tasks.filter(task => task.status === 'active').length, 5);
  h.api.tickManualWork(0.1);
  assert.ok(g.tasks.filter(task => task.status === 'active').every(task => task.workDone > 0));
  h.api.tickManualWork(100);
  assert.equal(g.totalTasksDone, 55);
  h.prepareUpgrade('noise_cancelling');
  h.api.purchaseUpgrade('noise_cancelling');
  assert.equal(h.api.getManualQueueSize(), 5);
  assert.equal(g.workReduction, 0.1);
  assert.equal(g.clickPower, 1);
  while (g.tasks.filter(task => task.status === 'available').length < 11) h.task();
  h.api.clickTask(g.tasks.find(task => task.status === 'available').id);
  assert.equal(g.tasks.filter(task => task.status === 'active').length, 5);
  h.api.tickManualWork(100);
  assert.equal(g.totalTasksDone, 60);
  assert.equal(g.totalClicks, 2);
  g.phase = 4;
  assert.equal(h.api.getManualQueueSize(), 1);
  h.api.clickTask(g.tasks.find(task => task.status === 'available').id);
  h.task();
  h.api.clickTask(g.tasks.find(task => task.status === 'available').id);
  h.api.tickManualWork(100);
  assert.equal(g.totalTasksDone, 62);
});

scenario('AI Basic costs exactly $2,000 and cannot be bought below that price', (h) => {
  const g = h.fresh(2);
  g.totalTasksDone = 300;
  h.prepareUpgrade('pro_model');
  g.cash = 1999;
  h.api.purchaseUpgrade('pro_model');
  assert.equal(g.phase, 2);
  g.cash = 2000;
  h.api.purchaseUpgrade('pro_model');
  assert.equal(g.phase, 3);
  assert.equal(g.cash, 0);
  assert.equal(g.tokens, 50);
  assert.match(g.log.map(entry => entry.msg).join(' '), /starter grant: \+50 tokens/);
});

scenario('free AI works at half its former speed while Basic retains its throughput', (h) => {
  const g = h.fresh(2);
  assert.equal(h.api.originalAiWorkRate(), 18.75);
  g.purchasedUpgrades.push('post_it_notes', 'gtd_workflow', 'noise_cancelling');
  assert.equal(h.api.originalAiWorkRate(), 18.75);
  g.phase = 3;
  assert.equal(h.api.originalAiWorkRate(), 54);
  g.clickPower = 2;
  assert.equal(h.api.originalAiWorkRate(), 108);
});

scenario('Basic stays slow with 40 tokens while licensed Pro scales with ordinary agents', (h) => {
  const g = h.fresh(3);
  g.cash = 1e6;
  g.tokens = 1000;
  g.totalTasksDone = 1000;
  g.aiFailMult = 0;
  g.uiRevealed.agents = true;
  h.prepareUpgrade('second_ai');
  h.api.purchaseUpgrade('second_ai');
  const pro = g.agents[0];
  pro.reliability = 2;
  assert.equal(h.api.workerTokenCapacity(pro), 100);
  h.task().workRequired = 1e9;
  h.api.topUpAiWorker();
  h.api.topUpAgent(pro.id);
  assert.equal(g.aiWorkerTokenTank, 40);
  assert.equal(pro.tokenTank, 100);
  const task = h.task();
  task.workRequired = 1e9;
  h.api.assignAgentToTask(task.id, pro.id);
  const consumed = g.tokensConsumed;
  h.api.tickAgents(1);
  assert.equal(pro.tokenTank, 88);
  assert.equal(g.tokensConsumed - consumed, 12);
  assert.equal(h.api.tokenBurnRate(), 12);
  h.api.renderAgentSection();
  assert.match(h.window.document.querySelector('#agent-list').textContent, /40\/40 tokens/);
  assert.match(h.window.document.querySelector('#agent-list').textContent, /88\/100 tokens/);
  h.api.purchaseUpgrade('inference_tuning');h.api.purchaseUpgrade('prompt_refinement');h.api.purchaseUpgrade('context_pruning');
  h.api.purchaseUpgrade('multi_bot');
  const basic = g.agents.find(agent => agent.olderModel);
  assert.equal(h.api.workerTokenCapacity(basic), 40);
  assert.equal(h.api.workerTokenCapacity(pro), 200);
  assert.equal(h.api.workerTokenCost(pro), 1);
  assert.ok(h.api.workerSpeed(task, pro) > h.api.workerSpeed(task, basic) * 5);
  assert.equal(h.api.workerTokenCapacity(h.worker()), 200);
  basic.tokenTank = 5;
  pro.tokenTank = 5;
  const reserve = g.tokens;
  h.api.topUpAgent(basic.id);
  h.api.topUpAgent(pro.id);
  assert.equal(basic.tokenTank, 40);
  assert.equal(pro.tokenTank, 200);
  assert.equal(g.tokens, reserve - 230);
  h.api.renderAgentSection();
  assert.match(h.window.document.querySelector('#agent-list').textContent, /40\/40 tokens/);
  assert.match(h.window.document.querySelector('#agent-list').textContent, /200\/200 tokens/);
  const beforeLicensedWork = g.tokensConsumed;
  h.api.tickAgents(1);
  assert.equal(g.tokensConsumed - beforeLicensedWork, 30 * 0.95);
  assert.equal(pro.tokenTank, 200 - 15 * 0.95);
  assert.equal(h.window.document.querySelector('#agent-slots'), null);
  g.phase = 6;
  g.managerUnlock = true;
  h.worker('manager');
  g.managerTokenTank = 4000;
  basic.tokenTank = 39;
  pro.tokenTank = 1499;
  h.api.tickManager();
  assert.equal(basic.tokenTank, 39);
  assert.equal(pro.tokenTank, 1499);
  g.phase = 9;
  const cluster = h.api.addClusterWithNextName();
  cluster.managerAssigned = true;
  cluster.tokenManagerAssigned = true;
  cluster.tank = 4000;
  cluster.workerAgentIds.push(basic.id, pro.id);
  basic.tokenTank = 0;
  pro.tokenTank = 0;
  h.api.tickClusterManagers();
  assert.equal(basic.tokenTank, 40);
  assert.equal(pro.tokenTank, 1500);
  assert.equal(h.api.validSave(g), true);
});

scenario('token consumption is negative in the top bar and company leadership, including when idle', (h) => {
  const g = h.fresh(10);
  g.uiRevealed.topBar = true;
  g.uiRevealed.clusters = true;
  g.averageTokenBurn = 12.4;
  h.api.renderTopBar();
  h.api.renderClusterSection();
  assert.equal(h.window.document.querySelector('#token-burn').textContent, '-12 tok/s');
  assert.match(h.window.document.querySelector('.company-leadership').textContent, /-12 tok\/s/);
  g.averageTokenBurn = 0;
  h.api.renderTopBar();
  assert.equal(h.window.document.querySelector('#token-burn').textContent, '-0 tok/s');
});

scenario('Phase 5 needs a normal worker refill after about twenty seconds of continuous work', (h) => {
  const g = h.fresh(5);
  g.aiFailMult = 0;
  g.tokenEfficiency = 0.402;
  const agent = h.worker();
  agent.tokenCost = 1;
  agent.reliability = 2;
  agent.tokenTank = h.api.workerTokenCapacity(agent);
  const task = h.task();
  task.workRequired = 1e9;
  h.api.assignAgentToTask(task.id, agent.id);
  assert.equal(h.api.workerTokenRate(), 60);
  h.api.tickAgents(20);
  assert.ok(agent.tokenTank > 0 && agent.tokenTank < 20);
  h.api.tickAgents(1);
  assert.equal(agent.tokenTank, 0);
  assert.equal(g.tokensConsumed, 500);
});

scenario('real batch sizes vary around their upgrade target and change the completion counter digits', (h) => {
  const g = h.fresh(6);
  g.batchSize = 100;
  g.totalTasksDone = 5067;
  const sizes = [];
  const endings = new Set();
  for (let i = 0; i < 500; i++) {
    const task = h.task();
    sizes.push(task.batchSize);
    h.api.completeTask(task, 'manual');
    endings.add(g.totalTasksDone % 100);
  }
  assert.ok(sizes.every(size => Number.isInteger(size) && size >= 80 && size <= 120));
  assert.ok(new Set(sizes).size > 20);
  assert.ok(endings.size > 50);
  const mean = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
  assert.ok(mean > 97 && mean < 103);
  assert.equal(g.totalTasksDone, 5067 + sizes.reduce((sum, size) => sum + size, 0));
  const savedSize = g.tasks[0].batchSize;
  g.batchSize = 500;
  assert.equal(g.tasks[0].batchSize, savedSize);
  assert.equal(h.api.validSave(g), true);
});

scenario('empty upgrade space retains the height of the last visible upgrade card', (h) => {
  const g = h.fresh();
  g.totalTasksDone = 7;
  g.uiRevealed.upgrades = true;
  h.prepareUpgrade('free_ai');
  h.api.renderUpgradeSection();
  const list = h.window.document.querySelector('#upgrade-list');
  const card = list.querySelector('.upgrade-card');
  assert.ok(card);
  card.getBoundingClientRect = () => ({ height: 74 });
  g.purchasedUpgrades.push('free_ai');
  h.api.renderUpgradeSection();
  assert.equal(list.style.getPropertyValue('--upgrade-card-height'), '74px');
  assert.ok(list.querySelector('.upgrade-space'));
  assert.equal(list.textContent, '');
  h.api.renderUpgradeSection();
  assert.equal(list.style.getPropertyValue('--upgrade-card-height'), '74px');
});

scenario('Phase 7 reveals task milestones in the background and spreads purchases before growth', (h) => {
  const g = h.fresh(7);
  g.totalTasksDone = 30000;
  g.cash = 1e9;
  g.uiRevealed.upgrades = true;
  h.prepareUpgrade('compute_2');
  h.api.renderUpgradeSection();
  const button = id => h.window.document.querySelector('[onclick="GAME.buy(\'' + id + '\')"]');
  assert.equal(button('compute_2'), null);
  assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent, /45,000 tasks/);
  assert.equal(button('devops_unlock').disabled, false);
  h.api.purchaseUpgrade('compute_2');
  assert.equal(g.purchasedUpgrades.includes('compute_2'), false);
  h.api.purchaseUpgrade('devops_unlock');
  g.totalTasksDone = 45000;
  h.api.purchaseUpgrade('compute_2');
  assert.equal(g.batchSize, 500);
  g.totalTasksDone = 65000;
  h.api.purchaseUpgrade('compute_1');
  g.totalTasksDone = 90000;
  const speed = g.agentSpeedMult;
  h.api.purchaseUpgrade('delivery_pipeline');
  assert.equal(g.agentSpeedMult, speed * 1.25);
  g.totalTasksDone = 115000;
  const pay = g.payMult;
  h.api.purchaseUpgrade('premium_contracts');
  assert.equal(g.payMult, pay * 1.35);
  h.api.renderUpgradeSection();
  assert.equal(button('ops_flywheel'), null);
  g.totalTasksDone = 150000;
  h.api.renderUpgradeSection();
  assert.ok(button('ops_flywheel'));
  g.cash = 999999;
  h.api.purchaseUpgrade('ops_flywheel');
  assert.equal(g.phase, 7);
  g.cash = 1000000;
  h.api.purchaseUpgrade('ops_flywheel');
  assert.equal(g.phase, 8);
  assert.equal(g.cash, 0);
});

for (const buyUpgrades of [false, true]) {
  scenario('a real opening requires the paid tools before free AI, upgrades ' + buyUpgrades, (h) => {
    const g = h.fresh();
    for (let step = 0; step < 3000 && g.phase === 1; step++) {
      h.advance(100);
      h.dismiss();
      if (g.uiRevealed.upgrades) {
        for (const upgrade of h.api.UPGRADES) {
          if (buyUpgrades || upgrade.id === 'free_ai') h.api.purchaseUpgrade(upgrade.id);
        }
      }
      if (g.phase !== 1) break;
      if (!g.uiRevealed.taskQueue) h.api.doEarlyTask();
      else {
        const task = g.tasks.find(item => item.status === 'available');
        if (task) h.api.clickTask(task.id);
      }
      h.api.tick();
    }
    assert.equal(g.phase, buyUpgrades ? 2 : 1);
    assert.ok(g.totalTasksDone >= 50);
    if (buyUpgrades) {
      assert.ok(g.totalClicks > 50 && g.totalClicks <= 100, 'work clicks: ' + g.totalClicks);
      assert.ok(h.api.UPGRADES.filter(upgrade => upgrade.phase === 1).every(upgrade => g.purchasedUpgrades.includes(upgrade.id)));
    } else assert.equal(g.purchasedUpgrades.length, 0);
    assert.equal(h.api.validSave(g), true);
  });
}

scenario('auto OFF stays idle; explicit top-up starts one job; guards prevent task stealing', (h) => {
  const g=h.fresh(4); g.tokens=50;
  const a=h.worker(); a.autoAssign=false; a.tokenTank=5;
  const t=h.task(); h.api.tickAgents(0.1); assert.equal(a.status,'idle');
  h.api.topUpAgent(a.id); assert.equal(a.status,'working');
  const b=h.worker('coder'); b.tokenTank=10; b.autoAssign=false; h.api.assignAgentToTask(t.id,b.id); assert.equal(b.status,'idle');
  a.reliability=2; h.api.tickAgents(1000); assert.equal(g.totalTasksDone,1);
  h.task(); h.api.tickAgents(0.1); assert.equal(a.status,'idle');
  h.api.toggleAgentAuto(a.id); a.tokenTank=10; h.api.tickAgents(0.1); assert.equal(a.status,'working');
});
scenario('Token Manager purchases scaled packs and charges only missing tokens', (h) => {
  const g=h.fresh(7);g.cash=1e6;g.tokens=0;g.aiWorkerShutdown=true;h.worker('manager');h.worker('token_mgr');const a=h.worker();
  h.api.tickTokenManager();assert.equal(g.tokens,46000);assert.equal(g.cash,970000);assert.equal(g.tokenPacksBought,1);
  h.advance(3000);h.api.tickTokenManager();h.api.tickManager();assert.equal(a.tokenTank,1500);assert.equal(g.managerTokenTank,2500);assert.equal(g.tokens,46000);
  g.managerTokenTank=3999;g.tokens=2;h.api.topUpManager();assert.equal(g.tokens,1);assert.equal(g.managerTokenTank,4000);
  g.managerTokenTank=0;g.tokens=3;h.api.topUpManager();assert.equal(g.managerTokenTank,3);
});
scenario('clusters include staged hardware and management before agent provisioning', (h) => {
  const g=h.fresh(9);g.tokens=5000;g.cash=1e6;g.uiRevealed.clusters=true;
  h.api.openCluster();const c=g.clusters[0];assert.equal(g.cash,938000);assert.equal(c.managerAssigned,false);
  for(const stage of ['Procuring GPUs','Racking hardware','Installing software','Final checks']){h.api.renderClusterSection();assert.match(h.window.document.querySelector('#cluster-list').textContent,new RegExp(stage));h.api.buyNextClusterWorker(c.id);assert.equal(g.agents.length,0);h.api.tickConstruction(c.buildDuration/4);}
  assert.equal(c.managerAssigned,true);assert.equal(c.tokenManagerAssigned,true);assert.equal(h.window.GAME.buyManagementTeam,undefined);
  h.api.buyNextClusterWorker(c.id);assert.equal(g.cash,935500);const agent=g.agents[0];assert.equal(agent.status,'provisioning');assert.ok(agent.name.length <= 6);assert.notEqual(agent.name,'AI Agent');h.api.tickConstruction(agent.provisionDuration/2);h.api.renderClusterSection();assert.equal(h.window.document.querySelector('[aria-label="Provisioning agent"]').getAttribute('aria-valuenow'),'50');
  h.api.tickConstruction(agent.provisionDuration/2);h.api.tickTokenManager();h.api.tickManager();assert.equal(agent.tokenTank,1500);assert.equal(c.tank,2500);assert.equal(agent.status,'idle');assert.equal(h.api.validSave(g),true);
});
scenario('upgrades change payouts, token use, failure rate, and deploy services', (h) => {
  const g=h.fresh(5);g.cash=1e8;g.totalTasksDone=2000;const a=h.worker();const t=h.task();t.typeId='research';const baseline=h.api.getTaskCashPayout(t,'agent',a);
  h.prepareUpgrade('web_browse');h.api.purchaseUpgrade('web_browse');assert.ok(Math.abs(h.api.getTaskCashPayout(t,'agent',a)-baseline*1.2)<1e-9);
  g.phase=9;g.totalTasksDone=2250000;h.fullCluster();h.prepareUpgrade('code_review');h.api.purchaseUpgrade('code_review');assert.ok(Math.abs(h.api.getTaskCashPayout(t,'agent',a)-baseline*1.2*1.25)<1e-9);
  h.api.purchaseUpgrade('deploy');assert.equal(g.services.length,2);const cash=g.cash;h.api.tickServices(1);assert.ok(g.cash-cash>=160);
  g.phase=10;g.cash=1e9;h.prepareUpgrade('ai_ceo');h.api.purchaseUpgrade('ai_ceo');h.api.purchaseUpgrade('ceo_recruitment');h.api.purchaseUpgrade('network_density');h.api.purchaseUpgrade('ceo_deploy_speed');h.api.purchaseUpgrade('cluster_capacity_16');h.api.purchaseUpgrade('ceo_batch');g.clusters=[];g.agents=[];for(let i=0;i<5;i++)h.fullCluster();h.api.purchaseUpgrade('server_1');assert.equal(g.services.length,5);
  const cost=g.cash;h.api.purchaseUpgrade('server_1');assert.equal(g.cash,cost);h.api.renderAll();
});
scenario('Scale Mode builds automatically through Phase 12 and replication exceeds 128 nodes', (h) => {
  const g=h.fresh(12);g.cash=1e12;g.ceoMode='scale';h.fullCluster();
  h.window.GAME.openCluster();assert.equal(g.clusters.length,1);h.api.tickAiCeo();assert.equal(g.clusters.length,2);const c=g.clusters[1];assert.equal(c.workforce,0);
  h.advance(12100);h.api.tickConstruction(12.1);h.api.tickAiCeo();assert.equal(c.workforce,16);const spent=g.cash;h.api.tickAiCeo();assert.ok(g.cash<spent);assert.equal(g.clusters.length,3);
  g.phase=13;for(let i=0;i<1100;i++){h.advance(2000);h.api.tickConstruction(2);h.api.tickAiCeo();}assert.ok(g.clusters.length>200);assert.equal(h.api.validSave(g),true);
  g.phase=14;h.api.checkMilestones();h.dismiss();h.api.renderAll();assert.equal(h.window.document.querySelectorAll('.network-grid div.cluster-card:not(.planning-card)').length,g.clusters.length);assert.equal(h.window.document.querySelectorAll('.network-grid div.cluster-card button').length,0);
  assert.equal(h.window.document.querySelector('.network-grid [data-cluster-id] strong').textContent,'C'+g.clusters.length);assert.match(h.window.document.querySelector('#delivery-summary').textContent,/delivery revenue/);
});
scenario('DevOps resolves critical incidents more slowly without final approval', (h) => {
  const g=h.fresh(7);h.worker('devops');
  const critical={id:'critical',name:'Critical',sev:'critical',fixProgress:0,createdAt:1,resolved:false,repCost:5,cashCost:0};
  const warning={...critical,id:'warning',name:'Warning',sev:'warning'};g.incidents=[critical,warning];
  h.api.tickDevopsIncidentResponse(10);assert.equal(critical.fixProgress,55);assert.equal(critical.resolved,false);
  h.api.tickDevopsIncidentResponse(30);assert.equal(critical.resolved,true);assert.equal(warning.resolved,true);assert.equal(g.stress,0);
  h.api.resolveIncident('critical','invalid');
});
scenario('selling freezes the company before either ending choice and persists', (h) => {
  const g=h.fresh(15);h.prepareUpgrade('fusion');g.cash=1e10;g.totalTasksDone=2000;g.services=[{id:'service',name:'Service',incomeRate:1000,active:true}];
  for(let i=0;i<100;i++)h.fullCluster();
  assert.equal(h.api.canTrueRetire(),false);h.api.purchaseUpgrade('fusion');assert.equal(g.retired,true);assert.equal(g.retirementFinal,false);assert.equal(h.api.canPrestige(),true);
  assert.equal(h.window.document.querySelector('#game-container').hidden,true);assert.equal(h.window.document.querySelector('#ending-overlay').hidden,false);
  const before=JSON.stringify(g);h.advance(1000);h.api.tick();h.window.GAME.buy('token_pack_2');h.window.GAME.addCash(1000);assert.equal(JSON.stringify(g),before);
  const early=harness(h.window.localStorage.getItem('ai_empire_save'));assert.equal(early.window.GAME.state.retired,true);assert.equal(early.window.document.querySelector('#ending-choices').hidden,false);early.close();
  h.window.GAME.trueRetire();assert.equal(g.retirementFinal,true);assert.equal(h.api.canPrestige(),false);h.window.GAME.prestige();assert.equal(h.window.GAME.state,g);
  const loaded=harness(h.window.localStorage.getItem('ai_empire_save'));assert.equal(loaded.window.GAME.state.retirementFinal,true);assert.equal(loaded.window.document.activeElement.id,'btn-ending-reset');loaded.close();
});
scenario('income is independent of task remaining time and excludes empty tanks', (h) => {
  const g=h.fresh(4);const a=h.worker();a.tokenTank=10;const t=h.task();h.api.assignAgentToTask(t.id,a.id);
  const before=h.api.getIncomeRate();t.workDone=t.workRequired-0.001;assert.equal(h.api.getIncomeRate(),before);
  a.tokenTank=0;assert.ok(h.api.getIncomeRate()<before);
});
scenario('offline earnings only use contracts; reloading cannot collect twice', (h) => {
  const g=h.fresh(9);g.services=[{id:'svc',name:'Service',incomeRate:80,active:true}];g.serviceSlots=1;
  h.advance(60000);h.api.applyOfflineProgress();assert.equal(g.cash,2400);
  h.api.applyOfflineProgress();assert.equal(g.cash,2400);
  assert.equal(h.api.calcOfflineProgress(1),null);assert.equal(h.api.calcOfflineProgress(1e9).seconds,28800);
  g.services=[];const a=h.worker();a.status='working';assert.equal(h.api.calcOfflineProgress(60).earned,0);
});
scenario('save validation rejects malformed, incompatible, unsafe, and dangling state', (h) => {
  const g=h.fresh();assert.equal(h.api.validSave(g),true);
  for(const value of [null,{},[],{...g,saveVersion:0},{...g,phase:16},{...g,cash:-1},{...g,cash:Infinity},{...g,musicMode:'invalid'}]) assert.equal(h.api.validSave(value),false);
  const a=h.worker();const t=h.task();assert.equal(h.api.validSave(g),true);a.currentTask='missing';assert.equal(h.api.validSave(g),false);a.currentTask=null;
  t.name='<img>';assert.equal(h.api.validSave(g),false);
  for(const raw of ['null','{','{"phase":1}']) {const x=harness(raw);assert.equal(x.api.save(),false);assert.equal(x.window.localStorage.getItem('ai_empire_save'),raw);assert.equal(x.window.document.querySelector('#save-notice').hidden,false);x.close();}
});
scenario('expected storage failures are visible; unexpected errors propagate', (h) => {
  h.fresh();const storage=h.window.localStorage;const prototype=Object.getPrototypeOf(storage);const original=prototype.setItem;
  prototype.setItem=()=>{throw new h.window.DOMException('full','QuotaExceededError');};assert.equal(h.api.save(),false);assert.equal(h.window.document.querySelector('#save-notice').hidden,false);
  prototype.setItem=()=>{throw new TypeError('programming error');};assert.throws(()=>h.api.save(),TypeError);
  prototype.setItem=original;assert.equal(h.api.save(),true);assert.equal(h.window.document.querySelector('#save-notice').hidden,true);
});
scenario('prestige retains earned bonuses and music preference', (h) => {
  const g=h.fresh(15);g.musicMode='off';g.retired=true;h.window.document.querySelector('#btn-ending-restart').click();const next=h.window.GAME.state;
  assert.equal(next.phase,1);assert.equal(next.prestigeCount,1);assert.equal(next.clickPower,2);assert.equal(next.tokens,50);assert.equal(next.musicMode,'off');assert.equal(h.api.validSave(next),true);
});
scenario('all phases render without errors and expose controls', (h) => {
  const g=h.fresh();g.cash=1e9;g.tokens=10000;g.totalTasksDone=2000;
  for(let phase=1;phase<=15;phase++){
    g.phase=phase;h.api.checkMilestones();h.dismiss();
    if(phase===9)h.api.addClusterWithNextName();
    for(const upgrade of h.api.UPGRADES.filter(u=>u.phase===phase&&u.oneTime))h.api.purchaseUpgrade(upgrade.id);
    h.dismiss();h.task();h.api.renderAll();
    assert.equal(h.api.validSave(g),true,`phase ${phase}`);
  }
});
scenario('manager hiring burst, role gates, and automation scheduling', (h) => {
  const g=h.fresh(6);g.cash=1e6;g.tokens=100;g.managerUnlock=true;g.agentAutoAssign=true;
  h.api.hireAgent('missing');h.api.hireAgent('devops');h.api.hireAgent('sales');h.api.hireAgent('token_mgr');assert.equal(g.agents.length,0);
  const a=h.worker();const t=h.task();t.typeId='email';h.api.hireAgent('manager');assert.equal(a.status,'working');assert.equal(g.managerTokenTank,0);
  h.api.tickAgentAutoAssign();h.api.fireAgent(g.agents.find(a=>a.roleId==='manager').id);a.status='idle';a.currentTask=null;t.status='available';t.assignedAgent=null;a.autoAssign=false;
  h.advance(2000);h.api.tickAgentAutoAssign();assert.equal(a.status,'idle');a.autoAssign=true;h.advance(2000);h.api.tickAgentAutoAssign();assert.equal(a.status,'working');
  h.api.renderAll();
});
scenario('cluster panel shows ordered management and removes individual worker controls', (h) => {
  const g=h.fresh(9);g.cash=1e6;g.totalTasksDone=1200;
  h.api.openCluster();const c=g.clusters[0];h.api.tickConstruction(12.1);h.api.buyNextClusterWorker(c.id,'coder');
  h.api.openCluster();h.api.checkMilestones();h.dismiss();h.api.renderAll();
  const text=h.window.document.querySelector('#cluster-list').textContent;
  assert.match(text,/Installing agents/);assert.doesNotMatch(text,/Worker controls|Unassigned workers|Global Utility/);
  const button=h.window.document.querySelector('#cluster-list button');button.focus();h.api.renderAll();assert.equal(h.window.document.activeElement,button);
  h.api.createAiWorkerIncident(h.task());g.incidents[0].fixProgress=90;h.api.renderIncidentSection();assert.match(h.window.document.querySelector('#incident-list').textContent,/DevOps responding/);
});
scenario('storage access failures, explicit resets, and successful recovery', (h) => {
  const prototype=Object.getPrototypeOf(h.window.localStorage);const get=prototype.getItem;const remove=prototype.removeItem;
  prototype.getItem=()=>{throw new h.window.DOMException('denied','SecurityError')};assert.equal(h.api.load(),false);
  prototype.getItem=()=>{throw new TypeError('bad')};assert.throws(()=>h.api.load(),TypeError);prototype.getItem=get;
  prototype.removeItem=()=>{throw new h.window.DOMException('denied','SecurityError')};h.api.performFullReset();assert.match(h.window.document.querySelector('#save-status').textContent,/Reset failed/);
  prototype.removeItem=()=>{throw new TypeError('bad')};assert.throws(()=>h.api.performFullReset(),TypeError);prototype.removeItem=remove;
  h.window.localStorage.setItem('ai_empire_save','test');h.api.performFullReset();assert.equal(h.window.localStorage.getItem('ai_empire_save'),null);
});
scenario('dialog focus, tab loop, escape, settings actions and lifecycle saves', (h) => {
  h.fresh(6);h.api.renderAll();const doc=h.window.document;doc.querySelector('#btn-settings').focus();h.api.openSettingsPopup();assert.equal(doc.activeElement.id,'btn-settings-music');
  for(const button of doc.querySelectorAll('#settings-popup button'))button.getClientRects=()=>[{}];
  let prevented=false;h.api.handleDialogKey({key:'Tab',shiftKey:true,preventDefault(){prevented=true}});assert.equal(prevented,true);
  h.api.handleDialogKey({key:'Tab',shiftKey:false,preventDefault(){}});
  h.api.handleDialogKey({key:'Escape'});assert.equal(doc.activeElement.id,'btn-settings');
  h.api.handleDialogKey({key:'Tab'});
  doc.querySelector('#btn-settings').click();doc.querySelector('#btn-settings-music').click();doc.querySelector('#btn-settings-reset').click();doc.querySelector('#btn-settings-confirm-cancel').click();doc.querySelector('#btn-settings-close').click();
  h.window.dispatchEvent(new h.window.Event('pagehide'));assert.ok(h.window.localStorage.getItem('ai_empire_save'));
  Object.defineProperty(doc,'hidden',{configurable:true,value:true});doc.dispatchEvent(new h.window.Event('visibilitychange'));h.api.tick();
  Object.defineProperty(doc,'hidden',{configurable:true,value:false});doc.dispatchEvent(new h.window.Event('visibilitychange'));
  doc.querySelector('#btn-save-retry').click();
});
scenario('tick pauses dialogs, clamps time jumps and does not expire active work', (h) => {
  const g=h.fresh(3);g.tokens=20;g.totalTasksDone=30;h.api.checkMilestones();h.dismiss();
  h.api.topUpAiWorker();const t=h.task();h.advance(100);h.api.tick();assert.ok(t.workDone>0);
  h.api.openSettingsPopup();const previous=g.totalPlaytime;h.advance(1000);h.api.tick();assert.equal(g.totalPlaytime,previous);h.api.closeSettingsPopup();
  h.advance(60000);h.api.tick();assert.equal(g.lastTick,h.window.Date.now());
  const active=h.task();active.status='active';active.createdAt=0;g.taskExpiryEnabled=true;h.api.pruneTasks(h.window.Date.now());assert.ok(g.tasks.includes(active));
  h.api.renderAll();
});
scenario('development stage helpers terminate and reject unknown stages', (h) => {
  h.window.GAME.cheat('invalid');for(const stage of ['0_1',3,6,9,11]){h.window.GAME.cheat(stage);assert.equal(h.api.validSave(h.window.GAME.state),true);}assert.ok(h.window.GAME.state.gameStarted);
});
test('three deterministic full journeys reach a saved ending without cheats', (t) => {
  for (const seed of [17, 42, 123]) {
    const result = play(seed);
    assert.equal(result.stalled, undefined);
    assert.equal(result.phases.length, 15);
    const freeAi = result.phases.find(phase => phase.phase === 2);
    assert.ok(freeAi.clicks > 50 && freeAi.clicks <= 100);
    assert.equal(result.offers.find(offer => offer.id === 'free_ai').cost, 0);
    assert.equal(result.offers.find(offer => offer.id === 'pro_model').cost, 2000);
    const growth = result.purchases.find(purchase => purchase.id === 'ops_flywheel');
    assert.equal(growth.cost, 1000000);
    const sale = ['retire_unlock', 'sale_advisor', 'sale_buyout', 'sale_diligence', 'sale_terms', 'fusion'].map(id => result.purchases.find(purchase => purchase.id === id));
    assert.equal(sale[0].cost, 90000);
    for (let index = 1; index < sale.length; index++) {
      assert.ok(sale[index].seconds - sale[index - 1].seconds >= [8, 10, 12, 18, 10][index - 1], 'Each sale step must complete before the next starts');
    }
    for (const id of ['compute_2', 'compute_1', 'delivery_pipeline', 'premium_contracts']) {
      const purchase = result.purchases.find(item => item.id === id);
      assert.ok(purchase.tasks >= ({ compute_2: 45000, compute_1: 65000, delivery_pipeline: 90000, premium_contracts: 115000 })[id]);
      assert.ok(purchase.seconds < growth.seconds);
    }
    t.diagnostic('Phase 7 purchases: ' + JSON.stringify(result.purchases.filter(purchase => purchase.phase === 7)));
    t.diagnostic('Seed ' + seed + ': free AI at ' + freeAi.clicks + ' work clicks; Basic at ' + result.phases.find(phase => phase.phase === 3).seconds + ' simulation seconds');
    assert.ok(result.phases.find(p => p.phase === 6).seconds - result.phases.find(p => p.phase === 5).seconds >= 35, 'Phase 5 has time for its upgrades');
    assert.ok(result.phases.find(p => p.phase === 9).tasks >= 1000000);
    assert.ok(result.phases.find(p => p.phase === 10).tasks >= 2500000);
    for (const id of ['cluster_capacity_3', 'ceo_readiness', 'ceo_recruitment', 'network_density']) {
      const offer = result.offers.find(item => item.id === id);
      assert.ok(offer.cash < offer.cost, id + ' must require saving when first offered');
      const purchase = result.purchases.find(item => item.id === id);
      assert.ok(purchase.seconds - offer.seconds >= 10, id + ' must leave time to save');
    }
    const globalExpansion = result.phases.find(phase => phase.phase === 14);
    const investorTalks = result.offers.find(offer => offer.id === 'retire_unlock');
    const expansionTime = investorTalks.seconds - globalExpansion.seconds;
    assert.ok(expansionTime >= 90 && expansionTime <= 180, 'Phase 14 leaves time to develop the neocloud network before investor talks appear');
    assert.ok(investorTalks.nodes >= 500);
    for (const id of ['neocloud_pipeline', 'standardised_construction', 'neocloud_batch', 'bulk_hardware', 'factory_direct', 'neocloud_supply_chain', 'parallel_neoclouds']) {
      const offer = result.offers.find(item => item.id === id);
      const purchase = result.purchases.find(item => item.id === id);
      assert.ok(offer.cash < offer.cost, id + ' must remain a savings goal');
      assert.ok(purchase.seconds - offer.seconds >= 8, id + ' leaves time to save');
    }
    assert.ok(result.tasks > result.phases.find(phase => phase.phase === 15).tasks, 'The company keeps delivering throughout sale preparation');
    assert.ok(result.offers.find(o => o.id === 'ceo_parallel_clusters').seconds > result.offers.find(o => o.id === 'ceo_deploy_speed').seconds, 'Scaling upgrades reveal across the expansion phase');
    assert.ok(result.offers.find(o => o.id === 'ceo_quad_batch').cash < result.offers.find(o => o.id === 'ceo_quad_batch').cost, 'Four-agent provisioning is a savings goal');
    for (const id of ['pro_model', 'second_ai', 'multi_bot']) {
      const offer = result.offers.find(item => item.id === id);
      assert.ok(offer.cash < offer.cost, id + ' must be a savings goal');
    }
  }
});

test('CEO prices require early saving and keep later automation goals across three action frequencies', (t) => {
  for (const actionEveryMs of [500, 5000, 10000]) {
    const result = play(17, actionEveryMs);
    assert.equal(result.stalled, undefined);
    const wait = id => result.purchases.find(item => item.id === id).seconds - result.offers.find(item => item.id === id).seconds;
    assert.equal(result.offers.find(item => item.id === 'ceo_recruitment').cost, 25000000);
    assert.equal(result.offers.find(item => item.id === 'network_density').cost, 30000000);
    assert.equal(result.offers.find(item => item.id === 'server_1').cost, 200000000);
    const pipeline = result.purchases.find(item => item.id === 'ceo_recruitment');
    const density = result.purchases.find(item => item.id === 'network_density');
    assert.ok(density.seconds > pipeline.seconds, 'The first two improvements require separate savings');
    assert.ok(wait('ceo_recruitment') <= 45, 'Pipeline remains an attainable early improvement');
    const goals = ['server_1', 'ceo_batch', 'ceo_quad_batch'].map(wait);
    assert.ok(goals.filter(seconds => seconds >= 20 && seconds <= 75).length >= 2, 'Major automation has visible saving goals');
    t.diagnostic(JSON.stringify({ actionEveryMs, pipelineWait: wait('ceo_recruitment'), scaleModeWait: wait('server_1'), dualWait: wait('ceo_batch'), fourWait: wait('ceo_quad_batch') }));
  }
});
scenario('managed workers show disabled controls while the Manager keeps its refill button', (h) => {
  const g = h.fresh(6);
  g.totalTasksDone = 650;
  g.tokens = 10000;
  const manager = h.worker('manager');
  const agent = h.worker();
  agent.tokenTank = 100;
  h.api.checkMilestones();
  h.dismiss();
  for (const phase of [6, 8]) {
    g.phase = phase;
    h.api.renderAll();
    const cards = [...h.window.document.querySelectorAll('#agent-list .agent-card')];
    assert.equal(cards[0].querySelector('button').textContent, 'Top-up tokens');
    assert.equal(cards[0].querySelector('button').disabled, false);
    for (const card of cards.slice(1)) {
      assert.equal(card.querySelector('button').textContent, 'Managed');
      assert.equal(card.querySelector('button').disabled, true);
      assert.equal(card.querySelector('button').hasAttribute('onclick'), false);
    }
    assert.doesNotMatch(cards.map(card => card.textContent).join(' '), /SPD|QUA|REL|Auto ON|Fuel/);
    assert.equal(h.window.document.querySelector('#section-stats').style.display, 'none');
  }
  g.managerTokenTank = 4000;
  h.api.topUpAgent(agent.id);
  h.api.topUpAiWorker();
  assert.equal(g.tokens, 10000);
  assert.equal(agent.tokenTank, 100);
  assert.equal(g.aiWorkerTokenTank, 0);
  h.api.fireAgent(manager.id);
  h.api.renderAll();
  assert.ok([...h.window.document.querySelectorAll('#agent-list .agent-card')].every(card => card.querySelector('button').textContent === 'Top-up tokens'));
  h.api.topUpAgent(agent.id);
  assert.equal(agent.tokenTank, 1500);
  assert.equal(g.tokens, 8600);
});
scenario('reset buttons require confirmation before discarding saved progress', (h) => {
  const doc=h.window.document;h.window.confirm=()=>false;
  for(const id of ['btn-save-reset','btn-ending-reset']){h.window.localStorage.setItem('ai_empire_save','keep');doc.getElementById(id).click();assert.equal(h.window.localStorage.getItem('ai_empire_save'),'keep');}
  h.window.confirm=()=>true;
  for(const id of ['btn-save-reset','btn-ending-reset']){doc.getElementById(id).click();assert.equal(h.window.localStorage.getItem('ai_empire_save'),null);}
});
scenario('cluster workers cannot be detached fired or individually controlled', (h) => {
  const g=h.fresh(9);g.cash=1e6;h.api.openCluster();const c=g.clusters[0];h.api.tickConstruction(12.1);h.api.buyNextClusterWorker(c.id,'writer');
  h.api.tickConstruction(12);const a=g.agents[0];a.tokenTank=10;const t=h.task();h.api.assignAgentToTask(t.id,a.id);
  assert.equal(h.window.GAME.unassignWorker,undefined);h.api.fireAgent(a.id);
  assert.equal(t.status,'agent');assert.equal(a.currentTask,t.id);assert.equal(c.managerAssigned,true);assert.equal(c.workerAgentIds[0],a.id);
  h.api.completeTask(t,'ai_assist');assert.equal(a.currentTask,null);assert.equal(h.api.validSave(g),true);
});
scenario('mobile rotate preference needs no storage permission', (h) => {
  Object.defineProperty(h.window,'innerWidth',{value:390,configurable:true});Object.defineProperty(h.window,'innerHeight',{value:844,configurable:true});h.api.updateRotateOverlay();
  assert.equal(h.window.document.querySelector('#rotate-overlay').classList.contains('show'),true);
  h.window.document.querySelector('#btn-rotate-continue').click();h.api.updateRotateOverlay();assert.equal(h.window.document.querySelector('#rotate-overlay').classList.contains('show'),false);
});
scenario('autopilot sustains work without manual tank refills', (h) => {
  const g=h.fresh(7);g.totalTasksDone=650;g.cash=100000;g.tokens=0;g.managerUnlock=true;g.aiWorkerShutdown=true;g.incidentsExplained=true;
  h.worker('manager');h.worker('token_mgr');h.worker('devops');h.worker('writer');h.worker('coder');h.api.checkMilestones();h.dismiss();
  for(let i=0;i<3000;i++){h.advance(100);h.api.tick();h.dismiss();}
  assert.ok(g.totalTasksDone>700);assert.ok(g.cash>0);assert.equal(h.api.validSave(g),true);
});
scenario('scale requires manage mode; buying an old cluster upgrade cannot exceed the cap', (h) => {
  const g=h.fresh(10);g.cash=1e9;g.totalTasksDone=1600;h.prepareUpgrade('ai_ceo');h.fullCluster();
  h.api.purchaseUpgrade('server_1');assert.equal(g.ceoMode,'off');h.api.checkMilestones();h.dismiss();h.api.renderUpgradeSection();assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/AI CEO Scale Mode/);
  h.api.purchaseUpgrade('ai_ceo');h.api.purchaseUpgrade('ceo_recruitment');h.api.purchaseUpgrade('network_density');h.api.purchaseUpgrade('ceo_deploy_speed');h.api.purchaseUpgrade('cluster_capacity_16');h.api.purchaseUpgrade('ceo_batch');g.clusters=[];g.agents=[];for(let i=0;i<5;i++)h.fullCluster();h.api.purchaseUpgrade('server_1');assert.equal(g.ceoMode,'scale');
  for(let i=0;i<7;i++)h.api.addClusterWithNextName();const cash=g.cash;h.api.purchaseUpgrade('cluster_beta');assert.equal(g.cash,cash);assert.equal(g.clusters.length,12);
  h.api.renderUpgradeSection();assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/Discounted Cluster Lease/);assert.equal(h.api.validSave(g),true);
});
scenario('live rendering preserves controls while values change', (h) => {
  const element=h.window.document.createElement('div');h.window.document.body.appendChild(element);
  h.api.updateHTML(element,"<button onclick='doWork()' disabled title='Old'>One</button><span>Remove</span>");const button=element.firstChild;
  h.api.updateHTML(element,"<button onclick='doWork()' title='New'>Two</button>");assert.equal(element.firstChild,button);assert.equal(button.disabled,false);assert.equal(button.title,'New');assert.equal(button.textContent,'Two');assert.equal(element.childNodes.length,1);
  h.api.updateHTML(element,"<button onclick='doWork()' title='New'>Two</button>");assert.equal(element.firstChild,button);
  h.api.updateHTML(element,"<button onclick='different()'>Another</button>");assert.notEqual(element.firstChild,button);
  h.api.updateHTML(element,'text');assert.equal(element.textContent,'text');h.api.updateHTML(element,'<p>Next</p>');assert.equal(element.firstChild.tagName,'P');
});
scenario('empty and locked panels clear prior DOM content', (h) => {
  const g=h.fresh();g.uiRevealed.agents=true;g.uiRevealed.prestige=true;h.api.renderAgentSection();h.api.renderPrestigeSection();h.api.renderTaskQueue();
  assert.equal(h.window.document.querySelector('#task-list').textContent,'');assert.equal(h.window.document.querySelector('#section-prestige').style.display,'none');
  g.phase=2;g.aiWorkerShutdown=true;h.api.renderAgentSection();assert.equal(h.window.document.querySelector('#agent-list').textContent,'');
  h.window.document.querySelector('#offline-popup').classList.add('show');h.window.document.querySelector('#btn-dismiss-offline').click();assert.equal(h.window.document.querySelector('#offline-popup').classList.contains('show'),false);
});
scenario('manual work can start from a full or partly filled tank without buying fuel', (h) => {
  const g=h.fresh(4);g.tokens=0;const a=h.worker();a.autoAssign=false;a.tokenTank=10;const t=h.task();h.api.topUpAgent(a.id);
  assert.equal(a.currentTask,t.id);assert.equal(g.tokens,0);assert.equal(a.tokenTank,10);
  h.api.completeTask(t,'agent');a.tokenTank=5;const next=h.task();h.api.topUpAgent(a.id);assert.equal(a.currentTask,next.id);assert.equal(g.tokens,0);
});
scenario('reset cannot be undone by the pagehide autosave', (h) => {
  h.fresh();h.api.save();h.api.performFullReset();h.window.dispatchEvent(new h.window.Event('pagehide'));
  assert.equal(h.window.localStorage.getItem('ai_empire_save'),null);assert.equal(h.api.save(),false);
});
scenario('chPh0 clears saved progress even after retirement and prevents autosave restoring it', (h) => {
  const g = h.fresh();
  g.cash = 12345;
  g.retired = true;
  h.api.save();
  assert.notEqual(h.window.localStorage.getItem('ai_empire_save'), null);
  h.window.chPh0();
  h.window.dispatchEvent(new h.window.Event('pagehide'));
  assert.equal(h.window.localStorage.getItem('ai_empire_save'), null);
  assert.equal(h.api.save(), false);
});
scenario('token top-up stays enabled even when the reserve is empty', (h) => {
  const g=h.fresh(4);g.tokens=0;g.uiRevealed.agents=true;const a=h.worker();a.tokenTank=5;h.api.renderAgentSection();
  const button=h.window.document.querySelector('[onclick="GAME.topUpAgent(\''+a.id+'\')"]');assert.equal(button.disabled,false);
  g.tokens=50;h.api.renderAgentSection();assert.equal(button.disabled,false);h.api.topUpAgent(a.id);assert.equal(a.tokenTank,55);assert.equal(g.tokens,0);
});
scenario('task quality affects cash without a separate reputation resource', (h) => {
  const g=h.fresh(4);g.totalTasksDone=25;g.codeQualityMult=1.25;const a=h.worker();a.quality=2;a.tokenTank=10;const t=h.task();h.api.assignAgentToTask(t.id,a.id);h.api.renderTaskQueue();
  assert.doesNotMatch(h.window.document.querySelector('#task-list').textContent,/Rep:/);assert.equal('reputation' in g,false);
  const cash=g.cash;const expected=h.api.getTaskCashPayout(t,'agent',a);h.api.completeTask(t,'agent');assert.equal(g.cash-cash,expected);
});
scenario('fast tasks finish immediately and completed cards do not obstruct the first work button', (h) => {
  const g=h.fresh(3);g.clickPower=10000;g.aiFailMult=0;g.aiWorkerTokenTank=10;
  const t=h.task();h.advance(1);const next=h.task();h.api.tickAiWorker(0.1);assert.equal(t.status,'done');assert.equal(g.totalTasksDone,1);
  h.api.renderTaskQueue();assert.doesNotMatch(h.window.document.querySelector('#task-list').textContent,/Completed/);
  assert.equal(h.window.document.querySelector('#task-list button').getAttribute('onclick'),"GAME.clickTask('"+next.id+"', event)");
  h.api.pruneTasks(h.window.Date.now());assert.equal(g.tasks.length,1);
});
scenario('worker top-ups conserve tokens and manual refills resume when the Manager is sold', (h) => {
  const g = h.fresh(6);
  g.tokens = 5000;
  g.managerUnlock = true;
  g.agentSlots = 6;
  g.cash = 1e6;
  h.api.hireAgent('manager');
  assert.equal(g.tokens, 1000);
  assert.equal(g.managerTokenTank, 4000);
  const agent = h.worker();
  h.api.tickManager();
  assert.equal(g.aiWorkerTokenTank, 1500);
  assert.equal(agent.tokenTank, 1500);
  assert.equal(g.managerTokenTank, 1000);
  h.api.fireAgent(g.agents.find(item => item.roleId === 'manager').id);
  agent.tokenTank = 1300;
  h.api.topUpAgent(agent.id);
  assert.equal(g.tokens, 800);
  assert.equal(agent.tokenTank, 1500);
  g.managerTokenTank = 0;
  agent.tokenTank = 1400;
  h.api.topUpAgent(agent.id);
  assert.equal(g.tokens, 700);
  assert.equal(agent.tokenTank, 1500);
  g.aiWorkerTokenTank = 0;
  g.tokens = 2;
  h.api.topUpAiWorker();
  assert.equal(g.tokens, 0);
  assert.equal(g.aiWorkerTokenTank, 2);
  g.tokens = 1000;
  g.phase = 7;
  h.api.tickTokenManager();
  assert.equal(g.tokens, 1000);
});
scenario('management order stays fixed and locked roles have no placeholders', (h) => {
  const g=h.fresh(7);g.uiRevealed.agents=true;g.managerUnlock=true;g.agentSlots=8;g.purchasedUpgrades.push('token_manager_unlock','devops_unlock');
  h.worker('writer');h.worker('devops');h.worker('token_mgr');h.worker('manager');h.api.renderAgentSection();
  const roles=[...h.window.document.querySelectorAll('#agent-list .agent-info .role')].map(el=>el.textContent);
  assert.match(roles[0],/Manager/);assert.match(roles[1],/Token Mgr/);assert.doesNotMatch(roles.join(' '),/DevOps/);h.api.renderIncidentSection();assert.match(h.window.document.querySelector('#incident-devops').textContent,/DevOps/);
  g.agents=[];g.phase=4;g.managerUnlock=false;g.purchasedUpgrades=[];h.api.renderAgentSection();
  assert.doesNotMatch(h.window.document.querySelector('#agent-list').textContent,/Manager|DevOps/);
  assert.equal(h.window.document.querySelectorAll('#agent-list .agent-vacancy').length,8);
});
scenario('node production consumes real tokens and stops when empty', (h) => {
  const g=h.fresh(12);g.cash=100000;const c=h.api.addClusterWithNextName();c.managerAssigned=true;c.tokenManagerAssigned=true;c.workforce=8;c.tank=1200;
  h.api.tickNetwork(2);assert.equal(g.cash,100120);assert.equal(c.tank,0);assert.equal(g.totalTasksDone,4);
  h.api.tickNetwork(2);assert.equal(g.cash,100120);h.api.tickTokenManager();assert.equal(g.tokens,49750);assert.match(g.log[0].msg,/Purchased/);
  h.advance(2000);h.api.tickTokenManager();assert.equal(c.tank,500);const before=g.cash;h.api.tickNetwork(1);assert.equal(g.cash,before+50);
  g.phase=14;c.workforce=c.workerSlotsMax;g.cash=1e10;g.totalTasksDone=10000;h.prepareUpgrade('retire_unlock');h.api.purchaseUpgrade('retire_unlock');assert.equal(g.phase,14);
  while(g.clusters.length<500){const item=h.api.addClusterWithNextName();item.managerAssigned=true;item.tokenManagerAssigned=true;item.workforce=item.workerSlotsMax;}
  h.api.purchaseUpgrade('retire_unlock');h.api.tickSalePreparation(8);assert.equal(g.phase,15);assert.equal(h.api.validSave(g),true);
});
scenario('cluster construction and node upgrades enforce stage, capacity and funds', (h) => {
  const g=h.fresh(9);g.cash=0;h.api.openCluster();assert.equal(g.clusters.length,0);
  g.cash=1e6;h.api.openCluster();const c=g.clusters[0];h.api.buyNextClusterWorker(c.id,'writer');assert.equal(g.agents.length,0);
  g.cash=0;h.api.tickConstruction(12.1);assert.equal(c.managerAssigned,true);g.cash=1e6;h.api.tickConstruction(12.1);
  h.api.buyNextClusterWorker('missing');assert.equal(g.agents.length,0);
  g.cash=0;h.api.buyNextClusterWorker(c.id,'writer');assert.equal(g.agents.length,0);g.cash=1e6;
  for(let i=0;i<9;i++)h.api.buyNextClusterWorker(c.id,'coder');assert.equal(g.agents.length,8);
  g.phase=12;g.ceoMode='scale';const empty=h.api.addClusterWithNextName();g.cash=0;h.api.tickAiCeo();assert.equal(empty.managerAssigned,false);
  g.cash=1e6;h.advance(6000);h.api.tickConstruction(6);h.api.tickAiCeo();assert.equal(c.workforce,8);h.advance(5000);h.api.tickAiCeo();assert.equal(empty.workforce,16);assert.equal(empty.managerAssigned,true);
  g.cash=0;h.advance(5000);h.api.tickAiCeo();assert.equal(g.clusters.length,2);
});
scenario('Token Manager can supply workers before a Manager is hired', (h) => {
  const g=h.fresh(7);g.tokens=50;h.worker('token_mgr');const a=h.worker();
  h.api.tickTokenManager();assert.equal(a.tokenTank,50);assert.equal(g.tokens,0);assert.equal(g.managerTokenTank,0);
});
scenario('an empty Manager keeps assigning jobs until worker tokens run out', (h) => {
  const g=h.fresh(6);g.aiWorkerShutdown=true;g.smartRouting=true;h.worker('manager');const a=h.worker();a.tokenTank=1500;a.tokenCost=1;a.reliability=2;
  const t=h.task();t.workRequired=1e9;h.api.tickManager();assert.equal(g.managerTokenTank,0);assert.equal(a.currentTask,t.id);
  h.api.tickAgents(5);assert.equal(a.tokenTank,750);assert.equal(a.status,'working');h.api.tickAgents(5);assert.equal(a.tokenTank,0);h.api.tickAgents(0.1);assert.equal(a.status,'idle');
});
scenario('eight busy Phase 6 workers consume tens of thousands of tokens per minute', (h) => {
  const g=h.fresh(6);g.aiWorkerShutdown=true;g.tokenEfficiency=0.8*0.75*0.67;
  for(let i=0;i<8;i++){const a=h.worker();a.tokenTank=1500;a.tokenCost=1;a.reliability=2;const t=h.task();t.workRequired=1e9;h.api.assignAgentToTask(t.id,a.id);}
  const rate=h.api.tokenBurnRate();assert.ok(rate*60>20000);assert.ok(rate*60<40000);
  h.api.tickAgents(10);assert.ok(Math.abs(g.agents.reduce((total,a)=>total+a.tokenTank,0)-(12000-rate*10))<0.001);
  g.uiRevealed.topBar=true;h.api.checkMilestones();h.dismiss();h.api.renderTopBar();assert.match(h.window.document.querySelector('#token-burn').textContent,/tok\/s/);
});
scenario('token prices rise with purchases while incident costs track earned wealth', (h) => {
  const g=h.fresh(6);g.cash=1e9;const pack=h.api.UPGRADES.find(u=>u.id==='token_pack_1');const cheap=h.api.getUpgradeCost(pack);
  const task=h.task();h.api.createAiWorkerIncident(task);const early=g.incidents[0].cashCost;
  g.totalCashEarned=1e8;assert.equal(h.api.getUpgradeCost(pack),cheap);h.api.createAiWorkerIncident(task);assert.ok(g.incidents.at(-1).cashCost>early*10);
  h.api.purchaseUpgrade(pack.id);assert.equal(g.tokenPacksBought,1);assert.ok(h.api.getUpgradeCost(pack)>cheap);
  const next=h.api.getUpgradeCost(pack);g.cash=next;h.api.buyTokenPacks(pack,3);assert.equal(g.cash,0);assert.equal(g.tokenPacksBought,2);
  const price=h.api.getUpgradeCost(pack);g.cash=1e9;assert.equal(h.api.getUpgradeCost(pack),price);
});
scenario('token-manager slot is reserved before another worker slot unlocks', (h) => {
  const g=h.fresh(6);g.cash=1e7;g.totalTasksDone=150000;g.managerUnlock=true;g.agentSlots=6;g.aiWorkerShutdown=true;h.prepareUpgrade('token_manager_unlock');
  for(const role of ['manager','writer','coder','researcher','analyst','support'])h.worker(role);
  h.api.purchaseUpgrade('token_manager_unlock');assert.equal(g.phase,7);assert.equal(g.agentSlots,7);
  h.api.purchaseUpgrade('agent_slot_7');assert.equal(g.agentSlots,7);
  h.api.checkMilestones();h.dismiss();h.api.renderAgentSection();assert.match(h.window.document.querySelector('.token-manager-slot').textContent,/Buy Token Manager/);
  h.api.hireAgent('token_mgr');g.purchasedUpgrades.push('devops_unlock');h.api.hireAgent('devops');assert.equal(g.agents.length,8);h.api.renderAgentSection();assert.equal(h.window.document.querySelectorAll('.agent-vacancy').length,1);
  h.prepareUpgrade('ops_flywheel');h.api.purchaseUpgrade('ops_flywheel');h.api.purchaseUpgrade('agent_slot_7');assert.equal(g.agentSlots,8);h.api.renderAgentSection();assert.match(h.window.document.querySelector('.agent-vacancy').textContent,/Sales/);
});
scenario('cluster permits gate provisioning and sales do not reset rising prices', (h) => {
  const g=h.fresh(9);g.cash=1e9;g.totalTasksDone=1500000;h.prepareUpgrade('code_agents');const first=h.fullCluster();
  h.api.openCluster();assert.equal(g.clusters.length,1);h.api.checkMilestones();h.dismiss();h.api.renderClusterSection();assert.equal(h.window.document.querySelector('[onclick="GAME.openCluster()"]'),null);
  h.api.purchaseUpgrade('cluster_capacity_2');assert.equal(h.api.clusterCapacity(),1);h.api.purchaseUpgrade('code_agents');h.api.purchaseUpgrade('cluster_capacity_2');
  const price=h.api.provisionCost();h.api.openCluster();const second=g.clusters[1];h.api.openCluster();assert.equal(g.clusters.length,2);assert.ok(h.api.provisionCost()>price);
  h.api.purchaseUpgrade('cluster_capacity_3');assert.equal(h.api.clusterCapacity(),2);h.api.tickConstruction(12.1);
  h.api.renderClusterSection();assert.equal(h.window.document.querySelectorAll('.node-grid .capacity-slot').length,16);
  h.api.sellCluster(second.id);assert.equal(g.clusters.length,2);for(let i=0;i<second.workerSlotsMax;i++)h.api.buyNextClusterWorker(second.id);h.api.tickConstruction(12);
  h.api.purchaseUpgrade('cluster_capacity_3');assert.equal(h.api.clusterCapacity(),3);
  const a=g.agents.find(item=>second.workerAgentIds.includes(item.id));a.tokenTank=100;const t=h.task();h.api.assignAgentToTask(t.id,a.id);
  const cash=g.cash;const resale=h.api.clusterSaleValue(second);const nextPrice=h.api.provisionCost();h.api.sellCluster(second.id);
  assert.equal(g.cash,cash+resale);assert.ok(resale<second.invested);assert.equal(g.clusters.length,1);assert.equal(g.agents.length,8);assert.equal(t.status,'available');assert.equal(h.api.provisionCost(),nextPrice);
  h.api.openCluster();assert.equal(g.clusters[1].name,'Cluster 3');assert.equal(h.api.validSave(g),true);
});
scenario('CEO Manage Mode staffs existing clusters without provisioning and displays its job', (h) => {
  const g=h.fresh(10);g.cash=1e9;g.totalTasksDone=2000000;h.prepareUpgrade('ai_ceo');for(let i=0;i<3;i++)h.fullCluster();g.uiRevealed.clusters=true;g.uiRevealed.upgrades=true;
  h.api.renderClusterSection();assert.ok(h.window.document.querySelector('.ceo-slot'));h.api.renderUpgradeSection();assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/AI CEO \(Manage Mode\)/);
  h.api.purchaseUpgrade('ai_ceo');assert.ok(g.clusters.every(c=>c.workerSlotsMax===8&&c.workerAgentIds.length===8));h.api.purchaseUpgrade('network_density');h.api.purchaseUpgrade('ceo_deploy_speed');h.api.purchaseUpgrade('cluster_capacity_16');h.api.purchaseUpgrade('ceo_batch');assert.equal(h.api.canManuallyProvisionCluster(),false);
  for(let i=0;i<24;i++){h.advance(5000);h.api.tickConstruction(5);h.api.tickAiCeo();}h.api.tickConstruction(12);assert.equal(h.api.canManuallyProvisionCluster(),true);assert.equal(g.clusters.length,3);
  h.window.GAME.openCluster();assert.equal(g.clusters.length,4);assert.equal(h.api.canManuallyProvisionCluster(),false);h.api.renderUpgradeSection();assert.match(h.window.document.querySelector('#upgrade-list').textContent,/Provisioning Pipeline/);
  h.api.tickConstruction(12.1);for(let i=0;i<16;i++){h.advance(5000);h.api.tickAiCeo();h.api.tickConstruction(12);}assert.equal(h.api.canManuallyProvisionCluster(),true);
  h.window.GAME.openCluster();assert.equal(g.clusters.length,5);h.api.tickConstruction(12.1);for(let i=0;i<16;i++){h.advance(5000);h.api.tickAiCeo();h.api.tickConstruction(12);}h.api.purchaseUpgrade('ceo_recruitment');h.api.purchaseUpgrade('server_1');assert.equal(g.ceoMode,'scale');
  h.window.GAME.openCluster();assert.equal(g.clusters.length,5);h.advance(2500);h.api.tickAiCeo();assert.equal(g.clusters.length,6);h.api.renderClusterSection();assert.equal(h.window.document.querySelector('.provision-card'),null);
});
scenario('automatic token purchases sustain a fully staffed hundred-node network', (h) => {
  const g=h.fresh(14);g.cash=1e9;g.tokenEfficiency=0.402;
  for(let i=0;i<100;i++){const c=h.api.addClusterWithNextName();c.workforce=8;c.managerAssigned=true;c.tokenManagerAssigned=true;}
  for(let i=0;i<600;i++){h.advance(100);h.api.tickTokenManager();h.api.tickNetwork(0.1);}
  assert.ok(g.clusters.every(c=>c.tank>0));assert.ok(g.totalTasksDone>11000);assert.ok(g.tokens>0);assert.equal(h.api.validSave(g),true);
  g.uiRevealed.upgrades=true;g.uiRevealed.clusters=true;h.api.renderUpgradeSection();h.api.renderWorkStream();
  assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/Add Another Worker Slot/);
  assert.match(h.window.document.querySelector('#delivery-summary').textContent,/100 managed nodes/);
});
scenario('second subscription is mandatory and both workers retain tokens and jobs at licensing', (h) => {
  const g=h.fresh(3);g.cash=1e6;g.tokens=200;g.totalTasksDone=1000;h.prepareUpgrade('second_ai');g.uiRevealed.agents=true;g.uiRevealed.upgrades=true;
  h.api.purchaseUpgrade('multi_bot');assert.equal(g.phase,3);h.api.renderUpgradeSection();assert.equal(h.window.document.querySelector('[onclick="GAME.buy(\'multi_bot\')"]'),null);
  h.api.purchaseUpgrade('second_ai');const second=g.agents[0];assert.equal(g.agents.length,1);h.api.purchaseUpgrade('second_ai');assert.equal(g.agents.length,1);
  g.tasks=[];g.aiWorkerCurrentTaskId=null;second.currentTask=null;second.status='idle';h.api.renderAgentSection();assert.equal(h.window.document.querySelectorAll('#agent-list button').length,2);assert.equal(h.window.document.querySelector('#agent-slots'),null);
  h.api.topUpAiWorker();h.api.topUpAgent(second.id);assert.equal(g.tokens,60);assert.equal(second.tokenTank,100);h.api.fireAgent(second.id);assert.equal(g.agents.length,1);
  const originalTask=h.task();originalTask.workRequired=1e6;g.aiFailMult=0;h.api.tickAiWorker(0.1);const loaded=g.aiWorkerTokenTank;
  const secondTask=h.task();secondTask.workRequired=1e6;h.api.assignAgentToTask(secondTask.id,second.id);const secondTokens=second.tokenTank;g.aiWorkerTasksCompleted=12;
  h.api.purchaseUpgrade('inference_tuning');h.api.purchaseUpgrade('prompt_refinement');h.api.purchaseUpgrade('context_pruning');
  h.api.purchaseUpgrade('multi_bot');assert.equal(g.phase,4);assert.equal(g.agents.length,2);assert.equal(g.aiWorkerShutdown,true);assert.equal(g.aiWorkerTokenTank,0);
  const original=g.agents.find(a=>a.roleId==='writer');assert.equal(original.tokenTank,loaded);assert.equal(original.tasksCompleted,12);assert.equal(original.currentTask,originalTask.id);assert.equal(originalTask.assignedAgent,original.id);assert.equal(second.tokenTank,secondTokens);assert.equal(second.currentTask,secondTask.id);
  assert.equal(h.api.validSave(g),true);h.api.fireAgent(original.id);h.api.hireAgent('writer');assert.equal(g.agents.length,2);
});
scenario('sale conditions gate the upgrade and restarting preserves bonuses without sales replay', (h) => {
  const g=h.fresh(15);g.cash=1e9;g.totalTasksDone=2000;g.uiRevealed.upgrades=true;h.prepareUpgrade('fusion');for(let i=0;i<100;i++)h.fullCluster();g.techDebt=20;
  h.api.purchaseUpgrade('fusion');assert.equal(g.retired,false);h.api.renderUpgradeSection();assert.equal(h.window.document.querySelector('[onclick="GAME.buy(\'fusion\')"]').disabled,true);
  h.window.GAME.trueRetire();assert.equal(g.retirementFinal,false);h.window.GAME.prestige();assert.equal(h.window.GAME.state,g);
  g.retired=true;g.retirementValue=100000;g.prestigeCount=1;g.prestigeBonusClick=1;g.prestigeBonusTokens=50;h.api.renderAll();h.window.document.querySelector('#btn-ending-restart').click();
  const next=h.window.GAME.state;assert.equal(next.retired,false);assert.equal(next.prestigeCount,2);assert.equal(next.clickPower,3);assert.equal(next.tokens,125);assert.equal(next.gameStarted,false);assert.equal(next.uiRevealed.taskQueue,false);
  assert.equal(h.api.validSave({...next,retirementFinal:true}),false);assert.match(h.window.document.querySelector('#intro-story').textContent,/bored/);
  h.window.document.querySelector('#btn-start-game').click();assert.equal(next.gameStarted,true);assert.equal(next.tasks.length,0);h.api.doEarlyTask();h.api.tickManualWork(1);assert.equal(next.totalTasksDone,1);
});
scenario('the older Basic model is visibly slow and can be sold for a faster replacement', (h) => {
  const g=h.fresh(3);g.cash=1e6;g.totalTasksDone=1000;g.tokens=200;h.prepareUpgrade('second_ai');h.api.purchaseUpgrade('second_ai');h.api.purchaseUpgrade('inference_tuning');h.api.purchaseUpgrade('prompt_refinement');h.api.purchaseUpgrade('context_pruning');h.api.purchaseUpgrade('multi_bot');
  const original=g.agents.find(agent=>agent.olderModel);const task=h.task();const slow=h.api.workerSpeed(task,original);h.api.renderAgentSection();g.uiRevealed.agents=true;h.api.renderAgentSection();
  assert.match(h.window.document.querySelector('#agent-list').textContent,/Older model · slow/);assert.doesNotMatch(h.window.document.querySelector('#agent-list').textContent,/Auto ON|Dismiss/);
  const saved=harness(JSON.stringify(g));try{assert.equal(saved.window.GAME.state.agents.find(agent=>agent.id===original.id).olderModel,true);}finally{saved.close();}
  h.api.fireAgent(original.id);h.api.hireAgent('writer');const replacement=g.agents.find(agent=>agent.roleId==='writer');assert.equal(replacement.olderModel,false);assert.ok(h.api.workerSpeed(task,replacement)>slow*2);
});
scenario('replication is revealed at twenty nodes and waits for the required online capacity', (h) => {
  for(const existing of [3,12]) {
    const g=h.fresh(11);g.cash=1e10;g.totalTasksDone=2000000;g.ceoMode='scale';g.uiRevealed.upgrades=true;h.prepareUpgrade('autonomous_nodes');
    for(let i=0;i<existing;i++)h.fullCluster();h.api.purchaseUpgrade('autonomous_nodes');h.api.purchaseUpgrade('ceo_continuous');const target=Math.max(20,existing+9);assert.equal(g.replicationTarget,target);
    h.api.renderUpgradeSection();assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/Node Replication/);
    while(g.clusters.length<target)h.fullCluster();
    h.api.renderUpgradeSection();const button=h.window.document.querySelector('[onclick="GAME.buy(\'replication\')"]');assert.ok(button);assert.doesNotMatch(button.closest('.card').textContent,/\(\d+ nodes\)/);assert.doesNotMatch(button.closest('.card').textContent,/reached|managed nodes/);
    g.clusters.at(-1).workforce=0;h.api.purchaseUpgrade('replication');assert.equal(g.phase,12);h.api.renderUpgradeSection();assert.equal(button.disabled,true);
    const restored=harness(JSON.stringify(g));try{assert.equal(restored.window.GAME.state.replicationTarget,target);}finally{restored.close();}
    h.advance(5000);h.api.tickAiCeo();h.api.purchaseUpgrade('replication');assert.equal(g.phase,13);h.advance(2000);h.api.tickAiCeo();assert.equal(g.clusters.length,target+4);
  }
});
scenario('Global Expansion costs $2B and requires forty completed nodes', (h) => {
  const g = h.fresh(13);
  g.cash = 2000000000;
  g.totalTasksDone = 2000000;
  g.uiRevealed.upgrades = true;
  h.prepareUpgrade('global_network');
  for (let index = 0; index < 39; index++) h.fullCluster();
  h.api.renderUpgradeSection();
  const selector = '[onclick="GAME.buy(\'global_network\')"]';
  assert.equal(h.window.document.querySelector(selector).textContent, '$2.00B');
  assert.equal(h.window.document.querySelector(selector).disabled, true);
  h.api.purchaseUpgrade('global_network');
  assert.equal(g.phase, 13);
  assert.equal(g.cash, 2000000000);
  h.fullCluster();
  g.cash--;
  h.api.renderUpgradeSection();
  assert.equal(h.window.document.querySelector(selector).disabled, true);
  h.api.purchaseUpgrade('global_network');
  assert.equal(g.phase, 13);
  assert.equal(g.cash, 1999999999);
  g.cash++;
  h.api.renderUpgradeSection();
  assert.equal(h.window.document.querySelector(selector).disabled, false);
  h.api.purchaseUpgrade('global_network');
  assert.equal(g.phase, 14);
  assert.equal(g.cash, 0);
  assert.ok(g.purchasedUpgrades.includes('global_network'));
});
scenario('free AI unlocks at its task milestone and later upgrades retain their prerequisites', (h) => {
  const g=h.fresh();g.cash=1e9;g.totalTasksDone=89;g.uiRevealed.upgrades=true;h.prepareUpgrade('free_ai');h.api.checkMilestones();h.dismiss();
  const upgrade=id=>h.api.UPGRADES.find(u=>u.id===id);
  assert.equal(g.milestonesReached.includes('expenses_unlock'),false);assert.equal(h.api.upgradeVisible(upgrade('free_ai')),true);
  h.api.purchaseUpgrade('free_ai');assert.equal(g.phase,1);
  g.totalTasksDone=105;h.api.purchaseUpgrade('free_ai');assert.equal(g.phase,2);h.api.renderUpgradeSection();assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/Prompt|Pro AI/);
  g.totalTasksDone=199;h.api.purchaseUpgrade('prompt_basics');assert.equal(g.purchasedUpgrades.includes('prompt_basics'),false);
  g.totalTasksDone=200;h.api.purchaseUpgrade('prompt_examples');assert.equal(g.purchasedUpgrades.includes('prompt_examples'),true);assert.equal(h.api.upgradeVisible(upgrade('prompt_basics')),false);
  g.totalTasksDone=300;h.api.purchaseUpgrade('pro_model');assert.equal(g.phase,2);h.api.purchaseUpgrade('prompt_library');h.api.purchaseUpgrade('gig_alerts');h.api.purchaseUpgrade('prompt_examples');h.api.purchaseUpgrade('marketing_campaign');h.api.purchaseUpgrade('pro_model');assert.equal(g.phase,3);
  g.totalTasksDone=361;h.api.renderUpgradeSection();assert.match(h.window.document.querySelector('#upgrade-list').textContent,/KV Caching/);assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/Second AI/);
  g.totalTasksDone=1000;h.api.purchaseUpgrade('second_ai');assert.equal(g.agents.length,0);h.prepareUpgrade('second_ai');h.api.purchaseUpgrade('second_ai');h.api.purchaseUpgrade('inference_tuning');h.api.purchaseUpgrade('prompt_refinement');h.api.purchaseUpgrade('context_pruning');h.api.purchaseUpgrade('multi_bot');assert.equal(g.phase,4);
  h.api.purchaseUpgrade('agent_slot_5');assert.equal(g.agentSlots,2);h.prepareUpgrade('agent_slot_3');h.worker('coder');h.api.purchaseUpgrade('agent_slot_3');assert.equal(g.agentSlots,3);
  h.api.purchaseUpgrade('tool_use');assert.equal(g.phase,4);h.prepareUpgrade('agent_slot_5');h.api.purchaseUpgrade('agent_slot_5');g.totalTasksDone=1150;h.api.purchaseUpgrade('tool_use');assert.equal(g.phase,5);
});
scenario('phase progression needs a Manager and full clusters before later upgrades appear', (h) => {
  const g=h.fresh(6);g.cash=1e9;g.totalTasksDone=150000;g.managerUnlock=true;h.prepareUpgrade('token_manager_unlock');h.api.purchaseUpgrade('token_manager_unlock');assert.equal(g.phase,6);
  h.worker('manager');h.api.purchaseUpgrade('token_manager_unlock');assert.equal(g.phase,7);
  g.phase=9;g.totalTasksDone=1500000;g.agents=[];h.prepareUpgrade('code_agents');const first=h.api.addClusterWithNextName();first.managerAssigned=true;first.tokenManagerAssigned=true;
  h.api.purchaseUpgrade('code_agents');assert.equal(g.purchasedUpgrades.includes('code_agents'),false);
  for(let i=0;i<8;i++)h.api.buyNextClusterWorker(first.id);h.api.tickConstruction(12);h.api.purchaseUpgrade('code_agents');h.api.purchaseUpgrade('cluster_capacity_2');
  h.api.purchaseUpgrade('cluster_capacity_3');assert.equal(h.api.clusterCapacity(),2);
  h.api.openCluster();const second=g.clusters[1];assert.equal(second.managerAssigned,false);h.api.tickConstruction(12.1);for(let i=0;i<second.workerSlotsMax;i++)h.api.buyNextClusterWorker(second.id);h.api.tickConstruction(12);
  h.api.purchaseUpgrade('cluster_capacity_3');assert.equal(h.api.clusterCapacity(),3);h.prepareUpgrade('ceo_readiness');h.api.purchaseUpgrade('ceo_readiness');assert.equal(g.phase,9);
  h.fullCluster();g.totalTasksDone=2500000;h.api.purchaseUpgrade('ceo_readiness');assert.equal(g.phase,10);
});
scenario('token display uses whole numbers and smooths actual consumption between jobs', (h) => {
  const g=h.fresh(3);g.totalTasksDone=361;g.aiWorkerTokenTank=40;g.aiFailMult=0;g.tokens=1234.56;h.api.checkMilestones();h.dismiss();const t=h.task();t.workRequired=1e9;
  for(let i=0;i<30;i++){h.advance(100);h.api.tick();h.dismiss();}
  assert.ok(g.tokensConsumed>0);const average=g.averageTokenBurn;assert.ok(average>1);g.aiWorkerTokenTank=0;
  h.advance(100);h.api.tick();assert.ok(g.averageTokenBurn>average*0.95);assert.ok(g.averageTokenBurn<average);
  h.api.renderAll();assert.equal(h.window.document.querySelector('#res-tokens').textContent,'1,235');assert.match(h.window.document.querySelector('#token-burn').textContent,/^-\d[\d,]* tok\/s$/);
  assert.doesNotMatch(h.window.document.querySelector('#agent-list').textContent,/\d\.\d.*tokens/);
});
scenario('Manager refills at ten percent and continues assigning jobs with conserved tokens', (h) => {
  const g = h.fresh(6);
  g.smartRouting = true;
  g.managerTokenTank = 4000;
  h.worker('manager');
  const agent = h.worker();
  const task = h.task();
  task.workRequired = 1e9;
  agent.tokenTank = 151;
  g.aiWorkerTokenTank = 151;
  h.api.tickManager();
  assert.equal(agent.tokenTank, 151);
  assert.equal(g.aiWorkerTokenTank, 151);
  assert.equal(g.managerTokenTank, 4000);
  assert.equal(agent.currentTask, task.id);
  agent.tokenTank = 150;
  g.aiWorkerTokenTank = 150;
  h.advance(100);
  h.api.tickManager();
  assert.equal(agent.tokenTank, 1500);
  assert.equal(g.aiWorkerTokenTank, 1500);
  assert.equal(g.managerTokenTank, 1300);
  h.advance(100);
  h.api.tickManager();
  assert.equal(g.managerTokenTank, 1300);
  agent.tokenTank = 0;
  g.aiWorkerShutdown = true;
  h.advance(100);
  h.api.tickManager();
  assert.equal(agent.tokenTank, 1300);
  assert.equal(g.managerTokenTank, 0);
  agent.tokenTank = 0;
  h.advance(100);
  h.api.tickManager();
  assert.equal(agent.tokenTank, 0);
});
scenario('CEO training speeds construction and DevOps retires technical debt automatically', (h) => {
  const g=h.fresh(10);g.cash=1e9;g.ceoMode='scale';h.api.openCluster();const first=g.clusters[0];assert.ok(first.buildDuration>=12&&first.buildDuration<=12.1);
  h.api.tickConstruction(first.buildDuration/4);assert.equal(first.buildRemaining,first.buildDuration*3/4);g.uiRevealed.clusters=true;h.api.renderClusterSection();assert.match(h.window.document.querySelector('#cluster-list').textContent,/Racking hardware/);
  g.phase=11;h.api.openCluster();assert.ok(g.clusters[1].buildDuration>=12&&g.clusters[1].buildDuration<=12.1);g.phase=14;h.api.openCluster();assert.ok(g.clusters[2].buildDuration>=2&&g.clusters[2].buildDuration<=2.1);
  h.api.tickConstruction(20);first.managerAssigned=true;first.tokenManagerAssigned=true;g.techDebt=10;h.api.tickDebt(10);assert.equal(g.techDebt,0);assert.equal(h.api.UPGRADES.some(u=>u.id==='pay_debt'),false);
});
scenario('prestige stops music and restores the introduction and first manual task', (h) => {
  const g=h.fresh(15);g.totalTasksDone=2000;h.api.unlockMusicPlayback();assert.ok(h.audioPlayers.some(player=>!player.paused));
  g.retired=true;h.window.GAME.prestige();const next=h.window.GAME.state;assert.ok(h.audioPlayers.every(player=>player.paused));assert.equal(next.gameStarted,false);assert.equal(next.tasks.length,0);assert.equal(next.milestonesReached.length,0);
  h.api.renderWorkStream();assert.equal(h.window.document.querySelector('#task-queue-section').style.display,'none');assert.match(h.window.document.querySelector('#intro-story').textContent,/bored/);
  h.window.document.querySelector('#btn-start-game').click();assert.equal(next.gameStarted,true);h.api.doEarlyTask();h.api.tickManualWork(1);assert.equal(next.totalTasksDone,1);assert.equal(next.uiRevealed.taskQueue,false);
});
scenario('ordinary upgrades appear in affordable and aspirational groups while transitions stay gated', (h) => {
  const g=h.fresh();g.purchasedUpgrades.push('tools_of_trade');g.totalTasksDone=15;g.cash=40;g.uiRevealed.upgrades=true;h.api.renderUpgradeSection();
  const cards=[...h.window.document.querySelectorAll('#upgrade-list .upgrade-card')];assert.equal(cards.length,3);assert.equal(cards.filter(card=>card.querySelector('button').disabled).length,2);
  g.totalTasksDone=50;assert.equal(h.api.upgradeVisible(h.api.UPGRADES.find(u=>u.id==='free_ai')),false);h.prepareUpgrade('free_ai');assert.equal(h.api.upgradeVisible(h.api.UPGRADES.find(u=>u.id==='free_ai')),true);
  g.totalTasksDone=0;g.purchasedUpgrades.push('free_ai');h.api.renderUpgradeSection();h.api.renderTaskQueue();assert.equal(h.window.document.querySelector('#upgrade-list').textContent,'');assert.equal(h.window.document.querySelector('#no-tasks').textContent,'');assert.ok(h.window.document.querySelector('.upgrade-space'));
  g.phase=9;h.prepareUpgrade('ai_ceo');h.api.renderUpgradeSection();assert.ok(h.window.document.querySelector('.upgrade-space'));assert.equal(h.window.document.querySelectorAll('#upgrade-list .upgrade-card').length,0);assert.match(h.window.document.querySelector('#upgrade-list').textContent,/Token Pack/);
  for(const upgrade of h.api.UPGRADES)assert.doesNotMatch(upgrade.desc,/Unlocks? Phase|Required before|Phase \d+ begins|for a Sales agent/);
});
scenario('Basic and Pro AI agents share token markup and button styling across licensing', (h) => {
  const g=h.fresh(3);g.totalTasksDone=1000;g.cash=1e6;g.uiRevealed.agents=true;h.prepareUpgrade('second_ai');h.api.purchaseUpgrade('second_ai');h.api.purchaseUpgrade('inference_tuning');h.api.purchaseUpgrade('prompt_refinement');h.api.purchaseUpgrade('context_pruning');h.api.renderAgentSection();
  const cards=[...h.window.document.querySelectorAll('#agent-list .agent-card')];assert.equal(cards.length,2);assert.deepEqual(cards.map(card=>card.querySelector('.name').firstChild.textContent.trim()),['AI 2000 Basic','AI 2000 Pro']);
  for(const card of cards){assert.equal(card.querySelector('.role').textContent,'');assert.equal(card.querySelector('.agent-token-count').nextElementSibling.className,'task-bar');}
  assert.equal(cards[0].querySelector('button').className,cards[1].querySelector('button').className);
  h.api.purchaseUpgrade('multi_bot');h.api.renderAgentSection();const text=h.window.document.querySelector('#agent-list').textContent;assert.match(text,/AI 2000 Basic/);assert.match(text,/Older model · slow/);assert.doesNotMatch(text,/sell to replace|AI subscription|worker/i);
  assert.equal(h.window.document.querySelectorAll('.agent-token-count').length,2);assert.deepEqual([...h.window.document.querySelectorAll('#agent-list .name')].map(el=>el.firstChild.textContent.trim()),['AI 2000 Basic','AI 2000 Pro']);
});
scenario('DevOps hiring and its agent card live in Incidents while management is highlighted', (h) => {
  const g=h.fresh(7);g.cash=1e6;g.agentSlots=8;g.managerUnlock=true;g.uiRevealed.agents=true;g.purchasedUpgrades.push('token_manager_unlock','devops_unlock');h.worker('manager');h.worker('token_mgr');
  h.api.renderAgentSection();h.api.renderIncidentSection();assert.equal(h.window.document.querySelectorAll('#agent-list .management-agent').length,2);assert.doesNotMatch(h.window.document.querySelector('#agent-list').textContent,/DevOps/);
  const hire=h.window.document.querySelector('#incident-devops button');assert.equal(hire.disabled,false);h.api.hireAgent('devops');h.api.renderAll();assert.match(h.window.document.querySelector('#incident-devops .agent-card').textContent,/DevOps/);
  const devops=g.agents.find(agent=>agent.roleId==='devops');h.api.fireAgent(devops.id);g.cash=0;h.api.renderIncidentSection();assert.equal(h.window.document.querySelector('#incident-devops button').disabled,true);
  g.cash=1e6;g.agentSlots=1;h.api.renderIncidentSection();assert.equal(h.window.document.querySelector('#incident-devops button').disabled,false);
  g.phase=6;g.purchasedUpgrades=[];g.uiRevealed.incidents=true;h.api.renderIncidentSection();assert.equal(h.window.document.querySelector('#incident-devops').textContent,'');
});
scenario('provisioning improvements bracket sixteen slots and remain visible during construction', (h) => {
  const g = h.fresh(10);
  g.cash = 1e10;
  g.totalTasksDone = 2e6;
  g.uiRevealed.upgrades = true;
  h.prepareUpgrade('ai_ceo');
  for (let index = 0; index < 5; index++) h.fullCluster();
  h.api.purchaseUpgrade('ai_ceo');
  h.api.purchaseUpgrade('ceo_recruitment');
  h.api.purchaseUpgrade('network_density');
  h.api.purchaseUpgrade('cluster_capacity_16');
  assert.ok(g.clusters.every(cluster => cluster.workerSlotsMax === 9));
  h.api.purchaseUpgrade('ceo_deploy_speed');
  h.api.purchaseUpgrade('cluster_capacity_16');
  assert.ok(g.clusters.every(cluster => cluster.workerSlotsMax === 16));
  assert.equal(g.ceoMode, 'manage');
  h.api.purchaseUpgrade('server_1');
  assert.equal(g.ceoMode, 'manage');
  h.api.purchaseUpgrade('ceo_batch');
  h.api.tickAiCeo();
  assert.equal(g.clusters[0].workerAgentIds.length, 10);
  assert.ok(g.agents.slice(-2).every(agent => agent.provisionDuration >= 2 / 1.5 && agent.provisionDuration <= 2 / 1.5 + 0.1));
  for (const cluster of g.clusters) {
    while (cluster.workerAgentIds.length < cluster.workerSlotsMax) h.api.buyNextClusterWorker(cluster.id);
  }
  h.api.tickConstruction(40);
  h.api.purchaseUpgrade('server_1');
  assert.equal(g.ceoMode, 'scale');
  const visible = () => h.api.UPGRADES.filter(h.api.upgradeVisible).map(upgrade => upgrade.id);
  const initial = visible();
  assert.ok(initial.includes('ceo_quad_batch'));
  h.advance(1000);
  h.api.tickAiCeo();
  const cluster = g.clusters.at(-1);
  assert.ok(cluster.buildRemaining > 0);
  assert.deepEqual(visible(), initial);
  h.api.purchaseUpgrade('ceo_quad_batch');
  h.api.tickConstruction(12.1);
  h.advance(1000);
  h.api.tickAiCeo();
  assert.equal(cluster.workerAgentIds.length, 4);
  h.advance(1000);
  h.api.tickAiCeo();
  assert.equal(cluster.workerAgentIds.length, 4);
  h.api.tickConstruction(3);
  h.advance(1000);
  h.api.tickAiCeo();
  assert.equal(cluster.workerAgentIds.length, 8);
  h.api.renderUpgradeSection();
  assert.match(h.window.document.querySelector('#upgrade-list').textContent, /Parallel Cluster Builds/);
  assert.match(h.window.document.querySelector('#upgrade-list').textContent, /Preassembled Server Racks/);
});
scenario('two and three managed clusters increase delivery speed without a retainer footer', (h) => {
  const g=h.fresh(9);const first=h.fullCluster();const agent=g.agents[0];const task=h.task();const baseline=h.api.workerSpeed(task,agent);h.fullCluster();assert.equal(h.api.workerSpeed(task,agent),baseline*1.5);h.fullCluster();assert.equal(h.api.workerSpeed(task,agent),baseline*2);
  g.uiRevealed.clusters=true;g.services=[{id:'one',name:'One',incomeRate:80,active:true},{id:'two',name:'Two',incomeRate:80,active:false}];g.techDebt=100;h.api.renderClusterSection();assert.doesNotMatch(h.window.document.querySelector('#cluster-list').textContent,/Client retainers|contract ·/);assert.doesNotMatch(h.window.document.querySelector('#cluster-list').textContent,/Recurring services|downtime|workers/);
  assert.equal(first.workerAgentIds.length,8);
});

scenario('original AI sale rejects early requests and releases any assigned task when available', (h) => {
  const g=h.fresh(3);h.api.shutdownAiWorker();assert.equal(g.aiWorkerShutdown,false);assert.match(g.log[0].msg,/cannot be sold yet/);
  g.phase=4;const task=h.task();task.status='ai';g.aiWorkerCurrentTaskId=task.id;g.aiWorkerTokenTank=10;h.api.shutdownAiWorker();assert.equal(g.aiWorkerShutdown,true);assert.equal(g.aiWorkerTokenTank,0);assert.equal(task.status,'available');assert.equal(g.aiWorkerCurrentTaskId,null);assert.match(g.log[0].msg,/AI agent sold/);
  h.api.shutdownAiWorker();assert.equal(g.aiWorkerShutdown,true);
});

scenario('Phase 10 scales real demand and continuously drains conserved reserve tokens', (h) => {
  const g=h.fresh(10);g.cash=0;g.tokens=200000;g.aiWorkerShutdown=true;g.totalTasksDone=3000;g.uiRevealed.taskQueue=true;g.taskSpawnMult=2.275;g.agentSpeedMult=2.8;g.tokenEfficiency=.402;g.workReduction=.4;g.codeSpeedMult=1.25;g.aiFailMult=0;g.smartRouting=true;
  for(let i=0;i<3;i++){const c=h.fullCluster();c.tank=4000;}for(const agent of g.agents)agent.tokenTank=1500;
  h.api.checkMilestones();h.dismiss();assert.equal(h.api.getMaxTasks(),36);g.tasks=[];h.advance(200);h.api.tickTaskSpawn();assert.equal(g.tasks.length,3);
  const inventory=()=>g.tokens+g.clusters.reduce((total,c)=>total+c.tank,0)+g.agents.reduce((total,a)=>total+a.tokenTank,0);const initial=inventory();const completed=g.totalTasksDone;
  for(let i=0;i<600;i++){h.advance(100);h.api.tick();h.dismiss();}
  assert.ok(g.tokensConsumed>25000);assert.ok(g.tokens<180000);assert.ok(g.totalTasksDone-completed>600);assert.ok(Math.abs(initial-inventory()-g.tokensConsumed)<.001);assert.ok(h.api.deliveryMetrics().rate>5);
  g.tasks=[];g.uiRevealed.taskQueue=false;h.advance(1000);h.api.tickTaskSpawn();assert.equal(g.tasks.length,0);
});
scenario('central Token Manager supplies each cluster before low worker tanks refill', (h) => {
  const g=h.fresh(10);g.tokens=10000;g.cash=0;const first=h.fullCluster();const second=h.fullCluster();first.tank=3000;second.tank=3000;
  h.api.tickTokenManager();assert.equal(first.tank,3250);assert.equal(second.tank,3250);assert.equal(g.tokens,9500);
  h.api.tickClusterManagers();for(const cluster of [first,second]){assert.deepEqual(Array.from(cluster.workerAgentIds,id=>g.agents.find(agent=>agent.id===id).tokenTank),[1500,1500,250,0,0,0,0,0]);assert.equal(cluster.tank,0);}
  first.tank=3990;second.tank=4000;g.tokens=5;h.api.tickTokenManager();assert.equal(first.tank,3995);assert.equal(second.tank,4000);assert.equal(g.tokens,0);
  g.cash=1e6;g.clusters=[];h.advance(3000);h.api.tickTokenManager();assert.ok(g.tokens>0);assert.match(h.api.deliveryMetrics().purchase,/tokens/);
  g.log=[];g.uiRevealed.clusters=true;h.api.renderClusterSection();assert.match(h.window.document.querySelector('.token-purchase').textContent,/Purchased/);assert.equal(h.window.document.querySelectorAll('.company-leadership .leadership-agent').length,2);
});
scenario('delivery summary collapses detail, keeps three completions and resets on phase and story changes', (h) => {
  const g=h.fresh(9);g.aiWorkerShutdown=true;g.uiRevealed.taskQueue=true;h.fullCluster();h.api.renderWorkStream();assert.equal(h.window.document.querySelector('#delivery-summary').hidden,true);
  h.fullCluster();const active=h.task();active.status='active';h.task();h.api.renderWorkStream();const summary=h.window.document.querySelector('#delivery-summary');assert.equal(summary.hidden,false);assert.equal(h.window.document.querySelector('#task-list').hidden,true);h.api.toggleDeliveryTasks();
  for(let i=0;i<4;i++){const task=h.task();task.name='Delivery '+i;h.api.completeTask(task,'manual');}h.dismiss();h.api.renderWorkStream();assert.equal(summary.querySelectorAll('li').length,3);assert.match(summary.textContent,/Delivery 3/);assert.doesNotMatch(summary.textContent,/Delivery 0/);
  h.window.GAME.toggleDeliveryTasks();assert.equal(h.window.document.querySelector('#task-list').hidden,true);assert.equal(summary.querySelector('button').getAttribute('aria-expanded'),'false');h.window.GAME.toggleDeliveryTasks();assert.equal(h.window.document.querySelector('#task-list').hidden,false);
  g.phase=10;h.api.renderWorkStream();assert.equal(h.window.document.querySelector('#task-list').hidden,false);assert.equal(h.api.deliveryMetrics().recent.length,3);
  g.phase=12;h.api.renderWorkStream();assert.equal(summary.querySelector('button'),null);assert.match(summary.textContent,/managed nodes/);assert.equal(summary.querySelector('li'),null);
  h.fresh();h.api.renderWorkStream();assert.equal(h.api.deliveryMetrics().recent.length,0);assert.equal(h.api.deliveryMetrics().rate,0);
});

scenario('buying the CEO preserves manually reopened tasks through later phase changes', (h) => {
  const g = h.fresh(10);
  g.cash = 1e9;
  g.totalTasksDone = 2000000;
  g.uiRevealed.taskQueue = true;
  g.uiRevealed.clusters = true;
  h.prepareUpgrade('ai_ceo');
  h.fullCluster();
  h.fullCluster();
  h.task();
  h.api.renderWorkStream();
  assert.equal(h.window.document.querySelector('#task-list').hidden, true);
  h.api.toggleDeliveryTasks();
  h.api.purchaseUpgrade('ai_ceo');
  h.api.renderWorkStream();
  assert.equal(h.window.document.querySelector('#task-list').hidden, false);
  assert.equal(h.window.document.querySelector('#task-count').textContent, '');
  assert.equal(h.window.document.querySelector('#delivery-summary button').textContent, 'Hide tasks ∧');
  assert.equal(h.window.document.querySelector('#task-list').hidden, false);
  g.phase = 11;
  h.api.renderWorkStream();
  assert.equal(h.window.document.querySelector('#task-list').hidden, false);
  const restored = harness(JSON.stringify(g));
  try {
    restored.api.renderWorkStream();
    assert.equal(restored.window.document.querySelector('#task-list').hidden, true);
  } finally {
    restored.close();
  }
});

scenario('cluster slots identify agents and distinguish empty slots from actual installations', (h) => {
  const g = h.fresh(9);
  g.cash = 1e6;
  g.uiRevealed.clusters = true;
  h.api.openCluster();
  const cluster = g.clusters[0];
  h.api.tickConstruction(12.1);
  h.api.renderClusterSection();
  const card = h.window.document.querySelector('div.cluster-card');
  assert.equal(card.querySelector('.cluster-status').textContent, 'Needs Agents');
  assert.equal(card.querySelector('.cluster-agents-label'), null);
  assert.ok(card.querySelector('.cluster-status').classList.contains('needs-agents'));
  assert.deepEqual([...card.querySelectorAll('.capacity-slot')].map(slot => slot.textContent), Array(8).fill('+'));
  assert.equal(card.querySelector('.capacity-slot').title, 'Add Cluster 1, agent slot 1');
  h.api.buyNextClusterWorker(cluster.id);
  h.api.renderClusterSection();
  assert.equal(card.querySelector('.cluster-status').textContent, 'Installing agents');
  assert.equal(card.querySelector('[role="progressbar"]').textContent, g.agents[0].name);
  h.api.tickConstruction(12);
  h.api.renderClusterSection();
  assert.equal(card.querySelector('.cluster-status').textContent, 'Partially Operational');
  assert.equal(card.querySelector('.capacity-slot.filled').textContent, g.agents[0].name);
  assert.equal(card.querySelector('.capacity-slot.filled').title, 'Cluster 1, agent slot 1 online');
  assert.doesNotMatch(h.window.document.querySelector('#cluster-list').textContent, /Client retainers/);
});

scenario('Dual Agent Provisioning has one definition and one rendered purchase', (h) => {
  const g = h.fresh(10);
  g.totalTasksDone = 2000000;
  g.uiRevealed.upgrades = true;
  h.prepareUpgrade('ceo_batch');
  assert.equal(h.api.UPGRADES.filter(upgrade => upgrade.name === 'Dual Agent Provisioning').length, 1);
  h.api.renderUpgradeSection();
  h.api.renderUpgradeSection();
  assert.equal(h.window.document.querySelectorAll('[onclick="GAME.buy(\'ceo_batch\')"]').length, 1);
});

scenario('cluster DevOps shows health while idle and incident details only when active', (h) => {
  const g = h.fresh(9);
  const cluster = h.fullCluster();
  h.api.renderIncidentSection();
  const health = h.window.document.querySelector('#operations-health');
  const heading = h.window.document.querySelector('#incidents-header').parentElement;
  assert.equal(health.hidden, false);
  assert.match(health.textContent, /Operations healthy.*DevOps included/);
  assert.equal(heading.hidden, true);
  assert.equal(h.window.document.querySelector('#no-incidents').style.display, 'none');
  h.api.triggerTutorialIncident();
  h.api.renderIncidentSection();
  assert.match(health.textContent, /1 incident.*Cluster DevOps responding/);
  assert.equal(heading.hidden, false);
  assert.equal(h.window.document.querySelectorAll('.incident-card').length, 1);
  h.api.createAiWorkerIncident(h.task());
  cluster.managerAssigned = false;
  h.api.renderIncidentSection();
  assert.match(health.textContent, /2 incidents.*Waiting for an online cluster/);
  cluster.managerAssigned = true;
  h.api.tickDevopsIncidentResponse(100);
  h.api.renderIncidentSection();
  assert.match(health.textContent, /Operations healthy/);
  assert.equal(h.window.document.querySelector('#incident-list').textContent, '');
  g.phase = 8;
  h.api.renderIncidentSection();
  assert.equal(health.hidden, true);
  assert.equal(heading.hidden, false);
  assert.equal(h.window.document.querySelector('#no-incidents').style.display, '');
});

scenario('cluster overview becomes denser as clusters and the next purchase tile are added', (h) => {
  const g = h.fresh(10);
  g.uiRevealed.clusters = true;
  g.purchasedUpgrades.push('cluster_capacity_3');
  for (let i = 0; i < 3; i++) h.fullCluster();
  h.api.renderClusterSection();
  assert.equal(h.window.document.querySelector('.cluster-overview'), null);
  g.ceoMode = 'manage';
  h.fullCluster();
  h.api.renderClusterSection();
  const overview = h.window.document.querySelector('.cluster-overview');
  assert.ok(overview);
  const width = parseFloat(overview.style.getPropertyValue('--cluster-card-min'));
  const padding = parseFloat(overview.style.getPropertyValue('--cluster-card-padding'));
  for (let i = 0; i < 4; i++) h.fullCluster();
  h.api.renderClusterSection();
  assert.equal(overview.querySelectorAll('div.cluster-card').length, 8);
  assert.ok(parseFloat(overview.style.getPropertyValue('--cluster-card-min')) < width);
  assert.ok(parseFloat(overview.style.getPropertyValue('--cluster-card-padding')) < padding);
  assert.equal(overview.querySelectorAll('.cluster-agents-label').length, 0);
  assert.equal(overview.querySelectorAll('details').length, 0);
});
scenario('provisioning occupies the first grid slot and respects unlocks capacity and cash', (h) => {
  const g=h.fresh(9);g.uiRevealed.clusters=true;h.fullCluster();h.api.renderClusterSection();assert.equal(h.window.document.querySelector('.provision-card'),null);
  g.purchasedUpgrades.push('cluster_capacity_2');h.api.renderClusterSection();let card=h.window.document.querySelector('.provision-card');assert.ok(card);assert.ok(card.parentElement.classList.contains('node-grid'));assert.equal(card.disabled,true);assert.equal(card.parentElement.firstElementChild,card);
  g.cash=1e6;h.api.renderClusterSection();assert.equal(card.disabled,false);h.api.openCluster();h.api.renderClusterSection();assert.equal(h.window.document.querySelector('.provision-card'),null);
  h.api.tickConstruction(12.1);for(let i=0;i<8;i++)h.api.buyNextClusterWorker(g.clusters[1].id,'coder');h.api.renderClusterSection();assert.ok([...h.window.document.querySelectorAll('.cluster-card button')].every(button=>button.textContent==='Sell'));
  g.phase=10;g.ceoMode='scale';h.api.renderClusterSection();assert.equal(h.window.document.querySelector('.provision-card'),null);assert.equal(h.window.document.querySelectorAll('.leadership-agent').length,2);
});
scenario('the first random AI incident shows its tutorial once before ordinary incidents', (h) => {
  const g=h.fresh(2);g.cash=1000;const task=h.task();h.api.createAiWorkerIncident(task);assert.equal(g.incidents.length,1);assert.equal(g.totalIncidents,1);assert.equal(g.incidents[0].sev,'warning');assert.equal(g.incidentsExplained,true);assert.equal(h.api.queue().filter(item=>item.title==='Your First Incident').length,1);
  h.api.triggerTutorialIncident();assert.equal(g.incidents.length,1);h.api.createAiWorkerIncident(task);assert.equal(g.incidents.length,2);assert.equal(h.api.queue().filter(item=>item.title==='Your First Incident').length,1);
  h.fresh(4);h.window.Math.random=()=>0;h.api.maybeCreateIncident(h.worker());assert.equal(h.window.GAME.state.incidents.length,1);assert.equal(h.window.GAME.state.incidentsExplained,true);
});
scenario('the timed incident cannot create a second failure in the same tick', (h) => {
  const g=h.fresh(2);g.aiRunSeconds=19.9;g.aiWorkerTokenTank=10;const task=h.task();task.workRequired=1e9;h.window.Math.random=()=>0;h.api.tickAiWorker(.2);assert.equal(g.totalIncidents,1);assert.equal(g.incidents.length,1);assert.equal(g.aiWorkerCurrentTaskId,task.id);assert.equal(task.workDone,0);
});
scenario('Phase 2 income includes the original AI and scales with Basic speed without inventing idle income', (h) => {
  const g=h.fresh(2);g.aiWorkerTokenTank=10;g.uiRevealed.topBar=true;g.uiRevealed.income=true;g.aiFailMult=0;const task=h.task();task.workRequired=100;task.pay=12;h.api.tickAiWorker(.1);
  const rate=h.api.getIncomeRate();assert.ok(rate>0);assert.ok(Math.abs(rate-12*h.api.originalAiWorkRate()/100)<1e-9);h.api.renderAll();assert.notEqual(h.window.document.querySelector('#income-rate').textContent,'+$0/s');assert.equal(h.api.getAiWorkerDisplayName(),'AI 2000 Free');
  task.workDone=99;assert.equal(h.api.getIncomeRate(),rate);g.phase=3;assert.ok(h.api.getIncomeRate()>rate);assert.equal(h.api.getAiWorkerDisplayName(),'AI 2000 Basic');g.aiWorkerTokenTank=0;assert.equal(h.api.getIncomeRate(),0);g.aiWorkerShutdown=true;assert.equal(h.api.getIncomeRate(),0);
});
scenario('failure training waits for three incidents and the paid tier has its own lifestyle', (h) => {
  const g=h.fresh(4);g.totalTasksDone=1200;g.cash=1e6;h.prepareUpgrade('prompt_basics');const upgrade=h.api.UPGRADES.find(item=>item.id==='prompt_basics');
  for(const count of [0,1,2]){g.totalIncidents=count;assert.equal(h.api.upgradeVisible(upgrade),false);h.api.purchaseUpgrade(upgrade.id);assert.equal(g.aiFailMult,1);}
  g.totalIncidents=3;h.api.purchaseUpgrade(upgrade.id);assert.equal(g.aiFailMult,.8);g.phase=3;g.uiRevealed.expenses=true;h.api.renderAll();assert.equal(h.window.document.querySelector('#expense-tier-label').textContent,'Coffee Shop Regular');assert.equal(h.api.UPGRADES.find(item=>item.id==='pro_model').name,'Upgrade to AI 2000 Basic');assert.doesNotMatch(h.api.UPGRADES.find(item=>item.id==='multi_bot').desc,/tokens|jobs/);
});
scenario('four-slot upgrade needs the third agent and two speed upgrades precede six usable slots', (h) => {
  const g=h.fresh(4);g.cash=1e7;g.totalTasksDone=1400;g.aiWorkerShutdown=true;h.worker('writer');h.worker('researcher');h.prepareUpgrade('agent_slot_3');const expansion=h.api.UPGRADES.find(item=>item.id==='agent_slot_3');assert.equal(expansion.cost,5000);assert.equal(h.api.upgradeVisible(expansion),false);
  h.api.hireAgent('writer');assert.equal(g.agents.length,3);assert.equal(h.api.upgradeVisible(expansion),true);h.api.purchaseUpgrade(expansion.id);assert.equal(h.api.getSharedAgentPoolSize(),4);h.api.hireAgent('writer');assert.equal(g.agents.length,4);
  h.prepareUpgrade('parallel_prompts');h.api.purchaseUpgrade('agent_slot_5');assert.equal(h.api.getSharedAgentPoolSize(),4);const speed=g.agentSpeedMult;h.api.purchaseUpgrade('parallel_prompts');assert.equal(g.agentSpeedMult,speed*1.15);h.api.purchaseUpgrade('agent_slot_5');assert.equal(h.api.getSharedAgentPoolSize(),4);h.api.purchaseUpgrade('response_streaming');assert.equal(g.agentSpeedMult,speed*1.15*1.2);h.api.purchaseUpgrade('agent_slot_5');assert.equal(h.api.getSharedAgentPoolSize(),6);
  h.api.hireAgent('writer');h.api.hireAgent('writer');assert.equal(g.agents.length,6);h.api.hireAgent('writer');assert.equal(g.agents.length,6);assert.equal(h.api.validSave(g),true);
});
scenario('dashed hiring cards reserve management roles and disable unaffordable hires', (h) => {
  const g=h.fresh(6);g.aiWorkerShutdown=true;g.agentSlots=6;g.managerUnlock=true;g.uiRevealed.agents=true;g.cash=19999;for(let i=0;i<6;i++)h.worker();h.api.renderAgentSection();let manager=h.window.document.querySelector('.manager-slot');assert.equal(manager.disabled,true);assert.equal(manager.parentElement.firstElementChild,manager);assert.equal(h.window.document.querySelector('.agent-vacancy'),null);const before=g.cash;h.api.hireAgent('manager');assert.equal(g.cash,before);
  g.cash=20000;h.api.renderAgentSection();assert.equal(manager.disabled,false);h.api.hireAgent('writer');assert.equal(g.agents.length,6);h.api.hireAgent('manager');assert.equal(g.cash,0);assert.equal(g.agents.length,7);g.cash=1e6;h.api.hireAgent('manager');assert.equal(g.agents.length,7);
  h.api.fireAgent(g.agents[0].id);g.cash=0;h.api.renderAgentSection();assert.equal(h.window.document.querySelectorAll('.agent-vacancy').length,1);assert.equal(h.window.document.querySelector('.agent-vacancy button').disabled,true);assert.equal(h.window.document.querySelectorAll('.agent-vacancy button').length,5);
});
scenario('phase cheats preserve their requested savings goals and prepare valid transitions', (h) => {
  const checkpoints = { 3: { cash: 1900 }, 4: { cash: 1300 }, 8: { tasks: 390000, cash: 800000 }, 9: { tasks: 1000000, cash: 1200000 }, 10: { tasks: 4600000, cash: 30000000, clusters: 3 }, 11: { tasks: 27000000, cash: 180000000, clusters: 5 }, 12: { tasks: 63000000, cash: 600000000, clusters: 21 } };
  for (const stage of ['0_1', '0_2', '0_3', '0_4']) assert.equal(Object.hasOwn(h.window, 'chPh' + stage), false);
  h.window.chPh0_();
  assert.equal(h.window.GAME.state.totalTasksDone, 35);
  for(const stage of ['0_',1]){h.window['chPh'+stage]();assert.equal(h.window.GAME.state.phase,1);assert.equal(h.api.validSave(h.window.GAME.state),true);}
  for(let stage=2;stage<=15;stage++){
    h.window['chPh'+stage]();const g=h.window.GAME.state;const upgrade=h.api.UPGRADES.find(item=>item.unlockPhase===stage);assert.equal(g.phase,stage-1,'chPh'+stage);assert.equal(h.api.validSave(g),true);
    const checkpoint = checkpoints[stage];
    if (checkpoint) {
      assert.equal(g.cash, checkpoint.cash);
      h.api.purchaseUpgrade(upgrade.id);
      assert.equal(g.phase, stage - 1);
      assert.equal(g.cash, checkpoint.cash);
      g.cash = upgrade.cost;
      if (checkpoint.clusters) {
        assert.equal(g.clusters.length, checkpoint.clusters);
        assert.equal(h.api.completedClusterCount(), checkpoint.clusters);
      }
    } else assert.ok(g.cash >= upgrade.cost);
    if(stage>=13){assert.equal(g.clusters.length,Math.max(upgrade.reqNodes-1,...h.api.UPGRADES.filter(item=>g.purchasedUpgrades.includes(item.id)).map(item=>item.reqNodes||0)));h.api.openCluster();h.api.tickConstruction(12.1);g.lastCeoAction=0;h.api.tickAiCeo();}else{assert.equal(g.totalTasksDone,checkpoint?.tasks ?? upgrade.reqTasks-3);if(g.totalTasksDone<upgrade.reqTasks)h.window.GAME.addTasks(3);}
    h.api.purchaseUpgrade(upgrade.id);h.api.tickSalePreparation(upgrade.saleDuration || 0);assert.equal(g.phase,stage,'transition '+stage);assert.equal(h.api.validSave(g),true);
  }
  h.window.GAME.state.retired=true;h.window.chPh6();assert.equal(h.window.GAME.state.phase,5);assert.equal(h.window.GAME.state.totalTasksDone,4997);assert.equal(new Set(h.window.GAME.state.agents.map(agent=>agent.roleId)).size,5);assert.equal(h.window.GAME.state.retired,false);
});

scenario('DevOps has a dedicated purchasable slot even when every shared slot is occupied', (h) => {
  const g=h.fresh(7);g.cash=1e7;g.aiWorkerShutdown=true;g.managerUnlock=true;g.agentSlots=7;g.purchasedUpgrades.push('token_manager_unlock','devops_unlock');g.uiRevealed.agents=true;
  for(let i=0;i<6;i++)h.worker('writer');h.worker('manager');h.worker('token_mgr');assert.equal(h.api.getSharedAgentPoolUsed(),8);h.api.renderAll();const slot=h.window.document.querySelector('#incident-devops .devops-slot');assert.equal(slot.tagName,'BUTTON');assert.ok(slot.classList.contains('hire-slot'));assert.equal(slot.disabled,false);assert.match(slot.textContent,/Buy DevOps.*Dedicated incident slot/);
  const price=h.api.getAgentHireCost(g.agents.length);const cash=g.cash;h.window.GAME.hire('devops');assert.equal(g.cash,cash-price);assert.equal(g.agents.length,9);assert.equal(h.api.getSharedAgentPoolUsed(),8);assert.equal(h.api.validSave(g),true);h.api.renderAll();assert.equal(h.window.document.querySelector('.agent-vacancy'),null);assert.ok(h.window.document.querySelector('#incident-devops .agent-card'));
  h.api.hireAgent('devops');assert.equal(g.agents.length,9);h.api.fireAgent(g.agents.find(a=>a.roleId==='manager').id);h.api.hireAgent('writer');assert.equal(h.api.getSharedAgentPoolUsed(),7);h.api.renderAgentSection();assert.equal(h.window.document.querySelector('.manager-slot').disabled,false);h.api.hireAgent('manager');assert.equal(h.api.getSharedAgentPoolUsed(),8);
});
scenario('each empty agent slot offers direct role purchases and accurate prices', (h) => {
  const g=h.fresh(4);g.aiWorkerShutdown=true;g.uiRevealed.agents=true;g.cash=0;h.worker('writer');h.worker('researcher');h.api.renderAgentSection();const slot=h.window.document.querySelector('.agent-vacancy');assert.equal(slot.querySelector('select'),null);assert.equal(slot.querySelectorAll('button').length,5);assert.ok([...slot.querySelectorAll('button')].every(button=>button.disabled));
  const price=h.api.getAgentHireCost(2);g.cash=price;h.api.renderAgentSection();const button=[...slot.querySelectorAll('button')].find(item=>item.textContent==='Buy Coder');assert.equal(button.disabled,false);h.window.eval(button.getAttribute('onclick'));assert.equal(g.cash,0);assert.equal(g.agents.at(-1).roleId,'coder');h.api.renderAgentSection();assert.equal(h.window.document.querySelector('.agent-vacancy'),null);
  assert.equal(h.api.UPGRADES.find(u=>u.id==='token_manager_unlock').desc,'Automatically buy tokens when they run out.');
});

scenario('agent warnings and integer cash rates remain consistent with the token warning', (h) => {
  const g=h.fresh(6);g.uiRevealed.agents=true;g.uiRevealed.topBar=true;g.cashRevealed=true;g.expensesRevealed=true;g.managerUnlock=true;g.tokens=3999;h.worker('manager');const agent=h.worker();
  h.api.renderAll();assert.ok(h.window.document.querySelector('#res-tokens-wrap').classList.contains('res-warning'));assert.equal(h.window.document.querySelector('#res-tokens-wrap .label').textContent,'Tokens');assert.equal(h.window.document.querySelectorAll('.agent-card.res-warning').length,3);
  g.managerTokenTank=10;agent.tokenTank=10;g.aiWorkerTokenTank=10;h.api.renderAll();assert.equal(h.window.document.querySelectorAll('.agent-card.res-warning').length,0);assert.ok(h.window.document.querySelector('.agent-info .name .role'));
  for(const selector of ['#income-rate','#expense-rate'])assert.match(h.window.document.querySelector(selector).textContent,/^[+-]\$[\d,]+\/s$/);
});
scenario('four and six agent expansions prevent later upgrades appearing out of order', (h) => {
  const g=h.fresh(4);g.cash=1e8;g.totalTasksDone=2000;g.aiWorkerShutdown=true;for(let i=0;i<3;i++)h.worker();h.prepareUpgrade('agent_slot_3');
  const visible=id=>h.api.upgradeVisible(h.api.UPGRADES.find(u=>u.id===id));assert.equal(visible('agent_slot_3'),true);for(const id of ['client_crm','prompt_basics','error_handling','parallel_prompts'])assert.equal(visible(id),false);
  h.api.purchaseUpgrade('agent_slot_3');assert.equal(visible('client_crm'),true);h.prepareUpgrade('agent_slot_5');assert.equal(visible('tool_use'),false);h.api.purchaseUpgrade('agent_slot_5');assert.equal(visible('tool_use'),true);
});
scenario('DevOps requires its own upgrade after the token-manager phase begins', (h) => {
  const g=h.fresh(7);g.cash=1e6;g.totalTasksDone=30000;g.uiRevealed.incidents=true;h.prepareUpgrade('compute_2');h.api.renderIncidentSection();assert.equal(h.window.document.querySelector('.devops-slot'),null);h.api.hireAgent('devops');assert.equal(g.agents.length,0);
  h.api.purchaseUpgrade('devops_unlock');assert.ok(g.purchasedUpgrades.includes('devops_unlock'));h.api.renderIncidentSection();assert.ok(h.window.document.querySelector('.devops-slot'));h.api.hireAgent('devops');assert.equal(g.agents[0].roleId,'devops');
});
scenario('Token Manager replenishes ahead of the warning even during rapid tank transfers', (h) => {
  const g=h.fresh(7);g.cash=1e9;g.tokens=4001;g.aiWorkerShutdown=true;g.managerUnlock=true;h.worker('manager');h.worker('token_mgr');for(let i=0;i<6;i++)h.worker();
  for(let i=0;i<100;i++){h.api.tickTokenManager();h.api.tickManager();h.advance(100);assert.ok(g.tokens>=4000);}
  g.phase=10;g.agents=[];g.tokens=4001;for(let i=0;i<5;i++)h.fullCluster();for(let i=0;i<30;i++){h.api.tickTokenManager();h.api.tickClusterManagers();h.advance(100);assert.ok(g.tokens>=4000);}
  g.cash=0;g.tokens=0;h.api.tickTokenManager();assert.equal(g.tokens,0);assert.equal(h.api.validSave(g),true);
});
scenario('batch upgrades count delivered tasks without multiplying cash or inflating job complexity', (h) => {
  const g=h.fresh(5);g.cash=1e9;g.totalTasksDone=1200;h.prepareUpgrade('bulk_jobs');const before=h.task();h.api.purchaseUpgrade('bulk_jobs');const task=h.task();assert.equal(before.batchSize,1);assert.ok(task.batchSize>=8&&task.batchSize<=12);const pay=h.api.getTaskCashPayout(task,'manual',null);const cash=g.cash;h.api.completeTask(task,'manual');assert.equal(g.totalTasksDone,1200+task.batchSize);assert.equal(g.cash,cash+pay);
  g.uiRevealed.taskQueue=true;const batch=h.task();h.api.renderTaskQueue();assert.match(h.window.document.querySelector('#task-list').textContent,new RegExp('Batch: '+batch.batchSize+' tasks'));g.totalTasksDone=1000000;const large=h.task();assert.ok(large.workRequired<1000);assert.equal(h.api.validSave(g),true);
  g.phase=12;g.batchSize=2000;const c=h.fullCluster();c.tank=4000;const count=g.totalTasksDone;h.api.tickNetwork(.1);assert.equal(g.totalTasksDone-count,1600);assert.ok(c.tank<4000);assert.ok(batch.batchSize>=8&&batch.batchSize<=12);
});
scenario('batch and provisioning save data reject invalid states and preserve construction', (h) => {
  const g=h.fresh(9);g.cash=1e6;h.api.openCluster();h.api.tickConstruction(12.1);h.api.buyNextClusterWorker(g.clusters[0].id);h.api.tickConstruction(2);const raw=JSON.stringify(g);const restored=harness(raw);try{assert.equal(restored.window.GAME.state.agents[0].provisionRemaining,g.agents[0].provisionRemaining);restored.api.tickConstruction(2.1);assert.equal(restored.window.GAME.state.agents[0].status,'idle');}finally{restored.close();}
  g.batchSize=0;assert.equal(h.api.validSave(g),false);g.batchSize=1;const task=h.task();task.batchSize=0;assert.equal(h.api.validSave(g),false);task.batchSize=1;g.agents[0].provisionDuration=0;assert.equal(h.api.validSave(g),false);g.agents[0].provisionDuration=4;g.agents[0].provisionRemaining=2;assert.equal(h.api.validSave(g),true);
  assert.equal(new Set(h.api.UPGRADES.map(u=>u.id)).size,h.api.UPGRADES.length);
});
scenario('compact nodes wait for paid agent installations to finish', (h) => {
  const g=h.fresh(11);g.cash=1e10;g.totalTasksDone=2000000;g.ceoMode='scale';g.uiRevealed.upgrades=true;h.prepareUpgrade('autonomous_nodes');const first=h.fullCluster();h.fullCluster();h.fullCluster();const id=first.workerAgentIds.pop();g.agents=g.agents.filter(agent=>agent.id!==id);h.api.buyNextClusterWorker(first.id);assert.equal(g.agents.at(-1).status,'provisioning');
  h.api.renderUpgradeSection();const button=h.window.document.querySelector('[onclick="GAME.buy(\'autonomous_nodes\')"]');assert.equal(button.disabled,true);h.api.purchaseUpgrade('autonomous_nodes');assert.equal(g.phase,11);h.api.tickConstruction(2);h.api.renderUpgradeSection();assert.equal(button.disabled,false);h.api.purchaseUpgrade('autonomous_nodes');assert.equal(g.phase,12);assert.equal(first.workforce,16);assert.equal(h.api.validSave(g),true);
});

scenario('parallel construction respects two active builds and charges each rising price', (h) => {
  const g=h.fresh(10);g.cash=1e10;g.ceoMode='scale';h.fullCluster();g.purchasedUpgrades.push('ceo_parallel_clusters','ceo_fast_builds');const before=g.cash;const firstPrice=h.api.provisionCost();h.api.tickAiCeo();assert.equal(g.clusters.length,3);assert.ok(g.clusters[1].buildDuration>=6&&g.clusters[1].buildDuration<=6.1);assert.ok(g.clusters[2].buildDuration>=6&&g.clusters[2].buildDuration<=6.1);assert.ok(g.clusters[2].invested>g.clusters[1].invested);assert.equal(before-g.cash,g.clusters[1].invested+g.clusters[2].invested);assert.equal(g.clusters[1].invested,firstPrice);
  h.advance(5000);h.api.tickAiCeo();assert.equal(g.clusters.length,3);g.cash=0;h.api.tickConstruction(6);h.advance(5000);h.api.tickAiCeo();assert.equal(g.clusters.length,3);assert.equal(g.clusters[1].workerAgentIds.length,0);
});
scenario('fully fitted racks pay for all agents and complete installations with construction', (h) => {
  const g=h.fresh(11);g.cash=1e10;g.ceoMode='scale';g.totalTasksDone=2000000;h.prepareUpgrade('ceo_full_fit');h.api.purchaseUpgrade('ceo_full_fit');const cost=h.api.provisionCost();const before=g.cash;h.api.openCluster();const c=g.clusters[0];assert.equal(before-g.cash,cost);assert.equal(c.invested,cost);assert.equal(c.workerAgentIds.length,16);assert.ok(g.agents.every(a=>a.status==='provisioning'));assert.equal(h.api.hasUnfinishedAgentInstallations(),false);assert.equal(h.api.completedClusterCount(),0);
  h.api.tickConstruction(c.buildDuration/2);assert.equal(h.api.completedClusterCount(),0);h.api.tickConstruction(c.buildDuration/2);assert.equal(h.api.completedClusterCount(),1);assert.ok(g.agents.every(a=>a.status==='idle'));assert.equal(h.api.validSave(g),true);
  const restored=harness(JSON.stringify(g));try{assert.equal(restored.api.completedClusterCount(),1);}finally{restored.close();}
});
scenario('fully fitted construction survives the compact-node transition without early delivery', (h) => {
  const g=h.fresh(11);g.cash=1e10;g.ceoMode='scale';g.totalTasksDone=2000000;h.prepareUpgrade('autonomous_nodes');for(let i=0;i<3;i++)h.fullCluster();h.api.openCluster();const c=g.clusters.at(-1);h.api.purchaseUpgrade('autonomous_nodes');assert.equal(g.phase,12);assert.equal(c.workforce,16);assert.equal(c.managerAssigned,false);c.tank=4000;h.api.tickNetwork(1);assert.equal(c.progress,0);h.api.tickConstruction(c.buildDuration);assert.equal(h.api.completedClusterCount(),4);assert.equal(h.api.validSave(g),true);
});
scenario('continuous deployment sustains two independently refilled builds without free agents', (h) => {
  const g=h.fresh(12);g.cash=1e12;g.ceoMode='scale';g.totalTasksDone=2000000;h.prepareUpgrade('ceo_continuous');h.fullCluster();h.api.purchaseUpgrade('ceo_continuous');assert.ok(g.purchasedUpgrades.includes('ceo_continuous'));const initial=g.cash;h.api.tickAiCeo();assert.equal(g.clusters.length,3);assert.equal(h.api.completedClusterCount(),1);
  for(let i=0;i<250;i++){h.advance(100);h.api.tickConstruction(.1);h.api.tickAiCeo();}assert.equal(h.api.completedClusterCount(),25);assert.equal(g.clusters.length,27);assert.ok(g.clusters.slice(1).every(c=>c.workforce===16));assert.equal(initial-g.cash,g.clusters.slice(1).reduce((sum,c)=>sum+c.invested,0));assert.equal(h.api.validSave(g),true);
  const upg=h.api.UPGRADES.find(u=>u.id==='replication');g.uiRevealed.upgrades=true;assert.equal(h.api.upgradeVisible(upg),true);h.api.renderUpgradeSection();const button=h.window.document.querySelector('[onclick="GAME.buy(\'replication\')"]');assert.equal(button.disabled,false);h.api.purchaseUpgrade('replication');assert.equal(g.phase,13);
  g.cash=0;const count=g.clusters.length;h.advance(2000);h.api.tickConstruction(2);h.api.tickAiCeo();assert.equal(g.clusters.length,count);
});
scenario('debug checkpoints finish and pay for partly staffed compact clusters', (h) => {
  const g=h.fresh(12);g.ceoMode='scale';g.cash=1e10;const c=h.fullCluster();c.workforce=3;const before=g.cash;h.api.fillCheatCompany(3);assert.equal(g.clusters.length,3);assert.ok(g.clusters.every(item=>item.workforce===16));assert.ok(g.cash<before);assert.equal(h.api.validSave(g),true);
});

scenario('the first paid tools appear at seven tasks and free AI reveals without its old modal', (h) => {
  const g = h.fresh();
  g.totalTasksDone = 6;
  h.api.checkMilestones();
  assert.equal(g.uiRevealed.upgrades, false);
  g.totalTasksDone = 7;
  h.api.checkMilestones();
  h.api.renderUpgradeSection();
  assert.equal(g.uiRevealed.upgrades, true);
  assert.equal(h.window.document.querySelectorAll('.upgrade-card').length, 1);
  assert.equal(h.window.document.querySelector('.upgrade-card button').textContent, 'Free');
  assert.equal(h.window.document.querySelector('[onclick="GAME.buy(\'post_it_notes\')"]'), null);
  h.api.purchaseUpgrade('tools_of_trade');
  h.api.renderUpgradeSection();
  assert.equal(h.window.document.querySelectorAll('.upgrade-card').length, 3);
  assert.equal(h.window.document.querySelector('[onclick="GAME.buy(\'post_it_notes\')"]').textContent, '$43');
  assert.equal(h.api.UPGRADES.find(upgrade => upgrade.id === 'post_it_notes').cost, 43);
  h.dismiss();
  g.totalTasksDone = 105;
  h.prepareUpgrade('free_ai');
  h.api.purchaseUpgrade('free_ai');
  h.api.checkMilestones();
  assert.equal(g.uiRevealed.agents, true);
  assert.equal(h.api.queue().some(popup => popup.title === 'AI Agent'), false);
  assert.equal(h.api.UPGRADES.find(upgrade => upgrade.id === 'free_ai').desc, 'Your first AI works through tasks automatically.');
  assert.equal(h.api.UPGRADES.find(upgrade => upgrade.id === 'prompt_examples').desc, '30% more work per prompt');
  assert.equal(h.api.UPGRADES.find(upgrade => upgrade.id === 'token_optimizer').name, 'KV Caching');
  assert.equal(h.api.UPGRADES.find(upgrade => upgrade.id === 'token_optimizer').desc, 'Reduces token use by 20%.');
  assert.equal(h.api.UPGRADES.find(upgrade => upgrade.id === 'token_compressor').desc, 'Shorter prompts reduce AI token use by 25%.');
  assert.equal(h.api.UPGRADES.find(upgrade => upgrade.id === 'token_distiller').desc, 'Reduces token use by 33%.');
});

for (const phase of [2, 3]) {
  scenario('Phase ' + phase + ' demand arrives one task at a time with busy spells and quiet gaps', (h) => {
    const g = h.fresh(phase);
    g.uiRevealed.taskQueue = true;
    g.totalTasksDone = phase === 2 ? 100 : 400;
    g.workReduction = 0.45;
    g.taskSpawnMult = phase === 2 ? 1 : 1.75;
    g.aiPowerMult = phase === 2 ? 1 : 1.3;
    g.aiFailMult = 0;
    g.incidentsExplained = true;
    assert.equal(h.api.getMaxTasks(), 12);
    const interval = h.api.getSpawnInterval();
    h.advance(interval - 1);
    h.api.tickTaskSpawn();
    assert.equal(g.tasks.length, 0);
    h.advance(1.01);
    h.api.tickTaskSpawn();
    assert.equal(g.tasks.length, 1);
    const delays = [];
    for (let arrival = 0; arrival < 100; arrival++) {
      g.tasks = [];
      const delay = h.api.getSpawnInterval();
      delays.push(delay);
      h.api.tickTaskSpawn();
      assert.equal(h.api.getSpawnInterval(), delay, 'Polling keeps the sampled delay');
      h.advance(delay - 0.01);
      h.api.tickTaskSpawn();
      assert.equal(g.tasks.length, 0);
      h.advance(0.02);
      h.api.tickTaskSpawn();
      assert.equal(g.tasks.length, 1);
    }
    assert.ok(new Set(delays).size > 90);
    assert.ok(delays.some(delay => delay < 300), 'Busy spells bring individual tasks close together');
    assert.ok(delays.some(delay => delay >= 1000), 'Quiet gaps leave room to catch up');
    g.tasks = [];
    let sawBacklog = false;
    let caughtUp = false;
    for (let step = 0; step < 600; step++) {
      h.advance(100);
      h.api.tickTaskSpawn();
      g.aiWorkerTokenTank = h.api.workerTokenCapacity();
      h.api.tickAiWorker(0.1);
      h.api.pruneTasks(h.window.Date.now());
      if (g.tasks.some(task => task.status === 'available')) sawBacklog = true;
      if (sawBacklog && g.tasks.every(task => task.status === 'done')) caughtUp = true;
    }
    assert.equal(sawBacklog, true);
    assert.equal(caughtUp, true);
    assert.ok(g.aiWorkerTasksCompleted > 0);
  });
}

scenario('both subscriptions take separate arrivals and consume their own tokens', (h) => {
  const g = h.fresh(3);
  g.cash = 1e6;
  g.totalTasksDone = 650;
  g.uiRevealed.taskQueue = true;
  g.aiFailMult = 0;
  g.incidentsExplained = true;
  h.prepareUpgrade('second_ai');
  h.api.purchaseUpgrade('second_ai');
  h.advance(Math.ceil(h.api.getSpawnInterval()));
  h.api.tickTaskSpawn();
  h.advance(Math.ceil(h.api.getSpawnInterval()));
  h.api.tickTaskSpawn();
  g.tokens = 200;
  h.api.topUpAiWorker();
  g.tokens = 100;
  const second = g.agents[0];
  h.api.topUpAgent(second.id);
  const originalTokens = g.aiWorkerTokenTank;
  const secondTokens = second.tokenTank;
  h.api.tickAiWorker(0.1);
  h.api.tickAgents(0.1);
  assert.ok(g.aiWorkerTokenTank < originalTokens);
  assert.ok(second.tokenTank < secondTokens);
  assert.notEqual(second.currentTask, g.aiWorkerCurrentTaskId);
});

scenario('Inference Tuning improves both subscriptions before the licence can appear', (h) => {
  const g = h.fresh(3);
  g.cash = 100000;
  g.totalTasksDone = 1000;
  g.uiRevealed.upgrades = true;
  h.prepareUpgrade('second_ai');
  const tuning = h.api.UPGRADES.find(upgrade => upgrade.id === 'inference_tuning');
  const licence = h.api.UPGRADES.find(upgrade => upgrade.id === 'multi_bot');
  assert.equal(h.api.upgradeVisible(tuning), false);
  h.api.purchaseUpgrade('second_ai');
  const pro = g.agents[0];
  const task = h.task();
  const basicSpeed = h.api.originalAiWorkRate();
  const proSpeed = h.api.workerSpeed(task, pro);
  const tokenRate = h.api.workerTokenRate();
  g.totalTasksDone = 899;
  assert.equal(h.api.upgradeVisible(tuning), false);
  h.api.purchaseUpgrade('inference_tuning');
  assert.equal(g.aiPowerMult, 1);
  g.totalTasksDone = 900;
  assert.equal(h.api.upgradeVisible(tuning), true);
  h.api.renderUpgradeSection();
  assert.match(h.window.document.querySelector('#upgrade-list').textContent, /Inference Tuning/);
  assert.equal(h.api.upgradeVisible(licence), false);
  g.totalTasksDone = 1000;
  h.api.purchaseUpgrade('multi_bot');
  assert.equal(g.phase, 3, 'The licence cannot bypass the performance upgrade');
  g.totalTasksDone = 900;
  g.cash = 5999;
  h.api.purchaseUpgrade('inference_tuning');
  assert.equal(g.cash, 5999);
  assert.equal(g.agentSpeedMult, 1);
  g.cash = 6000;
  h.api.purchaseUpgrade('inference_tuning');
  assert.equal(g.cash, 0);
  assert.equal(h.api.originalAiWorkRate(), basicSpeed * 1.15);
  assert.ok(Math.abs(h.api.workerSpeed(task, pro) - proSpeed * 1.15) < 1e-10);
  assert.equal(h.api.workerTokenRate(), tokenRate);
  assert.equal(h.api.upgradeVisible(licence), false);
  g.totalTasksDone = 1000;
  assert.equal(h.api.upgradeVisible(licence), true);
  g.cash = 4000;
  h.api.purchaseUpgrade('prompt_refinement');
  h.api.purchaseUpgrade('context_pruning');
  g.cash = 25000;
  h.api.purchaseUpgrade('multi_bot');
  assert.equal(g.phase, 4);
  assert.equal(g.cash, 0);
  assert.equal(h.api.validSave(g), true);
});

scenario('the second subscription checkpoint saves 870 tasks and $14K before the purchase', (h) => {
  h.window.GAME.state.retired = true;
  h.window.chPh3_1();
  const g = h.window.GAME.state;
  const second = h.api.UPGRADES.find(upgrade => upgrade.id === 'second_ai');
  const prior = h.api.UPGRADES.filter(upgrade => upgrade.oneTime && h.api.UPGRADES.indexOf(upgrade) < h.api.UPGRADES.indexOf(second));
  assert.equal(g.phase, 3);
  assert.equal(g.totalTasksDone, 870);
  assert.equal(g.totalClicks, 6960);
  assert.equal(g.cash, 14000);
  assert.equal(g.retired, false);
  assert.equal(g.agents.length, 0);
  assert.deepEqual([...g.purchasedUpgrades], [...prior].map(upgrade => upgrade.id));
  assert.equal(h.api.upgradeVisible(second), true);
  assert.equal(h.window.document.querySelector('[onclick="GAME.buy(\'second_ai\')"]').disabled, true);
  assert.equal(h.api.validSave(g), true);
  const restored = harness(h.window.localStorage.getItem('ai_empire_save'));
  try {
    const loaded = restored.window.GAME.state;
    assert.equal(loaded.totalTasksDone, 870);
    assert.equal(loaded.cash, 14000);
    assert.equal(restored.api.validSave(loaded), true);
    restored.api.purchaseUpgrade('second_ai');
    assert.equal(loaded.cash, 14000);
    loaded.cash += 4000;
    restored.api.purchaseUpgrade('second_ai');
    assert.equal(loaded.cash, 0);
    assert.equal(loaded.agents.length, 1);
    assert.equal(loaded.agents[0].name, 'AI 2000 Pro');
  } finally {
    restored.close();
  }
});

scenario('two inexpensive modest upgrades are required while the licence stays visible after tuning', (h) => {
  const g = h.fresh(3);
  g.cash = 100000;
  g.tokens = 1000;
  g.totalTasksDone = 1000;
  g.uiRevealed.upgrades = true;
  h.prepareUpgrade('second_ai');
  h.api.purchaseUpgrade('second_ai');
  const refinement = h.api.UPGRADES.find(upgrade => upgrade.id === 'prompt_refinement');
  const pruning = h.api.UPGRADES.find(upgrade => upgrade.id === 'context_pruning');
  const licence = h.api.UPGRADES.find(upgrade => upgrade.id === 'multi_bot');
  assert.equal(h.api.upgradeVisible(refinement), false);
  assert.equal(h.api.upgradeVisible(pruning), false);
  assert.equal(h.api.upgradeVisible(licence), false);
  h.api.purchaseUpgrade('inference_tuning');
  assert.equal(h.api.upgradeVisible(licence), true);
  h.api.renderUpgradeSection();
  const licenceButton = h.window.document.querySelector('[onclick="GAME.buy(\'multi_bot\')"]');
  assert.equal(licenceButton.disabled, true);
  h.api.purchaseUpgrade('multi_bot');
  assert.equal(g.phase, 3);
  const pro = g.agents[0];
  const task = h.task();
  task.workRequired = 1e6;
  const basicSpeed = h.api.originalAiWorkRate();
  const proSpeed = h.api.workerSpeed(task, pro);
  g.totalTasksDone = 924;
  assert.equal(h.api.upgradeVisible(refinement), false);
  h.api.purchaseUpgrade(refinement.id);
  assert.equal(h.api.originalAiWorkRate(), basicSpeed);
  g.totalTasksDone = 925;
  assert.equal(h.api.upgradeVisible(refinement), true);
  g.cash = 1499;
  h.api.purchaseUpgrade(refinement.id);
  assert.equal(g.cash, 1499);
  g.cash = 1500;
  h.api.purchaseUpgrade(refinement.id);
  assert.equal(g.cash, 0);
  assert.equal(h.api.originalAiWorkRate(), basicSpeed * 1.05);
  assert.ok(Math.abs(h.api.workerSpeed(task, pro) - proSpeed * 1.05) < 1e-10);
  h.api.purchaseUpgrade(refinement.id);
  assert.equal(h.api.originalAiWorkRate(), basicSpeed * 1.05);
  const efficiency = g.tokenEfficiency;
  g.totalTasksDone = 949;
  assert.equal(h.api.upgradeVisible(pruning), false);
  h.api.purchaseUpgrade(pruning.id);
  assert.equal(g.tokenEfficiency, efficiency);
  g.totalTasksDone = 950;
  assert.equal(h.api.upgradeVisible(pruning), true);
  g.cash = 2499;
  h.api.purchaseUpgrade(pruning.id);
  assert.equal(g.cash, 2499);
  g.cash = 2500;
  h.api.purchaseUpgrade(pruning.id);
  assert.equal(g.cash, 0);
  assert.equal(g.tokenEfficiency, efficiency * 0.95);
  h.api.topUpAiWorker();
  h.api.topUpAgent(pro.id);
  h.api.tickAiWorker(0.1);
  const proTask = h.task();
  proTask.workRequired = 1e6;
  h.api.assignAgentToTask(proTask.id, pro.id);
  const basicTokens = g.aiWorkerTokenTank;
  const proTokens = pro.tokenTank;
  h.api.tickAiWorker(0.1);
  h.api.tickAgents(0.1);
  const tokenRate = h.api.workerTokenRate() * efficiency * 0.95;
  assert.ok(Math.abs(basicTokens - g.aiWorkerTokenTank - tokenRate * 0.1) < 1e-9);
  assert.ok(Math.abs(proTokens - pro.tokenTank - tokenRate * 3 * 0.1) < 1e-9);
  g.totalTasksDone = 1000;
  g.cash = 24999;
  h.api.renderUpgradeSection();
  assert.equal(h.window.document.querySelector('[onclick="GAME.buy(\'multi_bot\')"]').disabled, true);
  g.cash = 25000;
  h.api.renderUpgradeSection();
  assert.equal(h.window.document.querySelector('[onclick="GAME.buy(\'multi_bot\')"]').disabled, false);
  h.api.purchaseUpgrade('multi_bot');
  assert.equal(g.phase, 4);
  assert.equal(g.cash, 0);
  assert.equal(h.api.validSave(g), true);
});

scenario('selling Basic preserves every worker slot through reload and replacement', (h) => {
  const g = h.fresh(3);
  g.cash = 1e6;
  g.totalTasksDone = 1000;
  g.uiRevealed.agents = true;
  h.prepareUpgrade('second_ai');
  h.api.purchaseUpgrade('second_ai');
  h.api.purchaseUpgrade('inference_tuning');h.api.purchaseUpgrade('prompt_refinement');h.api.purchaseUpgrade('context_pruning');
  h.api.purchaseUpgrade('multi_bot');
  h.api.hireAgent('coder', 2);
  const basic = g.agents.find(agent => agent.olderModel);
  const pro = g.agents.find(agent => agent.name === 'AI 2000 Pro');
  const coder = g.agents.find(agent => agent.roleId === 'coder');
  const task = h.task();
  basic.tokenTank = 40;
  h.api.assignAgentToTask(task.id, basic.id);
  h.api.fireAgent(basic.id);
  assert.equal(task.status, 'available');
  assert.equal(task.assignedAgent, null);
  h.api.renderAgentSection();
  const cards = [...h.window.document.querySelector('#agent-list').children];
  assert.deepEqual(cards.map(card => card.dataset.agentSlot), ['0', '1', '2']);
  assert.ok(cards[0].classList.contains('agent-vacancy'));
  assert.match(cards[0].textContent, /Agent slot 1/);
  assert.match(cards[1].textContent, /AI 2000 Pro/);
  assert.ok(cards[2].textContent.includes(coder.name));
  assert.equal(h.api.save(), true);
  const restored = harness(h.window.localStorage.getItem('ai_empire_save'));
  try {
    const loaded = restored.window.GAME.state;
    assert.equal(restored.api.validSave(loaded), true);
    assert.equal(loaded.agents.find(agent => agent.id === pro.id).slotIndex, 1);
    assert.equal(loaded.agents.find(agent => agent.id === coder.id).slotIndex, 2);
    const first = restored.window.document.querySelector('#agent-list').firstElementChild;
    assert.ok(first.classList.contains('agent-vacancy'));
    const buy = [...first.querySelectorAll('button')].find(button => button.textContent === 'Buy Writer');
    const cash = loaded.cash;
    const cost = restored.api.getAgentHireCost(loaded.agents.length);
    restored.window.eval(buy.getAttribute('onclick'));
    const replacement = loaded.agents.find(agent => agent.slotIndex === 0);
    assert.equal(replacement.olderModel, false);
    assert.equal(replacement.roleId, 'writer');
    assert.equal(loaded.cash, cash - cost);
    assert.ok(restored.api.workerSpeed(task, replacement) > h.api.workerSpeed(task, basic) * 2);
    restored.api.renderAgentSection();
    assert.equal(restored.window.document.querySelector('#agent-list').firstElementChild.dataset.agentSlot, '0');
    assert.equal(restored.window.document.querySelectorAll('.agent-vacancy').length, 0);
    restored.api.fireAgent(pro.id);
    restored.api.renderAgentSection();
    assert.equal(restored.window.document.querySelector('.agent-vacancy').dataset.agentSlot, '1');
    restored.api.hireAgent('analyst');
    assert.equal(loaded.agents.find(agent => agent.roleId === 'analyst').slotIndex, 1);
    assert.equal(loaded.agents.find(agent => agent.id === coder.id).slotIndex, 2);
    assert.equal(restored.api.validSave(loaded), true);
  } finally {
    restored.close();
  }
});

scenario('worker purchases respect the chosen vacancy and reject occupied or invalid slots', (h) => {
  const g = h.fresh(4);
  g.cash = 100000;
  g.uiRevealed.agents = true;
  for (const slot of [-1, 0, 0.5, 3, NaN]) h.api.hireAgent('coder', slot);
  assert.equal(g.agents.length, 0);
  assert.equal(g.cash, 100000);
  h.api.hireAgent('coder', 2);
  assert.equal(g.agents[0].slotIndex, 2);
  const cash = g.cash;
  h.api.hireAgent('writer', 2);
  assert.equal(g.cash, cash);
  assert.equal(g.agents.length, 1);
  h.api.renderAgentSection();
  assert.deepEqual([...h.window.document.querySelectorAll('#agent-list [data-agent-slot]')].map(card => card.dataset.agentSlot), ['0', '1', '2']);
  h.api.shutdownAiWorker();
  h.api.hireAgent('writer');
  assert.equal(g.agents[1].slotIndex, 0);
  h.api.hireAgent('researcher');
  assert.equal(g.agents[2].slotIndex, 1);
  assert.equal(h.api.validSave(g), true);
});

scenario('arrival delays survive reloads and neither full queues nor time jumps create batches', (h) => {
  const g = h.fresh(3);
  g.uiRevealed.taskQueue = true;
  h.advance(Math.ceil(h.api.getSpawnInterval()));
  h.api.tickTaskSpawn();
  const delay = h.api.getSpawnInterval();
  const restored = harness(JSON.stringify(g));
  try {
    const loaded = restored.window.GAME.state;
    restored.advance(h.window.Date.now() - restored.window.Date.now());
    assert.equal(loaded.lastTaskSpawn, g.lastTaskSpawn);
    assert.equal(loaded.taskSpawnDelay, g.taskSpawnDelay);
    assert.equal(restored.api.getSpawnInterval(), delay);
    restored.advance(delay - 0.01);
    restored.api.tickTaskSpawn();
    assert.equal(loaded.tasks.length, 1);
    restored.advance(0.02);
    restored.api.tickTaskSpawn();
    assert.equal(loaded.tasks.length, 2);
  } finally {
    restored.close();
  }
  while (g.tasks.length < h.api.getMaxTasks()) h.task();
  h.advance(60000);
  h.api.tickTaskSpawn();
  assert.equal(g.tasks.length, h.api.getMaxTasks());
  g.tasks = [];
  h.api.tickTaskSpawn();
  assert.equal(g.tasks.length, 0);
  h.advance(60000);
  h.api.tickTaskSpawn();
  assert.equal(g.tasks.length, 1);
});

scenario('save validation enforces persistent slot identities and a positive arrival delay', (h) => {
  const g = h.fresh(4);
  g.aiWorkerShutdown = true;
  const first = h.worker();
  const second = h.worker();
  assert.equal(h.api.validSave(g), true);
  second.slotIndex = first.slotIndex;
  assert.equal(h.api.validSave(g), false);
  second.slotIndex = 0.5;
  assert.equal(h.api.validSave(g), false);
  second.slotIndex = 1;
  g.taskSpawnDelay = 0;
  assert.equal(h.api.validSave(g), false);
  g.taskSpawnDelay = 1;
  assert.equal(h.api.validSave(g), true);
  const previous = JSON.stringify({...g, saveVersion: 8});
  const restored = harness(previous);
  try {
    assert.equal(restored.window.GAME.state.phase, 1);
    assert.equal(restored.window.localStorage.getItem('ai_empire_save'), previous);
    assert.match(restored.window.document.querySelector('#save-status').textContent, /older version/);
    assert.equal(restored.api.save(), false);
  } finally {
    restored.close();
  }
});

scenario('the free AI tank drains twice as fast and needs another top-up after four seconds', (h) => {
  const g = h.fresh(2);
  g.aiFailMult = 0;
  g.incidentsExplained = true;
  const task = h.task();
  task.workRequired = 1e6;
  h.api.topUpAiWorker();
  assert.equal(g.aiWorkerTokenTank, 10);
  assert.equal(h.api.workerTokenRate(), 2.4);
  h.api.tickAiWorker(4);
  assert.ok(Math.abs(g.aiWorkerTokenTank - 0.4) < 1e-9);
  h.api.tickAiWorker(1);
  assert.equal(g.aiWorkerTokenTank, 0);
  assert.equal(g.tokensConsumed, 10);
  assert.ok(Math.abs(task.workDone - 78.125) < 1e-9);
  h.api.topUpAiWorker();
  assert.equal(g.aiWorkerTokenTank, 10);
  assert.equal(g.tokens, 0);
});

scenario('opening checkpoints leave the intended upgrade groups ready to play', (h) => {
  const checkpoints = [
    ['0_2', 7, ['post_it_notes', 'gas_station_coffee', 'sticky_note_system']],
    ['0_', 35, ['side_hustle', 'inbox_zero', 'gtd_workflow']],
    ['0_4', 100, ['free_ai']],
  ];
  for (const [stage, tasks, expected] of checkpoints) {
    h.window.GAME.cheat(stage);
    const g = h.window.GAME.state;
    assert.equal(g.phase, 1);
    assert.equal(g.totalTasksDone, tasks);
    assert.deepEqual(Array.from(h.api.UPGRADES.filter(h.api.upgradeVisible), upgrade => upgrade.id), expected);
    assert.equal(h.window.document.querySelectorAll('.upgrade-card').length, expected.length);
    assert.ok(expected.every(id => !g.purchasedUpgrades.includes(id)));
    assert.equal(h.api.validSave(g), true);
  }
  const g = h.window.GAME.state;
  assert.equal(h.window.document.querySelector('.upgrade-card button').textContent, '105 tasks');
  assert.equal(h.window.document.querySelector('.upgrade-card button').disabled, true);
  for (let i = 0; i < 5; i++) h.task();
  h.api.clickTask(g.tasks[0].id);
  h.api.tickManualWork(10);
  assert.equal(g.totalTasksDone, 105);
  h.api.purchaseUpgrade('free_ai');
  assert.equal(g.phase, 2);
});

scenario('pressure, tools and Manager milestones retain their effects without a modal', (h) => {
  const g = h.fresh();
  g.totalTasksDone = 12;
  h.api.checkMilestones();
  assert.equal(g.uiRevealed.stress, true);
  assert.ok(g.milestonesReached.includes('stress_unlock'));
  assert.equal(h.api.queue().some(popup => popup.title === 'Pressure Building'), false);
  h.dismiss();
  for (const [phase, id, tasks] of [[4, 'tool_use', 1150], [5, 'manager_agent', 5000]]) {
    const state = h.fresh(phase);
    state.cash = 1e6;
    state.totalTasksDone = tasks;
    h.prepareUpgrade(id);
    h.api.checkMilestones();
    h.dismiss();
    h.api.purchaseUpgrade(id);
    assert.equal(state.phase, phase + 1);
    assert.equal(h.api.queue().length, 0);
    assert.equal(h.window.document.querySelector('#milestone-popup').classList.contains('show'), false);
    if (id === 'manager_agent') assert.equal(state.managerUnlock, true);
  }
});

scenario('Phase 2 offers useful improvements at regular early milestones before Basic', (h) => {
  const g = h.fresh(2);
  g.cash = 1e6;
  g.uiRevealed.taskQueue = true;
  g.uiRevealed.upgrades = true;
  h.prepareUpgrade('prompt_library');
  for (const [id, tasks] of [['prompt_library', 115], ['gig_alerts', 145], ['prompt_examples', 175], ['marketing_campaign', 225]]) {
    const upgrade = h.api.UPGRADES.find(item => item.id === id);
    g.totalTasksDone = tasks - 1;
    assert.equal(h.api.upgradeVisible(upgrade), false);
    h.api.purchaseUpgrade(id);
    assert.equal(g.purchasedUpgrades.includes(id), false);
    g.totalTasksDone = tasks;
    assert.equal(h.api.upgradeVisible(upgrade), true);
    h.api.purchaseUpgrade(id);
    assert.ok(g.purchasedUpgrades.includes(id));
  }
  assert.ok(Math.abs(g.aiPowerMult - 1.43) < 1e-9);
  assert.equal(g.taskSpawnMult, 2.1875);
  g.totalTasksDone = 300;
  g.cash = 2000;
  h.api.purchaseUpgrade('pro_model');
  assert.equal(g.phase, 3);
  assert.equal(g.cash, 0);
});

scenario('Client Outreach stays beside the second subscription and supplies both AIs with more work', (h) => {
  const g = h.fresh(3);
  g.cash = 1e6;
  g.tokens = 100000;
  g.totalTasksDone = 650;
  g.uiRevealed.taskQueue = true;
  g.uiRevealed.upgrades = true;
  g.taskSpawnMult = 2.1875;
  g.clickPower = 2;
  g.workReduction = 0.45;
  g.aiPowerMult = 1.43;
  g.aiFailMult = 0;
  g.incidentsExplained = true;
  h.prepareUpgrade('client_outreach');
  h.api.renderUpgradeSection();
  const secondButton = h.window.document.querySelector('[onclick="GAME.buy(\'second_ai\')"]');
  assert.ok(h.window.document.querySelector('[onclick="GAME.buy(\'client_outreach\')"]'));
  assert.ok(secondButton);
  assert.equal(secondButton.disabled, true);
  h.api.purchaseUpgrade('second_ai');
  assert.equal(g.agents.length, 0);
  const interval = h.api.getSpawnInterval();
  h.api.purchaseUpgrade('client_outreach');
  assert.equal(h.api.getSpawnInterval(), interval / 2);
  h.api.renderUpgradeSection();
  assert.equal(h.window.document.querySelector('[onclick="GAME.buy(\'second_ai\')"]').disabled, false);
  h.api.purchaseUpgrade('second_ai');
  const second = g.agents[0];
  second.reliability = 2;
  for (let step = 0; step < 1200; step++) {
    h.advance(100);
    h.api.tickTaskSpawn();
    if (g.aiWorkerTokenTank < 1) h.api.topUpAiWorker();
    if (second.tokenTank < 1) h.api.topUpAgent(second.id);
    h.api.tickAiWorker(0.1);
    h.api.tickAgents(0.1);
    h.api.pruneTasks(h.window.Date.now());
  }
  assert.ok(g.aiWorkerTasksCompleted > 100);
  assert.ok(second.tasksCompleted > 100, 'Pro receives sustained work from the larger pipeline');
  assert.ok(g.tokensConsumed > 0);
});

scenario('late Phase 5 orchestration bridges the wait for Manager and remains a prerequisite', (h) => {
  const g = h.fresh(5);
  g.cash = 1e6;
  g.totalTasksDone = 3499;
  h.prepareUpgrade('workflow_orchestration');
  const upgrade = h.api.UPGRADES.find(item => item.id === 'workflow_orchestration');
  assert.equal(h.api.upgradeVisible(upgrade), false);
  g.totalTasksDone = 3500;
  assert.equal(h.api.upgradeVisible(upgrade), true);
  g.totalTasksDone = 5000;
  h.api.purchaseUpgrade('manager_agent');
  assert.equal(g.phase, 5);
  h.api.purchaseUpgrade('workflow_orchestration');
  assert.equal(g.taskSpawnMult, 1.25);
  assert.equal(g.agentSpeedMult, 1.2);
  h.api.purchaseUpgrade('manager_agent');
  assert.equal(g.phase, 6);
});

scenario('hiring a Manager lets loaded tanks drain before refilling empty workers', (h) => {
  const g = h.fresh(6);
  g.cash = 1e6;
  g.tokens = 4000;
  g.aiWorkerShutdown = true;
  g.managerUnlock = true;
  g.agentSlots = 6;
  const loaded = h.worker();
  const empty = h.worker();
  loaded.tokenTank = 750;
  for (let i = 0; i < 2; i++) {
    const task = h.task();
    task.typeId = 'email';
  }
  h.api.hireAgent('manager');
  assert.equal(loaded.tokenTank, 750);
  assert.equal(empty.tokenTank, 1500);
  assert.equal(g.managerTokenTank, 2500);
  assert.equal(loaded.status, 'working');
  assert.equal(empty.status, 'working');
});

for (const phase of [9, 10, 11]) {
  scenario('Phase ' + phase + ' cluster managers refill only low tanks and conserve their supply', (h) => {
    const g = h.fresh(phase);
    const cluster = h.fullCluster();
    const workers = g.agents;
    for (const agent of workers) agent.tokenTank = 151;
    cluster.tank = 4000;
    h.api.tickClusterManagers();
    assert.ok(workers.every(agent => agent.tokenTank === 151));
    assert.equal(cluster.tank, 4000);
    workers[0].tokenTank = 150;
    h.api.tickClusterManagers();
    assert.equal(workers[0].tokenTank, 1500);
    assert.equal(cluster.tank, 2650);
    cluster.tank = 50;
    workers[1].tokenTank = 0;
    h.api.tickClusterManagers();
    assert.equal(workers[1].tokenTank, 50);
    assert.equal(cluster.tank, 0);
    assert.equal(h.api.validSave(g), true);
  });
}

scenario('DevOps appears earlier in Phase 7 with its task reveal kept in the background', (h) => {
  const g = h.fresh(7);
  g.totalTasksDone = 27999;
  g.cash = 60000;
  g.uiRevealed.upgrades = true;
  h.prepareUpgrade('devops_unlock');
  h.api.renderUpgradeSection();
  assert.equal(h.window.document.querySelector('[onclick="GAME.buy(\'devops_unlock\')"]'), null);
  g.totalTasksDone = 28000;
  h.api.renderUpgradeSection();
  const button = h.window.document.querySelector('[onclick="GAME.buy(\'devops_unlock\')"]');
  assert.equal(button.textContent, '$60.0K');
  assert.equal(button.disabled, false);
  assert.doesNotMatch(button.closest('.upgrade-card').textContent, /28,000|tasks/);
  h.api.purchaseUpgrade('devops_unlock');
  assert.equal(g.cash, 0);
});

scenario('upgrade buttons contain the full cash or token price without a separate cost label', (h) => {
  const g = h.fresh(3);
  g.uiRevealed.upgrades = true;
  g.totalTasksDone = 350;
  g.cash = 1000;
  h.prepareUpgrade('token_optimizer');
  h.api.renderUpgradeSection();
  const button = id => h.window.document.querySelector('[onclick="GAME.buy(\'' + id + '\')"]');
  assert.equal(button('token_optimizer').textContent, '$1.0K');
  assert.equal(button('token_optimizer').disabled, false);
  assert.equal(button('token_pack_1').textContent, '$110');
  assert.equal(h.window.document.querySelector('.upgrade-cost'), null);
  g.tokens = 5;
  h.api.UPGRADES.push({ id: 'test_tokens', name: 'Test tokens', desc: 'Token purchase', phase: 3, cost: 5, currency: 'tokens', oneTime: true });
  h.prepareUpgrade('test_tokens');
  h.api.renderUpgradeSection();
  assert.equal(button('test_tokens').textContent, '5 tok');
  h.api.UPGRADES.at(-1).oneTime = false;
  h.api.renderUpgradeSection();
  assert.equal(button('test_tokens').textContent, '5 tok');
});

scenario('CEO expansion previews the next cluster without making a purchase or offering a button', (h) => {
  const g = h.fresh(10);
  g.ceoMode = 'scale';
  g.uiRevealed.clusters = true;
  g.cash = 1e12;
  h.api.renderClusterSection();
  assert.equal(h.window.document.querySelector('.planning-card'), null);
  const stages = ['Negotiating with council', 'Drafting lease', 'Searching for land'];
  for (const stage of stages) {
    h.fullCluster();
    const before = g.cash;
    h.api.renderClusterSection();
    const planning = h.window.document.querySelector('.planning-card');
    assert.equal(planning.tagName, 'DIV');
    assert.equal(planning.getAttribute('onclick'), null);
    assert.equal(planning.querySelector('button'), null);
    assert.match(planning.textContent, new RegExp(stage));
    assert.equal(g.cash, before);
  }
  g.cash = 0;
  h.api.renderClusterSection();
  assert.match(h.window.document.querySelector('.planning-card').textContent, /Securing \$[0-9.]+[KMB]? funding/);
  g.phase = 14;
  for (const cluster of g.clusters) cluster.workforce = cluster.workerSlotsMax;
  h.api.renderClusterSection();
  assert.equal(h.window.document.querySelector('.planning-card strong').textContent, 'C4');
  g.ceoMode = 'manage';
  h.api.renderClusterSection();
  assert.equal(h.window.document.querySelector('.planning-card'), null);
});

scenario('late expansion accelerates gradually and respects the fourfold speed limit', (h) => {
  const g = h.fresh(13);
  g.ceoMode = 'scale';
  g.cash = 1e12;
  g.purchasedUpgrades.push('ceo_continuous', 'ceo_parallel_clusters', 'ceo_full_fit');
  for (let index = 0; index < 40; index++) h.fullCluster();
  assert.equal(h.api.expansionSpeed(), 1);
  g.phase = 14;
  assert.equal(h.api.clusterBuildDuration(), 2);
  for (let index = 0; index < 20; index++) h.fullCluster();
  assert.equal(h.api.expansionSpeed(), 2);
  assert.equal(h.api.clusterBuildDuration(), 1);
  g.lastCeoAction = h.window.Date.now();
  h.advance(249);
  h.api.tickAiCeo();
  assert.equal(g.clusters.length, 64);
  h.advance(1);
  h.api.tickAiCeo();
  assert.equal(g.clusters.length, 64);
  assert.ok(g.clusters.at(-1).buildDuration >= 1 && g.clusters.at(-1).buildDuration <= 1.1);
  while (h.api.completedClusterCount() < 100) h.fullCluster();
  g.phase = 15;
  assert.equal(h.api.expansionSpeed(), 4);
  assert.equal(h.api.clusterBuildDuration(), 0.5);
  g.purchasedUpgrades = [];
  assert.equal(h.api.clusterBuildDuration(), 0.5);
  g.purchasedUpgrades.push('ceo_fast_builds');
  assert.equal(h.api.clusterBuildDuration(), 0.25);
  g.clusters = [];
  assert.equal(h.api.expansionSpeed(), 1);
});

scenario('network task throughput grows in stages while cash and token costs stay consistent', (h) => {
  const g = h.fresh(12);
  g.ceoMode = 'scale';
  g.batchSize = 2000;
  const cluster = h.fullCluster();
  for (const [phase, tasks] of [[12, 16000], [13, 24000], [14, 56000], [15, 56000]]) {
    g.phase = phase;
    g.cash = 0;
    g.totalTasksDone = 0;
    g.tokensConsumed = 0;
    cluster.tank = 4000;
    cluster.progress = 0;
    h.api.tickNetwork(1);
    assert.equal(g.totalTasksDone, tasks);
    assert.equal(g.cash, 240);
    assert.equal(g.tokensConsumed, 2400);
  }
});

scenario('the CEO keeps expanding while the player can choose the Golden Parachute', (h) => {
  const g = h.fresh(15);
  g.ceoMode = 'scale';
  g.cash = 5e9;
  h.fullCluster();
  h.api.tickAiCeo();
  assert.equal(g.clusters.length, 5);
  assert.equal(g.cash, 5e9 - g.clusters.slice(1).reduce((total, cluster) => total + cluster.invested, 0));
  g.clustersProvisioned = 5000;
  assert.ok(h.api.provisionCost() > 5e9);
  h.advance(1000);
  h.api.tickAiCeo();
  assert.equal(g.clusters.length, 5);
  assert.equal(g.cash, 5e9 - g.clusters.slice(1).reduce((total, cluster) => total + cluster.invested, 0));
});

scenario('prestige adds a real slot at each capacity upgrade, including the former four-slot no-op', (h) => {
  const g = h.fresh(4);
  g.prestigeBonusSlot = true;
  g.agentSlots = 3;
  g.cash = 1e8;
  g.totalTasksDone = 2000;
  for (let index = 0; index < 3; index++) h.worker();
  assert.equal(h.api.getSharedAgentPoolSize(), 4);
  h.prepareUpgrade('agent_slot_3');
  h.api.purchaseUpgrade('agent_slot_3');
  assert.equal(h.api.getSharedAgentPoolSize(), 5);
  h.prepareUpgrade('agent_slot_5');
  h.api.purchaseUpgrade('agent_slot_5');
  assert.equal(h.api.getSharedAgentPoolSize(), 7);
});

scenario('chRetire prepares an immediate Golden Parachute and retirement restores the original music', (h) => {
  h.api.unlockMusicPlayback();
  h.window.chRetire();
  const g = h.window.GAME.state;
  assert.equal(g.phase, 15);
  assert.equal(g.retired, false);
  assert.equal(g.totalTasksDone, 1e9);
  assert.equal(h.api.completedClusterCount(), 500);
  assert.equal(h.api.canSellCompany(), true);
  assert.equal(h.api.validSave(g), true);
  const button = h.window.document.querySelector('[onclick="GAME.buy(\'fusion\')"]');
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, '$5.00B');
  h.window.eval(button.getAttribute('onclick'));
  assert.equal(g.retired, true);
  const base = h.audioPlayers.find(player => player.src === 'soundtrack-loop.mp3');
  assert.equal(base.paused, false);
  assert.ok(h.audioPlayers.filter(player => player !== base).every(player => player.paused));
  base.currentTime = 42;
  h.api.syncMusicPlayback();
  assert.equal(base.currentTime, 42);
  g.musicMode = 'off';
  h.api.syncMusicPlayback();
  assert.ok(h.audioPlayers.every(player => player.paused));
  g.musicMode = 'on';
  h.api.save();
  const restored = harness(h.window.localStorage.getItem('ai_empire_save'), {seed: 8675309});
  try {
    restored.api.unlockMusicPlayback();
    assert.ok(restored.audioPlayers.some(player => player.src === 'soundtrack-loop.mp3' && !player.paused));
    assert.ok(restored.audioPlayers.filter(player => player.src !== 'soundtrack-loop.mp3').every(player => player.paused));
  } finally {
    restored.close();
  }
});
