const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

test('Cut & Paste is the fixed theme with no theme controls or names', () => {
  for (const hash of ['', '#theme=1', '#theme=2', '#theme=3', '#theme=unknown']) {
    const h = harness(undefined, { before: window => window.history.replaceState(null, '', '/' + hash) });
    try {
      const document = h.window.document;
      assert.equal(document.body.dataset.theme, '3');
      assert.equal(document.querySelector('#theme-switcher, #theme-name, [data-theme-choice], #layout-name, .switcher-label'), null);
      h.api.startGame();
      h.window.GAME.cheat(6);
      assert.equal(document.body.dataset.theme, '3');
      assert.equal(document.querySelector('.header-actions').textContent.replace(/\s+/g, ' ').trim(), 'V H Settings');
    } finally { h.close(); }
  }
});

test('upgrade affordability changes preserve the control without availability labels', () => {
  const h = harness();
  try {
    h.window.GAME.cheat('0_2');
    const document = h.window.document;
    const button = document.querySelector('[onclick="GAME.buy(\'hire_assistant\')"]');
    const purchase = button.parentElement;
    h.window.GAME.state.cash = 0;
    h.api.renderUpgradeSection();
    assert.equal(purchase.querySelector('.upgrade-availability'), null);
    assert.equal(button.disabled, true);
    h.window.GAME.state.cash = 35;
    h.api.renderUpgradeSection();
    assert.equal(purchase.querySelector('.upgrade-availability'), null);
    assert.equal(button.textContent, '$30');
    assert.equal(button.disabled, false);
    assert.equal(document.querySelector('[onclick="GAME.buy(\'hire_assistant\')"]'), button);
    h.window.GAME.state.cash = 0;
    h.api.renderUpgradeSection();
    assert.equal(purchase.querySelector('.upgrade-availability'), null);
    assert.equal(document.querySelector('[onclick="GAME.buy(\'hire_assistant\')"]'), button);
    assert.equal(button.disabled, true);
  } finally { h.close(); }
});
