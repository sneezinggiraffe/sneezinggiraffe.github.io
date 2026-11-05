const { test, expect } = require('@playwright/test');

for (const width of [1440, 390]) {
  test(`upgrade cards support whole-card purchases and keyboard activation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await page.goto('/');
    await page.evaluate(() => {
      GAME.cheat('0_2');
      GAME.state.cash = 0;
    });
    await page.clock.runFor(200);
    if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
    const card = page.locator('.upgrade-card').filter({ hasText: 'Post-It Notes' });
    const action = card.locator('button');
    await expect(action).toBeDisabled();
    await expect(card).toHaveCSS('background-color', 'rgb(17, 24, 39)');
    await expect(card).toHaveCSS('border-top-color', 'rgb(30, 41, 59)');
    await card.click({ position: { x: 5, y: 5 } });
    expect(await page.evaluate(() => GAME.state.purchasedUpgrades.includes('post_it_notes'))).toBe(false);
    await page.evaluate(() => { GAME.state.cash = 1000; });
    await page.clock.runFor(200);
    await expect(action).toBeEnabled();
    await expect(card).toHaveCSS('background-color', 'rgb(38, 49, 64)');
    await expect(card).toHaveCSS('border-top-color', 'rgb(80, 96, 120)');
    await expect(action).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(action).toHaveText('$43');
    await card.click({ position: { x: 5, y: 5 } });
    expect(await page.evaluate(() => GAME.state.purchasedUpgrades.includes('post_it_notes'))).toBe(true);
    expect(await page.evaluate(() => GAME.state.cash)).toBe(957);
    await page.clock.runFor(200);
    const next = page.locator('.upgrade-card').filter({ hasText: 'Gas Station Coffee' }).locator('button');
    await next.focus();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => GAME.state.purchasedUpgrades.includes('gas_station_coffee'))).toBe(true);
    await page.clock.runFor(200);
    await page.screenshot({ path: `test-results/upgrade-cards-${width}.png` });
    await page.evaluate(() => { GAME.cheat('4'); GAME.state.cash = 0; });
    await page.clock.runFor(200);
    const pack = page.locator('.upgrade-repeatable').first();
    await expect(pack.locator('button')).toBeDisabled();
    await expect(pack).toHaveCSS('background-color', 'rgb(17, 24, 39)');
    await page.evaluate(() => { GAME.state.cash = 1000000; });
    await page.clock.runFor(200);
    await expect(pack.locator('button')).toBeEnabled();
    await expect(pack).toHaveCSS('background-color', 'rgb(38, 49, 64)');
    await expect(pack).toHaveCSS('border-top-color', 'rgb(80, 96, 120)');
  });
}
