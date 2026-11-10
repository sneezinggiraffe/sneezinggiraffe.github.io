const { harness } = require('./harness.cjs');
const assert = require('node:assert/strict');

function play(seed=17,actionEveryMs=500,delegateOpening=false) {
  const actionSteps=actionEveryMs/100;
  const h=harness(undefined,{seed});const g=h.fresh();const milestones=[];const offers=[];const purchases=[];const offered=new Set();const purchasesLogged=new Set();
  let lastPhase=0;
  for(let step=0;step<108000;step++) {
    h.advance(100);h.dismiss();
    if(step%actionSteps===0){
      if(h.api.agiRouteReady()){h.api.requestBuyout();h.api.positionForBuyout();}
      if(!g.uiRevealed.taskQueue)h.api.doEarlyTask();
      else if (!(delegateOpening && g.phase === 1 && h.api.assistantAvailable())) h.api.doWork();
      if(g.phase>=2 && g.aiWorkerTokenTank<1)h.api.topUpAiWorker();
      if(g.phase<8)for(const inc of g.incidents.filter(i=>!i.resolved))h.api.resolveIncident(inc.id,'manual');
      if (g.uiRevealed.upgrades) for (const u of h.api.UPGRADES) if (u.oneTime && (!u.optional || u.id === "multitasking") && !g.purchasedUpgrades.includes(u.id)) {
        if (h.api.upgradeVisible(u) && !offered.has(u.id)) {
          offered.add(u.id);
          offers.push({id:u.id,tasks:g.totalTasksDone,cash:Math.round(g.cash),cost:h.api.getUpgradeCost(u),seconds:step/10,nodes:h.api.completedClusterCount()});
        }
        const phase = g.phase;
        const cash = g.cash;
        const cost = h.api.getUpgradeCost(u);
        h.api.purchaseUpgrade(u.id);
        if (!purchasesLogged.has(u.id) && (g.purchasedUpgrades.includes(u.id) || g.salePreparation.upgradeId === u.id || g.agi.projectId === u.id)) {
          purchasesLogged.add(u.id);
          purchases.push({id:u.id,phase,tasks:g.totalTasksDone,cash:Math.round(cash),cost,seconds:step/10,nodes:h.api.completedClusterCount()});
        }
        if (g.phase !== phase) break;
      }
      if(g.phase>=3&&g.tokens<50)h.api.purchaseUpgrade('token_pack_1');
      if(g.phase>=3)for(const agent of g.agents)if(agent.tokenTank<1)h.api.topUpAgent(agent.id);
      if(g.phase>=5){
        const roles=['manager','token_mgr','devops','writer','coder','researcher','analyst','sales'];
        for(const role of roles)if(!g.agents.some(a=>a.roleId===role))h.api.hireAgent(role);
        if(g.managerTokenTank<10)h.api.topUpManager();
        for(const agent of g.agents)if(agent.tokenTank<1)h.api.topUpAgent(agent.id);
      }
    }
    if(step%actionSteps===0 && g.phase>=10 && g.phase<=13){
      if(h.api.canManuallyProvisionCluster())h.window.GAME.openCluster();
      if(g.phase<11)for(const c of g.clusters){h.api.buyNextClusterWorker(c.id);}
    }
    h.api.tick();
    if(g.phase!==lastPhase){milestones.push({phase:g.phase,seconds:step/10,tasks:g.totalTasksDone,clicks:g.totalClicks,cash:Math.round(g.cash),nodes:h.api.completedClusterCount()});lastPhase=g.phase;}
    if(h.api.canTrueRetire()){
      h.window.GAME.trueRetire();assert.equal(g.retired,true);assert.equal(h.api.validSave(g),true);
      const result={seed,actionEveryMs,minutes:Math.round(step/600),tasks:g.totalTasksDone,nodes:g.clusters.length,phases:milestones,offers,purchases};h.close();return result;
    }
  }
  const result={seed,stalled:g.phase,tasks:g.totalTasksDone,cash:g.cash,upgrades:g.purchasedUpgrades,phases:milestones};h.close();return result;
}
if(require.main===module){for(const seed of [17,42,123])console.log(JSON.stringify(play(seed)));}
module.exports={play};
