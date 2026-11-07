const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

function repairFixture(t, phase = 2) {
  const h = harness();
  t.after(() => h.close());
  const g = h.fresh(phase);
  g.cash = 1000;
  g.aiWorkerShutdown = true;
  g.lastTaskSpawn = h.window.Date.now() + 1e9;
  h.api.triggerTutorialIncident();
  h.dismiss();
  return { h, g, inc: g.incidents[0] };
}

test('manual repair takes exactly two seconds through the game tick and releases its work slot', (t) => {
  const { h, g, inc } = repairFixture(t);
  const task = h.task();
  const cash = g.cash;
  h.api.resolveIncident(inc.id, 'manual');
  assert.equal(inc.resolved, false);
  assert.equal(inc.fixProgress, 0);
  assert.equal(h.api.availableManualSlots(), 0);
  h.api.clickTask(task.id);
  h.api.doWork();
  assert.equal(task.status, 'available');
  assert.equal(h.window.document.querySelector(`[data-task-id="${task.id}"]`).disabled, true);
  for (let step = 0; step < 19; step++) { h.advance(100); h.api.tick(); }
  assert.equal(inc.fixProgress, 95);
  assert.equal(inc.resolved, false);
  h.advance(100); h.api.tick();
  assert.equal(inc.fixProgress, 100);
  assert.equal(inc.resolved, true);
  assert.equal(g.cash, cash);
  assert.equal(h.api.availableManualSlots(), 1);
  h.api.doWork();
  assert.equal(task.status, 'active');
  h.advance(500);
  assert.equal(g.incidents.includes(inc), false);
});

test('repair buttons keep their labels and share the DevOps progress bar', (t) => {
  const { h, inc } = repairFixture(t);
  h.worker('devops');
  h.api.renderIncidentSection();
  const list = h.window.document.querySelector('#incident-list');
  assert.equal(list.querySelector('.sev'), null);
  assert.equal(h.window.document.querySelector('#incident-count'), null);
  assert.deepEqual([...list.querySelectorAll('button')].map(button => button.textContent), ['Fix Manually', 'Pay to Fix ($40)']);
  assert.match(list.textContent, /DevOps responding/);
  h.api.resolveIncident(inc.id, 'manual');
  h.api.renderIncidentSection();
  assert.equal(list.querySelectorAll('.task-bar').length, 1);
  assert.equal(list.querySelector('.task-bar-fill').style.width, '0%');
  assert.equal(list.querySelector('button').disabled, true);
  h.api.tickManualRepairs(1);
  h.api.renderIncidentSection();
  assert.equal(list.querySelector('.task-bar-fill').style.width, '50%');
  assert.match(list.textContent, /Fixing manually \(50%\)/);
  assert.doesNotMatch(list.textContent, /DevOps responding|stress/i);
  inc.sev = 'critical';
  h.api.renderIncidentSection();
  assert.equal(list.querySelector('.sev'), null);
  assert.doesNotMatch(list.textContent, /critical|warning|\d+ active/i);
});

test('busy manual slots block repairs and multitasking permits a task alongside a repair', (t) => {
  const { h, g, inc } = repairFixture(t);
  const task = h.task();
  task.workRequired = 10000;
  h.api.clickTask(task.id);
  h.api.resolveIncident(inc.id, 'manual');
  assert.equal(inc.manualRepair, undefined);
  h.api.renderIncidentSection();
  assert.match(h.window.document.querySelector('#incident-list').textContent, /Manual slot busy/);
  assert.equal(h.window.document.querySelector('#incident-list button').disabled, true);
  g.purchasedUpgrades.push('multitasking');
  h.api.resolveIncident(inc.id, 'manual');
  h.api.tickManualRepairs(0.5);
  h.api.resolveIncident(inc.id, 'manual');
  assert.equal(inc.fixProgress, 25);
  h.api.tickManualWork(0.5);
  assert.ok(task.workDone > 0);
  assert.equal(h.api.availableManualSlots(), 0);
  assert.equal(h.api.validSave(g), true);
  assert.equal(h.window.document.querySelector(`[data-task-id="${task.id}"]`).disabled, true);
});

test('manual repairs immediately block new work even with a free multitasking slot', (t) => {
  const { h, g, inc } = repairFixture(t);
  g.purchasedUpgrades.push('multitasking');
  const task = h.task();
  h.task();
  h.api.resolveIncident(inc.id, 'manual');
  const card = h.window.document.querySelector(`[data-task-id="${task.id}"]`);
  assert.equal(h.api.availableManualSlots(), 1);
  assert.equal(card.disabled, true);
  card.click();
  h.api.doWork();
  h.api.clickTask(task.id);
  assert.equal(g.tasks.filter(task => task.status === 'active').length, 0);
  h.api.tickManualRepairs(2);
  assert.equal(card.disabled, false);
  card.click();
  assert.equal(g.tasks.filter(task => task.status === 'active').length, 2);
  assert.equal(h.api.validSave(g), true);
});

test('DevOps advances other incidents without doubling manual repair or discarding prior progress', (t) => {
  const { h, g, inc } = repairFixture(t, 8);
  h.worker('devops');
  h.api.tickDevopsIncidentResponse(2);
  assert.equal(inc.fixProgress, 22);
  h.api.createAiWorkerIncident(h.task());
  const other = g.incidents[1];
  h.api.resolveIncident(inc.id, 'manual');
  h.api.tickDevopsIncidentResponse(1);
  assert.equal(inc.fixProgress, 22);
  assert.ok(other.fixProgress > 0);
  h.api.tickManualRepairs(1.55);
  assert.equal(inc.resolved, false);
  h.api.tickManualRepairs(0.01);
  assert.equal(inc.fixProgress, 100);
  assert.equal(inc.resolved, true);
  h.advance(500);
  assert.equal(g.incidents.length, 1);
  assert.equal(g.incidents[0], other);
});

test('paid repair remains instant during manual work and cannot charge twice', (t) => {
  const { h, g, inc } = repairFixture(t);
  const task = h.task();
  g.purchasedUpgrades.push('multitasking');
  h.api.resolveIncident(inc.id, 'manual');
  h.api.tickManualRepairs(0.5);
  g.cash = 0;
  h.api.resolveIncident(inc.id, 'cash');
  assert.equal(inc.resolved, false);
  assert.equal(inc.fixProgress, 25);
  g.cash = 100;
  h.api.resolveIncident(inc.id, 'cash');
  assert.equal(g.cash, 60);
  assert.equal(h.window.document.querySelector(`[data-task-id="${task.id}"]`).disabled, false);
  assert.equal(inc.resolved, true);
  assert.equal(inc.fixProgress, 100);
  assert.equal(h.api.availableManualSlots(), 2);
  h.api.resolveIncident(inc.id, 'cash');
  h.api.resolveIncident('missing', 'manual');
  h.api.tickManualRepairs(2);
  assert.equal(g.cash, 60);
  h.advance(500);
  assert.equal(g.incidents.length, 0);
});

test('two manual repairs use both multitasking slots and reject a third', (t) => {
  const { h, g, inc } = repairFixture(t);
  g.purchasedUpgrades.push('multitasking');
  h.api.createAiWorkerIncident(h.task());
  h.api.createAiWorkerIncident(h.task());
  for (const incident of g.incidents) h.api.resolveIncident(incident.id, 'manual');
  assert.equal(h.api.manualRepairs().length, 2);
  assert.equal(g.incidents[2].manualRepair, undefined);
  assert.equal(h.api.validSave(g), true);
  h.api.tickManualRepairs(3);
  assert.equal(inc.fixProgress, 100);
  assert.equal(h.api.manualRepairs().length, 0);
  assert.equal(h.api.availableManualSlots(), 2);
});

test('existing saves with stress and partial incidents load unchanged and new repairs survive reload', (t) => {
  const { h, g, inc } = repairFixture(t);
  g.stress = 87;
  g.uiRevealed.stress = true;
  g.milestonesReached.push('stress_unlock');
  inc.fixProgress = 30;
  const version = g.saveVersion;
  const raw = JSON.stringify(g);
  const restored = harness(raw);
  t.after(() => restored.close());
  const loaded = restored.window.GAME.state;
  assert.equal(loaded.saveVersion, version);
  assert.equal(loaded.stress, 87);
  assert.equal(loaded.uiRevealed.stress, true);
  assert.ok(loaded.milestonesReached.includes('stress_unlock'));
  assert.equal(loaded.incidents[0].fixProgress, 30);
  assert.equal(loaded.cash, g.cash);
  assert.equal(loaded.totalTasksDone, g.totalTasksDone);
  assert.equal(restored.api.validSave(loaded), true);
  restored.api.renderAll();
  assert.equal(restored.window.document.querySelector('#res-stress-wrap'), null);
  restored.api.resolveIncident(inc.id, 'manual');
  restored.api.tickManualRepairs(0.4);
  assert.equal(loaded.incidents[0].fixProgress, 50);
  assert.equal(restored.api.save(), true);
  const resumed = harness(restored.window.localStorage.getItem('ai_empire_save'));
  t.after(() => resumed.close());
  assert.equal(resumed.api.availableManualSlots(), 0);
  resumed.api.tickManualRepairs(0.9);
  assert.equal(resumed.window.GAME.state.incidents[0].resolved, false);
  resumed.api.tickManualRepairs(0.1);
  assert.equal(resumed.window.GAME.state.incidents[0].resolved, true);
  assert.equal(resumed.window.GAME.state.stress, 87);
  assert.equal(resumed.api.validSave(resumed.window.GAME.state), true);
});

test('save validation accepts optional repair flags but rejects invalid flags and overbooked slots', (t) => {
  const { h, g, inc } = repairFixture(t);
  assert.equal(h.api.validSave(g), true);
  inc.manualRepair = false;
  assert.equal(h.api.validSave(g), true);
  inc.manualRepair = 'yes';
  assert.equal(h.api.validSave(g), false);
  inc.manualRepair = null;
  assert.equal(h.api.validSave(g), false);
  inc.manualRepair = true;
  const task = h.task();
  task.status = 'active';
  assert.equal(h.api.validSave(g), false);
  inc.resolved = true;
  assert.equal(h.api.validSave(g), true);
});
