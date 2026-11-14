/* Node 4: one board per modality. Concepts, short reply cards, notes, links. */

const boards = {
  learning: emptyBoard(),
  development: emptyBoard(),
  feedback: emptyBoard(),
};
let boardMode = "learning";
let linkMode = false;
let linkFrom = null;
let itemSeq = 1;
let seeded = false;

function emptyBoard() {
  return { items: [], links: [] };
}

function activeBoard() { return boards[boardMode]; }

function uid(prefix) {
  itemSeq += 1;
  return prefix + "-" + itemSeq;
}

function seedBoard(cards) {
  if (seeded) return;
  seeded = true;
  ["learning", "development", "feedback"].forEach(mode => {
    cards.forEach((card, index) => {
      const angle = -Math.PI / 2 + (index - (cards.length - 1) / 2) * 0.55;
      boards[mode].items.push({
        id: mode + "-c-" + index,
        type: "concept",
        name: card.name,
        domain: card.domain,
        x: 360 + Math.cos(angle) * 180,
        y: 250 + Math.sin(angle) * 120,
      });
    });
  });
  drawBoard();
}

function showModality(mode) {
  boardMode = mode;
  linkFrom = null;
  drawBoard();
}

function drawBoard() {
  const layer = document.getElementById("board-items");
  const svg = document.getElementById("board-lines");
  if (!layer) return;
  layer.innerHTML = "";
  const board = activeBoard();
  board.items.forEach(item => layer.appendChild(renderItem(item)));
  paintLinks();
  svg.setAttribute("viewBox", "0 0 " + layer.clientWidth + " " + layer.parentElement.clientHeight);
}

function renderItem(item) {
  const el = document.createElement("div");
  el.className = "board-item " + item.type + (item.kind === "risk" ? " risk" : "");
  el.dataset.id = item.id;
  el.style.left = item.x + "px";
  el.style.top = item.y + "px";
  if (item.type === "concept") {
    el.style.setProperty("--domain", domainColor(item.domain));
    el.innerHTML = `<h3 class="ep-name"></h3>`;
    el.querySelector("h3").textContent = item.name;
  } else if (item.type === "reply") {
    const kindKey = "kind" + item.kind.charAt(0).toUpperCase() + item.kind.slice(1);
    el.innerHTML = `<p class="kind-tag"></p><h3 class="ep-name"></h3><p></p>`;
    el.querySelector(".kind-tag").textContent = t(kindKey);
    el.querySelector("h3").textContent = item.title;
    el.querySelector("p:last-child").textContent = item.body;
  } else {
    el.innerHTML = `<textarea rows="2"></textarea>`;
    const area = el.querySelector("textarea");
    area.placeholder = t("notePh");
    area.value = item.text || "";
    area.addEventListener("input", () => { item.text = area.value; });
    area.addEventListener("pointerdown", event => event.stopPropagation());
  }
  if (linkFrom === item.id) el.style.outline = "1px solid #C5A059";
  el.addEventListener("pointerdown", event => startDrag(event, item, el));
  return el;
}

function startDrag(event, item, el) {
  if (event.target.closest("textarea")) return;
  if (linkMode || event.shiftKey) {
    event.preventDefault();
    if (!linkFrom) {
      linkFrom = item.id;
      drawBoard();
      return;
    }
    if (linkFrom !== item.id) {
      const label = window.prompt(t("linkLabel"), "") || "";
      activeBoard().links.push({ from: linkFrom, to: item.id, label, kind: "user" });
    }
    linkFrom = null;
    drawBoard();
    return;
  }
  const box = document.getElementById("board");
  const originX = event.clientX - item.x;
  const originY = event.clientY - item.y;
  el.setPointerCapture(event.pointerId);
  const move = (ev) => {
    item.x = Math.max(4, Math.min(box.clientWidth - 150, ev.clientX - originX));
    item.y = Math.max(4, Math.min(box.clientHeight - 40, ev.clientY - originY));
    el.style.left = item.x + "px";
    el.style.top = item.y + "px";
    anchorNote(item);
    paintLinks();
  };
  const up = () => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
}

function anchorNote(item) {
  if (item.type !== "note") return;
  let best = null;
  let bestDist = 90;
  activeBoard().items.forEach(other => {
    if (other.id === item.id || other.type === "note") return;
    const dist = Math.hypot(other.x - item.x, other.y - item.y);
    if (dist < bestDist) { bestDist = dist; best = other; }
  });
  item.attached_to = best ? (best.name || best.title || best.id) : null;
}

function itemCenter(item) {
  return { x: item.x + 75, y: item.y + 28 };
}

function paintLinks() {
  const svg = document.getElementById("board-lines");
  const board = activeBoard();
  const byId = Object.fromEntries(board.items.map(item => [item.id, item]));
  const paths = board.links.map(link => {
    const from = byId[link.from];
    const to = byId[link.to];
    if (!from || !to) return "";
    const a = itemCenter(from);
    const b = itemCenter(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * 28;
    const oy = (dx / len) * 28;
    let stroke = "#C5A059";
    let dash = "";
    let width = 1.6;
    let opacity = 0.55;
    if (link.kind === "model") { stroke = "#1A3A8F"; width = 1.15; opacity = 0.35; }
    if (link.kind === "risk") { stroke = "#8F1A1A"; dash = "4 4"; opacity = 0.7; }
    const midX = (a.x + b.x) / 2 + ox;
    const midY = (a.y + b.y) / 2 + oy;
    const label = link.label
      ? `<text x="${midX.toFixed(1)}" y="${midY.toFixed(1)}" font-size="11" fill="#5c584f" text-anchor="middle">${escapeXml(link.label)}</text>`
      : "";
    return `<path d="M ${a.x} ${a.y} C ${a.x + ox} ${a.y + oy}, ${b.x + ox} ${b.y + oy}, ${b.x} ${b.y}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-dasharray="${dash}" data-from="${link.from}" data-to="${link.to}"/>${label}`;
  }).join("");
  svg.innerHTML = paths;
  svg.querySelectorAll("path").forEach(path => {
    path.style.cursor = "pointer";
    path.addEventListener("click", () => {
      const from = path.dataset.from;
      const to = path.dataset.to;
      const link = board.links.find(item => item.from === from && item.to === to && item.kind === "user");
      if (!link) return;
      const next = window.prompt(t("linkLabel"), link.label);
      if (next === null) board.links = board.links.filter(item => item !== link);
      else link.label = next;
      paintLinks();
    });
  });
}

function escapeXml(text) {
  return String(text).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}

function toggleLinkMode() {
  linkMode = !linkMode;
  linkFrom = null;
  document.getElementById("btn-link-mode").classList.toggle("active", linkMode);
  document.getElementById("link-hint").classList.toggle("hidden", !linkMode);
}

function addBoardNote() {
  const item = { id: uid("note"), type: "note", text: "", x: 40, y: 40, attached_to: null };
  activeBoard().items.push(item);
  drawBoard();
}

function placeReply(intro, cards) {
  document.getElementById("board-intro").textContent = intro || "";
  const board = activeBoard();
  cards.forEach((card, index) => {
    const item = {
      id: uid("reply"),
      type: "reply",
      kind: card.kind || "help",
      title: card.title,
      body: card.body,
      x: 24 + (index % 3) * 170,
      y: 24 + Math.floor(index / 3) * 110,
    };
    board.items.push(item);
    (card.concepts || []).forEach(name => {
      const concept = board.items.find(other => other.type === "concept" && other.name === name);
      if (!concept) return;
      board.links.push({
        from: concept.id,
        to: item.id,
        label: "",
        kind: card.kind === "risk" ? "risk" : "model",
      });
    });
  });
  drawBoard();
}

function boardPayload() {
  const board = activeBoard();
  const byId = Object.fromEntries(board.items.map(item => [item.id, item]));
  const labelOf = (id) => {
    const item = byId[id];
    if (!item) return id;
    return item.name || item.title || item.text || id;
  };
  return {
    links: board.links
      .filter(link => link.kind === "user")
      .map(link => ({ from: labelOf(link.from), to: labelOf(link.to), label: link.label || "" })),
    notes: board.items
      .filter(item => item.type === "note" && item.text)
      .map(item => ({ id: item.id, text: item.text, attached_to: item.attached_to })),
  };
}

function boardsSnapshot() {
  return JSON.parse(JSON.stringify(boards));
}

function toggleTalk() {
  const area = document.getElementById("chat-messages");
  const btn = document.getElementById("btn-talk");
  const open = area.classList.toggle("hidden");
  btn.textContent = open ? t("seeTalk") : t("hideTalk");
}

onLang(() => {
  if (seeded) drawBoard();
  const area = document.getElementById("chat-messages");
  const btn = document.getElementById("btn-talk");
  if (area && btn) btn.textContent = area.classList.contains("hidden") ? t("seeTalk") : t("hideTalk");
});
