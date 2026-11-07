const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const gameFileUrl = pathToFileURL(path.resolve(__dirname, '../../index.html')).href;

function fillQueue() {
  GAME.state.tasks = Array.from({ length: 8 }, (_, index) => ({
    id: 'layout-task-' + index, typeId: 'email', name: 'Research Snippet', icon: '▤',
    client: 'Monica (following up)', batchSize: 1, workRequired: 800, workDone: index * 20,
    pay: 5, tokenCost: 2, failChance: 0, assignedAgent: null, status: 'available', createdAt: Date.now(),
  }));
  GAME.state.lastTaskSpawn = Date.now() + 1e9;
  GAME.state.taskDetails = true;
}

async function openPile(page, layout, { automatic = false, reducedMotion = 'no-preference' } = {}) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion });
  const now = Date.now();
  await page.clock.install({ time: new Date(now) });
  await page.clock.pauseAt(new Date(now + 1000));
  await page.goto(gameFileUrl + '#layout=' + layout);
  await page.evaluate(automatic => {
    GAME.cheat('0_2');
    GAME.state.totalTasksDone = 35;
    GAME.state.cash = 1000;
    GAME.state.taskDetails = true;
    GAME.state.lastTaskSpawn = Date.now() + 1e9;
    GAME.state.tasks = Array.from({ length: 3 }, (_, index) => ({
      id: 'pile-job-' + index, typeId: 'email', name: ['Finish the invoice', 'Waiting research', 'Waiting email'][index], icon: '▤',
      client: 'Monica (following up)', batchSize: 1, workRequired: index === 0 ? 2 : 800, workDone: 0,
      pay: 10, tokenCost: 0, failChance: 0, assignedAgent: null, status: 'available', createdAt: Date.now(),
    }));
    if (automatic) GAME.buy('hire_assistant');
  }, automatic);
  await page.clock.runFor(200);
  await expect(page.locator('#task-list > .task-card')).toHaveCount(3);
  await expect(page.locator('#you-card')).toBeVisible();
}


for (const width of [1440, 844, 390, 320]) {
  test(`both views preserve play and fit throughout progression at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const now = Date.now();
    await page.clock.install({ time: new Date(now) });
    await page.clock.pauseAt(new Date(now + 1000));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(gameFileUrl);
    for (const phase of [1, 6, 11, 16]) {
      await page.evaluate(value => GAME.cheat(value === 1 ? '0_' : value), phase);
      await page.evaluate(fillQueue);
      await page.clock.runFor(200);
      const state = await page.evaluate(() => JSON.stringify(GAME.state));
      for (const layout of [3, 4]) {
        await page.locator(`[data-layout-choice="${layout}"]`).click();
        const result = await page.evaluate(() => ({
          theme: document.body.dataset.theme,
          layout: document.body.dataset.layout,
          overflow: document.documentElement.scrollWidth > innerWidth,
          containerWidth: document.querySelector('#game-container').getBoundingClientRect().width,
          sectionWidths: [...document.querySelectorAll('.cp-section')]
            .filter(element => getComputedStyle(element).display !== 'none')
            .map(element => ({ id: element.id, width: element.getBoundingClientRect().width })),
          state: JSON.stringify(GAME.state),
        }));
        const context = `layout ${layout}, phase ${phase}`;
        expect(result.theme, context).toBe('3');
        expect(result.layout, context).toBe(String(layout));
        expect(result.overflow, context).toBe(false);
        expect(result.containerWidth, context).toBeLessThanOrEqual(width);
        expect(result.sectionWidths.every(section => section.width > 0 && section.width <= width), context + JSON.stringify(result.sectionWidths)).toBe(true);
        expect(result.state, context).toBe(state);
      }
    }
    expect(errors).toEqual([]);
  });
}

test('H spreads notes across the desk and V stacks them beside the team', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto(gameFileUrl);
  await page.evaluate(() => GAME.cheat('0_'));
  await page.evaluate(fillQueue);
  await page.clock.runFor(200);
  await page.getByRole('button', { name: 'Horizontal view', exact: true }).click();
  await expect(page.locator('#task-list')).toHaveCSS('display', 'grid');
  const horizontalQueue = await page.locator('#work-stream').boundingBox();
  const horizontalTeam = await page.locator('#section-agents').boundingBox();
  expect(horizontalQueue.y + horizontalQueue.height).toBeLessThanOrEqual(horizontalTeam.y);
  await page.screenshot({ path: 'test-results/horizontal-view.png', fullPage: true });
  await page.getByRole('button', { name: 'Vertical view', exact: true }).click();
  await expect(page.locator('#task-list')).toHaveCSS('display', 'flex');
  await expect(page.locator('#task-list')).toHaveCSS('flex-direction', 'column');
  const verticalQueue = await page.locator('#work-stream').boundingBox();
  const verticalTeam = await page.locator('#section-agents').boundingBox();
  expect(verticalQueue.x + verticalQueue.width).toBeLessThan(verticalTeam.x);
  const notes = await page.locator('#task-list > .task-card').all();
  const first = await notes[0].boundingBox();
  const second = await notes[1].boundingBox();
  expect(second.y).toBeGreaterThan(first.y);
  expect(second.y).toBeLessThan(first.y + first.height);
  await page.screenshot({ path: 'test-results/vertical-view.png', fullPage: true });
});

test('V and H support keyboard activation and restore the view from a file URL', async ({ page }) => {
  await page.goto(gameFileUrl + '#layout=3&review=views');
  await page.evaluate(() => GAME.cheat('0_'));
  const group = page.getByRole('group', { name: 'Game views', exact: true });
  await expect(group.locator('button')).toHaveText(['V', 'H']);
  const vertical = group.getByRole('button', { name: 'Vertical view', exact: true });
  await vertical.focus();
  await page.keyboard.press('Tab');
  await expect(group.getByRole('button', { name: 'Horizontal view', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#btn-settings')).toBeFocused();
  await vertical.focus();
  await page.keyboard.press('Enter');
  await expect(vertical).toBeFocused();
  await expect(vertical).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('body')).toHaveAttribute('data-layout', '4');
  expect(new URL(page.url()).hash).toContain('review=views');
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-layout', '4');
  await expect(page.locator('body')).toHaveAttribute('data-theme', '3');
  const horizontal = group.getByRole('button', { name: 'Horizontal view', exact: true });
  await horizontal.focus();
  await page.keyboard.press('Space');
  await expect(horizontal).toBeFocused();
  await expect(horizontal).toHaveAttribute('aria-pressed', 'true');
  await expect(vertical).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('body')).toHaveAttribute('data-layout', '3');
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-layout', '3');
});

for (const layout of [3, 4]) {
  for (const automatic of [false, true]) {
    test(`pile ${layout} crosses off a real ${automatic ? 'assistant' : 'manual'} completion and removes it`, async ({ page }) => {
      await openPile(page, layout, { automatic });
      expect(await page.locator('[data-task-id="pile-job-0"]').evaluate(element => getComputedStyle(element).animationName)).not.toBe('none');
      const before = await page.evaluate(() => ({ cash: GAME.state.cash, tasks: GAME.state.totalTasksDone, clicks: GAME.state.totalClicks }));
      const waiting = await page.locator('[data-task-id="pile-job-1"]').elementHandle();
      if (automatic) {
        await expect(page.locator('[data-task-id="pile-job-0"]')).toHaveAttribute('data-task-state', 'assistant');
        await page.evaluate(() => { GAME.state.tasks.find(task => task.id === 'pile-job-0').workDone = 1.95; });
        await page.clock.runFor(200);
      } else {
        await page.locator('#btn-do-task').click();
        await page.clock.runFor(400);
      }
      const ghost = page.locator('[data-task-completion="pile-job-0"]');
      await expect(ghost).toHaveCount(1);
      await expect(ghost).toHaveAttribute('data-task-state', 'done');
      await expect(ghost).toHaveAttribute('aria-hidden', 'true');
      await expect(ghost).toHaveAttribute('inert', '');
      await expect(ghost.locator('.task-assignee')).toHaveText('Done');
      await expect(ghost.locator('[data-task-work]')).toHaveText('Work: 2/2');
      await expect(ghost.locator('.task-name')).toHaveCSS('text-decoration-line', 'line-through');
      await expect(ghost).toHaveCSS('pointer-events', 'none');
      expect(await ghost.evaluate(element => getComputedStyle(element).animationName)).not.toBe('none');
      await expect(page.locator('#task-list > .task-card')).toHaveCount(2);
      await expect(page.locator('[data-task-id="pile-job-0"]')).toHaveCount(0);
      await expect(page.locator('#task-count')).toHaveText('2 tasks');
      expect(await waiting.evaluate(element => element === document.querySelector('[data-task-id="pile-job-1"]'))).toBe(true);
      const after = await page.evaluate(() => ({ cash: GAME.state.cash, tasks: GAME.state.totalTasksDone, clicks: GAME.state.totalClicks }));
      expect(after.tasks).toBe(before.tasks + 1);
      expect(after.cash).toBeCloseTo(before.cash + (automatic ? 8.5 : 10));
      expect(after.clicks).toBe(before.clicks + (automatic ? 0 : 1));
      await page.screenshot({ path: `test-results/pile-${layout}-${automatic ? 'assistant' : 'manual'}-completed.png`, fullPage: true });
      await page.clock.runFor(1200);
      await expect(ghost).toHaveCount(0);
      expect(await page.evaluate(() => GAME.state.totalTasksDone)).toBe(after.tasks);
      expect(await page.evaluate(() => GAME.state.cash)).toBeCloseTo(after.cash);
      await page.locator('#btn-do-task').click({ trial: true });
      await page.screenshot({ path: `test-results/pile-${layout}-${automatic ? 'assistant' : 'manual'}.png`, fullPage: true });
    });
  }
}

test('new notes enter once while existing notes keep their identity and reduced motion skips movement', async ({ page }) => {
  await openPile(page, 3, { reducedMotion: 'reduce' });
  const original = await page.locator('[data-task-id="pile-job-1"]').elementHandle();
  await expect(page.locator('[data-task-id="pile-job-1"]')).toHaveCSS('animation-name', 'none');
  await page.evaluate(() => {
    const template = GAME.state.tasks[1];
    GAME.state.tasks.push({ ...template, id: 'new-arrival', name: 'New note on the desk', workDone: 0, createdAt: Date.now() });
  });
  await page.clock.runFor(200);
  await expect(page.locator('[data-task-id="new-arrival"]')).toHaveCount(1);
  expect(await original.evaluate(element => element === document.querySelector('[data-task-id="pile-job-1"]'))).toBe(true);
  await page.locator('#btn-do-task').click();
  await page.clock.runFor(400);
  const ghost = page.locator('[data-task-completion="pile-job-0"]');
  await expect(ghost).toHaveCount(1);
  await expect(ghost).toHaveCSS('animation-name', 'none');
  await expect(ghost.locator('.task-name')).toHaveCSS('text-decoration-line', 'line-through');
  await page.clock.runFor(1200);
  await expect(ghost).toHaveCount(0);
});

test('switching views clears old completed notes and new completions use the selected view', async ({ page }) => {
  await openPile(page, 3, { reducedMotion: 'reduce' });
  await page.locator('#btn-do-task').click();
  await page.clock.runFor(400);
  await expect(page.locator('[data-task-completion]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Vertical view', exact: true }).click();
  await expect(page.locator('[data-task-completion]')).toHaveCount(0);
  await page.evaluate(() => { GAME.state.tasks[0].workDone = GAME.state.tasks[0].workRequired - 0.1; });
  await page.locator('#btn-do-task').click();
  await page.clock.runFor(200);
  await expect(page.locator('[data-task-completion]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Horizontal view', exact: true }).click();
  await expect(page.locator('[data-task-completion]')).toHaveCount(0);
  await expect(page.locator('body')).toHaveAttribute('data-layout', '3');
});
