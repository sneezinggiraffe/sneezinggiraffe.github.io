const { harness } = require('./harness.cjs');
const assert = require('node:assert/strict');

function play(seed=17) {
  const h=harness(undefined,{seed});const g=h.fresh();const milestones=[];
  let lastPhase=0;
  for(let step=0;step<108000;step++) {
    h.advance(100);h.dismiss();
    if(step%5===0){
      if(!g.uiRevealed.taskQueue)h.api.doEarlyTask();
      else {const task=g.tasks.find(t=>t.status==='available');if(task)h.api.clickTask(task.id);}
      if(g.phase>=2 && g.aiWorkerTokenTank<1)h.api.topUpAiWorker();
      if(g.phase<7)for(const inc of g.incidents.filter(i=>!i.resolved))h.api.resolveIncident(inc.id,'manual');
      if(g.techDebt>=5)h.api.purchaseUpgrade('pay_debt');
      for(const u of h.api.UPGRADES)if(u.oneTime&&!g.purchasedUpgrades.includes(u.id))h.api.purchaseUpgrade(u.id);
      if(g.phase>=3&&g.tokens<50)h.api.purchaseUpgrade('token_pack_1');
      if(g.phase>=4){
        const roles=['manager','token_mgr','devops','writer','coder','researcher','analyst','sales'];
        for(const role of roles)if(!g.agents.some(a=>a.roleId===role))h.api.hireAgent(role);
        if(g.managerTokenTank<10)h.api.topUpManager();
        for(const agent of g.agents)if(agent.tokenTank<1)h.api.topUpAgent(agent.id);
      }
    }
    h.api.tick();
    if(g.phase!==lastPhase){milestones.push({phase:g.phase,seconds:step/10,tasks:g.totalTasksDone,cash:Math.round(g.cash)});lastPhase=g.phase;}
    if(h.api.canTrueRetire()){
      h.window.GAME.trueRetire();assert.equal(g.retired,true);assert.equal(h.api.validSave(g),true);
      const result={seed,minutes:Math.round(step/600),tasks:g.totalTasksDone,nodes:g.clusters.length,phases:milestones};h.close();return result;
    }
  }
  const result={seed,stalled:g.phase,tasks:g.totalTasksDone,cash:g.cash,upgrades:g.purchasedUpgrades,phases:milestones};h.close();return result;
}
if(require.main===module){for(const seed of [17,42,123])console.log(JSON.stringify(play(seed)));}
module.exports={play};
