const { test, expect } = require('@playwright/test');
const { harness } = require('../harness.cjs');

function fixture(phase) {
  const h=harness();const g=h.fresh(phase);g.cash=1e11;g.tokens=50000;g.totalTasksDone=2000;g.managerUnlock=true;g.aiWorkerShutdown=phase>=4;g.payMult=10;
  g.purchasedUpgrades=h.api.UPGRADES.filter(u=>u.oneTime&&u.phase<=phase&&(!u.unlockPhase||u.unlockPhase<=phase)&&u.id!=='fusion').map(u=>u.id);
  g.ceoMode=phase>=11?'scale':phase>=10?'manage':'off';
  if(phase>=9)for(let n=0;n<(phase>=12?100:phase>=10?3:1);n++){const c=h.fullCluster();c.tank=4000;}
  if(phase<9){h.worker('manager');h.worker('token_mgr');h.worker('devops');}
  g.replicationTarget=109;g.services=[{id:'service',name:'Service',incomeRate:1000,active:true}];g.serviceSlots=1;
  h.api.checkMilestones();h.dismiss();g.lastTick=Date.now();g.lastSave=g.lastTick;g.lastCeoAction=g.lastTick;g.incidentsExplained=true;
  const raw=JSON.stringify(g);h.close();return raw;
}

test('Phase 5 adds two D4 and F4 phrases per bar with quiet chorus and reverb', async ({page}) => {
  const raw = fixture(4);
  await page.clock.install();
  await page.addInitScript(value => {
    localStorage.setItem('ai_empire_save', value);
    const NativeAudio = window.Audio;
    window.testAudioPlayers = [];
    window.Audio = function () {
      const player = new NativeAudio();
      window.testAudioPlayers.push(player);
      return player;
    };
  }, raw);
  await page.goto('/');
  await page.locator('#btn-settings').click();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.testAudioPlayers.some(player => player.src.endsWith('/synth_d4_loop.mp3')))).toBe(false);
  await page.locator('[onclick="GAME.buy(\'tool_use\')"]').click();
  expect(await page.evaluate(() => GAME.state.phase)).toBe(5);
  await page.clock.runFor(8100);
  await expect.poll(() => page.evaluate(() => {
    const synth = window.testAudioPlayers.find(player => player.src.endsWith('/synth_d4_loop.mp3'));
    return synth && { playing: !synth.paused, ready: synth.readyState >= 2, loop: synth.loop, volume: synth.volume, error: synth.error };
  })).toEqual({ playing: true, ready: true, loop: true, volume: 0.0729, error: null });

  const audio = await page.evaluate(async () => {
    const response = await fetch('synth_d4_loop.mp3');
    const context = new AudioContext();
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    await context.close();
    const samples = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const rms = (start, end) => {
      const first = Math.floor(start * buffer.sampleRate);
      const last = Math.floor(end * buffer.sampleRate);
      let sum = 0;
      for (let i = first; i < last; i++) sum += samples[i] ** 2;
      return Math.sqrt(sum / (last - first));
    };
    const spectralPower = (frequency, onset = 0.012) => {
      const first = Math.floor((onset + 0.018) * buffer.sampleRate);
      const last = Math.floor((onset + 0.103) * buffer.sampleRate);
      let real = 0;
      let imaginary = 0;
      for (let i = first; i < last; i++) {
        const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * (i - first) / (last - first - 1));
        const phase = 2 * Math.PI * frequency * i / buffer.sampleRate;
        real += samples[i] * window * Math.cos(phase);
        imaginary += samples[i] * window * Math.sin(phase);
      }
      return real ** 2 + imaginary ** 2;
    };
    const pitches = [293.665, 349.228].map(target => {
      let peakFrequency = 0;
      let peakPower = 0;
      for (let frequency = target - 8; frequency <= target + 8; frequency += 0.25) {
        const power = spectralPower(frequency);
        if (power > peakPower) { peakPower = power; peakFrequency = frequency; }
      }
      return { target, peakFrequency };
    });
    const beat = buffer.duration / 16;
    const phrases = Array.from({ length: 8 }, (_, phrase) => {
      const sixteenths = Array.from({ length: 8 }, (_, sixteenth) => {
        const onset = (phrase * 2 + sixteenth / 4) * beat + 0.012;
        return rms(onset + 0.015, onset + 0.075);
      });
      const notes = [0, 0.25, 0.75, 1.25, 1.5].map(position => {
        const onset = (phrase * 2 + position) * beat + 0.012;
        return {
          body: rms(onset + 0.015, onset + 0.075),
          decay: rms(onset + 0.095, onset + 0.125),
          dyadBalance: spectralPower(349.228, onset) / spectralPower(293.665, onset),
        };
      });
      const tails = [0.25, 0.75, 1.5].map(position => {
        const onset = (phrase * 2 + position) * beat + 0.012;
        return rms(onset + 0.145, onset + 0.225) / rms(onset + 0.015, onset + 0.075);
      });
      const first = Math.floor((phrase * 2 * beat + 0.03) * buffer.sampleRate);
      const last = Math.floor((phrase * 2 * beat + 0.11) * buffer.sampleRate);
      let difference = 0;
      let centre = 0;
      for (let index = first; index < last; index++) {
        difference += (samples[index] - right[index]) ** 2;
        centre += (samples[index] + right[index]) ** 2;
      }
      return { sixteenths, notes, tails, stereoWidth: Math.sqrt(difference / centre) };
    });
    return {
      duration: buffer.duration,
      pitches,
      brightness: (spectralPower(293.665 * 2) + spectralPower(293.665 * 3)) / spectralPower(293.665),
      phrases,
      edges: [Math.abs(samples[0]), Math.abs(samples[samples.length - 1])],
    };
  });
  expect(audio.duration).toBeCloseTo(8.36, 1);
  for (const pitch of audio.pitches) expect(Math.abs(pitch.peakFrequency - pitch.target)).toBeLessThan(1.5);
  expect(audio.brightness).toBeGreaterThan(0.03);
  expect(audio.phrases).toHaveLength(8);
  for (const phrase of audio.phrases) {
    for (const sixteenth of [0, 1, 3, 5, 6]) expect(phrase.sixteenths[sixteenth]).toBeGreaterThan(0.1);
    const quietLimit = Math.min(...phrase.notes.map(note => note.body)) * 0.15;
    for (const sixteenth of [2, 4, 7]) expect(phrase.sixteenths[sixteenth]).toBeLessThan(quietLimit);
    for (const note of phrase.notes) {
      expect(note.decay).toBeLessThan(note.body * 0.5);
      expect(note.dyadBalance).toBeGreaterThan(0.5);
      expect(note.dyadBalance).toBeLessThan(2);
    }
    for (const tail of phrase.tails) {
      expect(tail).toBeGreaterThan(0.005);
      expect(tail).toBeLessThan(0.12);
    }
    const otherNotes = [0, 1, 3, 4].map(index => phrase.notes[index].body);
    const accent = phrase.notes[2].body / (otherNotes.reduce((sum, value) => sum + value, 0) / otherNotes.length);
    expect(accent).toBeGreaterThan(1.05);
    expect(accent).toBeLessThan(1.3);
  }
  const widths = audio.phrases.map(phrase => phrase.stereoWidth);
  expect(Math.max(...widths)).toBeGreaterThan(0.04);
  expect(Math.max(...widths)).toBeLessThan(0.35);
  expect(Math.max(...widths) - Math.min(...widths)).toBeGreaterThan(0.02);
  for (const edge of audio.edges) expect(edge).toBeLessThan(0.001);

  await page.locator('#btn-dismiss-popup').click();
  await page.locator('#btn-settings').click();
  await page.locator('#btn-settings-music').click();
  expect(await page.evaluate(() => window.testAudioPlayers.every(player => player.paused))).toBe(true);
});

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
test('sale opens a separate retirement screen, then permanent retirement survives reload',async({page})=>{
  const raw=fixture(15);await page.addInitScript(value=>{if(!sessionStorage.getItem('ending_seeded')){localStorage.setItem('ai_empire_save',value);sessionStorage.setItem('ending_seeded','1')}},raw);
  page.on('dialog',dialog=>dialog.accept());await page.goto('/');await page.locator('[onclick="GAME.buy(\'fusion\')"]').click();
  await expect(page.getByRole('heading',{name:'You retired early!'})).toBeVisible();await expect(page.locator('#game-container')).toBeHidden();await expect(page.locator('#top-bar')).toBeHidden();
  await expect(page.locator('#btn-ending-restart')).toBeFocused();const balance=await page.evaluate(()=>GAME.state.cash);await page.waitForTimeout(300);expect(await page.evaluate(()=>GAME.state.cash)).toBe(balance);
  await page.reload();await expect(page.getByRole('heading',{name:'You retired early!'})).toBeVisible();await page.screenshot({path:'test-results/retire-early.png'});
  await page.getByRole('button',{name:'Actually retire',exact:true}).click();await expect(page.getByRole('heading',{name:'No more tasks.'})).toBeFocused();await expect(page.locator('#ending-choices')).toBeHidden();
  await page.reload();await expect(page.getByRole('heading',{name:'No more tasks.'})).toBeVisible();await expect(page.locator('#btn-ending-reset')).toBeFocused();await page.screenshot({path:'test-results/ending.png'});
  await page.evaluate(()=>localStorage.setItem('unrelated-app','keep'));await page.getByRole('button',{name:'Start a new story'}).click();await expect(page.getByRole('button',{name:'Find Work'})).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('unrelated-app'))).toBe('keep');
});
test('another model restarts from the retirement screen with earned bonuses',async({page})=>{
  await page.setViewportSize({width:390,height:844});const raw=fixture(15);await page.addInitScript(value=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('ai_empire_save',value);sessionStorage.setItem('seeded','1')}},raw);await page.goto('/');
  if(await page.locator('#rotate-overlay').isVisible())await page.locator('#btn-rotate-continue').click();
  await page.locator('[onclick="GAME.buy(\'fusion\')"]').click();await expect(page.locator('#ending-story')).toContainText('golf course');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/retire-early-mobile.png'});
  await page.locator('#btn-ending-restart').click();await expect(page.locator('#ending-overlay')).toBeHidden();await expect(page.locator('#intro-story')).toContainText('bored');expect(await page.evaluate(()=>GAME.state.prestigeCount)).toBe(1);expect(await page.evaluate(()=>GAME.state.clickPower)).toBe(2);
  await page.reload();expect(await page.evaluate(()=>GAME.state.retired)).toBe(false);expect(await page.evaluate(()=>GAME.state.prestigeCount)).toBe(1);
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
  await expect(page.locator('.network-grid div.cluster-card')).toHaveCount(100);await expect(page.locator('.network-grid div.cluster-card button')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.network-grid').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/network-100-mobile.png',fullPage:true});expect(errors).toEqual([]);
});
test('an empty cluster needs its management team before worker buttons appear',async({page})=>{
  const raw=fixture(9);await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  await page.getByRole('button',{name:'Provision cluster'}).click();const second=page.locator('div.cluster-card').nth(1);
  const firstBox=await page.locator('div.cluster-card').first().boundingBox();const secondBox=await second.boundingBox();expect(secondBox.x).toBeGreaterThan(firstBox.x);expect(secondBox.y).toBe(firstBox.y);
  await expect(second).toContainText('Building cluster');await expect(second.getByRole('progressbar')).toBeVisible();await expect(second).toContainText('Awaiting management',{timeout:15000});await expect(second.getByRole('button')).toHaveCount(1);
  await second.getByRole('button',{name:'Employ management team'}).click();await expect(second).toContainText('Manager · Token Manager · DevOps');
  await second.getByRole('button',{name:'Coder ($2.5K)',exact:true}).click();await expect(second.locator('.capacity-slot.filled')).toHaveCount(1);await expect(second.locator('.cluster-status')).toHaveText('Hiring');
  await expect(page.locator('#cluster-list')).not.toContainText('Worker controls');await page.screenshot({path:'test-results/phase9-grid.png',fullPage:true});
});
test('Phase 8 simplifies agents and allows a paid partial top-up with Manager online',async({page})=>{
  const h=harness(fixture(8),{seed:42});const g=h.window.GAME.state;g.managerTokenTank=4000;g.tokens=10000;g.aiWorkerShutdown=true;g.aiWorkerCurrentTaskId=null;g.tasks=[];
  const a=h.worker('writer');a.tokenTank=750;const id=a.id;g.lastTick=Date.now();const raw=JSON.stringify(g);h.close();
  await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  await expect(page.locator('#section-stats')).toBeHidden();await expect(page.locator('#agent-list')).not.toContainText('SPD');await expect(page.locator('#agent-list')).not.toContainText('Managed');
  const button=page.locator('[onclick="GAME.topUpAgent(\''+id+'\')"]');await expect(button).toHaveText('Top-up tokens');await button.click();
  expect(await page.evaluate(agentId=>GAME.state.agents.find(agent=>agent.id===agentId).tokenTank,id)).toBeGreaterThan(1000);
  expect(await page.evaluate(()=>GAME.state.tokens)).toBeLessThan(10000);
  await page.screenshot({path:'test-results/phase8-simple.png',fullPage:true});
});
test('Phase 12 provisions manually and the CEO then employs the team',async({page})=>{
  const raw=fixture(12);await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  await expect(page.locator('.node-grid div.cluster-card')).toHaveCount(100);
  await page.getByRole('button',{name:'Provision cluster'}).click();await expect(page.locator('.node-grid div.cluster-card')).toHaveCount(101);
  await expect(page.locator('.node-grid div.cluster-card').last().locator('.capacity-slot.filled')).toHaveCount(8,{timeout:16000});
  await expect(page.locator('.node-grid div.cluster-card button')).toHaveCount(0);
});

test('Phase 3 requires the second subscription before upgrading both workers',async({page})=>{
  const h=harness();const g=h.fresh(3);g.cash=100000;g.tokens=200;g.totalTasksDone=800;h.prepareUpgrade('second_ai');h.api.checkMilestones();h.dismiss();g.lastTick=Date.now();const raw=JSON.stringify(g);h.close();
  await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  await expect(page.locator('[onclick="GAME.buy(\'multi_bot\')"]')).toHaveCount(0);await page.locator('[onclick="GAME.buy(\'second_ai\')"]').click();
  await expect(page.locator('#agent-list').getByRole('button',{name:'Top-up tokens'})).toHaveCount(2);await expect(page.locator('#agent-slots')).toHaveText('Two AI subscriptions');
  for(const button of await page.locator('#agent-list').getByRole('button',{name:'Top-up tokens'}).all())await button.click();
  expect(await page.evaluate(()=>GAME.state.tokens)).toBe(120);await page.screenshot({path:'test-results/phase3-two-subscriptions.png',fullPage:true});
  await page.locator('[onclick="GAME.buy(\'multi_bot\')"]').click();expect(await page.evaluate(()=>GAME.state.phase)).toBe(4);expect(await page.evaluate(()=>GAME.state.aiWorkerShutdown)).toBe(true);expect(await page.evaluate(()=>GAME.state.agents.length)).toBe(2);
  await expect(page.locator('#agent-list').getByRole('button',{name:'Sell'})).toHaveCount(2);
});

test('an existing twelve-node company must provision and staff nine more nodes before replication',async({page})=>{
  const h=harness();const g=h.fresh(11);g.cash=1e9;g.tokens=1e6;g.totalTasksDone=2000;g.ceoMode='scale';g.aiWorkerShutdown=true;h.prepareUpgrade('autonomous_nodes');
  for(let i=0;i<12;i++){const c=h.api.addClusterWithNextName();c.managerAssigned=true;c.tokenManagerAssigned=true;for(let j=0;j<8;j++)c.workerAgentIds.push(h.worker('coder').id);}
  h.api.checkMilestones();h.dismiss();g.lastTick=Date.now();g.lastSave=g.lastTick;g.lastCeoAction=g.lastTick;const raw=JSON.stringify(g);h.close();
  await page.clock.install();await page.addInitScript(value=>{if(!sessionStorage.getItem('replication_seeded')){localStorage.setItem('ai_empire_save',value);sessionStorage.setItem('replication_seeded','1')}},raw);await page.goto('/');
  await page.locator('[onclick="GAME.buy(\'autonomous_nodes\')"]').click();await page.clock.runFor(200);await page.locator('#btn-dismiss-popup').click();
  const buy=page.locator('[onclick="GAME.buy(\'replication\')"]');await expect(buy).toHaveCount(0);
  for(let i=0;i<8;i++){await page.getByRole('button',{name:'Provision cluster'}).click();await page.clock.runFor(200);}
  await page.clock.runFor(41000);await expect(buy).toBeDisabled();await expect(buy.locator('..').locator('..')).toContainText('(21 nodes)');
  await page.reload();await expect(buy).toBeDisabled();expect(await page.evaluate(()=>GAME.state.replicationTarget)).toBe(21);
  await page.getByRole('button',{name:'Provision cluster'}).click();await page.clock.runFor(11500);await expect(buy).toBeEnabled();
  await buy.click();await page.clock.runFor(200);expect(await page.evaluate(()=>GAME.state.phase)).toBe(13);
});

for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  test(`fresh start fits the viewport at ${viewport.width}x${viewport.height}`,async({page})=>{
    await page.setViewportSize(viewport);await page.goto('/');
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    await page.getByRole('button',{name:'Find Work'}).click();
    if(await page.locator('#rotate-overlay').isVisible())await page.locator('#btn-rotate-continue').click();
    await expect(page.getByRole('button',{name:'Do Task',exact:true})).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    await page.screenshot({path:`test-results/start-${viewport.width}.png`});
  });
}
test('early upgrade visibility follows task milestones and prior purchases',async({page})=>{
  const h=harness();const g=h.fresh();g.cash=1e6;g.totalTasksDone=149;h.prepareUpgrade('free_ai');h.api.checkMilestones();h.dismiss();g.lastTick=Date.now();g.lastSave=g.lastTick;const raw=JSON.stringify(g);h.close();
  await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  const buy=id=>page.locator('[onclick="GAME.buy(\''+id+'\')"]');await expect(buy('free_ai')).toHaveCount(0);
  await page.evaluate(()=>GAME.addTasks(1));await expect(buy('free_ai')).toBeVisible();await buy('free_ai').click();await expect(buy('prompt_basics')).toHaveCount(0);await expect(buy('pro_model')).toHaveCount(0);
  await page.evaluate(()=>GAME.addTasks(49));await expect(buy('prompt_basics')).toHaveCount(0);await page.evaluate(()=>GAME.addTasks(1));await expect(buy('prompt_basics')).toBeVisible();await expect(buy('prompt_examples')).toBeVisible();
});

for(const width of [1440,390]) {
  test(`AI subscriptions keep matching bars and buttons through licensing at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});const h=harness();const g=h.fresh(3);g.cash=1e6;g.tokens=200;g.totalTasksDone=800;h.prepareUpgrade('second_ai');h.api.purchaseUpgrade('second_ai');h.api.checkMilestones();h.dismiss();g.lastTick=Date.now();const raw=JSON.stringify(g);h.close();
    await page.addInitScript(value=>{localStorage.setItem('ai_empire_save',value);sessionStorage.setItem('rotate_dismissed','1')},raw);await page.goto('/');
    if(await page.locator('#rotate-overlay').isVisible())await page.locator('#btn-rotate-continue').click();
    for(const phase of [3,4]){
      if(phase===4)await expect(page.locator('#agent-list').getByRole('button',{name:'Sell'})).toHaveCount(2);
      const cards=page.locator('#agent-list .agent-card');await expect(cards).toHaveCount(2);await expect(cards.nth(0).locator('.name')).toHaveText('AI 2000 Free');await expect(cards.nth(1).locator('.name')).toHaveText('AI 2000 Pro');
      const bars=await cards.locator('.task-bar').all();const first=await bars[0].boundingBox();const second=await bars[1].boundingBox();expect(first.width).toBe(second.width);
      const counts=await cards.locator('.agent-token-count').all();expect((await counts[0].boundingBox()).x).toBe(first.x);expect((await counts[1].boundingBox()).x).toBe(second.x);
      const buttons=cards.getByRole('button',{name:'Top-up tokens'});expect((await buttons.nth(0).boundingBox()).width).toBe((await buttons.nth(1).boundingBox()).width);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/phase${phase}-agents-${width}.png`,fullPage:true});
      if(phase===3)await page.locator('[onclick="GAME.buy(\'multi_bot\')"]').click();
    }
  });
}
test('DevOps sits in Incidents and management cards stand out',async({page})=>{
  const raw=fixture(8);await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  await expect(page.locator('#incident-devops .agent-card')).toContainText('DevOps');await expect(page.locator('#agent-list')).not.toContainText('DevOps');
  const colors=await page.locator('.management-agent').evaluateAll(cards=>cards.map(card=>getComputedStyle(card).backgroundColor));expect(colors).toEqual(['rgb(26, 38, 56)','rgb(26, 38, 56)']);
  await page.screenshot({path:'test-results/management-and-devops.png',fullPage:true,animations:'disabled'});
});
test('empty upgrades retain a blank card of space above token packs',async({page})=>{
  const h=harness(fixture(9));const g=h.window.GAME.state;g.clusters[0].workerAgentIds.pop();g.lastTick=Date.now();const raw=JSON.stringify(g);h.close();
  await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  await expect(page.locator('#upgrade-list .upgrade-space')).toBeVisible();expect((await page.locator('#upgrade-list .upgrade-space').boundingBox()).height).toBeGreaterThanOrEqual(88);await expect(page.locator('#upgrade-list')).not.toContainText('No upgrades');
});
test('CEO scaling displays filled and vacant slots alongside hiring upgrades',async({page})=>{
  const h=harness(fixture(10));const g=h.window.GAME.state;g.clusters[2].workerAgentIds.splice(4);g.purchasedUpgrades=g.purchasedUpgrades.filter(id=>!['ceo_recruitment','ceo_batch'].includes(id));g.lastTick=Date.now();g.lastCeoAction=g.lastTick;const raw=JSON.stringify(g);h.close();
  await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  const cluster=page.locator('div.cluster-card').nth(2);await expect(cluster.locator('.cluster-status')).toHaveText('Scaling');await expect(cluster.locator('.capacity-slot.filled')).toHaveCount(4);await expect(cluster.locator('.capacity-slot.empty')).toHaveCount(4);await expect(cluster).not.toContainText('4/8');
  await expect(page.locator('[onclick="GAME.buy(\'ceo_recruitment\')"]')).toBeVisible();await page.screenshot({path:'test-results/ceo-scaling.png',fullPage:true,animations:'disabled'});
});

for(const width of [1440,390]){
  test(`company leadership and next cluster card fit at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});const raw=fixture(12);await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
    if(await page.locator('#rotate-overlay').isVisible())await page.locator('#btn-rotate-continue').click();
    await expect(page.locator('.company-leadership .leadership-agent')).toHaveCount(2);await expect(page.locator('.company-leadership')).toContainText('AI CEO');await expect(page.locator('.company-leadership')).toContainText('Token Manager');await expect(page.locator('.company-leadership')).toContainText('tok/s');
    const card=page.locator('.provision-card');await expect(card).toHaveCount(1);expect(await card.evaluate(el=>el.parentElement.classList.contains('node-grid'))).toBe(true);await card.scrollIntoViewIfNeeded();await card.focus();await page.keyboard.press('Enter');await expect(page.locator('.node-grid div.cluster-card')).toHaveCount(101);
    await expect(page.locator('#delivery-summary')).toBeVisible();await expect(page.locator('#task-list')).toBeHidden();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('.company-leadership').screenshot({path:`test-results/leadership-${width}.png`});await page.locator('.provision-card').screenshot({path:`test-results/provision-${width}.png`});
  });
}
test('delivery details can be opened and collapsed without losing keyboard focus',async({page})=>{
  const h=harness(fixture(10));const g=h.window.GAME.state;g.agentSpeedMult=.00001;h.task();g.lastTick=Date.now();const raw=JSON.stringify(g);h.close();await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  await expect(page.locator('#delivery-summary')).toContainText('completed / min');await expect(page.locator('#task-list')).toBeHidden();const toggle=page.locator('#delivery-summary button');await toggle.focus();await page.keyboard.press('Enter');await expect(page.locator('#task-list')).toBeVisible();await expect(toggle).toHaveText('Hide tasks');await page.waitForTimeout(300);await expect(toggle).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#task-list')).toBeHidden();await expect(toggle).toHaveText('Show tasks');await page.screenshot({path:'test-results/compact-delivery.png',fullPage:true,animations:'disabled'});
});
