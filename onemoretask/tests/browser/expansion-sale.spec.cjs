const { test, expect } = require('@playwright/test');
const { harness } = require('../harness.cjs');

function expansionFixture(phase, count) {
  const h = harness();
  const g = h.fresh(phase);
  g.ceoMode = 'scale';
  g.cash = 1e11;
  g.tokens = 1e9;
  g.totalTasksDone = 1e9;
  g.aiWorkerShutdown = true;
  g.incidentsExplained = true;
  h.prepareUpgrade(phase >= 14 ? 'retire_unlock' : 'replication');
  for (let index = 0; index < count; index++) h.fullCluster().tank = 4000;
  h.api.openCluster();
  h.api.openCluster();
  h.api.tickConstruction(g.clusters.at(-2).buildDuration / 4);
  g.cash = 0;
  h.api.checkMilestones();
  h.dismiss();
  g.lastTick = Date.now();
  g.lastSave = g.lastTick;
  const raw = JSON.stringify(g);
  h.close();
  return raw;
}

function earlyClusterFixture(phase) {
  const h = harness();
  const g = h.fresh(phase);
  g.ceoMode = phase === 10 ? 'manage' : 'scale';
  g.cash = 0;
  g.tokens = 1e9;
  g.totalTasksDone = 1e9;
  g.aiWorkerShutdown = true;
  g.incidentsExplained = true;
  h.prepareUpgrade(phase === 10 ? 'server_1' : 'autonomous_nodes');
  for (let index = 0; index < 3; index++) h.fullCluster().tank = 4000;
  h.api.checkMilestones();
  h.dismiss();
  g.lastTick = Date.now();
  g.lastSave = g.lastTick;
  const raw = JSON.stringify(g);
  h.close();
  return raw;
}

function clusterCardPositions(grid) {
  const origin = grid.getBoundingClientRect();
  return [...grid.children].map(card => {
    const bounds = card.getBoundingClientRect();
    return {x: bounds.x - origin.x, y: bounds.y - origin.y};
  });
}

for (const width of [1440, 390, 320]) {
  for (const phase of [10, 11]) {
    test(`Phase ${phase} puts the placeholder and newest cluster at the top left at ${width}px`, async ({ page }) => {
      const raw = earlyClusterFixture(phase);
      const state = JSON.parse(raw);
      await page.setViewportSize({width, height: 900});
      await page.clock.install({time: new Date(state.lastTick)});
      await page.clock.pauseAt(new Date(state.lastTick + 1000));
      await page.addInitScript(value => {
        if (!sessionStorage.getItem('cluster_order_seeded')) {
          localStorage.setItem('ai_empire_save', value);
          sessionStorage.setItem('cluster_order_seeded', '1');
        }
      }, raw);
      await page.goto('/');
      if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
      const grid = page.locator('#cluster-list .node-grid');
      const placeholder = grid.locator(phase === 10 ? '.provision-card' : '.planning-card');
      await expect(grid.locator(':scope > .cluster-card').first()).toHaveClass(phase === 10 ? /provision-card/ : /planning-card/);
      const [placeholderBounds, previousBounds] = await grid.evaluate(clusterCardPositions);
      if (Math.abs(placeholderBounds.y - previousBounds.y) < 1) expect(placeholderBounds.x).toBeLessThan(previousBounds.x);
      else expect(placeholderBounds.y).toBeLessThan(previousBounds.y);
      await page.evaluate(() => GAME.addCash(1e10));
      await page.clock.runFor(200);
      if (phase === 10) {
        await placeholder.click();
        await page.clock.runFor(200);
      }
      const ids = await page.evaluate(() => {
        GAME.state.cash = 0;
        window.dispatchEvent(new Event('pagehide'));
        return GAME.state.clusters.map(cluster => cluster.id);
      });
      await expect(grid.locator(':scope > .cluster-card').first()).toHaveAttribute('data-cluster-id', ids.at(-1));
      expect(await grid.locator('[data-cluster-id]').evaluateAll(cards => cards.map(card => card.dataset.clusterId))).toEqual(ids.slice().reverse());
      const [newestBounds] = await grid.evaluate(clusterCardPositions);
      expect(newestBounds.x).toBeCloseTo(placeholderBounds.x, 0);
      expect(newestBounds.y).toBeCloseTo(placeholderBounds.y, 0);
      await page.reload();
      if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
      await expect(grid.locator(':scope > .cluster-card').first()).toHaveAttribute('data-cluster-id', ids.at(-1));
      await page.clock.runFor(13000);
      await expect(grid.locator('[data-cluster-id]').first()).toHaveAttribute('data-cluster-id', ids.at(-1));
      if (phase === 11) await expect(grid.locator(':scope > .cluster-card').first()).toHaveClass(/planning-card/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await grid.screenshot({path: `test-results/newest-first-phase${phase}-${width}.png`, animations: 'disabled'});
    });
  }

  for (const phase of [12, 14]) {
    test(`Phase ${phase} prepends planning and new clusters at the top left and preserves their order at ${width}px`, async ({ page }) => {
      const count = phase === 12 ? 45 : 260;
      const raw = expansionFixture(phase, count);
      const state = JSON.parse(raw);
      const newest = state.clusters.at(-1);
      await page.setViewportSize({width, height: width === 320 ? 568 : 900});
      await page.clock.install({time: new Date(state.lastTick)});
      await page.clock.pauseAt(new Date(state.lastTick + 1000));
      await page.addInitScript(value => {
        localStorage.setItem('ai_empire_save', value);
        sessionStorage.setItem('rotate_dismissed', '1');
      }, raw);
      await page.goto('/');
      if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
      const planning = page.locator('.planning-card');
      await planning.scrollIntoViewIfNeeded();
      await expect(planning).toBeInViewport();
      await expect(page.locator('[aria-label="Cluster construction"]')).toHaveCount(2);
      for (const build of await page.locator('[aria-label="Cluster construction"]').all()) await expect(build).toBeInViewport();
      const topGrid = page.locator(phase === 12 ? '#cluster-list .node-grid' : '[data-neocloud="11"] .network-grid');
      await expect(topGrid.locator(':scope > .cluster-card').first()).toHaveClass(/planning-card/);
      await expect(topGrid.locator('[data-cluster-id]').first()).toHaveAttribute('data-cluster-id', newest.id);
      await expect(page.locator('[data-cluster-id]')).toHaveCount(count + 2);
      expect(await page.locator('[data-cluster-id]').evaluateAll(cards => cards.map(card => card.dataset.clusterId))).toEqual(state.clusters.slice().reverse().map(cluster => cluster.id));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const overflowing = await page.locator('#cluster-list').evaluate(element => [...element.querySelectorAll('.cluster-card,.neocloud')].filter(card => card.scrollWidth > card.clientWidth + 1).map(card => card.textContent));
      expect(overflowing).toEqual([]);
      if (phase === 12) {
        await expect(page.locator('.neocloud')).toHaveCount(0);
        await expect(page.locator('.cluster-capacity')).toHaveCount(count);
        const slots = await page.locator('.autonomous-capacity .capacity-slot').evaluateAll(elements => elements.map(element => ({width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, label: element.textContent})));
        expect(slots.every(slot => Math.abs(slot.width - slot.height) < 1 && slot.label === '')).toBe(true);
      } else {
        await expect(page.locator('.neocloud')).toHaveCount(11);
        await expect(page.locator('.cluster-capacity')).toHaveCount(0);
        await expect(page.locator('[data-neocloud="10"] [data-cluster-id]')).toHaveCount(25);
      }
      const gaps = await page.locator('.cluster-construction-progress').evaluateAll(bars => bars.map(bar => bar.getBoundingClientRect().top - bar.previousElementSibling.getBoundingClientRect().bottom));
      expect(gaps.every(gap => gap >= 6 && gap <= 7)).toBe(true);
      await page.screenshot({path: `test-results/new-phase${phase}-${width}.png`, animations: 'disabled'});
      await page.clock.runFor(3500);
      await expect(page.locator('[aria-label="Cluster construction"]')).toHaveCount(0);
      await expect(topGrid.locator('[data-cluster-id]').first()).toHaveAttribute('data-cluster-id', newest.id);
      if (phase === 14) await expect(page.locator('[data-cluster-id="' + newest.id + '"]').locator('xpath=ancestor::section')).toHaveAttribute('data-neocloud', '11');
    });
  }
}

for (const width of [1440, 390]) {
  test(`the investor-to-sale journey resumes after reload and fades into retirement at ${width}px`, async ({ page }) => {
    await page.setViewportSize({width, height: 900});
    await page.addInitScript(() => sessionStorage.setItem('rotate_dismissed', '1'));
    const started = Date.now();
    await page.clock.install({time: new Date(started)});
    await page.clock.pauseAt(new Date(started + 1000));
    await page.goto('/');
    await page.evaluate(() => { chPh15(); GAME.addCash(1e11); });
    if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
    await page.clock.runFor(1000);
    const talks = page.locator('[onclick="GAME.buy(\'retire_unlock\')"]');
    await expect(talks).toHaveText('$90.0K');
    await talks.click();
    await page.clock.runFor(4000);
    await expect(talks).toBeDisabled();
    await expect(page.locator('[aria-label="Sale preparation"]')).toHaveAttribute('aria-valuenow', /4\d|5\d/);
    const remaining = await page.evaluate(() => GAME.state.salePreparation.remaining);
    await page.reload();
    if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
    expect(await page.evaluate(() => GAME.state.salePreparation.remaining)).toBe(remaining);
    await page.screenshot({path: `test-results/investor-talks-${width}.png`, animations: 'disabled'});
    await page.clock.runFor((remaining + 0.3) * 1000);
    await expect(page.locator('#milestone-popup')).toBeVisible();
    await page.locator('#btn-dismiss-popup').click();
    expect(await page.evaluate(() => GAME.state.phase)).toBe(15);
    for (const [id, duration] of [['sale_advisor', 10], ['sale_buyout', 12], ['sale_diligence', 18], ['sale_terms', 10]]) {
      const button = page.locator('[onclick="GAME.buy(\'' + id + '\')"]');
      await expect(button).toBeEnabled();
      await button.click();
      await page.clock.runFor(200);
      await expect(button).toBeDisabled();
      await expect(page.locator('[onclick="GAME.buy(\'fusion\')"]')).toHaveCount(0);
      await page.clock.runFor((duration + 0.3) * 1000);
      expect(await page.evaluate(value => GAME.state.purchasedUpgrades.includes(value), id)).toBe(true);
    }
    const complete = page.locator('[onclick="GAME.buy(\'fusion\')"]');
    await expect(complete).toBeEnabled();
    await expect(complete.locator('xpath=ancestor::div[contains(@class,"upgrade-card")]')).toContainText('Complete Company Sale');
    await expect(page.locator('.sale-readiness .ready')).toHaveCount(4);
    await page.screenshot({path: `test-results/sale-ready-${width}.png`, animations: 'disabled'});
    await complete.click();
    const balance = await page.evaluate(() => GAME.state.cash);
    await page.clock.runFor(600);
    await expect(page.locator('#sale-transition')).toBeVisible();
    await expect(page.locator('#game-container')).toBeVisible();
    await expect(page.locator('#ending-overlay')).toBeHidden();
    await page.clock.runFor(600);
    await expect(page.locator('#game-container')).toBeHidden();
    await expect(page.locator('#ending-overlay')).toBeHidden();
    await expect(page.locator('#sale-transition')).toHaveCSS('opacity', '1');
    await page.reload();
    await expect(page.locator('#sale-transition')).toBeVisible();
    await page.clock.runFor(1600);
    await expect(page.locator('#sale-transition')).toBeHidden();
    await expect(page.getByRole('heading', {name: 'You retired early!'})).toBeVisible();
    await expect(page.locator('#btn-ending-restart')).toBeFocused();
    expect(await page.evaluate(() => GAME.state.cash)).toBe(balance);
    await page.screenshot({path: `test-results/sale-ending-${width}.png`, animations: 'disabled'});
  });
}

test('reduced motion opens retirement immediately without the black transition', async ({ page }) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/');
  await page.evaluate(() => chRetire());
  await page.locator('[onclick="GAME.buy(\'fusion\')"]').click();
  await expect(page.locator('#sale-transition')).toBeHidden();
  await expect(page.getByRole('heading', {name: 'You retired early!'})).toBeVisible();
});
