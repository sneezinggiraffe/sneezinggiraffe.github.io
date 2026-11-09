const { test, expect } = require('@playwright/test');

async function openAgiCheckpoint(page, width = 1440, checkpoint = 'chPh16Choice', layout = 4) {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
  const started = Date.now();
  await page.clock.install({ time: new Date(started) });
  await page.clock.pauseAt(new Date(started + 1000));
  await page.addInitScript(value => localStorage.setItem('ai_empire_layout', String(value)), layout);
  await page.goto('/');
  await page.evaluate(name => {
    window[name]();
    GAME.addCash(1e11);
    GAME.state.ceoMode = 'manage';
  }, checkpoint);
  await page.clock.runFor(200);
}

function upgrade(page, id) {
  return page.locator('[onclick="GAME.buy(\'' + id + '\')"]');
}

async function saveAndReload(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.reload();
  await expect(page.locator('#save-notice')).toBeHidden();
}

test('AGI research persists, pauses with settings, and introduces a visible inspecting cursor', async ({ page }) => {
  test.setTimeout(120000);
  await openAgiCheckpoint(page, 1440, 'chPh16');
  await expect(page.locator('#phase-label')).toHaveText('Phase 15: Global Expansion');
  await expect(upgrade(page, 'retire_unlock')).toHaveCount(0);
  await upgrade(page, 'agi_research').click();
  await page.clock.runFor(10000);
  await expect(page.locator('#agi-status')).toContainText('Fund AGI Research');
  await expect(page.getByRole('progressbar', { name: 'AGI project' })).toBeVisible();
  await page.locator('#btn-settings').click();
  const remaining = await page.evaluate(() => GAME.state.agi.remaining);
  await page.clock.runFor(5000);
  expect(await page.evaluate(() => GAME.state.agi.remaining)).toBe(remaining);
  await page.locator('#btn-settings-close').click();
  await saveAndReload(page);
  expect(await page.evaluate(() => GAME.state.agi.remaining)).toBe(remaining);
  expect(await page.evaluate(() => GAME.state.phase)).toBe(15);
  await page.clock.runFor((remaining + 0.3) * 1000);
  await expect(page.locator('#phase-label')).toHaveText('Phase 16: AGI');
  await saveAndReload(page);
  expect(await page.evaluate(() => GAME.state.phase)).toBe(16);
  await upgrade(page, 'agi_computer_use').click();
  await page.clock.runFor(21000);
  await expect(page.locator('#agi-cursors')).toBeVisible();
  await expect(page.locator('#agi-cursor')).toBeVisible();
  await expect(page.locator('#game-container')).toHaveCSS('cursor', 'none');
  const cashTarget = await page.locator('#res-cash').boundingBox();
  expect(await page.locator('#agi-cursor').evaluate(cursor => Number.parseFloat(cursor.style.top))).toBeCloseTo(cashTarget.y + cashTarget.height / 2, 0);
  const firstPosition = await page.locator('#agi-cursor').evaluate(cursor => [cursor.style.left, cursor.style.top]);
  await page.clock.runFor(4500);
  const secondPosition = await page.locator('#agi-cursor').evaluate(cursor => [cursor.style.left, cursor.style.top]);
  expect(secondPosition).not.toEqual(firstPosition);
  await page.clock.runFor(8500);
  await expect(upgrade(page, 'agi_authority')).toBeEnabled();
  await expect(upgrade(page, 'agi_authority')).toBeInViewport();
  await expect(page.locator('#agi-progress')).toContainText('Supervised checks: 3 / 3');
  await page.screenshot({ path: 'test-results/agi-supervised-1440.png', animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const [width, layout] of [[1440, 4], [390, 4], [320, 4], [1440, 3], [390, 3], [320, 3]]) {
  test(`buyout delegates sale preparation and waits for the human to sell in view ${layout} at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await openAgiCheckpoint(page, width, 'chPh16Choice', layout);
    await expect(page.locator('#agi-route-choices')).toBeVisible();
    await expect(page.locator('#phase-label')).toHaveText('Phase 16: AGI');
    await page.clock.runFor(8000);
    await page.screenshot({ path: `test-results/agi-choice-${layout}-${width}.png`, animations: 'disabled' });
    await expect(page.locator('#btn-agi-buyout')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#btn-agi-scaling')).toBeInViewport({ ratio: 1 });
    await expect(upgrade(page, 'retire_unlock')).toHaveCount(0);
    await page.locator('#btn-agi-buyout').click();
    await expect(page.locator('#agi-route-choices')).toBeHidden();
    await page.clock.runFor(200);
    await upgrade(page, 'retire_unlock').click();
    await page.clock.runFor(8300);
    expect(await page.evaluate(() => GAME.state.phase)).toBe(17);
    await expect(page.locator('#phase-label')).toHaveText('Phase 17: Buyout');
    await page.locator('#btn-agi-resume').click();
    await page.clock.runFor(76000);
    expect(await page.evaluate(() => GAME.state.purchasedUpgrades.includes('sale_terms'))).toBe(true);
    expect(await page.evaluate(() => GAME.state.agi.purchases)).toBeGreaterThanOrEqual(4);
    await expect(upgrade(page, 'fusion')).toBeEnabled();
    expect(await page.evaluate(() => GAME.state.retired)).toBe(false);
    await page.clock.runFor(8000);
    expect(await page.evaluate(() => GAME.state.retired)).toBe(false);
    await page.screenshot({ path: `test-results/agi-buyout-${layout}-${width}.png`, animations: 'disabled' });
    await expect(upgrade(page, 'fusion')).toBeInViewport({ ratio: 1 });
    await expect(upgrade(page, 'fusion').locator('xpath=ancestor::div[contains(@class,"upgrade-card")]').locator('.name')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await upgrade(page, 'fusion').click();
    await page.clock.runFor(3000);
    await expect(page.locator('#ending-title')).toHaveText('You retired early!');
    await expect(page.locator('#agi-cursors')).toBeHidden();
    await expect(page.locator('#ending-choices')).toBeVisible();
    await saveAndReload(page);
    await expect(page.locator('#ending-title')).toHaveText('You retired early!');
  });

  test(`keep scaling confirms, replicates, ends and resets in view ${layout} at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await openAgiCheckpoint(page, width, 'chPh16Choice', layout);
    await page.locator('#btn-agi-scaling').click();
    await expect(page.locator('#agi-warning')).toBeVisible();
    await expect(page.locator('#btn-agi-cancel')).toBeFocused();
    await expect(page.locator('#agi-warning')).toContainText('closes the buyout route');
    expect(await page.evaluate(() => GAME.state.agi.route)).toBe('');
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#btn-agi-confirm')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#btn-agi-cancel')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#agi-warning')).toBeHidden();
    await expect(page.locator('#btn-agi-scaling')).toBeFocused();
    expect(await page.evaluate(() => GAME.state.agi.route)).toBe('');
    await page.locator('#btn-agi-scaling').click();
    await page.locator('#btn-agi-cancel').click();
    await expect(page.locator('#agi-route-choices')).toBeVisible();
    await expect(page.locator('#phase-label')).toHaveText('Phase 16: AGI');
    await page.locator('#btn-agi-scaling').click();
    await page.locator('#btn-agi-confirm').click();
    expect(await page.evaluate(() => GAME.state.agi.route)).toBe('scaling');
    expect(await page.evaluate(() => GAME.state.phase)).toBe(16);
    await expect(upgrade(page, 'retire_unlock')).toHaveCount(0);
    await page.clock.runFor(16000);
    await expect(page.locator('.agi-cursor:visible')).toHaveCount(3);
    expect(await page.evaluate(() => GAME.state.agi.replicas)).toBeGreaterThan(20);
    const elapsed = await page.evaluate(() => GAME.state.agi.runawaySeconds);
    await saveAndReload(page);
    expect(await page.evaluate(() => GAME.state.agi.runawaySeconds)).toBe(elapsed);
    await page.clock.runFor(12000);
    await expect(page.locator('body')).toHaveAttribute('data-agi-stage', '3');
    await expect(page.locator('.agi-cursor:visible')).toHaveCount(4);
    await expect(page.locator('#agi-runaway-panel')).toBeInViewport();
    expect(await page.locator('#agi-runaway-panel').evaluate(panel => panel.scrollWidth <= panel.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/agi-runaway-${layout}-${width}.png`, animations: 'disabled' });
    await page.clock.runFor(21000);
    await expect(page.locator('#ending-overlay')).toBeVisible();
    await expect(page.locator('#ending-title')).toHaveText('There is always one more task.');
    await expect(page.locator('#btn-ending-reset')).toBeFocused();
    await expect(page.locator('#ending-choices')).toBeHidden();
    await expect(page.locator('#agi-cursors')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await saveAndReload(page);
    await expect(page.locator('#ending-title')).toHaveText('There is always one more task.');
    await expect(page.locator('#btn-ending-reset')).toBeFocused();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#btn-ending-reset').click();
    await expect(page.locator('#intro-overlay')).toBeVisible();
    await expect(page.locator('#agi-runaway-panel')).toBeHidden();
    expect(await page.evaluate(() => GAME.state.agi.route)).toBe('');
    expect(await page.evaluate(() => GAME.state.phase)).toBe(1);
  });
}

test('mouse movement and wheel input restore control until AGI is resumed', async ({ page }) => {
  await openAgiCheckpoint(page);
  await page.clock.runFor(1000);
  await expect(page.locator('#agi-cursors')).toBeVisible();
  await page.mouse.move(200, 200);
  await expect(page.locator('#agi-cursors')).toBeHidden();
  await expect(page.locator('#btn-agi-resume')).toBeVisible();
  expect(await page.locator('#game-container').evaluate(element => getComputedStyle(element).cursor)).not.toBe('none');
  await page.clock.runFor(6000);
  expect(await page.evaluate(() => GAME.state.agi.paused)).toBe(true);
  await page.locator('#btn-agi-resume').click();
  await page.clock.runFor(1000);
  await expect(page.locator('#agi-cursors')).toBeVisible();
  await page.mouse.wheel(0, 200);
  await expect(page.locator('#agi-cursors')).toBeHidden();
  expect(await page.evaluate(() => GAME.state.agi.paused)).toBe(true);
});

test.describe('touch interaction', () => {
  test.use({ hasTouch: true });
  test('touch restores the human controls and supports the branch confirmation', async ({ page }) => {
    await openAgiCheckpoint(page, 390);
    await page.clock.runFor(1000);
    await expect(page.locator('#agi-cursors')).toBeVisible();
    await page.touchscreen.tap(30, 140);
    await expect(page.locator('#agi-cursors')).toBeHidden();
    await page.locator('#btn-agi-resume').tap();
    await page.clock.runFor(1000);
    await expect(page.locator('#agi-cursors')).toBeVisible();
    await page.locator('#btn-agi-scaling').tap();
    await expect(page.locator('#agi-warning')).toBeVisible();
    await page.locator('#btn-agi-cancel').tap();
    await expect(page.locator('#agi-route-choices')).toBeVisible();
    await expect(page.locator('#phase-label')).toHaveText('Phase 16: AGI');
  });
});

test('reduced motion removes cursor animation and still completes the scaling ending', async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAgiCheckpoint(page, 390);
  await page.clock.runFor(1000);
  await expect(page.locator('#agi-cursor')).toHaveCSS('transition-duration', '0s');
  await page.locator('#btn-agi-scaling').click();
  await page.locator('#btn-agi-confirm').click();
  await page.clock.runFor(46000);
  await expect(page.locator('#ending-title')).toHaveText('There is always one more task.');
  await expect(page.locator('#sale-transition')).toBeHidden();
  await expect(page.locator('#btn-ending-reset')).toBeEnabled();
});
