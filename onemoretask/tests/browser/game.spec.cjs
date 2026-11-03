const { test, expect } = require('@playwright/test');
const { harness } = require('../harness.cjs');

function fixture(phase) {
  const h=harness();const g=h.fresh(phase);g.cash=1e8;g.tokens=500;g.totalTasksDone=1600;g.reputation=3000;g.managerUnlock=true;
  if(phase>=9){for(let n=0;n<(phase>=12?100:1);n++){const c=h.api.addClusterWithNextName();c.managerAssigned=true;c.tokenManagerAssigned=true;c.tank=100;if(phase>=12)c.workforce=8;else for(let i=0;i<4;i++){const a=h.worker();c.workerAgentIds.push(a.id);}}}
  for(const upgrade of h.api.UPGRADES){if(upgrade.oneTime && (!upgrade.unlockPhase || upgrade.unlockPhase<=phase))h.api.purchaseUpgrade(upgrade.id);}
  if(phase<9){h.worker('manager');h.worker('token_mgr');h.worker('devops');}h.api.checkMilestones();h.dismiss();
  g.lastTick=Date.now();g.lastSave=g.lastTick;g.incidentsExplained=true;
  const raw=JSON.stringify(g);h.close();return raw;
}
test('new game, keyboard work, settings focus, save and reload', async ({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
  await page.getByRole('button',{name:'Find Work'}).click();
  await page.getByRole('button',{name:'Do Task',exact:true}).focus();await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>GAME.state.totalTasksDone)).toBe(1);
  await page.evaluate(()=>{GAME.addTasks(2)});await page.getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.locator('#btn-settings-music')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#btn-settings')).toBeFocused();
  await page.reload();await expect(page.locator('#intro-overlay')).toBeHidden();expect(errors).toEqual([]);
});
for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
  test(`late game fits and scrolls at ${viewport.width}x${viewport.height}`,async({page})=>{
    await page.setViewportSize(viewport);const raw=fixture(9);
    await page.addInitScript(value=>{localStorage.setItem('ai_empire_save',value);sessionStorage.setItem('rotate_dismissed','1')},raw);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
    if(await page.locator('#rotate-overlay').isVisible())await page.locator('#btn-rotate-continue').click();await expect(page.locator('#section-clusters')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#section-log').scrollIntoViewIfNeeded();await expect(page.locator('#section-log')).toBeInViewport();
    await page.locator('#cluster-list button').first().scrollIntoViewIfNeeded();await page.locator('#cluster-list button').first().focus();
    await page.waitForTimeout(300);await expect(page.locator('#cluster-list button').first()).toBeFocused();
    await page.screenshot({path:`test-results/phase9-${viewport.width}.png`,fullPage:true});expect(errors).toEqual([]);
  });
}
test('persistent ending freezes play and survives reload',async({page})=>{
  const h=harness(fixture(15));const g=h.window.GAME.state;if(!g.purchasedUpgrades.includes('fusion'))g.purchasedUpgrades.push('fusion');g.services=[{id:'svc',name:'Service',active:true,incomeRate:1000}];const raw=JSON.stringify(g);h.close();
  await page.addInitScript(value=>{if(!sessionStorage.getItem('ending_seeded')){localStorage.setItem('ai_empire_save',value);sessionStorage.setItem('ending_seeded','1')}},raw);
  page.on('dialog',dialog=>dialog.accept());await page.goto('/');if(await page.locator('#offline-popup').isVisible())await page.locator('#btn-dismiss-offline').click();await page.getByRole('button',{name:'Walk Away Forever'}).click();
  await expect(page.getByRole('heading',{name:'No more tasks.'})).toBeVisible();const balance=await page.evaluate(()=>GAME.state.cash);await page.waitForTimeout(300);expect(await page.evaluate(()=>GAME.state.cash)).toBe(balance);
  await page.reload();await expect(page.getByRole('heading',{name:'No more tasks.'})).toBeVisible();await page.screenshot({path:'test-results/ending.png'});
  await page.evaluate(()=>localStorage.setItem('unrelated-app','keep'));await page.getByRole('button',{name:'Start a new story'}).click();await expect(page.getByRole('button',{name:'Find Work'})).toBeVisible();expect(await page.evaluate(()=>GAME.state.retired)).toBe(false);expect(await page.evaluate(()=>localStorage.getItem('unrelated-app'))).toBe('keep');
});
test('invalid save is preserved and can be explicitly reset',async({page})=>{
  await page.addInitScript(()=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('ai_empire_save','null');sessionStorage.setItem('seeded','1')}});
  await page.goto('/');await expect(page.locator('#save-notice')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('ai_empire_save'))).toBe('null');
  page.on('dialog',dialog=>dialog.accept());await page.locator('#btn-save-reset').click();await expect(page.locator('#save-notice')).toBeHidden();
});

test('100-node view has no internal controls and remains responsive',async({page})=>{
  await page.setViewportSize({width:390,height:844});const raw=fixture(14);
  await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
  if(await page.locator('#rotate-overlay').isVisible())await page.locator('#btn-rotate-continue').click();
  await expect(page.locator('.node-grid .cluster-card')).toHaveCount(100);await expect(page.locator('.node-grid button')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.node-grid').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/network-100-mobile.png',fullPage:true});expect(errors).toEqual([]);
});
test('an empty cluster needs its management team before worker buttons appear',async({page})=>{
  const raw=fixture(9);await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  await page.getByRole('button',{name:'Open empty cluster'}).click();const second=page.locator('.cluster-card').nth(1);
  await expect(second).toContainText('management required');await expect(second.getByRole('button')).toHaveCount(1);
  await second.getByRole('button',{name:'Management team'}).click();await expect(second).toContainText('Manager · Token Manager · DevOps');
  await second.getByRole('button',{name:'Coder',exact:true}).click();await expect(second).toContainText('1/8 workers');
  await expect(page.locator('#cluster-list')).not.toContainText('Worker controls');
});
