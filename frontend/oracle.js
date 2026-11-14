/* A small koan after 45 seconds without a click or a key. Once per step. */

const IDLE_MS = 45000;
const seenSteps = new Set();
let idleTimer = null;
let koanIndex = 0;
let oracleSource = "local";

function currentStepKey() {
  if (!document.body.classList.contains("in-map")) return "";
  const panels = [...document.querySelectorAll(".idea-panel.open")];
  if (panels.length) return panels[panels.length - 1].dataset.step || "";
  const clusters = [...document.querySelectorAll(".idea-cluster")];
  if (clusters.length) return clusters[clusters.length - 1].id;
  const active = document.querySelector(".node-section.active");
  return active ? active.id : "";
}

function isBusy() {
  const loading = document.getElementById("loading");
  const spiral = document.getElementById("spiral");
  const zoom = document.getElementById("card-zoom");
  if (loading && !loading.classList.contains("hidden")) return true;
  if (spiral && !spiral.classList.contains("hidden")) return true;
  if (zoom && !zoom.classList.contains("hidden")) return true;
  return false;
}

function localKoan() {
  const list = (I18N[lang] && I18N[lang].koans) || I18N.es.koans;
  const question = list[koanIndex % list.length];
  koanIndex += 1;
  oracleSource = "local";
  return question;
}

async function fetchKoan() {
  const step = currentStepKey();
  const ideaId = typeof activeIdeaId === "function" ? activeIdeaId() : null;
  if (typeof sessionId !== "undefined" && sessionId) {
    try {
      const data = await api("POST", "/session/" + sessionId + "/koan", {
        step,
        idea_id: ideaId,
      });
      if (data && data.question) {
        oracleSource = "api";
        return data.question;
      }
    } catch (err) { /* the fixed list covers a failed call */ }
  }
  return localKoan();
}

async function openOracle() {
  const box = document.getElementById("oracle");
  const invoke = document.getElementById("oracle-invoke");
  if (!box) return;
  box.classList.remove("hidden");
  if (invoke) invoke.classList.add("hidden");
  const question = document.getElementById("oracle-q");
  question.textContent = "…";
  question.textContent = await fetchKoan();
}

function closeOracle() {
  const box = document.getElementById("oracle");
  if (box) box.classList.add("hidden");
  const invoke = document.getElementById("oracle-invoke");
  if (invoke && document.body.classList.contains("in-map")) invoke.classList.remove("hidden");
}

function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(onIdle, IDLE_MS);
}

function onIdle() {
  if (!document.body.classList.contains("in-map")) return;
  if (isBusy()) {
    armIdle();
    return;
  }
  const box = document.getElementById("oracle");
  if (box && !box.classList.contains("hidden")) return;
  const step = currentStepKey();
  if (!step || seenSteps.has(step)) return;
  seenSteps.add(step);
  openOracle();
}

function oracleEnter() {
  const invoke = document.getElementById("oracle-invoke");
  if (invoke) {
    invoke.classList.remove("hidden");
    invoke.setAttribute("aria-label", t("oracleInvoke"));
  }
  armIdle();
}

document.addEventListener("pointerdown", armIdle);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const zoom = document.getElementById("card-zoom");
    if (zoom && !zoom.classList.contains("hidden")) return;
    closeOracle();
  }
  armIdle();
});

document.addEventListener("DOMContentLoaded", () => {
  const another = document.getElementById("oracle-another");
  const close = document.getElementById("oracle-close");
  const invoke = document.getElementById("oracle-invoke");
  if (another) another.onclick = () => openOracle();
  if (close) close.onclick = closeOracle;
  if (invoke) {
    invoke.onclick = () => {
      const step = currentStepKey();
      if (step) seenSteps.add(step);
      openOracle();
    };
  }
  armIdle();
});

onLang(() => {
  const box = document.getElementById("oracle");
  const invoke = document.getElementById("oracle-invoke");
  if (invoke) invoke.setAttribute("aria-label", t("oracleInvoke"));
  if (box && !box.classList.contains("hidden") && oracleSource === "local") {
    document.getElementById("oracle-q").textContent = localKoan();
  }
});
