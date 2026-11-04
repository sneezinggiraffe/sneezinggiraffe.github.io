const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');
const { play } = require('./simulate.cjs');

function scenario(name, run) {
  test(name, () => { const h = harness(); try { run(h); } finally { h.close(); } });
}

test('the quiet Phase 5 synth waits for interaction, fades in and survives the drum change', () => {
  const intervals = new Map();
  let nextInterval = 0;
  const h = harness(undefined, { before(window) {
    window.setInterval = (fn, delay) => { const id = ++nextInterval; intervals.set(id, { fn, delay }); return id; };
    window.clearInterval = (id) => intervals.delete(id);
  } });
  const advanceFades = (ms) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      for (const [id, timer] of [...intervals]) if (timer.delay === 50 && intervals.has(id)) timer.fn();
    }
  };
  try {
    const g = h.fresh(5);
    g.totalTasksDone = 12;
    h.api.syncMusicPlayback();
    assert.equal(h.audioPlayers.length, 2);
    assert.ok(h.audioPlayers.every(player => player.paused));
    g.phase = 4;
    h.api.unlockMusicPlayback();
    assert.equal(h.audioPlayers.length, 2);
    g.cash = 12000;
    g.totalTasksDone = 1150;
    h.prepareUpgrade('tool_use');
    h.api.purchaseUpgrade('tool_use');
    assert.equal(g.phase, 5);
    const synth = h.audioPlayers.find(player => player.src === 'synth_d4_loop.mp3');
    assert.ok(synth);
    assert.equal(synth.preload, 'auto');
    assert.equal(synth.loop, true);
    assert.equal(synth.paused, false);
    assert.equal(synth.volume, 0);
    const timerCount = nextInterval;
    h.api.syncMusicPlayback();
    assert.equal(nextInterval, timerCount);
    advanceFades(4000);
    assert.equal(synth.volume, 0.03645);
    h.api.syncMusicPlayback();
    assert.equal(synth.volume, 0.03645);
    advanceFades(4000);
    assert.equal(synth.volume, 0.0729);
    synth.currentTime = 1.5;
    synth.pause();
    h.api.syncMusicPlayback();
    assert.equal(synth.paused, false);
    assert.equal(synth.volume, 0.0729);
    g.phase = 8;
    h.api.syncMusicPlayback();
    advanceFades(2000);
    assert.equal(h.audioPlayers.filter(player => player.src === 'synth_d4_loop.mp3').length, 1);
    assert.equal(synth.currentTime, 1.5);
    assert.equal(synth.paused, false);
    assert.equal(synth.volume, 0.0729);
    g.phase = 4;
    h.api.syncMusicPlayback();
    assert.equal(synth.paused, true);
    assert.equal(synth.currentTime, 0);
    assert.equal(synth.volume, 0);
    g.phase = 5;
    h.api.syncMusicPlayback();
    advanceFades(1000);
    assert.ok(synth.volume > 0 && synth.volume < 0.0729);
    g.musicMode = 'on';
    h.api.syncMusicPlayback();
    advanceFades(10000);
    assert.equal(synth.paused, true);
    assert.equal(synth.volume, 0);
    assert.ok(h.audioPlayers.some(player => player.src === 'soundtrack-loop.mp3' && !player.paused));
    g.musicMode = 'layered';
    h.api.syncMusicPlayback();
    advanceFades(8000);
    assert.equal(synth.volume, 0.0729);
    for (const change of [() => { g.musicMode = 'off'; }, () => { g.totalTasksDone = 0; }, () => { g.gameStarted = false; }, () => { g.retired = true; }]) {
      change();
      h.api.syncMusicPlayback();
      assert.equal(synth.paused, true);
      assert.equal(synth.currentTime, 0);
      assert.equal(synth.volume, 0);
      g.musicMode = 'layered'; g.totalTasksDone = 12; g.gameStarted = true; g.retired = false;
      h.api.syncMusicPlayback();
      assert.equal(synth.paused, false);
      advanceFades(1000);
    }
    g.phase = 15;
    h.api.sellCompany();
    assert.ok(h.audioPlayers.every(player => player.paused));
    assert.equal(synth.volume, 0);
    h.window.GAME.prestige();
    assert.ok(h.audioPlayers.every(player => player.paused));
    assert.equal(synth.volume, 0);
  } finally {
    h.close();
  }
});

scenario('DnB source changes stay silent until music is unlocked', (h) => {
  const g = h.fresh(7);
  g.totalTasksDone = 12;
  h.api.syncMusicPlayback();
  g.phase = 8;
  h.api.syncMusicPlayback();
  assert.ok(h.audioPlayers.every(player => player.paused));
  h.api.unlockMusicPlayback();
  assert.ok(h.audioPlayers.some(player => player.src === 'dnb_synth_loop.wav' && !player.paused));
});

scenario('a game already in DnB mode plays only the premix and base soundtrack', (h) => {
  const g = h.fresh(8);
  g.totalTasksDone = 12;
  h.api.unlockMusicPlayback();
  assert.equal(h.audioPlayers.length, 2);
  assert.ok(h.audioPlayers.some(player => player.src === 'dnb_synth_loop.wav' && !player.paused));
  assert.ok(h.audioPlayers.every(player => player.src !== 'synth_d4_loop.mp3'));
  g.musicMode = 'off';
  h.api.syncMusicPlayback();
  assert.ok(h.audioPlayers.every(player => player.paused));
});

test('DnB waits for a downbeat and hands the standalone hook to the premixed track', () => {
  const intervals = new Map();
  let nextInterval = 0;
  const h = harness(undefined, { before(window) {
    window.setInterval = (fn, delay) => { const id = ++nextInterval; intervals.set(id, { fn, delay }); return id; };
    window.clearInterval = (id) => intervals.delete(id);
  } });
  const advanceFades = (ms) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      for (const [id, timer] of [...intervals]) if (timer.delay === 50 && intervals.has(id)) timer.fn();
    }
  };
  try {
    const g = h.fresh(7);
    g.totalTasksDone = 12;
    h.api.unlockMusicPlayback();
    advanceFades(10000);
    const kick = h.audioPlayers.find(player => player.src === 'precursor_kick.mp3');
    const synth = h.audioPlayers.find(player => player.src === 'synth_d4_loop.mp3');
    kick.currentTime = 5.1;
    synth.currentTime = 2.5;
    g.phase = 8;
    h.api.syncMusicPlayback();
    const dnb = h.audioPlayers.find(player => player.src === 'dnb_synth_loop.wav');
    assert.equal(dnb.paused, true);
    h.api.syncMusicPlayback();
    assert.equal(dnb.paused, true);
    assert.equal(kick.paused, false);
    dnb.dispatchEvent(new h.window.Event('canplay'));
    h.advance(1100);
    assert.equal(dnb.paused, true);
    h.advance(71);
    assert.equal(dnb.volume, 0);
    assert.equal(dnb.paused, false);
    assert.equal(synth.currentTime, 2.5);
    const timers = nextInterval;
    h.api.syncMusicPlayback();
    assert.equal(nextInterval, timers);
    advanceFades(2000);
    assert.ok(Math.abs(dnb.volume - 0.18 * 2000 / 6270) < 1e-9);
    assert.ok(Math.abs(kick.volume - 0.18 * (1 - 2000 / 6270)) < 1e-9);
    assert.ok(Math.abs(synth.volume - 0.0729 * (1 - 2000 / 6270)) < 1e-9);
    h.api.syncMusicPlayback();
    assert.ok(Math.abs(synth.volume - 0.0729 * (1 - 2000 / 6270)) < 1e-9);
    assert.equal(kick.paused, false);
    advanceFades(2200);
    assert.ok(dnb.volume < 0.18);
    assert.equal(kick.paused, false);
    assert.equal(synth.paused, false);
    advanceFades(2100);
    assert.equal(dnb.volume, 0.18);
    assert.equal(kick.paused, true);
    assert.equal(kick.currentTime, 0);
    assert.equal(kick.volume, 0);
    assert.equal(synth.currentTime, 0);
    assert.equal(synth.paused, true);
    assert.equal(synth.volume, 0);
    h.api.syncMusicPlayback();
    assert.equal(synth.paused, true);
    g.phase = 7;
    h.api.syncMusicPlayback();
    const stoppedKick = h.audioPlayers[h.audioPlayers.length - 1];
    g.musicMode = 'off';
    h.api.syncMusicPlayback();
    stoppedKick.dispatchEvent(new h.window.Event('canplay'));
    assert.equal(stoppedKick.currentTime, 0);
    advanceFades(5000);
    assert.ok(h.audioPlayers.every(player => player.paused));
    assert.ok(h.audioPlayers.filter(player => player.src !== 'soundtrack-loop.mp3').every(player => player.volume === 0));
    g.musicMode = 'layered';
    h.api.syncMusicPlayback();
    stoppedKick.currentTime = 1.3;
    g.phase = 8;
    h.api.syncMusicPlayback();
    const obsoleteDnb = h.audioPlayers[h.audioPlayers.length - 1];
    g.phase = 7;
    h.api.syncMusicPlayback();
    obsoleteDnb.currentTime = 0;
    obsoleteDnb.dispatchEvent(new h.window.Event('canplay'));
    assert.equal(obsoleteDnb.currentTime, 0);
    const zeroKick = h.audioPlayers[h.audioPlayers.length - 1];
    obsoleteDnb.currentTime = 0;
    zeroKick.dispatchEvent(new h.window.Event('canplay'));
    assert.equal(zeroKick.paused, false);
    zeroKick.currentTime = 1.3;
    g.phase = 8;
    h.api.syncMusicPlayback();
    const cancelledDnb = h.audioPlayers[h.audioPlayers.length - 1];
    cancelledDnb.dispatchEvent(new h.window.Event('canplay'));
    g.musicMode = 'off';
    h.api.syncMusicPlayback();
    assert.equal(cancelledDnb.paused, true);
    g.musicMode = 'layered';
    h.api.syncMusicPlayback();
    const resumedTimers = nextInterval;
    h.advance(2200);
    assert.equal(nextInterval, resumedTimers);
    g.musicMode = 'layered';
    g.phase = 7;
    h.api.syncMusicPlayback();
    h.audioPlayers[h.audioPlayers.length - 1].currentTime = 1.7;
    g.phase = 8;
    h.api.syncMusicPlayback();
    const replacedDnb = h.audioPlayers[h.audioPlayers.length - 1];
    replacedDnb.dispatchEvent(new h.window.Event('canplay'));
    g.phase = 7;
    h.api.syncMusicPlayback();
    h.advance(2200);
    assert.equal(replacedDnb.paused, true);
  } finally {
    h.close();
  }
});

scenario('onboarding, manual work, keyboard action and rendering', (h) => {
  h.window.document.querySelector('#btn-start-game').click();
  h.window.document.querySelector('#btn-do-task').click();
  h.api.tickManualWork(10);
  assert.equal(h.window.GAME.state.totalTasksDone, 1);
  h.advance(1000);
  for (let i = 0; i < 20; i++) { const task = h.task(); h.api.clickTask(task.id); h.api.tickManualWork(10); h.advance(1000); }
  h.dismiss(); h.task(); h.api.renderAll();
  assert.equal(h.window.GAME.state.uiRevealed.upgrades, true);
  assert.ok(h.window.document.querySelector('#task-list').innerHTML.includes('onclick'));
});
scenario('auto OFF stays idle; explicit top-up starts one job; guards prevent task stealing', (h) => {
  const g=h.fresh(4); g.tokens=50;
  const a=h.worker(); a.autoAssign=false; a.tokenTank=5;
  const t=h.task(); h.api.tickAgents(0.1); assert.equal(a.status,'idle');
  h.api.topUpAgent(a.id); assert.equal(a.status,'working');
  const b=h.worker('coder'); b.tokenTank=10; b.autoAssign=false; h.api.assignAgentToTask(t.id,b.id); assert.equal(b.status,'idle');
  a.reliability=2; h.api.tickAgents(1000); assert.equal(g.totalTasksDone,1);
  h.task(); h.api.tickAgents(0.1); assert.equal(a.status,'idle');
  h.api.toggleAgentAuto(a.id); a.tokenTank=10; h.api.tickAgents(0.1); assert.equal(a.status,'working');
});
scenario('Token Manager purchases scaled packs and charges only missing tokens', (h) => {
  const g=h.fresh(7);g.cash=1e6;g.tokens=0;g.aiWorkerShutdown=true;h.worker('manager');h.worker('token_mgr');const a=h.worker();
  h.api.tickTokenManager();assert.equal(g.tokens,46000);assert.equal(g.cash,970000);assert.equal(g.tokenPacksBought,1);
  h.advance(3000);h.api.tickTokenManager();h.api.tickManager();assert.equal(a.tokenTank,25);assert.equal(g.managerTokenTank,3975);assert.equal(g.tokens,46000);
  g.managerTokenTank=3999;g.tokens=2;h.api.topUpManager();assert.equal(g.tokens,1);assert.equal(g.managerTokenTank,4000);
  g.managerTokenTank=0;g.tokens=3;h.api.topUpManager();assert.equal(g.managerTokenTank,3);
});
scenario('clusters include staged hardware and management before agent provisioning', (h) => {
  const g=h.fresh(9);g.tokens=5000;g.cash=1e6;g.uiRevealed.clusters=true;
  h.api.openCluster();const c=g.clusters[0];assert.equal(g.cash,938000);assert.equal(c.managerAssigned,false);
  for(const stage of ['Procuring GPUs','Racking hardware','Installing software','Final checks']){h.api.renderClusterSection();assert.match(h.window.document.querySelector('#cluster-list').textContent,new RegExp(stage));h.api.buyClusterWorker(c.id);assert.equal(g.agents.length,0);h.api.tickConstruction(3);}
  assert.equal(c.managerAssigned,true);assert.equal(c.tokenManagerAssigned,true);assert.equal(h.window.GAME.buyManagementTeam,undefined);
  h.api.buyClusterWorker(c.id);assert.equal(g.cash,935500);const agent=g.agents[0];assert.equal(agent.status,'provisioning');assert.equal(agent.name,'AI Agent');h.api.tickConstruction(2);h.api.renderClusterSection();assert.equal(h.window.document.querySelector('[aria-label="Provisioning agent"]').getAttribute('aria-valuenow'),'50');
  h.api.tickConstruction(2);h.api.tickTokenManager();h.api.tickManager();assert.equal(agent.tokenTank,1500);assert.equal(c.tank,2500);assert.equal(agent.status,'idle');assert.equal(h.api.validSave(g),true);
});
scenario('upgrades change payouts, token use, failure rate, and deploy services', (h) => {
  const g=h.fresh(5);g.cash=1e8;g.totalTasksDone=2000;const a=h.worker();const t=h.task();t.typeId='research';const baseline=h.api.getTaskCashPayout(t,'agent',a);
  h.prepareUpgrade('web_browse');h.api.purchaseUpgrade('web_browse');assert.ok(Math.abs(h.api.getTaskCashPayout(t,'agent',a)-baseline*1.2)<1e-9);
  g.phase=9;h.fullCluster();h.prepareUpgrade('code_review');h.api.purchaseUpgrade('code_review');assert.ok(Math.abs(h.api.getTaskCashPayout(t,'agent',a)-baseline*1.2*1.25)<1e-9);
  h.api.purchaseUpgrade('deploy');assert.equal(g.services.length,2);const cash=g.cash;h.api.tickServices(1);assert.ok(g.cash-cash>=160);
  g.phase=10;h.prepareUpgrade('ai_ceo');h.api.purchaseUpgrade('ai_ceo');g.clusters=[];g.agents=[];for(let i=0;i<5;i++)h.fullCluster();h.api.purchaseUpgrade('server_1');assert.equal(g.services.length,5);
  const cost=g.cash;h.api.purchaseUpgrade('server_1');assert.equal(g.cash,cost);h.api.renderAll();
});
scenario('Scale Mode builds automatically through Phase 12 and replication exceeds 128 nodes', (h) => {
  const g=h.fresh(12);g.cash=1e12;g.ceoMode='scale';h.fullCluster();
  h.window.GAME.openCluster();assert.equal(g.clusters.length,1);h.api.tickAiCeo();assert.equal(g.clusters.length,2);const c=g.clusters[1];assert.equal(c.workforce,0);
  h.advance(6000);h.api.tickConstruction(6);h.api.tickAiCeo();assert.equal(c.workforce,16);const spent=g.cash;h.api.tickAiCeo();assert.equal(g.cash,spent);
  g.phase=13;for(let i=0;i<1100;i++){h.advance(2000);h.api.tickConstruction(2);h.api.tickAiCeo();}assert.ok(g.clusters.length>200);assert.equal(h.api.validSave(g),true);
  g.phase=14;h.api.checkMilestones();h.dismiss();h.api.renderAll();assert.equal(h.window.document.querySelectorAll('.network-grid div.cluster-card').length,g.clusters.length);assert.equal(h.window.document.querySelectorAll('.network-grid div.cluster-card button').length,0);
  assert.equal(h.window.document.querySelector('.network-grid .cluster-card').textContent,'C1');assert.match(h.window.document.querySelector('#delivery-summary').textContent,/delivery revenue/);
});
scenario('DevOps resolves critical incidents more slowly without final approval', (h) => {
  const g=h.fresh(7);h.worker('devops');
  const critical={id:'critical',name:'Critical',sev:'critical',fixProgress:0,createdAt:1,resolved:false,repCost:5,cashCost:0};
  const warning={...critical,id:'warning',name:'Warning',sev:'warning'};g.incidents=[critical,warning];
  h.api.tickDevopsIncidentResponse(10);assert.equal(critical.fixProgress,55);assert.equal(critical.resolved,false);
  h.api.tickDevopsIncidentResponse(30);assert.equal(critical.resolved,true);assert.equal(warning.resolved,true);assert.equal(g.stress,0);
  h.api.resolveIncident('critical','invalid');
});
scenario('selling freezes the company before either ending choice and persists', (h) => {
  const g=h.fresh(15);h.prepareUpgrade('fusion');g.cash=1e10;g.totalTasksDone=2000;g.services=[{id:'service',name:'Service',incomeRate:1000,active:true}];
  for(let i=0;i<100;i++)h.fullCluster();
  assert.equal(h.api.canTrueRetire(),false);h.api.purchaseUpgrade('fusion');assert.equal(g.retired,true);assert.equal(g.retirementFinal,false);assert.equal(h.api.canPrestige(),true);
  assert.equal(h.window.document.querySelector('#game-container').hidden,true);assert.equal(h.window.document.querySelector('#ending-overlay').hidden,false);
  const before=JSON.stringify(g);h.advance(1000);h.api.tick();h.window.GAME.buy('token_pack_2');h.window.GAME.addCash(1000);assert.equal(JSON.stringify(g),before);
  const early=harness(h.window.localStorage.getItem('ai_empire_save'));assert.equal(early.window.GAME.state.retired,true);assert.equal(early.window.document.querySelector('#ending-choices').hidden,false);early.close();
  h.window.GAME.trueRetire();assert.equal(g.retirementFinal,true);assert.equal(h.api.canPrestige(),false);h.window.GAME.prestige();assert.equal(h.window.GAME.state,g);
  const loaded=harness(h.window.localStorage.getItem('ai_empire_save'));assert.equal(loaded.window.GAME.state.retirementFinal,true);assert.equal(loaded.window.document.activeElement.id,'btn-ending-reset');loaded.close();
});
scenario('income is independent of task remaining time and excludes empty tanks', (h) => {
  const g=h.fresh(4);const a=h.worker();a.tokenTank=10;const t=h.task();h.api.assignAgentToTask(t.id,a.id);
  const before=h.api.getIncomeRate();t.workDone=t.workRequired-0.001;assert.equal(h.api.getIncomeRate(),before);
  a.tokenTank=0;assert.ok(h.api.getIncomeRate()<before);
});
scenario('offline earnings only use contracts; reloading cannot collect twice', (h) => {
  const g=h.fresh(9);g.services=[{id:'svc',name:'Service',incomeRate:80,active:true}];g.serviceSlots=1;
  h.advance(60000);h.api.applyOfflineProgress();assert.equal(g.cash,2400);
  h.api.applyOfflineProgress();assert.equal(g.cash,2400);
  assert.equal(h.api.calcOfflineProgress(1),null);assert.equal(h.api.calcOfflineProgress(1e9).seconds,28800);
  g.services=[];const a=h.worker();a.status='working';assert.equal(h.api.calcOfflineProgress(60).earned,0);
});
scenario('save validation rejects malformed, incompatible, unsafe, and dangling state', (h) => {
  const g=h.fresh();assert.equal(h.api.validSave(g),true);
  for(const value of [null,{},[],{...g,saveVersion:0},{...g,phase:16},{...g,cash:-1},{...g,cash:Infinity},{...g,musicMode:'invalid'}]) assert.equal(h.api.validSave(value),false);
  const a=h.worker();const t=h.task();assert.equal(h.api.validSave(g),true);a.currentTask='missing';assert.equal(h.api.validSave(g),false);a.currentTask=null;
  t.name='<img>';assert.equal(h.api.validSave(g),false);
  for(const raw of ['null','{','{"phase":1}']) {const x=harness(raw);assert.equal(x.api.save(),false);assert.equal(x.window.localStorage.getItem('ai_empire_save'),raw);assert.equal(x.window.document.querySelector('#save-notice').hidden,false);x.close();}
});
scenario('expected storage failures are visible; unexpected errors propagate', (h) => {
  h.fresh();const storage=h.window.localStorage;const prototype=Object.getPrototypeOf(storage);const original=prototype.setItem;
  prototype.setItem=()=>{throw new h.window.DOMException('full','QuotaExceededError');};assert.equal(h.api.save(),false);assert.equal(h.window.document.querySelector('#save-notice').hidden,false);
  prototype.setItem=()=>{throw new TypeError('programming error');};assert.throws(()=>h.api.save(),TypeError);
  prototype.setItem=original;assert.equal(h.api.save(),true);assert.equal(h.window.document.querySelector('#save-notice').hidden,true);
});
scenario('prestige retains earned bonuses and music preference', (h) => {
  const g=h.fresh(15);g.musicMode='off';g.retired=true;h.window.document.querySelector('#btn-ending-restart').click();const next=h.window.GAME.state;
  assert.equal(next.phase,1);assert.equal(next.prestigeCount,1);assert.equal(next.clickPower,2);assert.equal(next.tokens,50);assert.equal(next.musicMode,'off');assert.equal(h.api.validSave(next),true);
});
scenario('all phases render without errors and expose controls', (h) => {
  const g=h.fresh();g.cash=1e9;g.tokens=10000;g.totalTasksDone=2000;
  for(let phase=1;phase<=15;phase++){
    g.phase=phase;h.api.checkMilestones();h.dismiss();
    if(phase===9)h.api.addClusterWithNextName();
    for(const upgrade of h.api.UPGRADES.filter(u=>u.phase===phase&&u.oneTime))h.api.purchaseUpgrade(upgrade.id);
    h.dismiss();h.task();h.api.renderAll();
    assert.equal(h.api.validSave(g),true,`phase ${phase}`);
  }
});
scenario('manager hiring burst, role gates, and automation scheduling', (h) => {
  const g=h.fresh(6);g.cash=1e6;g.tokens=100;g.managerUnlock=true;g.agentAutoAssign=true;
  h.api.hireAgent('missing');h.api.hireAgent('devops');h.api.hireAgent('sales');h.api.hireAgent('token_mgr');assert.equal(g.agents.length,0);
  const a=h.worker();const t=h.task();t.typeId='email';h.api.hireAgent('manager');assert.equal(a.status,'working');assert.equal(g.managerTokenTank,25);
  h.api.tickAgentAutoAssign();h.api.fireAgent(g.agents.find(a=>a.roleId==='manager').id);a.status='idle';a.currentTask=null;t.status='available';t.assignedAgent=null;a.autoAssign=false;
  h.advance(2000);h.api.tickAgentAutoAssign();assert.equal(a.status,'idle');a.autoAssign=true;h.advance(2000);h.api.tickAgentAutoAssign();assert.equal(a.status,'working');
  h.api.renderAll();
});
scenario('cluster panel shows ordered management and removes individual worker controls', (h) => {
  const g=h.fresh(9);g.cash=1e6;g.totalTasksDone=1200;
  h.api.openCluster();const c=g.clusters[0];h.api.tickConstruction(12);h.api.buyClusterWorker(c.id,'coder');
  h.api.openCluster();h.api.checkMilestones();h.dismiss();h.api.renderAll();
  const text=h.window.document.querySelector('#cluster-list').textContent;
  assert.match(text,/Provisioning agents/);assert.doesNotMatch(text,/Worker controls|Unassigned workers|Global Utility/);
  const button=h.window.document.querySelector('#cluster-list button');button.focus();h.api.renderAll();assert.equal(h.window.document.activeElement,button);
  h.api.createAiWorkerIncident(h.task());g.incidents[0].fixProgress=90;h.api.renderIncidentSection();assert.match(h.window.document.querySelector('#incident-list').textContent,/DevOps responding/);
});
scenario('storage access failures, explicit resets, and successful recovery', (h) => {
  const prototype=Object.getPrototypeOf(h.window.localStorage);const get=prototype.getItem;const remove=prototype.removeItem;
  prototype.getItem=()=>{throw new h.window.DOMException('denied','SecurityError')};assert.equal(h.api.load(),false);
  prototype.getItem=()=>{throw new TypeError('bad')};assert.throws(()=>h.api.load(),TypeError);prototype.getItem=get;
  prototype.removeItem=()=>{throw new h.window.DOMException('denied','SecurityError')};h.api.performFullReset();assert.match(h.window.document.querySelector('#save-status').textContent,/Reset failed/);
  prototype.removeItem=()=>{throw new TypeError('bad')};assert.throws(()=>h.api.performFullReset(),TypeError);prototype.removeItem=remove;
  h.window.localStorage.setItem('ai_empire_save','test');h.api.performFullReset();assert.equal(h.window.localStorage.getItem('ai_empire_save'),null);
});
scenario('dialog focus, tab loop, escape, settings actions and lifecycle saves', (h) => {
  h.fresh(6);h.api.renderAll();const doc=h.window.document;doc.querySelector('#btn-settings').focus();h.api.openSettingsPopup();assert.equal(doc.activeElement.id,'btn-settings-music');
  for(const button of doc.querySelectorAll('#settings-popup button'))button.getClientRects=()=>[{}];
  let prevented=false;h.api.handleDialogKey({key:'Tab',shiftKey:true,preventDefault(){prevented=true}});assert.equal(prevented,true);
  h.api.handleDialogKey({key:'Tab',shiftKey:false,preventDefault(){}});
  h.api.handleDialogKey({key:'Escape'});assert.equal(doc.activeElement.id,'btn-settings');
  h.api.handleDialogKey({key:'Tab'});
  doc.querySelector('#btn-settings').click();doc.querySelector('#btn-settings-music').click();doc.querySelector('#btn-settings-reset').click();doc.querySelector('#btn-settings-confirm-cancel').click();doc.querySelector('#btn-settings-close').click();
  h.window.dispatchEvent(new h.window.Event('pagehide'));assert.ok(h.window.localStorage.getItem('ai_empire_save'));
  Object.defineProperty(doc,'hidden',{configurable:true,value:true});doc.dispatchEvent(new h.window.Event('visibilitychange'));h.api.tick();
  Object.defineProperty(doc,'hidden',{configurable:true,value:false});doc.dispatchEvent(new h.window.Event('visibilitychange'));
  doc.querySelector('#btn-save-retry').click();
});
scenario('tick pauses dialogs, clamps time jumps and does not expire active work', (h) => {
  const g=h.fresh(3);g.tokens=20;g.totalTasksDone=30;h.api.checkMilestones();h.dismiss();
  h.api.topUpAiWorker();const t=h.task();h.advance(100);h.api.tick();assert.ok(t.workDone>0);
  h.api.openSettingsPopup();const previous=g.totalPlaytime;h.advance(1000);h.api.tick();assert.equal(g.totalPlaytime,previous);h.api.closeSettingsPopup();
  h.advance(60000);h.api.tick();assert.equal(g.lastTick,h.window.Date.now());
  const active=h.task();active.status='active';active.createdAt=0;g.taskExpiryEnabled=true;h.api.pruneTasks(h.window.Date.now());assert.ok(g.tasks.includes(active));
  h.api.renderAll();
});
scenario('development stage helpers terminate and reject unknown stages', (h) => {
  h.window.GAME.cheat('invalid');for(const stage of ['0_1',3,6,9,11]){h.window.GAME.cheat(stage);assert.equal(h.api.validSave(h.window.GAME.state),true);}assert.ok(h.window.GAME.state.gameStarted);
});
test('three deterministic full journeys reach a saved ending without cheats',()=>{
  for(const seed of [17,42,123]) {const result=play(seed);assert.equal(result.stalled,undefined);assert.equal(result.phases.length,15);assert.ok(result.phases.find(p=>p.phase===6).seconds-result.phases.find(p=>p.phase===5).seconds>=35,'Phase 5 has time for its upgrades');assert.ok(result.phases.find(p=>p.phase===9).tasks>=1000000);assert.ok(result.tasks>=1000000);assert.ok(result.offers.find(o=>o.id==='ceo_parallel_clusters').seconds>result.offers.find(o=>o.id==='ceo_deploy_speed').seconds,'Scaling upgrades reveal across the expansion phase');assert.ok(result.offers.find(o=>o.id==='ceo_quad_batch').cash<result.offers.find(o=>o.id==='ceo_quad_batch').cost,'Four-agent provisioning is a savings goal');for(const id of ['pro_model','second_ai','multi_bot']){const offer=result.offers.find(item=>item.id===id);assert.ok(offer.cash<offer.cost,id+' must be a savings goal');}}
});
scenario('all agents retain paid top-ups when managed and simplify in Phase 8', (h) => {
  const g=h.fresh(6);g.totalTasksDone=650;g.tokens=10000;h.worker('manager');const a=h.worker();a.tokenTank=100;h.api.checkMilestones();h.dismiss();h.api.renderAll();
  assert.match(h.window.document.querySelector('#agent-list').textContent,/Top-up tokens/);assert.doesNotMatch(h.window.document.querySelector('#agent-list').textContent,/Auto ON|Auto OFF/);
  g.managerTokenTank=4000;h.api.topUpAgent(a.id);assert.equal(g.tokens,8600);assert.equal(a.tokenTank,1500);
  g.phase=8;h.api.renderAll();assert.doesNotMatch(h.window.document.querySelector('#agent-list').textContent,/SPD|QUA|REL|Managed|Auto ON|Fuel/);assert.equal(h.window.document.querySelector('#section-stats').style.display,'none');
});
scenario('reset buttons require confirmation before discarding saved progress', (h) => {
  const doc=h.window.document;h.window.confirm=()=>false;
  for(const id of ['btn-save-reset','btn-ending-reset']){h.window.localStorage.setItem('ai_empire_save','keep');doc.getElementById(id).click();assert.equal(h.window.localStorage.getItem('ai_empire_save'),'keep');}
  h.window.confirm=()=>true;
  for(const id of ['btn-save-reset','btn-ending-reset']){doc.getElementById(id).click();assert.equal(h.window.localStorage.getItem('ai_empire_save'),null);}
});
scenario('cluster workers cannot be detached fired or individually controlled', (h) => {
  const g=h.fresh(9);g.cash=1e6;h.api.openCluster();const c=g.clusters[0];h.api.tickConstruction(12);h.api.buyClusterWorker(c.id,'writer');
  h.api.tickConstruction(4);const a=g.agents[0];a.tokenTank=10;const t=h.task();h.api.assignAgentToTask(t.id,a.id);
  assert.equal(h.window.GAME.unassignWorker,undefined);h.api.fireAgent(a.id);
  assert.equal(t.status,'agent');assert.equal(a.currentTask,t.id);assert.equal(c.managerAssigned,true);assert.equal(c.workerAgentIds[0],a.id);
  h.api.completeTask(t,'ai_assist');assert.equal(a.currentTask,null);assert.equal(h.api.validSave(g),true);
});
scenario('mobile rotate preference needs no storage permission', (h) => {
  Object.defineProperty(h.window,'innerWidth',{value:390,configurable:true});Object.defineProperty(h.window,'innerHeight',{value:844,configurable:true});h.api.updateRotateOverlay();
  assert.equal(h.window.document.querySelector('#rotate-overlay').classList.contains('show'),true);
  h.window.document.querySelector('#btn-rotate-continue').click();h.api.updateRotateOverlay();assert.equal(h.window.document.querySelector('#rotate-overlay').classList.contains('show'),false);
});
scenario('autopilot sustains work without manual tank refills', (h) => {
  const g=h.fresh(7);g.totalTasksDone=650;g.cash=100000;g.tokens=0;g.managerUnlock=true;g.aiWorkerShutdown=true;g.incidentsExplained=true;
  h.worker('manager');h.worker('token_mgr');h.worker('devops');h.worker('writer');h.worker('coder');h.api.checkMilestones();h.dismiss();
  for(let i=0;i<3000;i++){h.advance(100);h.api.tick();h.dismiss();}
  assert.ok(g.totalTasksDone>700);assert.ok(g.cash>0);assert.equal(h.api.validSave(g),true);
});
scenario('scale requires manage mode; buying an old cluster upgrade cannot exceed the cap', (h) => {
  const g=h.fresh(10);g.cash=1e8;g.totalTasksDone=1600;h.prepareUpgrade('ai_ceo');h.fullCluster();
  h.api.purchaseUpgrade('server_1');assert.equal(g.ceoMode,'off');h.api.checkMilestones();h.dismiss();h.api.renderUpgradeSection();assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/AI CEO Scale Mode/);
  h.api.purchaseUpgrade('ai_ceo');g.clusters=[];g.agents=[];for(let i=0;i<5;i++)h.fullCluster();h.api.purchaseUpgrade('server_1');assert.equal(g.ceoMode,'scale');
  for(let i=0;i<7;i++)h.api.addClusterWithNextName();const cash=g.cash;h.api.purchaseUpgrade('cluster_beta');assert.equal(g.cash,cash);assert.equal(g.clusters.length,12);
  h.api.renderUpgradeSection();assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/Discounted Cluster Lease/);assert.equal(h.api.validSave(g),true);
});
scenario('live rendering preserves controls while values change', (h) => {
  const element=h.window.document.createElement('div');h.window.document.body.appendChild(element);
  h.api.updateHTML(element,"<button onclick='doWork()' disabled title='Old'>One</button><span>Remove</span>");const button=element.firstChild;
  h.api.updateHTML(element,"<button onclick='doWork()' title='New'>Two</button>");assert.equal(element.firstChild,button);assert.equal(button.disabled,false);assert.equal(button.title,'New');assert.equal(button.textContent,'Two');assert.equal(element.childNodes.length,1);
  h.api.updateHTML(element,"<button onclick='doWork()' title='New'>Two</button>");assert.equal(element.firstChild,button);
  h.api.updateHTML(element,"<button onclick='different()'>Another</button>");assert.notEqual(element.firstChild,button);
  h.api.updateHTML(element,'text');assert.equal(element.textContent,'text');h.api.updateHTML(element,'<p>Next</p>');assert.equal(element.firstChild.tagName,'P');
});
scenario('empty and locked panels clear prior DOM content', (h) => {
  const g=h.fresh();g.uiRevealed.agents=true;g.uiRevealed.prestige=true;h.api.renderAgentSection();h.api.renderPrestigeSection();h.api.renderTaskQueue();
  assert.equal(h.window.document.querySelector('#task-list').textContent,'');assert.equal(h.window.document.querySelector('#section-prestige').style.display,'none');
  g.phase=2;g.aiWorkerShutdown=true;h.api.renderAgentSection();assert.equal(h.window.document.querySelector('#agent-list').textContent,'');
  h.window.document.querySelector('#offline-popup').classList.add('show');h.window.document.querySelector('#btn-dismiss-offline').click();assert.equal(h.window.document.querySelector('#offline-popup').classList.contains('show'),false);
});
scenario('manual work can start from a full or partly filled tank without buying fuel', (h) => {
  const g=h.fresh(4);g.tokens=0;const a=h.worker();a.autoAssign=false;a.tokenTank=10;const t=h.task();h.api.topUpAgent(a.id);
  assert.equal(a.currentTask,t.id);assert.equal(g.tokens,0);assert.equal(a.tokenTank,10);
  h.api.completeTask(t,'agent');a.tokenTank=5;const next=h.task();h.api.topUpAgent(a.id);assert.equal(a.currentTask,next.id);assert.equal(g.tokens,0);
});
scenario('reset cannot be undone by the pagehide autosave', (h) => {
  h.fresh();h.api.save();h.api.performFullReset();h.window.dispatchEvent(new h.window.Event('pagehide'));
  assert.equal(h.window.localStorage.getItem('ai_empire_save'),null);assert.equal(h.api.save(),false);
});
scenario('token top-up stays enabled even when the reserve is empty', (h) => {
  const g=h.fresh(4);g.tokens=0;g.uiRevealed.agents=true;const a=h.worker();a.tokenTank=5;h.api.renderAgentSection();
  const button=h.window.document.querySelector('[onclick="GAME.topUpAgent(\''+a.id+'\')"]');assert.equal(button.disabled,false);
  g.tokens=50;h.api.renderAgentSection();assert.equal(button.disabled,false);h.api.topUpAgent(a.id);assert.equal(a.tokenTank,55);assert.equal(g.tokens,0);
});
scenario('task quality affects cash without a separate reputation resource', (h) => {
  const g=h.fresh(4);g.totalTasksDone=25;g.codeQualityMult=1.25;const a=h.worker();a.quality=2;a.tokenTank=10;const t=h.task();h.api.assignAgentToTask(t.id,a.id);h.api.renderTaskQueue();
  assert.doesNotMatch(h.window.document.querySelector('#task-list').textContent,/Rep:/);assert.equal('reputation' in g,false);
  const cash=g.cash;const expected=h.api.getTaskCashPayout(t,'agent',a);h.api.completeTask(t,'agent');assert.equal(g.cash-cash,expected);
});
scenario('fast tasks finish immediately and completed cards do not obstruct the first work button', (h) => {
  const g=h.fresh(3);g.clickPower=10000;g.aiFailMult=0;g.aiWorkerTokenTank=10;
  const t=h.task();h.advance(1);const next=h.task();h.api.tickAiWorker(0.1);assert.equal(t.status,'done');assert.equal(g.totalTasksDone,1);
  h.api.renderTaskQueue();assert.doesNotMatch(h.window.document.querySelector('#task-list').textContent,/Completed/);
  assert.equal(h.window.document.querySelector('#task-list button').getAttribute('onclick'),"GAME.clickTask('"+next.id+"', event)");
  h.api.pruneTasks(h.window.Date.now());assert.equal(g.tasks.length,1);
});
scenario('worker top-ups conserve tokens with and without an online Manager', (h) => {
  const g=h.fresh(6);g.tokens=5000;g.managerUnlock=true;g.agentSlots=6;g.cash=1e6;
  h.api.hireAgent('manager');assert.equal(g.tokens,1000);assert.equal(g.managerTokenTank,4000);
  const a=h.worker();h.api.tickManager();assert.equal(g.aiWorkerTokenTank,25);assert.equal(a.tokenTank,25);assert.equal(g.managerTokenTank,3950);
  a.tokenTank=1300;h.api.topUpAgent(a.id);assert.equal(g.tokens,800);assert.equal(a.tokenTank,1500);
  g.managerTokenTank=0;a.tokenTank=1400;h.api.topUpAgent(a.id);assert.equal(g.tokens,700);assert.equal(a.tokenTank,1500);
  g.aiWorkerTokenTank=0;g.tokens=2;h.api.topUpAiWorker();assert.equal(g.tokens,0);assert.equal(g.aiWorkerTokenTank,2);
  g.tokens=1000;g.phase=7;h.api.tickTokenManager();assert.equal(g.tokens,1000);
});
scenario('management order stays fixed and locked roles have no placeholders', (h) => {
  const g=h.fresh(7);g.uiRevealed.agents=true;g.managerUnlock=true;g.agentSlots=8;g.purchasedUpgrades.push('token_manager_unlock','devops_unlock');
  h.worker('writer');h.worker('devops');h.worker('token_mgr');h.worker('manager');h.api.renderAgentSection();
  const roles=[...h.window.document.querySelectorAll('#agent-list .agent-info .role')].map(el=>el.textContent);
  assert.match(roles[0],/Manager/);assert.match(roles[1],/Token Mgr/);assert.doesNotMatch(roles.join(' '),/DevOps/);h.api.renderIncidentSection();assert.match(h.window.document.querySelector('#incident-devops').textContent,/DevOps/);
  g.agents=[];g.phase=4;g.managerUnlock=false;g.purchasedUpgrades=[];h.api.renderAgentSection();
  assert.doesNotMatch(h.window.document.querySelector('#agent-list').textContent,/Manager|DevOps/);
  assert.equal(h.window.document.querySelectorAll('#agent-list .agent-vacancy').length,8);
});
scenario('node production consumes real tokens and stops when empty', (h) => {
  const g=h.fresh(12);g.cash=100000;const c=h.api.addClusterWithNextName();c.managerAssigned=true;c.tokenManagerAssigned=true;c.workforce=8;c.tank=1200;
  h.api.tickNetwork(2);assert.equal(g.cash,100120);assert.equal(c.tank,0);assert.equal(g.totalTasksDone,2);
  h.api.tickNetwork(2);assert.equal(g.cash,100120);h.api.tickTokenManager();assert.equal(g.tokens,49750);assert.match(g.log[0].msg,/Purchased/);
  h.advance(2000);h.api.tickTokenManager();assert.equal(c.tank,500);const before=g.cash;h.api.tickNetwork(1);assert.equal(g.cash,before+50);
  g.phase=14;g.cash=1e10;g.totalTasksDone=10000;h.prepareUpgrade('retire_unlock');h.api.purchaseUpgrade('retire_unlock');assert.equal(g.phase,14);
  while(g.clusters.length<100){const item=h.api.addClusterWithNextName();item.managerAssigned=true;item.tokenManagerAssigned=true;item.workforce=8;}
  h.api.purchaseUpgrade('retire_unlock');assert.equal(g.phase,15);assert.equal(h.api.validSave(g),true);
});
scenario('cluster construction and node upgrades enforce stage, capacity and funds', (h) => {
  const g=h.fresh(9);g.cash=0;h.api.openCluster();assert.equal(g.clusters.length,0);
  g.cash=1e6;h.api.openCluster();const c=g.clusters[0];h.api.buyClusterWorker(c.id,'writer');assert.equal(g.agents.length,0);
  g.cash=0;h.api.tickConstruction(12);assert.equal(c.managerAssigned,true);g.cash=1e6;h.api.tickConstruction(12);
  h.api.buyClusterWorker('missing');assert.equal(g.agents.length,0);
  g.cash=0;h.api.buyClusterWorker(c.id,'writer');assert.equal(g.agents.length,0);g.cash=1e6;
  for(let i=0;i<9;i++)h.api.buyClusterWorker(c.id,'coder');assert.equal(g.agents.length,8);
  g.phase=12;g.ceoMode='scale';const empty=h.api.addClusterWithNextName();g.cash=0;h.api.tickAiCeo();assert.equal(empty.managerAssigned,false);
  g.cash=1e6;h.advance(6000);h.api.tickConstruction(6);h.api.tickAiCeo();assert.equal(c.workforce,8);h.advance(5000);h.api.tickAiCeo();assert.equal(empty.workforce,16);assert.equal(empty.managerAssigned,true);
  g.cash=0;h.advance(5000);h.api.tickAiCeo();assert.equal(g.clusters.length,2);
});
scenario('Token Manager can supply workers before a Manager is hired', (h) => {
  const g=h.fresh(7);g.tokens=50;h.worker('token_mgr');const a=h.worker();
  h.api.tickTokenManager();assert.equal(a.tokenTank,50);assert.equal(g.tokens,0);assert.equal(g.managerTokenTank,0);
});
scenario('an empty Manager keeps assigning jobs until worker tokens run out', (h) => {
  const g=h.fresh(6);g.aiWorkerShutdown=true;g.smartRouting=true;h.worker('manager');const a=h.worker();a.tokenTank=1500;a.tokenCost=1;a.reliability=2;
  const t=h.task();t.workRequired=1e9;h.api.tickManager();assert.equal(g.managerTokenTank,0);assert.equal(a.currentTask,t.id);
  h.api.tickAgents(5);assert.equal(a.tokenTank,750);assert.equal(a.status,'working');h.api.tickAgents(5);assert.equal(a.tokenTank,0);h.api.tickAgents(0.1);assert.equal(a.status,'idle');
});
scenario('eight busy Phase 6 workers consume tens of thousands of tokens per minute', (h) => {
  const g=h.fresh(6);g.aiWorkerShutdown=true;g.tokenEfficiency=0.8*0.75*0.67;
  for(let i=0;i<8;i++){const a=h.worker();a.tokenTank=1500;a.tokenCost=1;a.reliability=2;const t=h.task();t.workRequired=1e9;h.api.assignAgentToTask(t.id,a.id);}
  const rate=h.api.tokenBurnRate();assert.ok(rate*60>20000);assert.ok(rate*60<40000);
  h.api.tickAgents(10);assert.ok(Math.abs(g.agents.reduce((total,a)=>total+a.tokenTank,0)-(12000-rate*10))<0.001);
  g.uiRevealed.topBar=true;h.api.checkMilestones();h.dismiss();h.api.renderTopBar();assert.match(h.window.document.querySelector('#token-burn').textContent,/tok\/s/);
});
scenario('token prices rise with purchases while incident costs track earned wealth', (h) => {
  const g=h.fresh(6);g.cash=1e9;const pack=h.api.UPGRADES.find(u=>u.id==='token_pack_1');const cheap=h.api.getUpgradeCost(pack);
  const task=h.task();h.api.createAiWorkerIncident(task);const early=g.incidents[0].cashCost;
  g.totalCashEarned=1e8;assert.equal(h.api.getUpgradeCost(pack),cheap);h.api.createAiWorkerIncident(task);assert.ok(g.incidents.at(-1).cashCost>early*10);
  h.api.purchaseUpgrade(pack.id);assert.equal(g.tokenPacksBought,1);assert.ok(h.api.getUpgradeCost(pack)>cheap);
  const next=h.api.getUpgradeCost(pack);g.cash=next;h.api.buyTokenPacks(pack,3);assert.equal(g.cash,0);assert.equal(g.tokenPacksBought,2);
  const price=h.api.getUpgradeCost(pack);g.cash=1e9;assert.equal(h.api.getUpgradeCost(pack),price);
});
scenario('token-manager slot is reserved before another worker slot unlocks', (h) => {
  const g=h.fresh(6);g.cash=1e7;g.totalTasksDone=150000;g.managerUnlock=true;g.agentSlots=6;g.aiWorkerShutdown=true;h.prepareUpgrade('token_manager_unlock');
  for(const role of ['manager','writer','coder','researcher','analyst','support'])h.worker(role);
  h.api.purchaseUpgrade('token_manager_unlock');assert.equal(g.phase,7);assert.equal(g.agentSlots,7);
  h.api.purchaseUpgrade('agent_slot_7');assert.equal(g.agentSlots,7);
  h.api.checkMilestones();h.dismiss();h.api.renderAgentSection();assert.match(h.window.document.querySelector('.token-manager-slot').textContent,/Buy Token Manager/);
  h.api.hireAgent('token_mgr');g.purchasedUpgrades.push('devops_unlock');h.api.hireAgent('devops');assert.equal(g.agents.length,8);h.api.renderAgentSection();assert.equal(h.window.document.querySelectorAll('.agent-vacancy').length,1);
  h.prepareUpgrade('ops_flywheel');h.api.purchaseUpgrade('ops_flywheel');h.api.purchaseUpgrade('agent_slot_7');assert.equal(g.agentSlots,8);h.api.renderAgentSection();assert.match(h.window.document.querySelector('.agent-vacancy').textContent,/Sales/);
});
scenario('cluster permits gate provisioning and sales do not reset rising prices', (h) => {
  const g=h.fresh(9);g.cash=1e9;g.totalTasksDone=2000;h.prepareUpgrade('code_agents');const first=h.fullCluster();
  h.api.openCluster();assert.equal(g.clusters.length,1);h.api.checkMilestones();h.dismiss();h.api.renderClusterSection();assert.equal(h.window.document.querySelector('[onclick="GAME.openCluster()"]'),null);
  h.api.purchaseUpgrade('cluster_capacity_2');assert.equal(h.api.clusterCapacity(),1);h.api.purchaseUpgrade('code_agents');h.api.purchaseUpgrade('cluster_capacity_2');
  const price=h.api.provisionCost();h.api.openCluster();const second=g.clusters[1];h.api.openCluster();assert.equal(g.clusters.length,2);assert.ok(h.api.provisionCost()>price);
  h.api.purchaseUpgrade('cluster_capacity_3');assert.equal(h.api.clusterCapacity(),2);h.api.tickConstruction(12);
  h.api.renderClusterSection();assert.equal(h.window.document.querySelectorAll('.node-grid .capacity-slot').length,16);
  h.api.sellCluster(second.id);assert.equal(g.clusters.length,2);for(let i=0;i<8;i++)h.api.buyClusterWorker(second.id);h.api.tickConstruction(4);
  h.api.purchaseUpgrade('cluster_capacity_3');assert.equal(h.api.clusterCapacity(),3);
  const a=g.agents.find(item=>second.workerAgentIds.includes(item.id));a.tokenTank=100;const t=h.task();h.api.assignAgentToTask(t.id,a.id);
  const cash=g.cash;const resale=h.api.clusterSaleValue(second);const nextPrice=h.api.provisionCost();h.api.sellCluster(second.id);
  assert.equal(g.cash,cash+resale);assert.ok(resale<second.invested);assert.equal(g.clusters.length,1);assert.equal(g.agents.length,8);assert.equal(t.status,'available');assert.equal(h.api.provisionCost(),nextPrice);
  h.api.openCluster();assert.equal(g.clusters[1].name,'Cluster 3');assert.equal(h.api.validSave(g),true);
});
scenario('CEO Manage Mode staffs existing clusters without provisioning and displays its job', (h) => {
  const g=h.fresh(10);g.cash=1e9;g.totalTasksDone=2000000;h.prepareUpgrade('ai_ceo');for(let i=0;i<3;i++)h.fullCluster();g.uiRevealed.clusters=true;g.uiRevealed.upgrades=true;
  h.api.renderClusterSection();assert.ok(h.window.document.querySelector('.ceo-slot'));h.api.renderUpgradeSection();assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/AI CEO \(Manage Mode\)/);
  h.api.purchaseUpgrade('ai_ceo');assert.ok(g.clusters.every(c=>c.workerSlotsMax===16&&c.workerAgentIds.length===8));assert.equal(h.api.canManuallyProvisionCluster(),false);
  for(let i=0;i<24;i++){h.advance(5000);h.api.tickConstruction(5);h.api.tickAiCeo();}h.api.tickConstruction(4);assert.equal(h.api.canManuallyProvisionCluster(),true);assert.equal(g.clusters.length,3);
  h.window.GAME.openCluster();assert.equal(g.clusters.length,4);assert.equal(h.api.canManuallyProvisionCluster(),false);h.api.renderUpgradeSection();assert.match(h.window.document.querySelector('#upgrade-list').textContent,/Provisioning Pipeline/);
  h.api.tickConstruction(12);for(let i=0;i<16;i++){h.advance(5000);h.api.tickAiCeo();h.api.tickConstruction(4);}assert.equal(h.api.canManuallyProvisionCluster(),true);
  h.window.GAME.openCluster();assert.equal(g.clusters.length,5);h.api.tickConstruction(12);for(let i=0;i<16;i++){h.advance(5000);h.api.tickAiCeo();h.api.tickConstruction(4);}h.api.purchaseUpgrade('server_1');assert.equal(g.ceoMode,'scale');
  h.window.GAME.openCluster();assert.equal(g.clusters.length,5);h.advance(2500);h.api.tickAiCeo();assert.equal(g.clusters.length,6);h.api.renderClusterSection();assert.equal(h.window.document.querySelector('.provision-card'),null);
});
scenario('automatic token purchases sustain a fully staffed hundred-node network', (h) => {
  const g=h.fresh(14);g.cash=1e9;g.tokenEfficiency=0.402;
  for(let i=0;i<100;i++){const c=h.api.addClusterWithNextName();c.workforce=8;c.managerAssigned=true;c.tokenManagerAssigned=true;}
  for(let i=0;i<600;i++){h.advance(100);h.api.tickTokenManager();h.api.tickNetwork(0.1);}
  assert.ok(g.clusters.every(c=>c.tank>0));assert.ok(g.totalTasksDone>11000);assert.ok(g.tokens>0);assert.equal(h.api.validSave(g),true);
  g.uiRevealed.upgrades=true;g.uiRevealed.clusters=true;h.api.renderUpgradeSection();h.api.renderWorkStream();
  assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/Add Another Worker Slot/);
  assert.match(h.window.document.querySelector('#delivery-summary').textContent,/100 managed nodes/);
});
scenario('second subscription is mandatory and both workers retain tokens and jobs at licensing', (h) => {
  const g=h.fresh(3);g.cash=1e6;g.tokens=200;g.totalTasksDone=800;h.prepareUpgrade('second_ai');g.uiRevealed.agents=true;g.uiRevealed.upgrades=true;
  h.api.purchaseUpgrade('multi_bot');assert.equal(g.phase,3);h.api.renderUpgradeSection();assert.equal(h.window.document.querySelector('[onclick="GAME.buy(\'multi_bot\')"]'),null);
  h.api.purchaseUpgrade('second_ai');const second=g.agents[0];assert.equal(g.agents.length,1);h.api.purchaseUpgrade('second_ai');assert.equal(g.agents.length,1);
  g.tasks=[];g.aiWorkerCurrentTaskId=null;second.currentTask=null;second.status='idle';h.api.renderAgentSection();assert.equal(h.window.document.querySelectorAll('#agent-list button').length,2);assert.match(h.window.document.querySelector('#agent-slots').textContent,/Two AI/);
  h.api.topUpAiWorker();h.api.topUpAgent(second.id);assert.equal(g.tokens,120);assert.equal(second.tokenTank,40);h.api.fireAgent(second.id);assert.equal(g.agents.length,1);
  const originalTask=h.task();originalTask.workRequired=1e6;g.aiFailMult=0;h.api.tickAiWorker(0.1);const loaded=g.aiWorkerTokenTank;
  const secondTask=h.task();secondTask.workRequired=1e6;h.api.assignAgentToTask(secondTask.id,second.id);const secondTokens=second.tokenTank;g.aiWorkerTasksCompleted=12;
  h.api.purchaseUpgrade('multi_bot');assert.equal(g.phase,4);assert.equal(g.agents.length,2);assert.equal(g.aiWorkerShutdown,true);assert.equal(g.aiWorkerTokenTank,0);
  const original=g.agents.find(a=>a.roleId==='writer');assert.equal(original.tokenTank,loaded);assert.equal(original.tasksCompleted,12);assert.equal(original.currentTask,originalTask.id);assert.equal(originalTask.assignedAgent,original.id);assert.equal(second.tokenTank,secondTokens);assert.equal(second.currentTask,secondTask.id);
  assert.equal(h.api.validSave(g),true);h.api.fireAgent(original.id);h.api.hireAgent('writer');assert.equal(g.agents.length,2);
});
scenario('sale conditions gate the upgrade and restarting preserves bonuses without sales replay', (h) => {
  const g=h.fresh(15);g.cash=1e9;g.totalTasksDone=2000;g.uiRevealed.upgrades=true;h.prepareUpgrade('fusion');for(let i=0;i<100;i++)h.fullCluster();g.techDebt=20;
  h.api.purchaseUpgrade('fusion');assert.equal(g.retired,false);h.api.renderUpgradeSection();assert.equal(h.window.document.querySelector('[onclick="GAME.buy(\'fusion\')"]').disabled,true);
  h.window.GAME.trueRetire();assert.equal(g.retirementFinal,false);h.window.GAME.prestige();assert.equal(h.window.GAME.state,g);
  g.retired=true;g.retirementValue=100000;g.prestigeCount=1;g.prestigeBonusClick=1;g.prestigeBonusTokens=50;h.api.renderAll();h.window.document.querySelector('#btn-ending-restart').click();
  const next=h.window.GAME.state;assert.equal(next.retired,false);assert.equal(next.prestigeCount,2);assert.equal(next.clickPower,3);assert.equal(next.tokens,125);assert.equal(next.gameStarted,false);assert.equal(next.uiRevealed.taskQueue,false);
  assert.equal(h.api.validSave({...next,retirementFinal:true}),false);assert.match(h.window.document.querySelector('#intro-story').textContent,/bored/);
  h.window.document.querySelector('#btn-start-game').click();assert.equal(next.gameStarted,true);assert.equal(next.tasks.length,0);h.api.doEarlyTask();h.api.tickManualWork(1);assert.equal(next.totalTasksDone,1);
});
scenario('the older Pro model is visibly slow and can be sold for a faster replacement', (h) => {
  const g=h.fresh(3);g.cash=1e6;g.totalTasksDone=800;g.tokens=200;h.prepareUpgrade('second_ai');h.api.purchaseUpgrade('second_ai');h.api.purchaseUpgrade('multi_bot');
  const original=g.agents.find(agent=>agent.olderModel);const task=h.task();const slow=h.api.workerSpeed(task,original);h.api.renderAgentSection();g.uiRevealed.agents=true;h.api.renderAgentSection();
  assert.match(h.window.document.querySelector('#agent-list').textContent,/Older model · slow/);assert.doesNotMatch(h.window.document.querySelector('#agent-list').textContent,/Auto ON|Dismiss/);
  const saved=harness(JSON.stringify(g));try{assert.equal(saved.window.GAME.state.agents.find(agent=>agent.id===original.id).olderModel,true);}finally{saved.close();}
  h.api.fireAgent(original.id);h.api.hireAgent('writer');const replacement=g.agents.find(agent=>agent.roleId==='writer');assert.equal(replacement.olderModel,false);assert.ok(h.api.workerSpeed(task,replacement)>slow*2);
});
scenario('replication is revealed at twenty nodes and waits for the required online capacity', (h) => {
  for(const existing of [3,12]) {
    const g=h.fresh(11);g.cash=1e9;g.totalTasksDone=2000000;g.ceoMode='scale';g.uiRevealed.upgrades=true;h.prepareUpgrade('autonomous_nodes');
    for(let i=0;i<existing;i++)h.fullCluster();h.api.purchaseUpgrade('autonomous_nodes');h.api.purchaseUpgrade('ceo_continuous');const target=Math.max(20,existing+9);assert.equal(g.replicationTarget,target);
    h.api.renderUpgradeSection();assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/Node Replication/);
    while(g.clusters.length<target)h.fullCluster();
    h.api.renderUpgradeSection();const button=h.window.document.querySelector('[onclick="GAME.buy(\'replication\')"]');assert.ok(button);assert.match(button.closest('.card').textContent,new RegExp('\\('+target+' nodes\\)'));assert.doesNotMatch(button.closest('.card').textContent,/reached|managed nodes/);
    g.clusters.at(-1).workforce=0;h.api.purchaseUpgrade('replication');assert.equal(g.phase,12);h.api.renderUpgradeSection();assert.equal(button.disabled,true);
    const restored=harness(JSON.stringify(g));try{assert.equal(restored.window.GAME.state.replicationTarget,target);}finally{restored.close();}
    h.advance(5000);h.api.tickAiCeo();h.api.purchaseUpgrade('replication');assert.equal(g.phase,13);h.advance(2000);h.api.tickAiCeo();assert.equal(g.clusters.length,target+2);
  }
});
scenario('upgrades reveal in order after Reality Check and task milestones', (h) => {
  const g=h.fresh();g.cash=1e9;g.totalTasksDone=149;g.uiRevealed.upgrades=true;h.prepareUpgrade('free_ai');h.api.checkMilestones();h.dismiss();
  const upgrade=id=>h.api.UPGRADES.find(u=>u.id===id);
  assert.ok(g.milestonesReached.includes('expenses_unlock'));assert.equal(h.api.upgradeVisible(upgrade('free_ai')),false);
  g.totalTasksDone=150;h.api.purchaseUpgrade('free_ai');assert.equal(g.phase,2);h.api.renderUpgradeSection();assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/Prompt|Pro AI/);
  g.totalTasksDone=199;h.api.purchaseUpgrade('prompt_basics');assert.equal(g.purchasedUpgrades.includes('prompt_basics'),false);
  g.totalTasksDone=200;h.api.purchaseUpgrade('prompt_examples');assert.equal(g.purchasedUpgrades.includes('prompt_examples'),true);assert.equal(h.api.upgradeVisible(upgrade('prompt_basics')),false);
  g.totalTasksDone=300;h.api.purchaseUpgrade('pro_model');assert.equal(g.phase,2);h.api.purchaseUpgrade('prompt_examples');h.api.purchaseUpgrade('marketing_campaign');h.api.purchaseUpgrade('pro_model');assert.equal(g.phase,3);
  g.totalTasksDone=361;h.api.renderUpgradeSection();assert.match(h.window.document.querySelector('#upgrade-list').textContent,/Token Optimizer/);assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/Second AI/);
  g.totalTasksDone=1000;h.api.purchaseUpgrade('second_ai');assert.equal(g.agents.length,0);h.prepareUpgrade('second_ai');h.api.purchaseUpgrade('second_ai');h.api.purchaseUpgrade('multi_bot');assert.equal(g.phase,4);
  h.api.purchaseUpgrade('agent_slot_5');assert.equal(g.agentSlots,2);h.prepareUpgrade('agent_slot_3');h.worker('coder');h.api.purchaseUpgrade('agent_slot_3');assert.equal(g.agentSlots,3);
  h.api.purchaseUpgrade('tool_use');assert.equal(g.phase,4);h.prepareUpgrade('agent_slot_5');h.api.purchaseUpgrade('agent_slot_5');g.totalTasksDone=1150;h.api.purchaseUpgrade('tool_use');assert.equal(g.phase,5);
});
scenario('phase progression needs a Manager and full clusters before later upgrades appear', (h) => {
  const g=h.fresh(6);g.cash=1e9;g.totalTasksDone=150000;g.managerUnlock=true;h.prepareUpgrade('token_manager_unlock');h.api.purchaseUpgrade('token_manager_unlock');assert.equal(g.phase,6);
  h.worker('manager');h.api.purchaseUpgrade('token_manager_unlock');assert.equal(g.phase,7);
  g.phase=9;g.agents=[];h.prepareUpgrade('code_agents');const first=h.api.addClusterWithNextName();first.managerAssigned=true;first.tokenManagerAssigned=true;
  h.api.purchaseUpgrade('code_agents');assert.equal(g.purchasedUpgrades.includes('code_agents'),false);
  for(let i=0;i<8;i++)h.api.buyClusterWorker(first.id);h.api.tickConstruction(4);h.api.purchaseUpgrade('code_agents');h.api.purchaseUpgrade('cluster_capacity_2');
  h.api.purchaseUpgrade('cluster_capacity_3');assert.equal(h.api.clusterCapacity(),2);
  h.api.openCluster();const second=g.clusters[1];assert.equal(second.managerAssigned,false);h.api.tickConstruction(12);for(let i=0;i<8;i++)h.api.buyClusterWorker(second.id);h.api.tickConstruction(4);
  h.api.purchaseUpgrade('cluster_capacity_3');assert.equal(h.api.clusterCapacity(),3);h.prepareUpgrade('ceo_readiness');h.api.purchaseUpgrade('ceo_readiness');assert.equal(g.phase,9);
  h.fullCluster();g.totalTasksDone=1200000;h.api.purchaseUpgrade('ceo_readiness');assert.equal(g.phase,10);
});
scenario('token display uses whole numbers and smooths actual consumption between jobs', (h) => {
  const g=h.fresh(3);g.totalTasksDone=361;g.aiWorkerTokenTank=40;g.aiFailMult=0;g.tokens=1234.56;h.api.checkMilestones();h.dismiss();const t=h.task();t.workRequired=1e9;
  for(let i=0;i<30;i++){h.advance(100);h.api.tick();h.dismiss();}
  assert.ok(g.tokensConsumed>0);const average=g.averageTokenBurn;assert.ok(average>1);g.aiWorkerTokenTank=0;
  h.advance(100);h.api.tick();assert.ok(g.averageTokenBurn>average*0.95);assert.ok(g.averageTokenBurn<average);
  h.api.renderAll();assert.equal(h.window.document.querySelector('#res-tokens').textContent,'1,235');assert.match(h.window.document.querySelector('#token-burn').textContent,/^\d[\d,]* tok\/s$/);
  assert.doesNotMatch(h.window.document.querySelector('#agent-list').textContent,/\d\.\d.*tokens/);
});
scenario('Manager distributes small paid increments without preventing job assignment', (h) => {
  const g=h.fresh(6);g.aiWorkerShutdown=true;g.smartRouting=true;g.managerTokenTank=4000;h.worker('manager');const a=h.worker();const t=h.task();t.workRequired=1e9;
  h.api.tickManager();assert.equal(a.tokenTank,25);assert.equal(g.managerTokenTank,3975);assert.equal(a.currentTask,t.id);
  h.advance(100);h.api.tickManager();assert.equal(a.tokenTank,50);assert.equal(g.managerTokenTank,3950);
  const total=a.tokenTank+g.managerTokenTank;h.advance(100);h.api.tickManager();assert.equal(a.tokenTank+g.managerTokenTank,total);
});
scenario('CEO training speeds construction and DevOps retires technical debt automatically', (h) => {
  const g=h.fresh(10);g.cash=1e9;g.ceoMode='scale';h.api.openCluster();const first=g.clusters[0];assert.equal(first.buildDuration,12);
  h.api.tickConstruction(3);assert.equal(first.buildRemaining,9);g.uiRevealed.clusters=true;h.api.renderClusterSection();assert.match(h.window.document.querySelector('#cluster-list').textContent,/Racking hardware/);
  g.phase=11;h.api.openCluster();assert.equal(g.clusters[1].buildDuration,6);g.phase=14;h.api.openCluster();assert.equal(g.clusters[2].buildDuration,2);
  h.api.tickConstruction(20);first.managerAssigned=true;first.tokenManagerAssigned=true;g.techDebt=10;h.api.tickDebt(10);assert.equal(g.techDebt,0);assert.equal(h.api.UPGRADES.some(u=>u.id==='pay_debt'),false);
});
scenario('prestige stops music and restores the introduction and first manual task', (h) => {
  const g=h.fresh(15);g.totalTasksDone=2000;h.api.unlockMusicPlayback();assert.ok(h.audioPlayers.some(player=>!player.paused));
  g.retired=true;h.window.GAME.prestige();const next=h.window.GAME.state;assert.ok(h.audioPlayers.every(player=>player.paused));assert.equal(next.gameStarted,false);assert.equal(next.tasks.length,0);assert.equal(next.milestonesReached.length,0);
  h.api.renderWorkStream();assert.equal(h.window.document.querySelector('#task-queue-section').style.display,'none');assert.match(h.window.document.querySelector('#intro-story').textContent,/bored/);
  h.window.document.querySelector('#btn-start-game').click();assert.equal(next.gameStarted,true);h.api.doEarlyTask();h.api.tickManualWork(1);assert.equal(next.totalTasksDone,1);assert.equal(next.uiRevealed.taskQueue,false);
});
scenario('ordinary upgrades appear in affordable and aspirational groups while transitions stay gated', (h) => {
  const g=h.fresh();g.totalTasksDone=15;g.cash=40;g.uiRevealed.upgrades=true;h.api.renderUpgradeSection();
  const cards=[...h.window.document.querySelectorAll('#upgrade-list .upgrade-card')];assert.equal(cards.length,3);assert.equal(cards.filter(card=>card.querySelector('button').disabled).length,2);
  g.totalTasksDone=150;assert.equal(h.api.upgradeVisible(h.api.UPGRADES.find(u=>u.id==='free_ai')),false);
  g.totalTasksDone=0;h.api.renderUpgradeSection();h.api.renderTaskQueue();assert.equal(h.window.document.querySelector('#upgrade-list').textContent,'');assert.equal(h.window.document.querySelector('#no-tasks').textContent,'');assert.ok(h.window.document.querySelector('.upgrade-space'));
  g.phase=9;h.api.renderUpgradeSection();assert.ok(h.window.document.querySelector('.upgrade-space'));assert.equal(h.window.document.querySelectorAll('#upgrade-list .upgrade-card').length,0);assert.match(h.window.document.querySelector('#upgrade-list').textContent,/Token Pack/);
  for(const upgrade of h.api.UPGRADES)assert.doesNotMatch(upgrade.desc,/Unlocks? Phase|Required before|Phase \d+ begins|for a Sales agent/);
});
scenario('Basic and Pro AI agents share token markup and button styling across licensing', (h) => {
  const g=h.fresh(3);g.totalTasksDone=800;g.cash=1e6;g.uiRevealed.agents=true;h.prepareUpgrade('second_ai');h.api.purchaseUpgrade('second_ai');h.api.renderAgentSection();
  const cards=[...h.window.document.querySelectorAll('#agent-list .agent-card')];assert.equal(cards.length,2);assert.deepEqual(cards.map(card=>card.querySelector('.name').firstChild.textContent.trim()),['AI 2000 Basic','AI 2000 Pro']);
  for(const card of cards){assert.equal(card.querySelector('.role').textContent,'');assert.equal(card.querySelector('.agent-token-count').nextElementSibling.className,'task-bar');}
  assert.equal(cards[0].querySelector('button').className,cards[1].querySelector('button').className);
  h.api.purchaseUpgrade('multi_bot');h.api.renderAgentSection();const text=h.window.document.querySelector('#agent-list').textContent;assert.match(text,/AI 2000 Basic/);assert.match(text,/Older model · slow/);assert.doesNotMatch(text,/sell to replace|AI subscription|worker/i);
  assert.equal(h.window.document.querySelectorAll('.agent-token-count').length,2);assert.deepEqual([...h.window.document.querySelectorAll('#agent-list .name')].map(el=>el.firstChild.textContent.trim()),['AI 2000 Basic','AI 2000 Pro']);
});
scenario('DevOps hiring and its agent card live in Incidents while management is highlighted', (h) => {
  const g=h.fresh(7);g.cash=1e6;g.agentSlots=8;g.managerUnlock=true;g.uiRevealed.agents=true;g.purchasedUpgrades.push('token_manager_unlock','devops_unlock');h.worker('manager');h.worker('token_mgr');
  h.api.renderAgentSection();h.api.renderIncidentSection();assert.equal(h.window.document.querySelectorAll('#agent-list .management-agent').length,2);assert.doesNotMatch(h.window.document.querySelector('#agent-list').textContent,/DevOps/);
  const hire=h.window.document.querySelector('#incident-devops button');assert.equal(hire.disabled,false);h.api.hireAgent('devops');h.api.renderAll();assert.match(h.window.document.querySelector('#incident-devops .agent-card').textContent,/DevOps/);
  const devops=g.agents.find(agent=>agent.roleId==='devops');h.api.fireAgent(devops.id);g.cash=0;h.api.renderIncidentSection();assert.equal(h.window.document.querySelector('#incident-devops button').disabled,true);
  g.cash=1e6;g.agentSlots=1;h.api.renderIncidentSection();assert.equal(h.window.document.querySelector('#incident-devops button').disabled,false);
  g.phase=6;g.purchasedUpgrades=[];g.uiRevealed.incidents=true;h.api.renderIncidentSection();assert.equal(h.window.document.querySelector('#incident-devops').textContent,'');
});
scenario('CEO provisioning upgrades follow Scale Mode and remain visible during construction', (h) => {
  const g=h.fresh(10);g.cash=1e10;g.totalTasksDone=2000000;h.prepareUpgrade('ai_ceo');for(let i=0;i<5;i++)h.fullCluster();h.api.purchaseUpgrade('ai_ceo');g.uiRevealed.upgrades=true;
  h.api.purchaseUpgrade('ceo_recruitment');h.api.purchaseUpgrade('ceo_batch');assert.equal(g.purchasedUpgrades.includes('ceo_batch'),false);
  for(const c of g.clusters)while(c.workerAgentIds.length<c.workerSlotsMax)h.api.buyClusterWorker(c.id);h.api.tickConstruction(4);h.api.purchaseUpgrade('server_1');
  const visible=()=>h.api.UPGRADES.filter(h.api.upgradeVisible).map(u=>u.id);const initial=visible();assert.ok(initial.includes('ceo_deploy_speed'));assert.ok(initial.includes('ceo_batch'));
  h.api.tickAiCeo();const cluster=g.clusters.at(-1);assert.ok(cluster.buildRemaining>0);assert.deepEqual(visible(),initial);
  h.api.purchaseUpgrade('ceo_batch');h.api.tickConstruction(12);h.advance(1250);h.api.tickAiCeo();assert.equal(cluster.workerAgentIds.length,2);
  h.api.purchaseUpgrade('ceo_deploy_speed');h.api.purchaseUpgrade('ceo_quad_batch');h.advance(834);h.api.tickAiCeo();assert.equal(cluster.workerAgentIds.length,6);assert.equal(g.agents.at(-1).provisionDuration,4/1.5);
  h.api.renderUpgradeSection();assert.match(h.window.document.querySelector('#upgrade-list').textContent,/Parallel Cluster Builds/);assert.match(h.window.document.querySelector('#upgrade-list').textContent,/Preassembled Server Racks/);
});
scenario('two and three managed clusters increase delivery speed and retainers show current income', (h) => {
  const g=h.fresh(9);const first=h.fullCluster();const agent=g.agents[0];const task=h.task();const baseline=h.api.workerSpeed(task,agent);h.fullCluster();assert.equal(h.api.workerSpeed(task,agent),baseline*1.5);h.fullCluster();assert.equal(h.api.workerSpeed(task,agent),baseline*2);
  g.uiRevealed.clusters=true;g.services=[{id:'one',name:'One',incomeRate:80,active:true},{id:'two',name:'Two',incomeRate:80,active:false}];g.techDebt=100;h.api.renderClusterSection();assert.match(h.window.document.querySelector('#cluster-list').textContent,/Client retainers: 1 contract · \$40\/s/);assert.doesNotMatch(h.window.document.querySelector('#cluster-list').textContent,/Recurring services|downtime|workers/);
  assert.equal(first.workerAgentIds.length,8);
});

scenario('original AI sale rejects early requests and releases any assigned task when available', (h) => {
  const g=h.fresh(3);h.api.shutdownAiWorker();assert.equal(g.aiWorkerShutdown,false);assert.match(g.log[0].msg,/cannot be sold yet/);
  g.phase=4;const task=h.task();task.status='ai';g.aiWorkerCurrentTaskId=task.id;g.aiWorkerTokenTank=10;h.api.shutdownAiWorker();assert.equal(g.aiWorkerShutdown,true);assert.equal(g.aiWorkerTokenTank,0);assert.equal(task.status,'available');assert.equal(g.aiWorkerCurrentTaskId,null);assert.match(g.log[0].msg,/AI agent sold/);
  h.api.shutdownAiWorker();assert.equal(g.aiWorkerShutdown,true);
});

scenario('Phase 10 scales real demand and continuously drains conserved reserve tokens', (h) => {
  const g=h.fresh(10);g.cash=0;g.tokens=200000;g.aiWorkerShutdown=true;g.totalTasksDone=3000;g.uiRevealed.taskQueue=true;g.taskSpawnMult=2.275;g.agentSpeedMult=2.8;g.tokenEfficiency=.402;g.workReduction=.4;g.codeSpeedMult=1.25;g.aiFailMult=0;g.smartRouting=true;
  for(let i=0;i<3;i++){const c=h.fullCluster();c.tank=4000;}for(const agent of g.agents)agent.tokenTank=1500;
  h.api.checkMilestones();h.dismiss();assert.equal(h.api.getMaxTasks(),36);g.tasks=[];h.advance(200);h.api.tickTaskSpawn();assert.equal(g.tasks.length,3);
  const inventory=()=>g.tokens+g.clusters.reduce((total,c)=>total+c.tank,0)+g.agents.reduce((total,a)=>total+a.tokenTank,0);const initial=inventory();const completed=g.totalTasksDone;
  for(let i=0;i<600;i++){h.advance(100);h.api.tick();h.dismiss();}
  assert.ok(g.tokensConsumed>25000);assert.ok(g.tokens<180000);assert.ok(g.totalTasksDone-completed>600);assert.ok(Math.abs(initial-inventory()-g.tokensConsumed)<.001);assert.ok(h.api.deliveryMetrics().rate>5);
  g.tasks=[];g.uiRevealed.taskQueue=false;h.advance(1000);h.api.tickTaskSpawn();assert.equal(g.tasks.length,0);
});
scenario('central Token Manager supplies every cluster in small increments without manual refills', (h) => {
  const g=h.fresh(10);g.tokens=10000;g.cash=0;const first=h.fullCluster();const second=h.fullCluster();first.tank=3000;second.tank=3000;
  h.api.tickTokenManager();assert.equal(first.tank,3250);assert.equal(second.tank,3250);assert.equal(g.tokens,9500);
  h.api.tickClusterManagers();assert.ok(g.agents.every(agent=>agent.tokenTank===25));assert.equal(first.tank,3050);
  first.tank=3990;second.tank=4000;g.tokens=5;h.api.tickTokenManager();assert.equal(first.tank,3995);assert.equal(second.tank,4000);assert.equal(g.tokens,0);
  g.cash=1e6;g.clusters=[];h.advance(3000);h.api.tickTokenManager();assert.ok(g.tokens>0);assert.match(h.api.deliveryMetrics().purchase,/tokens/);
  g.log=[];g.uiRevealed.clusters=true;h.api.renderClusterSection();assert.match(h.window.document.querySelector('.token-purchase').textContent,/Purchased/);assert.equal(h.window.document.querySelectorAll('.company-leadership .leadership-agent').length,2);
});
scenario('delivery summary collapses detail, keeps three completions and resets on phase and story changes', (h) => {
  const g=h.fresh(9);g.aiWorkerShutdown=true;g.uiRevealed.taskQueue=true;h.fullCluster();h.api.renderWorkStream();assert.equal(h.window.document.querySelector('#delivery-summary').hidden,true);
  h.fullCluster();const active=h.task();active.status='active';h.task();h.api.renderWorkStream();const summary=h.window.document.querySelector('#delivery-summary');assert.equal(summary.hidden,false);assert.equal(h.window.document.querySelector('#task-list').hidden,false);
  for(let i=0;i<4;i++){const task=h.task();task.name='Delivery '+i;h.api.completeTask(task,'manual');}h.dismiss();h.api.renderWorkStream();assert.equal(summary.querySelectorAll('li').length,3);assert.match(summary.textContent,/Delivery 3/);assert.doesNotMatch(summary.textContent,/Delivery 0/);
  h.window.GAME.toggleDeliveryTasks();assert.equal(h.window.document.querySelector('#task-list').hidden,true);assert.equal(summary.querySelector('button').getAttribute('aria-expanded'),'false');h.window.GAME.toggleDeliveryTasks();assert.equal(h.window.document.querySelector('#task-list').hidden,false);
  g.phase=10;h.api.renderWorkStream();assert.equal(h.window.document.querySelector('#task-list').hidden,false);assert.equal(h.api.deliveryMetrics().recent.length,3);
  g.phase=12;h.api.renderWorkStream();assert.equal(summary.querySelector('button'),null);assert.match(summary.textContent,/managed nodes/);assert.equal(summary.querySelector('li'),null);
  h.fresh();h.api.renderWorkStream();assert.equal(h.api.deliveryMetrics().recent.length,0);assert.equal(h.api.deliveryMetrics().rate,0);
});
scenario('provisioning occupies the next grid slot and respects unlocks capacity and cash', (h) => {
  const g=h.fresh(9);g.uiRevealed.clusters=true;h.fullCluster();h.api.renderClusterSection();assert.equal(h.window.document.querySelector('.provision-card'),null);
  g.purchasedUpgrades.push('cluster_capacity_2');h.api.renderClusterSection();let card=h.window.document.querySelector('.provision-card');assert.ok(card);assert.ok(card.parentElement.classList.contains('node-grid'));assert.equal(card.disabled,true);assert.equal(card.previousElementSibling.tagName,'DIV');
  g.cash=1e6;h.api.renderClusterSection();assert.equal(card.disabled,false);h.api.openCluster();h.api.renderClusterSection();assert.equal(h.window.document.querySelector('.provision-card'),null);
  h.api.tickConstruction(12);for(let i=0;i<8;i++)h.api.buyClusterWorker(g.clusters[1].id,'coder');h.api.renderClusterSection();assert.ok([...h.window.document.querySelectorAll('.cluster-card button')].every(button=>button.textContent==='Sell'));
  g.phase=10;g.ceoMode='scale';h.api.renderClusterSection();assert.equal(h.window.document.querySelector('.provision-card'),null);assert.equal(h.window.document.querySelectorAll('.leadership-agent').length,2);
});
scenario('the first random AI incident shows its tutorial once before ordinary incidents', (h) => {
  const g=h.fresh(2);g.cash=1000;const task=h.task();h.api.createAiWorkerIncident(task);assert.equal(g.incidents.length,1);assert.equal(g.totalIncidents,1);assert.equal(g.incidents[0].sev,'warning');assert.equal(g.incidentsExplained,true);assert.equal(h.api.queue().filter(item=>item.title==='Your First Incident').length,1);
  h.api.triggerTutorialIncident();assert.equal(g.incidents.length,1);h.api.createAiWorkerIncident(task);assert.equal(g.incidents.length,2);assert.equal(h.api.queue().filter(item=>item.title==='Your First Incident').length,1);
  h.fresh(4);h.window.Math.random=()=>0;h.api.maybeCreateIncident(h.worker());assert.equal(h.window.GAME.state.incidents.length,1);assert.equal(h.window.GAME.state.incidentsExplained,true);
});
scenario('the timed incident cannot create a second failure in the same tick', (h) => {
  const g=h.fresh(2);g.aiRunSeconds=19.9;g.aiWorkerTokenTank=10;const task=h.task();task.workRequired=1e9;h.window.Math.random=()=>0;h.api.tickAiWorker(.2);assert.equal(g.totalIncidents,1);assert.equal(g.incidents.length,1);assert.equal(g.aiWorkerCurrentTaskId,task.id);assert.equal(task.workDone,0);
});
scenario('Phase 2 income includes the original AI and scales with Basic speed without inventing idle income', (h) => {
  const g=h.fresh(2);g.aiWorkerTokenTank=10;g.uiRevealed.topBar=true;g.uiRevealed.income=true;g.aiFailMult=0;const task=h.task();task.workRequired=100;task.pay=12;h.api.tickAiWorker(.1);
  const rate=h.api.getIncomeRate();assert.ok(rate>0);assert.ok(Math.abs(rate-12*h.api.originalAiWorkRate()/100)<1e-9);h.api.renderAll();assert.notEqual(h.window.document.querySelector('#income-rate').textContent,'+$0/s');assert.equal(h.api.getAiWorkerDisplayName(),'AI 2000 Free');
  task.workDone=99;assert.equal(h.api.getIncomeRate(),rate);g.phase=3;assert.ok(h.api.getIncomeRate()>rate);assert.equal(h.api.getAiWorkerDisplayName(),'AI 2000 Basic');g.aiWorkerTokenTank=0;assert.equal(h.api.getIncomeRate(),0);g.aiWorkerShutdown=true;assert.equal(h.api.getIncomeRate(),0);
});
scenario('failure training waits for three incidents and the paid tier has its own lifestyle', (h) => {
  const g=h.fresh(4);g.totalTasksDone=1200;g.cash=1e6;h.prepareUpgrade('prompt_basics');const upgrade=h.api.UPGRADES.find(item=>item.id==='prompt_basics');
  for(const count of [0,1,2]){g.totalIncidents=count;assert.equal(h.api.upgradeVisible(upgrade),false);h.api.purchaseUpgrade(upgrade.id);assert.equal(g.aiFailMult,1);}
  g.totalIncidents=3;h.api.purchaseUpgrade(upgrade.id);assert.equal(g.aiFailMult,.8);g.phase=3;g.uiRevealed.expenses=true;h.api.renderAll();assert.equal(h.window.document.querySelector('#expense-tier-label').textContent,'Coffee Shop Regular');assert.equal(h.api.UPGRADES.find(item=>item.id==='pro_model').name,'Upgrade to AI 2000 Basic');assert.doesNotMatch(h.api.UPGRADES.find(item=>item.id==='multi_bot').desc,/tokens|jobs/);
});
scenario('four-slot upgrade needs the third agent and two speed upgrades precede six usable slots', (h) => {
  const g=h.fresh(4);g.cash=1e7;g.totalTasksDone=1400;g.aiWorkerShutdown=true;h.worker('writer');h.worker('researcher');h.prepareUpgrade('agent_slot_3');const expansion=h.api.UPGRADES.find(item=>item.id==='agent_slot_3');assert.equal(expansion.cost,5000);assert.equal(h.api.upgradeVisible(expansion),false);
  h.api.hireAgent('writer');assert.equal(g.agents.length,3);assert.equal(h.api.upgradeVisible(expansion),true);h.api.purchaseUpgrade(expansion.id);assert.equal(h.api.getSharedAgentPoolSize(),4);h.api.hireAgent('writer');assert.equal(g.agents.length,4);
  h.prepareUpgrade('parallel_prompts');h.api.purchaseUpgrade('agent_slot_5');assert.equal(h.api.getSharedAgentPoolSize(),4);const speed=g.agentSpeedMult;h.api.purchaseUpgrade('parallel_prompts');assert.equal(g.agentSpeedMult,speed*1.15);h.api.purchaseUpgrade('agent_slot_5');assert.equal(h.api.getSharedAgentPoolSize(),4);h.api.purchaseUpgrade('response_streaming');assert.equal(g.agentSpeedMult,speed*1.15*1.2);h.api.purchaseUpgrade('agent_slot_5');assert.equal(h.api.getSharedAgentPoolSize(),6);
  h.api.hireAgent('writer');h.api.hireAgent('writer');assert.equal(g.agents.length,6);h.api.hireAgent('writer');assert.equal(g.agents.length,6);assert.equal(h.api.validSave(g),true);
});
scenario('dashed hiring cards reserve management roles and disable unaffordable hires', (h) => {
  const g=h.fresh(6);g.aiWorkerShutdown=true;g.agentSlots=6;g.managerUnlock=true;g.uiRevealed.agents=true;g.cash=19999;for(let i=0;i<6;i++)h.worker();h.api.renderAgentSection();let manager=h.window.document.querySelector('.manager-slot');assert.equal(manager.disabled,true);assert.equal(manager.parentElement.firstElementChild,manager);assert.equal(h.window.document.querySelector('.agent-vacancy'),null);const before=g.cash;h.api.hireAgent('manager');assert.equal(g.cash,before);
  g.cash=20000;h.api.renderAgentSection();assert.equal(manager.disabled,false);h.api.hireAgent('writer');assert.equal(g.agents.length,6);h.api.hireAgent('manager');assert.equal(g.cash,0);assert.equal(g.agents.length,7);g.cash=1e6;h.api.hireAgent('manager');assert.equal(g.agents.length,7);
  h.api.fireAgent(g.agents[0].id);g.cash=0;h.api.renderAgentSection();assert.equal(h.window.document.querySelectorAll('.agent-vacancy').length,1);assert.equal(h.window.document.querySelector('.agent-vacancy button').disabled,true);assert.equal(h.window.document.querySelectorAll('.agent-vacancy button').length,5);
});
scenario('every phase cheat lands before its actual transition with usable funds and a valid company', (h) => {
  for(const stage of ['0_1','0_2','0_3',1]){h.window['chPh'+stage]();assert.equal(h.window.GAME.state.phase,1);assert.equal(h.api.validSave(h.window.GAME.state),true);}
  for(let stage=2;stage<=15;stage++){
    h.window['chPh'+stage]();const g=h.window.GAME.state;const upgrade=h.api.UPGRADES.find(item=>item.unlockPhase===stage);assert.equal(g.phase,stage-1,'chPh'+stage);assert.ok(g.cash>=upgrade.cost);assert.equal(h.api.validSave(g),true);
    if(stage>=13){assert.equal(g.clusters.length,upgrade.reqNodes-1);h.api.openCluster();h.api.tickConstruction(12);g.lastCeoAction=0;h.api.tickAiCeo();}else{assert.equal(g.totalTasksDone,upgrade.reqTasks-3);h.window.GAME.addTasks(3);}
    h.api.purchaseUpgrade(upgrade.id);assert.equal(g.phase,stage,'transition '+stage);assert.equal(h.api.validSave(g),true);
  }
  h.window.GAME.state.retired=true;h.window.chPh6();assert.equal(h.window.GAME.state.phase,5);assert.equal(h.window.GAME.state.totalTasksDone,4997);assert.equal(new Set(h.window.GAME.state.agents.map(agent=>agent.roleId)).size,5);assert.equal(h.window.GAME.state.retired,false);
});

scenario('DevOps has a dedicated purchasable slot even when every shared slot is occupied', (h) => {
  const g=h.fresh(7);g.cash=1e7;g.aiWorkerShutdown=true;g.managerUnlock=true;g.agentSlots=7;g.purchasedUpgrades.push('token_manager_unlock','devops_unlock');g.uiRevealed.agents=true;
  for(let i=0;i<6;i++)h.worker('writer');h.worker('manager');h.worker('token_mgr');assert.equal(h.api.getSharedAgentPoolUsed(),8);h.api.renderAll();const slot=h.window.document.querySelector('#incident-devops .devops-slot');assert.equal(slot.tagName,'BUTTON');assert.ok(slot.classList.contains('hire-slot'));assert.equal(slot.disabled,false);assert.match(slot.textContent,/Buy DevOps.*Dedicated incident slot/);
  const price=h.api.getAgentHireCost(g.agents.length);const cash=g.cash;h.window.GAME.hire('devops');assert.equal(g.cash,cash-price);assert.equal(g.agents.length,9);assert.equal(h.api.getSharedAgentPoolUsed(),8);assert.equal(h.api.validSave(g),true);h.api.renderAll();assert.equal(h.window.document.querySelector('.agent-vacancy'),null);assert.ok(h.window.document.querySelector('#incident-devops .agent-card'));
  h.api.hireAgent('devops');assert.equal(g.agents.length,9);h.api.fireAgent(g.agents.find(a=>a.roleId==='manager').id);h.api.hireAgent('writer');assert.equal(h.api.getSharedAgentPoolUsed(),7);h.api.renderAgentSection();assert.equal(h.window.document.querySelector('.manager-slot').disabled,false);h.api.hireAgent('manager');assert.equal(h.api.getSharedAgentPoolUsed(),8);
});
scenario('each empty agent slot offers direct role purchases and accurate prices', (h) => {
  const g=h.fresh(4);g.aiWorkerShutdown=true;g.uiRevealed.agents=true;g.cash=0;h.worker('writer');h.worker('researcher');h.api.renderAgentSection();const slot=h.window.document.querySelector('.agent-vacancy');assert.equal(slot.querySelector('select'),null);assert.equal(slot.querySelectorAll('button').length,5);assert.ok([...slot.querySelectorAll('button')].every(button=>button.disabled));
  const price=h.api.getAgentHireCost(2);g.cash=price;h.api.renderAgentSection();const button=[...slot.querySelectorAll('button')].find(item=>item.textContent==='Buy Coder');assert.equal(button.disabled,false);h.window.eval(button.getAttribute('onclick'));assert.equal(g.cash,0);assert.equal(g.agents.at(-1).roleId,'coder');h.api.renderAgentSection();assert.equal(h.window.document.querySelector('.agent-vacancy'),null);
  assert.equal(h.api.UPGRADES.find(u=>u.id==='token_manager_unlock').desc,'Automatically buy tokens when they run out.');
});

scenario('agent warnings and integer cash rates remain consistent with the token warning', (h) => {
  const g=h.fresh(6);g.uiRevealed.agents=true;g.uiRevealed.topBar=true;g.cashRevealed=true;g.expensesRevealed=true;g.managerUnlock=true;g.tokens=3999;h.worker('manager');const agent=h.worker();
  h.api.renderAll();assert.ok(h.window.document.querySelector('#res-tokens-wrap').classList.contains('res-warning'));assert.equal(h.window.document.querySelector('#res-tokens-wrap .label').textContent,'Tokens');assert.equal(h.window.document.querySelectorAll('.agent-card.res-warning').length,3);
  g.managerTokenTank=10;agent.tokenTank=10;g.aiWorkerTokenTank=10;h.api.renderAll();assert.equal(h.window.document.querySelectorAll('.agent-card.res-warning').length,0);assert.ok(h.window.document.querySelector('.agent-info .name .role'));
  for(const selector of ['#income-rate','#expense-rate'])assert.match(h.window.document.querySelector(selector).textContent,/^[+-]\$[\d,]+\/s$/);
});
scenario('four and six agent expansions prevent later upgrades appearing out of order', (h) => {
  const g=h.fresh(4);g.cash=1e8;g.totalTasksDone=2000;g.aiWorkerShutdown=true;for(let i=0;i<3;i++)h.worker();h.prepareUpgrade('agent_slot_3');
  const visible=id=>h.api.upgradeVisible(h.api.UPGRADES.find(u=>u.id===id));assert.equal(visible('agent_slot_3'),true);for(const id of ['client_crm','prompt_basics','error_handling','parallel_prompts'])assert.equal(visible(id),false);
  h.api.purchaseUpgrade('agent_slot_3');assert.equal(visible('client_crm'),true);h.prepareUpgrade('agent_slot_5');assert.equal(visible('tool_use'),false);h.api.purchaseUpgrade('agent_slot_5');assert.equal(visible('tool_use'),true);
});
scenario('DevOps requires its own upgrade after the token-manager phase begins', (h) => {
  const g=h.fresh(7);g.cash=1e6;g.totalTasksDone=30000;g.uiRevealed.incidents=true;h.prepareUpgrade('compute_2');h.api.renderIncidentSection();assert.equal(h.window.document.querySelector('.devops-slot'),null);h.api.hireAgent('devops');assert.equal(g.agents.length,0);
  h.api.purchaseUpgrade('devops_unlock');assert.ok(g.purchasedUpgrades.includes('devops_unlock'));h.api.renderIncidentSection();assert.ok(h.window.document.querySelector('.devops-slot'));h.api.hireAgent('devops');assert.equal(g.agents[0].roleId,'devops');
});
scenario('Token Manager replenishes ahead of the warning even during rapid tank transfers', (h) => {
  const g=h.fresh(7);g.cash=1e9;g.tokens=4001;g.aiWorkerShutdown=true;g.managerUnlock=true;h.worker('manager');h.worker('token_mgr');for(let i=0;i<6;i++)h.worker();
  for(let i=0;i<100;i++){h.api.tickTokenManager();h.api.tickManager();h.advance(100);assert.ok(g.tokens>=4000);}
  g.phase=10;g.agents=[];g.tokens=4001;for(let i=0;i<5;i++)h.fullCluster();for(let i=0;i<30;i++){h.api.tickTokenManager();h.api.tickClusterManagers();h.advance(100);assert.ok(g.tokens>=4000);}
  g.cash=0;g.tokens=0;h.api.tickTokenManager();assert.equal(g.tokens,0);assert.equal(h.api.validSave(g),true);
});
scenario('batch upgrades count delivered tasks without multiplying cash or inflating job complexity', (h) => {
  const g=h.fresh(5);g.cash=1e9;g.totalTasksDone=1200;h.prepareUpgrade('bulk_jobs');const before=h.task();h.api.purchaseUpgrade('bulk_jobs');const task=h.task();assert.equal(before.batchSize,1);assert.equal(task.batchSize,10);const pay=h.api.getTaskCashPayout(task,'manual',null);const cash=g.cash;h.api.completeTask(task,'manual');assert.equal(g.totalTasksDone,1210);assert.equal(g.cash,cash+pay);
  g.uiRevealed.taskQueue=true;const batch=h.task();h.api.renderTaskQueue();assert.match(h.window.document.querySelector('#task-list').textContent,/Batch: 10 tasks/);g.totalTasksDone=1000000;const large=h.task();assert.ok(large.workRequired<1000);assert.equal(h.api.validSave(g),true);
  g.phase=12;g.batchSize=2000;const c=h.fullCluster();c.tank=4000;const count=g.totalTasksDone;h.api.tickNetwork(.1);assert.equal(g.totalTasksDone-count,400);assert.ok(c.tank<4000);assert.ok(batch.batchSize===10);
});
scenario('batch and provisioning save data reject invalid states and preserve construction', (h) => {
  const g=h.fresh(9);g.cash=1e6;h.api.openCluster();h.api.tickConstruction(12);h.api.buyClusterWorker(g.clusters[0].id);h.api.tickConstruction(2);const raw=JSON.stringify(g);const restored=harness(raw);try{assert.equal(restored.window.GAME.state.agents[0].provisionRemaining,2);restored.api.tickConstruction(2);assert.equal(restored.window.GAME.state.agents[0].status,'idle');}finally{restored.close();}
  g.batchSize=0;assert.equal(h.api.validSave(g),false);g.batchSize=1;const task=h.task();task.batchSize=0;assert.equal(h.api.validSave(g),false);task.batchSize=1;g.agents[0].provisionRemaining=5;assert.equal(h.api.validSave(g),false);g.agents[0].provisionRemaining=2;assert.equal(h.api.validSave(g),true);
  assert.equal(new Set(h.api.UPGRADES.map(u=>u.id)).size,h.api.UPGRADES.length);
});
scenario('compact nodes wait for paid agent installations to finish', (h) => {
  const g=h.fresh(11);g.cash=1e9;g.totalTasksDone=2000000;g.ceoMode='scale';g.uiRevealed.upgrades=true;h.prepareUpgrade('autonomous_nodes');const first=h.fullCluster();h.fullCluster();h.fullCluster();const id=first.workerAgentIds.pop();g.agents=g.agents.filter(agent=>agent.id!==id);h.api.buyClusterWorker(first.id);assert.equal(g.agents.at(-1).status,'provisioning');
  h.api.renderUpgradeSection();const button=h.window.document.querySelector('[onclick="GAME.buy(\'autonomous_nodes\')"]');assert.equal(button.disabled,true);h.api.purchaseUpgrade('autonomous_nodes');assert.equal(g.phase,11);h.api.tickConstruction(2);h.api.renderUpgradeSection();assert.equal(button.disabled,false);h.api.purchaseUpgrade('autonomous_nodes');assert.equal(g.phase,12);assert.equal(first.workforce,16);assert.equal(h.api.validSave(g),true);
});

scenario('parallel construction respects two active builds and charges each rising price', (h) => {
  const g=h.fresh(10);g.cash=1e10;g.ceoMode='scale';h.fullCluster();g.purchasedUpgrades.push('ceo_parallel_clusters','ceo_fast_builds');const before=g.cash;const firstPrice=h.api.provisionCost();h.api.tickAiCeo();assert.equal(g.clusters.length,3);assert.equal(g.clusters[1].buildDuration,6);assert.equal(g.clusters[2].buildDuration,6);assert.ok(g.clusters[2].invested>g.clusters[1].invested);assert.equal(before-g.cash,g.clusters[1].invested+g.clusters[2].invested);assert.equal(g.clusters[1].invested,firstPrice);
  h.advance(5000);h.api.tickAiCeo();assert.equal(g.clusters.length,3);g.cash=0;h.api.tickConstruction(6);h.advance(5000);h.api.tickAiCeo();assert.equal(g.clusters.length,3);assert.equal(g.clusters[1].workerAgentIds.length,0);
});
scenario('fully fitted racks pay for all agents and complete installations with construction', (h) => {
  const g=h.fresh(11);g.cash=1e10;g.ceoMode='scale';g.totalTasksDone=2000000;h.prepareUpgrade('ceo_full_fit');h.api.purchaseUpgrade('ceo_full_fit');const cost=h.api.provisionCost();const before=g.cash;h.api.openCluster();const c=g.clusters[0];assert.equal(before-g.cash,cost);assert.equal(c.invested,cost);assert.equal(c.workerAgentIds.length,16);assert.ok(g.agents.every(a=>a.status==='provisioning'));assert.equal(h.api.hasUnfinishedAgentInstallations(),false);assert.equal(h.api.completedClusterCount(),0);
  h.api.tickConstruction(c.buildDuration/2);assert.equal(h.api.completedClusterCount(),0);h.api.tickConstruction(c.buildDuration/2);assert.equal(h.api.completedClusterCount(),1);assert.ok(g.agents.every(a=>a.status==='idle'));assert.equal(h.api.validSave(g),true);
  const restored=harness(JSON.stringify(g));try{assert.equal(restored.api.completedClusterCount(),1);}finally{restored.close();}
});
scenario('fully fitted construction survives the compact-node transition without early delivery', (h) => {
  const g=h.fresh(11);g.cash=1e10;g.ceoMode='scale';g.totalTasksDone=2000000;h.prepareUpgrade('autonomous_nodes');for(let i=0;i<3;i++)h.fullCluster();h.api.openCluster();const c=g.clusters.at(-1);h.api.purchaseUpgrade('autonomous_nodes');assert.equal(g.phase,12);assert.equal(c.workforce,16);assert.equal(c.managerAssigned,false);c.tank=4000;h.api.tickNetwork(1);assert.equal(c.progress,0);h.api.tickConstruction(c.buildDuration);assert.equal(h.api.completedClusterCount(),4);assert.equal(h.api.validSave(g),true);
});
scenario('continuous deployment delivers a fully fitted cluster per second without free agents', (h) => {
  const g=h.fresh(12);g.cash=1e12;g.ceoMode='scale';g.totalTasksDone=2000000;h.prepareUpgrade('ceo_continuous');h.fullCluster();h.api.purchaseUpgrade('ceo_continuous');assert.ok(g.purchasedUpgrades.includes('ceo_continuous'));const initial=g.cash;h.api.tickAiCeo();assert.equal(g.clusters.length,3);assert.equal(h.api.completedClusterCount(),1);
  for(let i=0;i<200;i++){h.advance(100);h.api.tickConstruction(.1);h.api.tickAiCeo();}assert.equal(h.api.completedClusterCount(),21);assert.equal(g.clusters.length,23);assert.ok(g.clusters.slice(1).every(c=>c.workforce===16));assert.equal(initial-g.cash,g.clusters.slice(1).reduce((sum,c)=>sum+c.invested,0));assert.equal(h.api.validSave(g),true);
  const upg=h.api.UPGRADES.find(u=>u.id==='replication');g.uiRevealed.upgrades=true;assert.equal(h.api.upgradeVisible(upg),true);h.api.renderUpgradeSection();const button=h.window.document.querySelector('[onclick="GAME.buy(\'replication\')"]');assert.equal(button.disabled,false);h.api.purchaseUpgrade('replication');assert.equal(g.phase,13);
  g.cash=0;const count=g.clusters.length;h.advance(2000);h.api.tickConstruction(2);h.api.tickAiCeo();assert.equal(g.clusters.length,count);
});
scenario('debug checkpoints finish and pay for partly staffed compact clusters', (h) => {
  const g=h.fresh(12);g.ceoMode='scale';g.cash=1e10;const c=h.fullCluster();c.workforce=3;const before=g.cash;h.api.fillCheatCompany(3);assert.equal(g.clusters.length,3);assert.ok(g.clusters.every(item=>item.workforce===16));assert.ok(g.cash<before);assert.equal(h.api.validSave(g),true);
});
