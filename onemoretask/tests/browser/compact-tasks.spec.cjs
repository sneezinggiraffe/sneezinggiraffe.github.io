const { test, expect } = require('@playwright/test');

async function openInbox(page, width, layout, count = 8) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const now = Date.now();
  await page.clock.install({ time: new Date(now) });
  await page.clock.pauseAt(new Date(now + 1000));
  await page.goto('/#layout=' + layout);
  await page.evaluate(count => {
    GAME.cheat('0_2');
    GAME.state.totalTasksDone = 35;
    GAME.state.taskDetails = true;
    GAME.state.tasks = Array.from({ length: count }, (_, index) => ({
      id: 'compact-' + index, typeId: 'email', name: 'Research Snippet', icon: '▤',
      client: 'Monica (following up)', batchSize: index === 2 ? 2000 : 1, workRequired: 800, workDone: index,
      pay: 5, tokenCost: 0, failChance: 0, assignedAgent: null, status: 'available', createdAt: Date.now(),
    }));
    GAME.state.lastTaskSpawn = Date.now() + 1e9;
  }, count);
  await page.clock.runFor(200);
}

for (const width of [1440, 844, 390, 320]) {
  for (const layout of [3, 4]) {
    test(`original-sized cards fit and clicking starts the chosen task in view ${layout} at ${width}px`, async ({ page }) => {
      await openInbox(page, width, layout);
      const card = page.locator('[data-task-id="compact-2"]');
      const size = await card.evaluate(element => {
        const style = getComputedStyle(element);
        return { width: parseFloat(style.width), height: parseFloat(style.height), bottom: element.querySelector('.task-bottom').getBoundingClientRect().bottom, cardBottom: element.getBoundingClientRect().bottom };
      });
      expect(size.width).toBeLessThanOrEqual(width);
      expect(size.width).toBeGreaterThan(width <= 768 && layout === 3 ? 110 : 220);
      expect(size.height).toBe(layout === 3 ? (width <= 768 ? 158 : 148) : 152);
      expect(size.bottom).toBeLessThanOrEqual(size.cardBottom);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('#task-count')).toHaveCount(0);
      await expect(card).toHaveRole('button');
      const clicks = await page.evaluate(() => GAME.state.totalClicks);
      await card.locator('.task-name').click();
      await expect(card).toHaveAttribute('data-task-state', 'active');
      await expect(card).toBeDisabled();
      await expect(page.locator('#btn-do-task')).toBeDisabled();
      await expect(page.locator('[data-task-id="compact-0"]')).toHaveAttribute('data-task-state', 'available');
      await expect(page.locator('[data-task-id="compact-0"]')).toBeDisabled();
      expect(await page.evaluate(() => GAME.state.totalClicks)).toBe(clicks + 1);
      await page.screenshot({ path: `test-results/compact-${layout}-${width}.png` });
    });
  }
}

test('vertical notes have varied stable angles, no tray outline and continue below the viewport', async ({ page }) => {
  await openInbox(page, 1440, 4, 30);
  const initial = await page.locator('#task-list > .task-card').evaluateAll(cards => cards.map(card => ({ id: card.dataset.taskId, angle: card.style.getPropertyValue('--paper-angle') })));
  expect(new Set(initial.map(card => card.angle)).size).toBeGreaterThan(20);
  expect(initial.every(card => parseFloat(card.angle) >= -2 && parseFloat(card.angle) <= 2.4)).toBe(true);
  const tray = await page.locator('#task-list').evaluate(list => {
    const style = getComputedStyle(list);
    const cards = [...list.children].map(card => card.getBoundingClientRect());
    const pane = document.querySelector('#work-stream').getBoundingClientRect();
    return {
      borders: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
      shadow: style.boxShadow,
      background: style.backgroundImage,
      paneWidth: pane.width,
      partial: cards.filter(card => card.top < innerHeight && card.bottom > innerHeight).length,
      lastBottom: cards.at(-1).bottom,
      height: innerHeight,
    };
  });
  expect(tray.borders).toEqual(['0px', '0px', '0px', '0px']);
  expect(tray.shadow).toBe('none');
  expect(tray.background).toBe('none');
  expect(tray.paneWidth).toBeGreaterThan(350);
  expect(tray.paneWidth).toBeLessThan(500);
  expect(tray.partial).toBeGreaterThanOrEqual(1);
  expect(tray.lastBottom).toBeGreaterThan(tray.height + 100);
  const headingStyles = await page.locator('#task-queue-section h3, #section-upgrades h3').evaluateAll(headings => headings.map(heading => {
    const style = getComputedStyle(heading);
    return [style.fontFamily, style.fontSize, style.fontWeight, style.backgroundColor, style.border, style.boxShadow];
  }));
  expect(headingStyles).toHaveLength(2);
  expect(headingStyles[0]).toEqual(headingStyles[1]);
  await page.screenshot({ path: 'test-results/compact-vertical-overflow.png' });
  await page.evaluate(() => GAME.state.tasks.reverse());
  await page.clock.runFor(200);
  const reordered = await page.locator('#task-list > .task-card').evaluateAll(cards => cards.map(card => ({ id: card.dataset.taskId, angle: card.style.getPropertyValue('--paper-angle') })));
  expect(reordered.sort((a, b) => a.id.localeCompare(b.id))).toEqual(initial.sort((a, b) => a.id.localeCompare(b.id)));
});

test('task cards support keyboard work and Multitasking uses the same two slots as Do work', async ({ page }) => {
  await openInbox(page, 1440, 3);
  await page.evaluate(() => GAME.state.purchasedUpgrades.push('multitasking'));
  const selected = page.locator('[data-task-id="compact-2"]');
  await selected.focus();
  await page.keyboard.press('Space');
  await expect(selected).toHaveAttribute('data-task-state', 'active');
  await expect(page.locator('[data-task-id="compact-0"]')).toHaveAttribute('data-task-state', 'active');
  await expect(page.locator('#btn-do-task')).toBeDisabled();
  expect(await page.evaluate(() => GAME.state.tasks.filter(task => task.status === 'active').length)).toBe(2);
});

for (const [width, height] of [[1440, 900], [320, 568], [844, 390]]) {
  test(`the opening has regular buttons inside task cards near the top at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await page.goto('/');
    const intro = await page.locator('#intro-overlay').boundingBox();
    expect(intro.y).toBeLessThan(height * 0.2);
    const start = page.getByRole('button', { name: 'Find Work', exact: true });
    await expect(start).toHaveClass(/btn-primary/);
    await expect(page.locator('#intro-overlay .opening-task-card, .intro-box')).toHaveCount(0);
    expect(await start.evaluate(button => button.closest('.opening-task-card').id)).toBe('intro-overlay');
    await expect(page.locator('#intro-overlay .task-name')).toHaveText('One More Task');
    await expect(page.locator('#top-bar')).toBeHidden();
    await expect(start).toBeInViewport();
    await start.click();
    const work = page.getByRole('button', { name: 'Do Task', exact: true });
    await expect(work).toHaveClass(/btn-primary/);
    expect(await work.evaluate(button => button.closest('.opening-task-card').id)).toBe('prelude-card');
    await expect(page.locator('#prelude-hint')).toHaveText('Click Do Task to complete this gig.');
    await expect(page.locator('#prelude-task')).not.toBeEmpty();
    await expect(page.locator('#prelude-pay')).toContainText('Pay: $');
    await expect(page.locator('#top-bar')).toBeHidden();
    const box = await page.locator('#prelude-card').boundingBox();
    expect(box.y).toBeLessThan(height * 0.35);
    expect(box.height).toBeGreaterThanOrEqual(100);
    await work.click();
    await expect(work).toBeDisabled();
    await expect(page.locator('#prelude-details')).toBeVisible();
    await expect(page.locator('#prelude-hint')).toBeHidden();
  });
}
