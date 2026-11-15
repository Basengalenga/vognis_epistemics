const API = "http://localhost:8000/api/v1";
const HISTORY_KEY = "vognis-history";
let sessionId = null;
let selectedIntent = "creativity";
let graphData = null;
let rootSpread = null;
let feedbackEntry = null;

function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }

function showLoading(msg) {
  document.getElementById("loading-text").textContent = msg || "…";
  show("loading");
}
function hideLoading() { hide("loading"); }

function showNotice(message) {
  const el = document.getElementById("net-notice");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => el.classList.add("hidden"), 7000);
}

function reportError(e) {
  if (e && e.offline) return;
  alert(t("error") + ": " + (e && e.message ? e.message : e));
}

function claimNode(text, kind) {
  const el = document.createElement("div");
  el.className = "claim " + kind;
  const gem = document.createElement("i");
  gem.className = "gem";
  const p = document.createElement("p");
  p.textContent = text || "";
  el.appendChild(gem);
  el.appendChild(p);
  if ((text || "").length > 180) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "see-all";
    btn.textContent = t("seeAll");
    btn.onclick = () => {
      const open = p.classList.toggle("open");
      btn.textContent = open ? t("seeLess") : t("seeAll");
    };
    el.appendChild(btn);
  }
  return el;
}

function freezeCluster(n) {
  const section = document.getElementById("node" + n);
  const map = section.querySelector(".claim-map");
  if (!map || map.dataset.frozen === "1") return;
  map.dataset.frozen = "1";
  map.innerHTML = "";

  if (n === 1) {
    map.appendChild(claimNode(document.getElementById("problem").value, "user"));
  }

  if (n === 2) {
    map.appendChild(claimNode(document.getElementById("node2-summary").textContent, "model"));
    const row = document.createElement("div");
    row.className = "diamond-row";
    section.querySelectorAll(".keyword-tag").forEach((tag, i) => {
      if (i < 5) row.appendChild(claimNode(tag.textContent, "model"));
    });
    if (row.childElementCount) map.appendChild(row);
  }

  if (n === 3) {
    const attr = document.getElementById("critical-attr").value.trim();
    if (attr) map.appendChild(claimNode(attr, "user"));
  }
}

function goToNode(n) {
  for (let i = 1; i < n; i++) {
    const prev = document.getElementById("node" + i);
    if (!prev) continue;
    prev.classList.add("revealed", "settled");
    prev.classList.remove("active");
    freezeCluster(i);
  }
  document.querySelectorAll(".node-section").forEach(s => s.classList.remove("active"));
  const current = document.getElementById("node" + n);
  current.classList.add("revealed", "active");
  current.classList.remove("settled");
  document.getElementById("node-indicator").textContent = t("node") + " " + n;
  document.getElementById("btn-finish").classList.toggle("hidden", n < 2);
  setTimeout(() => current.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  let res;
  try {
    res = await fetch(API + path, opts);
  } catch (err) {
    if (err instanceof TypeError) {
      const error = new Error(t("offline"));
      error.offline = true;
      showNotice(t("offline"));
      throw error;
    }
    throw err;
  }
  if (!res.ok) {
    let detail = await res.text();
    try {
      const parsed = JSON.parse(detail);
      if (typeof parsed.detail === "string") detail = parsed.detail;
    } catch (e) { /* keep the raw body */ }
    throw new Error(detail);
  }
  return res.json();
}

async function submitNode1() {
  const problem = document.getElementById("problem").value.trim();
  if (problem.length < 10) return alert(t("needProblem"));

  const themes = document.getElementById("themes").value
    .split(",").map(item => item.trim()).filter(Boolean);

  showLoading(t("loadingKeywords"));
  try {
    const data = await api("POST", "/node1", {
      problem,
      expertise_level: document.getElementById("expertise").value,
      interest_themes: themes,
      intent_hint: document.getElementById("intent-hint").value,
      lang,
    });

    sessionId = data.session_id;
    document.getElementById("session-id-display").textContent = t("session") + " " + sessionId.slice(0, 8);
    show("session-bar");

    document.getElementById("node2-summary").textContent = data.data.keywords.join(" · ");

    const kwBox = document.getElementById("node2-keywords");
    kwBox.innerHTML = "";
    data.data.keywords.forEach(kw => {
      const tag = document.createElement("span");
      tag.className = "keyword-tag";
      tag.textContent = kw;
      kwBox.appendChild(tag);
    });

    goToNode(2);
  } catch (e) {
    reportError(e);
  } finally {
    hideLoading();
  }
}

function selectIntent(btn) {
  document.querySelectorAll(".btn-intent").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  selectedIntent = btn.dataset.intent;
}

async function submitNode2() {
  const desc = document.getElementById("detailed-desc").value.trim();
  if (desc.length < 10) return alert(t("needDetail"));

  showLoading(t("loadingSummary"));
  try {
    const data = await api("POST", "/node2", {
      session_id: sessionId,
      detailed_description: desc,
      intent: selectedIntent,
    });

    document.getElementById("node2-summary").textContent = data.message;
    goToNode(3);
  } catch (e) {
    reportError(e);
  } finally {
    hideLoading();
  }
}

function ensureRootSpread() {
  if (rootSpread) return rootSpread;
  rootSpread = createSpread(document.getElementById("root-spread"), {
    parentId: null,
    getAttribute: () => document.getElementById("critical-attr").value.trim(),
    onBack: () => {
      hide("node3b");
      show("node3a");
      document.getElementById("critical-attr").focus();
    },
  });
  return rootSpread;
}

async function submitConceptBank() {
  const attr = document.getElementById("critical-attr").value.trim();
  if (!attr) return alert(t("needAttribute"));
  const ok = await ensureRootSpread().load("new");
  if (!ok) return;
  hide("node3a");
  show("node3b");
}

async function submitSelection() {
  const spread = ensureRootSpread();
  const selected = spread.getSelectedCards();
  if (selected.length < 1 || selected.length > 5) return alert(t("needSelection"));
  const action = document.getElementById("branch-action").value;

  showLoading(t("loadingScore"));
  try {
    const data = await api("POST", "/node3/select", {
      session_id: sessionId,
      critical_attribute: document.getElementById("critical-attr").value.trim(),
      selected_entities: selected.map(card => card.name),
      action,
      parent_id: null,
    });

    const section = document.getElementById("node3");
    section.classList.add("revealed", "settled");
    section.classList.remove("active");
    freezeCluster(3);
    mountIdeas(data.data.ideas, action === "edit");
    graphData = { nodes: data.data.graph_nodes, edges: data.data.graph_edges };
    show("graph-toggle");
    fetchGraph();
  } catch (e) {
    reportError(e);
  } finally {
    hideLoading();
  }
}

function scoreRow(label, value, color) {
  const word = t(bandKey(value));
  return `
    <div class="score-row">
      <span class="score-label">${label}</span>
      <div class="score-bar-bg"><div class="score-bar-fill" style="width:${Math.max(0, Math.min(1, value)) * 100}%;background:${color}"></div></div>
      <span class="score-word">${word}</span>
      <span class="score-value">${Number(value).toFixed(2)}</span>
    </div>`;
}

function meter(word, number, label, colorClass) {
  return `
    <div class="master-score">
      <div class="value ${colorClass}">${word}</div>
      <div class="label">${label}</div>
      <div class="score-value">${number}</div>
    </div>`;
}

function createScoreCard(entity, scores) {
  const card = document.createElement("div");
  card.className = "score-card";
  const agent = scores.agent_scores || {};
  const surpriseRows = [
    scoreRow(t("distance"), agent.dc || 0, "#8F1A1A"),
    scoreRow(t("rarity"), agent.nc || 0, "#B54545"),
    scoreRow(t("originality"), agent.t || 0, "#6E1212"),
  ].join("");
  const solidRows = [
    scoreRow(t("analogy"), agent.vs || 0, "#1A3A8F"),
    scoreRow(t("impact"), agent.mp || 0, "#3D5CB5"),
    scoreRow(t("contact"), agent.pcf || 0, "#0E245C"),
  ].join("");
  const penalty = Number(scores.penalty || 1);
  const penaltyHtml = penalty > 1
    ? `<p class="penalty-note">${t("penaltyNote")}</p>`
    : "";
  card.innerHTML = `
    <h4></h4>
    <p class="verdict">${t(verdictKey(scores.ps, scores.ci))}</p>
    <div class="master-scores">
      ${meter(t(bandKey(scores.ps)), Number(scores.ps).toFixed(2), t("surprise"), "ps-color")}
      ${meter(t(bandKey(scores.ci)), Number(scores.ci).toFixed(2), t("solidity"), "ci-color")}
      ${meter(t(viBandKey(scores.vi)), Number(scores.vi).toFixed(2), t("valueName"), "vi-color")}
    </div>
    <div class="score-group surprise">
      <h5>${t("surprise")} <button type="button" class="help-q" data-help="formulaHelp">?</button></h5>
      <div class="score-bars">${surpriseRows}</div>
    </div>
    <div class="score-group solid">
      <h5>${t("solidity")}</h5>
      <div class="score-bars">${solidRows}</div>
    </div>
    ${penaltyHtml}
  `;
  card.querySelector("h4").textContent = entity;
  return card;
}

function readHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function writeHistory(all) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
}

function rememberHistory(summary) {
  if (!sessionId) return;
  const all = readHistory();
  let entry = all.find(item => item.id === sessionId);
  if (!entry) {
    entry = {
      id: sessionId,
      date: new Date().toISOString(),
      problem: "",
      ideas: [],
      summary: "",
      feedback: null,
    };
    all.push(entry);
  }
  const problem = document.getElementById("problem");
  if (problem && problem.value.trim()) entry.problem = problem.value.trim();
  if (typeof ideaSnapshot === "function") {
    const names = ideaSnapshot().map(node => node.name).filter(Boolean);
    if (names.length) entry.ideas = names;
    entry.bridges = ideaSnapshot()
      .filter(node => node.bridge)
      .map(node => ({ name: node.name, bridge: node.bridge }));
  }
  if (summary) entry.summary = summary;
  writeHistory(all);
}

function daysSince(iso) {
  const then = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  then.setHours(0, 0, 0, 0);
  return Math.round((today - then) / 86400000);
}

function pendingFeedbackEntry() {
  if (localStorage.getItem("vognis-feedback-snooze") === new Date().toDateString()) return null;
  return readHistory().find(entry => {
    if (entry.feedback) return false;
    if (!entry.ideas || !entry.ideas.length) return false;
    return daysSince(entry.date) >= 1;
  }) || null;
}

function paintFeedback(entry) {
  const idea = entry.ideas[0] || entry.problem || "";
  const days = daysSince(entry.date);
  const template = days <= 1 ? t("fbYesterday") : t("fbDays");
  document.getElementById("yesterday-q").textContent = template
    .replace("{idea}", idea)
    .replace("{n}", String(days));
}

function showYesterday() {
  const card = document.getElementById("yesterday");
  if (!card) return;
  const home = document.getElementById("home");
  feedbackEntry = pendingFeedbackEntry();
  if (!feedbackEntry || (home && home.classList.contains("hidden"))) {
    card.classList.add("hidden");
    return;
  }
  document.getElementById("yesterday-thanks").classList.add("hidden");
  paintFeedback(feedbackEntry);
  card.classList.remove("hidden");
}

function saveFeedback(rating) {
  if (!feedbackEntry) return;
  const all = readHistory();
  const entry = all.find(item => item.id === feedbackEntry.id);
  if (!entry) return;
  entry.feedback = {
    rating,
    note: document.getElementById("yesterday-note").value.trim(),
    at: new Date().toISOString(),
  };
  writeHistory(all);
  document.getElementById("yesterday-note").value = "";
  document.getElementById("yesterday-thanks").classList.remove("hidden");
  feedbackEntry = null;
  setTimeout(showYesterday, 900);
}

function snoozeFeedback() {
  localStorage.setItem("vognis-feedback-snooze", new Date().toDateString());
  hide("yesterday");
}

function startCreate() {
  document.getElementById("home").classList.add("hidden");
  document.body.classList.add("in-map");
  document.getElementById("workspace").classList.remove("hidden");
  constellationFocus(null, null);
  if (typeof oracleEnter === "function") oracleEnter();
}

function backHome() { location.reload(); }

function downloadFile(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || "").split(/\s+/);
  let line = "";
  let cursor = y;
  words.forEach(word => {
    const trial = line ? line + " " + word : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, cursor);
      line = word;
      cursor += lineHeight;
    } else line = trial;
  });
  if (line) ctx.fillText(line, x, cursor);
  return cursor + lineHeight;
}

function downloadMap(stamp) {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 1400;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111111";
  ctx.font = "28px Cinzel, serif";
  ctx.fillText("VOGNIS", 48, 56);
  let y = 110;
  document.querySelectorAll(".claim-map .claim p, .idea-box h3, .idea-seed, .idea-bridge").forEach(node => {
    ctx.fillStyle = "#0e245c";
    ctx.font = "22px Georgia, serif";
    y = wrapCanvasText(ctx, node.textContent, 48, y, 900, 28);
    y += 8;
  });
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "vognis-mapa-" + stamp + ".png";
  link.click();
}

function sessionMarkdown(data) {
  const lines = ["# Vognis", "", data.summary || "", "", "## " + t("bridges")];
  (data.bridges || []).forEach(bridge => lines.push("- " + bridge));
  lines.push("", "## " + t("problemLabel"), (data.session && data.session.problem) || "");
  ideaSnapshot().forEach(node => {
    lines.push("", "## " + node.path);
    if (node.attribute) lines.push(node.attribute);
    if (node.seed) lines.push(node.seed);
    if (node.bridge) lines.push(t("bridgePrefix") + node.bridge);
    (node.developments || []).forEach(dev => {
      lines.push("", "- " + (dev.modality || "") + ": " + (dev.user_message || ""));
      if (dev.intro) lines.push("  " + dev.intro);
      (dev.cards || []).forEach(card => lines.push("  - " + card.title + ": " + card.body));
    });
  });
  return lines.join("\n");
}

async function finishSession() {
  if (!sessionId) return;
  showLoading(t("ending"));
  try {
    const data = await api("POST", "/session/" + sessionId + "/finish");
    const stamp = new Date().toISOString().slice(0, 10);
    rememberHistory(data.summary || "");
    downloadFile("vognis-sesion-" + stamp + ".json", JSON.stringify(data.session, null, 2), "application/json");
    downloadFile("vognis-resumen-" + stamp + ".md", sessionMarkdown(data), "text/markdown");
    downloadMap(stamp);
    document.getElementById("closing-summary").textContent = data.summary || "";
    const list = document.getElementById("closing-bridges");
    list.innerHTML = "";
    (data.bridges || []).forEach(bridge => {
      const item = document.createElement("li");
      item.textContent = bridge;
      list.appendChild(item);
    });
    hide("workspace");
    document.getElementById("trail").classList.add("hidden");
    show("closing");
  } catch (e) {
    reportError(e);
  } finally {
    hideLoading();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("textarea").forEach(area => {
    area.addEventListener("input", () => {
      area.style.height = "auto";
      area.style.height = area.scrollHeight + "px";
    });
  });
  const create = document.getElementById("orb-create");
  create.addEventListener("mouseenter", () => {
    const rect = create.getBoundingClientRect();
    constellationFocus(rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  create.addEventListener("mouseleave", () => constellationFocus(null, null));
  document.addEventListener("click", event => {
    const button = event.target.closest(".help-q");
    const pop = document.getElementById("help-pop");
    if (!button) {
      pop.classList.add("hidden");
      return;
    }
    event.stopPropagation();
    pop.textContent = t(button.dataset.help);
    const rect = button.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 300)) + "px";
    pop.style.top = (rect.bottom + 8) + "px";
    pop.classList.remove("hidden");
  });
  document.querySelectorAll("#yesterday [data-fb]").forEach(btn => {
    btn.addEventListener("click", () => saveFeedback(btn.dataset.fb));
  });
  document.getElementById("yesterday-skip").addEventListener("click", snoozeFeedback);
  showYesterday();
});

onLang(() => {
  if (feedbackEntry) paintFeedback(feedbackEntry);
});

let graphOpen = false;

function toggleGraph() {
  graphOpen = !graphOpen;
  if (graphOpen) {
    show("graph-panel");
    drawGraph();
  } else {
    hide("graph-panel");
  }
}

async function fetchGraph() {
  if (!sessionId) return;
  try {
    graphData = await api("GET", `/session/${sessionId}/graph`);
    if (graphOpen) drawGraph();
  } catch (e) { /* the map on the page is the source of truth */ }
}

function drawGraph() {
  if (!graphData) return;
  const canvas = document.getElementById("graph-canvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const nodes = graphData.nodes || [];
  const edges = graphData.edges || [];
  if (!nodes.length) return;

  const positions = {};
  const root = nodes[0];
  positions[root.id] = { x: W / 2, y: H / 2 };

  const others = nodes.slice(1);
  others.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(others.length, 1) - Math.PI / 2;
    const rx = W * 0.35;
    const ry = H * 0.35;
    positions[n.id] = {
      x: W / 2 + rx * Math.cos(angle),
      y: H / 2 + ry * Math.sin(angle),
    };
  });

  edges.forEach(e => {
    const from = positions[e.source];
    const to = positions[e.target];
    if (!from || !to) return;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * 36;
    const oy = (dx / len) * 36;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.bezierCurveTo(from.x + ox, from.y + oy, to.x + ox, to.y + oy, to.x, to.y);

    ctx.globalAlpha = 1;
    if (e.edge_type === "serendipitous") {
      ctx.strokeStyle = "#8F1A1A";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.75;
      ctx.globalAlpha = 0.7;
    } else if (e.edge_type === "anchoring") {
      ctx.strokeStyle = "#1A3A8F";
      ctx.setLineDash([]);
      ctx.lineWidth = 1.25;
      ctx.globalAlpha = 0.35;
    } else {
      ctx.strokeStyle = "#C5A059";
      ctx.setLineDash([]);
      ctx.lineWidth = 1.75;
      ctx.globalAlpha = 0.55;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  });

  const colors = { concept: "#C5A059", entity: "#8F1A1A", process: "#1A3A8F" };

  nodes.forEach(n => {
    const p = positions[n.id];
    if (!p) return;
    const color = colors[n.node_type] || "#C5A059";
    const r = n.node_type === "concept" ? 24 : 18;

    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = color + "22";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#FAFAFA";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#111111";
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "center";
    const label = n.label.length > 20 ? n.label.slice(0, 18) + "..." : n.label;
    ctx.fillText(label, p.x, p.y + r + 16);
  });
}
