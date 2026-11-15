/* Epistemic cards: a spread can live in any container. One refresh budget per session. */

const spreads = [];
let refreshTokens = 2;
let idleRefreshes = 0;
let interacted = false;
let cooldownTimer = null;
let artSeq = 0;
let zoomCard = null;
let zoomSpread = null;

const PALETTE = ["#1A3A8F", "#C5A059", "#8F1A1A", "#3D5CB5", "#8D7040", "#6E1212", "#0E245C", "#B54545"];
const RADAR_KEYS = ["abstraction", "connectivity", "novelty", "applicability", "epistemic_confidence", "conceptual_distance"];
const RADAR_LABELS = ["radarAbs", "radarCon", "radarNov", "radarApp", "radarEpi", "radarDis"];

function domainColor(domain) {
  const text = domain || "vognis";
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function artSVG(name, color, id) {
  let h = 0;
  for (const ch of name || "") h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const marks = [];
  for (let i = 0; i < 4; i++) {
    const r = 18 + ((h >> (i * 4)) % 40);
    const cx = 30 + ((h >> i) % 140);
    const cy = 24 + ((h >> (i + 3)) % 150);
    marks.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-opacity=".6" stroke-width="1.2"/>`);
  }
  const ax = 30 + (h % 90);
  const ay = 250 - (h % 70);
  marks.push(`<path d="M16 ${ay} Q ${ax} 20 184 ${ay - 30}" fill="none" stroke="${color}" stroke-opacity=".45"/>`);
  return `<svg viewBox="0 0 200 280" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="cg${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".4"/>
      <stop offset="1" stop-color="#fafafa" stop-opacity=".05"/>
    </linearGradient></defs>
    <rect width="200" height="280" fill="url(#cg${id})"/>
    ${marks.join("")}
  </svg>`;
}

function radarSVG(radar) {
  const cx = 100;
  const cy = 78;
  const R = 48;
  const pt = (i, scale) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [cx + Math.cos(a) * R * scale, cy + Math.sin(a) * R * scale];
  };
  let rings = "";
  for (const scale of [0.35, 0.7, 1]) {
    const ring = RADAR_KEYS.map((_, i) => pt(i, scale).map(n => n.toFixed(1)).join(",")).join(" ");
    rings += `<polygon points="${ring}" fill="none" stroke="rgba(26,58,143,.25)"/>`;
  }
  const value = RADAR_KEYS.map((key, i) => pt(i, Number((radar || {})[key]) || 0).map(n => n.toFixed(1)).join(",")).join(" ");
  return `<svg class="radar-svg" viewBox="0 0 200 160">${rings}<polygon points="${value}" fill="rgba(26,58,143,.25)" stroke="#1A3A8F"/></svg>`;
}

function renderRefreshCount() {
  document.querySelectorAll(".refresh-count").forEach(el => {
    el.textContent = refreshTokens + " " + t("refreshes");
  });
  document.querySelectorAll(".btn-reshuffle").forEach(btn => {
    btn.disabled = refreshTokens <= 0 || !!cooldownTimer;
  });
}

function noteCardInteraction() {
  if (!interacted) {
    interacted = true;
    if (refreshTokens < 2) refreshTokens += 1;
    renderRefreshCount();
  }
  idleRefreshes = 0;
  document.querySelectorAll(".spread .nudge").forEach(el => el.classList.add("hidden"));
}

function startCooldown(spreadRoot) {
  document.querySelectorAll(".cooldown-bar").forEach(bar => bar.classList.add("hidden"));
  const bar = spreadRoot.querySelector(".cooldown-bar");
  const fill = bar.querySelector("i");
  bar.classList.remove("hidden");
  fill.style.transition = "none";
  fill.style.width = "100%";
  requestAnimationFrame(() => {
    fill.style.transition = "width 12s linear";
    fill.style.width = "0%";
  });
  clearTimeout(cooldownTimer);
  if (typeof track === "function") track("cooldown_start", { seconds: 12 }, { author: "client" });
  cooldownTimer = setTimeout(() => {
    cooldownTimer = null;
    bar.classList.add("hidden");
    renderRefreshCount();
  }, 12000);
  renderRefreshCount();
}

function createSpread(container, options) {
  const opts = options || {};
  const parentId = opts.parentId || null;
  const chosen = new Set();
  let cards = [];

  const root = document.createElement("div");
  root.className = "spread";
  root.innerHTML = `
    <div class="label-row center">
      <p class="instruction pick-line"></p>
      <button type="button" class="help-q" data-help="pickHelp">?</button>
    </div>
    <div class="concept-grid"></div>
    <div class="spread-actions">
      <button type="button" class="btn-ghost btn-rotate"><span class="spin-icon" aria-hidden="true">&#8635;</span> <span class="rotate-label"></span></button>
      <p class="spread-hint hint-line"></p>
      <button type="button" class="btn-ghost btn-reshuffle"><span aria-hidden="true">&#9776;</span> <span class="reshuffle-label"></span></button>
      <p class="refresh-count"></p>
      <div class="cooldown-bar hidden"><i></i></div>
    </div>
    <div class="nudge hidden">
      <p class="nudge-line"></p>
      <button type="button" class="btn-ghost nudge-back"></button>
    </div>`;
  container.appendChild(root);

  const grid = root.querySelector(".concept-grid");

  function relabel() {
    root.querySelector(".pick-line").textContent = t("pick");
    root.querySelector(".rotate-label").textContent = t("rotate");
    root.querySelector(".hint-line").textContent = t("sameIngredients");
    root.querySelector(".reshuffle-label").textContent = t("reshuffle");
    root.querySelector(".nudge-line").textContent = t("nudge");
    root.querySelector(".nudge-back").textContent = t("backToAttribute");
    renderRefreshCount();
    render();
  }

  function render() {
    if (!root.isConnected) return;
    grid.innerHTML = "";
    cards.forEach((card, index) => {
      const color = domainColor(card.domain);
      const wrap = document.createElement("article");
      wrap.className = "ep-card" + (chosen.has(card.name) ? " chosen" : "");
      wrap.dataset.name = card.name;
      wrap.style.animationDelay = (index * 0.06) + "s";
      wrap.innerHTML = `
        <button type="button" class="pick-dot"></button>
        <div class="ep-face">
          <div class="ep-art">${artSVG(card.name, color, artSeq++)}</div>
          <h3 class="ep-name"></h3>
          <p class="ep-seed"></p>
          <p class="ep-domain"></p>
        </div>`;
      wrap.querySelector(".ep-name").textContent = card.name;
      wrap.querySelector(".ep-seed").textContent = card.seed || "";
      wrap.querySelector(".ep-domain").textContent = card.domain || "";
      const dot = wrap.querySelector(".pick-dot");
      dot.setAttribute("aria-label", chosen.has(card.name) ? t("remove") : t("choose"));
      dot.onclick = (event) => {
        event.stopPropagation();
        toggle(card.name);
      };
      wrap.onclick = () => openCardZoom(card, wrap, handle);
      grid.appendChild(wrap);
    });
  }

  function persist() {
    if (opts.onCards) opts.onCards(cards.slice(), [...chosen]);
  }

  function toggle(name) {
    if (chosen.has(name)) chosen.delete(name);
    else if (chosen.size >= 5) {
      if (typeof track === "function") track("card_toggle_refused", { name, parent_id: parentId, chosen: [...chosen] });
      return alert(t("needSelection"));
    }
    else chosen.add(name);
    if (typeof track === "function") track("card_toggle", { name, picked: chosen.has(name), parent_id: parentId, chosen: [...chosen] });
    noteCardInteraction();
    render();
    persist();
    paintZoomPick();
  }

  async function load(mode) {
    const attr = opts.getAttribute ? opts.getAttribute() : "";
    if (!attr) {
      alert(t("needAttribute"));
      return false;
    }
    showSpiral();
    const started = Date.now();
    try {
      let path = `/node3/concept-bank?session_id=${sessionId}&critical_attribute=${encodeURIComponent(attr)}&mode=${mode || "new"}`;
      if (parentId) path += `&parent_id=${encodeURIComponent(parentId)}`;
      const source = opts.attributeField && typeof sourceOf === "function" ? sourceOf(opts.attributeField()) : "";
      if (source) path += `&input_source=${encodeURIComponent(source)}`;
      const data = await api("POST", path);
      const wait = Math.max(0, 2400 - (Date.now() - started));
      await new Promise(resolve => setTimeout(resolve, wait));
      cards = (data.data.concept_bank || []).map(card => Object.assign({ received_at: Date.now() }, card));
      const keep = new Set([...chosen].filter(name => cards.some(card => card.name === name)));
      chosen.clear();
      keep.forEach(name => chosen.add(name));
      render();
      persist();
      if (typeof track === "function") track("spread_shown", { mode: mode || "new", parent_id: parentId, names: cards.map(card => card.name), kept: [...chosen] }, { author: "client" });
      return true;
    } catch (e) {
      if (!e.offline) alert(t("error") + ": " + e.message);
      return false;
    } finally {
      hideSpiral();
    }
  }

  function restore(nextCards, chosenList) {
    cards = nextCards || [];
    chosen.clear();
    (chosenList || []).forEach(name => {
      if (cards.some(card => card.name === name)) chosen.add(name);
    });
    render();
  }

  function refresh(mode) {
    if (mode === "new") {
      if (refreshTokens <= 0 || cooldownTimer) return;
      refreshTokens -= 1;
      startCooldown(root);
    }
    if (interacted) idleRefreshes = 1;
    else idleRefreshes += 1;
    interacted = false;
    root.querySelector(".nudge").classList.toggle("hidden", idleRefreshes < 3);
    if (typeof track === "function") track("spread_refresh", { mode, parent_id: parentId, tokens_left: refreshTokens, idle_refreshes: idleRefreshes, nudge_shown: idleRefreshes >= 3 });
    renderRefreshCount();
    load(mode);
  }

  root.querySelector(".btn-rotate").onclick = () => refresh("rotate");
  root.querySelector(".btn-reshuffle").onclick = () => refresh("new");
  root.querySelector(".nudge-back").onclick = () => {
    if (typeof track === "function") track("nudge_back", { parent_id: parentId });
    root.querySelector(".nudge").classList.add("hidden");
    if (opts.onBack) opts.onBack();
  };

  const handle = {
    element: root,
    parentId,
    load,
    restore,
    relabel,
    isChosen: (name) => chosen.has(name),
    toggle,
    getSelectedNames: () => [...chosen],
    getSelectedCards: () => cards.filter(card => chosen.has(card.name)),
  };
  spreads.push(handle);
  relabel();
  return handle;
}

function paintZoomPick() {
  const btn = document.getElementById("zoom-pick");
  if (!btn || !zoomCard || !zoomSpread) return;
  const on = zoomSpread.isChosen(zoomCard.name);
  btn.textContent = on ? t("remove") : t("choose");
}

function paintZoom(card) {
  const color = domainColor(card.domain);
  const face = document.querySelector("#card-zoom .zoom-face");
  face.querySelector(".zoom-art").innerHTML = artSVG(card.name, color, "zoom");
  face.querySelector(".zoom-name").textContent = card.name;
  face.querySelector(".zoom-seed").textContent = card.seed || "";
  face.querySelector(".zoom-domain").textContent = card.domain || "";
  const back = document.querySelector("#card-zoom .zoom-back");
  back.querySelector(".zoom-desc").textContent = card.description || card.seed || "";
  back.querySelector(".zoom-because").textContent = t("appearedBecause");
  back.querySelector(".zoom-reason").textContent = card.reasoning || "";
  document.querySelector("#card-zoom .zoom-stats").innerHTML = radarSVG(card.radar || {}) + RADAR_KEYS.map((key, i) => {
    const val = Number((card.radar || {})[key]) || 0;
    return `<p class="stat-row"><span>${t(RADAR_LABELS[i])}</span><b>${t(bandKey(val))}</b><span class="score-value">${val.toFixed(2)}</span></p>`;
  }).join("");
  document.getElementById("zoom-flip").textContent = t("flip");
  document.getElementById("zoom-close").textContent = t("close");
  paintZoomPick();
}

async function fillWiki(card) {
  const img = document.querySelector("#card-zoom .zoom-img");
  const more = document.querySelector("#card-zoom .zoom-more");
  const desc = document.querySelector("#card-zoom .zoom-desc");
  img.classList.add("hidden");
  const title = (card.wiki_title || card.name || "").replace(/ /g, "_");
  const search = `https://${lang}.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(card.wiki_title || card.name || "")}`;
  more.href = search;
  more.textContent = t("searchWiki");
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!res.ok || zoomCard !== card) {
      if (!res.ok) if (typeof track === "function") track("wiki_missing", { name: card.name, title, status: res.status }, { author: "client" });
      return;
    }
    const data = await res.json();
    if (!card.description && data.extract) desc.textContent = data.extract;
    if (data.thumbnail && data.thumbnail.source) {
      img.src = data.thumbnail.source;
      img.alt = card.name;
      img.classList.remove("hidden");
    }
    more.href = (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) || search;
    more.textContent = t("readMore");
    if (typeof track === "function") track("wiki_shown", {
      name: card.name,
      title: data.title || title,
      extract: data.extract || "",
      extract_shown: !card.description && !!data.extract,
      image: (data.thumbnail && data.thumbnail.source) || "",
      url: more.href,
    }, { author: "client" });
  } catch (err) { /* the search link stays */ }
}

function placeZoomStats() {
  const fly = document.querySelector("#card-zoom .zoom-card");
  const stats = document.querySelector("#card-zoom .zoom-stats");
  if (!fly || !stats) return;
  const rect = fly.getBoundingClientRect();
  const statsWidth = Math.min(280, window.innerWidth * 0.3);
  if (rect.right + 16 + statsWidth < window.innerWidth - 8) {
    stats.style.left = (rect.right + 16) + "px";
    stats.style.top = rect.top + "px";
    stats.style.width = statsWidth + "px";
    stats.style.bottom = "auto";
  } else {
    stats.style.left = Math.max(12, (window.innerWidth - Math.min(rect.width, window.innerWidth - 24)) / 2) + "px";
    stats.style.top = "auto";
    stats.style.bottom = "5.2rem";
    stats.style.width = Math.min(rect.width, window.innerWidth - 24) + "px";
  }
}

function openCardZoom(card, origin, spreadApi) {
  noteCardInteraction();
  if (typeof track === "function") track("card_zoom_open", { name: card.name, parent_id: spreadApi ? spreadApi.parentId : null });
  zoomCard = card;
  zoomSpread = spreadApi;
  const layer = document.getElementById("card-zoom");
  const fly = layer.querySelector(".zoom-card");
  fly.classList.remove("flipped");
  paintZoom(card);
  layer.classList.remove("hidden");
  const from = origin.getBoundingClientRect();
  const w = Math.min(380, window.innerWidth * 0.8);
  const h = w * 1.5;
  fly.style.transition = "none";
  fly.style.left = from.left + "px";
  fly.style.top = from.top + "px";
  fly.style.width = from.width + "px";
  fly.style.height = from.height + "px";
  requestAnimationFrame(() => {
    fly.style.transition = "left .45s ease, top .45s ease, width .45s ease, height .45s ease";
    fly.style.width = w + "px";
    fly.style.height = h + "px";
    fly.style.left = ((window.innerWidth - w) / 2) + "px";
    fly.style.top = Math.max(16, (window.innerHeight - h) / 2 - 28) + "px";
    fly.addEventListener("transitionend", placeZoomStats, { once: true });
    setTimeout(placeZoomStats, 480);
  });
  fillWiki(card);
}

function closeCardZoom() {
  const layer = document.getElementById("card-zoom");
  if (!layer || layer.classList.contains("hidden")) return;
  if (typeof track === "function") track("card_zoom_close", { name: zoomCard ? zoomCard.name : "" });
  layer.classList.add("hidden");
  layer.querySelector(".zoom-card").classList.remove("flipped");
  zoomCard = null;
  zoomSpread = null;
}

function spiralPath() {
  let d = "";
  const steps = 220;
  for (let i = 0; i <= steps; i++) {
    const turn = (i / steps) * 3 * Math.PI * 2;
    const radius = 5 * Math.exp(0.2 * turn);
    const x = 200 + radius * Math.cos(turn);
    const y = 200 + radius * Math.sin(turn);
    d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1) + " ";
  }
  return d;
}

let spiralFrame = 0;

function showSpiral() {
  const svg = document.getElementById("spiral-svg");
  svg.innerHTML = `<path id="spiral-path" d="${spiralPath()}"/>`;
  const path = document.getElementById("spiral-path");
  const len = path.getTotalLength();
  path.style.strokeDasharray = String(len);
  path.style.strokeDashoffset = String(len);
  const layer = document.getElementById("spiral");
  layer.classList.remove("hidden", "pulse");
  const started = performance.now();
  const labels = [[0, "layer1"], [800, "layer2"], [1800, "layer3"]];
  const tick = (now) => {
    const elapsed = now - started;
    const progress = Math.min(1, elapsed / 3000);
    path.style.strokeDashoffset = String(len * (1 - progress));
    const key = labels.filter(item => elapsed >= item[0]).pop();
    document.getElementById("spiral-label").textContent = t(key[1]);
    if (progress < 1) spiralFrame = requestAnimationFrame(tick);
    else layer.classList.add("pulse");
  };
  spiralFrame = requestAnimationFrame(tick);
}

function hideSpiral() {
  cancelAnimationFrame(spiralFrame);
  const layer = document.getElementById("spiral");
  layer.classList.add("hidden");
  layer.classList.remove("pulse");
}

setInterval(() => {
  if (refreshTokens < 2) {
    refreshTokens += 1;
    renderRefreshCount();
  }
}, 60000);

document.addEventListener("DOMContentLoaded", () => {
  const layer = document.getElementById("card-zoom");
  if (!layer) return;
  layer.addEventListener("click", (event) => {
    if (event.target === layer) closeCardZoom();
  });
  document.getElementById("zoom-close").onclick = closeCardZoom;
  document.getElementById("zoom-flip").onclick = () => {
    const flipped = layer.querySelector(".zoom-card").classList.toggle("flipped");
    if (typeof track === "function") track("card_flip", { name: zoomCard ? zoomCard.name : "", back: flipped });
  };
  document.getElementById("zoom-pick").onclick = () => {
    if (zoomCard && zoomSpread) zoomSpread.toggle(zoomCard.name);
  };
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const layer = document.getElementById("card-zoom");
  if (!layer || layer.classList.contains("hidden")) return;
  closeCardZoom();
  event.stopImmediatePropagation();
});

onLang(() => {
  spreads.forEach(spread => {
    if (spread.element.isConnected) spread.relabel();
  });
  renderRefreshCount();
  if (zoomCard) paintZoom(zoomCard);
});
