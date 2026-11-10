const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

test('sale receipt moves from the sale card to centre and clears its styles on restart', t => {
  const h = harness(undefined, { reducedMotion: false });
  t.after(() => h.close());
  h.window.chRetire();
  const document = h.window.document;
  const card = document.querySelector('.sale-card');
  card.getBoundingClientRect = () => ({ left: 600, top: 100, width: 300, height: 200 });
  h.api.sellCompany();
  const scene = document.querySelector('#ending-transition');
  assert.equal(scene.style.getPropertyValue('--handoff-x'), '238px');
  assert.equal(scene.style.getPropertyValue('--handoff-y'), '-184px');
  assert.equal(document.querySelector('#sale-handoff').hidden, false);
  h.advance(2200);
  h.api.renderAll();
  assert.equal(scene.style.getPropertyValue('--handoff-x'), '119px');
  assert.equal(scene.style.getPropertyValue('--handoff-y'), '-92px');
  h.advance(800);
  h.api.renderAll();
  assert.equal(scene.style.getPropertyValue('--handoff-x'), '0px');
  assert.equal(scene.style.getPropertyValue('--handoff-border'), '0');
  h.advance(1600);
  h.api.renderAll();
  assert.equal(document.body.classList.contains('sale-departure'), false);
  assert.equal(document.activeElement.id, 'btn-ending-finish');
  document.querySelector('#btn-ending-restart').click();
  assert.equal(document.querySelector('#ending-overlay').hidden, true);
  assert.equal(document.body.style.getPropertyValue('--work-opacity'), '1');
  assert.equal(document.querySelector('#game-container').inert, false);
});

test('a sale without a rendered card centres the receipt and reload opens the settled ending', t => {
  const h = harness(undefined, { reducedMotion: false });
  t.after(() => h.close());
  h.fresh(17);
  h.api.sellCompany();
  assert.equal(h.window.document.querySelector('#ending-transition').style.getPropertyValue('--handoff-x'), '0px');
  const restored = harness(h.window.localStorage.getItem('ai_empire_save'), { reducedMotion: false });
  t.after(() => restored.close());
  assert.equal(restored.window.document.querySelector('#ending-transition').hidden, true);
  assert.equal(restored.window.document.querySelector('#ending-overlay').hidden, false);
});

test('permanent retirement removes the receipt, statistics and choices and stops all audio', t => {
  const h = harness();
  t.after(() => h.close());
  h.window.chRetire();
  h.api.unlockMusicPlayback();
  h.api.sellCompany();
  const document = h.window.document;
  document.querySelector('#btn-ending-finish').click();
  assert.equal(document.querySelector('#ending-title').textContent, 'No more tasks.');
  assert.equal(document.querySelector('#ending-story').textContent, 'Your time belongs to you.');
  for (const selector of ['#ending-kicker', '#ending-summary', '#ending-choices', '#ending-activity', '#ending-transition']) {
    assert.equal(document.querySelector(selector).hidden, true, selector);
  }
  assert.equal(document.activeElement.id, 'ending-title');
  assert.ok(h.audioPlayers.every(player => player.paused));
});

test('the departing receipt stays inside the viewport when the sale card extends beyond it', t => {
  const h = harness(undefined, { reducedMotion: false });
  t.after(() => h.close());
  h.window.chRetire();
  const document = h.window.document;
  document.querySelector('.sale-card').getBoundingClientRect = () => ({ left: 1000, top: 760, width: 300, height: 200 });
  document.querySelector('#sale-handoff').getBoundingClientRect = () => ({ width: 420, height: 180 });
  h.api.sellCompany();
  const scene = document.querySelector('#ending-transition');
  assert.equal(scene.style.getPropertyValue('--handoff-x'), '278px');
  assert.equal(scene.style.getPropertyValue('--handoff-y'), '270px');
});
