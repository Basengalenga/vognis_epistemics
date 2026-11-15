/* Decision door. The model is not called. See README.md in this folder. */

const DECIDE_COPY = {
  es: {
    kicker: "Tomar una decisión",
    locked: "Profundidad fija",
    normal: "Normal",
    extended: "Extendida",
    depthTitle: "Qué tan a fondo",
    depthLead: "Elige antes de empezar. Al entrar, esto queda fijo.",
    normalBody: "Una sentada. Tu postura, un argumento a favor, uno en contra, el supuesto que más pesa, un criterio para soltarla y una carta para mirarla distinto.",
    extendedBody: "El mismo recorrido, con más argumentos, la veracidad del supuesto que más pesa, y una pregunta más en esa rama.",
    begin: "Empezar",
    back: "Volver",
    next: "Seguir",
    registerTitle: "La decisión",
    registerLead: "Hoy te inclinas por una opción. Esa rama es la que se abre.",
    decisionLabel: "Qué estás decidiendo",
    decisionPh: "La decisión, en una frase…",
    disclaimer: "Esto es para una decisión tuya que vas a poder volver a mirar. No está hecho para decisiones médicas, irreversibles, o sobre otra persona.",
    options: "Opciones",
    optionPh: "Una opción",
    addOption: "Añadir opción",
    statusQuo: "Seguir como está",
    stance: "Hoy me inclino por esta",
    confidence: "Confianza",
    c1: "Casi no",
    c2: "Poca",
    c3: "A medias",
    c4: "Bastante",
    c5: "Muy seguro",
    checkable: "¿Hay evidencia que se pueda buscar?",
    yes: "Sí",
    no: "No",
    argsTitle: "Argumentos",
    argsLead: "Un argumento no gana por ser muchos. Pesa por cuánto movería la decisión si fuera falso.",
    forSide: "A favor de tu postura",
    againstSide: "En contra",
    argPh: "El argumento, en una frase…",
    weight: "Si esto fuera falso, cuánto se mueve tu decisión",
    w1: "Casi no",
    w5: "La derrumba",
    argCheck: "¿Este argumento se puede comprobar?",
    support: "Qué tan sustentado está",
    s1: "Casi nada",
    s5: "Muy sustentado",
    assumption: "Qué tendría que ser cierto para que se sostenga",
    assumptionPh: "Por ejemplo: que las dos opciones cuesten lo mismo.",
    assumptionOptional: "Opcional.",
    assumptionRequired: "En este sí hace falta: es el que más pesa.",
    addFor: "Añadir uno a favor",
    addAgainst: "Añadir uno en contra",
    remove: "Quitar",
    cruxTitle: "El crux",
    cruxLead: "¿Qué supuesto, si se derrumba, hace que tu decisión se caiga?",
    veracity: "Sobre el supuesto que más pesa: ¿cuál es su veracidad?",
    verified: "Ya lo comprobé",
    verifiable: "Se puede comprobar",
    unverifiable: "No se puede comprobar",
    hint: "Elegiste un supuesto que, según tus pesos, casi no mueve la decisión. El crux es el que la derrumbaría.",
    keepCrux: "Confirmar este",
    otherCrux: "Elegir otro",
    redTitle: "La rama que más pesa",
    redLead: "Una pregunta más, en tus palabras, sobre el supuesto que elegiste.",
    redPh: "La pregunta que todavía no te has hecho…",
    abandonTitle: "Criterio de abandono",
    abandonLead: "Qué tendrías que ver para soltar la postura. Un hecho, no una frase vaga.",
    abandonPh: "Por ejemplo: si en la revisión el costo pasa de la cifra que anoté.",
    lensTitle: "Una carta",
    lensLead: "Saca una. La instrucción no es un hallazgo. El hallazgo, si aparece, lo escribes tú.",
    draw: "Sacar una carta",
    drawn: "Ya está sacada",
    lensFailed: "Imagina que esta decisión ya fracasó. ¿Qué viste?",
    lensInvert: "Invierte la opción por la que te inclinas. ¿Qué aparece?",
    lensOther: "Míralo desde quien no elige. ¿Qué nota?",
    lensPh: "Lo que viste, si viste algo…",
    lensMoves: "¿Esto mueve alguna carta de tu árbol?",
    closeTitle: "La decisión, otra vez",
    closeLead: "Cambiar no es mejor que quedarte. Si algo se movió, señala qué carta hizo el trabajo.",
    finalStance: "Postura final",
    finalConfidence: "Confianza ahora",
    cite: "Qué carta hizo el trabajo",
    citePick: "Elige",
    citeNone: "Ninguna carta",
    citeCrux: "El crux",
    citeAbandon: "El criterio de abandono",
    citeLens: "La carta abstracta",
    citeArg: "Argumento",
    review: "Fecha para volver a mirarla",
    finish: "Cerrar y descargar",
    mirrorTitle: "Así quedó",
    before: "Al empezar",
    after: "Al cerrar",
    stayed: "Te mantuviste en la postura.",
    movedCard: "Cambiaste y señalaste la carta que hizo el trabajo.",
    movedNone: "Cambio sin carta.",
    namedAssumption: "Identificaste un supuesto.",
    namedCriterion: "Escribiste un criterio de abandono.",
    namedQuestion: "Escribiste una pregunta en la rama que más pesa.",
    home: "Volver al inicio",
    treeEmpty: "El árbol aparece cuando haya una postura.",
    openBranch: "Rama abierta",
    needDepth: "Elige la profundidad.",
    needDecision: "Describe la decisión con un poco más.",
    needOptions: "Escribe al menos dos opciones.",
    needStance: "Marca por cuál te inclinas hoy.",
    needConfidence: "Marca tu confianza.",
    needCheck: "Di si hay evidencia que se pueda buscar.",
    needArgs: "Hace falta un argumento a favor y uno en contra.",
    needWeight: "Cada argumento necesita su peso.",
    needSupport: "Si se puede comprobar, di qué tan sustentado está.",
    needAssumption: "El argumento que más pesa necesita su supuesto.",
    needCrux: "Elige el supuesto que derrumbaría la decisión.",
    needVeracity: "Di la veracidad del supuesto que más pesa.",
    needRed: "Escribe esa pregunta con un poco más.",
    needAbandon: "Escribe el hecho que te haría soltar la postura.",
    needLens: "Saca la carta antes de seguir.",
    needLensNote: "Si mueve una carta, escribe lo que viste.",
    needFinal: "Marca la postura y la confianza de ahora.",
    needCite: "Si algo cambió, señala una carta o di que no hay ninguna.",
    needDate: "Elige una fecha de hoy en adelante.",
  },
  en: {
    kicker: "Make a decision",
    locked: "Depth is fixed",
    normal: "Normal",
    extended: "Extended",
    depthTitle: "How far",
    depthLead: "Choose before you start. Once you enter, this stays fixed.",
    normalBody: "One sitting. Your stance, one argument for it, one against, the assumption that weighs most, a reason to let go, and one card that asks you to look differently.",
    extendedBody: "The same path, with more arguments, the status of the heaviest assumption, and one more question on that branch.",
    begin: "Begin",
    back: "Back",
    next: "Continue",
    registerTitle: "The decision",
    registerLead: "Today you lean toward one option. That is the branch that opens.",
    decisionLabel: "What you are deciding",
    decisionPh: "The decision, in one sentence…",
    disclaimer: "This is for a decision of yours that you will be able to look at again. It is not for medical decisions, irreversible ones, or decisions about someone else.",
    options: "Options",
    optionPh: "An option",
    addOption: "Add an option",
    statusQuo: "Keep things as they are",
    stance: "Today I lean this way",
    confidence: "Confidence",
    c1: "Barely",
    c2: "A little",
    c3: "Halfway",
    c4: "Fairly",
    c5: "Very sure",
    checkable: "Is there evidence you could look up?",
    yes: "Yes",
    no: "No",
    argsTitle: "Arguments",
    argsLead: "An argument does not win by numbers. It weighs by how far the decision would move if it were false.",
    forSide: "For your stance",
    againstSide: "Against it",
    argPh: "The argument, in one sentence…",
    weight: "If this were false, how far does the decision move",
    w1: "Barely",
    w5: "It collapses",
    argCheck: "Can this argument be checked?",
    support: "How well it is supported",
    s1: "Barely",
    s5: "Well supported",
    assumption: "What would have to be true for this to hold",
    assumptionPh: "For example: that both options cost the same.",
    assumptionOptional: "Optional.",
    assumptionRequired: "This one needs it: it weighs the most.",
    addFor: "Add one for it",
    addAgainst: "Add one against it",
    remove: "Remove",
    cruxTitle: "The crux",
    cruxLead: "Which assumption, if it fell, would bring the decision down?",
    veracity: "For the assumption that weighs most: what is its status?",
    verified: "I already checked it",
    verifiable: "It can be checked",
    unverifiable: "It cannot be checked",
    hint: "You picked an assumption that, by your own weights, barely moves the decision. The crux is the one that would bring it down.",
    keepCrux: "Keep this one",
    otherCrux: "Pick another",
    redTitle: "The branch that weighs most",
    redLead: "One more question, in your words, about the assumption you chose.",
    redPh: "The question you have not asked yet…",
    abandonTitle: "A reason to let go",
    abandonLead: "What you would have to see in order to drop the stance. A fact, not a vague line.",
    abandonPh: "For example: if at the review the cost is past the figure I wrote down.",
    lensTitle: "One card",
    lensLead: "Draw one. The instruction is not a finding. If a finding shows up, you write it.",
    draw: "Draw a card",
    drawn: "Already drawn",
    lensFailed: "Imagine this decision has already failed. What did you see?",
    lensInvert: "Invert the option you lean toward. What shows up?",
    lensOther: "Look at it from someone who does not choose. What do they notice?",
    lensPh: "What you saw, if you saw something…",
    lensMoves: "Does this move a card on your tree?",
    closeTitle: "The decision, again",
    closeLead: "Changing is not better than staying. If something moved, point at the card that did the work.",
    finalStance: "Final stance",
    finalConfidence: "Confidence now",
    cite: "Which card did the work",
    citePick: "Choose",
    citeNone: "No card",
    citeCrux: "The crux",
    citeAbandon: "The reason to let go",
    citeLens: "The abstract card",
    citeArg: "Argument",
    review: "A date to look again",
    finish: "Close and download",
    mirrorTitle: "Where it landed",
    before: "At the start",
    after: "At the close",
    stayed: "You stayed with the stance.",
    movedCard: "You moved, and you pointed at the card that did the work.",
    movedNone: "A change with no card.",
    namedAssumption: "You named an assumption.",
    namedCriterion: "You wrote a reason to let go.",
    namedQuestion: "You wrote a question on the branch that weighs most.",
    home: "Back to the start",
    treeEmpty: "The tree shows up once there is a stance.",
    openBranch: "Open branch",
    needDepth: "Choose the depth.",
    needDecision: "Say a little more about the decision.",
    needOptions: "Write at least two options.",
    needStance: "Mark the one you lean toward today.",
    needConfidence: "Mark your confidence.",
    needCheck: "Say whether evidence can be looked up.",
    needArgs: "One argument for the stance and one against it.",
    needWeight: "Every argument needs its weight.",
    needSupport: "If it can be checked, say how well it is supported.",
    needAssumption: "The argument that weighs most needs its assumption.",
    needCrux: "Choose the assumption that would bring the decision down.",
    needVeracity: "Say the status of the assumption that weighs most.",
    needRed: "Write that question with a little more.",
    needAbandon: "Write the fact that would make you let go of the stance.",
    needLens: "Draw the card before continuing.",
    needLensNote: "If it moves a card, write what you saw.",
    needFinal: "Mark the stance and the confidence you have now.",
    needCite: "If something moved, point at a card or say there is none.",
    needDate: "Choose a date from today onward.",
  },
};

const LENS_KEYS = ["failed", "invert", "other"];
const ARG_CAP = 3;
const OPTION_CAP = 4;

let decideState = null;
let decideStep = "depth";
let decideError = "";

function dt(key) {
  const pack = DECIDE_COPY[typeof lang === "string" ? lang : "es"] || DECIDE_COPY.es;
  return pack[key] || DECIDE_COPY.es[key] || key;
}

function decideEl(tag, attrs, children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else node.setAttribute(key, value === true ? "" : value);
  });
  (children || []).forEach(child => {
    if (!child) return;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  });
  return node;
}

function blankOption() {
  return { id: "o" + Math.random().toString(36).slice(2, 8), text: "" };
}

function blankArg(side) {
  return {
    id: "a" + Math.random().toString(36).slice(2, 8),
    side,
    text: "",
    weight: 0,
    checkable: null,
    support: 0,
    assumption: "",
    veracity: "",
  };
}

function freshDecide() {
  return {
    depth: "",
    decision: "",
    checkable: null,
    options: [blankOption(), blankOption()],
    stanceId: "",
    confidence: 0,
    args: [],
    cruxId: "",
    cruxKept: false,
    redTeam: "",
    abandonment: "",
    lens: "",
    lensNote: "",
    lensMoves: null,
    finalStanceId: "",
    finalConfidence: 0,
    cited: "",
    reviewDate: "",
    closed: false,
    summary: "",
  };
}

function decideSteps() {
  const steps = ["depth", "register", "arguments", "crux"];
  if (decideState && decideState.depth === "extended") steps.push("redteam");
  steps.push("abandon", "lens", "close");
  return steps;
}

function optionById(id) {
  return (decideState.options || []).find(option => option.id === id);
}

function argById(id) {
  return (decideState.args || []).find(arg => arg.id === id);
}

function filledArgs() {
  return decideState.args.filter(arg => arg.text.trim());
}

function heaviestArgs() {
  const ready = filledArgs().filter(arg => arg.weight > 0);
  if (!ready.length) return [];
  const top = Math.max(...ready.map(arg => arg.weight));
  return ready.filter(arg => arg.weight === top);
}

function assumptionCards() {
  return filledArgs().filter(arg => arg.assumption.trim());
}

function openArgId() {
  if (decideState.cruxId && argById(decideState.cruxId)) return decideState.cruxId;
  const heavy = heaviestArgs()[0];
  if (heavy) return heavy.id;
  const first = decideState.args.find(arg => arg.side === "for");
  return first ? first.id : "";
}

function stanceChanged() {
  return decideState.finalStanceId !== decideState.stanceId
    || Number(decideState.finalConfidence) !== Number(decideState.confidence);
}

function movementLines() {
  const lines = [];
  if (!stanceChanged()) lines.push(dt("stayed"));
  else if (decideState.cited && decideState.cited !== "none") lines.push(dt("movedCard"));
  else lines.push(dt("movedNone"));
  if (decideState.depth === "extended") {
    if (assumptionCards().length) lines.push(dt("namedAssumption"));
    if (decideState.abandonment.trim()) lines.push(dt("namedCriterion"));
    if (decideState.redTeam.trim()) lines.push(dt("namedQuestion"));
  }
  return lines;
}

function lensText() {
  if (decideState.lens === "failed") return dt("lensFailed");
  if (decideState.lens === "invert") return dt("lensInvert");
  if (decideState.lens === "other") return dt("lensOther");
  return "";
}

function readDecideForm() {
  const root = document.getElementById("decide-root");
  if (!root || !decideState) return;
  const decision = root.querySelector("#d-decision");
  if (decision) decideState.decision = decision.value;
  const check = root.querySelector("input[name='d-checkable']:checked");
  if (check) decideState.checkable = check.value === "yes";
  decideState.options.forEach(option => {
    const field = root.querySelector("#d-opt-" + option.id);
    if (field) option.text = field.value;
  });
  const stance = root.querySelector("input[name='d-stance']:checked");
  if (stance) decideState.stanceId = stance.value;
  const confidence = root.querySelector("input[name='d-confidence']:checked");
  if (confidence) decideState.confidence = Number(confidence.value);
  decideState.args.forEach(arg => {
    const text = root.querySelector("#d-arg-text-" + arg.id);
    const weight = root.querySelector("input[name='d-weight-" + arg.id + "']:checked");
    const can = root.querySelector("input[name='d-can-" + arg.id + "']:checked");
    const support = root.querySelector("input[name='d-support-" + arg.id + "']:checked");
    const assumption = root.querySelector("#d-assume-" + arg.id);
    const veracity = root.querySelector("input[name='d-veracity-" + arg.id + "']:checked");
    if (text) arg.text = text.value;
    if (weight) arg.weight = Number(weight.value);
    if (can) arg.checkable = can.value === "yes";
    if (support) arg.support = Number(support.value);
    if (assumption) arg.assumption = assumption.value;
    if (veracity) arg.veracity = veracity.value;
  });
  const crux = root.querySelector("input[name='d-crux']:checked");
  if (crux && crux.value !== decideState.cruxId) {
    decideState.cruxId = crux.value;
    decideState.cruxKept = false;
  }
  const red = root.querySelector("#d-red");
  if (red) decideState.redTeam = red.value;
  const abandon = root.querySelector("#d-abandon");
  if (abandon) decideState.abandonment = abandon.value;
  const lensNote = root.querySelector("#d-lens-note");
  if (lensNote) decideState.lensNote = lensNote.value;
  const moves = root.querySelector("input[name='d-moves']:checked");
  if (moves) decideState.lensMoves = moves.value === "yes";
  const finalStance = root.querySelector("input[name='d-final-stance']:checked");
  if (finalStance) decideState.finalStanceId = finalStance.value;
  const finalConfidence = root.querySelector("input[name='d-final-confidence']:checked");
  if (finalConfidence) decideState.finalConfidence = Number(finalConfidence.value);
  const cited = root.querySelector("#d-cited");
  if (cited) decideState.cited = cited.value;
  const date = root.querySelector("#d-date");
  if (date) decideState.reviewDate = date.value;
}

function scaleControl(name, current, labels) {
  const wrap = decideEl("div", { class: "d-scale" });
  labels.forEach((label, index) => {
    const value = String(index + 1);
    const id = name + "-" + value;
    wrap.appendChild(decideEl("input", {
      type: "radio",
      name,
      id,
      value,
      class: "hidden",
      checked: Number(current) === index + 1,
    }));
    wrap.appendChild(decideEl("label", { class: "d-choice" + (Number(current) === index + 1 ? " active" : ""), for: id, text: label }));
  });
  return wrap;
}

function pairChoice(name, current, yesValue, noValue) {
  const wrap = decideEl("div", { class: "d-choices" });
  [[yesValue, dt("yes")], [noValue, dt("no")]].forEach(([value, label]) => {
    const id = name + "-" + value;
    wrap.appendChild(decideEl("input", {
      type: "radio",
      name,
      id,
      value,
      class: "hidden",
      checked: current === value || (value === "yes" && current === true) || (value === "no" && current === false),
    }));
    const active = (value === "yes" && current === true) || (value === "no" && current === false) || current === value;
    wrap.appendChild(decideEl("label", { class: "d-choice" + (active ? " active" : ""), for: id, text: label }));
  });
  return wrap;
}

function confidenceLabels() {
  return [dt("c1"), dt("c2"), dt("c3"), dt("c4"), dt("c5")];
}

function renderTree() {
  const tree = decideEl("aside", { class: "d-tree" });
  tree.appendChild(decideEl("p", { class: "d-meta", text: dt("kicker") }));
  if (!decideState.stanceId || !optionById(decideState.stanceId)) {
    tree.appendChild(decideEl("p", { class: "d-lead", text: dt("treeEmpty") }));
    return tree;
  }
  if (decideState.decision.trim()) {
    tree.appendChild(decideEl("p", { class: "d-decision", text: decideState.decision.trim() }));
  }
  const trunks = decideEl("div", { class: "d-trunks" });
  decideState.options.filter(option => option.text.trim()).forEach(option => {
    const stance = option.id === decideState.stanceId;
    trunks.appendChild(decideEl("div", { class: "d-trunk" + (stance ? " is-stance" : "") }, [
      decideEl("span", { class: "d-meta", text: stance ? dt("stance") : dt("options") }),
      decideEl("p", { text: option.text.trim() }),
    ]));
  });
  tree.appendChild(trunks);
  const branches = decideEl("div", { class: "d-branches" });
  filledArgs().forEach(arg => {
    const open = arg.id === openArgId();
    const crux = arg.id === decideState.cruxId;
    branches.appendChild(decideEl("div", {
      class: "d-branch" + (open ? " is-open" : "") + (crux ? " is-crux" : ""),
    }, [
      decideEl("span", { class: "d-meta", text: (arg.side === "for" ? dt("forSide") : dt("againstSide")) + (open ? " · " + dt("openBranch") : "") }),
      decideEl("p", { text: arg.text.trim() }),
      arg.assumption.trim() ? decideEl("span", { class: "d-meta", text: arg.assumption.trim() }) : null,
    ]));
  });
  tree.appendChild(branches);
  if (decideState.lensMoves && decideState.lensNote.trim()) {
    tree.appendChild(decideEl("div", { class: "d-side-card" }, [
      decideEl("span", { class: "d-meta", text: dt("citeLens") }),
      decideEl("p", { text: decideState.lensNote.trim() }),
    ]));
  }
  return tree;
}

function panelShell(title, lead, body) {
  const panel = decideEl("section", { class: "d-panel" });
  panel.appendChild(decideEl("h2", { text: title }));
  if (lead) panel.appendChild(decideEl("p", { class: "d-lead", text: lead }));
  body.forEach(node => panel.appendChild(node));
  panel.appendChild(decideEl("p", { class: "d-error", id: "d-error", text: decideError }));
  return panel;
}

function actionRow(includeBack) {
  const row = decideEl("div", { class: "d-actions" });
  if (includeBack) {
    row.appendChild(decideEl("button", { type: "button", class: "btn-ghost", id: "d-back", text: dt("back") }));
  }
  row.appendChild(decideEl("button", { type: "button", class: "btn-primary", id: "d-next", text: decideStep === "close" ? dt("finish") : decideStep === "depth" ? dt("begin") : dt("next") }));
  return row;
}

function renderDepth() {
  const normal = decideEl("button", { type: "button", class: "d-choice" + (decideState.depth === "normal" ? " active" : ""), "data-depth": "normal" }, [
    decideEl("strong", { text: dt("normal") }),
    decideEl("span", { text: dt("normalBody") }),
  ]);
  const extended = decideEl("button", { type: "button", class: "d-choice" + (decideState.depth === "extended" ? " active" : ""), "data-depth": "extended" }, [
    decideEl("strong", { text: dt("extended") }),
    decideEl("span", { text: dt("extendedBody") }),
  ]);
  const grid = decideEl("div", { class: "d-depth" }, [normal, extended]);
  return panelShell(dt("depthTitle"), dt("depthLead"), [grid, actionRow(false)]);
}

function renderRegister() {
  const decision = decideEl("div", { class: "field" }, [
    decideEl("label", { for: "d-decision", text: dt("decisionLabel") }),
    decideEl("textarea", { id: "d-decision", rows: "3", placeholder: dt("decisionPh"), text: decideState.decision }),
  ]);
  const options = decideEl("div", { class: "field" }, [
    decideEl("label", { text: dt("options") }),
  ]);
  decideState.options.forEach(option => {
    const row = decideEl("div", { class: "d-option" });
    row.appendChild(decideEl("input", {
      type: "radio",
      name: "d-stance",
      value: option.id,
      checked: decideState.stanceId === option.id,
      title: dt("stance"),
    }));
    row.appendChild(decideEl("input", {
      type: "text",
      id: "d-opt-" + option.id,
      value: option.text,
      placeholder: dt("optionPh"),
    }));
    if (decideState.options.length > 2) {
      row.appendChild(decideEl("button", {
        type: "button",
        class: "btn-ghost d-remove",
        "data-remove-option": option.id,
        text: dt("remove"),
      }));
    }
    options.appendChild(row);
  });
  const optionActions = decideEl("div", { class: "d-inline" });
  if (decideState.options.length < OPTION_CAP) {
    optionActions.appendChild(decideEl("button", { type: "button", class: "btn-ghost", id: "d-add-option", text: dt("addOption") }));
  }
  optionActions.appendChild(decideEl("button", { type: "button", class: "btn-ghost", id: "d-status-quo", text: dt("statusQuo") }));
  options.appendChild(optionActions);
  options.appendChild(decideEl("p", { class: "d-meta", text: dt("stance") }));
  const body = [
    decision,
    decideEl("p", { class: "d-disclaimer", text: dt("disclaimer") }),
    options,
    decideEl("div", { class: "field" }, [
      decideEl("label", { text: dt("confidence") }),
      scaleControl("d-confidence", decideState.confidence, confidenceLabels()),
    ]),
    decideEl("div", { class: "field" }, [
      decideEl("label", { text: dt("checkable") }),
      pairChoice("d-checkable", decideState.checkable, "yes", "no"),
    ]),
    actionRow(false),
  ];
  return panelShell(dt("registerTitle"), dt("registerLead"), body);
}

function renderArgument(arg) {
  const heavy = heaviestArgs().some(item => item.id === arg.id) && arg.text.trim() && arg.weight > 0;
  const block = decideEl("div", { class: "d-arg" });
  block.appendChild(decideEl("p", { class: "d-meta", text: arg.side === "for" ? dt("forSide") : dt("againstSide") }));
  block.appendChild(decideEl("textarea", {
    id: "d-arg-text-" + arg.id,
    rows: "2",
    placeholder: dt("argPh"),
    text: arg.text,
  }));
  block.appendChild(decideEl("label", { text: dt("weight") }));
  block.appendChild(scaleControl("d-weight-" + arg.id, arg.weight, [dt("w1"), "2", "3", "4", dt("w5")]));
  if (decideState.checkable) {
    block.appendChild(decideEl("label", { text: dt("argCheck") }));
    block.appendChild(pairChoice("d-can-" + arg.id, arg.checkable, "yes", "no"));
    if (arg.checkable) {
      block.appendChild(decideEl("label", { text: dt("support") }));
      block.appendChild(scaleControl("d-support-" + arg.id, arg.support, [dt("s1"), "2", "3", "4", dt("s5")]));
    }
  }
  block.appendChild(decideEl("label", { for: "d-assume-" + arg.id, text: dt("assumption") }));
  block.appendChild(decideEl("textarea", {
    id: "d-assume-" + arg.id,
    rows: "2",
    placeholder: dt("assumptionPh"),
    text: arg.assumption,
  }));
  block.appendChild(decideEl("p", { class: "d-meta", text: heavy ? dt("assumptionRequired") : dt("assumptionOptional") }));
  const count = decideState.args.filter(item => item.side === arg.side).length;
  if (decideState.depth === "extended" && count > 1) {
    block.appendChild(decideEl("button", {
      type: "button",
      class: "btn-ghost",
      "data-remove-arg": arg.id,
      text: dt("remove"),
    }));
  }
  return block;
}

function renderArguments() {
  const body = decideState.args.map(renderArgument);
  if (decideState.depth === "extended") {
    const row = decideEl("div", { class: "d-inline" });
    if (decideState.args.filter(arg => arg.side === "for").length < ARG_CAP) {
      row.appendChild(decideEl("button", { type: "button", class: "btn-ghost", id: "d-add-for", text: dt("addFor") }));
    }
    if (decideState.args.filter(arg => arg.side === "against").length < ARG_CAP) {
      row.appendChild(decideEl("button", { type: "button", class: "btn-ghost", id: "d-add-against", text: dt("addAgainst") }));
    }
    body.push(row);
  }
  body.push(actionRow(true));
  return panelShell(dt("argsTitle"), dt("argsLead"), body);
}

function renderCrux() {
  const cards = decideEl("div", { class: "d-cards" });
  assumptionCards().forEach(arg => {
    const id = "d-crux-" + arg.id;
    cards.appendChild(decideEl("input", {
      type: "radio",
      name: "d-crux",
      id,
      value: arg.id,
      class: "hidden",
      checked: decideState.cruxId === arg.id,
    }));
    const card = decideEl("label", { class: "d-card" + (decideState.cruxId === arg.id ? " active" : ""), for: id }, [
      decideEl("span", { class: "d-meta", text: arg.side === "for" ? dt("forSide") : dt("againstSide") }),
      decideEl("p", { text: arg.assumption.trim() }),
    ]);
    cards.appendChild(card);
  });
  const body = [cards];
  const selected = argById(decideState.cruxId);
  const top = heaviestArgs();
  const weak = selected && top.length && !top.some(arg => arg.id === selected.id);
  if (weak && !decideState.cruxKept) {
    body.push(decideEl("div", { class: "d-hint" }, [
      decideEl("p", { text: dt("hint") }),
      decideEl("div", { class: "d-inline" }, [
        decideEl("button", { type: "button", class: "btn-ghost", id: "d-keep-crux", text: dt("keepCrux") }),
        decideEl("button", { type: "button", class: "btn-ghost", id: "d-drop-crux", text: dt("otherCrux") }),
      ]),
    ]));
  }
  if (decideState.depth === "extended") {
    heaviestArgs().forEach(arg => {
      body.push(decideEl("label", { text: dt("veracity") }));
      const wrap = decideEl("div", { class: "d-choices" });
      [["verified", dt("verified")], ["verifiable", dt("verifiable")], ["unverifiable", dt("unverifiable")]].forEach(([value, label]) => {
        const id = "d-veracity-" + arg.id + "-" + value;
        wrap.appendChild(decideEl("input", {
          type: "radio",
          name: "d-veracity-" + arg.id,
          id,
          value,
          class: "hidden",
          checked: arg.veracity === value,
        }));
        wrap.appendChild(decideEl("label", { class: "d-choice" + (arg.veracity === value ? " active" : ""), for: id, text: label }));
      });
      body.push(wrap);
    });
  }
  body.push(actionRow(true));
  return panelShell(dt("cruxTitle"), dt("cruxLead"), body);
}

function renderRedTeam() {
  const crux = argById(decideState.cruxId);
  const body = [];
  if (crux) body.push(decideEl("p", { class: "d-lens-text", text: crux.assumption.trim() }));
  body.push(decideEl("textarea", { id: "d-red", rows: "3", placeholder: dt("redPh"), text: decideState.redTeam }));
  body.push(actionRow(true));
  return panelShell(dt("redTitle"), dt("redLead"), body);
}

function renderAbandon() {
  return panelShell(dt("abandonTitle"), dt("abandonLead"), [
    decideEl("textarea", { id: "d-abandon", rows: "3", placeholder: dt("abandonPh"), text: decideState.abandonment }),
    actionRow(true),
  ]);
}

function renderLens() {
  const body = [];
  if (!decideState.lens) {
    body.push(decideEl("button", { type: "button", class: "btn-primary", id: "d-draw", text: dt("draw") }));
  } else {
    body.push(decideEl("p", { class: "d-meta", text: dt("drawn") }));
    body.push(decideEl("p", { class: "d-lens-text", text: lensText() }));
    body.push(decideEl("textarea", { id: "d-lens-note", rows: "3", placeholder: dt("lensPh"), text: decideState.lensNote }));
    body.push(decideEl("label", { text: dt("lensMoves") }));
    body.push(pairChoice("d-moves", decideState.lensMoves, "yes", "no"));
  }
  body.push(actionRow(true));
  return panelShell(dt("lensTitle"), dt("lensLead"), body);
}

function renderClose() {
  if (decideState.closed) return renderMirror();
  const stances = decideEl("div", { class: "d-choices" });
  decideState.options.filter(option => option.text.trim()).forEach(option => {
    const id = "d-final-" + option.id;
    stances.appendChild(decideEl("input", {
      type: "radio",
      name: "d-final-stance",
      id,
      value: option.id,
      class: "hidden",
      checked: decideState.finalStanceId === option.id,
    }));
    stances.appendChild(decideEl("label", {
      class: "d-choice" + (decideState.finalStanceId === option.id ? " active" : ""),
      for: id,
      text: option.text.trim(),
    }));
  });
  const body = [
    decideEl("label", { text: dt("finalStance") }),
    stances,
    decideEl("label", { text: dt("finalConfidence") }),
    scaleControl("d-final-confidence", decideState.finalConfidence, confidenceLabels()),
  ];
  if (decideState.finalStanceId && decideState.finalConfidence && stanceChanged()) {
    const select = decideEl("select", { id: "d-cited" });
    select.appendChild(decideEl("option", { value: "", text: dt("citePick") }));
    filledArgs().forEach(arg => {
      select.appendChild(decideEl("option", {
        value: arg.id,
        text: dt("citeArg") + ": " + arg.text.trim(),
        selected: decideState.cited === arg.id,
      }));
    });
    [["crux", dt("citeCrux")], ["abandon", dt("citeAbandon")]].forEach(([value, label]) => {
      select.appendChild(decideEl("option", { value, text: label, selected: decideState.cited === value }));
    });
    if (decideState.lensMoves) {
      select.appendChild(decideEl("option", { value: "lens", text: dt("citeLens"), selected: decideState.cited === "lens" }));
    }
    select.appendChild(decideEl("option", { value: "none", text: dt("citeNone"), selected: decideState.cited === "none" }));
    body.push(decideEl("label", { for: "d-cited", text: dt("cite") }));
    body.push(select);
  }
  body.push(decideEl("label", { for: "d-date", text: dt("review") }));
  body.push(decideEl("input", { type: "date", id: "d-date", value: decideState.reviewDate }));
  body.push(actionRow(true));
  return panelShell(dt("closeTitle"), dt("closeLead"), body);
}

function renderMirror() {
  const before = optionById(decideState.stanceId);
  const after = optionById(decideState.finalStanceId);
  const list = decideEl("ul", { class: "d-list" });
  movementLines().forEach(line => list.appendChild(decideEl("li", { text: line })));
  const panel = panelShell(dt("mirrorTitle"), "", [
    decideEl("div", { class: "d-mirror" }, [
      decideEl("article", {}, [
        decideEl("span", { class: "d-meta", text: dt("before") }),
        decideEl("p", { text: before ? before.text : "" }),
        decideEl("span", { class: "d-meta", text: String(decideState.confidence) }),
      ]),
      decideEl("article", {}, [
        decideEl("span", { class: "d-meta", text: dt("after") }),
        decideEl("p", { text: after ? after.text : "" }),
        decideEl("span", { class: "d-meta", text: String(decideState.finalConfidence) }),
      ]),
    ]),
    list,
    decideEl("div", { class: "d-actions" }, [
      decideEl("button", { type: "button", class: "btn-void", id: "d-home", text: dt("home") }),
    ]),
  ]);
  return panel;
}

function renderStep() {
  if (decideStep === "depth") return renderDepth();
  if (decideStep === "register") return renderRegister();
  if (decideStep === "arguments") return renderArguments();
  if (decideStep === "crux") return renderCrux();
  if (decideStep === "redteam") return renderRedTeam();
  if (decideStep === "abandon") return renderAbandon();
  if (decideStep === "lens") return renderLens();
  return renderClose();
}

function renderDecide(anchor) {
  const root = document.getElementById("decide-root");
  if (!root || !decideState) return;
  const y = window.scrollY;
  root.innerHTML = "";
  const top = decideEl("div", { class: "d-top" }, [
    decideEl("p", { class: "d-kicker", text: dt("kicker") }),
  ]);
  if (decideState.depth && decideStep !== "depth") {
    top.appendChild(decideEl("p", { class: "d-lock", text: dt("locked") + " · " + (decideState.depth === "extended" ? dt("extended") : dt("normal")) }));
  }
  root.appendChild(top);
  const showTree = decideStep !== "depth";
  const layout = decideEl("div", { class: "d-layout" + (showTree ? "" : " solo") });
  if (showTree) layout.appendChild(renderTree());
  layout.appendChild(renderStep());
  root.appendChild(layout);
  bindDecide();
  if (anchor) root.scrollIntoView({ block: "start" });
  else window.scrollTo(0, y);
}

function todayStamp() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + month + "-" + day;
}

function validateDecide() {
  if (decideStep === "depth") {
    if (!decideState.depth) return dt("needDepth");
    return "";
  }
  if (decideStep === "register") {
    if (decideState.decision.trim().length < 10) return dt("needDecision");
    const written = decideState.options.filter(option => option.text.trim().length >= 2);
    if (written.length < 2) return dt("needOptions");
    if (!decideState.stanceId || !optionById(decideState.stanceId) || !optionById(decideState.stanceId).text.trim()) return dt("needStance");
    if (!decideState.confidence) return dt("needConfidence");
    if (decideState.checkable === null) return dt("needCheck");
    return "";
  }
  if (decideStep === "arguments") {
    const fors = filledArgs().filter(arg => arg.side === "for");
    const against = filledArgs().filter(arg => arg.side === "against");
    if (!fors.length || !against.length) return dt("needArgs");
    if (filledArgs().some(arg => arg.text.trim().length < 8 || !arg.weight)) return dt("needWeight");
    if (decideState.checkable && filledArgs().some(arg => arg.checkable === null)) return dt("needSupport");
    if (decideState.checkable && filledArgs().some(arg => arg.checkable && !arg.support)) return dt("needSupport");
    if (heaviestArgs().some(arg => arg.assumption.trim().length < 8)) return dt("needAssumption");
    return "";
  }
  if (decideStep === "crux") {
    if (!decideState.cruxId || !argById(decideState.cruxId)) return dt("needCrux");
    const selected = argById(decideState.cruxId);
    const weak = !heaviestArgs().some(arg => arg.id === selected.id);
    if (weak && !decideState.cruxKept) return dt("hint");
    if (decideState.depth === "extended" && heaviestArgs().some(arg => !arg.veracity)) return dt("needVeracity");
    return "";
  }
  if (decideStep === "redteam") {
    if (decideState.redTeam.trim().length < 12) return dt("needRed");
    return "";
  }
  if (decideStep === "abandon") {
    if (decideState.abandonment.trim().length < 12) return dt("needAbandon");
    return "";
  }
  if (decideStep === "lens") {
    if (!decideState.lens) return dt("needLens");
    if (decideState.lensMoves === null) return dt("needLens");
    if (decideState.lensMoves && decideState.lensNote.trim().length < 8) return dt("needLensNote");
    return "";
  }
  if (!decideState.finalStanceId || !decideState.finalConfidence) return dt("needFinal");
  if (stanceChanged() && !decideState.cited) return dt("needCite");
  if (!decideState.reviewDate || decideState.reviewDate < todayStamp()) return dt("needDate");
  return "";
}

function goDecide(next) {
  const steps = decideSteps();
  const index = steps.indexOf(decideStep);
  if (next) {
    const error = validateDecide();
    if (error) {
      decideError = error;
      renderDecide(true);
      return;
    }
    decideError = "";
    if (decideStep === "close") {
      closeDecide();
      return;
    }
    if (decideStep === "register" && !decideState.args.length) {
      decideState.args = [blankArg("for"), blankArg("against")];
    }
    if (decideStep === "arguments") decideState.args = filledArgs();
    decideStep = steps[Math.min(index + 1, steps.length - 1)];
  } else if (index > 1) {
    decideError = "";
    decideStep = steps[index - 1];
  }
  renderDecide(true);
}

function downloadDecide(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function closeDecide() {
  const lines = movementLines();
  decideState.summary = lines.join(" ");
  decideState.closed = true;
  const stamp = todayStamp();
  const payload = {
    depth: decideState.depth,
    decision: decideState.decision.trim(),
    checkable: decideState.checkable,
    options: decideState.options.filter(option => option.text.trim()).map(option => ({
      id: option.id,
      text: option.text.trim(),
      stanceAtStart: option.id === decideState.stanceId,
      stanceAtEnd: option.id === decideState.finalStanceId,
    })),
    confidenceAtStart: decideState.confidence,
    confidenceAtEnd: decideState.finalConfidence,
    arguments: filledArgs().map(arg => ({
      id: arg.id,
      side: arg.side,
      text: arg.text.trim(),
      weight: arg.weight,
      checkable: decideState.checkable ? arg.checkable : null,
      support: decideState.checkable && arg.checkable ? arg.support : null,
      assumption: arg.assumption.trim(),
      veracity: arg.veracity || null,
      crux: arg.id === decideState.cruxId,
    })),
    cruxKeptDespiteHint: decideState.cruxKept,
    redTeam: decideState.redTeam.trim(),
    abandonment: decideState.abandonment.trim(),
    lens: decideState.lens,
    lensInstruction: lensText(),
    lensNote: decideState.lensNote.trim(),
    lensEnteredTree: Boolean(decideState.lensMoves && decideState.lensNote.trim()),
    cited: stanceChanged() ? decideState.cited : "",
    reviewDate: decideState.reviewDate,
    movement: lines,
  };
  downloadDecide("vognis-decision-" + stamp + ".json", JSON.stringify(payload, null, 2), "application/json");
  const md = ["# Vognis", "", payload.decision, "", "## " + dt("mirrorTitle"), ...lines.map(line => "- " + line), "", "## " + dt("abandonTitle"), payload.abandonment];
  downloadDecide("vognis-decision-" + stamp + ".md", md.join("\n"), "text/markdown");
  renderDecide(true);
}

function bindDecide() {
  const root = document.getElementById("decide-root");
  root.querySelectorAll("[data-depth]").forEach(button => {
    button.addEventListener("click", () => {
      decideState.depth = button.dataset.depth;
      decideError = "";
      renderDecide();
    });
  });
  const next = root.querySelector("#d-next");
  if (next) next.addEventListener("click", () => { readDecideForm(); goDecide(true); });
  const back = root.querySelector("#d-back");
  if (back) back.addEventListener("click", () => { readDecideForm(); goDecide(false); });
  const addOption = root.querySelector("#d-add-option");
  if (addOption) addOption.addEventListener("click", () => {
    readDecideForm();
    if (decideState.options.length < OPTION_CAP) decideState.options.push(blankOption());
    renderDecide();
  });
  const status = root.querySelector("#d-status-quo");
  if (status) status.addEventListener("click", () => {
    readDecideForm();
    const empty = decideState.options.find(option => !option.text.trim());
    if (empty) empty.text = dt("statusQuo");
    else if (decideState.options.length < OPTION_CAP) {
      const option = blankOption();
      option.text = dt("statusQuo");
      decideState.options.push(option);
    }
    renderDecide();
  });
  root.querySelectorAll("[data-remove-option]").forEach(button => {
    button.addEventListener("click", () => {
      readDecideForm();
      if (decideState.options.length <= 2) return;
      decideState.options = decideState.options.filter(option => option.id !== button.dataset.removeOption);
      if (!optionById(decideState.stanceId)) decideState.stanceId = "";
      renderDecide();
    });
  });
  const addFor = root.querySelector("#d-add-for");
  if (addFor) addFor.addEventListener("click", () => {
    readDecideForm();
    decideState.args.push(blankArg("for"));
    renderDecide();
  });
  const addAgainst = root.querySelector("#d-add-against");
  if (addAgainst) addAgainst.addEventListener("click", () => {
    readDecideForm();
    decideState.args.push(blankArg("against"));
    renderDecide();
  });
  root.querySelectorAll("[data-remove-arg]").forEach(button => {
    button.addEventListener("click", () => {
      readDecideForm();
      decideState.args = decideState.args.filter(arg => arg.id !== button.dataset.removeArg);
      renderDecide();
    });
  });
  const keep = root.querySelector("#d-keep-crux");
  if (keep) keep.addEventListener("click", () => {
    readDecideForm();
    decideState.cruxKept = true;
    decideError = "";
    renderDecide();
  });
  const drop = root.querySelector("#d-drop-crux");
  if (drop) drop.addEventListener("click", () => {
    readDecideForm();
    decideState.cruxId = "";
    decideState.cruxKept = false;
    renderDecide();
  });
  const draw = root.querySelector("#d-draw");
  if (draw) draw.addEventListener("click", () => {
    readDecideForm();
    decideState.lens = LENS_KEYS[Math.floor(Math.random() * LENS_KEYS.length)];
    renderDecide();
  });
  const home = root.querySelector("#d-home");
  if (home) home.addEventListener("click", () => location.reload());
  root.querySelectorAll("input, textarea, select").forEach(field => {
    field.addEventListener("change", () => {
      readDecideForm();
      if (field.type === "radio" || field.tagName === "SELECT") renderDecide();
    });
  });
}

function startDecide() {
  decideState = freshDecide();
  decideStep = "depth";
  decideError = "";
  document.getElementById("home").classList.add("hidden");
  const workspace = document.getElementById("workspace");
  const closing = document.getElementById("closing");
  if (workspace) workspace.classList.add("hidden");
  if (closing) closing.classList.add("hidden");
  document.getElementById("decide-root").classList.remove("hidden");
  document.body.classList.add("in-decide");
  renderDecide(true);
}

document.addEventListener("DOMContentLoaded", () => {
  const orb = document.getElementById("orb-decide");
  if (orb && window.constellationFocus) {
    orb.addEventListener("mouseenter", () => {
      const rect = orb.getBoundingClientRect();
      window.constellationFocus(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    orb.addEventListener("mouseleave", () => window.constellationFocus(null, null));
  }
  if (typeof onLang === "function") {
    onLang(() => {
      if (!decideState) return;
      readDecideForm();
      renderDecide();
    });
  }
});
