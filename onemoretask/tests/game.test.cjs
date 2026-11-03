const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');
const { play } = require('./simulate.cjs');

function scenario(name, run) {
  test(name, () => { const h = harness(); try { run(h); } finally { h.close(); } });
}
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
scenario('token manager buys and refills tanks; manager tops up only missing balance', (h) => {
  const g=h.fresh(7);g.cash=1000;g.tokens=0;h.worker('manager');h.worker('token_mgr'); const a=h.worker();
  h.api.tickTokenManager();assert.equal(g.tokens,500);h.advance(3000);h.api.tickTokenManager();
  h.api.tickManager();assert.ok(g.managerTokenTank<100);assert.equal(a.tokenTank,10);assert.ok(g.aiWorkerTokenTank>0);
  g.managerTokenTank=99;g.tokens=1;h.api.topUpManager();assert.equal(g.tokens,0);assert.equal(g.managerTokenTank,100);
  g.managerTokenTank=0;g.tokens=3;h.api.topUpManager();assert.equal(g.managerTokenTank,3);
});
scenario('clusters require one paid management team before explicit worker hiring', (h) => {
  const g=h.fresh(9);g.tokens=500;g.cash=1e6;
  h.api.openCluster();const c=g.clusters[0];assert.equal(c.name,'Cluster 1');
  h.api.buyClusterWorker(c.id,'coder');assert.equal(g.agents.length,0);
  h.api.buyManagementTeam(c.id);assert.equal(g.cash,938000);assert.equal(c.managerAssigned,true);
  h.api.buyClusterWorker(c.id,'coder');assert.equal(g.cash,935500);assert.equal(c.workerAgentIds.length,1);
  h.api.tickTokenManager();h.api.tickManager();assert.equal(g.agents[0].tokenTank,10);assert.equal(c.tank,90);
  const before=g.cash;h.api.buyManagementTeam(c.id);assert.equal(g.cash,before);
  assert.equal(h.window.GAME.toggleClusterUtil,undefined);assert.equal(c.managerAssigned,true);
  h.api.purchaseUpgrade('code_agents');assert.equal(g.clusters.every(item=>item.managerAssigned),true);
  assert.equal(h.api.validSave(g),true);
});
scenario('upgrades change payouts, token use, failure rate, and deploy services', (h) => {
  const g=h.fresh(9);g.cash=1e8;g.totalTasksDone=1500;h.api.addClusterWithNextName();
  const a=h.worker();const t=h.task();t.typeId='research';
  const baseline=h.api.getTaskCashPayout(t,'agent',a);
  h.api.purchaseUpgrade('code_review');assert.equal(h.api.getTaskCashPayout(t,'agent',a),baseline*1.25);
  h.api.purchaseUpgrade('web_browse');assert.equal(h.api.getTaskCashPayout(t,'agent',a),baseline*1.25*1.2);
  h.api.purchaseUpgrade('deploy');assert.equal(g.services.length,2);const cash=g.cash;h.api.tickServices(1);assert.equal(g.cash-cash,160);
  g.phase=10;h.api.purchaseUpgrade('ai_ceo');h.api.purchaseUpgrade('server_1');assert.equal(g.services.length,5);
  const cost=g.cash;h.api.purchaseUpgrade('server_1');assert.equal(g.cash,cost);
  h.api.renderAll();
});
scenario('CEO scales complete nodes with budget cooldown and a 128-node cap', (h) => {
  const g=h.fresh(12);g.cash=1e10;g.ceoMode='scale';
  h.api.tickAiCeo();assert.equal(g.clusters.length,1);assert.equal(g.clusters[0].workforce,8);assert.equal(g.cash,1e10-1000000);
  h.api.tickAiCeo();assert.equal(g.clusters.length,1);
  for(let i=0;i<127;i++){h.advance(5000);h.api.tickAiCeo();}
  assert.equal(g.clusters.length,128);const before=g.cash;h.advance(5000);h.api.tickAiCeo();assert.equal(g.cash,before);
  assert.equal(h.api.validSave(g),true);
  g.phase=14;assert.equal(h.api.nodeCost(),390000);h.api.checkMilestones();h.dismiss();h.api.renderAll();
  assert.equal(h.window.document.querySelectorAll('.node-grid .cluster-card').length,128);
  assert.equal(h.window.document.querySelectorAll('.node-grid button').length,0);
});
scenario('DevOps resolves critical incidents more slowly without final approval', (h) => {
  const g=h.fresh(7);h.worker('devops');
  const critical={id:'critical',name:'Critical',sev:'critical',fixProgress:0,createdAt:1,resolved:false,repCost:5,cashCost:0};
  const warning={...critical,id:'warning',name:'Warning',sev:'warning'};g.incidents=[critical,warning];
  h.api.tickDevopsIncidentResponse(10);assert.equal(critical.fixProgress,55);assert.equal(critical.resolved,false);
  h.api.tickDevopsIncidentResponse(30);assert.equal(critical.resolved,true);assert.equal(warning.resolved,true);assert.equal(g.stress,0);
  h.api.resolveIncident('critical','invalid');
});
scenario('retirement requires sale and sustainable income and persists a frozen ending', (h) => {
  const g=h.fresh(15);g.reputation=1000;g.services=[{id:'service',name:'Service',incomeRate:1000,active:true}];
  for(let i=0;i<100;i++){const c=h.api.addClusterWithNextName();c.managerAssigned=true;c.tokenManagerAssigned=true;}
  assert.equal(h.api.canTrueRetire(),false);g.purchasedUpgrades.push('fusion');assert.equal(h.api.canTrueRetire(),true);
  h.window.GAME.trueRetire();assert.equal(g.retired,true);assert.equal(h.window.document.querySelector('#ending-overlay').hidden,false);
  const before=JSON.stringify(g);h.advance(1000);h.api.tick();h.window.GAME.buy('token_pack_2');h.window.GAME.addCash(1000);assert.equal(JSON.stringify(g),before);
  const loaded=harness(h.window.localStorage.getItem('ai_empire_save'));assert.equal(loaded.window.GAME.state.retired,true);loaded.close();
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
  const g=h.fresh(15);g.musicMode='off';h.api.prestige();const next=h.window.GAME.state;
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
  const a=h.worker();const t=h.task();t.typeId='email';h.api.hireAgent('manager');assert.equal(a.status,'working');assert.equal(g.managerTokenTank,90);
  h.api.tickAgentAutoAssign();h.api.fireAgent(g.agents.find(a=>a.roleId==='manager').id);a.status='idle';a.currentTask=null;t.status='available';t.assignedAgent=null;a.autoAssign=false;
  h.advance(2000);h.api.tickAgentAutoAssign();assert.equal(a.status,'idle');a.autoAssign=true;h.advance(2000);h.api.tickAgentAutoAssign();assert.equal(a.status,'working');
  h.api.renderAll();
});
scenario('cluster panel shows ordered management and removes individual worker controls', (h) => {
  const g=h.fresh(9);g.cash=1e6;g.totalTasksDone=1200;
  h.api.openCluster();const c=g.clusters[0];h.api.buyManagementTeam(c.id);h.api.buyClusterWorker(c.id,'coder');
  h.api.openCluster();h.api.checkMilestones();h.dismiss();h.api.renderAll();
  const text=h.window.document.querySelector('#cluster-list').textContent;
  assert.match(text,/Manager · Token Manager · DevOps/);assert.doesNotMatch(text,/Worker controls|Unassigned workers|Global Utility/);
  const button=h.window.document.querySelector('#cluster-list button');button.focus();h.api.renderAll();assert.equal(h.window.document.activeElement,button);
  h.api.createAiWorkerIncident(h.task());g.incidents[0].fixProgress=90;h.api.renderIncidentSection();assert.match(h.window.document.querySelector('#incident-list').textContent,/resolves automatically/);
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
  for(const seed of [17,42,123]) {const result=play(seed);assert.equal(result.stalled,undefined);assert.equal(result.phases.length,15);assert.ok(result.tasks>=1560);}
});
scenario('agent controls display manager and manual automation states', (h) => {
  const g=h.fresh(6);g.totalTasksDone=650;g.tokens=10;h.worker('manager');h.worker();h.api.checkMilestones();h.dismiss();h.api.renderAll();
  assert.match(h.window.document.querySelector('#agent-list').textContent,/Refill manager/);assert.match(h.window.document.querySelector('#agent-list').textContent,/Auto ON/);
  g.managerTokenTank=100;h.api.renderAll();assert.match(h.window.document.querySelector('#agent-list').textContent,/Managed/);
});
scenario('reset buttons require confirmation before discarding saved progress', (h) => {
  const doc=h.window.document;h.window.confirm=()=>false;
  for(const id of ['btn-save-reset','btn-ending-reset']){h.window.localStorage.setItem('ai_empire_save','keep');doc.getElementById(id).click();assert.equal(h.window.localStorage.getItem('ai_empire_save'),'keep');}
  h.window.confirm=()=>true;
  for(const id of ['btn-save-reset','btn-ending-reset']){doc.getElementById(id).click();assert.equal(h.window.localStorage.getItem('ai_empire_save'),null);}
});
scenario('cluster workers cannot be detached fired or individually controlled', (h) => {
  const g=h.fresh(9);g.cash=1e6;h.api.openCluster();const c=g.clusters[0];h.api.buyManagementTeam(c.id);h.api.buyClusterWorker(c.id,'writer');
  const a=g.agents[0];a.tokenTank=10;const t=h.task();h.api.assignAgentToTask(t.id,a.id);
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
  const g=h.fresh(10);g.cash=1e8;g.totalTasksDone=1600;
  h.api.purchaseUpgrade('server_1');assert.equal(g.ceoMode,'off');h.api.checkMilestones();h.dismiss();h.api.renderUpgradeSection();assert.doesNotMatch(h.window.document.querySelector('#upgrade-list').textContent,/AI CEO Scale Mode/);
  h.api.purchaseUpgrade('ai_ceo');h.api.purchaseUpgrade('server_1');assert.equal(g.ceoMode,'scale');
  for(let i=0;i<8;i++)h.api.addClusterWithNextName();const cash=g.cash;h.api.purchaseUpgrade('cluster_beta');assert.equal(g.cash,cash);assert.equal(g.clusters.length,8);
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
  assert.equal(h.window.document.querySelector('#task-list').textContent,'');assert.match(h.window.document.querySelector('#prestige-content').textContent,/Not Yet/);
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
scenario('the manual work button remains usable with loaded fuel and no spare tokens', (h) => {
  const g=h.fresh(4);g.tokens=0;g.uiRevealed.agents=true;const a=h.worker();a.autoAssign=false;a.tokenTank=5;h.task();h.api.renderAgentSection();
  const button=h.window.document.querySelector('[onclick="GAME.topUpAgent(\''+a.id+'\')"]');assert.equal(button.disabled,false);
  h.api.topUpAgent(a.id);assert.equal(a.status,'working');assert.equal(a.tokenTank,5);
});
scenario('task cards show quality-adjusted reputation rewards', (h) => {
  const g=h.fresh(4);g.totalTasksDone=25;g.codeQualityMult=1.25;const a=h.worker();a.quality=2;a.tokenTank=10;const t=h.task();t.repReward=4;h.api.assignAgentToTask(t.id,a.id);h.api.renderTaskQueue();
  assert.match(h.window.document.querySelector('#task-list').textContent,/Rep: \+10/);h.api.completeTask(t,'agent');assert.equal(g.reputation,10);
});
scenario('phase 3 automation stays visible for two seconds and completions linger', (h) => {
  const g=h.fresh(3);g.clickPower=10000;g.aiFailMult=0;g.aiWorkerTokenTank=10;
  const t=h.task();h.api.tickAiWorker(0.1);assert.equal(t.status,'ai');assert.ok(t.workDone<t.workRequired);
  for(let i=0;i<18;i++){h.advance(100);h.api.tickAiWorker(0.1);}
  assert.equal(g.totalTasksDone,0);h.advance(200);h.api.tickAiWorker(0.2);assert.equal(g.totalTasksDone,1);
  h.api.pruneTasks(h.window.Date.now());h.api.renderTaskQueue();assert.match(h.window.document.querySelector('#task-list').textContent,/Completed/);
  h.advance(1600);h.api.pruneTasks(h.window.Date.now());assert.equal(g.tasks.length,0);
});
scenario('fuel transfers conserve reserve and manager supplies AI Worker Pro', (h) => {
  const g=h.fresh(6);g.tokens=200;g.managerUnlock=true;g.agentSlots=6;g.cash=1e6;
  h.api.hireAgent('manager');assert.equal(g.tokens,100);assert.equal(g.managerTokenTank,100);
  const a=h.worker();h.api.tickManager();assert.equal(g.aiWorkerTokenTank,10);assert.equal(a.tokenTank,10);assert.equal(g.managerTokenTank,80);
  const reserve=g.tokens;h.api.tickTokenManager();assert.equal(g.tokens,reserve);
  g.managerTokenTank=0;g.aiWorkerTokenTank=0;g.tokens=2;h.api.topUpAiWorker();assert.equal(g.tokens,0);assert.equal(g.aiWorkerTokenTank,2);
  g.tokens=3;a.tokenTank=0;h.api.topUpAgent(a.id);assert.equal(a.tokenTank,3);assert.equal(g.tokens,0);
  g.tokens=1000;g.aiWorkerTokenTank=0;g.phase=7;h.api.tickTokenManager();assert.equal(g.tokens,1000);assert.equal(g.aiWorkerTokenTank,0);
  h.worker('token_mgr');h.api.tickTokenManager();assert.ok(g.tokens<1000);
});
scenario('management order stays fixed and locked roles have no placeholders', (h) => {
  const g=h.fresh(7);g.uiRevealed.agents=true;g.managerUnlock=true;g.agentSlots=8;g.purchasedUpgrades.push('token_manager_unlock');
  h.worker('writer');h.worker('devops');h.worker('token_mgr');h.worker('manager');h.api.renderAgentSection();
  const roles=[...h.window.document.querySelectorAll('#agent-list .agent-info .role')].map(el=>el.textContent);
  assert.match(roles[0],/Manager/);assert.match(roles[1],/Token Mgr/);assert.match(roles[2],/DevOps/);
  g.agents=[];g.phase=4;g.managerUnlock=false;g.purchasedUpgrades=[];h.api.renderAgentSection();
  assert.doesNotMatch(h.window.document.querySelector('#agent-list').textContent,/Manager|DevOps/);
  assert.equal(h.window.document.querySelectorAll('#agent-list [style*="dashed"]').length,1);
});
scenario('node production consumes fuel and halts when starved, management buys explicitly', (h) => {
  const g=h.fresh(12);g.cash=1000;const c=h.api.addClusterWithNextName();c.managerAssigned=true;c.tokenManagerAssigned=true;c.workforce=8;c.tank=4.8;
  h.api.tickNetwork(2);assert.ok(Math.abs(g.cash-1120)<0.001);assert.equal(c.tank,0);assert.equal(g.totalTasksDone,2);
  h.api.tickNetwork(2);assert.ok(Math.abs(g.cash-1120)<0.001);
  h.api.tickTokenManager();assert.equal(g.tokens,500);assert.match(g.log[0].msg,/auto-purchased/);
  h.advance(2000);h.api.tickTokenManager();assert.equal(c.tank,100);h.api.tickNetwork(1);assert.ok(g.cash>820);
  g.phase=14;g.cash=1e8;g.totalTasksDone=10000;h.api.purchaseUpgrade('retire_unlock');assert.equal(g.phase,14);
  while(g.clusters.length<100){const item=h.api.addClusterWithNextName();item.managerAssigned=true;item.tokenManagerAssigned=true;item.workforce=8;}
  h.api.purchaseUpgrade('retire_unlock');assert.equal(g.phase,15);assert.equal(h.api.validSave(g),true);
});
scenario('cluster construction and node upgrades enforce stage, capacity and funds', (h) => {
  const g=h.fresh(9);g.cash=0;h.api.openCluster();assert.equal(g.clusters.length,0);
  g.cash=1e6;h.api.openCluster();const c=g.clusters[0];h.api.buyManagementTeam('missing');h.api.buyClusterWorker(c.id,'writer');assert.equal(g.agents.length,0);
  g.cash=0;h.api.buyManagementTeam(c.id);assert.equal(c.managerAssigned,false);g.cash=1e6;h.api.buyManagementTeam(c.id);
  h.api.buyClusterWorker(c.id,'manager');h.api.buyClusterWorker(c.id,'missing');assert.equal(g.agents.length,0);
  g.cash=0;h.api.buyClusterWorker(c.id,'writer');assert.equal(g.agents.length,0);g.cash=1e6;
  for(let i=0;i<9;i++)h.api.buyClusterWorker(c.id,'coder');assert.equal(g.agents.length,8);
  g.phase=12;g.ceoMode='scale';const empty=h.api.addClusterWithNextName();g.cash=0;h.api.tickAiCeo();assert.equal(empty.managerAssigned,false);
  g.cash=1e6;h.advance(5000);h.api.tickAiCeo();assert.equal(c.workforce,8);h.advance(5000);h.api.tickAiCeo();assert.equal(empty.workforce,8);assert.equal(empty.managerAssigned,true);
  g.cash=0;h.advance(5000);h.api.tickAiCeo();assert.equal(g.clusters.length,2);
});
scenario('Token Manager can supply workers before a Manager is hired', (h) => {
  const g=h.fresh(7);g.tokens=50;h.worker('token_mgr');const a=h.worker();
  h.api.tickTokenManager();assert.equal(a.tokenTank,10);assert.ok(g.tokens<40);assert.equal(g.managerTokenTank,0);
});
