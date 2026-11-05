const { test, expect } = require('@playwright/test');

for (const musicMode of ['off', 'on']) {
  test(`reset and cheats preserve music ${musicMode} after reload`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate(mode => {
      GAME.state.musicMode = mode;
      GAME.cheat(3);
    }, musicMode);
    await page.reload();
    expect(await page.evaluate(() => GAME.state.musicMode)).toBe(musicMode);
    await Promise.all([
      page.waitForEvent('load'),
      page.evaluate(() => GAME.resetSave()),
    ]);
    await expect(page.locator('#intro-overlay')).toBeVisible();
    await expect.poll(() => page.evaluate(() => GAME.state.gameStarted)).toBe(false);
    expect(await page.evaluate(() => GAME.state.musicMode)).toBe(musicMode);
    expect(await page.evaluate(() => GAME.state.phase)).toBe(1);
    await page.reload();
    expect(await page.evaluate(() => GAME.state.musicMode)).toBe(musicMode);
  });
}
