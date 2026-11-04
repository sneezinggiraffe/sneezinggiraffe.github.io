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
  const fmtTokens = (n) => Math.round(n).toLocaleString("en-US");
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
      invested: 0,
      buildRemaining: 0,
      buildDuration: 0,
      workforce: 0,
      tank: 0,
      progress: 0,
      workerSlotsMax: G.ceoMode === "off" ? 8 : 16,
      workerAgentIds: [],
      managerAssigned: false,
      tokenManagerAssigned: false,
      active: true,
    };
  }

  function addClusterWithNextName() {
    G.clustersProvisioned++;
    var name = "Cluster " + G.clustersProvisioned;
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
  // Keep AI throughput after moving the early 4.5x click-power bonuses into manual queues.
  const AI_WORK_MULT_PHASE2 = 5.625;
  const AI_WORK_MULT_PHASE3 = 8.1;
  const AI_FAIL_BASE_PHASE2_PER_SEC = 0.018;
  const AI_FAIL_BASE_PHASE3_PER_SEC = 0.009;
  const AI_FAIL_REWORK_FRACTION = 0.15;
  const MANAGER_TOPUP_COST_TOKEN = 4000;
  const MANAGER_TOKEN_TANK_MAX = 4000;
  const STALL_LOG_COOLDOWN_MS = 3000;
  const TASK_EXPIRY_MS = 30000;
  const EARLY_TASK_WORK_MULT = 0.5;
  const AI_TUTORIAL_SECONDS = 20;
  const SOUNDTRACKS = [
    { minTasks: 12, path: "soundtrack-loop.mp3" },
  ];
  const DNB_LAYER_PATH = "dnb_synth_loop.wav";
  const DRUM_LAYERS = [
    { minPhase: 4, path: "precursor_kick.mp3" },
    { minPhase: 8, path: DNB_LAYER_PATH },
  ];
  const MUSIC_TARGET_VOLUME = 0.25;
  const DRUM_TARGET_VOLUME = 0.18;
  const SYNTH_START_PHASE = 5;
  const SYNTH_LAYER_PATH = "synth_d4_loop.mp3";
  const SYNTH_TARGET_VOLUME = 0.0729;
  const SYNTH_FADE_IN_MS = 8000;
  const MUSIC_FADE_IN_MS = 6000;
  const MUSIC_FADE_STEP_MS = 50;
  const DRUM_FADE_IN_MS = 10000;
  const DRUM_BAR_SECONDS = 2.09;
  const DRUM_CROSSFADE_MS = DRUM_BAR_SECONDS * 2000;
  const DNB_CROSSFADE_MS = DRUM_BAR_SECONDS * 3000;
  const DRUM_FADE_STEP_MS = 50;
  const FINAL_PHASE = 15;
  const SAVE_VERSION = 8;

  const CLUSTER_COST = 50000;
  const MAJOR_PHASE_POPUPS = [3, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15];

  const TASK_TYPES = [
    { id: "email", name: "Write Email", icon: "\u2709\uFE0F", baseWork: 5, basePay: 3, phase: 1 },
    { id: "research", name: "Research Snippet", icon: "\uD83D\uDD0D", baseWork: 7, basePay: 5, phase: 1 },
    { id: "spreadsheet", name: "Spreadsheet Entry", icon: "\uD83D\uDCCA", baseWork: 6, basePay: 4, phase: 1 },
    { id: "social", name: "Social Media Post", icon: "\uD83D\uDCF1", baseWork: 4, basePay: 2, phase: 1 },
    { id: "copy", name: "Copywriting", icon: "\u270D", baseWork: 8, basePay: 7, phase: 1 },
    { id: "article", name: "Blog Article", icon: "\uD83D\uDCDD", baseWork: 14, basePay: 15, phase: 3 },
    { id: "report", name: "Data Report", icon: "\uD83D\uDCC8", baseWork: 17, basePay: 20, phase: 3 },
    { id: "code", name: "Small Script", icon: "\uD83D\uDCBB", baseWork: 20, basePay: 25, phase: 6 },
    { id: "integration", name: "API Integration", icon: "\uD83D\uDD17", baseWork: 28, basePay: 40, phase: 6 },
    { id: "webapp", name: "Mini Web App", icon: "\uD83C\uDF10", baseWork: 45, basePay: 70, phase: 9 },
    { id: "saas", name: "SaaS Feature", icon: "\u2601", baseWork: 68, basePay: 110, phase: 10 },
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
    { id: "chaotic", name: "Chaotic Energy", desc: "Work speed varies +/-20% while working", fx: () => {} },
  ];

  const INCIDENT_TEMPLATES = [
    { id: "hallucination", name: "Hallucinated Output Published", desc: "An agent published confident nonsense to a client.", sev: "critical", phase: 2 },
    { id: "token_burn", name: "Token Budget Exceeded", desc: "An agent entered a reasoning loop and burned through tokens.", sev: "warning", tokenCost: 50, phase: 3 },
    { id: "wrong_email", name: "Wrong Email Sent", desc: "An agent emailed the wrong client with another client's data.", sev: "critical", phase: 6 },
    { id: "conflict", name: "Agent Conflict", desc: "Two agents overwrote each other's work.", sev: "warning", phase: 8 },
    { id: "outage", name: "Deployment Outage", desc: "A deployed service went down. Clients are unhappy.", sev: "critical", cashCost: 20, phase: 10 },
    { id: "drift", name: "Alignment Drift", desc: "Agents optimised for the wrong metric. Output quality dropped.", sev: "warning", phase: 11 },
    { id: "overcharge", name: "Billing Spike", desc: "Compute costs surged from an unoptimised workflow.", sev: "warning", cashCost: 30, phase: 7 },
    { id: "data_leak", name: "Data Mix-up", desc: "Training data from one client leaked into another's output.", sev: "critical", phase: 9 },
  ];

  // ---------- UPGRADES DEFINITIONS ----------
  const UPGRADES = [
    // Early scrappy upgrades (milestone-gated by reqTasks)
    // Likely to have ~$110 at this point
    { id: "post_it_notes", name: "Post-It Notes", desc: "Work on 2 tasks at once with one click.", cost: 43, currency: "cash", phase: 1, effect: { manualQueueSize: 2 }, oneTime: true, reqTasks: 10 },
    { id: "gas_station_coffee", name: "Gas Station Coffee", desc: "Tasks pay 15% more. Caffeine helps.", cost: 51, currency: "cash", phase: 1, effect: { payMult: 1.15 }, oneTime: true, reqTasks: 10 },
    { id: "sticky_note_system", name: "A Box Of Paperclips", desc: "Record who's asking for what.", cost: 34, currency: "cash", phase: 1, effect: { taskDetails: true }, oneTime: true, reqTasks: 10 },
    { id: "side_hustle", name: "Side Hustle Optimization", desc: "Tasks pay 20% more.", cost: 41, currency: "cash", phase: 1, effect: { payMult: 1.2 }, oneTime: true, reqTasks: 30 },
    { id: "inbox_zero", name: "Inbox Zero Method", desc: "Tasks require 15% less work. A clear inbox, a clear mind.", cost: 51, currency: "cash", phase: 1, effect: { workReduction: 0.15 }, oneTime: true, reqTasks: 30 },
    { id: "gtd_workflow", name: "GTD Workflow", desc: "Work on 5 tasks at once with one click.", cost: 61, currency: "cash", phase: 1, effect: { manualQueueSize: 5 }, oneTime: true, reqTasks: 30 },
    { id: "focus_timer", name: "Focus Timer (Pomodoro)", desc: "Tasks require 20% less work.", cost: 79, currency: "cash", phase: 1, effect: { workReduction: 0.2 }, oneTime: true, reqTasks: 50 },

    // Phase 1 -> 2
    { id: "dual_monitors", name: "Dual Monitors", desc: "+25% pay for all tasks.", cost: 80, currency: "cash", phase: 1, effect: { payMult: 1.25 }, oneTime: true, reqTasks: 50 },
    { id: "noise_cancelling", name: "Noise-Cancelling Headphones", desc: "Clearer focus and instructions. All tasks require 10% less work.", cost: 99, currency: "cash", phase: 1, effect: { workReduction: 0.1 }, oneTime: true, reqTasks: 50 },
    { id: "free_ai", name: "Discover Free-Tier AI", desc: "Your first AI works through tasks automatically. Free after 50 completed tasks; top up its tokens to keep it running.", cost: 0, currency: "tasks", phase: 1, unlockPhase: 2, oneTime: true, reqTasks: 50 },

    // Phase 2 -> 3
    { id: "prompt_examples", name: "Few-Shot Prompting", desc: "AI assist does 30% more work per action.", cost: 450, currency: "cash", phase: 2, effect: { aiPowerMult: 1.3 }, oneTime: true, reqTasks: 200 },
    { id: "marketing_campaign", name: "Marketing Campaign", desc: "Your first marketing campaign. Tasks arrive 75% faster.", cost: 650, currency: "cash", phase: 2, effect: { payMult: 1.6, taskSpawnMult: 1.75 }, oneTime: true, reqTasks: 200 },
    { id: "pro_model", name: "Upgrade to AI 2000 Basic", desc: "A larger token allowance for longer sessions.", cost: 2500, currency: "cash", phase: 2, unlockPhase: 3, oneTime: true, reqTasks: 300 },

    // Phase 3 -> 4
    { id: "token_pack_1", name: "Token Pack (200)", desc: "Get 200 tokens.", cost: 110, currency: "cash", phase: 3, effect: { giveTokens: 200 }, oneTime: false },
    { id: "token_optimizer", name: "Token Optimizer", desc: "Smarter caching reduces AI assist token usage by 20%.", cost: 1000, currency: "cash", phase: 3, effect: { tokenEfficiency: 0.8 }, oneTime: true, reqTasks: 350},
    { id: "guardrails", name: "Output Guardrails", desc: "Validation layer catches hallucinations. AI failure rate -30%.", cost: 1200, currency: "cash", phase: 3, effect: { aiFailMult: 0.7 }, oneTime: true, reqTasks: 350 },
    { id: "token_compressor", name: "Prompt Compression", desc: "Prompt compacting reduces AI assist token usage by 25%.", cost: 1500, currency: "cash", phase: 3, effect: { tokenEfficiency: 0.75 }, oneTime: true, reqTasks: 350 },
    { id: "premium_support", name: "Premium Support", desc: "Priority response times. Clients are thrilled.", cost: 800, currency: "cash", phase: 3, effect: { payMult: 1.05 }, oneTime: true, reqTasks: 425 },
    { id: "token_distiller", name: "Model Distillation", desc: "Smaller model handles routine work. AI assist token usage drops by 33%.", cost: 1500, currency: "cash", phase: 3, effect: { tokenEfficiency: 0.67 }, oneTime: true, reqTasks: 425 },
    { id: "batch_processing", name: "Batch Processing", desc: "Queue and process work in batches. 2x click power.", cost: 1200, currency: "cash", phase: 3, effect: { clickPower: 2 }, oneTime: true, reqTasks: 425 },
    { id: "billboard_campaign", name: "Billboard", desc: "A large advert on the side of a nearby building. More demand and higher pay.", cost: 2500, currency: "cash", phase: 3, effect: { payMult: 2.0 }, oneTime: true, reqTasks: 500 },
    { id: "structured_output", name: "Structured Outputs", desc: "JSON mode makes task results 35% more valuable.", cost: 3000, currency: "cash", phase: 3, effect: { payMult: 1.35 }, oneTime: true, reqTasks: 500 },
    { id: "second_ai", name: "Second AI Subscription", desc: "A second AI subscription with its own token allowance.", cost: 18000, currency: "cash", phase: 3, oneTime: true, reqTasks: 650 },
    { id: "multi_bot", name: "Multi-Agent Licence", requires: "second_ai", desc: "More agents, more work.", cost: 25000, currency: "cash", phase: 3, unlockPhase: 4, oneTime: true, reqTasks: 750 },

    // Phase 4 -> 5
    { id: "agent_onboarding", name: "Agent Onboarding Guide", desc: "Better instructions for agents. +15% agent speed.", cost: 1100, currency: "cash", phase: 4, effect: { agentSpeedMult: 1.15 }, oneTime: true },
    { id: "inbound_pipeline", name: "Inbound Pipeline", desc: "Run an early growth push. Tasks arrive 30% faster.", cost: 1800, currency: "cash", phase: 4, effect: { taskSpawnMult: 1.3 }, oneTime: true },
    { id: "task_templates", name: "Task Templates", desc: "Pre-written briefs. Tasks require 15% less work.", cost: 2400, currency: "cash", phase: 4, effect: { workReduction: 0.15 }, oneTime: true },
    { id: "agent_slot_3", name: "Agent Slot Expansion (4)", desc: "Allow up to 4 agents.", cost: 5000, currency: "cash", phase: 4, effect: { agentSlots: 3 }, oneTime: true, requires: "task_templates", reqAgents: 3 },
    { id: "client_crm", name: "Client Tracker", desc: "Keep clients happy. Tasks pay 40% more.", cost: 2500, currency: "cash", phase: 4, effect: { payMult: 1.4 }, oneTime: true },
    { id: "prompt_basics", name: "Prompt Engineering 101", desc: "Reduce AI failure rate by 20%.", cost: 3200, currency: "cash", phase: 4, effect: { aiFailMult: 0.8 }, oneTime: true, reqTasks: 350, reqIncidents: 3 },
    { id: "error_handling", name: "Error Recovery Protocol", desc: "Agents fail less often. -20% AI failure rate.", cost: 4000, currency: "cash", phase: 4, effect: { aiFailMult: 0.8 }, oneTime: true },
    { id: "parallel_prompts", name: "Parallel Prompting", desc: "Run independent steps together. Agents work 15% faster.", cost: 3800, currency: "cash", phase: 4, requires: "agent_slot_3", effect: { agentSpeedMult: 1.15 }, oneTime: true },
    { id: "response_streaming", name: "Response Streaming", desc: "Process results as they arrive. Agents work 20% faster.", cost: 5200, currency: "cash", phase: 4, requires: "parallel_prompts", effect: { agentSpeedMult: 1.2 }, oneTime: true },
    { id: "agent_slot_5", requires: "response_streaming", name: "Agent Slot Expansion (6)", desc: "Allow up to 6 agents.", cost: 6500, currency: "cash", phase: 4, effect: { agentSlots: 5 }, oneTime: true },
    { id: "tool_use", name: "Tool Use SDK", desc: "Agents can use tools.", cost: 12000, currency: "cash", phase: 4, unlockPhase: 5, oneTime: true, reqTasks: 1150 },

    // Phase 5 (operations pressure)
    { id: "web_browse", name: "Web Search Tool", desc: "Agents can browse the web. +15% agent speed, +20% quality on research.", cost: 7500, currency: "cash", phase: 5, effect: { toolBonus: 0.2, agentSpeedMult: 1.15 }, oneTime: true },
    { id: "bulk_jobs", name: "Bulk Processing", desc: "Deliver around 10 tasks in each job.", cost: 9000, currency: "cash", phase: 5, effect: { batchSize: 10 }, oneTime: true },
    { id: "sales_playbook", name: "Sales Playbook", desc: "Sharper discovery and handoff process. Sales increase by 50%.", cost: 12000, currency: "cash", phase: 5, effect: { payMult: 1.5 }, oneTime: true },
    { id: "code_exec", name: "Code Execution Tool", desc: "Agents can run code. +25% speed on code tasks.", cost: 16000, currency: "cash", phase: 5, effect: { codeSpeedMult: 1.25 }, oneTime: true },
    { id: "revenue_ops", name: "Revenue Ops System", desc: "Pipeline discipline and better follow-up. Sales increase by 50%.", cost: 28000, currency: "cash", phase: 5, effect: { payMult: 1.50 }, oneTime: true },
    { id: "manager_agent", name: "Manager Agent", desc: "Add a Manager role to coordinate your agents.", cost: 12000, currency: "cash", phase: 5, unlockPhase: 6, effect: { managerUnlock: true, agentSlots: 6 }, oneTime: true, reqTasks: 5000 },

    // Phase 6 (manager-led automation)
    { id: "scheduling", name: "Auto-Assign Playbooks", desc: "Coordinate batches of around 100 tasks. Assignment is 50% faster.", cost: 15000, currency: "cash", phase: 6, effect: { batchSize: 100, managerAssignMult: 1.5, agentAutoAssign: true }, oneTime: true },
    { id: "smart_routing", name: "Smart Routing", desc: "Manager can route agents across specialties when needed.", cost: 19000, currency: "cash", phase: 6, effect: { smartRouting: true }, oneTime: true },
    { id: "neural_boost", name: "Neural Architecture Boost", desc: "Optimised model weights. All agents work 35% faster.", cost: 25000, currency: "cash", phase: 6, effect: { agentSpeedMult: 1.35 }, oneTime: true, reqTasks: 580 },
    { id: "token_manager_unlock", name: "Token Manager Slot", desc: "Automatically buy tokens when they run out.", cost: 40000, currency: "cash", phase: 6, requiresRole: "manager", unlockPhase: 7, effect: { giveTokens: 300, agentSlots: 7 }, oneTime: true, reqTasks: 30000 },

    // Phase 7 (token-stable autopilot)
    { id: "agent_slot_7", name: "Add Another Agent Slot", desc: "Room for another agent.", cost: 22000, currency: "cash", phase: 8, requiresRole: "token_mgr", effect: { agentSlots: 8 }, oneTime: true, reqTasks: 670 },
    { id: "compute_2", name: "Revenue Optimization Upgrade", desc: "Deliver batches of around 500 tasks. Double revenue.", cost: 150000, currency: "cash", phase: 7, effect: { batchSize: 500, payMult: 2.0 }, oneTime: true, reqTasks: 45000 },
    { id: "devops_unlock", name: "DevOps Agent Slot", desc: "Automate incident response.", cost: 60000, currency: "cash", phase: 7, oneTime: true, reqTasks: 30000 },
    { id: "compute_1", name: "Incident Runbooks", desc: "DevOps resolves incidents 20% faster.", cost: 175000, currency: "cash", phase: 7, effect: { devopsIncidentMult: 1.2 }, oneTime: true, reqTasks: 65000 },
    { id: "delivery_pipeline", name: "Delivery Pipeline", desc: "A smoother handoff. All agents work 25% faster.", cost: 250000, currency: "cash", phase: 7, effect: { agentSpeedMult: 1.25 }, oneTime: true, reqTasks: 90000 },
    { id: "premium_contracts", name: "Premium Client Contracts", desc: "Win better client work. All tasks pay 35% more.", cost: 350000, currency: "cash", phase: 7, effect: { payMult: 1.35 }, oneTime: true, reqTasks: 115000 },
    { id: "ops_flywheel", name: "Operations Flywheel", desc: "Stable operations loops unlock growth.", cost: 1000000, currency: "cash", phase: 7, unlockPhase: 8, effect: { payMult: 1.50 }, oneTime: true, reqTasks: 150000 },

    // Phase 8 (growth marketing)
    { id: "growth_marketing", name: "Growth Marketing Engine", desc: "Serve larger clients with batches of around 2,000 tasks. Double revenue.", cost: 50000, currency: "cash", phase: 8, effect: { batchSize: 2000, payMult: 2.00 }, oneTime: true, reqTasks: 860 },
    { id: "management", name: "Referral Partnerships", desc: "Partner channels bring higher-value client work.", cost: 70000, currency: "cash", phase: 8, effect: { payMult: 1.50 }, oneTime: true, reqTasks: 920 },
    { id: "acquire_micro_agency", name: "Acquire Micro Agency", desc: "Bring your team together as a managed cluster.", cost: 1500000, currency: "cash", phase: 8, unlockPhase: 9, effect: { agentSlots: 10 }, oneTime: true, reqTasks: 1000000 },

    // Phase 9 (clusterization)

    { id: "code_agents", name: "Cluster Operations Blueprint", desc: "Standardise cluster operations. Reduce debt growth by 25% and improve output quality by 10%.", cost: 150000, currency: "cash", phase: 9, effect: { debtReduction: 0.25, codeQualityMult: 1.1 }, oneTime: true, reqTasks: 1020 },
    { id: "cluster_capacity_2", name: "Second Cluster Permit", desc: "Unlock Provision cluster and room for one more cluster.", cost: 250000, currency: "cash", phase: 9, requires: "code_agents", effect: {}, oneTime: true, reqTasks: 1060 },
    { id: "cluster_capacity_3", name: "Third Cluster Permit", desc: "Add room for a third cluster.", cost: 750000, currency: "cash", phase: 9, requires: "cluster_capacity_2", effect: {}, oneTime: true, reqTasks: 1180 },
    { id: "testing", name: "Cluster Runbooks", desc: "Reduce technical debt growth and tighten incident handling.", cost: 350000, currency: "cash", phase: 9, effect: { debtReduction: 0.3, devopsIncidentMult: 1.15 }, oneTime: true, reqTasks: 1120 },
    { id: "code_review", name: "Cross-Cluster QA Mesh", desc: "Improves cluster output quality by 25%.", cost: 500000, currency: "cash", phase: 9, effect: { codeQualityMult: 1.25 }, oneTime: true, reqTasks: 1160 },
    { id: "deploy", name: "Cluster Revenue Platform", desc: "Sign ongoing client contracts for regular income.", cost: 650000, currency: "cash", phase: 9, effect: { serviceSlots: 2, payMult: 1.12 }, oneTime: true, reqTasks: 1200 },
    { id: "ceo_readiness", name: "AI CEO Readiness", desc: "Formalize org controls so an AI CEO can take over.", cost: 4000000, currency: "cash", phase: 9, unlockPhase: 10, effect: {}, oneTime: true, reqTasks: 1200000 },

    // Phase 10 (AI CEO)
    { id: "ai_ceo", name: "AI CEO", desc: "AI CEO takes over cluster coordination and budgets.", cost: 1000000, currency: "cash", phase: 10, effect: { aiCeo: true }, oneTime: true, reqTasks: 1320 },
    { id: "server_1", name: "AI CEO Scale Mode", desc: "AI CEO can now scale cluster output aggressively.", cost: 200000000, currency: "cash", phase: 10, requires: "ai_ceo", effect: { ceoScale: true, agentSpeedMult: 1.5, payMult: 1.3, serviceSlots: 5 }, oneTime: true, reqTasks: 1400 },
    { id: "ceo_recruitment", name: "Provisioning Pipeline", desc: "The CEO adds agents and coordinates twice as often.", cost: 10000000, currency: "cash", phase: 10, requires: "ai_ceo", oneTime: true },
    { id: "ceo_deploy_speed", name: "Faster AI Provisioning", desc: "Provision agents 50% faster.", cost: 40000000, currency: "cash", phase: 10, requires: "server_1", oneTime: true },
    { id: "ceo_batch", name: "Dual Agent Provisioning", desc: "Provision two agents at once.", cost: 75000000, currency: "cash", phase: 10, requires: "server_1", oneTime: true },
    { id: "ceo_quad_batch", name: "Four-Agent Provisioning", desc: "Provision four agents at once.", cost: 100000000, currency: "cash", phase: 10, requires: "ceo_batch", oneTime: true },
    { id: "ceo_parallel_clusters", name: "Parallel Cluster Builds", desc: "Build two clusters at once.", cost: 150000000, currency: "cash", phase: 10, requires: "ceo_quad_batch", oneTime: true },
    { id: "ceo_fast_builds", name: "Preassembled Server Racks", desc: "Halve cluster construction time.", cost: 200000000, currency: "cash", phase: 10, requires: "server_1", oneTime: true },
    { id: "server_2", name: "Autonomous Expansion Desk", desc: "Refine expansion workflows. Task pay increases by 20%.", cost: 2500000, currency: "cash", phase: 10, effect: { payMult: 1.2 }, oneTime: true, reqTasks: 1440 },
    { id: "retire_unlock", name: "Golden Parachute", desc: "Reach 100 managed nodes and prepare your exit.", cost: 2000000000, currency: "cash", phase: 14, reqNodes: 100, unlockPhase: 15, effect: {}, oneTime: true, reqTasks: 1520 },

    { id: "ceo_course", name: "CEO Goes on a Course", desc: "Halve cluster construction time again. The CEO coordinates twice as often.", cost: 100000000, currency: "cash", phase: 10, requires: "server_1", unlockPhase: 11, effect: { payMult: 1.2 }, oneTime: true, reqTasks: 1500000 },
    { id: "ceo_full_fit", name: "Fully Fitted Racks", desc: "Install all 16 agents during construction. Agent costs are included in the cluster price.", cost: 80000000, currency: "cash", phase: 11, requires: "ceo_course", oneTime: true },
    { id: "autonomous_nodes", name: "Autonomous Operating Model", desc: "Compact infrastructure for a larger autonomous company.", cost: 75000000, currency: "cash", phase: 11, reqNodes: 3, unlockPhase: 12, effect: { payMult: 1.2 }, oneTime: true, reqTasks: 2000000 },
    { id: "ceo_continuous", name: "Continuous Deployment", desc: "Complete two fully fitted clusters every two seconds, while funds allow.", cost: 150000000, currency: "cash", phase: 12, requires: "ceo_full_fit", oneTime: true },
    { id: "replication", name: "Node Replication", desc: "Standardize node replication. Reduce cluster costs by 35%.", cost: 50000000, currency: "cash", phase: 12, reqNodes: 20, unlockPhase: 13, effect: { payMult: 1.15 }, oneTime: true },
    { id: "global_network", name: "Global Expansion", desc: "Expand every second, with node costs reduced another 40%.", cost: 250000000, currency: "cash", phase: 13, reqNodes: 40, unlockPhase: 14, effect: { payMult: 1.2 }, oneTime: true },

    // Phase 11 (retirement)
    // Retirement now follows the four new network stages, in Phase 15.
    { id: "fusion", name: "Sell the Company and Retire Early!", desc: "Close the deal, play golf and finally look after your health. Requires 100 managed nodes, debt below 10, no incidents and income above twice expenses.", cost: 5000000000, currency: "cash", phase: 15, effect: {}, oneTime: true, reqTasks: 1560 },

    // Repeatable
    { id: "token_pack_2", name: "Token Pack (500)", desc: "Get 500 tokens.", cost: 300, currency: "cash", phase: 3, effect: { giveTokens: 500 }, oneTime: false },
  ];

  // Expenses tiers
  const EXPENSE_TIERS = [
    { phase: 1, name: "Living in car", rate: 1.0 },
    { phase: 2, name: "Shared coworking desk", rate: 1.5 },
    { phase: 3, name: "Coffee Shop Regular", rate: 2.0 },
    { phase: 4, name: "Home office", rate: 5 },
    { phase: 5, name: "Tooling overhead", rate: 10 },
    { phase: 6, name: "Manager operations", rate: 14 },
    { phase: 7, name: "Token and incident control", rate: 18 },
    { phase: 8, name: "Growth spend + referrals", rate: 28 },
    { phase: 9, name: "Server power & cooling", rate: 45 },
    { phase: 10, name: "AI CEO command stack", rate: 70 },
    { phase: 11, name: "Executive training", rate: 120 },
    { phase: 12, name: "Autonomous network", rate: 180 },
    { phase: 13, name: "Replication platform", rate: 250 },
    { phase: 14, name: "Global network", rate: 400 },
    { phase: 15, name: "Exit prep and legal", rate: 500 },
  ];

  // ---------- MILESTONES ----------
  const MILESTONES = [
    // Task-count based
    { id: "first_task", reqTasks: 3, reveals: ["topBar", "cash"] },
    { id: "backlog_start", reqTasks: 5, reveals: ["taskQueue"], popup: { title: "Incoming...", msg: "More gigs are coming in. Your inbox is filling up." }, spawnOnTrigger: 2 },
    { id: "stress_unlock", reqTasks: 12, reveals: ["stress"], popup: { title: "Pressure Building", msg: "The work keeps coming. You are starting to feel the pressure." } },
    { id: "upgrades_unlock", reqTasks: 15, reveals: ["upgrades", "log"], setFlags: { taskExpiryEnabled: true }, popup: { title: "Tools of the Trade", msg: "Maybe some better tools would help you keep up..." } },
    { id: "expenses_unlock", reqTasks: 90, reveals: ["expenseCard", "expenses"], setFlags: { expensesRevealed: true }, popup: { title: "Reality Check", msg: "Your phone bill is due. Your car needs gas. Living costs money, even in a parking lot. Bills are now draining your cash." } },
    { id: "income_display", reqTasks: 96, reveals: ["income"] },
    { id: "ai_hint", reqTasks: 35, popup: { title: "There Must Be a Better Way", msg: "You are getting faster, but the work never stops. Maybe there is a smarter way..." } },
    // Phase-based
    { id: "tokens_unlock", reqPhase: 3, reveals: ["tokens"] },
    { id: "agents_unlock", reqPhase: 2, reveals: ["agents"], popup: { title: "AI Agent", msg: "Your first AI agent is available. Top it up to keep it running tasks for you." } },
    { id: "dashboard_unlock", reqPhase: 8, reveals: ["dashboard"] },
    { id: "clusters_unlock", reqPhase: 9, reveals: ["clusters"] },
    { id: "debt_unlock", reqPhase: 9, reveals: ["debt"] },
    { id: "prestige_unlock", reqPhase: FINAL_PHASE, reveals: ["prestige"] },
  ];

  // ---------- GAME STATE ----------
  let G = defaultState();

  function defaultState() {
    return {
      saveVersion: SAVE_VERSION,
      retired: false,
      retirementFinal: false,
      retiredAt: 0,
      retirementValue: 0,
      lastCeoAction: 0,
      cash: 0,
      tokens: 0,
      tokenPacksBought: 0,
      tokensConsumed: 0,
      averageTokenBurn: 0,
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
      clustersProvisioned: 0,
      replicationTarget: 20,
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
      batchSize: 1,
      workReduction: 0,
      taskDetails: false,
      musicMode: "layered", // off | on | layered
      uiRevealed: {
        topBar: false,
        cash: false,
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
  let saveBlocked = false;

  function storageMessage(message) {
    $("#save-status").textContent = message;
    $("#save-notice").hidden = !message;
  }

  function validShape(value, template) {
    if (template === null) return value === null || typeof value === "string" || Number.isFinite(value);
    if (typeof template === "number") return Number.isFinite(value) && value >= 0;
    if (typeof template === "string") return typeof value === "string" && !/</.test(value);
    if (typeof template === "boolean") return typeof value === "boolean";
    if (Array.isArray(template)) return Array.isArray(value);
    return value !== null && typeof value === "object" && !Array.isArray(value) &&
      Object.keys(template).every((key) => Object.hasOwn(value, key) && validShape(value[key], template[key]));
  }

  function validSave(state) {
    if (!validShape(state, defaultState()) || state.saveVersion !== SAVE_VERSION) return false;
    if (!Number.isInteger(state.batchSize) || state.batchSize < 1) return false;
    if (state.retirementFinal && !state.retired) return false;
    if (!Number.isInteger(state.phase) || state.phase < 1 || state.phase > FINAL_PHASE) return false;
    if (!["off", "manage", "scale"].includes(state.ceoMode) || !["off", "on", "layered"].includes(state.musicMode)) return false;
    const taskShape = { batchSize: 1, id: "", typeId: "", name: "", icon: "", client: "", workRequired: 1, workDone: 0, pay: 0, tokenCost: 0, failChance: 0, assignedAgent: null, status: "", createdAt: 0 };
    const agentShape = { id: "", name: "", olderModel: false, roleId: "", roleName: "", icon: "", color: "", specialty: [], traitId: "", traitName: "", traitDesc: "", speed: 1, quality: 1, reliability: 1, tokenCost: 1, tokenTank: 0, status: "", autoAssign: true, currentTask: null, tasksCompleted: 0, hired: 0, tokenStarved: false, errorTime: null, provisionRemaining: 0, provisionDuration: 0 };
    const incidentShape = { id: "", templateId: "", name: "", desc: "", sev: "", cashCost: 0, tokenCost: 0, fixProgress: 0, createdAt: 0, resolved: false };
    const clusterShape = { id: "", name: "", invested: 0, buildRemaining: 0, buildDuration: 0, workforce: 0, tank: 0, progress: 0, workerSlotsMax: 8, workerAgentIds: [], managerAssigned: false, tokenManagerAssigned: false, active: true };
    const collections = [[state.tasks, taskShape], [state.agents, agentShape], [state.incidents, incidentShape], [state.clusters, clusterShape], [state.services, { id: "", name: "", incomeRate: 0, active: true }], [state.log, { msg: "", type: "", t: 0 }]];
    if (!collections.every(([items, shape]) => items.every((item) => validShape(item, shape)))) return false;
    const entities = [...state.tasks, ...state.agents, ...state.clusters, ...state.services, ...state.incidents];
    if (!entities.every((item) => /^[a-z0-9_]+$/.test(item.id) && !/["'&]/.test(item.name))) return false;
    if (new Set(entities.map((item) => item.id)).size !== entities.length) return false;
    if (!state.tasks.every((task) => TASK_TYPES.some((type) => type.id === task.typeId) && Number.isInteger(task.batchSize) && task.batchSize > 0 && task.workRequired > 0 && task.workDone <= task.workRequired && ["available", "active", "ai", "agent", "done"].includes(task.status))) return false;
    if (!state.agents.every((agent) => AGENT_ROLES.some((role) => role.id === agent.roleId) && /^#[0-9a-f]{6}$/i.test(agent.color) && agent.speed > 0 && agent.tokenCost > 0 && agent.specialty.every((id) => TASK_TYPES.some((type) => type.id === id)) && ["idle", "working", "error", "provisioning"].includes(agent.status) && (agent.status !== "provisioning" || (agent.provisionRemaining > 0 && agent.provisionRemaining <= agent.provisionDuration)))) return false;
    if (!state.incidents.every((incident) => ["warning", "critical"].includes(incident.sev) && incident.fixProgress <= 100)) return false;
    if (!state.purchasedUpgrades.every((id) => UPGRADES.some((upgrade) => upgrade.id === id)) || !state.milestonesReached.every((id) => MILESTONES.some((milestone) => milestone.id === id))) return false;
    if (!state.log.every((entry) => ["", "good", "bad", "warn", "info"].includes(entry.type))) return false;
    const assigned = state.clusters.flatMap((cluster) => cluster.workerAgentIds);
    if (new Set(assigned).size !== assigned.length) return false;
    if (!state.clusters.every((cluster) => [8, 16].includes(cluster.workerSlotsMax) && Number.isInteger(cluster.workforce) && cluster.workforce <= cluster.workerSlotsMax && cluster.managerAssigned === cluster.tokenManagerAssigned && cluster.workerAgentIds.length <= cluster.workerSlotsMax && cluster.workerAgentIds.every((id) => state.agents.some((agent) => agent.id === id && !UTILITY_ROLES.includes(agent.roleId))))) return false;
    return state.agents.every((agent) => agent.currentTask === null || state.tasks.some((task) => task.id === agent.currentTask && task.assignedAgent === agent.id && task.status === "agent")) &&
      state.tasks.every((task) => task.assignedAgent === null || state.agents.some((agent) => agent.id === task.assignedAgent)) &&
      (state.aiWorkerCurrentTaskId === null || state.tasks.some((task) => task.id === state.aiWorkerCurrentTaskId));
  }

  function save() {
    if (saveBlocked) return false;
    G.lastSave = Date.now();
    try {
      localStorage.setItem("ai_empire_save", JSON.stringify(G));
      storageMessage("");
      return true;
    } catch (error) {
      /* quota exceeded - ignore */
      // Storage failures now stay visible; programming errors still propagate.
      if (!(error instanceof DOMException) || !["QuotaExceededError", "SecurityError"].includes(error.name)) throw error;
      storageMessage("Progress could not be saved. Keep this tab open and allow browser storage, then retry.");
      return false;
    }
  }

  function load() {
    let raw;
    try {
      raw = localStorage.getItem("ai_empire_save");
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "SecurityError") throw error;
      storageMessage("Browser storage is blocked. You can play, but progress cannot be saved.");
      return false;
    }
    if (!raw) return false;
    let state;
    try {
      state = JSON.parse(raw);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      state = null;
    }
    if (!validSave(state)) {
      saveBlocked = true;
      storageMessage("This save is invalid or from an older version. It has been preserved. Reset saved progress to start a new game.");
      return false;
    }
    G = state;
    return true;
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

  function taskBatchSize() {
    return G.batchSize === 1 ? 1 : randInt(Math.ceil(G.batchSize * 0.8), Math.floor(G.batchSize * 1.2));
  }

  function generateTask() {
    const types = availableTaskTypes();
    const type = pick(types);
    const tier = Math.max(1, G.phase - type.phase + 1);
    const mult = 1 + (tier - 1) * 0.5 + G.prestigeCount * 0.1;
    const fatigueTasks = Math.max(0, Math.min(G.totalTasksDone, 1000) - 20);
    const fatigueMult = 1 + fatigueTasks * 0.002; // keep early completion speed through task 20
    return {
      id: uid(),
      typeId: type.id,
      name: type.name,
      icon: type.icon,
      client: pickClient(),
      batchSize: taskBatchSize(),
      workRequired: Math.ceil(type.baseWork * mult * fatigueMult * (1 - G.workReduction)),
      workDone: 0,
      pay: Math.round(type.basePay * mult * 10) / 10,
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
      batchSize: G.batchSize,
      workRequired: Math.max(1, Math.ceil(type.baseWork * EARLY_TASK_WORK_MULT)),
      workDone: 0,
      pay: type.basePay,
      tokenCost: 0,
      failChance: 0,
      assignedAgent: null,
      status: "available",
      createdAt: Date.now(),
    };
  }

  function getMaxTasks() {
    if (G.phase >= 9) return Math.max(MAX_TASKS, managedNodeCount() * 12);
    if (G.totalTasksDone < 10) return 3;
    if (G.totalTasksDone < 20) return 5;
    if (G.totalTasksDone < 50) return 6;
    if (G.totalTasksDone < 100) return 8;
    return MAX_TASKS;
  }

  function getSpawnInterval() {
    var base;
    {
      if (!G.uiRevealed.taskQueue) return Infinity; // No auto-spawn before task queue
      if (G.totalTasksDone < 10) base = 2000;
      else if (G.totalTasksDone < 15) base = 1600;
      else if (G.totalTasksDone < 20) base = 1100;
      else if (G.totalTasksDone < 50) base = 1000;
      else if (G.totalTasksDone < 200) base = 500;
      else base = Math.max(300, TASK_SPAWN_BASE - G.phase * 550 - G.totalTasksDone * 5);
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
  function getManualQueueSize() {
    if (G.phase >= 4) return 1;
    return UPGRADES.reduce((size, upgrade) => G.purchasedUpgrades.includes(upgrade.id) && upgrade.effect && upgrade.effect.manualQueueSize ? Math.max(size, upgrade.effect.manualQueueSize) : size, 1);
  }

  function clickTask(taskId, evt) {
    const task = G.tasks.find((t) => t.id === taskId);
    if (!task || task.status !== "available") return;
    if (G.phase < 4 && G.tasks.some((t) => t.status === "active")) return;

    task.status = "active";
    G.activeTaskId = taskId;
    const queued = G.tasks.filter((t) => t.status === "available").slice(0, getManualQueueSize() - 1);
    for (const next of queued) next.status = "active";
    G.totalClicks++;
    showClickReward(G.clickPower, evt);
  }

  function tickManualWork(dtSec) {
    var activeTasks = G.tasks.filter(function (t) { return t.status === "active"; });
    if (activeTasks.length === 0) return;

    var workPerSec = G.clickPower / MANUAL_WORK_SECONDS_PER_CLICK;
    for (var i = 0; i < activeTasks.length; i++) {
      var task = activeTasks[i];
      var work = Math.min(task.workRequired - task.workDone, workPerSec * dtSec);
      task.workDone += work;
      if (task.workDone >= task.workRequired) {
        completeTask(task, "manual");
      }
    }
    if (!G.activeTaskId) G.activeTaskId = (G.tasks.find((t) => t.status === "active") || {}).id || null;
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
    if (!G.incidentsExplained) { triggerTutorialIncident(); return; }
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
      desc: tmpl.desc + (task ? " (AI agent on \"" + task.name + "\")" : ""),
      sev: tmpl.sev,
      cashCost: Math.ceil((tmpl.cashCost || 20) * economyScale() + Math.sqrt(G.totalCashEarned) * 0.2),
      tokenCost: tmpl.tokenCost || 0,
      fixProgress: 0,
      createdAt: Date.now(),
      resolved: false,
    };
    G.incidents.push(incident);
    G.totalIncidents++;
    if (incident.cashCost > 0) G.cash = Math.max(0, G.cash - incident.cashCost / 2);
    if (!G.uiRevealed.incidents) G.uiRevealed.incidents = true;
    log("INCIDENT: " + incident.name + "!", "bad");
  }


  function workerTokenCapacity(agent) {
    if (agent && agent.olderModel) return 40;
    if (agent && agent.name === "AI 2000 Pro" && G.phase < 4) return 100;
    return G.phase >= 6 ? 1500 : G.phase === 5 ? 500 : G.phase === 4 ? 200 : G.phase === 3 ? 40 : 10;
  }

  function workerTokenRate() {
    return G.phase >= 6 ? 150 : G.phase === 5 ? 60 : G.phase === 4 ? 15 : G.phase === 3 ? 4 : 1.2;
  }

  function workerTokenCost(agent) {
    return G.phase >= 4 && agent.name === "AI 2000 Pro" ? 1 : agent.tokenCost;
  }

  function topUpAiWorker() {
    if (G.phase < 2 || G.aiWorkerShutdown) return;
    const amount = Math.min(workerTokenCapacity() - G.aiWorkerTokenTank, G.phase < 3 ? workerTokenCapacity() : G.tokens);
    if (amount <= 0) return;
    if (G.phase >= 3) G.tokens -= amount;
    G.aiWorkerTokenTank += amount;
    save();
  }

  function shutdownAiWorker() {
    if (G.phase < 4) {
      log("This AI agent cannot be sold yet.", "bad");
      return;
    }
    if (G.aiWorkerShutdown) return;
    for (var ti = 0; ti < G.tasks.length; ti++) {
      if (G.tasks[ti].status === "ai") G.tasks[ti].status = "available";
    }
    G.aiWorkerCurrentTaskId = null;
    G.aiWorkerTokenTank = 0;
    G.aiWorkerShutdown = true;
    log("AI agent sold. Slot available.", "warn");
    save();
  }


  function topUpAgent(agentId) {
    if (G.phase >= 9) return;
    const agent = G.agents.find((item) => item.id === agentId);
    if (!agent || UTILITY_ROLES.includes(agent.roleId)) return;
    const amount = Math.min(G.tokens, Math.max(0, workerTokenCapacity(agent) - agent.tokenTank));
    G.tokens -= amount;
    agent.tokenTank += amount;
    const task = findMatchingTask(agent) || pickNextAiTask();
    if (task && agent.status === "idle" && agent.tokenTank > 0) assignAgentToTask(task.id, agent.id);
    agent.tokenStarved = agent.tokenTank <= 0;
  }

  function topUpManager() {
    if (G.phase < 6 || !hasIdleManager()) return;
    const amount = Math.min(G.tokens, MANAGER_TOKEN_TANK_MAX - G.managerTokenTank);
    G.tokens -= amount;
    G.managerTokenTank += amount;
    if (amount > 0) log("Manager topped up (+" + fmtTokens(amount) + ").", "info");
  }

  function toggleAiAutopilot() {
    log("AI autopilot was replaced by Top-up controls in the Agents pane.", "warn");
  }

  function originalAiWorkRate() {
    return G.clickPower / MANUAL_WORK_SECONDS_PER_CLICK * (G.phase >= 3 ? AI_WORK_MULT_PHASE3 : AI_WORK_MULT_PHASE2) * G.aiPowerMult;
  }

  function tickAiWorker(dtSec) {
    if (G.phase < 2 || G.aiWorkerShutdown) {
      G.aiWorkerCurrentTaskId = null;
      for (var pi = 0; pi < G.tasks.length; pi++) {
        if (G.tasks[pi].status === "ai") G.tasks[pi].status = "available";
      }
      return;
    }
    G.aiWorkerTokenTank = clamp(G.aiWorkerTokenTank, 0, workerTokenCapacity());
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
    var drain = workerTokenRate() * G.tokenEfficiency * dtSec;
    if (G.aiWorkerTokenTank < drain) {
      effectiveDt = drain > 0 ? dtSec * (G.aiWorkerTokenTank / drain) : 0;
      G.aiWorkerTokenTank = 0;
    } else {
      G.aiWorkerTokenTank -= drain;
    }

    if (effectiveDt <= 0) return;

    G.tokensConsumed += workerTokenRate() * G.tokenEfficiency * effectiveDt;
    G.aiRunSeconds += effectiveDt;
    if (!G.incidentsExplained && G.aiRunSeconds >= AI_TUTORIAL_SECONDS) {
      triggerTutorialIncident();
      return;
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

    task.workDone = Math.min(task.workRequired, task.workDone + originalAiWorkRate() * effectiveDt);

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
    if (G.incidentsExplained) return;
    G.incidentsExplained = true;
    const incident = {
      id: uid(),
      templateId: "hallucination",
      name: "Hallucinated Output Published",
      desc: "Your AI produced confident nonsense and sent it to a client.",
      sev: "warning",
      cashCost: 0,
      tokenCost: 0,
      fixProgress: 0,
      createdAt: Date.now(),
      resolved: false,
    };
    G.incidents.push(incident);
    G.totalIncidents++;
    G.uiRevealed.incidents = true;
    log("INCIDENT: Hallucinated Output Published!", "bad");
    showPopup("Your First Incident", "Incidents are operational failures caused by automation. Incidents disrupt work and cost money. Fix manually (costs stress) or pay to resolve. This is a mild one. They get worse as you scale.");
  }

  function findMatchingTask(agent) {
    var avail = G.tasks.filter(function (t) { return t.status === "available"; });
    return avail.find(function (t) { return agent.specialty.includes(t.typeId); }) || null;
  }

  function workerAvailable(agent) {
    return !UTILITY_ROLES.includes(agent.roleId) && (G.phase < 9 || !!getAgentCluster(agent.id));
  }

  function clusterControl(agent, role) {
    if (G.phase < 9) return true;
    const cluster = getAgentCluster(agent.id);
    return !!cluster && cluster.active && cluster[role];
  }

  function managerControls(agent) {
    return hasIdleManager() && clusterControl(agent, "managerAssigned");
  }

  function workerQuality(task, agent) {
    return agent.quality * G.codeQualityMult * (["research", "report"].includes(task.typeId) ? 1 + G.toolBonus : 1);
  }

  function workerSpeed(task, agent) {
    const specialty = agent.specialty.includes(task.typeId) ? 1.4 : 1;
    const code = ["code", "integration", "webapp", "saas"].includes(task.typeId) ? G.codeSpeedMult : 1;
    const scale = G.phase >= 9 ? 1 + Math.min(2, Math.max(0, managedNodeCount() - 1)) * 0.5 : 1;
    return agent.speed * (agent.olderModel ? 0.25 : 1) * AGENT_WORK_MULT * G.agentSpeedMult * specialty * code * scale;
  }

  function hasIdleManager() {
    if (G.phase >= 9) return G.clusters.some((cluster) => cluster.managerAssigned);
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
    if (G.phase >= 9) return;
    var agent = G.agents.find(function (a) { return a.id === agentId; });
    if (!agent) return;
    if (agent.roleId === "manager" || agent.roleId === "token_mgr" || agent.roleId === "devops") return;
    agent.autoAssign = !agent.autoAssign;
    log(agent.name + (agent.autoAssign ? " set to Auto Assign." : " set to Manual Assign."), "info");
  }

  function assignAgentToTask(taskId, agentId) {
    const task = G.tasks.find((t) => t.id === taskId);
    const agent = G.agents.find((a) => a.id === agentId);
    if (!task || task.status !== "available" || !agent || agent.status !== "idle" || !workerAvailable(agent)) return;
    if (UTILITY_ROLES.indexOf(agent.roleId) === -1 && G.phase >= 2 && (agent.tokenTank || 0) <= 0) return;
    task.status = "agent";
    task.assignedAgent = agentId;
    agent.status = "working";
    agent.currentTask = taskId;
    log("Assigned " + agent.name + " to \"" + task.name + "\".", "info");
  }

  function getTaskCashPayout(task, method, agent) {
    var taskMult = 1;
    if (method === "agent" && agent) taskMult = workerQuality(task, agent);
    return task.pay * taskMult * G.payMult;
  }

  function completeTask(task, method) {
    if (task.status === "done") return;
    if (task.assignedAgent) method = "agent";
    if (G.activeTaskId === task.id) G.activeTaskId = null;
    task.status = "done";
    task.workDone = task.workRequired;

    let agent = null;

    if (method === "agent") {
      agent = G.agents.find((a) => a.id === task.assignedAgent);
      if (agent) {
        agent.status = "idle";
        agent.tokenStarved = false;
        agent.currentTask = null;
        agent.tasksCompleted = (agent.tasksCompleted || 0) + task.batchSize;
      }
    }

    task.assignedAgent = null;
    if (G.aiWorkerCurrentTaskId === task.id) G.aiWorkerCurrentTaskId = null;
    const pay = getTaskCashPayout(task, method, agent);
    G.cash += pay;
    G.totalCashEarned += pay;
    G.totalTasksDone += task.batchSize;
    if (G.phase >= 9) {
      const metrics = deliveryMetrics();
      metrics.recent.unshift(task.name);
      metrics.recent.length = Math.min(3, metrics.recent.length);
    }
    syncMusicPlayback();

    if (G.stress > 0) G.stress = clamp(G.stress - 2, 0, 100);

    log("Completed \"" + task.name + "\" -> +" + fmtCash(pay), "good");

    // Check milestones immediately on task completion
    checkMilestones();

    // Remove from task list after a short delay

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
      olderModel: false,
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
      autoAssign: true,
      currentTask: null,
      tasksCompleted: 0,
      hired: Date.now(),
      tokenStarved: false,
      errorTime: null,
      provisionRemaining: 0,
      provisionDuration: 0,
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
    return sharedAgentCount() + aiWorkerUsed;
  }

  function sharedAgentCount() {
    return G.agents.filter((agent) => agent.roleId !== "devops").length;
  }

  function getHireAgentCapacity() {
    if (G.phase < 4) return 0;
    if (G.phase >= 9) return G.clusters.reduce((total, cluster) => total + cluster.workerSlotsMax, 0);
    return G.aiWorkerShutdown ? G.agentSlots + 1 : G.agentSlots;
  }

  function reservedHireRoles() {
    return ["manager", "token_mgr"].filter((role) => (role === "manager" ? G.managerUnlock : G.purchasedUpgrades.includes("token_manager_unlock")) && !G.agents.some((agent) => agent.roleId === role));
  }

  function hireAgent(roleId) {
    if (G.phase >= 9) return;
    const role = AGENT_ROLES.find((candidate) => candidate.id === roleId);
    if (!role || G.phase < 4 || (roleId === "manager" && !G.managerUnlock) ||
        (roleId === "token_mgr" && !G.purchasedUpgrades.includes("token_manager_unlock")) ||
        (roleId === "devops" && !G.purchasedUpgrades.includes("devops_unlock")) || (roleId === "sales" && G.phase < 8)) return;
    // Utility roles are always singletons; worker roles allow duplicates in Phase 9+
    var isUtility = UTILITY_ROLES.indexOf(roleId) >= 0;
    if (isUtility) {
      if (G.agents.some(function (a) { return a.roleId === roleId; })) {
        log("Already have that agent type!", "bad");
        return;
      }
    }
    const reserved = reservedHireRoles();
    if (roleId !== "devops" && !reserved.includes(roleId) && sharedAgentCount() >= getHireAgentCapacity() - reserved.length) return;
    const activeAgents = G.agents.length;
    if (roleId !== "devops" && sharedAgentCount() >= getHireAgentCapacity()) {
      log("No agent slots available!", "bad");
      return;
    }
    const cost = getAgentHireCost(activeAgents, roleId);
    if (G.cash < cost) {
      log("Not enough cash to buy an agent (need " + fmtCash(cost) + ").", "bad");
      return;
    }
    G.cash -= cost;
    const agent = createAgent(roleId);
    G.agents.push(agent);
    log("Bought " + agent.name + " (" + agent.roleName + ", " + agent.traitName + ")!", "info");

    // Burst-assign idle workers when manager is first hired
    if (roleId === "manager") {
      topUpManager();
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
        if (!bt || !clusterControl(ba, "managerAssigned")) continue;
        const amount = Math.min(G.managerTokenTank, 75, workerTokenCapacity(ba) - ba.tokenTank);
        ba.tokenTank += amount;
        G.managerTokenTank -= amount;
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
    if (G.phase < 4 || G.phase >= 9) return;
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
    // Sell for 30% of next hire cost
    const refund = Math.floor(getAgentHireCost(G.agents.length - 1) * 0.3);
    G.cash += refund;
    G.agents.splice(idx, 1);
    if (agent.roleId === "manager") {
      G.managerTokenTank = 0;
    }
    log("Sold " + agent.name + ". Recovered " + fmtCash(refund) + ".", "warn");
  }

  // ---------- AGENT TICK ----------
  function tickAgents(dtSec) {
    for (const agent of G.agents) {
      if (UTILITY_ROLES.indexOf(agent.roleId) >= 0) continue;

      if (!workerAvailable(agent)) continue;
      if (agent.status === "idle" && agent.autoAssign && !managerControls(agent) && (agent.tokenTank || 0) > 0) {
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
      var tokenDrain = workerTokenRate() * workerTokenCost(agent) * G.tokenEfficiency * dtSec;
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
      G.tokensConsumed += workerTokenRate() * workerTokenCost(agent) * G.tokenEfficiency * effectiveDt;

      // Work done per second
      let workRate = workerSpeed(task, agent) * effectiveDt;
      if (agent.traitId === "chaotic") workRate *= rand(0.8, 1.2);


      // Reliability check
      const failRoll = Math.random();
      const failPerSecond = clamp((1 - agent.reliability * 0.8) * 0.2 * G.aiFailMult * (1 + G.techDebt * 0.01), 0, 0.95);
      const failThreshold = 1 - Math.pow(1 - failPerSecond, effectiveDt);
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
    if (G.phase >= 9) { tickClusterManagers(); return; }
    if (!hasIdleManager()) return;
    var now = Date.now();
    if (now - G.lastManagerAssignAt < 100) return;
    G.lastManagerAssignAt = now;


    if (!G.aiWorkerShutdown && G.aiWorkerTokenTank <= workerTokenCapacity() * 0.25) {
      const amount = Math.min(G.managerTokenTank, 25, workerTokenCapacity() - G.aiWorkerTokenTank);
      G.aiWorkerTokenTank += amount;
      G.managerTokenTank -= amount;
    }
    var assignmentBudget = getManagerAssignmentBudget();
    if (G.phase >= 6) {
      for (var ri = 0; ri < G.agents.length; ri++) {
        if (G.managerTokenTank <= 0) break;
        var refillAgent = G.agents[ri];
        if (UTILITY_ROLES.indexOf(refillAgent.roleId) >= 0) continue;
        if (!managerControls(refillAgent) || refillAgent.tokenTank >= workerTokenCapacity(refillAgent)) continue;
        const amount = Math.min(G.managerTokenTank, 25, workerTokenCapacity(refillAgent) - refillAgent.tokenTank);
        refillAgent.tokenTank += amount;
        refillAgent.tokenStarved = false;
        G.managerTokenTank -= amount;
      }
    }

    for (var i = 0; i < G.agents.length; i++) {
      if (assignmentBudget <= 0) break;
      var agent = G.agents[i];
      if (agent.roleId === "manager" || agent.roleId === "token_mgr" || agent.roleId === "devops") continue;
      if (agent.status !== "idle" || !managerControls(agent)) continue;
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
    if (hasIdleManager() && G.phase < 9) return;
    var now = Date.now();
    if (now - G.lastAgentAutoAssignAt < 1600) return;
    G.lastAgentAutoAssignAt = now;

    var assigned = 0;
    for (var i = 0; i < G.agents.length; i++) {
      var agent = G.agents[i];
      if (agent.status !== "idle") continue;
      if (agent.roleId === "manager" || agent.roleId === "token_mgr" || agent.roleId === "devops") continue;
      if (!agent.autoAssign || managerControls(agent)) continue;
      var task = findMatchingTask(agent);
      if (!task) continue;
      assignAgentToTask(task.id, agent.id);
      assigned++;
      if (assigned >= 1) break;
    }
  }

  // ---------- TOKEN MANAGER AUTO-BUY ----------
    // Buy bulk pack if affordable, otherwise starter pack
  // ---------- INCIDENTS ----------
  function tokenPackAmount(upgrade) {
    const multiplier = G.phase >= 6 ? 100 : G.phase === 5 ? 20 : G.phase === 4 ? 5 : 1;
    return upgrade.effect.giveTokens * multiplier;
  }

  function economyScale() {
    return 1 + Math.log10(1 + G.totalCashEarned / 10000);
  }

  function tokenBurnRate() {
    if (G.phase >= 12) return G.clusters.reduce((total, cluster) => total + (cluster.managerAssigned && cluster.tank > 0 ? cluster.workforce : 0), 0) * workerTokenRate() * G.tokenEfficiency;
    return (G.agents.reduce((total, agent) => total + (agent.status === "working" && agent.tokenTank > 0 ? workerTokenCost(agent) : 0), 0) + (G.aiWorkerCurrentTaskId && G.aiWorkerTokenTank > 0 ? 1 : 0)) * workerTokenRate() * G.tokenEfficiency;
  }

  function buyTokenPacks(pack, count) {
    let amount = 0;
    let cost = 0;
    for (let index = 0; index < count; index++) {
      const price = getUpgradeCost(pack);
      if (G.cash < price) break;
      G.cash -= price;
      cost += price;
      amount += tokenPackAmount(pack);
      G.tokenPacksBought++;
    }
    G.tokens += amount;
    if (amount > 0) {
      const message = "Purchased " + fmtTokens(amount) + " tokens for " + fmtCash(cost) + ".";
      log(message, "info");
      if (G.phase >= 9) deliveryMetrics().purchase = message;
    }
  }

  function tickTokenManager() {
    const online = G.phase >= 10 || (G.phase >= 9 ? G.clusters.some((cluster) => cluster.managerAssigned) : G.agents.some((agent) => agent.roleId === "token_mgr" && agent.status === "idle"));
    if (!online) return;
    const demand = G.phase >= 9 ? G.clusters.reduce((total, cluster) => total + (cluster.managerAssigned ? (G.phase >= 12 ? cluster.workforce : cluster.workerAgentIds.length) : 0), 0) * workerTokenRate() * G.tokenEfficiency : tokenBurnRate();
    const transfers = G.phase >= 9 ? G.clusters.filter((cluster) => cluster.managerAssigned).reduce((total, cluster) => total + MANAGER_TOKEN_TANK_MAX - cluster.tank, 0) : MANAGER_TOKEN_TANK_MAX + G.agents.reduce((total, agent) => total + workerTokenCapacity(agent), 0);
    const reserveTarget = MANAGER_TOPUP_COST_TOKEN + Math.max(demand * 5, transfers);
    if (G.tokens < reserveTarget) {
      // Buy bulk pack if affordable, otherwise starter pack
      const pack = ["token_pack_2", "token_pack_1"].map((id) => UPGRADES.find((upgrade) => upgrade.id === id)).find((upgrade) => G.cash >= getUpgradeCost(upgrade));
      if (pack) buyTokenPacks(pack, Math.max(1, Math.ceil(reserveTarget * 2 / tokenPackAmount(pack))));
      G.lastTokenBuy = Date.now();
    }
    if (G.phase < 9 && G.managerTokenTank < MANAGER_TOKEN_TANK_MAX * 0.25) topUpManager();
    for (const cluster of G.clusters) {
      if (!cluster.managerAssigned || cluster.tank >= MANAGER_TOKEN_TANK_MAX * (G.phase >= 10 ? 1 : 0.25)) continue;
      const amount = Math.min(G.tokens, MANAGER_TOKEN_TANK_MAX - cluster.tank, G.phase >= 10 ? 250 : MANAGER_TOKEN_TANK_MAX);
      G.tokens -= amount;
      cluster.tank += amount;
    }
    if (!hasIdleManager()) {
      for (const agent of G.agents) {
        if (workerAvailable(agent) && agent.tokenTank < workerTokenCapacity(agent) * 0.25) topUpAgent(agent.id);
      }
      if (!G.aiWorkerShutdown && G.aiWorkerTokenTank < workerTokenCapacity() * 0.25) topUpAiWorker();
    }
  }

  function maybeCreateIncident(agent) {
    const templates = INCIDENT_TEMPLATES.filter((t) => t.phase <= G.phase);
    if (templates.length === 0) return;
    if (Math.random() > 0.4) return; // 40% chance an agent error creates an incident
    if (!G.incidentsExplained) { triggerTutorialIncident(); return; }
    const tmpl = pick(templates);
    const incident = {
      id: uid(),
      templateId: tmpl.id,
      name: tmpl.name,
      desc: tmpl.desc + (agent ? " (" + agent.name + ")" : ""),
      sev: tmpl.sev,
      cashCost: Math.ceil((tmpl.cashCost || 20) * economyScale() + Math.sqrt(G.totalCashEarned) * 0.2),
      tokenCost: tmpl.tokenCost || 0,
      fixProgress: 0,
      createdAt: Date.now(),
      resolved: false,
    };
    G.incidents.push(incident);
    G.totalIncidents++;

    // Immediate partial penalty
    if (incident.cashCost > 0) G.cash = Math.max(0, G.cash - incident.cashCost / 2);

    // Reveal incidents UI if not yet shown
    if (!G.uiRevealed.incidents) G.uiRevealed.incidents = true;

    log("INCIDENT: " + incident.name + "!", "bad");
  }

  function resolveIncident(incidentId, method) {
    const inc = G.incidents.find((i) => i.id === incidentId);
    if (!inc || inc.resolved || !["manual", "cash"].includes(method)) return;

    if (method === "manual") {
      // Takes time/stress but free
      G.stress = clamp(G.stress + 10 * (1 - inc.fixProgress / 100), 0, 100);
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
    // Unresolved incidents drain reputation over time
    // Reputation has been removed; incidents retain their cash costs and downtime.
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
    const responders = G.phase >= 9 ? G.clusters.filter((cluster) => cluster.managerAssigned) : G.agents.filter((a) => a.roleId === "devops" && a.status === "idle");
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
      var rate = inc.sev === "critical" ? 0.5 : 1;
      var remaining = Math.max(0, 100 - inc.fixProgress);
      var spend = Math.min(remaining, workBudget * rate);
      inc.fixProgress += spend;
      workBudget -= spend / rate;
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
    // Service costs
    rate += G.services.length * 2;
    rate += G.clusters.length * (G.ceoMode === "off" ? 12 : 4);
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
    const devops = G.clusters.filter((cluster) => cluster.managerAssigned).length;
    G.techDebt = Math.max(0, G.techDebt + growth - devops * dtSec * 0.5);
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
    return upg.id.startsWith("token_pack_") ? Math.ceil(upg.cost * tokenPackAmount(upg) / upg.effect.giveTokens * (1 + G.tokenPacksBought * 0.02)) : upg.cost;
  }

  function getAgentHireCost(agentCount, roleId) {
    if (roleId === "manager") return 20000;
    var baseCost = AGENT_BASE_HIRE_COST * Math.pow(AGENT_HIRE_COST_MULT, Math.min(agentCount, 6)) * (1 + Math.max(0, agentCount - 6) * 0.15);
    return Math.ceil(baseCost * getLateCostMultiplier());
  }

  function getAgentRevenueRate() {
    if (G.phase < 4) return 0;
    var activeWorkers = G.agents.filter(function (agent) {
      return workerAvailable(agent) && agent.status === "working" && agent.tokenTank > 0;
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
    // Passive growth income (Phase 4+)
    let rate = networkIncomeRate() + getAgentRevenueRate() + getMarketingRevenueRate();
    const originalTask = getCurrentAiWorkerTask();
    if (originalTask && G.aiWorkerTokenTank > 0) rate += getTaskCashPayout(originalTask, "ai_assist", null) * originalAiWorkRate() / originalTask.workRequired;
    // From working agents
    for (const agent of G.agents) {
      const task = G.tasks.find((item) => item.id === agent.currentTask);
      if (agent.status === "working" && agent.tokenTank > 0 && task && workerAvailable(agent)) {
        rate += getTaskCashPayout(task, "agent", agent) * (workerSpeed(task, agent) / task.workRequired);
      }
    }
    // From services
    const uptime = Math.max(0.5, 1 - G.techDebt * 0.005 - G.incidents.filter((incident) => !incident.resolved).length * 0.05);
    for (const service of G.services) {
      if (service.active) rate += service.incomeRate * uptime;
    }
    return rate;
  }

  // ---------- UPGRADE PURCHASE ----------
  function clusterOnline(cluster) {
    return cluster.buildRemaining === 0 && cluster.managerAssigned && (G.phase >= 12 ? cluster.workforce === cluster.workerSlotsMax : cluster.workerAgentIds.length === cluster.workerSlotsMax && cluster.workerAgentIds.every((id) => G.agents.find((agent) => agent.id === id).status !== "provisioning"));
  }

  function clustersFull() {
    return G.clusters.length > 0 && G.clusters.every(clusterOnline);
  }

  function completedClusterCount() {
    return G.clusters.filter(clusterOnline).length;
  }

  function hasUnfinishedAgentInstallations() {
    return G.agents.some((agent) => agent.status === "provisioning" && !G.clusters.some((cluster) => cluster.buildRemaining > 0 && cluster.workerAgentIds.includes(agent.id)));
  }

  function upgradeVisible(upgrade) {
    if (upgrade.phase > G.phase || (upgrade.oneTime && G.purchasedUpgrades.includes(upgrade.id))) return false;
    if (upgrade.id === "free_ai") return true;
    if (upgrade.reqTasks && G.totalTasksDone < upgrade.reqTasks && !(G.phase === 7 && upgrade.phase === 7)) return false;
    if (upgrade.reqIncidents && G.totalIncidents < upgrade.reqIncidents) return false;
    if (upgrade.reqAgents && G.agents.filter((agent) => !UTILITY_ROLES.includes(agent.roleId)).length < upgrade.reqAgents) return false;
    if (upgrade.requires && !G.purchasedUpgrades.includes(upgrade.requires)) return false;
    if (upgrade.requiresRole && !G.agents.some((agent) => agent.roleId === upgrade.requiresRole)) return false;
    if (!upgrade.oneTime) return true;
    const prior = UPGRADES.filter((item) => item.oneTime && (item.phase < upgrade.phase || (item.phase === upgrade.phase && UPGRADES.indexOf(item) < UPGRADES.indexOf(upgrade))));
    if (prior.some((item) => ["agent_slot_3", "agent_slot_5"].includes(item.id) && !G.purchasedUpgrades.includes(item.id))) return false;
    if (upgrade.unlockPhase || upgrade.id === "second_ai") {
      if (prior.some((item) => !G.purchasedUpgrades.includes(item.id))) return false;
    } else {
      const waiting = prior.filter((item) => item.phase === upgrade.phase && !G.purchasedUpgrades.includes(item.id));
      if (waiting.length >= 3) return false;
    }
    if (upgrade.id === "server_1" && (G.clusters.length < 5 || !clustersFull())) return false;
    if (upgrade.id === "replication") return G.clusters.length >= 20;
    if (G.phase === 9 && !clustersFull()) return false;
    if (upgrade.id === "cluster_capacity_3" && G.clusters.length < 2) return false;
    if (upgrade.id === "ceo_readiness" && G.clusters.length < 3) return false;
    return true;
  }

  function purchaseUpgrade(upgradeId) {
    const upg = UPGRADES.find((u) => u.id === upgradeId);
    if (!upg || G.retired || !upgradeVisible(upg)) return;
    if (upg.id.startsWith("token_pack_")) { buyTokenPacks(upg, 1); return; }
    if (upgradeId === "fusion" && !canSellCompany()) return;
    if (upgradeId === "autonomous_nodes" && hasUnfinishedAgentInstallations()) return;
    if (upg.oneTime && G.purchasedUpgrades.includes(upgradeId)) return;
    if (upg.phase > G.phase) return;
    if (G.phase >= 9 && upg.effect && upg.effect.agentSlots && !upg.unlockPhase) return;
    if (upg.requires && !G.purchasedUpgrades.includes(upg.requires)) return;
    if (upg.requiresRole && !G.agents.some((agent) => agent.roleId === upg.requiresRole)) return;

    if (upg.reqTasks && G.totalTasksDone < upg.reqTasks) return;
    if (completedClusterCount() < nodeRequirement(upg)) return;


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
      if (upg.effect.giveTokens) { const amount = upg.id.startsWith("token_pack_") ? tokenPackAmount(upg) : upg.effect.giveTokens; G.tokens += amount; log(upg.name + ": +" + amount + " tokens.", "info"); }
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
      if (upg.effect.aiCeo) {
        G.ceoMode = "manage";
        deliveryMetrics().showTasks = false;
        for (const cluster of G.clusters) cluster.workerSlotsMax = 16;
      }
      if (upg.effect.ceoScale) G.ceoMode = "scale";
      if (upg.effect.serviceSlots) G.serviceSlots = Math.max(G.serviceSlots, upg.effect.serviceSlots);
      if (upg.effect.reduceDebt) G.techDebt = Math.max(0, G.techDebt - upg.effect.reduceDebt);
      // New effects for early upgrades
      if (upg.effect.batchSize) G.batchSize = upg.effect.batchSize;
      if (upg.effect.payMult) G.payMult *= upg.effect.payMult;
      if (upg.effect.workReduction) G.workReduction = Math.min(0.5, G.workReduction + upg.effect.workReduction);
      if (upg.effect.taskDetails) G.taskDetails = true;
      if (upg.effect.tokenEfficiency) G.tokenEfficiency *= upg.effect.tokenEfficiency;
      if (upg.effect.taskSpawnMult) G.taskSpawnMult *= upg.effect.taskSpawnMult;
    }

    if (upg.effect && upg.effect.serviceSlots) {
      while (G.services.length < G.serviceSlots) {
        G.services.push({ id: uid(), name: "Revenue Service " + (G.services.length + 1), incomeRate: 80, active: true });
      }
    }

    if (upgradeId === "second_ai") {
      const second = createAgent("researcher");
      second.name = "AI 2000 Pro";
      second.icon = "🤖";
      second.tokenCost = 3;
      G.agents.push(second);
    }
    if (upgradeId === "multi_bot") convertSubscriptions();

    // Phase unlock
    if (upg.unlockPhase && upg.unlockPhase > G.phase) {
      G.phase = upg.unlockPhase;
      syncMusicPlayback();
      log("PHASE " + G.phase + " UNLOCKED!", "info");

      // Phase 3: grant starter tokens
      const starter_tokens = 50;
      if (G.phase === 3) { G.tokens += starter_tokens; log("Basic subscription starter grant: +50 tokens.", "info"); }

      // Build phase upgrade popup copy and show only on major beats
      var newTier = null;
      for (var ti = 0; ti < EXPENSE_TIERS.length; ti++) {
        if (G.phase >= EXPENSE_TIERS[ti].phase) newTier = EXPENSE_TIERS[ti];
      }
      var title = upg.name;
      var msg = upg.desc;
      if (G.phase === 3) msg += "\n\nYou start with " + starter_tokens + " tokens. AI Assist and agents will burn tokens over time. Buy token packs from the upgrade shop to keep up, or you will stall out.";

      if (G.phase === 6) msg += "\n\nManager mode is live. Buy a Manager to auto-assign idle agents immediately.";
      if (newTier && G.expensesRevealed) msg += "\n\nLifestyle upgraded to: " + newTier.name + ". Expenses are now " + "$" + fmtTokens(newTier.rate) + "/s.";

      // Phase 9: initialize clusters
      if (G.phase === 9 && G.clusters.length === 0) {
        var alpha = addClusterWithNextName();
        alpha.invested = CLUSTER_COST + 12000;
        alpha.managerAssigned = true;
        alpha.tokenManagerAssigned = true;
        alpha.tank = G.managerTokenTank;
        G.managerTokenTank = 0;
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
        G.agents = G.agents.filter((agent) => !UTILITY_ROLES.includes(agent.roleId));
        log("Cluster 1 formed with existing agents and a management agents online.", "info");
        msg += "\n\nCluster 1 includes Manager, Token Manager and DevOps. Bring another cluster online, then provision its agents.";
      }

      if (G.phase === 12) {
        G.replicationTarget = Math.max(20, G.clusters.length + 9);
        for (const cluster of G.clusters) {
          cluster.workforce = cluster.workerAgentIds.length;
          for (const id of cluster.workerAgentIds) cluster.tank += G.agents.find((agent) => agent.id === id).tokenTank;
          cluster.workerAgentIds = [];
        }
        G.agents = [];
        G.tasks = [];
        G.activeTaskId = null;
        G.aiWorkerCurrentTaskId = null;
        msg += "\n\nYour CEO now operates the nodes. Individual agent controls are retired. Grow the network to 100 managed nodes.";
      }

      // Phase 10: AI CEO baseline orchestration bump
      if (G.phase === 10) {
        G.agentSpeedMult *= 1.8;
        G.payMult *= 1.6;
        msg += "\n\nYour company is ready for an AI CEO.";
      }

      if (MAJOR_PHASE_POPUPS.indexOf(G.phase) >= 0) {
        showPopup(title, msg);
      }

      // Auto-deploy a service when reaching phase 10
      // Service-slot upgrades now deploy and fund recurring contracts directly.

    }

    log("Purchased: " + upg.name, "good");

    // Check milestones after upgrade (phase may have changed)
    checkMilestones();
    if (upgradeId === "fusion") sellCompany();
  }

  // ---------- PRESTIGE ----------

  function convertSubscriptions() {
    if (G.aiWorkerShutdown) return;
    const original = createAgent("writer");
    original.speed = 0.35;
    original.tokenCost = 1;
    original.olderModel = true;
    original.name = "AI 2000 Basic";
    original.icon = "🤖";
    original.tokenTank = G.aiWorkerTokenTank;
    original.tasksCompleted = G.aiWorkerTasksCompleted;
    const task = getCurrentAiWorkerTask();
    if (task) {
      task.status = "agent";
      task.assignedAgent = original.id;
      original.currentTask = task.id;
      original.status = "working";
    }
    G.agents.unshift(original);
    G.aiWorkerShutdown = true;
    G.aiWorkerTokenTank = 0;
    G.aiWorkerCurrentTaskId = null;
    log("Both AI subscriptions are now agents. Their loaded tokens and jobs are retained.", "info");
  }

  function canSellCompany() {
    return !G.retired && G.phase >= FINAL_PHASE && G.techDebt < 10 &&
      G.incidents.every((incident) => incident.resolved) && getIncomeRate() > getExpenseRate() * 2 && managedNodeCount() >= 100;
  }

  function sellCompany() {
    G.retirementValue = G.cash + getIncomeRate() * 120;
    G.cash = G.retirementValue;
    G.retired = true;
    G.retiredAt = Date.now();
    syncMusicPlayback();
    popupQueue = [];
    dismissPopup();
    save();
    renderAll();
  }

  function canPrestige() {
    return G.retired && !G.retirementFinal;
  }


  function canTrueRetire() {
    return G.retired && !G.retirementFinal;
  }

  function finishRetirement() {
    if (!canTrueRetire()) return;
    G.retirementFinal = true;
    save();
    renderAll();
    $("#ending-title").focus();
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
    newState.totalPlaytime = G.totalPlaytime;
    newState.musicMode = G.musicMode;
    // On prestige, fast-forward onboarding (player knows the game)
    // Mark task-count milestones as reached so popups don't replay
    G = newState;
    popupQueue = [];
    dismissPopup();
    log("PRESTIGE #" + G.prestigeCount + "! New cycle begins with bonuses.", "info");
    // Spawn initial tasks for prestige
    // A new cycle now begins with the introduction and manual work again.
    syncMusicPlayback();
    renderIntro();
    save();
  }

  // ---------- OFFLINE PROGRESS ----------
  function calcOfflineProgress(elapsedSec) {
    if (elapsedSec < 10 || G.retired) return null;
    const cappedSec = Math.min(elapsedSec, 3600 * 8); // Max 8 hours
    // 50% offline efficiency
    // Offline work is limited to recurring contracts, never a snapshot of busy workers.
    let income = getMarketingRevenueRate() * cappedSec * 0.5;
    // Services
    for (const service of G.services) {
      if (service.active) income += service.incomeRate * cappedSec * 0.5;
    }
    // Expenses (only if revealed)
    const expenses = getExpenseRate() * cappedSec;
    return { earned: income, expenses, net: Math.max(0, income - expenses), seconds: cappedSec };
  }

  function applyOfflineProgress() {
    const offline = calcOfflineProgress((Date.now() - G.lastTick) / 1000);
    if (offline && offline.net > 0) {
      G.cash += offline.net;
      G.totalCashEarned += offline.earned;
      $("#offline-earnings").textContent = "+" + fmtCash(offline.net);
      $("#offline-details").textContent = "Away for " + Math.floor(offline.seconds / 60) + "m. Contract income " + fmtCash(offline.earned) + ", expenses " + fmtCash(offline.expenses) + ".";
      $("#offline-popup").classList.add("show");
    }
    G.lastTick = Date.now();
    pruneTasks(G.lastTick);
    save();
  }

  // ---------- TASK SPAWN TICK ----------
  function tickTaskSpawn() {
    const interval = getSpawnInterval();
    if (interval === Infinity) return;
    if (Date.now() - G.lastTaskSpawn < interval) return;
    G.lastTaskSpawn = Date.now();
    const batch = G.phase >= 9 ? Math.max(1, managedNodeCount()) : 1;
    for (let index = 0; index < batch; index++) spawnTask();
  }

  // ---------- AI CEO auto-management (Phase 10+) ----------
    // Manage mode: auto-enable autoAssign on new hires
    // New hires enable self-assignment on creation; CEO routing supersedes it.
    // Manage mode + Scale mode: auto-assign idle agents to available tasks
    // Auto-create new cluster when all existing clusters are full
    // Scale mode: auto-hire when slots available and cash is healthy
      // Pick a worker role that has cluster slots available
  // ---------- MILESTONES ----------
  function managedNodeCount() {
    return G.clusters.filter((cluster) => cluster.managerAssigned).length;
  }

  function nodeRequirement(upgrade) {
    return upgrade.id === "replication" ? G.replicationTarget : upgrade.reqNodes || 0;
  }


  function clusterCapacity() {
    if (G.phase >= 10 && G.ceoMode === "scale") return Infinity;
    if (G.ceoMode === "manage") return 5;
    return G.purchasedUpgrades.includes("cluster_capacity_3") ? 3 : G.purchasedUpgrades.includes("cluster_capacity_2") ? 2 : 1;
  }

  function nodeCost() {
    return Math.ceil(1000000 * Math.pow(1 + G.clustersProvisioned * 0.025, 2) * (G.phase >= 13 ? 0.65 : 1) * (G.phase >= 14 ? 0.6 : 1));
  }

  function provisionCost() {
    return 12000 + (G.purchasedUpgrades.includes("ceo_full_fit") ? 40000 : 0) + (G.phase >= 12 ? nodeCost() : Math.ceil(CLUSTER_COST * Math.pow(1.6, Math.max(0, G.clustersProvisioned - 1))));
  }


  function clusterBuildDuration() {
    if (G.purchasedUpgrades.includes("ceo_continuous")) return 2;
    const base = G.phase >= 14 ? 2 : G.phase >= 13 ? 3 : G.phase >= 11 ? 6 : 12;
    return base / (G.purchasedUpgrades.includes("ceo_fast_builds") ? 2 : 1);
  }

  function openCluster() {
    const cost = provisionCost();
    if (G.phase < 9 || G.clusters.length >= clusterCapacity() || G.cash < cost) return;
    G.cash -= cost;
    const cluster = addClusterWithNextName();
    cluster.invested = cost;
    cluster.buildDuration = clusterBuildDuration();
    cluster.buildRemaining = cluster.buildDuration;
    if (G.purchasedUpgrades.includes("ceo_full_fit")) {
      if (G.phase >= 12) cluster.workforce = cluster.workerSlotsMax;
      else for (let index = 0; index < cluster.workerSlotsMax; index++) provisionClusterAgent(cluster, cluster.buildDuration);
    }
    log(cluster.name + " provisioned for " + fmtCash(cost) + ".", "info");
  }

  function clusterSaleValue(cluster) {
    return Math.floor(cluster.invested * 0.6);
  }

  function sellCluster(clusterId) {
    const cluster = G.clusters.find((item) => item.id === clusterId);
    if (G.phase < 9 || G.phase >= 12 || G.clusters.length <= 1 || !cluster || cluster.workerAgentIds.length !== cluster.workerSlotsMax || !cluster.managerAssigned) return;
    const ids = new Set(cluster.workerAgentIds);
    for (const task of G.tasks) {
      if (!ids.has(task.assignedAgent)) continue;
      task.assignedAgent = null;
      task.status = "available";
    }
    G.agents = G.agents.filter((agent) => !ids.has(agent.id));
    G.clusters = G.clusters.filter((item) => item !== cluster);
    const price = clusterSaleValue(cluster);
    G.cash += price;
    log(cluster.name + " sold for " + fmtCash(price) + ".", "info");
  }

  function buyClusterWorker(clusterId) {
    const cluster = G.clusters.find((item) => item.id === clusterId);
    if (G.phase < 9 || G.phase >= 12 || !cluster || cluster.buildRemaining > 0 || !cluster.managerAssigned || cluster.workerAgentIds.length >= cluster.workerSlotsMax || G.cash < 2500) return;
    G.cash -= 2500;
    cluster.invested += 2500;
    provisionClusterAgent(cluster, (G.phase >= 11 ? 2 : 4) / (G.purchasedUpgrades.includes("ceo_deploy_speed") ? 1.5 : 1));
  }

  function provisionClusterAgent(cluster, duration) {
    const agent = createAgent("coder");
    agent.name = "AI Agent";
    agent.specialty = TASK_TYPES.map((type) => type.id);
    agent.speed = 1;
    agent.quality = 1;
    agent.reliability = 1;
    agent.tokenCost = 1;
    agent.status = "provisioning";
    agent.provisionDuration = duration;
    agent.provisionRemaining = agent.provisionDuration;
    G.agents.push(agent);
    cluster.workerAgentIds.push(agent.id);
  }

  function canManuallyProvisionCluster() {
    if (G.phase < 9 || G.ceoMode === "scale" || G.clusters.length >= clusterCapacity() || G.clusters.some((cluster) => cluster.buildRemaining > 0)) return false;
    if (G.ceoMode === "manage") {
      if (G.clusters.slice(0, 3).some((cluster) => cluster.workerAgentIds.length < 12)) return false;
      if (G.clusters.length >= 4 && !clustersFull()) return false;
    }
    return true;
  }

  function tickClusterManagers() {
    if (G.phase >= 12) return;
    for (const cluster of G.clusters) {
      if (!cluster.managerAssigned) continue;
      for (const id of cluster.workerAgentIds) {
        const agent = G.agents.find((item) => item.id === id);
        if (agent.tokenTank < workerTokenCapacity(agent) * (G.phase >= 10 ? 1 : 0.25)) {
          const amount = Math.min(cluster.tank, workerTokenCapacity(agent) - agent.tokenTank, G.phase >= 10 ? 25 : workerTokenCapacity(agent));
          cluster.tank -= amount;
          agent.tokenTank += amount;
        }
        if (agent.status !== "idle" || agent.tokenTank <= 0) continue;
        const task = findMatchingTask(agent) || pickNextAiTask();
        if (task) assignAgentToTask(task.id, agent.id);
      }
    }
  }

  function networkIncomeRate() {
    if (G.phase < 12) return 0;
    return G.clusters.reduce((total, cluster) => total + (cluster.managerAssigned && cluster.tank > 0 ? cluster.workforce * 15 * G.payMult : 0), 0);
  }

  function tickNetwork(dtSec) {
    if (G.phase < 12) return;
    for (const cluster of G.clusters) {
      if (!cluster.managerAssigned || cluster.workforce === 0) continue;
      const rate = cluster.workforce * workerTokenRate() * G.tokenEfficiency;
      const elapsed = Math.min(dtSec, cluster.tank / rate);
      cluster.tank = Math.max(0, cluster.tank - elapsed * rate);
      G.tokensConsumed += elapsed * rate;
      const income = cluster.workforce * 15 * G.payMult * elapsed;
      G.cash += income;
      G.totalCashEarned += income;
      cluster.progress += cluster.workforce * G.batchSize * elapsed / 4;
      const completed = Math.floor(cluster.progress);
      cluster.progress -= completed;
      G.totalTasksDone += completed;
    }
  }


  function tickConstruction(dtSec) {
    for (const cluster of G.clusters) {
      if (cluster.buildRemaining <= 0) continue;
      cluster.buildRemaining = Math.max(0, cluster.buildRemaining - dtSec);
      if (cluster.buildRemaining === 0) {
        cluster.managerAssigned = true;
        cluster.tokenManagerAssigned = true;
        log(cluster.name + " online.", "info");
      }
    }
    for (const agent of G.agents) {
      if (agent.status !== "provisioning") continue;
      agent.provisionRemaining = Math.max(0, agent.provisionRemaining - dtSec);
      if (agent.provisionRemaining === 0) agent.status = "idle";
    }
  }

  function tickAiCeo() {
    if (G.ceoMode === "off") return;
    const baseInterval = G.phase >= 14 ? 1000 : G.phase >= 13 ? 2000 : G.phase >= 11 ? 2500 : 5000;
    const interval = baseInterval / (G.purchasedUpgrades.includes("ceo_recruitment") ? 2 : 1) / (G.ceoMode === "scale" ? 2 : 1) / (G.purchasedUpgrades.includes("ceo_deploy_speed") ? 1.5 : 1);
    if (Date.now() - G.lastCeoAction < interval) return;
    G.lastCeoAction = Date.now();
    if (G.phase >= 12) {
      const unfinished = G.clusters.find((cluster) => cluster.buildRemaining === 0 && (!cluster.managerAssigned || cluster.workforce < cluster.workerSlotsMax));
      if (unfinished) {
        const cost = (unfinished.managerAssigned ? 0 : 12000) + (unfinished.workerSlotsMax - unfinished.workforce) * 2500;
        if (G.cash < cost * 2) return;
        G.cash -= cost;
        unfinished.invested += cost;
        unfinished.managerAssigned = true;
        unfinished.tokenManagerAssigned = true;
        unfinished.workforce = unfinished.workerSlotsMax;
        log("CEO activated " + unfinished.name + ".", "info");
        return;
      }
    }
    const hiring = G.clusters.find((cluster) => cluster.buildRemaining === 0 && cluster.managerAssigned && cluster.workerAgentIds.length < cluster.workerSlotsMax);
    if (G.phase < 12 && hiring) {
      const batch = G.purchasedUpgrades.includes("ceo_quad_batch") ? 4 : G.purchasedUpgrades.includes("ceo_batch") ? 2 : 1;
      for (let index = 0; index < batch; index++) buyClusterWorker(hiring.id);
      return;
    }
    if (G.ceoMode !== "scale" || G.clusters.length === 0) return;
    const concurrent = G.purchasedUpgrades.includes("ceo_parallel_clusters") ? 2 : 1;
    const pending = G.clusters.filter((cluster) => !clusterOnline(cluster)).length;
    for (let index = pending; index < concurrent; index++) {
      if (G.cash < provisionCost() * 2) break;
      openCluster();
    }
  }

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
  let drumTransitionPending = false;
  let synthPlayer = null;
  let synthFadeInterval = null;
  let musicUnlocked = false;
  let activeSoundtrackPath = null;
  let activeDrumLayerPath = null;
  let musicFadeInterval = null;
  let drumFadeInterval = null;
  let drumCrossfadeInterval = null;
  let hasDoneInitialMusicFadeIn = false;
  let smoothedIncomeRate = 0;
  let deliveryObservation = null;

  function deliveryMetrics() {
    if (!deliveryObservation || deliveryObservation.game !== G) deliveryObservation = { game: G, phase: G.phase, rate: 0, recent: [], showTasks: G.ceoMode === "off", purchase: "" };
    if (deliveryObservation.phase !== G.phase) {
      deliveryObservation.phase = G.phase;
      if (G.ceoMode === "off") deliveryObservation.showTasks = true;
    }
    return deliveryObservation;
  }

  function toggleDeliveryTasks() {
    const metrics = deliveryMetrics();
    metrics.showTasks = !metrics.showTasks;
    renderWorkStream();
  }

  function renderDeliverySummary() {
    const metrics = deliveryMetrics();
    const queued = G.tasks.filter((task) => task.status === "available").length;
    const running = G.tasks.filter((task) => ["active", "ai", "agent"].includes(task.status)).length;
    let html = "<div class='card delivery-card'><h3>Delivery</h3><div class='delivery-metrics'><strong class='delivery-rate'>" + fmtTokens(metrics.rate * 60) + "<small>completed / min</small></strong>";
    if (G.phase < 12) html += "<span class='delivery-queued'>" + queued + " queued</span><span class='delivery-running'>" + running + " in progress</span>";
    else html += "<span>" + managedNodeCount() + " managed nodes</span><span>" + "$" + fmtTokens(networkIncomeRate()) + "/s delivery revenue</span>";
    html += "</div>";
    if (G.phase < 12) {
      html += "<ul class='recent-deliveries'>" + metrics.recent.map((name) => "<li>✓ " + name + "</li>").join("") + "</ul>";
      html += "<button class='btn btn-outline btn-sm delivery-toggle' aria-expanded='" + metrics.showTasks + "' aria-controls='task-list' onclick='GAME.toggleDeliveryTasks()'>" + (metrics.showTasks ? "Hide tasks ∧" : "Show tasks ∨") + "</button>";
    }
    html += "</div>";
    updateHTML($("#delivery-summary"), html);
  }

  function showPopup(title, msg) {
    popupQueue.push({ title: title, msg: msg });
    if (popupQueue.length === 1) displayPopup();
  }

  function displayPopup() {
    if (popupQueue.length === 0) return;
    var p = popupQueue[0];
    $("#milestone-popup-title").textContent = p.title;
    $("#milestone-popup-msg").textContent = p.msg;
    $("#milestone-popup").classList.add("show");
    syncDialogFocus();
  }

  function dismissPopup() {
    popupQueue.shift();
    if (popupQueue.length > 0) {
      displayPopup();
    } else {
      $("#milestone-popup").classList.remove("show");
    }
    syncDialogFocus();
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
    drumTransitionPending = false;
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
    drumTransitionPending = false;

    if (outgoingDrumPlayer) stopAndResetAudio(outgoingDrumPlayer, 0);
    outgoingDrumPlayer = drumPlayer;
    var previousDrumPlayer = outgoingDrumPlayer;
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

    drumTransitionPending = true;
    nextDrumPlayer.addEventListener("canplay", function () {
      if (!drumTransitionPending || drumPlayer !== nextDrumPlayer) return;
      var barPosition = previousDrumPlayer.currentTime % DRUM_BAR_SECONDS;
      var beginCrossfade = function () {
        if (!drumTransitionPending || drumPlayer !== nextDrumPlayer) return;
        drumTransitionPending = false;
        playAudioIfUnlocked(drumPlayer, "drum layer");
        var outgoingSynth = nextDrumPath === DNB_LAYER_PATH ? synthPlayer : null;
        var outgoingSynthVolume = outgoingSynth ? outgoingSynth.volume : 0;
        if (outgoingSynth) clearSynthFadeTimerIfAny();
        var outgoingStartVolume = outgoingDrumPlayer && outgoingDrumPlayer.volume > 0 ? outgoingDrumPlayer.volume : DRUM_TARGET_VOLUME;
        var fadeDuration = nextDrumPath === DNB_LAYER_PATH ? DNB_CROSSFADE_MS : DRUM_CROSSFADE_MS;
        var elapsed = 0;
        drumCrossfadeInterval = setInterval(function () {
          elapsed += DRUM_FADE_STEP_MS;
          var progress = elapsed / fadeDuration;
          if (progress >= 1) {
            drumPlayer.volume = DRUM_TARGET_VOLUME;
            if (outgoingSynth) stopSynthPlayback();
            if (outgoingDrumPlayer) {
              stopAndResetAudio(outgoingDrumPlayer, 0);
              outgoingDrumPlayer = null;
            }
            clearDrumCrossfadeTimerIfAny();
            return;
          }
          drumPlayer.volume = DRUM_TARGET_VOLUME * progress;
          if (outgoingSynth) outgoingSynth.volume = outgoingSynthVolume * (1 - progress);
          if (outgoingDrumPlayer) {
            outgoingDrumPlayer.volume = outgoingStartVolume * (1 - progress);
          }
        }, DRUM_FADE_STEP_MS);
      };
      if (barPosition === 0) {
        beginCrossfade();
        return;
      }
      setTimeout(beginCrossfade, (DRUM_BAR_SECONDS - barPosition) * 1000);
    }, { once: true });
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

    if (drumTransitionPending) return;
    playAudioIfUnlocked(drumPlayer, "drum layer");
    if (!drumCrossfadeInterval && !drumFadeInterval && drumPlayer.volume < DRUM_TARGET_VOLUME) {
      var remaining = DRUM_TARGET_VOLUME - drumPlayer.volume;
      drumPlayer.volume += Math.min(remaining, 0.02);
    }
  }

  function clearSynthFadeTimerIfAny() {
    if (synthFadeInterval) {
      clearInterval(synthFadeInterval);
      synthFadeInterval = null;
    }
  }

  function stopSynthPlayback() {
    clearSynthFadeTimerIfAny();
    stopAndResetAudio(synthPlayer, 0);
  }

  function syncSynthLayerPlayback() {
    if (G.phase < SYNTH_START_PHASE || !musicUnlocked) {
      stopSynthPlayback();
      return;
    }
    if (G.phase >= 8) {
      if (!drumTransitionPending && !drumCrossfadeInterval) stopSynthPlayback();
      return;
    }
    if (!synthPlayer) {
      synthPlayer = new Audio();
      synthPlayer.preload = "auto";
      synthPlayer.loop = true;
      synthPlayer.src = SYNTH_LAYER_PATH;
      synthPlayer.volume = 0;
    }
    if (synthPlayer.paused) playAudioIfUnlocked(synthPlayer, "synth layer");
    if (synthFadeInterval || synthPlayer.volume === SYNTH_TARGET_VOLUME) return;
    var elapsed = 0;
    synthFadeInterval = setInterval(function () {
      elapsed += MUSIC_FADE_STEP_MS;
      var progress = Math.min(elapsed / SYNTH_FADE_IN_MS, 1);
      synthPlayer.volume = SYNTH_TARGET_VOLUME * progress;
      if (progress === 1) {
        clearInterval(synthFadeInterval);
        synthFadeInterval = null;
      }
    }, MUSIC_FADE_STEP_MS);
  }

  function syncMusicPlayback() {
    if (!musicPlayer) return;
    var mode = getCurrentMusicMode();
    var nextSoundtrackPath = getCurrentSoundtrackPath();
    var nextDrumLayerPath = getCurrentDrumLayerPath();

    if (mode === "off" || !G.gameStarted || G.retired) {
      clearMusicFadeTimerIfAny();
      stopAndResetAudio(musicPlayer, MUSIC_TARGET_VOLUME);
      activeSoundtrackPath = null;
      stopDrumPlayback();
      stopSynthPlayback();
      return;
    }

    syncBaseSoundtrack(nextSoundtrackPath);
    if (!nextSoundtrackPath || mode !== "layered") {
      stopDrumPlayback();
      stopSynthPlayback();
      return;
    }
    syncDrumLayerPlayback(nextDrumLayerPath);
    syncSynthLayerPlayback();
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
    syncDialogFocus();
  }

  function closeSettingsPopup() {
    $("#settings-popup").classList.remove("show");
    syncDialogFocus();
    resetSettingsPopupState();
  }

  function askResetConfirmation() {
    $("#settings-msg").textContent = "Are you sure? This will permanently reset all progress.";
    $("#settings-main-actions").style.display = "none";
    $("#settings-confirm-actions").style.display = "flex";
  }

  function performFullReset() {
    try {
      localStorage.removeItem("ai_empire_save");
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "SecurityError") throw error;
      storageMessage("Reset failed because browser storage is blocked. Allow storage and try again.");
      return;
    }
    saveBlocked = true;
    location.reload();
  }

  let rotateDismissed = false;

  function updateRotateOverlay() {
    var overlay = $("#rotate-overlay");
    if (!overlay) return;
    var dismissed = rotateDismissed;
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
      if (task.status !== "available" || now - task.createdAt < TASK_EXPIRY_MS) return true;
      clearExpiredTaskState(task);
      return false;
    });
  }

  // ---------- MAIN GAME TICK ----------
  function tick() {
    if (!G.gameStarted || G.retired || document.hidden) return;
    if (document.querySelector(".popup-overlay.show, #rotate-overlay.show")) {
      G.lastTick = Date.now();
      return;
    }
    if (Date.now() - G.lastTick > 10000) {
      applyOfflineProgress();
      return;
    }
    const now = Date.now();
    const dtMs = clamp(now - G.lastTick, 0, 1000);
    const dtSec = dtMs / 1000;
    G.lastTick = now;
    G.totalPlaytime += dtMs;

    const consumedBefore = G.tokensConsumed;
    const completedBefore = G.totalTasksDone;
    tickConstruction(dtSec);
    if (G.phase < 12) tickTaskSpawn();
    tickNetwork(dtSec);
    tickManualWork(dtSec);
    tickAiWorker(dtSec);
    tickManager();
    tickAgents(dtSec);
    tickAgentAutoAssign();
    if (dtSec > 0) G.averageTokenBurn += ((G.tokensConsumed - consumedBefore) / dtSec - G.averageTokenBurn) * (1 - Math.exp(-dtSec / 5));
    if (dtSec > 0 && G.phase >= 9) {
      const metrics = deliveryMetrics();
      metrics.rate += ((G.totalTasksDone - completedBefore) / dtSec - metrics.rate) * (1 - Math.exp(-dtSec / 10));
    }
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

  function patchChildren(target, source) {
    const desired = [...source.childNodes];
    for (let index = 0; index < desired.length; index++) {
      const next = desired[index];
      const current = target.childNodes[index];
      if (!current) {
        target.appendChild(next.cloneNode(true));
      } else if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName ||
          (current.nodeType === 1 && current.getAttribute("onclick") !== next.getAttribute("onclick"))) {
        current.replaceWith(next.cloneNode(true));
      } else if (current.nodeType === 3) {
        if (current.data !== next.data) current.data = next.data;
      } else if (current.nodeType === 1) {
        for (const attribute of [...current.attributes]) {
          if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
        }
        for (const attribute of [...next.attributes]) {
          if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
        }
        patchChildren(current, next);
      }
    }
    while (target.childNodes.length > desired.length) target.lastChild.remove();
  }

  const renderedMarkup = new WeakMap();

  function updateHTML(element, html) {
    if (renderedMarkup.get(element) === html) return;
    const template = document.createElement("template");
    template.innerHTML = html;
    patchChildren(element, template.content);
    renderedMarkup.set(element, html);
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
	    $("#res-tokens").textContent = fmtTokens(G.tokens);
        $("#res-tasks").textContent = fmt(G.totalTasksDone);
        $("#token-burn").textContent = "-" + fmtTokens(G.averageTokenBurn) + " tok/s";
	    $("#res-debt").textContent = fmt(G.techDebt);
	    $("#res-stress").textContent = Math.round(G.stress) + "%";
	    $("#phase-label").textContent = "Phase " + G.phase;

    // Progressive reveal of resource counters
    $("#res-cash-wrap").style.display = G.uiRevealed.cash ? "" : "none";
    $("#res-tokens-wrap").style.display = G.uiRevealed.tokens ? "" : "none";
    $("#res-debt-wrap").style.display = G.uiRevealed.debt ? "" : "none";
    $("#res-stress-wrap").style.display = G.uiRevealed.stress ? "" : "none";

    // Warning pulse
    $("#res-tokens-wrap").classList.toggle("res-warning", G.tokens < (G.phase >= 6 ? MANAGER_TOPUP_COST_TOKEN : workerTokenCapacity()));
    $("#res-stress-wrap").classList.toggle("res-warning", G.stress > 80);

    // Income and expense rates
    var income = getIncomeRate();
    if (smoothedIncomeRate === 0) smoothedIncomeRate = income;
    smoothedIncomeRate += (income - smoothedIncomeRate) * 0.2;
    if (Math.abs(smoothedIncomeRate - income) < 0.01) smoothedIncomeRate = income;
    var expense = getExpenseRate();
    var incomeEl = $("#income-rate");
    incomeEl.style.display = G.uiRevealed.income ? "" : "none";
    incomeEl.textContent = "+" + "$" + fmtTokens(smoothedIncomeRate) + "/s";
    var expenseWrap = $("#res-expense-wrap");
    expenseWrap.style.display = G.uiRevealed.expenses ? "" : "none";
    $("#expense-rate").textContent = "-" + "$" + fmtTokens(expense) + "/s";
    var expTier = null;
    for (var ti = 0; ti < EXPENSE_TIERS.length; ti++) {
      if (G.phase >= EXPENSE_TIERS[ti].phase) expTier = EXPENSE_TIERS[ti];
    }
    $("#expense-tier-label").textContent = expTier ? expTier.name : "Expenses";
  }

  function renderWorkStream() {
    const compact = G.phase >= 10 || (G.phase === 9 && managedNodeCount() >= 2);
    $("#delivery-summary").hidden = !compact;
    $("#task-list").hidden = compact && (G.phase >= 12 || !deliveryMetrics().showTasks);
    if (compact) {
      $("#early-task-section").style.display = "none";
      $("#task-queue-section").style.display = "block";
      $("#tasks-complete-count").textContent = G.totalTasksDone;
      renderDeliverySummary();
      if (!$("#task-list").hidden) renderTaskQueue();
      else updateHTML($("#task-list"), "");
      $("#task-count").textContent = "";
      $("#no-tasks").style.display = "none";
      return;
    }
    var earlySection = $("#early-task-section");
    var queueSection = $("#task-queue-section");

    $("#tasks-complete-count").textContent = G.totalTasksDone;

    if (!G.uiRevealed.taskQueue) {
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
    return G.phase >= 3 ? "AI 2000 Basic" : "AI 2000 Free";
  }

  function getAgentTaskLabel(agentName) {
    if (!agentName) return "Agent";
    if (agentName.length <= 10) return agentName;
    return agentName.slice(0, 10) + "...";
  }

  function renderTaskQueue() {
    var list = $("#task-list");
    var noTasks = $("#no-tasks");
    var tasks = G.tasks.filter((task) => task.status !== "done");
    var queueSize = Math.min(getManualQueueSize(), tasks.filter((task) => task.status === "available").length);
    var manualBusy = G.phase < 4 && tasks.some((task) => task.status === "active");

    $("#task-count").textContent = tasks.length + " tasks";

    if (tasks.length === 0) {
      updateHTML(list, "");
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
        var clickBtn = "<button class='" + getWorkTaskButtonClass() + "' onclick=\"GAME.clickTask('" + t.id + "', event)\" " + (manualBusy ? "disabled" : "") + ">" + (queueSize > 1 ? "Work on " + queueSize : "Work") + "</button>";
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
        (t.batchSize > 1 ? "<span>Batch: " + fmtTokens(t.batchSize) + " tasks</span>" : "") + "<span>Pay: <strong style='color:var(--cash)'>" + fmtCash(displayedPay) + "</strong></span>";
      if (G.totalTasksDone >= 20) {
        metaHtml +=
          "<span>Work: " + Math.ceil(t.workDone) + "/" + t.workRequired + "</span>";
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
    updateHTML(list, html);
  }

  function renderUpgradeSection() {
    var section = $("#section-upgrades");
    if (!G.uiRevealed.upgrades) { section.style.display = "none"; return; }
    section.style.display = "";

    const previousCard = $("#upgrade-list .upgrade-card");
    if (previousCard) {
      const height = previousCard.getBoundingClientRect().height;
      if (height > 0) $("#upgrade-list").style.setProperty("--upgrade-card-height", height + "px");
    }

    var available = UPGRADES.filter(upgradeVisible);

    if (available.length === 0) {
      updateHTML($("#upgrade-list"), "<div class='upgrade-space' aria-hidden='true'></div>");
      return;
    }

    // Split into repeatables and one-time upgrades
    var repeatables = [];
    var oneTime = [];
    for (var i = 0; i < available.length; i++) {
      if (available[i].id === "ai_ceo") continue;
      if (available[i].oneTime) oneTime.push(available[i]);
      else repeatables.push(available[i]);
    }

    var MAX_VISIBLE = oneTime.length;
    var hidden = Math.max(0, oneTime.length - MAX_VISIBLE);
    var visible = oneTime.slice(0, MAX_VISIBLE);

    var html = "";
    // One-time upgrades (capped)
    for (var i = 0; i < visible.length; i++) {
      var u = visible[i];
      var cost = getUpgradeCost(u);
      var canAfford = u.currency === "cash" ? G.cash >= cost : G.tokens >= u.cost;
      var requiredNodes = nodeRequirement(u);
      var requirementsMet = (!u.reqTasks || G.totalTasksDone >= u.reqTasks) && (u.id !== "autonomous_nodes" || !hasUnfinishedAgentInstallations()) && (u.id !== "fusion" || canSellCompany()) && completedClusterCount() >= requiredNodes && (!u.requiresRole || G.agents.some((agent) => agent.roleId === u.requiresRole));
      html += "<div class='card upgrade-card'>" +
        "<div class='upgrade-info'>" +
        "<div class='name'>" + u.name + (u.unlockPhase ? " <span class='badge badge-purple'>-> Phase " + u.unlockPhase + "</span>" : "") + "</div>" +
        "<div class='desc'>" + u.desc + (requiredNodes ? " (" + requiredNodes + " nodes)" : "") + (u.phase === 7 && u.reqTasks ? " (" + fmtTokens(u.reqTasks) + " tasks)" : "") + "</div>" +
        "</div>" +
        "<div style='display:flex;align-items:center;gap:10px'>" +
        "<span class='upgrade-cost'>" + (u.currency === "tasks" ? u.reqTasks + " tasks" : u.currency === "cash" ? fmtCash(cost) : u.cost + " tok") + "</span>" +
        "<button class='btn btn-green btn-sm' onclick=\"GAME.buy('" + u.id + "')\" " + (!canAfford || !requirementsMet ? "disabled" : "") + ">" + (u.currency === "tasks" ? "Unlock" : "Buy") + "</button>" +
        "</div>" +
        "</div>";
    }
    if (visible.length === 0) html += "<div class='upgrade-space' aria-hidden='true'></div>";
    // Repeatables (always shown, compact row)
    for (var i = 0; i < repeatables.length; i++) {
      var u = repeatables[i];
      var cost = getUpgradeCost(u);
      var canAfford = u.currency === "cash" ? G.cash >= cost : G.tokens >= u.cost;
      html += "<div style='display:inline-flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg2);border:1px solid var(--bg3);border-radius:var(--radius);margin-right:6px;margin-bottom:6px'>" +
        "<span class='text-sm'>" + (u.id.startsWith("token_pack_") ? "Token Pack (" + fmtTokens(tokenPackAmount(u)) + ")" : u.name) + "</span>" +
        "<span class='upgrade-cost text-sm'>" + (u.currency === "cash" ? fmtCash(cost) : u.cost + " tok") + "</span>" +
        "<button class='btn btn-green btn-sm' onclick=\"GAME.buy('" + u.id + "')\" " + (!canAfford ? "disabled" : "") + " style='padding:2px 10px'>Buy</button>" +
        "</div>";
    }
    updateHTML($("#upgrade-list"), html);
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
    return renderAgentCard({ roleId: "original_ai", name: getAiWorkerDisplayName(), icon: "🤖", roleName: "", tokenTank: G.aiWorkerTokenTank });
  }

  // Hire info
  // Agent list -- assignable first, then error, idle, working last
  // manager always leads in phase 6+
  // assignable
  // working or utility
  function availableHireRoles() {
    return AGENT_ROLES.filter((role) =>
      (!UTILITY_ROLES.includes(role.id) || !G.agents.some((agent) => agent.roleId === role.id)) &&
      (role.id !== "manager" || G.managerUnlock) &&
      (role.id !== "token_mgr" || G.purchasedUpgrades.includes("token_manager_unlock")) &&
      (role.id !== "devops" || G.purchasedUpgrades.includes("devops_unlock")) && (role.id !== "sales" || G.phase >= 8));
  }

  function renderAgentCard(agent) {
    const utility = UTILITY_ROLES.includes(agent.roleId);
    const manager = agent.roleId === "manager";
    const original = agent.roleId === "original_ai";
    const capacity = manager ? MANAGER_TOKEN_TANK_MAX : workerTokenCapacity(agent);
    const tokens = manager ? G.managerTokenTank : agent.tokenTank;
    const action = original ? "GAME.topUpAiWorker()" : manager ? "GAME.topUpManager()" : "GAME.topUpAgent('" + agent.id + "')";
    let html = "<div class='card agent-card" + (["manager", "token_mgr"].includes(agent.roleId) ? " management-agent" : "") + (G.phase >= 8 ? " simple-agent" : "") + ((!utility || manager) && tokens <= 0 ? " res-warning" : "") + "'><div class='agent-icon'>" + agent.icon + "</div><div class='agent-info'><div class='name'>" + (agent.olderModel ? "AI 2000 Basic" : agent.name) + " <span class='role'>" + (agent.olderModel ? "Older model · slow" : G.phase < 4 ? "" : agent.roleName) + "</span></div>";
    if (!utility || manager) html += "<div class='agent-token-count'>" + fmtTokens(tokens) + "/" + fmtTokens(capacity) + " tokens</div><div class='task-bar'><div class='task-bar-fill' style='width:" + clamp(tokens / capacity * 100, 0, 100) + "%'></div></div>";
    else html += "<span class='text-sm'>" + (agent.roleId === "token_mgr" ? "Buying and distributing tokens" : "Resolving incidents") + "</span>";
    html += "</div><div class='agent-action-col'>";
    if (!utility || manager) html += "<button class='btn btn-purple btn-sm' onclick=\"" + action + "\" >Top-up tokens</button>";
    if (G.phase >= 4) html += "<button class='btn btn-outline btn-sm' onclick=\"" + (original ? "GAME.shutdownAiWorker()" : "GAME.fire('" + agent.id + "')") + "\">Sell</button>";
    html += "</div></div>";
    return html;
  }

  function renderAgentSection() {
    const section = $("#section-agents");
    section.style.display = G.uiRevealed.agents && !G.uiRevealed.clusters ? "" : "none";
    if (!G.uiRevealed.agents || G.uiRevealed.clusters) return;
    updateHTML($("#agent-hire-section"), "");
    let html = "";
    const cost = getAgentHireCost(G.agents.length);
    const reserved = reservedHireRoles();
    for (const roleId of ["manager", "token_mgr"]) {
      const agent = G.agents.find((item) => item.roleId === roleId);
      if (agent) html += renderAgentCard(agent);
      else if (reserved.includes(roleId)) {
        const name = roleId === "manager" ? "Manager" : "Token Manager";
        const price = getAgentHireCost(G.agents.length, roleId);
        html += "<button class='card hire-slot management-agent " + (roleId === "manager" ? "manager-slot" : "token-manager-slot") + "' onclick=\"GAME.hire('" + roleId + "')\" " + (G.cash < price || sharedAgentCount() >= getHireAgentCapacity() ? "disabled" : "") + "><span class='provision-icon'>+</span><strong>Buy " + name + "</strong><span>" + fmtCash(price) + "</span></button>";
      }
    }
    html += renderAiWorkerCard();
    for (const agent of G.agents.filter((item) => !UTILITY_ROLES.includes(item.roleId))) html += renderAgentCard(agent);
    const hireRoles = availableHireRoles().filter((item) => !UTILITY_ROLES.includes(item.id));
    const vacancies = G.phase >= 4 ? getHireAgentCapacity() - sharedAgentCount() - reserved.length : 0;
    for (let slot = 0; slot < vacancies; slot++) {
      const number = getSharedAgentPoolUsed() + reserved.length + slot + 1;
      html += "<div class='card hire-slot agent-vacancy'><div class='vacancy-heading'><span class='provision-icon'>+</span><strong>Agent slot " + number + "</strong><span>" + fmtCash(cost) + " each</span></div><div class='agent-buy-options'>";
      for (const role of hireRoles) html += "<button class='btn btn-green btn-sm' onclick=\"GAME.hire('" + role.id + "')\" " + (G.cash < cost ? "disabled" : "") + ">Buy " + role.name + "</button>";
      html += "</div></div>";
    }
    updateHTML($("#agent-list"), html);
  }

  function getAgentCluster(agentId) {
    for (var i = 0; i < G.clusters.length; i++) {
      if (G.clusters[i].workerAgentIds.indexOf(agentId) >= 0) return G.clusters[i];
    }
    return null;
  }

  // Remove from any current cluster
  // Add to target cluster



  // Toggle: unassign from all others first
  // Only one manager exists, so just move assignment
  // CEO mode badge
  // Manager Console + utility hire buttons (moved from agent section)
  // Util slots row
  // Worker slots (8 squares)
  // Stale reference -- clean up
  // Only show CEO badge on the first cluster
  // Unassigned workers list
  // Global Utility Roles section

  // Find first unassigned worker and assign to this cluster
  function renderClusterSlot(cluster, index, delegated) {
    const agent = G.agents.find((item) => item.id === cluster.workerAgentIds[index]);
    const filled = G.phase >= 12 ? index < cluster.workforce : Boolean(agent);
    const label = G.phase < 12 ? index + 1 : "";
    const identity = cluster.name + ", agent " + (index + 1);
    if (agent && agent.status === "provisioning") {
      const progress = Math.round(100 * (1 - agent.provisionRemaining / agent.provisionDuration));
      return "<span class='capacity-slot provisioning' role='progressbar' aria-label='Provisioning agent' aria-valuemin='0' aria-valuemax='100' aria-valuenow='" + progress + "' title='Installing " + identity + "' style='--progress:" + progress + "%'>" + label + "</span>";
    }
    if (!filled && !delegated && G.phase < 12) return "<button class='capacity-slot empty provision-agent' onclick=\"GAME.buyClusterWorker('" + cluster.id + "')\" aria-label='Provision agent for $2,500' title='Add " + identity + "' " + (G.cash < 2500 || !cluster.managerAssigned ? "disabled" : "") + ">" + label + "</button>";
    return "<span class='capacity-slot " + (filled ? "filled" : "empty") + "' title='" + identity + (filled ? " online" : " vacant") + "'>" + label + "</span>";
  }

  function renderClusterSection() {
    const section = $("#section-clusters");
    section.style.display = G.uiRevealed.clusters ? "" : "none";
    if (!G.uiRevealed.clusters) return;
    const compact = G.phase >= 12;
    const minimal = G.phase >= 14;
    const delegated = G.phase >= 10 && G.ceoMode !== "off";
    const tiles = G.clusters.length + (canManuallyProvisionCluster() ? 1 : 0);
    const density = Math.max(0, tiles - 3);
    const overview = !compact && density > 0;
    $("#cluster-count").textContent = managedNodeCount() + " online / " + G.clusters.length + " clusters";
    let html = "";
    if (G.phase >= 10) {
      const purchase = deliveryMetrics().purchase;
      html += "<div class='company-leadership' aria-label='Company leadership'>";
      if (G.ceoMode === "off") html += "<button class='card hire-slot management-agent leadership-agent ceo-slot' onclick=\"GAME.buy('ai_ceo')\" " + (G.cash < 1000000 ? "disabled" : "") + "><span class='provision-icon'>+</span><strong>Provision AI CEO</strong><span>$1M</span></button>";
      else html += "<div class='card management-agent leadership-agent'><span class='agent-icon'>🧠</span><div><strong>AI CEO</strong><p class='ceo-status'>" + (G.ceoMode === "manage" ? "Adding agents to existing clusters" : "Adding agents and expanding") + "</p></div></div>";
      html += "<div class='card management-agent leadership-agent'><span class='agent-icon'>🪙</span><div><strong>Token Manager</strong><p>Company-wide token supply</p><p>" + fmtTokens(G.tokens) + " tokens · -" + fmtTokens(G.averageTokenBurn) + " tok/s</p><p class='text-sm token-purchase'>" + (purchase || "Monitoring tokens") + "</p></div></div></div>";
    }
    html += "<div class='" + (minimal ? "network-grid" : compact ? "node-grid" : "node-grid agent-grid") + (overview ? " cluster-overview" : "") + "' style='--cluster-card-min:" + Math.max(104, 132 - density * 7) + "px;--cluster-card-padding:" + Math.max(5, 10 - density * 0.7) + "px;--cluster-card-gap:" + Math.max(3, 8 - density * 0.4) + "px;--cluster-slot-height:" + Math.max(16, 24 - density) + "px'>";
    for (const cluster of G.clusters) {
      const count = compact ? cluster.workforce : cluster.workerAgentIds.filter((id) => G.agents.find((agent) => agent.id === id).status !== "provisioning").length;
      const title = cluster.name + ": " + count + "/" + cluster.workerSlotsMax + " agents, " + fmtTokens(cluster.tank) + " tokens";
      html += "<div class='cluster-card' title='" + title + "'><strong>" + (minimal ? cluster.name.replace("Cluster ", "C") : cluster.name) + "</strong>";
      if (cluster.buildRemaining > 0) {
        const progress = 100 * (1 - cluster.buildRemaining / cluster.buildDuration);
        const stage = ["Procuring GPUs", "Racking hardware", "Installing software", "Final checks"][Math.min(3, Math.floor(progress / 25))];
        html += "<p class='text-sm'>" + stage + "</p><div class='task-bar' role='progressbar' aria-label='Cluster construction' aria-valuemin='0' aria-valuemax='100' aria-valuenow='" + Math.round(progress) + "'><div class='task-bar-fill' style='width:" + progress + "%'></div></div></div>";
        continue;
      }
      if (!minimal) {
        const installing = cluster.workerAgentIds.some((id) => G.agents.find((agent) => agent.id === id).status === "provisioning");
        const status = count < cluster.workerSlotsMax ? (delegated ? "Scaling" : installing ? "Installing agents" : count === 0 ? "Add your first agent" : "Add more agents") : cluster.tank > 0 ? "Operating" : "Awaiting tokens";
        html += "<p class='text-sm cluster-status'>" + status + "</p>" + (!compact ? "<p class='cluster-agents-label'>Agents " + count + "/" + cluster.workerSlotsMax + "</p>" : "") + "<div class='cluster-capacity' aria-label='" + count + " of " + cluster.workerSlotsMax + " agents online'>";
        for (let index = 0; index < cluster.workerSlotsMax; index++) html += renderClusterSlot(cluster, index, delegated);
        html += "</div>";
      }
      if (!compact && count === cluster.workerSlotsMax && G.clusters.length > 1) html += "<button class='btn btn-outline btn-sm' onclick=\"GAME.sellCluster('" + cluster.id + "')\">Sell</button>";
      html += "</div>";
    }
    if (canManuallyProvisionCluster()) html += "<button class='cluster-card provision-card' onclick='GAME.openCluster()' aria-label='Bring cluster online (" + fmtCash(provisionCost()) + ")' " + (G.cash < provisionCost() ? "disabled" : "") + "><span class='provision-icon'>+</span><strong>Bring cluster online</strong><span>" + fmtCash(provisionCost()) + "</span></button>";
    html += "</div>";
    updateHTML($("#cluster-list"), html);
  }

  function renderDevops() {
    if (G.phase >= 9) return "";
    const agent = G.agents.find((item) => item.roleId === "devops");
    if (agent) return renderAgentCard(agent);
    if (!G.purchasedUpgrades.includes("devops_unlock")) return "";
    const cost = getAgentHireCost(G.agents.length);
    return "<button class='card hire-slot devops-slot' onclick=\"GAME.hire('devops')\" " + (G.cash < cost ? "disabled" : "") + "><span class='provision-icon'>+</span><strong>Buy DevOps</strong><span>" + fmtCash(cost) + "</span><small>Dedicated incident slot</small></button>";
  }

  function renderIncidentSection() {
    var section = $("#section-incidents");
    if (!G.uiRevealed.incidents && G.phase < 7) { section.style.display = "none"; return; }
    section.style.display = "";

    updateHTML($("#incident-devops"), renderDevops());
    var active = G.incidents.filter(function (i) { return !i.resolved; });
    var idleDevops = G.phase >= 9 ? managedNodeCount() : G.agents.filter(function (a) { return a.roleId === "devops" && a.status === "idle"; }).length;
    const health = $("#operations-health");
    health.hidden = G.phase < 9;
    health.textContent = active.length === 0 ? "Operations healthy · DevOps included in every cluster" : active.length + (active.length === 1 ? " incident · " : " incidents · ") + (idleDevops > 0 ? "Cluster DevOps responding" : "Waiting for an online cluster");
    health.classList.toggle("attention", active.length > 0);
    $("#incidents-header").parentElement.hidden = G.phase >= 9 && active.length === 0;
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
      updateHTML($("#incident-list"), "");
      $("#no-incidents").style.display = G.phase >= 9 ? "none" : "";
      return;
    }
    $("#no-incidents").style.display = "none";

	    var html = "";
	    for (var i = 0; i < active.length; i++) {
	      var inc = active[i];
	      var age = Math.floor((Date.now() - inc.createdAt) / 1000);
	      var cashPart = inc.cashCost > 0 ? "<span style='font-size:.78rem;color:var(--red)'>-" + fmtCash(inc.cashCost) + "</span>" : "";
	      html += "<div class='card incident-card " + (inc.sev === "warning" ? "warning" : "") + "'>" +
	        "<div class='sev " + inc.sev + "'>" + inc.sev + "</div>" +
	        "<div style='display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px'>" +
	        "<div style='font-weight:600;min-width:0'>" + inc.name + "</div>" +
	        "<div style='display:flex;align-items:center;gap:8px;white-space:nowrap'>" +
	        cashPart +
	        "<span style='font-size:.78rem;color:var(--text3)'>" + age + "s</span>" +
	        "</div>" +
	        "</div>" +
	        "<div class='text-sm text-muted mb'>" + inc.desc + "</div>" +
	        (idleDevops > 0 ? "<div class='text-sm mb' style='color:var(--green)'>DevOps responding (" + (inc.fixProgress || 0).toFixed(0) + "%)" + "</div>" : "") +
	        ((inc.fixProgress || 0) > 0 ? "<div class='task-bar mb'><div class='task-bar-fill' style='width:" + Math.min(100, inc.fixProgress).toFixed(0) + "%;background:var(--green)'></div></div>" : "") +
	        "<div style='display:flex;gap:6px'>" +
	        "<button class='btn btn-primary btn-sm' onclick=\"GAME.resolveInc('" + inc.id + "','manual')\">Fix Manually (+stress)</button>" +
	        "<button class='btn btn-yellow btn-sm'" + (G.cash < (inc.cashCost || 20) * 2 ? " disabled" : "") + " onclick=\"GAME.resolveInc('" + inc.id + "','cash')\">Pay to Fix (" + fmtCash((inc.cashCost || 20) * 2) + ")</button>" +
	        "</div>" +
	        "</div>";
	    }
    updateHTML($("#incident-list"), html);
  }

    // Playtime
    // Agents summary
  function renderStatsSection() {
    $("#section-stats").style.display = "none";
  }


  function renderPrestigeSection() {
    $("#section-prestige").style.display = "none";
  }

  function renderEnding() {
    $("#ending-overlay").hidden = !G.retired;
    $("#game-container").hidden = G.retired;
    $("#top-bar").hidden = G.retired;
    $("#ending-title").textContent = G.retirementFinal ? "No more tasks." : "You retired early!";
    $("#ending-story").textContent = G.retirementFinal ? "You leave the laptop closed. The next model can wait. Your time belongs to you." : "A Tuesday morning on the golf course. A proper night's sleep. That health check you kept putting off. For once, your time belongs to you.";
    $("#ending-summary").textContent = "You completed " + fmt(G.totalTasksDone) + " tasks and walked away with " + fmtCash(G.retirementValue) + ".";
    $("#ending-choices").hidden = !G.retired || G.retirementFinal;
    $("#btn-ending-reset").hidden = !G.retirementFinal;
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
    updateHTML($("#log-panel"), html);
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

  let activeDialog = null;
  let previousFocus = null;

  function syncDialogFocus() {
    const dialog = document.querySelector("#ending-overlay:not([hidden])") || document.querySelector("#intro-overlay:not(.hidden)") || document.querySelector("#settings-popup.show, #milestone-popup.show, #offline-popup.show, #rotate-overlay.show");
    $("#game-container").inert = !!dialog;
    $("#top-bar").inert = !!dialog;
    if (dialog !== activeDialog) {
      if (dialog) {
        if (!activeDialog) previousFocus = document.activeElement;
        const target = dialog.id === "ending-overlay" ? $(G.retirementFinal ? "#btn-ending-reset" : "#btn-ending-restart") : dialog.querySelector("button");
        target.focus({ preventScroll: true });
      } else if (previousFocus && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
      activeDialog = dialog;
    }
  }

  function handleDialogKey(event) {
    if (!activeDialog) return;
    if (event.key === "Escape" && activeDialog.id === "settings-popup") {
      closeSettingsPopup();
      syncDialogFocus();
    }
    if (event.key !== "Tab") return;
    const buttons = [...activeDialog.querySelectorAll("button:not(:disabled)")].filter((button) => button.getClientRects().length > 0);
    const index = buttons.indexOf(document.activeElement);
    const next = event.shiftKey ? index - 1 : index + 1;
    if (next < 0 || next >= buttons.length) {
      event.preventDefault();
      buttons[event.shiftKey ? buttons.length - 1 : 0].focus();
    }
  }

  function renderAll() {
    const focusedAction = document.activeElement.getAttribute("onclick");
    renderEnding();
    $("#game-container").inert = G.retired;
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
    if (focusedAction) {
      const replacement = [...document.querySelectorAll("button[onclick]")].find((button) => button.getAttribute("onclick") === focusedAction && !button.disabled);
      if (replacement) replacement.focus({ preventScroll: true });
    }
    syncDialogFocus();
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

  function renderIntro() {
    $("#intro-overlay").classList.toggle("hidden", G.gameStarted);
    $("#intro-story").textContent = G.prestigeCount > 0 ? "Golf was nice. So was sleeping in. But there is a new model out, and you are getting bored. Maybe just one more task..." : "You are broke. Living out of your car. Your phone buzzes -- another gig app notification.";
    $("#intro-hint").textContent = G.prestigeCount > 0 ? "You know how this starts. This time will be different. Probably." : "You dream of early retirement. Maybe organising your life and smarter systems could set you free...";
  }

  function startGame() {
    G.gameStarted = true;
    G.lastTick = Date.now();
    G.startTime = Date.now();
    renderIntro();
    syncDialogFocus();
    log(G.prestigeCount > 0 ? "Back for one more task." : "You start your freelance grind from the backseat of your car.", "info");
    log("Click 'Do Task' to find gigs and earn cash.", "info");
    // No tasks spawned on start -- player creates them via Do Task button
    save();
  }

  // ---------- INIT ----------
  function init() {
    // Prevent trackpad pinch-zoom (macOS) and Safari gesture zoom
    // Zoom is allowed for accessibility.
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) save();
      else if (G.gameStarted && !G.retired) applyOfflineProgress();
    });
    $("#btn-save-retry").addEventListener("click", save);
    $("#btn-save-reset").addEventListener("click", function () {
      if (confirm("Discard saved progress and start over?")) performFullReset();
    });
    $("#btn-ending-restart").addEventListener("click", function () { GAME.prestige(); });
    $("#btn-ending-finish").addEventListener("click", function () { GAME.trueRetire(); });
    $("#btn-ending-reset").addEventListener("click", function () {
      if (confirm("Start a fresh game? Your completed run will be erased.")) performFullReset();
    });

    document.addEventListener("keydown", handleDialogKey);
    var loaded = load();
    setupMusic();

    // Popup dismiss
    $("#btn-dismiss-popup").addEventListener("click", function () { dismissPopup(); });

    // Offline popup dismiss
    $("#btn-dismiss-offline").addEventListener("click", function () {
      $("#offline-popup").classList.remove("show");
      syncDialogFocus();
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
      rotateDismissed = true;
      updateRotateOverlay();
      syncDialogFocus();
    });
    window.addEventListener("resize", updateRotateOverlay);
    window.addEventListener("orientationchange", updateRotateOverlay);
    updateRotateOverlay();

    // Do Task button (early game)
    $("#btn-do-task").addEventListener("click", function (evt) {
      if (!G.gameStarted || G.retired) return;
      doEarlyTask(evt);
    });

    // Intro
    $("#btn-start-game").addEventListener("click", startGame);
    renderIntro();
    // Offline progress
    if (loaded && G.gameStarted && !G.retired) applyOfflineProgress();

    // Main loops
    setInterval(tick, TICK_MS);
    setInterval(renderAll, 200);

    // Initial render
    renderAll();
  }

  function fillCheatCompany(targetClusters) {
    if (G.phase < 4) return;
    if (G.phase < 9) {
      while (sharedAgentCount() < getHireAgentCapacity() || (G.phase >= 7 && !G.agents.some((agent) => agent.roleId === "devops"))) {
        const candidates = availableHireRoles().sort((a, b) => Number(UTILITY_ROLES.includes(b.id)) - Number(UTILITY_ROLES.includes(a.id)) || G.agents.filter((agent) => agent.roleId === a.id).length - G.agents.filter((agent) => agent.roleId === b.id).length);
        const before = G.agents.length;
        for (const role of candidates) {
          hireAgent(role.id);
          if (G.agents.length > before) break;
        }
        if (G.agents.length === before) break;
      }
      return;
    }
    while (G.clusters.length < targetClusters && G.clusters.length < clusterCapacity()) openCluster();
    tickConstruction(12);
    for (const cluster of G.clusters) {
      if (G.phase < 12) {
        while (cluster.workerAgentIds.length < cluster.workerSlotsMax) buyClusterWorker(cluster.id);
      } else if (!cluster.managerAssigned || cluster.workforce < cluster.workerSlotsMax) {
        G.lastCeoAction = 0;
        tickAiCeo();
      }
    }
    tickConstruction(12);
  }

  function loadCheatStage(stage) {
    const early = { "0_1": 0, "0_2": 11, "0_3": 14, "1": 89 };
    const number = Number(stage);
    const target = UPGRADES.find((upgrade) => upgrade.unlockPhase === number);
    if (!Object.hasOwn(early, stage) && !target) return;
    const phase = target ? number - 1 : 1;
    G = defaultState();
    G.gameStarted = true;
    G.totalTasksDone = target ? 100000000 : early[stage];
    G.totalIncidents = 3;
    G.incidentsExplained = true;
    G.cash = 1e15;
    const preceding = UPGRADES.filter((upgrade) => upgrade.oneTime && upgrade.phase <= phase && (!upgrade.unlockPhase || upgrade.unlockPhase <= phase));
    const requiredClusters = Math.max(phase >= 10 ? 5 : 3, ...preceding.map((upgrade) => upgrade.reqNodes || 0));
    let changed = true;
    while (changed) {
      const before = G.purchasedUpgrades.length + G.agents.length + G.clusters.length;
      fillCheatCompany(requiredClusters);
      for (const upgrade of preceding) purchaseUpgrade(upgrade.id);
      changed = before !== G.purchasedUpgrades.length + G.agents.length + G.clusters.length;
    }
    fillCheatCompany(requiredClusters);
    tickConstruction(12);
    if (target && target.reqNodes) fillCheatCompany(Math.max(3, target.reqNodes - 1));
    G.totalTasksDone = target ? (phase >= 12 ? (phase === 12 ? 3000000 : phase === 13 ? 8000000 : 20000000) : target.reqTasks - 3) : early[stage];
    G.totalClicks = G.totalTasksDone * 8;
    G.cash = target ? Math.ceil(getUpgradeCost(target) * 1.25) + (number === 6 ? 25000 : 1000) : number === 1 ? 90 : G.totalTasksDone * 4;
    G.tokens = phase >= 9 ? Math.max(100000, G.clusters.length * 12000) : phase >= 6 ? 50000 : phase >= 3 ? 10000 : 0;
    G.aiWorkerTokenTank = phase >= 2 && !G.aiWorkerShutdown ? workerTokenCapacity() : 0;
    G.managerTokenTank = phase >= 6 && phase < 9 ? MANAGER_TOKEN_TANK_MAX : 0;
    G.aiRunSeconds = 0;
    G.totalIncidents = phase >= 3 ? 3 : 0;
    G.incidentsExplained = phase >= 3;
    G.incidents = [];
    G.tasks = [];
    G.activeTaskId = null;
    G.aiWorkerCurrentTaskId = null;
    for (const agent of G.agents) {
      agent.currentTask = null;
      agent.status = "idle";
      agent.tokenTank = UTILITY_ROLES.includes(agent.roleId) ? 0 : workerTokenCapacity(agent);
    }
    for (const cluster of G.clusters) cluster.tank = MANAGER_TOKEN_TANK_MAX;
    G.log = [];
    G.milestonesReached = [];
    checkMilestones();
    G.lastTick = Date.now();
    G.lastTaskSpawn = Date.now();
    G.lastCeoAction = Date.now();
    popupQueue = [];
    dismissPopup();
    $("#intro-overlay").classList.add("hidden");
    log("Debug checkpoint: Phase " + G.phase + (target ? ", before " + target.name : "") + ".", "info");
    syncMusicPlayback();
    renderAll();
    save();
  }

  // Historical checkpoint notes retained from the original fixtures.
  // Initial state after start
  // -> Pressure Building (task 12)
  // -> Tools of the Trade (task 20)
  // -> Reality Check / expenses (task 90)
  // -> Discover Free-Tier AI / phase 2 (task 110)
  // -> Pro AI Subscription / phase 3
  // -> Multi-Bot License / phase 4
  // Phase 5 entry: web/code upgrades available
  // Phase 6 entry: manager works before playbooks
  // Phase 7 entry: Token budget console
  // Phase 7 entry: Token budget console
  // Phase 9 entry: single cluster Alpha
  // Phase 9: second cluster upgrade available soon
  // Phase 9: second cluster can be purchased
  // Purchase all available upgrades (loop until stable for phase unlocks)
  // Fill all currently available hire slots
  // Clean up side effects from purchases

  // ---------- PUBLIC API (for onclick handlers) ----------
  window.GAME = {
    clickTask: function (id, evt) { clickTask(id, evt); },
    aiAssist: function (id, evt) { aiAssistTask(id, evt); },
    toggleAiAutopilot: toggleAiAutopilot,
    topUpAiWorker: topUpAiWorker,
    shutdownAiWorker: shutdownAiWorker,
    topUpAgent: topUpAgent,
    topUpManager: topUpManager,
    openCluster: function () { if (canManuallyProvisionCluster()) openCluster(); },
    toggleDeliveryTasks: toggleDeliveryTasks,
    sellCluster: sellCluster,
    buyClusterWorker: buyClusterWorker,
    assignAgent: assignAgentToTask,
    autoAssign: function (id) { topUpAgent(id); },
    hire: hireAgent,
    fire: fireAgent,
    buy: purchaseUpgrade,
    resolveInc: resolveIncident,
    toggleAgentAuto: toggleAgentAuto,
    prestige: function () { prestige(); renderAll(); },
    trueRetire: finishRetirement,
    // Cheats - jump to specific game stages for testing
    cheat: loadCheatStage,
    // Debug
    get state() { return G; },
    addCash: function (n) { G.cash += n; },
    addTokens: function (n) { G.tokens += n; },
    setPhase: function (n) { G.phase = n; checkMilestones(); },
    addTasks: function (n) { G.totalTasksDone += n; checkMilestones(); syncMusicPlayback(); },
    resetSave: function () { performFullReset(); },
  };

  for (const name of Object.keys(window.GAME)) {
    if (typeof window.GAME[name] !== "function" || name === "resetSave") continue;
    const action = window.GAME[name];
    window.GAME[name] = function (...args) {
      if (G.retired && !["prestige", "trueRetire", "cheat"].includes(name)) return;
      return action(...args);
    };
  }

  // Console shortcuts
  var cheatShortcuts = [
    "0_1", "0_2", "0_3", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
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
