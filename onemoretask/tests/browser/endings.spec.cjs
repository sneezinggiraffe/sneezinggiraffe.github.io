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
    await expect(page.locator('#handover-work')).toBeVisible();
    await expect(page.locator('#sale-settlement li:visible')).toHaveCount(1);
    await page.screenshot({ path: `test-results/sale-departure-${width}.png` });
    await page.clock.runFor(7800);
    await expect(page.locator('#work-stream')).toHaveCSS('opacity', '0');
    await expect(page.locator('#sale-settlement li:visible')).toHaveCount(3);
    await expect.poll(async () => {
      const movingReceipt = await page.locator('#sale-handoff').boundingBox();
      return Math.abs(movingReceipt.x + movingReceipt.width / 2 - width / 2);
    }).toBeLessThan(30);
    const receipt = await page.locator('#sale-handoff').boundingBox();
    expect(receipt.x).toBeGreaterThanOrEqual(0);
    expect(receipt.x + receipt.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/sale-receipt-${width}.png` });
    await page.clock.runFor(1000);
    await expect(page.locator('#sale-last-task')).toBeVisible();
    await expect(page.locator('#sale-handoff')).toBeHidden();
    await page.screenshot({ path: `test-results/sale-last-task-${width}.png`, animations: 'disabled' });
    await page.clock.runFor(4400);
    await expect(page.locator('#btn-ending-finish')).toBeFocused();
    await expect(page.locator('#ending-overlay')).toHaveAttribute('data-ending', 'sale');
    await page.screenshot({ path: `test-results/retirement-quiet-${width}.png` });
    await page.keyboard.press('Tab');
    await expect(page.locator('#btn-ending-restart')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#btn-ending-finish')).toBeFocused();
    await page.keyboard.press('Enter');
    await page.clock.runFor(1400);
    await expect(page.locator('#retirement-notification-title')).toHaveText('A new model is available.');
    await expect(page.locator('#btn-close-laptop')).toBeFocused();
    await page.screenshot({ path: `test-results/retirement-notification-${width}.png`, animations: 'disabled' });
    await page.keyboard.press('Enter');
    await page.clock.runFor(1400);
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
    await expect(page.locator('#agi-last-task')).toBeVisible();
    await page.screenshot({ path: `test-results/agi-last-task-${width}.png`, animations: 'disabled' });
    await page.clock.runFor(2100);
    await expect(page.locator('#agi-last-task-status')).toHaveText('Task completed ✓');
    await page.clock.runFor(1100);
    await expect(page.locator('#agi-task-offspring .epilogue-task')).toHaveCount(2);
    await page.clock.runFor(1000);
    await expect(page.locator('#agi-task-offspring .epilogue-task')).toHaveCount(4);
    await page.clock.runFor(2000);
    await expect(page.locator('#agi-task-offspring .epilogue-task')).toHaveCount(32);
    await page.screenshot({ path: `test-results/agi-task-stream-${width}.png`, animations: 'disabled' });
    await page.clock.runFor(4100);
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

for (const route of ['sale', 'agi']) {
  test(`keyboard skips the ${route} epilogue and leaves the completed run intact`, async ({ page }) => {
    await openEnding(page, 390, route === 'sale' ? 'chRetire' : 'chPh16Choice');
    if (route === 'sale') await page.locator('[onclick="GAME.buy(\'fusion\')"]').click();
    else {
      await page.locator('#btn-agi-scaling').click();
      await page.locator('#btn-agi-confirm').click();
      await page.evaluate(() => { GAME.state.agi.runawaySeconds = 44.9; });
      await page.clock.runFor(200);
    }
    const state = await page.evaluate(() => JSON.stringify(GAME.state));
    await expect(page.locator('#btn-ending-skip')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#btn-ending-skip')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#ending-transition')).toBeHidden();
    await expect(page.locator(route === 'sale' ? '#btn-ending-finish' : '#btn-ending-reset')).toBeFocused();
    expect(await page.evaluate(() => JSON.stringify(GAME.state))).toBe(state);
    await page.reload();
    await expect(page.locator('#ending-transition')).toBeHidden();
  });
}

test('reduced motion preserves the close-laptop decision and reload before it returns to the retirement choices', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openEnding(page, 320, 'chRetire');
  await page.locator('[onclick="GAME.buy(\'fusion\')"]').click();
  await page.locator('#btn-ending-finish').click();
  await expect(page.locator('#btn-close-laptop')).toBeFocused();
  expect(await page.evaluate(() => GAME.state.retirementFinal)).toBe(false);
  await page.reload();
  await expect(page.locator('#btn-ending-finish')).toBeFocused();
  await page.locator('#btn-ending-finish').click();
  await page.locator('#btn-close-laptop').click();
  await expect(page.locator('#ending-title')).toHaveText('No more tasks.');
  await expect(page.locator('#retirement-epilogue')).toBeHidden();
});
