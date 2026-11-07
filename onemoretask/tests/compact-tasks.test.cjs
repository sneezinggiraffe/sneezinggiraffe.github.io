const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

function inbox(h, phase = 1) {
  const state = h.fresh(phase);
  state.uiRevealed.taskQueue = true;
  state.totalTasksDone = 35;
  const tasks = Array.from({ length: 3 }, () => h.task());
  for (const task of tasks) task.workRequired = 1;
  h.api.renderAll();
  return { state, tasks, document: h.window.document };
}

test('clicking a task title starts that task and immediately disables Do work', () => {
  const h = harness();
  try {
    const { state, tasks, document } = inbox(h);
    const clicks = state.totalClicks;
    const selected = document.querySelector(`[data-task-id="${tasks[2].id}"]`);
    selected.querySelector('.task-name').click();
    assert.equal(tasks[2].status, 'active');
    assert.equal(tasks[0].status, 'available');
    assert.equal(state.totalClicks, clicks + 1);
    assert.equal(document.querySelector('#btn-do-task').disabled, true);
    assert.equal(selected.disabled, true);
    assert.ok([...document.querySelectorAll('#task-list > button')].every(card => card.disabled));
    selected.click();
    assert.equal(state.totalClicks, clicks + 1);
    h.api.tickManualWork(10);
    h.api.pruneTasks(h.window.Date.now());
    h.api.renderAll();
    assert.equal(document.querySelector('#btn-do-task').disabled, false);
    assert.equal(document.querySelector(`[data-task-id="${tasks[0].id}"]`).disabled, false);
  } finally { h.close(); }
});

test('a clicked task takes priority while Multitasking fills both work slots', () => {
  const h = harness();
  try {
    const { state, tasks, document } = inbox(h);
    state.purchasedUpgrades.push('multitasking');
    document.querySelector(`[data-task-id="${tasks[2].id}"]`).click();
    assert.equal(tasks[2].status, 'active');
    assert.equal(tasks[0].status, 'active');
    assert.equal(tasks[1].status, 'available');
    assert.equal(document.querySelector('#btn-do-task').disabled, true);
    assert.equal(state.totalClicks, 1);
  } finally { h.close(); }
});

test('owned tasks, missing task IDs and queue background clicks cannot start another task', () => {
  const h = harness();
  try {
    const { state, tasks, document } = inbox(h);
    tasks[1].status = 'assistant';
    h.api.renderTaskQueue();
    const before = JSON.stringify(state);
    document.querySelector(`[data-task-id="${tasks[1].id}"]`).click();
    h.api.doWork(undefined, tasks[1].id);
    h.api.doWork(undefined, 'missing-task');
    document.querySelector('#task-list').click();
    assert.equal(JSON.stringify(state), before);
  } finally { h.close(); }
});

test('task cards respect manual repair, stopped-game and retirement guards', () => {
  const h = harness();
  try {
    const { state, tasks, document } = inbox(h);
    state.incidents.push({ resolved: false, manualRepair: true });
    h.api.renderWorkStream();
    assert.equal(document.querySelector(`[data-task-id="${tasks[0].id}"]`).disabled, true);
    document.querySelector(`[data-task-id="${tasks[0].id}"]`).click();
    assert.equal(tasks[0].status, 'available');
    state.incidents = [];
    state.gameStarted = false;
    h.api.doWork(undefined, tasks[0].id);
    state.gameStarted = true;
    state.retired = true;
    h.api.doWork(undefined, tasks[0].id);
    assert.equal(tasks[0].status, 'available');
    assert.equal(state.totalClicks, 0);
  } finally { h.close(); }
});

test('card angles vary across the full range and remain stable without using gameplay randomness', () => {
  const h = harness();
  let restored;
  try {
    const { state, tasks, document } = inbox(h);
    const angles = Array.from({ length: 200 }, (_, index) => Number(h.api.taskCardAngle('task-' + index)));
    assert.ok(angles.every(angle => angle >= -2 && angle <= 2.4));
    assert.ok(Math.min(...angles) < -1.8);
    assert.ok(Math.max(...angles) > 2.2);
    assert.ok(new Set(angles).size > 180);
    let randomCalls = 0;
    h.window.Math.random = () => { randomCalls++; return 0.5; };
    const angle = document.querySelector(`[data-task-id="${tasks[0].id}"]`).style.getPropertyValue('--paper-angle');
    tasks[0].workDone = 0.2;
    state.tasks.reverse();
    h.api.renderTaskQueue();
    h.api.selectLayout('4');
    h.api.renderTaskQueue();
    assert.equal(document.querySelector(`[data-task-id="${tasks[0].id}"]`).style.getPropertyValue('--paper-angle'), angle);
    assert.equal(randomCalls, 0);
    h.api.save();
    restored = harness(h.window.localStorage.getItem('ai_empire_save'));
    assert.equal(restored.window.document.querySelector(`[data-task-id="${tasks[0].id}"]`).style.getPropertyValue('--paper-angle'), angle);
  } finally {
    if (restored) restored.close();
    h.close();
  }
});

test('the opening uses a clickable card with a clear instruction before moving work into You', () => {
  const h = harness();
  try {
    const document = h.window.document;
    const start = document.querySelector('#btn-start-game');
    assert.equal(start.classList.contains('opening-task-card'), true);
    assert.match(start.textContent, /Click to find your first gig/);
    start.click();
    const work = document.querySelector('#btn-do-task');
    for (let index = 0; index < 3; index++) {
      assert.equal(work.classList.contains('opening-task-card'), true);
      assert.equal(document.querySelector('#prelude-hint').hidden, false);
      assert.match(document.querySelector('#prelude-hint').textContent, /Click to start/);
      work.click();
      assert.equal(work.disabled, true);
      assert.equal(document.querySelector('#prelude-details').hidden, false);
      assert.equal(document.querySelector('#prelude-hint').hidden, true);
      h.api.tickManualWork(10);
      h.api.pruneTasks(h.window.Date.now());
      h.api.renderAll();
    }
    assert.equal(work.classList.contains('opening-task-card'), false);
    assert.equal(work.parentElement.id, 'you-controls');
    document.querySelector('[data-task-id="setup_inbox"]').click();
    assert.equal(work.disabled, true);
    assert.equal(h.window.GAME.state.tasks.find(task => task.id === 'setup_inbox').status, 'active');
    assert.equal(document.querySelector('#task-count'), null);
    assert.equal(document.querySelector('#task-queue-section h3').textContent, 'Tasks Complete: 3');
  } finally { h.close(); }
});

test('the expanded queue accepts thirty live tasks and stops spawning at its cap', () => {
  const h = harness();
  try {
    const state = h.fresh(2);
    state.uiRevealed.taskQueue = true;
    for (let index = 0; index < 35; index++) h.api.spawnTask();
    assert.equal(h.api.getMaxTasks(), 30);
    assert.equal(state.tasks.length, 30);
    state.tasks.pop();
    h.api.spawnTask();
    assert.equal(state.tasks.length, 30);
  } finally { h.close(); }
});
