const { test, expect } = require('@playwright/test');

for (const layout of [3, 4]) {
  for (const width of [1440, 390]) {
    test(`view ${layout} keeps tasks fixed while scrolling to the last agent at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.clock.install();
      await page.goto('/');
      await page.evaluate(() => {
        GAME.cheat(6);
        GAME.state.agentSlots = 10;
        GAME.state.aiWorkerShutdown = true;
        GAME.state.agents = [];
      });
      await page.locator(`[data-layout-choice="${layout}"]`).click();
      await page.clock.runFor(200);
      const panel = page.locator('#control-panel');
      const lastSlot = page.locator('.agent-vacancy').last();
      const deskBefore = await page.locator('#work-stream').boundingBox();
      expect(await panel.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
      await lastSlot.locator('button').first().focus();
      await expect(lastSlot.locator('button').first()).toBeInViewport();
      expect(await panel.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      expect(await page.locator('#work-stream').boundingBox()).toEqual(deskBefore);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await page.screenshot({ path: `test-results/agent-scroll-${layout}-${width}.png` });
    });
  }

  test(`view ${layout} assigns topmost visible notes and leaves off-screen work queued`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await page.goto('/');
    await page.evaluate(() => {
      GAME.cheat(6);
      const g = GAME.state;
      g.agentSlots = 20;
      g.agents = [];
      g.aiWorkerShutdown = true;
      g.cash = 1e9;
      g.tokens = 1e9;
      g.tasks = Array.from({ length: 30 }, (_, index) => ({
        id: `visible-${index}`, typeId: 'email', name: `Task ${index}`, icon: '▤', client: '',
        batchSize: 1, workRequired: 100000, workDone: 0, pay: 10, tokenCost: 1,
        failChance: 0, assignedAgent: null, status: 'available', createdAt: Date.now() - index,
      }));
      g.lastTaskSpawn = Date.now() + 1e9;
    });
    await page.locator(`[data-layout-choice="${layout}"]`).click();
    await page.clock.runFor(200);
    await page.evaluate(() => {
      for (let i = 0; i < 12; i++) GAME.hire('writer');
      for (const agent of GAME.state.agents) GAME.topUpAgent(agent.id);
    });
    await page.clock.runFor(200);
    const result = await page.evaluate(() => {
      const desk = document.querySelector('#work-stream').getBoundingClientRect();
      return GAME.state.tasks.map(task => {
        const rect = document.querySelector(`[data-task-id="${task.id}"]`).getBoundingClientRect();
        return { id: task.id, status: task.status, visible: rect.top >= desk.top && rect.bottom <= Math.min(desk.bottom, innerHeight) };
      });
    });
    const working = result.filter(task => task.status === 'agent');
    expect(working.length).toBeGreaterThan(0);
    expect(working.every(task => task.visible)).toBe(true);
    expect(working.map(task => task.id)).toEqual(result.slice(0, working.length).map(task => task.id));
    expect(result.filter(task => !task.visible).every(task => task.status === 'available')).toBe(true);
    await page.screenshot({ path: `test-results/visible-work-${layout}.png` });
  });
}
