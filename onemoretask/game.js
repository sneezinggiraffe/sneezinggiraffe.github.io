(function () {
  "use strict";

  // ---------- HELPERS ----------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const fmt = (n) => {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n < 100 && n % 1 !== 0 ? n.toFixed(2) : n.toFixed(0);
  };
  const fmtCash = (n) => "$" + fmt(n);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (lo, hi) => Math.random() * (hi - lo) + lo;
  const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
  const pick = (arr) => arr[randInt(0, arr.length - 1)];
  const uid = () => Math.random().toString(36).slice(2, 9);

  // ---------- CONSTANTS ----------
  const TICK_MS = 100; // game tick
  const SAVE_INTERVAL = 10000;
  const TASK_SPAWN_BASE = 800; // ms between new tasks (late game formula)
  const MAX_TASKS = 12;
  const AGENT_WORK_MULT = 25; // base multiplier for agent work speed
  const MAX_LOG = 200;
  const AGENT_BASE_HIRE_COST = 250;
  const AGENT_HIRE_COST_MULT = 1.8;
  const SOUNDTRACKS = [
    { minTasks: 8, path: "soundtrack-loop.mp3" },
  ];
  const MUSIC_TARGET_VOLUME = 0.25;
  const MUSIC_FADE_IN_MS = 6000;
  const MUSIC_FADE_STEP_MS = 50;

  const TASK_TYPES = [
    { id: "email", name: "Write Email", icon: "\u2709\uFE0F", baseWork: 5, basePay: 3, baseRep: 1, phase: 1 },
    { id: "research", name: "Research Snippet", icon: "\uD83D\uDD0D", baseWork: 7, basePay: 5, baseRep: 2, phase: 1 },
    { id: "spreadsheet", name: "Spreadsheet Entry", icon: "\uD83D\uDCCA", baseWork: 6, basePay: 4, baseRep: 1, phase: 1 },
    { id: "social", name: "Social Media Post", icon: "\uD83D\uDCF1", baseWork: 4, basePay: 2, baseRep: 2, phase: 1 },
    { id: "copy", name: "Copywriting", icon: "\u270D", baseWork: 8, basePay: 7, baseRep: 3, phase: 1 },
    { id: "article", name: "Blog Article", icon: "\uD83D\uDCDD", baseWork: 14, basePay: 15, baseRep: 5, phase: 3 },
    { id: "report", name: "Data Report", icon: "\uD83D\uDCC8", baseWork: 17, basePay: 20, baseRep: 6, phase: 3 },
    { id: "code", name: "Small Script", icon: "\uD83D\uDCBB", baseWork: 20, basePay: 25, baseRep: 7, phase: 5 },
    { id: "integration", name: "API Integration", icon: "\uD83D\uDD17", baseWork: 28, basePay: 40, baseRep: 10, phase: 5 },
    { id: "webapp", name: "Mini Web App", icon: "\uD83C\uDF10", baseWork: 45, basePay: 70, baseRep: 15, phase: 8 },
    { id: "saas", name: "SaaS Feature", icon: "\u2601", baseWork: 68, basePay: 110, baseRep: 20, phase: 9 },
  ];

  const CLIENT_NAMES = [
    "Greg", "Linda", "Dave", "Brenda", "Mike", "Janet", "Susan", "Doug",
    "Cheryl", "Steve", "Tammy", "Karen", "Bob", "Terry", "Raj", "Diane",
    "Phil", "Monica", "Hank", "Yolanda", "Craig", "Debra", "Norm", "Patty",
    "Aisha", "Marcus", "Priya", "Javier", "Leah", "Omar", "Naomi", "Trevor",
  ];
  const CLIENT_TAGS = [
    "(following up)", "(did you see my last email?)", "(ASAP please)", "(3rd request)",
    "(per my last email)", "(circling back)", "(need this by EOD)", "(just checking in)",
    "(URGENT)", "(overdue)", "(re: last Tuesday)", "(please advise)",
    "(quick favor)", "(final reminder)", "(blocked without this)", "(client waiting)",
    "(need this approved)", "(status update?)",
  ];
  const CLIENT_PLAIN = [
    "URGENT - Client #4092", "Unknown Sender", "Vendor Relations", "Reply-All Victim",
    "Client Escalation Desk", "PRIORITY - External Audit", "Accounts Receivable",
    "angry-customer@gmail.com", "no-reply@important-client.com", "FWD: Escalation Thread",
    "RE: Missing Deliverable", "Billing Dispute Queue", "Executive Assistant Inbox",
  ];
  function pickClient() {
    const r = Math.random();
    if (r < 0.5) return pick(CLIENT_NAMES) + " " + pick(CLIENT_TAGS);
    if (r < 0.8) return pick(CLIENT_NAMES);
    return pick(CLIENT_PLAIN);
  }

  const AGENT_ROLES = [
    { id: "writer", name: "Writer", icon: "\u270D", color: "#06b6d4", specialty: ["email", "social", "copy", "article"], statBias: { speed: 1.2, quality: 1.0, reliability: 0.9 } },
    { id: "researcher", name: "Researcher", icon: "\uD83D\uDD0D", color: "#8b5cf6", specialty: ["research", "report"], statBias: { speed: 0.8, quality: 1.3, reliability: 1.1 } },
    { id: "coder", name: "Coder", icon: "\uD83D\uDCBB", color: "#10b981", specialty: ["code", "integration", "webapp", "saas", "spreadsheet"], statBias: { speed: 1.0, quality: 1.1, reliability: 0.85 } },
    { id: "analyst", name: "Analyst", icon: "\uD83D\uDCCA", color: "#f59e0b", specialty: ["spreadsheet", "report", "research"], statBias: { speed: 0.9, quality: 1.2, reliability: 1.0 } },
    { id: "support", name: "Support", icon: "\uD83C\uDFA7", color: "#ec4899", specialty: ["email", "social"], statBias: { speed: 1.3, quality: 0.9, reliability: 1.0 } },
    { id: "manager", name: "Manager", icon: "\uD83D\uDC54", color: "#f97316", specialty: [], statBias: { speed: 0.7, quality: 1.0, reliability: 1.2 } },
    { id: "devops", name: "DevOps", icon: "\uD83D\uDD27", color: "#64748b", specialty: ["code", "integration", "webapp"], statBias: { speed: 0.9, quality: 1.0, reliability: 1.3 } },
    { id: "sales", name: "Sales", icon: "\uD83D\uDCE3", color: "#22c55e", specialty: ["email", "social", "copy"], statBias: { speed: 1.1, quality: 0.8, reliability: 1.0 } },
    { id: "token_mgr", name: "Token Mgr", icon: "\uD83E\uDE99", color: "#0ea5e9", specialty: [], statBias: { speed: 1.0, quality: 1.0, reliability: 1.0 } },
  ];

  const TRAITS = [
    { id: "overconfident", name: "Overconfident", desc: "+20% speed, -15% reliability", fx: (a) => { a.speed *= 1.2; a.reliability *= 0.85; } },
    { id: "pedantic", name: "Pedantic", desc: "+20% quality, -15% speed", fx: (a) => { a.quality *= 1.2; a.speed *= 0.85; } },
    { id: "sloppy", name: "Sloppy but Fast", desc: "+30% speed, -25% quality", fx: (a) => { a.speed *= 1.3; a.quality *= 0.75; } },
    { id: "tool_obsessed", name: "Tool-Obsessed", desc: "+15% quality, +10% token cost", fx: (a) => { a.quality *= 1.15; a.tokenCost *= 1.1; } },
    { id: "frugal", name: "Frugal", desc: "-20% token cost, -10% speed", fx: (a) => { a.tokenCost *= 0.8; a.speed *= 0.9; } },
    { id: "hallucinator", name: "Hallucinator", desc: "+25% speed, -20% reliability", fx: (a) => { a.speed *= 1.25; a.reliability *= 0.8; } },
    { id: "perfectionist", name: "Perfectionist", desc: "+25% quality, -20% speed", fx: (a) => { a.quality *= 1.25; a.speed *= 0.8; } },
    { id: "chaotic", name: "Chaotic Energy", desc: "All stats +/-20% randomly each task", fx: () => {} },
  ];

  const INCIDENT_TEMPLATES = [
    { id: "hallucination", name: "Hallucinated Output Published", desc: "An agent published confident nonsense to a client.", sev: "critical", repCost: 5, phase: 2 },
    { id: "token_burn", name: "Token Budget Exceeded", desc: "An agent entered a reasoning loop and burned through tokens.", sev: "warning", tokenCost: 50, phase: 3 },
    { id: "wrong_email", name: "Wrong Email Sent", desc: "An agent emailed the wrong client with another client's data.", sev: "critical", repCost: 8, phase: 5 },
    { id: "conflict", name: "Agent Conflict", desc: "Two agents overwrote each other's work.", sev: "warning", repCost: 3, phase: 7 },
    { id: "outage", name: "Deployment Outage", desc: "A deployed service went down. Clients are unhappy.", sev: "critical", repCost: 10, cashCost: 20, phase: 9 },
    { id: "drift", name: "Alignment Drift", desc: "Agents optimised for the wrong metric. Output quality dropped.", sev: "warning", repCost: 4, phase: 10 },
    { id: "overcharge", name: "Billing Spike", desc: "Compute costs surged from an unoptimised workflow.", sev: "warning", cashCost: 30, phase: 6 },
    { id: "data_leak", name: "Data Mix-up", desc: "Training data from one client leaked into another's output.", sev: "critical", repCost: 12, phase: 8 },
  ];

  // ---------- UPGRADES DEFINITIONS ----------
  const UPGRADES = [
    // Early scrappy upgrades (milestone-gated by reqTasks)
    // Likely to have ~$110 at this point
    { id: "post_it_notes", name: "Post-It Notes", desc: "+50% click power. Simple but effective.", cost: 43, currency: "cash", phase: 1, effect: { clickPower: 1.5 }, oneTime: true, reqTasks: 22 },
    { id: "gas_station_coffee", name: "Gas Station Coffee", desc: "Tasks pay 15% more. Caffeine helps.", cost: 51, currency: "cash", phase: 1, effect: { payMult: 1.15 }, oneTime: true, reqTasks: 24 },
    { id: "sticky_note_system", name: "A Box Of Paperclips", desc: "Record who's asking for what.", cost: 34, currency: "cash", phase: 1, effect: { taskDetails: true }, oneTime: true, reqTasks: 26 },
    { id: "side_hustle", name: "Side Hustle Optimization", desc: "Tasks pay 20% more.", cost: 41, currency: "cash", phase: 1, effect: { payMult: 1.2 }, oneTime: true, reqTasks: 30 },
    { id: "inbox_zero", name: "Inbox Zero Method", desc: "Tasks require 15% less work. A clear inbox, a clear mind.", cost: 51, currency: "cash", phase: 1, effect: { workReduction: 0.15 }, oneTime: true, reqTasks: 29 },
    { id: "gtd_workflow", name: "GTD Workflow", desc: "You read 'Getting Things Done'. 2x click power.", cost: 61, currency: "cash", phase: 1, effect: { clickPower: 2 }, oneTime: true, reqTasks: 50 },
    { id: "focus_timer", name: "Focus Timer (Pomodoro)", desc: "Tasks require 20% less work.", cost: 101, currency: "cash", phase: 1, effect: { workReduction: 0.2 }, oneTime: true, reqTasks: 52 },

    // Phase 1 -> 2
    { id: "dual_monitors", name: "Dual Monitors", desc: "+25% pay for all tasks.", cost: 80, currency: "cash", phase: 1, effect: { payMult: 1.00 }, oneTime: true, reqTasks: 92 },
    { id: "noise_cancelling", name: "Noise-Cancelling Headphones", desc: "+50% click power.", cost: 99, currency: "cash", phase: 1, effect: { clickPower: 1.00 }, oneTime: true, reqTasks: 95 },
    { id: "free_ai", name: "Discover Free-Tier AI", desc: "Unlock AI Assist on tasks. Faster but risks hallucination failures.", cost: 210, currency: "cash", phase: 1, unlockPhase: 2, oneTime: true, reqTasks: 120 },

    // Phase 2 -> 3
    { id: "prompt_basics", name: "Prompt Engineering 101", desc: "Reduce AI failure rate by 20%.", cost: 120, currency: "cash", phase: 2, effect: { aiFailMult: 0.8 }, oneTime: true },
    { id: "prompt_examples", name: "Few-Shot Prompting", desc: "AI assist does 30% more work per action.", cost: 170, currency: "cash", phase: 2, effect: { aiPowerMult: 1.3 }, oneTime: true, reqTasks: 120 },
    { id: "marketing_campaign", name: "Marketing Campaign", desc: "Your first marketing campaign! Tasks are more frequent and pay 60% more.", cost: 200, currency: "cash", phase: 2, effect: { payMult: 1.6, giveRep: 80 }, oneTime: true, reqTasks: 230 },
    { id: "pro_model", name: "Pro AI Subscription", desc: "Unlock Pro model: better quality, costs tokens. Unlocks Phase 3.", cost: 500, currency: "cash", phase: 2, unlockPhase: 3, oneTime: true, reqTasks: 260 },

    // Phase 3 -> 4
    { id: "token_pack_1", name: "Token Pack (200)", desc: "Get 200 tokens.", cost: 110, currency: "cash", phase: 3, effect: { giveTokens: 200 }, oneTime: false },
    { id: "token_optimizer", name: "Token Optimizer", desc: "Smarter caching cuts AI assist cost to 4 tok/click.", cost: 150, currency: "cash", phase: 3, effect: { tokenEfficiency: 0.8 }, oneTime: true},
    { id: "guardrails", name: "Output Guardrails", desc: "Validation layer catches hallucinations. AI failure rate -30%.", cost: 165, currency: "cash", phase: 3, effect: { aiFailMult: 0.7 }, oneTime: true },
    { id: "token_compressor", name: "Prompt Compression", desc: "Prompt compacting cuts AI assist cost to 3 tok/click.", cost: 180, currency: "cash", phase: 3, effect: { tokenEfficiency: 0.75 }, oneTime: true, reqTasks: 300 },
    { id: "premium_support", name: "Premium Support", desc: "Priority response times. Clients are thrilled.", cost: 113, currency: "cash", phase: 3, effect: { giveRep: 1 }, oneTime: true, reqTasks: 335 },
    { id: "token_distiller", name: "Model Distillation", desc: "Smaller model handles routine work. AI assist cost drops to 2 tok/click.", cost: 291, currency: "cash", phase: 3, effect: { tokenEfficiency: 0.67 }, oneTime: true, reqTasks: 350 },
    { id: "batch_processing", name: "Batch Processing", desc: "Queue and process work in batches. 2x click power.", cost: 400, currency: "cash", phase: 3, effect: { clickPower: 2 }, oneTime: true, reqTasks: 351 },
    { id: "billboard_campaign", name: "Billboard", desc: "A large advert on the side of a nearby building. More demand and higher pay.", cost: 500, currency: "cash", phase: 3, effect: { payMult: 2.0, giveRep: 1000 }, oneTime: true, reqTasks: 353 },
    { id: "structured_output", name: "Structured Outputs", desc: "JSON mode makes task results 25% more valuable.", cost: 500, currency: "cash", phase: 3, effect: { payMult: 1.35 }, oneTime: true, reqTasks: 353 },
    { id: "multi_bot", name: "Multi-Bot License", desc: "Unlock agent hiring. Phase 4 begins.", cost: 2200, currency: "cash", phase: 3, unlockPhase: 4, oneTime: true, reqTasks: 380 },

    // Phase 4 -> 5
    { id: "agent_onboarding", name: "Agent Onboarding Guide", desc: "Better instructions for agents. +15% agent speed.", cost: 1100, currency: "cash", phase: 4, effect: { agentSpeedMult: 1.15 }, oneTime: true },
    { id: "agent_slot_3", name: "Agent Slot Expansion (3)", desc: "Allow up to 3 agents.", cost: 2200, currency: "cash", phase: 4, effect: { agentSlots: 3 }, oneTime: true },
    { id: "task_templates", name: "Task Templates", desc: "Pre-written briefs. Tasks require 15% less work.", cost: 2400, currency: "cash", phase: 4, effect: { workReduction: 0.15 }, oneTime: true },
    { id: "client_crm", name: "Client Tracker", desc: "Keep clients happy. Tasks pay 40% more.", cost: 2800, currency: "cash", phase: 4, effect: { payMult: 1.4 }, oneTime: true },
    { id: "error_handling", name: "Error Recovery Protocol", desc: "Agents fail less often. -20% AI failure rate.", cost: 3200, currency: "cash", phase: 4, effect: { aiFailMult: 0.8 }, oneTime: true },
    { id: "agent_slot_5", name: "Agent Slot Expansion (5)", desc: "Allow up to 5 agents.", cost: 6500, currency: "cash", phase: 4, effect: { agentSlots: 5 }, oneTime: true },
    { id: "growth_marketing", name: "Growth Marketing Engine", desc: "Launch paid ads and referral loops. Adds passive cashflow and boosts agent-generated revenue.", cost: 8100, currency: "cash", phase: 4, effect: { payMult: 1.35, giveRep: 220 }, oneTime: true },
    { id: "tool_use", name: "Tool Use SDK", desc: "Agents can use tools. Unlock Phase 5.", cost: 12000, currency: "cash", phase: 4, unlockPhase: 5, oneTime: true },

    // Phase 5 -> 6
    { id: "macro_keyboard", name: "Macro Keyboard", desc: "Programmable hotkeys. 3x click power.", cost: 600, currency: "cash", phase: 5, effect: { clickPower: 3 }, oneTime: true },
    { id: "web_browse", name: "Web Search Tool", desc: "Agents can browse the web. +15% quality on research.", cost: 400, currency: "cash", phase: 5, effect: { toolBonus: 0.15 }, oneTime: true },
    { id: "code_exec", name: "Code Execution Tool", desc: "Agents can run code. +20% speed on code tasks.", cost: 500, currency: "cash", phase: 5, effect: { codeSpeedMult: 1.2 }, oneTime: true },
    { id: "scheduling", name: "Job Scheduler", desc: "Set agents to run on schedules. Unlock Phase 6.", cost: 2000, currency: "cash", phase: 5, unlockPhase: 6, oneTime: true },

    // Phase 6 -> 7
    { id: "neural_boost", name: "Neural Architecture Boost", desc: "Optimised model weights. All agents work 50% faster.", cost: 800, currency: "cash", phase: 6, effect: { agentSpeedMult: 1.5 }, oneTime: true },
    { id: "compute_1", name: "Compute Tier 1", desc: "Unlock 3 compute slots for parallel jobs.", cost: 500, currency: "cash", phase: 6, effect: { compute: 3 }, oneTime: true },
    { id: "compute_2", name: "Compute Tier 2", desc: "Upgrade to 6 compute slots.", cost: 1200, currency: "cash", phase: 6, effect: { compute: 6 }, oneTime: true },
    { id: "management", name: "Agent Management Console", desc: "Unlock manager dashboard. Phase 7.", cost: 1000, currency: "cash", phase: 6, unlockPhase: 7, oneTime: true },

    // Phase 7 -> 8
    { id: "manager_agent", name: "Manager Agent Unlock", desc: "Hire manager agents that route and retry. +1 agent slot.", cost: 1500, currency: "cash", phase: 7, effect: { managerUnlock: true, agentSlots: 6 }, oneTime: true },
    { id: "smart_routing", name: "Smart Routing", desc: "Manager assigns agents to any task when no specialty match. No idle time.", cost: 1200, currency: "cash", phase: 7, effect: { smartRouting: true }, oneTime: true },
    { id: "agent_slot_7", name: "Agent Slot Expansion (8)", desc: "Allow up to 8 agents.", cost: 2000, currency: "cash", phase: 7, effect: { agentSlots: 7 }, oneTime: true },
    { id: "code_agents", name: "Code-Writer Agents", desc: "Agents can write scripts and automations. Phase 8.", cost: 2500, currency: "cash", phase: 7, unlockPhase: 8, oneTime: true },

    // Phase 8 -> 9
    { id: "testing", name: "Automated Testing", desc: "Reduces technical debt growth by 30%.", cost: 2000, currency: "cash", phase: 8, effect: { debtReduction: 0.3 }, oneTime: true },
    { id: "code_review", name: "Code Review Bot", desc: "Improves code agent quality by 25%.", cost: 2000, currency: "cash", phase: 8, effect: { codeQualityMult: 1.25 }, oneTime: true },
    { id: "deploy", name: "Deployment Platform", desc: "Deploy services for passive income. Phase 9.", cost: 5000, currency: "cash", phase: 8, unlockPhase: 9, oneTime: true },

    // Phase 9 -> 10
    { id: "server_1", name: "Server Tier 1", desc: "Deploy up to 2 services.", cost: 3000, currency: "cash", phase: 9, effect: { serviceSlots: 2 }, oneTime: true },
    { id: "server_2", name: "Server Tier 2", desc: "Deploy up to 5 services.", cost: 8000, currency: "cash", phase: 9, effect: { serviceSlots: 5 }, oneTime: true },
    { id: "fusion", name: "Agent Fusion Lab", desc: "Fuse agents into composite engines. Phase 10.", cost: 10000, currency: "cash", phase: 9, unlockPhase: 10, oneTime: true },

    // Phase 10 -> 11
    { id: "swarm", name: "Swarm Mode", desc: "Run many cheap agents in parallel with voting.", cost: 15000, currency: "cash", phase: 10, effect: { swarmMode: true }, oneTime: true },
    { id: "consensus", name: "Consensus Engine", desc: "Reduces alignment drift incidents by 50%.", cost: 12000, currency: "cash", phase: 10, effect: { driftReduction: 0.5 }, oneTime: true },
    { id: "enterprise", name: "Enterprise License", desc: "Full autonomous departments. Phase 11.", cost: 25000, currency: "cash", phase: 10, unlockPhase: 11, oneTime: true },

    // Phase 11 -> 12
    { id: "ai_ceo", name: "AI CEO", desc: "Meta-agent allocates budget and decides what to build.", cost: 50000, currency: "cash", phase: 11, effect: { aiCeo: true }, oneTime: true },
    { id: "agent_slot_15", name: "Agent Slot Expansion (15)", desc: "Allow up to 15 agents.", cost: 30000, currency: "cash", phase: 11, effect: { agentSlots: 15 }, oneTime: true },
    { id: "retire_unlock", name: "Golden Parachute", desc: "The Retire button appears. Phase 12.", cost: 100000, currency: "cash", phase: 11, unlockPhase: 12, oneTime: true },

    // Repeatable
    { id: "token_pack_2", name: "Token Pack (500)", desc: "Get 500 tokens.", cost: 300, currency: "cash", phase: 3, effect: { giveTokens: 500 }, oneTime: false },
    { id: "pay_debt", name: "Pay Down Tech Debt", desc: "Reduce agent failure rate by 15.", cost: 200, currency: "cash", phase: 8, effect: { reduceDebt: 15 }, oneTime: false },
  ];

  // Expenses tiers
  const EXPENSE_TIERS = [
    { phase: 1, name: "Living in car", rate: 1.0 },
    { phase: 2, name: "Shared coworking desk", rate: 1.5 },
    { phase: 3, name: "Pro AI subscription", rate: 2.0 },
    { phase: 4, name: "Home office", rate: 5 },
    { phase: 5, name: "Small office + tools", rate: 10 },
    { phase: 6, name: "Server costs", rate: 10 },
    { phase: 7, name: "Team management overhead", rate: 18 },
    { phase: 8, name: "Dev infrastructure", rate: 30 },
    { phase: 9, name: "Hosting & deployment", rate: 50 },
    { phase: 10, name: "Swarm compute cluster", rate: 85 },
    { phase: 11, name: "Enterprise operations", rate: 150 },
    { phase: 12, name: "Global AI empire", rate: 250 },
  ];

  // ---------- MILESTONES ----------
  const MILESTONES = [
    // Task-count based
    { id: "first_task", reqTasks: 3, reveals: ["topBar", "cash"] },
    { id: "backlog_start", reqTasks: 5, reveals: ["taskQueue"], popup: { title: "Incoming...", msg: "More gigs are coming in. Your inbox is filling up." }, spawnOnTrigger: 2 },
    { id: "rep_unlock", reqTasks: 10, reveals: ["rep"] },
    { id: "stress_unlock", reqTasks: 12, reveals: ["stress"], popup: { title: "Pressure Building", msg: "The work keeps coming. You are starting to feel the pressure." } },
    { id: "upgrades_unlock", reqTasks: 20, reveals: ["upgrades", "log"], setFlags: { taskExpiryEnabled: true }, popup: { title: "Tools of the Trade", msg: "Maybe some better tools would help you keep up..." } },
    { id: "expenses_unlock", reqTasks: 90, reveals: ["expenseCard", "expenses"], setFlags: { expensesRevealed: true }, popup: { title: "Reality Check", msg: "Your phone bill is due. Your car needs gas. Living costs money, even in a parking lot. Bills are now draining your cash." } },
    { id: "income_display", reqTasks: 96, reveals: ["income"] },
    { id: "ai_hint", reqTasks: 110, popup: { title: "There Must Be a Better Way", msg: "You are getting faster, but the work never stops. Maybe there is a smarter way..." } },
    // Phase-based
    { id: "tokens_unlock", reqPhase: 3, reveals: ["tokens"] },
    { id: "agents_unlock", reqPhase: 4, reveals: ["agents"], popup: { title: "Delegation", msg: "You can now hire AI agents to work tasks for you. Each agent has stats, traits, and specialties." } },
    { id: "compute_unlock", reqPhase: 6, reveals: ["compute", "automation"] },
    { id: "dashboard_unlock", reqPhase: 7, reveals: ["dashboard"] },
    { id: "debt_unlock", reqPhase: 8, reveals: ["debt"] },
    { id: "prestige_unlock", reqPhase: 11, reveals: ["prestige"] },
  ];

  // ---------- GAME STATE ----------
  let G = defaultState();

  function defaultState() {
    return {
      cash: 0,
      tokens: 0,
      reputation: 0,
      techDebt: 0,
      stress: 0,
      computeUsed: 0,
      computeMax: 0,
      phase: 1,
      clickPower: 1,
      aiFailMult: 1,
      aiPowerMult: 1,
      tokenEfficiency: 1,
      toolBonus: 0,
      codeSpeedMult: 1,
      agentSpeedMult: 1,
      codeQualityMult: 1,
      debtReduction: 0,
      driftReduction: 0,
      agentSlots: 2,
      serviceSlots: 0,
      managerUnlock: false,
      smartRouting: false,
      lastTokenBuy: 0,
      swarmMode: false,
      aiCeo: false,
      tasks: [],
      agents: [],
      incidents: [],
      schedules: [],
      services: [],
      purchasedUpgrades: [],
      log: [],
      totalCashEarned: 0,
      totalTasksDone: 0,
      totalClicks: 0,
      totalIncidents: 0,
      activeTaskId: null,
      // Prestige
      prestigeCount: 0,
      prestigeBonusClick: 0,
      prestigeBonusTokens: 0,
      prestigeBonusSlot: false,
      // Timing
      lastTick: Date.now(),
      lastSave: Date.now(),
      lastTaskSpawn: Date.now(),
      lastIncidentCheck: Date.now(),
      gameStarted: false,
      startTime: Date.now(),
      totalPlaytime: 0,
      // Onboarding / progressive reveal
      milestonesReached: [],
      expensesRevealed: false,
      incidentsExplained: false,
      aiAssistCount: 0,
      taskExpiryEnabled: false,
      payMult: 1,
      workReduction: 0,
      taskDetails: false,
      musicEnabled: true,
      uiRevealed: {
        topBar: false,
        cash: false,
        rep: false,
        stress: false,
        tokens: false,
        compute: false,
        debt: false,
        expenses: false,
        income: false,
        taskQueue: false,
        upgrades: false,
        expenseCard: false,
        agents: false,
        incidents: false,
        automation: false,
        dashboard: false,
        prestige: false,
        log: false,
      },
    };
  }

  // ---------- SAVE / LOAD ----------
  function save() {
    G.lastSave = Date.now();
    try {
      localStorage.setItem("ai_empire_save", JSON.stringify(G));
    } catch (e) { /* quota exceeded - ignore */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem("ai_empire_save");
      if (!raw) return false;
      const data = JSON.parse(raw);
      const def = defaultState();
      for (const k of Object.keys(def)) {
        if (data[k] !== undefined) G[k] = data[k];
      }
      // Apply prestige bonuses
      G.clickPower = Math.max(G.clickPower, 1 + G.prestigeBonusClick);
      // Migrate old saves without onboarding fields
      migrateSave();
      return true;
    } catch (e) {
      return false;
    }
  }

  function migrateSave() {
    // Detect old save without uiRevealed (pre-onboarding)
    if (!G.uiRevealed || G.uiRevealed.topBar === undefined) {
      const def = defaultState();
      G.milestonesReached = [];
      G.uiRevealed = { ...def.uiRevealed };
      if (G.aiAssistCount === undefined) G.aiAssistCount = 0;
      if (G.taskExpiryEnabled === undefined) G.taskExpiryEnabled = true;
      if (G.payMult === undefined) G.payMult = 1;
      if (G.workReduction === undefined) G.workReduction = 0;
      if (G.taskDetails === undefined) G.taskDetails = false;

      // Fast-forward by re-running milestone checks (applies reveals + flags)
      checkMilestones();

      // Edge cases not covered by milestones
      if (G.phase >= 2) G.incidentsExplained = true;
      if (G.incidents.length > 0 || G.totalIncidents > 0) G.uiRevealed.incidents = true;
    }
  }

  // ---------- LOGGING ----------
  function log(msg, type) {
    type = type || "";
    G.log.unshift({ msg: msg, type: type, t: Date.now() });
    if (G.log.length > MAX_LOG) G.log.length = MAX_LOG;
  }

  // ---------- TASK GENERATION ----------
  function availableTaskTypes() {
    return TASK_TYPES.filter((t) => t.phase <= G.phase);
  }

  function generateTask() {
    const types = availableTaskTypes();
    const type = pick(types);
    const tier = Math.max(1, G.phase - type.phase + 1);
    const mult = 1 + (tier - 1) * 0.5 + G.prestigeCount * 0.1;
    const fatigueMult = 1 + G.totalTasksDone * 0.002; // slow fatigue
    return {
      id: uid(),
      typeId: type.id,
      name: type.name,
      icon: type.icon,
      client: pickClient(),
      workRequired: Math.ceil(type.baseWork * mult * fatigueMult * (1 - G.workReduction)),
      workDone: 0,
      pay: Math.round(type.basePay * mult * 10) / 10,
      repReward: Math.ceil(type.baseRep * mult),
      tokenCost: G.phase >= 3 ? Math.ceil(type.baseWork * 0.3 * mult) : 0,
      failChance: 0,
      assignedAgent: null,
      status: "available", // available, active, agent, done
      createdAt: Date.now(),
    };
  }

  function generateEarlyTask() {
    // For early game: pick only simple Phase 1 tasks
    const easyTypes = TASK_TYPES.filter((t) => t.phase === 1 && t.baseWork <= 10);
    const type = pick(easyTypes);
    return {
      id: uid(),
      typeId: type.id,
      name: type.name,
      icon: type.icon,
      client: pickClient(),
      workRequired: type.baseWork,
      workDone: 0,
      pay: type.basePay,
      repReward: type.baseRep,
      tokenCost: 0,
      failChance: 0,
      assignedAgent: null,
      status: "active",
      createdAt: Date.now(),
    };
  }

  function getMaxTasks() {
    if (G.prestigeCount > 0) return MAX_TASKS;
    if (G.totalTasksDone < 10) return 3;
    if (G.totalTasksDone < 20) return 5;
    if (G.totalTasksDone < 50) return 6;
    if (G.totalTasksDone < 100) return 8;
    return MAX_TASKS;
  }

  function getSpawnInterval() {
    if (G.prestigeCount > 0) {
      return Math.max(500, TASK_SPAWN_BASE - G.phase * 500 - G.reputation * 5);
    }
    if (!G.uiRevealed.taskQueue) return Infinity; // No auto-spawn before task queue
    if (G.totalTasksDone < 10) return 2000;
    if (G.totalTasksDone < 15) return 1600;
    if (G.totalTasksDone < 20) return 1100;
    if (G.totalTasksDone < 50) return 1000;
    if (G.totalTasksDone < 200) return 500;
    return Math.max(500, TASK_SPAWN_BASE - G.phase * 550 - G.reputation * 5);
  }

  function spawnTask() {
    if (G.tasks.length >= getMaxTasks()) return;
    const task = generateTask();
    G.tasks.push(task);
  }

  // ---------- EARLY GAME: DO TASK BUTTON ----------
  function doEarlyTask(evt) {
    // In early game (< 3 tasks done), the big button creates + works on tasks
    let task = G.tasks.find((t) => t.status === "active");
    if (!task) {
      task = generateEarlyTask();
      G.tasks.push(task);
      G.activeTaskId = task.id;
    }
    clickTask(task.id, evt);
  }

  // ---------- CLICKING / TASK WORK ----------
  function clickTask(taskId, evt) {
    const task = G.tasks.find((t) => t.id === taskId);
    if (!task || task.status === "done") return;
    task.status = "active";
    G.activeTaskId = taskId;
    G.totalClicks++;
    G.stress = clamp(G.stress + 0.3, 0, 100);

    let power = G.clickPower;
    task.workDone = Math.min(task.workRequired, task.workDone + power);

    if (task.workDone >= task.workRequired) {
      completeTask(task, "manual");
    }
    showClickReward(power, evt);
  }

  function aiAssistTask(taskId, evt) {
    const task = G.tasks.find((t) => t.id === taskId);
    if (!task || task.status === "done") return;
    if (G.phase < 2) return;

    const tokenCost = G.phase >= 3 ? Math.ceil(3 * (1 + G.phase * 0.2) * G.tokenEfficiency) : 0;
    if (tokenCost > 0 && G.tokens < tokenCost) {
      log("Not enough tokens for AI assist!", "bad");
      return;
    }
    if (tokenCost > 0) G.tokens -= tokenCost;

    task.status = "active";
    G.activeTaskId = taskId;

    let power = Math.ceil(G.clickPower * 2.5 * G.aiPowerMult);
    const failRoll = Math.random();
    const failThreshold = 0.25 * G.aiFailMult * (1 + G.techDebt * 0.005);

    if (failRoll < failThreshold * 0.3) {
      // Total nonsense -- reset progress
      task.workDone = 0;
      log("AI produced nonsense on \"" + task.name + "\". Progress reset!", "bad");
      G.stress = clamp(G.stress + 5, 0, 100);
    } else if (failRoll < failThreshold) {
      // Hallucination -- partial redo
      task.workDone = Math.max(0, task.workDone - Math.ceil(power * 0.5));
      log("AI hallucinated on \"" + task.name + "\". Some progress lost.", "warn");
      G.stress = clamp(G.stress + 2, 0, 100);
    } else {
      task.workDone = Math.min(task.workRequired, task.workDone + power);
    }

    if (task.workDone >= task.workRequired) {
      completeTask(task, "ai_assist");
    }

    // Track AI assist count for scripted first incident
    G.aiAssistCount++;
    if (G.aiAssistCount === 25 && !G.incidentsExplained) {
      triggerTutorialIncident();
    }

    showClickReward(power, evt);
  }

  function triggerTutorialIncident() {
    G.incidentsExplained = true;
    const incident = {
      id: uid(),
      templateId: "hallucination",
      name: "Hallucinated Output Published",
      desc: "Your AI produced confident nonsense and sent it to a client.",
      sev: "warning",
      repCost: 3,
      cashCost: 0,
      tokenCost: 0,
      createdAt: Date.now(),
      resolved: false,
    };
    G.incidents.push(incident);
    G.totalIncidents++;
    G.reputation = Math.max(0, G.reputation - 1);
    G.uiRevealed.incidents = true;
    log("INCIDENT: Hallucinated Output Published!", "bad");
    showPopup("Your First Incident", "Incidents are operational failures caused by automation. Unresolved incidents drain reputation over time. Fix manually (costs stress) or pay to resolve. This is a mild one. They get worse as you scale.");
  }

  function findMatchingTask(agent) {
    var avail = G.tasks.filter(function (t) { return t.status === "available"; });
    return avail.find(function (t) { return agent.specialty.includes(t.typeId); }) || null;
  }

  function autoAssignAgent(agentId) {
    var agent = G.agents.find(function (a) { return a.id === agentId; });
    if (!agent || agent.status !== "idle") return;
    var task = findMatchingTask(agent);
    if (task) assignAgentToTask(task.id, agentId);
  }

  function assignAgentToTask(taskId, agentId) {
    const task = G.tasks.find((t) => t.id === taskId);
    const agent = G.agents.find((a) => a.id === agentId);
    if (!task || !agent || agent.status !== "idle") return;
    task.status = "agent";
    task.assignedAgent = agentId;
    agent.status = "working";
    agent.currentTask = taskId;
    log("Assigned " + agent.name + " to \"" + task.name + "\".", "info");
  }

  function getTaskCashPayout(task, method, agent) {
    var taskMult = 1;
    if (method === "agent" && agent) taskMult = agent.quality;
    return task.pay * taskMult * G.payMult;
  }

  function completeTask(task, method) {
    task.status = "done";
    task.workDone = task.workRequired;

    let repMult = 1;
    let agent = null;

    if (method === "agent") {
      agent = G.agents.find((a) => a.id === task.assignedAgent);
      if (agent) {
        repMult = agent.quality;
        agent.status = "idle";
        agent.tokenStarved = false;
        agent.currentTask = null;
        agent.tasksCompleted = (agent.tasksCompleted || 0) + 1;
      }
    }

    const pay = getTaskCashPayout(task, method, agent);
    const rep = Math.ceil(task.repReward * repMult);
    G.cash += pay;
    G.reputation += rep;
    G.totalCashEarned += pay;
    G.totalTasksDone++;
    syncMusicPlayback();

    if (G.stress > 0) G.stress = clamp(G.stress - 2, 0, 100);

    log("Completed \"" + task.name + "\" -> +" + fmtCash(pay) + ", +" + rep + " rep", "good");

    // Check milestones immediately on task completion
    checkMilestones();

    // Remove from task list after a short delay
    setTimeout(() => {
      G.tasks = G.tasks.filter((t) => t.id !== task.id);
      if (G.activeTaskId === task.id) G.activeTaskId = null;
    }, 300);
  }

  // ---------- AGENT SYSTEM ----------
  function createAgent(roleId) {
    const role = AGENT_ROLES.find((r) => r.id === roleId);
    if (!role) return null;
    const trait = pick(TRAITS);
    const baseSpeed = rand(0.8, 1.2) * role.statBias.speed;
    const baseQuality = rand(0.8, 1.2) * role.statBias.quality;
    const baseReliability = rand(0.75, 1.1) * role.statBias.reliability;
    const agent = {
      id: uid(),
      name: generateAgentName(),
      roleId: role.id,
      roleName: role.name,
      icon: role.icon,
      color: role.color,
      specialty: role.specialty,
      traitId: trait.id,
      traitName: trait.name,
      traitDesc: trait.desc,
      speed: baseSpeed,
      quality: baseQuality,
      reliability: baseReliability,
      tokenCost: rand(0.8, 1.2),
      status: "idle", // idle, working, error
      currentTask: null,
      tasksCompleted: 0,
      hired: Date.now(),
    };
    trait.fx(agent);
    return agent;
  }

  const AGENT_FIRST = ["Alpha", "Beta", "Gamma", "Delta", "Echo", "Nova", "Pixel", "Logic", "Byte", "Flux", "Quark", "Neon", "Synth", "Proto", "Cipher", "Vector", "Pulse", "Drift", "Glitch", "Spark"];
  const AGENT_LAST = ["3000", "Prime", "Max", "Ultra", "Lite", "Zero", "One", "X", "Pro", "Mini", "Turbo", "Core", "Net", "Hub", "Bot", "AI", "GPT", "LLM"];
  function generateAgentName() {
    return pick(AGENT_FIRST) + "-" + pick(AGENT_LAST);
  }

  function hireAgent(roleId) {
    if (G.agents.some(function (a) { return a.roleId === roleId; })) {
      log("Already have that agent type!", "bad");
      return;
    }
    const activeAgents = G.agents.length;
    if (activeAgents >= G.agentSlots) {
      log("No agent slots available!", "bad");
      return;
    }
    const cost = getAgentHireCost(activeAgents);
    if (G.cash < cost) {
      log("Not enough cash to hire (need " + fmtCash(cost) + ").", "bad");
      return;
    }
    G.cash -= cost;
    const agent = createAgent(roleId);
    G.agents.push(agent);
    log("Hired " + agent.name + " (" + agent.roleName + ", " + agent.traitName + ")!", "info");
  }

  function fireAgent(agentId) {
    const idx = G.agents.findIndex((a) => a.id === agentId);
    if (idx === -1) return;
    const agent = G.agents[idx];
    if (agent.status === "working") {
      const task = G.tasks.find((t) => t.id === agent.currentTask);
      if (task) {
        task.status = "available";
        task.assignedAgent = null;
      }
    }
    // Sell for 30% of next hire cost
    const refund = Math.ceil(getAgentHireCost(G.agents.length - 1) * 0.3);
    G.cash += refund;
    G.agents.splice(idx, 1);
    log("Fired " + agent.name + ". Recovered " + fmtCash(refund) + ".", "warn");
  }

  // ---------- AGENT TICK ----------
  function tickAgents(dtSec) {
    for (const agent of G.agents) {
      if (agent.status !== "working") continue;
      const task = G.tasks.find((t) => t.id === agent.currentTask);
      if (!task) {
        agent.status = "idle";
        agent.currentTask = null;
        continue;
      }

      // Token cost per second
      const tokenBurn = agent.tokenCost * 0.5 * dtSec;
      if (G.tokens < tokenBurn && G.phase >= 3) {
        if (!agent.tokenStarved) log(agent.name + " stalled: out of tokens.", "warn");
        agent.tokenStarved = true;
        continue;
      }
      agent.tokenStarved = false;
      if (G.phase >= 3) G.tokens -= tokenBurn;

      // Work done per second
      let workRate = agent.speed * AGENT_WORK_MULT * G.agentSpeedMult * dtSec;
      const isSpecialty = agent.specialty.includes(task.typeId);
      if (isSpecialty) workRate *= 1.4;
      if (G.toolBonus > 0 && ["research", "report"].includes(task.typeId)) workRate *= 1 + G.toolBonus;
      if (G.codeSpeedMult > 1 && ["code", "integration", "webapp", "saas"].includes(task.typeId)) workRate *= G.codeSpeedMult;

      // Reliability check
      const failRoll = Math.random();
      const failThreshold = (1 - agent.reliability * 0.8) * 0.02 * (1 + G.techDebt * 0.01);
      if (failRoll < failThreshold) {
        agent.status = "error";
        agent.tokenStarved = false;
        task.status = "available";
        task.assignedAgent = null;
        agent.currentTask = null;
        log(agent.name + " failed on \"" + task.name + "\". Agent needs reset.", "bad");
        maybeCreateIncident(agent);
        continue;
      }

      task.workDone = Math.min(task.workRequired, task.workDone + workRate);
      if (task.workDone >= task.workRequired) {
        completeTask(task, "agent");
      }
    }

    // Auto-recover error agents after a delay
    for (const agent of G.agents) {
      if (agent.status === "error") {
        if (!agent.errorTime) agent.errorTime = Date.now();
        if (Date.now() - agent.errorTime > 5000) {
          agent.status = "idle";
          agent.errorTime = null;
        }
      }
    }
  }

  // ---------- MANAGER AUTO-ASSIGN ----------
  function tickManager() {
    var hasManager = G.agents.some(function (a) { return a.roleId === "manager" && a.status === "idle"; });
    if (!hasManager) return;
    for (var i = 0; i < G.agents.length; i++) {
      var agent = G.agents[i];
      if (agent.roleId === "manager" || agent.roleId === "token_mgr") continue;
      if (agent.status !== "idle") continue;
      var task = findMatchingTask(agent);
      if (!task && G.smartRouting) {
        var avail = G.tasks.filter(function (t) { return t.status === "available"; });
        task = avail[0] || null;
      }
      if (task) assignAgentToTask(task.id, agent.id);
    }
  }

  // ---------- TOKEN MANAGER AUTO-BUY ----------
  function tickTokenManager() {
    var hasTokenMgr = G.agents.some(function (a) { return a.roleId === "token_mgr" && a.status === "idle"; });
    if (!hasTokenMgr) return;
    if (G.tokens > 100) return;
    if (Date.now() - G.lastTokenBuy < 2000) return;
    // Buy bulk pack if affordable, otherwise starter pack
    var bulkPack = UPGRADES.find(function (u) { return u.id === "token_pack_2"; });
    var starterPack = UPGRADES.find(function (u) { return u.id === "token_pack_1"; });
    var bulkCost = bulkPack ? getUpgradeCost(bulkPack) : 300;
    var starterCost = starterPack ? getUpgradeCost(starterPack) : 110;
    if (G.cash >= bulkCost) {
      G.cash -= bulkCost;
      G.tokens += 500;
      G.lastTokenBuy = Date.now();
      log("Token Manager auto-purchased 500 tokens.", "info");
    } else if (G.cash >= starterCost) {
      G.cash -= starterCost;
      G.tokens += 200;
      G.lastTokenBuy = Date.now();
      log("Token Manager auto-purchased 200 tokens.", "info");
    }
  }

  // ---------- INCIDENTS ----------
  function maybeCreateIncident(agent) {
    const templates = INCIDENT_TEMPLATES.filter((t) => t.phase <= G.phase);
    if (templates.length === 0) return;
    if (Math.random() > 0.4) return; // 40% chance an agent error creates an incident
    const tmpl = pick(templates);
    const incident = {
      id: uid(),
      templateId: tmpl.id,
      name: tmpl.name,
      desc: tmpl.desc + (agent ? " (" + agent.name + ")" : ""),
      sev: tmpl.sev,
      repCost: tmpl.repCost || 0,
      cashCost: tmpl.cashCost || 0,
      tokenCost: tmpl.tokenCost || 0,
      createdAt: Date.now(),
      resolved: false,
    };
    G.incidents.push(incident);
    G.totalIncidents++;

    // Immediate partial penalty
    if (incident.repCost > 0) G.reputation = Math.max(0, G.reputation - Math.ceil(incident.repCost / 2));
    if (incident.cashCost > 0) G.cash = Math.max(0, G.cash - incident.cashCost / 2);

    // Reveal incidents UI if not yet shown
    if (!G.uiRevealed.incidents) G.uiRevealed.incidents = true;

    log("INCIDENT: " + incident.name + "!", "bad");
  }

  function resolveIncident(incidentId, method) {
    const inc = G.incidents.find((i) => i.id === incidentId);
    if (!inc || inc.resolved) return;

    if (method === "manual") {
      // Takes time/stress but free
      G.stress = clamp(G.stress + 10, 0, 100);
      inc.resolved = true;
      log("Manually resolved: " + inc.name + ".", "good");
    } else if (method === "cash") {
      const cost = (inc.cashCost || 20) * 2;
      if (G.cash < cost) { log("Not enough cash!", "bad"); return; }
      G.cash -= cost;
      inc.resolved = true;
      log("Paid " + fmtCash(cost) + " to resolve: " + inc.name + ".", "warn");
    }

    // Remove resolved after delay
    setTimeout(() => {
      G.incidents = G.incidents.filter((i) => i.id !== incidentId);
    }, 500);
  }

  function tickIncidents(dtSec) {
    // Unresolved incidents drain reputation over time
    for (const inc of G.incidents) {
      if (inc.resolved) continue;
      const age = (Date.now() - inc.createdAt) / 1000;
      if (age > 10) {
        G.reputation = Math.max(0, G.reputation - 0.1 * dtSec);
      }
    }

    // Random incident generation -- only after tutorial incident
    if (!G.incidentsExplained) return;
    if (G.phase < 2 || G.agents.length === 0) return;
    const checkInterval = Math.max(15000, 60000 - G.phase * 3000 - G.agents.length * 1000);
    if (Date.now() - G.lastIncidentCheck < checkInterval) return;
    G.lastIncidentCheck = Date.now();

    let chance = 0.05 + G.phase * 0.02 + G.techDebt * 0.003 + G.agents.length * 0.01;
    if (G.driftReduction > 0) chance *= (1 - G.driftReduction * 0.3);
    if (Math.random() < chance) {
      maybeCreateIncident(null);
    }
  }

  // ---------- SCHEDULES (Phase 6+) ----------
  function addSchedule() {
    if (G.phase < 6) return;
    const idleAgents = G.agents.filter((a) => a.status === "idle");
    if (idleAgents.length === 0) { log("No idle agents for schedule!", "bad"); return; }

    const cost = getScheduleCost();
    if (G.cash < cost) { log("Need " + fmtCash(cost) + " to add schedule.", "bad"); return; }
    G.cash -= cost;

    const agent = idleAgents[0];
    const types = availableTaskTypes();
    const taskType = pick(types);

    G.schedules.push({
      id: uid(),
      name: "Daily " + taskType.name,
      taskTypeId: taskType.id,
      agentId: agent.id,
      agentName: agent.name,
      intervalMs: 30000, // 30s game time = "daily"
      lastRun: 0,
      enabled: true,
    });
    log("Added schedule: Daily " + taskType.name + " -> " + agent.name, "info");
  }

  function tickSchedules() {
    if (G.phase < 6) return;
    const now = Date.now();
    for (const sched of G.schedules) {
      if (!sched.enabled) continue;
      if (now - sched.lastRun < sched.intervalMs) continue;
      sched.lastRun = now;

      const agent = G.agents.find((a) => a.id === sched.agentId);
      if (!agent || agent.status !== "idle") continue;
      if (G.computeUsed >= G.computeMax && G.computeMax > 0) continue;

      // Generate and auto-assign
      const task = generateTask();
      task.typeId = sched.taskTypeId;
      const tmpl = TASK_TYPES.find((t) => t.id === sched.taskTypeId) || TASK_TYPES[0];
      task.name = tmpl.name + " (scheduled)";
      task.icon = tmpl.icon;
      G.tasks.push(task);
      assignAgentToTask(task.id, agent.id);
      if (G.computeMax > 0) G.computeUsed++;
    }
  }

  // ---------- PASSIVE INCOME ----------
  function tickServices(dtSec) {
    let totalPassiveIncome = 0;
    totalPassiveIncome += (getAgentRevenueRate() + getMarketingRevenueRate()) * dtSec;
    if (G.phase >= 9) {
      for (const svc of G.services) {
        if (!svc.active) continue;
        const uptime = Math.max(0.5, 1 - G.techDebt * 0.005 - G.incidents.filter((i) => !i.resolved).length * 0.05);
        const income = svc.incomeRate * uptime * dtSec;
        totalPassiveIncome += income;
      }
    }
    G.cash += totalPassiveIncome;
    if (totalPassiveIncome > 0) G.totalCashEarned += totalPassiveIncome;
  }

  // ---------- EXPENSES ----------
  function getExpenseRate() {
    if (!G.expensesRevealed) return 0;

    let rate = 0;
    for (const tier of EXPENSE_TIERS) {
      if (G.phase >= tier.phase) rate = tier.rate;
    }
    // Agent upkeep
    rate += G.agents.length * (0.8 + G.phase * 0.2);
    // Schedule overhead
    rate += G.schedules.length * 0.2;
    // Service costs
    rate += G.services.length * 2;
    return rate;
  }

  function tickExpenses(dtSec) {
    if (!G.expensesRevealed) return;
    const rate = getExpenseRate();
    G.cash -= rate * dtSec;
    if (G.cash < 0) G.cash = 0;
  }

  // ---------- TECH DEBT (Phase 8+) ----------
  function tickDebt(dtSec) {
    if (G.phase < 8) return;
    // Debt grows with agent activity
    const activeAgents = G.agents.filter((a) => a.status === "working").length;
    const growth = activeAgents * 0.05 * dtSec * (1 - G.debtReduction);
    G.techDebt = Math.max(0, G.techDebt + growth);
  }

  // ---------- STRESS ----------
  function tickStress(dtSec) {
    // Stress slowly recovers
    if (G.stress > 0) {
      G.stress = clamp(G.stress - 0.5 * dtSec, 0, 100);
    }
  }

  function getLateCostMultiplier() {
    if (G.phase < 5) return 1;
    var mult = 1 + (G.phase - 4) * 0.12;
    if (G.purchasedUpgrades.includes("growth_marketing")) mult += 0.1;
    return mult;
  }

  function getUpgradeCost(upg) {
    if (!upg || upg.currency !== "cash") return upg ? upg.cost : 0;
    if (upg.phase < 4) return upg.cost;
    return Math.ceil(upg.cost * getLateCostMultiplier());
  }

  function getAgentHireCost(agentCount) {
    var baseCost = AGENT_BASE_HIRE_COST * Math.pow(AGENT_HIRE_COST_MULT, agentCount);
    return Math.ceil(baseCost * getLateCostMultiplier());
  }

  function getScheduleCost() {
    var baseCost = 100 + G.schedules.length * 150;
    return Math.ceil(baseCost * getLateCostMultiplier());
  }

  function getAgentRevenueRate() {
    if (G.phase < 4) return 0;
    var perAgent = 1.4 + G.phase * 0.4;
    if (G.purchasedUpgrades.includes("growth_marketing")) perAgent *= 1.65;
    return G.agents.length * perAgent;
  }

  function getMarketingRevenueRate() {
    if (!G.purchasedUpgrades.includes("growth_marketing")) return 0;
    return 4 + G.phase * 1.5;
  }

  // ---------- INCOME RATE ESTIMATION ----------
  function getIncomeRate() {
    let rate = 0;
    // From working agents
    for (const agent of G.agents) {
      if (agent.status === "working") {
        const task = G.tasks.find((t) => t.id === agent.currentTask);
        if (task) {
          const timeToComplete = (task.workRequired - task.workDone) / (agent.speed * AGENT_WORK_MULT * G.agentSpeedMult);
          if (timeToComplete > 0) rate += getTaskCashPayout(task, "agent", agent) / timeToComplete;
        }
      }
    }
    // From services
    for (const svc of G.services) {
      if (svc.active) rate += svc.incomeRate;
    }
    // Passive growth income (Phase 4+)
    rate += getAgentRevenueRate();
    rate += getMarketingRevenueRate();
    return rate;
  }

  // ---------- UPGRADE PURCHASE ----------
  function purchaseUpgrade(upgradeId) {
    const upg = UPGRADES.find((u) => u.id === upgradeId);
    if (!upg) return;
    if (upg.oneTime && G.purchasedUpgrades.includes(upgradeId)) return;
    if (upg.phase > G.phase) return;
    if (upg.reqTasks && G.totalTasksDone < upg.reqTasks) return;
    if (upg.reqRep && G.reputation < upg.reqRep) {
      log("Need " + upg.reqRep + " reputation!", "bad");
      return;
    }

    var upgradeCost = getUpgradeCost(upg);
    if (upg.currency === "cash") {
      if (G.cash < upgradeCost) { log("Not enough cash!", "bad"); return; }
      G.cash -= upgradeCost;
    } else if (upg.currency === "tokens") {
      if (G.tokens < upg.cost) { log("Not enough tokens!", "bad"); return; }
      G.tokens -= upg.cost;
    }

    if (upg.oneTime) G.purchasedUpgrades.push(upgradeId);

    // Apply effects
    if (upg.effect) {
      if (upg.effect.clickPower) G.clickPower *= upg.effect.clickPower;
      if (upg.effect.aiFailMult) G.aiFailMult *= upg.effect.aiFailMult;
      if (upg.effect.aiPowerMult) G.aiPowerMult *= upg.effect.aiPowerMult;
      if (upg.effect.giveTokens) G.tokens += upg.effect.giveTokens;
      if (upg.effect.agentSlots) G.agentSlots = Math.max(G.agentSlots, upg.effect.agentSlots);
      if (upg.effect.compute) G.computeMax = Math.max(G.computeMax, upg.effect.compute);
      if (upg.effect.toolBonus) G.toolBonus += upg.effect.toolBonus;
      if (upg.effect.codeSpeedMult) G.codeSpeedMult *= upg.effect.codeSpeedMult;
      if (upg.effect.agentSpeedMult) G.agentSpeedMult *= upg.effect.agentSpeedMult;
      if (upg.effect.codeQualityMult) G.codeQualityMult *= upg.effect.codeQualityMult;
      if (upg.effect.debtReduction) G.debtReduction = Math.min(0.9, G.debtReduction + upg.effect.debtReduction);
      if (upg.effect.driftReduction) G.driftReduction = Math.min(0.9, G.driftReduction + upg.effect.driftReduction);
      if (upg.effect.managerUnlock) G.managerUnlock = true;
      if (upg.effect.smartRouting) G.smartRouting = true;
      if (upg.effect.swarmMode) G.swarmMode = true;
      if (upg.effect.aiCeo) G.aiCeo = true;
      if (upg.effect.serviceSlots) G.serviceSlots = Math.max(G.serviceSlots, upg.effect.serviceSlots);
      if (upg.effect.reduceDebt) G.techDebt = Math.max(0, G.techDebt - upg.effect.reduceDebt);
      // New effects for early upgrades
      if (upg.effect.payMult) G.payMult *= upg.effect.payMult;
      if (upg.effect.workReduction) G.workReduction = Math.min(0.5, G.workReduction + upg.effect.workReduction);
      if (upg.effect.taskDetails) G.taskDetails = true;
      if (upg.effect.tokenEfficiency) G.tokenEfficiency *= upg.effect.tokenEfficiency;
      if (upg.effect.giveRep) G.reputation += upg.effect.giveRep;
    }

    // Phase unlock
    if (upg.unlockPhase && upg.unlockPhase > G.phase) {
      G.phase = upg.unlockPhase;
      log("PHASE " + G.phase + " UNLOCKED!", "info");

      // Phase 3: grant starter tokens
      const starter_tokens = 200;
      if (G.phase === 3) G.tokens += starter_tokens;

      // Show phase upgrade popup with lifestyle info
      var newTier = null;
      for (var ti = 0; ti < EXPENSE_TIERS.length; ti++) {
        if (G.phase >= EXPENSE_TIERS[ti].phase) newTier = EXPENSE_TIERS[ti];
      }
      var title = upg.name;
      var msg = upg.desc;
      if (G.phase === 3) msg += "\n\nYou start with " + starter_tokens + " tokens. AI Assist and agents will burn tokens over time. Buy token packs from the upgrade shop to keep up, or you will stall out.";
      if (newTier && G.expensesRevealed) msg += "\n\nLifestyle upgraded to: " + newTier.name + ". Expenses are now " + fmtCash(newTier.rate) + "/s.";
      showPopup(title, msg);

      // Phase 9: infrastructure scaling doubles agent output and pay
      if (G.phase === 9) {
        G.agentSpeedMult *= 6;
        G.payMult *= 3;
        msg += "\n\nInfrastructure scaling kicks in -- agent speed and task pay doubled.";
      }

      // Auto-deploy a service when reaching phase 9
      if (G.phase >= 9 && G.services.length === 0) {
        G.services.push({
          id: uid(),
          name: "Content Engine v1",
          incomeRate: 5,
          active: true,
        });
        log("Deployed: Content Engine v1 (+$5/s passive income)", "good");
      }
    }

    log("Purchased: " + upg.name, "good");

    // Check milestones after upgrade (phase may have changed)
    checkMilestones();
  }

  // ---------- PRESTIGE ----------
  function canPrestige() {
    return G.phase >= 12;
  }

  function canTrueRetire() {
    return G.phase >= 12 &&
      G.reputation >= 200 &&
      G.techDebt < 10 &&
      G.incidents.filter((i) => !i.resolved).length === 0 &&
      getIncomeRate() > getExpenseRate() * 2;
  }

  function prestige() {
    if (!canPrestige()) return;
    const bonus = {
      clickBonus: 1,
      tokenBonus: 50 + G.prestigeCount * 25,
      slotBonus: G.prestigeCount === 0,
    };

    const newState = defaultState();
    newState.prestigeCount = G.prestigeCount + 1;
    newState.prestigeBonusClick = G.prestigeBonusClick + bonus.clickBonus;
    newState.prestigeBonusTokens = G.prestigeBonusTokens + bonus.tokenBonus;
    newState.prestigeBonusSlot = true;
    newState.clickPower = 1 + newState.prestigeBonusClick;
    newState.tokens = newState.prestigeBonusTokens;
    newState.agentSlots = newState.prestigeBonusSlot ? 3 : 2;
    newState.gameStarted = true;
    newState.startTime = Date.now();
    newState.totalPlaytime = G.totalPlaytime;

    // On prestige, fast-forward onboarding (player knows the game)
    newState.uiRevealed.topBar = true;
    newState.uiRevealed.cash = true;
    newState.uiRevealed.taskQueue = true;
    newState.uiRevealed.rep = true;
    newState.uiRevealed.stress = true;
    newState.uiRevealed.upgrades = true;
    newState.uiRevealed.log = true;
    newState.uiRevealed.expenses = true;
    newState.uiRevealed.expenseCard = true;
    newState.uiRevealed.income = true;
    newState.expensesRevealed = true;
    newState.taskExpiryEnabled = true;
    newState.incidentsExplained = true;
    // Mark task-count milestones as reached so popups don't replay
    for (const m of MILESTONES) {
      if (m.reqTasks !== undefined) newState.milestonesReached.push(m.id);
    }

    G = newState;
    log("PRESTIGE #" + G.prestigeCount + "! New cycle begins with bonuses.", "info");
    // Spawn initial tasks for prestige
    spawnTask();
    spawnTask();
    spawnTask();
    save();
  }

  // ---------- OFFLINE PROGRESS ----------
  function calcOfflineProgress(elapsedSec) {
    if (elapsedSec < 10) return null;
    const cappedSec = Math.min(elapsedSec, 3600 * 8); // Max 8 hours

    let income = 0;
    income += (getAgentRevenueRate() + getMarketingRevenueRate()) * cappedSec * 0.5;
    // Services
    for (const svc of G.services) {
      if (svc.active) income += svc.incomeRate * cappedSec * 0.5; // 50% offline efficiency
    }
    // Scheduled agents (rough estimate)
    const scheduledJobs = G.schedules.filter((s) => s.enabled).length;
    const runs = Math.floor(cappedSec / 30) * scheduledJobs; // each schedule runs every 30s
    const avgPay = G.phase * 3;
    income += runs * avgPay * 0.5;

    // Expenses (only if revealed)
    const expenses = G.expensesRevealed ? getExpenseRate() * cappedSec : 0;
    const net = Math.max(0, income - expenses);

    return { earned: income, expenses: expenses, net: net, seconds: cappedSec, runs: runs };
  }

  // ---------- TASK SPAWN TICK ----------
  function tickTaskSpawn() {
    const interval = getSpawnInterval();
    if (interval === Infinity) return;
    if (Date.now() - G.lastTaskSpawn < interval) return;
    G.lastTaskSpawn = Date.now();
    spawnTask();
  }

  // ---------- AI CEO auto-management (Phase 11+) ----------
  function tickAiCeo() {
    if (!G.aiCeo) return;
    // Auto-assign idle agents to available tasks
    const idleAgents = G.agents.filter((a) => a.status === "idle");
    const availTasks = G.tasks.filter((t) => t.status === "available");
    for (let i = 0; i < Math.min(idleAgents.length, availTasks.length); i++) {
      // Match specialty if possible
      const agent = idleAgents[i];
      const bestTask = availTasks.find((t) => agent.specialty.includes(t.typeId)) || availTasks[i];
      if (bestTask) assignAgentToTask(bestTask.id, agent.id);
    }
  }

  // ---------- MILESTONES ----------
  function checkMilestones() {
    for (const m of MILESTONES) {
      if (G.milestonesReached.includes(m.id)) continue;

      let met = true;
      if (m.reqTasks !== undefined && G.totalTasksDone < m.reqTasks) met = false;
      if (m.reqPhase !== undefined && G.phase < m.reqPhase) met = false;
      if (!met) continue;

      G.milestonesReached.push(m.id);

      // Apply reveals
      if (m.reveals) {
        for (let i = 0; i < m.reveals.length; i++) {
          G.uiRevealed[m.reveals[i]] = true;
        }
      }

      // Apply flags
      if (m.setFlags) {
        var flagKeys = Object.keys(m.setFlags);
        for (let i = 0; i < flagKeys.length; i++) {
          G[flagKeys[i]] = m.setFlags[flagKeys[i]];
        }
      }

      // Spawn tasks on trigger
      if (m.spawnOnTrigger) {
        for (let i = 0; i < m.spawnOnTrigger; i++) {
          spawnTask();
        }
      }

      // Show popup
      if (m.popup) {
        showPopup(m.popup.title, m.popup.msg);
      }
    }
  }

  // ---------- POPUP SYSTEM ----------
  let popupQueue = [];
  let musicPlayer = null;
  let musicUnlocked = false;
  let activeSoundtrackPath = null;
  let musicFadeInterval = null;
  let hasDoneInitialMusicFadeIn = false;

  function showPopup(title, msg) {
    popupQueue.push({ title: title, msg: msg });
    if (popupQueue.length === 1) displayPopup();
  }

  function displayPopup() {
    if (popupQueue.length === 0) return;
    var p = popupQueue[0];
    $("#milestone-popup-title").textContent = p.title;
    $("#milestone-popup-msg").innerHTML = p.msg.replace(/\n/g, "<br>");
    $("#milestone-popup").classList.add("show");
  }

  function dismissPopup() {
    popupQueue.shift();
    if (popupQueue.length > 0) {
      displayPopup();
    } else {
      $("#milestone-popup").classList.remove("show");
    }
  }

  function updateMusicToggleLabel() {
    $("#btn-settings-music").textContent = "Music: " + (G.musicEnabled ? "On" : "Off");
  }

  function clearMusicFadeTimerIfAny() {
    if (musicFadeInterval) {
      clearInterval(musicFadeInterval);
      musicFadeInterval = null;
    }
  }

  function getCurrentSoundtrackPath() {
    var selectedPath = null;
    for (var i = 0; i < SOUNDTRACKS.length; i++) {
      var soundtrack = SOUNDTRACKS[i];
      if (G.totalTasksDone >= soundtrack.minTasks) {
        selectedPath = soundtrack.path;
      }
    }
    return selectedPath;
  }

  function syncMusicPlayback() {
    if (!musicPlayer) return;
    var nextSoundtrackPath = getCurrentSoundtrackPath();

    if (!G.musicEnabled || !nextSoundtrackPath) {
      clearMusicFadeTimerIfAny();
      musicPlayer.pause();
      musicPlayer.currentTime = 0;
      musicPlayer.volume = MUSIC_TARGET_VOLUME;
      activeSoundtrackPath = null;
      return;
    }

    if (activeSoundtrackPath !== nextSoundtrackPath) {
      clearMusicFadeTimerIfAny();
      musicPlayer.pause();
      musicPlayer.src = nextSoundtrackPath;
      musicPlayer.currentTime = 0;
      musicPlayer.load();
      musicPlayer.volume = MUSIC_TARGET_VOLUME;
      activeSoundtrackPath = nextSoundtrackPath;
    }

    if (!musicUnlocked) return;

    const shouldFadeIn = !hasDoneInitialMusicFadeIn;
    if (shouldFadeIn) {
      musicPlayer.volume = 0;
    } else {
      musicPlayer.volume = MUSIC_TARGET_VOLUME;
    }

    const playPromise = musicPlayer.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function (err) {
        if (!err) return;
        if (err.name === "NotAllowedError" || err.name === "AbortError") return;
        console.error("Unable to play soundtrack.", err);
      });
    }

    if (!shouldFadeIn) return;

    clearMusicFadeTimerIfAny();
    hasDoneInitialMusicFadeIn = true;
    var elapsed = 0;
    musicFadeInterval = setInterval(function () {
      elapsed += MUSIC_FADE_STEP_MS;
      var progress = elapsed / MUSIC_FADE_IN_MS;
      if (progress >= 1) {
        musicPlayer.volume = MUSIC_TARGET_VOLUME;
        clearMusicFadeTimerIfAny();
        return;
      }
      musicPlayer.volume = MUSIC_TARGET_VOLUME * progress;
    }, MUSIC_FADE_STEP_MS);
  }

  function unlockMusicPlayback() {
    musicUnlocked = true;
    syncMusicPlayback();
  }

  function setupMusic() {
    if (musicPlayer) {
      updateMusicToggleLabel();
      syncMusicPlayback();
      return;
    }

    musicPlayer = new Audio();
    musicPlayer.loop = true;
    musicPlayer.preload = "auto";
    musicPlayer.volume = MUSIC_TARGET_VOLUME;

    document.addEventListener("pointerdown", unlockMusicPlayback, { once: true });
    document.addEventListener("keydown", unlockMusicPlayback, { once: true });
    document.addEventListener("click", unlockMusicPlayback, { once: true });

    updateMusicToggleLabel();
    syncMusicPlayback();
  }

  function toggleMusicSetting() {
    G.musicEnabled = !G.musicEnabled;
    updateMusicToggleLabel();
    syncMusicPlayback();
    save();
  }

  function resetSettingsPopupState() {
    $("#settings-msg").textContent = "Manage settings.";
    $("#settings-main-actions").style.display = "flex";
    $("#settings-confirm-actions").style.display = "none";
    updateMusicToggleLabel();
  }

  function openSettingsPopup() {
    resetSettingsPopupState();
    $("#settings-popup").classList.add("show");
  }

  function closeSettingsPopup() {
    $("#settings-popup").classList.remove("show");
    resetSettingsPopupState();
  }

  function askResetConfirmation() {
    $("#settings-msg").textContent = "Are you sure? This will permanently reset all progress.";
    $("#settings-main-actions").style.display = "none";
    $("#settings-confirm-actions").style.display = "flex";
  }

  function performFullReset() {
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var key = localStorage.key(i);
      if (key && key.indexOf("ai_empire_") === 0) {
        localStorage.removeItem(key);
      }
    }
    localStorage.removeItem("ai_empire_save");
    location.reload();
  }

  // ---------- MAIN GAME TICK ----------
  function tick() {
    if (!G.gameStarted) return;
    const now = Date.now();
    const dtMs = now - G.lastTick;
    const dtSec = dtMs / 1000;
    G.lastTick = now;
    G.totalPlaytime += dtMs;

    tickTaskSpawn();
    tickAgents(dtSec);
    tickManager();
    tickTokenManager();
    tickIncidents(dtSec);
    tickSchedules();
    tickServices(dtSec);
    tickExpenses(dtSec);
    tickDebt(dtSec);
    tickStress(dtSec);
    tickAiCeo();

    // Remove stale tasks (expiry gated)
    G.tasks = G.tasks.filter((t) => {
      if (t.status === "active" || t.status === "agent" || t.status === "done") return true;
      if (!G.taskExpiryEnabled) return true;
      var expired = Date.now() - t.createdAt >= 30000;
      return !expired;
    });

    // Compute usage tracking
    G.computeUsed = G.agents.filter((a) => a.status === "working").length;

    // Check phase-based milestones periodically
    checkMilestones();

    // Auto-save
    if (now - G.lastSave > SAVE_INTERVAL) save();
  }

  // ---------- UI RENDERING ----------

  function renderTopBar() {
    var topBar = $("#top-bar");
    if (G.uiRevealed.topBar) {
      topBar.classList.add("visible");
    } else {
      topBar.classList.remove("visible");
      return;
    }

    // Update values
    $("#res-cash").textContent = fmtCash(G.cash);
    $("#res-tokens").textContent = fmt(G.tokens);
    $("#res-rep").textContent = fmt(G.reputation);
    $("#res-debt").textContent = fmt(G.techDebt);
    $("#res-stress").textContent = Math.round(G.stress) + "%";
    $("#res-compute").textContent = G.computeUsed + "/" + G.computeMax;
    $("#phase-label").textContent = "Phase " + G.phase;

    // Progressive reveal of resource counters
    $("#res-cash-wrap").style.display = G.uiRevealed.cash ? "" : "none";
    $("#res-tokens-wrap").style.display = G.uiRevealed.tokens ? "" : "none";
    $("#res-compute-wrap").style.display = G.uiRevealed.compute ? "" : "none";
    $("#res-rep-wrap").style.display = G.uiRevealed.rep ? "" : "none";
    $("#res-debt-wrap").style.display = G.uiRevealed.debt ? "" : "none";
    $("#res-stress-wrap").style.display = G.uiRevealed.stress ? "" : "none";

    // Warning pulse
    $("#res-tokens-wrap").classList.toggle("res-warning", G.tokens < 90);
    $("#res-stress-wrap").classList.toggle("res-warning", G.stress > 80);

    // Income and expense rates
    var income = getIncomeRate();
    var expense = getExpenseRate();
    var incomeEl = $("#income-rate");
    incomeEl.style.display = G.uiRevealed.income ? "" : "none";
    incomeEl.textContent = "+" + fmtCash(income) + "/s";
    var expenseWrap = $("#res-expense-wrap");
    expenseWrap.style.display = G.uiRevealed.expenses ? "" : "none";
    $("#expense-rate").textContent = "-" + fmtCash(expense) + "/s";
    var expTier = null;
    for (var ti = 0; ti < EXPENSE_TIERS.length; ti++) {
      if (G.phase >= EXPENSE_TIERS[ti].phase) expTier = EXPENSE_TIERS[ti];
    }
    $("#expense-tier-label").textContent = expTier ? expTier.name : "Expenses";
  }

  function renderWorkStream() {
    var earlySection = $("#early-task-section");
    var queueSection = $("#task-queue-section");

    $("#tasks-complete-count").textContent = G.totalTasksDone;

    if (!G.uiRevealed.taskQueue && G.prestigeCount === 0) {
      // Early game: show big Do Task button
      earlySection.style.display = "";
      queueSection.style.display = "none";
      renderEarlyTask();
    } else {
      // Normal game: show task queue
      earlySection.style.display = "none";
      queueSection.style.display = "block";
      renderTaskQueue();
    }
  }

  function renderEarlyTask() {
    var display = $("#early-task-display");
    var activeTask = G.tasks.find((t) => t.status === "active");
    if (activeTask) {
      display.style.visibility = "visible";
      $("#early-task-icon-name").textContent = activeTask.icon + " " + activeTask.name;
      var pct = Math.floor((activeTask.workDone / activeTask.workRequired) * 100);
      var displayedPay = getTaskCashPayout(activeTask, "manual", null);
      $("#early-task-bar").style.width = pct + "%";
      $("#early-task-reward").innerHTML = "<span style='color:var(--cash)'>" + fmtCash(displayedPay) + "</span> reward &bull; " + pct + "% done";
    } else {
      display.style.visibility = "hidden";
    }
  }

  function renderTaskQueue() {
    var list = $("#task-list");
    var noTasks = $("#no-tasks");
    var tasks = G.tasks.filter((t) => t.status !== "done");

    $("#task-count").textContent = tasks.length + " tasks";

    if (tasks.length === 0) {
      list.innerHTML = "";
      noTasks.style.display = "";
      return;
    }
    noTasks.style.display = "none";

    var html = "";
    for (var ti = 0; ti < tasks.length; ti++) {
      var t = tasks[ti];
      var pct = Math.floor((t.workDone / t.workRequired) * 100);
      var agent = t.assignedAgent ? G.agents.find(function (a) { return a.id === t.assignedAgent; }) : null;

      var actions = "";
      if (t.status === "available" || t.status === "active") {
        var clickBtn = "<button class='btn btn-primary btn-sm' onclick=\"GAME.clickTask('" + t.id + "', event)\">Click (+" + G.clickPower + ")</button>";
        var aiTokenCost = G.phase >= 3 ? Math.ceil(3 * (1 + G.phase * 0.2) * G.tokenEfficiency) : 0;
        var aiCost = aiTokenCost > 0 ? " (" + aiTokenCost + " tok)" : "";
        var aiDisabled = aiTokenCost > 0 && G.tokens < aiTokenCost ? " disabled" : "";
        var aiDimStyle = G.agentSlots >= 3 ? " style='background:#513782'" : G.uiRevealed.agents ? " style='background:#5a3ab0'" : "";
        var aiBtn = "<button class='btn btn-purple btn-sm'" + aiDisabled + aiDimStyle + " onclick=\"GAME.aiAssist('" + t.id + "', event)\">AI Assist" + aiCost + "</button>";

        if (G.uiRevealed.tokens) {
          // If less than 5 tokens left and cash <$300, then flip to show click button
          if (G.tokens <= 5 && G.cash < 300) {
            actions += clickBtn;
          } else {
            actions += aiBtn;
          }
        } else {
          actions += clickBtn;
          if (G.phase >= 2) {
            actions += aiBtn;
          }
        }
      }
      if (t.status === "agent" && agent) {
        actions = "<span class='agent-status status-working'>" + agent.name + " Working...</span>";
      }
      var displayedPay = getTaskCashPayout(t, t.status === "agent" ? "agent" : "manual", agent);

      // Task expiry countdown
      var expiryHtml = "";
      if (G.taskExpiryEnabled && t.status === "available") {
        var timeLeft = Math.max(0, 30 - (Date.now() - t.createdAt) / 1000);
        if (timeLeft < 15) {
          expiryHtml = "<div class='task-expiry'>" + Math.ceil(timeLeft) + "s</div>";
        }
      }

      // Client name gated behind taskDetails upgrade (Sticky Note System)
      var clientHtml = "";
      if (G.taskDetails && t.client) {
        clientHtml = "<div class='task-client'>From: " + t.client + "</div>";
      }

      // Pay is always visible; other details gated behind task count
      var metaHtml = "<div class='task-meta'>" +
        "<span>Pay: <strong style='color:var(--cash)'>" + fmtCash(displayedPay) + "</strong></span>";
      if (G.totalTasksDone >= 20) {
        metaHtml +=
          "<span>Rep: <strong style='color:var(--rep)'>+" + t.repReward + "</strong></span>" +
          "<span>Work: " + Math.ceil(t.workDone) + "/" + t.workRequired + "</span>" +
          (t.tokenCost > 0 ? "<span>Tokens: " + t.tokenCost + "</span>" : "");
      }
      metaHtml += "</div>";

      var taskCardClass = "card task-card" + (expiryHtml ? " has-expiry" : "");
      html += "<div class='" + taskCardClass + "'>" +
        expiryHtml +
        "<div class='task-header'><div class='task-name'>" + t.icon + " " + t.name + "</div>" + clientHtml + "</div>" +
        metaHtml +
        "<div class='task-bottom'><div class='task-actions'>" + actions + "</div>" +
        "<div class='task-bar'><div class='task-bar-fill' style='width:" + pct + "%'></div></div></div>" +
        "</div>";
    }
    list.innerHTML = html;
  }

  function renderUpgradeSection() {
    var section = $("#section-upgrades");
    if (!G.uiRevealed.upgrades) { section.style.display = "none"; return; }
    section.style.display = "";

    var available = UPGRADES.filter(function (u) {
      if (u.phase > G.phase) return false;
      if (u.oneTime && G.purchasedUpgrades.includes(u.id)) return false;
      if (u.reqTasks && G.totalTasksDone < u.reqTasks) return false;
      return true;
    });

    if (available.length === 0) {
      $("#upgrade-list").innerHTML = "<div class='text-muted text-sm' style='text-align:center;padding:20px'>No upgrades available right now. Keep working!</div>";
      return;
    }

    // Split into repeatables and one-time upgrades
    var repeatables = [];
    var oneTime = [];
    for (var i = 0; i < available.length; i++) {
      if (available[i].oneTime) oneTime.push(available[i]);
      else repeatables.push(available[i]);
    }

    var MAX_VISIBLE = 3;
    var hidden = Math.max(0, oneTime.length - MAX_VISIBLE);
    var visible = oneTime.slice(0, MAX_VISIBLE);

    var html = "";
    // One-time upgrades (capped)
    for (var i = 0; i < visible.length; i++) {
      var u = visible[i];
      var cost = getUpgradeCost(u);
      var canAfford = u.currency === "cash" ? G.cash >= cost : G.tokens >= u.cost;
      var meetsRep = !u.reqRep || G.reputation >= u.reqRep;
      html += "<div class='card upgrade-card'>" +
        "<div class='upgrade-info'>" +
        "<div class='name'>" + u.name + (u.unlockPhase ? " <span class='badge badge-purple'>-> Phase " + u.unlockPhase + "</span>" : "") + "</div>" +
        "<div class='desc'>" + u.desc + (u.reqRep ? " <span style='color:var(--rep)'>(Requires " + u.reqRep + " rep)</span>" : "") + "</div>" +
        "</div>" +
        "<div style='display:flex;align-items:center;gap:10px'>" +
        "<span class='upgrade-cost'>" + (u.currency === "cash" ? fmtCash(cost) : u.cost + " tok") + "</span>" +
        "<button class='btn btn-green btn-sm' onclick=\"GAME.buy('" + u.id + "')\" " + (!canAfford || !meetsRep ? "disabled" : "") + ">Buy</button>" +
        "</div>" +
        "</div>";
    }
    // Repeatables (always shown, compact row)
    for (var i = 0; i < repeatables.length; i++) {
      var u = repeatables[i];
      var cost = getUpgradeCost(u);
      var canAfford = u.currency === "cash" ? G.cash >= cost : G.tokens >= u.cost;
      html += "<div style='display:inline-flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg2);border:1px solid var(--bg3);border-radius:var(--radius);margin-right:6px;margin-bottom:6px'>" +
        "<span class='text-sm'>" + u.name + "</span>" +
        "<span class='upgrade-cost text-sm'>" + (u.currency === "cash" ? fmtCash(cost) : u.cost + " tok") + "</span>" +
        "<button class='btn btn-green btn-sm' onclick=\"GAME.buy('" + u.id + "')\" " + (!canAfford ? "disabled" : "") + " style='padding:2px 10px'>Buy</button>" +
        "</div>";
    }
    $("#upgrade-list").innerHTML = html;
  }

  function renderExpenseSection() {
    // Expenses now shown in top bar
  }

  function renderAgentSection() {
    var section = $("#section-agents");
    if (!G.uiRevealed.agents) { section.style.display = "none"; return; }
    section.style.display = "";

    if (G.phase < 4) return;

    $("#agent-slots").textContent = G.agents.length + "/" + G.agentSlots + " slots";

    // Hire info
    var hireCost = getAgentHireCost(G.agents.length);
    var availRoles = AGENT_ROLES.filter(function (r) {
      if (r.id === "manager" && !G.managerUnlock) return false;
      if (r.id === "devops" && G.phase < 8) return false;
      if (r.id === "sales" && G.phase < 7) return false;
      if (r.id === "token_mgr" && G.phase < 5) return false;
      return true;
    });
    $("#agent-hire-section").innerHTML = "";

    // Agent list -- assignable first, then error, idle, working last
    var utilityRoles = ["manager", "token_mgr"];
    var sorted = G.agents.slice().sort(function (a, b) {
      function rank(ag) {
        if (ag.status === "idle" && utilityRoles.indexOf(ag.roleId) === -1 && findMatchingTask(ag)) return 0; // assignable
        if (ag.status === "error") return 1;
        if (ag.status === "idle" && utilityRoles.indexOf(ag.roleId) === -1) return 2;
        return 3; // working or utility
      }
      return rank(a) - rank(b);
    });
    var html = "";
    for (var j = 0; j < sorted.length; j++) {
      var a = sorted[j];
      var task = a.currentTask ? G.tasks.find(function (t) { return t.id === a.currentTask; }) : null;
      html += "<div class='card agent-card'>" +
        "<div class='agent-icon' style='background:" + a.color + "30;color:" + a.color + "'>" + a.icon + "</div>" +
        "<div class='agent-info'>" +
        "<div class='name'>" + a.name + (task ? " <span style='font-weight:400;font-size:.72rem;color:var(--accent);margin-left:8px'>" + task.name + " (" + Math.floor(task.workDone / task.workRequired * 100) + "%)</span>" : a.roleId === "manager" && a.status === "idle" ? " <span style='font-weight:400;font-size:.72rem;color:var(--accent);margin-left:8px'>Managing</span>" : a.roleId === "token_mgr" && a.status === "idle" ? " <span style='font-weight:400;font-size:.72rem;color:var(--token);margin-left:8px'>Monitoring tokens</span>" : "") + "</div>" +
        "<div class='role'>" + a.roleName + " -- <span style='color:var(--text3)'>" + a.traitName + "</span></div>" +
        "<div class='agent-stats'>" +
        "<span class='agent-stat'>SPD " + a.speed.toFixed(2) + "</span>" +
        "<span class='agent-stat'>QUA " + a.quality.toFixed(2) + "</span>" +
        "<span class='agent-stat'>REL " + a.reliability.toFixed(2) + "</span>" +
        "<span class='agent-stat'>Tasks: " + (a.tasksCompleted || 0) + "</span>" +
        "</div>" +
        "</div>" +
        "<div style='display:flex;flex-direction:column;gap:8px;align-items:flex-end'>" +
        (a.tokenStarved
          ? "<span class='agent-status status-error'>No tokens</span>"
          : a.status === "idle" && utilityRoles.indexOf(a.roleId) === -1 && findMatchingTask(a)
          ? "<button class='btn btn-green btn-sm' onclick=\"GAME.autoAssign('" + a.id + "')\">Assign</button>"
          : a.roleId === "manager" && a.status === "idle"
          ? "<span class='agent-status status-working'>Managing</span>"
          : a.roleId === "token_mgr" && a.status === "idle"
          ? "<span class='agent-status status-working'>Active</span>"
          : "<span class='agent-status " + (a.status === "idle" ? "status-idle" : a.status === "working" ? "status-working" : "status-error") + "'>" + a.status[0].toUpperCase() + a.status.slice(1) + "</span>") +
        "<button class='btn btn-outline btn-sm' onclick=\"GAME.fire('" + a.id + "')\">Shutdown</button>" +
        "</div>" +
        "</div>";
    }
    // Empty slot placeholders with hire buttons
    var emptySlots = G.agentSlots - G.agents.length;
    for (var s = 0; s < emptySlots; s++) {
      var btns = "";
      for (var ri = 0; ri < availRoles.length; ri++) {
        var r = availRoles[ri];
        var owned = G.agents.some(function (a) { return a.roleId === r.id; });
        btns += "<button class='btn btn-green btn-sm' onclick=\"GAME.hire('" + r.id + "')\" " + (owned || G.cash < hireCost ? "disabled" : "") + ">" + r.icon + " " + r.name + "</button>";
      }
      html += "<div class='card agent-card' style='border-style:dashed;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap;min-height:62px'>" +
        "<span class='text-muted' style='font-size:.75rem'>Hire (" + fmtCash(hireCost) + ")</span>" +
        btns +
        "</div>";
    }
    $("#agent-list").innerHTML = html;
  }

  function renderIncidentSection() {
    var section = $("#section-incidents");
    if (!G.uiRevealed.incidents) { section.style.display = "none"; return; }
    section.style.display = "";

    var active = G.incidents.filter(function (i) { return !i.resolved; });
    $("#incident-count").textContent = active.length + " active";

    var header = $("#incidents-header");
    if (active.length > 0) {
      header.classList.add("pulse");
      header.style.color = "var(--red)";
    } else {
      header.classList.remove("pulse");
      header.style.color = "";
    }

    if (active.length === 0) {
      $("#incident-list").innerHTML = "";
      $("#no-incidents").style.display = "";
      return;
    }
    $("#no-incidents").style.display = "none";

    var html = "";
    for (var i = 0; i < active.length; i++) {
      var inc = active[i];
      var age = Math.floor((Date.now() - inc.createdAt) / 1000);
      html += "<div class='card incident-card " + (inc.sev === "warning" ? "warning" : "") + "'>" +
        "<div class='sev " + inc.sev + "'>" + inc.sev + "</div>" +
        "<div style='display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px'>" +
        "<div style='font-weight:600;min-width:0'>" + inc.name + "</div>" +
        "<div style='display:flex;align-items:center;gap:8px;white-space:nowrap'>" +
        "<span style='font-size:.78rem;color:var(--rep)'>-" + inc.repCost + " rep/s</span>" +
        "<span style='font-size:.78rem;color:var(--text3)'>" + age + "s</span>" +
        "</div>" +
        "</div>" +
        "<div class='text-sm text-muted mb'>" + inc.desc + "</div>" +
        (inc.cashCost ? "<div class='text-sm mb'><span style='color:var(--red)'>-" + fmtCash(inc.cashCost) + "</span></div>" : "") +
        "<div style='display:flex;gap:6px'>" +
        "<button class='btn btn-primary btn-sm' onclick=\"GAME.resolveInc('" + inc.id + "','manual')\">Fix Manually (+stress)</button>" +
        "<button class='btn btn-yellow btn-sm'" + (G.cash < (inc.cashCost || 20) * 2 ? " disabled" : "") + " onclick=\"GAME.resolveInc('" + inc.id + "','cash')\">Pay to Fix (" + fmtCash((inc.cashCost || 20) * 2) + ")</button>" +
        "</div>" +
        "</div>";
    }
    $("#incident-list").innerHTML = html;
  }

  function renderAutomationSection() {
    var section = $("#section-automation");
    if (!G.uiRevealed.automation) { section.style.display = "none"; return; }
    section.style.display = "";

    if (G.phase < 6) return;

    var btn = $("#btn-add-schedule");
    btn.disabled = G.agents.filter(function (a) { return a.status === "idle"; }).length === 0;

    var list = $("#schedule-list");
    if (G.schedules.length === 0) {
      list.innerHTML = "<div class='text-muted text-sm' style='text-align:center;padding:15px'>No schedules yet. Add a daily job to start passive automation.</div>";
      return;
    }
    var html = "";
    for (var i = 0; i < G.schedules.length; i++) {
      var s = G.schedules[i];
      var agent = G.agents.find(function (a) { return a.id === s.agentId; });
      html += "<div class='card schedule-card'>" +
        "<div class='schedule-info'>" +
        "<div class='name'>" + s.name + "</div>" +
        "<div class='desc'>Agent: " + (agent ? agent.name : "???") + " -- Every " + (s.intervalMs / 1000) + "s</div>" +
        "</div>" +
        "<div style='display:flex;gap:6px'>" +
        "<button class='btn btn-sm " + (s.enabled ? "btn-green" : "btn-outline") + "' onclick=\"GAME.toggleSchedule('" + s.id + "')\">" + (s.enabled ? "ON" : "OFF") + "</button>" +
        "<button class='btn btn-red btn-sm' onclick=\"GAME.removeSchedule('" + s.id + "')\">Remove</button>" +
        "</div>" +
        "</div>";
    }
    list.innerHTML = html;
  }

  function renderStatsSection() {
    var section = $("#section-stats");
    if (!G.uiRevealed.dashboard) { section.style.display = "none"; return; }
    section.style.display = "";

    // Playtime
    var secs = Math.floor(G.totalPlaytime / 1000);
    var h = Math.floor(secs / 3600);
    var m = Math.floor((secs % 3600) / 60);

    $("#dash-stats").innerHTML =
      "<div class='flex-between mb'><span>Playtime</span><span>" + h + "h " + m + "m</span></div>" +
      "<div class='flex-between mb'><span>Prestige</span><span>" + G.prestigeCount + "</span></div>" +
      "<div class='flex-between mb'><span>Tasks completed</span><span>" + G.totalTasksDone + "</span></div>" +
      "<div class='flex-between mb'><span>Total earned</span><span>" + fmtCash(G.totalCashEarned) + "</span></div>" +
      "<div class='flex-between mb'><span>Total clicks</span><span>" + G.totalClicks + "</span></div>" +
      "<div class='flex-between mb'><span>Click power</span><span>" + G.clickPower.toFixed(1) + "x</span></div>" +
      "<div class='flex-between mb'><span>Agents</span><span>" + G.agents.length + "/" + G.agentSlots + "</span></div>" +
      "<div class='flex-between'><span>Incidents</span><span>" + G.totalIncidents + "</span></div>";

    // Agents summary
    var das = $("#dash-agents-summary");
    if (G.agents.length > 0) {
      var agentHtml = "<div class='text-sm' style='margin-top:8px'><strong>Active Agents</strong></div>";
      for (var i = 0; i < G.agents.length; i++) {
        var a = G.agents[i];
        agentHtml += "<div style='display:flex;gap:8px;align-items:center;margin-top:4px'>" +
          "<span class='agent-status " + (a.status === "idle" ? "status-idle" : a.status === "working" ? "status-working" : "status-error") + "'>" + a.status[0].toUpperCase() + a.status.slice(1) + "</span>" +
          "<span style='font-size:.82rem'><strong>" + a.name + "</strong> <span class='text-muted'>(" + a.roleName + ")</span></span>" +
          "</div>";
      }
      das.innerHTML = agentHtml;
    } else {
      das.innerHTML = "";
    }
  }

  function renderPrestigeSection() {
    var section = $("#section-prestige");
    if (!G.uiRevealed.prestige) { section.style.display = "none"; return; }
    section.style.display = "";

    var content = $("#prestige-content");
    if (G.phase < 12) {
      content.innerHTML =
        "<div class='prestige-box'>" +
        "<h2>Not Yet...</h2>" +
        "<div class='req'>Reach Phase 12 to unlock the Retire option.</div>" +
        "<div class='text-sm text-muted'>Current: Phase " + G.phase + " / 12</div>" +
        "<div class='task-bar mt' style='max-width:300px;margin:10px auto'>" +
        "<div class='task-bar-fill' style='width:" + (G.phase / 12 * 100).toFixed(0) + "%;background:var(--purple)'></div>" +
        "</div>" +
        "</div>";
      return;
    }

    var trueRetire = canTrueRetire();
    content.innerHTML =
      "<div class='prestige-box mb'>" +
      "<h2>Retire Early (Prestige)</h2>" +
      "<div class='req'>Reset everything but keep permanent bonuses. The market resets, a new model drops, and you start again... faster.</div>" +
      "<div class='text-sm mb'>" +
      "<div>Prestige count: " + G.prestigeCount + "</div>" +
      "<div>Bonus click power: +" + (G.prestigeBonusClick + 1) + "</div>" +
      "<div>Bonus starting tokens: +" + (G.prestigeBonusTokens + 50 + G.prestigeCount * 25) + "</div>" +
      (G.prestigeCount === 0 ? "<div>Bonus: Extra starting agent slot</div>" : "") +
      "</div>" +
      "<button class='btn btn-purple' onclick='GAME.prestige()' style='padding:12px 30px;font-size:1rem'>Retire & Restart</button>" +
      "</div>" +
      "<div class='prestige-box' style='border-color:var(--cash)'>" +
      "<h2 style='color:var(--cash)'>Actually Retire (True Ending)</h2>" +
      "<div class='req'>Your empire runs itself. You walk away.</div>" +
      "<div class='text-sm mb' style='text-align:left;max-width:300px;margin:0 auto'>" +
      "<div class='flex-between'><span>Rep >= 200</span><span>" + (G.reputation >= 200 ? "\u2713" : G.reputation.toFixed(0) + "/200") + "</span></div>" +
      "<div class='flex-between'><span>Tech Debt < 10</span><span>" + (G.techDebt < 10 ? "\u2713" : G.techDebt.toFixed(0) + "/10") + "</span></div>" +
      "<div class='flex-between'><span>No incidents</span><span>" + (G.incidents.filter(function (i) { return !i.resolved; }).length === 0 ? "\u2713" : "\u2717") + "</span></div>" +
      "<div class='flex-between'><span>Income > 2x expenses</span><span>" + (getIncomeRate() > getExpenseRate() * 2 ? "\u2713" : "\u2717") + "</span></div>" +
      "</div>" +
      "<button class='btn btn-green mt' onclick='GAME.trueRetire()' " + (!trueRetire ? "disabled" : "") + " style='padding:12px 30px;font-size:1rem'>Walk Away Forever</button>" +
      "</div>";
  }

  function renderLogSection() {
    var section = $("#section-log");
    if (!G.uiRevealed.log) { section.style.display = "none"; return; }
    section.style.display = "";

    var html = "";
    var entries = G.log.slice(0, 30);
    for (var i = 0; i < entries.length; i++) {
      var l = entries[i];
      var ago = Math.floor((Date.now() - l.t) / 1000);
      html += "<div class='log-entry " + l.type + "'><span class='text-muted'>[" + ago + "s ago]</span> " + l.msg + "</div>";
    }
    $("#log-panel").innerHTML = html;
  }

  function renderLayout() {
    var container = $("#game-container");

    // Check if control panel has any visible children
    var cpVisible = G.uiRevealed.upgrades || G.uiRevealed.agents || G.uiRevealed.incidents ||
      G.uiRevealed.automation || G.uiRevealed.dashboard || G.uiRevealed.prestige ||
      G.uiRevealed.log;

    container.classList.toggle("cp-visible", cpVisible);

    // Late game: control panel dominates
    var lateGame = G.phase >= 5 || G.agents.length > 0;
    container.classList.toggle("cp-late", cpVisible && lateGame);
  }

  function renderAll() {
    renderLayout();
    renderTopBar();
    renderWorkStream();
    renderUpgradeSection();
    renderExpenseSection();
    renderAgentSection();
    renderIncidentSection();
    renderAutomationSection();
    renderStatsSection();
    renderPrestigeSection();
    renderLogSection();
  }

  // ---------- CLICK REWARD ANIMATION ----------
  function showClickReward(amount, evt) {
    var el = document.createElement("div");
    el.className = "click-reward";
    el.textContent = "+" + amount;
    if (evt && evt.clientX) {
      el.style.left = evt.clientX + "px";
      el.style.top = (evt.clientY - 20) + "px";
    } else {
      el.style.left = (Math.random() * 200 + 100) + "px";
      el.style.top = (Math.random() * 100 + 150) + "px";
    }
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 800);
  }

  // ---------- INIT ----------
  function init() {
    // Prevent trackpad pinch-zoom (macOS) and Safari gesture zoom
    document.addEventListener("wheel", function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    document.addEventListener("gesturestart", function (e) { e.preventDefault(); });
    document.addEventListener("gesturechange", function (e) { e.preventDefault(); });

    var loaded = load();
    setupMusic();

    // Add schedule button
    $("#btn-add-schedule").addEventListener("click", function () { addSchedule(); });

    // Popup dismiss
    $("#btn-dismiss-popup").addEventListener("click", function () { dismissPopup(); });

    // Offline popup dismiss
    $("#btn-dismiss-offline").addEventListener("click", function () {
      $("#offline-popup").classList.remove("show");
    });

    // Settings popup
    $("#btn-settings").addEventListener("click", function () {
      openSettingsPopup();
    });
    $("#btn-settings-close").addEventListener("click", function () {
      closeSettingsPopup();
    });
    $("#btn-settings-music").addEventListener("click", function () {
      toggleMusicSetting();
    });
    $("#btn-settings-reset").addEventListener("click", function () {
      askResetConfirmation();
    });
    $("#btn-settings-confirm-cancel").addEventListener("click", function () {
      resetSettingsPopupState();
    });
    $("#btn-settings-confirm-yes").addEventListener("click", function () {
      performFullReset();
    });
    $("#settings-popup").addEventListener("click", function (evt) {
      if (evt.target === $("#settings-popup")) {
        closeSettingsPopup();
      }
    });

    // Do Task button (early game)
    $("#btn-do-task").addEventListener("click", function (evt) {
      if (!G.gameStarted) return;
      doEarlyTask(evt);
    });

    // Intro
    if (!loaded || !G.gameStarted) {
      $("#intro-overlay").classList.remove("hidden");
      $("#btn-start-game").addEventListener("click", function () {
        G.gameStarted = true;
        G.lastTick = Date.now();
        G.startTime = Date.now();
        $("#intro-overlay").classList.add("hidden");
        log("You start your freelance grind from the backseat of your car.", "info");
        log("Click 'Do Task' to find gigs and earn cash.", "info");
        // No tasks spawned on start -- player creates them via Do Task button
        save();
      });
    } else {
      $("#intro-overlay").classList.add("hidden");
      // Offline progress
      var elapsed = (Date.now() - G.lastTick) / 1000;
      var offline = calcOfflineProgress(elapsed);
      if (offline && offline.net > 0) {
        G.cash += offline.net;
        G.totalCashEarned += offline.earned;
        $("#offline-earnings").textContent = "+" + fmtCash(offline.net);
        $("#offline-details").textContent = "Away for " + Math.floor(offline.seconds / 60) + "m. Earned " + fmtCash(offline.earned) + ", expenses " + fmtCash(offline.expenses) + ".";
        $("#offline-popup").classList.add("show");
      }
      G.lastTick = Date.now();
    }

    // Main loops
    setInterval(tick, TICK_MS);
    setInterval(renderAll, 200);

    // Initial render
    renderAll();
  }

  // ---------- PUBLIC API (for onclick handlers) ----------
  window.GAME = {
    clickTask: function (id, evt) { clickTask(id, evt); },
    aiAssist: function (id, evt) { aiAssistTask(id, evt); },
    assignAgent: assignAgentToTask,
    autoAssign: autoAssignAgent,
    hire: hireAgent,
    fire: fireAgent,
    buy: purchaseUpgrade,
    resolveInc: resolveIncident,
    toggleSchedule: function (id) {
      var s = G.schedules.find(function (x) { return x.id === id; });
      if (s) s.enabled = !s.enabled;
    },
    removeSchedule: function (id) {
      G.schedules = G.schedules.filter(function (x) { return x.id !== id; });
    },
    prestige: function () {
      if (canPrestige() && confirm("Retire and start a new cycle with permanent bonuses?")) {
        prestige();
      }
    },
    trueRetire: function () {
      if (canTrueRetire() && confirm("Walk away from your empire forever? This is the true ending.")) {
        alert("Congratulations. Your AI empire continues without you, ever finishing that One More Task.\n\nThe machines don't miss you. They never did.\n\nYour account keeps rising. Your inbox goes silent...");
        G.log = [];
        log("You retired. The empire runs itself. Credits roll.", "good");
        save();
      }
    },
    // Cheats - jump to specific game stages for testing
    cheat: function (stage) {
      var stages = {
        1: { tasks: 11, cash: 53, ph: 1 },  // -> Pressure Building (task 12)
        2: { tasks: 19, cash: 78, ph: 1 },  // -> Tools of the Trade (task 20)
        3: { tasks: 89, cash: 90, ph: 1 },  // -> Reality Check / expenses (task 90)
        4: { tasks: 109, cash: 5, ph: 1 },  // -> Discover Free-Tier AI / phase 2 (task 110)
        5: { tasks: 189, cash: 209, ph: 1 },  // -> Discover Free-Tier AI, just before / phase 2
        6: { tasks: 308, cash: 498, ph: 2 }, // -> Pro AI Subscription / phase 3
        7: { tasks: 450, cash: 1950, tokens: 200, ph: 3 }, // -> Multi-Bot License / phase 4
        8: { tasks: 701, cash: 1300, tokens: 436, ph: 4 },   // Phase 5: Tool use sdk. task complete, cash 1.3k, token 436
        //9: { tasks: 10000, cash: 5000, ph: 5 }, // -> Job Scheduler / phase 6
      };
      var s = stages[stage];
      if (!s) { console.log("Stages: 1-5"); return; }
      G = defaultState();
      G.gameStarted = true;
      G.totalTasksDone = s.tasks;
      G.totalClicks = s.tasks * 8;
      G.cash = 999999;
      // Purchase all available upgrades (loop until stable for phase unlocks)
      var changed = true;
      while (changed) {
        changed = false;
        for (var i = 0; i < UPGRADES.length; i++) {
          var u = UPGRADES[i];
          if (!u.oneTime || G.purchasedUpgrades.indexOf(u.id) >= 0) continue;
          if (u.phase > G.phase || (u.reqTasks && u.reqTasks > s.tasks)) continue;
          if (u.unlockPhase && u.unlockPhase > s.ph) continue;
          purchaseUpgrade(u.id);
          changed = true;
        }
      }
      // Clean up side effects from purchases
      G.cash = s.cash;
      if (s.tokens !== undefined) G.tokens = s.tokens;
      G.tasks = [];
      G.log = [];
      G.milestonesReached = [];
      checkMilestones();
      G.lastTick = Date.now();
      G.lastTaskSpawn = 0;
      popupQueue = [];
      dismissPopup();
      $("#intro-overlay").classList.add("hidden");
      save();
    },
    // Debug
    get state() { return G; },
    addCash: function (n) { G.cash += n; },
    addTokens: function (n) { G.tokens += n; },
    setPhase: function (n) { G.phase = n; checkMilestones(); },
    addTasks: function (n) { G.totalTasksDone += n; checkMilestones(); syncMusicPlayback(); },
    resetSave: function () { performFullReset(); },
  };

  // Console shortcuts: chPh1() through chPh5()
  window.chPh1 = function () { GAME.cheat(1); };
  window.chPh2 = function () { GAME.cheat(2); };
  window.chPh3 = function () { GAME.cheat(3); };
  window.chPh4 = function () { GAME.cheat(4); };
  window.chPh5 = function () { GAME.cheat(5); };
  window.chPh6 = function () { GAME.cheat(6); };
  window.chPh7 = function () { GAME.cheat(7); };
  window.chPh8 = function () { GAME.cheat(8); };

  // Start
  init();
})();
