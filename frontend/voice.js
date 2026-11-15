/* Browser dictation. The words land in the field. Nothing is sent until the person continues. */

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let voiceRec = null;
let voiceButton = null;
let voiceField = null;
let voiceHeard = "";

function voiceLang() {
  return typeof lang !== "undefined" && lang === "en" ? "en-US" : "es-MX";
}

function growField(field) {
  if (field.tagName !== "TEXTAREA") return;
  field.style.height = "auto";
  field.style.height = field.scrollHeight + "px";
}

function stopVoice() {
  const rec = voiceRec;
  voiceRec = null;
  if (rec && voiceField) {
    if (typeof track === "function") track("dictation_stop", { field: typeof fieldKey === "function" ? fieldKey(voiceField) : "", heard: voiceHeard, value: voiceField.value });
  }
  voiceField = null;
  voiceHeard = "";
  if (voiceButton) {
    voiceButton.classList.remove("listening");
    voiceButton.title = t("mic");
    voiceButton.setAttribute("aria-label", t("mic"));
    voiceButton = null;
  }
  if (!rec) return;
  rec.onend = null;
  try { rec.stop(); } catch (err) { /* already stopped */ }
}

function startVoice(field, button) {
  stopVoice();
  const rec = new SpeechRec();
  rec.lang = voiceLang();
  rec.continuous = true;
  rec.interimResults = true;
  const start = field.value;
  const prefix = start && !/\s$/.test(start) ? start + " " : start;
  let finals = 0;
  rec.onstart = () => { finals = 0; };
  rec.onresult = event => {
    let said = "";
    for (let i = 0; i < event.results.length; i++) said += event.results[i][0].transcript;
    voiceHeard = said;
    for (let i = finals; i < event.results.length && event.results[i].isFinal; i++) {
      finals = i + 1;
      if (typeof track === "function") track("dictation_text", {
        field: typeof fieldKey === "function" ? fieldKey(field) : "",
        text: event.results[i][0].transcript,
        confidence: event.results[i][0].confidence,
      });
    }
    field.value = prefix + said;
    growField(field);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  };
  rec.onerror = event => {
    if (typeof track === "function") track("dictation_error", { error: event.error }, { author: "client" });
    if (event.error === "not-allowed" || event.error === "service-not-allowed") showNotice(t("micDenied"));
    else if (event.error !== "aborted" && event.error !== "no-speech") showNotice(t("micFail"));
    stopVoice();
  };
  rec.onend = () => {
    if (voiceRec !== rec) return;
    try { rec.start(); } catch (err) { stopVoice(); }
  };
  try {
    rec.start();
  } catch (err) {
    showNotice(t("micFail"));
    return;
  }
  voiceRec = rec;
  voiceButton = button;
  voiceField = field;
  voiceHeard = "";
  if (typeof track === "function") track("dictation_start", { field: typeof fieldKey === "function" ? fieldKey(field) : "", lang: rec.lang });
  button.classList.add("listening");
  button.title = t("micStop");
  button.setAttribute("aria-label", t("micStop"));
}

function attachVoice(field) {
  if (!SpeechRec || !field || field.dataset.voice === "1") return;
  field.dataset.voice = "1";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn-mic";
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/><path d="M17 11a5 5 0 0 1-10 0M12 16v3M9 19h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  button.title = t("mic");
  button.setAttribute("aria-label", t("mic"));
  const wrap = document.createElement("div");
  wrap.className = "voice-field";
  field.parentNode.insertBefore(wrap, field);
  wrap.appendChild(field);
  wrap.appendChild(button);
  button.addEventListener("click", () => {
    if (voiceButton === button) stopVoice();
    else startVoice(field, button);
  });
}

function armVoice(root) {
  if (!root) return;
  root.querySelectorAll("textarea, input[type='text']").forEach(attachVoice);
}

document.addEventListener("DOMContentLoaded", () => {
  armVoice(document.getElementById("workspace"));
  armVoice(document.getElementById("closing"));
});

if (typeof onLang === "function") {
  onLang(() => {
    document.querySelectorAll(".btn-mic").forEach(button => {
      const listening = button.classList.contains("listening");
      const label = t(listening ? "micStop" : "mic");
      button.title = label;
      button.setAttribute("aria-label", label);
    });
  });
}
