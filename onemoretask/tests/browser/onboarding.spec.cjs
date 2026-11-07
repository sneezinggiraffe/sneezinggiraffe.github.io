const { test, expect } = require('@playwright/test');

for (const [width, height] of [[1440, 900], [390, 900], [320, 900], [320, 568], [844, 390]]) {
  test(`card opening leads to a working inbox task and a lone introductory upgrade at ${width}x${height}px`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({width, height});
    const start = Date.now();
    await page.clock.install({time: new Date(start)});
    await page.clock.pauseAt(new Date(start + 1000));
    await page.goto('/');
    await expect(page.locator('#intro-overlay')).toBeVisible();
    await expect(page.locator('#intro-title')).toBeInViewport();
    const findWork = page.getByRole('button', {name: 'Find Work', exact: true});
    await findWork.click();

    for (let index = 0; index < 3; index++) {
      const work = page.getByRole('button', {name: 'Do Task', exact: true});
      await expect(work).toBeInViewport();
      await expect(page.locator('#prelude-section')).toBeVisible();
      await expect(page.locator('#task-queue-section')).toBeHidden();
      await expect(page.locator('#section-agents')).toBeHidden();
      await expect(page.locator('#prelude-details')).toBeVisible();
      await expect(page.locator('#prelude-task')).not.toBeEmpty();
      if (index < 2) await expect(page.locator('#top-bar')).toBeHidden();
      else await expect(page.locator('#top-bar')).toBeVisible();
      await work.click();
      await expect(page.locator('.click-reward')).toHaveCount(0);
      await page.clock.runFor(300);
      expect(Number(await page.locator('#prelude-progress').getAttribute('aria-valuenow'))).toBeGreaterThan(0);
      if (index === 0) await page.screenshot({ path: `test-results/prelude-${width}-${height}.png`, fullPage: true, animations: 'disabled' });
      await page.clock.runFor(700);
      if (index === 0) await expect(page.locator('#top-bar')).toBeHidden();
      else await expect(page.locator('#top-bar')).toBeVisible();
    }
    await expect(page.locator('#prelude-section')).toBeHidden();
    await expect(page.locator('#team-heading')).toHaveText('');
    await expect(page.locator('#you-card, #btn-do-task')).toHaveCount(0);
    await expect(page.locator('#section-agents')).toBeHidden();
    expect(await page.evaluate(() => GAME.state.manualTasksCompleted)).toBe(3);
    await expect(page.locator('#task-list .task-card')).toHaveCount(1);
    await expect(page.locator('#task-list')).toContainText('Set Up Your Inbox');
    await expect(page.locator('#task-list')).toContainText('Pay: $0');
    expect(await page.evaluate(() => GAME.state.totalTasksDone)).toBe(3);
    await expect(page.locator('#milestone-popup')).toBeHidden();
    await page.clock.runFor(5000);
    await expect(page.locator('#task-list .task-card')).toHaveCount(1);
    await page.screenshot({path: `test-results/inbox-waiting-${width}.png`, fullPage: true});
    await page.reload();

    await expect(page.locator('#task-list .task-card')).toHaveCount(1);
    await page.locator('#task-list > .task-card').focus();
    await page.keyboard.press('Enter');
    await page.clock.runFor(400);
    await expect(page.locator('#task-list .task-card')).toHaveCount(3);
    const inbox = page.locator('#task-list .task-card').filter({hasText: 'Set Up Your Inbox'});
    await expect(inbox.locator('[data-assignment="active"]')).toBeVisible();
    const progress = await inbox.locator('.task-bar-fill').evaluate(element => parseFloat(element.style.width));
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(100);
    expect(await page.evaluate(() => GAME.state.totalTasksDone)).toBe(3);
    const cash = await page.evaluate(() => GAME.state.cash);
    await page.screenshot({path: `test-results/inbox-working-${width}.png`, fullPage: true});
    await page.reload();

    await expect(inbox.locator('[data-assignment="active"]')).toBeVisible();
    await page.clock.runFor(2000);
    expect(await page.evaluate(() => GAME.state.totalTasksDone)).toBe(4);
    expect(await page.evaluate(() => GAME.state.cash)).toBe(cash);
    await expect(inbox).toHaveCount(0);
    for (let index = 0; index < 3; index++) {
      await page.locator('#task-list > .task-card:enabled .task-name').first().click();
      await page.clock.runFor(1500);
    }
    const intro = page.locator('#upgrade-list .upgrade-card');
    await expect(intro).toHaveCount(1);
    await expect(intro).toContainText('Tools of the Trade');
    await expect(page.locator('#section-log')).toBeHidden();
    await expect(page.locator('#milestone-popup')).toBeHidden();
    await page.reload();

    await expect(intro).toHaveCount(1);
    await expect(intro).toContainText('Tools of the Trade');
    await expect(page.locator('#section-log')).toBeHidden();
    await page.screenshot({path: `test-results/tools-alone-${width}.png`, fullPage: true});
    const beforeFree = await page.evaluate(() => GAME.state.cash);
    await expect(intro.locator('button')).toHaveText('');
    await intro.click({ position: { x: 5, y: 5 } });
    await page.clock.runFor(200);
    expect(await page.evaluate(() => GAME.state.cash)).toBe(beforeFree);
    await expect(page.locator('#section-log')).toBeVisible();
    await expect(page.locator('#upgrade-list .upgrade-card')).toHaveCount(3);
    await expect(page.locator('#upgrade-list')).not.toContainText('Tools of the Trade');
    await page.reload();

    await expect(page.locator('#upgrade-list .upgrade-card')).toHaveCount(3);
    await expect(page.locator('#upgrade-list')).not.toContainText('Tools of the Trade');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
