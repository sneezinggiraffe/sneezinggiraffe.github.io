const { test, expect } = require('@playwright/test');
const { harness } = require('../harness.cjs');

for (const [phase, capacity] of [[11, 2], [11, 4], [13, 2]]) {
  test(`Phase ${phase} keeps ${capacity} provisioning slots staggered through real renders and reload`, async ({page}) => {
    const h = harness();
    const g = h.fresh(phase);
    g.ceoMode = phase === 11 ? 'manage' : 'scale';
    g.cash = 1e12;
    g.tokens = 1e9;
    g.totalTasksDone = 2e6;
    g.aiWorkerShutdown = true;
    g.incidentsExplained = true;
    g.purchasedUpgrades.push('ceo_batch');
    if (capacity === 4) g.purchasedUpgrades.push('ceo_quad_batch');
    if (phase === 13) {
      g.purchasedUpgrades.push('ceo_full_fit', 'ceo_continuous', 'ceo_parallel_clusters');
      h.fullCluster();
    } else {
      for (let index = 0; index < 2; index++) {
        const cluster = h.api.addClusterWithNextName();
        cluster.managerAssigned = true;
        cluster.tokenManagerAssigned = true;
      }
    }
    h.api.checkMilestones();
    h.dismiss();
    g.lastTick = Date.now();
    g.lastTaskSpawn = g.lastTick + 1e9;
    const raw = JSON.stringify(g);
    h.close();
    await page.clock.install({time: new Date(g.lastTick)});
    await page.clock.pauseAt(new Date(g.lastTick + 1000));
    await page.addInitScript(value => {
      if (!sessionStorage.getItem('pipeline_seeded')) {
        localStorage.setItem('ai_empire_save', value);
        sessionStorage.setItem('pipeline_seeded', '1');
      }
    }, raw);
    await page.goto('/');
    await page.clock.runFor(200);
    const remaining = phase === 11 ? 'provisionRemaining' : 'buildRemaining';
    const duration = phase === 11 ? 'provisionDuration' : 'buildDuration';
    const snapshot = await page.evaluate(({phase, remaining, duration}) => {
      window.dispatchEvent(new Event('pagehide'));
      return (phase === 11 ? GAME.state.agents : GAME.state.clusters).filter(job => job[remaining] > 0).map(job => ({id: job.id, remaining: job[remaining], duration: job[duration]}));
    }, {phase, remaining, duration});
    expect(snapshot).toHaveLength(capacity);
    expect(snapshot.some(job => job.remaining > job.duration)).toBe(true);
    await page.reload();
    expect(await page.evaluate(({phase, remaining}) => (phase === 11 ? GAME.state.agents : GAME.state.clusters).filter(job => job[remaining] > 0).map(job => job[remaining]), {phase, remaining})).toEqual(snapshot.map(job => job.remaining));
    const completed = new Map();
    let refilledIndependently = false;
    for (let frame = 1; frame <= 70; frame++) {
      await page.clock.runFor(200);
      const state = await page.evaluate(({phase, remaining, ids}) => {
        const jobs = phase === 11 ? GAME.state.agents : GAME.state.clusters;
        const selector = phase === 11 ? '.capacity-slot.provisioning' : '[aria-label="Cluster construction"]';
        return {
          active: jobs.filter(job => job[remaining] > 0).length,
          cohort: ids.map(id => jobs.find(job => job.id === id)[remaining]),
          count: jobs.length,
          bars: [...document.querySelectorAll(selector)].map(bar => Number(bar.getAttribute('aria-valuenow'))),
        };
      }, {phase, remaining, ids: snapshot.map(job => job.id)});
      expect(state.active).toBeLessThanOrEqual(capacity);
      expect(state.bars.every(progress => progress >= 0 && progress <= 100)).toBe(true);
      if (frame === 7) expect(new Set(state.bars).size).toBe(capacity);
      snapshot.forEach((job, index) => {
        if (state.cohort[index] === 0 && !completed.has(job.id)) completed.set(job.id, frame);
      });
      if (state.cohort[0] === 0 && state.cohort[1] > 0) {
        expect(state.active).toBe(capacity);
        expect(state.count).toBeGreaterThan(phase === 11 ? capacity : capacity + 1);
        refilledIndependently = true;
      }
    }
    expect(completed.size).toBe(capacity);
    expect(new Set(completed.values()).size).toBe(capacity);
    expect(refilledIndependently).toBe(true);
  });
}

test('Ralph-loops and Scale Mode skip modals and the operating model uses the new price and copy', async ({page}) => {
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => { chPh9(); GAME.addCash(200000); });
  await page.clock.runFor(200);
  const loops = page.locator('[onclick="GAME.buy(\'ops_flywheel\')"]');
  await expect(loops.locator('..').locator('..')).toContainText('Ralph-loops');
  await expect(loops.locator('..').locator('..').locator('.desc')).toHaveText('Agents work for longer and check their work.');
  await loops.click();
  expect(await page.evaluate(() => GAME.state.phase)).toBe(9);
  await expect(page.locator('#milestone-popup')).toBeHidden();
  expect(await page.evaluate(() => {
    chPh12();
    return { cash: GAME.state.cash, tasks: GAME.state.totalTasksDone, clusters: GAME.state.clusters.length };
  })).toEqual({ cash: 180000000, tasks: 27000000, clusters: 5 });
  await page.clock.runFor(200);
  await expect(page.locator('[onclick="GAME.buy(\'server_1\')"]')).toBeDisabled();
  await page.evaluate(() => GAME.addCash(20000000));
  await page.clock.runFor(200);
  await page.locator('[onclick="GAME.buy(\'server_1\')"]').click();
  expect(await page.evaluate(() => GAME.state.phase)).toBe(12);
  await expect(page.locator('#milestone-popup')).toBeHidden();
  await page.evaluate(() => { GAME.addCash(2e9); GAME.addTasks(2e6); });
  await page.clock.runFor(200);
  for (const id of ['ceo_quad_batch', 'ceo_parallel_clusters', 'ceo_fast_builds', 'server_2', 'ceo_course', 'ceo_full_fit']) {
    await page.locator('[onclick="GAME.buy(\'' + id + '\')"]').click();
    await page.clock.runFor(200);
  }
  await page.clock.runFor(200);
  const model = page.locator('[onclick="GAME.buy(\'autonomous_nodes\')"]');
  await expect(model).toHaveText('$760.00M');
  await model.click();
  expect(await page.evaluate(() => GAME.state.phase)).toBe(13);
  await expect(page.locator('#milestone-popup')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Running an Autonomous Network', exact: true })).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`late Phase 9 offers two improvements before acquisition at ${width}px`, async ({page}) => {
    const h = harness(fixture(9));
    const g = h.window.GAME.state;
    g.purchasedUpgrades = g.purchasedUpgrades.filter(id => !['project_playbooks', 'account_expansion'].includes(id));
    g.cash = 5e6;
    g.totalTasksDone = 720000;
    g.lastTick = Date.now();
    g.lastTaskSpawn = g.lastTick + 1e6;
    const raw = JSON.stringify(g);
    h.close();
    await page.setViewportSize({width, height: 900});
    await page.clock.install({time: new Date(g.lastTick)});
    await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw);
    await page.goto('/');

    const playbooks = page.locator('[onclick="GAME.buy(\'project_playbooks\')"]');
    const accounts = page.locator('[onclick="GAME.buy(\'account_expansion\')"]');
    const acquisition = page.locator('[onclick="GAME.buy(\'acquire_micro_agency\')"]');
    await expect(playbooks).toBeVisible();
    await expect(playbooks).toHaveText('$750.0K');
    await expect(accounts).toHaveCount(0);
    await expect(acquisition).toHaveCount(0);
    await page.evaluate(() => GAME.addTasks(140000));
    await page.clock.runFor(200);
    await expect(accounts).toBeVisible();
    await expect(accounts).toHaveText('$1.25M');
    await page.locator('#upgrade-list').screenshot({path: `test-results/phase8-upgrades-${width}.png`});
    await playbooks.click();
    await page.clock.runFor(200);
    await accounts.click();
    await page.evaluate(() => GAME.addTasks(140000));
    await page.clock.runFor(200);
    await expect(acquisition).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await acquisition.click();
    expect(await page.evaluate(() => GAME.state.phase)).toBe(10);
  });

  test(`opening checkpoints reveal their upgrade groups at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await page.goto('/');
    const groups = [
      ['0_2', 7, ['Hire a Part-Time Assistant', 'Gas Station Coffee', 'A Box Of Paperclips']],
      ['0_', 35, ['Side Hustle Optimization', 'Multitasking', 'Inbox Zero Method']],
      ['0_4', 100, []],
    ];
    for (const [stage, tasks, names] of groups) {
      await page.evaluate(value => GAME.cheat(value), stage);

      await expect(page.locator('#milestone-popup')).toBeHidden();
      expect(await page.evaluate(() => GAME.state.totalTasksDone)).toBe(tasks);
      await expect(page.locator('#upgrade-list .upgrade-card')).toHaveCount(names.length);
      for (const name of names) await expect(page.locator('#upgrade-list')).toContainText(name);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    const freeAi = page.getByRole('button', { name: '150 tasks', exact: true });
    await expect(freeAi).toHaveCount(0);
    await page.screenshot({ path: `test-results/free-ai-checkpoint-${width}.png`, fullPage: true });
    await page.evaluate(() => GAME.addTasks(50));
    await page.clock.runFor(200);
    await expect(freeAi).toBeEnabled();
    await freeAi.click();
    expect(await page.evaluate(() => GAME.state.phase)).toBe(2);
  });

  test(`Client Outreach and Second AI Subscription stay visible together at ${width}px`, async ({ page }) => {
    const h = harness();
    const g = h.fresh(3);
    g.totalTasksDone = 650;
    g.cash = 23000;
    h.prepareUpgrade('client_outreach');
    h.api.checkMilestones();
    h.dismiss();
    g.lastTick = Date.now();
    g.lastTaskSpawn = g.lastTick;
    const raw = JSON.stringify(g);
    h.close();
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date(g.lastTick) });
    await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw);
    await page.goto('/');

    const outreach = page.locator('[onclick="GAME.buy(\'client_outreach\')"]');
    const second = page.locator('[onclick="GAME.buy(\'second_ai\')"]');
    await expect(outreach).toBeVisible();
    await expect(second).toBeVisible();
    await expect(second).toBeDisabled();
    await outreach.click();
    await page.clock.runFor(200);
    await expect(second).toBeVisible();
    await expect(second).toBeEnabled();
    await second.click();
    await page.clock.runFor(200);
    await expect(page.locator('#agent-list .agent-card')).toHaveCount(2);
    await expect(page.locator('#agent-list')).toContainText('AI 2000 Pro');
    expect(await page.evaluate(() => GAME.state.taskSpawnMult)).toBe(2);
  });
}

for (const width of [1440, 390]) {
  test(`manual cluster slots require separate purchases and retain visible upgrades at ${width}px`, async ({ page }) => {
    const h = harness(fixture(10));
    const g = h.window.GAME.state;
    g.cash = 1e9;
    g.purchasedUpgrades = g.purchasedUpgrades.filter(id => !['testing', 'code_review'].includes(id));
    g.lastTick = Date.now();
    g.lastSave = g.lastTick;
    g.lastTaskSpawn = g.lastTick + 1e6;
    g.tasks = [];
    const raw = JSON.stringify(g);
    h.close();
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date(g.lastTick) });
    await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw);
    await page.goto('/');

    const upgrade = page.locator('[onclick="GAME.buy(\'testing\')"]');
    await expect(upgrade).toBeVisible();
    await page.getByRole('button', { name: /Bring cluster online/ }).click();
    await page.clock.runFor(200);
    await expect(page.locator('#task-list')).toBeHidden();
    await expect(upgrade).toBeVisible();
    await expect(upgrade).toBeDisabled();
    await page.clock.runFor(12200);
    const cluster = page.locator('.cluster-card:not(.provision-card)').first();
    const slots = cluster.locator('.capacity-slot');
    await expect(slots).toHaveCount(8);
    await expect(slots.last()).toHaveText('+');
    await expect(slots.last()).toBeDisabled();
    await slots.last().evaluate(button => button.click());
    expect(await page.evaluate(() => GAME.state.clusters[1].workerAgentIds.length)).toBe(0);
    for (let index = 0; index < 8; index++) {
      await slots.nth(index).click();
      await page.clock.runFor(200);
      expect(await page.evaluate(() => GAME.state.clusters[1].workerAgentIds.length)).toBe(index + 1);
    }
    await page.clock.runFor(4200);
    const names = await page.evaluate(() => GAME.state.clusters[1].workerAgentIds.map(id => GAME.state.agents.find(agent => agent.id === id).name));
    expect(await slots.allTextContents()).toEqual(names);
    expect(new Set(names).size).toBe(8);
    await expect(upgrade).toBeEnabled();
    const sell = cluster.locator('.cluster-hdr').getByRole('button', { name: 'Sell', exact: true });
    await expect(sell).toBeVisible();
    await cluster.screenshot({ path: `test-results/manual-cluster-${width}.png` });
    await sell.click();
    await page.clock.runFor(200);
    expect(await page.evaluate(() => GAME.state.clusters.length)).toBe(1);
  });

  test(`CEO capacity upgrades follow auto-fill and keep agent names consistent at ${width}px`, async ({ page }) => {
    const h = harness();
    const g = h.fresh(11);
    g.cash = 1e9;
    g.totalTasksDone = 2e6;
    h.prepareUpgrade('ai_ceo');
    for (let index = 0; index < 3; index++) h.fullCluster();
    h.api.checkMilestones();
    h.dismiss();
    g.lastTick = Date.now();
    g.lastSave = g.lastTick;
    g.lastTaskSpawn = g.lastTick + 1e6;
    const raw = JSON.stringify(g);
    h.close();
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date(g.lastTick) });
    await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw);
    await page.goto('/');

    const card = page.locator('[data-cluster-id="' + g.clusters[0].id + '"]');
    await expect(card.locator('.capacity-slot')).toHaveCount(8);
    await expect(page.locator('[onclick="GAME.buy(\'network_density\')"]')).toHaveCount(0);
    await page.locator('.ceo-slot').click();
    await page.clock.runFor(200);
    await expect(card.locator('.capacity-slot')).toHaveCount(8);
    await page.locator('[onclick="GAME.buy(\'network_density\')"]').click();
    await page.clock.runFor(200);
    await expect(card.locator('.capacity-slot')).toHaveCount(9);
    await expect(card.locator('.capacity-slot.provisioning')).toBeVisible();
    expect(await card.locator('.cluster-capacity').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(3);
    const names = await page.evaluate(() => GAME.state.clusters[0].workerAgentIds.map(id => GAME.state.agents.find(agent => agent.id === id)).filter(agent => agent.status !== 'provisioning').map(agent => agent.name));
    expect(await card.locator('.capacity-slot.filled').allTextContents()).toEqual(names);
    await card.screenshot({ path: `test-results/cluster-nine-${width}.png` });
    await page.locator('[onclick="GAME.buy(\'ceo_deploy_speed\')"]').click();
    await page.clock.runFor(200);
    await page.locator('[onclick="GAME.buy(\'cluster_capacity_16\')"]').click();
    await page.clock.runFor(200);
    await expect(card.locator('.capacity-slot')).toHaveCount(16);
    expect(await card.locator('.cluster-capacity').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`planning cards and the immediate retirement cheat work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      const NativeAudio = window.Audio;
      window.testAudioPlayers = [];
      window.Audio = function () {
        const player = new NativeAudio();
        window.testAudioPlayers.push(player);
        return player;
      };

    });
    await page.clock.install();
    await page.goto('/');
    await page.evaluate(() => chPh15());

    const planning = page.locator('.planning-card');
    await expect(planning).toBeVisible();
    await expect(planning).toContainText('Planning');
    expect(await planning.getAttribute('onclick')).toBeNull();
    await expect(planning.locator('button')).toHaveCount(0);
    await planning.screenshot({ path: `test-results/planning-${width}.png` });
    await page.evaluate(() => chRetire());
    const parachute = page.locator('[onclick="GAME.buy(\'fusion\')"]');
    await expect(parachute).toBeEnabled();
    await expect(parachute).toHaveText('$5.00B');
    await expect(page.locator('.upgrade-cost')).toHaveCount(0);
    await parachute.click();
    await page.clock.runFor(2800);
    await expect(page.getByRole('heading', { name: 'You retired early!' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.testAudioPlayers.some(player => player.src.endsWith('/soundtrack-loop.mp3') && !player.paused))).toBe(true);
    expect(await page.evaluate(() => window.testAudioPlayers.filter(player => !player.src.endsWith('/soundtrack-loop.mp3')).every(player => player.paused))).toBe(true);
    expect(await page.evaluate(() => GAME.state.totalTasksDone)).toBeGreaterThanOrEqual(1e9);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/retirement-cheat-${width}.png`, fullPage: true });
  });
}

function fixture(phase) {
  const h=harness();const g=h.fresh(phase);g.cash=1e11;g.tokens=50000;g.totalTasksDone=2000000;g.managerTokenTank=4000;g.managerUnlock=true;g.aiWorkerShutdown=phase>=5;g.payMult=10;
  h.api.purchaseUpgrade('tools_of_trade');
  g.purchasedUpgrades=h.api.UPGRADES.filter(u=>u.oneTime&&u.phase<=phase&&(!u.unlockPhase||u.unlockPhase<=phase)&&u.id!=='fusion').map(u=>u.id);
  g.ceoMode=phase>=12?'scale':phase>=11?'manage':'off';
  if(phase>=10)for(let n=0;n<(phase>=13?100:phase>=11?3:1);n++){const c=h.fullCluster();c.tank=4000;}
  if(phase<10){h.worker('manager');h.worker('token_mgr');h.worker('devops');}
  g.replicationTarget=109;g.services=[{id:'service',name:'Service',incomeRate:1000,active:true}];g.serviceSlots=1;
  h.api.checkMilestones();h.dismiss();g.lastTick=Date.now();g.lastSave=g.lastTick;g.lastCeoAction=g.lastTick;g.incidentsExplained=true;
  const raw=JSON.stringify(g);h.close();return raw;
}

test('Phase 6 adds two D4 and F4 phrases per bar with quiet chorus and reverb', async ({page}) => {
  const raw = fixture(5);
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
  expect(await page.evaluate(() => GAME.state.phase)).toBe(6);
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

  await expect(page.locator('#milestone-popup')).toBeHidden();
  await page.locator('#btn-settings').click();
  const musicButton = page.locator('#btn-settings-music');
  await expect(musicButton).toHaveText('Music: On');
  await musicButton.click();
  await expect(musicButton).toHaveText('Music: Off');
  expect(await page.evaluate(() => window.testAudioPlayers.every(player => player.paused))).toBe(true);
  await musicButton.click();
  await expect(musicButton).toHaveText('Music: On');
  expect(await page.evaluate(() => window.testAudioPlayers.filter(player => !player.paused).length)).toBe(3);
});

test('DnB uses the original fast drums with a broad hook in one seamless premix', async ({page}) => {
  const raw = fixture(8);
  await page.clock.install();
  await page.addInitScript(value => {
    localStorage.setItem('ai_empire_save', value);
    const NativeAudio = window.Audio;
    window.testAudioPlayers = [];
    window.testDnbStart = null;
    window.testDnbReady = false;
    window.Audio = function () {
      const player = new NativeAudio();
      player.addEventListener('canplay', () => {
        if (player.src.endsWith('/dnb_synth_loop.wav')) {
          window.testDnbReady = true;
        }
      }, { once: true });
      player.addEventListener('playing', () => {
        if (player.src.endsWith('/dnb_synth_loop.wav')) window.testDnbStart = player.currentTime;
      }, { once: true });
      window.testAudioPlayers.push(player);
      return player;
    };
  }, raw);
  await page.goto('/');
  await page.locator('#btn-settings').click();
  await page.keyboard.press('Escape');
  await page.clock.runFor(11000);
  await expect.poll(() => page.evaluate(() => {
    const kick = window.testAudioPlayers.find(player => player.src.endsWith('/precursor_kick.mp3'));
    return kick.readyState >= 2 && !kick.paused;
  })).toBe(true);
  const transition = await page.evaluate(() => {
    const synth = window.testAudioPlayers.find(player => player.src.endsWith('/synth_d4_loop.mp3'));
    const synthTime = synth.currentTime;
    GAME.buy('ops_flywheel');
    return { phase: GAME.state.phase, synthTime, synthAfter: synth.currentTime };
  });
  expect(transition.phase).toBe(9);
  expect(transition.synthAfter).toBeCloseTo(transition.synthTime, 2);
  await expect.poll(() => page.evaluate(() => window.testDnbReady)).toBe(true);
  await page.clock.runFor(2500);
  await expect.poll(() => page.evaluate(() => window.testDnbStart)).not.toBeNull();
  expect(await page.evaluate(() => window.testDnbStart)).toBeLessThan(0.05);
  await page.clock.runFor(6400);
  await expect.poll(() => page.evaluate(() => {
    const dnb = window.testAudioPlayers.find(player => player.src.endsWith('/dnb_synth_loop.wav'));
    const kick = window.testAudioPlayers.find(player => player.src.endsWith('/precursor_kick.mp3'));
    const synth = window.testAudioPlayers.find(player => player.src.endsWith('/synth_d4_loop.mp3'));
    return { playing: !dnb.paused, ready: dnb.readyState >= 2, loop: dnb.loop, volume: dnb.volume, outgoingPaused: kick.paused, standaloneStopped: synth.paused && synth.volume === 0, error: dnb.error };
  })).toEqual({ playing: true, ready: true, loop: true, volume: 0.18, outgoingPaused: true, standaloneStopped: true, error: null });

  const audio = await page.evaluate(async () => {
    const context = new AudioContext();
    const decode = async path => context.decodeAudioData(await (await fetch(path)).arrayBuffer());
    const mixed = await decode('dnb_synth_loop.wav');
    const original = await decode('dnb_deep_loop.mp3');
    const earlySynth = await decode('synth_d4_loop.mp3');
    await context.close();
    const samples = mixed.getChannelData(0);
    const reference = original.getChannelData(0);
    const beat = 60 / 172;
    const offset = Math.round(16 * beat * mixed.sampleRate);
    const rms = (first, last) => {
      let energy = 0;
      for (let index = first; index < last; index++) energy += samples[index] ** 2;
      return Math.sqrt(energy / (last - first));
    };
    const power = (signal, onset, frequency) => {
      const first = Math.round((onset + 0.025) * mixed.sampleRate);
      const last = Math.round((onset + 0.105) * mixed.sampleRate);
      let real = 0;
      let imaginary = 0;
      for (let index = first; index < last; index++) {
        const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * (index - first) / (last - first - 1));
        const phase = 2 * Math.PI * frequency * index / mixed.sampleRate;
        real += signal[index] * window * Math.cos(phase);
        imaginary += signal[index] * window * Math.sin(phase);
      }
      return real ** 2 + imaginary ** 2;
    };
    const notes = [];
    const rests = [];
    for (let bar = 0; bar < 16; bar++) {
      for (const position of [0, 0.5, 1.5, 2.5, 3]) {
        const onset = (bar * 4 + position) * beat + 0.012;
        notes.push({
          d: power(samples, onset, 293.665),
          f: power(samples, onset, 349.228),
          originalD: power(reference, onset + offset / mixed.sampleRate, 293.665),
          originalF: power(reference, onset + offset / mixed.sampleRate, 349.228),
        });
      }
      for (const position of [1, 2, 3.5]) rests.push(power(samples, (bar * 4 + position) * beat + 0.012, 349.228));
    }
    const lowpass = signal => {
      const result = new Float32Array(signal.length);
      const coefficient = 1 - Math.exp(-2 * Math.PI * 550 / mixed.sampleRate);
      let value = 0;
      for (let index = 0; index < signal.length; index++) {
        value += coefficient * (signal[index] - value);
        result[index] = value;
      }
      return result;
    };
    const mixedLow = lowpass(samples);
    const referenceLow = lowpass(reference);
    let correlation = -1;
    for (const shift of [-24, -16, -8, 0, 8, 16, 24]) {
      let product = 0;
      let mixedEnergy = 0;
      let originalEnergy = 0;
      for (let index = Math.floor(mixed.sampleRate * 0.1); index < samples.length - mixed.sampleRate * 0.1; index += 8) {
        const a = mixedLow[index];
        const b = referenceLow[index + offset + shift];
        product += a * b;
        mixedEnergy += a ** 2;
        originalEnergy += b ** 2;
      }
      correlation = Math.max(correlation, product / Math.sqrt(mixedEnergy * originalEnergy));
    }
    let differences = 0;
    const edgeSamples = Math.floor(mixed.sampleRate * 0.02);
    for (let index = 1; index < edgeSamples; index++) differences += (samples[index] - samples[index - 1]) ** 2;
    return {
      duration: mixed.duration,
      playbackDuration: window.testAudioPlayers.find(player => player.src.endsWith('/dnb_synth_loop.wav')).duration,
      earlyPhraseDuration: earlySynth.duration / 8,
      correlation,
      notes,
      rests,
      seamJump: Math.abs(samples[0] - samples[samples.length - 1]),
      normalStep: Math.sqrt(differences / (edgeSamples - 1)),
      head: rms(0, Math.floor(mixed.sampleRate * beat * 4)),
      tail: rms(samples.length - Math.floor(mixed.sampleRate * beat * 4), samples.length),
      overall: rms(0, samples.length),
    };
  });
  expect(audio.duration).toBeCloseTo(16 * 4 * 60 / 172, 3);
  expect(Math.abs(audio.playbackDuration - audio.duration)).toBeLessThan(0.002);
  expect(audio.duration / 16).toBeGreaterThan(audio.earlyPhraseDuration);
  expect(audio.correlation).toBeGreaterThan(0.85);
  expect(audio.seamJump).toBeLessThan(audio.normalStep * 4);
  expect(audio.head).toBeGreaterThan(audio.overall * 0.6);
  expect(audio.tail).toBeGreaterThan(audio.overall * 0.6);
  expect(audio.notes).toHaveLength(80);
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  expect(mean(audio.notes.map(note => note.d))).toBeGreaterThan(mean(audio.notes.map(note => note.originalD)) * 1.2);
  expect(mean(audio.notes.map(note => note.f))).toBeGreaterThan(mean(audio.notes.map(note => note.originalF)) * 3);
  expect(mean(audio.notes.map(note => note.f))).toBeGreaterThan(mean(audio.rests) * 3);
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
    await page.setViewportSize(viewport);const raw=fixture(10);
    await page.addInitScript(value=>{localStorage.setItem('ai_empire_save',value);},raw);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
    await expect(page.locator('#section-clusters')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#section-log').scrollIntoViewIfNeeded();await expect(page.locator('#section-log')).toBeInViewport();
    await page.locator('#cluster-list button').first().scrollIntoViewIfNeeded();await page.locator('#cluster-list button').first().focus();
    await page.waitForTimeout(300);await expect(page.locator('#cluster-list button').first()).toBeFocused();
    await page.screenshot({path:`test-results/phase9-${viewport.width}.png`,fullPage:true});expect(errors).toEqual([]);
  });
}
test('sale opens a separate retirement screen, then permanent retirement survives reload',async({page})=>{
  const raw=fixture(16);await page.addInitScript(value=>{if(!sessionStorage.getItem('ending_seeded')){localStorage.setItem('ai_empire_save',value);sessionStorage.setItem('ending_seeded','1')}},raw);
  page.on('dialog',dialog=>dialog.accept());await page.goto('/');await page.locator('[onclick="GAME.buy(\'fusion\')"]').click();
  await expect(page.getByRole('heading',{name:'You retired early!'})).toBeVisible();await expect(page.locator('#game-container')).toBeHidden();await expect(page.locator('#top-bar')).toBeHidden();
  await expect(page.locator('#btn-ending-restart')).toBeFocused();const balance=await page.evaluate(()=>GAME.state.cash);await page.waitForTimeout(300);expect(await page.evaluate(()=>GAME.state.cash)).toBe(balance);
  await page.reload();await expect(page.getByRole('heading',{name:'You retired early!'})).toBeVisible();await page.screenshot({path:'test-results/retire-early.png'});
  await page.getByRole('button',{name:'Actually retire',exact:true}).click();await expect(page.getByRole('heading',{name:'No more tasks.'})).toBeFocused();await expect(page.locator('#ending-choices')).toBeHidden();
  await page.reload();await expect(page.getByRole('heading',{name:'No more tasks.'})).toBeVisible();await expect(page.locator('#btn-ending-reset')).toBeFocused();await page.screenshot({path:'test-results/ending.png'});
  await page.evaluate(()=>localStorage.setItem('unrelated-app','keep'));await page.getByRole('button',{name:'Start a new story'}).click();await expect(page.getByRole('button',{name:'Find Work'})).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('unrelated-app'))).toBe('keep');
});
test('another model restarts from the retirement screen with earned bonuses',async({page})=>{
  await page.setViewportSize({width:390,height:844});const raw=fixture(16);await page.addInitScript(value=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('ai_empire_save',value);sessionStorage.setItem('seeded','1')}},raw);await page.goto('/');

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
  await page.setViewportSize({width:390,height:844});const raw=fixture(15);
  await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');

  await expect(page.locator('.network-grid div.cluster-card:not(.planning-card)')).toHaveCount(100);await expect(page.locator('.network-grid div.cluster-card:not(.planning-card) button')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.neocloud-list').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/network-100-mobile.png',fullPage:true});expect(errors).toEqual([]);
});
test('clusters build hardware and management before slots provision agents',async({page})=>{
  await page.clock.install();const raw=fixture(10);await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  await page.getByRole('button',{name:/Bring cluster online/}).click();const second=page.locator('div.cluster-card:not(.planning-card)').first();await expect(second.locator('.cluster-hdr strong')).toHaveText('Cluster 2');const firstBox=await page.locator('div.cluster-card:not(.planning-card)').nth(1).boundingBox();const secondBox=await second.boundingBox();expect(secondBox.x).toBeLessThan(firstBox.x);expect(secondBox.y).toBe(firstBox.y);
  for(const stage of ['Procuring GPUs','Racking hardware','Installing software','Final checks']){await page.clock.runFor(100);await expect(second).toContainText(stage);await expect(second.getByRole('progressbar')).toBeVisible();await page.clock.runFor(2900);}
  await page.clock.runFor(300);await expect(second.getByRole('button',{name:'Provision agent for $2,500',exact:true})).toHaveCount(8);await expect(second.locator('.cluster-status')).toHaveText('Needs Agents');await expect(second.locator('.cluster-agents-label')).toHaveCount(0);
  await expect(second.locator('.cluster-status')).toHaveCSS('color', 'rgb(135, 71, 0)');await second.getByRole('button',{name:'Provision agent for $2,500',exact:true}).first().click();await page.clock.runFor(2000);await expect(second.locator('[aria-label="Provisioning agent"]')).toBeVisible();await expect(second.locator('.cluster-status')).toHaveText('Installing agents');await page.clock.runFor(2200);await expect(second.locator('.capacity-slot.filled')).toHaveCount(1);expect(await second.locator('.capacity-slot.filled').textContent()).toBe(await page.evaluate(() => GAME.state.agents.find(agent => agent.id === GAME.state.clusters[1].workerAgentIds[0]).name));await expect(second.locator('.cluster-status')).toHaveText('Partially Operational');
  await expect(page.locator('#cluster-list')).not.toContainText('management team');await page.screenshot({path:'test-results/phase9-grid.png',fullPage:true});
});
test('Phase 9 workers are managed and refill only at ten percent', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => {
    chStart9();
    GAME.state.aiFailMult = 0;
    GAME.state.tasks = [];
    GAME.state.lastTaskSpawn = Date.now() + 1e9;
    GAME.state.agents.filter(agent => !['manager', 'token_mgr', 'devops'].includes(agent.roleId)).forEach(agent => { agent.tokenTank = agent.olderModel ? 20 : 750; });
  });
  await page.clock.runFor(200);
  await expect(page.locator('#section-stats')).toBeHidden();
  await expect(page.locator('#agent-list .agent-stat')).toHaveCount(0);
  const workers = page.locator('#agent-list .agent-card').filter({ has: page.locator('.agent-managed[role="status"]') });
  const count = await workers.count();
  expect(count).toBeGreaterThan(0);
  for (const worker of await workers.all()) {
    await expect(worker.locator('.agent-managed[role="status"]')).toHaveText('Managed');
    await expect(worker.getByRole('button', { name: 'Managed', exact: true })).toHaveCount(0);
    await expect(worker.getByRole('button', { name: 'Add tokens', exact: true })).toHaveCount(0);
    await expect(worker.locator('.agent-token-count')).toHaveText(/^(20\/40|750\/1,500) tokens$/);
  }
  const standardWorkers = workers.filter({ hasNotText: 'Older model' });
  await page.clock.runFor(1000);
  await expect(standardWorkers.first().locator('.agent-token-count')).toHaveText('750/1,500 tokens');
  await page.evaluate(() => {
    GAME.state.agents.find(agent => !agent.olderModel && !['manager', 'token_mgr', 'devops'].includes(agent.roleId)).tokenTank = 150;
  });
  await page.clock.runFor(200);
  await expect(standardWorkers.first().locator('.agent-token-count')).toHaveText('1,500/1,500 tokens');
  await expect(page.getByRole('button', { name: 'Add tokens', exact: true })).toHaveCount(1);
  await page.screenshot({ path: 'test-results/phase8-simple.png', fullPage: true });
});
test('Scale Mode continues automatic construction and staffing in Phase 13',async({page})=>{
  const raw = fixture(13); const now = JSON.parse(raw).lastTick;
  await page.clock.install({ time: new Date(now) }); await page.clock.pauseAt(new Date(now + 1000));
  await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw); await page.goto('/');
  await expect(page.locator('.node-grid div.cluster-card:not(.planning-card)')).toHaveCount(100);await expect(page.locator('.provision-card')).toHaveCount(0);await page.clock.runFor(1000);await expect(page.locator('.node-grid div.cluster-card:not(.planning-card)')).toHaveCount(102);
  const buildingId = await page.evaluate(() => GAME.state.clusters.at(-1).id);
  await page.clock.runFor(2200);
  await expect(page.locator('[data-cluster-id="' + buildingId + '"] .capacity-slot.filled')).toHaveCount(16);await expect(page.locator('.node-grid div.cluster-card:not(.planning-card) button')).toHaveCount(0);
});

test('Phase 3 requires two cheap upgrades while keeping the multi-agent licence visible',async({page})=>{
  await page.emulateMedia({reducedMotion: 'reduce'});
  const h=harness();const g=h.fresh(3);g.cash=100000;g.tokens=200;g.totalTasksDone=800;h.prepareUpgrade('second_ai');h.api.checkMilestones();h.dismiss();g.lastTick=Date.now();const raw=JSON.stringify(g);h.close();
  await page.clock.install({time: new Date(g.lastTick)});
  await page.clock.pauseAt(new Date(g.lastTick + 1000));
  await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  await expect(page.locator('[onclick="GAME.buy(\'multi_bot\')"]')).toHaveCount(0);await page.locator('[onclick="GAME.buy(\'second_ai\')"]').click();
  await page.clock.runFor(200);
  await expect(page.locator('#agent-list').getByRole('button',{name:'Add tokens'})).toHaveCount(2);await expect(page.locator('#agent-slots')).toHaveCount(0);
  for(const button of await page.locator('#agent-list').getByRole('button',{name:'Add tokens'}).all())await button.click();
  expect(await page.evaluate(()=>GAME.state.tokens)).toBe(60);await page.screenshot({path:'test-results/phase3-two-subscriptions.png',fullPage:true});
  const tuning = page.locator('[onclick="GAME.buy(\'inference_tuning\')"]');
  const licence = page.locator('[onclick="GAME.buy(\'multi_bot\')"]');
  await expect(tuning).toHaveCount(0);
  await expect(licence).toHaveCount(0);
  await page.evaluate(() => GAME.addTasks(100));
  await page.clock.runFor(200);
  await expect(tuning).toHaveText('$6.0K');
  await expect(licence).toHaveCount(0);
  await tuning.click();
  await page.clock.runFor(200);
  expect(await page.evaluate(() => ({basic: GAME.state.aiPowerMult, pro: GAME.state.agentSpeedMult}))).toEqual({basic: 1.15, pro: 1.15});
  await expect(licence).toHaveCount(0);
  await page.evaluate(() => GAME.addTasks(100));
  await page.clock.runFor(200);
  await expect(licence).toBeVisible();
  await expect(licence).toBeDisabled();
  const refinement = page.locator('[onclick="GAME.buy(\'prompt_refinement\')"]');
  const pruning = page.locator('[onclick="GAME.buy(\'context_pruning\')"]');
  await expect(refinement).toHaveText('$1.5K');
  await expect(pruning).toHaveCount(0);
  await refinement.click();
  await page.clock.runFor(200);
  await expect(licence).toBeDisabled();
  await expect(pruning).toHaveText('$2.5K');
  await pruning.click();
  await page.clock.runFor(200);
  await expect(licence).toBeEnabled();
  await page.locator('[onclick="GAME.buy(\'multi_bot\')"]').click();expect(await page.evaluate(()=>GAME.state.phase)).toBe(5);expect(await page.evaluate(()=>GAME.state.aiWorkerShutdown)).toBe(true);expect(await page.evaluate(()=>GAME.state.agents.length)).toBe(2);
  await page.clock.runFor(200);
  await expect(page.locator('#agent-list').getByRole('button',{name:'Sell'})).toHaveCount(2);
});

test('an existing twelve-node company must provision and staff nine more nodes before replication',async({page})=>{
  const h=harness();const g=h.fresh(12);g.cash=1e11;g.tokens=1e6;g.totalTasksDone=2000000;g.incidentsExplained=true;g.ceoMode='scale';g.aiWorkerShutdown=true;h.prepareUpgrade('autonomous_nodes');
  for(let i=0;i<12;i++)h.fullCluster();h.api.checkMilestones();h.dismiss();g.lastTick=Date.now();g.lastSave=g.lastTick;g.lastCeoAction=g.lastTick;const raw=JSON.stringify(g);h.close();
  // Pause before navigation so the CEO cannot expand the fixture before its phase transition.
  await page.clock.install({ time: new Date(g.lastTick) });
  await page.clock.pauseAt(new Date(g.lastTick + 1000));
  await page.addInitScript(value=>{if(!sessionStorage.getItem('replication_seeded')){localStorage.setItem('ai_empire_save',value);sessionStorage.setItem('replication_seeded','1')}},raw);await page.goto('/');
  await page.locator('[onclick="GAME.buy(\'autonomous_nodes\')"]').click();await page.clock.runFor(200);await expect(page.locator('#milestone-popup')).toBeHidden();const buy=page.locator('[onclick="GAME.buy(\'replication\')"]');await expect(buy).toHaveCount(0);
  await page.locator('[onclick="GAME.buy(\'ceo_continuous\')"]').click();await page.clock.runFor(8500);await expect(buy).toBeDisabled();await expect(buy.locator('..').locator('..').locator('.desc')).toHaveText('Build four clusters at once. Reduce cluster costs by 35%.');await page.evaluate(()=>GAME.state.lastSave=0);await page.clock.runFor(200);await page.reload();expect(await page.evaluate(()=>GAME.state.replicationTarget)).toBe(21);
  await page.clock.runFor(5000);await expect(buy).toBeEnabled();await buy.click();await page.clock.runFor(200);expect(await page.evaluate(()=>GAME.state.phase)).toBe(14);
});

for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  test(`fresh start fits the viewport at ${viewport.width}x${viewport.height}`,async({page})=>{
    await page.setViewportSize(viewport);await page.goto('/');
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    await page.getByRole('button',{name:'Find Work'}).click();

    await expect(page.getByRole('button',{name:'Do Task',exact:true})).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    await page.screenshot({path:`test-results/start-${viewport.width}.png`});
  });
}
test('early upgrade visibility follows task milestones and prior purchases',async({page})=>{
  const h=harness();const g=h.fresh();g.cash=0;g.totalTasksDone=104;h.prepareUpgrade('free_ai');h.api.checkMilestones();h.dismiss();g.lastTick=Date.now();g.lastSave=g.lastTick;g.lastTaskSpawn=g.lastTick+1e9;const raw=JSON.stringify(g);h.close();
  await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  const buy=id=>page.locator('[onclick="GAME.buy(\''+id+'\')"]');await expect(buy('free_ai')).toHaveCount(0);
  await page.evaluate(()=>GAME.addTasks(1));await expect(buy('free_ai')).toBeDisabled();await page.evaluate(()=>GAME.addTasks(45));await expect(buy('free_ai')).toBeEnabled();await buy('free_ai').click();expect(await page.evaluate(()=>GAME.state.cash)).toBe(0);await expect(buy('prompt_basics')).toHaveCount(0);await expect(buy('pro_model')).toHaveCount(0);
  await page.evaluate(()=>GAME.addTasks(24));await expect(buy('prompt_basics')).toHaveCount(0);await page.evaluate(()=>GAME.addTasks(1));await expect(buy('prompt_basics')).toHaveCount(0);await expect(buy('prompt_examples')).toBeVisible();
});

for(const width of [1440,390]) {
  test(`AI subscriptions keep matching bars and buttons through licensing at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});const h=harness();const g=h.fresh(3);g.cash=1e6;g.tokens=200;g.totalTasksDone=1000;h.prepareUpgrade('second_ai');h.api.purchaseUpgrade('second_ai');h.api.purchaseUpgrade('inference_tuning');h.api.purchaseUpgrade('prompt_refinement');h.api.purchaseUpgrade('context_pruning');h.api.checkMilestones();h.dismiss();g.lastTick=Date.now();const raw=JSON.stringify(g);h.close();
    await page.addInitScript(value=>{localStorage.setItem('ai_empire_save',value);},raw);await page.goto('/');

    for(const phase of [4,5]){
      if(phase===5)await expect(page.locator('#agent-list').getByRole('button',{name:'Sell'})).toHaveCount(2);
      const cards=page.locator('#agent-list .agent-card');await expect(cards).toHaveCount(2);await expect(cards.nth(0).locator('.name')).toContainText('AI 2000 Basic');await expect(cards.nth(1).locator('.name')).toContainText('AI 2000 Pro');
      const bars=await cards.locator('.task-bar').all();const first=await bars[0].boundingBox();const second=await bars[1].boundingBox();expect(first.width).toBe(second.width);
      const counts=await cards.locator('.agent-token-count').all();expect((await counts[0].boundingBox()).x).toBe(first.x);expect((await counts[1].boundingBox()).x).toBe(second.x);
      await expect(counts[0]).toHaveText(/\/40 tokens(?: Empty)?$/);await expect(counts[1]).toHaveText(new RegExp('/'+(phase===4?100:200)+' tokens(?: Empty)?$'));await expect(page.locator('#agent-slots')).toHaveCount(0);await expect(page.locator('#token-burn')).toHaveText(/^-\d[\d,]* tok\/s$/);
      const buttons=cards.getByRole('button',{name:'Add tokens'});expect((await buttons.nth(0).boundingBox()).width).toBe((await buttons.nth(1).boundingBox()).width);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/phase${phase}-agents-${width}.png`,fullPage:true});
      if(phase===4)await page.locator('[onclick="GAME.buy(\'multi_bot\')"]').click();
    }
  });
}
test('DevOps sits in Incidents and management cards stand out',async({page})=>{
  const raw=fixture(9);await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  await expect(page.locator('#incident-devops .agent-card')).toContainText('DevOps');await expect(page.locator('#agent-list')).not.toContainText('DevOps');
  const colors=await page.locator('.management-agent').evaluateAll(cards=>cards.map(card=>getComputedStyle(card).backgroundColor));expect(colors).toEqual(['rgb(228, 233, 222)','rgb(228, 233, 222)']);
  await page.screenshot({path:'test-results/management-and-devops.png',fullPage:true,animations:'disabled'});
});
test('empty upgrades retain a blank card of space above token packs',async({page})=>{
  const h=harness(fixture(10));const g=h.window.GAME.state;g.clusters[0].workerAgentIds.pop();g.lastTick=Date.now();const raw=JSON.stringify(g);h.close();
  await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  await expect(page.locator('#upgrade-list .upgrade-space')).toBeVisible();expect((await page.locator('#upgrade-list .upgrade-space').boundingBox()).height).toBeCloseTo(68,1);await expect(page.locator('#upgrade-list')).not.toContainText('No upgrades');
});

for (const width of [1440, 390]) {
  test(`buying the last upgrade preserves the exact empty panel height at ${width}px`, async ({ page }) => {
    const h = harness();
    const g = h.fresh();
    g.totalTasksDone = 7; g.cash = 1000;
    h.prepareUpgrade('sticky_note_system');
    h.api.checkMilestones();
    h.dismiss();
    g.tasks = [];
    g.lastTick = Date.now();
    g.lastSave = g.lastTick;
    g.lastTaskSpawn = g.lastTick + 1e9;
    const raw = JSON.stringify(g);
    h.close();
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install({ time: new Date(g.lastTick) });
    await page.clock.pauseAt(new Date(g.lastTick + 1000));
    await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw);
    await page.goto('/');

    const section = page.locator('#section-upgrades');
    const beforePanel = await section.boundingBox();
    const beforeCard = await section.locator('.upgrade-card').boundingBox();
    await page.clock.runFor(200);
    await page.getByRole('button', { name: '$34', exact: true }).click();
    await page.clock.runFor(200);
    const placeholder = section.locator('.upgrade-space');
    await expect(placeholder).toBeVisible();
    expect((await placeholder.boundingBox()).height).toBeCloseTo(beforeCard.height, 1);
    expect((await section.boundingBox()).height).toBeCloseTo(beforePanel.height, 1);
    await expect(page.locator('#upgrade-list')).toHaveText('');
  });
}

test('Phase 8 keeps reveal milestones hidden and offers DevOps first', async ({ page }) => {
  const h = harness();
  const g = h.fresh(8);
  g.totalTasksDone = 30000;
  g.cash = 100000;
  g.aiWorkerShutdown = true;
  h.prepareUpgrade('compute_2');
  h.api.checkMilestones();
  h.dismiss();
  g.tasks = [];
  g.lastTick = Date.now();
  g.lastSave = g.lastTick;
  g.lastTaskSpawn = g.lastTick;
  const raw = JSON.stringify(g);
  h.close();
  await page.clock.install({ time: new Date(g.lastTick) });
  await page.clock.pauseAt(new Date(g.lastTick + 1000));
  await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw);
  await page.goto('/');
  const button = id => page.locator('[onclick="GAME.buy(\'' + id + '\')"]');
  await expect(button('compute_2')).toHaveCount(0);
  await expect(button('compute_1')).toHaveCount(0);
  await expect(page.locator('#upgrade-list')).not.toContainText('tasks)');
  await expect(button('devops_unlock')).toBeEnabled();
  await button('devops_unlock').click();
  expect(await page.evaluate(() => GAME.state.cash)).toBe(40000);
  await page.clock.runFor(200);
  await expect(button('delivery_pipeline')).toHaveCount(0);
  await page.evaluate(() => GAME.addTasks(15000));
  await page.clock.runFor(200);
  await expect(button('compute_2')).toBeVisible();
  await expect(button('compute_2')).toHaveText('$150.0K');
  await expect(button('compute_2')).toBeDisabled();
  await expect(page.locator('.upgrade-cost')).toHaveCount(0);
});

test('CEO scaling displays filled and vacant slots alongside hiring upgrades',async({page})=>{
  const h=harness(fixture(11));const g=h.window.GAME.state;g.clusters[2].workerAgentIds.splice(4);g.purchasedUpgrades=g.purchasedUpgrades.filter(id=>!['ceo_recruitment','ceo_batch'].includes(id));g.lastTick=Date.now();g.lastCeoAction=g.lastTick;const raw=JSON.stringify(g);h.close();
  await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  const cluster=page.locator('div.cluster-card:not(.planning-card)').first();await expect(cluster.locator('.cluster-hdr strong')).toHaveText('Cluster 3');await expect(cluster.locator('.cluster-status')).toHaveText('Partially Operational');await expect(cluster.locator('.capacity-slot.filled')).toHaveCount(4);await expect(cluster.locator('.capacity-slot.empty')).toHaveCount(12);await expect(cluster).not.toContainText('4/8');
  await expect(page.locator('[onclick="GAME.buy(\'ceo_recruitment\')"]')).toBeVisible();await page.screenshot({path:'test-results/ceo-scaling.png',fullPage:true,animations:'disabled'});
});

for(const width of [1440,390]){
  test(`company leadership and next cluster card fit at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});const raw=fixture(11);await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');

    await expect(page.locator('.company-leadership .leadership-agent')).toHaveCount(2);await expect(page.locator('.company-leadership')).toContainText('AI CEO');await expect(page.locator('.company-leadership')).toContainText('Token Manager');await expect(page.locator('.company-leadership')).toContainText('tok/s');
    const card=page.locator('.provision-card');await expect(card).toHaveCount(1);expect(await card.evaluate(el=>el.parentElement.classList.contains('node-grid'))).toBe(true);await card.scrollIntoViewIfNeeded();await card.focus();await page.keyboard.press('Enter');await expect(page.locator('.node-grid div.cluster-card:not(.planning-card)')).toHaveCount(4);
    await expect(page.locator('#delivery-summary')).toBeVisible();await expect(page.locator('#task-list')).toBeHidden();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('.company-leadership').screenshot({path:`test-results/leadership-${width}.png`});await page.locator('.node-grid').screenshot({path:`test-results/provision-${width}.png`});
  });
}
test('delivery details can be opened and collapsed without losing keyboard focus',async({page})=>{
  const h=harness(fixture(11));const g=h.window.GAME.state;g.agentSpeedMult=.00001;h.task();g.lastTick=Date.now();const raw=JSON.stringify(g);h.close();await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');
  await expect(page.locator('#delivery-summary')).toContainText('completed / min');await expect(page.locator('#task-list')).toBeHidden();const toggle=page.locator('#delivery-summary button');await toggle.click();await expect(page.locator('#task-list')).toBeVisible();await toggle.focus();await page.keyboard.press('Enter');await expect(page.locator('#task-list')).toBeHidden();await expect(toggle).toHaveText('Show tasks ∨');await page.waitForTimeout(300);await expect(toggle).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#task-list')).toBeVisible();await expect(toggle).toHaveText('Hide tasks ∧');await page.screenshot({path:'test-results/compact-delivery.png',fullPage:true,animations:'disabled'});
});

for (const width of [1440, 320]) {
  test(`delivery counters keep their columns when the completed count grows at ${width}px`, async ({ page }) => {
    const h = harness(fixture(11));
    const g = h.window.GAME.state;
    g.lastTick = Date.now();
    g.lastSave = g.lastTick;
    const raw = JSON.stringify(g);
    h.close();
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install({ time: new Date(g.lastTick) });
    await page.clock.pauseAt(new Date(g.lastTick + 1000));
    await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw);
    await page.goto('/');

    const queued = page.locator('.delivery-queued');
    const running = page.locator('.delivery-running');
    const queuedX = (await queued.boundingBox()).x;
    const runningX = (await running.boundingBox()).x;
    for (const count of ['9', '999', '99,999', '9,999,999']) {
      await page.locator('.delivery-rate').evaluate((element, value) => { element.firstChild.textContent = value; }, count);
      expect((await queued.boundingBox()).x).toBeCloseTo(queuedX, 1);
      expect((await running.boundingBox()).x).toBeCloseTo(runningX, 1);
    }
    await expect(page.locator('#task-count')).toHaveCount(0);
    await expect(page.locator('#cluster-list')).not.toContainText('Client retainers');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/delivery-stable-${width}.png`, fullPage: true, animations: 'disabled' });
  });
}

test('tasks fold at two clusters and the CEO preserves a manual reopening', async ({ page }) => {
  const h = harness();
  const g = h.fresh(11);
  g.cash = 1e9;
  g.tokens = 100000;
  g.totalTasksDone = 2000000;
  g.aiWorkerShutdown = true;
  h.prepareUpgrade('ai_ceo');
  for (let i = 0; i < 3; i++) h.fullCluster();
  h.api.checkMilestones();
  h.dismiss();
  g.tasks = [];
  g.agentSpeedMult = 0.00001;
  g.lastTick = Date.now();
  g.lastSave = g.lastTick;
  const task = h.task();
  task.createdAt = g.lastTick;
  task.workRequired = 1e9;
  const raw = JSON.stringify(g);
  h.close();
  await page.clock.install({ time: new Date(g.lastTick) });
  await page.clock.pauseAt(new Date(g.lastTick + 1000));
  await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw);
  await page.goto('/');
  await expect(page.locator('#task-list')).toBeHidden();
  await page.locator('#delivery-summary button').click();
  await expect(page.locator('#task-list')).toBeVisible();
  await page.getByRole('button', { name: /Provision AI CEO/ }).click();
  await page.clock.runFor(200);
  await expect(page.locator('#task-list')).toBeVisible();
  const toggle = page.locator('#delivery-summary button');
  await expect(toggle).toHaveText('Hide tasks ∧');
  await toggle.click();
  await expect(page.locator('#task-list')).toBeHidden();
  await toggle.click();
  await expect(page.locator('#task-list')).toBeVisible();
  await expect(toggle).toHaveText('Hide tasks ∧');
});

for (const width of [1440, 390]) {
  test(`three through six clusters keep readable slots and accessible cards at ${width}px`, async ({ browser, baseURL }) => {
    let previousCardHeight = Infinity;
    for (const count of [3, 4, 5, 6]) {
      const h = harness(fixture(12), { seed: 42 });
      const g = h.window.GAME.state;
      for (let i = 3; i < count; i++) h.fullCluster();
      g.lastTick = Date.now();
      g.lastSave = g.lastTick;
      g.lastCeoAction = g.lastTick + 1000000;
      g.lastIncidentCheck = g.lastTick;
      g.aiFailMult = 0;
      expect(h.api.validSave(g)).toBe(true);
      const raw = JSON.stringify(g);
      h.close();
      const context = await browser.newContext({ baseURL, viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      try {
        const page = await context.newPage();
        await page.clock.install({ time: new Date(g.lastTick) });
        await page.clock.pauseAt(new Date(g.lastTick + 1000));
        await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw);
        await page.goto('/');

        const grid = page.locator('#cluster-list .agent-grid');
        await expect(grid.locator('div.cluster-card:not(.planning-card)')).toHaveCount(count);
        const layout = await grid.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const cards = [...element.querySelectorAll('div.cluster-card:not(.planning-card)')];
          const boxes = cards.map(card => card.getBoundingClientRect());
          return {
            height: bounds.height,
            cardHeight: Math.max(...boxes.map(box => box.height)),
            visibleCards: boxes.filter(box => box.top >= bounds.top - 0.5 && box.bottom <= bounds.bottom + 0.5).length,
            labelsFit: cards.every(card => [...card.querySelectorAll('.capacity-slot')].every(slot => slot.scrollWidth <= slot.clientWidth)),
            overflowingControls: cards.flatMap((card, index) => [...card.querySelectorAll('.capacity-slot, button')].flatMap(control => {
              const box = control.getBoundingClientRect();
              return box.top < boxes[index].top || box.bottom > boxes[index].bottom || box.left < boxes[index].left || box.right > boxes[index].right ? [{ name: control.textContent, card: boxes[index].toJSON(), control: box.toJSON() }] : [];
            })),
          };
        });
        expect(layout.cardHeight, `${count} clusters must not enlarge the cards`).toBeLessThanOrEqual(previousCardHeight);
        expect(layout.labelsFit, `${count} clusters must keep short names readable inside their slots`).toBe(true);
        expect(layout.overflowingControls, `${count} clusters must keep all agent slots and Sell controls inside their cards`).toEqual([]);
        if (count >= 4) {
          expect(await grid.evaluate(element => getComputedStyle(element).overflowY)).toBe('visible');
          expect(layout.height).toBeGreaterThan(0);
          expect(layout.visibleCards).toBeGreaterThan(0);
          await grid.locator('div.cluster-card:not(.planning-card)').last().scrollIntoViewIfNeeded();
          await expect(grid.locator('div.cluster-card:not(.planning-card)').last()).toBeInViewport();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        previousCardHeight = layout.cardHeight;
      } finally {
        await context.close();
      }
    }
  });

  test(`cluster overview grows with the fleet without a nested scrollbar at ${width}px`, async ({ page }) => {
    const h = harness(fixture(12), { seed: 42 });
    const g = h.window.GAME.state;
    h.fullCluster();
    g.lastTick = Date.now();
    g.lastSave = g.lastTick;
    g.lastCeoAction = g.lastTick + 1000000;
    g.lastIncidentCheck = g.lastTick;
    g.aiFailMult = 0;
    expect(h.api.validSave(g)).toBe(true);
    const raw = JSON.stringify(g);
    h.close();
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install({ time: new Date(g.lastTick) });
    await page.clock.pauseAt(new Date(g.lastTick + 1000));
    await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw);
    await page.goto('/');

    const overview = page.locator('.cluster-overview');
    await expect(overview.locator('div.cluster-card:not(.planning-card)')).toHaveCount(4);
    const beforeMinimum = await overview.evaluate(element => parseFloat(element.style.getPropertyValue('--cluster-card-min')));
    await page.evaluate(() => { GAME.state.lastCeoAction = 0; });
    for (const target of [6, 12]) {
      for (let step = 0; step < 80 && await page.evaluate(() => GAME.state.clusters.length) < target; step++) await page.clock.runFor(200);
      await expect(overview.locator('div.cluster-card:not(.planning-card)')).toHaveCount(target);
      expect((await overview.boundingBox()).height).toBeGreaterThan(0);
      expect(await overview.evaluate(element => getComputedStyle(element).overflowY)).toBe('visible');
      expect(await overview.evaluate(element => parseFloat(element.style.getPropertyValue('--cluster-card-min')))).toBeLessThan(beforeMinimum);
    }
    await expect(overview.locator('details')).toHaveCount(0);
    expect(await overview.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBeGreaterThanOrEqual(2);
    const firstCard = overview.locator('div.cluster-card:not(.planning-card)').last();
    const cardBounds = await firstCard.boundingBox();
    const lastAgent = await firstCard.locator('.capacity-slot').last().boundingBox();
    expect(lastAgent.y + lastAgent.height).toBeLessThanOrEqual(cardBounds.y + cardBounds.height);
    const sell = await firstCard.getByRole('button', { name: 'Sell', exact: true }).boundingBox();
    expect(sell.y + sell.height).toBeLessThanOrEqual(cardBounds.y + cardBounds.height);
    await expect(page.locator('#operations-health')).toContainText('Operations healthy');
    await expect(page.locator('#incidents-header')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/cluster-overview-${width}.png`, fullPage: true, animations: 'disabled' });
  });
}
for(const width of [1440,390]){
  test(`Manager and agent hiring placeholders work at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.evaluate(()=>{chPh7();GAME.addTasks(3);GAME.buy('manager_agent');});
    if(await page.locator('#milestone-popup').isVisible())await expect(page.locator('#milestone-popup')).toBeHidden();
    const manager=page.locator('.manager-slot');await expect(manager).toBeVisible();await expect(manager).toContainText('$20.0K');expect(await manager.evaluate(el=>el===el.parentElement.firstElementChild)).toBe(true);await manager.screenshot({path:`test-results/manager-slot-${width}.png`});await manager.click();await expect(manager).toHaveCount(0);await expect(page.locator('#agent-list .agent-card').first()).toContainText('Manager');
    const sell=page.locator('#agent-list .agent-card').nth(1).getByRole('button',{name:'Sell',exact:true});await sell.click();const vacancy=page.locator('.agent-vacancy');await expect(vacancy).toHaveCount(1);await expect(vacancy.getByRole('button',{name:'Buy Coder',exact:true})).toBeDisabled();await page.evaluate(()=>GAME.addCash(10000));await expect(vacancy.locator('select')).toHaveCount(0);await expect(vacancy.getByRole('button',{name:'Buy Coder',exact:true})).toBeEnabled();await vacancy.getByRole('button',{name:'Buy Coder',exact:true}).focus();await page.waitForTimeout(300);await expect(vacancy.getByRole('button',{name:'Buy Coder',exact:true})).toBeFocused();await page.screenshot({path:`test-results/hiring-${width}.png`,fullPage:true,animations:'disabled'});await vacancy.getByRole('button',{name:'Buy Coder',exact:true}).click();await expect(vacancy).toHaveCount(0);expect(await page.evaluate(()=>GAME.state.agents.length)).toBe(7);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
test('Phase 2 AI income appears and the Basic purchase changes model and lifestyle names',async({page})=>{
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => { chPh3(); GAME.addTasks(3); });
  await page.clock.runFor(1000);
  await expect.poll(() => page.locator('#income-rate').textContent()).not.toBe('+$0/s');
  await expect(page.locator('#agent-list [data-agent-slot="0"] .name')).toHaveText('AI 2000 Free');
  await page.evaluate(() => GAME.addCash(2000 - GAME.state.cash));
  await page.clock.runFor(200);
  await page.locator('[onclick="GAME.buy(\'pro_model\')"]').click();
  await page.clock.runFor(200);
  await expect(page.locator('#milestone-popup')).toBeHidden();
  await page.clock.runFor(200);
  await expect(page.locator('#agent-list [data-agent-slot="0"] .name')).toHaveText('AI 2000 Basic');
  await expect(page.locator('#expense-tier-label')).toHaveText('Coffee Shop Regular');
  await expect(page.locator('[onclick="GAME.buy(\'prompt_basics\')"]')).toHaveCount(0);
  await page.screenshot({path:'test-results/basic-tier.png',fullPage:true,animations:'disabled'});
});

test('phase checkpoints save the requested task and cash amounts', async ({page}) => {
  await page.clock.install();
  await page.goto('/');
  for (const [stage, cash, tasks] of [[3, 1900, 297], [4, 14000, 870], [5, 1300, 997], [9, 800000, 390000]]) {
    const checkpoint = await page.evaluate(stage => {
      window['chPh' + stage]();
      const saved = JSON.parse(localStorage.getItem('ai_empire_save'));
      return {cash: GAME.state.cash, savedCash: saved.cash, tasks: GAME.state.totalTasksDone, savedTasks: saved.totalTasksDone};
    }, stage);
    expect(checkpoint).toEqual({cash, savedCash: cash, tasks, savedTasks: tasks});
  }
});

for (const width of [1440, 390]) {
  test(`the second subscription checkpoint preserves its savings goal after reload at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    const now = new Date();
    await page.clock.install({time: now});
    await page.clock.pauseAt(new Date(now.getTime() + 1000));
    await page.goto('/');
    await page.evaluate(() => chPh4());
    await page.reload();

    const second = page.locator('[onclick="GAME.buy(\'second_ai\')"]');
    await expect(second).toBeVisible();
    await expect(second).toHaveText('$18.0K');
    await expect(second).toBeDisabled();
    expect(await page.evaluate(() => ({phase: GAME.state.phase, tasks: GAME.state.totalTasksDone, cash: GAME.state.cash, agents: GAME.state.agents.length}))).toEqual({phase: 3, tasks: 870, cash: 14000, agents: 0});
    // Leave room for living costs during the next render tick.
    await page.evaluate(() => GAME.addCash(4001));
    await page.clock.runFor(200);
    await second.click();
    await page.clock.runFor(200);
    await expect(page.locator('#agent-list')).toContainText('AI 2000 Pro');
  });
}

for (const width of [1440, 390]) {
  test(`selling Basic leaves the first slot available through reload and replacement at ${width}px`, async ({page}) => {
    const h = harness();
    const g = h.fresh(3);
    g.cash = 1e6;
    g.totalTasksDone = 1000;
    h.prepareUpgrade('second_ai');
    h.api.purchaseUpgrade('second_ai');
    h.api.purchaseUpgrade('inference_tuning');h.api.purchaseUpgrade('prompt_refinement');h.api.purchaseUpgrade('context_pruning');
    h.api.purchaseUpgrade('multi_bot');
    h.api.hireAgent('coder', 2);
    h.api.checkMilestones();
    h.dismiss();
    g.lastTick = Date.now();
    g.lastTaskSpawn = g.lastTick + 1e9;
    const raw = JSON.stringify(g);
    const proId = g.agents.find(agent => agent.name === 'AI 2000 Pro').id;
    const coderId = g.agents.find(agent => agent.roleId === 'coder').id;
    h.close();
    await page.setViewportSize({width, height: 900});
    await page.clock.install({time: new Date(g.lastTick)});
    await page.clock.pauseAt(new Date(g.lastTick + 1000));
    await page.addInitScript(value => {
      if (!sessionStorage.getItem('slots_seeded')) {
        localStorage.setItem('ai_empire_save', value);
        sessionStorage.setItem('slots_seeded', '1');
      }
    }, raw);
    await page.goto('/');

    const slots = page.locator('#agent-list > [data-agent-slot]');
    await expect(slots.nth(0)).toContainText('AI 2000 Basic');
    await expect(slots.nth(1)).toContainText('AI 2000 Pro');
    await slots.nth(0).getByRole('button', {name: 'Sell', exact: true}).click();
    await page.clock.runFor(200);
    await expect(slots.nth(0)).toHaveClass(/agent-vacancy/);
    await expect(slots.nth(0)).toContainText('Agent slot 1');
    await expect(slots.nth(1)).toContainText('AI 2000 Pro');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();

    await expect(slots.nth(0)).toHaveClass(/agent-vacancy/);
    await expect(slots.nth(1)).toContainText('AI 2000 Pro');
    await page.screenshot({path: `test-results/basic-vacancy-${width}.png`, fullPage: true});
    await slots.nth(0).getByRole('button', {name: 'Buy Writer', exact: true}).click();
    await page.clock.runFor(200);
    await expect(slots.nth(0)).toHaveClass(/agent-card/);
    await expect(slots.nth(0)).toContainText('Writer');
    await expect(slots.nth(1)).toContainText('AI 2000 Pro');
    expect(await page.evaluate(({proId, coderId}) => ({
      proSlot: GAME.state.agents.find(agent => agent.id === proId).slotIndex,
      coderSlot: GAME.state.agents.find(agent => agent.id === coderId).slotIndex,
      replacementIsOld: GAME.state.agents.find(agent => agent.slotIndex === 0).olderModel,
      fits: document.documentElement.scrollWidth <= innerWidth,
    }), {proId, coderId})).toEqual({proSlot: 1, coderSlot: 2, replacementIsOld: false, fits: true});
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();

    await expect(slots.nth(0)).toContainText('Writer');
    await expect(slots.nth(1)).toContainText('AI 2000 Pro');
  });
}

for(const width of [1440,390]){
  test(`DevOps can be bought with a full agent pool at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.evaluate(()=>{chPh8();GAME.addTasks(3);GAME.buy('token_manager_unlock');GAME.addCash(1000000);GAME.buy('devops_unlock');});
    await page.getByRole('button',{name:/Buy Token Manager/}).click();await expect(page.locator('#agent-slots')).toHaveCount(0);
    const button=page.getByRole('button',{name:/Buy DevOps/});await expect(button).toBeEnabled();await button.screenshot({path:`test-results/devops-slot-${width}.png`});await button.focus();await page.keyboard.press('Enter');await expect(button).toHaveCount(0);await expect(page.locator('#incident-devops .agent-card')).toContainText('DevOps');await expect(page.locator('#agent-slots')).toHaveCount(0);expect(await page.evaluate(()=>GAME.state.agents.length)).toBe(9);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test('CEO is provisioned from its card without implicitly expanding agent capacity',async({page})=>{
  const h=harness();const g=h.fresh(11);g.cash=999999;g.tokens=1e6;g.totalTasksDone=1200000;g.incidentsExplained=true;g.aiWorkerShutdown=true;h.prepareUpgrade('ai_ceo');for(let i=0;i<3;i++)h.fullCluster();h.api.checkMilestones();h.dismiss();g.lastTick=Date.now();g.lastCeoAction=g.lastTick;const raw=JSON.stringify(g);h.close();
  await page.clock.install();await page.addInitScript(value=>localStorage.setItem('ai_empire_save',value),raw);await page.goto('/');const ceo=page.getByRole('button',{name:/Provision AI CEO/});await expect(ceo).toBeDisabled();await page.evaluate(()=>GAME.addCash(1001));await page.clock.runFor(200);await expect(ceo).toBeEnabled();await ceo.focus();await page.keyboard.press('Enter');await page.clock.runFor(200);expect(await page.evaluate(()=>GAME.state.ceoMode)).toBe('manage');expect(await page.evaluate(()=>GAME.state.cash)).toBeLessThan(1000);
  for(const card of await page.locator('div.cluster-card:not(.planning-card)').all()){await expect(card.locator('.filled')).toHaveCount(8);await expect(card.locator('.capacity-slot')).toHaveCount(8);}await expect(page.locator('.provision-card')).toHaveCount(1);
  await page.evaluate(()=>GAME.addCash(1e8));await page.clock.runFor(100000);await expect(page.locator('.provision-card')).toHaveCount(1);const upgrade=page.locator('[onclick="GAME.buy(\'ceo_recruitment\')"]');await expect(upgrade).toBeVisible();await page.locator('.provision-card').click();await page.clock.runFor(200);await expect(upgrade).toBeVisible();await expect(page.locator('.provision-card')).toHaveCount(0);await page.screenshot({path:'test-results/ceo-provisioning.png',fullPage:true,animations:'disabled'});
});

test('provisioning improvements bracket sixteen slots and stay available during construction', async ({page}) => {
  const h = harness();
  const g = h.fresh(11);
  g.ceoMode = 'manage';
  g.cash = 0;
  g.tokens = 1e6;
  g.totalTasksDone = 2e6;
  g.aiWorkerShutdown = true;
  g.incidentsExplained = true;
  h.prepareUpgrade('ceo_deploy_speed');
  for (let index = 0; index < 5; index++) h.fullCluster();
  h.api.checkMilestones();
  h.dismiss();
  g.lastTick = Date.now();
  g.lastCeoAction = g.lastTick;
  const raw = JSON.stringify(g);
  h.close();
  await page.clock.install({ time: new Date(g.lastTick) });
  await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw);
  await page.goto('/');
  const speed = page.locator('[onclick="GAME.buy(\'ceo_deploy_speed\')"]');
  const capacity = page.locator('[onclick="GAME.buy(\'cluster_capacity_16\')"]');
  const dual = page.locator('[onclick="GAME.buy(\'ceo_batch\')"]');
  await expect(speed).toBeVisible();
  await expect(speed).toBeDisabled();
  await expect(capacity).toHaveCount(0);
  await expect(dual).toHaveCount(0);
  await page.evaluate(() => GAME.addCash(1e9));
  await page.clock.runFor(200);
  await speed.click();
  await page.clock.runFor(200);
  await capacity.click();
  await page.clock.runFor(200);
  await expect(dual).toBeVisible();
  await dual.click();
  await page.clock.runFor(40000);
  await page.locator('[onclick="GAME.buy(\'server_1\')"]').click();
  await page.clock.runFor(1500);
  await expect(page.locator('div.cluster-card:not(.planning-card)')).toHaveCount(6);
  const quad = page.locator('[onclick="GAME.buy(\'ceo_quad_batch\')"]');
  await expect(quad).toBeVisible();
  await quad.click();
  await page.clock.runFor(200);
  await expect(page.locator('#upgrade-list')).toContainText('Parallel Cluster Builds');
  await expect(page.locator('#upgrade-list')).toContainText('Preassembled Server Racks');
  await page.clock.runFor(12500);
  await expect(page.locator('#upgrade-list')).toContainText('Parallel Cluster Builds');
  await expect(page.locator('#upgrade-list')).toContainText('Preassembled Server Racks');
  await page.locator('#upgrade-list').screenshot({path:'test-results/scaling-upgrades.png'});
});

for (const width of [1440, 390]) {
  test(`task cards limit concurrent manual work before upgrades at ${width}px`, async ({ page }) => {
    const h = harness();
    const g = h.fresh();
    g.totalTasksDone = 6;
    for (let i = 0; i < 3; i++) h.task().workRequired = 40;
    h.api.checkMilestones();
    h.dismiss();
    g.lastTick = Date.now();
    for (const task of g.tasks) task.createdAt = g.lastTick;
    g.lastTaskSpawn = g.lastTick + 1e9;
    const raw = JSON.stringify(g);
    h.close();
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date(g.lastTick) });
    await page.clock.pauseAt(new Date(g.lastTick + 1000));
    await page.addInitScript(value => localStorage.setItem('ai_empire_save', value), raw);
    await page.goto('/');

    const available = page.locator('#task-list > .task-card:enabled');
    for (let count = 1; count <= 3; count++) {
      await expect(available.first()).toBeEnabled();
      await available.first().locator('.task-name').click(); await page.clock.runFor(200);
      await expect(available).toHaveCount(0);
      await expect(page.locator('#task-list [data-assignment="active"]')).toHaveCount(1);
      await page.clock.runFor(6500);
    }
    expect(await page.evaluate(() => GAME.state.totalClicks)).toBe(3);
    expect(await page.evaluate(() => GAME.state.totalTasksDone)).toBe(9);
  });
}
