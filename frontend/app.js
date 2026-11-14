const API = "http://localhost:8000/api/v1";
let sessionId = null;
let selectedIntent = "creativity";
let selectedModality = "learning";
let graphData = null;

// === Helpers ===

function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }

function showLoading(msg) {
  document.getElementById("loading-text").textContent = msg || "Processing...";
  show("loading");
}
function hideLoading() { hide("loading"); }

function shortClaim(text, n = 72) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return "…";
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
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
    const row = document.createElement("div");
    row.className = "diamond-row";
    getSelectedNames().forEach(name => row.appendChild(claimNode(name, "jump")));
    if (row.childElementCount) map.appendChild(row);
    const scores = document.getElementById("node3-results");
    if (scores && !scores.classList.contains("hidden")) map.appendChild(scores);
  }
}

function goToNode(n) {
  for (let i = 1; i < n; i++) {
    const prev = document.getElementById("node" + i);
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
  if (n === 4) seedBoard(getSelectedCards());
  setTimeout(() => current.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json();
}

// === Node 1 ===

async function submitNode1() {
  const problem = document.getElementById("problem").value.trim();
  if (problem.length < 10) return alert(t("needProblem"));

  const themes = document.getElementById("themes").value
    .split(",").map(t => t.trim()).filter(Boolean);

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

    // Populate Node 2
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
    alert(t("error") + ": " + e.message);
  } finally {
    hideLoading();
  }
}

// === Node 2 ===

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
    alert(t("error") + ": " + e.message);
  } finally {
    hideLoading();
  }
}

// === Node 3 ===

async function loadConceptBank(mode) {
  const attr = document.getElementById("critical-attr").value.trim();
  if (!attr) return alert(t("needAttribute"));

  showSpiral();
  const started = Date.now();
  try {
    const data = await api("POST",
      `/node3/concept-bank?session_id=${sessionId}&critical_attribute=${encodeURIComponent(attr)}&mode=${mode || "new"}`);
    const wait = Math.max(0, 2400 - (Date.now() - started));
    await new Promise(resolve => setTimeout(resolve, wait));
    const cards = (data.data.concept_bank || []).map(card => Object.assign({ received_at: Date.now() }, card));
    renderSpread(cards);
    hide("node3a");
    show("node3b");
  } catch (e) {
    alert(t("error") + ": " + e.message);
  } finally {
    hideSpiral();
  }
}

function submitConceptBank() { loadConceptBank("new"); }

async function submitSelection() {
  const selected = getSelectedNames();

  if (selected.length < 1 || selected.length > 5) {
    return alert(t("needSelection"));
  }

  showLoading(t("loadingScore"));
  try {
    const data = await api("POST", "/node3/select", {
      session_id: sessionId,
      critical_attribute: document.getElementById("critical-attr").value.trim(),
      selected_entities: selected,
      action: document.getElementById("branch-action").value,
    });

    // Show scores
    const container = document.getElementById("scores-container");
    container.innerHTML = "";
    data.data.entity_scores.forEach(es => {
      container.appendChild(createScoreCard(es.entity, es.scores));
    });
    show("node3-results");

    // Store graph
    graphData = { nodes: data.data.graph_nodes, edges: data.data.graph_edges };
    show("graph-toggle");

    // Auto-advance after brief display
    setTimeout(() => goToNode(4), 800);
  } catch (e) {
    alert(t("error") + ": " + e.message);
  } finally {
    hideLoading();
  }
}

function createScoreCard(entity, scores) {
  const card = document.createElement("div");
  card.className = "score-card";

  const agentScores = scores.agent_scores;
  const bars = [
    { key: "DC", val: agentScores.dc, color: "#8F1A1A" },
    { key: "NC", val: agentScores.nc, color: "#B54545" },
    { key: "T", val: agentScores.t, color: "#6E1212" },
    { key: "VS", val: agentScores.vs, color: "#1A3A8F" },
    { key: "MP", val: agentScores.mp, color: "#3D5CB5" },
    { key: "PCF", val: agentScores.pcf, color: "#0E245C" },
  ];

  let barsHtml = bars.map(b => `
    <div class="score-row">
      <span class="score-label">${b.key}</span>
      <div class="score-bar-bg">
        <div class="score-bar-fill" style="width:${b.val * 100}%;background:${b.color}"></div>
      </div>
      <span class="score-value">${b.val.toFixed(2)}</span>
    </div>
  `).join("");

  card.innerHTML = `
    <h4>${entity}</h4>
    <div class="score-bars">${barsHtml}</div>
    <div class="master-scores">
      <div class="master-score"><div class="value ps-color">${scores.ps.toFixed(3)}</div><div class="label">${t("ps")}</div></div>
      <div class="master-score"><div class="value ci-color">${scores.ci.toFixed(3)}</div><div class="label">${t("ci")}</div></div>
      <div class="master-score"><div class="value vi-color">${scores.vi.toFixed(4)}</div><div class="label">${t("vi")}</div></div>
      <div class="master-score"><div class="value pen-color">${scores.penalty.toFixed(2)}</div><div class="label">${t("penalty")}</div></div>
    </div>
  `;
  return card;
}

// === Node 4: Chat ===

function selectModality(btn) {
  document.querySelectorAll(".btn-mod").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  selectedModality = btn.dataset.mod;
  showModality(selectedModality);
}

function addChatMsg(role, text) {
  const area = document.getElementById("chat-messages");
  const div = claimNode(text, role === "user" ? "user" : "model");
  div.classList.add("chat-msg", role);
  area.appendChild(div);
  setTimeout(() => div.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
}

async function submitChat() {
  const input = document.getElementById("chat-input");
  const msg = input.value.trim();
  if (!msg) return;

  addChatMsg("user", msg);
  input.value = "";

  showLoading(t("thinking"));
  try {
    const data = await api("POST", "/node4", {
      session_id: sessionId,
      modality: selectedModality,
      confidence: parseInt(document.getElementById("confidence").value),
      user_message: msg,
      board: boardPayload(),
    });

    placeReply(data.data.intro, data.data.cards || []);
    addChatMsg("assistant", data.message);

    // Show live scores if available
    if (data.scores) {
      const lsc = document.getElementById("live-scores-content");
      lsc.innerHTML = "";
      lsc.appendChild(createScoreCard("Current State", data.scores));
      show("live-scores");
    }

    // Refresh graph data
    fetchGraph();
  } catch (e) {
    addChatMsg("assistant", t("error") + ": " + e.message);
  } finally {
    hideLoading();
  }
}

// Enter key sends chat
function startCreate() {
  document.getElementById("home").classList.add("hidden");
  document.body.classList.add("in-map");
  document.getElementById("workspace").classList.remove("hidden");
  constellationFocus(null, null);
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
  document.querySelectorAll(".claim-map .claim p").forEach(node => {
    ctx.fillStyle = "#dce5f8";
    ctx.fillRect(48, y - 22, 880, 8);
    ctx.fillStyle = "#0e245c";
    ctx.font = "22px Georgia, serif";
    y = wrapCanvasText(ctx, node.textContent, 64, y, 860, 28);
    y += 18;
  });
  const snapshot = boardsSnapshot();
  Object.keys(snapshot).forEach(mode => {
    ctx.fillStyle = "#111111";
    ctx.font = "16px sans-serif";
    y = wrapCanvasText(ctx, mode, 48, y + 10, 860, 22);
    snapshot[mode].links.filter(link => link.kind === "user").forEach(link => {
      const line = itemLabel(snapshot[mode], link.from) + " — " + (link.label || "") + " — " + itemLabel(snapshot[mode], link.to);
      y = wrapCanvasText(ctx, line, 64, y, 860, 22);
    });
  });
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "vognis-mapa-" + stamp + ".png";
  link.click();
}

function itemLabel(board, id) {
  const item = (board.items || []).find(entry => entry.id === id);
  if (!item) return id;
  return item.name || item.title || item.text || id;
}

function sessionMarkdown(data, boards) {
  const lines = ["# Vognis", "", data.summary || "", "", "## " + t("bridges")];
  (data.bridges || []).forEach(bridge => lines.push("- " + bridge));
  lines.push("", "## " + t("problemLabel"), data.session.problem || "");
  Object.keys(boards).forEach(mode => {
    lines.push("", "## " + mode);
    boards[mode].links.filter(link => link.kind === "user").forEach(link => {
      lines.push("- " + itemLabel(boards[mode], link.from) + " — " + (link.label || "·") + " — " + itemLabel(boards[mode], link.to));
    });
    boards[mode].items.filter(item => item.type === "note" && item.text).forEach(note => {
      lines.push("- " + (note.attached_to || "nota") + ": " + note.text);
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
    const boards = boardsSnapshot();
    const session = Object.assign({}, data.session, { local_boards: boards });
    downloadFile("vognis-sesion-" + stamp + ".json", JSON.stringify(session, null, 2), "application/json");
    downloadFile("vognis-resumen-" + stamp + ".md", sessionMarkdown(data, boards), "text/markdown");
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
    show("closing");
  } catch (e) {
    alert(t("error") + ": " + e.message);
  } finally {
    hideLoading();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("chat-input").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitChat();
    }
  });
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
    pop.textContent = t(button.dataset.help);
    const rect = button.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 300)) + "px";
    pop.style.top = (rect.bottom + 8) + "px";
    pop.classList.remove("hidden");
  });
});

// === Graph ===

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
  } catch (e) { /* silent */ }
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

  // Layout: root center, entities in circle
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

  // Draw edges
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

  // Draw nodes
  const colors = { concept: "#C5A059", entity: "#8F1A1A", process: "#1A3A8F" };

  nodes.forEach(n => {
    const p = positions[n.id];
    if (!p) return;
    const color = colors[n.node_type] || "#C5A059";
    const r = n.node_type === "concept" ? 24 : 18;

    // Glow
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = color + "22";
    ctx.fill();

    // Circle
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#FAFAFA";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = "#111111";
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "center";
    const label = n.label.length > 20 ? n.label.slice(0, 18) + "..." : n.label;
    ctx.fillText(label, p.x, p.y + r + 16);
  });
}
