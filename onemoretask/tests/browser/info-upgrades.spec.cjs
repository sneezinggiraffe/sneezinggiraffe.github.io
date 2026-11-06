const { test, expect } = require('@playwright/test');
const { harness } = require('../harness.cjs');

for (const width of [1440, 390]) {
  for (const [id, phase] of [['incident_info', 2]]) {
    test(`${id} is readable and dismissible without stopping play at ${width}px`, async ({ page }) => {
      const h = harness();
      const g = h.fresh(phase);
      g.totalTasksDone = 1000;
      g.cash = 5000;
      g.tokens = 100;
      g.uiRevealed.log = true;
      g.lastTaskSpawn = Date.now() + 1e9;
      if (id === 'incident_info') h.api.triggerTutorialIncident();
      h.api.checkMilestones();
      g.lastTick = Date.now();
      g.lastSave = g.lastTick;
      const raw = JSON.stringify(g);
      const name = h.api.UPGRADES.find(item => item.id === id).name;
      h.close();
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install({ time: new Date(g.lastTick) });
      await page.clock.pauseAt(new Date(g.lastTick + 1000));
      await page.addInitScript(value => {
        if (!localStorage.getItem('ai_empire_save')) localStorage.setItem('ai_empire_save', value);
      }, raw);
      await page.goto('/');
      await expect(page.locator('#rotate-overlay, #offline-popup')).toHaveCount(0);
      await expect(page.locator('#milestone-popup')).toBeHidden();
      const button = page.getByRole('button', { name, exact: true });
      await expect(button).toBeEnabled();
      await expect(button).toHaveText('');
      const card = button.locator('..').locator('..');
      await expect(card.locator('.desc')).toHaveText('Automation make mistakes that disrupt work and cost money. Keep on top of fixing them.');
      await card.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const elapsed = await page.evaluate(() => GAME.state.totalPlaytime);
      await page.clock.runFor(1000);
      expect(await page.evaluate(() => GAME.state.totalPlaytime)).toBeGreaterThan(elapsed);
      await page.screenshot({ path: `test-results/${id}-${width}.png`, fullPage: true });
      const before = await page.evaluate(() => ({ cash: GAME.state.cash, tokens: GAME.state.tokens, tasks: GAME.state.totalTasksDone }));
      // Clicking the description exercises the full-card click target.
      const description = await card.locator('.desc').boundingBox();
      await page.mouse.click(description.x + 5, description.y + 5);
      expect(await page.evaluate(() => ({ cash: GAME.state.cash, tokens: GAME.state.tokens, tasks: GAME.state.totalTasksDone }))).toEqual(before);
      expect(await page.evaluate(id => GAME.state.purchasedUpgrades.includes(id), id)).toBe(true);
      await page.clock.runFor(200);
      await expect(button).toHaveCount(0);
      await page.reload();
      await expect(button).toHaveCount(0);
      await expect(page.locator('#save-notice')).toBeHidden();
    });
  }
}
