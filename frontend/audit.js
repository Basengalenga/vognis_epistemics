/* Audit: human-provenance map of the session so far.
   It reads a snapshot of the session JSON on the server and never finishes or changes the session.
   The panel is the same as mapa/metrics.html: same data, logic and color scales.
   Everything here carries data-vlog-skip, so the session log does not record it. */

const AUDIT_LIBS = [
  "vendor/cytoscape-3.30.2.min.js",
  "vendor/dagre-0.8.5.min.js",
  "vendor/cytoscape-dagre-2.5.0.js",
];
const AUDIT_LABEL = { es: "AUDITORÍA", en: "AUDIT" };
const AUDIT_ARIA = { es: "Abrir auditoría", en: "Open audit" };
const AUDIT_WHISTLE = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
  stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="9" cy="14.5" r="5.5"/><circle cx="9" cy="14.5" r="1.4"/>
  <path d="M9 9h12v3.6h-7.4"/><path d="M12.5 9V7.2h2.6V9"/>
  <path d="M5 10.2 3.2 8.4"/><circle cx="2.6" cy="7.8" r="1"/></svg>`;

let auditButton = null;
let auditOverlay = null;
let auditOpen = false;
let auditRun = 0;          // stale polls and renders check this
let auditLibs = null;
let auditCys = [];
let auditCleanup = [];
let auditReturnFocus = null;
let auditScroll = "";

function auditApi() {
  return typeof API !== "undefined" ? API : location.protocol + "//" + location.hostname + ":8000/api/v1";
}

/* Called from goToNode: the button shows once node 1 is done. */
function auditOnNode(n) {
  try {
    auditEnsureButton();
    const ok = n >= 2 && typeof sessionId !== "undefined" && !!sessionId
      && !(typeof previewMode !== "undefined" && previewMode);
    auditButton.classList.toggle("hidden", !ok);
  } catch (e) { /* the audit never breaks the session */ }
}

function auditEnsureButton() {
  if (auditButton) return;
  const host = document.getElementById("workspace") || document.body;
  auditButton = document.createElement("button");
  auditButton.type = "button";
  auditButton.id = "audit-open";
  auditButton.className = "audit-open hidden";
  auditButton.setAttribute("data-vlog-skip", "");
  auditButton.innerHTML = AUDIT_WHISTLE + `<span class="audit-open-label"></span>`;
  auditButton.addEventListener("click", auditStart);
  host.appendChild(auditButton);
  auditPaintLabel();
  if (typeof onLang === "function") onLang(auditPaintLabel);
}

function auditPaintLabel() {
  if (!auditButton) return;
  const l = (typeof lang !== "undefined" && lang === "en") ? "en" : "es";
  auditButton.querySelector(".audit-open-label").textContent = AUDIT_LABEL[l];
  auditButton.setAttribute("aria-label", AUDIT_ARIA[l]);
}

function auditLoadLibs() {
  if (!auditLibs) {
    auditLibs = AUDIT_LIBS.reduce((chain, src) => chain.then(() => new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    })), Promise.resolve());
    auditLibs.catch(() => { auditLibs = null; });
  }
  return auditLibs;
}

/* ------------------------------------------------------------------ panel */

function auditBuildOverlay() {
  if (auditOverlay) return;
  const el = document.createElement("div");
  el.className = "audit-overlay hidden";
  el.setAttribute("data-vlog-skip", "");
  el.innerHTML = `
  <div class="audit-modal" role="dialog" aria-modal="true" aria-labelledby="audit-title">
    <header class="audit-head">
      <div class="audit-titles">
        <p class="audit-kicker">Auditoría</p>
        <h2 id="audit-title">Procedencia humana</h2>
        <p class="audit-snap" id="audit-snap"></p>
      </div>
      <div class="audit-tools">
        <span class="audit-authors"><span><span class="audit-ring" style="border-color:var(--au-user)"></span>User</span>
          <span><span class="audit-ring" style="border-color:var(--au-ai)"></span>AI</span>
          <span><span class="audit-sw" style="background:var(--au-green)"></span>pro</span>
          <span><span class="audit-sw" style="background:var(--au-red)"></span>con</span></span>
        <label><input type="checkbox" id="audit-sec"> Mostrar aristas secundarias</label>
        <label><input type="checkbox" id="audit-sync" checked> Sincronizar zoom</label>
        <label><input type="checkbox" id="audit-tl"> Ordenar por tiempo</label>
      </div>
      <button type="button" class="btn-void audit-close" id="audit-close">Cerrar panel</button>
    </header>
    <div class="audit-info" id="audit-info"><span class="meta">Pasa el mouse o da clic sobre un nodo (en cualquier panel) para verlo en los cuatro.</span></div>
    <div class="audit-status" id="audit-status">
      <div class="spinner" id="audit-spinner"></div>
      <p id="audit-status-text"></p>
      <p class="audit-error hidden" id="audit-error"></p>
      <button type="button" class="btn-void hidden" id="audit-retry">Reintentar</button>
    </div>
    <div class="audit-grid hidden" id="audit-grid">
      <section class="audit-card"><h3>1 · Tiempo</h3>
        <div class="audit-sub">orden de aparición de cada statement</div>
        <div class="audit-legend" id="audit-leg1"></div><div class="audit-cy" id="audit-cy1"></div></section>
      <section class="audit-card"><h3>2 · 50% asegurado (propagada)</h3>
        <div class="audit-sub">0.5·propio + 0.5·prom. padres</div>
        <div class="audit-legend" data-scale></div><div class="audit-cy" id="audit-cy2"></div></section>
      <section class="audit-card"><h3>3 · Promedio directo de los padres</h3>
        <div class="audit-sub">prom. de etiquetas crudas (User=1, AI=0) de los padres</div>
        <div class="audit-legend" data-scale data-null></div><div class="audit-cy" id="audit-cy3"></div></section>
      <section class="audit-card"><h3>4 · Discordancia m2 vs m3</h3>
        <div class="audit-sub">discordante: uno &lt; 0.5 y el otro &gt; 0.5 · empate: alguno = 0.5</div>
        <div class="audit-legend" id="audit-leg4"></div><div class="audit-cy" id="audit-cy4"></div></section>
    </div>
  </div>`;
  document.body.appendChild(el);
  auditOverlay = el;
  el.addEventListener("click", ev => { if (ev.target === el) auditClose(); });
  el.querySelector("#audit-close").addEventListener("click", auditClose);
  el.querySelector("#audit-retry").addEventListener("click", auditStart);
}

function auditKeys(ev) {
  if (!auditOpen || ev.key !== "Escape") return;
  ev.preventDefault();
  ev.stopImmediatePropagation();  // only the panel closes: not the oracle, a card or the log
  auditClose();
}

function auditShow() {
  auditBuildOverlay();
  if (auditOpen) return;
  auditOpen = true;
  auditReturnFocus = document.activeElement;
  auditScroll = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
  auditOverlay.classList.remove("hidden");
  window.addEventListener("keydown", auditKeys, true);
  document.getElementById("audit-close").focus({ preventScroll: true });
}

function auditClose() {
  if (!auditOpen) return;
  auditOpen = false;
  auditRun++;  // the job keeps going on the server; a later click joins it
  auditDestroy();
  auditOverlay.classList.add("hidden");
  window.removeEventListener("keydown", auditKeys, true);
  document.documentElement.style.overflow = auditScroll;
  if (typeof armIdle === "function") armIdle();  // the oracle's 45 s start over after the panel
  if (auditReturnFocus && auditReturnFocus.focus) {
    try { auditReturnFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
}

function auditDestroy() {
  auditCys.forEach(cy => { try { cy.destroy(); } catch (e) { /* ignore */ } });
  auditCys = [];
  auditCleanup.forEach(fn => { try { fn(); } catch (e) { /* ignore */ } });
  auditCleanup = [];
  if (!auditOverlay) return;
  auditOverlay.querySelectorAll(".audit-lane").forEach(el => el.remove());
  auditOverlay.querySelector(".audit-modal").classList.remove("tl");
  ["audit-sec", "audit-tl"].forEach(id => { document.getElementById(id).checked = false; });
  document.getElementById("audit-sync").checked = true;
  document.getElementById("audit-info").innerHTML =
    '<span class="meta">Pasa el mouse o da clic sobre un nodo (en cualquier panel) para verlo en los cuatro.</span>';
}

function auditStatus(text, error) {
  document.getElementById("audit-grid").classList.add("hidden");
  document.getElementById("audit-status").classList.remove("hidden");
  document.getElementById("audit-spinner").classList.toggle("hidden", !!error);
  document.getElementById("audit-status-text").textContent = text;
  const err = document.getElementById("audit-error");
  err.textContent = error || "";
  err.classList.toggle("hidden", !error);
  document.getElementById("audit-retry").classList.toggle("hidden", !error);
}

function auditProgress(job) {
  if (!job.total) return "Tomando la foto de la sesión…";
  let text = `Procesando ${job.done} de ${job.total} eventos`;
  if (job.fresh) text += ` · ${job.fresh} ${job.fresh === 1 ? "nuevo" : "nuevos"} con el modelo`;
  return text;
}

function auditSnapLine(job) {
  const t = new Date(job.snapshot_at);
  return `Foto de la sesión a las ${t.toLocaleTimeString()} · ${job.entries} entradas · la sesión sigue abierta`;
}

async function auditFetch(method) {
  const res = await fetch(auditApi() + "/session/" + sessionId + "/audit", { method });
  let body = null;
  try { body = await res.json(); } catch (e) { /* not JSON */ }
  if (!res.ok) throw new Error((body && body.detail) || ("HTTP " + res.status));
  return body;
}

async function auditStart() {
  if (typeof sessionId === "undefined" || !sessionId) return;
  auditShow();
  auditDestroy();
  const run = ++auditRun;
  auditStatus("Tomando la foto de la sesión…");
  document.getElementById("audit-snap").textContent = "";
  try {
    const [job] = await Promise.all([auditFetch("POST"), auditLoadLibs()]);
    if (run !== auditRun) return;
    document.getElementById("audit-snap").textContent = auditSnapLine(job);
    await auditPoll(run, job);
  } catch (e) {
    if (run !== auditRun) return;
    auditStatus("La auditoría no pudo terminar.", String(e && e.message ? e.message : e));
  }
}

async function auditPoll(run, job) {
  while (job.state === "running") {
    auditStatus(auditProgress(job));
    await new Promise(resolve => setTimeout(resolve, 700));
    if (run !== auditRun) return;
    job = await auditFetch("GET");
    if (run !== auditRun) return;
  }
  if (job.state === "error") {
    const kept = job.done ? ` Lo procesado (${job.done} de ${job.total}) quedó en caché; reintentar sigue desde ahí.` : "";
    auditStatus("El modelo falló durante la auditoría." + kept, job.error || "Error desconocido");
    return;
  }
  document.getElementById("audit-snap").textContent = auditSnapLine(job);
  if (!job.graph.nodes.length) {
    auditStatus("Todavía no hay statements que auditar.", " ");
    document.getElementById("audit-retry").classList.add("hidden");
    return;
  }
  document.getElementById("audit-status").classList.add("hidden");
  document.getElementById("audit-grid").classList.remove("hidden");
  auditRender(job.graph, job.metrics);
}

/* ------------------------------------------------------------------ render
   Port of the script in mapa/metrics.html. Only ids and class names change. */

function auditRender(g, M) {
  const root = auditOverlay;
  const modal = root.querySelector(".audit-modal");
  const css = n => getComputedStyle(root).getPropertyValue(n).trim();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const short = (s, n = 60) => s.length > n ? s.slice(0, n - 1) + '…' : s;
  const fmt = v => v === null ? 'sin entradas' : v.toFixed(3);

  // ColorBrewer RdBu (11 clases), 0 = rojo, 0.5 = casi blanco, 1 = azul.
  const RDBU = ['#67001f','#b2182b','#d6604d','#f4a582','#fddbc7','#f7f7f7','#d1e5f0','#92c5de','#4393c3','#2166ac','#053061'];
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rdbu = t => {
    t = Math.max(0, Math.min(1, t)) * (RDBU.length - 1);
    const i = Math.min(Math.floor(t), RDBU.length - 2), f = t - i;
    const a = hex(RDBU[i]), b = hex(RDBU[i + 1]);
    return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * f)).join(',')})`;
  };
  // ColorBrewer Greens (9 clases), 0 = casi blanco (primer statement), 1 = verde oscuro (más reciente).
  const GREENS = ['#f7fcf5','#e5f5e0','#c7e9c0','#a1d99b','#74c476','#41ab5d','#238b45','#006d2c','#00441b'];
  const ramp = stops => t => {
    t = Math.max(0, Math.min(1, t)) * (stops.length - 1);
    const i = Math.min(Math.floor(t), stops.length - 2), f = t - i;
    const a = hex(stops[i]), b = hex(stops[i + 1]);
    return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * f)).join(',')})`;
  };
  const greens = ramp(GREENS);
  root.querySelector('#audit-leg1').innerHTML =
    `<span>antiguo</span><span class="audit-ramp" style="background:linear-gradient(90deg,${GREENS.join(',')})"></span><span>reciente</span>`;
  root.querySelectorAll('[data-scale]').forEach(el => {
    el.innerHTML = `<span>0 (AI)</span><span class="audit-ramp" style="background:linear-gradient(90deg,${RDBU.join(',')})"></span><span>1 (User)</span>` +
      (el.hasAttribute('data-null') ? `<span><span class="audit-sw" style="background:var(--au-null)"></span>sin entradas</span>` : '');
  });

  const met = {};
  M.nodes.forEach(r => met[r.id] = r);

  // Misma lógica que index.html: el padre principal es la fuente más reciente; el layout usa sólo esas aristas.
  const order = {};
  g.nodes.forEach((n, i) => order[n.id] = i);
  const primary = {};
  g.edges.forEach((e, i) => {
    const cur = primary[e.target];
    if (cur === undefined || order[e.source] > order[g.edges[cur].source]) primary[e.target] = i;
  });
  const isPrimary = new Set(Object.values(primary));

  // Línea de tiempo: x = rango temporal con paso uniforme; y = carril por autor (User arriba, AI abajo).
  // Si el nodo anterior del mismo carril se encimaría (nodo de 170 px de ancho), alterna una fila abajo.
  const N = g.nodes.length, DX = 95, ROW = 80, LANES = { User: 0, AI: 360 };
  const laneOf = n => n.author === 'User' ? 'User' : 'AI';
  const tlPos = {}, last = {};
  g.nodes.map(n => ({ n, k: Math.round(met[n.id].time_rank * (N - 1)) }))
    .sort((a, b) => a.k - b.k)
    .forEach(({ n, k }) => {
      const lane = laneOf(n), x = k * DX, prev = last[lane];
      const alt = prev && x - prev.x < 185 ? 1 - prev.alt : 0;
      last[lane] = { x, alt };
      tlPos[n.id] = { x, y: LANES[lane] + alt * ROW };
    });
  // Curvatura de cada arista en la línea de tiempo (todas van de izquierda a derecha;
  // en cytoscape una distancia positiva curva hacia abajo en ese sentido).
  // Mismo carril: arco hacia afuera (User arriba, AI abajo), más alto cuanto más larga.
  const cpd = g.edges.map(e => {
    const a = tlPos[e.source], b = tlPos[e.target], dx = Math.abs(b.x - a.x);
    const la = laneOf(g.nodes[order[e.source]]), lb = laneOf(g.nodes[order[e.target]]);
    if (la !== lb) return Math.min(0.08 * dx, 300);
    const d = Math.min(40 + 0.15 * dx, 700);
    return la === 'User' ? -d : d;
  });

  const STATE = { discordante: css('--au-disc'), empate: css('--au-tie'), concordante: css('--au-conc'),
                  'sin entradas': css('--au-null') };
  const panels = [
    { id: 'audit-cy1', fill: r => greens(r.time_rank), cls: () => 'time' },
    { id: 'audit-cy2', fill: r => rdbu(r.m2) },
    { id: 'audit-cy3', fill: r => r.m3 === null ? css('--au-null') : rdbu(r.m3), tag: r => r.m3 === null ? '\nsin entradas' : '' },
    { id: 'audit-cy4', fill: r => STATE[r.estado], cls: r => r.estado.replace(' ', '-'),
      tag: r => r.estado === 'sin entradas' ? '\nsin entradas' : '' },
  ];

  const baseStyle = [
    { selector: 'node', style: {
        'shape': 'round-rectangle', 'width': 170, 'height': 70,
        'background-color': 'data(fill)', 'border-width': 5, 'border-color': 'data(border)',
        'label': 'data(label)', 'text-wrap': 'wrap', 'text-max-width': 155,
        'text-valign': 'center', 'text-halign': 'center',
        'font-size': 10, 'color': '#fff', 'text-outline-width': 1.5, 'text-outline-color': '#333' } },
    { selector: 'edge', style: {
        'curve-style': 'bezier', 'width': 2, 'target-arrow-shape': 'triangle', 'arrow-scale': 1.1,
        'label': 'data(type)', 'font-size': 9, 'text-background-color': '#fff',
        'text-background-opacity': 0.85, 'text-background-padding': 2 } },
    { selector: 'edge[type = "pro"]', style: { 'line-color': css('--au-green'), 'target-arrow-color': css('--au-green'), 'color': css('--au-green') } },
    { selector: 'edge[type = "con"]', style: { 'line-color': css('--au-red'), 'target-arrow-color': css('--au-red'), 'color': css('--au-red') } },
    { selector: 'edge.secondary', style: { 'line-style': 'dashed', 'opacity': 0.55, 'curve-style': 'unbundled-bezier', 'label': '' } },
    { selector: 'edge.tl', style: { 'curve-style': 'unbundled-bezier', 'control-point-distances': 'data(cpd)',
                                    'control-point-weights': 0.5 } },
    { selector: '.hidden', style: { 'display': 'none' } },
    { selector: 'node.concordante, node.sin-entradas', style: { 'opacity': 0.45 } },
    // Panel de tiempo: contorno gris exterior además del borde de autor, para que los primeros
    // (casi blancos) no se pierdan contra el fondo.
    { selector: 'node.time', style: { 'outline-width': 2, 'outline-color': '#777', 'outline-offset': 1 } },
    { selector: 'node.sel', style: { 'opacity': 1, 'underlay-color': '#000', 'underlay-opacity': 0.35,
                                     'underlay-padding': 10, 'underlay-shape': 'round-rectangle', 'z-index': 99 } },
  ];

  const cys = panels.map(p => cytoscape({
    container: document.getElementById(p.id),
    wheelSensitivity: 0.2,
    style: baseStyle,
    elements: [
      ...g.nodes.map(n => {
        const r = met[n.id];
        return { data: { ...n, fill: p.fill(r),
          border: n.author === 'User' ? css('--au-user') : css('--au-ai'),
          label: `${n.author}${p.tag ? p.tag(r) : ''}\n${short(n.text)}` },
          classes: p.cls ? p.cls(r) : '' };
      }),
      ...g.edges.map((e, i) => ({ data: { id: 'e' + i, ...e, cpd: cpd[i] },
        classes: isPrimary.has(i) ? 'primary' : 'secondary hidden' })),
    ],
  }));
  auditCys = cys;

  // Layout dagre una sola vez (en el primer panel) y mismas posiciones en los demás.
  cys[0].elements().not('edge.secondary').layout({ name: 'dagre', rankDir: 'TB', nodeSep: 25, rankSep: 50, edgeSep: 10 }).run();
  const pos = {};
  cys[0].nodes().forEach(n => pos[n.id()] = { ...n.position() });
  cys.slice(1).forEach(cy => cy.layout({ name: 'preset', positions: n => pos[n.id()], fit: false }).run());
  cys.forEach(cy => cy.fit(undefined, 20));

  // Zoom/pan sincronizado (se suspende mientras corre la animación de cambio de layout;
  // cada panel hace su propio fit, igual que al cargar).
  const syncBox = document.getElementById('audit-sync');
  let syncing = false, animating = false;
  cys.forEach(src => src.on('viewport', () => {
    if (animating || syncing || !syncBox.checked) return;
    syncing = true;
    cys.forEach(cy => { if (cy !== src) cy.viewport({ zoom: src.zoom(), pan: src.pan() }); });
    syncing = false;
  }));

  // Etiquetas de carril ("User" / "AI") fijas a la izquierda de cada panel, siguiendo el zoom/pan vertical.
  const laneMid = { User: LANES.User + ROW / 2, AI: LANES.AI + ROW / 2 };
  const laneTags = cys.map((cy, i) => {
    const box = document.getElementById(panels[i].id), card = box.parentElement;
    const tags = ['User', 'AI'].map(name => {
      const el = document.createElement('div');
      el.className = 'audit-lane';
      el.textContent = name;
      el.style.borderColor = css(name === 'User' ? '--au-user' : '--au-ai');
      card.appendChild(el);
      return { name, el };
    });
    const place = () => tags.forEach(t =>
      t.el.style.top = (box.offsetTop + cy.pan().y + laneMid[t.name] * cy.zoom()) + 'px');
    cy.on('viewport resize', place);
    return place;
  });
  const onResize = () => laneTags.forEach(f => f());
  window.addEventListener('resize', onResize);
  auditCleanup.push(() => window.removeEventListener('resize', onResize));

  document.getElementById('audit-tl').onchange = ev => {
    const tl = ev.target.checked;
    modal.classList.toggle('tl', tl);
    animating = true;
    let pending = cys.length;
    cys.forEach(cy => {
      cy.edges().toggleClass('tl', tl);
      const lay = cy.layout({ name: 'preset', positions: n => (tl ? tlPos : pos)[n.id()],
        fit: true, padding: 20, animate: true, animationDuration: 500, animationEasing: 'ease-in-out-cubic' });
      lay.one('layoutstop', () => { if (--pending === 0) animating = false; });
      lay.run();
    });
    laneTags.forEach(f => f());
  };

  document.getElementById('audit-sec').onchange = ev =>
    cys.forEach(cy => cy.edges('.secondary').toggleClass('hidden', !ev.target.checked));

  const select = id => {
    cys.forEach(cy => { cy.nodes('.sel').removeClass('sel'); cy.getElementById(id).addClass('sel'); });
    const n = g.nodes[order[id]], r = met[id], N = g.nodes.length;
    const k = Math.round(r.time_rank * (N - 1)) + 1;
    const t = new Date(n.timestamp);
    document.getElementById('audit-info').innerHTML =
      `<div class="text">${esc(n.text)}</div>
       <div class="meta">${esc(n.author)} · ${esc(n.id)} · <b class="v">${t.toLocaleTimeString()}</b>
       (${t.toLocaleDateString()}; ${esc(n.timestamp)}) · statement <b class="v">${k}</b> de ${N}
       · m2 <b class="v">${fmt(r.m2)}</b> · m3 <b class="v">${fmt(r.m3)}</b>
       · <b class="v">${r.estado}</b></div>`;
  };
  cys.forEach(cy => cy.on('mouseover tap', 'node', ev => select(ev.target.id())));

  const s = M.summary;
  document.getElementById('audit-leg4').innerHTML =
    `<span><span class="audit-sw" style="background:var(--au-disc)"></span>discordantes: <b>${s.discordante}</b></span>
     <span><span class="audit-sw" style="background:var(--au-tie)"></span>empate: <b>${s.empate}</b></span>
     <span><span class="audit-sw" style="background:var(--au-conc)"></span>concordantes: <b>${s.concordante}</b></span>
     <span><span class="audit-sw" style="background:var(--au-null)"></span>sin entradas (m3 null): <b>${s.sin_entradas}</b></span>`;
}
