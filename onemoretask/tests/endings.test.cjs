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
  h.advance(7500);
  h.api.renderAll();
  assert.equal(scene.style.getPropertyValue('--handoff-x'), '119px');
  assert.equal(scene.style.getPropertyValue('--handoff-y'), '-92px');
  h.advance(1500);
  h.api.renderAll();
  assert.equal(scene.style.getPropertyValue('--handoff-x'), '0px');
  assert.equal(scene.style.getPropertyValue('--handoff-border'), '0');
  h.advance(5000);
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
  assert.equal(document.querySelector('#retirement-epilogue').hidden, false);
  assert.equal(document.activeElement.id, 'btn-close-laptop');
  document.querySelector('#btn-close-laptop').click();
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

test('sale epilogue settles in stages, shows continuing work, then an empty final task', t => {
  const h = harness(undefined, { reducedMotion: false });
  t.after(() => h.close());
  h.window.chRetire();
  h.api.sellCompany();
  const document = h.window.document;
  const frozen = JSON.stringify(h.window.GAME.state);
  assert.equal(document.activeElement.id, 'btn-ending-skip');
  assert.equal(document.querySelector('#handover-work').hidden, false);
  assert.equal(document.querySelectorAll('#sale-settlement li:not([hidden])').length, 1);
  h.api.beginRetirement();
  assert.equal(document.querySelector('#retirement-epilogue').hidden, true);
  h.advance(1800);
  h.api.renderAll();
  assert.equal(document.querySelectorAll('#sale-settlement li:not([hidden])').length, 2);
  h.advance(1800);
  h.api.renderAll();
  assert.equal(document.querySelectorAll('#sale-settlement li:not([hidden])').length, 3);
  h.advance(6000);
  h.api.renderAll();
  assert.equal(document.querySelector('#sale-handoff').hidden, true);
  assert.equal(document.querySelector('#sale-last-task').hidden, false);
  assert.equal(document.querySelector('#handover-work').hidden, true);
  assert.equal(document.querySelector('#ending-overlay').hidden, true);
  h.advance(4400);
  h.api.renderAll();
  assert.equal(document.activeElement.id, 'btn-ending-finish');
  assert.equal(JSON.stringify(h.window.GAME.state), frozen);
});

test('AGI reviews human input, completes its last task and creates a growing stream without changing the settled run', t => {
  const h = harness(undefined, { reducedMotion: false });
  t.after(() => h.close());
  h.window.chPh16Choice();
  h.api.requestKeepScaling();
  h.api.confirmKeepScaling();
  for (const [seconds, count] of [[36, 1], [3, 2], [3, 3]]) {
    h.api.tickAgi(seconds);
    h.api.renderAll();
    assert.equal(h.window.document.querySelectorAll('#agi-human-status li:not([hidden])').length, count);
  }
  h.api.tickAgi(3);
  const document = h.window.document;
  const frozen = JSON.stringify(h.window.GAME.state);
  let elapsed = 0;
  for (const [at, count, step] of [[3000, 0, 'arrive'], [4400, 0, 'click'], [5000, 0, 'complete'], [6200, 2, 'complete'], [7200, 4, 'complete'], [8200, 8, 'complete'], [9200, 32, 'complete']]) {
    h.advance(at - elapsed);
    elapsed = at;
    h.api.renderAll();
    assert.equal(document.querySelector('#agi-last-task').dataset.step, step);
    assert.equal(document.querySelector('#agi-last-task').hidden, count > 0);
    assert.equal(document.querySelectorAll('#agi-task-offspring .epilogue-task').length, count);
    h.api.renderAll();
  }
  h.advance(4000);
  h.api.renderAll();
  assert.equal(document.querySelector('#ending-overlay').hidden, false);
  assert.equal(document.activeElement.id, 'btn-ending-reset');
  assert.equal(JSON.stringify(h.window.GAME.state), frozen);
});

for (const route of ['sale', 'agi']) {
  test(`skip ${route} epilogue keeps the outcome and focuses its final action`, t => {
    const h = harness(undefined, { reducedMotion: false });
    t.after(() => h.close());
    h.api.skipEndingScene();
    h.api.beginRetirement();
    if (route === 'sale') {
      h.window.chRetire();
      h.api.sellCompany();
    } else {
      h.window.chPh16Choice();
      h.api.requestKeepScaling();
      h.api.confirmKeepScaling();
      h.api.tickAgi(45);
    }
    const frozen = JSON.stringify(h.window.GAME.state);
    h.window.document.querySelector('#btn-ending-skip').click();
    assert.equal(h.window.document.querySelector('#ending-transition').hidden, true);
    assert.equal(h.window.document.activeElement.id, route === 'sale' ? 'btn-ending-finish' : 'btn-ending-reset');
    assert.equal(JSON.stringify(h.window.GAME.state), frozen);
    h.api.skipEndingScene();
  });
}

test('closing the laptop folds the notification, fades music and persists final retirement immediately', t => {
  const h = harness(undefined, { reducedMotion: false });
  t.after(() => h.close());
  h.window.chRetire();
  h.api.unlockMusicPlayback();
  h.api.sellCompany();
  h.api.skipEndingScene();
  const document = h.window.document;
  document.querySelector('#btn-ending-finish').click();
  assert.equal(h.window.GAME.state.retirementFinal, false);
  assert.equal(document.querySelector('#retirement-epilogue').hidden, false);
  h.advance(1200);
  h.api.renderAll();
  assert.equal(document.querySelector('#retirement-epilogue').style.getPropertyValue('--notification-reveal'), '1');
  document.querySelector('#btn-close-laptop').click();
  assert.equal(h.window.GAME.state.retirementFinal, true);
  assert.equal(document.querySelector('#retirement-epilogue').dataset.closing, 'true');
  assert.equal(document.querySelector('#ending-overlay').hidden, true);
  const reloaded = harness(h.window.localStorage.getItem('ai_empire_save'), { reducedMotion: false });
  t.after(() => reloaded.close());
  assert.equal(reloaded.window.document.querySelector('#retirement-epilogue').hidden, true);
  assert.equal(reloaded.window.document.querySelector('#ending-title').textContent, 'No more tasks.');
  h.advance(600);
  h.api.renderAll();
  assert.equal(document.querySelector('#retirement-epilogue').style.getPropertyValue('--laptop-close'), '0.5');
  assert.equal(h.audioPlayers[0].volume, 0.125);
  h.advance(600);
  h.api.renderAll();
  assert.equal(document.querySelector('#retirement-epilogue').hidden, true);
  assert.equal(document.activeElement.id, 'ending-title');
  assert.ok(h.audioPlayers.every(player => player.paused));
  h.window.chRetire();
  assert.equal(document.querySelector('#retirement-epilogue').hidden, true);
});

test('Retire works during the menu reveal and closing fades from the current music volume', t => {
  const h = harness(undefined, { reducedMotion: false });
  t.after(() => h.close());
  h.window.chRetire();
  h.api.unlockMusicPlayback();
  h.api.sellCompany();
  h.advance(13000);
  h.api.renderAll();
  h.window.document.querySelector('#btn-ending-finish').click();
  assert.equal(h.window.document.querySelector('#retirement-epilogue').hidden, false);
  const volume = h.audioPlayers[0].volume;
  h.window.document.querySelector('#btn-close-laptop').click();
  assert.equal(h.audioPlayers[0].volume, volume);
  h.advance(600);
  h.api.renderAll();
  assert.equal(h.audioPlayers[0].volume, volume / 2);
});
