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

  function neocloudIdentity(number) {
    const [name, prefix] = NEOCLOUD_NAMES[(number - 1) % NEOCLOUD_NAMES.length];
    const generation = Math.floor((number - 1) / NEOCLOUD_NAMES.length);
    return { name: name + (generation ? " " + (generation + 1) : ""), prefix, id: "NC-" + String(number).padStart(3, "0") };
  }

  function clusterCode(number) {
    return neocloudIdentity(Math.floor((number - 1) / NEOCLOUD_SIZE) + 1).prefix + "-" + String(number).padStart(4, "0");
  }

  function clusterDisplayName(cluster) {
    return clusterCode(Number(cluster.name.slice(8)));
  }

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
      workerSlotsMax: G.phase >= 12 || G.ceoMode === "scale" || G.purchasedUpgrades.includes("cluster_capacity_16") ? 16 : G.purchasedUpgrades.includes("network_density") ? 9 : 8,
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
  const MAX_TASKS = 30;
  const AGENT_WORK_MULT = 25; // base multiplier for agent work speed
  const MAX_LOG = 200;
  const AGENT_BASE_HIRE_COST = 250;
  const AGENT_HIRE_COST_MULT = 1.9;
  const ASSISTANT_BREAK_SECONDS = 2;
  const ASSISTANT_BREAK_LABELS = ["Break time", "Lunch", "Dentist", "Sleeping"];
  const MANUAL_WORK_SECONDS_PER_CLICK = 0.15;
  const MANUAL_REPAIR_SECONDS = 2;
  // Keep AI throughput after moving the early 4.5x click-power bonuses into manual queues.
  const AI_WORK_MULT_PHASE2 = 2.8125;
  const AI_WORK_MULT_PHASE3 = 8.1;
  const AI_FAIL_BASE_PHASE2_PER_SEC = 0.018;
  const AI_FAIL_BASE_PHASE3_PER_SEC = 0.009;
  const AI_FAIL_REWORK_FRACTION = 0.15;
  const MANAGER_TOPUP_COST_TOKEN = 4000;
  const MANAGER_TOKEN_TANK_MAX = 4000;
  const STALL_LOG_COOLDOWN_MS = 3000;
  const TASK_EXPIRY_MS = 30000;
  const EARLY_TASK_WORK_MULT = 0.5;
  const OPENING_GIGS = [
    { name: "Deliver a pizza", description: "Take a hot pizza to a customer nearby." },
    { name: "Wash a car", description: "Wash a neighbour's car and clean the windows." },
    { name: "Help write an email", description: "Help someone turn their rough notes into a clear email." },
  ];
  const AI_TUTORIAL_SECONDS = 20;
  const SOUNDTRACKS = [
    { minTasks: 12, path: "soundtrack-loop.mp3" },
  ];
  const DNB_LAYER_PATH = "dnb_synth_loop.wav";
  const DRUM_LAYERS = [
    { minPhase: 5, path: "precursor_kick.mp3" },
    { minPhase: 9, path: DNB_LAYER_PATH },
  ];
  const MUSIC_TARGET_VOLUME = 0.25;
  const DRUM_TARGET_VOLUME = 0.18;
  const SYNTH_START_PHASE = 6;
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
  const FINAL_PHASE = 17;
  const PHASE_NAMES = { 15: "Global Expansion", 16: "AGI", 17: "Buyout" };
  const SAVE_VERSION = 20;
  const NEOCLOUD_SIZE = 25;
  const NEOCLOUD_NAMES = [
    ["Atlas", "ATL"], ["Boreal", "BOR"], ["Nimbus", "NIM"], ["Meridian", "MER"], ["Aurora", "AUR"],
    ["Cirrus", "CIR"], ["Stratus", "STR"], ["Zenith", "ZEN"], ["Horizon", "HOR"], ["Vega", "VEG"],
    ["Orion", "ORI"], ["Lyra", "LYR"], ["Nova", "NOV"], ["Solstice", "SOL"], ["Polaris", "POL"],
    ["Aster", "AST"], ["Helios", "HEL"], ["Cobalt", "COB"], ["Eclipse", "ECL"], ["Kepler", "KEP"],
    ["Altair", "ALT"], ["Andromeda", "AND"], ["Arcturus", "ARC"], ["Cassiopeia", "CAS"], ["Celeste", "CEL"],
    ["Comet", "COM"], ["Corona", "COR"], ["Cosmos", "COS"], ["Cygnus", "CYG"], ["Draco", "DRA"],
    ["Equinox", "EQU"], ["Halcyon", "HLC"], ["Halo", "HLO"], ["Ion", "ION"], ["Iris", "IRI"],
    ["Lumen", "LUM"], ["Luna", "LUN"], ["Nebula", "NEB"], ["Oberon", "OBE"], ["Odyssey", "ODY"],
    ["Pulsar", "PUL"], ["Quasar", "QUA"], ["Radiant", "RAD"], ["Rigel", "RIG"], ["Sirius", "SIR"],
    ["Spectra", "SPE"], ["Tempest", "TEM"], ["Titan", "TIT"], ["Umbra", "UMB"], ["Vesper", "VES"],
  ];
  const ENDING_FADE_OUT_MS = 3000;
  const ENDING_BLACK_PAUSE_MS = 400;
  const ENDING_FADE_IN_MS = 1200;

  const CLUSTER_COST = 50000;

  const TASK_TYPES = [
    { id: "email", name: "Write Email", icon: "\u2709\uFE0F", baseWork: 5, basePay: 3, phase: 1 },
    { id: "research", name: "Research Snippet", icon: "\uD83D\uDD0D", baseWork: 7, basePay: 5, phase: 1 },
    { id: "spreadsheet", name: "Spreadsheet Entry", icon: "\uD83D\uDCCA", baseWork: 6, basePay: 4, phase: 1 },
    { id: "social", name: "Social Media Post", icon: "\uD83D\uDCF1", baseWork: 4, basePay: 2, phase: 1 },
    { id: "copy", name: "Copywriting", icon: "\u270D", baseWork: 8, basePay: 7, phase: 1 },
    { id: "article", name: "Blog Article", icon: "\uD83D\uDCDD", baseWork: 14, basePay: 15, phase: 3 },
    { id: "report", name: "Data Report", icon: "\uD83D\uDCC8", baseWork: 17, basePay: 20, phase: 3 },
    { id: "code", name: "Small Script", icon: "\uD83D\uDCBB", baseWork: 20, basePay: 25, phase: 7 },
    { id: "integration", name: "API Integration", icon: "\uD83D\uDD17", baseWork: 28, basePay: 40, phase: 7 },
    { id: "webapp", name: "Mini Web App", icon: "\uD83C\uDF10", baseWork: 45, basePay: 70, phase: 10 },
    { id: "saas", name: "SaaS Feature", icon: "\u2601", baseWork: 68, basePay: 110, phase: 11 },
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
    { id: "token_mgr", name: "Token Assistant", icon: "\uD83E\uDE99", color: "#0ea5e9", specialty: [], statBias: { speed: 1.0, quality: 1.0, reliability: 1.0 } },
  ];

  const AGENT_MARKERS = { original_ai: "AI", writer: "WR", researcher: "RS", coder: "CD", analyst: "AN", support: "SP", manager: "MG", devops: "OP", sales: "SL", token_mgr: "TA" };

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
    { id: "hallucination", name: "Hallucinated Output Published", desc: "An agent published confident nonsense to a client.", phase: 2 },
    { id: "token_burn", name: "Token Budget Exceeded", desc: "An agent entered a reasoning loop and burned through tokens.", tokenCost: 50, phase: 3 },
    { id: "wrong_email", name: "Wrong Email Sent", desc: "An agent emailed the wrong client with another client's data.", phase: 7 },
    { id: "conflict", name: "Agent Conflict", desc: "Two agents overwrote each other's work.", phase: 9 },
    { id: "outage", name: "Deployment Outage", desc: "A deployed service went down. Clients are unhappy.", cashCost: 20, phase: 11 },
    { id: "drift", name: "Alignment Drift", desc: "Agents optimised for the wrong metric. Output quality dropped.", phase: 12 },
    { id: "overcharge", name: "Billing Spike", desc: "Compute costs surged from an unoptimised workflow.", cashCost: 30, phase: 8 },
    { id: "data_leak", name: "Data Mix-up", desc: "Training data from one client leaked into another's output.", phase: 10 },
  ];

  // ---------- UPGRADES DEFINITIONS ----------
  const UPGRADES = [
    // Early scrappy upgrades (milestone-gated by reqTasks)
    // Likely to have ~$110 at this point
    { id: "tools_of_trade", name: "Tools of the Trade", desc: "Maybe some better tools would help you keep up...", cost: 0, currency: "cash", phase: 1, introductory: true, oneTime: true, reqTasks: 7 },
    { id: "hire_assistant", name: "Hire a Part-Time Assistant", desc: "Delegate easier tasks", cost: 30, currency: "cash", phase: 1, oneTime: true, reqTasks: 7 },
    { id: "gas_station_coffee", name: "Gas Station Coffee", desc: "Tasks pay 15% more. Caffeine helps.", cost: 51, currency: "cash", phase: 1, effect: { payMult: 1.15 }, oneTime: true, reqTasks: 7 },
    { id: "sticky_note_system", name: "A Box Of Paperclips", desc: "Record who's asking for what.", cost: 34, currency: "cash", phase: 1, effect: { taskDetails: true }, oneTime: true, reqTasks: 7 },
    { id: "assistant_settling", name: "Settling In", desc: "Your assistant works 25% faster.", cost: 10, currency: "cash", phase: 1, requires: "hire_assistant", oneTime: true, reqTasks: 8 },
    { id: "assistant_routine", name: "Knows the Routine", desc: "Your assistant works another 25% faster.", cost: 15, currency: "cash", phase: 1, requires: "assistant_settling", oneTime: true, reqTasks: 12 },
    { id: "ai_hint", name: "There Must Be a Better Way", desc: "You are getting faster, but the work never stops. Maybe there is a smarter way...", cost: 0, currency: "cash", phase: 1, introductory: true, oneTime: true, reqTasks: 35 },
    { id: "side_hustle", name: "Side Hustle Optimization", desc: "Tasks pay 20% more.", cost: 41, currency: "cash", phase: 1, effect: { payMult: 1.2 }, oneTime: true, reqTasks: 35 },
    { id: "multitasking", name: "Multitasking", desc: "Do one task with each hand", cost: 61, currency: "cash", phase: 1, requires: "hire_assistant", oneTime: true, reqTasks: 35 },
    { id: "inbox_zero", name: "Inbox Zero Method", desc: "Tasks require 15% less work. A clear inbox, a clear mind.", cost: 51, currency: "cash", phase: 1, effect: { workReduction: 0.15 }, oneTime: true, reqTasks: 35 },
    { id: "focus_timer", name: "Focus Timer (Pomodoro)", desc: "Tasks require 20% less work.", cost: 79, currency: "cash", phase: 1, effect: { workReduction: 0.2 }, oneTime: true, reqTasks: 50 },

    // Phase 1 -> 2
    { id: "dual_monitors", name: "Dual Monitors", desc: "+25% pay for all tasks.", cost: 80, currency: "cash", phase: 1, effect: { payMult: 1.25 }, oneTime: true, reqTasks: 50 },
    { id: "noise_cancelling", name: "Noise-Cancelling Headphones", desc: "Clearer focus and instructions. All tasks require 10% less work.", cost: 99, currency: "cash", phase: 1, effect: { workReduction: 0.1 }, oneTime: true, reqTasks: 50 },
    { id: "reality_check", name: "Reality Check", desc: "Your phone bill is due. Your car needs gas. Living costs money, even in a parking lot. Click to start paying expenses.", cost: 0, currency: "cash", phase: 1, introductory: true, oneTime: true, reqTasks: 85 },
    { id: "free_ai", requires: "reality_check", name: "Discover Free-Tier AI", desc: "Your first AI works through tasks automatically.", cost: 0, currency: "tasks", phase: 1, unlockPhase: 2, oneTime: true, revealTasks: 105, reqTasks: 150 },

    // Phase 2 -> 3
    { id: "incident_info", name: "Your First Incident", desc: "Automation make mistakes that disrupt work and cost money. Keep on top of fixing them.", cost: 0, currency: "cash", phase: 2, infoUntilPhase: 9, reqIncidents: 1, introductory: true, optional: true, oneTime: true },
    { id: "prompt_library", name: "Prompt Library", desc: "Reuse successful prompts. AI completes 10% more work per prompt.", cost: 150, currency: "cash", phase: 2, effect: { aiPowerMult: 1.1 }, oneTime: true, reqTasks: 115 },
    { id: "gig_alerts", name: "Gig Alerts", desc: "Find new work sooner. Tasks arrive 25% faster.", cost: 250, currency: "cash", phase: 2, effect: { taskSpawnMult: 1.25 }, oneTime: true, reqTasks: 145 },
    { id: "prompt_examples", name: "Few-Shot Prompting", desc: "30% more work per prompt", cost: 450, currency: "cash", phase: 2, effect: { aiPowerMult: 1.3 }, oneTime: true, reqTasks: 175 },
    { id: "marketing_campaign", name: "Marketing Campaign", desc: "Your first marketing campaign. Tasks arrive 75% faster.", cost: 400, currency: "cash", phase: 2, effect: { payMult: 1.6, taskSpawnMult: 1.75 }, oneTime: true, reqTasks: 200 },
    { id: "pro_model", name: "Upgrade to AI 2000 Basic", desc: "A larger token allowance for longer sessions.", cost: 2000, currency: "cash", phase: 2, unlockPhase: 3, oneTime: true, reqTasks: 300 },

    // Phase 3 -> 4
    // Retired info cards have an empty phase range; their IDs remain valid in saved progress.
    { id: "token_info", name: "Keeping AI Running", desc: "Your Basic upgrade added 50 tokens to your reserve. AI uses tokens while working and stops when its tank is empty. Buy token packs to refill your reserve, then use Add tokens on each AI to fill its tank.", cost: 0, currency: "cash", phase: 3, infoUntilPhase: 0, introductory: true, optional: true, oneTime: true },
    { id: "token_pack_1", name: "Token Pack (200)", desc: "Get 200 tokens.", cost: 110, currency: "cash", phase: 3, effect: { giveTokens: 200 }, oneTime: false },
    { id: "token_optimizer", name: "KV Caching", desc: "Reduces token use by 20%.", cost: 1000, currency: "cash", phase: 3, effect: { tokenEfficiency: 0.8 }, oneTime: true, reqTasks: 350},
    { id: "guardrails", name: "Output Guardrails", desc: "Validation layer catches hallucinations. AI failure rate -30%.", cost: 1200, currency: "cash", phase: 3, effect: { aiFailMult: 0.7 }, oneTime: true, reqTasks: 350 },
    { id: "token_compressor", name: "Prompt Compression", desc: "Shorter prompts reduce AI token use by 25%.", cost: 1500, currency: "cash", phase: 3, effect: { tokenEfficiency: 0.75 }, oneTime: true, reqTasks: 350 },
    { id: "premium_support", name: "Premium Support", desc: "Priority response times. Clients are thrilled.", cost: 800, currency: "cash", phase: 3, effect: { payMult: 1.05 }, oneTime: true, reqTasks: 425 },
    { id: "token_distiller", name: "Model Distillation", desc: "Reduces token use by 33%.", cost: 1500, currency: "cash", phase: 3, effect: { tokenEfficiency: 0.67 }, oneTime: true, reqTasks: 425 },
    { id: "faster_inference", name: "Faster Inference", desc: "Your AI subscription completes tasks twice as fast.", cost: 1200, currency: "cash", phase: 3, effect: { aiPowerMult: 2 }, oneTime: true, reqTasks: 425 },
    { id: "billboard_campaign", name: "Billboard", desc: "A large advert on the side of a nearby building. More demand and higher pay.", cost: 2000, currency: "cash", phase: 3, effect: { payMult: 2.0 }, oneTime: true, reqTasks: 500 },
    { id: "structured_output", name: "Structured Outputs", desc: "JSON mode makes task results 35% more valuable.", cost: 3000, currency: "cash", phase: 3, effect: { payMult: 1.35 }, oneTime: true, reqTasks: 500 },
    { id: "client_outreach", name: "Client Outreach", desc: "Build a steady pipeline for both subscriptions. Tasks arrive twice as often.", cost: 4500, currency: "cash", phase: 3, effect: { taskSpawnMult: 2 }, oneTime: true, reqTasks: 650 },
    { id: "second_ai", requires: "client_outreach", showBeforeRequires: true, name: "Second AI Subscription", desc: "Replace your assistant with AI 2000 Pro", cost: 18000, currency: "cash", phase: 3, unlockPhase: 4, oneTime: true, reqTasks: 650 },
    // Phase 4 -> 5
    { id: "inference_tuning", requires: "second_ai", name: "Inference Tuning", desc: "Tune both subscriptions to work 15% faster.", cost: 6000, currency: "cash", phase: 4, effect: { aiPowerMult: 1.15, agentSpeedMult: 1.15 }, oneTime: true, reqTasks: 900 },
    { id: "prompt_refinement", requires: "inference_tuning", name: "Prompt Refinement", desc: "Polish reusable prompts. Both subscriptions work 5% faster.", cost: 1500, currency: "cash", phase: 4, effect: { aiPowerMult: 1.05, agentSpeedMult: 1.05 }, oneTime: true, reqTasks: 925 },
    { id: "context_pruning", requires: "prompt_refinement", name: "Context Pruning", desc: "Trim unnecessary context. Both subscriptions use 5% fewer tokens.", cost: 2500, currency: "cash", phase: 4, effect: { tokenEfficiency: 0.95 }, oneTime: true, reqTasks: 950 },
    { id: "multi_bot", name: "Multi-Agent Licence", requires: "context_pruning", visibleAfter: "inference_tuning", desc: "More agents, more work.", cost: 25000, currency: "cash", phase: 4, unlockPhase: 5, oneTime: true, reqTasks: 1000 },

    // Phase 5 -> 6
    { id: "agent_onboarding", name: "Agent Onboarding Guide", desc: "Better instructions for agents. +15% agent speed.", cost: 1100, currency: "cash", phase: 5, effect: { agentSpeedMult: 1.15 }, oneTime: true },
    { id: "inbound_pipeline", name: "Inbound Pipeline", desc: "Run an early growth push. Tasks arrive 30% faster.", cost: 1800, currency: "cash", phase: 5, effect: { taskSpawnMult: 1.3 }, oneTime: true },
    { id: "task_templates", name: "Task Templates", desc: "Pre-written briefs. Tasks require 15% less work.", cost: 2400, currency: "cash", phase: 5, effect: { workReduction: 0.15 }, oneTime: true },
    { id: "agent_slot_3", name: "Additional Agent Slot", desc: "Add room for one more agent.", cost: 5000, currency: "cash", phase: 5, effect: { agentSlots: 3 }, oneTime: true, requires: "task_templates", reqAgents: 3 },
    { id: "client_crm", name: "Client Tracker", desc: "Keep clients happy. Tasks pay 40% more.", cost: 2500, currency: "cash", phase: 5, effect: { payMult: 1.4 }, oneTime: true },
    { id: "prompt_basics", name: "Prompt Engineering 101", desc: "Reduce AI failure rate by 20%.", cost: 3200, currency: "cash", phase: 5, effect: { aiFailMult: 0.8 }, oneTime: true, reqTasks: 350, reqIncidents: 3 },
    { id: "error_handling", name: "Error Recovery Protocol", desc: "Agents fail less often. -20% AI failure rate.", cost: 4000, currency: "cash", phase: 5, effect: { aiFailMult: 0.8 }, oneTime: true },
    { id: "parallel_prompts", name: "Parallel Prompting", desc: "Run independent steps together. Agents work 15% faster.", cost: 3800, currency: "cash", phase: 5, requires: "agent_slot_3", effect: { agentSpeedMult: 1.15 }, oneTime: true },
    { id: "response_streaming", name: "Response Streaming", desc: "Process results as they arrive. Agents work 20% faster.", cost: 5200, currency: "cash", phase: 5, requires: "parallel_prompts", effect: { agentSpeedMult: 1.2 }, oneTime: true },
    { id: "agent_slot_5", requires: "response_streaming", name: "Two More Agent Slots", desc: "Add room for two more agents.", cost: 6500, currency: "cash", phase: 5, effect: { agentSlots: 5 }, oneTime: true },
    { id: "tool_use", name: "Tool Use SDK", desc: "Agents can use tools.", cost: 12000, currency: "cash", phase: 5, unlockPhase: 6, oneTime: true, reqTasks: 1150 },

    // Phase 6 (operations pressure)
    { id: "web_browse", name: "Web Search Tool", desc: "Agents can browse the web. +15% agent speed, +20% quality on research.", cost: 7500, currency: "cash", phase: 6, effect: { toolBonus: 0.2, agentSpeedMult: 1.15 }, oneTime: true },
    { id: "bulk_jobs", name: "Bulk Processing", desc: "Deliver around 10 tasks in each job.", cost: 9000, currency: "cash", phase: 6, effect: { batchSize: 10 }, oneTime: true },
    { id: "sales_playbook", name: "Sales Playbook", desc: "Sharper discovery and handoff process. Sales increase by 50%.", cost: 12000, currency: "cash", phase: 6, effect: { payMult: 1.5 }, oneTime: true },
    { id: "code_exec", name: "Code Execution Tool", desc: "Agents can run code. +25% speed on code tasks.", cost: 16000, currency: "cash", phase: 6, effect: { codeSpeedMult: 1.25 }, oneTime: true },
    { id: "revenue_ops", name: "Revenue Ops System", desc: "Pipeline discipline and better follow-up. Sales increase by 50%.", cost: 28000, currency: "cash", phase: 6, effect: { payMult: 1.50 }, oneTime: true },
    { id: "workflow_orchestration", name: "Workflow Orchestration", desc: "Keep the team moving. Tasks arrive 25% faster and agents work 20% faster.", cost: 18000, currency: "cash", phase: 6, effect: { taskSpawnMult: 1.25, agentSpeedMult: 1.2 }, oneTime: true, reqTasks: 3500 },
    { id: "manager_agent", name: "Manager Agent", desc: "Add a Manager role to coordinate your agents.", cost: 12000, currency: "cash", phase: 6, unlockPhase: 7, effect: { managerUnlock: true, agentSlots: 6 }, oneTime: true, reqTasks: 5000 },

    // Phase 7 (manager-led automation)
    { id: "scheduling", name: "Auto-Assign Playbooks", desc: "Coordinate batches of around 100 tasks. Assignment is 50% faster.", cost: 15000, currency: "cash", phase: 7, effect: { batchSize: 100, managerAssignMult: 1.5, agentAutoAssign: true }, oneTime: true },
    { id: "smart_routing", name: "Smart Routing", desc: "Manager can route agents across specialties when needed.", cost: 19000, currency: "cash", phase: 7, effect: { smartRouting: true }, oneTime: true },
    { id: "neural_boost", name: "Neural Architecture Boost", desc: "Optimised model weights. All agents work 35% faster.", cost: 25000, currency: "cash", phase: 7, effect: { agentSpeedMult: 1.35 }, oneTime: true, reqTasks: 580 },
    { id: "token_manager_unlock", name: "Token Assistant Slot", desc: "Buys token for manager agent", cost: 40000, currency: "cash", phase: 7, requiresRole: "manager", unlockPhase: 8, effect: { giveTokens: 300, agentSlots: 7 }, oneTime: true, reqTasks: 30000 },

    // Phase 8 (token-stable autopilot)
    { id: "agent_slot_7", name: "Add Another Agent Slot", desc: "Room for another agent.", cost: 22000, currency: "cash", phase: 9, requiresRole: "token_mgr", effect: { agentSlots: 8 }, oneTime: true, reqTasks: 670 },
    { id: "compute_2", name: "Revenue Optimization Upgrade", desc: "Deliver batches of around 500 tasks. Double revenue.", cost: 150000, currency: "cash", phase: 8, effect: { batchSize: 500, payMult: 2.0 }, oneTime: true, reqTasks: 45000 },
    { id: "devops_unlock", name: "DevOps Agent Slot", desc: "Automate incident response.", cost: 60000, currency: "cash", phase: 8, oneTime: true, reqTasks: 28000 },
    { id: "compute_1", name: "Incident Runbooks", desc: "DevOps resolves incidents 20% faster.", cost: 175000, currency: "cash", phase: 8, effect: { devopsIncidentMult: 1.2 }, oneTime: true, reqTasks: 65000 },
    { id: "delivery_pipeline", name: "Delivery Pipeline", desc: "A smoother handoff. All agents work 25% faster.", cost: 250000, currency: "cash", phase: 8, effect: { agentSpeedMult: 1.25 }, oneTime: true, reqTasks: 90000 },
    { id: "premium_contracts", name: "Premium Client Contracts", desc: "Win better client work. All tasks pay 35% more.", cost: 350000, currency: "cash", phase: 8, effect: { payMult: 1.35 }, oneTime: true, reqTasks: 115000 },
    { id: "ops_flywheel", name: "Ralph-loops", desc: "Agents work for longer and check their work.", cost: 1000000, currency: "cash", phase: 8, unlockPhase: 9, effect: { payMult: 1.50 }, oneTime: true, reqTasks: 150000 },

    // Phase 9 (growth marketing)
    { id: "growth_marketing", name: "Growth Marketing Engine", desc: "Serve larger clients with batches of around 2,000 tasks. Double revenue.", cost: 300000, currency: "cash", phase: 9, effect: { batchSize: 2000, payMult: 2.00 }, oneTime: true, reqTasks: 175000 },
    { id: "management", name: "Referral Partnerships", desc: "Partner channels bring higher-value client work.", cost: 500000, currency: "cash", phase: 9, effect: { payMult: 1.50 }, oneTime: true, reqTasks: 350000 },
    { id: "enterprise_pipeline", name: "Enterprise Sales Pipeline", desc: "Larger accounts bring 25% more demand and 25% more revenue.", cost: 1000000, currency: "cash", phase: 9, effect: { taskSpawnMult: 1.25, payMult: 1.25 }, oneTime: true, reqTasks: 600000 },
    { id: "project_playbooks", name: "Long-Running Project Playbooks", desc: "Keep longer projects moving. Agents work 25% faster.", cost: 750000, currency: "cash", phase: 9, effect: { agentSpeedMult: 1.25 }, oneTime: true, reqTasks: 720000 },
    { id: "account_expansion", name: "Account Expansion", desc: "Grow existing client accounts. Tasks arrive 20% faster and pay 30% more.", cost: 1250000, currency: "cash", phase: 9, effect: { taskSpawnMult: 1.2, payMult: 1.3 }, oneTime: true, reqTasks: 860000 },
    { id: "acquire_micro_agency", name: "Acquire Micro Agency", desc: "Bring your team together as a managed cluster.", cost: 1500000, currency: "cash", phase: 9, unlockPhase: 10, effect: { agentSlots: 10 }, oneTime: true, reqTasks: 1000000 },

    // Phase 10 (clusterization)

    { id: "cluster_info", name: "Your First Cluster", desc: "Your team is now ATL-0001, with Manager, Token Assistant and DevOps included. Buy the Second Cluster Permit, bring another cluster online, then provision its agents.", cost: 0, currency: "cash", phase: 10, infoUntilPhase: 0, introductory: true, optional: true, oneTime: true },
    { id: "code_agents", name: "Cluster Operations Blueprint", desc: "Standardise cluster operations. Reduce debt growth by 25% and improve output quality by 10%.", cost: 1500000, currency: "cash", phase: 10, effect: { debtReduction: 0.25, codeQualityMult: 1.1 }, oneTime: true, reqTasks: 1050000 },
    { id: "cluster_capacity_2", name: "Second Cluster Permit", desc: "Unlock Provision cluster and room for one more cluster.", cost: 2500000, currency: "cash", phase: 10, requires: "code_agents", effect: {}, oneTime: true, reqTasks: 1150000 },
    { id: "cluster_capacity_3", name: "Third Cluster Permit", desc: "Add room for a third cluster.", cost: 12000000, currency: "cash", phase: 10, requires: "cluster_capacity_2", effect: {}, oneTime: true, reqTasks: 1500000 },
    { id: "testing", name: "Cluster Runbooks", desc: "Reduce technical debt growth and tighten incident handling.", cost: 3500000, currency: "cash", phase: 10, effect: { debtReduction: 0.3, devopsIncidentMult: 1.15 }, oneTime: true, reqTasks: 1750000 },
    { id: "code_review", name: "Cross-Cluster QA Mesh", desc: "Improves cluster output quality by 25%.", cost: 5000000, currency: "cash", phase: 10, effect: { codeQualityMult: 1.25 }, oneTime: true, reqTasks: 2000000 },
    { id: "deploy", name: "Cluster Revenue Platform", desc: "Sign ongoing client contracts for regular income.", cost: 6500000, currency: "cash", phase: 10, effect: { serviceSlots: 2, payMult: 1.12 }, oneTime: true, reqTasks: 2250000 },
    { id: "ceo_readiness", name: "AI CEO Readiness", desc: "Formalize org controls so an AI CEO can take over.", cost: 35000000, currency: "cash", phase: 10, unlockPhase: 11, effect: {}, oneTime: true, reqTasks: 2500000 },

    // Phase 11 (AI CEO)
    { id: "ai_ceo", name: "AI CEO", desc: "AI CEO takes over cluster coordination and budgets.", cost: 1000000, currency: "cash", phase: 11, effect: { aiCeo: true }, oneTime: true, reqTasks: 1320 },
    { id: "ceo_recruitment", name: "Provisioning Pipeline", desc: "The CEO adds agents and coordinates twice as often.", cost: 25000000, currency: "cash", phase: 11, requires: "ai_ceo", oneTime: true },
    { id: "network_density", name: "Re-architect Network", desc: "Increase cluster density. Add one agent slot per cluster.", cost: 30000000, currency: "cash", phase: 11, requires: "ai_ceo", effect: { clusterSlots: 9 }, oneTime: true },
    { id: "ceo_deploy_speed", name: "Faster AI Provisioning", desc: "Provision agents 50% faster.", cost: 40000000, currency: "cash", phase: 11, requires: "network_density", oneTime: true },
    { id: "cluster_capacity_16", name: "High-Density Clusters", desc: "Optimise cluster space for more agent slots.", cost: 50000000, currency: "cash", phase: 11, requires: "ceo_deploy_speed", effect: { clusterSlots: 16 }, oneTime: true },
    { id: "ceo_batch", name: "Dual Agent Provisioning", desc: "Provision two agents at once.", cost: 75000000, currency: "cash", phase: 11, requires: "cluster_capacity_16", oneTime: true },
    { id: "server_1", name: "AI CEO Scale Mode", desc: "Let the AI CEO create and staff new clusters automatically.", cost: 200000000, currency: "cash", phase: 11, requires: "ceo_batch", unlockPhase: 12, effect: { ceoScale: true, agentSpeedMult: 1.5, payMult: 1.3, serviceSlots: 5 }, oneTime: true, reqTasks: 1400 },
    { id: "ceo_quad_batch", name: "Four-Agent Provisioning", desc: "Provision four agents at once.", cost: 100000000, currency: "cash", phase: 12, requires: "server_1", oneTime: true },
    { id: "ceo_parallel_clusters", name: "Parallel Cluster Builds", desc: "Build two clusters at once.", cost: 150000000, currency: "cash", phase: 12, requires: "ceo_quad_batch", oneTime: true },
    { id: "ceo_fast_builds", name: "Preassembled Server Racks", desc: "Halve cluster construction time.", cost: 200000000, currency: "cash", phase: 12, requires: "server_1", oneTime: true },
    { id: "server_2", name: "Autonomous Expansion Desk", desc: "Refine expansion workflows. Task pay increases by 20%.", cost: 2500000, currency: "cash", phase: 12, effect: { payMult: 1.2 }, oneTime: true, reqTasks: 1440 },

    { id: "ceo_course", name: "Rapid Cluster Deployment", desc: "Halve cluster build time and double CEO coordination speed.", cost: 300000000, currency: "cash", phase: 12, requires: "ceo_fast_builds", effect: { payMult: 1.2 }, oneTime: true, reqTasks: 1500000 },
    { id: "ceo_full_fit", name: "Fully Fitted Racks", desc: "Install all 16 agents during construction. Agent costs are included in the cluster price.", cost: 400000000, currency: "cash", phase: 12, requires: "ceo_course", oneTime: true },
    { id: "autonomous_nodes", name: "Autonomous Operating Model", desc: "Compact infrastructure for a larger autonomous company.", cost: 760000000, currency: "cash", phase: 12, unlockPhase: 13, effect: { payMult: 1.2 }, oneTime: true, reqTasks: 2000000 },
    { id: "network_info", name: "Running an Autonomous Network", desc: "Your CEO now operates the nodes. Individual agent controls are gone. The CEO builds and staffs nodes automatically; use upgrades to expand capacity and reduce costs.", cost: 0, currency: "cash", phase: 13, infoUntilPhase: 0, introductory: true, optional: true, oneTime: true },
    { id: "ceo_continuous", name: "Continuous Deployment", desc: "Improve deployment speed by 50%.", cost: 150000000, currency: "cash", phase: 13, requires: "ceo_full_fit", oneTime: true },
    { id: "replication", name: "Node Replication", desc: "Build four clusters at once. Reduce cluster costs by 35%.", cost: 1500000000, currency: "cash", phase: 13, reqNodes: 20, unlockPhase: 14, effect: { payMult: 1.15 }, oneTime: true },
    { id: "global_network", name: "Global Expansion", desc: "Reduce node costs another 40%. Each neocloud groups 25 clusters.", cost: 2000000000, currency: "cash", phase: 14, reqNodes: 40, unlockPhase: 15, effect: { payMult: 1.2 }, oneTime: true },
    { id: "neocloud_pipeline", name: "Neocloud Deployment Pipeline", desc: "Halve cluster construction time.", cost: 2000000000, currency: "cash", phase: 15, requires: "global_network", reqNodes: 100, oneTime: true },
    { id: "standardised_construction", name: "Standardised Construction", desc: "Use repeatable cluster designs. Halve cluster construction costs.", cost: 1000000000, currency: "cash", phase: 15, requires: "neocloud_pipeline", reqNodes: 125, oneTime: true },
    { id: "neocloud_batch", name: "Neocloud Construction", desc: "Build 25 clusters at once to fill a whole neocloud.", cost: 2000000000, currency: "cash", phase: 15, requires: "standardised_construction", reqNodes: 150, oneTime: true },
    { id: "bulk_hardware", name: "Bulk Hardware Contracts", desc: "Buy hardware across the network. Halve cluster construction costs again.", cost: 1500000000, currency: "cash", phase: 15, requires: "neocloud_batch", reqNodes: 200, oneTime: true },
    { id: "factory_direct", name: "Factory-Direct Hardware", desc: "Buy directly from manufacturers. Lower hardware costs and keep future price increases linear.", cost: 2000000000, currency: "cash", phase: 15, requires: "bulk_hardware", reqNodes: 400, oneTime: true },
    { id: "neocloud_supply_chain", name: "Dedicated Hardware Supply", desc: "Halve cluster construction time again.", cost: 2500000000, currency: "cash", phase: 15, requires: "factory_direct", reqNodes: 450, oneTime: true },
    { id: "parallel_neoclouds", name: "Parallel Neoclouds", desc: "Build 50 clusters at once across two neoclouds.", cost: 3000000000, currency: "cash", phase: 15, requires: "neocloud_supply_chain", reqNodes: 500, oneTime: true },
    { id: "agi_research", name: "Fund AGI Research", desc: "Train a system to run the company, including your part.", cost: 8000000000, currency: "cash", phase: 15, requires: "parallel_neoclouds", reqNodes: 500, unlockPhase: 16, agiDuration: 30, oneTime: true },
    { id: "agi_computer_use", name: "Enable Computer Use", desc: "Teach AGI to inspect the company and use its controls.", cost: 4000000000, currency: "cash", phase: 16, requires: "agi_research", agiDuration: 20, oneTime: true, reserveForPlayer: true },
    { id: "agi_authority", name: "Allow AGI to buy upgrades", desc: "AGI runs three checks. Approve once to let it spend company cash on upgrades.", cost: 6000000000, currency: "cash", phase: 16, requires: "agi_computer_use", oneTime: true, reserveForPlayer: true },
    { id: "agi_contracts", name: "Enterprise Capacity Contracts", desc: "AGI secures dedicated customers. Increase delivery revenue by 25%.", cost: 12000000000, currency: "cash", phase: 16, requires: "agi_authority", agiDuration: 30, effect: { payMult: 1.25 }, oneTime: true },
    { id: "agi_independence", name: "Train Your Replacement", desc: "Complete the founder handover after expansion, delivery and healthy operations milestones.", cost: 20000000000, currency: "cash", phase: 16, requires: "agi_contracts", agiDuration: 45, oneTime: true },
    { id: "retire_unlock", name: "Host Investor Talks", desc: "Invite a group of investors to discuss the company over an exceptionally expensive lunch.", cost: 90000, currency: "cash", phase: 16, requires: "agi_independence", reqNodes: 500, unlockPhase: 17, saleDuration: 8, saleActivity: "Hosting investors and answering questions", saleOutcome: "The investors are interested. Time to bring in someone who has sold a company before.", effect: {}, oneTime: true, reqTasks: 1520 },

    // Phase 12 (retirement)
    // Retirement now follows the four new network stages and AGI, in Phase 17.
    { id: "sale_advisor", name: "Appoint a Sale Advisor", desc: "Commission a valuation and prepare the company for potential buyers.", cost: 5000000, currency: "cash", phase: 17, requires: "retire_unlock", saleDuration: 10, saleActivity: "Preparing the valuation and buyer briefing", saleOutcome: "The advisor has prepared a valuation. Your AI management team would like a word.", oneTime: true },
    { id: "sale_buyout", name: "Discuss a Management Buyout", desc: "Your AI management team has put together a proposal. Apparently it can run things without you.", cost: 20000000, currency: "cash", phase: 17, requires: "sale_advisor", saleDuration: 12, saleActivity: "Reviewing the management team's proposal", saleOutcome: "Management has made an offer. The buyers want a closer look at the business.", oneTime: true },
    { id: "sale_diligence", name: "Complete Due Diligence", desc: "Open the books and review the company's operations, finances and outstanding issues.", cost: 100000000, currency: "cash", phase: 17, requires: "sale_buyout", saleDuration: 18, saleActivity: "Reviewing finances, contracts and operations", saleOutcome: "Due diligence is complete. The lawyers are ready to agree the final terms.", oneTime: true },
    { id: "sale_terms", name: "Agree Sale Terms", desc: "Settle the final offer, sign the agreements and prepare your handover.", cost: 250000000, currency: "cash", phase: 17, requires: "sale_diligence", saleDuration: 10, saleActivity: "Negotiating the final offer and agreements", saleOutcome: "The agreements are signed. One last decision, then your time belongs to you.", oneTime: true },
    { id: "fusion", name: "Complete Company Sale", desc: "Take your golden parachute. Hand over the company and begin your next chapter.", cost: 5000000000, currency: "cash", phase: 17, requires: "sale_terms", reqNodes: 100, effect: {}, oneTime: true, reqTasks: 1560, reserveForPlayer: true },

    // Repeatable
    { id: "token_pack_2", name: "Token Pack (500)", desc: "Get 500 tokens.", cost: 300, currency: "cash", phase: 3, effect: { giveTokens: 500 }, oneTime: false },
  ];

  const AGI_AUTHORITY = UPGRADES.find((upgrade) => upgrade.id === "agi_authority");
  const PLAYER_RESERVED_UPGRADES = UPGRADES.filter((upgrade) =>
    upgrade.reserveForPlayer || (upgrade.phase >= 12 && upgrade.phase <= 15 && upgrade.currency === "cash" && upgrade.oneTime && !upgrade.optional));

  // Expenses tiers
  const EXPENSE_TIERS = [
    { phase: 1, name: "Living in car", rate: 1.0 },
    { phase: 2, name: "Shared coworking desk", rate: 1.5 },
    { phase: 3, name: "Coffee Shop Regular", rate: 2.0 },
    { phase: 5, name: "Home office", rate: 5 },
    { phase: 6, name: "Tooling overhead", rate: 10 },
    { phase: 7, name: "Manager operations", rate: 14 },
    { phase: 8, name: "Token and incident control", rate: 18 },
    { phase: 9, name: "Growth spend + referrals", rate: 28 },
    { phase: 10, name: "Server power & cooling", rate: 45 },
    { phase: 11, name: "AI CEO command stack", rate: 70 },
    { phase: 12, name: "Expansion infrastructure", rate: 120 },
    { phase: 13, name: "Autonomous network", rate: 180 },
    { phase: 14, name: "Replication platform", rate: 250 },
    { phase: 15, name: "Global network", rate: 400 },
    { phase: 16, name: "AGI operations", rate: 400 },
    { phase: 17, name: "Exit prep and legal", rate: 500 },
  ];

  // ---------- MILESTONES ----------
  const MILESTONES = [
    // Task-count based
    { id: "first_task", reqTasks: 2, reveals: ["topBar", "cash"] },
    { id: "backlog_start", reqTasks: 3, reveals: ["taskQueue"], inboxTask: true },
    // Retain the milestone ID so existing saves remain valid.
    { id: "stress_unlock", reqTasks: 12 },
    { id: "upgrades_unlock", reqTasks: 7, reveals: ["upgrades"], setFlags: { taskExpiryEnabled: true } },
    { id: "expenses_unlock", reqTasks: 85, reveals: ["expenseCard"] },
    { id: "income_display", reqTasks: 96, reveals: ["income"] },
    { id: "ai_hint", reqTasks: 35 },
    // Phase-based
    { id: "tokens_unlock", reqPhase: 3, reveals: ["tokens"] },
    { id: "agents_unlock", reqPhase: 2, reveals: ["agents"] },
    { id: "dashboard_unlock", reqPhase: 9, reveals: ["dashboard"] },
    { id: "clusters_unlock", reqPhase: 10, reveals: ["clusters"] },
    { id: "debt_unlock", reqPhase: 10, reveals: ["debt"] },
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
      salePreparation: { upgradeId: "", remaining: 0 },
      agi: { projectId: "", remaining: 0, checks: 0, purchases: 0, baselineNodes: 0, baselineTasks: 0, healthySeconds: 0, route: "", runawaySeconds: 0, replicas: 1, ended: false, paused: false },
      lastCeoAction: 0,
      cash: 0,
      tokens: 0,
      tokenPacksBought: 0,
      tokensConsumed: 0,
      averageTokenBurn: 0,
      techDebt: 0,
      // ---------- STRESS ----------
      // Stress slowly recovers
      // Retired mechanic: retain the stored fields without changing their values.
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
      manualTasksCompleted: 0,
      totalClicks: 0,
      totalIncidents: 0,
      activeTaskId: null,
      assistant: { taskIds: [], dismissed: false, tasksCompleted: 0, cycleCompleted: 0, breakRemaining: 0, breakLabel: "" },
      // Prestige
      prestigeCount: 0,
      prestigeBonusClick: 0,
      prestigeBonusTokens: 0,
      prestigeBonusSlot: false,
      // Timing
      lastTick: Date.now(),
      lastSave: Date.now(),
      lastTaskSpawn: Date.now(),
      taskSpawnDelay: 1,
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
      musicMode: "on", // off | on (full layered soundtrack)
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
    if (!["off", "manage", "scale"].includes(state.ceoMode) || !["off", "on"].includes(state.musicMode)) return false;
    if (!validAgiSave(state)) return false;
    const saleStep = UPGRADES.find((upgrade) => upgrade.id === state.salePreparation.upgradeId && upgrade.saleDuration);
    if (state.salePreparation.upgradeId ? !saleStep || state.retired || saleStep.phase !== state.phase || state.salePreparation.remaining <= 0 || state.salePreparation.remaining > saleStep.saleDuration || state.purchasedUpgrades.includes(saleStep.id) || (saleStep.requires && !state.purchasedUpgrades.includes(saleStep.requires)) : state.salePreparation.remaining !== 0) return false;
    const taskShape = { batchSize: 1, id: "", typeId: "", name: "", icon: "", client: "", workRequired: 1, workDone: 0, pay: 0, tokenCost: 0, failChance: 0, assignedAgent: null, status: "", createdAt: 0 };
    const agentShape = { id: "", name: "", olderModel: false, slotIndex: 0, roleId: "", roleName: "", icon: "", color: "", specialty: [], traitId: "", traitName: "", traitDesc: "", speed: 1, quality: 1, reliability: 1, tokenCost: 1, tokenTank: 0, status: "", autoAssign: true, currentTask: null, tasksCompleted: 0, hired: 0, tokenStarved: false, errorTime: null, provisionRemaining: 0, provisionDuration: 0 };
    const incidentShape = { id: "", templateId: "", name: "", desc: "", cashCost: 0, tokenCost: 0, fixProgress: 0, createdAt: 0, resolved: false };
    const clusterShape = { id: "", name: "", invested: 0, buildRemaining: 0, buildDuration: 0, workforce: 0, tank: 0, progress: 0, workerSlotsMax: 8, workerAgentIds: [], managerAssigned: false, tokenManagerAssigned: false, active: true };
    const collections = [[state.tasks, taskShape], [state.agents, agentShape], [state.incidents, incidentShape], [state.clusters, clusterShape], [state.services, { id: "", name: "", incomeRate: 0, active: true }], [state.log, { msg: "", type: "", t: 0 }]];
    if (!collections.every(([items, shape]) => items.every((item) => validShape(item, shape)))) return false;
    const assistantTasks = state.tasks.filter((task) => task.status === "assistant");
    const taskIds = state.assistant.taskIds;
    const slots = state.purchasedUpgrades.includes("multitasking") ? 2 : 1;
    if (taskIds.length > 1 || taskIds.length !== assistantTasks.length) return false;
    if (taskIds.length && (state.assistant.dismissed || !state.purchasedUpgrades.includes("hire_assistant"))) return false;
    if (!taskIds.every((id) => assistantTasks.some((task) => task.id === id))) return false;
    if (!Number.isInteger(state.assistant.cycleCompleted) || state.assistant.cycleCompleted >= 5) return false;
    if (state.assistant.breakRemaining > ASSISTANT_BREAK_SECONDS) return false;
    if (state.assistant.breakRemaining > 0 ? taskIds.length > 0 || state.assistant.cycleCompleted !== 0 || !ASSISTANT_BREAK_LABELS.includes(state.assistant.breakLabel) : state.assistant.breakLabel !== "") return false;
    if (state.tasks.filter((task) => task.status === "active").length + state.incidents.filter((incident) => !incident.resolved && incident.manualRepair === true).length > slots) return false;
    const entities = [...state.tasks, ...state.agents, ...state.clusters, ...state.services, ...state.incidents];
    if (!entities.every((item) => /^[a-z0-9_]+$/.test(item.id) && !/["'&]/.test(item.name))) return false;
    if (new Set(entities.map((item) => item.id)).size !== entities.length) return false;
    if (!state.tasks.every((task) => TASK_TYPES.some((type) => type.id === task.typeId) && Number.isInteger(task.batchSize) && task.batchSize > 0 && task.workRequired > 0 && task.workDone <= task.workRequired && ["available", "active", "ai", "agent", "assistant", "done"].includes(task.status))) return false;
    if (!state.agents.every((agent) => AGENT_ROLES.some((role) => role.id === agent.roleId) && /^#[0-9a-f]{6}$/i.test(agent.color) && agent.speed > 0 && agent.tokenCost > 0 && agent.specialty.every((id) => TASK_TYPES.some((type) => type.id === id)) && ["idle", "working", "error", "provisioning"].includes(agent.status) && (agent.status !== "provisioning" || (agent.provisionRemaining > 0 && agent.provisionDuration > 0)))) return false;
    const workers = state.agents.filter((agent) => !UTILITY_ROLES.includes(agent.roleId));
    if (state.taskSpawnDelay <= 0 || !workers.every((agent) => Number.isInteger(agent.slotIndex)) || new Set(workers.map((agent) => agent.slotIndex)).size !== workers.length) return false;
    if (!state.incidents.every((incident) => incident.fixProgress <= 100 && (!Object.hasOwn(incident, "manualRepair") || typeof incident.manualRepair === "boolean"))) return false;
    if (!state.purchasedUpgrades.every((id) => UPGRADES.some((upgrade) => upgrade.id === id)) || !state.milestonesReached.every((id) => MILESTONES.some((milestone) => milestone.id === id))) return false;
    if (!state.log.every((entry) => ["", "good", "bad", "warn", "info"].includes(entry.type))) return false;
    const assigned = state.clusters.flatMap((cluster) => cluster.workerAgentIds);
    if (new Set(assigned).size !== assigned.length) return false;
    if (!state.clusters.every((cluster) => /^Cluster [1-9]\d*$/.test(cluster.name) && Number(cluster.name.slice(8)) <= state.clustersProvisioned && [8, 9, 16].includes(cluster.workerSlotsMax) && Number.isInteger(cluster.workforce) && cluster.workforce <= cluster.workerSlotsMax && cluster.managerAssigned === cluster.tokenManagerAssigned && cluster.workerAgentIds.length <= cluster.workerSlotsMax && cluster.workerAgentIds.every((id) => state.agents.some((agent) => agent.id === id && !UTILITY_ROLES.includes(agent.roleId))))) return false;
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

  function workloadTier(phase) {
    return phase >= 4 ? phase - 1 : phase;
  }

  function generateTask() {
    const types = availableTaskTypes();
    const type = pick(types);
    const tier = Math.max(1, workloadTier(G.phase) - workloadTier(type.phase) + 1);
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
      name: OPENING_GIGS[G.manualTasksCompleted % OPENING_GIGS.length].name,
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
    if (G.phase >= 10) return Math.max(MAX_TASKS, managedNodeCount() * 12);
    if (G.phase >= 2 && G.phase <= 4) return MAX_TASKS;
    if (G.phase === 1 && G.purchasedUpgrades.includes("hire_assistant")) return G.totalTasksDone < 100 ? 8 : MAX_TASKS;
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
      if (G.tasks.some((task) => task.id === "setup_inbox" && task.status === "available")) return Infinity;
      if (G.phase >= 2 && G.phase <= 4) return (G.phase === 2 ? 4000 : 3500) / 7.5 * G.taskSpawnDelay / Math.max(1, G.taskSpawnMult);
      if (G.totalTasksDone < 10) base = 2000;
      else if (G.totalTasksDone < 15) base = 1600;
      else if (G.totalTasksDone < 20) base = 1100;
      else if (G.totalTasksDone < 50) base = 1000;
      else if (G.totalTasksDone < 200) base = 500;
      else base = Math.max(300, TASK_SPAWN_BASE - workloadTier(G.phase) * 550 - G.totalTasksDone * 5);
    }

    var spawnMult = Math.max(0.1, G.taskSpawnMult || 1);
    if (G.phase === 1 && G.purchasedUpgrades.includes("hire_assistant")) spawnMult *= 3;
    return Math.max(120, base / spawnMult);
  }

  function spawnTask() {
    if (G.tasks.length >= getMaxTasks()) return;
    const task = generateTask();
    G.tasks.push(task);
  }

  // ---------- EARLY GAME: DO TASK BUTTON ----------
  function prepareOpeningTask() {
    if (!G.gameStarted || G.phase !== 1 || G.uiRevealed.taskQueue || G.tasks.some((task) => task.status === "available" || task.status === "active")) return;
    G.tasks.push(generateEarlyTask());
  }

  function doEarlyTask(evt) {
    // In early game (< 3 tasks done), the big button creates + works on tasks
    if (G.uiRevealed.taskQueue) return;
    prepareOpeningTask();
    const task = G.tasks.find((item) => item.status === "available");
    if (task) clickTask(task.id, evt);
  }

  function generateInboxTask() {
    // The opening button now sets up the inbox before paid gigs arrive.
    // Inbox setup follows the central opening and uses the normal task progress.
    return { ...generateTask(), id: "setup_inbox", typeId: "email", name: "Set Up Your Inbox", icon: "📥", client: "", pay: 0, workRequired: 10, batchSize: 1 };
  }

  // ---------- CLICKING / TASK WORK ----------
  function clickTask(taskId, evt) {
    const task = G.tasks.find((t) => t.id === taskId);
    if (!task || task.status !== "available" || manualRepairs().length > 0 || availableManualSlots() === 0) return;

    startManualTasks([task], evt, taskId);
  }

  function startManualTasks(tasks, evt, selectedTaskId) {
    for (const task of tasks) {
      if (task.id !== selectedTaskId && !visibleTaskIds().has(task.id)) continue;
      task.status = "active";
      G.activeTaskId = task.id;
      if (task.id === "setup_inbox") {
        G.lastTaskSpawn = Date.now();
        spawnTask();
        spawnTask();
      }
    }
    G.totalClicks++;
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
  }

  function humanWorkSlots() {
    return G.purchasedUpgrades.includes("multitasking") ? 2 : 1;
  }

  function manualRepairs() {
    return G.incidents.filter((incident) => !incident.resolved && incident.manualRepair === true);
  }

  function availableManualSlots() {
    return Math.max(0, humanWorkSlots() - G.tasks.filter((task) => task.status === "active").length - manualRepairs().length);
  }

  function assistantAvailable() {
    return G.purchasedUpgrades.includes("hire_assistant") && !G.assistant.dismissed;
  }

  function assistantTaskSeconds() {
    if (G.purchasedUpgrades.includes("assistant_routine")) return 4 / (1.25 * 1.25);
    if (G.purchasedUpgrades.includes("assistant_settling")) return 4 / 1.25;
    return 4;
  }

  function tickAssistant(dtSec) {
    if (!G.gameStarted || G.retired || !assistantAvailable()) return;
    while (dtSec > 0) {
      if (G.assistant.breakRemaining > 0) {
        const elapsed = Math.min(dtSec, G.assistant.breakRemaining);
        G.assistant.breakRemaining = Math.max(0, G.assistant.breakRemaining - elapsed);
        dtSec -= elapsed;
        if (G.assistant.breakRemaining < 1e-9) {
          G.assistant.breakRemaining = 0;
          G.assistant.breakLabel = "";
        }
        continue;
      }
      let task = G.tasks.find((item) => item.id === G.assistant.taskIds[0]);
      if (!task) {
        task = pickNextAiTask();
        if (!task) return;
        task.status = "assistant";
        G.assistant.taskIds = [task.id];
      }
      const rate = task.workRequired / assistantTaskSeconds();
      const remaining = (task.workRequired - task.workDone) / rate;
      if (remaining > dtSec + 1e-9) {
        task.workDone += rate * dtSec;
        return;
      }
      task.workDone = task.workRequired;
      dtSec = Math.max(0, dtSec - remaining);
      G.assistant.tasksCompleted += task.batchSize;
      G.assistant.cycleCompleted++;
      G.assistant.taskIds = [];
      completeTask(task, "assistant");
      if (G.assistant.cycleCompleted === 5) {
        G.assistant.cycleCompleted = 0;
        G.assistant.breakRemaining = ASSISTANT_BREAK_SECONDS;
        G.assistant.breakLabel = pick(ASSISTANT_BREAK_LABELS);
      }
    }
  }

  function dismissAssistant() {
    if (G.retired || !G.purchasedUpgrades.includes("second_ai") || !assistantAvailable()) return;
    for (const id of G.assistant.taskIds) {
      const task = G.tasks.find((item) => item.id === id);
      task.status = "available";
      task.createdAt = Date.now();
    }
    G.assistant.taskIds = [];
    G.assistant.dismissed = true;
    G.assistant.cycleCompleted = 0;
    G.assistant.breakRemaining = 0;
    G.assistant.breakLabel = "";
    log("Assistant dismissed. Any unfinished tasks are ready for you or AI to finish.", "info");
    save();
  }

  function doWork(evt, taskId) {
    if (!G.gameStarted || G.retired || manualRepairs().length > 0 || availableManualSlots() === 0) return;
    if (!G.uiRevealed.taskQueue) { doEarlyTask(evt); return; }
    const slots = availableManualSlots();
    const available = availableTasks();
    if (taskId) {
      const selected = G.tasks.find((task) => task.id === taskId && task.status === "available");
      if (!selected) return;
      const index = available.indexOf(selected);
      if (index >= 0) available.splice(index, 1);
      available.unshift(selected);
    }
    const tasks = available.slice(0, slots);
    if (tasks.length) startManualTasks(tasks, evt, taskId);
  }

  function handleTaskClick(event) {
    const card = event.target.closest("[data-task-id]");
    if (!card) return;
    doWork(event, card.dataset.taskId);
    renderWorkStream();
  }

  function handleWorkClick(event) {
    if (!G.gameStarted || G.retired) return;
    doWork(event);
    renderWorkStream();
  }

  function deliveredTasksLabel(count) {
    return count + (count === 1 ? " task delivered" : " tasks delivered");
  }

  function renderAssistantCard() {
    if (!assistantAvailable()) return "";
    const task = G.tasks.find((item) => item.id === G.assistant.taskIds[0]);
    const onBreak = G.assistant.breakRemaining > 0;
    const status = onBreak ? G.assistant.breakLabel + " - Back in " + Math.ceil(G.assistant.breakRemaining) + "s" : task ? "Working on " + task.name : "Waiting for work";
    return "<div class='card agent-card" + (onBreak ? " assistant-on-break" : "") + "' data-assistant><div class='agent-icon' aria-hidden='true'>" + (onBreak ? "Ⅱ" : "AS") + "</div><div class='agent-info'><div class='name'>Assistant <span class='role'>Part-time</span></div><div class='text-sm" + (onBreak ? " assistant-break-status" : "") + "'>" + status + "</div><small>" + deliveredTasksLabel(G.assistant.tasksCompleted) + " · 15% task fee</small></div></div>";
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

  function visibleTaskIds() {
    // Cluster delivery represents work in aggregate once the company outgrows individual notes.
    if (!G.uiRevealed.taskQueue || G.phase >= 11 || (G.phase === 10 && G.clusters.length >= 2)) return new Set(G.tasks.map((task) => task.id));
    renderTaskQueue();
    const desk = $("#work-stream").getBoundingClientRect();
    const bottom = Math.min(window.innerHeight, desk.bottom);
    const top = Math.max(0, desk.top);
    const left = Math.max(0, desk.left);
    const right = Math.min(window.innerWidth, desk.right);
    return new Set([...$("#task-list").children].filter((card) => {
      const rect = card.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top >= top && rect.bottom <= bottom && rect.left >= left && rect.right <= right;
    }).map((card) => card.dataset.taskId));
  }

  function availableTasks() {
    const visible = visibleTaskIds();
    return G.tasks.filter((task) => task.status === "available" && visible.has(task.id));
  }

  function pickNextAiTask() {
    return availableTasks()[0] || null;
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
    if (agent && agent.name === "AI 2000 Pro" && G.phase < 5) return 100;
    return G.phase >= 7 ? 1500 : G.phase === 6 ? 500 : G.phase === 5 ? 200 : G.phase >= 3 ? 40 : 10;
  }

  function workerTokenRate() {
    return G.phase >= 7 ? 150 : G.phase === 6 ? 60 : G.phase === 5 ? 15 : G.phase >= 3 ? 4 : 2.4;
  }

  function workerTokenCost(agent) {
    return G.phase >= 5 && agent.name === "AI 2000 Pro" ? 1 : agent.tokenCost;
  }

  function topUpAiWorker() {
    if (G.phase < 2 || G.aiWorkerShutdown || hasIdleManager()) return;
    const amount = Math.min(workerTokenCapacity() - G.aiWorkerTokenTank, G.phase < 3 ? workerTokenCapacity() : G.tokens);
    if (amount <= 0) return;
    if (G.phase >= 3) G.tokens -= amount;
    G.aiWorkerTokenTank += amount;
    save();
  }

  function shutdownAiWorker() {
    if (G.phase < 5) {
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
    if (G.phase >= 10) return;
    const agent = G.agents.find((item) => item.id === agentId);
    if (!agent || UTILITY_ROLES.includes(agent.roleId) || managerControls(agent)) return;
    const amount = Math.min(G.tokens, Math.max(0, workerTokenCapacity(agent) - agent.tokenTank));
    G.tokens -= amount;
    agent.tokenTank += amount;
    const task = findMatchingTask(agent, true);
    if (task && agent.status === "idle" && agent.tokenTank > 0) assignAgentToTask(task.id, agent.id);
    agent.tokenStarved = agent.tokenTank <= 0;
  }

  function topUpManager() {
    if (G.phase < 7 || !hasIdleManager()) return;
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
      G.aiWorkerTasksCompleted += task.batchSize;
      G.aiWorkerCurrentTaskId = null;
      completeTask(task, "ai_assist");
    }
  }

  function aiAssistTask(taskId, evt) {
    const task = G.tasks.find((t) => t.id === taskId);
    if (!task || task.status === "done") return;
    if (G.phase < 2) return;

    const tokenCost = G.phase >= 3 ? Math.ceil(3 * (1 + workloadTier(G.phase) * 0.2) * G.tokenEfficiency) : 0;
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
    } else if (failRoll < failThreshold) {
      // Hallucination -- partial redo
      task.workDone = Math.max(0, task.workDone - Math.ceil(power * 0.5));
      log("AI hallucinated on \"" + task.name + "\". Some progress lost.", "warn");
    } else {
      task.workDone = Math.min(task.workRequired, task.workDone + power);
    }

    if (task.workDone >= task.workRequired) {
      completeTask(task, "ai_assist");
    }

  }

  function triggerTutorialIncident() {
    if (G.incidentsExplained) return;
    G.incidentsExplained = true;
    const incident = {
      id: uid(),
      templateId: "hallucination",
      name: "Hallucinated Output Published",
      desc: "Your AI produced confident nonsense and sent it to a client.",
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
  }

  function findMatchingTask(agent, allowAny = false) {
    return availableTasks().find((task) => allowAny || agent.specialty.includes(task.typeId)) || null;
  }

  function workerAvailable(agent) {
    return !UTILITY_ROLES.includes(agent.roleId) && (G.phase < 10 || !!getAgentCluster(agent.id));
  }

  function clusterControl(agent, role) {
    if (G.phase < 10) return true;
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
    const scale = G.phase >= 10 ? 1 + Math.min(2, Math.max(0, managedNodeCount() - 1)) * 0.5 : 1;
    return agent.speed * (agent.olderModel ? 0.25 : 1) * AGENT_WORK_MULT * G.agentSpeedMult * specialty * code * scale;
  }

  function hasIdleManager() {
    if (G.phase >= 10) return G.clusters.some((cluster) => cluster.managerAssigned);
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
    if (G.phase >= 10) return;
    var agent = G.agents.find(function (a) { return a.id === agentId; });
    if (!agent) return;
    if (agent.roleId === "manager" || agent.roleId === "token_mgr" || agent.roleId === "devops") return;
    agent.autoAssign = !agent.autoAssign;
    log(agent.name + (agent.autoAssign ? " set to Auto Assign." : " set to Manual Assign."), "info");
  }

  function assignAgentToTask(taskId, agentId) {
    const task = G.tasks.find((t) => t.id === taskId);
    const agent = G.agents.find((a) => a.id === agentId);
    if (!task || !availableTasks().includes(task) || !agent || agent.status !== "idle" || !workerAvailable(agent)) return;
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
    return task.pay * taskMult * G.payMult * (method === "assistant" ? 0.85 : 1);
  }

  function completeTask(task, method) {
    if (task.status === "done") return;
    showTaskCompletion(task);
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
    if (method === "manual") G.manualTasksCompleted += task.batchSize;
    if (G.phase >= 10) {
      const metrics = deliveryMetrics();
      metrics.recent.unshift(task.name);
      metrics.recent.length = Math.min(3, metrics.recent.length);
    }
    syncMusicPlayback();

    log("Completed \"" + task.name + "\" -> +" + fmtCash(pay), "good");

    // Check milestones immediately on task completion
    checkMilestones();
    if (method === "manual") prepareOpeningTask();

    // Remove from task list after a short delay

  }

  // ---------- AGENT SYSTEM ----------
  function newClusterAgentName() {
    const used = new Set(G.agents.map((agent) => agent.name));
    const start = Math.floor(Math.random() * 0x10000);
    for (let offset = 0; offset < 0x10000; offset++) {
      const name = ((start + offset) % 0x10000).toString(16).padStart(4, "0");
      if (!used.has(name)) return name;
    }
    throw new RangeError("All four-character agent IDs are in use.");
  }

  function nextWorkerSlot() {
    let slot = !G.aiWorkerShutdown && G.phase >= 2 ? 1 : 0;
    const occupied = new Set(G.agents.filter((agent) => !UTILITY_ROLES.includes(agent.roleId)).map((agent) => agent.slotIndex));
    while (occupied.has(slot)) slot++;
    return slot;
  }

  function createAgent(roleId, slotIndex = nextWorkerSlot()) {
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
      slotIndex: slotIndex,
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
    if (G.phase < 5) return G.aiWorkerShutdown ? 0 : 1;
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
    if (G.phase < 5) return 0;
    if (G.phase >= 10) return G.clusters.reduce((total, cluster) => total + cluster.workerSlotsMax, 0);
    return G.aiWorkerShutdown ? G.agentSlots + 1 : G.agentSlots;
  }

  function reservedHireRoles() {
    return ["manager", "token_mgr"].filter((role) => (role === "manager" ? G.managerUnlock : G.purchasedUpgrades.includes("token_manager_unlock")) && !G.agents.some((agent) => agent.roleId === role));
  }

  function workerSlotCount() {
    return getSharedAgentPoolSize() - G.agents.filter((agent) => ["manager", "token_mgr"].includes(agent.roleId)).length - reservedHireRoles().length;
  }

  function hireAgent(roleId, slotIndex = nextWorkerSlot()) {
    if (G.phase >= 10) return;
    const role = AGENT_ROLES.find((candidate) => candidate.id === roleId);
    if (!role || G.phase < 5 || (roleId === "manager" && !G.managerUnlock) ||
        (roleId === "token_mgr" && !G.purchasedUpgrades.includes("token_manager_unlock")) ||
        (roleId === "devops" && !G.purchasedUpgrades.includes("devops_unlock")) || (roleId === "sales" && G.phase < 9)) return;
    // Utility roles are always singletons; worker roles allow duplicates in Phase 10+
    var isUtility = UTILITY_ROLES.indexOf(roleId) >= 0;
    if (isUtility) {
      if (G.agents.some(function (a) { return a.roleId === roleId; })) {
        log("Already have that agent type!", "bad");
        return;
      }
    }
    if (!isUtility && (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= workerSlotCount() ||
        (!G.aiWorkerShutdown && slotIndex === 0) || G.agents.some((agent) => !UTILITY_ROLES.includes(agent.roleId) && agent.slotIndex === slotIndex))) return;
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
    const agent = createAgent(roleId, slotIndex);
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
        var bt = findMatchingTask(ba, true);
        if (!bt || !clusterControl(ba, "managerAssigned")) continue;
        if (ba.tokenTank <= workerTokenCapacity(ba) * 0.1) {
          const amount = Math.min(G.managerTokenTank, workerTokenCapacity(ba) - ba.tokenTank);
          ba.tokenTank += amount;
          G.managerTokenTank -= amount;
        }
        assignAgentToTask(bt.id, ba.id);
        burstCount++;
      }
      if (burstCount > 0) {
        log("Manager deployed -- assigned " + burstCount + " idle agent" + (burstCount > 1 ? "s" : "") + "!", "good");
      }
    }

    // In Phase 10+, auto-assign new worker to first cluster with available slots
    if (G.phase >= 10 && UTILITY_ROLES.indexOf(roleId) === -1) {
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
    if (G.phase < 5 || G.phase >= 10) return;
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
        var nextTask = findMatchingTask(agent, true);
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
    if (G.phase >= 10) { tickClusterManagers(); return; }
    if (!hasIdleManager()) return;
    var now = Date.now();
    if (now - G.lastManagerAssignAt < 100) return;
    G.lastManagerAssignAt = now;


    if (!G.aiWorkerShutdown && G.aiWorkerTokenTank <= workerTokenCapacity() * 0.1) {
      const amount = Math.min(G.managerTokenTank, workerTokenCapacity() - G.aiWorkerTokenTank);
      G.aiWorkerTokenTank += amount;
      G.managerTokenTank -= amount;
    }
    var assignmentBudget = getManagerAssignmentBudget();
    if (G.phase >= 7) {
      for (var ri = 0; ri < G.agents.length; ri++) {
        if (G.managerTokenTank <= 0) break;
        var refillAgent = G.agents[ri];
        if (UTILITY_ROLES.indexOf(refillAgent.roleId) >= 0) continue;
        if (!managerControls(refillAgent) || refillAgent.tokenTank > workerTokenCapacity(refillAgent) * 0.1) continue;
        const amount = Math.min(G.managerTokenTank, workerTokenCapacity(refillAgent) - refillAgent.tokenTank);
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
      var task = findMatchingTask(agent, G.smartRouting);
      if (!task) continue;
      assignAgentToTask(task.id, agent.id);
      assignmentBudget--;
    }
  }

  // ---------- PER-AGENT AUTO-ASSIGN ----------
  function tickAgentAutoAssign() {
    if (!G.agentAutoAssign) return;
    if (hasIdleManager() && G.phase < 10) return;
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
    const multiplier = G.phase >= 7 ? 100 : G.phase === 6 ? 20 : G.phase === 5 ? 5 : 1;
    return upgrade.effect.giveTokens * multiplier;
  }

  function economyScale() {
    return 1 + Math.log10(1 + G.totalCashEarned / 10000);
  }

  function tokenBurnRate() {
    if (G.phase >= 13) return G.clusters.reduce((total, cluster) => total + (cluster.managerAssigned && cluster.tank > 0 ? cluster.workforce : 0), 0) * workerTokenRate() * G.tokenEfficiency;
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
      if (G.phase >= 10) deliveryMetrics().purchase = message;
    }
  }

  function tickTokenManager() {
    const online = G.phase >= 11 || (G.phase >= 10 ? G.clusters.some((cluster) => cluster.managerAssigned) : G.agents.some((agent) => agent.roleId === "token_mgr" && agent.status === "idle"));
    if (!online) return;
    const demand = G.phase >= 10 ? G.clusters.reduce((total, cluster) => total + (cluster.managerAssigned ? (G.phase >= 13 ? cluster.workforce : cluster.workerAgentIds.length) : 0), 0) * workerTokenRate() * G.tokenEfficiency : tokenBurnRate();
    const transfers = G.phase >= 10 ? G.clusters.filter((cluster) => cluster.managerAssigned).reduce((total, cluster) => total + MANAGER_TOKEN_TANK_MAX - cluster.tank, 0) : MANAGER_TOKEN_TANK_MAX + G.agents.reduce((total, agent) => total + workerTokenCapacity(agent), 0);
    const reserveTarget = MANAGER_TOPUP_COST_TOKEN + Math.max(demand * 5, transfers);
    if (G.tokens < reserveTarget) {
      // Buy bulk pack if affordable, otherwise starter pack
      const pack = ["token_pack_2", "token_pack_1"].map((id) => UPGRADES.find((upgrade) => upgrade.id === id)).find((upgrade) => G.cash >= getUpgradeCost(upgrade));
      if (pack) buyTokenPacks(pack, Math.max(1, Math.ceil(reserveTarget * 2 / tokenPackAmount(pack))));
      G.lastTokenBuy = Date.now();
    }
    if (G.phase < 10 && G.managerTokenTank < MANAGER_TOKEN_TANK_MAX * 0.25) topUpManager();
    for (const cluster of G.clusters) {
      if (!cluster.managerAssigned || cluster.tank >= MANAGER_TOKEN_TANK_MAX * (G.phase >= 11 ? 1 : 0.25)) continue;
      const amount = Math.min(G.tokens, MANAGER_TOKEN_TANK_MAX - cluster.tank, G.phase >= 11 ? 250 : MANAGER_TOKEN_TANK_MAX);
      G.tokens -= amount;
      cluster.tank += amount;
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
      // Manual repairs now use a work slot; stress has been retired.
      if (inc.manualRepair || availableManualSlots() === 0) return;
      inc.manualRepair = true;
      renderWorkStream();
      return;
    } else if (method === "cash") {
      const cost = (inc.cashCost || 20) * 2;
      if (G.cash < cost) { log("Not enough cash!", "bad"); return; }
      G.cash -= cost;
      inc.fixProgress = 100;
      inc.resolved = true;
      log("Paid " + fmtCash(cost) + " to resolve: " + inc.name + ".", "warn");
      renderWorkStream();
    }

    // Remove resolved after delay
    setTimeout(() => {
      G.incidents = G.incidents.filter((i) => i.id !== incidentId);
    }, 500);
  }

  function tickManualRepairs(dtSec) {
    for (const inc of manualRepairs()) {
      inc.fixProgress = Math.min(100, inc.fixProgress + dtSec * 100 / MANUAL_REPAIR_SECONDS);
      if (inc.fixProgress < 100) continue;
      inc.resolved = true;
      log("Manually resolved: " + inc.name + ".", "good");
      renderWorkStream();
      setTimeout(() => {
        G.incidents = G.incidents.filter((incident) => incident.id !== inc.id);
      }, 500);
    }
  }

  function tickIncidents(dtSec) {
    // Unresolved incidents drain reputation over time
    // Reputation has been removed; incidents retain their cash costs and downtime.
    // Random incident generation -- only after tutorial incident
    if (!G.incidentsExplained) return;
    if (G.phase < 2 || G.agents.length === 0) return;
    const checkInterval = Math.max(15000, 60000 - workloadTier(G.phase) * 3000 - G.agents.length * 1000);
    if (Date.now() - G.lastIncidentCheck < checkInterval) return;
    G.lastIncidentCheck = Date.now();

    let chance = 0.05 + workloadTier(G.phase) * 0.02 + G.techDebt * 0.003 + G.agents.length * 0.01;
    if (G.driftReduction > 0) chance *= (1 - G.driftReduction * 0.3);
    if (Math.random() < chance) {
      maybeCreateIncident(null);
    }
  }

  // ---------- DEVOPS INCIDENT RESPONSE ----------
  function tickDevopsIncidentResponse(dtSec) {
    const responders = G.phase >= 10 ? G.clusters.filter((cluster) => cluster.managerAssigned) : G.agents.filter((a) => a.roleId === "devops" && a.status === "idle");
    if (responders.length === 0) return;

    const active = G.incidents
      .filter((i) => !i.resolved && !i.manualRepair)
      .sort((a, b) => a.createdAt - b.createdAt);
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
  function getExpenseRate(preview = false) {
    if (!preview && (!G.expensesRevealed || !G.purchasedUpgrades.includes("reality_check"))) return 0;

    let rate = 0;
    for (const tier of EXPENSE_TIERS) {
      if (G.phase >= tier.phase) rate = tier.rate;
    }
    // Agent upkeep
    rate += G.agents.length * (0.8 + workloadTier(G.phase) * 0.2);
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

  // ---------- TECH DEBT (Phase 10+) ----------
  function tickDebt(dtSec) {
    if (G.phase < 10) return;
    // Debt grows with agent activity
    const activeAgents = G.agents.filter((a) => a.status === "working").length;
    const growth = activeAgents * 0.05 * dtSec * (1 - G.debtReduction);
    const devops = G.clusters.filter((cluster) => cluster.managerAssigned).length;
    G.techDebt = Math.max(0, G.techDebt + growth - devops * dtSec * 0.5);
  }

  function getLateCostMultiplier() {
    if (G.phase < 5) return 1;
    var mult = 1 + (workloadTier(G.phase) - 3) * 0.18;
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
    if (G.phase < 5) return 0;
    var activeWorkers = G.agents.filter(function (agent) {
      return workerAvailable(agent) && agent.status === "working" && agent.tokenTank > 0;
    }).length;
    if (activeWorkers <= 0) return 0;
    var perAgent = 1.4 + workloadTier(G.phase) * 0.4;
    if (G.purchasedUpgrades.includes("growth_marketing")) perAgent *= 1.65;
    return activeWorkers * perAgent;
  }

  function getMarketingRevenueRate() {
    if (!G.purchasedUpgrades.includes("growth_marketing")) return 0;
    return 4 + workloadTier(G.phase) * 1.5;
  }

  // ---------- INCOME RATE ESTIMATION ----------
  function getIncomeRate() {
    // Passive growth income (Phase 5+)
    let rate = networkIncomeRate() + getAgentRevenueRate() + getMarketingRevenueRate();
    if (assistantAvailable()) {
      // Average the five-task cycle so short tasks and breaks do not hide assistant income between ticks.
      const task = G.tasks.find((item) => item.status === "assistant") || G.tasks.find((item) => item.status === "available");
      if (task) rate += getTaskCashPayout(task, "assistant", null) / (assistantTaskSeconds() + ASSISTANT_BREAK_SECONDS / 5);
    }
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

  // ---------- AGI HANDOVER ----------
  const AGI_INSPECTIONS = {
    cash: ["#res-cash", "#income-rate", "#expense-rate"],
    operations: ["#incident-list .incident-card", "#operations-health", ".delivery-rate", "#res-tasks"],
    network: [".neocloud.active .neocloud-status", "#cluster-count", ".ceo-status", "#cluster-heading", ".delivery-metrics > span"],
    log: ["#log-panel"],
  };
  const AGI_CHECKS = ["cash", "operations", "network"];
  const AGI_PATROL = ["cash", "operations", "network", "cash", "log", "network"];
  const AGI_GLANCE_TIMES = [1.6, 2.6, 1.2, 2.9, 1.9];
  const AGI_CHECK_LABELS = { cash: "company cash", operations: "operations", network: "network capacity", log: "the event log" };
  const AGI_DECISION_STATUS = {
    agi_authority: "Input needed. Approve AGI purchasing in Upgrades.",
    route: "Input needed. Retire or keep scaling.",
    retire_unlock: "Input needed. Host investor talks to begin the buyout.",
    fusion: "Input needed. Complete the company sale in Upgrades.",
  };

  function validAgiSave(state) {
    const a = state.agi;
    const project = UPGRADES.find((upgrade) => upgrade.id === a.projectId && upgrade.agiDuration);
    if (!["", "buyout", "scaling"].includes(a.route) || !Number.isInteger(a.checks) || !Number.isInteger(a.purchases) || !Number.isInteger(a.replicas) || a.replicas < 1) return false;
    if (a.projectId ? !project || state.phase !== project.phase || state.retired || a.route !== "" || a.remaining <= 0 || a.remaining > project.agiDuration || state.purchasedUpgrades.includes(project.id) || !state.purchasedUpgrades.includes(project.requires) : a.remaining !== 0) return false;
    if (a.route && !state.purchasedUpgrades.includes("agi_independence")) return false;
    if (a.route === "scaling" && (state.phase !== 16 || state.salePreparation.upgradeId || state.purchasedUpgrades.includes("retire_unlock"))) return false;
    if (a.ended && (a.route !== "scaling" || !state.retired || a.runawaySeconds !== 45)) return false;
    if (a.runawaySeconds > 45 || (a.route !== "scaling" && (a.runawaySeconds !== 0 || a.replicas !== 1 || a.ended))) return false;
    if (a.route === "scaling" && (state.retired !== a.ended || (a.runawaySeconds === 45 && !a.ended))) return false;
    return true;
  }

  function agiMilestones() {
    return [
      [Math.min(500, Math.max(0, completedClusterCount() - G.agi.baselineNodes)), 500, "New clusters"],
      [Math.min(100000000, Math.max(0, G.totalTasksDone - G.agi.baselineTasks)), 100000000, "Tasks delivered"],
      [Math.min(30, G.agi.healthySeconds), 30, "Healthy operating seconds"],
    ];
  }

  function agiUpgradeReady(upgrade) {
    if (upgrade.id === "agi_authority") return G.agi.checks >= AGI_CHECKS.length;
    if (upgrade.id === "agi_independence") return agiMilestones().every(([value, target]) => value >= target);
    return true;
  }

  function agiFounderDecision() {
    if (agiRouteReady()) return "route";
    if (G.agi.route === "buyout") {
      if (G.purchasedUpgrades.includes("sale_terms")) return "fusion";
      if (!G.purchasedUpgrades.includes("retire_unlock") && !G.salePreparation.upgradeId) return "retire_unlock";
    }
    if (G.agi.checks >= AGI_CHECKS.length && fundedCashUpgrade(AGI_AUTHORITY)) return AGI_AUTHORITY.id;
    return "";
  }

  function agiCanDrive(decision = agiFounderDecision()) {
    return G.gameStarted && !G.retired && G.purchasedUpgrades.includes("agi_computer_use") && !G.agi.paused && !decision && !document.hidden && !document.querySelector(".popup-overlay.show");
  }

  function agiNextUpgrade() {
    if (!G.purchasedUpgrades.includes("agi_authority") || G.agi.projectId || G.salePreparation.upgradeId || G.agi.route === "scaling") return null;
    return UPGRADES.find((upgrade) => (upgrade.id.startsWith("agi_") || (G.agi.route === "buyout" && upgrade.phase === FINAL_PHASE && upgrade.saleDuration)) && upgradeVisible(upgrade)) || null;
  }

  let agiMotion = null;
  let runawayFadeStartedAt = null;

  function agiMotionState() {
    if (!agiMotion || agiMotion.owner !== G) {
      agiMotion = { owner: G, elapsed: 0, visits: 0, target: "", status: "AGI checking company cash", scrolled: false, logScrolled: false, decision: "", clicking: false };
    }
    return agiMotion;
  }

  function tickAgi(dtSec) {
    if (G.retired || document.hidden || document.querySelector(".popup-overlay.show")) return;
    if (G.agi.route === "scaling") { tickAgiRunaway(dtSec); return; }
    if (G.purchasedUpgrades.includes("agi_authority") && !G.purchasedUpgrades.includes("agi_independence") && G.techDebt < 10 && G.incidents.every((incident) => incident.resolved) && getIncomeRate() > getExpenseRate() * 2) G.agi.healthySeconds = Math.min(30, G.agi.healthySeconds + dtSec);
    if (G.agi.projectId) {
      G.agi.remaining = Math.max(0, G.agi.remaining - dtSec);
      if (G.agi.remaining === 0) {
        const project = UPGRADES.find((upgrade) => upgrade.id === G.agi.projectId);
        G.agi.projectId = "";
        completeUpgradePurchase(project);
        save();
      }
    }
    const motion = agiMotionState();
    if (!agiCanDrive()) {
      motion.target = "";
      motion.elapsed = 0;
      motion.clicking = false;
      return;
    }
    const supervising = G.agi.checks < AGI_CHECKS.length && !G.purchasedUpgrades.includes("agi_authority");
    if (!motion.target) {
      const upgrade = agiNextUpgrade();
      const affordable = upgrade && agiUpgradeReady(upgrade) && G.cash >= getUpgradeCost(upgrade);
      const inspection = supervising ? AGI_CHECKS[G.agi.checks] : AGI_PATROL[motion.visits % AGI_PATROL.length];
      motion.target = affordable ? upgrade.id : inspection;
      motion.status = affordable ? "Purchasing " + upgrade.name :
        upgrade && !agiUpgradeReady(upgrade) ? "Proving independent operations" :
        upgrade ? "Saving for " + upgrade.name : "AGI checking " + AGI_CHECK_LABELS[inspection];
      motion.scrolled = false;
      motion.logScrolled = false;
    }
    const inspecting = Object.hasOwn(AGI_INSPECTIONS, motion.target);
    motion.elapsed += dtSec;
    if (!inspecting && motion.elapsed >= 2 && $("#control-panel").scrollTop > 0) {
      revealAgiTarget();
      motion.elapsed = 2;
      motion.scrolled = true;
    }
    motion.clicking = !inspecting && motion.elapsed >= 3.25 && motion.elapsed < 4;
    if (motion.elapsed < 4) return;
    if (inspecting) {
      motion.visits++;
      if (supervising) G.agi.checks++;
    }
    else {
      const before = G.purchasedUpgrades.length;
      purchaseUpgrade(motion.target);
      if (G.purchasedUpgrades.length > before || G.agi.projectId === motion.target || G.salePreparation.upgradeId === motion.target) G.agi.purchases++;
    }
    motion.target = "";
    motion.elapsed = 0;
    motion.clicking = false;
  }

  function takeAgiControl() {
    if (!agiCanDrive()) return;
    G.agi.paused = true;
    agiMotion = null;
    save();
    renderAll();
  }

  function resumeAgi() {
    if (!G.purchasedUpgrades.includes("agi_computer_use") || G.retired) return;
    G.agi.paused = false;
    agiMotion = null;
    save();
    renderAll();
  }

  function agiRouteReady() {
    return G.gameStarted && !G.retired && G.phase === 16 && G.agi.route === "" && G.purchasedUpgrades.includes("agi_independence");
  }

  function requestBuyout() {
    if (!agiRouteReady()) return;
    $("#agi-buyout-warning").classList.add("show");
    renderAll();
  }

  function cancelBuyout() {
    $("#agi-buyout-warning").classList.remove("show");
    G.lastTick = Date.now();
    renderAll();
  }

  function positionForBuyout() {
    if (!agiRouteReady() || !$("#agi-buyout-warning").classList.contains("show")) return;
    $("#agi-buyout-warning").classList.remove("show");
    G.lastTick = Date.now();
    G.agi.route = "buyout";
    agiMotion = null;
    G.agi.paused = false;
    log("The company runs without you. Preparing for a buyout.", "good");
    save();
    renderAll();
  }

  function requestKeepScaling() {
    if (!agiRouteReady()) return;
    $("#agi-warning").classList.add("show");
    renderAll();
  }

  function cancelKeepScaling() {
    $("#agi-warning").classList.remove("show");
    G.lastTick = Date.now();
    renderAll();
  }

  function confirmKeepScaling() {
    if (!agiRouteReady() || !$("#agi-warning").classList.contains("show")) return;
    G.agi.route = "scaling";
    G.agi.paused = false;
    agiMotion = null;
    log("Guard rails removed. Objective: keep scaling.", "warn");
    cancelKeepScaling();
    save();
  }

  function tickAgiRunaway(dtSec) {
    G.agi.runawaySeconds = Math.min(45, G.agi.runawaySeconds + dtSec);
    G.agi.replicas = Math.floor(Math.pow(2, G.agi.runawaySeconds / 3));
    G.totalTasksDone += Math.floor(G.agi.replicas * 10000 * dtSec);
    if (G.agi.runawaySeconds < 45) {
      if (Date.now() - G.lastSave > SAVE_INTERVAL) save();
      return;
    }
    G.agi.ended = true;
    G.retired = true;
    G.retiredAt = Date.now();
    runawayFadeStartedAt = G.retiredAt;
    log("There is always one more task.", "bad");
    save();
    renderAll();
  }

  function agiUpgradeControl(id) {
    return $("[onclick=\"GAME.buy('" + id + "')\"]");
  }

  function agiTargetVisible(target) {
    if (!target) return false;
    const rect = target.getBoundingClientRect();
    const pane = target.closest("#control-panel, #work-stream")?.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    return rect.width > 0 && rect.height > 0 && x >= 0 && x <= window.innerWidth && y >= Math.max(0, pane?.top ?? 0) &&
      y <= Math.min(window.innerHeight, pane?.bottom ?? window.innerHeight);
  }

  function agiPointerTarget() {
    const motion = agiMotionState();
    const selectors = AGI_INSPECTIONS[motion.target];
    if (!selectors && motion.target) return agiUpgradeControl(motion.target);
    const visible = (selectors || AGI_INSPECTIONS.cash).map($).filter(agiTargetVisible);
    const offset = Number(agiLookAgain(motion)) + Math.floor(motion.visits / AGI_CHECKS.length);
    return visible.length ? visible[offset % visible.length] : $("#res-cash");
  }

  function agiLookAgain(motion) {
    return motion.elapsed >= AGI_GLANCE_TIMES[motion.visits % AGI_GLANCE_TIMES.length];
  }

  function scrollAgiPane(pane, top, animate) {
    if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) pane.scrollTo({ top, behavior: "smooth" });
    else pane.scrollTop = top;
  }

  function revealAgiTarget() {
    scrollAgiPane($("#control-panel"), 0, false);
  }

  function renderAgiInspection(motion) {
    const logPanel = motion.target === "log" ? $("#log-panel") : null;
    const detail = motion.target === "operations" ? $("#incident-list .incident-card") || $("#operations-health") : logPanel;
    if (detail && !motion.scrolled) {
      revealAgiTarget();
      motion.scrolled = true;
    }
    if (logPanel && !motion.logScrolled && agiLookAgain(motion)) {
      const maxScroll = logPanel.scrollHeight - logPanel.clientHeight;
      if (maxScroll > 0) {
        scrollAgiPane(logPanel, 0, true);
      }
      motion.logScrolled = true;
    }
  }

  function runawayAgiTarget(index) {
    const elapsed = (G.agi.runawaySeconds / (1 + index * 0.14) + index * 0.7) % 4.9;
    const beat = elapsed < 1.1 ? 0 : elapsed < 3.3 ? 1 : 2;
    if (index === 0) return $(["#agi-replication-count", "#agi-runaway-status", "#agi-runaway-panel h3"][beat]);
    return $(".agi-task-grid span:nth-child(" + (((beat + index) % 3) * 3 + index) + ")");
  }

  function renderAgiPointer(decision = agiFounderDecision()) {
    const driving = agiCanDrive(decision);
    const motion = agiMotionState();
    const active = !G.retired && !document.hidden && !$(".popup-overlay.show");
    if (!decision) motion.decision = "";
    else if (active && motion.decision !== decision) {
      scrollAgiPane($("#control-panel"), 0, false);
      motion.decision = decision;
      // Cancel any final compositor movement from the preceding smooth inspection scroll.
      window.requestAnimationFrame(() => {
        if (agiMotion === motion && motion.decision === decision) scrollAgiPane($("#control-panel"), 0, false);
      });
    }

    document.body.classList.toggle("agi-driving", driving);
    const runaway = active && G.agi.route === "scaling";
    if (driving && !runaway) renderAgiInspection(motion);
    const target = driving && !runaway ? agiPointerTarget() : null;
    const purchaseCard = target?.closest(".upgrade-card");
    $$(".agi-click-target").forEach((card) => card.classList.remove("agi-click-target"));
    if (purchaseCard && motion.clicking) purchaseCard.classList.add("agi-click-target");
    $("#agi-cursor span").textContent = purchaseCard && motion.clicking ? "AGI · Click" : "AGI";
    $("#agi-cursors").hidden = !runaway && !target;
    if (!runaway && !target) return;
    if (purchaseCard && !motion.scrolled) {
      revealAgiTarget();
      motion.scrolled = true;
    }
    const stage = Math.min(3, 1 + Math.floor(G.agi.runawaySeconds / 12));
    $$(".agi-cursor").forEach((cursor, index) => {
      cursor.hidden = index > (runaway ? stage : 0);
      if (cursor.hidden) return;
      const rect = (runaway ? runawayAgiTarget(index) : target).getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      cursor.style.left = clamp(x, 8, window.innerWidth - 75) + "px";
      cursor.style.top = clamp(y, 8, window.innerHeight - 45) + "px";
      cursor.classList.toggle("clicking", runaway ? (Math.floor(G.agi.runawaySeconds * 3) + index) % 4 === 0 : motion.clicking);
    });
  }

  function renderAgiResearch(project) {
    const elapsed = project.agiDuration - G.agi.remaining;
    const stage = Math.min(2, Math.floor(elapsed / 10));
    const labels = ["Assemble training data", "Train model", "Run evaluations"];
    const descriptions = [
      fmtTokens(G.totalTasksDone) + " completed tasks available for training.",
      "Learning to complete the work your company delivers.",
      "Testing email, research and spreadsheet work.",
    ];
    const passed = Math.max(0, Math.floor((elapsed - 20) / 3));
    return "<div class='agi-research'><ol class='agi-research-stages' aria-label='Research stages'>" + labels.map((label, index) =>
      "<li data-state='" + (index < stage ? "complete" : index === stage ? "active" : "pending") + "'>" + label + "</li>"
    ).join("") + "</ol><p class='agi-research-detail'>" + descriptions[stage] + "</p><div class='agi-research-tasks'>" +
      TASK_TYPES.slice(0, 3).map((task, index) => {
        const complete = stage === 2 && index < passed;
        const status = complete ? "Passed" : ["Training example", "Learning", "Evaluating"][stage];
        return "<div class='agi-research-task' data-state='" + (complete ? "complete" : "active") + "'><strong>" + task.name + "</strong><span>" + status + "</span></div>";
      }).join("") + "</div></div>";
  }

  function renderAgi() {
    const visible = G.purchasedUpgrades.includes("agi_research") || G.agi.projectId !== "";
    $("#section-agi").hidden = !visible || G.retired;
    const runaway = G.agi.route === "scaling" && !G.retired;
    document.body.classList.toggle("agi-runaway", runaway);
    document.body.dataset.agiStage = String(Math.min(3, 1 + Math.floor(G.agi.runawaySeconds / 12)));
    $("#agi-runaway-panel").hidden = !runaway;
    const decision = agiFounderDecision();
    const computerUse = G.purchasedUpgrades.includes("agi_computer_use");
    const awaitingApproval = computerUse && !G.purchasedUpgrades.includes("agi_authority");
    const control = $("#btn-agi-control");
    control.hidden = !computerUse || Boolean(decision);
    const controlLabel = G.agi.paused ? "Resume AGI" : "Take control";
    if (control.textContent !== controlLabel) control.textContent = controlLabel;
    const choices = $("#agi-route-choices");
    const showChoices = decision === "route";
    if (showChoices && choices.hidden) {
      choices.append($("#agi-route-template").content.cloneNode(true));
      $("#btn-agi-buyout").addEventListener("click", requestBuyout);
      $("#btn-agi-scaling").addEventListener("click", requestKeepScaling);
    } else if (!showChoices && !choices.hidden) choices.replaceChildren();
    choices.hidden = !showChoices;
    const project = UPGRADES.find((upgrade) => upgrade.id === G.agi.projectId);
    let status = "Research complete. Enable computer use.";
    if (decision) status = AGI_DECISION_STATUS[decision];
    else if (project) status = project.name + " · " + Math.ceil(G.agi.remaining) + "s remaining";
    else if (G.agi.paused) status = "You have control";
    else if (runaway) status = "AGI is scaling without oversight.";
    else if (awaitingApproval) {
      const checks = G.agi.checks;
      status = checks < AGI_CHECKS.length ?
        "AGI checking " + AGI_CHECK_LABELS[AGI_CHECKS[checks]] + " · " + (checks + 1) + " of " + AGI_CHECKS.length :
        "Checks complete. Saving for approval · " + fmtCash(G.cash) + " / " + fmtCash(getUpgradeCost(AGI_AUTHORITY));
    } else if (computerUse) status = agiMotionState().status;
    const statusElement = $("#agi-status");
    if (statusElement.textContent !== status) statusElement.textContent = status;
    let progress = "";
    if (project) progress = "<progress aria-label='AGI project' max='" + project.agiDuration + "' value='" + (project.agiDuration - G.agi.remaining) + "'></progress>";
    if (project?.id === "agi_research") progress += renderAgiResearch(project);
    if (awaitingApproval) progress += "<p>Checks complete · " + Math.min(AGI_CHECKS.length, G.agi.checks) + " / " + AGI_CHECKS.length + "</p>";
    if (G.purchasedUpgrades.includes("agi_authority") && !G.purchasedUpgrades.includes("agi_independence")) progress += "<ul>" + agiMilestones().map(([value, target, label]) => "<li>" + label + ": " + fmtTokens(value) + " / " + fmtTokens(target) + "</li>").join("") + "</ul>";
    updateHTML($("#agi-progress"), progress);
    if (runaway) {
      const stage = Math.min(3, Math.floor(G.agi.runawaySeconds / 12));
      $("#agi-runaway-status").textContent = ["Subsidiaries are assigning tasks to each other.", "Internal demand has exceeded forecasts.", "Additional management instances deployed.", "All available space allocated to tasks."][stage];
      $("#agi-replication-count").textContent = fmtTokens(G.agi.replicas) + " AGI instances";
    }
    renderAgiPointer(decision);
  }

  // ---------- UPGRADE PURCHASE ----------
  function clusterOnline(cluster) {
    return cluster.buildRemaining === 0 && cluster.managerAssigned && (G.phase >= 13 ? cluster.workforce === cluster.workerSlotsMax : cluster.workerAgentIds.length === cluster.workerSlotsMax && cluster.workerAgentIds.every((id) => G.agents.find((agent) => agent.id === id).status !== "provisioning"));
  }

  function clustersFull() {
    return G.clusters.length > 0 && G.clusters.every(clusterOnline);
  }

  function completedClusterCount() {
    return G.clusters.filter(clusterOnline).length;
  }

  function hasUnfinishedAgentInstallations() {
    return provisioningAgents().length > 0;
  }

  function provisioningAgents() {
    return G.agents.filter((agent) => agent.status === "provisioning" && !G.clusters.some((cluster) => cluster.buildRemaining > 0 && cluster.workerAgentIds.includes(agent.id)));
  }

  function upgradeVisible(upgrade) {
    if (G.agi.route === "scaling") return false;
    if (upgrade.id === "retire_unlock" && G.agi.route !== "buyout") return false;
    if (upgrade.agiDuration && G.agi.projectId) return false;
    if (upgrade.phase > G.phase || (upgrade.oneTime && G.purchasedUpgrades.includes(upgrade.id))) return false;
    if (upgrade.id === "reality_check") return G.totalTasksDone >= upgrade.reqTasks;
    if (upgrade.infoUntilPhase !== undefined) return G.phase <= upgrade.infoUntilPhase && (!upgrade.reqIncidents || G.totalIncidents >= upgrade.reqIncidents);
    if (G.phase === 1 && upgrade.id !== "tools_of_trade" && !G.purchasedUpgrades.includes("tools_of_trade")) return false;
    if (G.phase === 1 && upgrade.reqTasks >= 35 && upgrade.id !== "ai_hint" && !G.purchasedUpgrades.includes("ai_hint")) return false;
    if (upgrade.saleDuration && G.salePreparation.upgradeId && G.salePreparation.upgradeId !== upgrade.id) return false;
    const revealTasks = upgrade.revealTasks ?? upgrade.reqTasks;
    if (revealTasks && G.totalTasksDone < revealTasks) return false;
    if (upgrade.reqIncidents && G.totalIncidents < upgrade.reqIncidents) return false;
    if (upgrade.reqAgents && G.agents.filter((agent) => !UTILITY_ROLES.includes(agent.roleId)).length < upgrade.reqAgents) return false;
    if (upgrade.visibleAfter) return G.purchasedUpgrades.includes(upgrade.visibleAfter);
    if (upgrade.requires && !upgrade.showBeforeRequires && !G.purchasedUpgrades.includes(upgrade.requires)) return false;
    if (upgrade.requiresRole && !G.agents.some((agent) => agent.roleId === upgrade.requiresRole)) return false;
    if (!upgrade.oneTime || upgrade.optional) return true;
    const prior = UPGRADES.filter((item) => item.oneTime && !item.introductory && !item.optional && (item.phase < upgrade.phase || (item.phase === upgrade.phase && UPGRADES.indexOf(item) < UPGRADES.indexOf(upgrade))));
    if (prior.some((item) => ["agent_slot_3", "agent_slot_5"].includes(item.id) && !G.purchasedUpgrades.includes(item.id))) return false;
    if (upgrade.unlockPhase || ["ai_hint", "reality_check"].includes(upgrade.id)) {
      if (prior.some((item) => !(upgrade.showBeforeRequires && item.id === upgrade.requires) && !G.purchasedUpgrades.includes(item.id))) return false;
    } else {
      const waiting = prior.filter((item) => item.phase === upgrade.phase && !G.purchasedUpgrades.includes(item.id));
      if (waiting.length >= 3) return false;
    }
    if (upgrade.id === "server_1" && (G.clusters.length < 5 || !clustersFull())) return false;
    if (upgrade.id === "replication") return G.clusters.length >= 20;
    if (upgrade.id === "retire_unlock" && completedClusterCount() < upgrade.reqNodes) return false;
    if (upgrade.id === "cluster_capacity_3" && G.clusters.length < 2) return false;
    if (upgrade.id === "ceo_readiness" && G.clusters.length < 3) return false;
    return true;
  }

  function upgradeStaffingReady(upgrade) {
    return G.phase !== 10 || upgrade.phase !== 10 || clustersFull();
  }

  function upgradeRequirementsMet(upgrade) {
    return agiUpgradeReady(upgrade) && upgradeStaffingReady(upgrade) &&
      (!upgrade.requires || G.purchasedUpgrades.includes(upgrade.requires)) &&
      (!upgrade.reqTasks || G.totalTasksDone >= upgrade.reqTasks) &&
      (upgrade.id !== "autonomous_nodes" || !hasUnfinishedAgentInstallations()) &&
      (upgrade.id !== "fusion" || canSellCompany()) &&
      completedClusterCount() >= nodeRequirement(upgrade) &&
      (!upgrade.requiresRole || G.agents.some((agent) => agent.roleId === upgrade.requiresRole));
  }

  function fundedCashUpgrade(upgrade) {
    return G.cash >= getUpgradeCost(upgrade) && G.agi.projectId !== upgrade.id &&
      upgradeVisible(upgrade) && upgradeRequirementsMet(upgrade);
  }

  function purchaseUpgrade(upgradeId) {
    const upg = UPGRADES.find((u) => u.id === upgradeId);
    if (!upg || G.retired || !upgradeVisible(upg)) return;
    if (upg.saleDuration && G.salePreparation.upgradeId) return;
    if ((upg.agiDuration && G.agi.projectId) || !agiUpgradeReady(upg)) return;
    if (upg.id.startsWith("token_pack_")) { buyTokenPacks(upg, 1); return; }
    if (upgradeId === "fusion" && !canSellCompany()) return;
    if (!upgradeStaffingReady(upg)) return;
    if (upgradeId === "autonomous_nodes" && hasUnfinishedAgentInstallations()) return;
    if (upg.oneTime && G.purchasedUpgrades.includes(upgradeId)) return;
    if (upg.phase > G.phase) return;
    if (G.phase >= 10 && upg.effect && upg.effect.agentSlots && !upg.unlockPhase) return;
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

    if (upg.agiDuration) {
      G.agi.projectId = upg.id;
      G.agi.remaining = upg.agiDuration;
      log("Started: " + upg.name, "info");
      save();
      renderAll();
      return;
    }
    if (upg.saleDuration) {
      G.salePreparation = { upgradeId: upg.id, remaining: upg.saleDuration };
      log(upg.saleActivity + ".", "info");
      save();
      return;
    }
    completeUpgradePurchase(upg);
  }

  function tickSalePreparation(dtSec) {
    if (!G.salePreparation.upgradeId || G.retired) return;
    G.salePreparation.remaining = Math.max(0, G.salePreparation.remaining - dtSec);
    if (G.salePreparation.remaining > 0) return;
    const upgrade = UPGRADES.find((item) => item.id === G.salePreparation.upgradeId);
    G.salePreparation = { upgradeId: "", remaining: 0 };
    completeUpgradePurchase(upgrade);
    save();
  }

  function completeUpgradePurchase(upg) {
    const upgradeId = upg.id;
    if (upgradeId === "reality_check") {
      G.expensesRevealed = true;
      G.uiRevealed.expenses = true;
    }
    if (upgradeId === "tools_of_trade") G.uiRevealed.log = true;
    if (upgradeId === "free_ai") G.aiWorkerTokenTank = 10;
    if (upgradeId === "hire_assistant") G.uiRevealed.agents = true;
    if (upg.oneTime) G.purchasedUpgrades.push(upgradeId);
    if (["agi_authority", "agi_independence", "sale_terms"].includes(upgradeId)) agiMotion = null;
    if (upgradeId === "agi_computer_use") G.agi.paused = false;
    if (upgradeId === "agi_authority") {
      G.agi.baselineNodes = completedClusterCount();
      G.agi.baselineTasks = G.totalTasksDone;
      G.agi.healthySeconds = 0;
      G.agi.paused = false;
    }
    if (upgradeId === "ceo_recruitment" || upgradeId === "ceo_deploy_speed") {
      const speed = upgradeId === "ceo_recruitment" ? 2 : 1.5;
      for (const agent of G.agents) {
        if (agent.status !== "provisioning") continue;
        const delay = Math.max(0, agent.provisionRemaining - agent.provisionDuration);
        agent.provisionDuration /= speed;
        agent.provisionRemaining = (agent.provisionRemaining - delay) / speed + delay;
      }
    }

    // Apply effects
    if (upg.effect) {
      if (upg.effect.aiFailMult) G.aiFailMult *= upg.effect.aiFailMult;
      if (upg.effect.aiPowerMult) G.aiPowerMult *= upg.effect.aiPowerMult;
      if (upg.effect.giveTokens) { const amount = upg.id.startsWith("token_pack_") ? tokenPackAmount(upg) : upg.effect.giveTokens; G.tokens += amount; log(upg.name + ": +" + amount + " tokens.", "info"); }
      if (upg.effect.agentSlots) G.agentSlots = Math.max(G.agentSlots, upg.effect.agentSlots + Number(G.prestigeBonusSlot));
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
      if (upg.effect.clusterSlots) for (const cluster of G.clusters) cluster.workerSlotsMax = Math.max(cluster.workerSlotsMax, upg.effect.clusterSlots);
      if (upg.effect.aiCeo) {
        G.ceoMode = "manage";
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
      dismissAssistant();
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
      // Phase guidance now appears in optional free info upgrades.

      // Phase 10: initialize clusters
      if (G.phase === 10 && G.clusters.length === 0) {
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
            ag.tokenCost = workerTokenCost(ag);
            ag.name = newClusterAgentName();
            alpha.workerAgentIds.push(ag.id);
          }
        }
        // Assign manager/token_mgr to Alpha if they exist
        if (G.agents.some(function (a) { return a.roleId === "manager"; })) alpha.managerAssigned = true;
        if (G.agents.some(function (a) { return a.roleId === "token_mgr"; })) alpha.tokenManagerAssigned = true;
        G.agents = G.agents.filter((agent) => !UTILITY_ROLES.includes(agent.roleId));
        log("ATL-0001 formed with existing agents and management online.", "info");
      }

      if (G.phase === 13) {
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
      }

      // Phase 11: AI CEO baseline orchestration bump
      if (G.phase === 11) {
        G.agentSpeedMult *= 1.8;
        G.payMult *= 1.6;
      }

      // Auto-deploy a service when reaching phase 11
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
    const original = createAgent("writer", 0);
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
    return !G.retired && G.agi.route === "buyout" && G.phase >= FINAL_PHASE && G.techDebt < 10 &&
      G.purchasedUpgrades.includes("sale_terms") && G.incidents.every((incident) => incident.resolved) && getIncomeRate() > getExpenseRate() * 2 && managedNodeCount() >= 100;
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
    return G.retired && !G.retirementFinal && !G.agi.ended;
  }


  function canTrueRetire() {
    return G.retired && !G.retirementFinal && !G.agi.ended;
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
    clearTaskCompletions();
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
      log("Offline earnings: +" + fmtCash(offline.net) + ". Away for " + Math.floor(offline.seconds / 60) + "m. Contract income " + fmtCash(offline.earned) + ", expenses " + fmtCash(offline.expenses) + ".", "good");
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
    if (G.phase >= 2 && G.phase <= 4) G.taskSpawnDelay = rand(0.25, 1.75) * (Math.random() < 0.15 ? 5 : 0.3);
    const batch = G.phase >= 10 ? Math.max(1, managedNodeCount()) : 1;
    for (let index = 0; index < batch; index++) spawnTask();
  }

  // ---------- AI CEO auto-management (Phase 11+) ----------
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
    if (G.phase >= 11 && G.ceoMode === "scale") return Infinity;
    if (G.ceoMode === "manage") return 5;
    return G.purchasedUpgrades.includes("cluster_capacity_3") ? 3 : G.purchasedUpgrades.includes("cluster_capacity_2") ? 2 : 1;
  }

  function nodeCost(provisioned = G.clustersProvisioned) {
    const scale = 1 + provisioned * 0.025;
    const hardware = G.purchasedUpgrades.includes("factory_direct") ? scale * 10 : scale * scale;
    return Math.ceil(1000000 * hardware * (G.phase >= 14 ? 0.65 : 1) * (G.phase >= 15 ? 0.6 : 1));
  }

  function provisionCost(provisioned = G.clustersProvisioned) {
    const constructionDiscount = (G.purchasedUpgrades.includes("standardised_construction") ? 0.5 : 1) * (G.purchasedUpgrades.includes("bulk_hardware") ? 0.5 : 1);
    return Math.ceil((12000 + (G.purchasedUpgrades.includes("ceo_full_fit") ? 40000 : 0) + (G.phase >= 13 ? nodeCost(provisioned) : Math.ceil(CLUSTER_COST * Math.pow(1.6, Math.max(0, provisioned - 1))))) * constructionDiscount);
  }


  function expansionFundingTarget() {
    const concurrency = clusterBuildConcurrency();
    const batch = concurrency >= NEOCLOUD_SIZE ? concurrency : 1;
    let budget = 0;
    for (let index = 0; index < batch; index++) budget += provisionCost(G.clustersProvisioned + index);
    return budget * 2;
  }

  function canPlanNextCluster() {
    if (G.ceoMode !== "scale" || G.clusters.length === 0) return false;
    if (G.phase >= 13) return true;
    const cluster = G.clusters.at(-1);
    const target = 9 + parseInt(cluster.id, 36) % 4;
    const ready = cluster.workerAgentIds.filter((id) => G.agents.find((agent) => agent.id === id).status !== "provisioning").length;
    return cluster.buildRemaining === 0 && ready >= target;
  }

  function clusterBuildDuration() {
    const neocloudSpeed = (G.purchasedUpgrades.includes("neocloud_pipeline") ? 2 : 1) * (G.purchasedUpgrades.includes("neocloud_supply_chain") ? 2 : 1);
    if (G.purchasedUpgrades.includes("ceo_continuous")) return 2 / expansionSpeed() / neocloudSpeed;
    const base = G.phase >= 15 ? 2 : G.phase >= 14 ? 3 : 12;
    return base / (G.purchasedUpgrades.includes("ceo_fast_builds") ? 2 : 1) / (G.purchasedUpgrades.includes("ceo_course") ? 2 : 1) / expansionSpeed() / neocloudSpeed;
  }

  function expansionSpeed() {
    return G.phase < 15 ? 1 : clamp(1 + (completedClusterCount() - 40) / 20, 1, 4);
  }

  function staggeredStartDelay(jobs, remaining, duration, spacing = 1) {
    if (jobs.length === 0) return 0;
    const latestStart = Math.max(...jobs.map((job) => job[remaining] - job[duration]));
    return Math.max(0, latestStart + rand(0.3, 0.4) / spacing);
  }

  function openCluster() {
    const cost = provisionCost();
    if (G.phase < 10 || G.clusters.length >= clusterCapacity() || G.cash < cost) return;
    G.cash -= cost;
    const duration = clusterBuildDuration();
    const concurrency = clusterBuildConcurrency();
    const spacing = concurrency >= NEOCLOUD_SIZE ? Math.max(1, concurrency * 0.8 / duration) : 1;
    const delay = staggeredStartDelay(G.clusters.filter((cluster) => cluster.buildRemaining > 0), "buildRemaining", "buildDuration", spacing);
    const cluster = addClusterWithNextName();
    cluster.invested = cost;
    cluster.buildDuration = duration;
    cluster.buildRemaining = cluster.buildDuration + delay;
    if (G.purchasedUpgrades.includes("ceo_full_fit")) {
      if (G.phase >= 13) cluster.workforce = cluster.workerSlotsMax;
      else for (let index = 0; index < cluster.workerSlotsMax; index++) provisionClusterAgent(cluster, cluster.buildDuration, delay);
    }
    if (G.clusters.length === 2) deliveryMetrics().showTasks = false;
    log(clusterDisplayName(cluster) + " provisioned for " + fmtCash(cost) + ".", "info");
  }

  function clusterSaleValue(cluster) {
    return Math.floor(cluster.invested * 0.6);
  }

  function sellCluster(clusterId) {
    const cluster = G.clusters.find((item) => item.id === clusterId);
    if (G.phase < 10 || G.phase >= 13 || G.clusters.length <= 1 || !cluster || cluster.workerAgentIds.length !== cluster.workerSlotsMax || !cluster.managerAssigned) return;
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
    log(clusterDisplayName(cluster) + " sold for " + fmtCash(price) + ".", "info");
  }

  function buyClusterWorker(clusterId, slotIndex) {
    const cluster = G.clusters.find((item) => item.id === clusterId);
    if (!cluster || slotIndex !== cluster.workerAgentIds.length) return;
    buyNextClusterWorker(clusterId);
  }

  function buyNextClusterWorker(clusterId) {
    const cluster = G.clusters.find((item) => item.id === clusterId);
    if (G.phase < 10 || G.phase >= 13 || !cluster || cluster.buildRemaining > 0 || !cluster.managerAssigned || cluster.workerAgentIds.length >= cluster.workerSlotsMax || G.cash < 2500) return;
    G.cash -= 2500;
    cluster.invested += 2500;
    const delay = staggeredStartDelay(provisioningAgents(), "provisionRemaining", "provisionDuration");
    provisionClusterAgent(cluster, (G.phase >= 12 ? 2 : 4) / (G.purchasedUpgrades.includes("ceo_recruitment") ? 2 : 1) / (G.purchasedUpgrades.includes("ceo_deploy_speed") ? 1.5 : 1), delay);
  }

  function provisionClusterAgent(cluster, duration, delay) {
    const agent = createAgent("coder");
    agent.name = newClusterAgentName();
    agent.specialty = TASK_TYPES.map((type) => type.id);
    agent.speed = 1;
    agent.quality = 1;
    agent.reliability = 1;
    agent.tokenCost = 1;
    agent.status = "provisioning";
    agent.provisionDuration = duration;
    agent.provisionRemaining = duration + delay;
    G.agents.push(agent);
    cluster.workerAgentIds.push(agent.id);
  }

  function canManuallyProvisionCluster() {
    if (G.phase < 10 || G.ceoMode === "scale" || G.clusters.length >= clusterCapacity() || G.clusters.some((cluster) => cluster.buildRemaining > 0)) return false;
    if (!clustersFull()) return false;
    return true;
  }

  function tickClusterManagers() {
    if (G.phase >= 13) return;
    for (const cluster of G.clusters) {
      if (!cluster.managerAssigned) continue;
      for (const id of cluster.workerAgentIds) {
        const agent = G.agents.find((item) => item.id === id);
        if (agent.tokenTank <= workerTokenCapacity(agent) * 0.1) {
          const amount = Math.min(cluster.tank, workerTokenCapacity(agent) - agent.tokenTank);
          cluster.tank -= amount;
          agent.tokenTank += amount;
        }
        if (agent.status !== "idle" || agent.tokenTank <= 0) continue;
        const task = findMatchingTask(agent, true);
        if (task) assignAgentToTask(task.id, agent.id);
      }
    }
  }

  function clusterIncomeRate(cluster) {
    return cluster.managerAssigned && cluster.tank > 0 ? cluster.workforce * 15 * G.payMult : 0;
  }

  function networkIncomeRate() {
    if (G.phase < 13) return 0;
    return G.clusters.reduce((total, cluster) => total + clusterIncomeRate(cluster), 0);
  }

  function tickNetwork(dtSec) {
    if (G.phase < 13) return;
    for (const cluster of G.clusters) {
      if (!cluster.managerAssigned || cluster.workforce === 0) continue;
      const rate = cluster.workforce * workerTokenRate() * G.tokenEfficiency;
      const elapsed = Math.min(dtSec, cluster.tank / rate);
      cluster.tank = Math.max(0, cluster.tank - elapsed * rate);
      G.tokensConsumed += elapsed * rate;
      const income = cluster.workforce * 15 * G.payMult * elapsed;
      G.cash += income;
      G.totalCashEarned += income;
      cluster.progress += cluster.workforce * G.batchSize * elapsed * (G.phase >= 15 ? 7 : G.phase === 14 ? 3 : 2) / 4;
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
        log(clusterDisplayName(cluster) + " online.", "info");
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
    const reserve = expansionReserve();
    tickAgentProvisioning(reserve);
    tickClusterProvisioning(reserve);
    const baseInterval = G.phase >= 15 ? 1000 : G.phase >= 14 ? 2000 : 5000;
    const interval = baseInterval / (G.purchasedUpgrades.includes("ceo_recruitment") ? 2 : 1) / (G.ceoMode === "scale" ? 2 : 1) / (G.purchasedUpgrades.includes("ceo_deploy_speed") ? 1.5 : 1) / (G.purchasedUpgrades.includes("ceo_course") ? 2 : 1) / expansionSpeed();
    if (Date.now() - G.lastCeoAction < interval) return;
    G.lastCeoAction = Date.now();
    if (G.phase >= 13) {
      const unfinished = G.clusters.find((cluster) => cluster.buildRemaining === 0 && (!cluster.managerAssigned || cluster.workforce < cluster.workerSlotsMax));
      if (unfinished) {
        const cost = (unfinished.managerAssigned ? 0 : 12000) + (unfinished.workerSlotsMax - unfinished.workforce) * 2500;
        if (G.cash - reserve < cost * 2) return;
        G.cash -= cost;
        unfinished.invested += cost;
        unfinished.managerAssigned = true;
        unfinished.tokenManagerAssigned = true;
        unfinished.workforce = unfinished.workerSlotsMax;
        log("CEO activated " + unfinished.name + ".", "info");
        return;
      }
    }
  }

  function tickAgentProvisioning(reserve) {
    if (G.phase >= 13) return;
    const capacity = G.purchasedUpgrades.includes("ceo_quad_batch") ? 4 : G.purchasedUpgrades.includes("ceo_batch") ? 2 : 1;
    for (let index = provisioningAgents().length; index < capacity; index++) {
      const hiring = G.clusters.find((cluster) => cluster.buildRemaining === 0 && cluster.managerAssigned && cluster.workerAgentIds.length < cluster.workerSlotsMax);
      if (!hiring || G.cash - reserve < 2500) break;
      buyNextClusterWorker(hiring.id);
    }
  }

  function expansionReserve() {
    let reserve = 0;
    for (const upgrade of PLAYER_RESERVED_UPGRADES) {
      if (upgrade.phase === G.phase && upgrade.cost > reserve && fundedCashUpgrade(upgrade)) reserve = upgrade.cost;
    }
    if (reserve) return reserve;
    const planned = agiNextUpgrade();
    return planned && agiUpgradeReady(planned) ? getUpgradeCost(planned) : 0;
  }

  function tickClusterProvisioning(reserve = expansionReserve()) {
    if (G.ceoMode !== "scale" || G.clusters.length === 0) return;
    if (G.cash < expansionFundingTarget() + reserve) return;
    const concurrent = clusterBuildConcurrency();
    const pending = G.clusters.filter((cluster) => !clusterOnline(cluster)).length;
    for (let index = pending; index < concurrent; index++) {
      if (G.cash - reserve < provisionCost() * 2) break;
      openCluster();
    }
  }

  function clusterBuildConcurrency() {
    if (G.phase >= 15 && G.purchasedUpgrades.includes("parallel_neoclouds")) return NEOCLOUD_SIZE * 2;
    if (G.phase >= 15 && G.purchasedUpgrades.includes("neocloud_batch")) return NEOCLOUD_SIZE;
    return G.phase >= 14 ? 4 : G.purchasedUpgrades.includes("ceo_parallel_clusters") ? 2 : 1;
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
      if (m.inboxTask && G.totalTasksDone === m.reqTasks && G.phase === 1) {
        G.tasks.push(generateInboxTask());
        renderWorkStream();
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
    if (!deliveryObservation || deliveryObservation.game !== G) deliveryObservation = { game: G, phase: G.phase, rate: 0, recent: [], showTasks: G.ceoMode === "off" && G.clusters.length < 2, purchase: "" };
    if (deliveryObservation.phase !== G.phase) {
      deliveryObservation.phase = G.phase;
      if (G.ceoMode === "off" && G.clusters.length < 2) deliveryObservation.showTasks = true;
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
    if (G.phase < 13) html += "<span class='delivery-queued'>" + queued + " queued</span><span class='delivery-running'>" + running + " in progress</span>";
    else html += "<span>" + managedNodeCount() + " managed nodes</span><span>" + "$" + fmtTokens(networkIncomeRate()) + "/s delivery revenue</span>";
    html += "</div>";
    if (G.phase < 13) {
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
    return G.musicMode;
  }

  function updateMusicToggleLabel() {
    var mode = getCurrentMusicMode();
    var label = mode === "off" ? "Off" : "On";
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
    if (G.phase >= 9) {
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

  function endingTransitionElapsed() {
    if (!G.retired || G.retirementFinal || (G.agi.ended && G.retiredAt !== runawayFadeStartedAt) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
    const elapsed = Math.max(0, Date.now() - G.retiredAt);
    return elapsed < ENDING_FADE_OUT_MS + ENDING_BLACK_PAUSE_MS + ENDING_FADE_IN_MS ? elapsed : null;
  }

  function syncSaleMusic(elapsed, soundtrackPath) {
    clearMusicFadeTimerIfAny();
    clearDrumFadeTimerIfAny();
    clearDrumCrossfadeTimerIfAny();
    clearSynthFadeTimerIfAny();
    ensureSoundtrackSource(soundtrackPath);
    hasDoneInitialMusicFadeIn = true;
    playAudioIfUnlocked(musicPlayer, "soundtrack");
    if (elapsed < ENDING_FADE_OUT_MS) {
      const volume = 1 - elapsed / ENDING_FADE_OUT_MS;
      musicPlayer.volume = MUSIC_TARGET_VOLUME * volume;
      for (const player of [drumPlayer, outgoingDrumPlayer]) {
        if (player) player.volume = DRUM_TARGET_VOLUME * volume;
      }
      if (synthPlayer) synthPlayer.volume = SYNTH_TARGET_VOLUME * volume;
    } else {
      stopDrumPlayback();
      stopSynthPlayback();
      musicPlayer.volume = MUSIC_TARGET_VOLUME * clamp((elapsed - ENDING_FADE_OUT_MS - ENDING_BLACK_PAUSE_MS) / ENDING_FADE_IN_MS, 0, 1);
    }
  }

  function syncMusicPlayback() {
    if (!musicPlayer) return;
    var mode = getCurrentMusicMode();
    var nextSoundtrackPath = getCurrentSoundtrackPath();
    var nextDrumLayerPath = getCurrentDrumLayerPath();

    if (mode === "off" || !G.gameStarted) {
      clearMusicFadeTimerIfAny();
      stopAndResetAudio(musicPlayer, MUSIC_TARGET_VOLUME);
      activeSoundtrackPath = null;
      stopDrumPlayback();
      stopSynthPlayback();
      return;
    }

    const saleElapsed = G.agi.ended ? null : endingTransitionElapsed();
    if (saleElapsed !== null && nextSoundtrackPath) {
      syncSaleMusic(saleElapsed, nextSoundtrackPath);
      return;
    }

    syncBaseSoundtrack(nextSoundtrackPath);
    if (!nextSoundtrackPath || G.retired) {
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
    G.musicMode = mode === "off" ? "on" : "off";
    updateMusicToggleLabel();
    syncMusicPlayback();
    save();
  }

  function resetSettingsPopupState() {
    $("#settings-msg").textContent = "";
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
    clearTaskCompletions();
    const newState = defaultState();
    newState.musicMode = G.musicMode;
    try {
      localStorage.setItem("ai_empire_save", JSON.stringify(newState));
    } catch (error) {
      if (!(error instanceof DOMException) || !["SecurityError", "QuotaExceededError"].includes(error.name)) throw error;
      storageMessage("Reset failed because browser storage is unavailable. Allow storage or free space and try again.");
      return;
    }
    saveBlocked = true;
    location.reload();
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
    if (document.querySelector(".popup-overlay.show")) {
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
    if (G.agi.route === "scaling") { tickAgi(dtSec); return; }

    const consumedBefore = G.tokensConsumed;
    const completedBefore = G.totalTasksDone;
    tickConstruction(dtSec);
    if (G.phase < 13) tickTaskSpawn();
    tickNetwork(dtSec);
    tickManualWork(dtSec);
    tickAssistant(dtSec);
    tickAiWorker(dtSec);
    tickManager();
    tickAgents(dtSec);
    tickAgentAutoAssign();
    if (dtSec > 0) G.averageTokenBurn += ((G.tokensConsumed - consumedBefore) / dtSec - G.averageTokenBurn) * (1 - Math.exp(-dtSec / 5));
    if (dtSec > 0 && G.phase >= 10) {
      const metrics = deliveryMetrics();
      metrics.rate += ((G.totalTasksDone - completedBefore) / dtSec - metrics.rate) * (1 - Math.exp(-dtSec / 10));
    }
    tickTokenManager();
    tickIncidents(dtSec);
    tickManualRepairs(dtSec);
    tickDevopsIncidentResponse(dtSec);
    tickServices(dtSec);
    tickExpenses(dtSec);
    tickDebt(dtSec);
    tickAiCeo();
    tickSalePreparation(dtSec);
    tickAgi(dtSec);

    pruneTasks(now);

    // Check phase-based milestones periodically
    checkMilestones();

    // Auto-save
    if (now - G.lastSave > SAVE_INTERVAL) save();
  }

  function patchChildren(target, source) {
    const desired = [...source.childNodes];
    const taskCards = target.id === "task-list" ? new Map([...target.children].map((child) => [child.dataset.taskId, child])) : null;
    if (taskCards) {
      const desiredTaskIds = new Set(desired.filter((child) => child.nodeType === 1).map((child) => child.getAttribute("data-task-id")));
      for (const [taskId, card] of taskCards) {
        if (!desiredTaskIds.has(taskId)) {
          card.remove();
          taskCards.delete(taskId);
        }
      }
    }
    for (let index = 0; index < desired.length; index++) {
      const next = desired[index];
      let current = target.childNodes[index];
      const taskId = taskCards && next.nodeType === 1 && next.getAttribute("data-task-id");
      if (taskId && (!current || current.nodeType !== 1 || current.dataset.taskId !== taskId)) {
        const existing = taskCards.get(taskId);
        if (existing) {
          target.insertBefore(existing, current || null);
          current = existing;
        } else {
          target.insertBefore(next.cloneNode(true), current || null);
          continue;
        }
      }
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

  function clearTaskCompletions() {
    $("#task-completions").replaceChildren();
  }

  function showTaskCompletion(task) {
    if (document.hidden) return;
    const list = $("#task-list");
    const card = [...list.children].find((element) => element.dataset.taskId === task.id);
    if (!card || list.hidden) return;
    const layer = $("#task-completions");
    const note = card.cloneNode(true);
    note.classList.add("task-completed");
    note.removeAttribute("data-task-id");
    note.dataset.taskCompletion = task.id;
    note.dataset.taskState = "done";
    note.setAttribute("aria-hidden", "true");
    note.setAttribute("inert", "");
    let left = card.offsetLeft;
    let top = card.offsetTop;
    for (let parent = card.offsetParent; parent && parent !== $("#task-queue-section"); parent = parent.offsetParent) {
      left += parent.offsetLeft - parent.scrollLeft;
      top += parent.offsetTop - parent.scrollTop;
    }
    note.style.left = left + "px";
    note.style.top = top + "px";
    note.style.width = card.offsetWidth + "px";
    note.style.height = card.offsetHeight + "px";
    const transform = getComputedStyle(card).transform;
    note.style.setProperty("--completed-transform", transform === "none" ? "matrix(1,0,0,1,0,0)" : transform);
    note.style.transform = transform;
    note.querySelector(".task-assignee").textContent = "Done";
    note.querySelector(".task-bar-fill").style.width = "100%";
    const work = note.querySelector("[data-task-work]");
    if (work) work.textContent = "Work: " + task.workRequired + "/" + task.workRequired;
    while (layer.children.length >= 6) layer.firstElementChild.remove();
    layer.appendChild(note);
    setTimeout(() => note.remove(), 550);
  }

  function selectLayout(layoutId) {
    const buttons = [...document.querySelectorAll("[data-layout-choice]")];
    const selected = buttons.find((button) => button.dataset.layoutChoice === layoutId);
    if (!selected) return false;
    clearTaskCompletions();
    document.body.dataset.layout = layoutId;
    for (const button of buttons) button.setAttribute("aria-pressed", String(button === selected));
    return true;
  }

  function handleLayoutSelection(event) {
    const layoutId = event.currentTarget.dataset.layoutChoice;
    selectLayout(layoutId);
    try {
      localStorage.setItem("ai_empire_layout", layoutId);
    } catch (error) {
      if (!(error instanceof DOMException) || !["SecurityError", "QuotaExceededError"].includes(error.name)) throw error;
      storageMessage("Layout could not be saved. Allow browser storage or free space and select the layout again.");
    }
  }

  function initLayoutSwitcher() {
    let requested = "4";
    try {
      requested = localStorage.getItem("ai_empire_layout") || "4";
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "SecurityError") throw error;
      storageMessage("Browser storage is blocked. Layout changes cannot be saved.");
    }
    if (!selectLayout(requested)) selectLayout("4");
    for (const button of document.querySelectorAll("[data-layout-choice]")) button.addEventListener("click", handleLayoutSelection);
  }

  function tokensLow() {
    return G.tokens < (G.phase >= 7 ? MANAGER_TOPUP_COST_TOKEN : workerTokenCapacity());
  }

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
	    $("#phase-label").textContent = "Phase " + G.phase + (PHASE_NAMES[G.phase] ? ": " + PHASE_NAMES[G.phase] : "");

    // Progressive reveal of resource counters
    $("#res-cash-wrap").style.display = G.uiRevealed.cash ? "" : "none";
    $("#res-tokens-wrap").style.display = G.uiRevealed.tokens ? "" : "none";
    $("#res-debt-wrap").style.display = G.uiRevealed.debt && G.techDebt > 0 ? "" : "none";
    $("#res-debt-wrap").classList.toggle("res-debt-active", G.techDebt > 0);

    // Warning pulse
    $("#res-tokens-wrap").classList.toggle("res-warning", tokensLow());

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
    expenseWrap.style.display = G.uiRevealed.expenses && G.purchasedUpgrades.includes("reality_check") ? "" : "none";
    $("#expense-rate").textContent = "-" + "$" + fmtTokens(expense) + "/s";
    var expTier = null;
    for (var ti = 0; ti < EXPENSE_TIERS.length; ti++) {
      if (G.phase >= EXPENSE_TIERS[ti].phase) expTier = EXPENSE_TIERS[ti];
    }
    $("#expense-tier-label").textContent = expTier ? expTier.name : "Expenses";
  }

  function renderWorkStream() {
    const prelude = G.gameStarted && !G.uiRevealed.taskQueue;
    if (!G.gameStarted || prelude) clearTaskCompletions();
    $("#prelude-section").hidden = !prelude;
    $("#tasks-heading").style.visibility = G.gameStarted && G.uiRevealed.taskQueue ? "visible" : "hidden";
    if (prelude) {
      const task = G.tasks.find((item) => item.status === "active" || item.status === "available");
      const working = task && task.status === "active";
      $("#prelude-card").disabled = !!working || manualRepairs().length > 0 || availableManualSlots() === 0;
      $("#prelude-action").hidden = !!working || G.manualTasksCompleted > 0;
      $("#prelude-hint").textContent = OPENING_GIGS[G.manualTasksCompleted % OPENING_GIGS.length].description;
      $("#prelude-task").textContent = task ? task.name : "Your next gig";
      $("#prelude-pay").textContent = task ? "Pay: " + fmtCash(getTaskCashPayout(task, "manual", null)) : "";
      $("#prelude-progress").hidden = !working;
      $("#prelude-status").hidden = !working;
      const progress = task ? Math.floor(task.workDone / task.workRequired * 100) : 0;
      $("#prelude-bar").style.width = progress + "%";
      $("#prelude-progress").setAttribute("aria-valuenow", progress);
      $("#prelude-status").textContent = task ? fmtCash(getTaskCashPayout(task, "manual", null)) + " reward · " + progress + "% done" : "";
    }
    const compact = G.phase >= 11 || (G.phase === 10 && G.clusters.length >= 2);
    $("#delivery-summary").hidden = !compact;
    $("#task-list").hidden = compact && (G.phase >= 13 || !deliveryMetrics().showTasks);
    if (compact) {
      $("#task-queue-section").style.display = "block";
      $("#tasks-complete-count").textContent = fmtTokens(G.totalTasksDone);
      renderDeliverySummary();
      if (!$("#task-list").hidden) renderTaskQueue();
      else updateHTML($("#task-list"), "");
      $("#no-tasks").style.display = "none";
      return;
    }
    // Early game: show big Do Task button
    // The first card now offers inbox setup in the same position as normal tasks.
    // The central opening precedes that first queued card.
    // Normal game: show task queue
    // Work controls now live in Agents throughout the opening; cards show assignments.
    $("#task-queue-section").style.display = G.gameStarted && G.uiRevealed.taskQueue ? "block" : "none";
    $("#tasks-complete-count").textContent = fmtTokens(G.totalTasksDone);
    renderTaskQueue();
  }

  function getAiWorkerDisplayName() {
    return G.phase >= 3 ? "AI 2000 Basic" : "AI 2000 Free";
  }

  function getAgentTaskLabel(agentName) {
    if (!agentName) return "Agent";
    if (agentName.length <= 10) return agentName;
    return agentName.slice(0, 10) + "...";
  }

  function taskCardAngle(id) {
    let hash = 2166136261;
    for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507) >>> 0;
    return (-2 + hash / 4294967295 * 4.4).toFixed(3);
  }

  function renderTaskQueue() {
    var list = $("#task-list");
    var noTasks = $("#no-tasks");
    var tasks = G.tasks.filter((task) => task.status !== "done");

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

      const owner = t.status === "available" ? "Unassigned" : t.status === "active" ? "You" : t.status === "assistant" ? "Assistant" : t.status === "ai" ? getAiWorkerDisplayName() : getAgentTaskLabel(agent.name);
      const actions = "<span class='task-assignee' title='" + (agent ? agent.name : owner) + "' data-assignment='" + t.status + "'>" + owner + "</span>";
      var displayedPay = getTaskCashPayout(t, t.status === "agent" ? "agent" : t.status === "assistant" ? "assistant" : "manual", agent);

      // Task expiry countdown
      var expiryHtml = "";
      if (G.taskExpiryEnabled && t.status === "available") {
        var timeLeft = Math.max(0, TASK_EXPIRY_MS / 1000 - (Date.now() - t.createdAt) / 1000);
        if (timeLeft < 15) {
          expiryHtml = "<span class='task-expiry'>" + Math.ceil(timeLeft) + "s</span>";
        }
      }

      // Client name gated behind taskDetails upgrade (Sticky Note System)
      var clientHtml = "";
      if (G.taskDetails && t.client) {
        clientHtml = "<span class='task-client'>From: " + t.client + "</span>";
      }

      // Pay is always visible; other details gated behind task count
      var metaHtml = "<span class='task-meta'>" +
        (t.batchSize > 1 ? "<span>Batch: " + fmtTokens(t.batchSize) + " tasks</span>" : "") + "<span>Pay: <strong style='color:var(--cash)'>" + fmtCash(displayedPay) + "</strong></span>";
      if (G.totalTasksDone >= 20) {
        metaHtml +=
          "<span data-task-work>Work: " + Math.ceil(t.workDone) + "/" + t.workRequired + "</span>";
      }
      metaHtml += "</span>";

      var taskCardClass = "card task-card" + (expiryHtml ? " has-expiry" : "");
      const disabled = t.status !== "available" || manualRepairs().length > 0 || availableManualSlots() === 0;
      html += "<button type='button' class='" + taskCardClass + "' data-task-id='" + t.id + "' data-task-state='" + t.status + "' style='--paper-angle:" + taskCardAngle(t.id) + "deg'" + (disabled ? " disabled" : "") + ">" +
        expiryHtml +
        "<span class='task-header'><span class='task-name'><span class='task-icon' aria-hidden='true'>▤</span> " + t.name + "</span>" + clientHtml + "</span>" +
        metaHtml +
        "<span class='task-bottom'><span class='task-actions'>" + actions + "</span>" +
        "<span class='task-bar'><span class='task-bar-fill' style='width:" + pct + "%'></span></span></span>" +
        "</button>";
    }
    updateHTML(list, html);
  }

  function renderSaleStatus(upgrade) {
    if (!upgrade.saleDuration && upgrade.id !== "fusion") return "";
    const steps = UPGRADES.filter((item) => item.saleDuration || item.id === "fusion");
    const previous = steps.filter((item) => G.purchasedUpgrades.includes(item.id)).at(-1);
    let html = "<p class='sale-step-label'>Company sale · Step " + (steps.indexOf(upgrade) + 1) + " of " + steps.length + "</p>";
    if (previous) html += "<p class='sale-story'>" + previous.saleOutcome + "</p>";
    if (G.salePreparation.upgradeId === upgrade.id) {
      const progress = 100 * (1 - G.salePreparation.remaining / upgrade.saleDuration);
      return html + "<p class='sale-activity' role='status'>" + upgrade.saleActivity + " · " + Math.ceil(G.salePreparation.remaining) + "s remaining</p><div class='task-bar sale-progress' role='progressbar' aria-label='Sale preparation' aria-valuemin='0' aria-valuemax='100' aria-valuenow='" + Math.round(progress) + "'><div class='task-bar-fill' style='width:" + progress + "%'></div></div>";
    }
    const nodes = completedClusterCount();
    if (upgrade.reqNodes) html += "<p class='sale-size'>" + (nodes >= upgrade.reqNodes ? "Company size requirement met: " + nodes + " online" : "Company size: " + nodes + " / " + upgrade.reqNodes + " online") + "</p>";
    if (upgrade.id === "fusion") {
      const incidents = G.incidents.filter((incident) => !incident.resolved).length;
      const income = getIncomeRate();
      const expenses = getExpenseRate();
      const checks = [
        [G.cash >= upgrade.cost, "Cash: " + fmtCash(G.cash) + " / " + fmtCash(upgrade.cost)],
        [G.techDebt < 10, "Technical debt: " + Math.round(G.techDebt) + " / below 10"],
        [incidents === 0, incidents + " unresolved incidents"],
        [income > expenses * 2, "Income $" + fmtTokens(income) + "/s must exceed twice expenses ($" + fmtTokens(expenses * 2) + "/s)"],
      ];
      html += "<ul class='sale-readiness' aria-label='Sale readiness'>" + checks.map(([ready, label]) => "<li class='" + (ready ? "ready" : "waiting") + "'>" + (ready ? "✓ " : "○ ") + label + "</li>").join("") + "</ul>";
    }
    return html;
  }

  function renderUpgradeSection() {
    var section = $("#section-upgrades");
    if (!G.uiRevealed.upgrades) { section.style.display = "none"; return; }
    section.style.display = "";

    const previousAction = $("#upgrade-list .upgrade-card .upgrade-action")?.getAttribute("onclick");
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
      if (available[i].id === "ai_ceo" || (G.phase >= 11 && available[i].id.startsWith("token_pack_"))) continue;
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
      var preparing = G.salePreparation.upgradeId === u.id;
      var requirementsMet = upgradeRequirementsMet(u);
      const authority = u === AGI_AUTHORITY;
      const needsInput = ((authority && canAfford && requirementsMet) || u.id === "fusion" || u.id === "retire_unlock") && !preparing ? " <span class='badge badge-yellow input-needed'>Input needed</span>" : "";
      const actionLabel = preparing ? "In progress" :
        authority ? "Approve · " + fmtCash(cost) :
        u.currency === "tasks" ? fmtTokens(u.reqTasks) + " tasks" :
        u.currency === "cash" ? (cost === 0 ? "" : fmtCash(cost)) : fmtTokens(u.cost) + " tok";
      html += "<div class='card upgrade-card" + (u.saleDuration || u.id === "fusion" ? " sale-card" : "") + "'>" +
        "<div class='upgrade-info'>" +
        "<div class='name'>" + u.name + needsInput + (u.unlockPhase ? " <span class='badge badge-purple'>-> Phase " + u.unlockPhase + "</span>" : "") + "</div>" +
        "<div class='desc'>" + u.desc + (u.id === "reality_check" ? " Bills cost $" + fmtTokens(getExpenseRate(true)) + "/s." : "") + "</div>" +
        renderSaleStatus(u) +
        "</div>" +
        "<div class='upgrade-purchase'>" +
        "<button class='upgrade-action' onclick=\"GAME.buy('" + u.id + "')\" " + (preparing || !canAfford || !requirementsMet ? "disabled" : "") + (u.currency === "cash" && cost === 0 ? " aria-label='" + u.name + "'" : "") + ">" + actionLabel + "</button>" +
        "</div>" +
        "</div>";
    }
    if (visible.length === 0 && !agiRouteReady()) html += "<div class='upgrade-space' aria-hidden='true'></div>";
    // Repeatables (always shown, compact row)
    for (var i = 0; i < repeatables.length; i++) {
      var u = repeatables[i];
      var cost = getUpgradeCost(u);
      var canAfford = u.currency === "cash" ? G.cash >= cost : G.tokens >= u.cost;
      html += "<div class='upgrade-repeatable' style='position:relative;display:inline-flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg2);border:1px solid var(--bg3);border-radius:var(--radius);margin-right:6px;margin-bottom:6px'>" +
        "<span class='text-sm'>" + (u.id.startsWith("token_pack_") ? "Token Pack (" + fmtTokens(tokenPackAmount(u)) + ")" : u.name) + "</span>" +
        "<button class='upgrade-action" + (u.id.startsWith("token_pack_") && tokensLow() ? " token-purchase-warning" : "") + "' onclick=\"GAME.buy('" + u.id + "')\" " + (!canAfford ? "disabled" : "") + " style='padding:2px 10px'>" + (u.currency === "cash" ? fmtCash(cost) : fmtTokens(u.cost) + " tok") + "</button>" +
        "</div>";
    }
    updateHTML($("#upgrade-list"), html);
    const nextAction = $("#upgrade-list .upgrade-card .upgrade-action")?.getAttribute("onclick");
    if (G.phase >= 15 && nextAction && nextAction !== previousAction) revealAgiTarget();
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
  // manager always leads in phase 7+
  // assignable
  // working or utility
  function availableHireRoles() {
    return AGENT_ROLES.filter((role) =>
      (!UTILITY_ROLES.includes(role.id) || !G.agents.some((agent) => agent.roleId === role.id)) &&
      (role.id !== "manager" || G.managerUnlock) &&
      (role.id !== "token_mgr" || G.purchasedUpgrades.includes("token_manager_unlock")) &&
      (role.id !== "devops" || G.purchasedUpgrades.includes("devops_unlock")) && (role.id !== "sales" || G.phase >= 9));
  }

  function renderAgentCard(agent) {
    const utility = UTILITY_ROLES.includes(agent.roleId);
    const manager = agent.roleId === "manager";
    const original = agent.roleId === "original_ai";
    const capacity = manager ? MANAGER_TOKEN_TANK_MAX : workerTokenCapacity(agent);
    const tokens = manager ? G.managerTokenTank : agent.tokenTank;
    const noTokens = G.phase >= 3 && G.tokens <= 0;
    const action = original ? "GAME.topUpAiWorker()" : manager ? "GAME.topUpManager()" : "GAME.topUpAgent('" + agent.id + "')";
    let html = "<div class='card agent-card" + (["manager", "token_mgr"].includes(agent.roleId) ? " management-agent" : "") + (G.phase >= 9 ? " simple-agent" : "") + ((!utility || manager) && tokens <= 0 ? " res-warning" : "") + "'" + (utility ? "" : " data-agent-slot='" + (original ? 0 : agent.slotIndex) + "'") + "><div class='agent-icon' aria-hidden='true'>" + AGENT_MARKERS[agent.roleId] + "</div><div class='agent-info'><div class='name'>" + (agent.olderModel ? "AI 2000 Basic" : agent.name) + " <span class='role'>" + (agent.olderModel ? "Older model · slow" : G.phase < 5 ? "" : agent.roleId === "token_mgr" ? "Token Assistant" : agent.roleName) + "</span></div>";
    if (original) html += "<small>" + G.aiWorkerTasksCompleted + " tasks delivered</small>";
    if (!utility || manager) html += "<div class='agent-token-count'>" + fmtTokens(tokens) + "/" + fmtTokens(capacity) + " tokens" + (tokens <= 0 ? " <span class='token-empty'>Empty</span>" : "") + "</div><div class='task-bar'><div class='task-bar-fill' style='width:" + clamp(tokens / capacity * 100, 0, 100) + "%'></div></div>";
    else html += "<span class='text-sm'>" + (agent.roleId === "token_mgr" ? "Buys token for manager agent" : "Resolving incidents") + "</span>";
    html += "</div><div class='agent-action-col'>";
    if (!utility || manager) html += managerControls(agent) && !manager ? "<span class='agent-managed' role='status'>Managed</span>" : "<button class='btn btn-refill btn-sm' onclick=\"" + action + "\" " + (noTokens ? "disabled>No tokens" : ">Add tokens") + "</button>";
    if (G.phase >= 5) html += "<button class='btn btn-outline btn-sm' onclick=\"" + (original ? "GAME.shutdownAiWorker()" : "GAME.fire('" + agent.id + "')") + "\">Sell</button>";
    html += "</div></div>";
    return html;
  }

  function renderAgentSection() {
    const section = $("#section-agents");
    section.style.display = G.gameStarted && G.uiRevealed.taskQueue && !G.uiRevealed.clusters ? "" : "none";
    if (!G.gameStarted || !G.uiRevealed.taskQueue || G.uiRevealed.clusters) return;
    updateHTML($("#agent-hire-section"), "");
    const title = G.purchasedUpgrades.includes("second_ai") ? "Agents" : G.purchasedUpgrades.includes("hire_assistant") ? "Team" : "";
    $("#team-heading").textContent = title;
    $("#team-header").hidden = !title;
    let html = renderAssistantCard();
    const cost = getAgentHireCost(G.agents.length);
    const reserved = reservedHireRoles();
    for (const roleId of ["manager", "token_mgr"]) {
      const agent = G.agents.find((item) => item.roleId === roleId);
      if (agent) html += renderAgentCard(agent);
      else if (reserved.includes(roleId)) {
        const name = roleId === "manager" ? "Manager" : "Token Assistant";
        const price = getAgentHireCost(G.agents.length, roleId);
        html += "<button class='card hire-slot management-agent " + (roleId === "manager" ? "manager-slot" : "token-manager-slot") + "' onclick=\"GAME.hire('" + roleId + "')\" " + (G.cash < price || sharedAgentCount() >= getHireAgentCapacity() ? "disabled" : "") + "><span class='vacancy-heading'><strong>" + name + "</strong><span>" + fmtCash(price) + "</span></span><span class='manager-purchase-detail'><span>" + (roleId === "manager" ? "Assigns work and refills agents" : "Buys token for manager agent") + "</span><span>Buy</span></span></button>";
      }
    }
    const workers = G.agents.filter((item) => !UTILITY_ROLES.includes(item.roleId));
    if (G.phase < 5) {
      html += renderAiWorkerCard();
      for (const agent of workers) html += renderAgentCard(agent);
    }
    const hireRoles = availableHireRoles().filter((item) => !UTILITY_ROLES.includes(item.id));
    for (let slot = 0; G.phase >= 5 && slot < workerSlotCount(); slot++) {
      if (slot === 0 && !G.aiWorkerShutdown) { html += renderAiWorkerCard(); continue; }
      const agent = workers.find((item) => item.slotIndex === slot);
      if (agent) { html += renderAgentCard(agent); continue; }
      const number = slot + getSharedAgentPoolSize() - workerSlotCount() + 1;
      html += "<div class='card hire-slot agent-vacancy' data-agent-slot='" + slot + "'><div class='vacancy-heading'><strong>Agent slot " + number + "</strong><span>" + fmtCash(cost) + "</span></div><div class='agent-buy-options'>";
      for (const role of hireRoles) html += "<button class='btn btn-sm' aria-label='Buy " + role.name + "' onclick=\"GAME.hire('" + role.id + "'," + slot + ")\" " + (G.cash < cost ? "disabled" : "") + ">" + role.name + "</button>";
      html += "</div></div>";
    }
    updateHTML($("#agent-list"), html);
    section.style.display = html ? "" : "none";
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
    const filled = G.phase >= 13 ? index < cluster.workforce : Boolean(agent);
    const label = G.phase < 13 && agent ? agent.name : "";
    const identity = clusterDisplayName(cluster) + ", agent slot " + (index + 1);
    if (agent && agent.status === "provisioning") {
      const progress = clamp(100 * (1 - agent.provisionRemaining / agent.provisionDuration), 0, 100);
      return "<span class='capacity-slot provisioning' role='progressbar' aria-label='Provisioning agent' aria-valuemin='0' aria-valuemax='100' aria-valuenow='" + progress + "' title='Installing " + identity + "' style='--progress:" + progress + "%'>" + label + "</span>";
    }
    if (!filled && !delegated && G.phase < 13) return "<button class='capacity-slot empty provision-agent' onclick=\"GAME.buyClusterWorker('" + cluster.id + "'," + index + ")\" aria-label='Provision agent for $2,500' title='Add " + identity + "' " + (G.cash < 2500 || !cluster.managerAssigned || index !== cluster.workerAgentIds.length ? "disabled" : "") + ">+</button>";
    return "<span class='capacity-slot " + (filled ? "filled" : "empty") + "' title='" + identity + (filled ? " online" : " vacant") + "'>" + (filled ? label : "+") + "</span>";
  }

  function clusterConstructionProgress(cluster) {
    return clamp(1 - cluster.buildRemaining / cluster.buildDuration, 0, 1);
  }

  function clusterConstructionStage(progress) {
    return ["Procuring GPUs", "Racking hardware", "Installing software", "Final checks"][Math.min(3, Math.floor(progress * 4))];
  }

  function renderClusterCard(cluster) {
    const compact = G.phase >= 13;
    const delegated = G.phase >= 11 && G.ceoMode !== "off";
    const count = compact ? cluster.workforce : cluster.workerAgentIds.filter((id) => G.agents.find((agent) => agent.id === id).status !== "provisioning").length;
    const title = clusterDisplayName(cluster) + ": " + count + "/" + cluster.workerSlotsMax + " agents, " + fmtTokens(cluster.tank) + " tokens";
    let html = "<div class='cluster-card' data-cluster-id='" + cluster.id + "' title='" + title + "'>";
    html += "<div class='cluster-hdr'><strong>" + clusterDisplayName(cluster) + "</strong>";
    if (!compact && count === cluster.workerSlotsMax && G.clusters.length > 1) html += "<button class='btn btn-outline btn-sm cluster-sell' onclick=\"GAME.sellCluster('" + cluster.id + "')\">Sell</button>";
    html += "</div>";
    if (cluster.buildRemaining > 0) {
      const fraction = clusterConstructionProgress(cluster);
      const progress = fraction * 100;
      const stage = clusterConstructionStage(fraction);
      return html + "<p class='text-sm'>" + stage + "</p><div class='task-bar cluster-construction-progress' role='progressbar' aria-label='Cluster construction' aria-valuemin='0' aria-valuemax='100' aria-valuenow='" + Math.round(progress) + "'><div class='task-bar-fill' style='width:" + progress + "%'></div></div></div>";
    }
    const installing = cluster.workerAgentIds.some((id) => G.agents.find((agent) => agent.id === id).status === "provisioning");
    const status = count < cluster.workerSlotsMax ? (count > 0 ? "Partially Operational" : installing ? "Installing agents" : "Needs Agents") : cluster.tank > 0 ? "Operating" : "Awaiting tokens";
    html += "<p class='text-sm cluster-status" + (status === "Needs Agents" ? " needs-agents" : "") + "'>" + status + "</p><div class='cluster-capacity" + (compact ? " autonomous-capacity" : "") + "' style='--cluster-columns:" + (cluster.workerSlotsMax === 9 ? 3 : 4) + "' aria-label='" + count + " of " + cluster.workerSlotsMax + " agents online'>";
    for (let index = 0; index < cluster.workerSlotsMax; index++) html += renderClusterSlot(cluster, index, delegated);
    return html + "</div></div>";
  }

  function renderPlanningCard() {
    const funding = expansionFundingTarget() + expansionReserve();
    const stage = G.cash < funding ? "Securing " + fmtCash(funding) + " funding" : ["Searching for land", "Negotiating with council", "Drafting lease"][G.clustersProvisioned % 3];
    return "<div class='cluster-card planning-card' aria-label='Next cluster: planning'><strong>" + clusterCode(G.clustersProvisioned + 1) +
      "</strong><span>Planning</span><small>" + stage + "</small><small>Build cost · " + fmtCash(provisionCost()) + "</small></div>";
  }

  function neocloudGroups(nextCloud) {
    const groups = new Map();
    if (nextCloud) groups.set(nextCloud, Array(NEOCLOUD_SIZE).fill(null));
    for (const cluster of G.clusters) {
      const index = Number(cluster.name.slice(8)) - 1;
      const number = Math.floor(index / NEOCLOUD_SIZE) + 1;
      if (!groups.has(number)) groups.set(number, Array(NEOCLOUD_SIZE).fill(null));
      groups.get(number)[index % NEOCLOUD_SIZE] = cluster;
    }
    return [...groups.entries()].sort(([a], [b]) => b - a);
  }

  function renderNeoclouds(planning) {
    const nextCloud = planning ? Math.floor(G.clustersProvisioned / NEOCLOUD_SIZE) + 1 : 0;
    const funding = planning ? expansionFundingTarget() + expansionReserve() : 0;
    let html = "<div class='neocloud-list'>";
    for (const [number, slots] of neocloudGroups(nextCloud)) {
      const cloud = neocloudIdentity(number);
      let online = 0;
      let progress = 0;
      let income = 0;
      let currentStage = "";
      const tiles = slots.map((cluster, index) => {
        if (!cluster) return "<span class='neocloud-slot empty' aria-hidden='true'></span>";
        const ready = clusterOnline(cluster);
        const fraction = cluster.buildRemaining > 0 ? clusterConstructionProgress(cluster) : Number(ready);
        const stage = ready ? "Online" : cluster.buildRemaining > 0 ? clusterConstructionStage(fraction) : "Preparing";
        const label = clusterDisplayName(cluster) + " · " + stage;
        online += Number(ready);
        progress += fraction;
        income += clusterIncomeRate(cluster);
        if (!ready && !currentStage) currentStage = clusterDisplayName(cluster) + " · " + stage;
        return "<div class='cluster-card neocloud-slot' data-cluster-id='" + cluster.id + "' data-state='" + (ready ? "online" : "building") +
          "' role='img' aria-label='" + label + "' title='" + label + "'><strong aria-hidden='true'>" + String((number - 1) * NEOCLOUD_SIZE + index + 1).padStart(4, "0") + "</strong></div>";
      }).join("");
      const state = currentStage ? "Building" : number === nextCloud ? "Planning" : "Online";
      const status = currentStage || (state === "Planning" && G.cash < funding ? "Planning · " + fmtCash(funding) + " funding target" : state);
      html += "<section class='neocloud" + (state === "Online" ? "" : " active") + "' data-neocloud='" + number + "' aria-label='" + cloud.name + " · " + cloud.id +
        "'><div class='neocloud-header'><strong>" + cloud.name + " <small>" + cloud.id + "</small></strong><span>" + online + "/" + NEOCLOUD_SIZE + " online</span></div>" +
        "<p class='neocloud-summary'>" + clusterCode((number - 1) * NEOCLOUD_SIZE + 1) + "–" + clusterCode(number * NEOCLOUD_SIZE) + " · " + fmtCash(income) + "/s</p>" +
        "<div class='network-grid'>" + tiles + "</div><p class='neocloud-status' title='" + status + "'>" + status + "</p>" +
        "<progress class='neocloud-progress' aria-label='Neocloud construction' max='" + NEOCLOUD_SIZE + "' value='" + progress.toFixed(2) + "'></progress></section>";
    }
    return html + "</div>";
  }

  function renderClusterSection() {
    const section = $("#section-clusters");
    section.style.display = G.uiRevealed.clusters ? "" : "none";
    if (!G.uiRevealed.clusters) return;
    const minimal = G.phase >= 15;
    const planning = canPlanNextCluster();
    const tiles = G.clusters.length + (canManuallyProvisionCluster() || planning ? 1 : 0);
    const density = Math.max(0, tiles - 3);
    const overview = density > 0;
    $("#cluster-count").textContent = managedNodeCount() + " online / " + G.clusters.length + " clusters";
    $("#cluster-heading").textContent = minimal ? "Neoclouds" : "Clusters";
    let html = "";
    if (G.phase >= 11) {
      const purchase = deliveryMetrics().purchase;
      html += "<div class='company-leadership' aria-label='Company leadership'>";
      if (G.ceoMode === "off") html += "<button class='card hire-slot management-agent leadership-agent ceo-slot' onclick=\"GAME.buy('ai_ceo')\" " + (G.cash < 1000000 ? "disabled" : "") + "><span class='provision-icon'>+</span><strong>Provision AI CEO</strong><span>$1M</span><span class='hire-arrow' aria-hidden='true'>→</span></button>";
      else html += "<div class='card management-agent leadership-agent'><span class='agent-icon' aria-hidden='true'>CEO</span><div><strong>AI CEO</strong><p class='ceo-status'>" + (G.ceoMode === "manage" ? "Adding agents to existing clusters" : "Adding agents and expanding") + "</p></div></div>";
      html += "<div class='card management-agent leadership-agent'><span class='agent-icon' aria-hidden='true'>TA</span><div><strong>Token Assistant</strong><p>Company-wide token supply</p><p>" + fmtTokens(G.tokens) + " tokens · -" + fmtTokens(G.averageTokenBurn) + " tok/s</p><p class='text-sm token-purchase'>" + (purchase || "Monitoring tokens") + "</p></div></div></div>";
    }
    if (minimal) html += renderNeoclouds(planning);
    else {
      html += "<div class='node-grid agent-grid" + (overview ? " cluster-overview" : "") + "' style='--cluster-card-min:" + Math.max(152, 180 - density * 6) + "px;--cluster-card-padding:" + Math.max(5, 10 - density * 0.7) + "px;--cluster-card-gap:" + Math.max(3, 8 - density * 0.4) + "px;--cluster-slot-height:" + Math.max(16, 24 - density) + "px'>";
      if (planning) html += renderPlanningCard();
      if (canManuallyProvisionCluster()) html += "<button class='cluster-card provision-card' onclick='GAME.openCluster()' aria-label='Bring cluster online (" + fmtCash(provisionCost()) + ")' " + (G.cash < provisionCost() ? "disabled" : "") + "><span class='provision-icon'>+</span><strong>Bring cluster online</strong><span>" + fmtCash(provisionCost()) + "</span></button>";
      for (const cluster of G.clusters.slice().reverse()) html += renderClusterCard(cluster);
      html += "</div>";
    }
    updateHTML($("#cluster-list"), html);
  }

  function renderDevops() {
    if (G.phase >= 10) return "";
    const agent = G.agents.find((item) => item.roleId === "devops");
    if (agent) return renderAgentCard(agent);
    if (!G.purchasedUpgrades.includes("devops_unlock")) return "";
    const cost = getAgentHireCost(G.agents.length);
    return "<button class='card hire-slot devops-slot' onclick=\"GAME.hire('devops')\" " + (G.cash < cost ? "disabled" : "") + "><span class='vacancy-heading'><strong>DevOps</strong><span>" + fmtCash(cost) + "</span></span><span class='manager-purchase-detail'><span>Resolves incidents</span><span>Buy</span></span></button>";
  }

  function renderIncidentSection() {
    var section = $("#section-incidents");
    if (!G.uiRevealed.incidents && G.phase < 8) { section.style.display = "none"; return; }
    section.style.display = "";

    updateHTML($("#incident-devops"), renderDevops());
    var active = G.incidents.filter(function (i) { return !i.resolved; });
    var idleDevops = G.phase >= 10 ? managedNodeCount() : G.agents.filter(function (a) { return a.roleId === "devops" && a.status === "idle"; }).length;
    const health = $("#operations-health");
    health.hidden = G.phase < 10;
    health.textContent = active.length === 0 ? "Operations healthy · DevOps included in every cluster" : active.length + (active.length === 1 ? " incident · " : " incidents · ") + (idleDevops > 0 ? "Cluster DevOps responding" : "Waiting for an online cluster");
    health.classList.toggle("attention", active.length > 0);
    $("#incidents-header").parentElement.hidden = G.phase >= 10 && active.length === 0;

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
      $("#no-incidents").style.display = G.phase >= 10 ? "none" : "";
      return;
    }
    $("#no-incidents").style.display = "none";

	    var html = "";
	    for (var i = 0; i < active.length; i++) {
	      var inc = active[i];
	      var age = Math.floor((Date.now() - inc.createdAt) / 1000);
	      var cashPart = inc.cashCost > 0 ? "<span style='font-size:.78rem;color:var(--red)'>-" + fmtCash(inc.cashCost) + "</span>" : "";
	      html += "<div class='card incident-card" + (inc.manualRepair || idleDevops > 0 ? " repairing" : "") + "'>" +
	        "<div style='display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px'>" +
	        "<div style='font-weight:600;min-width:0'>" + inc.name + "</div>" +
	        "<div style='display:flex;align-items:center;gap:8px;white-space:nowrap'>" +
	        cashPart +
	        "<span style='font-size:.78rem;color:var(--text3)'>" + age + "s</span>" +
	        "</div>" +
	        "</div>" +
	        "<div class='text-sm text-muted mb'>" + inc.desc + "</div>" +
	        (inc.manualRepair ? "<div class='text-sm mb' style='color:var(--green)'>Fixing manually (" + inc.fixProgress.toFixed(0) + "%)</div>" : idleDevops > 0 ? "<div class='text-sm mb' style='color:var(--green)'>DevOps responding (" + (inc.fixProgress || 0).toFixed(0) + "%)" + "</div>" : "") +
	        ((inc.fixProgress || 0) > 0 || inc.manualRepair ? "<div class='task-bar mb'><div class='task-bar-fill' style='width:" + Math.min(100, inc.fixProgress).toFixed(0) + "%;background:var(--green)'></div></div>" : "") +
	        (!inc.manualRepair && availableManualSlots() === 0 ? "<div class='text-sm mb'>Manual slot busy</div>" : "") +
	        "<div style='display:flex;gap:6px'>" +
	        "<button class='btn btn-primary btn-sm'" + (inc.manualRepair || availableManualSlots() === 0 ? " disabled" : "") + " onclick=\"GAME.resolveInc('" + inc.id + "','manual')\">Fix Manually</button>" +
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
    const elapsed = endingTransitionElapsed();
    const transitioning = elapsed !== null;
    const revealAt = ENDING_FADE_OUT_MS + ENDING_BLACK_PAUSE_MS;
    const companyHidden = G.retired && (!transitioning || elapsed >= (G.agi.ended ? revealAt : ENDING_FADE_OUT_MS));
    const fade = $("#ending-transition");
    fade.hidden = !transitioning;
    if (transitioning) fade.style.opacity = elapsed < ENDING_FADE_OUT_MS ? elapsed / ENDING_FADE_OUT_MS : 1 - clamp((elapsed - revealAt) / ENDING_FADE_IN_MS, 0, 1);
    $("#ending-overlay").hidden = !G.retired || (transitioning && elapsed < revealAt);
    $("#game-container").hidden = companyHidden;
    $("#top-bar").hidden = companyHidden;
    $("#ending-title").textContent = G.retirementFinal ? "No more tasks." : "You retired early!";
    $("#ending-story").textContent = G.retirementFinal ? "You leave the laptop closed. The next model can wait. Your time belongs to you." : "A Tuesday morning on the golf course. A proper night's sleep. That health check you kept putting off. For once, your time belongs to you.";
    $("#ending-summary").textContent = "You completed " + fmt(G.totalTasksDone) + " tasks and walked away with " + fmtCash(G.retirementValue) + ".";
    $("#ending-choices").hidden = !G.retired || G.retirementFinal;
    $("#btn-ending-reset").hidden = !(G.retirementFinal || G.agi.ended);
    $("#ending-scene").textContent = G.agi.ended ? "∞" : "⛳";
    if (G.agi.ended) {
      $("#ending-title").textContent = "There is always one more task.";
      $("#ending-story").textContent = "The AGI created its own customers, its own tasks and " + fmtTokens(G.agi.replicas) + " copies of itself. The company outgrew the screen. It no longer needs you.";
      $("#ending-summary").textContent = fmt(G.totalTasksDone) + " tasks completed. No one left to invoice.";
      $("#ending-choices").hidden = true;
      $("#btn-ending-reset").hidden = false;
    }
    if (G.retired) syncMusicPlayback();
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
    var cpVisible = (G.gameStarted && G.uiRevealed.taskQueue) || G.uiRevealed.upgrades || G.uiRevealed.agents || G.uiRevealed.clusters ||
      G.uiRevealed.incidents || G.uiRevealed.dashboard || G.uiRevealed.prestige ||
      G.uiRevealed.log;

    container.classList.toggle("cp-visible", cpVisible);

    // Late game: control panel dominates
    var lateGame = G.phase >= 6 || G.agents.length > 0;
    container.classList.toggle("cp-late", cpVisible && lateGame);
  }

  let activeDialog = null;
  let previousFocus = null;

  function syncDialogFocus() {
    const dialog = document.querySelector("#ending-overlay:not([hidden])") || document.querySelector(".popup-overlay.show");
    $("#game-container").inert = !!dialog || G.retired;
    $("#top-bar").inert = !!dialog || G.retired;
    if (dialog !== activeDialog) {
      if (dialog) {
        if (!activeDialog) previousFocus = document.activeElement;
        const target = dialog.id === "ending-overlay" ? $(G.retirementFinal || G.agi.ended ? "#btn-ending-reset" : "#btn-ending-restart") : dialog.querySelector("button");
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
      return;
    }
    if (event.key === "Escape") {
      if (activeDialog.id === "agi-warning") cancelKeepScaling();
      else if (activeDialog.id === "agi-buyout-warning") cancelBuyout();
      return;
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
    if (G.retired) {
      document.body.classList.remove("agi-driving");
      if (!G.agi.ended || $("#game-container").hidden) {
        document.body.classList.remove("agi-runaway");
        $("#agi-cursors").hidden = true;
      }
      syncDialogFocus();
      return;
    }
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
    renderAgi();
    if (focusedAction) {
      const replacement = [...document.querySelectorAll("button[onclick]")].find((button) => button.getAttribute("onclick") === focusedAction && !button.disabled);
      if (replacement) replacement.focus({ preventScroll: true });
    }
    syncDialogFocus();
  }

  // ---------- CLICK REWARD ANIMATION ----------
  function renderIntro() {
    $("#intro-overlay").classList.toggle("hidden", G.gameStarted);
    $("#intro-story").textContent = G.prestigeCount > 0 ? "Retirement was nice. Now you are bored. One more task?" : "You are broke. Living out of your car. Your phone buzzes -- another gig app notification.";
    $("#intro-hint").textContent = G.prestigeCount > 0 ? "Start again. Build smarter." : "You dream of early retirement. Maybe organising your life and smarter systems could set you free...";
  }

  function startGame() {
    G.gameStarted = true;
    G.lastTick = Date.now();
    G.startTime = Date.now();
    prepareOpeningTask();
    renderIntro();
    syncDialogFocus();
    log(G.prestigeCount > 0 ? "Back for one more task." : "You start your freelance grind from the backseat of your car.", "info");
    log("Click 'Do Task' to find gigs and earn cash.", "info");
    // No tasks spawned on start -- player creates them via Do Task button
    // Inbox setup now introduces the first gigs.
    renderAll();
    save();
  }

  // ---------- INIT ----------
  function init() {
    initLayoutSwitcher();
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
    $("#btn-agi-buyout-cancel").addEventListener("click", cancelBuyout);
    $("#btn-agi-buyout-confirm").addEventListener("click", positionForBuyout);
    $("#btn-agi-control").addEventListener("click", function () {
      if (G.agi.paused) resumeAgi();
      else takeAgiControl();
    });
    $("#btn-agi-cancel").addEventListener("click", cancelKeepScaling);
    $("#btn-agi-confirm").addEventListener("click", confirmKeepScaling);
    var loaded = load();
    setupMusic();

    // Popup dismiss
    $("#btn-dismiss-popup").addEventListener("click", function () { dismissPopup(); });

    // Offline popup dismiss
    // Offline earnings are credited and recorded in the event log.

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
    $("#prelude-card").addEventListener("click", handleWorkClick);
    $("#task-list").addEventListener("click", handleTaskClick);

    // Intro
    $("#intro-overlay").addEventListener("click", startGame);
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
    if (G.phase < 5) return;
    if (G.phase < 10) {
      while (sharedAgentCount() < getHireAgentCapacity() || (G.phase >= 8 && !G.agents.some((agent) => agent.roleId === "devops"))) {
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
    tickConstruction(Math.max(0, ...G.clusters.map((cluster) => cluster.buildRemaining)));
    for (const cluster of G.clusters) {
      if (G.phase < 13) {
        while (cluster.workerAgentIds.length < cluster.workerSlotsMax) buyNextClusterWorker(cluster.id);
      } else if (!cluster.managerAssigned || cluster.workforce < cluster.workerSlotsMax) {
        G.lastCeoAction = 0;
        tickAiCeo();
      }
    }
    tickConstruction(Math.max(0, ...G.agents.map((agent) => agent.provisionRemaining)));
  }

  function loadCheatStage(stage) {
    const early = { "0_1": 0, "0_2": 7, "0_": 35, "0_4": 100, "1": 50 };
    const startPhase9 = stage === "start9";
    const agiChoice = stage === "16_choice";
    const number = startPhase9 ? 9 : Number(stage);
    const agiStart = number === 16;
    const target = stage === "retire" ? UPGRADES.find((upgrade) => upgrade.id === "fusion") : UPGRADES.find((upgrade) => upgrade.unlockPhase === (agiChoice ? 17 : number));
    if (!Object.hasOwn(early, stage) && !target) return;
    clearTaskCompletions();
    saveBlocked = false;
    storageMessage("");
    const phase = target ? target.phase : 1;
    const checkpoint = { "4": { tasks: 870, cash: 14000 }, "9": { tasks: 390000, cash: 800000 }, "10": { tasks: 1000000, cash: 1200000 }, "11": { tasks: 4600000, cash: 30000000, clusters: 3 }, "12": { tasks: 27000000, cash: 180000000, clusters: 5 }, "13": { tasks: 63000000, cash: 600000000, clusters: 21 } }[stage];
    const musicMode = G.musicMode;
    G = defaultState();
    G.musicMode = musicMode;
    G.gameStarted = true;
    G.totalTasksDone = target ? 100000000 : early[stage];
    G.totalIncidents = 3;
    G.incidentsExplained = true;
    G.cash = 1e15;
    const preceding = UPGRADES.filter((upgrade) => (!agiStart || UPGRADES.indexOf(upgrade) < UPGRADES.indexOf(target)) && upgrade !== target && upgrade.oneTime && (!Object.hasOwn(early, stage) || (upgrade.reqTasks < early[stage] || (upgrade.introductory && upgrade.reqTasks === early[stage]))) && upgrade.phase <= phase && (!upgrade.unlockPhase || upgrade.unlockPhase <= phase));
    const requiredClusters = Math.max(checkpoint?.clusters || 0, phase >= 11 ? 5 : 3, ...preceding.map((upgrade) => upgrade.reqNodes || 0));
    let changed = true;
    while (changed) {
      const before = G.purchasedUpgrades.length + G.agents.length + G.clusters.length;
      fillCheatCompany(requiredClusters);
      for (const upgrade of preceding) {
        if (upgrade.id === "agi_authority") G.agi.checks = AGI_CHECKS.length;
        if (upgrade.id === "agi_independence") { G.agi.baselineNodes = Math.max(0, completedClusterCount() - 500); G.agi.baselineTasks = 0; G.agi.healthySeconds = 30; }
        if (upgrade.id === "retire_unlock") G.agi.route = "buyout";
        purchaseUpgrade(upgrade.id);
        if (G.agi.projectId) tickAgi(G.agi.remaining);
        if (G.salePreparation.upgradeId) tickSalePreparation(G.salePreparation.remaining);
      }
      changed = before !== G.purchasedUpgrades.length + G.agents.length + G.clusters.length;
    }
    if (number === 1) purchaseUpgrade("focus_timer");
    fillCheatCompany(requiredClusters);
    tickConstruction(12.1);
    if (target && target.reqNodes) fillCheatCompany(Math.max(3, target.reqNodes - (stage === "retire" ? 0 : 1)));
    if (!agiStart && G.purchasedUpgrades.includes("agi_independence")) G.agi.route = agiChoice ? "" : "buyout";
    G.totalTasksDone = checkpoint ? checkpoint.tasks : stage === "retire" ? 1000000000 : target ? (phase >= 13 ? (phase === 13 ? 3000000 : phase === 14 ? 8000000 : 20000000) : target.reqTasks - 3) : early[stage];
    G.totalClicks = G.totalTasksDone * 8;
    G.cash = checkpoint ? checkpoint.cash : target ? Math.ceil(getUpgradeCost(target) * 1.25) + (number === 7 ? 25000 : 1000) : number === 1 ? 90 : G.totalTasksDone * 4;
    if (target && target.reqNodes) G.cash = Math.max(G.cash, provisionCost() * 2 + getUpgradeCost(target));
    if (agiStart) G.cash = 8000000000;
    if (number === 3) G.cash = 1900;
    if (number === 5) G.cash = 1300;
    G.tokens = phase >= 10 ? Math.max(100000, G.clusters.length * 12000) : phase >= 7 ? 50000 : phase >= 3 ? 10000 : 0;
    G.aiWorkerTokenTank = phase >= 2 && !G.aiWorkerShutdown ? workerTokenCapacity() : 0;
    G.managerTokenTank = phase >= 7 && phase < 10 ? MANAGER_TOKEN_TANK_MAX : 0;
    G.aiRunSeconds = 0;
    G.totalIncidents = phase >= 3 ? 3 : 0;
    G.incidentsExplained = phase >= 3;
    G.incidents = [];
    G.tasks = [];
    G.assistant.taskIds = [];
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
    G.uiRevealed.taskQueue = G.totalTasksDone > 0;
    checkMilestones();
    G.lastTick = Date.now();
    G.lastTaskSpawn = Date.now();
    G.lastCeoAction = Date.now();
    if (startPhase9) {
      G.totalTasksDone = target.reqTasks;
      purchaseUpgrade(target.id);
    }
    popupQueue = [];
    dismissPopup();
    $("#agi-warning").classList.remove("show");
    $("#agi-buyout-warning").classList.remove("show");
    $("#intro-overlay").classList.add("hidden");
    log("Debug checkpoint: Phase " + G.phase + (startPhase9 ? ", at phase entry" : target ? ", before " + target.name : "") + ".", "info");
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
  // -> Multi-Bot License / phase 5
  // Phase 6 entry: web/code upgrades available
  // Phase 7 entry: manager works before playbooks
  // Phase 8 entry: Token budget console
  // Phase 8 entry: Token budget console
  // Phase 10 entry: single cluster Alpha
  // Phase 10: second cluster upgrade available soon
  // Phase 10: second cluster can be purchased
  // Purchase all available upgrades (loop until stable for phase unlocks)
  // Fill all currently available hire slots
  // Clean up side effects from purchases

  // ---------- PUBLIC API (for onclick handlers) ----------
  window.GAME = {
    doWork: doWork,
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
    resumeAgi: resumeAgi,
    requestBuyout: requestBuyout,
    positionForBuyout: positionForBuyout,
    requestKeepScaling: requestKeepScaling,
    cancelKeepScaling: cancelKeepScaling,
    confirmKeepScaling: confirmKeepScaling,
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
  window.chPh0 = function () { GAME.resetSave(); };
  var cheatShortcuts = [
    "0_", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17
  ];
  window.chStart9 = function () { GAME.cheat("start9"); };
  window.chPh16Choice = function () { GAME.cheat("16_choice"); };
  window.chRetire = function () { GAME.cheat("retire"); };
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
