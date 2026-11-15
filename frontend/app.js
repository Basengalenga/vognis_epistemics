const API = location.protocol + "//" + location.hostname + ":8000/api/v1";
const HISTORY_KEY = "vognis-history";
let sessionId = null;
let selectedIntent = "creativity";
let flow = "create";
let decideOptions = ["", ""];
let decideStance = -1;
let decideConfidence = 0;
let decideFinalStance = -1;
let decideFinalConfidence = 0;
let decideClosing = false;
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
    if (flow === "decide") {
      const row = document.createElement("div");
      row.className = "diamond-row";
      decideOptions.forEach((text, index) => {
        const written = text.trim();
        if (!written) return;
        const claim = claimNode(written, "user");
        if (index === decideStance) claim.classList.add("is-stance");
        row.appendChild(claim);
      });
      if (row.childElementCount) map.appendChild(row);
    }
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
  if (typeof track === "function") track("node_view", { node: n }, { author: "client" });
  document.getElementById("btn-finish").classList.toggle("hidden", n < 2);
  setTimeout(() => current.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
}

let previewMode = false;

async function api(method, path, body) {
  if (previewMode) {
    showNotice(t("previewBlocked"));
    throw new Error(t("previewBlocked"));
  }
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
      if (typeof track === "function") track("api_error", { method, path, offline: true }, { author: "client" });
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
    if (typeof track === "function") track("api_error", { method, path, status: res.status, detail: String(detail).slice(0, 500) }, { author: "client" });
    throw new Error(detail);
  }
  return res.json();
}

async function submitNode1() {
  const problem = document.getElementById("problem").value.trim();
  if (problem.length < 10) return alert(t("needProblem"));

  const themes = document.getElementById("themes").value
    .split(",").map(item => item.trim()).filter(Boolean);

  const payload = {
    problem,
    expertise_level: document.getElementById("expertise").value,
    interest_themes: themes,
    intent_hint: document.getElementById("intent-hint").value,
    lang,
    flow,
    input_source: typeof sourceById === "function" ? {
      problem: sourceById("problem"),
      themes: sourceById("themes"),
    } : {},
  };
  if (flow === "decide") {
    readDecideOptions();
    const written = decideOptions.map(item => item.trim()).filter(item => item.length >= 2);
    if (written.length < 2) return alert(t("needOptions"));
    if (decideStance < 0 || !decideOptions[decideStance] || decideOptions[decideStance].trim().length < 2) return alert(t("needStance"));
    if (!decideConfidence) return alert(t("needConfidence"));
    payload.options = decideOptions.map(item => item.trim()).filter(Boolean).slice(0, 4);
    payload.stance = decideOptions[decideStance].trim();
    payload.confidence = decideConfidence;
    payload.interest_themes = [];
  }

  showLoading(t("loadingKeywords"));
  try {
    const data = await api("POST", "/node1", payload);

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
  if (typeof track === "function") track("intent_pick", { intent: selectedIntent });
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
      input_source: typeof sourceById === "function" ? { description: sourceById("detailed-desc") } : {},
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
    attributeField: () => document.getElementById("critical-attr"),
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
      input_source: typeof sourceById === "function" ? { attribute: sourceById("critical-attr") } : {},
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
  if (typeof sendLate === "function") sendLate(entry.id, "next_day_feedback", entry.feedback);
  document.getElementById("yesterday-note").value = "";
  document.getElementById("yesterday-thanks").classList.remove("hidden");
  feedbackEntry = null;
  setTimeout(showYesterday, 900);
}

function snoozeFeedback() {
  localStorage.setItem("vognis-feedback-snooze", new Date().toDateString());
  hide("yesterday");
}

function confidenceWords() {
  return [t("c1"), t("c2"), t("c3"), t("c4"), t("c5")];
}

function paintScale(container, name, current, onPick) {
  if (!container) return;
  container.innerHTML = "";
  confidenceWords().forEach((label, index) => {
    const value = index + 1;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.id = name + "-" + value;
    input.value = String(value);
    input.checked = current === value;
    const lab = document.createElement("label");
    lab.htmlFor = input.id;
    lab.textContent = label;
    if (current === value) lab.classList.add("active");
    input.addEventListener("change", () => onPick(value));
    container.appendChild(input);
    container.appendChild(lab);
  });
}

function paintDecideConfidence() {
  paintScale(document.getElementById("decide-confidence"), "decide-confidence", decideConfidence, value => {
    decideConfidence = value;
    paintDecideConfidence();
  });
}

function readDecideOptions() {
  const list = document.getElementById("decide-option-list");
  if (!list) return;
  const fields = [...list.querySelectorAll("input[type='text']")];
  if (!fields.length) return;
  decideOptions = fields.map(field => field.value);
  const stance = list.querySelector("input[type='radio']:checked");
  if (stance) decideStance = Number(stance.value);
}

function renderDecideOptions() {
  const list = document.getElementById("decide-option-list");
  if (!list) return;
  list.innerHTML = "";
  decideOptions.forEach((text, index) => {
    const row = document.createElement("div");
    row.className = "decide-option" + (index === decideStance ? " is-stance" : "");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "decide-stance";
    radio.value = String(index);
    radio.checked = index === decideStance;
    radio.title = t("stance");
    radio.addEventListener("change", () => {
      readDecideOptions();
      decideStance = index;
      renderDecideOptions();
    });
    const field = document.createElement("input");
    field.type = "text";
    field.value = text;
    field.placeholder = t("optionPh");
    field.addEventListener("input", () => { decideOptions[index] = field.value; });
    if (typeof attachVoice === "function") attachVoice(field);
    row.appendChild(radio);
    row.appendChild(field);
    if (decideOptions.length > 2) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn-ghost";
      remove.textContent = t("remove");
      remove.addEventListener("click", () => {
        readDecideOptions();
        decideOptions.splice(index, 1);
        if (decideStance === index) decideStance = -1;
        else if (decideStance > index) decideStance -= 1;
        renderDecideOptions();
      });
      row.appendChild(remove);
    }
    list.appendChild(row);
  });
  const add = document.getElementById("decide-add-option");
  if (add) add.classList.toggle("hidden", decideOptions.length >= 4);
  paintDecideConfidence();
}

function startDecide() {
  flow = "decide";
  document.body.classList.add("flow-decide");
  decideOptions = ["", ""];
  decideStance = -1;
  decideConfidence = 0;
  decideFinalStance = -1;
  decideFinalConfidence = 0;
  decideClosing = false;
  startCreate();
  renderDecideOptions();
  if (typeof applyI18n === "function") applyI18n();
}

function todayStamp() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + month + "-" + day;
}

function paintFinalStances() {
  const box = document.getElementById("decide-final-stances");
  if (!box) return;
  box.innerHTML = "";
  decideOptions.forEach((text, index) => {
    const written = text.trim();
    if (written.length < 2) return;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "decide-final-stance";
    input.id = "decide-final-" + index;
    input.value = String(index);
    input.checked = decideFinalStance === index;
    const lab = document.createElement("label");
    lab.htmlFor = input.id;
    lab.textContent = written;
    if (decideFinalStance === index) lab.classList.add("active");
    input.addEventListener("change", () => {
      decideFinalStance = index;
      paintFinalStances();
      const after = document.getElementById("decide-after");
      if (after) after.textContent = written + " · " + (decideFinalConfidence || "");
    });
    box.appendChild(input);
    box.appendChild(lab);
  });
}

function paintFinalConfidence() {
  paintScale(document.getElementById("decide-final-confidence"), "decide-final-confidence", decideFinalConfidence, value => {
    decideFinalConfidence = value;
    paintFinalConfidence();
    const after = document.getElementById("decide-after");
    const stance = decideOptions[decideFinalStance];
    if (after) after.textContent = ((stance || "").trim()) + " · " + value;
  });
}

function showDecideClose() {
  readDecideOptions();
  const before = document.getElementById("decide-before");
  if (before) before.textContent = ((decideOptions[decideStance] || "").trim()) + " · " + decideConfidence;
  const after = document.getElementById("decide-after");
  if (after) after.textContent = "";
  paintFinalStances();
  paintFinalConfidence();
  hide("workspace");
  document.getElementById("trail").classList.add("hidden");
  show("closing");
  decideClosing = true;
}

function decideCloseError() {
  const abandon = document.getElementById("decide-abandon").value.trim();
  const date = document.getElementById("decide-review").value;
  if (decideFinalStance < 0 || !decideFinalConfidence) return t("needFinal");
  if (!(decideOptions[decideFinalStance] || "").trim()) return t("needFinal");
  if (abandon.length < 8) return t("needAbandon");
  if (!date || date < todayStamp()) return t("needDate");
  return "";
}

function decideCloseBody() {
  return {
    final_stance: decideOptions[decideFinalStance].trim(),
    final_confidence: decideFinalConfidence,
    abandonment: document.getElementById("decide-abandon").value.trim(),
    review_date: document.getElementById("decide-review").value,
  };
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
  const lines = ["# Vognis", "", data.summary || ""];
  if (flow === "decide") {
    lines.push("", "## " + t("before"), ((decideOptions[decideStance] || "").trim()) + " · " + decideConfidence);
    lines.push("", "## " + t("after"), ((decideOptions[decideFinalStance] || "").trim()) + " · " + decideFinalConfidence);
    const abandon = document.getElementById("decide-abandon");
    if (abandon && abandon.value.trim()) lines.push("", "## " + t("abandon"), abandon.value.trim());
  }
  lines.push("", "## " + t("bridges"));
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
  if (flow === "decide" && !decideClosing) {
    if (!sessionId && !previewMode) return;
    showDecideClose();
    return;
  }
  if (!sessionId) return;
  let body = null;
  if (flow === "decide") {
    const error = decideCloseError();
    if (error) return alert(error);
    body = decideCloseBody();
  }
  showLoading(t("ending"));
  try {
    if (typeof track === "function") {
      track("finish", { flow });
      await flushLogNow();
    }
    const data = await api("POST", "/session/" + sessionId + "/finish", body);
    const stamp = new Date().toISOString().slice(0, 10);
    rememberHistory(data.summary || "");
    downloadFile("vognis-sesion-" + stamp + ".json", JSON.stringify(data.record, null, 2), "application/json");
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
  const previewParams = new URLSearchParams(location.search);
  if (previewParams.has("preview")) openPreview(previewParams.get("flow") === "decide");
  const decideOrb = document.getElementById("orb-decide");
  if (decideOrb) {
    decideOrb.addEventListener("mouseenter", () => {
      const rect = decideOrb.getBoundingClientRect();
      constellationFocus(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    decideOrb.addEventListener("mouseleave", () => constellationFocus(null, null));
  }
  const addOption = document.getElementById("decide-add-option");
  if (addOption) addOption.addEventListener("click", () => {
    readDecideOptions();
    if (decideOptions.length >= 4) return;
    decideOptions.push("");
    renderDecideOptions();
  });
  const decideFinish = document.getElementById("btn-decide-finish");
  if (decideFinish) decideFinish.addEventListener("click", () => finishSession());
  if (typeof onLang === "function") {
    onLang(() => {
      if (flow !== "decide") return;
      readDecideOptions();
      renderDecideOptions();
      if (decideClosing) {
        paintFinalStances();
        paintFinalConfidence();
      }
    });
  }
  function openPreview(deciding) {
    previewMode = true;
    document.body.classList.add("preview-mode");
    if (deciding) startDecide();
    else startCreate();
    const note = document.createElement("p");
    note.className = "preview-note";
    note.dataset.i18n = "previewNote";
    note.textContent = t("previewNote");
    document.getElementById("workspace").prepend(note);

    if (deciding) {
      decideOptions = ["Lo dejo este año", "Espero a que cierre el proyecto"];
      decideStance = 0;
      decideConfidence = 3;
      decideFinalStance = 0;
      decideFinalConfidence = 4;
      renderDecideOptions();
    }
    document.getElementById("problem").value = deciding
      ? "Si dejo el trabajo este año o espero a que cierre el proyecto."
      : "Los parques de la ciudad se vuelven inutilizables durante una ola de calor.";
    document.getElementById("themes").value = deciding ? "" : "sombra, calor, refugio";
    document.getElementById("expertise").value = "intermediate";
    document.getElementById("intent-hint").value = "balance";
    document.getElementById("detailed-desc").value = deciding
      ? "Lo que está en juego es el sueldo de este año. Si no decido, el proyecto sigue y yo sigo en el mismo puesto."
      : "Que el parque siga siendo un lugar para estar cuando el sol pega fuerte. La gente tiene que poder quedarse, no solo cruzarlo.";
    document.getElementById("node2-summary").textContent = deciding
      ? "La decisión es si el año se usa para irse o para cerrar el proyecto."
      : "El parque tiene que seguir siendo un lugar para estar cuando el sol pega fuerte.";
    const keywords = document.getElementById("node2-keywords");
    (deciding ? ["sueldo", "proyecto", "tiempo", "salida"] : ["sombra", "calor", "refugio", "isla de calor"]).forEach(word => {
      const tag = document.createElement("span");
      tag.className = "keyword-tag";
      tag.textContent = word;
      keywords.appendChild(tag);
    });
    document.querySelectorAll(".btn-intent").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.intent === "balance");
    });
    selectedIntent = "balance";
    document.getElementById("critical-attr").value = deciding
      ? "Que el proyecto cierre en seis meses."
      : "Antes, una herida infectada terminaba en amputación; con los antibióticos, se podía tratar.";

    ["node1", "node2", "node3"].forEach(id => {
      const section = document.getElementById(id);
      section.classList.add("revealed");
      section.classList.remove("settled", "active");
    });
    hide("node3a");
    show("node3b");
    document.getElementById("btn-finish").classList.add("hidden");

    const sampleCards = (deciding ? [
      ["Contratos de opción", "Un plazo fijo para decidir, con un costo si se deja pasar.", "Finanzas"],
      ["Migración de aves", "La salida ocurre cuando la estación ya cambió, no cuando el ave lo desea.", "Etología"],
      ["Relevo en el teatro", "El actor que entra no espera a que la obra termine.", "Artes escénicas"],
      ["Mareas", "El momento de zarpar lo marca el agua, no el calendario del puerto.", "Navegación"],
      ["Semillas de fuego", "Algunas plantas solo germinan después de que el incendio pasó.", "Ecología"],
      ["Compases de espera", "En música, el silencio también es una decisión de tiempo.", "Música"],
    ] : [
      ["Pérgolas bioclimáticas", "Lamas que se cierran cuando el sol ya lastima.", "Arquitectura adaptativa"],
      ["Bosques urbanos de crecimiento rápido", "Sombra que llega antes de que el árbol envejezca.", "Silvicultura"],
      ["Memoria de fase en ceras orgánicas", "Un material que guarda el calor del día y lo suelta de noche.", "Almacenamiento térmico"],
      ["Termorregulación de termitas", "Montículos que mantienen el interior fresco sin máquina.", "Biomimética"],
      ["Tejidos beduinos reflectantes", "Tela que bloquea el sol y deja pasar el aire.", "Tecnología textil"],
      ["Nebulizadores evaporativos", "Una nube fina que baja la temperatura del aire.", "Climatización"],
    ]).map(([name, seed, domain]) => ({ name, seed, domain, description: seed, layer: 2, radar: {} }));
    const spread = createSpread(document.getElementById("root-spread"), {
      parentId: null,
      getAttribute: () => document.getElementById("critical-attr").value,
    });
    const chosenNames = deciding
      ? ["Contratos de opción", "Migración de aves", "Relevo en el teatro"]
      : ["Pérgolas bioclimáticas", "Bosques urbanos de crecimiento rápido", "Memoria de fase en ceras orgánicas"];
    spread.restore(sampleCards, chosenNames);
    document.querySelectorAll(".btn-rotate, .btn-reshuffle, #btn-node1, #btn-node2, #branch-action, [onclick='submitSelection()']").forEach(btn => {
      btn.disabled = true;
    });

    const scores = {
      ps: 0.62, ci: 0.74, vi: 0.81, penalty: 1,
      agent_scores: { dc: 0.55, nc: 0.48, t: 0.7, vs: 0.66, mp: 0.8, pcf: 0.61 },
    };
    const ideas = sampleCards.slice(0, 3).map(card => ({
      id: card.name,
      name: card.name,
      seed: card.seed,
      parent_id: null,
      depth: 0,
      attribute: document.getElementById("critical-attr").value,
      scores,
    }));
    mountIdeas(ideas, false);
    const focusName = chosenNames[0];
    const focus = ideaNodes[focusName];
    focus.bridge = deciding
      ? "Un contrato de opción muestra que el plazo de seis meses es el supuesto, no la respuesta."
      : "Las lamas se cierran justo cuando el sol ya lastima el parque.";
    focus.modality = "development";
    focus.developments = [{
      modality: deciding ? "feedback" : "learning",
      user_message: deciding
        ? "¿Qué tan bien se sostiene mi razonamiento?"
        : "¿Qué conceptos debería entender para asentar mejor esto?",
      intro: deciding
        ? "Lo que escucho es que quieres ver si el plazo de seis meses sostiene la decisión, no cuál opción ganar."
        : "Lo que escucho es que quieres entender la idea antes de construirla.",
      cards: [{
        kind: "question",
        title: "Supuesto",
        body: deciding
          ? "¿Qué contarías como prueba de que el proyecto no cierra en seis meses?"
          : "¿Qué estás dando por hecho al decir que la sombra tiene que moverse?",
        concepts: [focusName],
      }],
    }];
    openMode[focusName] = "develop";
    renderTree();

    document.getElementById("closing-summary").textContent = deciding
      ? "El supuesto de los seis meses quedó a la vista. La postura no se movió, y nadie eligió por la persona."
      : "La sombra dejó de ser un extra y pasó a ser la manera de que el parque siga habitable. El puente de las lamas conecta esa idea con el calor del mediodía.";
    const bridges = document.getElementById("closing-bridges");
    bridges.innerHTML = "";
    const item = document.createElement("li");
    item.textContent = focus.bridge;
    if (deciding) {
      document.getElementById("decide-before").textContent = "Lo dejo este año · 3";
      document.getElementById("decide-after").textContent = "Lo dejo este año · 4";
      document.getElementById("decide-abandon").value = "Si en la revisión el proyecto ya tiene fecha de cierre dentro de seis meses.";
      document.getElementById("decide-review").value = todayStamp();
      paintFinalStances();
      paintFinalConfidence();
      document.getElementById("btn-decide-finish").disabled = true;
    }
    bridges.appendChild(item);
    show("closing");
    setTimeout(() => window.scrollTo(0, 0), 120);
  }

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
