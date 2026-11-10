const { test, expect } = require('@playwright/test');

async function openAgiCheckpoint(page, width = 1440, checkpoint = 'chPh16Choice', layout = 4) {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
  const started = Date.now();
  await page.clock.install({ time: new Date(started) });
  await page.clock.pauseAt(new Date(started + 1000));
  await page.addInitScript(value => localStorage.setItem('ai_empire_layout', String(value)), layout);
  await page.goto('/');
  await page.evaluate(name => {
    window[name]();
    GAME.addCash(1e11);
    GAME.state.ceoMode = 'manage';
  }, checkpoint);
  await page.clock.runFor(200);
}

function upgrade(page, id) {
  return page.locator('[onclick="GAME.buy(\'' + id + '\')"]');
}

async function saveAndReload(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.reload();
  await expect(page.locator('#save-notice')).toBeHidden();
}

test('AGI research persists, pauses with settings, and introduces a visible inspecting cursor', async ({ page }) => {
  test.setTimeout(120000);
  await openAgiCheckpoint(page, 1440, 'chPh16');
  await expect(page.locator('#phase-label')).toHaveText('Phase 15: Global Expansion');
  await expect(upgrade(page, 'retire_unlock')).toHaveCount(0);
  await expect(upgrade(page, 'agi_research')).toHaveText('$8.00B');
  await upgrade(page, 'agi_research').click();
  await expect(upgrade(page, 'agi_research')).toHaveCount(0);
  await page.clock.runFor(10000);
  await expect(page.locator('#agi-status')).toContainText('Fund AGI Research');
  await expect(page.getByRole('progressbar', { name: 'AGI project' })).toBeVisible();
  await page.locator('#btn-settings').click();
  const remaining = await page.evaluate(() => GAME.state.agi.remaining);
  await page.clock.runFor(5000);
  expect(await page.evaluate(() => GAME.state.agi.remaining)).toBe(remaining);
  await page.locator('#btn-settings-close').click();
  await saveAndReload(page);
  expect(await page.evaluate(() => GAME.state.agi.remaining)).toBe(remaining);
  expect(await page.evaluate(() => GAME.state.phase)).toBe(15);
  await page.clock.runFor((remaining + 0.3) * 1000);
  await expect(page.locator('#phase-label')).toHaveText('Phase 16: AGI');
  await saveAndReload(page);
  expect(await page.evaluate(() => GAME.state.phase)).toBe(16);
  await upgrade(page, 'agi_computer_use').click();
  await expect(upgrade(page, 'agi_computer_use')).toHaveCount(0);
  await page.clock.runFor(21000);
  await expect(page.locator('#agi-cursors')).toBeVisible();
  await expect(page.locator('#agi-cursor')).toBeVisible();
  await expect(page.locator('#game-container')).toHaveCSS('cursor', /url\(.*width='18'.*height='23'.*stroke-dasharray='2 2'.*opacity='\.35'.*\) 2 1, auto/);
  await expect(page.locator('#upgrade-list')).toHaveCSS('cursor', /url\(.*opacity='\.35'/);
  await expect(page.locator('#agi-status')).toContainText('AGI checking company cash');
  const cashTarget = await page.locator('#res-cash').boundingBox();
  expect(await page.locator('#agi-cursor').evaluate(cursor => Number.parseFloat(cursor.style.top))).toBeCloseTo(cashTarget.y + cashTarget.height / 2, 0);
  const firstPosition = await page.locator('#agi-cursor').evaluate(cursor => [cursor.style.left, cursor.style.top]);
  await page.clock.runFor(4500);
  const secondPosition = await page.locator('#agi-cursor').evaluate(cursor => [cursor.style.left, cursor.style.top]);
  expect(secondPosition).not.toEqual(firstPosition);
  await page.locator('#control-panel').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.clock.runFor(8500);
  await expect(upgrade(page, 'agi_authority')).toBeEnabled();
  await expect(upgrade(page, 'agi_authority')).toBeInViewport();
  expect(await page.locator('#control-panel').evaluate(element => element.scrollTop)).toBe(0);
  await expect(page.locator('#agi-progress')).toContainText('Checks complete · 3 / 3');
  await expect(page.locator('#upgrade-list .input-needed')).toHaveText('Input needed');
  await expect(page.locator('#agi-cursors')).toBeHidden();
  await page.screenshot({ path: 'test-results/agi-supervised-1440.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Approve · $6.00B' }).click();
  expect(await page.evaluate(() => GAME.state.purchasedUpgrades.includes('agi_authority'))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('research occupies the normal upgrade slot and starts on one click', async ({ page }) => {
  await openAgiCheckpoint(page, 1440, 'chPh16');
  const research = upgrade(page, 'agi_research');
  await expect(page.locator('#upgrade-list .upgrade-card').filter({ has: research })).toContainText('Fund AGI Research');
  await expect(research).toHaveText('$8.00B');
  await expect(page.getByText('Next phase', { exact: true })).toHaveCount(0);
  await research.click();
  await expect(research).toHaveCount(0);
  expect(await page.evaluate(() => GAME.state.agi.projectId)).toBe('agi_research');
  await expect(page.getByRole('progressbar', { name: 'AGI project' })).toBeVisible();
});

for (const width of [1440, 390, 320]) {
  test(`research stages and task evaluations fit at ${width}px`, async ({ page }) => {
    await openAgiCheckpoint(page, width, 'chPh16');
    await upgrade(page, 'agi_research').click();
    await expect(page.locator('#section-agi > .card')).toHaveCSS('padding-bottom', '12px');
    await expect(page.locator('.agi-research-stages [data-state="active"]')).toHaveText('Assemble training data');
    await page.clock.runFor(10100);
    await expect(page.locator('.agi-research-stages [data-state="active"]')).toHaveText('Train model');
    await page.clock.runFor(10000);
    await expect(page.locator('.agi-research-stages [data-state="active"]')).toHaveText('Run evaluations');
    await page.clock.runFor(9000);
    await expect(page.locator('.agi-research-task[data-state="complete"]')).toHaveCount(3);
    expect(await page.locator('.agi-research').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/research-evaluations-${width}.png`, animations: 'disabled' });
    await page.clock.runFor(1000);
    await expect(page.locator('.agi-research')).toHaveCount(0);
    await expect(upgrade(page, 'agi_computer_use')).toBeVisible();
  });
}

for (const width of [1440, 390, 320]) {
  test(`computer use training demonstrates controls and fits at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: width === 1440 ? 'no-preference' : 'reduce' });
    await openAgiCheckpoint(page, width, 'chPh16');
    await upgrade(page, 'agi_research').click();
    await page.clock.runFor(30300);
    await upgrade(page, 'agi_computer_use').click();
    const training = page.locator('.agi-computer-training');
    const cursor = training.locator('.agi-practice-cursor');
    await expect(training).toHaveAttribute('data-stage', '0');
    const initial = await cursor.getAttribute('style');
    await page.clock.runFor(1200);
    const moved = await cursor.getAttribute('style');
    if (width === 1440) expect(moved).not.toBe(initial);
    else {
      expect(moved).toBe(initial);
      await expect(cursor).toHaveCSS('transition-duration', '0s');
    }
    await page.locator('#btn-settings').click();
    const paused = await page.evaluate(() => GAME.state.agi.remaining);
    await page.clock.runFor(200);
    const pausedPosition = await cursor.getAttribute('style');
    await page.clock.runFor(1000);
    expect(await page.evaluate(() => GAME.state.agi.remaining)).toBe(paused);
    expect(await cursor.getAttribute('style')).toBe(pausedPosition);
    await page.locator('#btn-settings-close').click();
    await saveAndReload(page);
    expect(await cursor.getAttribute('style')).toBe(pausedPosition);
    for (const [elapsed, stage, clicking] of [[5.5, 0, true], [6.3, 1, false], [11.5, 1, true], [12.3, 2, false], [18.5, 2, true], [19.3, 3, false]]) {
      const remaining = await page.evaluate(() => GAME.state.agi.remaining);
      await page.clock.runFor(Math.round((elapsed - (20 - remaining)) * 1000));
      await expect(training).toHaveAttribute('data-stage', String(stage));
      await expect(training.locator('[data-state="complete"]')).toHaveCount(stage);
      await expect(cursor).toHaveClass(clicking ? /clicking/ : 'agi-practice-cursor');
      if (clicking) {
        const point = await cursor.evaluate(element => [parseFloat(element.style.left), parseFloat(element.style.top)]);
        expect(point).toEqual([[17, 18], [45, 18], [80, 80]][stage]);
      }
      if (stage === 2) {
        const message = await training.locator('.agi-practice-message').boundingBox();
        const send = await training.locator('.agi-practice-send').boundingBox();
        expect(message.y + message.height).toBeLessThan(send.y);
      }
    }
    await expect(training.locator('.agi-practice-caption')).toHaveText('Computer use ready.');
    expect(await training.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const inbox = await training.locator('.agi-practice-inbox').boundingBox();
    const tasks = await training.locator('.agi-practice-tasks').boundingBox();
    expect(inbox.x + inbox.width).toBeLessThan(tasks.x);
    await training.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/computer-use-training-${width}.png`, animations: 'disabled' });
    await page.clock.runFor(1000);
    await expect(training).toHaveCount(0);
    await expect(page.locator('#agi-cursor')).toBeVisible();
  });
}

test('buyout confirmation supports cancellation, Escape and primary action above Go back', async ({ page }) => {
  await openAgiCheckpoint(page, 390);
  await page.locator('#btn-agi-buyout').click();
  const dialog = page.locator('#agi-buyout-warning');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#agi-buyout-message')).toHaveText('Prepare the company for sale and the retirement you once dreamt of.');
  expect((await page.locator('#btn-agi-buyout-confirm').boundingBox()).y).toBeLessThan((await page.locator('#btn-agi-buyout-cancel').boundingBox()).y);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#btn-agi-buyout')).toBeFocused();
  await page.locator('#btn-agi-buyout').click();
  await page.locator('#btn-agi-buyout-cancel').click();
  expect(await page.evaluate(() => GAME.state.agi.route)).toBe('');
  await expect(page.getByText('Choose the next chapter', { exact: true })).toHaveCount(0);
});

for (const [width, layout] of [[1440, 4], [390, 4], [320, 4], [1440, 3], [390, 3], [320, 3]]) {
  test(`buyout delegates sale preparation and waits for the human to sell in view ${layout} at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await openAgiCheckpoint(page, width, 'chPh16Choice', layout);
    await expect(page.locator('#section-upgrades #agi-route-choices')).toBeVisible();
    await expect(page.locator('#agi-route-choices')).toContainText('Input needed');
    await expect(page.locator('#agi-cursors')).toBeHidden();
    await expect(page.locator('#phase-label')).toHaveText('Phase 16: AGI');
    await page.clock.runFor(8000);
    await page.screenshot({ path: `test-results/agi-choice-${layout}-${width}.png`, animations: 'disabled' });
    expect(await page.locator('#control-panel').evaluate(element => element.scrollTop)).toBe(0);
    await expect(page.locator('#agi-status')).toBeInViewport({ ratio: 1 });
    await page.locator('#agi-route-choices').scrollIntoViewIfNeeded();
    await expect(page.locator('#agi-route-choices .input-needed')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#btn-agi-buyout')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#btn-agi-scaling')).toBeInViewport({ ratio: 1 });
    await expect(upgrade(page, 'retire_unlock')).toHaveCount(0);
    await page.locator('#btn-agi-buyout').click();
    await expect(page.locator('#agi-buyout-warning')).toBeVisible();
    await page.locator('#btn-agi-buyout-confirm').click();
    await expect(page.locator('#agi-route-choices')).toBeHidden();
    await page.clock.runFor(200);
    await upgrade(page, 'retire_unlock').click();
    await page.clock.runFor(8300);
    expect(await page.evaluate(() => GAME.state.phase)).toBe(17);
    await expect(page.locator('#phase-label')).toHaveText('Phase 17: Buyout');
    await page.clock.runFor(76000);
    expect(await page.evaluate(() => GAME.state.purchasedUpgrades.includes('sale_terms'))).toBe(true);
    expect(await page.evaluate(() => GAME.state.agi.purchases)).toBeGreaterThanOrEqual(4);
    await expect(upgrade(page, 'fusion')).toBeEnabled();
    await expect(page.locator('#upgrade-list .input-needed')).toHaveText('Input needed');
    expect(await page.evaluate(() => GAME.state.retired)).toBe(false);
    await page.clock.runFor(8000);
    expect(await page.evaluate(() => GAME.state.retired)).toBe(false);
    await page.screenshot({ path: `test-results/agi-buyout-${layout}-${width}.png`, animations: 'disabled' });
    expect(await page.locator('#control-panel').evaluate(element => element.scrollTop)).toBe(0);
    await expect(page.locator('#agi-status')).toBeInViewport({ ratio: 1 });
    await upgrade(page, 'fusion').scrollIntoViewIfNeeded();
    await expect(upgrade(page, 'fusion')).toBeInViewport({ ratio: 1 });
    await expect(upgrade(page, 'fusion').locator('xpath=ancestor::div[contains(@class,"upgrade-card")]').locator('.name')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await upgrade(page, 'fusion').click();
    await page.clock.runFor(5000);
    await expect(page.locator('#ending-title')).toHaveText('Your time belongs to you.');
    await expect(page.locator('#agi-cursors')).toBeHidden();
    await expect(page.locator('#ending-choices')).toBeVisible();
    await saveAndReload(page);
    await expect(page.locator('#ending-title')).toHaveText('Your time belongs to you.');
  });

  test(`keep scaling confirms, replicates, ends and resets in view ${layout} at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await openAgiCheckpoint(page, width, 'chPh16Choice', layout);
    await page.locator('#btn-agi-scaling').click();
    await expect(page.locator('#agi-warning')).toBeVisible();
    await expect(page.locator('#agi-warning')).toHaveAccessibleName('Remove guard rails');
    expect((await page.locator('#btn-agi-confirm').boundingBox()).y).toBeLessThan((await page.locator('#btn-agi-cancel').boundingBox()).y);
    await expect(page.locator('#btn-agi-confirm')).toBeFocused();
    await expect(page.locator('#agi-warning-message')).toHaveText('Are you sure? AGI will expand without further approval.');
    expect(await page.evaluate(() => GAME.state.agi.route)).toBe('');
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#btn-agi-cancel')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#btn-agi-confirm')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#agi-warning')).toBeHidden();
    await expect(page.locator('#btn-agi-scaling')).toBeFocused();
    expect(await page.evaluate(() => GAME.state.agi.route)).toBe('');
    await page.locator('#btn-agi-scaling').click();
    await page.locator('#btn-agi-cancel').click();
    await expect(page.locator('#agi-route-choices')).toBeVisible();
    await expect(page.locator('#phase-label')).toHaveText('Phase 16: AGI');
    await page.locator('#btn-agi-scaling').click();
    await page.locator('#btn-agi-confirm').click();
    expect(await page.evaluate(() => GAME.state.agi.route)).toBe('scaling');
    expect(await page.evaluate(() => GAME.state.phase)).toBe(16);
    await expect(upgrade(page, 'retire_unlock')).toHaveCount(0);
    await page.clock.runFor(16000);
    await expect(page.locator('.agi-cursor:visible')).toHaveCount(3);
    expect(await page.evaluate(() => GAME.state.agi.replicas)).toBeGreaterThan(20);
    const elapsed = await page.evaluate(() => GAME.state.agi.runawaySeconds);
    await saveAndReload(page);
    expect(await page.evaluate(() => GAME.state.agi.runawaySeconds)).toBe(elapsed);
    await page.clock.runFor(12000);
    await expect(page.locator('body')).toHaveAttribute('data-agi-stage', '3');
    await expect(page.locator('.agi-cursor:visible')).toHaveCount(4);
    await expect(page.locator('#agi-runaway-panel')).toBeInViewport();
    expect(await page.locator('#agi-runaway-panel').evaluate(panel => panel.scrollWidth <= panel.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/agi-runaway-${layout}-${width}.png`, animations: 'disabled' });
    await page.clock.runFor(17600);
    const fade = page.locator('#ending-transition');
    await expect(fade).toBeVisible();
    await expect(page.locator('#access-revoked')).toHaveText('Human input no longer required.');
    await expect(page.locator('#agi-runaway-panel')).toBeHidden();
    await expect(page.locator('#ending-overlay')).toBeHidden();
    await page.clock.runFor(5400);
    await expect(page.locator('#ending-overlay')).toBeVisible();
    await expect(fade).toBeHidden();
    await expect(page.locator('#ending-title')).toHaveText('There is always one more task.');
    await expect(page.locator('#btn-ending-reset')).toBeFocused();
    await expect(page.locator('#ending-choices')).toBeHidden();
    await expect(page.locator('#agi-cursors')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await saveAndReload(page);
    await expect(page.locator('#ending-title')).toHaveText('There is always one more task.');
    await expect(page.locator('#btn-ending-reset')).toBeFocused();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#btn-ending-reset').click();
    await expect(page.locator('#intro-overlay')).toBeVisible();
    await expect(page.locator('#agi-runaway-panel')).toBeHidden();
    expect(await page.evaluate(() => GAME.state.agi.route)).toBe('');
    expect(await page.evaluate(() => GAME.state.phase)).toBe(1);
  });
}

for (const [width, reducedMotion] of [[1440, 'no-preference'], [390, 'reduce']]) {
  test(`AGI returns from the bottom before a visible purchase at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await openAgiCheckpoint(page, width);
    await page.evaluate(() => {
      GAME.state.purchasedUpgrades = GAME.state.purchasedUpgrades.filter(id => !['agi_contracts', 'agi_independence'].includes(id));
      GAME.state.ceoMode = 'manage';
    });
    await page.clock.runFor(300);
    const panel = page.locator('#control-panel');
    const purchase = upgrade(page, 'agi_contracts');
    await panel.evaluate(element => { element.scrollTop = element.scrollHeight; });
    expect(await panel.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await page.clock.runFor(1700);
    expect(await panel.evaluate(element => element.scrollTop)).toBe(0);
    await page.clock.runFor(1500);
    await expect(page.locator('#agi-cursor')).toHaveClass(/clicking/);
    await expect(page.locator('#agi-cursor span')).toHaveText('AGI · Click');
    await expect(page.locator('#agi-cursor span')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.agi-click-target')).toHaveCount(1);
    await expect(purchase).toBeInViewport({ ratio: 1 });
    const ring = await page.locator('#agi-cursor').evaluate(element => {
      const style = getComputedStyle(element, '::before');
      return { content: style.content, border: style.borderTopWidth, animation: style.animationDuration };
    });
    expect(ring.content).toBe('""');
    expect(ring.border).toBe('3px');
    expect(ring.animation).toBe(reducedMotion === 'reduce' ? '0s' : '0.75s');
    await page.screenshot({ path: `test-results/agi-purchase-click-${width}.png` });
    await panel.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.clock.runFor(700);
    expect(await panel.evaluate(element => element.scrollTop)).toBe(0);
    expect(await page.evaluate(() => GAME.state.agi.projectId)).toBe('');
    await page.clock.runFor(2100);
    expect(await page.evaluate(() => GAME.state.agi.projectId)).toBe('agi_contracts');
    await expect(page.locator('.agi-click-target')).toHaveCount(0);
  });
}

test('AGI inspections keep the control panel and event log at the top', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAgiCheckpoint(page);
  await page.evaluate(() => {
    const state = GAME.state;
    state.purchasedUpgrades = state.purchasedUpgrades.filter(id => !['agi_contracts', 'agi_independence'].includes(id));
    state.agi.projectId = 'agi_contracts';
    state.agi.remaining = 30;
    state.log = Array.from({ length: 24 }, (_, index) => ({ msg: 'Cluster ' + (24 - index) + ' online.', type: 'info', t: Date.now() }));
    document.querySelector('#control-panel').scrollTop = 1000;
  });
  const operations = page.locator('#operations-health');
  const events = page.locator('#log-panel');
  await page.clock.runFor(4600);
  expect(await page.locator('#control-panel').evaluate(element => element.scrollTop)).toBe(0);
  await page.clock.runFor(14500);
  expect(await events.evaluate(element => element.scrollTop)).toBe(0);
});

test('the header control pauses AGI with a click and resumes with the keyboard', async ({ page }) => {
  await openAgiCheckpoint(page, 1440, 'chPh17');
  await upgrade(page, 'retire_unlock').click();
  await page.clock.runFor(1000);
  await expect(page.locator('#agi-cursors')).toBeVisible();
  const control = page.locator('#btn-agi-control');
  await page.mouse.move(200, 200);
  await page.mouse.wheel(0, 200);
  await expect(control).toHaveText('Take control');
  expect(await page.evaluate(() => GAME.state.agi.paused)).toBe(false);
  await expect(page.locator('#agi-cursors')).toBeVisible();
  await control.click();
  await expect(page.locator('#agi-cursors')).toBeHidden();
  await expect(control).toHaveText('Resume AGI');
  expect(await page.locator('#game-container').evaluate(element => getComputedStyle(element).cursor)).not.toBe('none');
  await page.clock.runFor(13000);
  expect(await page.evaluate(() => GAME.state.agi.paused)).toBe(true);
  expect(await page.evaluate(() => GAME.state.agi.purchases)).toBe(0);
  await control.focus();
  await page.keyboard.press('Enter');
  await page.clock.runFor(1000);
  await expect(page.locator('#agi-cursors')).toBeVisible();
  await expect(control).toHaveText('Take control');
});

test.describe('touch interaction', () => {
  test.use({ hasTouch: true });
  test('touch supports the branch confirmation and restores the player pointer during runaway scaling', async ({ page }) => {
    await openAgiCheckpoint(page, 390);
    await page.locator('#btn-agi-scaling').tap();
    await expect(page.locator('#agi-warning')).toBeVisible();
    await page.locator('#btn-agi-cancel').tap();
    await expect(page.locator('#agi-route-choices')).toBeVisible();
    await expect(page.locator('#phase-label')).toHaveText('Phase 16: AGI');
    await page.locator('#btn-agi-scaling').tap();
    await page.locator('#btn-agi-confirm').tap();
    const control = page.locator('#btn-agi-control');
    await control.tap();
    await expect(control).toHaveText('Resume AGI');
    await expect(page.locator('body')).not.toHaveClass(/agi-driving/);
    const cursors = page.locator('.agi-cursor:visible');
    await expect(cursors).toHaveCount(2);
    const positions = () => cursors.evaluateAll(elements => elements.map(element => [element.style.left, element.style.top]));
    const before = await positions();
    expect(before[0]).not.toEqual(before[1]);
    await page.clock.runFor(2200);
    expect(await positions()).not.toEqual(before);
    await control.tap();
    await expect(page.locator('body')).toHaveClass(/agi-driving/);
  });
});

test('reduced motion removes cursor animation and still completes the scaling ending', async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAgiCheckpoint(page, 390);
  await page.clock.runFor(1000);
  await page.locator('#btn-agi-scaling').click();
  await page.locator('#btn-agi-confirm').click();
  await expect(page.locator('#agi-cursor')).toBeVisible();
  await expect(page.locator('#agi-cursor')).toHaveCSS('transition-duration', '0s');
  await page.clock.runFor(46000);
  await expect(page.locator('#ending-title')).toHaveText('There is always one more task.');
  await expect(page.locator('#ending-transition')).toBeHidden();
  await expect(page.locator('#btn-ending-reset')).toBeEnabled();
});
