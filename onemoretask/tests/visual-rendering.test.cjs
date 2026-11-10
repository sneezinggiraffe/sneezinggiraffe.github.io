const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

test('task presentation uses a monochrome document marker and a plain opening title', () => {
  const h = harness();
  try {
    const g = h.fresh();
    const task = h.task();
    task.status = 'active';
    g.uiRevealed.taskQueue = false;
    h.api.renderWorkStream();
    assert.equal(h.window.document.querySelector('#prelude-task').textContent, task.name);
    g.uiRevealed.taskQueue = true;
    h.api.renderWorkStream();
    const heading = h.window.document.querySelector('#task-list .task-name');
    assert.equal(heading.querySelector('.task-icon').textContent, '▤');
    assert.equal(heading.querySelector('.task-icon').getAttribute('aria-hidden'), 'true');
    assert.doesNotMatch(heading.textContent, /\p{Extended_Pictographic}/u);
    assert.ok(heading.textContent.includes(task.name));
  } finally { h.close(); }
});

test('role markers are decorative and independent of stored emoji icons', () => {
  const h = harness();
  try {
    h.fresh(9);
    const markers = { writer: 'WR', researcher: 'RS', coder: 'CD', analyst: 'AN', support: 'SP', manager: 'MG', devops: 'OP', sales: 'SL', token_mgr: 'TA' };
    for (const [role, marker] of Object.entries(markers)) {
      const agent = h.worker(role);
      const template = h.window.document.createElement('template');
      template.innerHTML = h.api.renderAgentCard(agent);
      const icon = template.content.querySelector('.agent-icon');
      assert.equal(icon.textContent, marker);
      assert.equal(icon.getAttribute('aria-hidden'), 'true');
      assert.doesNotMatch(template.content.textContent, /\p{Extended_Pictographic}/u);
    }
    const template = h.window.document.createElement('template');
    template.innerHTML = h.api.renderAiWorkerCard();
    assert.equal(template.content.querySelector('.agent-icon').textContent, 'AI');
  } finally { h.close(); }
});

test('assistant and leadership markers retain meaningful names and break status', () => {
  const h = harness();
  try {
    const g = h.fresh();
    g.purchasedUpgrades.push('hire_assistant');
    g.uiRevealed.taskQueue = true;
    h.api.renderAll();
    assert.equal(h.window.document.querySelector('[data-assistant] .agent-icon').textContent, 'AS');
    g.assistant.breakRemaining = 2;
    g.assistant.breakLabel = 'Lunch';
    h.api.renderAll();
    assert.equal(h.window.document.querySelector('[data-assistant] .agent-icon').textContent, 'Ⅱ');
    assert.match(h.window.document.querySelector('[data-assistant]').textContent, /Lunch - Back in 2s/);
    h.window.chPh13();
    const icons = [...h.window.document.querySelectorAll('.company-leadership .agent-icon')];
    assert.deepEqual(icons.map(icon => icon.textContent), ['CEO', 'TA']);
    assert.ok(icons.every(icon => icon.getAttribute('aria-hidden') === 'true'));
  } finally { h.close(); }
});

test('zero tanks have a precise empty label while funded tanks omit it', () => {
  const h = harness();
  try {
    const g = h.fresh(7);
    const agent = h.worker('coder');
    const template = h.window.document.createElement('template');
    for (const tokens of [0, 1]) {
      agent.tokenTank = tokens;
      template.innerHTML = h.api.renderAgentCard(agent);
      assert.equal(template.content.querySelector('.agent-card').classList.contains('res-warning'), tokens === 0);
      assert.equal(template.content.querySelector('.token-empty')?.textContent, tokens === 0 ? 'Empty' : undefined);
    }
    const manager = h.worker('manager');
    g.managerTokenTank = 0;
    template.innerHTML = h.api.renderAgentCard(manager);
    assert.equal(template.content.querySelector('.token-empty').textContent, 'Empty');
    assert.equal(template.content.querySelector('button').textContent, 'No tokens');
  } finally { h.close(); }
});

test('debt styling follows the debt value and clears after recovery', () => {
  const h = harness();
  try {
    const g = h.fresh(10);
    g.uiRevealed.topBar = true;
    g.uiRevealed.debt = true;
    for (const debt of [0, 12, 0]) {
      g.techDebt = debt;
      h.api.renderTopBar();
      assert.equal(h.window.document.querySelector('#res-debt-wrap').classList.contains('res-debt-active'), debt > 0);
      assert.equal(h.window.document.querySelector('#res-debt').textContent, String(debt));
      assert.equal(h.window.document.querySelector('#res-debt-wrap').style.display, debt > 0 ? '' : 'none');
      assert.equal(h.window.document.querySelector('#res-debt-wrap .label').textContent, 'Tech debt');
    }
  } finally { h.close(); }
});

test('settings omit redundant default copy and restore it after cancelling reset confirmation', () => {
  const h = harness();
  try {
    h.api.openSettingsPopup();
    const document = h.window.document;
    assert.equal(document.querySelector('#settings-msg').textContent, '');
    document.querySelector('#btn-settings-reset').click();
    assert.equal(document.querySelector('#settings-msg').textContent, 'Are you sure? This will permanently reset all progress.');
    assert.equal(document.querySelector('#settings-main-actions').style.display, 'none');
    document.querySelector('#btn-settings-confirm-cancel').click();
    assert.equal(document.querySelector('#settings-msg').textContent, '');
    assert.equal(document.querySelector('#settings-main-actions').style.display, 'flex');
    assert.equal(document.querySelector('#settings-confirm-actions').style.display, 'none');
  } finally { h.close(); }
});

test('refill buttons disable without reserve tokens and recover after funding', () => {
  const h = harness();
  try {
    const g = h.fresh(3);
    const agents = [{ roleId: 'original_ai', tokenTank: 0 }, h.worker('coder'), h.worker('manager')];
    agents[2].status = 'error';
    const template = h.window.document.createElement('template');
    for (const tokens of [0, 1, 0]) {
      g.tokens = tokens;
      for (const agent of agents) {
        template.innerHTML = h.api.renderAgentCard(agent);
        const button = template.content.querySelector('.btn-refill');
        assert.equal(button.disabled, tokens === 0);
        assert.equal(button.textContent, tokens === 0 ? 'No tokens' : 'Add tokens');
      }
    }
    g.phase = 2;
    template.innerHTML = h.api.renderAiWorkerCard();
    assert.equal(template.content.querySelector('.btn-refill').disabled, false);
    assert.equal(template.content.querySelector('.btn-refill').textContent, 'Add tokens');
  } finally { h.close(); }
});

test('token pack purchase highlights follow the same low threshold as the status', () => {
  const h = harness();
  try {
    const g = h.fresh(3);
    g.cash = 10000;
    g.uiRevealed.tokens = true;
    g.uiRevealed.topBar = true;
    g.uiRevealed.upgrades = true;
    for (const tokens of [0, 1, 100000, 0]) {
      g.tokens = tokens;
      h.api.renderAll();
      const document = h.window.document;
      const low = document.querySelector('#res-tokens-wrap').classList.contains('res-warning');
      assert.equal(low, tokens < 100000);
      const buttons = [...document.querySelectorAll('button[onclick*="token_pack_"]')];
      assert.equal(buttons.length, 2);
      assert.ok(buttons.every(button => button.classList.contains('token-purchase-warning') === low));
      assert.equal(document.querySelectorAll('.token-purchase-warning:not([onclick*="token_pack_"])').length, 0);
    }
  } finally { h.close(); }
});
