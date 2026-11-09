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

function goToNode(n) {
  document.querySelectorAll(".node-section").forEach(s => s.classList.remove("active"));
  document.getElementById("node" + n).classList.add("active");
  document.getElementById("node-indicator").textContent = "Node " + n;
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
  if (problem.length < 10) return alert("Please describe your problem in more detail.");

  const themes = document.getElementById("themes").value
    .split(",").map(t => t.trim()).filter(Boolean);

  showLoading("Extracting key concepts...");
  try {
    const data = await api("POST", "/node1", {
      problem,
      expertise_level: document.getElementById("expertise").value,
      interest_themes: themes,
      intent_hint: document.getElementById("intent-hint").value,
    });

    sessionId = data.session_id;
    document.getElementById("session-id-display").textContent = "Session: " + sessionId.slice(0, 8);
    show("session-bar");

    // Populate Node 2
    document.getElementById("node2-summary").textContent =
      "Keywords extracted: " + data.data.keywords.length + " concepts identified from your problem.";

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
    alert("Error: " + e.message);
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
  if (desc.length < 10) return alert("Please provide a more detailed description.");

  showLoading("Synthesizing your vision...");
  try {
    const data = await api("POST", "/node2", {
      session_id: sessionId,
      detailed_description: desc,
      intent: selectedIntent,
    });

    document.getElementById("node2-summary").textContent = data.message;
    goToNode(3);
  } catch (e) {
    alert("Error: " + e.message);
  } finally {
    hideLoading();
  }
}

// === Node 3 ===

async function submitConceptBank() {
  const attr = document.getElementById("critical-attr").value.trim();
  if (!attr) return alert("Please define a critical attribute.");

  showLoading("Generating 20 alien concepts...");
  try {
    const data = await api("POST",
      `/node3/concept-bank?session_id=${sessionId}&critical_attribute=${encodeURIComponent(attr)}`);

    const grid = document.getElementById("concept-bank");
    grid.innerHTML = "";
    data.data.concept_bank.forEach(concept => {
      const chip = document.createElement("div");
      chip.className = "concept-chip";
      chip.textContent = concept;
      chip.onclick = () => chip.classList.toggle("selected");
      grid.appendChild(chip);
    });

    hide("node3a");
    show("node3b");
  } catch (e) {
    alert("Error: " + e.message);
  } finally {
    hideLoading();
  }
}

async function submitSelection() {
  const selected = Array.from(document.querySelectorAll(".concept-chip.selected"))
    .map(c => c.textContent);

  if (selected.length < 1 || selected.length > 5) {
    return alert("Select between 1 and 5 entities.");
  }

  showLoading("Scoring entities with 6 sub-agents...");
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
    alert("Error: " + e.message);
  } finally {
    hideLoading();
  }
}

function createScoreCard(entity, scores) {
  const card = document.createElement("div");
  card.className = "score-card";

  const agentScores = scores.agent_scores;
  const bars = [
    { key: "DC", val: agentScores.dc, color: "#e040fb" },
    { key: "NC", val: agentScores.nc, color: "#ce93d8" },
    { key: "T", val: agentScores.t, color: "#ab47bc" },
    { key: "VS", val: agentScores.vs, color: "#00e5ff" },
    { key: "MP", val: agentScores.mp, color: "#26c6da" },
    { key: "PCF", val: agentScores.pcf, color: "#00bcd4" },
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
      <div class="master-score"><div class="value ps-color">${scores.ps.toFixed(3)}</div><div class="label">PS (Serendipity)</div></div>
      <div class="master-score"><div class="value ci-color">${scores.ci.toFixed(3)}</div><div class="label">CI (Quality)</div></div>
      <div class="master-score"><div class="value vi-color">${scores.vi.toFixed(4)}</div><div class="label">VI (Innovation)</div></div>
      <div class="master-score"><div class="value pen-color">${scores.penalty.toFixed(2)}</div><div class="label">Penalty</div></div>
    </div>
  `;
  return card;
}

// === Node 4: Chat ===

function selectModality(btn) {
  document.querySelectorAll(".btn-mod").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  selectedModality = btn.dataset.mod;
}

function addChatMsg(role, text) {
  const area = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = "chat-msg " + role;
  div.textContent = text;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

async function submitChat() {
  const input = document.getElementById("chat-input");
  const msg = input.value.trim();
  if (!msg) return;

  addChatMsg("user", msg);
  input.value = "";

  showLoading("Thinking...");
  try {
    const data = await api("POST", "/node4", {
      session_id: sessionId,
      modality: selectedModality,
      confidence: parseInt(document.getElementById("confidence").value),
      user_message: msg,
    });

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
    addChatMsg("assistant", "Error: " + e.message);
  } finally {
    hideLoading();
  }
}

// Enter key sends chat
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("chat-input").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitChat();
    }
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

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);

    if (e.edge_type === "serendipitous") {
      ctx.strokeStyle = "#e040fb";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
    } else if (e.edge_type === "anchoring") {
      ctx.strokeStyle = "#00e5ff";
      ctx.setLineDash([]);
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = "#444466";
      ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // Draw nodes
  const colors = { concept: "#22c55e", entity: "#e040fb", process: "#00e5ff" };

  nodes.forEach(n => {
    const p = positions[n.id];
    if (!p) return;
    const color = colors[n.node_type] || "#7c5cfc";
    const r = n.node_type === "concept" ? 24 : 18;

    // Glow
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = color + "22";
    ctx.fill();

    // Circle
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#12121a";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = "#e0e0e8";
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "center";
    const label = n.label.length > 20 ? n.label.slice(0, 18) + "..." : n.label;
    ctx.fillText(label, p.x, p.y + r + 16);
  });
}
