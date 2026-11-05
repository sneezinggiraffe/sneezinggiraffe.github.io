const { test, expect } = require('@playwright/test');
const { harness } = require('../harness.cjs');

async function openTeam(page, width, phase = 1) {
  const h = harness(); const g = h.fresh(phase);
  g.totalTasksDone = phase === 1 ? 7 : 650; g.cash = 20000; g.uiRevealed.taskQueue = true;
  if (phase === 1) { h.api.purchaseUpgrade('tools_of_trade'); h.api.purchaseUpgrade('hire_assistant'); h.api.purchaseUpgrade('gas_station_coffee'); h.api.purchaseUpgrade('sticky_note_system'); g.payMult = 1; }
  else { h.prepareUpgrade('second_ai'); g.assistant.dismissed = false; }
  g.aiFailMult = 0; g.incidentsExplained = true;
  h.api.checkMilestones(); h.dismiss();
  g.tasks = [];
  g.lastTick = Date.now(); g.lastTaskSpawn = g.lastTick + 1e9;
  for (let index = 0; index < (phase === 1 ? 7 : 5); index++) {
    const task = h.task(); task.workRequired = phase === 1 ? 8 : 100; task.pay = 10; task.createdAt = g.lastTick + index;
  }
  if (phase > 1) { h.api.assignAssistantWork(); g.aiWorkerTokenTank = h.api.workerTokenCapacity(); }
  const raw = JSON.stringify(g); h.close();
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: new Date(g.lastTick) });
  await page.clock.pauseAt(new Date(g.lastTick + 1000));
  await page.addInitScript(value => { if (!localStorage.getItem('ai_empire_save')) localStorage.setItem('ai_empire_save', value); }, raw);
  await page.goto('/');
  if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
}

for (const width of [1440, 390]) {
  test(`assistant starts four concurrent tasks, survives reload and stops at ${width}px`, async ({ page }) => {
    await openTeam(page, width);
    const assistant = page.locator('[data-assistant]');
    await expect(page.locator('#team-heading')).toHaveText('Team');
    await expect(page.locator('#you-card > .agent-icon')).toBeVisible();
    await expect(page.locator('[data-assistant] > .agent-icon')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss assistant' })).toHaveCount(0);
    await expect(assistant).toContainText('Waiting for work');
    const cash = await page.evaluate(() => GAME.state.cash);
    await assistant.getByRole('button', { name: 'Assign work' }).click();
    await page.clock.runFor(500);
    await expect(page.locator('#task-list button')).toHaveCount(0);
    await expect(page.locator('.task-assignee')).toHaveText(['Assistant', 'Assistant', 'Assistant', 'Assistant', 'Unassigned', 'Unassigned', 'Unassigned']);
    await expect(assistant).toContainText('4 working');
    await expect(assistant.getByRole('button', { name: 'Working...' })).toBeDisabled();
    const ids = await page.evaluate(() => GAME.state.assistant.taskIds);
    await page.reload();
    if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
    expect(await page.evaluate(() => GAME.state.assistant.taskIds)).toEqual(ids);
    await page.clock.runFor(2100);
    expect(await page.evaluate(() => GAME.state.assistant.tasksCompleted)).toBe(4);
    expect(await page.evaluate(() => GAME.state.cash)).toBeCloseTo(cash + 34);
    await expect(page.locator('#task-list .task-card')).toHaveCount(3);
    await expect(assistant).toContainText('Waiting for work');
    await page.screenshot({ path: `test-results/individual-tasks-${width}.png`, fullPage: true });
    await page.clock.runFor(4200);
    await expect(assistant).toContainText('Waiting for work');
    expect(await page.evaluate(() => GAME.state.assistant.tasksCompleted)).toBe(4);
    await page.clock.runFor(2000);
    await expect(page.locator('.task-assignee')).toHaveText(['Unassigned', 'Unassigned', 'Unassigned']);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('#btn-do-task')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`Pro replaces the assistant, keeps progress and renames Team at ${width}px`, async ({ page }) => {
    await openTeam(page, width, 3);
    await page.clock.runFor(500);
    await expect(page.locator('#team-heading')).toHaveText('Team');
    await expect(page.locator('#you-card > .agent-icon')).toBeVisible();
    await expect(page.locator('[data-assistant] > .agent-icon')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss assistant' })).toHaveCount(0);
    await expect(page.locator('#section-agents .name')).toHaveText(['You', 'Assistant Part-time', 'AI 2000 Basic']);
    const before = await page.evaluate(() => GAME.state.tasks.map(task => ({ id: task.id, status: task.status, work: task.workDone })));
    expect(before.find(task => task.status === 'ai').work).toBeGreaterThan(before.find(task => task.status === 'assistant').work * 4);
    await page.screenshot({ path: `test-results/human-ai-comparison-${width}.png`, fullPage: true });
    await page.locator('.upgrade-card').filter({ hasText: 'Second AI Subscription' }).getByRole('button').click();
    await page.clock.runFor(200);
    await expect(page.locator('[data-assistant]')).toHaveCount(0);
    await expect(page.locator('#team-heading')).toHaveText('Agents');
    await expect(page.locator('#section-agents .name')).toHaveText(['You', 'AI 2000 Basic', 'AI 2000 Pro']);
    const after = await page.evaluate(() => GAME.state.tasks.map(task => ({ id: task.id, status: task.status, work: task.workDone })));
    for (const task of before.filter(task => task.status.startsWith('assistant'))) {
      const released = after.find(item => item.id === task.id);
      expect(released.status).toBe('available'); expect(released.work).toBe(task.work);
    }
    await page.reload();
    if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
    await expect(page.locator('#team-heading')).toHaveText('Agents');
    await expect(page.locator('[data-assistant]')).toHaveCount(0);
    await expect(page.locator('#you-card')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('Multitasking opens a second manual slot and the assistant cannot be dismissed', async ({ page }) => {
  await openTeam(page, 1440);
  await page.evaluate(() => { for (const task of GAME.state.tasks) task.workRequired = 100; });
  await page.locator('[data-assistant]').getByRole('button', { name: 'Assign work' }).click();
  await page.locator('#btn-do-task').click();
  await page.clock.runFor(200);
  await expect(page.locator('#btn-do-task')).toBeDisabled();
  await page.evaluate(() => { GAME.state.totalTasksDone = 35; GAME.buy('ai_hint'); });
  await page.clock.runFor(200);
  await page.locator('.upgrade-card').filter({ hasText: 'Multitasking' }).getByRole('button').click();
  await page.clock.runFor(200);
  await expect(page.locator('[data-assistant]')).toContainText('4 working');
  await page.evaluate(() => GAME.setPhase(2));
  await page.clock.runFor(200);
  await expect(page.getByRole('button', { name: 'Dismiss assistant' })).toHaveCount(0);
  expect(await page.evaluate(() => typeof GAME.dismissAssistant)).toBe('undefined');
  await expect(page.locator('[data-assistant]')).toBeVisible();
  const primaryStyle = element => {
    const css = getComputedStyle(element);
    return ['padding', 'fontSize', 'fontWeight', 'borderRadius', 'backgroundColor', 'color'].map(key => css[key]);
  };
  expect(await page.getByRole('button', { name: 'Add tokens' }).evaluate(primaryStyle))
    .toEqual(await page.locator('#btn-do-task').evaluate(primaryStyle));
  await expect(page.locator('#btn-do-task')).toBeEnabled();
  await page.locator('#btn-do-task').click(); await page.clock.runFor(200);
  await expect(page.locator('#you-status')).toHaveText('Working on 2 tasks');
  await expect(page.locator('#btn-do-task')).toBeDisabled();
});

for (const width of [1440, 390]) {
  test(`You and assistant share button styling and Multitasking assigns a pair in one click at ${width}px`, async ({ page }) => {
    await openTeam(page, width);
    await page.evaluate(() => {
      for (const task of GAME.state.tasks) task.workRequired = 100;
      GAME.state.totalTasksDone = 35; GAME.buy('ai_hint'); GAME.buy('multitasking');
    });
    await page.clock.runFor(200);
    const you = page.locator('#btn-do-task');
    const assistant = page.locator('[data-assistant]').getByRole('button', { name: 'Assign work' });
    const style = element => {
      const css = getComputedStyle(element);
      return ['width', 'height', 'padding', 'fontSize', 'fontWeight', 'borderRadius', 'backgroundColor', 'color'].map(key => css[key]);
    };
    expect(await you.evaluate(style)).toEqual(await assistant.evaluate(style));
    await expect(page.locator('#you-delivered')).toHaveText('0 tasks delivered');
    const before = await page.evaluate(() => GAME.state.totalClicks);
    await you.click(); await page.clock.runFor(200);
    expect(await page.evaluate(() => GAME.state.totalClicks)).toBe(before + 1);
    await expect(page.locator('[data-assignment="active"]')).toHaveCount(2);
    await expect(you).toBeDisabled();
    await expect(page.locator('.click-reward')).toHaveCount(0);
    await page.clock.runFor(15000);
    await expect(page.locator('#you-delivered')).toHaveText('2 tasks delivered');
    await page.reload();
    if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
    await expect(page.locator('#you-delivered')).toHaveText('2 tasks delivered');
    await page.screenshot({ path: `test-results/matched-team-${width}.png`, fullPage: true, animations: 'disabled' });
  });
}
