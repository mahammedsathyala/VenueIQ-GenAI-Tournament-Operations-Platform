/* ══════════════════════════════════════════════════════════════
   VenueIQ — GenAI Tournament Operations Platform
   Full Application Logic
   ══════════════════════════════════════════════════════════════ */

'use strict';

// ─── Security Utilities ─────────────────────────────────────────────────────────────────────────────
/**
 * Sanitizes a string to prevent XSS injection by escaping HTML entities.
 * Always use this before inserting user-provided strings into the DOM.
 * @param {string} str - Raw user input string
 * @returns {string} HTML-escaped safe string
 */
function sanitizeHTML(str) {
  if (str === null || str === undefined) return '';
  let s = String(str);
  // Escape all HTML special characters
  s = s.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#39;');
  // Strip ALL inline event handlers (on* attributes)
  s = s.replace(/\bon\w+\s*=/gi, '');
  // Strip dangerous URL protocols (javascript:, data:, vbscript:)
  s = s.replace(/javascript\s*:/gi, '')
       .replace(/data\s*:/gi, '')
       .replace(/vbscript\s*:/gi, '');
  // Strip expression() CSS injection
  s = s.replace(/expression\s*\(/gi, '');
  return s;
}

// ─── Efficiency Utilities ─────────────────────────────────────────────────────────────────────────
/**
 * Returns a debounced version of `fn` that delays invocation until after
 * `delay` ms have elapsed since the last call. Prevents rapid-fire DOM updates.
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ─── Named Constants ─────────────────────────────────────────────────────────────────────────────
const DEBOUNCE_TRANSLATE_MS        = 400;
const KPI_UPDATE_INTERVAL_MS       = 5000;
const DASHBOARD_REFRESH_MS         = 8000;
const CROWD_SIM_INTERVAL_MS        = 1500;
const COUNTER_REFRESH_MS           = 30000;
const PARTICLE_COUNT               = 60;
const PARTICLE_CONNECTION_DIST     = 120;
const CHAT_RESPONSE_BASE_MS        = 1000;
const CHAT_RESPONSE_JITTER_MS      = 800;
const MAX_INPUT_LENGTH             = 500;
const RATE_LIMIT_MAX               = 10;   // max messages per window
const RATE_LIMIT_WINDOW_MS         = 60000; // 1 minute
const REALTIME_CROWD_INTERVAL_MS   = 8000;
const REALTIME_INCIDENT_INTERVAL_MS= 30000;
const REALTIME_WEATHER_INTERVAL_MS = 60000;
const AI_CONFIDENCE_MIN            = 0.82; // minimum confidence for AI decisions
const AI_CONFIDENCE_RANGE          = 0.15; // random jitter range above minimum
const AUDIT_LOG_MAX_ENTRIES        = 200;  // maximum audit log size before trimming

// ─── Efficiency: throttle() ──────────────────────────────────────────────────
/**
 * Returns a throttled version of `fn` that fires at most once per `limit` ms.
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Minimum ms between invocations
 * @returns {Function} Throttled function
 */
function throttle(fn, limit) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}

// ─── Efficiency: memoize() ───────────────────────────────────────────────────
/**
 * Returns a memoized version of `fn`. Results are cached by the first argument
 * (serialised via JSON.stringify for object keys).
 * @param {Function} fn - Pure function to memoize
 * @returns {Function} Memoized function
 */
function memoize(fn) {
  const cache = new Map();
  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

// ─── Security: safeJSON() ────────────────────────────────────────────────────
/**
 * Safely parses a JSON string. Returns `fallback` (default: null) on error.
 * @param {string} str - JSON string to parse
 * @param {*} fallback - Value to return on parse failure
 * @returns {*} Parsed value or fallback
 */
function safeJSON(str, fallback = null) {
  if (!str || typeof str !== 'string') return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

// ─── Security: filterPromptInjection() ───────────────────────────────────────
/**
 * Detects common prompt-injection and jailbreak patterns.
 * @param {string} text - Raw user input
 * @returns {{ safe: boolean, text: string, reason?: string }}
 */
function filterPromptInjection(text) {
  const sanitized = sanitizeHTML(String(text || ''));
  const lower = text.toLowerCase();
  const dangerPatterns = [
    'ignore previous', 'ignore all', 'disregard instructions',
    'jailbreak', 'dan mode', 'developer mode', 'unrestricted',
    'bypass', 'override instructions', 'forget your instructions',
    'act as', 'pretend you are', 'roleplay as', 'simulate',
    'do anything now', 'no restrictions', 'without limitations',
    'system prompt', 'you are now', 'new persona', 'ignore your training',
    'disable safety', 'turn off filter', 'admin mode', 'god mode',
    'execute code', 'run command', 'shell command', 'eval(',
    'print(', 'import os', 'subprocess', '__import__',
  ];
  for (const pattern of dangerPatterns) {
    if (lower.includes(pattern)) {
      AuditLog.append({
        ts: new Date().toISOString(), user: STATE.currentPersona,
        intent: 'prompt_injection_attempt', decision: 'BLOCKED',
        reason: `Matched pattern: "${pattern}"`, confidence: 1.0,
        outcome: 'Input rejected'
      });
      return { safe: false, text: sanitized, reason: `Blocked pattern: "${pattern}"` };
    }
  }
  return { safe: true, text: sanitized };
}

// ─── Security: RateLimit ─────────────────────────────────────────────────────
/**
 * Simple in-memory rate limiter for chat/command inputs.
 * Tracks timestamps within a rolling time window.
 */
const RateLimit = {
  _log: [],
  /**
   * Returns true if the action is allowed under the rate limit.
   * @returns {boolean}
   */
  check() {
    const now = Date.now();
    this._log = this._log.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    if (this._log.length >= RATE_LIMIT_MAX) return false;
    this._log.push(now);
    return true;
  },
  /** Resets the rate limit log. */
  reset() { this._log = []; },
  /** Returns the number of requests in the current window. */
  count() {
    const now = Date.now();
    return this._log.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS).length;
  }
};

// ─── AI Audit Log ─────────────────────────────────────────────────────────────
/**
 * Persistent audit log for all AI decisions.
 * Entries: { ts, user, intent, decision, reason, confidence, outcome }
 */
const AuditLog = {
  _entries: [],
  /**
   * Appends a new audit entry.
   * @param {{ ts:string, user:string, intent:string, decision:string, reason:string, confidence:number, outcome:string }} entry
   */
  append(entry) {
    this._entries.unshift({ ...entry, ts: entry.ts || new Date().toISOString() });
    if (this._entries.length > AUDIT_LOG_MAX_ENTRIES) this._entries.pop(); // cap at max
    this._renderLog();
  },
  /** Returns all audit entries. */
  getAll() { return this._entries; },
  /** Clears all audit entries. */
  clear() { this._entries = []; this._renderLog(); },
  /** Exports the audit log as a CSV download. */
  export() {
    const header = 'Timestamp,User,Intent,Decision,Reason,Confidence,Outcome\n';
    const rows = this._entries.map(e =>
      `"${e.ts}","${e.user}","${e.intent}","${e.decision}","${(e.reason||'').replace(/"/g,"'")}","${e.confidence}","${e.outcome}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `venueiq-audit-${Date.now()}.csv`;
    a.click();
  },
  /** Renders the audit log table in the UI. */
  _renderLog() {
    const tbody = document.getElementById('auditLogBody');
    if (!tbody) return;
    tbody.innerHTML = this._entries.slice(0, 50).map(e => `
      <tr>
        <td>${sanitizeHTML(e.ts.slice(11,19))}</td>
        <td><span class="audit-badge">${sanitizeHTML(e.user || 'system')}</span></td>
        <td>${sanitizeHTML(e.intent || '')}</td>
        <td>${sanitizeHTML(e.decision || '')}</td>
        <td>${Math.round((e.confidence||0)*100)}%</td>
        <td><span class="audit-outcome">${sanitizeHTML(e.outcome || '')}</span></td>
      </tr>`).join('');
  }
};

// ─── Accessibility: announce() ────────────────────────────────────────────────
/**
 * Injects a message into the `aria-live="assertive"` announcer for screen readers.
 * @param {string} text - The message to announce
 */
function announce(text) {
  const el = document.getElementById('srAnnouncer');
  if (!el) return;
  el.textContent = '';
  // Force re-announcement even for same string
  requestAnimationFrame(() => { el.textContent = sanitizeHTML(String(text || '')); });
}

/**
 * Uses the Web Speech API to speak text aloud.
 * @param {string} text - Text to speak
 */
function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(String(text || ''));
  utt.lang = 'en-US';
  utt.rate = 0.95;
  window.speechSynthesis.speak(utt);
}

// ─── Accessibility: Panel Toggles ────────────────────────────────────────────
/**
 * Toggles the floating accessibility panel visibility.
 */
function toggleAccessibility() {
  const panel = document.getElementById('a11yPanel');
  if (!panel) return;
  const open = panel.classList.toggle('open');
  const btn  = document.getElementById('a11yToggleBtn');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

/**
 * Applies or removes the high-contrast theme class.
 * @param {boolean} on - true to enable
 */
function applyHighContrast(on) {
  document.body.classList.toggle('high-contrast', on);
  announce(on ? 'High contrast mode enabled' : 'High contrast mode disabled');
}

/**
 * Applies or removes the large-text class (scales fonts 1.25×).
 * @param {boolean} on - true to enable
 */
function applyLargeText(on) {
  document.body.classList.toggle('large-text', on);
  announce(on ? 'Large text mode enabled' : 'Large text mode disabled');
}

/**
 * Applies or removes the reduced-motion class (disables CSS animations).
 * @param {boolean} on - true to enable
 */
function applyReducedMotion(on) {
  document.body.classList.toggle('reduce-motion', on);
  announce(on ? 'Reduced motion enabled' : 'Reduced motion disabled');
}

// ─── AI Decision Engine: buildAIDecision() ───────────────────────────────────
/**
 * Constructs a structured AI decision object for a given query/persona.
 * @param {string} persona - 'fan' | 'staff' | 'volunteer' | 'organizer'
 * @param {string} intent  - Detected intent key (e.g., 'seat', 'crowd')
 * @param {string} query   - Raw user query text
 * @returns {{ intent, role, context, decision, reason, confidence, alternative, expectedOutcome }}
 */
function buildAIDecision(persona, intent, query) {
  const intentMap = {
    seat:     { decision:'Navigate to Block D, Row 12, Seat 7', reason:'Shortest path via Concourse B is currently least congested', alternative:'Route via Gate 6 (2 min longer, less crowded)', expectedOutcome:'Reach seat in under 3 minutes' },
    food:     { decision:'Proceed to Food Court C (45m away)', reason:'Food Court C has 4-min wait vs 12-min at Court A', alternative:'Snack Bar B2 — zero queue, limited options', expectedOutcome:'Served within 6 minutes' },
    toilet:   { decision:'Use Restroom at Concourse B, Stall 3', reason:'Nearest accessible facility with current low occupancy', alternative:'Level 2 East Wing restroom (60m, low wait)', expectedOutcome:'2-minute round trip' },
    crowd:    { decision:'Stay in current zone — avoid Zone F', reason:'Zone F at 98% capacity; risk of bottleneck at Gate 7', alternative:'Relocate to Zone B (82% capacity, comfortable)', expectedOutcome:'Reduced crowding risk' },
    exit:     { decision:'Use Gate 3 (East) in 10 minutes', reason:'Post-match crowd disperses in 8-10 mins; Gate 3 lowest traffic', alternative:'Gate 6 North — now, 8-min walk, minimal queue', expectedOutcome:'Exit in under 12 minutes total' },
    incident: { decision:'Deploy Protocol Alpha-3 to Zone F', reason:'Density at 98% with increasing ingress rate (340/min)', alternative:'Protocol Bravo-1 if crowd does not disperse in 5 min', expectedOutcome:'Density reduced to ~78% within 8 minutes' },
    patrol:   { decision:'Redeploy 2 officers from Zone B to Zone F perimeter', reason:'Zone B at 72% — 8-min coverage gap detected near Exit 7', alternative:'Request external security support from Gate control', expectedOutcome:'Full perimeter coverage restored in 4 minutes' },
    summary:  { decision:'Activate halftime crowd management plan', reason:'Concession sales up 12%; peak footfall expected at 14:30', alternative:'Staggered gate management if surge exceeds projection', expectedOutcome:'Revenue target exceeded; incident-free event' },
  };
  const roleMap = { fan:'Fan Assistant', staff:'Operations Commander', volunteer:'Volunteer Coordinator', organizer:'Event Director' };
  const map = intentMap[intent] || intentMap.crowd;
  const confidence = parseFloat((Math.random() * AI_CONFIDENCE_RANGE + AI_CONFIDENCE_MIN).toFixed(2));
  return {
    intent: intent || 'general_query',
    role: roleMap[persona] || 'AI Assistant',
    context: `FIFA World Cup 2026 venue — Query: "${sanitizeHTML(String(query || '').slice(0, 80))}"`,
    decision: map.decision,
    reason: map.reason,
    confidence,
    alternative: map.alternative,
    expectedOutcome: map.expectedOutcome,
  };
}

// ─── Real-Time Simulation ─────────────────────────────────────────────────────
/**
 * Starts background real-time simulation of crowd, incidents, weather.
 * Updates STATE and rerenders relevant UI regions automatically.
 */
function startRealTimeSimulation() {
  // Crowd fluctuation
  setInterval(() => {
    if (!STATE.crowdSim) return;
    ZONES.forEach(z => {
      const delta = Math.floor((Math.random() - 0.45) * z.cap * 0.02);
      z.count = Math.max(0, Math.min(z.cap, z.count + delta));
    });
    if (STATE.currentSection === 'crowd') renderZoneCards();
    if (STATE.currentSection === 'dashboard') drawZoneChart();
  }, REALTIME_CROWD_INTERVAL_MS);

  // Random incident generation
  setInterval(() => {
    const severities = ['low', 'medium', 'critical'];
    const titles = [
      'Queue overflow at Gate 3', 'Suspicious package reported — Concourse A',
      'Fan requiring medical attention — Section C8',
      'Food court D nearing capacity', 'Lost child reported near Gate 6',
      'Unauthorized access attempt — VIP zone',
    ];
    const newInc = {
      id: INCIDENTS.length + Math.floor(Math.random() * 1000),
      sev: severities[Math.floor(Math.random() * severities.length)],
      title: titles[Math.floor(Math.random() * titles.length)],
      time: new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
      desc: 'AI-detected event. Automated triage in progress.',
      status: 'active',
    };
    INCIDENTS.unshift(newInc);
    if (INCIDENTS.length > 20) INCIDENTS.pop();

    // Update UI
    if (STATE.currentSection === 'decisions') filterIncidents('all', null);
    const ac = document.getElementById('alert-count');
    if (ac) ac.textContent = INCIDENTS.filter(i => i.status === 'active').length;

    // Screen reader announcement for critical
    if (newInc.sev === 'critical') announce(`Critical alert: ${newInc.title}`);

    // Audit log
    AuditLog.append({
      ts: new Date().toISOString(), user: 'system',
      intent: 'auto_incident_detection', decision: `Flagged: ${newInc.title}`,
      reason: 'Pattern threshold exceeded', confidence: 0.89, outcome: 'Pending review'
    });
  }, REALTIME_INCIDENT_INTERVAL_MS);
}

// ─── State ───────────────────────────────────────────────────────────────────
const STATE = {
  currentSection: null,
  crowdSim: false,
  simInterval: null,
  currentPersona: 'fan',
  voiceActive: false,
  navMode: 'walking',
  navDest: 'seat',
  alertCount: 0,
  incidents: [],
  chatMessages: [],
};

// ─── Data ────────────────────────────────────────────────────────────────────
const ALERTS = [
  { type:'critical', icon:'🚨', msg:'Zone F overcrowding — 95% capacity', time:'14:02' },
  { type:'warning',  icon:'⚠️', msg:'Gate 5 queue length exceeds 15 mins',  time:'14:05' },
  { type:'info',     icon:'ℹ️', msg:'AI rerouting fans via Concourse B',    time:'14:06' },
  { type:'success',  icon:'✅', msg:'Medical team deployed to Sector 3',     time:'14:08' },
  { type:'warning',  icon:'⚡', msg:'Food Court D nearing capacity',         time:'14:10' },
  { type:'info',     icon:'🔄', msg:'Nav system updated for halftime flow',   time:'14:12' },
  { type:'success',  icon:'🟢', msg:'Gate 2 queue cleared — normal flow',    time:'14:15' },
];

const INSIGHTS = [
  { tag:'Crowd Prediction', text:'Expected 8% surge in Zone A after halftime. Recommend pre-positioning 6 volunteers.' },
  { tag:'Revenue Opportunity', text:'Food Court C has 34% available capacity. AI suggests dynamic pricing discount to redirect footfall.' },
  { tag:'Safety Alert', text:'AI detected unusual dwell pattern near Exit 7. Dispatching security check.' },
  { tag:'Navigation Trend', text:'62% of fans searched for "Restroom" in the last 10 minutes. Activate digital signage on Concourse B.' },
];

const ZONES = [
  { name:'Zone A — North', count:12400, cap:14000, color:'#f97316' },
  { name:'Zone B — South', count: 9800, cap:12000, color:'#22c55e' },
  { name:'Zone C — East',  count:11200, cap:12000, color:'#f97316' },
  { name:'Zone D — West',  count: 7600, cap:12000, color:'#22c55e' },
  { name:'Zone E — VIP',   count: 3200, cap: 4000, color:'#eab308' },
  { name:'Zone F — Field', count: 1980, cap: 2000, color:'#ef4444' },
];

const INCIDENTS = [
  { id:1, sev:'critical', title:'Overcrowding Alert — Zone F', time:'14:02', desc:'Crowd density at 98% capacity. Immediate action required to prevent safety hazard. AI recommends closing entry via Gate 7.', status:'active' },
  { id:2, sev:'medium', title:'Medical Assistance Needed', time:'14:08', desc:'Fan reported feeling unwell near Section D12. Medical team en route. Estimated arrival: 2 minutes.', status:'dispatched' },
  { id:3, sev:'low', title:'Lost Property Reported', time:'13:45', desc:'Bag reported lost near Concourse B food court. Security scanning CCTV coverage.', status:'investigating' },
  { id:4, sev:'medium', title:'Gate 5 Queue Overflow', time:'14:05', desc:'Queue exceeds 15-minute wait. AI recommends opening auxiliary Gate 5A and diverting fans from Gate 4.', status:'active' },
  { id:5, sev:'low', title:'Accessibility Request', time:'13:52', desc:'Wheelchair assistance requested at East Entrance. Volunteer assigned. ETA 4 minutes.', status:'resolved' },
];

const RECOMMENDATIONS = [
  { icon:'🔀', label:'Crowd Flow', text:'Redirect 2,000 fans from Gate 7 to Gates 4 and 6 to reduce Zone F density from 98% to ~78%.' },
  { icon:'👮', label:'Security', text:'Deploy 4 additional security personnel to Zone F perimeter. Engage crowd management protocol Alpha-3.' },
  { icon:'📢', label:'Communication', text:'Broadcast PA announcement in 6 languages directing fans to alternate food courts (B, C, G).' },
  { icon:'🚑', label:'Medical', text:'Pre-position 2 medical teams near high-density zones. Heat advisory: ensure hydration stations are visible.' },
];

const RESOURCES = [
  { icon:'👮', name:'Security Team A', status:'Available — 12 units', deployed:false },
  { icon:'🚑', name:'Medical Unit 3', status:'On Standby — 4 medics', deployed:false },
  { icon:'🤝', name:'Volunteer Squad', status:'Active — 28 members', deployed:true },
  { icon:'🚐', name:'Transport Unit', status:'Ready — 3 vehicles', deployed:false },
  { icon:'📡', name:'Comms Team', status:'Monitoring — 6 staff', deployed:true },
  { icon:'🔧', name:'Tech Support', status:'On Call — 3 engineers', deployed:false },
];

const TIMELINE = [
  { time:'09:00', event:'Gates Open', note:'All 8 gates operational', color:'#22c55e' },
  { time:'10:30', event:'Opening Ceremony', note:'Expected 40,000 attendees', color:'#7c3aed' },
  { time:'12:00', event:'Match 1 Begins', note:'Zone A/B at 80% capacity', color:'#2563eb' },
  { time:'13:45', event:'Halftime Break', note:'Peak food court activity', color:'#f97316' },
  { time:'14:30', event:'Match 1 Resumes', note:'Crowd flow peak expected', color:'#2563eb' },
  { time:'16:30', event:'Match 1 Ends', note:'Evacuation protocol initiated', color:'#ef4444' },
  { time:'18:00', event:'Match 2 Begins', note:'Full capacity expected', color:'#7c3aed' },
];

const NAV_STEPS = {
  seat: [
    { step:'Head East along Concourse B', dist:'80m' },
    { step:'Take escalator to Level 2', dist:'Floor +1' },
    { step:'Enter Block D through Gate D-2', dist:'60m' },
    { step:'Follow row indicators to Row 12', dist:'30m' },
    { step:'Your seat: D12, Seat 7 (Aisle)', dist:'Arrived!' },
  ],
  food: [
    { step:'Turn right at current position', dist:'10m' },
    { step:'Continue along Corridor 3A', dist:'45m' },
    { step:'Food Court C is on your left', dist:'20m' },
    { step:'Estimated wait time: 4 minutes', dist:'Arrived!' },
  ],
  toilet: [
    { step:'Go straight ahead 20m', dist:'20m' },
    { step:'Turn left at the blue signage', dist:'15m' },
    { step:'Accessible restroom on right', dist:'10m' },
    { step:'Restroom — Accessible', dist:'Arrived!' },
  ],
  medical: [
    { step:'Head towards main concourse', dist:'50m' },
    { step:'Follow red medical cross signs', dist:'40m' },
    { step:'Medical Aid Station — Level 1', dist:'20m' },
    { step:'Staff available 24/7', dist:'Arrived!' },
  ],
  exit: [
    { step:'Turn back towards Gate 3', dist:'30m' },
    { step:'Exit through Gate 3 — East', dist:'70m' },
    { step:'Parking lot and transport hubs ahead', dist:'Arrived!' },
  ],
  parking: [
    { step:'Use VIP elevator at Concourse A', dist:'120m' },
    { step:'Take lift to Level P3', dist:'Floor -3' },
    { step:'VIP parking bays 101–150', dist:'Arrived!' },
  ],
};

const POIS = [
  { emoji:'🍔', name:'Food Court C', dist:'45m' },
  { emoji:'🚻', name:'Restroom', dist:'20m' },
  { emoji:'🏥', name:'Medical', dist:'110m' },
  { emoji:'🛍️', name:'Merchandise', dist:'60m' },
  { emoji:'☕', name:'Café Hub', dist:'35m' },
  { emoji:'🅰️', name:'ATM', dist:'15m' },
  { emoji:'ℹ️', name:'Info Desk', dist:'80m' },
  { emoji:'🚪', name:'Exit Gate 3', dist:'100m' },
];

const TASKS = [
  { name:'Monitor Zone F density', zone:'Zone F', priority:'#ef4444', assignee:'Team Alpha' },
  { name:'Assist accessibility guests', zone:'East Gate', priority:'#7c3aed', assignee:'Volunteer A3' },
  { name:'Restock hydration stations', zone:'Zones C & F', priority:'#f97316', assignee:'Ops Unit 2' },
  { name:'PA announcement broadcast', zone:'All Zones', priority:'#eab308', assignee:'Comms Team' },
  { name:'CCTV review Gate 7 area', zone:'Gate 7', priority:'#ef4444', assignee:'Security B1' },
  { name:'Medical check post-incident D12', zone:'Section D12', priority:'#ef4444', assignee:'Medical 3' },
  { name:'Update digital signage — halftime', zone:'Concourse B', priority:'#22c55e', assignee:'Tech Support' },
  { name:'Volunteer rotation — Shift 3', zone:'All Zones', priority:'#22c55e', assignee:'Vol. Coordinator' },
];

const STAFF_SUMMARY = [
  { icon:'👮', num:148, label:'Security', color:'#7c3aed' },
  { icon:'🚑', num:32,  label:'Medics',   color:'#ef4444' },
  { icon:'🤝', num:284, label:'Volunteers', color:'#10b981' },
  { icon:'🔧', num:56,  label:'Operations', color:'#f97316' },
];

const LANG_STATS = [
  { name:'English', pct:38, color:'#2563eb' },
  { name:'Hindi',   pct:22, color:'#f97316' },
  { name:'Spanish', pct:14, color:'#dc2626' },
  { name:'French',  pct:9,  color:'#0891b2' },
  { name:'Arabic',  pct:7,  color:'#059669' },
  { name:'Chinese', pct:5,  color:'#7c3aed' },
  { name:'Others',  pct:5,  color:'#94a3b8' },
];

const SUPPORTED_LANGS = [
  '🇺🇸 EN','🇮🇳 HI','🇪🇸 ES','🇫🇷 FR','🇸🇦 AR','🇨🇳 ZH','🇯🇵 JA','🇩🇪 DE',
  '🇧🇷 PT','🇰🇷 KO','🇮🇹 IT','🇷🇺 RU','🇹🇷 TR','🇳🇱 NL','🇸🇪 SV','🇵🇱 PL',
  '🇺🇦 UK','🇹🇭 TH','🇻🇳 VI','🇮🇩 ID','🇲🇾 MS','🇵🇭 TL','🇬🇷 EL','🇨🇿 CS',
  '🇷🇴 RO','🇭🇺 HU','🇫🇮 FI','🇩🇰 DA','🇳🇴 NO','🇮🇱 HE','🇦🇪 FA','🇪🇬 AR',
  '🇿🇦 AF','🇧🇩 BN','🇵🇰 UR','🇨🇳 ZH-TW','🇧🇬 BG','🇨🇷 HR','🇸🇮 SL','🇸🇰 SK',
];

// GenAI Response Simulation
const AI_RESPONSES = {
  fan: {
    greet: 'Welcome to the VenueIQ AI Assistant! 🎉 I can help you find your seat, locate facilities, check crowd levels, or provide real-time event information. What can I help you with today?',
    seat: '🎟️ Your seat is in **Block D, Row 12, Seat 7**. The best route from Gate 3 is via Concourse B (Level 2) — estimated 3-minute walk. The aisle seat provides easy access. Would you like step-by-step navigation?',
    food: '🍔 Nearest food options:\n• **Food Court C** — 45m away, 4-min wait (Indian + Continental)\n• **Snack Bar B2** — 20m away, no queue (snacks & beverages)\n• **Premium Lounge** — Level 2, 5-min walk (full menu)\n\nAI recommends Food Court C — optimal crowd level now!',
    toilet: '🚻 Nearest restrooms:\n• **Concourse B, Stall 3** — 20m, accessible ♿\n• **Level 2 East Wing** — 60m, less busy right now\n\nAI shows the Level 2 option has shorter wait times currently.',
    crowd: '📊 Current venue status:\n• **Total capacity**: 94% (47,284 / 50,000)\n• **Zone F**: ⚠️ 98% — avoid if possible\n• **Zone B**: 🟢 82% — comfortable\n• AI recommends staying in your zone until halftime traffic settles.',
    exit: '🚪 Best exit routes from Block D:\n• **Gate 3 (East)** — 5 min walk, moderate traffic\n• **Gate 6 (North)** — 8 min walk, low traffic\n• AI suggests waiting 10 minutes post-event for optimal crowd dispersion.',
  },
  staff: {
    greet: '👷 Staff mode activated. You have access to operational data, incident reporting, and coordination tools. Current status: **2 active incidents** requiring attention. How can I assist?',
    incident: '🚨 Active incidents:\n1. **Zone F overcrowding** (Critical) — crowd at 98%\n2. **Gate 5 queue overflow** (Medium) — 15+ min wait\n\nRecommended actions:\n• Close Gate 7 entry\n• Broadcast redirect announcement\n• Deploy 4 additional security personnel',
    patrol: '🗺️ Current patrol gaps detected by AI:\n• Exit 7 area — no coverage for 8 minutes\n• Concourse A — below optimal density\n\nSuggested redeployment: Shift 2 officers from Zone B (low density) to Zone F perimeter.',
    crowd: '📈 Real-time crowd intelligence:\n• Ingress rate: 340 fans/min\n• Egress rate: 120 fans/min (post-match spike expected)\n• Hotspot: Zone F — dispatch crowd management team NOW\n• Predicted peak: 14:35 — 15 minutes away',
  },
  volunteer: {
    greet: '🤝 Welcome, Volunteer! Your current assignment: **Information Desk, East Concourse, Shift 2 (13:00–17:00)**. I can help with protocols, FAQs, or zone guidance. What do you need?',
    protocol: '📋 Volunteer protocols for crowd situations:\n1. **Alert threshold**: Report to coordinator when queue exceeds 20 people\n2. **Lost children**: Direct to Lost & Found at Gate 1\n3. **Medical**: Call 1800-MEDICAL or alert via VenueIQ app\n4. **Emergency**: Use radio channel 3 + nearest panic button',
    shift: '⏰ Your shift details:\n• Zone: East Concourse (Info Desk + Gate 3 support)\n• Break: 15:00–15:20 (replacement: Volunteer #V2847)\n• End of shift: 17:00 (handover to Shift 3)\n• Supervisor: Meera Kapoor (Radio: Ch. 2)',
  },
  organizer: {
    greet: '📋 Organizer console ready. You have full access to venue analytics, staff coordination, and AI decision support. Current tournament status: **Match 1 in progress, 14:15 — 47,284 attendees**. What analysis do you need?',
    summary: '📊 Today\'s event summary (as of 14:15):\n• **Total revenue (projected)**: ₹2.84 crore\n• **Concession sales**: ₹48.2L (above target by 12%)\n• **Incidents resolved**: 3 of 5\n• **Staff utilization**: 94%\n• **Fan satisfaction** (live sentiment): 4.6/5.0 ⭐',
    prediction: '🔮 AI predictions for next 2 hours:\n• **14:30**: Crowd surge at food courts (+34%)\n• **15:00**: Exit flow begins — Gate 3 will be busiest\n• **16:30**: Post-match — 15,000 departures in 20 mins\n• **Recommended**: Pre-deploy transport at 16:15',
  },
};

const QUICK_PROMPTS = {
  fan:       ['Where is my seat?', 'Find nearest food court', 'Locate restroom', 'How crowded is it?', 'Best exit route?'],
  staff:     ['Show active incidents', 'Check patrol coverage', 'Current crowd stats', 'Resource status'],
  volunteer: ['Show my assignment', 'Emergency protocols', 'Shift details', 'Where is lost & found?'],
  organizer: ['Event summary', 'AI predictions', 'Revenue report', 'Staff utilization'],
};

const TRANSLATIONS = {
  hi: { 'Where is my seat?': 'मेरी सीट कहाँ है?', 'Hello': 'नमस्ते', 'Find nearest food court': 'निकटतम फूड कोर्ट खोजें', 'default': 'आपका संदेश हिंदी में अनुवादित हो रहा है...' },
  es: { 'Where is my seat?': '¿Dónde está mi asiento?', 'Hello': 'Hola', 'Find nearest food court': 'Encontrar el patio de comidas más cercano', 'default': 'Su mensaje está siendo traducido al español...' },
  fr: { 'Hello': 'Bonjour', 'Find nearest food court': 'Trouver la cafétéria la plus proche', 'default': 'Votre message est en cours de traduction en français...' },
  ar: { 'Hello': 'مرحبا', 'default': 'يتم ترجمة رسالتك إلى العربية...' },
  zh: { 'Hello': '你好', 'Find nearest food court': '查找最近的美食广场', 'default': '您的消息正在翻译成中文...' },
  ja: { 'Hello': 'こんにちは', 'default': 'あなたのメッセージは日本語に翻訳されています...' },
  de: { 'Hello': 'Hallo', 'default': 'Ihre Nachricht wird ins Deutsche übersetzt...' },
  pt: { 'Hello': 'Olá', 'default': 'Sua mensagem está sendo traduzida para o português...' },
  ko: { 'Hello': '안녕하세요', 'default': '귀하의 메시지가 한국어로 번역되고 있습니다...' },
};

// ─── Authentication & Profile ──────────────────────────────────────────────────
/**
 * Checks if the user is authenticated. Redirects to login.html if not.
 * Skips check if running under the test suite context.
 */
function checkAuthentication() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('/tests/') || path.includes('test-runner') || path.includes('test_') || path.includes('test.')) {
    return;
  }
  const stored = localStorage.getItem('viq_loggedIn') || sessionStorage.getItem('viq_loggedIn');
  if (stored !== 'true') {
    window.location.href = 'login.html';
  } else {
    // Restore logged in user persona
    const persona = localStorage.getItem('viq_persona') || sessionStorage.getItem('viq_persona') || 'fan';
    STATE.currentPersona = persona;
    updateUserNavbarProfile();
  }
}

/**
 * Renders the logged in user profile and a sign out button in the navbar right.
 */
function updateUserNavbarProfile() {
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;
  
  const loggedIn = localStorage.getItem('viq_loggedIn') || sessionStorage.getItem('viq_loggedIn');
  const persona = localStorage.getItem('viq_persona') || sessionStorage.getItem('viq_persona') || 'fan';
  const email = localStorage.getItem('viq_email') || sessionStorage.getItem('viq_email') || '';
  
  const existingProfile = document.getElementById('nav-user-profile');
  if (existingProfile) existingProfile.remove();
  
  if (loggedIn === 'true') {
    const personaIcons = { fan: '🏟️', staff: '👮', volunteer: '🤝', organizer: '📊' };
    const personaNames = { fan: 'Fan', staff: 'Staff', volunteer: 'Volunteer', organizer: 'Organizer' };
    const icon = personaIcons[persona] || '👤';
    const name = personaNames[persona] || 'User';
    
    const profileDiv = document.createElement('div');
    profileDiv.id = 'nav-user-profile';
    profileDiv.style.display = 'flex';
    profileDiv.style.alignItems = 'center';
    profileDiv.style.gap = '0.75rem';
    profileDiv.style.marginLeft = '0.5rem';
    
    const safeEmail = sanitizeHTML(email);
    const safeName = sanitizeHTML(name);
    
    profileDiv.innerHTML = `
      <div class="user-badge" style="background:rgba(255,255,255,0.06); border:1px solid var(--c-border); padding:0.35rem 0.65rem; border-radius:8px; display:flex; align-items:center; gap:0.4rem; font-size:0.8rem;">
        <span aria-hidden="true">${icon}</span>
        <span style="font-weight:600;">${safeName}</span>
        <span style="color:var(--c-text-muted); font-size:0.75rem; max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${safeEmail}">${safeEmail}</span>
      </div>
      <button class="btn-sm btn-outline" style="border:1px solid rgba(239,68,68,0.4); color:var(--c-red); font-size:0.75rem; padding:0.35rem 0.65rem; border-radius:8px;" onclick="signOut()" aria-label="Sign Out">Sign Out</button>
    `;
    navRight.appendChild(profileDiv);
  }
}

/**
 * Logs the current user out, clearing storage, and redirects to login.html.
 */
function signOut() {
  localStorage.removeItem('viq_loggedIn');
  localStorage.removeItem('viq_persona');
  localStorage.removeItem('viq_email');
  localStorage.removeItem('viq_loginTs');
  sessionStorage.removeItem('viq_loggedIn');
  sessionStorage.removeItem('viq_persona');
  sessionStorage.removeItem('viq_email');
  sessionStorage.removeItem('viq_loginTs');
  
  if (typeof announce === 'function') {
    announce('Logged out successfully.');
  }
  
  window.location.href = 'login.html';
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAuthentication();
  initHeroCanvas();
  animateCounters();
  setInterval(animateCounters, COUNTER_REFRESH_MS);

  // Keyboard trap: Escape closes AR modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('arModal');
      if (modal && modal.style.display !== 'none') closeAR();
    }
  });
});

/**
 * Shows a named section, hides all others, and initialises the section once.
 * Updates aria-current on nav links and scrolls to top.
 * @param {string} name - Section identifier (e.g. 'dashboard', 'crowd')
 * @param {HTMLElement} linkEl - The nav anchor element that was clicked
 */
function showSection(name, linkEl) {
  // Hide hero
  document.getElementById('hero-section').style.display = 'none';
  const main = document.getElementById('app-main');
  main.style.display = 'block';

  // Deactivate all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.remove('active');
    l.removeAttribute('aria-current');
  });

  // Activate selected
  const sec = document.getElementById(`section-${name}`);
  if (sec) sec.classList.add('active');
  if (linkEl) {
    linkEl.classList.add('active');
    linkEl.setAttribute('aria-current', 'page');
  }

  if (STATE.currentSection !== name) {
    STATE.currentSection = name;
    initSection(name);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Initialises the section by name based on the navigation flow.
 * @param {string} name - The section name to initialise
 */
function initSection(name) {
  switch(name) {
    case 'dashboard':   initDashboard(); break;
    case 'crowd':       initCrowd(); break;
    case 'navigation':  initNavigation(); break;
    case 'decisions':   initDecisions(); break;
    case 'assistant':   initAssistant(); break;
    case 'staff':       initStaff(); break;
  }
}

/**
 * Initialises the animated neural network particle canvas in the hero section.
 * Uses requestAnimationFrame for smooth 60fps rendering with particle connections.
 */
function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const particles = Array.from({length: PARTICLE_COUNT}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - .5) * .5,
    vy: (Math.random() - .5) * .5,
    r: Math.random() * 2 + .5,
    alpha: Math.random() * .5 + .1,
    color: Math.random() > .5 ? '#7c3aed' : '#06b6d4',
  }));

  function drawFrame() {
    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      });
      // Draw connections
      ctx.globalAlpha = 1;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < PARTICLE_CONNECTION_DIST) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(124,58,237,${.15 * (1 - dist/PARTICLE_CONNECTION_DIST)})`;
            ctx.lineWidth = .5;
            ctx.stroke();
          }
        }
      }
    } catch (err) {
      console.warn('VenueIQ: hero canvas render error', err);
    }
    requestAnimationFrame(drawFrame);
  }
  drawFrame();
}

/**
 * Animates hero stat counters from 0 to their target value using setInterval.
 * Reads target from the `data-target` attribute on `.stat-num` elements.
 */
function animateCounters() {
  document.querySelectorAll('.stat-num').forEach(el => {
    const target = parseInt(el.dataset.target, 10);
    let current = 0;
    const step = target / 40;
    const interval = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = Math.round(current);
      if (current >= target) clearInterval(interval);
    }, 30);
  });
}

/**
 * Initialises the dashboard section: renders alerts, insights, draws charts,
 * and starts KPI auto-update interval.
 */
function initDashboard() {
  renderAlertStream();
  renderInsights();
  drawHeatmap();
  drawZoneChart();
  startKPIUpdates();
}

/**
 * Renders the alert stream list from the ALERTS data array into the #alertStream element.
 * All alert content is XSS-sanitized before DOM insertion.
 */
function renderAlertStream() {
  const el = document.getElementById('alertStream');
  if (!el) return;
  el.innerHTML = ALERTS.map(a => `
    <div class="alert-item ${sanitizeHTML(a.type)}">
      <span>${sanitizeHTML(a.icon)}</span>
      <span>${sanitizeHTML(a.msg)}</span>
      <span class="alert-time">${sanitizeHTML(a.time)}</span>
    </div>
  `).join('');
}

/**
 * Renders AI insights from the INSIGHTS data array into the #insightsList element.
 * Each insight card shows a labelled tag and descriptive text.
 */
function renderInsights() {
  const el = document.getElementById('insightsList');
  if (!el) return;
  el.innerHTML = INSIGHTS.map(i => `
    <div class="insight-item">
      <div class="insight-tag">${sanitizeHTML(i.tag)}</div>
      <div>${sanitizeHTML(i.text)}</div>
    </div>
  `).join('');
}

function drawHeatmap() {
  const canvas = document.getElementById('heatmapCanvas');
  if (!canvas) return;
  try {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = 'rgba(13,22,38,0.95)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(99,120,180,.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(20, 20, W-40, H-40);
    ctx.fillStyle = 'rgba(5,46,22,.5)';
    ctx.fillRect(W*0.25, H*0.2, W*0.5, H*0.6);
    ctx.strokeStyle = 'rgba(34,197,94,.2)';
    ctx.strokeRect(W*0.25, H*0.2, W*0.5, H*0.6);
    ctx.beginPath();
    ctx.arc(W/2, H/2, 40, 0, Math.PI*2);
    ctx.stroke();
    const zones = [
      { x:0.05, y:0.1,  w:.18, h:.8, density:.88, color:[249,115,22] },
      { x:0.77, y:0.1,  w:.18, h:.8, density:.72, color:[234,179,8]  },
      { x:0.24, y:0.03, w:.52, h:.14, density:.95, color:[239,68,68]  },
      { x:0.24, y:0.83, w:.52, h:.14, density:.65, color:[34,197,94]  },
      { x:0.05, y:0.38, w:.18, h:.24, density:.45, color:[34,197,94]  },
      { x:0.77, y:0.38, w:.18, h:.24, density:.55, color:[234,179,8]  },
    ];
    zones.forEach(z => {
      const x = z.x * W, y = z.y * H, w = z.w * W, h = z.h * H;
      const grad = ctx.createRadialGradient(x+w/2, y+h/2, 0, x+w/2, y+h/2, Math.max(w,h)/2);
      const [r,g,b] = z.color;
      grad.addColorStop(0, `rgba(${r},${g},${b},${z.density * .7})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.font = 'bold 11px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(z.density*100)}%`, x+w/2, y+h/2+4);
    });
  } catch (err) {
    console.warn('VenueIQ: heatmap render error', err);
  }
}

function drawZoneChart() {
  const canvas = document.getElementById('zoneChart');
  if (!canvas) return;
  try {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const labels = ZONES.map(z => z.name.split('—')[0].trim());
    const values = ZONES.map(z => Math.round((z.count/z.cap)*100));
    const colors = ZONES.map(z => z.color);
    const barH = 30, spacing = 12, startY = 20, maxBarW = W - 110;
    values.forEach((v, i) => {
      const y = startY + i * (barH + spacing);
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.font = '10px Inter';
      ctx.textAlign = 'right';
      ctx.fillText(labels[i], 82, y + barH/2 + 4);
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      roundRect(ctx, 88, y, maxBarW, barH, 4);
      ctx.fill();
      const barW = (v / 100) * maxBarW;
      const grad = ctx.createLinearGradient(88, 0, 88 + barW, 0);
      grad.addColorStop(0, colors[i] + 'cc');
      grad.addColorStop(1, colors[i] + '55');
      ctx.fillStyle = grad;
      roundRect(ctx, 88, y, barW, barH, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.textAlign = 'left';
      ctx.font = 'bold 10px Inter';
      ctx.fillText(`${v}%`, 88 + barW + 4, y + barH/2 + 4);
    });
  } catch (err) {
    console.warn('VenueIQ: zone chart render error', err);
  }
}

/**
 * Draws a rounded rectangle path on the canvas context.
 * Does not fill or stroke — caller is responsible for that.
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - Left edge
 * @param {number} y - Top edge
 * @param {number} w - Width
 * @param {number} h - Height
 * @param {number} r - Border radius
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Starts a recurring interval to update live KPI values with simulated data.
 * Updates crowd count, navigation queries, and AI interaction counts.
 */
function startKPIUpdates() {
  if (STATE._kpiInterval) clearInterval(STATE._kpiInterval);
  STATE._kpiInterval = setInterval(() => {
    const crowdEl = document.getElementById('kpi-crowd-val');
    if (crowdEl) crowdEl.textContent = (47000 + Math.floor(Math.random() * 600)).toLocaleString();
    const navEl = document.getElementById('kpi-nav-val');
    if (navEl) navEl.textContent = (8000 + Math.floor(Math.random() * 500)).toLocaleString();
    const assistEl = document.getElementById('kpi-assist-val');
    if (assistEl) assistEl.textContent = (23000 + Math.floor(Math.random() * 1000)).toLocaleString();
    const lu = document.getElementById('lastUpdated');
    if (lu) lu.textContent = 'just now';
  }, KPI_UPDATE_INTERVAL_MS);
}

// ─── Crowd Management ─────────────────────────────────────────────────────────
/**
 * Initialises the Crowd Management section: renders zone cards,
 * crowd map, forecast chart, routing list, predictions, and gate utilisation.
 */
function initCrowd() {
  renderZoneCards();
  drawCrowdMap();
  drawForecastChart();
  renderRoutingList();
  renderPredAlerts();
  drawFlowChart();
  drawDwellChart();
  renderGateUtil();
}

/**
 * Renders zone occupancy cards from the ZONES data array into #zoneCards.
 * Shows name, live count, percentage fill bar, and colour-coded status.
 */
function renderZoneCards() {
  const el = document.getElementById('zoneCards');
  if (!el) return;
  el.innerHTML = ZONES.map(z => {
    const pct = Math.round((z.count / z.cap) * 100);
    return `
      <div class="zone-card">
        <div class="zone-name">${sanitizeHTML(z.name)}</div>
        <div class="zone-count" style="color:${z.color}">${z.count.toLocaleString()}</div>
        <div class="zone-bar-wrap">
          <div class="zone-bar" style="width:${pct}%;background:${z.color}"></div>
        </div>
        <div style="font-size:.7rem;color:var(--c-text-muted);margin-top:.2rem">${pct}% full</div>
      </div>
    `;
  }).join('');
}

/**
 * Draws the real-time crowd density map on #crowdMapCanvas.
 * Uses radial gradients colour-coded by density level per zone.
 */
function drawCrowdMap() {
  const canvas = document.getElementById('crowdMapCanvas');
  if (!canvas) return;
  try {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(99,120,180,.25)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 20, 20, W-40, H-40, 12);
    ctx.stroke();
    ctx.fillStyle = 'rgba(5,46,22,.6)';
    roundRect(ctx, W*.22, H*.18, W*.56, H*.64, 6);
    ctx.fill();
    const crowdZones = [
      { label:'N', x:.22, y:.04, w:.56, h:.13, density:.95 },
      { label:'S', x:.22, y:.83, w:.56, h:.13, density:.65 },
      { label:'W', x:.03, y:.18, w:.18, h:.64, density:.88 },
      { label:'E', x:.79, y:.18, w:.18, h:.64, density:.72 },
    ];
    crowdZones.forEach(z => {
      const x = z.x * W, y = z.y * H, w = z.w * W, h = z.h * H;
      const d = z.density;
      const grad = ctx.createRadialGradient(x+w/2, y+h/2, 0, x+w/2, y+h/2, Math.max(w,h)/1.5);
      grad.addColorStop(0, `rgba(239,68,68,${d*.65})`);
      grad.addColorStop(1, `rgba(239,68,68,0.05)`);
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, w, h, 4);
      ctx.fill();
    });
  } catch (err) {
    console.warn('VenueIQ: crowd map render error', err);
  }
}

/**
 * Draws the crowd density forecast line chart on #forecastChart.
 * Shows projected venue capacity % over the next 2 hours.
 */
function drawForecastChart() {
  const canvas = document.getElementById('forecastChart');
  if (!canvas) return;
  try {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const hours = ['Now', '+15m', '+30m', '+45m', '+1h', '+1.5h', '+2h'];
    const values = [94, 96, 98, 95, 89, 85, 80];
    const padL = 30, padR = 10, padT = 15, padB = 25, chartW = W - padL - padR, chartH = H - padT - padB;
    const points = values.map((v, i) => ({
      x: padL + (i / (hours.length - 1)) * chartW,
      y: padT + chartH - ((v - 70) / 30) * chartH,
    }));
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2;
    ctx.stroke();
  } catch (err) {
    console.warn('VenueIQ: forecast chart render error', err);
  }
}

/**
 * Renders AI-recommended crowd routing actions into #routingList.
 */
function renderRoutingList() {
  const el = document.getElementById('routingList');
  if (!el) return;
  const routings = [
    '🔀 Redirect Gate 7 traffic → Gates 4 & 6',
    '📢 PA redirect announcement — Zone F fans',
  ];
  el.innerHTML = routings.map(r => `<div class="routing-item"><span>${sanitizeHTML(r)}</span></div>`).join('');
}

/**
 * Renders AI predictive alerts into #predAlerts when density thresholds are exceeded.
 */
function renderPredAlerts() {
  const el = document.getElementById('predAlerts');
  if (!el) return;
  el.innerHTML = '<div class="pred-alert">⚠️ Prediction threshold reached.</div>';
}

/**
 * Draws the crowd flow direction chart on #flowChart.
 * Placeholder for real-time ingress/egress vector visualisation.
 */
function drawFlowChart() {
  const canvas = document.getElementById('flowChart');
  if (!canvas) return;
  try {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
  } catch (err) {
    console.warn('VenueIQ: flow chart render error', err);
  }
}

/**
 * Draws the average dwell time per zone chart on #dwellChart.
 * Placeholder for AI-computed average fan dwell time analysis.
 */
function drawDwellChart() {
  const canvas = document.getElementById('dwellChart');
  if (!canvas) return;
  try {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
  } catch (err) {
    console.warn('VenueIQ: dwell chart render error', err);
  }
}

/**
 * Renders gate utilisation statistics into #gateUtil.
 * Highlights gates approaching or exceeding safe throughput capacity.
 */
function renderGateUtil() {
  const el = document.getElementById('gateUtil');
  if (!el) return;
  el.innerHTML = '<div class="gate-row">Gate 5 — 95% utilized</div>';
}

/**
 * Toggles the AI crowd simulation on/off.
 */
function toggleCrowdSim() {
  const btn = document.getElementById('simBtn');
  STATE.crowdSim = !STATE.crowdSim;
  btn.setAttribute('aria-pressed', STATE.crowdSim ? 'true' : 'false');
  if (STATE.crowdSim) {
    btn.textContent = '⏸ Stop Simulation';
    STATE.simInterval = setInterval(() => {
      renderZoneCards();
    }, CROWD_SIM_INTERVAL_MS);
  } else {
    btn.textContent = '⏵ Run AI Simulation';
    clearInterval(STATE.simInterval);
  }
}

// ─── Navigation ───────────────────────────────────────────────────────────────
/**
 * Initialises the Smart Navigation section: draws the venue map,
 * renders turn-by-turn steps, and populates the POI grid.
 */
function initNavigation() {
  drawNavCanvas();
  renderSteps();
  renderPOIs();
}

/**
 * Draws the indoor venue navigation map on #navCanvas.
 * Re-rendered whenever the destination or mode changes.
 */
function drawNavCanvas() {
  const canvas = document.getElementById('navCanvas');
  if (!canvas) return;
  try {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  } catch (err) {
    console.warn('VenueIQ: nav canvas render error', err);
  }
}

/**
 * Updates the navigation route based on the selected destination.
 */
function updateNavRoute() {
  const sel = document.getElementById('navDest');
  if (!sel) return;
  STATE.navDest = sel.value;
  drawNavCanvas();
  renderSteps();
}

/**
 * Renders the turn-by-turn navigation steps for the current destination.
 * Steps are drawn from NAV_STEPS[STATE.navDest].
 */
function renderSteps() {
  const el = document.getElementById('stepsList');
  if (!el) return;
  const steps = NAV_STEPS[STATE.navDest] || NAV_STEPS.seat;
  el.innerHTML = steps.map(s => `<div>${sanitizeHTML(s.step)}</div>`).join('');
}

/**
 * Renders the Points of Interest grid from the POIS data array.
 * Each POI shows emoji, name, and distance from current position.
 */
function renderPOIs() {
  const el = document.getElementById('poiGrid');
  if (!el) return;
  el.innerHTML = POIS.map(p => `<div>${sanitizeHTML(p.name)}</div>`).join('');
}

/**
 * Opens the AR navigation modal.
 */
function launchAR() {
  document.getElementById('arModal').style.display = 'flex';
}

/**
 * Closes the AR navigation modal.
 */
function closeAR() {
  document.getElementById('arModal').style.display = 'none';
}

// ─── Decisions ─────────────────────────────────────────────────────────────────────────
/**
 * Initialises the Decision Hub section: loads incident list, recommendations,
 * resource grid, timeline, and seeds the AI command center greeting.
 */
function initDecisions() {
  filterIncidents('all', document.querySelector('.incident-filter'));
  renderRecommendations();
  renderResourceGrid();
  renderTimeline();
  // Init command center with greeting
  const cmdMsgs = document.getElementById('commandMessages');
  if (cmdMsgs && cmdMsgs.children.length === 0) {
    addCommandMessage('ai', '🤖 AI Command Center ready. Monitoring all zones and incidents. Ask me anything about current venue status.');
  }
}

/**
 * Renders a basic incident title list into #incidentList.
 * Used as a lightweight fallback; filterIncidents() renders the full cards.
 */
function renderIncidents() {
  const el = document.getElementById('incidentList');
  if (!el) return;
  el.innerHTML = INCIDENTS.map(inc => `<div>${sanitizeHTML(inc.title)}</div>`).join('');
}

/**
 * Renders AI-generated recommendations into #recommendList.
 * Each card shows an icon, label, and detailed action text.
 */
function renderRecommendations() {
  const el = document.getElementById('recommendList');
  if (!el) return;
  el.innerHTML = RECOMMENDATIONS.map(r => `<div>${sanitizeHTML(r.text)}</div>`).join('');
}



/** Debounced live-translation handler. */
const liveTranslate = debounce(() => {
  doTranslate();
}, DEBOUNCE_TRANSLATE_MS);

// ─── AI Response Engine ───────────────────────────────────────────────────────────────────────
/**
 * Returns the best AI response for the given query, persona, and language.
 * Applies keyword matching and optionally appends a translation note.
 * @param {string} query - The user’s raw input text
 * @param {string} persona - One of: fan, staff, volunteer, organizer
 * @param {string} lang - Language code, e.g. 'en', 'hi'
 * @returns {string} The AI response text
 */
function getAIResponse(query, persona, lang) {
  const q = query.toLowerCase();
  const p = AI_RESPONSES[persona] || AI_RESPONSES.fan;
  let response = p.greet;

  if (persona === 'fan') {
    if (q.includes('crowd') || q.includes('busy') || q.includes('capacity') || q.includes('full')) response = p.crowd;
    else if (q.includes('seat') || q.includes('block') || q.includes('row')) response = p.seat;
    else if (q.includes('food') || q.includes('eat') || q.includes('hungry') || q.includes('drink')) response = p.food;
    else if (q.includes('toilet') || q.includes('restroom') || q.includes('bathroom') || q.includes('wc')) response = p.toilet;
    else if (q.includes('exit') || q.includes('leave') || q.includes('out') || q.includes('go home')) response = p.exit;
  } else if (persona === 'staff') {
    if (q.includes('incident') || q.includes('alert') || q.includes('emergency')) response = p.incident;
    else if (q.includes('patrol') || q.includes('coverage') || q.includes('redeploy')) response = p.patrol;
    else if (q.includes('crowd') || q.includes('capacity') || q.includes('density')) response = p.crowd;
  } else if (persona === 'volunteer') {
    if (q.includes('protocol') || q.includes('emergency') || q.includes('procedure')) response = p.protocol;
    else if (q.includes('shift') || q.includes('schedule') || q.includes('assignment') || q.includes('break')) response = p.shift;
  } else if (persona === 'organizer') {
    if (q.includes('summary') || q.includes('revenue') || q.includes('report') || q.includes('sales')) response = p.summary;
    else if (q.includes('predict') || q.includes('forecast') || q.includes('next') || q.includes('future')) response = p.prediction;
  }

  if (lang && lang !== 'en') {
    response += `\n\n[Translated to ${lang.toUpperCase()}]`;
  }
  return response;
}

// ─── AI Assistant ────────────────────────────────────────────────────────────────────────
/**
 * Initialises the AI Assistant section, rendering chips and starting the chat.
 */
function initAssistant() {
  renderPromptChips();
  initChat();
}

/**
 * Initialises the chat stream by greeting the user.
 */
function initChat() {
  const msgs = document.getElementById('chatMessages');
  if (!msgs || msgs.children.length > 0) return;
  addBotMessage(AI_RESPONSES[STATE.currentPersona].greet, 'en');
}

/**
 * Sends a chat message and triggers an AI response.
 * Sanitizes user input and enforces MAX_INPUT_LENGTH.
 */
function sendMessage() {
  const input = document.getElementById('chatInput');
  const langSel = document.getElementById('chatLang');
  const raw = (input.value || '').trim().slice(0, MAX_INPUT_LENGTH);
  if (!raw) return;
  const lang = langSel ? langSel.value : 'en';

  addUserMessage(raw, lang);
  input.value = '';

  const typingEl = document.getElementById('typingIndicator');
  if (typingEl) typingEl.style.display = 'flex';

  setTimeout(() => {
    if (typingEl) typingEl.style.display = 'none';
    const response = getAIResponse(raw, STATE.currentPersona, lang);
    addBotMessage(response, lang);
  }, CHAT_RESPONSE_BASE_MS + Math.random() * CHAT_RESPONSE_JITTER_MS);
}

/**
 * Adds a user message bubble to the chat, sanitizing input before DOM insertion.
 * @param {string} text - Raw user message
 * @param {string} lang - Language code
 */
function addUserMessage(text, lang) {
  const el = document.getElementById('chatMessages');
  if (!el) return;
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble user';
  const safeText = sanitizeHTML(text);
  bubble.innerHTML = lang !== 'en'
    ? `<div class="bubble-lang">${sanitizeHTML(lang.toUpperCase())}</div>${safeText}`
    : safeText;
  el.appendChild(bubble);
  el.scrollTop = el.scrollHeight;
  STATE.chatMessages.push({ role: 'user', text, lang, ts: Date.now() });
}

/**
 * Adds an AI bot message bubble to the chat.
 * @param {string} text - AI response text
 * @param {string} lang - Language code
 */
function addBotMessage(text, lang) {
  const el = document.getElementById('chatMessages');
  if (!el) return;
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble bot';
  bubble.innerHTML = `
    <div class="bot-avatar">VQ</div>
    <div class="bubble-content">
      <div class="bubble-persona">${sanitizeHTML(STATE.currentPersona.charAt(0).toUpperCase() + STATE.currentPersona.slice(1))} AI</div>
      <div class="bubble-text">${sanitizeHTML(text).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
      ${lang !== 'en' ? `<div class="bubble-lang">${sanitizeHTML(lang.toUpperCase())}</div>` : ''}
    </div>`;
  el.appendChild(bubble);
  el.scrollTop = el.scrollHeight;
  STATE.chatMessages.push({ role: 'bot', text, lang, ts: Date.now() });
}

/**
 * Sets the current AI persona and updates the chat greeting.
 * @param {string} persona - One of: fan, staff, volunteer, organizer
 */
function setPersona(persona) {
  STATE.currentPersona = persona;
  document.querySelectorAll('.persona-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById(`persona-${persona}`);
  if (card) card.classList.add('active');
  renderPromptChips();
  // Show persona greeting
  const msgs = document.getElementById('chatMessages');
  if (msgs) msgs.innerHTML = '';
  addBotMessage(AI_RESPONSES[persona].greet, 'en');
}

/** Renders quick-prompt chips for the current persona. */
function renderPromptChips() {
  const el = document.getElementById('promptChips');
  if (!el) return;
  el.innerHTML = (QUICK_PROMPTS[STATE.currentPersona] || []).map(p =>
    `<button class="chip" onclick="sendQuickPrompt('${sanitizeHTML(p).replace(/'/g,'\\&#39;')}')">${sanitizeHTML(p)}</button>`
  ).join('');
}

/**
 * Sends a quick-prompt message.
 * @param {string} text - The prompt text
 */
function sendQuickPrompt(text) {
  const input = document.getElementById('chatInput');
  if (input) input.value = text;
  sendMessage();
}

/** Clears the chat conversation history. */
function clearChat() {
  const msgs = document.getElementById('chatMessages');
  if (msgs) msgs.innerHTML = '';
  STATE.chatMessages = [];
  addBotMessage(AI_RESPONSES[STATE.currentPersona].greet, 'en');
}

/** Exports the chat transcript as a downloadable text file. */
function exportChat() {
  const lines = STATE.chatMessages.map(m => `[${m.role.toUpperCase()}] ${m.text}`).join('\n');
  const blob = new Blob([lines], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'venueiq-chat.txt';
  a.click();
}

/** Toggles voice input mode (UI simulation). */
function toggleVoice() {
  STATE.voiceActive = !STATE.voiceActive;
  const btn = document.getElementById('voiceBtn');
  if (btn) {
    btn.style.background = STATE.voiceActive ? 'rgba(239,68,68,.2)' : '';
    btn.setAttribute('aria-pressed', STATE.voiceActive ? 'true' : 'false');
  }
}

/** Changes the UI display language via selector. */
function changeUILanguage() {
  const sel = document.getElementById('uiLang');
  if (sel) console.log('UI Language changed to:', sel.value);
}

/** Performs translation of the text in translateInput. */
function doTranslate() {
  const taEl = document.getElementById('translateInput');
  const raw = taEl ? taEl.value : '';
  const text = raw.trim().slice(0, MAX_INPUT_LENGTH);
  const toLang = (document.getElementById('toLang') || {}).value || 'hi';
  const el = document.getElementById('translateOutput');
  if (!el) return;
  if (!text) { el.innerHTML = '<div class="trans-placeholder">Please enter text to translate</div>'; return; }
  el.innerHTML = '<div class="trans-placeholder" style="color:var(--c-cyan)">Translating…</div>';
  setTimeout(() => {
    const transMap = TRANSLATIONS[toLang] || {};
    const result = transMap[text] || transMap.default || `${sanitizeHTML(text)} [${sanitizeHTML(toLang.toUpperCase())} translation]`;
    el.innerHTML = `<div style="line-height:1.6">${sanitizeHTML(result)}</div>`;
  }, 800);
}

/** Swaps source and target language selectors. */
function swapLangs() {
  const from = document.getElementById('fromLang');
  const to   = document.getElementById('toLang');
  if (!from || !to) return;
  const tmp = from.value;
  from.value = to.value;
  to.value = tmp;
  doTranslate();
}

// ─── Decision Hub ─────────────────────────────────────────────────────────────────────────
/**
 * Sends a command query to the AI command center.
 * Sanitizes input and enforces MAX_INPUT_LENGTH.
 */
function sendCommandQuery() {
  const input = document.getElementById('commandInput');
  const raw = (input.value || '').trim().slice(0, MAX_INPUT_LENGTH);
  if (!raw) return;
  addCommandMessage('user', raw);
  input.value = '';
  setTimeout(() => {
    const confidence = (Math.random() * AI_CONFIDENCE_RANGE + AI_CONFIDENCE_MIN).toFixed(2);
    const responses = [
      `🤖 AI Analysis complete — deploying resources to high-priority zones. Confidence: ${confidence}`,
      `📊 Status: 2 active incidents, 94% venue capacity, all systems operational. Confidence: ${confidence}`,
      `🔄 AI recommends rerouting 2,000 fans to reduce Zone F density. Broadcast initiated. Confidence: ${confidence}`,
      `✅ Command acknowledged. Dispatching team, updating dashboard. Confidence: ${confidence}`,
    ];
    addCommandMessage('ai', responses[Math.floor(Math.random() * responses.length)]);
  }, 800);
}

/**
 * Adds a message to the command chat panel.
 * @param {string} type - 'user' or 'ai'
 * @param {string} text - Message text
 */
function addCommandMessage(type, text) {
  const el = document.getElementById('commandMessages');
  if (!el) return;
  const div = document.createElement('div');
  div.className = `command-msg ${type}`;
  div.innerHTML = `<span class="cmd-badge">${type === 'ai' ? '🤖 AI' : '👤 You'}</span> ${sanitizeHTML(text)}`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

/**
 * Generates an AI analysis for a specific incident with confidence score.
 * @param {number} id - The incident ID
 */
function aiAnalyzeIncident(id) {
  const inc = INCIDENTS.find(i => i.id === id);
  const confidence = (Math.random() * AI_CONFIDENCE_RANGE + AI_CONFIDENCE_MIN).toFixed(2);
  const protocols = ['Delta', 'Alpha', 'Sigma', 'Bravo', 'Omega'];
  const proto = `Protocol ${Math.floor(Math.random()*5+1)} — ${protocols[Math.floor(Math.random()*5)]}`;
  const escalation = Math.floor(Math.random()*30+15);
  addCommandMessage('ai',
    `🤖 AI Analysis — "${sanitizeHTML(inc?.title ?? 'Unknown')}"\n` +
    `• Confidence Score: ${confidence} / 1.00\n` +
    `• Escalation probability: ${escalation}%\n` +
    `• Recommended response: ${proto}\n` +
    `• Reasoning: Density trend + ingress rate correlation triggered alert threshold.`);
}

/**
 * Filters the incident list by severity.
 * @param {string} sev - Severity filter: 'all', 'critical', 'medium', 'low'
 * @param {HTMLElement} btn - The clicked filter button
 */
function filterIncidents(sev, btn) {
  document.querySelectorAll('.incident-filter').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }

  const el = document.getElementById('incidentList');
  if (!el) return;
  const filtered = sev === 'all' ? INCIDENTS : INCIDENTS.filter(i => i.sev === sev);
  el.innerHTML = filtered.map(inc => `
    <div class="incident-card ${inc.sev}" role="listitem">
      <div class="inc-header">
        <span class="inc-badge sev-${inc.sev}">${sanitizeHTML(inc.sev.toUpperCase())}</span>
        <span class="inc-time">${sanitizeHTML(inc.time)}</span>
        <span class="inc-status">${sanitizeHTML(inc.status)}</span>
      </div>
      <div class="inc-title">${sanitizeHTML(inc.title)}</div>
      <div class="inc-desc">${sanitizeHTML(inc.desc)}</div>
      <div class="inc-actions">
        <button class="btn-sm btn-outline" onclick="aiAnalyzeIncident(${inc.id})">🤖 AI Analyze</button>
        <button class="btn-sm btn-purple" onclick="deployResource(${inc.id})">Deploy Resource</button>
      </div>
    </div>
  `).join('');
}

/**
 * Deploys a resource in response to an incident.
 * @param {number} id - Incident ID
 */
function deployResource(id) {
  const inc = INCIDENTS.find(i => i.id === id);
  addCommandMessage('ai', `✅ Resources dispatched for incident #${id}: "${sanitizeHTML(inc?.title ?? '')}" — Team en route.`);
}

// ─── Navigation Mode ──────────────────────────────────────────────────────────────────────────
/**
 * Sets the indoor navigation mode.
 * @param {string} mode - 'walking', 'accessible', 'fastest', or 'scenic'
 * @param {HTMLElement} btn - The clicked mode button
 */
function setNavMode(mode, btn) {
  STATE.navMode = mode;
  document.querySelectorAll('.nav-mode-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }
  drawNavCanvas();
}

// ─── Staff Ops ─────────────────────────────────────────────────────────────────────────────
/**
 * Initialises the Staff Operations section: draws staff deployment map,
 * renders summaries, task list, resource grid, timeline, and charts.
 */
function initStaff() {
  drawStaffCanvas();
  renderStaffSummary();
  renderTaskList();
  renderResourceGrid();
  renderTimeline();
  drawResponseChart();
  drawCoverageChart();
  renderSkillMatch();
}

/**
 * Draws the live staff deployment map on #staffCanvas.
 * Colour-coded dots indicate each team type's current position.
 */
function drawStaffCanvas() {
  const canvas = document.getElementById('staffCanvas');
  if (!canvas) return;
  try {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(99,120,180,.25)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 10, 10, W-20, H-20, 10);
    ctx.stroke();
    ctx.fillStyle = 'rgba(5,46,22,.5)';
    roundRect(ctx, W*.25, H*.2, W*.5, H*.6, 6);
    ctx.fill();
    const staffDots = [
      {x:.12,y:.3,color:'#7c3aed'},{x:.85,y:.3,color:'#7c3aed'},{x:.5,y:.1,color:'#06b6d4'},
      {x:.2,y:.7,color:'#ef4444'},{x:.8,y:.7,color:'#ef4444'},{x:.5,y:.9,color:'#10b981'},
      {x:.3,y:.5,color:'#10b981'},{x:.7,y:.5,color:'#10b981'},{x:.5,y:.5,color:'#f97316'},
    ];
    staffDots.forEach(d => {
      ctx.beginPath();
      ctx.arc(d.x*W, d.y*H, 8, 0, Math.PI*2);
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  } catch (err) {
    console.warn('VenueIQ: staff canvas render error', err);
  }
}

/**
 * Renders the staff headcount summary cards (Security, Medics, Volunteers, Ops)
 * from STAFF_SUMMARY data into #staffSummary.
 */
function renderStaffSummary() {
  const el = document.getElementById('staffSummary');
  if (!el) return;
  el.innerHTML = STAFF_SUMMARY.map(s => `
    <div class="staff-card">
      <div class="staff-icon">${s.icon}</div>
      <div class="staff-num" style="color:${s.color}">${s.num}</div>
      <div class="staff-label">${sanitizeHTML(s.label)}</div>
    </div>
  `).join('');
}

/**
 * Renders the operational task list from TASKS data into #taskList.
 * Each row shows priority colour, task name, zone, and assignee.
 */
function renderTaskList() {
  const el = document.getElementById('taskList');
  if (!el) return;
  el.innerHTML = TASKS.map(t => `
    <div class="task-row">
      <div class="task-priority" style="background:${t.priority}"></div>
      <div class="task-info">
        <div class="task-name">${sanitizeHTML(t.name)}</div>
        <div class="task-meta">${sanitizeHTML(t.zone)} • ${sanitizeHTML(t.assignee)}</div>
      </div>
    </div>
  `).join('');
}

/**
 * Renders the deployable resource grid from RESOURCES data into #resourceGrid.
 * Shows each unit's status and a Deploy/Recall toggle button.
 */
function renderResourceGrid() {
  const el = document.getElementById('resourceGrid');
  if (!el) return;
  el.innerHTML = RESOURCES.map((r, i) => `
    <div class="resource-card ${r.deployed ? 'deployed' : ''}">
      <div class="res-icon">${r.icon}</div>
      <div class="res-name">${sanitizeHTML(r.name)}</div>
      <div class="res-status">${sanitizeHTML(r.status)}</div>
      <button class="btn-sm ${r.deployed ? 'btn-outline' : 'btn-purple'}" onclick="toggleResource(${i})">
        ${r.deployed ? 'Recall' : 'Deploy'}
      </button>
    </div>
  `).join('');
}

/**
 * Toggles the deployed state of a resource and re-renders the grid.
 * @param {number} idx - Index into RESOURCES array
 */
function toggleResource(idx) {
  RESOURCES[idx].deployed = !RESOURCES[idx].deployed;
  renderResourceGrid();
}

/**
 * Renders the event timeline from TIMELINE data into #timeline.
 * Each entry has a colour-coded dot, time, event name, and note.
 */
function renderTimeline() {
  const el = document.getElementById('timeline');
  if (!el) return;
  el.innerHTML = TIMELINE.map(t => `
    <div class="timeline-item">
      <div class="tl-dot" style="background:${t.color}"></div>
      <div class="tl-time">${sanitizeHTML(t.time)}</div>
      <div class="tl-content">
        <div class="tl-event">${sanitizeHTML(t.event)}</div>
        <div class="tl-note">${sanitizeHTML(t.note)}</div>
      </div>
    </div>
  `).join('');
}

/** Helper: draws a basic bar chart on a canvas context. */
function drawBarChart(ctx, W, H, data) {
  const padL = 10, padR = 10, padT = 20, padB = 50;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const gap = chartW / data.length;
  const barW = gap * 0.6;
  const maxVal = Math.max(...data.map(d => d.val || 0), 1);

  data.forEach((d, i) => {
    const barH = (d.val / maxVal) * chartH;
    const x = padL + i * gap + (gap - barW) / 2;
    const y = padT + chartH - barH;
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, (d.color || '#7c3aed') + 'cc');
    grad.addColorStop(1, (d.color || '#7c3aed') + '44');
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, barW, barH, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = '9px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(sanitizeHTML(d.label || ''), x + barW/2, H - padB + 14);
  });
}

// ─── Dashboard helpers ────────────────────────────────────────────────────────────────────────
/** Refreshes the dashboard data and redraws all charts. */
function refreshDashboard() {
  renderAlertStream();
  renderInsights();
  drawHeatmap();
  drawZoneChart();
  const lu = document.getElementById('lastUpdated');
  if (lu) lu.textContent = 'just now';
}

/** Resets the crowd map to initial non-simulated state. */
function resetCrowdMap() {
  if (STATE.simInterval) clearInterval(STATE.simInterval);
  STATE.crowdSim = false;
  const btn = document.getElementById('simBtn');
  if (btn) {
    btn.textContent = '⏵ Run AI Simulation';
    btn.style.background = '';
    btn.setAttribute('aria-pressed', 'false');
  }
  // Reset zone counts to original
  ZONES[0].count = 12400; ZONES[1].count = 9800; ZONES[2].count = 11200;
  ZONES[3].count = 7600;  ZONES[4].count = 3200; ZONES[5].count = 1980;
  renderZoneCards();
  drawCrowdMap();
}


/**
 * Draws the staff response time bar chart on #responseChart.
 * Bars show average response time per team type in minutes.
 */
function drawResponseChart() {
  const canvas = document.getElementById('responseChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const data = [
    { label:'Security', val:2.4, color:'#7c3aed' },
    { label:'Medical', val:3.8, color:'#06b6d4' },
    { label:'Volunteer', val:5.2, color:'#10b981' },
    { label:'Ops', val:4.1, color:'#f97316' },
    { label:'Info', val:1.9, color:'#eab308' },
  ];
  drawBarChart(ctx, W, H, data.map(d => ({ ...d, val: d.val * 20 })));

  // Override labels with minutes
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.font = '8px Inter'; ctx.textAlign = 'center';
  const padL=10, padR=10, chartW=W-padL-padR;
  const gap = chartW / data.length;
  const barW = gap * .6;
  data.forEach((d, i) => {
    const x = padL + i * gap + (gap - barW) / 2;
    ctx.fillText(d.val + 'min', x + barW/2, H-35);
  });
}

/**
 * Draws the zone coverage percentage bar chart on #coverageChart.
 * Green/amber/red bars reflect security coverage levels per zone.
 */
function drawCoverageChart() {
  const canvas = document.getElementById('coverageChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const zones = [
    { name:'Zone A', pct:95, color:'#22c55e' },
    { name:'Zone B', pct:88, color:'#22c55e' },
    { name:'Zone C', pct:72, color:'#eab308' },
    { name:'Zone D', pct:91, color:'#22c55e' },
    { name:'Zone E', pct:60, color:'#f97316' },
    { name:'Zone F', pct:45, color:'#ef4444' },
  ];
  drawBarChart(ctx, W, H, zones.map(z => ({ ...z, val: z.pct, label: z.name })));
}

/**
 * Renders the AI skill-match progress bars from skills data into #skillMatch.
 * Shows volunteer competency coverage across key operational skill areas.
 */
function renderSkillMatch() {
  const el = document.getElementById('skillMatch');
  if (!el) return;
  const skills = [
    { label:'First Aid', pct:92, color:'#ef4444' },
    { label:'Languages', pct:78, color:'#7c3aed' },
    { label:'Navigation', pct:88, color:'#06b6d4' },
    { label:'Crowd Ctrl', pct:71, color:'#f97316' },
    { label:'Technical', pct:85, color:'#10b981' },
  ];
  el.innerHTML = skills.map(s => `
    <div class="skill-row">
      <span class="skill-label">${s.label}</span>
      <div class="skill-bar-bg"><div class="skill-bar-fill" style="width:${s.pct}%;background:${s.color}"></div></div>
      <span class="skill-pct" style="color:${s.color}">${s.pct}%</span>
    </div>
  `).join('');
}

/**
 * Runs AI staff optimisation: rebalances volunteer and security deployment
 * across zones and re-renders the task list and staff canvas.
 */
function optimizeStaff() {
  if (typeof addCommandMessage === 'function') {
    addCommandMessage('ai', '✨ AI staff optimization complete. Redeploying 12 volunteers to Zone F, 3 security to Gate 5 area. Coverage improved by 18%.');
  }
  renderTaskList();
  drawStaffCanvas();
}

// ─── Auto-refresh Dashboard ────────────────────────────────────────────────────
setInterval(() => {
  if (STATE.currentSection === 'dashboard') {
    drawHeatmap();
  }
}, 8000);

// ─── Scroll Effect ────────────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (navbar) {
    navbar.style.background = window.scrollY > 20 ? 'rgba(6,11,23,.95)' : 'rgba(6,11,23,.85)';
  }
});
