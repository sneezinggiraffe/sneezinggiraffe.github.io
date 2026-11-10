const { test, expect } = require('@playwright/test');
const { harness } = require('../harness.cjs');

for (const width of [1440, 390]) {
  test(`four-character hex IDs fit agent tiles and Rapid Cluster Deployment keeps Phase 12 at ${width}px`, async ({ page }) => {
    const h = harness();
    const g = h.fresh(12);
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
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.clock.install({time: new Date(g.lastTick)});
    await page.clock.pauseAt(new Date(g.lastTick + 1000));
    await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw);
    await page.goto('/');

    const slots = await page.locator('.capacity-slot.filled').evaluateAll(elements => elements.map(element => ({label: element.textContent, fits: element.scrollWidth <= element.clientWidth})));
    expect(slots).toHaveLength(80);
    expect(slots.every(slot => /^[0-9a-f]{4}$/.test(slot.label) && slot.fits)).toBe(true);
    expect(new Set(slots.map(slot => slot.label)).size).toBe(80);
    const rapid = page.locator('[onclick="GAME.buy(\'ceo_course\')"]');
    await expect(rapid.locator('xpath=ancestor::div[contains(@class,"upgrade-card")]')).toContainText('Rapid Cluster Deployment');
    await rapid.click();
    expect(await page.evaluate(() => GAME.state.phase)).toBe(12);
    await expect(page.locator('#milestone-popup')).toBeHidden();
    await page.evaluate(() => GAME.addCash(1e9));
    await page.clock.runFor(200);
    expect(await page.evaluate(() => GAME.state.clusters.filter(cluster => cluster.buildRemaining > 0).map(cluster => cluster.buildDuration))).toEqual([3, 3]);
    await page.locator('#section-clusters').scrollIntoViewIfNeeded();
    await page.screenshot({path: `test-results/hex-agent-ids-${width}.png`, animations: 'disabled'});
  });

  test(`Phase 13 keeps Phase 12 agent-box dimensions at ${width}px`, async ({ page }) => {
    const h = harness();
    h.window.chPh13();
    const g = h.window.GAME.state;
    expect(g.totalTasksDone).toBe(63000000);
    expect(g.cash).toBe(600000000);
    expect(h.api.completedClusterCount()).toBe(21);
    g.cash = 760000000;
    g.lastTick = Date.now();
    g.lastSave = g.lastTick;
    g.lastCeoAction = g.lastTick + 1000000;
    const raw = JSON.stringify(g);
    h.close();
    await page.setViewportSize({width, height: 900});
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.clock.install({time: new Date(g.lastTick)});
    await page.clock.pauseAt(new Date(g.lastTick + 1000));
    await page.addInitScript(value => {
      localStorage.setItem('ai_empire_save', value);

    }, raw);
    await page.goto('/');

    const slot = page.locator('.capacity-slot.filled').first();
    await expect(slot).toHaveText(/^[0-9a-f]{4}$/);
    const before = await slot.boundingBox();
    await page.locator('[onclick="GAME.buy(\'autonomous_nodes\')"]').click();
    await page.clock.runFor(200);
    expect(await page.evaluate(() => GAME.state.phase)).toBe(13);
    await expect(page.locator('.capacity-slot.filled')).toHaveCount(21 * 16);
    await expect(slot).toBeEmpty();
    const after = await slot.boundingBox();
    expect(after.width).toBeCloseTo(before.width, 1);
    expect(after.height).toBeCloseTo(before.height, 1);
    expect(after.height).toBe(16);
    await expect(page.locator('#milestone-popup')).toBeHidden();
    await page.locator('#section-clusters').scrollIntoViewIfNeeded();
    await page.screenshot({path: `test-results/phase12-agent-boxes-${width}.png`, animations: 'disabled'});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`Factory-Direct Hardware is a separate cost upgrade before Dedicated Hardware Supply at ${width}px`, async ({ page }) => {
    const h = harness();
    const g = h.fresh(15);
    g.ceoMode = 'scale';
    g.cash = 2e9;
    g.tokens = 1e9;
    g.totalTasksDone = 1e9;
    g.aiWorkerShutdown = true;
    h.prepareUpgrade('factory_direct');
    for (let index = 0; index < 400; index++) h.fullCluster().tank = 4000;
    h.api.checkMilestones();
    h.dismiss();
    g.lastTick = Date.now();
    g.lastSave = g.lastTick;
    const raw = JSON.stringify(g);
    h.close();
    await page.setViewportSize({width, height: 900});
    await page.clock.install();
    await page.addInitScript(value => {
      localStorage.setItem('ai_empire_save', value);

    }, raw);
    await page.goto('/');

    const factory = page.locator('[onclick="GAME.buy(\'factory_direct\')"]');
    const supply = page.locator('[onclick="GAME.buy(\'neocloud_supply_chain\')"]');
    await expect(factory.locator('xpath=ancestor::div[contains(@class,"upgrade-card")]')).toContainText('Factory-Direct Hardware');
    await expect(factory).toHaveText('$2.00B');
    await expect(supply).toHaveCount(0);
    await page.clock.runFor(2000);
    await expect(factory).toBeEnabled();
    expect(await page.evaluate(() => GAME.state.clusters.length)).toBe(400);
    await factory.click();
    await page.clock.runFor(200);
    await expect(factory).toHaveCount(0);
    await expect(supply).toBeDisabled();
    expect(await page.evaluate(() => GAME.state.purchasedUpgrades.includes('factory_direct'))).toBe(true);
    await page.locator('#section-upgrades').screenshot({path: `test-results/factory-direct-${width}.png`});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`Phase 15 builds two neoclouds together and opens AGI research before investor talks at ${width}px`, async ({ page }) => {
    const h = harness();
    const g = h.fresh(15);
    g.ceoMode = 'scale';
    g.cash = 3e9;
    g.tokens = 1e9;
    g.totalTasksDone = 1e9;
    g.aiWorkerShutdown = true;
    g.incidentsExplained = true;
    h.prepareUpgrade('parallel_neoclouds');
    for (let index = 0; index < 500; index++) h.fullCluster().tank = 4000;
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

    }, raw);
    await page.goto('/');

    const talks = page.locator('[onclick="GAME.buy(\'retire_unlock\')"]');
    const research = page.locator('[onclick="GAME.buy(\'agi_research\')"]');
    await expect(talks).toHaveCount(0);
    await page.locator('[onclick="GAME.buy(\'parallel_neoclouds\')"]').click();
    await page.evaluate(() => GAME.addCash(1e10));
    await page.clock.runFor(200);
    const building = page.locator('.neocloud-slot[data-state="building"]');
    await expect(building).toHaveCount(50);
    await expect(page.locator('.neocloud:has([data-state="building"])')).toHaveCount(2);
    const order = await page.locator('[data-cluster-id]').evaluateAll(cards => cards.map(card => card.title.split(' · ')[0]));
    const expectedOrder = [];
    for (let first = 526; first >= 1; first -= 25) {
      for (let offset = 0; offset < 25; offset++) expectedOrder.push(h.api.clusterCode(first + offset));
    }
    expect(order).toEqual(expectedOrder);
    await page.locator('[data-neocloud="22"]').scrollIntoViewIfNeeded();
    await page.screenshot({path: `test-results/parallel-neoclouds-${width}.png`, animations: 'disabled'});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const remaining = await page.evaluate(() => {
      GAME.state.cash = 0;
      window.dispatchEvent(new Event('pagehide'));
      return GAME.state.clusters.slice(500).map(cluster => cluster.buildRemaining);
    });
    await page.reload();

    expect(await page.evaluate(() => GAME.state.clusters.slice(500).map(cluster => cluster.buildRemaining))).toEqual(remaining);
    await page.clock.runFor(300);
    await expect(building).toHaveCount(0);
    await expect(talks).toHaveCount(0);
    await expect(research).toBeDisabled();
    expect(await page.evaluate(() => GAME.state.phase)).toBe(15);
    await page.evaluate(() => GAME.addCash(1e10));
    await page.clock.runFor(500);
    expect(await page.evaluate(() => GAME.state.clusters.filter(cluster => cluster.buildRemaining === 0 && cluster.managerAssigned).length)).toBeGreaterThanOrEqual(500);
    await expect(talks).toHaveCount(0);
    await expect(research).toBeEnabled();
    expect(await page.evaluate(() => GAME.state.phase)).toBe(15);
    await expect(page.locator('#milestone-popup')).toBeHidden();
  });
}
