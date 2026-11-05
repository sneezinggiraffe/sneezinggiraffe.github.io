const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const filename = path.resolve(__dirname, '../game.js');
const source = fs.readFileSync(filename, 'utf8');
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const names = [...source.matchAll(/^  function (\w+)\(/gm)].map((match) => match[1]);
const exposed = source.replace('  // Start\n  init();', `  window.testAPI = { ${names.join(',')}, UPGRADES, AGENT_ROLES, MILESTONES, CLUSTER_AGENT_NAMES, reset: () => { G = defaultState(); saveBlocked = false; popupQueue = []; }, queue: () => popupQueue };\n  // Start\n  init();`);

function harness(saved, options = {}) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  let now = 1000000;
  let seed = options.seed || 17;
  const timers = [];
  window.Date.now = () => now;
  window.matchMedia = () => ({ matches: options.reducedMotion !== false });
  window.Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const audioPlayers=[];
  window.Audio = class extends window.EventTarget { constructor() { super(); this.paused = true; this.currentTime = 0; audioPlayers.push(this); } pause() { this.paused = true; } play() { this.paused = false; return Promise.resolve(); } load() {} removeAttribute() {} };
  window.setInterval = () => 1;
  window.clearInterval = () => {};
  window.setTimeout = (fn, delay) => { timers.push({ fn, at: now + delay }); };
  window.confirm = () => true;
  window.alert = () => {};
  if (saved !== undefined) window.localStorage.setItem('ai_empire_save', saved);
  if (options.before) options.before(window);
  vm.runInContext(exposed, dom.getInternalVMContext(), { filename });
  const api = window.testAPI;
  function advance(ms = 100) {
    now += ms;
    for (const timer of timers.splice(0)) {
      if (timer.at <= now) timer.fn();
      else timers.push(timer);
    }
  }
  function fresh(phase = 1) {
    api.reset();
    const state = window.GAME.state;
    state.phase = phase;
    state.gameStarted = true;
    window.document.querySelector('#intro-overlay').classList.add('hidden');
    for (const el of window.document.querySelectorAll('.show')) el.classList.remove('show');
    return state;
  }
  function worker(role = 'writer') { const agent = api.createAgent(role); window.GAME.state.agents.push(agent); return agent; }
  function task() { const item = api.generateTask(); window.GAME.state.tasks.push(item); return item; }
  function dismiss() { while (api.queue().length) api.dismissPopup(); window.document.querySelector('#offline-popup').classList.remove('show'); }
  function prepareUpgrade(id) {
    const upgrade=api.UPGRADES.find(item=>item.id===id);
    const state=window.GAME.state;
    for(const item of api.UPGRADES) {
      if(item.oneTime && (item.phase<upgrade.phase || (item.phase===upgrade.phase && api.UPGRADES.indexOf(item)<api.UPGRADES.indexOf(upgrade))) && !state.purchasedUpgrades.includes(item.id))state.purchasedUpgrades.push(item.id);
    }
  }
  function fullCluster() {
    const state=window.GAME.state;const cluster=api.addClusterWithNextName();cluster.managerAssigned=true;cluster.tokenManagerAssigned=true;
    if(state.phase>=12)cluster.workforce=cluster.workerSlotsMax;
    else for(let i=0;i<cluster.workerSlotsMax;i++){const agent=worker('coder');agent.name=api.newClusterAgentName();cluster.workerAgentIds.push(agent.id);}
    return cluster;
  }
  return { dom, window, api, audioPlayers, advance, fresh, worker, task, dismiss, prepareUpgrade, fullCluster, close: () => dom.window.close() };
}
module.exports = { harness };
