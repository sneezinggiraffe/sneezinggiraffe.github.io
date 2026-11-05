const { test, expect } = require('@playwright/test');
const { harness } = require('../harness.cjs');

for (const width of [1440, 390]) {
  test(`four-character hex IDs fit agent tiles and Rapid Cluster Deployment keeps Phase 11 at ${width}px`, async ({ page }) => {
    const h = harness();
    const g = h.fresh(11);
    g.ceoMode = 'scale';
    g.cash = 300000000;
    g.tokens = 1e9;
    g.totalTasksDone = 27000000;
    g.aiWorkerShutdown = true;
    g.incidentsExplained = true;
    h.prepareUpgrade('ceo_course');
    for (let index = 0; index < 5; index++) h.fullCluster().tank = 4000;
    h.api.checkMilestones();
    h.dismiss();
    g.lastTick = Date.now();
    g.lastSave = g.lastTick;
    const raw = JSON.stringify(g);
    h.close();
    await page.setViewportSize({width, height: 900});
    await page.clock.install({time: new Date(g.lastTick)});
    await page.clock.pauseAt(new Date(g.lastTick + 1000));
    await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw);
    await page.goto('/');
    if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
    const slots = await page.locator('.capacity-slot.filled').evaluateAll(elements => elements.map(element => ({label: element.textContent, fits: element.scrollWidth <= element.clientWidth})));
    expect(slots).toHaveLength(80);
    expect(slots.every(slot => /^[0-9a-f]{4}$/.test(slot.label) && slot.fits)).toBe(true);
    expect(new Set(slots.map(slot => slot.label)).size).toBe(80);
    const rapid = page.locator('[onclick="GAME.buy(\'ceo_course\')"]');
    await expect(rapid.locator('xpath=ancestor::div[contains(@class,"upgrade-card")]')).toContainText('Rapid Cluster Deployment');
    await rapid.click();
    expect(await page.evaluate(() => GAME.state.phase)).toBe(11);
    await expect(page.locator('#milestone-popup')).toBeHidden();
    await page.evaluate(() => GAME.addCash(1e9));
    await page.clock.runFor(200);
    expect(await page.evaluate(() => GAME.state.clusters.filter(cluster => cluster.buildRemaining > 0).map(cluster => cluster.buildDuration))).toEqual([3, 3]);
    await page.locator('#section-clusters').scrollIntoViewIfNeeded();
    await page.screenshot({path: `test-results/hex-agent-ids-${width}.png`, animations: 'disabled'});
  });

  test(`Phase 14 builds two neoclouds together and delays investor talks until 200 completed clusters at ${width}px`, async ({ page }) => {
    const h = harness();
    const g = h.fresh(14);
    g.ceoMode = 'scale';
    g.cash = 1e9;
    g.tokens = 1e9;
    g.totalTasksDone = 1e9;
    g.aiWorkerShutdown = true;
    g.incidentsExplained = true;
    h.prepareUpgrade('parallel_neoclouds');
    for (let index = 0; index < 125; index++) h.fullCluster().tank = 4000;
    h.api.checkMilestones();
    h.dismiss();
    g.lastTick = Date.now();
    g.lastSave = g.lastTick;
    const raw = JSON.stringify(g);
    h.close();
    await page.setViewportSize({width, height: 900});
    await page.clock.install({time: new Date(g.lastTick)});
    await page.clock.pauseAt(new Date(g.lastTick + 1000));
    await page.addInitScript(value => {
      if (!sessionStorage.getItem('neocloud_seeded')) {
        localStorage.setItem('ai_empire_save', value);
        sessionStorage.setItem('neocloud_seeded', '1');
      }
      sessionStorage.setItem('rotate_dismissed', '1');
    }, raw);
    await page.goto('/');
    if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
    const talks = page.locator('[onclick="GAME.buy(\'retire_unlock\')"]');
    await expect(talks).toHaveCount(0);
    await page.locator('[onclick="GAME.buy(\'parallel_neoclouds\')"]').click();
    await page.evaluate(() => GAME.addCash(1e10));
    await page.clock.runFor(200);
    await expect(page.locator('[aria-label="Cluster construction"]')).toHaveCount(50);
    await expect(page.locator('.neocloud:has([aria-label="Cluster construction"])')).toHaveCount(2);
    const order = await page.locator('[data-cluster-id]').evaluateAll(cards => cards.map(card => card.querySelector('strong').textContent));
    expect(order).toEqual(Array.from({length: 175}, (_, index) => 'C' + (175 - index)));
    await page.locator('[data-neocloud="6"]').scrollIntoViewIfNeeded();
    await page.screenshot({path: `test-results/parallel-neoclouds-${width}.png`, animations: 'disabled'});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const remaining = await page.evaluate(() => {
      GAME.state.cash = 0;
      window.dispatchEvent(new Event('pagehide'));
      return GAME.state.clusters.slice(125).map(cluster => cluster.buildRemaining);
    });
    await page.reload();
    if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
    expect(await page.evaluate(() => GAME.state.clusters.slice(125).map(cluster => cluster.buildRemaining))).toEqual(remaining);
    await page.clock.runFor(300);
    await expect(page.locator('[aria-label="Cluster construction"]')).toHaveCount(0);
    await expect(talks).toHaveCount(0);
    expect(await page.evaluate(() => GAME.state.phase)).toBe(14);
    await page.evaluate(() => GAME.addCash(1e10));
    await page.clock.runFor(500);
    expect(await page.evaluate(() => GAME.state.clusters.filter(cluster => cluster.buildRemaining === 0 && cluster.managerAssigned).length)).toBeGreaterThanOrEqual(200);
    await expect(talks).toBeEnabled();
    await talks.click();
    await page.clock.runFor(8100);
    expect(await page.evaluate(() => GAME.state.phase)).toBe(15);
    await expect(page.locator('#milestone-popup')).toBeVisible();
  });
}
