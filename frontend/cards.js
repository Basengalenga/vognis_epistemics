/* Epistemic cards: spread, Fibonacci wait, flip, Wikipedia. */

let currentSpread = [];
const chosenNames = new Set();
let refreshTokens = 2;
let idleRefreshes = 0;
let interacted = false;
let cooldownTimer = null;

const PALETTE = ["#1A3A8F", "#C5A059", "#8F1A1A", "#3D5CB5", "#8D7040", "#6E1212", "#0E245C", "#B54545"];

function domainColor(domain) {
  const text = domain || "vognis";
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function artSVG(name, color, id) {
  let h = 0;
  for (const ch of name) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const marks = [];
  for (let i = 0; i < 4; i++) {
    const r = 16 + ((h >> (i * 4)) % 36);
    const cx = 28 + ((h >> i) % 150);
    const cy = 18 + ((h >> (i + 3)) % 86);
    marks.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-opacity=".6" stroke-width="1.2"/>`);
  }
  const ax = 20 + (h % 80);
  const ay = 90 - (h % 40);
  marks.push(`<path d="M10 ${ay} Q ${ax} 10 190 ${ay - 20}" fill="none" stroke="${color}" stroke-opacity=".45"/>`);
  return `<svg viewBox="0 0 200 120" aria-hidden="true">
    <defs><linearGradient id="cg${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".4"/>
      <stop offset="1" stop-color="#fafafa" stop-opacity=".05"/>
    </linearGradient></defs>
    <rect width="200" height="120" fill="url(#cg${id})"/>
    ${marks.join("")}
  </svg>`;
}

function radarSVG(radar) {
  const keys = ["abstraction", "connectivity", "novelty", "applicability", "epistemic_confidence", "conceptual_distance"];
  const labels = ["radarAbs", "radarCon", "radarNov", "radarApp", "radarEpi", "radarDis"];
  const cx = 100;
  const cy = 78;
  const R = 48;
  const pt = (i, scale) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [cx + Math.cos(a) * R * scale, cy + Math.sin(a) * R * scale];
  };
  let rings = "";
  for (const scale of [0.35, 0.7, 1]) {
    const ring = keys.map((_, i) => pt(i, scale).map(n => n.toFixed(1)).join(",")).join(" ");
    rings += `<polygon points="${ring}" fill="none" stroke="rgba(26,58,143,.25)"/>`;
  }
  const value = keys.map((key, i) => pt(i, Number(radar[key]) || 0).map(n => n.toFixed(1)).join(",")).join(" ");
  const names = labels.map((key, i) => {
    const [x, y] = pt(i, 1.28);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="8" fill="#5c584f">${t(key)}</text>`;
  }).join("");
  return `<svg class="radar-svg" viewBox="0 0 200 160">${rings}<polygon points="${value}" fill="rgba(26,58,143,.25)" stroke="#1A3A8F"/></svg>${names ? `<svg class="radar-svg" viewBox="0 0 200 160" style="position:absolute;inset:0">${names}</svg>` : ""}`;
}

function renderRefreshCount() {
  const el = document.getElementById("refresh-count");
  if (el) el.textContent = refreshTokens + " " + t("refreshes");
  const reshuffle = document.getElementById("btn-reshuffle");
  if (reshuffle) reshuffle.disabled = refreshTokens <= 0 || cooldownTimer;
}

function noteCardInteraction() {
  if (!interacted) {
    interacted = true;
    if (refreshTokens < 2) refreshTokens += 1;
    renderRefreshCount();
  }
  idleRefreshes = 0;
  document.getElementById("refresh-nudge").classList.add("hidden");
}

function renderSpread(cards) {
  currentSpread = cards;
  const keep = new Set([...chosenNames].filter(name => cards.some(card => card.name === name)));
  chosenNames.clear();
  keep.forEach(name => chosenNames.add(name));
  const grid = document.getElementById("concept-bank");
  grid.innerHTML = "";
  cards.forEach((card, index) => {
    const color = domainColor(card.domain);
    const wrap = document.createElement("article");
    wrap.className = "ep-card" + (chosenNames.has(card.name) ? " chosen" : "");
    wrap.style.animationDelay = (index * 0.06) + "s";
    const when = new Date(card.received_at || Date.now()).toLocaleString(lang === "en" ? "en" : "es");
    wrap.innerHTML = `
      <div class="ep-inner">
        <div class="ep-face">
          <div class="ep-art">${artSVG(card.name, color, index)}</div>
          <h3 class="ep-name"></h3>
          <p class="ep-seed"></p>
          <p class="ep-domain"></p>
          <div class="ep-actions">
            <button type="button" class="btn-ghost flip-btn"></button>
            <button type="button" class="btn-ghost pick-btn"></button>
          </div>
        </div>
        <div class="ep-face ep-back">
          <div style="position:relative">${radarSVG(card.radar || {})}</div>
          <p class="ep-meta"></p>
          <p class="ep-reason"></p>
          <button type="button" class="btn-ghost flip-btn"></button>
        </div>
      </div>`;
    wrap.querySelector(".ep-name").textContent = card.name;
    wrap.querySelector(".ep-seed").textContent = card.seed;
    wrap.querySelector(".ep-domain").textContent = card.domain;
    wrap.querySelector(".ep-meta").textContent = when + " · " + t("origin") + " " + (card.origin_keyword || "");
    wrap.querySelector(".ep-reason").textContent = card.reasoning;
    wrap.querySelectorAll(".flip-btn").forEach(btn => {
      btn.textContent = t("flip");
      btn.onclick = (event) => {
        event.stopPropagation();
        noteCardInteraction();
        wrap.classList.toggle("flipped");
      };
    });
    const pick = wrap.querySelector(".pick-btn");
    const paintPick = () => {
      pick.textContent = chosenNames.has(card.name) ? t("chosen") : t("choose");
    };
    paintPick();
    pick.onclick = (event) => {
      event.stopPropagation();
      if (chosenNames.has(card.name)) chosenNames.delete(card.name);
      else if (chosenNames.size >= 5) return alert(t("needSelection"));
      else chosenNames.add(card.name);
      wrap.classList.toggle("chosen", chosenNames.has(card.name));
      paintPick();
      noteCardInteraction();
    };
    wrap.querySelector(".ep-face").onclick = () => openCardPanel(card);
    grid.appendChild(wrap);
  });
  renderRefreshCount();
}

function getSelectedNames() { return [...chosenNames]; }

function getSelectedCards() {
  return currentSpread.filter(card => chosenNames.has(card.name));
}

async function openCardPanel(card) {
  noteCardInteraction();
  const panel = document.getElementById("card-panel");
  panel.classList.remove("hidden");
  document.getElementById("panel-title").textContent = card.name;
  document.getElementById("panel-desc").textContent = card.description || card.seed;
  const img = document.getElementById("panel-img");
  const more = document.getElementById("panel-more");
  img.classList.add("hidden");
  const title = (card.wiki_title || card.name).replace(/ /g, "_");
  const search = `https://${lang}.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(card.wiki_title || card.name)}`;
  more.href = search;
  more.textContent = t("searchWiki");
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.extract) return;
    document.getElementById("panel-desc").textContent = card.description || data.extract;
    if (data.thumbnail && data.thumbnail.source) {
      img.src = data.thumbnail.source;
      img.classList.remove("hidden");
    }
    more.href = (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) || search;
    more.textContent = t("readMore");
  } catch (err) { /* search link stays */ }
}

function closeCardPanel() {
  document.getElementById("card-panel").classList.add("hidden");
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

function refreshSpread(mode) {
  if (mode === "new") {
    if (refreshTokens <= 0 || cooldownTimer) return;
    refreshTokens -= 1;
    const bar = document.getElementById("cooldown-bar");
    const fill = bar.querySelector("i");
    bar.classList.remove("hidden");
    fill.style.width = "100%";
    fill.style.transition = "width 12s linear";
    requestAnimationFrame(() => { fill.style.width = "0%"; });
    cooldownTimer = setTimeout(() => {
      cooldownTimer = null;
      bar.classList.add("hidden");
      fill.style.transition = "none";
      renderRefreshCount();
    }, 12000);
  }
  if (interacted) idleRefreshes = 1;
  else idleRefreshes += 1;
  interacted = false;
  document.getElementById("refresh-nudge").classList.toggle("hidden", idleRefreshes < 3);
  renderRefreshCount();
  loadConceptBank(mode);
}

function backToAttribute() {
  document.getElementById("refresh-nudge").classList.add("hidden");
  hide("node3b");
  show("node3a");
  document.getElementById("critical-attr").focus();
}

setInterval(() => {
  if (refreshTokens < 2) {
    refreshTokens += 1;
    renderRefreshCount();
  }
}, 60000);

onLang(() => {
  if (currentSpread.length) renderSpread(currentSpread);
  renderRefreshCount();
});
