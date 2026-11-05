const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

test('manual token packs disappear on entering Phase 11 and stay hidden thereafter', () => {
  const h = harness();
  try {
    h.window.chPh11();
    const g = h.window.GAME.state;
    const packs = () => h.window.document.querySelectorAll('#upgrade-list button[onclick*="token_pack_"]');
    assert.equal(g.phase, 10);
    h.api.renderUpgradeSection();
    assert.equal(packs().length, 2);

    g.cash = 35000000;
    h.api.purchaseUpgrade('ceo_readiness');
    assert.equal(g.phase, 11);
    h.api.renderUpgradeSection();
    assert.equal(packs().length, 0);

    g.tokens = 0;
    g.cash = 1000000;
    const bought = g.tokenPacksBought;
    h.api.tickTokenManager();
    assert.ok(g.tokenPacksBought > bought);
    assert.ok(g.cash < 1000000);

    for (const phase of [12, 13, 14, 15, 16]) {
      g.phase = phase;
      h.api.renderUpgradeSection();
      assert.equal(packs().length, 0);
    }
  } finally {
    h.close();
  }
});
