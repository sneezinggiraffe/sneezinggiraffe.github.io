const { test, expect } = require('@playwright/test');

async function openEnding(page, width, checkpoint) {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(name => window[name](), checkpoint);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 200));
}

for (const width of [1440, 390, 320]) {
  test(`sale clears the workspace in stages and leaves a quiet ending at ${width}px`, async ({ page }) => {
    await openEnding(page, width, 'chRetire');
    await page.locator('[onclick="GAME.buy(\'fusion\')"]').click();
    await page.clock.runFor(1000);
    await expect(page.locator('#sale-handoff')).toBeVisible();
    const initialReceipt = await page.locator('#sale-handoff').boundingBox();
    expect(initialReceipt.y).toBeGreaterThanOrEqual(23);
    expect(initialReceipt.y + initialReceipt.height).toBeLessThanOrEqual(page.viewportSize().height - 23);
    await expect(page.locator('#work-stream')).toHaveCSS('opacity', '0');
    const opacities = await page.evaluate(() => [getComputedStyle(document.querySelector('#section-agents')).opacity, getComputedStyle(document.querySelector('#top-bar')).opacity].map(Number));
    expect(opacities[0]).toBeLessThan(opacities[1]);
    await page.screenshot({ path: `test-results/sale-departure-${width}.png` });
    await page.clock.runFor(1800);
    await expect.poll(async () => {
      const movingReceipt = await page.locator('#sale-handoff').boundingBox();
      return Math.abs(movingReceipt.x + movingReceipt.width / 2 - width / 2);
    }).toBeLessThan(30);
    const receipt = await page.locator('#sale-handoff').boundingBox();
    expect(receipt.x).toBeGreaterThanOrEqual(0);
    expect(receipt.x + receipt.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/sale-receipt-${width}.png` });
    await page.clock.runFor(2000);
    await expect(page.locator('#btn-ending-finish')).toBeFocused();
    await expect(page.locator('#ending-overlay')).toHaveAttribute('data-ending', 'sale');
    await page.screenshot({ path: `test-results/retirement-quiet-${width}.png` });
    await page.keyboard.press('Tab');
    await expect(page.locator('#btn-ending-restart')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#btn-ending-finish')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#ending-title')).toHaveText('No more tasks.');
    await expect(page.locator('#ending-title')).toBeFocused();
    await expect(page.locator('#ending-summary')).toBeHidden();
    await expect(page.locator('#ending-kicker')).toBeHidden();
    await page.screenshot({ path: `test-results/retirement-final-${width}.png`, animations: 'disabled' });
    await page.reload();
    await expect(page.locator('#ending-title')).toHaveText('No more tasks.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`AGI removes human controls, fills the screen and revokes access at ${width}px`, async ({ page }) => {
    await openEnding(page, width, 'chPh16Choice');
    await page.locator('#btn-agi-scaling').click();
    await page.locator('#btn-agi-confirm').click();
    await page.clock.runFor(12500);
    await expect(page.locator('#control-panel')).toHaveJSProperty('inert', true);
    await expect(page.locator('.agi-task-grid span')).toHaveCount(24);
    await page.evaluate(() => { GAME.state.agi.runawaySeconds = 36; });
    await page.clock.runFor(200);
    await expect(page.locator('.agi-task-grid span')).toHaveCount(120);
    await expect(page.locator('#top-bar')).toBeHidden();
    await expect(page.locator('#task-queue-section')).toHaveJSProperty('inert', true);
    await page.screenshot({ path: `test-results/agi-dense-${width}.png` });
    await page.clock.runFor(9000);
    await expect(page.locator('#access-revoked')).toBeVisible();
    await expect(page.locator('#game-container')).toBeHidden();
    await expect(page.locator('#agi-cursors')).toBeHidden();
    await page.screenshot({ path: `test-results/agi-revoked-${width}.png` });
    await page.clock.runFor(3100);
    await expect(page.locator('#ending-title')).toHaveText('There is always one more task.');
    await expect(page.locator('#btn-ending-reset')).toBeFocused();
    await expect(page.locator('#ending-activity')).toBeVisible();
    await page.screenshot({ path: `test-results/agi-ending-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('reduced motion skips AGI disconnection animation and leaves a static activity strip', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openEnding(page, 390, 'chPh16Choice');
  await page.locator('#btn-agi-scaling').click();
  await page.locator('#btn-agi-confirm').click();
  await page.evaluate(() => { GAME.state.agi.runawaySeconds = 44.9; });
  await page.clock.runFor(400);
  await expect(page.locator('#ending-transition')).toBeHidden();
  await expect(page.locator('#ending-title')).toHaveText('There is always one more task.');
  await expect(page.locator('#ending-activity span')).toHaveCSS('animation-name', 'none');
});
