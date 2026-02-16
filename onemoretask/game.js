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

  function createCluster(name) {
    return {
      id: uid(),
      name: name,
      workerSlotsMax: 8,
      workerAgentIds: [],
      managerAssigned: false,
      tokenManagerAssigned: false,
      active: true,
    };
  }

  function addClusterWithNextName() {
    var name = CLUSTER_NAME_ORDER[G.clusters.length] || "Cluster-" + (G.clusters.length + 1);
    var cluster = createCluster(name);
    G.clusters.push(cluster);
    return cluster;
  }

  // ---------- CONSTANTS ----------
  const TICK_MS = 100; // game tick
  const SAVE_INTERVAL = 10000;
  const TASK_SPAWN_BASE = 800; // ms between new tasks (late game formula)
  const MAX_TASKS = 12;
  const AGENT_WORK_MULT = 25; // base multiplier for agent work speed
  const MAX_LOG = 200;
  const AGENT_BASE_HIRE_COST = 250;
  const AGENT_HIRE_COST_MULT = 1.9;
  const MANUAL_WORK_SECONDS_PER_CLICK = 0.15;
  const MANUAL_STRESS_PER_SEC = 2;
  const AI_WORK_MULT_PHASE2 = 1.25;
  const AI_WORK_MULT_PHASE3 = 1.8;
  const AI_FAIL_BASE_PHASE2_PER_SEC = 0.018;
  const AI_FAIL_BASE_PHASE3_PER_SEC = 0.009;
  const AI_FAIL_REWORK_FRACTION = 0.15;
  const TOPUP_COST_TOKEN = 1;
  const MANAGER_TOPUP_COST_TOKEN = 100;
  const MANAGER_TOKEN_TANK_MAX = 100;
  const TOPUP_LOAD_UNITS = 1;
  const AI_WORKER_TOKEN_TANK_MAX = 10;
  const AI_WORKER_TOPUP_FRACTION = 0.34;
  const AI_WORKER_TOKEN_TANK_DRAIN_PER_SEC = 1.2;
  const AGENT_TOKEN_TANK_DRAIN_PER_SEC = 2.5;
  const STALL_LOG_COOLDOWN_MS = 3000;
  const TASK_EXPIRY_MS = 30000;
  const EARLY_TASK_WORK_MULT = 0.5;
  const AI_TUTORIAL_SECONDS = 20;
  const SOUNDTRACKS = [
    { minTasks: 12, path: "soundtrack-loop.mp3" },
  ];
  const DRUM_LAYERS = [
    { minPhase: 4, path: "precursor_kick.mp3" },
    { minPhase: 8, path: "dnb_deep_loop.mp3" },
  ];
  const MUSIC_TARGET_VOLUME = 0.25;
  const DRUM_TARGET_VOLUME = 0.18;
  const MUSIC_FADE_IN_MS = 6000;
  const MUSIC_FADE_STEP_MS = 50;
  const DRUM_FADE_IN_MS = 10000;
  const DRUM_CROSSFADE_MS = 1800;
  const DRUM_FADE_STEP_MS = 50;
  const FINAL_PHASE = 11;
  const MAJOR_PHASE_POPUPS = [3, 5, 6, 8, 9, 10, 11];
  const CLUSTER_NAME_ORDER = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"];

  const TASK_TYPES = [
    { id: "email", name: "Write Email", icon: "\u2709\uFE0F", baseWork: 5, basePay: 3, baseRep: 1, phase: 1 },
    { id: "research", name: "Research Snippet", icon: "\uD83D\uDD0D", baseWork: 7, basePay: 5, baseRep: 2, phase: 1 },
    { id: "spreadsheet", name: "Spreadsheet Entry", icon: "\uD83D\uDCCA", baseWork: 6, basePay: 4, baseRep: 1, phase: 1 },
    { id: "social", name: "Social Media Post", icon: "\uD83D\uDCF1", baseWork: 4, basePay: 2, baseRep: 2, phase: 1 },
    { id: "copy", name: "Copywriting", icon: "\u270D", baseWork: 8, basePay: 7, baseRep: 3, phase: 1 },
    { id: "article", name: "Blog Article", icon: "\uD83D\uDCDD", baseWork: 14, basePay: 15, baseRep: 5, phase: 3 },
    { id: "report", name: "Data Report", icon: "\uD83D\uDCC8", baseWork: 17, basePay: 20, baseRep: 6, phase: 3 },
    { id: "code", name: "Small Script", icon: "\uD83D\uDCBB", baseWork: 20, basePay: 25, baseRep: 7, phase: 6 },
    { id: "integration", name: "API Integration", icon: "\uD83D\uDD17", baseWork: 28, basePay: 40, baseRep: 10, phase: 6 },
    { id: "webapp", name: "Mini Web App", icon: "\uD83C\uDF10", baseWork: 45, basePay: 70, baseRep: 15, phase: 9 },
    { id: "saas", name: "SaaS Feature", icon: "\u2601", baseWork: 68, basePay: 110, baseRep: 20, phase: 10 },
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
    { id: "wrong_email", name: "Wrong Email Sent", desc: "An agent emailed the wrong client with another client's data.", sev: "critical", repCost: 8, phase: 6 },
    { id: "conflict", name: "Agent Conflict", desc: "Two agents overwrote each other's work.", sev: "warning", repCost: 3, phase: 8 },
    { id: "outage", name: "Deployment Outage", desc: "A deployed service went down. Clients are unhappy.", sev: "critical", repCost: 10, cashCost: 20, phase: 10 },
    { id: "drift", name: "Alignment Drift", desc: "Agents optimised for the wrong metric. Output quality dropped.", sev: "warning", repCost: 4, phase: 11 },
    { id: "overcharge", name: "Billing Spike", desc: "Compute costs surged from an unoptimised workflow.", sev: "warning", cashCost: 30, phase: 7 },
    { id: "data_leak", name: "Data Mix-up", desc: "Training data from one client leaked into another's output.", sev: "critical", repCost: 12, phase: 9 },
  ];

  // ---------- UPGRADES DEFINITIONS ----------
  const UPGRADES = [
    // Early scrappy upgrades (milestone-gated by reqTasks)
    // Likely to have ~$110 at this point
    { id: "post_it_notes", name: "Post-It Notes", desc: "+50% click power. Simple but effective.", cost: 43, currency: "cash", phase: 1, effect: { clickPower: 1.5 }, oneTime: true, reqTasks: 10 },
    { id: "gas_station_coffee", name: "Gas Station Coffee", desc: "Tasks pay 15% more. Caffeine helps.", cost: 51, currency: "cash", phase: 1, effect: { payMult: 1.15 }, oneTime: true, reqTasks: 24 },
    { id: "sticky_note_system", name: "A Box Of Paperclips", desc: "Record who's asking for what.", cost: 34, currency: "cash", phase: 1, effect: { taskDetails: true }, oneTime: true, reqTasks: 26 },
    { id: "side_hustle", name: "Side Hustle Optimization", desc: "Tasks pay 20% more.", cost: 41, currency: "cash", phase: 1, effect: { payMult: 1.2 }, oneTime: true, reqTasks: 30 },
    { id: "inbox_zero", name: "Inbox Zero Method", desc: "Tasks require 15% less work. A clear inbox, a clear mind.", cost: 51, currency: "cash", phase: 1, effect: { workReduction: 0.15 }, oneTime: true, reqTasks: 29 },
    { id: "gtd_workflow", name: "GTD Workflow", desc: "You read 'Getting Things Done'. 2x click power.", cost: 61, currency: "cash", phase: 1, effect: { clickPower: 2 }, oneTime: true, reqTasks: 50 },
    { id: "focus_timer", name: "Focus Timer (Pomodoro)", desc: "Tasks require 20% less work.", cost: 79, currency: "cash", phase: 1, effect: { workReduction: 0.2 }, oneTime: true, reqTasks: 52 },

    // Phase 1 -> 2
    { id: "dual_monitors", name: "Dual Monitors", desc: "+25% pay for all tasks.", cost: 80, currency: "cash", phase: 1, effect: { payMult: 1.25 }, oneTime: true, reqTasks: 60 },
    { id: "noise_cancelling", name: "Noise-Cancelling Headphones", desc: "+50% click power.", cost: 99, currency: "cash", phase: 1, effect: { clickPower: 1.5 }, oneTime: true, reqTasks: 65 },
    { id: "free_ai", name: "Discover Free-Tier AI", desc: "Unlock AI Assist on tasks. Faster but risks hallucination failures.", cost: 210, currency: "cash", phase: 1, unlockPhase: 2, oneTime: true, reqTasks: 70 },

    // Phase 2 -> 3
    { id: "prompt_basics", name: "Prompt Engineering 101", desc: "Reduce AI failure rate by 20%.", cost: 120, currency: "cash", phase: 2, effect: { aiFailMult: 0.8 }, oneTime: true },
    { id: "prompt_examples", name: "Few-Shot Prompting", desc: "AI assist does 30% more work per action.", cost: 160, currency: "cash", phase: 2, effect: { aiPowerMult: 1.3 }, oneTime: true, reqTasks: 90 },
    { id: "marketing_campaign", name: "Marketing Campaign", desc: "Your first marketing campaign. Tasks arrive 75% faster.", cost: 200, currency: "cash", phase: 2, effect: { payMult: 1.6, giveRep: 80, taskSpawnMult: 1.75 }, oneTime: true, reqTasks: 110 },
    { id: "pro_model", name: "Pro AI Subscription", desc: "Unlock Pro model: better quality, costs tokens. Unlocks Phase 3.", cost: 700, currency: "cash", phase: 2, unlockPhase: 3, oneTime: true, reqTasks: 130 },

    // Phase 3 -> 4
    { id: "token_pack_1", name: "Token Pack (200)", desc: "Get 200 tokens.", cost: 110, currency: "cash", phase: 3, effect: { giveTokens: 200 }, oneTime: false },
    { id: "token_optimizer", name: "Token Optimizer", desc: "Smarter caching reduces AI assist token usage by 20%.", cost: 500, currency: "cash", phase: 3, effect: { tokenEfficiency: 0.8 }, oneTime: true},
    { id: "guardrails", name: "Output Guardrails", desc: "Validation layer catches hallucinations. AI failure rate -30%.", cost: 700, currency: "cash", phase: 3, effect: { aiFailMult: 0.7 }, oneTime: true },
    { id: "token_compressor", name: "Prompt Compression", desc: "Prompt compacting reduces AI assist token usage by 25%.", cost: 680, currency: "cash", phase: 3, effect: { tokenEfficiency: 0.75 }, oneTime: true, reqTasks: 300 },
    { id: "premium_support", name: "Premium Support", desc: "Priority response times. Clients are thrilled.", cost: 313, currency: "cash", phase: 3, effect: { giveRep: 1 }, oneTime: true, reqTasks: 335 },
    { id: "token_distiller", name: "Model Distillation", desc: "Smaller model handles routine work. AI assist token usage drops by 33%.", cost: 691, currency: "cash", phase: 3, effect: { tokenEfficiency: 0.67 }, oneTime: true, reqTasks: 350 },
    { id: "batch_processing", name: "Batch Processing", desc: "Queue and process work in batches. 2x click power.", cost: 500, currency: "cash", phase: 3, effect: { clickPower: 2 }, oneTime: true, reqTasks: 351 },
    { id: "billboard_campaign", name: "Billboard", desc: "A large advert on the side of a nearby building. More demand and higher pay.", cost: 800, currency: "cash", phase: 3, effect: { payMult: 2.0, giveRep: 1000 }, oneTime: true, reqTasks: 353 },
    { id: "structured_output", name: "Structured Outputs", desc: "JSON mode makes task results 25% more valuable.", cost: 900, currency: "cash", phase: 3, effect: { payMult: 1.35 }, oneTime: true, reqTasks: 353 },
    { id: "multi_bot", name: "Multi-Bot License", desc: "Unlock agent hiring. Phase 4 begins.", cost: 5500, currency: "cash", phase: 3, unlockPhase: 4, oneTime: true, reqTasks: 380 },

    // Phase 4 -> 5
    { id: "agent_onboarding", name: "Agent Onboarding Guide", desc: "Better instructions for agents. +15% agent speed.", cost: 1100, currency: "cash", phase: 4, effect: { agentSpeedMult: 1.15 }, oneTime: true },
    { id: "agent_slot_3", name: "Agent Slot Expansion (4)", desc: "Allow up to 4 agents.", cost: 2200, currency: "cash", phase: 4, effect: { agentSlots: 3 }, oneTime: true },
    { id: "inbound_pipeline", name: "Inbound Pipeline", desc: "Run an early growth push. Tasks arrive 30% faster.", cost: 1800, currency: "cash", phase: 4, effect: { taskSpawnMult: 1.3 }, oneTime: true },
    { id: "task_templates", name: "Task Templates", desc: "Pre-written briefs. Tasks require 15% less work.", cost: 2400, currency: "cash", phase: 4, effect: { workReduction: 0.15 }, oneTime: true },
    { id: "client_crm", name: "Client Tracker", desc: "Keep clients happy. Tasks pay 40% more.", cost: 2500, currency: "cash", phase: 4, effect: { payMult: 1.4 }, oneTime: true },
    { id: "error_handling", name: "Error Recovery Protocol", desc: "Agents fail less often. -20% AI failure rate.", cost: 4000, currency: "cash", phase: 4, effect: { aiFailMult: 0.8 }, oneTime: true },
    { id: "agent_slot_5", name: "Agent Slot Expansion (6)", desc: "Allow up to 6 agents.", cost: 6500, currency: "cash", phase: 4, effect: { agentSlots: 5, giveRep: 2000 }, oneTime: true },
    { id: "tool_use", name: "Tool Use SDK", desc: "Agents can use tools. Unlock Phase 5.", cost: 12000, currency: "cash", phase: 4, unlockPhase: 5, oneTime: true },

    // Phase 5 (operations pressure)
    { id: "web_browse", name: "Web Search Tool", desc: "Agents can browse the web. +15% agent speed, +20% quality on research.", cost: 2500, currency: "cash", phase: 5, effect: { toolBonus: 0.2, agentSpeedMult: 1.15 }, oneTime: true },
    { id: "sales_playbook", name: "Sales Playbook", desc: "Sharper discovery and handoff process. Sales increase by 50%.", cost: 3600, currency: "cash", phase: 5, effect: { payMult: 1.5 }, oneTime: true },
    { id: "code_exec", name: "Code Execution Tool", desc: "Agents can run code. +25% speed on code tasks.", cost: 3700, currency: "cash", phase: 5, effect: { codeSpeedMult: 1.25 }, oneTime: true },
    { id: "revenue_ops", name: "Revenue Ops System", desc: "Pipeline discipline and better follow-up. Sales increase by 50%.", cost: 8200, currency: "cash", phase: 5, effect: { payMult: 1.50 }, oneTime: true },
    { id: "manager_agent", name: "Manager Agent", desc: "Promote one agent to coordinator. Unlocks Phase 6.", cost: 25000, currency: "cash", phase: 5, unlockPhase: 6, effect: { managerUnlock: true, agentSlots: 6, giveRep: 150 }, oneTime: true },

    // Phase 6 (manager-led automation)
    { id: "scheduling", name: "Auto-Assign Playbooks", desc: "Manager runbooks boosts assignment by 50%.", cost: 15000, currency: "cash", phase: 6, effect: { managerAssignMult: 1.5, agentAutoAssign: true }, oneTime: true },
    { id: "smart_routing", name: "Smart Routing", desc: "Manager can route agents across specialties when needed.", cost: 19000, currency: "cash", phase: 6, effect: { smartRouting: true }, oneTime: true },
    { id: "neural_boost", name: "Neural Architecture Boost", desc: "Optimised model weights. All agents work 35% faster.", cost: 25000, currency: "cash", phase: 6, effect: { agentSpeedMult: 1.35 }, oneTime: true, reqTasks: 580 },
    { id: "token_manager_unlock", name: "Token Budget Console", desc: "Unlock Token Manager automation. Unlocks Phase 7.", cost: 40000, currency: "cash", phase: 6, unlockPhase: 7, effect: { giveTokens: 300 }, oneTime: true, reqTasks: 650 },

    // Phase 7 (token-stable autopilot)
    { id: "agent_slot_7", name: "Agent Slot Expansion (8)", desc: "Allow up to 8 agents.", cost: 22000, currency: "cash", phase: 7, effect: { agentSlots: 8, giveRep: 250 }, oneTime: true, reqTasks: 670 },
    { id: "compute_2", name: "Revenue Optimization Upgrade", desc: "Apply data-driven strategies to maximize sales. 2x Revenue Multiplier.", cost: 31000, currency: "cash", phase: 7, effect: { payMult: 2.0 }, oneTime: true, reqTasks: 850 },
    { id: "compute_1", name: "Incident Runbooks", desc: "DevOps resolves incidents 20% faster.", cost: 35000, currency: "cash", phase: 7, effect: { devopsIncidentMult: 1.2 }, oneTime: true, reqTasks: 850 },
    { id: "ops_flywheel", name: "Operations Flywheel", desc: "Stable operations loops unlock growth. Unlocks Phase 8.", cost: 50000, currency: "cash", phase: 7, unlockPhase: 8, effect: { payMult: 1.50, giveRep: 300 }, oneTime: true, reqTasks: 890 },

    // Phase 8 (growth marketing)
    { id: "growth_marketing", name: "Growth Marketing Engine", desc: "Launch paid ads and referral loops. Adds passive cashflow and boosts agent-generated revenue.", cost: 50000, currency: "cash", phase: 8, effect: { payMult: 2.00, giveRep: 600 }, oneTime: true, reqTasks: 860 },
    { id: "management", name: "Referral Partnerships", desc: "Partner channels bring higher-value client work.", cost: 70000, currency: "cash", phase: 8, effect: { payMult: 1.50, giveRep: 450 }, oneTime: true, reqTasks: 920 },
    { id: "acquire_micro_agency", name: "Acquire Micro Agency", desc: "Acquire a second team and standardise handoffs. Unlocks Phase 9.", cost: 200000, currency: "cash", phase: 8, unlockPhase: 9, effect: { agentSlots: 10, giveRep: 900 }, oneTime: true, reqTasks: 980 },

    // Phase 9 (clusterization)
    { id: "cluster_beta", name: "Open Cluster Bravo", desc: "Stand up a second cluster and begin multi-cluster operations.", cost: 22000, currency: "cash", phase: 9, effect: { addCluster: 1, giveRep: 350 }, oneTime: true, reqTasks: 1020 },
    { id: "code_agents", name: "Cluster Operations Blueprint", desc: "Package process into repeatable cluster units.", cost: 18000, currency: "cash", phase: 9, effect: { debtReduction: 0.25, codeQualityMult: 1.1 }, oneTime: true, reqTasks: 1060 },
    { id: "testing", name: "Cluster Runbooks", desc: "Reduce technical debt growth and tighten incident handling.", cost: 24000, currency: "cash", phase: 9, effect: { debtReduction: 0.3, devopsIncidentMult: 1.15 }, oneTime: true, reqTasks: 1120 },
    { id: "code_review", name: "Cross-Cluster QA Mesh", desc: "Improves cluster output quality by 25%.", cost: 26000, currency: "cash", phase: 9, effect: { codeQualityMult: 1.25 }, oneTime: true, reqTasks: 1160 },
    { id: "deploy", name: "Cluster Revenue Platform", desc: "Deploy services for cluster-level passive income.", cost: 30000, currency: "cash", phase: 9, effect: { serviceSlots: 2, payMult: 1.12 }, oneTime: true, reqTasks: 1200 },
    { id: "ceo_readiness", name: "AI CEO Readiness", desc: "Formalize org controls so an AI CEO can take over. Unlocks Phase 10.", cost: 75000, currency: "cash", phase: 9, unlockPhase: 10, effect: { giveRep: 1200 }, oneTime: true, reqTasks: 1280 },

    // Phase 10 (AI CEO)
    { id: "ai_ceo", name: "AI CEO (Manage Mode)", desc: "AI CEO takes over cluster coordination and budgets.", cost: 90000, currency: "cash", phase: 10, effect: { aiCeo: true, giveRep: 1500 }, oneTime: true, reqTasks: 1320 },
    { id: "server_1", name: "AI CEO Scale Mode", desc: "AI CEO can now scale cluster output aggressively.", cost: 120000, currency: "cash", phase: 10, effect: { ceoScale: true, agentSpeedMult: 1.5, payMult: 1.3, serviceSlots: 5 }, oneTime: true, reqTasks: 1400 },
    { id: "server_2", name: "Autonomous Expansion Desk", desc: "Expand orchestration bandwidth for additional teams.", cost: 140000, currency: "cash", phase: 10, effect: { agentSlots: 12, payMult: 1.2 }, oneTime: true, reqTasks: 1440 },
    { id: "retire_unlock", name: "Golden Parachute", desc: "Sell all and walk away. Unlocks Phase 11.", cost: 160000, currency: "cash", phase: 10, unlockPhase: 11, effect: { giveRep: 2000 }, oneTime: true, reqTasks: 1520 },

    // Phase 11 (retirement)
    { id: "fusion", name: "Sell The Company", desc: "Liquidate and lock in your legacy.", cost: 210000, currency: "cash", phase: 11, effect: { giveRep: 5000, giveTokens: 1000 }, oneTime: true, reqTasks: 1600 },

    // Repeatable
    { id: "token_pack_2", name: "Token Pack (500)", desc: "Get 500 tokens.", cost: 300, currency: "cash", phase: 3, effect: { giveTokens: 500 }, oneTime: false },
    { id: "pay_debt", name: "Pay Down Tech Debt", desc: "Reduce agent failure rate by 15.", cost: 200, currency: "cash", phase: 9, effect: { reduceDebt: 15 }, oneTime: false },
  ];

  // Expenses tiers
  const EXPENSE_TIERS = [
    { phase: 1, name: "Living in car", rate: 1.0 },
    { phase: 2, name: "Shared coworking desk", rate: 1.5 },
    { phase: 3, name: "Pro AI subscription", rate: 2.0 },
    { phase: 4, name: "Home office", rate: 5 },
    { phase: 5, name: "Tooling overhead", rate: 10 },
    { phase: 6, name: "Manager operations", rate: 14 },
    { phase: 7, name: "Token and incident control", rate: 18 },
    { phase: 8, name: "Growth spend + referrals", rate: 28 },
    { phase: 9, name: "Cluster coordination overhead", rate: 45 },
    { phase: 10, name: "AI CEO command stack", rate: 70 },
    { phase: 11, name: "Exit prep and legal", rate: 120 },
  ];

  // ---------- MILESTONES ----------
  const MILESTONES = [
    // Task-count based
    { id: "first_task", reqTasks: 3, reveals: ["topBar", "cash"] },
    { id: "backlog_start", reqTasks: 5, reveals: ["taskQueue"], popup: { title: "Incoming...", msg: "More gigs are coming in. Your inbox is filling up." }, spawnOnTrigger: 2 },
    { id: "rep_unlock", reqTasks: 10, reveals: ["rep"] },
    { id: "stress_unlock", reqTasks: 12, reveals: ["stress"], popup: { title: "Pressure Building", msg: "The work keeps coming. You are starting to feel the pressure." } },
    { id: "upgrades_unlock", reqTasks: 15, reveals: ["upgrades", "log"], setFlags: { taskExpiryEnabled: true }, popup: { title: "Tools of the Trade", msg: "Maybe some better tools would help you keep up..." } },
    { id: "expenses_unlock", reqTasks: 90, reveals: ["expenseCard", "expenses"], setFlags: { expensesRevealed: true }, popup: { title: "Reality Check", msg: "Your phone bill is due. Your car needs gas. Living costs money, even in a parking lot. Bills are now draining your cash." } },
    { id: "income_display", reqTasks: 96, reveals: ["income"] },
    { id: "ai_hint", reqTasks: 35, popup: { title: "There Must Be a Better Way", msg: "You are getting faster, but the work never stops. Maybe there is a smarter way..." } },
    // Phase-based
    { id: "tokens_unlock", reqPhase: 3, reveals: ["tokens"] },
    { id: "agents_unlock", reqPhase: 2, reveals: ["agents"], popup: { title: "AI Worker", msg: "Your first AI worker is available. Top it up to keep it running tasks for you." } },
    { id: "dashboard_unlock", reqPhase: 8, reveals: ["dashboard"] },
    { id: "clusters_unlock", reqPhase: 9, reveals: ["clusters"] },
    { id: "debt_unlock", reqPhase: 9, reveals: ["debt"] },
    { id: "prestige_unlock", reqPhase: FINAL_PHASE, reveals: ["prestige"] },
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
      devopsIncidentMult: 1,
      agentSlots: 2,
      serviceSlots: 0,
      managerUnlock: false,
      smartRouting: false,
      managerAssignMult: 1,
      agentAutoAssign: false,
      lastManagerAssignAt: 0,
      lastAgentAutoAssignAt: 0,
      lastTokenBuy: 0,
      ceoMode: "off",       // "off" | "manage" | "scale"
      clusters: [],
      tasks: [],
      agents: [],
      incidents: [],
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
      aiRunSeconds: 0,
      aiWorkerTokenTank: 0,
      aiWorkerCurrentTaskId: null,
      aiWorkerTasksCompleted: 0,
      aiWorkerLastStallAt: 0,
      aiWorkerShutdown: false,
      managerTokenTank: 0,
      managerLastStallAt: 0,
      taskExpiryEnabled: false,
      taskSpawnMult: 1,
      payMult: 1,
      workReduction: 0,
      taskDetails: false,
      musicMode: "layered", // off | on | layered
      uiRevealed: {
        topBar: false,
        cash: false,
        rep: false,
        stress: false,
        tokens: false,
        debt: false,
        expenses: false,
        income: false,
        taskQueue: false,
        upgrades: false,
        expenseCard: false,
        agents: false,
        incidents: false,
        dashboard: false,
        clusters: false,
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
      G = JSON.parse(raw);
      return true;
    } catch (e) {
      return false;
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
    const fatigueTasks = Math.max(0, G.totalTasksDone - 20);
    const fatigueMult = 1 + fatigueTasks * 0.002; // keep early completion speed through task 20
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
      status: "available", // available, active, ai, agent, done
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
      workRequired: Math.max(1, Math.ceil(type.baseWork * EARLY_TASK_WORK_MULT)),
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
    var base;
    if (G.prestigeCount > 0) {
      base = Math.max(300, TASK_SPAWN_BASE - G.phase * 500 - G.reputation * 5);
    } else {
      if (!G.uiRevealed.taskQueue) return Infinity; // No auto-spawn before task queue
      if (G.totalTasksDone < 10) base = 2000;
      else if (G.totalTasksDone < 15) base = 1600;
      else if (G.totalTasksDone < 20) base = 1100;
      else if (G.totalTasksDone < 50) base = 1000;
      else if (G.totalTasksDone < 200) base = 500;
      else base = Math.max(300, TASK_SPAWN_BASE - G.phase * 550 - G.reputation * 5);
    }

    var spawnMult = Math.max(0.1, G.taskSpawnMult || 1);
    return Math.max(120, base / spawnMult);
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
      $("#early-task-display").style.visibility = "visible";
      $("#early-task-icon-name").textContent = task.icon + " " + task.name;
      $("#early-task-bar").style.width = "0%";
      $("#early-task-reward").innerHTML = "<span style='color:var(--cash)'>" + fmtCash(getTaskCashPayout(task, "manual", null)) + "</span> reward &bull; 0% done";
      $("#btn-do-task").textContent = "Working...";
      $("#btn-do-task").style.cursor = "wait";
    }
    clickTask(task.id, evt);
  }

  // ---------- CLICKING / TASK WORK ----------
  function clickTask(taskId, evt) {
    const task = G.tasks.find((t) => t.id === taskId);
    if (!task || task.status !== "available") return;

    task.status = "active";
    G.activeTaskId = taskId;
    G.totalClicks++;
    showClickReward(G.clickPower, evt);
  }

  function tickManualWork(dtSec) {
    var activeTasks = G.tasks.filter(function (t) { return t.status === "active"; });
    if (activeTasks.length === 0) return;

    var workPerSec = G.clickPower / MANUAL_WORK_SECONDS_PER_CLICK;
    for (var i = 0; i < activeTasks.length; i++) {
      var task = activeTasks[i];
      task.workDone = Math.min(task.workRequired, task.workDone + workPerSec * dtSec);
      if (task.workDone >= task.workRequired) {
        completeTask(task, "manual");
      }
    }
    G.stress = clamp(G.stress + MANUAL_STRESS_PER_SEC * dtSec * activeTasks.length, 0, 100);
  }

  function getCurrentAiWorkerTask() {
    if (G.aiWorkerShutdown) return null;
    if (!G.aiWorkerCurrentTaskId) return null;
    var task = G.tasks.find(function (t) { return t.id === G.aiWorkerCurrentTaskId; }) || null;
    if (!task || task.status === "done") {
      G.aiWorkerCurrentTaskId = null;
      return null;
    }
    if (task.status !== "ai") task.status = "ai";
    return task;
  }

  function pickNextAiTask() {
    var available = G.tasks.filter(function (t) { return t.status === "available"; });
    if (available.length === 0) return null;
    available.sort(function (a, b) {
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return available[0];
  }

  function createAiWorkerIncident(task) {
    var tmpl = INCIDENT_TEMPLATES.find(function (t) { return t.id === "hallucination" && t.phase <= G.phase; });
    if (!tmpl) {
      var available = INCIDENT_TEMPLATES.filter(function (t) { return t.phase <= G.phase; });
      if (available.length === 0) return;
      tmpl = available[0];
    }
    var incident = {
      id: uid(),
      templateId: tmpl.id,
      name: tmpl.name,
      desc: tmpl.desc + (task ? " (AI worker on \"" + task.name + "\")" : ""),
      sev: tmpl.sev,
      repCost: tmpl.repCost || 0,
      cashCost: tmpl.cashCost || 0,
      tokenCost: tmpl.tokenCost || 0,
      fixProgress: 0,
      createdAt: Date.now(),
      resolved: false,
    };
    G.incidents.push(incident);
    G.totalIncidents++;
    if (incident.repCost > 0) G.reputation = Math.max(0, G.reputation - Math.ceil(incident.repCost / 2));
    if (incident.cashCost > 0) G.cash = Math.max(0, G.cash - incident.cashCost / 2);
    if (!G.uiRevealed.incidents) G.uiRevealed.incidents = true;
    log("INCIDENT: " + incident.name + "!", "bad");
  }

  function topUpAiWorker() {
    if (G.phase < 2) {
      log("AI worker is not unlocked yet.", "bad");
      return;
    }
    if (G.aiWorkerShutdown) {
      log("AI worker is shut down.", "bad");
      return;
    }
    G.aiWorkerTokenTank = clamp(G.aiWorkerTokenTank, 0, AI_WORKER_TOKEN_TANK_MAX);
    if (G.aiWorkerTokenTank >= AI_WORKER_TOKEN_TANK_MAX) return;
    if (G.phase >= 3 && G.tokens < TOPUP_COST_TOKEN) {
      if (Date.now() - G.aiWorkerLastStallAt >= STALL_LOG_COOLDOWN_MS) {
        log("AI worker top-up failed: out of tokens.", "warn");
        G.aiWorkerLastStallAt = Date.now();
      }
      return;
    }
    if (G.phase >= 3) {
      G.tokens -= TOPUP_COST_TOKEN;
    }
    var topUpAmount = AI_WORKER_TOKEN_TANK_MAX * AI_WORKER_TOPUP_FRACTION;
    G.aiWorkerTokenTank = clamp(G.aiWorkerTokenTank + topUpAmount, 0, AI_WORKER_TOKEN_TANK_MAX);
    log("AI worker topped up.", "info");
    save();
  }

  function shutdownAiWorker() {
    if (G.phase < 4) {
      log("AI worker shutdown unlocks in multi-bot mode.", "bad");
      return;
    }
    if (G.aiWorkerShutdown) return;
    for (var ti = 0; ti < G.tasks.length; ti++) {
      if (G.tasks[ti].status === "ai") G.tasks[ti].status = "available";
    }
    G.aiWorkerCurrentTaskId = null;
    G.aiWorkerTokenTank = 0;
    G.aiWorkerShutdown = true;
    log("AI worker shut down. Slot freed for other agents.", "warn");
    save();
  }

  function topUpAgent(agentId) {
    var agent = G.agents.find(function (a) { return a.id === agentId; });
    if (!agent) return;
    if (UTILITY_ROLES.indexOf(agent.roleId) >= 0) return;
    var managerOnline = G.phase >= 6 && G.agents.some(function (a) { return a.roleId === "manager"; });
    if (managerOnline) {
      log("Manager is online. Top up the manager instead.", "warn");
      return;
    }
    if (G.phase >= 3 && G.tokens < TOPUP_COST_TOKEN) {
      log("Not enough tokens to top up " + agent.name + ".", "bad");
      return;
    }
    if (G.phase >= 3) {
      G.tokens -= TOPUP_COST_TOKEN;
    }
    agent.tokenTank = (agent.tokenTank || 0) + TOPUP_LOAD_UNITS;
    agent.tokenStarved = false;
  }

  function topUpManager() {
    if (G.phase < 6) {
      log("Manager top-up unlocks in Phase 6.", "bad");
      return;
    }
    var manager = G.agents.find(function (a) { return a.roleId === "manager"; });
    if (!manager) {
      log("Hire a manager first.", "bad");
      return;
    }
    if ((G.managerTokenTank || 0) >= MANAGER_TOKEN_TANK_MAX) return;
    if (G.phase >= 3 && G.tokens < MANAGER_TOPUP_COST_TOKEN) {
      if (Date.now() - G.managerLastStallAt >= STALL_LOG_COOLDOWN_MS) {
        log("Manager top-up failed: need 100 tokens.", "warn");
        G.managerLastStallAt = Date.now();
      }
      return;
    }
    if (G.phase >= 3) {
      G.tokens -= MANAGER_TOPUP_COST_TOKEN;
    }
    var before = G.managerTokenTank || 0;
    G.managerTokenTank = clamp(before + MANAGER_TOPUP_COST_TOKEN, 0, MANAGER_TOKEN_TANK_MAX);
    var delta = Math.floor(G.managerTokenTank - before);
    if (delta > 0) log("Manager topped up (+" + delta + ").", "info");
  }

  function toggleAiAutopilot() {
    log("AI autopilot was replaced by Top-up controls in the Agents pane.", "warn");
  }

  function tickAiWorker(dtSec) {
    if (G.phase < 2 || G.aiWorkerShutdown) {
      G.aiWorkerCurrentTaskId = null;
      for (var pi = 0; pi < G.tasks.length; pi++) {
        if (G.tasks[pi].status === "ai") G.tasks[pi].status = "available";
      }
      return;
    }
    G.aiWorkerTokenTank = clamp(G.aiWorkerTokenTank, 0, AI_WORKER_TOKEN_TANK_MAX);
    if (G.aiWorkerTokenTank <= 0) {
      for (var ti = 0; ti < G.tasks.length; ti++) {
        if (G.tasks[ti].status === "ai") G.tasks[ti].status = "available";
      }
      G.aiWorkerCurrentTaskId = null;
      return;
    }

    var task = getCurrentAiWorkerTask();
    if (!task) {
      task = pickNextAiTask();
      if (!task) return;
      task.status = "ai";
      G.aiWorkerCurrentTaskId = task.id;
    }

    var effectiveDt = dtSec;
    var drain = AI_WORKER_TOKEN_TANK_DRAIN_PER_SEC * dtSec;
    if (G.aiWorkerTokenTank < drain) {
      effectiveDt = drain > 0 ? dtSec * (G.aiWorkerTokenTank / drain) : 0;
      G.aiWorkerTokenTank = 0;
    } else {
      G.aiWorkerTokenTank -= drain;
    }

    if (effectiveDt <= 0) return;

    G.aiRunSeconds += effectiveDt;
    if (!G.incidentsExplained && G.aiRunSeconds >= AI_TUTORIAL_SECONDS) {
      triggerTutorialIncident();
    }

    var failBasePerSec = G.phase >= 3 ? AI_FAIL_BASE_PHASE3_PER_SEC : AI_FAIL_BASE_PHASE2_PER_SEC;
    var failPerSec = failBasePerSec * G.aiFailMult * (1 + G.techDebt * 0.005);
    failPerSec = clamp(failPerSec, 0, 0.95);
    var failChance = 1 - Math.pow(1 - failPerSec, effectiveDt);
    if (Math.random() < failChance) {
      var rework = Math.ceil(task.workRequired * AI_FAIL_REWORK_FRACTION);
      task.workDone = Math.max(0, task.workDone - rework);
      task.status = "available";
      G.aiWorkerCurrentTaskId = null;
      createAiWorkerIncident(task);
      return;
    }

    var manualWorkPerSec = G.clickPower / MANUAL_WORK_SECONDS_PER_CLICK;
    var aiWorkMult = G.phase >= 3 ? AI_WORK_MULT_PHASE3 : AI_WORK_MULT_PHASE2;
    var aiWorkPerSec = manualWorkPerSec * aiWorkMult * G.aiPowerMult;
    task.workDone = Math.min(task.workRequired, task.workDone + aiWorkPerSec * effectiveDt);

    if (task.workDone >= task.workRequired) {
      G.aiWorkerTasksCompleted++;
      G.aiWorkerCurrentTaskId = null;
      completeTask(task, "ai_assist");
    }
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
      fixProgress: 0,
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

  function hasIdleManager() {
    return G.agents.some(function (a) { return a.roleId === "manager" && a.status === "idle"; });
  }

  function getManagerAssignmentBudget() {
    var base = G.smartRouting ? 3 : 2;
    return Math.max(1, Math.floor(base * G.managerAssignMult));
  }

  function autoAssignAgent(agentId) {
    topUpAgent(agentId);
  }

  function toggleAgentAuto(agentId) {
    if (!G.agentAutoAssign) return;
    var agent = G.agents.find(function (a) { return a.id === agentId; });
    if (!agent) return;
    if (agent.roleId === "manager" || agent.roleId === "token_mgr" || agent.roleId === "devops") return;
    agent.autoAssign = !agent.autoAssign;
    log(agent.name + (agent.autoAssign ? " set to Auto Assign." : " set to Manual Assign."), "info");
  }

  function assignAgentToTask(taskId, agentId) {
    const task = G.tasks.find((t) => t.id === taskId);
    const agent = G.agents.find((a) => a.id === agentId);
    if (!task || !agent || agent.status !== "idle") return;
    if (UTILITY_ROLES.indexOf(agent.roleId) === -1 && G.phase >= 2 && (agent.tokenTank || 0) <= 0) return;
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
      tokenTank: 0,
      status: "idle", // idle, working, error
      autoAssign: false,
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

  var UTILITY_ROLES = ["manager", "token_mgr", "devops"];

  function getSharedAgentPoolSize() {
    if (G.phase < 4) return G.aiWorkerShutdown ? 0 : 1;
    return G.agentSlots + 1;
  }

  function getSharedAgentPoolUsed() {
    var aiWorkerUsed = (!G.aiWorkerShutdown && G.phase >= 2) ? 1 : 0;
    return G.agents.length + aiWorkerUsed;
  }

  function getHireAgentCapacity() {
    if (G.phase < 4) return 0;
    return G.aiWorkerShutdown ? G.agentSlots + 1 : G.agentSlots;
  }

  function hireAgent(roleId) {
    // Utility roles are always singletons; worker roles allow duplicates in Phase 9+
    var isUtility = UTILITY_ROLES.indexOf(roleId) >= 0;
    if (isUtility || G.phase < 9) {
      if (G.agents.some(function (a) { return a.roleId === roleId; })) {
        log("Already have that agent type!", "bad");
        return;
      }
    }
    const activeAgents = G.agents.length;
    if (activeAgents >= getHireAgentCapacity()) {
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

    // Burst-assign idle workers when manager is first hired
    if (roleId === "manager") {
      var burstCount = 0;
      for (var bi = 0; bi < G.agents.length; bi++) {
        var ba = G.agents[bi];
        if (UTILITY_ROLES.indexOf(ba.roleId) >= 0) continue;
        if (ba.status !== "idle") continue;
        var bt = findMatchingTask(ba);
        if (!bt) {
          var avail = G.tasks.filter(function (t) { return t.status === "available"; });
          bt = avail[0] || null;
        }
        if (!bt) continue;
        assignAgentToTask(bt.id, ba.id);
        burstCount++;
      }
      if (burstCount > 0) {
        log("Manager deployed -- assigned " + burstCount + " idle agent" + (burstCount > 1 ? "s" : "") + "!", "good");
      }
    }

    // In Phase 9+, auto-assign new worker to first cluster with available slots
    if (G.phase >= 9 && UTILITY_ROLES.indexOf(roleId) === -1) {
      for (var ci = 0; ci < G.clusters.length; ci++) {
        var cl = G.clusters[ci];
        if (cl.workerAgentIds.length < cl.workerSlotsMax) {
          cl.workerAgentIds.push(agent.id);
          log(agent.name + " assigned to Cluster " + cl.name + ".", "info");
          break;
        }
      }
    }
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
    // Remove from cluster
    for (var ci = 0; ci < G.clusters.length; ci++) {
      var cl = G.clusters[ci];
      var wi = cl.workerAgentIds.indexOf(agentId);
      if (wi >= 0) { cl.workerAgentIds.splice(wi, 1); break; }
    }
    // Sell for 30% of next hire cost
    const refund = Math.ceil(getAgentHireCost(G.agents.length - 1) * 0.3);
    G.cash += refund;
    G.agents.splice(idx, 1);
    if (agent.roleId === "manager") {
      G.managerTokenTank = 0;
    }
    log("Fired " + agent.name + ". Recovered " + fmtCash(refund) + ".", "warn");
  }

  // ---------- AGENT TICK ----------
  function tickAgents(dtSec) {
    for (const agent of G.agents) {
      if (UTILITY_ROLES.indexOf(agent.roleId) >= 0) continue;

      if (agent.status === "idle" && (agent.tokenTank || 0) > 0) {
        var nextTask = findMatchingTask(agent);
        if (!nextTask) {
          var availIdle = G.tasks.filter(function (t) { return t.status === "available"; });
          nextTask = availIdle[0] || null;
        }
        if (nextTask) assignAgentToTask(nextTask.id, agent.id);
      }

      if (agent.status !== "working") continue;
      const task = G.tasks.find((t) => t.id === agent.currentTask);
      if (!task) {
        agent.status = "idle";
        agent.currentTask = null;
        continue;
      }

      if ((agent.tokenTank || 0) <= 0) {
        task.status = "available";
        task.assignedAgent = null;
        agent.status = "idle";
        agent.currentTask = null;
        if (!agent.tokenStarved) log(agent.name + " stalled: out of tokens.", "warn");
        agent.tokenStarved = true;
        continue;
      }

      var effectiveDt = dtSec;
      var tokenDrain = AGENT_TOKEN_TANK_DRAIN_PER_SEC * dtSec;
      if (agent.tokenTank < tokenDrain) {
        effectiveDt = tokenDrain > 0 ? dtSec * (agent.tokenTank / tokenDrain) : 0;
        agent.tokenTank = 0;
      } else {
        agent.tokenTank -= tokenDrain;
      }
      if (effectiveDt <= 0) {
        task.status = "available";
        task.assignedAgent = null;
        agent.status = "idle";
        agent.currentTask = null;
        agent.tokenStarved = true;
        continue;
      }
      agent.tokenStarved = false;

      // Work done per second
      let workRate = agent.speed * AGENT_WORK_MULT * G.agentSpeedMult * effectiveDt;
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
    if (!hasIdleManager()) return;
    var now = Date.now();
    if (now - G.lastManagerAssignAt < 500) return;
    G.lastManagerAssignAt = now;

    if (G.phase >= 6 && G.managerTokenTank <= 0) {
      if (now - G.managerLastStallAt >= STALL_LOG_COOLDOWN_MS) {
        log("Manager stalled: top up manager tokens.", "warn");
        G.managerLastStallAt = now;
      }
      return;
    }

    var assignmentBudget = getManagerAssignmentBudget();
    if (G.phase >= 6) {
      for (var ri = 0; ri < G.agents.length; ri++) {
        if (assignmentBudget <= 0) break;
        if (G.managerTokenTank <= 0) break;
        var refillAgent = G.agents[ri];
        if (UTILITY_ROLES.indexOf(refillAgent.roleId) >= 0) continue;
        if ((refillAgent.tokenTank || 0) >= TOPUP_LOAD_UNITS) continue;
        refillAgent.tokenTank = (refillAgent.tokenTank || 0) + TOPUP_LOAD_UNITS;
        refillAgent.tokenStarved = false;
        G.managerTokenTank -= TOPUP_LOAD_UNITS;
        assignmentBudget--;
      }
    }

    for (var i = 0; i < G.agents.length; i++) {
      if (assignmentBudget <= 0) break;
      var agent = G.agents[i];
      if (agent.roleId === "manager" || agent.roleId === "token_mgr" || agent.roleId === "devops") continue;
      if (agent.status !== "idle") continue;
      if ((agent.tokenTank || 0) <= 0) continue;
      var task = findMatchingTask(agent);
      if (!task && G.smartRouting) {
        var avail = G.tasks.filter(function (t) { return t.status === "available"; });
        task = avail[0] || null;
      }
      if (!task) continue;
      assignAgentToTask(task.id, agent.id);
      assignmentBudget--;
    }
  }

  // ---------- PER-AGENT AUTO-ASSIGN ----------
  function tickAgentAutoAssign() {
    if (!G.agentAutoAssign) return;
    if (hasIdleManager()) return;
    var now = Date.now();
    if (now - G.lastAgentAutoAssignAt < 1600) return;
    G.lastAgentAutoAssignAt = now;

    var assigned = 0;
    for (var i = 0; i < G.agents.length; i++) {
      var agent = G.agents[i];
      if (agent.status !== "idle") continue;
      if (agent.roleId === "manager" || agent.roleId === "token_mgr" || agent.roleId === "devops") continue;
      if (!agent.autoAssign) continue;
      var task = findMatchingTask(agent);
      if (!task) continue;
      assignAgentToTask(task.id, agent.id);
      assigned++;
      if (assigned >= 1) break;
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
      fixProgress: 0,
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
      inc.fixProgress = 100;
      inc.resolved = true;
      log("Manually resolved: " + inc.name + ".", "good");
    } else if (method === "cash") {
      const cost = (inc.cashCost || 20) * 2;
      if (G.cash < cost) { log("Not enough cash!", "bad"); return; }
      G.cash -= cost;
      inc.fixProgress = 100;
      inc.resolved = true;
      log("Paid " + fmtCash(cost) + " to resolve: " + inc.name + ".", "warn");
    }

    // Remove resolved after delay
    setTimeout(() => {
      G.incidents = G.incidents.filter((i) => i.id !== incidentId);
    }, 500);
  }

  function tickIncidents(dtSec) {
    const idleDevops = G.agents.filter((a) => a.roleId === "devops" && a.status === "idle").length;
    const devopsMitigation = idleDevops > 0 ? Math.max(0.35, 1 - idleDevops * 0.25) : 1;

    // Unresolved incidents drain reputation over time
    for (const inc of G.incidents) {
      if (inc.resolved) continue;
      const age = (Date.now() - inc.createdAt) / 1000;
      if (age > 10) {
        var progressMitigation = inc.fixProgress ? Math.max(0.25, 1 - inc.fixProgress / 120) : 1;
        G.reputation = Math.max(0, G.reputation - 0.1 * dtSec * devopsMitigation * progressMitigation);
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

  // ---------- DEVOPS INCIDENT RESPONSE ----------
  function tickDevopsIncidentResponse(dtSec) {
    const responders = G.agents.filter((a) => a.roleId === "devops" && a.status === "idle");
    if (responders.length === 0) return;

    const active = G.incidents
      .filter((i) => !i.resolved)
      .sort((a, b) => {
        var sa = a.sev === "critical" ? 2 : 1;
        var sb = b.sev === "critical" ? 2 : 1;
        if (sb !== sa) return sb - sa;
        return a.createdAt - b.createdAt;
      });
    if (active.length === 0) return;

    var workBudget = responders.length * dtSec * 11 * G.devopsIncidentMult;
    for (var i = 0; i < active.length && workBudget > 0; i++) {
      var inc = active[i];
      var remaining = Math.max(0, 100 - inc.fixProgress);
      var spend = Math.min(remaining, workBudget);
      inc.fixProgress += spend;
      workBudget -= spend;
      if (inc.fixProgress >= 100) {
        inc.resolved = true;
        log("DevOps resolved: " + inc.name + ".", "good");
        (function (incidentId) {
          setTimeout(function () {
            G.incidents = G.incidents.filter(function (x) { return x.id !== incidentId; });
          }, 500);
        })(inc.id);
      }
    }
  }

  // ---------- PASSIVE INCOME ----------
  function tickServices(dtSec) {
    let totalPassiveIncome = 0;
    totalPassiveIncome += (getAgentRevenueRate() + getMarketingRevenueRate()) * dtSec;
    if (G.phase >= 10) {
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

  // ---------- TECH DEBT (Phase 9+) ----------
  function tickDebt(dtSec) {
    if (G.phase < 9) return;
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
    if (G.phase < 4) return 1;
    var mult = 1 + (G.phase - 3) * 0.18;
    if (G.purchasedUpgrades.includes("growth_marketing")) mult += 0.15;
    return mult;
  }

  function getUpgradeCost(upg) {
    if (!upg) return 0;
    return upg.cost;
  }

  function getAgentHireCost(agentCount) {
    var baseCost = AGENT_BASE_HIRE_COST * Math.pow(AGENT_HIRE_COST_MULT, agentCount);
    return Math.ceil(baseCost * getLateCostMultiplier());
  }

  function getAgentRevenueRate() {
    if (G.phase < 4) return 0;
    var activeWorkers = G.agents.filter(function (agent) {
      return UTILITY_ROLES.indexOf(agent.roleId) === -1 && agent.status === "working";
    }).length;
    if (activeWorkers <= 0) return 0;
    var perAgent = 1.4 + G.phase * 0.4;
    if (G.purchasedUpgrades.includes("growth_marketing")) perAgent *= 1.65;
    return activeWorkers * perAgent;
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
      if (upg.effect.toolBonus) G.toolBonus += upg.effect.toolBonus;
      if (upg.effect.codeSpeedMult) G.codeSpeedMult *= upg.effect.codeSpeedMult;
      if (upg.effect.agentSpeedMult) G.agentSpeedMult *= upg.effect.agentSpeedMult;
      if (upg.effect.codeQualityMult) G.codeQualityMult *= upg.effect.codeQualityMult;
      if (upg.effect.debtReduction) G.debtReduction = Math.min(0.9, G.debtReduction + upg.effect.debtReduction);
      if (upg.effect.driftReduction) G.driftReduction = Math.min(0.9, G.driftReduction + upg.effect.driftReduction);
      if (upg.effect.devopsIncidentMult) G.devopsIncidentMult *= upg.effect.devopsIncidentMult;
      if (upg.effect.managerUnlock) G.managerUnlock = true;
      if (upg.effect.managerAssignMult) G.managerAssignMult *= upg.effect.managerAssignMult;
      if (upg.effect.agentAutoAssign) G.agentAutoAssign = true;
      if (upg.effect.smartRouting) G.smartRouting = true;
      if (upg.effect.aiCeo) G.ceoMode = "manage";
      if (upg.effect.ceoScale) G.ceoMode = "scale";
      if (upg.effect.addCluster) {
        for (var addCount = 0; addCount < upg.effect.addCluster; addCount++) {
          var addedCluster = addClusterWithNextName();
          log("Cluster " + addedCluster.name + " opened.", "info");
        }
      }
      if (upg.effect.serviceSlots) G.serviceSlots = Math.max(G.serviceSlots, upg.effect.serviceSlots);
      if (upg.effect.reduceDebt) G.techDebt = Math.max(0, G.techDebt - upg.effect.reduceDebt);
      // New effects for early upgrades
      if (upg.effect.payMult) G.payMult *= upg.effect.payMult;
      if (upg.effect.workReduction) G.workReduction = Math.min(0.5, G.workReduction + upg.effect.workReduction);
      if (upg.effect.taskDetails) G.taskDetails = true;
      if (upg.effect.tokenEfficiency) G.tokenEfficiency *= upg.effect.tokenEfficiency;
      if (upg.effect.taskSpawnMult) G.taskSpawnMult *= upg.effect.taskSpawnMult;
      if (upg.effect.giveRep) G.reputation += upg.effect.giveRep;
    }

    // Phase unlock
    if (upg.unlockPhase && upg.unlockPhase > G.phase) {
      G.phase = upg.unlockPhase;
      log("PHASE " + G.phase + " UNLOCKED!", "info");

      // Phase 3: grant starter tokens
      const starter_tokens = 200;
      if (G.phase === 3) G.tokens += starter_tokens;

      // Build phase upgrade popup copy and show only on major beats
      var newTier = null;
      for (var ti = 0; ti < EXPENSE_TIERS.length; ti++) {
        if (G.phase >= EXPENSE_TIERS[ti].phase) newTier = EXPENSE_TIERS[ti];
      }
      var title = upg.name;
      var msg = upg.desc;
      if (G.phase === 3) msg += "\n\nYou start with " + starter_tokens + " tokens. AI Assist and agents will burn tokens over time. Buy token packs from the upgrade shop to keep up, or you will stall out.";
      if (G.phase === 5) msg += "\n\nTooling upgrades are available now -- upgrade your agents and unlock the Manager to take control.";
      if (G.phase === 6) msg += "\n\nManager mode is live. Hire a Manager to auto-assign idle workers immediately.";
      if (newTier && G.expensesRevealed) msg += "\n\nLifestyle upgraded to: " + newTier.name + ". Expenses are now " + fmtCash(newTier.rate) + "/s.";

      // Phase 9: initialize clusters
      if (G.phase === 9 && G.clusters.length === 0) {
        var alpha = addClusterWithNextName();
        // Assign existing workers to Alpha
        for (var ci = 0; ci < G.agents.length; ci++) {
          var ag = G.agents[ci];
          if (UTILITY_ROLES.indexOf(ag.roleId) >= 0) continue;
          if (alpha.workerAgentIds.length < alpha.workerSlotsMax) {
            alpha.workerAgentIds.push(ag.id);
          }
        }
        // Assign manager/token_mgr to Alpha if they exist
        if (G.agents.some(function (a) { return a.roleId === "manager"; })) alpha.managerAssigned = true;
        if (G.agents.some(function (a) { return a.roleId === "token_mgr"; })) alpha.tokenManagerAssigned = true;
        log("Cluster Alpha formed with existing team.", "info");
        msg += "\n\nCluster Alpha formed around your existing team. Unlock the next cluster as you scale.";
      }

      // Phase 10: AI CEO baseline orchestration bump
      if (G.phase === 10) {
        G.agentSpeedMult *= 1.8;
        G.payMult *= 1.6;
        msg += "\n\nAI CEO orchestration is live. Throughput and margins climb immediately.";
      }

      if (MAJOR_PHASE_POPUPS.indexOf(G.phase) >= 0) {
        showPopup(title, msg);
      }

      // Auto-deploy a service when reaching phase 10
      if (G.phase >= 10 && G.services.length === 0) {
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
    return G.phase >= FINAL_PHASE;
  }

  function canTrueRetire() {
    return G.phase >= FINAL_PHASE &&
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
    // Expenses (only if revealed)
    const expenses = G.expensesRevealed ? getExpenseRate() * cappedSec : 0;
    const net = Math.max(0, income - expenses);

    return { earned: income, expenses: expenses, net: net, seconds: cappedSec };
  }

  // ---------- TASK SPAWN TICK ----------
  function tickTaskSpawn() {
    const interval = getSpawnInterval();
    if (interval === Infinity) return;
    if (Date.now() - G.lastTaskSpawn < interval) return;
    G.lastTaskSpawn = Date.now();
    spawnTask();
  }

  // ---------- AI CEO auto-management (Phase 10+) ----------
  function tickAiCeo() {
    if (G.ceoMode === "off") return;

    // Manage mode + Scale mode: auto-assign idle agents to available tasks
    var idleAgents = G.agents.filter(function (a) { return a.status === "idle" && UTILITY_ROLES.indexOf(a.roleId) === -1; });
    var availTasks = G.tasks.filter(function (t) { return t.status === "available"; });
    for (var i = 0; i < Math.min(idleAgents.length, availTasks.length); i++) {
      var agent = idleAgents[i];
      var bestTask = availTasks.find(function (t) { return agent.specialty.includes(t.typeId); }) || availTasks[i];
      if (bestTask) {
        assignAgentToTask(bestTask.id, agent.id);
      }
    }

    // Manage mode: auto-enable autoAssign on new hires
    if (G.agentAutoAssign) {
      for (var j = 0; j < G.agents.length; j++) {
        var ag = G.agents[j];
        if (UTILITY_ROLES.indexOf(ag.roleId) === -1 && !ag.autoAssign) {
          ag.autoAssign = true;
        }
      }
    }

    // Scale mode: auto-hire when slots available and cash is healthy
    if (G.ceoMode === "scale") {
      var emptySlots = getHireAgentCapacity() - G.agents.length;
      if (emptySlots > 0) {
        var hireCost = getAgentHireCost(G.agents.length);
        var cashThreshold = hireCost * 3;
        if (G.cash > cashThreshold) {
          // Pick a worker role that has cluster slots available
          var workerRoles = AGENT_ROLES.filter(function (r) { return UTILITY_ROLES.indexOf(r.id) === -1; });
          var role = pick(workerRoles);
          hireAgent(role.id);
        }
      }
      // Auto-create new cluster when all existing clusters are full
      var allFull = G.clusters.length > 0 && G.clusters.every(function (c) { return c.workerAgentIds.length >= c.workerSlotsMax; });
      if (allFull && G.cash > 50000) {
        var newCluster = addClusterWithNextName();
        log("CEO scaled up: Cluster " + newCluster.name + " created.", "info");
      }
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
  let drumPlayer = null;
  let outgoingDrumPlayer = null;
  let musicUnlocked = false;
  let activeSoundtrackPath = null;
  let activeDrumLayerPath = null;
  let musicFadeInterval = null;
  let drumFadeInterval = null;
  let drumCrossfadeInterval = null;
  let hasDoneInitialMusicFadeIn = false;
  let smoothedIncomeRate = 0;

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

  function getCurrentMusicMode() {
    if (G.musicMode === "off" || G.musicMode === "on" || G.musicMode === "layered") {
      return G.musicMode;
    }
    return "layered";
  }

  function updateMusicToggleLabel() {
    var mode = getCurrentMusicMode();
    var label = mode === "layered" ? "Layered" : mode === "off" ? "Off" : "On";
    $("#btn-settings-music").textContent = "Music: " + label;
  }

  function clearMusicFadeTimerIfAny() {
    if (musicFadeInterval) {
      clearInterval(musicFadeInterval);
      musicFadeInterval = null;
    }
  }

  function clearDrumFadeTimerIfAny() {
    if (drumFadeInterval) {
      clearInterval(drumFadeInterval);
      drumFadeInterval = null;
    }
  }

  function clearDrumCrossfadeTimerIfAny() {
    if (drumCrossfadeInterval) {
      clearInterval(drumCrossfadeInterval);
      drumCrossfadeInterval = null;
    }
  }

  function stopAndResetAudio(player, volume) {
    if (!player) return;
    player.pause();
    player.currentTime = 0;
    player.volume = volume;
  }

  function playAudioIfUnlocked(player, label) {
    if (!musicUnlocked || !player) return;
    const playPromise = player.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function (err) {
        if (!err) return;
        if (err.name === "NotAllowedError" || err.name === "AbortError") return;
        console.error("Unable to play " + label + ".", err);
      });
    }
  }

  function createDrumPlayer(path) {
    var player = new Audio();
    player.preload = "auto";
    player.loop = true;
    player.volume = 0;
    if (path) {
      player.src = path;
      player.load();
    }
    return player;
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

  function getCurrentDrumLayerPath() {
    var selectedPath = null;
    for (var i = 0; i < DRUM_LAYERS.length; i++) {
      var layer = DRUM_LAYERS[i];
      if (G.phase >= layer.minPhase) {
        selectedPath = layer.path;
      }
    }
    return selectedPath;
  }

  function ensureSoundtrackSource(nextSoundtrackPath) {
    if (activeSoundtrackPath === nextSoundtrackPath) return;
    clearMusicFadeTimerIfAny();
    musicPlayer.pause();
    musicPlayer.src = nextSoundtrackPath;
    musicPlayer.currentTime = 0;
    musicPlayer.load();
    musicPlayer.volume = MUSIC_TARGET_VOLUME;
    activeSoundtrackPath = nextSoundtrackPath;
  }

  function syncBaseSoundtrack(nextSoundtrackPath) {
    if (!nextSoundtrackPath) {
      clearMusicFadeTimerIfAny();
      stopAndResetAudio(musicPlayer, MUSIC_TARGET_VOLUME);
      activeSoundtrackPath = null;
      return;
    }

    ensureSoundtrackSource(nextSoundtrackPath);
    if (!musicUnlocked) return;

    const shouldFadeIn = !hasDoneInitialMusicFadeIn;
    if (shouldFadeIn) {
      musicPlayer.volume = 0;
    } else {
      musicPlayer.volume = MUSIC_TARGET_VOLUME;
    }
    playAudioIfUnlocked(musicPlayer, "soundtrack");
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

  function stopDrumPlayback() {
    clearDrumFadeTimerIfAny();
    clearDrumCrossfadeTimerIfAny();
    stopAndResetAudio(drumPlayer, 0);
    if (outgoingDrumPlayer) {
      stopAndResetAudio(outgoingDrumPlayer, 0);
      outgoingDrumPlayer = null;
    }
    activeDrumLayerPath = null;
  }

  function fadeInDrumPlayer() {
    if (!drumPlayer) return;
    clearDrumFadeTimerIfAny();
    drumPlayer.volume = 0;
    playAudioIfUnlocked(drumPlayer, "drum layer");
    if (!musicUnlocked) return;
    var elapsed = 0;
    drumFadeInterval = setInterval(function () {
      elapsed += DRUM_FADE_STEP_MS;
      var progress = elapsed / DRUM_FADE_IN_MS;
      if (progress >= 1) {
        drumPlayer.volume = DRUM_TARGET_VOLUME;
        clearDrumFadeTimerIfAny();
        return;
      }
      drumPlayer.volume = DRUM_TARGET_VOLUME * progress;
    }, DRUM_FADE_STEP_MS);
  }

  function crossfadeDrumPlayer(nextDrumPath) {
    clearDrumFadeTimerIfAny();
    clearDrumCrossfadeTimerIfAny();

    outgoingDrumPlayer = drumPlayer;
    var nextDrumPlayer = createDrumPlayer(nextDrumPath);
    drumPlayer = nextDrumPlayer;
    activeDrumLayerPath = nextDrumPath;

    if (!musicUnlocked) {
      if (outgoingDrumPlayer) {
        stopAndResetAudio(outgoingDrumPlayer, 0);
        outgoingDrumPlayer = null;
      }
      return;
    }

    playAudioIfUnlocked(drumPlayer, "drum layer");
    var outgoingStartVolume = outgoingDrumPlayer && outgoingDrumPlayer.volume > 0 ? outgoingDrumPlayer.volume : DRUM_TARGET_VOLUME;
    var elapsed = 0;
    drumCrossfadeInterval = setInterval(function () {
      elapsed += DRUM_FADE_STEP_MS;
      var progress = elapsed / DRUM_CROSSFADE_MS;
      if (progress >= 1) {
        drumPlayer.volume = DRUM_TARGET_VOLUME;
        if (outgoingDrumPlayer) {
          stopAndResetAudio(outgoingDrumPlayer, 0);
          outgoingDrumPlayer = null;
        }
        clearDrumCrossfadeTimerIfAny();
        return;
      }
      drumPlayer.volume = DRUM_TARGET_VOLUME * progress;
      if (outgoingDrumPlayer) {
        outgoingDrumPlayer.volume = outgoingStartVolume * (1 - progress);
      }
    }, DRUM_FADE_STEP_MS);
  }

  function syncDrumLayerPlayback(nextDrumPath) {
    if (!nextDrumPath) {
      stopDrumPlayback();
      return;
    }

    if (!drumPlayer) {
      drumPlayer = createDrumPlayer(nextDrumPath);
      activeDrumLayerPath = nextDrumPath;
      fadeInDrumPlayer();
      return;
    }

    if (activeDrumLayerPath !== nextDrumPath) {
      if (activeDrumLayerPath === null) {
        stopAndResetAudio(drumPlayer, 0);
        drumPlayer.src = nextDrumPath;
        drumPlayer.currentTime = 0;
        drumPlayer.load();
        activeDrumLayerPath = nextDrumPath;
        fadeInDrumPlayer();
        return;
      }
      crossfadeDrumPlayer(nextDrumPath);
      return;
    }

    playAudioIfUnlocked(drumPlayer, "drum layer");
    if (!drumCrossfadeInterval && !drumFadeInterval && drumPlayer.volume < DRUM_TARGET_VOLUME) {
      var remaining = DRUM_TARGET_VOLUME - drumPlayer.volume;
      drumPlayer.volume += Math.min(remaining, 0.02);
    }
  }

  function syncMusicPlayback() {
    if (!musicPlayer) return;
    var mode = getCurrentMusicMode();
    var nextSoundtrackPath = getCurrentSoundtrackPath();
    var nextDrumLayerPath = getCurrentDrumLayerPath();

    if (mode === "off") {
      clearMusicFadeTimerIfAny();
      stopAndResetAudio(musicPlayer, MUSIC_TARGET_VOLUME);
      activeSoundtrackPath = null;
      stopDrumPlayback();
      return;
    }

    syncBaseSoundtrack(nextSoundtrackPath);
    if (!nextSoundtrackPath || mode !== "layered") {
      stopDrumPlayback();
      return;
    }
    syncDrumLayerPlayback(nextDrumLayerPath);
  }

  function unlockMusicPlayback() {
    musicUnlocked = true;
    syncMusicPlayback();
  }

  function setupMusic() {
    if (musicPlayer && drumPlayer) {
      updateMusicToggleLabel();
      syncMusicPlayback();
      return;
    }

    if (!musicPlayer) {
      musicPlayer = new Audio();
      musicPlayer.preload = "auto";
      musicPlayer.loop = true;
      musicPlayer.volume = MUSIC_TARGET_VOLUME;
      document.addEventListener("pointerdown", unlockMusicPlayback, { once: true });
      document.addEventListener("keydown", unlockMusicPlayback, { once: true });
      document.addEventListener("click", unlockMusicPlayback, { once: true });
    }
    if (!drumPlayer) {
      drumPlayer = createDrumPlayer(null);
    }

    updateMusicToggleLabel();
    syncMusicPlayback();
  }

  function toggleMusicSetting() {
    var mode = getCurrentMusicMode();
    if (mode === "off") G.musicMode = "on";
    else if (mode === "on") G.musicMode = "layered";
    else G.musicMode = "off";
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

  function updateRotateOverlay() {
    var overlay = $("#rotate-overlay");
    if (!overlay) return;
    var dismissed = sessionStorage.getItem("rotate_dismissed") === "1";
    var isMobile = window.innerWidth <= 768;
    var isPortrait = window.innerHeight > window.innerWidth;
    overlay.classList.toggle("show", !dismissed && isMobile && isPortrait);
  }

  function clearExpiredTaskState(task) {
    if (task.status === "agent" && task.assignedAgent) {
      var assigned = G.agents.find(function (a) { return a.id === task.assignedAgent; }) || null;
      if (assigned && assigned.currentTask === task.id) {
        assigned.status = "idle";
        assigned.currentTask = null;
      }
    }
    if (task.status === "ai" && G.aiWorkerCurrentTaskId === task.id) {
      G.aiWorkerCurrentTaskId = null;
    }
    if (task.status === "active" && G.activeTaskId === task.id) {
      G.activeTaskId = null;
    }
  }

  function pruneTasks(now) {
    G.tasks = G.tasks.filter(function (task) {
      if (task.status === "done") return false;
      if (!G.taskExpiryEnabled) return true;
      if (now - task.createdAt < TASK_EXPIRY_MS) return true;
      clearExpiredTaskState(task);
      return false;
    });
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
    tickManualWork(dtSec);
    tickAiWorker(dtSec);
    tickManager();
    tickAgents(dtSec);
    tickAgentAutoAssign();
    tickTokenManager();
    tickIncidents(dtSec);
    tickDevopsIncidentResponse(dtSec);
    tickServices(dtSec);
    tickExpenses(dtSec);
    tickDebt(dtSec);
    tickStress(dtSec);
    tickAiCeo();

    pruneTasks(now);

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
	    var cashDigits = G.cash < 100 && G.cash % 1 !== 0 ? 2 : 0;
	    $("#res-cash").textContent = "$" + G.cash.toLocaleString("en-US", { minimumFractionDigits: cashDigits, maximumFractionDigits: cashDigits });
	    $("#res-tokens").textContent = fmt(G.tokens);
	    $("#res-rep").textContent = fmt(G.reputation);
	    $("#res-debt").textContent = fmt(G.techDebt);
	    $("#res-stress").textContent = Math.round(G.stress) + "%";
	    $("#phase-label").textContent = "Phase " + G.phase;

    // Progressive reveal of resource counters
    $("#res-cash-wrap").style.display = G.uiRevealed.cash ? "" : "none";
    $("#res-tokens-wrap").style.display = G.uiRevealed.tokens ? "" : "none";
    $("#res-rep-wrap").style.display = G.uiRevealed.rep ? "" : "none";
    $("#res-debt-wrap").style.display = G.uiRevealed.debt ? "" : "none";
    $("#res-stress-wrap").style.display = G.uiRevealed.stress ? "" : "none";

    // Warning pulse
    $("#res-tokens-wrap").classList.toggle("res-warning", G.tokens < MANAGER_TOPUP_COST_TOKEN);
    $("#res-stress-wrap").classList.toggle("res-warning", G.stress > 80);

    // Income and expense rates
    var income = getIncomeRate();
    if (smoothedIncomeRate === 0) smoothedIncomeRate = income;
    smoothedIncomeRate += (income - smoothedIncomeRate) * 0.2;
    if (Math.abs(smoothedIncomeRate - income) < 0.01) smoothedIncomeRate = income;
    var expense = getExpenseRate();
    var incomeEl = $("#income-rate");
    incomeEl.style.display = G.uiRevealed.income ? "" : "none";
    incomeEl.textContent = "+" + fmtCash(smoothedIncomeRate) + "/s";
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
    var btn = $("#btn-do-task");
    var activeTask = G.tasks.find((t) => t.status === "active");
    if (activeTask) {
      display.style.visibility = "visible";
      $("#early-task-icon-name").textContent = activeTask.icon + " " + activeTask.name;
      var pct = Math.floor((activeTask.workDone / activeTask.workRequired) * 100);
      var displayedPay = getTaskCashPayout(activeTask, "manual", null);
      $("#early-task-bar").style.width = pct + "%";
      $("#early-task-reward").innerHTML = "<span style='color:var(--cash)'>" + fmtCash(displayedPay) + "</span> reward &bull; " + pct + "% done";
      btn.textContent = "Working...";
      btn.style.cursor = "wait";
    } else {
      display.style.visibility = "hidden";
      $("#early-task-bar").style.width = "0%";
      $("#early-task-reward").textContent = "";
      btn.textContent = "Do Task";
      btn.style.cursor = "pointer";
    }
  }

  function getWorkTaskButtonClass() {
    if (G.phase >= 4) return "btn btn-work-phase4 btn-sm task-action-btn";
    if (G.phase >= 3) return "btn btn-work-phase3 btn-sm task-action-btn";
    if (G.phase >= 2) return "btn btn-work-phase2 btn-sm task-action-btn";
    return "btn btn-primary btn-sm task-action-btn";
  }

  function getAiWorkerDisplayName() {
    return G.phase >= 3 ? "AI Worker Pro" : "AI Worker";
  }

  function getAgentTaskLabel(agentName) {
    if (!agentName) return "Agent";
    if (agentName.length <= 10) return agentName;
    return agentName.slice(0, 10) + "...";
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
      if (t.status === "available") {
        var clickBtn = "<button class='" + getWorkTaskButtonClass() + "' onpointerdown=\"GAME.clickTask('" + t.id + "', event)\">Work</button>";
        actions += clickBtn;
      }
      if (t.status === "active") {
        actions = "<button class='" + getWorkTaskButtonClass() + "' disabled style='cursor:wait'>Working...</button>";
      }
      if (t.status === "ai") {
        actions = "<button class='btn btn-purple btn-sm task-action-btn' disabled style='cursor:wait'>" + getAiWorkerDisplayName() + " (" + pct + "%)</button>";
      }
      if (t.status === "agent" && agent) {
        var agentWorkBtnClass = G.phase >= 4 ? "btn btn-purple btn-sm task-action-btn" : getWorkTaskButtonClass();
        actions = "<button class='" + agentWorkBtnClass + "' disabled style='cursor:wait' title='" + agent.name + "'>" + getAgentTaskLabel(agent.name) + " (" + pct + "%)</button>";
      }
      var displayedPay = getTaskCashPayout(t, t.status === "agent" ? "agent" : "manual", agent);

      // Task expiry countdown
      var expiryHtml = "";
      if (G.taskExpiryEnabled) {
        var timeLeft = Math.max(0, TASK_EXPIRY_MS / 1000 - (Date.now() - t.createdAt) / 1000);
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

    var MAX_VISIBLE = 2;
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

  function renderAgentStatusButton(statusText, isActive) {
    var statusClass = isActive ? "btn btn-primary btn-sm agent-status-btn" : "btn btn-outline btn-sm agent-status-btn";
    return "<button class='" + statusClass + "' disabled>" + statusText + "</button>";
  }

  function renderAiWorkerCard() {
    if (G.phase < 2 || G.aiWorkerShutdown) return "";
    var aiTask = getCurrentAiWorkerTask();
    var aiTokenTank = Math.max(0, G.aiWorkerTokenTank || 0);
    var aiTokenLoaded = Math.floor(aiTokenTank);
    var aiTokenPct = clamp(Math.floor((aiTokenLoaded / AI_WORKER_TOKEN_TANK_MAX) * 100), 0, 100);
    var aiCanTopUp = aiTokenTank < AI_WORKER_TOKEN_TANK_MAX && (G.phase < 3 || G.tokens >= TOPUP_COST_TOKEN);
    var aiCostLabel = G.phase < 3 ? " (free)" : " (-1 tok)";
    var aiPct = aiTask ? Math.floor((aiTask.workDone / aiTask.workRequired) * 100) : 0;
    var statusText = aiTokenLoaded <= 0 ? "No tokens" : "Working (" + aiPct + "%)";
    var statusHtml = renderAgentStatusButton(statusText, aiTokenLoaded > 0);
    var shutdownBtn = G.phase >= 4 ? "<button class='btn btn-outline btn-sm agent-delete-btn' title='Shutdown' onclick=\"GAME.shutdownAiWorker()\">X</button>" : "";
    var statusRow = "<div class='agent-status-row'>" + statusHtml + shutdownBtn + "</div>";

    return "<div class='card agent-card'>" +
      "<div class='agent-icon' style='background:#7c3aed30;color:#a78bfa'>\uD83E\uDD16</div>" +
      "<div class='agent-info'>" +
      "<div class='name'>" + getAiWorkerDisplayName() + "</div>" +
      "<div class='role'>Single worker queue</div>" +
      "<div class='agent-meter-row'>" +
      "<div class='task-bar'>" +
      "<div class='task-bar-fill' style='width:" + aiTokenPct + "%;background:var(--purple)'></div>" +
      "</div>" +
      "<span class='agent-stat'>Tasks: " + (G.aiWorkerTasksCompleted || 0) + "</span>" +
      "</div>" +
      "</div>" +
      "<div class='agent-action-col'>" +
      "<button class='btn btn-purple btn-sm' onclick=\"GAME.topUpAiWorker()\" " + (!aiCanTopUp ? "disabled" : "") + ">Top-up" + aiCostLabel + "</button>" +
      statusRow +
      "</div>" +
      "</div>";
  }

  function renderAgentSection() {
    var section = $("#section-agents");
    if (!G.uiRevealed.agents || G.uiRevealed.clusters) { section.style.display = "none"; return; }
    section.style.display = "";

    if (G.phase < 2) {
      $("#agent-slots").textContent = "";
      $("#agent-hire-section").innerHTML = "";
      $("#agent-list").innerHTML = "";
      return;
    }

    if (G.phase < 4) {
      if (!G.aiWorkerShutdown) {
        $("#agent-slots").textContent = "Solo AI";
        $("#agent-hire-section").innerHTML = "<div class='text-sm text-muted' style='margin-bottom:8px'>Top up your AI worker to keep it running.</div>";
        $("#agent-list").innerHTML = renderAiWorkerCard();
      } else {
        $("#agent-slots").textContent = "0/1 slots";
        $("#agent-hire-section").innerHTML = "<div class='text-sm text-muted' style='margin-bottom:8px'>AI worker is shut down.</div>";
        $("#agent-list").innerHTML = "";
      }
      return;
    }

    $("#agent-slots").textContent = getSharedAgentPoolUsed() + "/" + getSharedAgentPoolSize() + " slots";

    // Hire info
    var hireCost = getAgentHireCost(G.agents.length);
    var availRoles = AGENT_ROLES.filter(function (r) {
      if (r.id === "manager" && !G.managerUnlock) return false;
      if (r.id === "devops" && G.phase < 7) return false;
      if (r.id === "sales" && G.phase < 8) return false;
      if (r.id === "token_mgr" && G.purchasedUpgrades.indexOf("token_manager_unlock") === -1) return false;
      return true;
    });
    var phase9ClusterMode = G.phase >= 9 && G.uiRevealed.clusters;
    var managerAgent = G.agents.find(function (a) { return a.roleId === "manager"; }) || null;
    var managerOnline = G.phase >= 6 && !!managerAgent;
    var managerBudget = getManagerAssignmentBudget();
    var managerSummary = "";
    if (G.phase >= 6) {
      managerSummary = "<div class='card' style='margin-bottom:10px'>" +
        "<div class='flex-between mb'><strong>Manager Console</strong><span class='text-sm text-muted'>" + (managerAgent ? "Online" : "Offline") + "</span></div>" +
        "<div class='text-sm' style='display:flex;gap:10px;flex-wrap:wrap'>" +
        "<span>Auto-Assign: " + (managerAgent ? "Active" : "Need Manager hire") + "</span>" +
        "<span>Throughput: " + managerBudget + " assignment/tick</span>" +
        "<span>Smart Routing: " + (G.smartRouting ? "On" : "Off") + "</span>" +
        "</div>" +
        "</div>";
    }
    if (phase9ClusterMode) {
      var utilityHireButtons = "";
      for (var ur = 0; ur < availRoles.length; ur++) {
        var utilRole = availRoles[ur];
        if (UTILITY_ROLES.indexOf(utilRole.id) === -1) continue;
        var utilOwned = G.agents.some(function (a) { return a.roleId === utilRole.id; });
        utilityHireButtons += "<button class='btn btn-green btn-sm' onclick=\"GAME.hire('" + utilRole.id + "')\" " + (utilOwned || G.cash < hireCost ? "disabled" : "") + ">" + utilRole.icon + " " + utilRole.name + "</button>";
      }
      managerSummary += "<div class='text-sm text-muted' style='margin-bottom:8px'>Workers are now managed in the Clusters panel.</div>";
      if (utilityHireButtons) {
        managerSummary += "<div style='display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px'>" + utilityHireButtons + "</div>";
      }
    }
    $("#agent-hire-section").innerHTML = managerSummary;

    // Agent list -- assignable first, then error, idle, working last
    var sorted = G.agents.slice().sort(function (a, b) {
      function rank(ag) {
        if (G.phase >= 6 && ag.roleId === "manager") return -1; // manager always leads in phase 6+
        if (ag.status === "idle" && UTILITY_ROLES.indexOf(ag.roleId) === -1 && findMatchingTask(ag)) return 0; // assignable
        if (ag.status === "error") return 1;
        if (ag.status === "idle" && UTILITY_ROLES.indexOf(ag.roleId) === -1) return 2;
        return 3; // working or utility
      }
      return rank(a) - rank(b);
    });
    var displayAgents = phase9ClusterMode
      ? sorted.filter(function (a) { return UTILITY_ROLES.indexOf(a.roleId) >= 0; })
      : sorted;

    var aiCardHtml = renderAiWorkerCard();
    var aiAtBottom = false;
    if (aiCardHtml) {
      aiAtBottom = (G.aiWorkerTokenTank || 0) > 0 || !!getCurrentAiWorkerTask();
    }
    var emptySlots = phase9ClusterMode ? 0 : (getHireAgentCapacity() - G.agents.length);
    if (emptySlots < 0) emptySlots = 0;
    var hireSlotsHtml = "";
    for (var s = 0; s < emptySlots; s++) {
      var btns = "";
      for (var ri = 0; ri < availRoles.length; ri++) {
        var r = availRoles[ri];
        if (phase9ClusterMode && UTILITY_ROLES.indexOf(r.id) === -1) continue;
        var owned = G.agents.some(function (a) { return a.roleId === r.id; });
        var isUtil = UTILITY_ROLES.indexOf(r.id) >= 0;
        var blocked = (isUtil || G.phase < 9) ? owned : false;
        btns += "<button class='btn btn-green btn-sm' onclick=\"GAME.hire('" + r.id + "')\" " + (blocked || G.cash < hireCost ? "disabled" : "") + ">" + r.icon + " " + r.name + "</button>";
      }
      hireSlotsHtml += "<div class='card agent-card' style='border-style:dashed;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap;min-height:62px'>" +
        "<span class='text-muted' style='font-size:.75rem'>Hire (" + fmtCash(hireCost) + ")</span>" +
        btns +
        "</div>";
    }
    var html = "";
    var managerFirst = G.phase >= 6 && displayAgents.length > 0 && displayAgents[0].roleId === "manager";
    var firstManagerCard = "";
    var otherCards = "";
    for (var j = 0; j < displayAgents.length; j++) {
      var a = displayAgents[j];
      var task = a.currentTask ? G.tasks.find(function (t) { return t.id === a.currentTask; }) : null;
      var tokenTank = Math.max(0, a.tokenTank || 0);
      var tokenPct = clamp(Math.floor((tokenTank / TOPUP_LOAD_UNITS) * 100), 0, 100);
      var meterColor = "var(--accent)";
      if (a.roleId === "manager") {
        tokenPct = clamp(Math.floor(((G.managerTokenTank || 0) / MANAGER_TOKEN_TANK_MAX) * 100), 0, 100);
        meterColor = "var(--green)";
      } else if (a.roleId === "token_mgr") {
        tokenPct = a.status === "error" ? 0 : 100;
        meterColor = "var(--token)";
      } else if (a.roleId === "devops") {
        tokenPct = a.status === "error" ? 0 : 100;
        meterColor = "var(--green)";
      }

      var actionButtons = "";
      var stateText = a.status[0].toUpperCase() + a.status.slice(1);
      var stateActive = a.status !== "error";

      if (a.roleId === "manager") {
        actionButtons = "<div style='display:flex;gap:6px'><button class='btn btn-purple btn-sm' onclick=\"GAME.topUpManager()\" " + (G.tokens < MANAGER_TOPUP_COST_TOKEN || (G.managerTokenTank || 0) >= MANAGER_TOKEN_TANK_MAX ? "disabled" : "") + ">Top-up 100</button></div>";
        stateText = (G.managerTokenTank || 0) > 0 ? "Managing" : "No tokens";
        stateActive = (G.managerTokenTank || 0) > 0;
      } else if (a.roleId === "token_mgr" && a.status === "idle") {
        stateText = "Active";
      } else if (a.roleId === "devops" && a.status === "idle") {
        stateText = "Incident Response";
      } else if (UTILITY_ROLES.indexOf(a.roleId) === -1 && managerOnline) {
        stateText = "Managed";
      } else if (UTILITY_ROLES.indexOf(a.roleId) === -1) {
        actionButtons = "<div style='display:flex;gap:6px'><button class='btn btn-purple btn-sm' onclick=\"GAME.topUpAgent('" + a.id + "')\" " + (G.phase >= 3 && G.tokens < TOPUP_COST_TOKEN ? "disabled" : "") + ">Top-up (-1 tok)</button>" + (G.agentAutoAssign ? "<button class='btn btn-outline btn-sm' onclick=\"GAME.toggleAgentAuto('" + a.id + "')\">" + (a.autoAssign ? "Auto ON" : "Auto OFF") + "</button>" : "") + "</div>";
        if (a.status === "error") {
          stateText = "Error";
          stateActive = false;
        } else if (a.tokenStarved) {
          stateText = "No tokens";
          stateActive = false;
        } else if (a.status === "working") {
          stateText = "Working";
          stateActive = true;
        } else {
          stateText = "Idle";
          stateActive = true;
        }
      }

      var cardHtml = "<div class='card agent-card'>" +
        "<div class='agent-icon' style='background:" + a.color + "30;color:" + a.color + "'>" + a.icon + "</div>" +
        "<div class='agent-info'>" +
        "<div class='name'>" + a.name + (task ? " <span style='font-weight:400;font-size:.72rem;color:var(--accent);margin-left:8px'>" + task.name + " (" + Math.floor(task.workDone / task.workRequired * 100) + "%)</span>" : a.roleId === "manager" && a.status === "idle" ? " <span style='font-weight:400;font-size:.72rem;color:var(--accent);margin-left:8px'>Managing</span>" : a.roleId === "token_mgr" && a.status === "idle" ? " <span style='font-weight:400;font-size:.72rem;color:var(--token);margin-left:8px'>Monitoring tokens</span>" : a.roleId === "devops" && a.status === "idle" ? " <span style='font-weight:400;font-size:.72rem;color:var(--green);margin-left:8px'>Incident response</span>" : a.autoAssign ? " <span style='font-weight:400;font-size:.72rem;color:var(--green);margin-left:8px'>Auto Assign ON</span>" : "") + "</div>" +
        "<div class='agent-role-row'>" +
        "<div class='role'>" + a.roleName + " -- <span style='color:var(--text3)'>" + a.traitName + "</span></div>" +
        "<div class='agent-stats'>" +
        "<span class='agent-stat'>SPD " + a.speed.toFixed(2) + "</span>" +
        "<span class='agent-stat'>QUA " + a.quality.toFixed(2) + "</span>" +
        "<span class='agent-stat'>REL " + a.reliability.toFixed(2) + "</span>" +
        (G.phase >= 9 && UTILITY_ROLES.indexOf(a.roleId) === -1 ? (function () { var acl = getAgentCluster(a.id); return acl ? "<span class='agent-stat' style='color:var(--accent)'>" + acl.name + "</span>" : "<span class='agent-stat' style='color:var(--text3)'>Unassigned</span>"; })() : "") +
        "</div>" +
        "</div>" +
        "<div class='agent-meter-row'>" +
        "<div class='task-bar'><div class='task-bar-fill' style='width:" + tokenPct + "%;background:" + meterColor + "'></div></div>" +
        "<span class='agent-stat'>Tasks: " + (a.tasksCompleted || 0) + "</span>" +
        "</div>" +
        "</div>" +
        "<div class='agent-action-col'>" +
        actionButtons +
        "<div class='agent-status-row'>" + renderAgentStatusButton(stateText, stateActive) +
        "<button class='btn btn-outline btn-sm agent-delete-btn' title='Delete' onclick=\"GAME.fire('" + a.id + "')\">X</button></div>" +
        "</div>" +
        "</div>";
      if (managerFirst && j === 0) firstManagerCard = cardHtml;
      else otherCards += cardHtml;
    }
    if (managerFirst) {
      html += firstManagerCard;
      html += hireSlotsHtml;
      if (aiCardHtml && !aiAtBottom) html += aiCardHtml;
      html += otherCards;
    } else {
      html += hireSlotsHtml;
      if (aiCardHtml && !aiAtBottom) html += aiCardHtml;
      html += otherCards;
    }
    if (aiCardHtml && aiAtBottom) html += aiCardHtml;
    $("#agent-list").innerHTML = html;
  }

  function getAgentCluster(agentId) {
    for (var i = 0; i < G.clusters.length; i++) {
      if (G.clusters[i].workerAgentIds.indexOf(agentId) >= 0) return G.clusters[i];
    }
    return null;
  }

  function assignWorkerToCluster(agentId, clusterId) {
    // Remove from any current cluster
    for (var i = 0; i < G.clusters.length; i++) {
      var cl = G.clusters[i];
      var idx = cl.workerAgentIds.indexOf(agentId);
      if (idx >= 0) cl.workerAgentIds.splice(idx, 1);
    }
    // Add to target cluster
    var target = G.clusters.find(function (c) { return c.id === clusterId; });
    if (target && target.workerAgentIds.length < target.workerSlotsMax) {
      target.workerAgentIds.push(agentId);
      var ag = G.agents.find(function (a) { return a.id === agentId; });
      if (ag) log(ag.name + " assigned to Cluster " + target.name + ".", "info");
    }
  }

  function unassignWorkerFromCluster(agentId) {
    for (var i = 0; i < G.clusters.length; i++) {
      var cl = G.clusters[i];
      var idx = cl.workerAgentIds.indexOf(agentId);
      if (idx >= 0) {
        cl.workerAgentIds.splice(idx, 1);
        var ag = G.agents.find(function (a) { return a.id === agentId; });
        if (ag) log(ag.name + " unassigned from Cluster " + cl.name + ".", "info");
        return;
      }
    }
  }

  function toggleClusterUtil(clusterId, role) {
    var cl = G.clusters.find(function (c) { return c.id === clusterId; });
    if (!cl) return;
    if (role === "manager") {
      // Toggle: unassign from all others first
      if (cl.managerAssigned) {
        cl.managerAssigned = false;
      } else {
        // Only one manager exists, so just move assignment
        for (var i = 0; i < G.clusters.length; i++) G.clusters[i].managerAssigned = false;
        cl.managerAssigned = true;
      }
    } else if (role === "token_mgr") {
      if (cl.tokenManagerAssigned) {
        cl.tokenManagerAssigned = false;
      } else {
        for (var i = 0; i < G.clusters.length; i++) G.clusters[i].tokenManagerAssigned = false;
        cl.tokenManagerAssigned = true;
      }
    }
  }

  function renderClusterSection() {
    var section = $("#section-clusters");
    if (!G.uiRevealed.clusters) { section.style.display = "none"; return; }
    section.style.display = "";

    var totalWorkers = 0;
    for (var ci = 0; ci < G.clusters.length; ci++) totalWorkers += G.clusters[ci].workerAgentIds.length;
    var totalSlots = G.clusters.length * 8;
    $("#cluster-count").textContent = G.clusters.length + " clusters, " + totalWorkers + "/" + totalSlots + " workers";

    // CEO mode badge
    var ceoBadge = G.ceoMode !== "off" ? " <span class='cluster-ceo-badge'>CEO: " + G.ceoMode + "</span>" : "";

    // Manager Console + utility hire buttons (moved from agent section)
    var managerAgent = G.agents.find(function (a) { return a.roleId === "manager"; }) || null;
    var managerBudget = getManagerAssignmentBudget();
    var clusterManagerTopupBtn = "";
    if (managerAgent) {
      clusterManagerTopupBtn = "<button class='btn btn-purple btn-sm' onclick=\"GAME.topUpManager()\" " + (G.tokens < MANAGER_TOPUP_COST_TOKEN || (G.managerTokenTank || 0) >= MANAGER_TOKEN_TANK_MAX ? "disabled" : "") + ">Top-up 100</button>";
    }
    var html = "<div class='card' style='margin-bottom:10px'>" +
      "<div class='flex-between mb'><strong>Manager Console</strong><span class='text-sm text-muted'>" + (managerAgent ? "Online" : "Offline") + "</span></div>" +
      "<div class='text-sm' style='display:flex;gap:10px;flex-wrap:wrap'>" +
      "<span>Auto-Assign: " + (managerAgent ? "Active" : "Need Manager hire") + "</span>" +
      "<span>Throughput: " + managerBudget + " assignment/tick</span>" +
      "<span>Smart Routing: " + (G.smartRouting ? "On" : "Off") + "</span>" +
      clusterManagerTopupBtn +
      "</div>" +
      "</div>";

    var clusterHireCost = getAgentHireCost(G.agents.length);
    var clusterAvailRoles = AGENT_ROLES.filter(function (r) {
      if (r.id === "manager" && !G.managerUnlock) return false;
      if (r.id === "devops" && G.phase < 7) return false;
      if (r.id === "sales" && G.phase < 8) return false;
      if (r.id === "token_mgr" && G.purchasedUpgrades.indexOf("token_manager_unlock") === -1) return false;
      return true;
    });
    var utilityHireButtons = "";
    for (var ur = 0; ur < clusterAvailRoles.length; ur++) {
      var utilRole = clusterAvailRoles[ur];
      if (UTILITY_ROLES.indexOf(utilRole.id) === -1) continue;
      var utilOwned = G.agents.some(function (a) { return a.roleId === utilRole.id; });
      utilityHireButtons += "<button class='btn btn-green btn-sm' onclick=\"GAME.hire('" + utilRole.id + "')\" " + (utilOwned || G.cash < clusterHireCost ? "disabled" : "") + ">" + utilRole.icon + " " + utilRole.name + "</button>";
    }
    if (utilityHireButtons) {
      html += "<div style='display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px'>" + utilityHireButtons + "</div>";
    }

    for (var ci = 0; ci < G.clusters.length; ci++) {
      var cl = G.clusters[ci];
      var workerCount = cl.workerAgentIds.length;
      var workingCount = 0;
      var idleCount = 0;
      for (var wi = 0; wi < cl.workerAgentIds.length; wi++) {
        var wag = G.agents.find(function (a) { return a.id === cl.workerAgentIds[wi]; });
        if (wag && wag.status === "working") workingCount++;
        else if (wag && wag.status === "idle") idleCount++;
      }

      // Util slots row
      var hasManager = G.agents.some(function (a) { return a.roleId === "manager"; });
      var hasTokenMgr = G.agents.some(function (a) { return a.roleId === "token_mgr"; });
      var mgrSlot = "<span class='cluster-slot util-slot " + (cl.managerAssigned ? "filled" : "empty") + "' onclick=\"GAME.toggleClusterUtil('" + cl.id + "','manager')\" title='Manager'>" +
        "\uD83D\uDC54 " + (cl.managerAssigned ? "Mgr" : (hasManager ? "+" : "--")) + "</span>";
      var tmSlot = "<span class='cluster-slot util-slot " + (cl.tokenManagerAssigned ? "filled" : "empty") + "' onclick=\"GAME.toggleClusterUtil('" + cl.id + "','token_mgr')\" title='Token Manager'>" +
        "\uD83E\uDE99 " + (cl.tokenManagerAssigned ? "TM" : (hasTokenMgr ? "+" : "--")) + "</span>";

      // Worker slots (8 squares)
      var slotsHtml = "";
      for (var si = 0; si < cl.workerSlotsMax; si++) {
        if (si < cl.workerAgentIds.length) {
          var wid = cl.workerAgentIds[si];
          var wagent = G.agents.find(function (a) { return a.id === wid; });
          if (wagent) {
            slotsHtml += "<span class='cluster-slot filled' style='color:" + wagent.color + ";border-color:" + wagent.color + "' onclick=\"GAME.unassignWorker('" + wid + "')\" title='" + wagent.name + " (" + wagent.roleName + ")'>" + wagent.icon + "</span>";
          } else {
            // Stale reference -- clean up
            slotsHtml += "<span class='cluster-slot empty'>?</span>";
          }
        } else {
          slotsHtml += "<span class='cluster-slot empty' onclick=\"GAME.cycleAssign('" + cl.id + "')\">+</span>";
        }
      }

      html += "<div class='cluster-card'>" +
        "<div class='cluster-hdr'><span class='cluster-name'>" + cl.name + ceoBadge + "</span><span class='cluster-status'>" + (cl.active ? "Active" : "Idle") + "</span></div>" +
        "<div class='cluster-slots-row'>" + mgrSlot + tmSlot + "</div>" +
        "<div class='cluster-slots-row'>" + slotsHtml + "</div>" +
        "<div class='cluster-stats'><span>" + workerCount + "/8 workers</span><span style='color:var(--accent)'>" + workingCount + " active</span><span style='color:var(--green)'>" + idleCount + " idle</span></div>" +
        "</div>";
      // Only show CEO badge on the first cluster
      ceoBadge = "";
    }

    // Unassigned workers list
    var unassigned = G.agents.filter(function (a) {
      if (UTILITY_ROLES.indexOf(a.roleId) >= 0) return false;
      return !getAgentCluster(a.id);
    });
    if (unassigned.length > 0) {
      html += "<div style='margin-top:8px;font-size:.78rem;color:var(--text2)'>Unassigned workers:</div>";
      for (var ui = 0; ui < unassigned.length; ui++) {
        var ua = unassigned[ui];
        var assignBtns = "";
        for (var ci2 = 0; ci2 < G.clusters.length; ci2++) {
          var cl2 = G.clusters[ci2];
          if (cl2.workerAgentIds.length < cl2.workerSlotsMax) {
            assignBtns += "<button class='btn btn-green btn-sm' onclick=\"GAME.assignToCluster('" + ua.id + "','" + cl2.id + "')\">" + cl2.name + "</button>";
          }
        }
        html += "<div style='display:flex;gap:6px;align-items:center;margin-top:4px'>" +
          "<span style='color:" + ua.color + "'>" + ua.icon + "</span> <span class='text-sm'>" + ua.name + "</span> " + assignBtns +
          "</div>";
      }
    }

    if (G.agents.length < G.agentSlots) {
      var hireCost = getAgentHireCost(G.agents.length);
      var workerButtons = "";
      for (var ri = 0; ri < AGENT_ROLES.length; ri++) {
        var role = AGENT_ROLES[ri];
        if (UTILITY_ROLES.indexOf(role.id) >= 0) continue;
        workerButtons += "<button class='btn btn-green btn-sm' onclick=\"GAME.hire('" + role.id + "')\" " + (G.cash < hireCost ? "disabled" : "") + ">" + role.icon + " " + role.name + "</button>";
      }
      html += "<div style='margin-top:10px'>" +
        "<div class='text-sm text-muted' style='margin-bottom:4px'>Hire worker (" + fmtCash(hireCost) + "):</div>" +
        "<div style='display:flex;gap:6px;flex-wrap:wrap'>" + workerButtons + "</div>" +
        "</div>";
    }

    // Global Utility Roles section
    var utilAgents = G.agents.filter(function (a) { return UTILITY_ROLES.indexOf(a.roleId) >= 0; });
    if (utilAgents.length > 0) {
      html += "<div style='margin-top:12px;font-size:.78rem;color:var(--text2);margin-bottom:6px'>Global Utility Roles</div>";
      for (var ui2 = 0; ui2 < utilAgents.length; ui2++) {
        var ua2 = utilAgents[ui2];
        var utilStatus = ua2.roleId === "manager" && ua2.status === "idle" ? "Managing"
          : ua2.roleId === "token_mgr" && ua2.status === "idle" ? "Monitoring tokens"
          : ua2.roleId === "devops" && ua2.status === "idle" ? "Incident response"
          : ua2.status[0].toUpperCase() + ua2.status.slice(1);
        html += "<div class='card agent-card'>" +
          "<div class='agent-icon' style='background:" + ua2.color + "30;color:" + ua2.color + "'>" + ua2.icon + "</div>" +
          "<div class='agent-info'>" +
          "<div class='name'>" + ua2.name + " <span style='font-weight:400;font-size:.72rem;color:var(--accent);margin-left:8px'>" + utilStatus + "</span></div>" +
          "<div class='role'>" + ua2.roleName + " -- <span style='color:var(--text3)'>" + ua2.traitName + "</span></div>" +
          "</div>" +
          "<div style='display:flex;flex-direction:column;gap:8px;align-items:flex-end'>" +
          "<button class='btn btn-outline btn-sm agent-delete-btn' title='Delete' onclick=\"GAME.fire('" + ua2.id + "')\">X</button>" +
          "</div>" +
          "</div>";
      }
    }

    $("#cluster-list").innerHTML = html;
  }

  function cycleAssignWorker(clusterId) {
    // Find first unassigned worker and assign to this cluster
    var unassigned = G.agents.filter(function (a) {
      if (UTILITY_ROLES.indexOf(a.roleId) >= 0) return false;
      return !getAgentCluster(a.id);
    });
    if (unassigned.length === 0) return;
    assignWorkerToCluster(unassigned[0].id, clusterId);
  }

  function renderIncidentSection() {
    var section = $("#section-incidents");
    if (!G.uiRevealed.incidents) { section.style.display = "none"; return; }
    section.style.display = "";

    var active = G.incidents.filter(function (i) { return !i.resolved; });
    var idleDevops = G.agents.filter(function (a) { return a.roleId === "devops" && a.status === "idle"; }).length;
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
	      var repPart = inc.repCost > 0 ? "<span style='font-size:.78rem;color:var(--rep)'>-" + inc.repCost + " rep/s</span>" : "";
	      var cashPart = inc.cashCost > 0 ? "<span style='font-size:.78rem;color:var(--red)'>-" + fmtCash(inc.cashCost) + "</span>" : "";
	      html += "<div class='card incident-card " + (inc.sev === "warning" ? "warning" : "") + "'>" +
	        "<div class='sev " + inc.sev + "'>" + inc.sev + "</div>" +
	        "<div style='display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px'>" +
	        "<div style='font-weight:600;min-width:0'>" + inc.name + "</div>" +
	        "<div style='display:flex;align-items:center;gap:8px;white-space:nowrap'>" +
	        repPart +
	        cashPart +
	        "<span style='font-size:.78rem;color:var(--text3)'>" + age + "s</span>" +
	        "</div>" +
	        "</div>" +
	        "<div class='text-sm text-muted mb'>" + inc.desc + "</div>" +
	        (idleDevops > 0 ? "<div class='text-sm mb' style='color:var(--green)'>DevOps responding (" + (inc.fixProgress || 0).toFixed(0) + "%)</div>" : "") +
	        ((inc.fixProgress || 0) > 0 ? "<div class='task-bar mb'><div class='task-bar-fill' style='width:" + Math.min(100, inc.fixProgress).toFixed(0) + "%;background:var(--green)'></div></div>" : "") +
	        "<div style='display:flex;gap:6px'>" +
	        "<button class='btn btn-primary btn-sm' onclick=\"GAME.resolveInc('" + inc.id + "','manual')\">Fix Manually (+stress)</button>" +
	        "<button class='btn btn-yellow btn-sm'" + (G.cash < (inc.cashCost || 20) * 2 ? " disabled" : "") + " onclick=\"GAME.resolveInc('" + inc.id + "','cash')\">Pay to Fix (" + fmtCash((inc.cashCost || 20) * 2) + ")</button>" +
	        "</div>" +
	        "</div>";
	    }
    $("#incident-list").innerHTML = html;
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
    if (G.phase < FINAL_PHASE) {
      content.innerHTML =
        "<div class='prestige-box'>" +
        "<h2>Not Yet...</h2>" +
        "<div class='req'>Reach Phase " + FINAL_PHASE + " to unlock the Retire option.</div>" +
        "<div class='text-sm text-muted'>Current: Phase " + G.phase + " / " + FINAL_PHASE + "</div>" +
        "<div class='task-bar mt' style='max-width:300px;margin:10px auto'>" +
        "<div class='task-bar-fill' style='width:" + (G.phase / FINAL_PHASE * 100).toFixed(0) + "%;background:var(--purple)'></div>" +
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
    var cpVisible = G.uiRevealed.upgrades || G.uiRevealed.agents || G.uiRevealed.clusters ||
      G.uiRevealed.incidents || G.uiRevealed.dashboard || G.uiRevealed.prestige ||
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
    renderClusterSection();
    renderIncidentSection();
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

    $("#btn-rotate-continue").addEventListener("click", function () {
      sessionStorage.setItem("rotate_dismissed", "1");
      updateRotateOverlay();
    });
    window.addEventListener("resize", updateRotateOverlay);
    window.addEventListener("orientationchange", updateRotateOverlay);
    updateRotateOverlay();

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
    toggleAiAutopilot: toggleAiAutopilot,
    topUpAiWorker: topUpAiWorker,
    shutdownAiWorker: shutdownAiWorker,
    topUpAgent: topUpAgent,
    topUpManager: topUpManager,
    assignAgent: assignAgentToTask,
    autoAssign: function (id) { topUpAgent(id); },
    hire: hireAgent,
    fire: fireAgent,
    buy: purchaseUpgrade,
    resolveInc: resolveIncident,
    toggleAgentAuto: toggleAgentAuto,
    assignToCluster: assignWorkerToCluster,
    unassignWorker: unassignWorkerFromCluster,
    cycleAssign: cycleAssignWorker,
    toggleClusterUtil: toggleClusterUtil,
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
        "0_1": { tasks: 0, cash: 0, ph: 1 }, // Initial state after start
        "0_2": { tasks: 11, cash: 53, ph: 1 },  // -> Pressure Building (task 12)
        "0_3": { tasks: 19, cash: 78, ph: 1 },  // -> Tools of the Trade (task 20)
        1: { tasks: 89, cash: 90, ph: 1 },  // -> Reality Check / expenses (task 90)
        2: { tasks: 128, cash: 205, ph: 1 },  // -> Discover Free-Tier AI / phase 2 (task 110)
        3: { tasks: 247, cash: 498, ph: 2 }, // -> Pro AI Subscription / phase 3
        4: { tasks: 510, cash: 7000, tokens: 200, ph: 3 }, // -> Multi-Bot License / phase 4
        5: { tasks: 850, cash: 15000, tokens: 436, ph: 4 },   // Phase 5 entry: web/code upgrades available
        6: { tasks: 560, cash: 22000, tokens: 500, ph: 5 },   // Phase 6 entry: manager works before playbooks
        7: { tasks: 775, cash: 34000, tokens: 500, ph: 6 },   // Phase 7 entry: Token budget console
        8: { tasks: 1050, cash: 40000, tokens: 500, ph: 7 },   // Phase 7 entry: Token budget console
        9: { tasks: 1180, cash: 150000, tokens: 900, ph: 8 }, // Phase 9 entry: single cluster Alpha

        10: { tasks: 1030, cash: 90000, tokens: 1000, ph: 9 }, // Phase 9: second cluster upgrade available soon
        11: { tasks: 1100, cash: 120000, tokens: 1200, ph: 10 }, // Phase 9: second cluster can be purchased
      };
      var s = stages[stage];
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
      // Fill all currently available hire slots
      var hireGuard = 0;
      while (G.phase >= 4 && G.agents.length < getHireAgentCapacity() && hireGuard < 100) {
        hireGuard++;
        var candidates = AGENT_ROLES.filter(function (role) {
          if (role.id === "manager" && !G.managerUnlock) return false;
          if (role.id === "devops" && G.phase < 7) return false;
          if (role.id === "sales" && G.phase < 8) return false;
          if (role.id === "token_mgr" && G.purchasedUpgrades.indexOf("token_manager_unlock") === -1) return false;
          if ((UTILITY_ROLES.indexOf(role.id) >= 0 || G.phase < 9) && G.agents.some(function (a) { return a.roleId === role.id; })) return false;
          return true;
        });
        if (candidates.length === 0) break;
        var roleToHire = candidates[0];
        var beforeHireCount = G.agents.length;
        hireAgent(roleToHire.id);
        if (G.agents.length === beforeHireCount) break;
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

  // Console shortcuts
  var cheatShortcuts = [
    "0_1", "0_2", "0_3", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
  ];
  for (var shortcutIndex = 0; shortcutIndex < cheatShortcuts.length; shortcutIndex++) {
    var shortcut = cheatShortcuts[shortcutIndex];
    var shortName = "chPh" + shortcut.toString();
    window[shortName] = (function (stageNum) {
      return function () { GAME.cheat(stageNum); };
    })(shortcut);
  }

  // Start
  init();
})();
