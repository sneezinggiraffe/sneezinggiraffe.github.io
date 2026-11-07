const { test, expect } = require('@playwright/test');

for (const width of [1440, 320]) {
  test(`opening cards respond to the full surface and show actions only on cards one and two at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const now = Date.now();
    await page.clock.install({ time: new Date(now) });
    await page.clock.pauseAt(new Date(now + 1000));
    await page.goto('/');
    const intro = page.getByRole('button', { name: 'Find Work', exact: true });
    await expect(intro.locator('button')).toHaveCount(0);
    await expect(page.locator('#intro-action')).toHaveAttribute('aria-hidden', 'true');
    const material = await intro.evaluate(element => {
      const style = getComputedStyle(element);
      return [style.backgroundColor, style.border, style.borderRadius, style.boxShadow, style.padding, style.fontFamily, style.fontSize];
    });
    await intro.click({ position: { x: 5, y: 5 } });
    const names = ['Deliver a pizza', 'Wash a car', 'Help write an email'];
    const card = page.locator('#prelude-card');
    for (let index = 0; index < 3; index++) {
      await expect(page.locator('#prelude-task')).toHaveText(names[index]);
      await expect(card.locator('button')).toHaveCount(0);
      if (index === 0) await expect(page.locator('#prelude-action')).toBeVisible();
      else await expect(page.locator('#prelude-action')).toBeHidden();
      if (index === 0) await page.locator('#prelude-action').click();
      else if (index === 1) await page.locator('#prelude-hint').click();
      else await card.click({ position: { x: 5, y: 5 } });
      await expect(card).toBeDisabled();
      await expect(page.locator('#prelude-action')).toBeHidden();
      await expect(page.locator('#prelude-hint')).toBeVisible();
      await page.clock.runFor(1000);
      expect(await page.evaluate(() => GAME.state.totalClicks)).toBe(index + 1);
      if (index < 1) await expect(page.locator('#top-bar')).toBeHidden();
      else await expect(page.locator('#top-bar')).toBeVisible();
    }
    await expect(page.locator('#prelude-section')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Do work', exact: true })).toHaveCount(0);
    await expect(page.locator('#you-card')).toHaveCount(0);
    await expect(page.locator('#section-agents')).toBeHidden();
    await page.locator('#btn-settings').click();
    const popup = page.locator('#settings-popup .popup');
    await expect(popup).toHaveClass(/paper-card/);
    const settingsMaterial = await popup.evaluate(element => {
      const style = getComputedStyle(element);
      return [style.backgroundColor, style.border, style.borderRadius, style.boxShadow, style.padding, style.fontFamily, style.fontSize];
    });
    expect(settingsMaterial).toEqual(material);
    await page.screenshot({ path: `test-results/settings-paper-${width}.png` });
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.locator('#settings-popup')).toBeHidden();
  });
}

for (const layout of [3, 4]) {
  test(`completing a task does not restart surviving-card animations or detach them in view ${layout}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const now = Date.now();
    await page.clock.install({ time: new Date(now) });
    await page.clock.pauseAt(new Date(now + 1000));
    await page.addInitScript(value => localStorage.setItem('ai_empire_layout', String(value)), layout);
  await page.goto('/');
    await page.evaluate(() => {
      GAME.cheat('0_2');
      GAME.state.totalTasksDone = 35;
      GAME.state.tasks = Array.from({ length: 8 }, (_, index) => ({
        id: 'steady_' + index, typeId: 'email', name: 'Write Email', icon: '▤', client: '',
        batchSize: 1, workRequired: index ? 800 : 2, workDone: 0, pay: 5,
        tokenCost: 0, failChance: 0, assignedAgent: null, status: 'available', createdAt: Date.now(),
      }));
      GAME.state.lastTaskSpawn = Date.now() + 1e9;
    });
    await page.clock.runFor(200);
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      const list = document.querySelector('#task-list');
      window.cardStabilityProbe = {
        originals: [...list.children].slice(1).map(card => ({ id: card.dataset.taskId, node: card, animation: card.getAnimations()[0] })),
        reinserted: [], restarted: [],
      };
      new MutationObserver(records => {
        for (const record of records) {
          for (const node of record.addedNodes) if (node.nodeType === 1) window.cardStabilityProbe.reinserted.push(node.dataset.taskId);
        }
      }).observe(list, { childList: true });
      list.addEventListener('animationstart', event => {
        if (event.animationName === 'paper-splat') window.cardStabilityProbe.restarted.push(event.target.dataset.taskId);
      });
    });
    await page.locator('[data-task-id="steady_0"] .task-name').click();
    await page.clock.runFor(600);
    await page.waitForTimeout(80);
    await expect(page.locator('#task-list > .task-card')).toHaveCount(7);
    const stability = await page.evaluate(() => ({
      reinserted: window.cardStabilityProbe.reinserted,
      restarted: window.cardStabilityProbe.restarted,
      stable: window.cardStabilityProbe.originals.every(({ id, node, animation }) => node === document.querySelector(`[data-task-id="${id}"]`) && node.getAnimations()[0] === animation),
    }));
    expect(stability.reinserted).toEqual([]);
    expect(stability.restarted).toEqual([]);
    expect(stability.stable).toBe(true);
  });
}
