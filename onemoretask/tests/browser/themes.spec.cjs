const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const gameFileUrl = pathToFileURL(path.resolve(__dirname, '../../index.html')).href;

for (const width of [1440, 844, 390, 320]) {
  test(`V and H sit beside Settings at the right edge without presentation labels at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const now = Date.now();
    await page.clock.install({ time: new Date(now) });
    await page.clock.pauseAt(new Date(now + 1000));
    await page.goto('/#theme=1');
    await expect(page.locator('body')).toHaveAttribute('data-theme', '3');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(217, 221, 218)');
    await expect(page.locator('#theme-switcher, #theme-name, [data-theme-choice], #layout-name, .switcher-label')).toHaveCount(0);
    for (const phase of ['0_2', 16]) {
      await page.evaluate(value => GAME.cheat(value), phase);
      await page.clock.runFor(200);
      const group = page.getByRole('group', { name: 'Game views', exact: true });
      await expect(group.locator('button')).toHaveText(['V', 'H']);
      await expect(page.locator('.header-actions > button')).toHaveText(['Settings']);
      const geometry = await page.locator('.header-actions').evaluate(actions => {
        const view = actions.querySelector('#layout-switcher');
        const settings = actions.querySelector('#btn-settings');
        const v = view.children[0].getBoundingClientRect();
        const h = view.children[1].getBoundingClientRect();
        const button = settings.getBoundingClientRect();
        const top = getComputedStyle(document.querySelector('#top-bar'));
        return {
          adjacent: view.nextElementSibling === settings,
          gap: button.left - h.right,
          viewGap: h.left - v.right,
          centreDifference: Math.abs((h.top + h.bottom) / 2 - (button.top + button.bottom) / 2),
          rightInset: innerWidth - button.right,
          padding: parseFloat(top.paddingRight),
          height: h.height,
        };
      });
      expect(geometry.adjacent).toBe(true);
      expect(geometry.gap).toBeCloseTo(6, 0);
      expect(geometry.viewGap).toBeCloseTo(2, 0);
      expect(geometry.centreDifference).toBeLessThanOrEqual(1);
      expect(geometry.rightInset).toBeCloseTo(geometry.padding, 0);
      expect(geometry.height).toBe(width <= 768 ? 40 : 28);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.screenshot({ path: `test-results/view-controls-${width}.png`, fullPage: true });
  });

  test(`purchase contrast and view selection remain clear at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const now = Date.now();
    await page.clock.install({ time: new Date(now) });
    await page.clock.pauseAt(new Date(now + 1000));
    await page.goto('/');
    await page.evaluate(() => { GAME.cheat('0_2'); GAME.state.cash = 35; });
    await page.clock.runFor(200);
    const available = page.locator('.upgrade-card').filter({ has: page.locator('.upgrade-action:enabled') }).first();
    const unavailable = page.locator('.upgrade-card').filter({ has: page.locator('.upgrade-action:disabled') }).first();
    await expect(available).toBeVisible();
    await expect(unavailable).toBeVisible();
    const state = await page.evaluate(() => JSON.stringify(GAME.state));
    for (const layout of [3, 4]) {
      await page.locator(`[data-layout-choice="${layout}"]`).click();
      const styles = await available.evaluate((card, disabledCard) => {
        const enabled = getComputedStyle(card);
        const disabled = getComputedStyle(disabledCard);
        const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
        const luminance = colour => rgb(colour).map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
        const contrast = (first, second) => {
          const a = luminance(first);
          const b = luminance(second);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        };
        const selected = getComputedStyle(document.querySelector('[data-layout-choice][aria-pressed="true"]'));
        return {
          ratio: contrast(enabled.backgroundColor, disabled.backgroundColor),
          stripe: parseFloat(enabled.borderLeftWidth) >= 3 && enabled.borderLeftColor !== disabled.borderLeftColor,
          selectedContrast: contrast(selected.color, selected.backgroundColor),
          priceContrast: contrast(getComputedStyle(disabledCard.querySelector('.upgrade-action')).color, disabled.backgroundColor),
        };
      }, await unavailable.elementHandle());
      expect(styles.ratio >= 1.4 || styles.stripe).toBe(true);
      expect(styles.selectedContrast).toBeGreaterThanOrEqual(4.5);
      expect(styles.priceContrast).toBeGreaterThanOrEqual(4.5);
      expect(await page.evaluate(() => JSON.stringify(GAME.state))).toBe(state);
      await expect(page.locator('.upgrade-availability')).toHaveCount(0);
    }
  });
}

test('buy-agent roles and DevOps remain clear interactive controls in both views', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => {
    GAME.cheat(9);
    GAME.state.agents = GAME.state.agents.filter(agent => agent.roleId !== 'devops');
    GAME.state.cash = 1e9;
    GAME.state.tasks = [];
    GAME.state.lastTaskSpawn = Date.now() + 1e9;
    GAME.fire(GAME.state.agents.find(agent => !['manager', 'token_mgr'].includes(agent.roleId)).id);
  });
  await page.clock.runFor(200);
  const writer = page.getByRole('button', { name: 'Buy Writer', exact: true }).first();
  const devops = page.getByRole('button', { name: /Buy DevOps/ });
  const refill = page.getByRole('button', { name: 'Add tokens', exact: true }).first();
  await expect(refill).toBeEnabled();
  await expect(writer).toBeEnabled();
  await expect(devops).toBeEnabled();
  for (const layout of [3, 4]) {
    await page.locator(`[data-layout-choice="${layout}"]`).click();
    await expect(refill).toHaveClass(/btn-refill/);
    await expect(refill).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(refill).toHaveCSS('border-top-style', 'solid');
    await refill.click({ trial: true });
    for (const control of [writer, devops]) {
      await control.click({ trial: true });
      const style = await control.evaluate(button => {
        const css = getComputedStyle(button);
        return { background: css.backgroundColor, border: parseFloat(css.borderTopWidth), cursor: css.cursor };
      });
      expect(style.background).not.toBe('rgba(0, 0, 0, 0)');
      expect(style.border).toBeGreaterThanOrEqual(1);
      expect(style.cursor).toBe('pointer');
    }
  }
});

test('opening the HTML directly keeps the final theme and both views across reloads', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const now = Date.now();
  await page.clock.install({ time: new Date(now) });
  await page.clock.pauseAt(new Date(now + 1000));
  await page.goto(gameFileUrl + '#theme=2');
  await expect(page.locator('body')).toHaveAttribute('data-theme', '3');
  await page.evaluate(() => { GAME.cheat('0_2'); GAME.state.cash = 35; });
  await page.clock.runFor(200);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const before = await page.evaluate(() => ({ save: localStorage.getItem('ai_empire_save'), tasks: GAME.state.totalTasksDone, cash: GAME.state.cash, upgrades: [...GAME.state.purchasedUpgrades] }));
  for (const layout of [4, 3]) {
    await page.locator(`[data-layout-choice="${layout}"]`).click();
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-layout', String(layout));
    await expect(page.locator('body')).toHaveAttribute('data-theme', '3');
    expect(new URL(page.url()).protocol).toBe('file:');
    expect(await page.evaluate(() => localStorage.getItem('ai_empire_save'))).toBe(before.save);
    expect(await page.evaluate(() => ({ tasks: GAME.state.totalTasksDone, cash: GAME.state.cash, upgrades: [...GAME.state.purchasedUpgrades] }))).toEqual({ tasks: before.tasks, cash: before.cash, upgrades: before.upgrades });
  }
  await expect(page.locator('#save-notice')).toBeHidden();
  expect(errors).toEqual([]);
});

test('both views keep opening and settings controls accessible on compact screens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.removeItem('ai_empire_save'));
  for (const [width, height] of [[320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    for (const layout of [3, 4]) {
      const url = new URL(gameFileUrl);
      url.searchParams.set('view', layout);
      url.searchParams.set('width', width);
      url.hash = 'layout=' + layout;
      await page.goto(url.href);
      const title = await page.locator('#intro-title').boundingBox();
      expect(title.y).toBeGreaterThanOrEqual(-0.5);
      expect(title.y + title.height).toBeLessThanOrEqual(height + 0.5);
      await page.getByRole('button', { name: 'Find Work', exact: true }).click();
      await expect(page.locator('#top-bar')).toBeHidden();
      for (let index = 0; index < 2; index++) {
        await page.getByRole('button', { name: 'Do Task', exact: true }).click();
        await page.clock.runFor(1500);
      }
      await expect(page.locator('#top-bar')).toBeVisible();
      await page.locator('#btn-settings').click();
      await expect(page.locator('#settings-popup')).toBeVisible();
      const popup = await page.locator('#settings-popup .popup').boundingBox();
      expect(popup.x).toBeGreaterThanOrEqual(-0.5);
      expect(popup.y).toBeGreaterThanOrEqual(-0.5);
      expect(popup.x + popup.width).toBeLessThanOrEqual(width + 0.5);
      expect(popup.y + popup.height).toBeLessThanOrEqual(height + 0.5);
      await page.getByRole('button', { name: 'Reset Game', exact: true }).click();
      await expect(page.locator('#settings-msg')).toContainText('permanently reset');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.locator('#settings-popup')).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});
