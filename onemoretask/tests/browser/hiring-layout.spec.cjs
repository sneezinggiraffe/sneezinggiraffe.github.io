const { test, expect } = require('@playwright/test');

for (const width of [1440, 390, 320]) {
  for (const layout of [3, 4]) {
    test(`hiring keeps slot geometry and role buttons at ${width}px in view ${layout}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.clock.install();
      await page.goto('/');
      await page.evaluate(() => {
        GAME.cheat(9);
        GAME.state.phase = 9;
        GAME.state.agents = GAME.state.agents.filter(agent => !['manager', 'token_mgr', 'devops'].includes(agent.roleId));
        GAME.state.cash = 1e9;
        GAME.state.tasks = [];
        GAME.state.lastTaskSpawn = Date.now() + 1e9;
        GAME.fire(GAME.state.agents[0].id);
      });
      await page.clock.runFor(200);
      await page.locator(`[data-layout-choice="${layout}"]`).click();
      const sharedHeight = (await page.locator('.manager-slot').boundingBox()).height;
      for (const selector of ['.manager-slot', '.token-manager-slot', '.devops-slot']) {
        const purchase = page.locator(selector);
        await expect(purchase).toHaveCSS('box-shadow', 'none');
        const before = await purchase.boundingBox();
        expect(before.height).toBe(sharedHeight);
        await page.evaluate(() => { GAME.state.cash = 0; });
        await page.clock.runFor(200);
        await expect(purchase).toBeDisabled();
        expect((await purchase.boundingBox()).height).toBe(before.height);
        await page.evaluate(() => { GAME.state.cash = 1e9; });
        await page.clock.runFor(200);
        await purchase.focus();
        await page.keyboard.press('Enter');
        await page.clock.runFor(200);
        const role = selector === '.manager-slot' ? 'Manager' : selector === '.token-manager-slot' ? 'Token Mgr' : 'DevOps';
        const card = page.locator('#agent-list > .agent-card, #incident-devops > .agent-card').filter({ has: page.locator('.role', { hasText: role }) }).last();
        expect((await card.boundingBox()).height).toBe(before.height);
        expect(await card.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const center = bounds.top + bounds.height / 2;
          return [...element.children].every(child => {
            const childBounds = child.getBoundingClientRect();
            return Math.abs(childBounds.top + childBounds.height / 2 - center) < 1;
          });
        })).toBe(true);
      }
      const vacancy = page.locator('.agent-vacancy').first();
      const slot = await vacancy.getAttribute('data-agent-slot');
      await expect(vacancy.getByRole('combobox')).toHaveCount(0);
      await expect(vacancy.getByRole('button')).toHaveCount(6);
      const buy = vacancy.getByRole('button', { name: 'Buy Coder', exact: true });
      const before = await vacancy.boundingBox();
      expect(before.height).toBe(sharedHeight);
      await page.evaluate(() => { GAME.state.cash = 0; });
      await page.clock.runFor(200);
      await expect(buy).toBeDisabled();
      expect((await vacancy.boundingBox()).height).toBe(before.height);
      await page.evaluate(() => { GAME.state.cash = 1e9; });
      await page.clock.runFor(200);
      expect(await vacancy.locator('button').evaluateAll(buttons => buttons.every(button => {
        const bounds = button.getBoundingClientRect();
        const parent = button.closest('.agent-vacancy').getBoundingClientRect();
        return Math.abs(bounds.width - buttons[0].getBoundingClientRect().width) < 1 && bounds.bottom <= parent.bottom &&
          bounds.top === buttons[0].getBoundingClientRect().top && button.scrollWidth <= button.clientWidth;
      }))).toBe(true);
      for (const button of await vacancy.getByRole('button').all()) {
        await button.click({ trial: true });
      }
      await vacancy.locator('.agent-buy-options').evaluate(row => { row.scrollLeft = 0; });
      await expect(buy).toBeEnabled();
      await expect(buy).toHaveCSS('box-shadow', 'none');
      await vacancy.screenshot({ path: `test-results/hire-slot-${width}-${layout}.png` });
      await buy.focus();
      await page.keyboard.press('Enter');
      await page.clock.runFor(200);
      const occupied = page.locator(`.agent-card[data-agent-slot="${slot}"]`);
      await expect(occupied).toContainText('Coder');
      expect((await occupied.boundingBox()).height).toBe(before.height);
      expect(await occupied.evaluate(card => [...card.children].every(child => {
        const a = card.getBoundingClientRect();
        const b = child.getBoundingClientRect();
        return b.bottom <= a.bottom && b.right <= a.right;
      }))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}
