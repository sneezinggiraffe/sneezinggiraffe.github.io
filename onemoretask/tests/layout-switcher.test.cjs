const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

test('the header has vertical then horizontal view choices before Settings', () => {
  const h = harness();
  try {
    const document = h.window.document;
    const group = document.querySelector('#layout-switcher');
    const choices = [...group.querySelectorAll('button')];
    assert.equal(group.getAttribute('role'), 'group');
    assert.equal(group.getAttribute('aria-label'), 'Game views');
    assert.deepEqual(choices.map(button => button.textContent), ['V', 'H']);
    assert.deepEqual(choices.map(button => button.dataset.layoutChoice), ['4', '3']);
    assert.deepEqual(choices.map(button => button.getAttribute('aria-label')), ['Vertical view', 'Horizontal view']);
    assert.ok(choices.every(button => button.title === button.getAttribute('aria-label') && button.type === 'button'));
    assert.equal(group.nextElementSibling.id, 'btn-settings');
    assert.equal(document.body.dataset.layout, '3');
    assert.equal(choices[0].getAttribute('aria-pressed'), 'false');
    assert.equal(choices[1].getAttribute('aria-pressed'), 'true');
    assert.equal(document.querySelector('#layout-name, .switcher-label'), null);
  } finally { h.close(); }
});

test('both views preserve the fixed theme, game progress and saved progress', () => {
  const h = harness();
  try {
    h.window.GAME.cheat(6);
    const document = h.window.document;
    const state = JSON.stringify(h.window.GAME.state);
    const save = h.window.localStorage.getItem('ai_empire_save');
    for (const id of ['4', '3', '4']) {
      const choice = document.querySelector(`[data-layout-choice="${id}"]`);
      choice.click();
      assert.equal(document.body.dataset.theme, '3');
      assert.equal(document.body.dataset.layout, id);
      assert.equal(choice.getAttribute('aria-pressed'), 'true');
      assert.equal(document.querySelectorAll('[data-layout-choice][aria-pressed="true"]').length, 1);
      assert.equal(new h.window.URLSearchParams(h.window.location.hash.slice(1)).get('layout'), id);
      assert.equal(JSON.stringify(h.window.GAME.state), state);
      assert.equal(h.window.localStorage.getItem('ai_empire_save'), save);
    }
  } finally { h.close(); }
});

test('view URLs restore the choice and preserve query, path and other fragment values', () => {
  for (const id of ['3', '4']) {
    const h = harness(undefined, { before: window => window.history.replaceState(null, '', '/onemoretask/?review=views#theme=1&layout=' + id + '&panel=team') });
    try {
      const document = h.window.document;
      assert.equal(document.body.dataset.theme, '3');
      assert.equal(document.body.dataset.layout, id);
      document.querySelector(`[data-layout-choice="${id === '3' ? '4' : '3'}"]`).click();
      assert.equal(h.window.location.pathname, '/onemoretask/');
      assert.equal(h.window.location.search, '?review=views');
      const parameters = new h.window.URLSearchParams(h.window.location.hash.slice(1));
      assert.equal(parameters.get('layout'), id === '3' ? '4' : '3');
      assert.equal(parameters.get('panel'), 'team');
      assert.equal(parameters.get('theme'), '1');
    } finally { h.close(); }
  }
});

test('removed and invalid views cannot alter presentation, state or URL', () => {
  const h = harness();
  try {
    const document = h.window.document;
    document.querySelector('[data-layout-choice="4"]').click();
    const state = JSON.stringify(h.window.GAME.state);
    const hash = h.window.location.hash;
    for (const id of ['', '0', '1', '2', '5', '6', 'unknown', '1"]']) {
      assert.equal(h.api.selectLayout(id), false);
      assert.equal(document.body.dataset.layout, '4');
      assert.equal(document.body.dataset.theme, '3');
      assert.equal(h.window.location.hash, hash);
      assert.equal(JSON.stringify(h.window.GAME.state), state);
    }
  } finally { h.close(); }
});

test('removed and invalid view URLs start with H without compatibility aliases', () => {
  for (const id of ['1', '2', '5', 'unknown']) {
    const h = harness(undefined, { before: window => window.history.replaceState(null, '', '#layout=' + id) });
    try {
      assert.equal(h.window.document.body.dataset.layout, '3');
      assert.equal(h.window.document.querySelector(`[data-layout-choice="${id}"]`), null);
      assert.equal(h.window.document.querySelector('[data-layout-choice="3"]').getAttribute('aria-pressed'), 'true');
    } finally { h.close(); }
  }
});

test('revealing and refreshing the header preserves the selected view', () => {
  const h = harness(undefined, { before: window => window.history.replaceState(null, '', '#layout=4') });
  try {
    h.api.startGame();
    h.api.renderTopBar();
    assert.equal(h.window.document.querySelector('#top-bar').classList.contains('visible'), true);
    assert.equal(h.window.document.body.dataset.layout, '4');
    assert.equal(h.window.document.querySelector('[data-layout-choice="4"]').getAttribute('aria-pressed'), 'true');
  } finally { h.close(); }
});
