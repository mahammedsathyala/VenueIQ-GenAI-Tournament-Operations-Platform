/* ══════════════════════════════════════════════════════════════
   VenueIQ — GenAI Tournament Operations Platform
   Full Application Logic
   ══════════════════════════════════════════════════════════════ */

'use strict';

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

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initHeroCanvas();
  animateCounters();
  setInterval(animateCounters, 30000);
});

// ─── Navigation ───────────────────────────────────────────────────────────────
function showSection(name, linkEl) {
  // Hide hero
  document.getElementById('hero-section').style.display = 'none';
  const main = document.getElementById('app-main');
  main.style.display = 'block';

  // Deactivate all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  // Activate selected
  const sec = document.getElementById(`section-${name}`);
  if (sec) sec.classList.add('active');
  if (linkEl) linkEl.classList.add('active');

  if (STATE.currentSection !== name) {
    STATE.currentSection = name;
    initSection(name);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

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

// ─── Hero Canvas ──────────────────────────────────────────────────────────────
function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const particles = Array.from({length: 60}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - .5) * .5,
    vy: (Math.random() - .5) * .5,
    r: Math.random() * 2 + .5,
    alpha: Math.random() * .5 + .1,
    color: Math.random() > .5 ? '#7c3aed' : '#06b6d4',
  }));

  function drawFrame() {
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
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(124,58,237,${.15 * (1 - dist/120)})`;
          ctx.lineWidth = .5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(drawFrame);
  }
  drawFrame();
}

function animateCounters() {
  document.querySelectorAll('.stat-num').forEach(el => {
    const target = parseInt(el.dataset.target);
    let current = 0;
    const step = target / 40;
    const interval = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = Math.round(current);
      if (current >= target) clearInterval(interval);
    }, 30);
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function initDashboard() {
  renderAlertStream();
  renderInsights();
  drawHeatmap();
  drawZoneChart();
  startKPIUpdates();
}

function renderAlertStream() {
  const el = document.getElementById('alertStream');
  if (!el) return;
  el.innerHTML = ALERTS.map(a => `
    <div class="alert-item ${a.type}">
      <span>${a.icon}</span>
      <span>${a.msg}</span>
      <span class="alert-time">${a.time}</span>
    </div>
  `).join('');
}

function renderInsights() {
  const el = document.getElementById('insightsList');
  if (!el) return;
  el.innerHTML = INSIGHTS.map(i => `
    <div class="insight-item">
      <div class="insight-tag">${i.tag}</div>
      <div>${i.text}</div>
    </div>
  `).join('');
}

function drawHeatmap() {
  const canvas = document.getElementById('heatmapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Stadium shape
  ctx.fillStyle = 'rgba(13,22,38,0.95)';
  ctx.fillRect(0, 0, W, H);

  // Draw stadium outline
  ctx.strokeStyle = 'rgba(99,120,180,.3)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(20, 20, W-40, H-40);

  // Field
  ctx.fillStyle = 'rgba(5,46,22,.5)';
  ctx.fillRect(W*0.25, H*0.2, W*0.5, H*0.6);
  ctx.strokeStyle = 'rgba(34,197,94,.2)';
  ctx.strokeRect(W*0.25, H*0.2, W*0.5, H*0.6);

  // Center circle
  ctx.beginPath();
  ctx.arc(W/2, H/2, 40, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(34,197,94,.2)';
  ctx.stroke();

  // Heatmap zones
  const zones = [
    { x:0.05, y:0.1,  w:.18, h:.8, density:.88, color:[249,115,22] },
    { x:0.77, y:0.1,  w:.18, h:.8, density:.72, color:[234,179,8]  },
    { x:0.24, y:0.03, w:.52, h:.14, density:.95, color:[239,68,68]  },
    { x:0.24, y:0.83, w:.52, h:.14, density:.65, color:[34,197,94]  },
    { x:0.05, y:0.38, w:.18, h:.24, density:.45, color:[34,197,94]  },
    { x:0.77, y:0.38, w:.18, h:.24, density:.55, color:[234,179,8]  },
  ];

  zones.forEach(z => {
    const x = z.x * W, y = z.y * H;
    const w = z.w * W, h = z.h * H;
    const grad = ctx.createRadialGradient(x+w/2, y+h/2, 0, x+w/2, y+h/2, Math.max(w,h)/2);
    const [r,g,b] = z.color;
    grad.addColorStop(0, `rgba(${r},${g},${b},${z.density * .7})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Label
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(z.density*100)}%`, x+w/2, y+h/2+4);
  });

  // Zone labels
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.font = '10px Inter';
  ctx.fillText('NORTH STAND', W/2, 35);
  ctx.fillText('SOUTH STAND', W/2, H-30);
  ctx.save(); ctx.translate(32, H/2); ctx.rotate(-Math.PI/2);
  ctx.fillText('WEST', 0, 0); ctx.restore();
  ctx.save(); ctx.translate(W-32, H/2); ctx.rotate(Math.PI/2);
  ctx.fillText('EAST', 0, 0); ctx.restore();
}

function drawZoneChart() {
  const canvas = document.getElementById('zoneChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const labels = ZONES.map(z => z.name.split('—')[0].trim());
  const values = ZONES.map(z => Math.round((z.count/z.cap)*100));
  const colors = ZONES.map(z => z.color);
  const barH = 30;
  const spacing = 12;
  const startY = 20;
  const maxBarW = W - 110;

  values.forEach((v, i) => {
    const y = startY + i * (barH + spacing);
    // Label
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(labels[i], 82, y + barH/2 + 4);
    // Background bar
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    roundRect(ctx, 88, y, maxBarW, barH, 4);
    ctx.fill();
    // Value bar
    const barW = (v / 100) * maxBarW;
    const grad = ctx.createLinearGradient(88, 0, 88 + barW, 0);
    grad.addColorStop(0, colors[i] + 'cc');
    grad.addColorStop(1, colors[i] + '55');
    ctx.fillStyle = grad;
    roundRect(ctx, 88, y, barW, barH, 4);
    ctx.fill();
    // Percentage
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.textAlign = 'left';
    ctx.font = 'bold 10px Inter';
    ctx.fillText(`${v}%`, 88 + barW + 4, y + barH/2 + 4);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function startKPIUpdates() {
  setInterval(() => {
    const crowdEl = document.getElementById('kpi-crowd-val');
    if (crowdEl) {
      const v = 47000 + Math.floor(Math.random() * 600);
      crowdEl.textContent = v.toLocaleString();
    }
    const navEl = document.getElementById('kpi-nav-val');
    if (navEl) {
      const v = 8000 + Math.floor(Math.random() * 500);
      navEl.textContent = v.toLocaleString();
    }
    const assistEl = document.getElementById('kpi-assist-val');
    if (assistEl) {
      const v = 23000 + Math.floor(Math.random() * 1000);
      assistEl.textContent = v.toLocaleString();
    }
    const lu = document.getElementById('lastUpdated');
    if (lu) lu.textContent = 'just now';
  }, 5000);
}

function refreshDashboard() {
  drawHeatmap();
  drawZoneChart();
  renderAlertStream();
}

// ─── Crowd Management ─────────────────────────────────────────────────────────
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

function renderZoneCards() {
  const el = document.getElementById('zoneCards');
  if (!el) return;
  el.innerHTML = ZONES.map(z => {
    const pct = Math.round((z.count / z.cap) * 100);
    return `
      <div class="zone-card">
        <div class="zone-name">${z.name}</div>
        <div class="zone-count" style="color:${z.color}">${z.count.toLocaleString()}</div>
        <div class="zone-bar-wrap">
          <div class="zone-bar" style="width:${pct}%;background:${z.color}"></div>
        </div>
        <div style="font-size:.7rem;color:var(--c-text-muted);margin-top:.2rem">${pct}% full</div>
      </div>
    `;
  }).join('');
}

function drawCrowdMap() {
  const canvas = document.getElementById('crowdMapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(0, 0, W, H);

  // Stadium outline
  ctx.strokeStyle = 'rgba(99,120,180,.25)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 20, 20, W-40, H-40, 12);
  ctx.stroke();

  // Playing field
  ctx.fillStyle = 'rgba(5,46,22,.6)';
  roundRect(ctx, W*.22, H*.18, W*.56, H*.64, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(34,197,94,.25)';
  ctx.stroke();

  // Center line
  ctx.beginPath();
  ctx.moveTo(W/2, H*.18);
  ctx.lineTo(W/2, H*.82);
  ctx.strokeStyle = 'rgba(34,197,94,.15)';
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(W/2, H/2, 45, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(34,197,94,.2)';
  ctx.stroke();

  // Crowd density overlays
  const crowdZones = [
    { label:'N', x:.22, y:.04, w:.56, h:.13, density:.95 },
    { label:'S', x:.22, y:.83, w:.56, h:.13, density:.65 },
    { label:'W', x:.03, y:.18, w:.18, h:.64, density:.88 },
    { label:'E', x:.79, y:.18, w:.18, h:.64, density:.72 },
    { label:'NW', x:.03, y:.04, w:.17, h:.13, density:.5 },
    { label:'NE', x:.8,  y:.04, w:.17, h:.13, density:.6 },
    { label:'SW', x:.03, y:.83, w:.17, h:.13, density:.4 },
    { label:'SE', x:.8,  y:.83, w:.17, h:.13, density:.45 },
  ];

  crowdZones.forEach(z => {
    const x = z.x * W, y = z.y * H, w = z.w * W, h = z.h * H;
    const d = z.density;
    let r, g, b;
    if (d > .9)      { r=239; g=68;  b=68;  }
    else if (d > .7) { r=249; g=115; b=22;  }
    else if (d > .5) { r=234; g=179; b=8;   }
    else             { r=34;  g=197; b=94;  }

    const grad = ctx.createRadialGradient(x+w/2, y+h/2, 0, x+w/2, y+h/2, Math.max(w,h)/1.5);
    grad.addColorStop(0, `rgba(${r},${g},${b},${d*.65})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0.05)`);
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, w, h, 4);
    ctx.fill();

    // Label
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(d*100)}%`, x+w/2, y+h/2+4);
  });

  // Animated flow arrows (static for now)
  const arrows = [
    { x: W*.11, y: H*.5, dir: 0 },
    { x: W*.89, y: H*.5, dir: Math.PI },
    { x: W*.5,  y: H*.1, dir: Math.PI/2 },
    { x: W*.5,  y: H*.9, dir: -Math.PI/2 },
  ];
  arrows.forEach(a => {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.dir);
    ctx.fillStyle = 'rgba(6,182,212,.7)';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(8, 8); ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function drawForecastChart() {
  const canvas = document.getElementById('forecastChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const hours = ['Now', '+15m', '+30m', '+45m', '+1h', '+1.5h', '+2h'];
  const values = [94, 96, 98, 95, 89, 85, 80];
  const maxV = 100;
  const padL = 30, padR = 10, padT = 15, padB = 25;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  // Grid lines
  [80, 85, 90, 95, 100].forEach(v => {
    const y = padT + chartH - ((v - 70) / 30) * chartH;
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.font = '9px Inter'; ctx.textAlign = 'right';
    ctx.fillText(v + '%', padL - 3, y + 3);
  });

  // Line
  const points = values.map((v, i) => ({
    x: padL + (i / (hours.length - 1)) * chartW,
    y: padT + chartH - ((v - 70) / 30) * chartH,
  }));

  // Fill
  const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0, 'rgba(124,58,237,.3)');
  grad.addColorStop(1, 'rgba(124,58,237,.0)');
  ctx.beginPath();
  ctx.moveTo(points[0].x, padT + chartH);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length-1].x, padT + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Threshold line
  const threshY = padT + chartH - ((95 - 70) / 30) * chartH;
  ctx.setLineDash([5, 3]);
  ctx.strokeStyle = 'rgba(239,68,68,.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, threshY); ctx.lineTo(W - padR, threshY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(239,68,68,.7)';
  ctx.font = '8px Inter'; ctx.textAlign = 'right';
  ctx.fillText('Critical', W - padR, threshY - 3);

  // Dots + labels
  points.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
    ctx.fillStyle = values[i] >= 95 ? '#ef4444' : '#7c3aed';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font = '8px Inter'; ctx.textAlign = 'center';
    ctx.fillText(hours[i], p.x, padT + chartH + 14);
  });
}

function renderRoutingList() {
  const el = document.getElementById('routingList');
  if (!el) return;
  const routings = [
    '🔀 Redirect Gate 7 traffic → Gates 4 & 6',
    '📢 PA redirect announcement — Zone F fans',
    '🟢 Open auxiliary Gate 5A for extra flow',
    '🚶 Activate Concourse B alternate path',
  ];
  el.innerHTML = routings.map(r => `<div class="routing-item"><span>${r}</span></div>`).join('');
}

function renderPredAlerts() {
  const el = document.getElementById('predAlerts');
  if (!el) return;
  const alerts = [
    { type:'critical', msg:'⚠️ Zone F will reach 100% in ~12 mins' },
    { type:'warning', msg:'🔶 Halftime food surge expected at 14:30' },
    { type:'info', msg:'ℹ️ Exit flow peak predicted at 16:35' },
  ];
  el.innerHTML = alerts.map(a => `
    <div class="pred-alert" style="background:rgba(${a.type==='critical'?'239,68,68':a.type==='warning'?'249,115,22':'6,182,212'},.08);border:1px solid rgba(${a.type==='critical'?'239,68,68':a.type==='warning'?'249,115,22':'6,182,212'},.2);border-radius:6px">
      ${a.msg}
    </div>
  `).join('');
}

function drawFlowChart() {
  const canvas = document.getElementById('flowChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const labels = ['10:00','11:00','12:00','13:00','14:00','15:00'];
  const entryData = [380, 520, 440, 310, 280, 220];
  const exitData  = [40, 80, 120, 200, 160, 340];
  drawLineChart(ctx, W, H, labels, [
    { data: entryData, color: '#22c55e', label: 'Entry' },
    { data: exitData,  color: '#ef4444', label: 'Exit'  },
  ]);
}

function drawDwellChart() {
  const canvas = document.getElementById('dwellChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const data = [
    { label:'Field',    val:185, color:'#7c3aed' },
    { label:'Food Ct',  val:24,  color:'#f97316' },
    { label:'Toilets',  val:8,   color:'#06b6d4' },
    { label:'Merch',    val:18,  color:'#eab308' },
    { label:'Concourse',val:32,  color:'#22c55e' },
  ];
  drawBarChart(ctx, W, H, data);
}

function drawLineChart(ctx, W, H, labels, datasets) {
  const padL=35, padR=10, padT=10, padB=25;
  const chartW = W-padL-padR, chartH = H-padT-padB;
  const maxVal = Math.max(...datasets.flatMap(d => d.data)) * 1.1;

  // Grid
  [0,.25,.5,.75,1].forEach(t => {
    const y = padT + chartH * (1-t);
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-padR, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.font = '8px Inter'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal*t), padL-3, y+3);
  });

  // Labels
  labels.forEach((l, i) => {
    const x = padL + (i/(labels.length-1)) * chartW;
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.font = '8px Inter'; ctx.textAlign = 'center';
    ctx.fillText(l, x, H-8);
  });

  // Lines
  datasets.forEach(ds => {
    const pts = ds.data.map((v, i) => ({
      x: padL + (i/(labels.length-1)) * chartW,
      y: padT + chartH - (v/maxVal) * chartH,
    }));
    ctx.beginPath();
    pts.forEach((p, i) => i===0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = ds.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
      ctx.fillStyle = ds.color; ctx.fill();
    });
  });
}

function drawBarChart(ctx, W, H, data) {
  const padL=10, padR=10, padT=10, padB=30;
  const chartW = W-padL-padR, chartH = H-padT-padB;
  const maxVal = Math.max(...data.map(d => d.val)) * 1.15;
  const barW = chartW / data.length * .6;
  const gap   = chartW / data.length;

  data.forEach((d, i) => {
    const x = padL + i * gap + (gap - barW) / 2;
    const bH = (d.val / maxVal) * chartH;
    const y = padT + chartH - bH;

    const grad = ctx.createLinearGradient(0, y, 0, y+bH);
    grad.addColorStop(0, d.color + 'cc');
    grad.addColorStop(1, d.color + '33');
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, barW, bH, 3);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.font = 'bold 9px Inter'; ctx.textAlign = 'center';
    ctx.fillText(d.val + 'm', x + barW/2, y - 4);
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.font = '8px Inter';
    ctx.fillText(d.label, x + barW/2, H - 10);
  });
}

function renderGateUtil() {
  const el = document.getElementById('gateUtil');
  if (!el) return;
  const gates = [
    { name:'Gate 1', util:45, color:'#22c55e' },
    { name:'Gate 2', util:72, color:'#eab308' },
    { name:'Gate 3', util:88, color:'#f97316' },
    { name:'Gate 4', util:56, color:'#22c55e' },
    { name:'Gate 5', util:95, color:'#ef4444' },
    { name:'Gate 6', util:40, color:'#22c55e' },
  ];
  el.innerHTML = gates.map(g => `
    <div class="gate-row">
      <div class="gate-info"><strong>${g.name}</strong><span>${g.util}% utilized</span></div>
      <div class="gate-bar-bg"><div class="gate-bar-fill" style="width:${g.util}%;background:${g.color}"></div></div>
    </div>
  `).join('');
}

function toggleCrowdSim() {
  const btn = document.getElementById('simBtn');
  STATE.crowdSim = !STATE.crowdSim;
  if (STATE.crowdSim) {
    btn.textContent = '⏸ Stop Simulation';
    btn.style.background = 'linear-gradient(135deg,#ef4444,#b91c1c)';
    STATE.simInterval = setInterval(() => {
      ZONES.forEach(z => {
        z.count = Math.max(0, Math.min(z.cap, z.count + (Math.random() - .4) * 200));
      });
      renderZoneCards();
      drawCrowdMap();
      drawForecastChart();
    }, 1500);
  } else {
    btn.textContent = '⏵ Run AI Simulation';
    btn.style.background = '';
    clearInterval(STATE.simInterval);
  }
}

function resetCrowdMap() {
  STATE.crowdSim = false;
  clearInterval(STATE.simInterval);
  document.getElementById('simBtn').textContent = '⏵ Run AI Simulation';
  document.getElementById('simBtn').style.background = '';
  ZONES[0].count = 12400; ZONES[1].count = 9800;
  ZONES[2].count = 11200; ZONES[3].count = 7600;
  ZONES[4].count = 3200;  ZONES[5].count = 1980;
  renderZoneCards(); drawCrowdMap();
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function initNavigation() {
  drawNavCanvas();
  renderSteps();
  renderPOIs();
}

function drawNavCanvas() {
  const canvas = document.getElementById('navCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#090f1e';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(99,120,180,.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Venue walls
  const walls = [
    [20, 20, W-40, H-40],  // outer boundary
    [W*.2, H*.1, W*.6, H*.8], // inner courtyard
  ];
  ctx.strokeStyle = 'rgba(99,120,180,.35)';
  ctx.lineWidth = 2;
  walls.forEach(([x,y,w,h]) => {
    roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();
  });

  // Corridors
  ctx.fillStyle = 'rgba(30,50,90,.6)';
  const corridors = [
    [20, 20, W-40, 80],         // N corridor
    [20, H-100, W-40, 80],      // S corridor
    [20, 20, 80, H-40],         // W corridor
    [W-100, 20, 80, H-40],      // E corridor
  ];
  corridors.forEach(([x,y,w,h]) => {
    roundRect(ctx, x, y, w, h, 4);
    ctx.fill();
  });

  // POI Icons
  const pois = [
    { x:120, y:50,  icon:'🍔', label:'Food Court C' },
    { x:W/2, y:50,  icon:'🚻', label:'Restroom' },
    { x:W-80, y:60,  icon:'🏥', label:'Medical' },
    { x:100, y:H-60, icon:'🅰️', label:'ATM' },
    { x:W/2, y:H-60, icon:'🛍️', label:'Merch' },
    { x:W-80, y:H/2, icon:'☕', label:'Café' },
    { x:35, y:H/2,  icon:'ℹ️', label:'Info' },
  ];
  pois.forEach(p => {
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.icon, p.x, p.y + 6);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.font = '8px Inter';
    ctx.fillText(p.label, p.x, p.y + 18);
    ctx.fillStyle = 'white';
  });

  // Route based on destination
  const dest = STATE.navDest;
  const routeColors = { seat:'#7c3aed', food:'#f97316', toilet:'#06b6d4', medical:'#ef4444', exit:'#22c55e', parking:'#eab308' };
  const color = routeColors[dest] || '#7c3aed';

  // Route path (simplified)
  const routes = {
    seat:    [[100, H-30], [100, H*.55], [W*.35, H*.55], [W*.35, H*.3], [W*.5, H*.3]],
    food:    [[100, H-30], [100, H*.5], [120, H*.5]],
    toilet:  [[100, H-30], [100, H*.5], [W/2, H*.5], [W/2, 55]],
    medical: [[100, H-30], [W-80, H-30], [W-80, H/2]],
    exit:    [[100, H-30], [100, H-80], [40, H-80]],
    parking: [[100, H-30], [100, H*.2], [W*.3, H*.2]],
  };
  const route = routes[dest] || routes.seat;

  // Animated glow path
  const drawRouteLine = (alpha) => {
    ctx.beginPath();
    route.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = alpha;
    ctx.setLineDash([8, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  };

  // Glow
  ctx.shadowBlur = 12;
  ctx.shadowColor = color;
  drawRouteLine(.8);
  ctx.shadowBlur = 0;
  drawRouteLine(.4);

  // Waypoints
  route.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p[0], p[1], i === 0 ? 8 : 5, 0, Math.PI*2);
    ctx.fillStyle = i === 0 ? '#22c55e' : color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p[0], p[1], i === 0 ? 14 : 9, 0, Math.PI*2);
    ctx.strokeStyle = i === 0 ? 'rgba(34,197,94,.4)' : color + '44';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Current location label
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 10px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('📍 You', route[0][0], route[0][1] - 18);

  // Destination label
  const last = route[route.length - 1];
  ctx.fillStyle = 'white';
  ctx.fillText('🎯 Dest', last[0], last[1] - 18);
}

function updateNavRoute() {
  const sel = document.getElementById('navDest');
  STATE.navDest = sel.value.split('— ')[0].trim().toLowerCase();
  if (STATE.navDest.includes('seat')) STATE.navDest = 'seat';
  else if (STATE.navDest.includes('food')) STATE.navDest = 'food';
  else if (STATE.navDest.includes('rest')) STATE.navDest = 'toilet';
  else if (STATE.navDest.includes('medical')) STATE.navDest = 'medical';
  else if (STATE.navDest.includes('exit')) STATE.navDest = 'exit';
  else if (STATE.navDest.includes('park')) STATE.navDest = 'parking';

  const dest = document.getElementById('navDest').value;
  if (dest.includes('Seat')) STATE.navDest = 'seat';
  else if (dest.includes('Food')) STATE.navDest = 'food';
  else if (dest.includes('Rest')) STATE.navDest = 'toilet';
  else if (dest.includes('Medical')) STATE.navDest = 'medical';
  else if (dest.includes('Exit')) STATE.navDest = 'exit';
  else if (dest.includes('Parking')) STATE.navDest = 'parking';

  drawNavCanvas();
  renderSteps();

  const info = {
    seat: '3 min walk · 220m · ♿ Accessible route',
    food: '1 min walk · 75m · 4-min wait',
    toilet: '1 min walk · 45m · ♿ Accessible',
    medical: '2 min walk · 120m · 24/7 available',
    exit: '2 min walk · 100m · Low traffic',
    parking: '4 min walk + lift · VIP area',
  };
  const overlay = document.getElementById('navOverlayInfo');
  if (overlay) {
    const dist = info[STATE.navDest] || '3 min · 200m';
    overlay.innerHTML = `<div class="nav-route-info"><span class="route-dist">📍 Est. ${dist}</span></div>`;
  }
}

function renderSteps() {
  const dest = STATE.navDest;
  const steps = NAV_STEPS[dest] || NAV_STEPS.seat;
  const el = document.getElementById('stepsList');
  if (!el) return;
  el.innerHTML = steps.map((s, i) => `
    <div class="step-item">
      <div class="step-num">${i + 1}</div>
      <div>
        <div class="step-text">${s.step}</div>
        <div class="step-dist">${s.dist}</div>
      </div>
    </div>
  `).join('');
}

function renderPOIs() {
  const el = document.getElementById('poiGrid');
  if (!el) return;
  el.innerHTML = POIS.map(p => `
    <div class="poi-item" onclick="setNavDest('${p.name}')">
      <span class="poi-emoji">${p.emoji}</span>
      <div class="poi-name">${p.name}</div>
      <div class="poi-dist">${p.dist}</div>
    </div>
  `).join('');
}

function setNavMode(mode, el) {
  STATE.navMode = mode;
  document.querySelectorAll('.nav-mode-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  drawNavCanvas();
}

function launchAR() {
  document.getElementById('arModal').style.display = 'flex';
}
function closeAR() {
  document.getElementById('arModal').style.display = 'none';
}

// ─── Decisions ────────────────────────────────────────────────────────────────
function initDecisions() {
  renderIncidents();
  renderRecommendations();
  renderResources();
  renderTimeline();
  addInitialCommandMessages();
}

function renderIncidents(filter = 'all') {
  const el = document.getElementById('incidentList');
  if (!el) return;
  const filtered = filter === 'all' ? INCIDENTS : INCIDENTS.filter(i => i.sev === filter);
  el.innerHTML = filtered.map(inc => `
    <div class="incident-item ${inc.sev}" data-sev="${inc.sev}">
      <div class="inc-header">
        <span class="inc-badge ${inc.sev}">${inc.sev.toUpperCase()}</span>
        <span class="inc-title">${inc.title}</span>
        <span class="inc-time">${inc.time}</span>
      </div>
      <div class="inc-desc">${inc.desc}</div>
      <div class="inc-actions">
        <button class="inc-btn" onclick="resolveIncident(${inc.id})">✓ Acknowledge</button>
        <button class="inc-btn" onclick="dispatchToIncident(${inc.id})">🚀 Dispatch</button>
        <button class="inc-btn" onclick="aiAnalyzeIncident(${inc.id})">🤖 AI Analyze</button>
      </div>
    </div>
  `).join('');
}

function filterIncidents(filter, el) {
  document.querySelectorAll('.incident-filter').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderIncidents(filter);
}

function resolveIncident(id) {
  const idx = INCIDENTS.findIndex(i => i.id === id);
  if (idx > -1) {
    INCIDENTS[idx].sev = 'low';
    INCIDENTS[idx].title += ' — RESOLVED';
    renderIncidents();
  }
}

function dispatchToIncident(id) {
  addCommandMessage('ai', `🚀 Dispatching resources for Incident #${id}. Nearest available team assigned. ETA: 3 minutes. Tracking activated.`);
}

function aiAnalyzeIncident(id) {
  const inc = INCIDENTS.find(i => i.id === id);
  addCommandMessage('ai', `🤖 AI Analysis for "${inc?.title}": Based on historical patterns and current venue data, recommend immediate crowd redistribution. Probability of escalation: ${Math.floor(Math.random()*30+15)}%. Suggested response: Protocol ${Math.floor(Math.random()*5+1)} — ${['Delta','Alpha','Sigma','Bravo','Omega'][Math.floor(Math.random()*5)]}.`);
}

function renderRecommendations() {
  const el = document.getElementById('recommendList');
  if (!el) return;
  el.innerHTML = RECOMMENDATIONS.map(r => `
    <div class="recommend-item">
      <span class="rec-icon">${r.icon}</span>
      <div class="rec-body">
        <div class="rec-label">${r.label}</div>
        <div class="rec-text">${r.text}</div>
      </div>
    </div>
  `).join('');
}

function renderResources() {
  const el = document.getElementById('resourceGrid');
  if (!el) return;
  el.innerHTML = RESOURCES.map((r, i) => `
    <div class="resource-item" onclick="deployResource(${i})">
      <span class="res-icon">${r.icon}</span>
      <div class="res-data">
        <div class="res-name">${r.name}</div>
        <div class="res-status">${r.status}</div>
      </div>
      <span class="res-deploy" id="res-badge-${i}">${r.deployed ? '🟢 Active' : '📤 Deploy'}</span>
    </div>
  `).join('');
}

function deployResource(idx) {
  RESOURCES[idx].deployed = !RESOURCES[idx].deployed;
  const badge = document.getElementById(`res-badge-${idx}`);
  if (badge) badge.textContent = RESOURCES[idx].deployed ? '🟢 Active' : '📤 Deploy';
  addCommandMessage('ai', `${RESOURCES[idx].deployed ? '🚀 Deploying' : '🔄 Recalling'} ${RESOURCES[idx].name} — status updated in real-time operations board.`);
}

function renderTimeline() {
  const el = document.getElementById('timeline');
  if (!el) return;
  const now = new Date();
  const nowH = now.getHours();
  el.innerHTML = TIMELINE.map(t => {
    const h = parseInt(t.time.split(':')[0]);
    const past = h < nowH;
    const current = h === nowH;
    return `
      <div class="timeline-item">
        <div class="tl-dot" style="background:${past?'rgba(255,255,255,.2)':t.color};${current?'box-shadow:0 0 12px '+t.color:''}">${past?'✓':current?'▶':''}</div>
        <div class="tl-content">
          <div class="tl-time">${t.time}</div>
          <div class="tl-event" style="color:${current?t.color:'var(--c-text)'}">${t.event}</div>
          <div class="tl-note">${t.note}</div>
        </div>
      </div>
    `;
  }).join('');
}

function addInitialCommandMessages() {
  const msgs = [
    { type:'ai', text:'🤖 AI Command Center online. Monitoring 48,000+ data points. All systems nominal.' },
    { type:'ai', text:'⚠️ Zone F density at 98% — recommending immediate crowd redistribution.' },
  ];
  msgs.forEach(m => addCommandMessage(m.type, m.text));
}

function addCommandMessage(type, text) {
  const el = document.getElementById('commandMessages');
  if (!el) return;
  const div = document.createElement('div');
  div.className = `cmd-msg ${type}`;
  div.textContent = text;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function sendCommandQuery() {
  const input = document.getElementById('commandInput');
  const text = input.value.trim();
  if (!text) return;
  addCommandMessage('user', text);
  input.value = '';
  setTimeout(() => {
    const responses = [
      '🤖 Processing your command. AI analysis complete — deploying resources to high-priority zones.',
      '📊 Current status: 2 active incidents, 94% venue capacity, all emergency systems operational.',
      '🔄 AI recommends rerouting 2,000 fans to reduce Zone F density. Broadcast initiated.',
      '✅ Command acknowledged. Dispatching team and updating operational dashboard.',
    ];
    addCommandMessage('ai', responses[Math.floor(Math.random() * responses.length)]);
  }, 800);
}

function addEmergencyAlert() {
  const newInc = {
    id: INCIDENTS.length + 1,
    sev: 'critical',
    title: `🚨 EMERGENCY — Gate ${Math.floor(Math.random()*8+1)} Evacuation`,
    time: new Date().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}),
    desc: 'AI detected anomalous crowd surge. Immediate evacuation protocol may be required. All available units on standby.',
    status: 'active',
  };
  INCIDENTS.unshift(newInc);
  renderIncidents();
  addCommandMessage('ai', `🚨 EMERGENCY ALERT: ${newInc.title} — All protocols initiated. Command center notified.`);
}

function clearAlerts() {
  const el = document.getElementById('incidentList');
  if (el) el.innerHTML = '<div style="text-align:center;color:var(--c-text-muted);padding:2rem;font-size:.85rem;">No active alerts</div>';
}

// ─── AI Assistant ─────────────────────────────────────────────────────────────
function initAssistant() {
  renderPersonaPrompts();
  renderLangBars();
  renderLangChips();
  initChat();
}

function initChat() {
  const msgs = document.getElementById('chatMessages');
  if (!msgs || msgs.children.length > 0) return;
  addBotMessage(AI_RESPONSES[STATE.currentPersona].greet, 'en');
}

function selectPersona(persona, el) {
  STATE.currentPersona = persona;
  document.querySelectorAll('.persona-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderPersonaPrompts();
  // Add greeting in new persona mode
  setTimeout(() => {
    addBotMessage(AI_RESPONSES[persona].greet, 'en');
  }, 300);
}

function renderPersonaPrompts() {
  const el = document.getElementById('promptChips');
  if (!el) return;
  const prompts = QUICK_PROMPTS[STATE.currentPersona] || QUICK_PROMPTS.fan;
  el.innerHTML = prompts.map(p => `
    <button class="prompt-chip" onclick="sendPrompt('${p.replace(/'/g,"\\'")}')">💬 ${p}</button>
  `).join('');
}

function renderLangBars() {
  const el = document.getElementById('langBars');
  if (!el) return;
  el.innerHTML = LANG_STATS.map(l => `
    <div class="lang-bar-item">
      <div class="lb-info"><span class="lb-name">${l.name}</span><span class="lb-pct">${l.pct}%</span></div>
      <div class="lb-track"><div class="lb-fill" style="width:${l.pct}%;background:${l.color}"></div></div>
    </div>
  `).join('');
}

function renderLangChips() {
  const el = document.getElementById('langChips');
  if (!el) return;
  el.innerHTML = SUPPORTED_LANGS.map(l => `<div class="lang-chip">${l}</div>`).join('');
}

function sendPrompt(text) {
  document.getElementById('chatInput').value = text;
  sendMessage();
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const langSel = document.getElementById('chatLang');
  const text = input.value.trim();
  if (!text) return;
  const lang = langSel ? langSel.value : 'en';

  addUserMessage(text, lang);
  input.value = '';

  // Show typing
  const typingEl = document.getElementById('typingIndicator');
  if (typingEl) typingEl.style.display = 'flex';

  setTimeout(() => {
    if (typingEl) typingEl.style.display = 'none';
    const response = getAIResponse(text, STATE.currentPersona, lang);
    addBotMessage(response, lang);
  }, 1000 + Math.random() * 800);
}

function getAIResponse(text, persona, lang) {
  const lowerText = text.toLowerCase();
  const responses = AI_RESPONSES[persona] || AI_RESPONSES.fan;

  let response = responses.greet;

  if (lowerText.includes('seat') || lowerText.includes('block') || lowerText.includes('row')) {
    response = responses.seat || responses.greet;
  } else if (lowerText.includes('food') || lowerText.includes('eat') || lowerText.includes('hungry') || lowerText.includes('restaurant')) {
    response = responses.food || responses.greet;
  } else if (lowerText.includes('toilet') || lowerText.includes('restroom') || lowerText.includes('washroom') || lowerText.includes('bathroom')) {
    response = responses.toilet || responses.greet;
  } else if (lowerText.includes('crowd') || lowerText.includes('busy') || lowerText.includes('crowd') || lowerText.includes('capacity')) {
    response = responses.crowd || responses.greet;
  } else if (lowerText.includes('exit') || lowerText.includes('leave') || lowerText.includes('go home')) {
    response = responses.exit || responses.greet;
  } else if (lowerText.includes('incident') || lowerText.includes('emergency') || lowerText.includes('alert')) {
    response = responses.incident || responses.greet;
  } else if (lowerText.includes('patrol') || lowerText.includes('security')) {
    response = responses.patrol || responses.greet;
  } else if (lowerText.includes('protocol') || lowerText.includes('procedure')) {
    response = responses.protocol || responses.greet;
  } else if (lowerText.includes('shift') || lowerText.includes('schedule')) {
    response = responses.shift || responses.greet;
  } else if (lowerText.includes('summary') || lowerText.includes('report')) {
    response = responses.summary || responses.greet;
  } else if (lowerText.includes('predict') || lowerText.includes('forecast')) {
    response = responses.prediction || responses.greet;
  }

  // Translate response if needed (simulated)
  if (lang !== 'en' && TRANSLATIONS[lang]) {
    // In a real system, this would call a translation API
    return response + `\n\n_[Translated to ${lang.toUpperCase()}]_\n🌐 ${TRANSLATIONS[lang].default || 'Translation in progress...'}`;
  }

  return response;
}

function addUserMessage(text, lang) {
  const el = document.getElementById('chatMessages');
  if (!el) return;
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble user';
  bubble.innerHTML = `${lang !== 'en' ? `<div class="bubble-lang">${lang.toUpperCase()}</div>` : ''}${text}`;
  el.appendChild(bubble);
  el.scrollTop = el.scrollHeight;
}

function addBotMessage(text, lang) {
  const el = document.getElementById('chatMessages');
  if (!el) return;
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble bot';
  // Convert basic markdown
  const formatted = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/_\[(.+?)\]_/g, '<em style="color:var(--c-cyan)">[$1]</em>');
  bubble.innerHTML = `<div class="bubble-lang">VenueIQ AI</div>${formatted}`;
  el.appendChild(bubble);
  el.scrollTop = el.scrollHeight;
}

function clearChat() {
  const el = document.getElementById('chatMessages');
  if (el) el.innerHTML = '';
  setTimeout(() => addBotMessage(AI_RESPONSES[STATE.currentPersona].greet, 'en'), 300);
}

function exportChat() {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return;
  const text = Array.from(msgs.querySelectorAll('.chat-bubble')).map(b => {
    const type = b.classList.contains('user') ? 'You' : 'VenueIQ AI';
    return `${type}: ${b.textContent}`;
  }).join('\n\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'venueiq-chat.txt'; a.click();
}

let voiceTimeout = null;
function toggleVoice() {
  STATE.voiceActive = !STATE.voiceActive;
  const btn = document.getElementById('voiceBtn');
  if (!btn) return;
  if (STATE.voiceActive) {
    btn.classList.add('recording');
    btn.textContent = '⏹';
    addUserMessage('🎤 [Voice input simulated] "Where is the nearest food court?"', 'en');
    voiceTimeout = setTimeout(() => {
      STATE.voiceActive = false;
      btn.classList.remove('recording');
      btn.textContent = '🎤';
      const typingEl = document.getElementById('typingIndicator');
      if (typingEl) typingEl.style.display = 'flex';
      setTimeout(() => {
        if (typingEl) typingEl.style.display = 'none';
        addBotMessage(AI_RESPONSES[STATE.currentPersona].food || AI_RESPONSES.fan.food, 'en');
      }, 1000);
    }, 2000);
  } else {
    clearTimeout(voiceTimeout);
    btn.classList.remove('recording');
    btn.textContent = '🎤';
  }
}

function doTranslate() {
  const text = document.getElementById('translateInput').value;
  const toLang = document.getElementById('toLang').value;
  const el = document.getElementById('translateOutput');
  if (!el) return;
  if (!text.trim()) {
    el.innerHTML = '<div class="trans-placeholder">Please enter text to translate</div>';
    return;
  }
  el.innerHTML = '<div class="trans-placeholder" style="color:var(--c-cyan)">Translating...</div>';
  setTimeout(() => {
    const transMap = TRANSLATIONS[toLang] || {};
    const result = transMap[text] || transMap.default || `${text} [${toLang.toUpperCase()} translation]`;
    el.innerHTML = `<div style="line-height:1.6">${result}</div>`;
  }, 800);
}

function liveTranslate() {
  const text = document.getElementById('translateInput').value;
  if (text.length > 3) {
    setTimeout(doTranslate, 500);
  }
}

function swapLangs() {
  const from = document.getElementById('fromLang');
  const to = document.getElementById('toLang');
  const tmp = from.value;
  from.value = to.value;
  to.value = tmp;
}

function speakTranslation() {
  const el = document.getElementById('translateOutput');
  if (el && window.speechSynthesis) {
    const text = el.textContent;
    const utter = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utter);
  }
}

function changeUILanguage() {
  // In a real app, this would switch all UI text. Here we show feedback.
  const lang = document.getElementById('uiLang').value;
  const names = { en:'English', hi:'Hindi', es:'Spanish', fr:'French', ar:'Arabic', zh:'Chinese', ja:'Japanese', de:'German', pt:'Portuguese', ko:'Korean' };
  addBotMessage(`🌐 Interface language switched to ${names[lang]}. All responses will now be provided in ${names[lang]}.`, lang);
}

// ─── Staff ────────────────────────────────────────────────────────────────────
function initStaff() {
  drawStaffCanvas();
  renderStaffSummary();
  renderTaskList();
  drawResponseChart();
  drawCoverageChart();
  renderSkillMatch();
}

function drawStaffCanvas() {
  const canvas = document.getElementById('staffCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#090f1e';
  ctx.fillRect(0, 0, W, H);

  // Venue outline
  ctx.strokeStyle = 'rgba(99,120,180,.25)';
  ctx.lineWidth = 2;
  roundRect(ctx, 20, 20, W-40, H-40, 10);
  ctx.stroke();

  // Field
  ctx.fillStyle = 'rgba(5,46,22,.5)';
  roundRect(ctx, W*.25, H*.15, W*.5, H*.7, 6);
  ctx.fill();

  // Grid zones
  const zoneLabels = ['A','B','C','D','E','F','G','H'];
  const zoneCols = 4, zoneRows = 2;
  const zW = (W-40)/zoneCols, zH = (H-40)/zoneRows;
  for (let r = 0; r < zoneRows; r++) {
    for (let c = 0; c < zoneCols; c++) {
      ctx.strokeStyle = 'rgba(99,120,180,.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(20 + c*zW, 20 + r*zH, zW, zH);
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      ctx.font = '11px Inter';
      ctx.textAlign = 'left';
      ctx.fillText('Zone ' + zoneLabels[r*zoneCols+c], 28 + c*zW, 38 + r*zH);
    }
  }

  // Staff dots
  const staffDots = [
    // Security (purple) - zone perimeters
    ...[...Array(12)].map(() => ({ x: 30+Math.random()*(W-60), y: 30+Math.random()*(H-60), color:'#7c3aed', r:5 })),
    // Medics (red)
    ...[...Array(6)].map((_, i) => ({ x: W*.1+i*W*.15, y: H*.5, color:'#06b6d4', r:5 })),
    // Volunteers (green)
    ...[...Array(10)].map(() => ({ x: 40+Math.random()*(W-80), y: 40+Math.random()*(H-80), color:'#10b981', r:4 })),
    // Operations (orange)
    ...[...Array(5)].map((_, i) => ({ x: W*.2+i*W*.15, y: H*.9, color:'#f97316', r:4 })),
    // Information (yellow)
    ...[...Array(4)].map((_, i) => ({ x: W*.15+i*W*.2, y: H*.1, color:'#eab308', r:4 })),
  ];

  staffDots.forEach(d => {
    // Glow
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r + 4, 0, Math.PI*2);
    ctx.fillStyle = d.color + '22';
    ctx.fill();
    // Dot
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI*2);
    ctx.fillStyle = d.color;
    ctx.fill();
  });

  // Coverage zones (transparent overlay)
  const coverageAreas = [
    { x:W*.05, y:H*.05, r:80, color:'#7c3aed' },
    { x:W*.5, y:H*.5, r:100, color:'#10b981' },
    { x:W*.85, y:H*.7, r:70, color:'#06b6d4' },
  ];
  coverageAreas.forEach(a => {
    const grad = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r);
    grad.addColorStop(0, a.color + '18');
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r, 0, Math.PI*2);
    ctx.fillStyle = grad;
    ctx.fill();
  });
}

function renderStaffSummary() {
  const el = document.getElementById('staffSummary');
  if (!el) return;
  el.innerHTML = STAFF_SUMMARY.map(s => `
    <div class="staff-sum-card">
      <span class="ss-icon">${s.icon}</span>
      <div>
        <div class="ss-num" style="color:${s.color}">${s.num}</div>
        <div class="ss-label">${s.label}</div>
      </div>
    </div>
  `).join('');
}

function renderTaskList() {
  const el = document.getElementById('taskList');
  if (!el) return;
  el.innerHTML = TASKS.map(t => `
    <div class="task-item">
      <div class="task-priority" style="background:${t.priority}"></div>
      <div class="task-info">
        <div class="task-name">${t.name}</div>
        <div class="task-zone">📍 ${t.zone}</div>
      </div>
      <div class="task-assignee">${t.assignee}</div>
    </div>
  `).join('');
}

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

function optimizeStaff() {
  addCommandMessage?.('ai', '✨ AI staff optimization complete. Redeploying 12 volunteers to Zone F, 3 security to Gate 5 area. Coverage improved by 18%.');
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
