// ================== CONFIGURATION ==================
const CONFIG = {
  mode: "demo",                       // plus tard : "ai"
  apiUrl: "/.netlify/functions/chat", // serveur sécurisé (étape future)
  storageKey: "fatiha-conversation",
  maxHistory: 50
};

// ================== ÉLÉMENTS DE LA PAGE ==================
const chat = document.getElementById("chat");
const form = document.getElementById("composer");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const suggestions = document.getElementById("suggestions");
document.getElementById("status").textContent =
  CONFIG.mode === "ai" ? "En ligne" : "Mode démo (sans IA)";

let messages = loadHistory();

// ================== AFFICHAGE ==================
function addBubble(role, text, extraClass = "") {
  const div = document.createElement("div");
  div.className = ("msg " + role + " " + extraClass).trim();
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function render() {
  chat.innerHTML = "";
  if (messages.length === 0) {
    addBubble("assistant",
      "Bonjour, je suis Fatiha 👋
Je t'aide en mathématiques et en physique-chimie, étape par étape.
Pose-moi une question !");
  }
  messages.forEach(m => addBubble(m.role, m.content));
  suggestions.style.display = messages.length ? "none" : "flex";
}

// ================== MÉMOIRE LOCALE ==================
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(CONFIG.storageKey)) || []; }
  catch { return []; }
}

function saveHistory() {
  messages = messages.slice(-CONFIG.maxHistory);
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(messages));
}

// ================== CERVEAU DE FATIHA ==================
async function getReply(history) {
  if (CONFIG.mode === "ai") return askAI(history);
  await new Promise(r => setTimeout(r, 400));
  return demoBrain(history[history.length - 1].content);
}

// Mode IA réelle : appelle le serveur Netlify (la clé restera cachée côté serveur)
async function askAI(history) {
  const res = await fetch(CONFIG.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history })
  });
  if (!res.ok) throw new Error("serveur indisponible (" + res.status + ")");
  const data = await res.json();
  return data.reply;
}
// ---------- Outils mathématiques ----------
function fmt(n) {
  const r = Math.round(n * 1e6) / 1e6;
  return String(r).replace(".", ",");
}

function toJs(expr) {
  let e = expr.toLowerCase()
    .replace(/,/g, ".")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "");
  if (!/^[0-9x+\-*/^().]+$/.test(e)) return null; // sécurité : uniquement des caractères mathématiques
  e = e.replace(/(\d)(x|\()/g, "$1*$2")
       .replace(/\)(x|\d|\()/g, ")*$1")
       .replace(/x\(/g, "x*(")
       .replace(/\^/g, "**");
  return e;
}

function makeFn(expr) {
  const js = toJs(expr);
  if (!js) return null;
  try {
    const f = new Function("x", "return (" + js + ");");
    f(1);
    return f;
  } catch { return null; }
}

function isLinear(f) {
  const f0 = f(0), f1 = f(1);
  return [2, 3, -1].every(t => {
    const v = f(t);
    return isFinite(v) && Math.abs(v - (f0 + t * (f1 - f0))) < 1e-7;
  });
}

function solveLinear(text) {
  const m = text.match(/([0-9x+\-*/^().,\s]+)=([0-9x+\-*/^().,\s]+)/i);
  if (!m || !/x/i.test(m[0])) return null;
  const left = m[1].trim(), right = m[2].trim();
  const L = makeFn(left), R = makeFn(right);
  if (!L || !R) return null;

  if (!isLinear(L) || !isLinear(R)) {
    return "Cette équation n'est pas du premier degré.
En mode démo, je résous seulement les équations du type ax + b = c. Une fois connectée à une vraie IA, j'irai beaucoup plus loin !";
  }

  const a = (L(1) - L(0)) - (R(1) - R(0));
  const b = R(0) - L(0);
  const steps = [
    "Équation : " + left + " = " + right,
    "",
    "Étape 1 : je regroupe les termes en x à gauche et les nombres à droite.",
    "→ " + fmt(a) + "x = " + fmt(b)
  ];

  if (Math.abs(a) < 1e-12) {
    steps.push("", Math.abs(b) < 1e-12
      ? "0 = 0 est toujours vrai : tous les nombres sont solutions."
      : "0 = " + fmt(b) + " est impossible : l'équation n'a aucune solution.");
    return steps.join("
");
  }

  const x = b / a;
  steps.push(
    "",
    "Étape 2 : je divise les deux côtés par " + fmt(a) + ".",
    "→ x = " + fmt(b) + " / " + fmt(a) + " = " + fmt(x),
    "",
    "Vérification : avec x = " + fmt(x) + ", on obtient " + fmt(L(x)) + " = " + fmt(R(x)) + " ✔",
    "",
    "✅ Solution : x = " + fmt(x)
  );
  return steps.join("");
}

function calculate(text) {
  const m = text.match(/[0-9+\-*/^().,×÷\s]{3,}/);
  if (!m || !/[+\-*/^×÷]/.test(m[0]) || !/\d/.test(m[0])) return null;
  const expr = m[0].trim();
  const f = makeFn(expr);
  if (!f) return null;
  const r = f(0);
  if (!isFinite(r)) return "Ce calcul n'a pas de résultat fini (division par zéro ?).";
  return "Calcul : " + expr + "
Résultat : " + fmt(r) +
    "

Rappel des priorités : parenthèses, puissances, multiplications et divisions, puis additions et soustractions.";
}

// ---------- Petite base de connaissances ----------
const KNOWLEDGE = [
  { keys: ["bonjour", "salut", "coucou", "bonsoir"],
    answer: "Bonjour ! 😊 Donne-moi un exercice de maths ou de physique-chimie, ou essaie une suggestion." },
  { keys: ["mole"],
    answer: "La mole (mol) est l'unité de quantité de matière.
1 mole contient environ 6,02 × 10²³ entités (nombre d'Avogadro).

Formule utile : n = m / M
• n : quantité de matière (mol)
• m : masse (g)
• M : masse molaire (g/mol)" },
  { keys: ["pythagore"],
    answer: "Théorème de Pythagore : dans un triangle rectangle, le carré de l'hypoténuse est égal à la somme des carrés des deux autres côtés.

BC² = AB² + AC²  (si le triangle est rectangle en A)" },
  { keys: ["ohm"],
    answer: "Loi d'Ohm : U = R × I
• U : tension (volts, V)
• R : résistance (ohms, Ω)
• I : intensité (ampères, A)" },
  { keys: ["vitesse"],
    answer: "Vitesse moyenne : v = d / t
• d : distance (m)
• t : durée (s)
• v : vitesse (m/s)

Astuce : pour passer de km/h à m/s, on divise par 3,6." },
  { keys: ["masse volumique"],
    answer: "Masse volumique : ρ = m / V
• m : masse (kg ou g)
• V : volume (m³ ou L)
Exemple : l'eau a une masse volumique de 1 kg/L." }
];

function normalize(t) {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function knowledge(text) {
  const t = normalize(text);
  for (const item of KNOWLEDGE) {
    if (item.keys.some(k => new RegExp("\\b" + normalize(k) + "\\b").test(t))) return item.answer;
  }
  return null;
}

function demoBrain(text) {
  return solveLinear(text)
    || calculate(text)
    || knowledge(text)
    || "Je suis encore en mode démo : je sais résoudre les équations du 1er degré (ex : 3x - 5 = 10), faire des calculs, et expliquer quelques notions (mole, Pythagore, loi d'Ohm, vitesse, masse volumique).
Bientôt, je serai connectée à une vraie intelligence artificielle !";
}// ================== ENVOI DES MESSAGES ==================
async function send(text) {
  text = text.trim();
  if (!text || sendBtn.disabled) return;

  messages.push({ role: "user", content: text });
  saveHistory();
  render();
  input.value = "";
  autoResize();
  sendBtn.disabled = true;

  const typing = addBubble("assistant", "Fatiha réfléchit...", "typing");
  try {
    const reply = await getReply(messages);
    messages.push({ role: "assistant", content: reply });
  } catch (err) {
    messages.push({ role: "assistant", content: "Oups, une erreur est survenue : " + err.message });
  }
  typing.remove();
  saveHistory();
  render();
  sendBtn.disabled = false;
}

function autoResize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
}

form.addEventListener("submit", e => { e.preventDefault(); send(input.value); });
input.addEventListener("input", autoResize);
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input.value); }
});
suggestions.addEventListener("click", e => {
  if (e.target.classList.contains("chip")) send(e.target.textContent);
});
clearBtn.addEventListener("click", () => {
  if (confirm("Effacer toute la conversation ?")) {
    messages = [];
    saveHistory();
    render();
  }
});

render();
