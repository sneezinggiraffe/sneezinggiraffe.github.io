const { test, expect } = require('@playwright/test');

for (const width of [1440, 390]) {
  test(`better way gates later upgrades until its free button is clicked at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await page.goto('/');
    await page.evaluate(() => {
      GAME.cheat('0_2');
      GAME.state.cash = 1000;
      for (const id of ['post_it_notes', 'gas_station_coffee', 'sticky_note_system']) GAME.buy(id);
      GAME.addTasks(27);
    });
    await page.clock.runFor(200);
    if (await page.locator('#rotate-overlay').isVisible()) await page.locator('#btn-rotate-continue').click();
    const card = page.locator('#upgrade-list .upgrade-card');
    await expect(card).toHaveCount(0);
    await page.evaluate(() => GAME.addTasks(1));
    await page.clock.runFor(200);
    await expect(page.locator('#milestone-popup')).toBeHidden();
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('There Must Be a Better Way');
    await card.getByRole('button', { name: 'Free', exact: true }).click();
    await page.clock.runFor(200);
    await expect(card).toHaveCount(3);
    for (const name of ['Side Hustle Optimization', 'Inbox Zero Method', 'GTD Workflow']) {
      await expect(page.locator('#upgrade-list')).toContainText(name);
    }
    await expect(page.locator('#milestone-popup')).toBeHidden();
  });
}
