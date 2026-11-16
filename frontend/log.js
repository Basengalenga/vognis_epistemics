/* Session log for what happens only in the browser.
   It only records. Every failure is swallowed, nothing waits on it, and nothing is shown. */

const vlogQueue = [];
const vlogDrafts = new Map();
const vlogSources = new WeakMap();
const vlogDraftTimers = new WeakMap();

function vlogNow() {
  return new Date().toISOString();
}

function vlogSession() {
  try {
    return typeof sessionId !== "undefined" && sessionId ? sessionId : null;
  } catch (e) {
    return null;
  }
}

function vlogBlocked() {
  try {
    return typeof previewMode !== "undefined" && previewMode;
  } catch (e) {
    return false;
  }
}

function vlogApi() {
  try {
    return typeof API !== "undefined" ? API : location.protocol + "//" + location.hostname + ":8000/api/v1";
  } catch (e) {
    return location.protocol + "//" + location.hostname + ":8000/api/v1";
  }
}

/* author: "user" for what the person did, "client" for what the page did on its own. */
function track(kind, detail, options) {
  try {
    const opts = options || {};
    vlogQueue.push({
      client_at: vlogNow(),
      kind: String(kind),
      author: opts.author === "client" ? "client" : "user",
      text: opts.text ? String(opts.text) : "",
      detail: detail || {},
    });
    if (vlogQueue.length > 2000) vlogQueue.splice(0, vlogQueue.length - 2000);
  } catch (e) { /* logging never breaks the page */ }
}

function flushLog(final) {
  try {
    const id = vlogSession();
    if (!id || vlogBlocked() || !vlogQueue.length) return;
    const events = vlogQueue.splice(0, 400);
    fetch(vlogApi() + "/session/" + id + "/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
      keepalive: !!final,
    }).catch(() => {
      vlogQueue.unshift(...events);
    });
    if (vlogQueue.length) setTimeout(() => flushLog(final), 50);
  } catch (e) { /* logging never breaks the page */ }
}

/* Waits for what is queued to reach the server, at most two seconds. */
async function flushLogNow() {
  try {
    const id = vlogSession();
    if (!id || vlogBlocked() || !vlogQueue.length) return;
    const events = vlogQueue.splice(0, vlogQueue.length);
    const send = fetch(vlogApi() + "/session/" + id + "/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    }).catch(() => { vlogQueue.unshift(...events); });
    await Promise.race([send, new Promise(resolve => setTimeout(resolve, 2000))]);
  } catch (e) { /* logging never breaks the page */ }
}

/* For a session that already closed, such as the next-day feedback. */
function sendLate(id, kind, detail) {
  try {
    if (!id || vlogBlocked()) return;
    fetch(vlogApi() + "/session/" + id + "/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [{ client_at: vlogNow(), kind, author: "user", detail: detail || {} }] }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) { /* ignore */ }
}

function vlogDescribe(el) {
  if (!el || !el.tagName) return {};
  const info = { tag: el.tagName.toLowerCase() };
  if (el.id) info.id = el.id;
  const cls = typeof el.className === "string" ? el.className.trim() : "";
  if (cls) info.class = cls;
  const data = {};
  ["mode", "intent", "lang", "help", "fb", "step", "name"].forEach(key => {
    if (el.dataset && el.dataset[key]) data[key] = el.dataset[key];
  });
  if (Object.keys(data).length) info.data = data;
  const label = (el.getAttribute && (el.getAttribute("aria-label") || el.title)) || "";
  const text = (el.innerText || el.value || "").trim().replace(/\s+/g, " ");
  if (text) info.text = text.slice(0, 160);
  else if (label) info.text = label.slice(0, 160);
  const cluster = el.closest && el.closest(".idea-cluster");
  if (cluster) info.idea_id = cluster.id.replace(/^cluster-/, "");
  const section = el.parentElement && el.parentElement.closest("[id]");
  if (section) info.within = section.id;
  return info;
}

/* Where a text field lives, so a draft can be matched to what was later sent. */
function fieldKey(el) {
  if (!el) return "";
  if (el.id) return el.id;
  const cls = typeof el.className === "string" ? el.className.split(/\s+/)[0] : el.tagName.toLowerCase();
  const cluster = el.closest && el.closest(".idea-cluster");
  return cluster ? cls + "@" + cluster.id.replace(/^cluster-/, "") : cls;
}

function isTextField(el) {
  if (!el || !el.tagName) return false;
  if (el.tagName === "TEXTAREA") return true;
  return el.tagName === "INPUT" && (el.type === "text" || el.type === "search");
}

/* typed, voice or mixed for whatever is in the field now. Resets when the field is emptied. */
function markSource(field, how) {
  try {
    if (!field.value) {
      vlogSources.delete(field);
      return;
    }
    const before = vlogSources.get(field);
    if (!before || before === how) vlogSources.set(field, how);
    else vlogSources.set(field, "mixed");
  } catch (e) { /* ignore */ }
}

function sourceOf(field) {
  try {
    if (!field || !field.value || !field.value.trim()) return "";
    return vlogSources.get(field) || "typed";
  } catch (e) {
    return "";
  }
}

function sourceById(id) {
  return sourceOf(document.getElementById(id));
}

function takeSource(field) {
  const value = sourceOf(field);
  try { vlogSources.delete(field); } catch (e) { /* ignore */ }
  return value;
}

function saveDraft(field, why) {
  try {
    const value = field.value || "";
    const last = vlogDrafts.get(field);
    if (last === value) return;
    vlogDrafts.set(field, value);
    track("draft", { field: fieldKey(field), value, length: value.length, input_source: sourceOf(field), why });
  } catch (e) { /* ignore */ }
}

/* Elements marked data-vlog-skip (the audit) are not part of the session, so they are not logged. */
function vlogSkip(el) {
  try {
    return !!(el && el.closest && el.closest("[data-vlog-skip]"));
  } catch (e) {
    return false;
  }
}

/* Voice fills a field with a synthetic input event, so isTrusted tells typing from dictation. */
document.addEventListener("input", event => {
  try {
    const field = event.target;
    if (vlogSkip(field)) return;
    if (!isTextField(field)) return;
    markSource(field, event.isTrusted ? "typed" : "voice");
    clearTimeout(vlogDraftTimers.get(field));
    vlogDraftTimers.set(field, setTimeout(() => saveDraft(field, "pause"), 2000));
  } catch (e) { /* ignore */ }
}, true);

document.addEventListener("focusout", event => {
  try {
    const field = event.target;
    if (vlogSkip(field)) return;
    if (!isTextField(field)) return;
    clearTimeout(vlogDraftTimers.get(field));
    saveDraft(field, "blur");
  } catch (e) { /* ignore */ }
}, true);

document.addEventListener("click", event => {
  try {
    if (vlogSkip(event.target)) return;
    const target = event.target.closest("button, a, [role=button], .ep-card, .orb, input[type=radio], input[type=checkbox]") || event.target;
    track("click", vlogDescribe(target));
  } catch (e) { /* ignore */ }
}, true);

document.addEventListener("change", event => {
  try {
    const el = event.target;
    if (vlogSkip(el)) return;
    if (isTextField(el)) return;
    const info = vlogDescribe(el);
    info.value = el.type === "checkbox" ? el.checked : el.value;
    track("change", info);
  } catch (e) { /* ignore */ }
}, true);

document.addEventListener("keydown", event => {
  try {
    if (vlogSkip(event.target)) return;
    if (event.key === "Escape" || (event.key === "Enter" && !event.shiftKey && isTextField(event.target))) {
      track("key", { key: event.key, field: isTextField(event.target) ? fieldKey(event.target) : "" });
    }
  } catch (e) { /* ignore */ }
}, true);

document.addEventListener("visibilitychange", () => {
  track("visibility", { state: document.visibilityState }, { author: "client" });
  if (document.visibilityState === "hidden") flushLog(true);
});

window.addEventListener("pagehide", () => {
  track("page_leave", {}, { author: "client" });
  flushLog(true);
});

window.addEventListener("error", event => {
  track("page_error", { message: String(event.message || ""), source: String(event.filename || ""), line: event.lineno || 0 }, { author: "client" });
});

document.addEventListener("DOMContentLoaded", () => {
  track("page_open", {
    url: location.href,
    lang: (typeof lang !== "undefined" ? lang : ""),
    viewport: window.innerWidth + "x" + window.innerHeight,
    agent: navigator.userAgent,
  }, { author: "client" });
});

setInterval(() => flushLog(false), 3000);
