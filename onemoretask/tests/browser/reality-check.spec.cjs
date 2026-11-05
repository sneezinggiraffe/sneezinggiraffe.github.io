const { test, expect } = require('@playwright/test');

for (const width of [1440, 390]) {
  test(`Reality Check reveals free AI only after clicking its free upgrade at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await page.goto('/');
    await page.evaluate(() => chPh1());
    if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
    const cards = page.locator('#upgrade-list .upgrade-card');
    await expect(cards).toHaveCount(2);
    await expect(cards).not.toContainText(['Reality Check']);
    await page.evaluate(() => { GAME.addTasks(40); GAME.addCash(1000); });
    await page.clock.runFor(200);
    for (const name of ['Dual Monitors', 'Noise-Cancelling Headphones']) {
      await expect(page.locator('#upgrade-list')).not.toContainText('Reality Check');
      await cards.filter({ hasText: name }).locator('button').click();
      await page.clock.runFor(200);
    }
    await page.clock.runFor(200);
    await expect(page.locator('#milestone-popup')).toBeHidden();
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('Reality Check');
    expect(await page.evaluate(() => GAME.state.expensesRevealed)).toBe(true);
    await expect(cards.locator('button')).toHaveText('');
    await cards.click({ position: { x: 5, y: 5 } });
    await page.clock.runFor(200);
    await expect(cards).toHaveCount(0);
    await page.clock.runFor(10000);
    await page.locator('#task-list button:enabled').first().click();
    await page.clock.runFor(5000);
    await expect(cards).toHaveCount(0);
    await page.locator('#task-list button:enabled').first().click();
    await page.clock.runFor(200);
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('Discover Free-Tier AI');
    await expect(cards.getByRole('button', { name: '105 tasks', exact: true })).toBeDisabled();
    await expect(page.locator('#milestone-popup')).toBeHidden();
  });
}
