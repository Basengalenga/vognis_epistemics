/* Idea tree: one column, sibling diamonds, one open branch. */

const ideaNodes = {};
const activeAt = {};
const openMode = {};

function childrenOf(parentId) {
  return Object.values(ideaNodes).filter(node => (node.parentId || null) === (parentId || null));
}

function dropChildren(parentId) {
  const doomed = new Set();
  let growing = true;
  while (growing) {
    growing = false;
    Object.values(ideaNodes).forEach(node => {
      if (doomed.has(node.id)) return;
      const direct = (node.parentId || null) === (parentId || null);
      const nested = node.parentId && doomed.has(node.parentId);
      if (direct || nested) {
        doomed.add(node.id);
        growing = true;
      }
    });
  }
  doomed.forEach(id => {
    delete ideaNodes[id];
    delete openMode[id];
  });
}

function pathOf(node) {
  const names = [];
  let current = node;
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.push(current.name);
    current = current.parentId ? ideaNodes[current.parentId] : null;
  }
  return names.reverse().join(" › ");
}

function ideaSnapshot() {
  return Object.values(ideaNodes).map(node => ({
    name: node.name,
    path: pathOf(node),
    attribute: node.attribute,
    seed: node.seed,
    developments: node.developments || [],
  }));
}

function activeIdeaId() {
  const depths = Object.keys(activeAt).map(Number).sort((a, b) => b - a);
  for (const depth of depths) {
    if (ideaNodes[activeAt[depth]]) return activeAt[depth];
  }
  return null;
}

function kindLabel(kind) {
  const map = {
    recommendation: "kindRecommendation",
    help: "kindHelp",
    question: "kindQuestion",
    risk: "kindRisk",
    step: "kindStep",
  };
  return t(map[kind] || "kindHelp");
}

function mountIdeas(ideas, replace) {
  if (!ideas || !ideas.length) return;
  const parentId = ideas[0].parent_id || null;
  if (replace) dropChildren(parentId);
  ideas.forEach(idea => {
    const card = idea.card || {};
    ideaNodes[idea.id] = {
      id: idea.id,
      parentId: idea.parent_id || null,
      name: idea.name || card.name || "",
      seed: idea.seed || card.seed || "",
      card,
      scores: idea.scores || null,
      attribute: idea.attribute || "",
      depth: idea.depth || 0,
      developments: ideaNodes[idea.id] ? ideaNodes[idea.id].developments : [],
      modality: "learning",
      confidence: 3,
      pendingCards: null,
      pendingChosen: [],
      pendingAttribute: "",
    };
  });
  const depth = ideas[0].depth || 0;
  activeAt[depth] = ideas[0].id;
  Object.keys(activeAt).forEach(key => {
    if (Number(key) > depth) delete activeAt[key];
  });
  renderTree();
  if (typeof rememberHistory === "function") rememberHistory();
  const el = document.getElementById("cluster-" + ideas[0].id);
  if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
}

function selectTab(depth, id) {
  activeAt[depth] = id;
  Object.keys(activeAt).forEach(key => {
    if (Number(key) > depth) delete activeAt[key];
  });
  renderTree();
}

function renderTabs(siblings, activeId, depth) {
  const row = document.createElement("div");
  row.className = "idea-tabs";
  siblings.forEach(node => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "idea-tab" + (node.id === activeId ? " active" : "");
    btn.textContent = node.name;
    btn.onclick = () => selectTab(depth, node.id);
    row.appendChild(btn);
  });
  return row;
}

function appendDevelopment(thread, dev) {
  const row = document.createElement("div");
  row.className = "dev-row";
  row.appendChild(claimNode(dev.user_message || "", "user"));
  const cards = document.createElement("div");
  cards.className = "dev-cards";
  if (dev.intro) {
    const intro = document.createElement("p");
    intro.className = "dev-intro";
    intro.textContent = dev.intro;
    cards.appendChild(intro);
  }
  (dev.cards || []).forEach(card => {
    const el = document.createElement("article");
    el.className = "reply-card" + (card.kind === "risk" ? " risk" : "");
    const kind = document.createElement("p");
    kind.className = "kind-tag";
    kind.textContent = kindLabel(card.kind);
    const title = document.createElement("h4");
    title.textContent = card.title || "";
    const body = document.createElement("p");
    body.textContent = card.body || "";
    el.append(kind, title, body);
    cards.appendChild(el);
  });
  row.appendChild(cards);
  thread.appendChild(row);
}

function renderDeepen(panel, node) {
  panel.dataset.step = node.id + ":deepen";
  panel.classList.add("open");
  panel.innerHTML = `
    <div class="field">
      <div class="label-row">
        <label></label>
        <button type="button" class="help-q" data-help="attributeHelp">?</button>
      </div>
      <input class="deep-attr" type="text">
    </div>
    <button type="button" class="btn-primary deep-ask"></button>
    <div class="deep-spread"></div>
    <div class="field deep-action hidden">
      <label class="attach-label"></label>
      <select class="deep-branch">
        <option value="branch"></option>
        <option value="edit"></option>
      </select>
    </div>
    <button type="button" class="btn-primary deep-attach hidden"></button>`;
  panel.querySelector("label").textContent = t("attribute");
  const input = panel.querySelector(".deep-attr");
  input.placeholder = t("attributePh");
  input.value = node.pendingAttribute || "";
  input.addEventListener("input", () => { node.pendingAttribute = input.value; });
  panel.querySelector(".deep-ask").textContent = t("askDistant");
  panel.querySelector(".attach-label").textContent = t("attachHow");
  panel.querySelector('option[value="branch"]').textContent = t("branch");
  panel.querySelector('option[value="edit"]').textContent = t("edit");
  panel.querySelector(".deep-attach").textContent = t("attach");
  const spread = createSpread(panel.querySelector(".deep-spread"), {
    parentId: node.id,
    getAttribute: () => input.value.trim(),
    onBack: () => input.focus(),
    onCards: (nextCards, chosen) => {
      node.pendingCards = nextCards;
      node.pendingChosen = chosen;
    },
  });
  const showAttach = () => {
    panel.querySelector(".deep-action").classList.remove("hidden");
    panel.querySelector(".deep-attach").classList.remove("hidden");
  };
  panel.querySelector(".deep-ask").onclick = async () => {
    const ok = await spread.load("new");
    if (ok) showAttach();
  };
  if (node.pendingCards && node.pendingCards.length) {
    spread.restore(node.pendingCards, node.pendingChosen || []);
    showAttach();
  }
  panel.querySelector(".deep-attach").onclick = () => submitChild(node, spread, panel);
}

async function submitChild(node, spread, panel) {
  const selected = spread.getSelectedCards();
  if (selected.length < 1 || selected.length > 5) return alert(t("needSelection"));
  const action = panel.querySelector(".deep-branch").value;
  const attribute = panel.querySelector(".deep-attr").value.trim();
  if (!attribute) return alert(t("needAttribute"));
  showLoading(t("loadingScore"));
  try {
    const data = await api("POST", "/node3/select", {
      session_id: sessionId,
      critical_attribute: attribute,
      selected_entities: selected.map(card => card.name),
      action,
      parent_id: node.id,
    });
    openMode[node.id] = null;
    node.pendingCards = null;
    node.pendingChosen = [];
    mountIdeas(data.data.ideas, action === "edit");
    if (typeof fetchGraph === "function") fetchGraph();
  } catch (e) {
    reportError(e);
  } finally {
    hideLoading();
  }
}

function renderDevelop(panel, node) {
  panel.dataset.step = node.id + ":develop";
  panel.classList.add("open");
  panel.innerHTML = `
    <div class="controls-bar">
      <div class="control-group">
        <div class="label-row">
          <span class="visually-hidden dev-mod-label"></span>
          <button type="button" class="help-q" data-help="devHelp">?</button>
        </div>
        <div class="modality-buttons"></div>
      </div>
      <div class="control-group">
        <label><span class="conf-label"></span>: <span class="conf-val"></span></label>
        <input type="range" min="1" max="5" class="conf-range">
        <div class="conf-labels"><span class="conf-safe"></span><span class="conf-radical"></span></div>
      </div>
    </div>
    <div class="dev-thread"></div>
    <div class="chat-input-area">
      <textarea class="dev-input" rows="2"></textarea>
      <button type="button" class="btn-send" aria-label="Send">&#8595;</button>
    </div>`;
  panel.querySelector(".dev-mod-label").textContent = t("modalityHelp");
  const modes = panel.querySelector(".modality-buttons");
  ["learning", "development", "feedback"].forEach(mode => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-mod" + (node.modality === mode ? " active" : "");
    btn.textContent = t(mode);
    btn.onclick = () => {
      node.modality = mode;
      modes.querySelectorAll(".btn-mod").forEach(other => other.classList.remove("active"));
      btn.classList.add("active");
    };
    modes.appendChild(btn);
  });
  panel.querySelector(".conf-label").textContent = t("confidence");
  panel.querySelector(".conf-safe").textContent = t("safe");
  panel.querySelector(".conf-radical").textContent = t("radical");
  const range = panel.querySelector(".conf-range");
  const confVal = panel.querySelector(".conf-val");
  range.value = String(node.confidence || 3);
  confVal.textContent = range.value;
  range.oninput = () => {
    node.confidence = parseInt(range.value, 10);
    confVal.textContent = range.value;
  };
  const thread = panel.querySelector(".dev-thread");
  (node.developments || []).forEach(dev => appendDevelopment(thread, dev));
  const input = panel.querySelector(".dev-input");
  input.placeholder = t("askPh");
  const send = () => sendDevelop(node, panel);
  panel.querySelector(".btn-send").onclick = send;
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  });
}

async function sendDevelop(node, panel) {
  const input = panel.querySelector(".dev-input");
  const msg = input.value.trim();
  if (!msg) return;
  input.value = "";
  showLoading(t("thinking"));
  try {
    const data = await api("POST", "/node4", {
      session_id: sessionId,
      modality: node.modality || "learning",
      confidence: node.confidence || 3,
      user_message: msg,
      focus_id: node.id,
    });
    const dev = {
      modality: node.modality,
      user_message: msg,
      intro: (data.data && data.data.intro) || "",
      cards: (data.data && data.data.cards) || [],
    };
    node.developments.push(dev);
    appendDevelopment(panel.querySelector(".dev-thread"), dev);
    if (data.scores) {
      node.scores = data.scores;
      const cluster = document.getElementById("cluster-" + node.id);
      if (cluster) {
        const force = cluster.querySelector(".idea-force");
        if (force) force.textContent = t(verdictKey(data.scores.ps, data.scores.ci));
        const box = cluster.querySelector(".idea-scores");
        if (box) {
          box.innerHTML = "";
          box.appendChild(createScoreCard(node.name, data.scores));
        }
      }
    }
    if (typeof fetchGraph === "function") fetchGraph();
  } catch (e) {
    reportError(e);
  } finally {
    hideLoading();
  }
}

function renderCluster(node) {
  const el = document.createElement("article");
  el.className = "idea-cluster";
  el.id = "cluster-" + node.id;
  const box = document.createElement("div");
  box.className = "idea-box";
  const title = document.createElement("h3");
  title.textContent = node.name;
  const seed = document.createElement("p");
  seed.className = "idea-seed";
  seed.textContent = node.seed || "";
  box.append(title, seed);
  const force = document.createElement("p");
  force.className = "idea-force";
  if (node.scores) force.textContent = t(verdictKey(node.scores.ps, node.scores.ci));
  const actions = document.createElement("div");
  actions.className = "idea-actions";
  const deepen = document.createElement("button");
  deepen.type = "button";
  deepen.className = "btn-ghost" + (openMode[node.id] === "deepen" ? " active" : "");
  deepen.textContent = t("deepen");
  deepen.onclick = () => {
    openMode[node.id] = openMode[node.id] === "deepen" ? null : "deepen";
    renderTree();
  };
  const develop = document.createElement("button");
  develop.type = "button";
  develop.className = "btn-ghost" + (openMode[node.id] === "develop" ? " active" : "");
  develop.textContent = t("develop");
  develop.onclick = () => {
    openMode[node.id] = openMode[node.id] === "develop" ? null : "develop";
    renderTree();
  };
  actions.append(deepen, develop);
  const scores = document.createElement("div");
  scores.className = "idea-scores";
  if (node.scores && typeof createScoreCard === "function") {
    scores.appendChild(createScoreCard(node.name, node.scores));
  }
  const panel = document.createElement("div");
  panel.className = "idea-panel";
  el.append(box, force, actions, scores, panel);
  if (openMode[node.id] === "deepen") renderDeepen(panel, node);
  if (openMode[node.id] === "develop") renderDevelop(panel, node);
  return el;
}

function renderTrail() {
  const nav = document.getElementById("trail");
  if (!nav) return;
  nav.innerHTML = "";
  if (!Object.keys(ideaNodes).length) {
    nav.classList.add("hidden");
    return;
  }
  nav.classList.remove("hidden");
  const bits = [{ label: t("problemCrumb"), target: "node1" }];
  let parentId = null;
  let depth = 0;
  while (depth < 12) {
    const siblings = childrenOf(parentId);
    if (!siblings.length) break;
    const id = siblings.some(node => node.id === activeAt[depth]) ? activeAt[depth] : siblings[0].id;
    bits.push({ label: ideaNodes[id].name, target: "cluster-" + id });
    parentId = id;
    depth += 1;
  }
  bits.forEach((bit, index) => {
    if (index) {
      const sep = document.createElement("span");
      sep.className = "trail-sep";
      sep.textContent = "›";
      nav.appendChild(sep);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = bit.label;
    btn.onclick = () => {
      const target = document.getElementById(bit.target);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    nav.appendChild(btn);
  });
}

function renderTree() {
  const host = document.getElementById("idea-tree");
  if (!host) return;
  host.innerHTML = "";
  let parentId = null;
  let depth = 0;
  while (depth < 12) {
    const siblings = childrenOf(parentId);
    if (!siblings.length) break;
    if (!siblings.some(node => node.id === activeAt[depth])) activeAt[depth] = siblings[0].id;
    const active = ideaNodes[activeAt[depth]];
    const level = document.createElement("section");
    level.className = "idea-level";
    level.appendChild(renderTabs(siblings, active.id, depth));
    level.appendChild(renderCluster(active));
    host.appendChild(level);
    parentId = active.id;
    depth += 1;
  }
  renderTrail();
}

onLang(() => {
  if (Object.keys(ideaNodes).length) renderTree();
});
