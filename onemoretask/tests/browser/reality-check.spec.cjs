const { test, expect } = require('@playwright/test');

for (const width of [1440, 390]) {
  test(`Reality Check reveals free AI only after clicking its free upgrade at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await page.goto('/');
    await page.evaluate(() => GAME.cheat('1'));
    if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
    const cards = page.locator('#upgrade-list .upgrade-card');
    await expect(cards).toHaveCount(0);
    await page.evaluate(() => GAME.addTasks(1));
    await page.clock.runFor(200);
    await expect(page.locator('#milestone-popup')).toBeHidden();
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('Reality Check');
    expect(await page.evaluate(() => GAME.state.expensesRevealed)).toBe(true);
    await cards.getByRole('button', { name: 'Free', exact: true }).click();
    await page.clock.runFor(200);
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('Discover Free-Tier AI');
    await expect(cards.getByRole('button', { name: '105 tasks', exact: true })).toBeDisabled();
    await expect(page.locator('#milestone-popup')).toBeHidden();
  });
}
