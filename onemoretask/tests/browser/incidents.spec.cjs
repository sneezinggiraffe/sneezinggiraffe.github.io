const { test, expect } = require('@playwright/test');
const { harness } = require('../harness.cjs');

async function openIncident(page, width, multitasking = false) {
  const h = harness();
  const g = h.fresh(2);
  g.cash = 1000;
  if (multitasking) g.purchasedUpgrades.push('multitasking');
  g.totalTasksDone = 15;
  g.aiWorkerShutdown = true;
  g.stress = 90;
  g.uiRevealed.stress = true;
  g.milestonesReached.push('stress_unlock');
  h.api.checkMilestones();
  h.api.triggerTutorialIncident();
  h.dismiss();
  g.tasks = [];
  const task = h.task();
  task.workRequired = 10000;
  g.lastTick = Date.now();
  task.createdAt = g.lastTick;
  g.incidents[0].createdAt = g.lastTick;
  g.lastSave = g.lastTick;
  g.lastTaskSpawn = g.lastTick + 1e9;
  const raw = JSON.stringify(g);
  h.close();
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: new Date(g.lastTick) });
  await page.clock.pauseAt(new Date(g.lastTick + 1000));
  await page.addInitScript(value => {
    if (!localStorage.getItem('ai_empire_save')) localStorage.setItem('ai_empire_save', value);
  }, raw);
  await page.goto('/');

}

for (const width of [1440, 390]) {
  test(`manual repair uses the shared progress bar for two seconds at ${width}px`, async ({ page }) => {
    await openIncident(page, width);
    await expect(page.locator('#res-stress-wrap')).toHaveCount(0);
    const card = page.locator('.incident-card');
    await expect(card.getByRole('button', { name: 'Pay to Fix ($40)', exact: true })).toBeEnabled();
    await card.getByRole('button', { name: 'FIx Manually', exact: true }).click();
    await page.clock.runFor(1000);
    await expect(card).toContainText('Fixing manually (50%)');
    await expect(card.locator('.task-bar-fill')).toHaveAttribute('style', /width:50%/);
    await expect(card.getByRole('button', { name: 'FIx Manually', exact: true })).toBeDisabled();
    await expect(page.locator('#task-list > .task-card')).toBeDisabled();
    await page.screenshot({ path: `test-results/manual-repair-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.clock.runFor(900);
    expect(await page.evaluate(() => GAME.state.incidents[0].resolved)).toBe(false);
    await page.clock.runFor(100);
    await expect(card).toHaveCount(0);
    await expect(page.locator('#task-list > .task-card')).toBeEnabled();
  });
}

test('manual repair resumes after reload and payment immediately releases its slot', async ({ page }) => {
  await openIncident(page, 1440);
  await page.getByRole('button', { name: 'FIx Manually', exact: true }).click();
  await page.clock.runFor(1000);
  await page.evaluate(() => localStorage.setItem('ai_empire_save', JSON.stringify(GAME.state)));
  await page.reload();
  await expect(page.locator('.incident-card')).toContainText('Fixing manually (50%)');
  await expect(page.locator('#task-list > .task-card')).toBeDisabled();
  const cash = await page.evaluate(() => GAME.state.cash);
  await page.getByRole('button', { name: 'Pay to Fix ($40)', exact: true }).click();
  await page.clock.runFor(200);
  await expect(page.locator('.incident-card')).toHaveCount(0);
  await expect(page.locator('#task-list > .task-card')).toBeEnabled();
  expect(await page.evaluate(() => GAME.state.cash)).toBe(cash - 40);
});

for (const multitasking of [false, true]) {
  test(`repair immediately blocks rapid task-card clicks with multitasking ${multitasking}`, async ({ page }) => {
    await openIncident(page, 1440, multitasking);
    const result = await page.evaluate(() => {
      const fix = document.querySelector('#incident-list button');
      const work = document.querySelector('#task-list > .task-card');
      fix.click();
      work.click();
      GAME.doWork();
      GAME.clickTask(GAME.state.tasks[0].id);
      return {
        disabled: work.disabled,
        started: GAME.state.tasks.some(task => task.status === 'active'),
      };
    });
    expect(result).toEqual({ disabled: true, started: false });
    await page.clock.runFor(2000);
    await expect(page.locator('#task-list > .task-card')).toBeEnabled();
    await page.locator('#task-list > .task-card .task-name').click();
    expect(await page.evaluate(() => GAME.state.tasks.some(task => task.status === 'active'))).toBe(true);
  });
}
