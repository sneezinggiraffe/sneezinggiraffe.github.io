const { test, expect } = require('@playwright/test');

for (const width of [1440, 844, 390, 320]) {
  test(`final Cut & Paste styling stays readable through game progression at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(217, 221, 218)');
    await expect(page.locator('#intro-overlay')).toHaveCSS('border-radius', '1px');
    await page.getByRole('button', { name: 'Find Work', exact: true }).click();
    for (const stage of ['0_', 6, 9, 11, 13, 16]) {
      await page.evaluate(value => GAME.cheat(value), stage);
      await page.clock.runFor(200);
      await expect(page.locator('#rotate-overlay, #offline-popup')).toHaveCount(0);
      await expect(page.locator('#milestone-popup')).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const topBar = await page.locator('#top-bar').boundingBox();
      const taskHeading = await page.locator('#task-queue-section > .section-hdr').boundingBox();
      expect(topBar.y + topBar.height).toBeLessThanOrEqual(taskHeading.y);
      await expect(page.locator('#phase-label')).toHaveCSS('border-radius', '2px');
      const section = page.locator('.cp-section:visible > .card').first();
      await expect(section).toHaveCSS('box-shadow', 'none');
      await expect(section).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      const markerText = await page.locator('.agent-icon:visible, .task-icon:visible').allTextContents();
      if (stage === '0_') expect(markerText.length).toBeGreaterThan(0);
      expect(markerText.join('')).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(await page.locator('.agent-icon:visible, .task-icon:visible').evaluateAll(markers => markers.every(marker => marker.getAttribute('aria-hidden') === 'true'))).toBe(true);
      const filled = page.locator('.capacity-slot.filled').first();
      if (await filled.count()) {
        await expect(filled).toHaveCSS('background-color', 'rgb(129, 135, 125)');
      }
    }
    await page.evaluate(() => GAME.cheat(6));
    await page.clock.runFor(200);
    const topUp = page.getByRole('button', { name: 'Add tokens', exact: true }).first();
    await expect(topUp).toHaveCSS('border-radius', '0px');
    if (width <= 768) {
      expect((await topUp.boundingBox()).height).toBeGreaterThanOrEqual(40);
      expect((await page.locator('#btn-settings').boundingBox()).height).toBeGreaterThanOrEqual(40);
    }
    await page.locator('#btn-settings').click();
    await expect(page.locator('#settings-popup .popup')).toHaveCSS('border-radius', '0px');
    await expect(page.locator('#settings-msg')).not.toHaveText('Manage settings.');
    await expect(page.locator('#btn-settings-reset')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.screenshot({ path: `test-results/visual-refresh-${width}.png`, fullPage: true });
  });
}

test('token shortages stay visible without glow or continuous motion and managed workers remain legible', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => {
    chStart9();
    GAME.state.tasks = [];
    GAME.state.lastTaskSpawn = Date.now() + 1e9;
    GAME.state.aiFailMult = 0;
    GAME.state.tokens = 0;
    GAME.state.cash = 0;
    GAME.state.managerTokenTank = 0;
    GAME.state.techDebt = 0;
    for (const agent of GAME.state.agents) agent.tokenTank = 0;
  });
  await page.clock.runFor(200);
  const warning = page.locator('#res-tokens-wrap');
  await expect(warning).toHaveClass(/res-warning/);
  await expect(warning).toHaveCSS('animation-name', 'none');
  await expect(warning).toHaveCSS('box-shadow', 'none');
  await expect(page.locator('#res-debt-wrap')).not.toHaveClass(/res-debt-active/);
  await expect(page.locator('#res-debt')).toHaveCSS('color', 'rgb(32, 40, 33)');
  await page.evaluate(() => { GAME.state.techDebt = 20; });
  await page.clock.runFor(200);
  await expect(page.locator('#res-debt-wrap')).toHaveClass(/res-debt-active/);
  const managed = page.locator('.agent-managed').first();
  await expect(managed).toHaveAttribute('role', 'status');
  await expect(managed).toHaveText('Managed');
  await expect(managed).toHaveCSS('opacity', '1');
  await expect(page.getByRole('button', { name: 'Managed', exact: true })).toHaveCount(0);
  const depleted = page.locator('.agent-card.res-warning');
  expect(await depleted.count()).toBeGreaterThan(0);
  await expect(page.locator('.management-agent.res-warning')).toHaveCount(1);
  for (const card of await depleted.all()) {
    await expect(card).toHaveCSS('background-color', 'rgb(239, 221, 218)');
    await expect(card).toHaveCSS('border-top-color', 'rgb(162, 58, 56)');
    await expect(card).toHaveCSS('animation-name', 'none');
    await expect(card).toHaveCSS('box-shadow', 'rgb(157, 167, 155) 3px 3px 0px 0px');
  }
});

test('retirement retains its existing colours and controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => chRetire());
  await page.locator('[onclick="GAME.buy(\'fusion\')"]').click();
  await expect(page.locator('#ending-overlay')).toBeVisible();
  await expect(page.locator('#ending-overlay')).toHaveCSS('background-color', 'rgb(10, 14, 23)');
  await expect(page.locator('#ending-title')).toHaveCSS('color', 'rgb(16, 185, 129)');
  await expect(page.locator('#btn-ending-restart')).toHaveCSS('background-color', 'rgb(139, 92, 246)');
  await expect(page.locator('#btn-ending-restart')).toHaveCSS('border-radius', '8px');
});

for (const width of [844, 320]) {
  test(`large delivery counts fit on one line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const now = Date.now();
    await page.clock.install({ time: new Date(now) });
    await page.clock.pauseAt(new Date(now + 1000));
    await page.goto('/');
    await page.evaluate(() => GAME.cheat(16));
    await page.clock.runFor(200);
    const number = await page.locator('.delivery-rate').evaluate(element => {
      element.firstChild.textContent = '304,532,335';
      const range = document.createRange();
      range.selectNodeContents(element.firstChild);
      const rectangles = [...range.getClientRects()];
      const box = element.getBoundingClientRect();
      return { lines: rectangles.length, fits: rectangles.every(rect => rect.left >= box.left && rect.right <= box.right) };
    });
    expect(number).toEqual({ lines: 1, fits: true });
  });
}
