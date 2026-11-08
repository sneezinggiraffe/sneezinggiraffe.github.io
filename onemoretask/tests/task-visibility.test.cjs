const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

function desk(h) {
  const state = h.fresh(5);
  state.aiWorkerShutdown = true;
  const jobs = Array.from({ length: 5 }, () => h.task());
  h.api.renderTaskQueue();
  const document = h.window.document;
  document.querySelector('#work-stream').getBoundingClientRect = () => ({ top: 50, bottom: 600, left: 5, right: 500 });
  const cards = [...document.querySelector('#task-list').children];
  for (const [index, card] of cards.entries()) {
    card.getBoundingClientRect = () => ({ top: 80 + index * 110, bottom: 180 + index * 110, left: 10, right: 210, width: 200, height: 100 });
  }
  return { state, jobs, cards };
}

test('only fully visible notes are eligible, using desk and viewport bounds', () => {
  const h = harness(undefined, { deskGeometry: true });
  try {
    const { jobs, cards } = desk(h);
    assert.deepEqual(Array.from(h.api.availableTasks()), jobs.slice(0, 4));
    const valid = cards[0].getBoundingClientRect();
    for (const invalid of [{ width: 0 }, { height: 0 }, { top: 49 }, { left: -1 }, { left: 4 }, { right: 501 }, { right: h.window.innerWidth + 1 }, { bottom: h.window.innerHeight + 1 }]) {
      cards[0].getBoundingClientRect = () => ({ ...valid, ...invalid });
      assert.equal(h.api.visibleTaskIds().has(jobs[0].id), false);
    }
    cards[0].getBoundingClientRect = () => valid;
    h.window.document.querySelector('#work-stream').getBoundingClientRect = () => ({ top: -10, bottom: 1000, left: -10, right: 2000 });
    assert.equal(h.api.visibleTaskIds().has(jobs[0].id), true);
  } finally { h.close(); }
});

test('AI and agents take displayed order, with specialist eligibility when required', () => {
  const h = harness(undefined, { deskGeometry: true });
  try {
    const { jobs } = desk(h);
    jobs[0].createdAt = 9999999;
    jobs[1].createdAt = 1;
    jobs[0].typeId = 'code';
    jobs[1].typeId = 'email';
    const agent = h.worker('writer');
    agent.specialty = ['email'];
    assert.equal(h.api.pickNextAiTask(), jobs[0]);
    assert.equal(h.api.findMatchingTask(agent), jobs[1]);
    assert.equal(h.api.findMatchingTask(agent, true), jobs[0]);
    jobs.slice(0, 4).forEach(job => { job.status = 'active'; });
    assert.equal(h.api.pickNextAiTask(), null);
    assert.equal(h.api.findMatchingTask(agent), null);
  } finally { h.close(); }
});

test('full manual capacity blocks selection and automatic workers leave hidden tasks queued', () => {
  const h = harness(undefined, { deskGeometry: true });
  try {
    const { state, jobs, cards } = desk(h);
    state.purchasedUpgrades.push('hire_assistant', 'multitasking');
    const agent = h.worker('writer');
    agent.tokenTank = 100;
    jobs.slice(0, 4).forEach(job => { job.status = 'active'; });
    h.api.clickTask(jobs[4].id);
    h.api.doWork(undefined, jobs[4].id);
    h.api.tickAssistant(1);
    h.api.assignAgentToTask(jobs[4].id, agent.id);
    assert.equal(jobs[4].status, 'available');
    jobs.slice(0, 4).forEach(job => { job.status = 'done'; });
    cards[4].getBoundingClientRect = () => ({ top: 80, bottom: 180, left: 10, right: 210, width: 200, height: 100 });
    h.api.tickAssistant(1);
    assert.equal(jobs[4].status, 'assistant');
    cards[4].getBoundingClientRect = () => ({ top: 800, bottom: 900, left: 10, right: 210, width: 200, height: 100 });
    h.api.tickAssistant(3);
    assert.equal(jobs[4].status, 'done');
  } finally { h.close(); }
});

test('opening work and aggregate cluster delivery remain available without individual cards', () => {
  const h = harness(undefined, { deskGeometry: true });
  try {
    const state = h.fresh();
    const job = h.task();
    assert.equal(h.api.visibleTaskIds().has(job.id), true);
    state.uiRevealed.taskQueue = true;
    state.phase = 10;
    assert.equal(h.api.visibleTaskIds().has(job.id), false);
    state.clusters = [{}, {}];
    assert.equal(h.api.visibleTaskIds().has(job.id), true);
    state.clusters = [];
    state.phase = 11;
    assert.equal(h.api.visibleTaskIds().has(job.id), true);
  } finally { h.close(); }
});

test('Multitasking rechecks space after the first task expands in the stack', () => {
  const h = harness(undefined, { deskGeometry: true });
  try {
    const { state, jobs, cards } = desk(h);
    state.purchasedUpgrades.push('multitasking');
    cards[1].getBoundingClientRect = () => ({ top: 200, bottom: jobs[0].status === 'active' ? 650 : 300, left: 10, right: 210, width: 200, height: 100 });
    h.api.doWork();
    assert.equal(jobs[0].status, 'active');
    assert.equal(jobs[1].status, 'available');
    assert.equal(state.totalClicks, 1);
  } finally { h.close(); }
});

test('explicit selection starts any queued task regardless of desk visibility', () => {
  for (const action of ['clickTask', 'doWork']) {
    const h = harness(undefined, { deskGeometry: true });
    try {
      const { state, jobs } = desk(h);
      if (action === 'clickTask') h.api.clickTask(jobs[4].id);
      else h.api.doWork(undefined, jobs[4].id);
      assert.equal(jobs[4].status, 'active');
      assert.equal(state.activeTaskId, jobs[4].id);
      assert.ok(jobs.slice(0, 4).every(job => job.status === 'available'));
      h.api.tickManualWork(0.1);
      assert.ok(jobs[4].workDone > 0);
    } finally { h.close(); }
  }
});

test('selected tasks retain capacity and ownership checks and multitasking fills a visible slot', () => {
  const h = harness(undefined, { deskGeometry: true });
  try {
    const { state, jobs } = desk(h);
    state.purchasedUpgrades.push('multitasking');
    h.api.doWork(undefined, 'missing');
    jobs[3].status = 'assistant';
    h.api.doWork(undefined, jobs[3].id);
    h.api.clickTask(jobs[3].id);
    assert.equal(state.totalClicks, 0);
    h.api.doWork(undefined, jobs[4].id);
    assert.equal(jobs[4].status, 'active');
    assert.equal(jobs[0].status, 'active');
    h.api.doWork(undefined, jobs[2].id);
    h.api.clickTask(jobs[2].id);
    assert.equal(jobs[2].status, 'available');
    assert.equal(jobs[3].status, 'assistant');
    assert.equal(state.totalClicks, 1);
  } finally { h.close(); }
});
