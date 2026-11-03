const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const filename = path.resolve(__dirname, '../game.js');
const source = fs.readFileSync(filename, 'utf8');
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const names = [...source.matchAll(/^  function (\w+)\(/gm)].map((match) => match[1]);
const exposed = source.replace('  // Start\n  init();', `  window.testAPI = { ${names.join(',')}, UPGRADES, AGENT_ROLES, MILESTONES, reset: () => { G = defaultState(); saveBlocked = false; popupQueue = []; }, queue: () => popupQueue };\n  // Start\n  init();`);

function harness(saved, options = {}) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  let now = 1000000;
  let seed = options.seed || 17;
  const timers = [];
  window.Date.now = () => now;
  window.Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  window.Audio = class { constructor() { this.paused = true; } pause() { this.paused = true; } play() { this.paused = false; return Promise.resolve(); } load() {} removeAttribute() {} };
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
  return { dom, window, api, advance, fresh, worker, task, dismiss, close: () => dom.window.close() };
}
module.exports = { harness };
