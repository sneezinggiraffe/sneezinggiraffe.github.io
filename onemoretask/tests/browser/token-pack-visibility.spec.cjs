const { test, expect } = require('@playwright/test');
const { harness } = require('../harness.cjs');

test('Phase 10 removes manual token packs immediately and after reload', async ({ page }) => {
  const h = harness();
  let raw;
  try {
    h.window.chPh10();
    const g = h.window.GAME.state;
    g.cash = 35000000;
    g.lastTick = Date.now();
    raw = JSON.stringify(g);
  } finally {
    h.close();
  }
  await page.addInitScript(value => {
    if (!localStorage.getItem('ai_empire_save')) localStorage.setItem('ai_empire_save', value);
  }, raw);
  await page.goto('/');
  const packs = page.locator('#upgrade-list button[onclick*="token_pack_"]');
  await expect(packs).toHaveCount(2);
  await page.locator('[onclick="GAME.buy(\'ceo_readiness\')"]').click();
  await expect(packs).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('ai_empire_save', JSON.stringify(GAME.state)));
  await page.reload();
  expect(await page.evaluate(() => GAME.state.phase)).toBe(10);
  await expect(packs).toHaveCount(0);
});
