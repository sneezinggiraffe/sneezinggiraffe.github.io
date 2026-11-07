const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

for (const completedIndexes of [[0], [2], [0, 1]]) {
  test(`completing notes ${completedIndexes.join(',')} leaves all surviving cards attached in place`, () => {
    const h = harness();
    try {
      const state = h.fresh();
      state.uiRevealed.taskQueue = true;
      state.totalTasksDone = 35;
      const tasks = Array.from({ length: 6 }, () => h.task());
      h.api.renderTaskQueue();
      const list = h.window.document.querySelector('#task-list');
      const originals = new Map([...list.children].map(card => [card.dataset.taskId, card]));
      const moved = [];
      const insertBefore = list.insertBefore.bind(list);
      list.insertBefore = (node, reference) => {
        if (node.parentElement === list) moved.push(node.dataset.taskId);
        return insertBefore(node, reference);
      };
      for (const index of completedIndexes) h.api.completeTask(tasks[index], 'manual');
      h.api.pruneTasks(h.window.Date.now());
      h.api.renderTaskQueue();
      assert.deepEqual(moved, []);
      assert.equal(list.children.length, 6 - completedIndexes.length);
      for (const card of list.children) assert.equal(card, originals.get(card.dataset.taskId));
      h.api.renderTaskQueue();
      assert.deepEqual(moved, []);
    } finally { h.close(); }
  });
}

function desk(h, layout = '3') {
  const g = h.fresh();
  g.uiRevealed.taskQueue = true;
  g.totalTasksDone = 35;
  h.api.selectLayout(layout);
  return g;
}

test('a completed pile note is crossed off without retaining a live task or repeating its payout', () => {
  const h = harness();
  try {
    const g = desk(h);
    const done = h.task();
    const waiting = h.task();
    h.api.renderTaskQueue();
    const document = h.window.document;
    const list = document.querySelector('#task-list');
    const card = list.firstElementChild;
    const remainingCard = list.lastElementChild;
    const section = document.querySelector('#task-queue-section');
    Object.defineProperties(card, { offsetLeft: { value: 30 }, offsetTop: { value: 40 }, offsetWidth: { value: 220 }, offsetHeight: { value: 140 }, offsetParent: { value: list } });
    Object.defineProperties(list, { offsetLeft: { value: 12 }, offsetTop: { value: 20 }, scrollLeft: { value: 7 }, scrollTop: { value: 3 }, offsetParent: { value: section } });
    card.style.transform = 'rotate(3deg)';
    const cash = g.cash;
    const pay = h.api.getTaskCashPayout(done, 'manual', null);
    h.api.completeTask(done, 'manual');
    h.api.pruneTasks(h.window.Date.now());
    h.api.renderTaskQueue();
    const ghost = document.querySelector('[data-task-completion]');
    assert.equal(ghost.dataset.taskCompletion, done.id);
    assert.equal(ghost.dataset.taskState, 'done');
    assert.equal(ghost.hasAttribute('data-task-id'), false);
    assert.equal(ghost.getAttribute('aria-hidden'), 'true');
    assert.equal(ghost.hasAttribute('inert'), true);
    assert.equal(ghost.querySelector('.task-assignee').textContent, 'Done');
    assert.equal(ghost.querySelector('.task-bar-fill').style.width, '100%');
    assert.equal(ghost.querySelector('[data-task-work]').textContent, 'Work: ' + done.workRequired + '/' + done.workRequired);
    assert.equal(ghost.style.left, '35px');
    assert.equal(ghost.style.top, '57px');
    assert.equal(ghost.style.width, '220px');
    assert.equal(ghost.style.height, '140px');
    assert.equal(ghost.style.getPropertyValue('--completed-transform'), 'rotate(3deg)');
    assert.equal(list.firstElementChild, remainingCard);
    assert.equal(list.firstElementChild.dataset.taskId, waiting.id);
    assert.equal(document.querySelector('#task-count'), null);
    assert.equal(g.cash, cash + pay);
    assert.equal(g.totalTasksDone, 36);
    h.api.completeTask(done, 'manual');
    assert.equal(g.cash, cash + pay);
    assert.equal(document.querySelectorAll('[data-task-completion]').length, 1);
    h.advance(1099);
    assert.equal(document.querySelectorAll('[data-task-completion]').length, 1);
    h.advance(1);
    assert.equal(document.querySelectorAll('[data-task-completion]').length, 0);
  } finally { h.close(); }
});

test('hidden queues, unseen jobs and background completion do not create pile notes', () => {
  const h = harness();
  try {
    desk(h);
    const task = h.task();
    h.api.renderTaskQueue();
    h.api.showTaskCompletion({ id: 'not-rendered' });
    h.window.document.querySelector('#task-list').hidden = true;
    h.api.showTaskCompletion(task);
    h.window.document.querySelector('#task-list').hidden = false;
    Object.defineProperty(h.window.document, 'hidden', { value: true });
    h.api.showTaskCompletion(task);
    assert.equal(h.window.document.querySelectorAll('[data-task-completion]').length, 0);
  } finally { h.close(); }
});

test('automatic completions are bounded and remain absent from saves', () => {
  const h = harness();
  try {
    const g = desk(h, '4');
    const jobs = Array.from({ length: 8 }, () => h.task());
    h.api.renderTaskQueue();
    for (const card of h.window.document.querySelectorAll('#task-list .task-card')) card.style.transform = 'none';
    for (const job of jobs) h.api.completeTask(job, 'assistant');
    const ghosts = [...h.window.document.querySelectorAll('[data-task-completion]')];
    assert.equal(ghosts.length, 6);
    assert.deepEqual(ghosts.map(note => note.dataset.taskCompletion), jobs.slice(2).map(job => job.id));
    assert.equal(ghosts[0].style.getPropertyValue('--completed-transform'), 'matrix(1,0,0,1,0,0)');
    assert.equal(g.totalTasksDone, 43);
    h.api.pruneTasks(h.window.Date.now());
    h.api.save();
    const saved = JSON.parse(h.window.localStorage.getItem('ai_empire_save'));
    assert.equal(saved.tasks.length, 0);
    assert.equal(JSON.stringify(saved).includes('taskCompletion'), false);
    h.advance(1100);
    assert.equal(h.window.document.querySelectorAll('[data-task-completion]').length, 0);
  } finally { h.close(); }
});

test('expired work leaves no completed note and changing presentation clears old notes', () => {
  const h = harness();
  try {
    const g = desk(h, '4');
    g.taskExpiryEnabled = true;
    const expired = h.task();
    expired.createdAt -= 100000;
    h.api.renderTaskQueue();
    h.api.pruneTasks(h.window.Date.now());
    h.api.renderTaskQueue();
    assert.equal(h.window.document.querySelectorAll('[data-task-completion]').length, 0);
    const task = h.task();
    h.api.renderTaskQueue();
    h.api.showTaskCompletion(task);
    assert.equal(h.window.document.querySelectorAll('[data-task-completion]').length, 1);
    h.api.selectLayout('3');
    assert.equal(h.window.document.querySelectorAll('[data-task-completion]').length, 0);
    h.api.showTaskCompletion(task);
    h.api.selectLayout('4');
    assert.equal(h.window.document.querySelectorAll('[data-task-completion]').length, 0);
    h.api.selectLayout('3');
    h.api.showTaskCompletion(task);
    h.window.GAME.cheat('0_');
    assert.equal(h.window.document.querySelectorAll('[data-task-completion]').length, 0);
    const next = h.task();
    h.api.renderTaskQueue();
    h.api.showTaskCompletion(next);
    assert.equal(h.window.document.querySelectorAll('[data-task-completion]').length, 1);
    h.window.GAME.state.gameStarted = false;
    h.api.renderWorkStream();
    assert.equal(h.window.document.querySelectorAll('[data-task-completion]').length, 0);
  } finally { h.close(); }
});

test('task notes keep their identity through progress, reordering and new arrivals', () => {
  const h = harness();
  try {
    const g = desk(h);
    const first = h.task();
    const second = h.task();
    h.api.renderTaskQueue();
    const list = h.window.document.querySelector('#task-list');
    const firstCard = list.children[0];
    const secondCard = list.children[1];
    first.workDone++;
    h.api.renderTaskQueue();
    assert.equal(list.children[0], firstCard);
    g.tasks.reverse();
    h.api.renderTaskQueue();
    assert.equal(list.children[0], secondCard);
    assert.equal(list.children[1], firstCard);
    const arrival = h.task();
    g.tasks = [arrival, second, first];
    h.api.renderTaskQueue();
    assert.equal(list.children[0].dataset.taskId, arrival.id);
    assert.equal(list.children[1], secondCard);
    assert.equal(list.children[2], firstCard);
    assert.equal(list.children[2].dataset.taskState, 'available');
  } finally { h.close(); }
});

test('early completed notes work before detailed work counters are revealed', () => {
  const h = harness();
  try {
    const g = desk(h);
    g.totalTasksDone = 7;
    const job = h.task();
    h.api.renderTaskQueue();
    h.api.completeTask(job, 'manual');
    const ghost = h.window.document.querySelector('[data-task-completion]');
    assert.equal(ghost.querySelector('[data-task-work]'), null);
    assert.equal(ghost.querySelector('.task-assignee').textContent, 'Done');
  } finally { h.close(); }
});
