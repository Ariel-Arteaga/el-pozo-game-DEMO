// game.js — CLIENTE (v3)
// El servidor sigue siendo el único que decide muertes, daño y estado.
// Este archivo solo pide acciones y dibuja (más la narrativa ambiental,
// que es puramente cosmética y no afecta ninguna regla del juego).

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const fullscreenBtn = document.getElementById("fullscreen-btn");
const radarCanvas = document.getElementById("radar-canvas");
const radarCtx = radarCanvas ? radarCanvas.getContext("2d") : null;

let WORLD_W = 1400;
let WORLD_H = 800;
const VIEWPORT_W = 960;
const VIEWPORT_H = 560;
let scale = 1;

function resizeCanvas() {
  const maxW = window.innerWidth * 0.98;
  const maxH = document.fullscreenElement ? window.innerHeight * 0.95 : window.innerHeight * 0.82;
  scale = Math.min(maxW / VIEWPORT_W, maxH / VIEWPORT_H);
  canvas.width = VIEWPORT_W * scale;
  canvas.height = VIEWPORT_H * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
document.addEventListener("fullscreenchange", resizeCanvas);

const fullscreenHint = document.getElementById("fullscreen-hint");
const barHealth = document.getElementById("bar-health");
const barStamina = document.getElementById("bar-stamina");
const livesDisplay = document.getElementById("lives-display");
const ammoCount = document.getElementById("ammo-count");
const cavadoresCount = document.getElementById("cavadores-count");
const enemiesCount = document.getElementById("enemies-count");
const scoreCount = document.getElementById("score-count");
const grenadeCount = document.getElementById("grenade-count");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const restartBtn = document.getElementById("restart-btn");
const overlaySubtext = document.getElementById("overlay-subtext");
const finalScoreValue = document.getElementById("final-score-value");
const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("start-btn");
const pauseMenu = document.getElementById("pause-menu");
const letterOverlay = document.getElementById("letter-overlay");
const letterContent = document.getElementById("letter-content");
const closeLetterBtn = document.getElementById("close-letter-btn");
const pazOverlay = document.getElementById("paz-overlay");
const pazContinueBtn = document.getElementById("paz-continue-btn");

// ---------------------------------------------------------------------------
// FINAL: LA PAZ EN EL CHACO — se muestra al ganar, antes del parte de guerra.
// (No se enfoca ningún botón a propósito: si el jugador viene spameando
// ESPACIO, un botón enfocado se activaría solo y saltaría la escena.)
// ---------------------------------------------------------------------------
let pazOpen = false;
let pazOpenedAt = 0;

function openPeaceScreen() {
  pazOpen = true;
  pazOpenedAt = performance.now();
  keysDown.clear();
  overlay.classList.add("hidden");
  pazOverlay.classList.remove("hidden"); // al mostrarse, sus animaciones CSS arrancan solas
}

function closePeaceScreen() {
  if (!pazOpen) return;
  pazOpen = false;
  pazOverlay.classList.add("hidden");
  overlay.classList.remove("hidden");
  showEndingNarrative();
}

pazContinueBtn.addEventListener("click", closePeaceScreen);
window.addEventListener("keydown", (e) => {
  if (!pazOpen) return;
  if (e.key !== "Enter" && e.key !== " " && e.key !== "Escape") return;
  e.preventDefault();
  // Ignora el teclado los primeros 1.8 s para no saltarse la escena sin querer.
  if (!e.repeat && performance.now() - pazOpenedAt > 1800) closePeaceScreen();
});

// ---------------------------------------------------------------------------
// CARTAS NARRATIVAS (MODO HISTORIA) — puramente cosméticas: no tocan reglas.
// level: índice de nivel (0 = antes de empezar, 1 y 2 = al entrar al nivel).
// ---------------------------------------------------------------------------
const NARRATIVE_LETTERS = [
  {
    level: 0,
    lugar: "Chaco Boreal · Mediados de 1932",
    num: "Carta N.º 1",
    titulo: "El Infierno Verde",
    sello: "Reservado",
    parrafos: [
      "Nuestros abuelos y bisabuelos vivieron una horrible guerra entre hermanos...",
      "Al Chaco Boreal lo llamaron <span class='sangre-texto'>«infierno verde»</span>: por el calor sofocante y por la falta de agua, que mató a más soldados que el propio enemigo.",
      "La música que se escucha a continuación reflejó aquellas penas. Esta y otras forman parte del repertorio de una época en que los jóvenes se despedían de sus seres queridos para ir a la guerra.",
    ],
    firma: "— Para quienes no volvieron",
  },
  {
    level: 1,
    lugar: "Diario de campaña · Atardecer",
    num: "Carta N.º 2",
    titulo: "Ruido de motores",
    sello: "Urgente",
    parrafos: [
      "La infantería enemiga nos pisa los talones, pero el verdadero terror es el estruendo de sus motores. Han traído <span class='sangre-texto'>maquinaria pesada</span>.",
      "Nuestros fusiles no les hacen <span class='tachado'>ni cosquillas</span> al acero. Solo nos queda esquivar su fuego, esperar a que se atasquen en la arena suelta y lanzarles nuestras últimas granadas.",
      "La sed ya nos nubla la vista.",
    ],
    firma: "— Subocial Navajas",
  },
  {
    level: 2,
    lugar: "El Pozo · Medianoche",
    num: "Carta N.º 3",
    titulo: "La vigilia",
    sello: "Última",
    parrafos: [
      "Llegamos. Encontramos el pozo de Plácido Huanca que menciona Céspedes. Pero apenas tiene barro húmedo en el fondo.",
      "Los vigías informan que sombras se acercan por el frente este y los aviones cruzan el cielo. Nos rodea la oscuridad total.",
      "Preparen el lanzallamas... si vamos a morir en este infierno, que sea <span class='sangre-texto'>luchando</span>. Que Dios se apiade de nosotros.",
    ],
    firma: "— Subocial Navajas",
  },
];

let letterOpen = false;
let letterPausedGame = false;
let pendingLevelStart = null;
const lettersShown = new Set();

function renderLetter(l) {
  const papel = letterOverlay.querySelector(".carta-papel");
  if (papel) papel.classList.toggle("tipo-maquina", l.tipo === "maquina");
  const parrafos = l.parrafos.map((t, i) => `<p style="--i:${i}">${t}</p>`).join("");
  letterContent.innerHTML =
    `<span class="sello">${l.sello}</span>` +
    `<div class="fecha"><span>${l.lugar}</span><span>${l.num}</span></div>` +
    `<h3 id="letter-title" class="carta-titulo">${l.titulo}</h3>` +
    parrafos +
    `<p class="firma" style="--i:${l.parrafos.length}">${l.firma}</p>`;
  if (letterContent.parentElement) letterContent.parentElement.scrollTop = 0;
}

// Abre la carta del nivel. Si pauseGame es true, pausa el servidor mientras se lee.
function openLetter(levelIndex, pauseGame) {
  const l = NARRATIVE_LETTERS.find((x) => x.level === levelIndex);
  if (!l) return false;
  renderLetter(l);
  letterOpen = true;
  keysDown.clear();
  letterOverlay.classList.remove("hidden");
  closeLetterBtn.focus();
  if (pauseGame && latestState && !latestState.paused) {
    letterPausedGame = true;
    requestPause();
    // Reintento por si el primer pedido de pausa chocó con otro en vuelo.
    setTimeout(() => {
      if (letterOpen && latestState && !latestState.paused) requestPause();
    }, 250);
  }
  return true;
}

async function closeLetter() {
  if (!letterOpen) return;
  letterOpen = false;
  letterOverlay.classList.add("hidden");
  keysDown.clear();

  if (pendingLevelStart !== null) {
    pendingLevelStart = null;
    startScreen.classList.add("hidden");
    await resetGame();
    startBtn.disabled = false;
    showFullscreenHint();
  } else if (letterPausedGame) {
    letterPausedGame = false;
    if (latestState && latestState.paused) await requestPause();
  }
}

function showFullscreenHint() {
  if (!fullscreenHint) return;
  fullscreenHint.classList.remove("show");
  void fullscreenHint.offsetWidth; // reinicia la animación
  fullscreenHint.classList.add("show");
}

closeLetterBtn.addEventListener("click", closeLetter);

// ---------------------------------------------------------------------------
// MODO AVENTURA (3 frentes) + ARCHIVO DE HISTORIA
// ---------------------------------------------------------------------------
const levelSelect = document.getElementById("level-select");
const lsBackBtn = document.getElementById("ls-back-btn");
const historyBtn = document.getElementById("history-btn");
const historyOverlay = document.getElementById("history-overlay");
const historyGrid = document.getElementById("hist-grid");
const historyScroll = historyOverlay.querySelector(".hist-scroll");
const histBackBtn = document.getElementById("hist-back-btn");

let selectedLevel = 0; // nivel con el que arranca (y reintenta) la partida

// Cartas extra: solo viven en el Archivo de Historia (no salen durante la partida).
const EXTRA_LETTERS = [
  {
    lugar: "Marcha nocturna · Verano de 1933",
    num: "Carta N.º 4",
    titulo: "Cada sorbo se cuenta",
    sello: "Sed",
    tipo: "carta",
    parrafos: [
      "Anoche se acabó el agua de las cantimploras. Hoy alguien lamió el rocío de las hojas antes del amanecer, y otro tomó agua de un charco que no debía. Nadie dijo nada.",
      "La sed no duele solo en la garganta. Te enturbia la cabeza, te hace ver lagunas donde solo hay arena y monte. Los más jóvenes ya hablan solos.",
      "Mientras el camión de agua no llegue, cada gota vale más que una bala.",
    ],
    firma: "— Un soldado sin nombre",
  },
  {
    lugar: "Fortín Boquerón · Septiembre de 1932",
    num: "Documento N.º 5",
    titulo: "Telegrama desde Boquerón",
    sello: "Reconstrucción",
    tipo: "maquina",
    parrafos: [
      "GUARNICIÓN RESISTE. CERCO CASI COMPLETO. MUNICIÓN ESCASEA. AGUA RACIONADA. STOP.",
      "SE ESPERAN REFUERZOS QUE NO LLEGAN. LA MORAL SE SOSTIENE CON PURA TERQUEDAD. STOP.",
      "Nota del archivo: el asedio de Boquerón duró casi tres semanas y terminó con la rendición de la guarnición. Este telegrama es una reconstrucción.",
    ],
    firma: "— Estación de campaña",
  },
  {
    lugar: "Campamento · Noche cerrada",
    num: "Carta N.º 6",
    titulo: "Mamá, extraño el frío",
    sello: "Correo de campaña",
    tipo: "carta",
    parrafos: [
      "Mamá: aquí no hay frío como el de casa, aquí el sol te aplasta desde que sale. Yo, que crecí entre cerros, nunca pensé que extrañaría tanto el viento helado.",
      "Mastico coca para engañar al hambre y al cansancio, como me enseñó el abuelo. Los muchachos dicen que la guerra pasa pronto. No les creo, pero les sonrío.",
      "Si el correo llega, guarda esta carta. Si no llega, guarda mi lugar en la mesa.",
    ],
    firma: "— Tu hijo",
  },
  {
    lugar: "Ficha del archivo · La Paz, 1936",
    num: "Documento N.º 7",
    titulo: "Sangre de mestizos",
    sello: "Literatura",
    tipo: "maquina",
    parrafos: [
      "Augusto Céspedes (1904–1997) fue escritor, periodista y político boliviano. Vivió la Guerra del Chaco de cerca y la convirtió en literatura.",
      "En 1936 publicó «Sangre de mestizos», un libro de relatos sobre la guerra. Uno de ellos es «El pozo»: soldados, sed y un agujero en la tierra.",
      "Este juego se inspira libremente en ese cuento. Los personajes y los hechos del juego son ficción; el dolor de esa guerra no lo fue.",
    ],
    firma: "— Nota del archivo",
  },
  {
    lugar: "Frente paraguayo · Monte cerrado",
    num: "Carta N.º 8",
    titulo: "También teníamos sed",
    sello: "Del otro lado",
    tipo: "carta",
    parrafos: [
      "Mamá: en el monte hablamos guaraní para no sentirnos solos. Somos campesinos, muchos vamos descalzos, y la sed nos muerde igual que a ellos.",
      "Anoche escuché cantar al otro lado una melodía triste que no entendí. Sonaba a las de mi tierra.",
      "Nos mandaron a matarnos por un monte que ninguno de nosotros eligió.",
    ],
    firma: "— Un soldado paraguayo",
  },
  {
    lugar: "Campo de prisioneros · 1933",
    num: "Carta N.º 9",
    titulo: "Soga y silencio",
    sello: "Cautivo",
    tipo: "carta",
    parrafos: [
      "Nos ataron con soga fina, de las que cortan sin hacer ruido. Caminamos días con las manos amarradas, bebiendo lo que nos daban.",
      "El que se rinde deja de ser soldado y pasa a ser una boca más que alimentar. Yo solo pienso en volver, en que alguien nos encuentre antes de que el monte nos gane.",
      "Si estás leyendo esto y aún tienes un fusil: no te olvides de los que quedamos atrás.",
    ],
    firma: "— Prisionero N.º 214",
  },
  {
    lugar: "Cese el fuego · 12 de junio de 1935",
    num: "Documento N.º 10",
    titulo: "Se callaron los fusiles",
    sello: "Fin",
    tipo: "maquina",
    parrafos: [
      "El 12 de junio de 1935 se acordó el cese del fuego. Tras tres años de guerra, el Chaco quedó en silencio.",
      "La paz definitiva se firmó en Buenos Aires en 1938. Paraguay conservó la mayor parte del Chaco Boreal.",
      "Decenas de miles de hombres de ambos países no volvieron. Los que sí, regresaron cambiados para siempre: ese silencio también pesa.",
    ],
    firma: "— Nota del archivo",
  },
];

// ---------- Modo Aventura: los 3 cuadros ----------
function openLevelSelect() {
  levelSelect.classList.remove("hidden");
  const first = levelSelect.querySelector(".nivel-card");
  if (first) first.focus();
}

function closeLevelSelect() {
  levelSelect.classList.add("hidden");
  startBtn.focus();
}

async function startAdventure(levelIndex) {
  selectedLevel = levelIndex;
  levelSelect.classList.add("hidden");
  startBtn.disabled = true;
  lettersShown.clear(); // partida nueva: las cartas de los niveles vuelven a salir

  // Nivel 1: primero la carta inicial; la partida arranca al cerrarla (ver closeLetter).
  if (levelIndex === 0 && openLetter(0, false)) {
    pendingLevelStart = 0;
  } else {
    startScreen.classList.add("hidden");
    await resetGame(levelIndex);
    startBtn.disabled = false;
    showFullscreenHint();
  }
}

levelSelect.querySelectorAll(".nivel-card").forEach((card) => {
  card.addEventListener("click", () => startAdventure(Number(card.dataset.level)));
});
lsBackBtn.addEventListener("click", closeLevelSelect);

// ---------- Archivo de Historia ----------
function openArchiveLetter(l) {
  renderLetter(l);
  letterOpen = true;
  keysDown.clear();
  letterOverlay.classList.remove("hidden");
  closeLetterBtn.focus();
}

function letterSnippet(l) {
  const tmp = document.createElement("div");
  tmp.innerHTML = l.parrafos[0];
  return tmp.textContent;
}

function renderHistoryGrid() {
  historyGrid.innerHTML = "";
  const todas = [
    ...NARRATIVE_LETTERS.map((l) => ({ ...l, enCampana: true })),
    ...EXTRA_LETTERS.map((l) => ({ ...l, enCampana: false })),
  ];
  for (const l of todas) {
    const card = document.createElement("button");
    card.className = "hist-card" + (l.enCampana ? " en-campana" : "");
    card.innerHTML =
      `<span class="hist-tipo"><span>${l.tipo === "maquina" ? "Documento" : "Carta"}</span><span>${l.num}</span></span>` +
      `<span class="hist-titulo">${l.titulo}</span>` +
      `<span class="hist-lugar">${l.lugar}</span>` +
      `<span class="hist-resumen">${letterSnippet(l)}</span>` +
      `<span class="hist-pie"><em>${l.enCampana ? "En campaña" : "Archivo"}</em><span>Leer →</span></span>`;
    card.addEventListener("click", () => openArchiveLetter(l));
    historyGrid.appendChild(card);
  }
}

function openHistory() {
  historyOverlay.classList.remove("hidden");
  historyScroll.scrollTop = 0;
  histBackBtn.focus();
}

function closeHistory() {
  historyOverlay.classList.add("hidden");
  historyBtn.focus();
}

historyBtn.addEventListener("click", openHistory);
histBackBtn.addEventListener("click", closeHistory);
renderHistoryGrid();

// Teclado de los menús: ESC vuelve atrás y 1/2/3 eligen frente.
window.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || letterOpen) return; // si hay carta abierta, ella manda
  if (e.key === "Escape") {
    if (!historyOverlay.classList.contains("hidden")) closeHistory();
    else if (!levelSelect.classList.contains("hidden")) closeLevelSelect();
    return;
  }
  if (!levelSelect.classList.contains("hidden") && ["1", "2", "3"].includes(e.key)) {
    startAdventure(Number(e.key) - 1);
  }
});
const pauseResumeBtn = document.getElementById("pause-resume-btn");
const pauseRestartBtn = document.getElementById("pause-restart-btn");
const pauseMenuBtn = document.getElementById("pause-menu-btn");

// Estado global del flujo: 'MENU' | 'PLAYING' | 'GAMEOVER'
let gameState = "MENU";

let latestState = null;
let keysDown = new Set();
let lastMoveSentAt = 0;
let lastStateFetchAt = 0;
const MOVE_SEND_INTERVAL = 30;
const STATE_FETCH_INTERVAL = 50;

let bullets = [];
const BULLET_RANGE = 250;
const BULLET_DURATION = 200;

let grenadeThrows = [];
let meleeSlashes = [];
let explosionAnims = [];
let lingeringSmokes = [];
let scorchMarks = [];
let bloodSpurts = [];
let impactSparks = []; // chispas/tierra cuando una bala pega en un enemigo (no lo mata)
let fallingUnits = []; // colapso breve de un soldado enemigo al morir
let charredUnits = [];
let planeCrashes = new Map(); // jefe bombardero derribado: caída en llamas (id → animación)
let vehicleExplosionAnims = []; // explosión mecánica propia de los tanques al ser destruidos
let shellImpactAnims = []; // pequeñas explosiones de impacto del obús del tanque pesado
let enemyMortarThrows = [];
let mortarShotIds = new Set();
let planeBombThrows = [];
let planeBombShotIds = new Set();
const PLANE_ALTITUDE_PX = 230; // ¡ALTITUD REALISTA! Separa visualmente el avión de su sombra
let renderedEnemyShotIds = new Set();
let renderedExplosionIds = new Set();
let renderedHitIds = new Set();
let renderedShellImpactIds = new Set();

let lastShotVisualAt = 0;
let lastMeleeVisualAt = -10000;
const MELEE_THRUST_MS = 280; // duración de la estocada con bayoneta
const RECOIL_DURATION_MS = 160; // duración del culatazo al disparar el fusil
const enemyFiringUntil = new Map();
const enemyHitUntil = new Map(); // id -> { until, killed } — flash de daño sobre el enemigo
const planeBombOpenUntil = new Map(); // plane.id -> hasta cuándo se ve la compuerta abierta

const muzzlePoints = new Map();

let prevHealth = null;
let damageFlashUntil = 0;
let lastEnemyGunshotSoundAt = 0;
let lastFootstepAt = 0;
let gameOverSoundPlayed = false;
let prevIsTransitioning = false;
let shakeUntil = 0;
let shakeMag = 0;
const DAMAGE_FLASH_MS = 420;
const ENEMY_HIT_FLASH_MS = 260;

const DIR_OFFSETS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// ---------------------------------------------------------------------------
// COLISIONES (predicción del cliente — la validación real es del servidor)
// ---------------------------------------------------------------------------
const BODY_RADIUS = 9;

function blockedAt(x, y) {
  const cols = latestState && latestState.colliders;
  if (Array.isArray(cols)) {
    for (const c of cols) {
      if (typeof c.r === "number") {
        if (Math.hypot(x - c.x, y - c.y) < c.r + BODY_RADIUS) return true;
      } else if (
        x > c.x - BODY_RADIUS && x < c.x + c.w + BODY_RADIUS &&
        y > c.y - BODY_RADIUS * 0.6 && y < c.y + c.h + BODY_RADIUS * 0.6
      ) {
        return true;
      }
    }
  }
  // Tampoco dejamos que el cliente prediga un paso que lo mete adentro de
  // un enemigo vivo — así no se ve el "atraviese fantasma" ni un instante
  // antes de que el servidor confirme el bloqueo.
  if (latestState) {
    for (const e of latestState.enemies) {
      if (!e.alive) continue;
      if (e.type === "jefe_avion") continue; // vuela: su sombra no bloquea el paso
      if (e.type === "jefe_canon" && !e.entered) continue; // todavía está entrando
      const r = ENEMY_RADIUS[e.type] || ENEMY_RADIUS.soldado;
      if (Math.hypot(x - e.x, y - e.y) < r + BODY_RADIUS) return true;
    }
  }
  return false;
}

const ENEMY_RADIUS = { soldado: 12, tanqueta: 20, torreta: 18, mortero: 16, tanqueta_pesada: 27, tanqueta_asalto: 16, tren_blindado: 60, jefe_canon: 84 };
// Jefe nivel 3: hitbox elíptica en su SOMBRA. Debe coincidir con el servidor (radius y radius / 2).
const JEFE_AVION_RX = 110;
const JEFE_AVION_RY = 55;

// ---------------------------------------------------------------------------
// UNIFORMES
// ---------------------------------------------------------------------------
const UNIFORMS = {
  boliviano: {
    cloth: "#8f7f48", clothDark: "#544a24", clothLight: "#b8a860",
    skin: "#d9a273", skinDark: "#8f5f3c", faceShadow: "#1c1208",
    // Gorra de plato con visera de cuero y escarapela, en vez del casco
    // tipo Stahlhelm — más fiel a la referencia.
    helmet: "#5c6b52", helmetDark: "#33402f", helmetLight: "#8a9a72", helmetType: "gorra",
    visor: "#2b2018",
    strap: "#7a4a22", boot: "#4a3218", bootDark: "#22160a",
    pack: "#7a6a3c", packDark: "#4a3f22", bedroll: "#7d8a5a",
    scarf: "#e8ddbf", scarfDark: "#b8a878",
    // Cuello de piel/lana grueso y bandolera con cartuchera al pecho.
    fur: "#e8ddbf", furDark: "#b8a878",
    pouch: "#5c4223", pouchDark: "#3a2a16",
    // Polainas (vendas) en la espinilla, en vez de bota corrida hasta la
    // rodilla.
    puttee: "#a89464",
    accent: "#d4b23c", outline: "#1a1208",
  },
  enemigo: {
    cloth: "#4f6f94", clothDark: "#2b4059", clothLight: "#7396bd",
    skin: "#c9986a", skinDark: "#84603f", faceShadow: "#0d141b",
    helmet: "#3e5570", helmetDark: "#1f2d3b", helmetLight: "#86a2be", helmetType: "ala",
    strap: "#8a6a3a", boot: "#3a2a1c", bootDark: "#170f08",
    pack: "#7d7550", packDark: "#4a4630", bedroll: "#c9c3a6",
    scarf: "#ece6ce", scarfDark: "#a39d80",
    accent: "#9fd6ff", outline: "#0c141b",
  },
  // Paracaidista enemigo: mono caqui, casco verde oliva y correaje rojo —
  // se distingue del soldado de infantería tanto en el aire como en tierra.
  paracaidista: {
    cloth: "#9a8f66", clothDark: "#5f5837", clothLight: "#c2b78a",
    skin: "#c9986a", skinDark: "#84603f", faceShadow: "#0d141b",
    helmet: "#4d5e3a", helmetDark: "#2c3823", helmetLight: "#86986a", helmetType: "ala",
    strap: "#a8321f", boot: "#2a1f14", bootDark: "#120c06",
    pack: "#a8321f", packDark: "#6a1f12", bedroll: "#c9c3a6",
    scarf: "#a8321f", scarfDark: "#6a1f12",
    accent: "#e8c04a", outline: "#0c141b",
  },
};

const VEHICLE_COLORS = {
  hull: "#4b5a3e", hullDark: "#333f28", hullLight: "#5f7050",
  track: "#20241b", trackLight: "#3a3a30",
  turret: "#425039", barrel: "#1c1f1a", outline: "#161a12",
  accent: "#9fd6ff",
};

const TURRET_EMPLACEMENT_COLORS = {
  bag: "#8a7a52", bagDark: "#5c4f30", bagLight: "#a89468",
  metal: "#3e4a3a", metalDark: "#20261d", barrel: "#1c1f1a",
  skin: "#c9986a", skinDark: "#84603f",
  outline: "#161a12", accent: "#9fd6ff",
};

// Variantes de tanque — mismo chasis dibujado en extras.js, solo cambia la
// paleta que se le pasa, inspirada en los diseños verde/azul/rojo.
const VEHICLE_COLORS_PESADA = {
  hull: "#2f5f7a", hullDark: "#1c3d4f", hullLight: "#4a86a8",
  track: "#20241b", trackLight: "#3a3a30",
  turret: "#264f66", barrel: "#1c1f1a", outline: "#0c1a22",
  accent: "#9fd6ff",
};
const VEHICLE_COLORS_ASALTO = {
  hull: "#8a2e28", hullDark: "#5c1c18", hullLight: "#b8483c",
  track: "#20241b", trackLight: "#3a3a30",
  turret: "#6e2420", barrel: "#1c1f1a", outline: "#1a0c0a",
  accent: "#ffb347",
};
const VEHICLE_PALETTES = {
  tanqueta: VEHICLE_COLORS,
  tanqueta_pesada: VEHICLE_COLORS_PESADA,
  tanqueta_asalto: VEHICLE_COLORS_ASALTO,
};

function unitPhase(id, speed = 150) {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return performance.now() / speed + hash;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function celLine(pts, w, fill, edge, ow = 2.2) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = edge; ctx.lineWidth = w + ow * 2; ctx.stroke();
  ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke();
}

function celBox(x, y, w, h, r, fill, dark, edge, lw = 2.2) {
  ctx.save();
  roundRect(x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.clip();
  ctx.fillStyle = dark;
  ctx.fillRect(x + w * 0.62, y, w * 0.4, h);
  ctx.fillRect(x, y + h * 0.78, w, h * 0.3);
  ctx.restore();
  roundRect(x, y, w, h, r);
  ctx.strokeStyle = edge; ctx.lineWidth = lw; ctx.stroke();
}

function celDisc(cx, cy, r, fill, dark, edge, lw = 2.2) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = dark; ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.3, r * 0.95, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = edge; ctx.lineWidth = lw; ctx.stroke();
}

// Curva de la estocada (t: 0 → 1): retrocede, embiste rápido y recupera.
// Devuelve -0.4 (recogido) … 1 (brazos y arma totalmente estirados) … 0.
function meleeReach(t) {
  if (t == null) return 0;
  if (t < 0.25) return -0.4 * (t / 0.25);
  if (t < 0.55) {
    const u = (t - 0.25) / 0.3;
    return -0.4 + 1.4 * (1 - Math.pow(1 - u, 3));
  }
  const u = (t - 0.55) / 0.45;
  return 1 - u * u * (3 - 2 * u);
}

function drawSoldierFigure(x, drawY, opts) {
  const {
    dir = "right", moving = false, phase = 0, colors,
    weapon = "rifle", kneeling = false, digSwing = 0, firing = false, isMelee = false, meleeT = null,
    recoilT = null, weaponScale = 1, hero = false, antiAir = false,
  } = opts;

  // Estocada: estira brazos y arma 12 px hacia adelante durante el tajo.
  const meleeOff = isMelee ? 12 : 0;
  const meleeDirY = (DIR_OFFSETS[dir] || [1, 0])[1];

  const mirror = dir === "left" ? -1 : 1;
  const side = dir === "left" || dir === "right";
  const backView = dir === "up";
  const bp = phase || performance.now() / 150;
  // Si el uniforme trae piel/lana propia (bolivianos), el cuello usa esos
  // colores; si no (enemigo), sigue usando el pañuelo de siempre.
  const collarFill = colors.fur || colors.scarf;
  const collarDark = colors.furDark || colors.scarfDark;

  const swing = moving ? Math.sin(phase) * 9.5 : 0;
  const swingOpp = -swing;
  const breathing = (moving ? 0.4 : 1) * (Math.sin(bp * 0.45) * 0.5 + 0.5) * 1.5;
  // Contoneo de hombros y cabeza al caminar — antes solo las piernas se
  // movían y el torso/cabeza quedaban perfectamente rígidos encima, lo
  // que es justo lo que se lee como "andar de zombie" a cualquier
  // distancia. La cadera también sube un poco en cada paso.
  const hipBob = moving ? Math.abs(Math.sin(phase)) * 1.2 : 0;
  const headBob = moving ? Math.sin(phase * 2) * 0.9 : 0;
  // Al disparar, el cuerpo se inclina un poco más hacia adelante — una
  // postura de "encajando el retroceso" en vez de quedarse recto y solo
  // mover los brazos, que es lo que hacía que el disparo se sintiera plano.
  const fireLean = firing && side ? 1.6 * mirror : 0;
  const lean = (moving ? (side ? 2.8 * mirror : Math.sin(phase) * 1.4) : (side ? 1.2 * mirror : 0)) + fireLean;
  // En la estocada el torso se inclina hacia adelante junto con el arma.
  const meleeLunge = weapon === "bayoneta" && side ? Math.max(0, meleeReach(meleeT)) * 4 * mirror : 0;
  const bx = x + lean + meleeLunge;

  const hipY = (kneeling ? drawY - 7 : drawY - 1) - hipBob;
  const shoulderY = (kneeling ? drawY - 21 : drawY - 25) - breathing - hipBob;
  const headY = (kneeling ? drawY - 30 : drawY - 35) - breathing * 1.3 - hipBob - headBob;
  const hx = bx + (side ? 1.4 * mirror : 0);

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const leg = (hipX, sw, front, cloth) => {
    const st = side ? (front ? 3.4 : -3.4) * mirror : 0;
    const footX = hipX + st + (side ? sw * 1.05 : 0);
    const footY = drawY + 13.5 + (side ? -Math.max(0, sw) * 0.4 : sw * 0.3);
    const kneeX = (hipX + footX) / 2 + (side ? 2.4 * mirror : 0);
    const kneeY = hipY + 8 - (side ? Math.max(0, sw) * 0.2 : 0);
    celLine([[hipX, hipY], [kneeX, kneeY], [footX, footY - 3]], 6.4, cloth, colors.outline);
    // Polaina enrollada en la espinilla (en vez de bota lisa hasta la
    // rodilla) — solo en uniformes que la traen; el enemigo sigue con bota.
    celLine([[kneeX + (footX - kneeX) * 0.2, kneeY + 3], [footX, footY - 2]], 6.8, colors.puttee || colors.boot, colors.outline);
    celBox(side ? (mirror > 0 ? footX - 4 : footX - 6) : footX - 5, footY - 3.5, 10, 6.5, 2.4, colors.boot, colors.bootDark, colors.outline);
  };

  if (kneeling) {
    celLine([[x - 4, hipY], [x - 8 * mirror, drawY + 6], [x - 14 * mirror, drawY + 10]], 6.4, colors.clothDark, colors.outline);
    celBox(x - 14 * mirror - 5, drawY + 7.5, 10, 6.5, 2.4, colors.boot, colors.bootDark, colors.outline);
    celLine([[x + 4, hipY], [x + 12 * mirror, drawY + 2], [x + 14 * mirror, drawY + 10]], 6.4, colors.cloth, colors.outline);
    celBox(x + 14 * mirror - (mirror > 0 ? 3 : 7), drawY + 8, 10, 6.5, 2.4, colors.boot, colors.bootDark, colors.outline);
  } else {
    leg(x - (side ? 2 : 4.6), swingOpp, false, colors.clothDark);
    leg(x + (side ? 2 : 4.6), swing, true, colors.cloth);
  }

  const packBounce = moving ? Math.sin(bp * 2 + 1) * 1.1 : 0;
  const drawPack = () => {
    const py = shoulderY + 2 + packBounce;
    if (side) {
      const px = mirror > 0 ? bx - 14 : bx + 4;
      celBox(px, py, 10, 14, 2.4, colors.pack, colors.packDark, colors.outline);
      celBox(px + 2, py + 7, 6, 4.5, 1.2, colors.packDark, colors.packDark, colors.outline, 1.6);
      celBox(px - 1, py - 4, 12, 6, 3, colors.bedroll, colors.packDark, colors.outline);
    } else {
      celBox(bx - 8, py, 16, 14, 2.4, colors.pack, colors.packDark, colors.outline);
      celBox(bx - 5, py + 7, 10, 4.5, 1.2, colors.packDark, colors.packDark, colors.outline, 1.6);
      celBox(bx - 9.5, py - 4, 19, 6, 3, colors.bedroll, colors.packDark, colors.outline);
    }
  };
  if (dir !== "down" && !backView) drawPack();

  const tw = side ? 15 : 20;
  const th = hipY - shoulderY + 4;
  celBox(bx - tw / 2, shoulderY, tw, th, 4.5, colors.cloth, colors.clothDark, colors.outline, 2.6);
  ctx.fillStyle = colors.clothLight;
  ctx.fillRect(bx - tw / 2 + 2, shoulderY + 3, 2.4, th - 11);

  for (const k of backView ? [1, -1] : [1]) {
    celLine([[bx - (tw / 2 - 2.5) * mirror * k, shoulderY + 2], [bx + (tw / 2 - 3) * mirror * k, hipY - 2]], 3.2, colors.strap, colors.outline, 1.3);
  }
  celBox(bx - tw / 2 - 0.5, hipY - 2.5, tw + 1, 5.5, 1.6, colors.strap, colors.bootDark, colors.outline, 2);
  if (dir === "down") {
    celBox(bx - 2.6, hipY - 2.2, 5.2, 4.6, 1, colors.accent, colors.accent, colors.outline, 1.6);
    celBox(bx - 8.6, hipY - 9, 5.6, 7, 1.4, colors.pack, colors.packDark, colors.outline, 1.8);
    celBox(bx + 3, hipY - 9, 5.6, 7, 1.4, colors.pack, colors.packDark, colors.outline, 1.8);
  } else if (side) {
    celBox(bx + (mirror > 0 ? 0.5 : -6.1), hipY - 9, 5.6, 7, 1.4, colors.pack, colors.packDark, colors.outline, 1.8);
  }
  if (backView) drawPack();

  // Bandolera cruzada al pecho con cartuchera de cuero — solo en
  // uniformes que la traen (bolivianos, incluidos aliados y cavadores).
  if (colors.pouch) {
    celLine([[bx - tw / 2 + 1, shoulderY - 1], [bx + tw / 2 - 1, hipY - 3]], 2.6, colors.strap, colors.outline, 1.2);
    celBox(bx - 3.2, hipY - 8, 8, 6.5, 1.6, colors.pouch, colors.pouchDark, colors.outline, 1.6);
  }

  let muzzle = null;

  if (weapon === "pickaxe") {
    const shoulderX = bx + 4 * mirror;
    const angle = -1.15 + ((digSwing + 1) / 2) * 1.5;
    const handX = shoulderX + Math.sin(angle) * 11 * mirror + meleeOff * mirror;
    const handY = shoulderY + 4 + Math.cos(angle) * 9 + meleeOff * meleeDirY;
    const tipX = shoulderX + Math.sin(angle) * 23 * mirror + meleeOff * mirror;
    const tipY = shoulderY + Math.cos(angle) * 23 + meleeOff * meleeDirY;

    celLine([[bx - 3 * mirror, shoulderY + 3], [handX - mirror, handY + 1]], 5.4, colors.clothDark, colors.outline);
    celLine([[handX - (tipX - handX) * 0.35, handY - (tipY - handY) * 0.35], [tipX, tipY]], 3.6, "#8a5a2b", colors.outline, 1.8);
    celLine([[tipX - 7 * mirror, tipY - 3], [tipX + 6 * mirror, tipY + 2]], 4, "#b4bcc2", colors.outline, 1.8);
    celLine([[bx, shoulderY + 2], [handX, handY]], 5.4, colors.cloth, colors.outline);
    celDisc(handX, handY, 3.2, colors.skin, colors.skinDark, colors.outline, 1.8);
  } else if (weapon === "rifle") {
    // Pose antiaérea: el fusil apunta al cielo (hacia arriba, apenas inclinado hacia donde mira).
    const [ox, oy] = antiAir ? [0.22 * mirror, -1] : (DIR_OFFSETS[dir] || [1, 0]);
    // Balanceo del fusil al caminar, sincronizado con la misma fase que
    // mueve las piernas — sin esto, cargar el arma se veía perfectamente
    // rígido mientras el cuerpo caminaba, y eso es lo que se leía "zombie".
    const walkSway = moving && !firing ? Math.sin(bp) * 0.08 : 0;
    const aimOx = firing ? ox : ox * 0.68 + 0.2 * mirror + walkSway * mirror;
    const aimOy = firing ? oy : oy * 0.68 - 0.16 + walkSway * 0.5;
    const len = Math.hypot(aimOx, aimOy) || 1;
    const ux = aimOx / len, uy = aimOy / len;
    const perpX = -uy, perpY = ux;
    const gunAngle = Math.atan2(uy, ux);

    // Culatazo: el fusil retrocede hacia el hombro y el cañón sube un
    // toque justo al disparar, y se recupera rápido — así el disparo se
    // siente como un arma reaccionando, no solo brazos estirados.
    const recoilAmt = (typeof recoilT === "number") ? Math.pow(Math.max(0, 1 - recoilT), 2) : 0;
    const kick = recoilAmt * 5;
    const ws = weaponScale;

    const gripX = bx + ux * 7 + ux * meleeOff - ux * kick * 0.4;
    const gripY = shoulderY + 6 + uy * 6 + uy * meleeOff - uy * kick * 0.4;
    const buttX = gripX - ux * 12 * ws;
    const buttY = gripY - uy * 9 * ws;
    const tipDistX = (firing ? 37 : 31) * ws;
    const tipDistY = (firing ? 26 : 21) * ws;
    const tipX = gripX + ux * tipDistX + ux * meleeOff - ux * kick * 0.6 + perpX * kick * 0.4;
    const tipY = gripY + uy * tipDistY + uy * meleeOff - uy * kick * 0.6 + perpY * kick * 0.4;
    const handDistX = (firing ? 16 : 14) * ws;
    const handDistY = (firing ? 11 : 10) * ws;
    const handX = gripX + ux * handDistX - ux * kick * 0.3;
    const handY = gripY + uy * handDistY - uy * kick * 0.3;

    // Brazo trasero, sosteniendo la culata contra el hombro.
    celLine([[bx - 5 * mirror, shoulderY + 3], [buttX + ux * 2, buttY + 2]], 5.4, colors.clothDark, colors.outline);
    celDisc(buttX + ux * 2, buttY + 2, 2.9, colors.skin, colors.skinDark, colors.outline, 1.6);

    // Culata de madera, ahusada, con veta transversal visible.
    celLine([[buttX, buttY], [gripX + ux * 3, gripY + uy * 3]], 6.6 * ws, "#8a5a2b", "#1d1108", 2);
    ctx.strokeStyle = "#c48a44"; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(buttX, buttY + 1.6); ctx.lineTo(gripX + ux * 3, gripY + uy * 3 + 1.6);
    ctx.stroke();
    ctx.strokeStyle = "#5a3416"; ctx.lineWidth = 1;
    for (let i = 0.25; i < 1; i += 0.25) {
      const gx = buttX + (gripX + ux * 3 - buttX) * i;
      const gy = buttY + (gripY + uy * 3 - buttY) * i;
      ctx.beginPath();
      ctx.moveTo(gx - perpX * 2.6, gy - perpY * 2.6);
      ctx.lineTo(gx + perpX * 2.6, gy + perpY * 2.6);
      ctx.stroke();
    }

    // Mecanismo (receptor + cerrojo + guardamonte + alza), dibujado en su
    // propio espacio rotado — piezas de verdad, no líneas sueltas.
    ctx.save();
    ctx.translate(gripX, gripY);
    ctx.rotate(gunAngle);
    ctx.scale(ws, ws);
    ctx.fillStyle = "#2a2f26";
    ctx.fillRect(-3, -2.6, 9, 5.2);
    ctx.strokeStyle = "#0d0f0b"; ctx.lineWidth = 1.2;
    ctx.strokeRect(-3, -2.6, 9, 5.2);
    ctx.strokeStyle = "#12171a"; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-1, 1.4); ctx.lineTo(-4.5, 4.4); ctx.stroke();
    ctx.fillStyle = "#4a545b";
    ctx.beginPath(); ctx.arc(-4.8, 4.8, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#12171a"; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(1, 3.4, 2, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = "#12171a";
    ctx.fillRect(-2.4, -3.6, 3, 1.3);
    // Franja de mira / alza trasera — solo en el arma "héroe", para que
    // el jugador reconozca su propio fusil de un vistazo entre la
    // multitud de soldados iguales.
    if (hero) {
      ctx.fillStyle = colors.accent || "#d4b23c";
      ctx.fillRect(-3, -3.4, 9, 1);
    }
    ctx.restore();

    // Cañón: fino y largo, con guardamano de madera y mira delantera.
    celLine([[gripX + ux * 5, gripY + uy * 5], [tipX, tipY]], 3 * ws, "#12171a", "#0a0c0a", 1.4);
    ctx.strokeStyle = "#4a545b"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gripX + ux * 5 - perpX * 0.6, gripY + uy * 5 - perpY * 0.6);
    ctx.lineTo(tipX - perpX * 0.6, tipY - perpY * 0.6);
    ctx.stroke();
    // Brillo metálico a lo largo del cañón — remarca su silueta contra
    // fondos oscuros, sobre todo en el fusil del protagonista.
    ctx.strokeStyle = hero ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)";
    ctx.lineWidth = hero ? 1.1 : 0.7;
    ctx.beginPath();
    ctx.moveTo(gripX + ux * 6 - perpX * 1.1, gripY + uy * 6 - perpY * 1.1);
    ctx.lineTo(tipX - ux * 3 - perpX * 1.1, tipY - uy * 3 - perpY * 1.1);
    ctx.stroke();
    celLine([[gripX + ux * 4, gripY + uy * 4], [handX, handY]], 4.6 * ws, "#7a4f26", "#1d1108", 1.6);
    ctx.fillStyle = "#12171a";
    ctx.beginPath();
    ctx.moveTo(tipX - ux * 1.5 * ws + perpX * 1.2 * ws, tipY - uy * 1.5 * ws + perpY * 1.2 * ws);
    ctx.lineTo(tipX - ux * 1.5 * ws - perpX * 1.2 * ws, tipY - uy * 1.5 * ws - perpY * 1.2 * ws);
    ctx.lineTo(tipX + ux * 1.4 * ws, tipY + uy * 1.4 * ws);
    ctx.closePath();
    ctx.fill();

    // Correa diagonal, de la culata al cañón — en el fusil héroe lleva
    // el color de acento boliviano para que se lea como "su" rifle.
    ctx.strokeStyle = hero ? (colors.accent || colors.strap) : colors.strap;
    ctx.lineWidth = hero ? 2 : 1.6;
    ctx.beginPath();
    ctx.moveTo(buttX + ux * 3 - perpX * 3, buttY + uy * 3 - perpY * 3);
    ctx.lineTo(gripX + ux * (tipDistX * 0.62) + perpX * 2, gripY + uy * (tipDistY * 0.62) + perpY * 2);
    ctx.stroke();

    // Brazo delantero, sosteniendo el guardamano.
    celLine([[bx + 4 * mirror, shoulderY + 3], [handX, handY]], 5.4, colors.cloth, colors.outline);
    celDisc(handX, handY, 3.3, colors.skin, colors.skinDark, colors.outline, 1.8);

    muzzle = { x: tipX, y: tipY, ux, uy };
  } else if (weapon === "bayoneta") {
    const [ox, oy] = DIR_OFFSETS[dir] || [1, 0];
    const k = meleeReach(meleeT);
    const aimOx = ox;
    const aimOy = oy * 0.9 - (side ? 0.12 : 0);
    const alen = Math.hypot(aimOx, aimOy) || 1;
    const ux = aimOx / alen, uy = aimOy / alen;

    const gripX = bx + ux * (7 + 9 * k);
    const gripY = shoulderY + 6 + uy * (6 + 7 * k);
    const buttX = gripX - ux * 11;
    const buttY = gripY - uy * 8;
    const tipX = gripX + ux * 24;
    const tipY = gripY + uy * 17;
    const bladeX = tipX + ux * 16;
    const bladeY = tipY + uy * 12;

    // Estela de la embestida (detrás de la hoja, solo cuando el arma va a fondo).
    if (k > 0.35) {
      ctx.save();
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * 3.2;
        ctx.strokeStyle = `rgba(232, 240, 244, ${(0.42 - i * 0.08) * Math.min(1, k)})`;
        ctx.lineWidth = 1.6 - i * 0.3;
        ctx.beginPath();
        ctx.moveTo(bladeX - ux * 2 - uy * off, bladeY - uy * 2 + ux * off);
        ctx.lineTo(bladeX - ux * (20 + i * 6) - uy * off, bladeY - uy * (14 + i * 4) + ux * off);
        ctx.stroke();
      }
      ctx.restore();
    }

    celLine([[bx - 5 * mirror, shoulderY + 3], [buttX + ux * 2, buttY + 2]], 5.4, colors.clothDark, colors.outline);
    celDisc(buttX + ux * 2, buttY + 2, 2.9, colors.skin, colors.skinDark, colors.outline, 1.6);

    celLine([[buttX, buttY], [gripX + ux * 5, gripY + uy * 5]], 6, "#8a5a2b", "#1d1108", 2);
    ctx.strokeStyle = "#5a3416"; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(buttX, buttY + 1.8); ctx.lineTo(gripX + ux * 5, gripY + uy * 5 + 1.8);
    ctx.stroke();

    celLine([[gripX + ux * 4, gripY + uy * 4], [tipX, tipY]], 4.2, "#6b7880", "#12171a", 2);
    celLine([[gripX + ux * 1, gripY + uy * 1], [gripX + ux * 8, gripY + uy * 8]], 5.6, "#4a545b", "#12171a", 1.8);
    celLine([[tipX - ux * 3, tipY - uy * 3], [tipX, tipY]], 5.4, "#2a3238", "#12171a", 1.6);

    // Bayoneta calada: hoja de acero con filo brillante.
    celLine([[tipX, tipY], [bladeX, bladeY]], 2.8, "#cfd8de", "#12171a", 1.7);
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(tipX + ux * 3, tipY + uy * 3 - 0.8);
    ctx.lineTo(bladeX - ux * 2, bladeY - uy * 2 - 0.8);
    ctx.stroke();
    ctx.restore();

    celLine([[bx + 4 * mirror, shoulderY + 3], [gripX + ux * 9, gripY + uy * 9]], 5.4, colors.cloth, colors.outline);
    celDisc(gripX + ux * 9, gripY + uy * 9, 3.3, colors.skin, colors.skinDark, colors.outline, 1.8);

    // Destello en la punta al final de la embestida.
    if (k > 0.85) {
      ctx.save();
      ctx.globalAlpha = (k - 0.85) / 0.15;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(bladeX, bladeY, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  } else {
    celLine([[bx - 8.5, shoulderY + 3], [bx - 9 + swingOpp * 0.5, shoulderY + 16]], 5.4, colors.clothDark, colors.outline);
    celLine([[bx + 8.5, shoulderY + 3], [bx + 9 + swing * 0.5, shoulderY + 16]], 5.4, colors.cloth, colors.outline);
    celDisc(bx - 9 + swingOpp * 0.5, shoulderY + 16, 3, colors.skin, colors.skinDark, colors.outline, 1.8);
    celDisc(bx + 9 + swing * 0.5, shoulderY + 16, 3, colors.skin, colors.skinDark, colors.outline, 1.8);
  }

  const fl = Math.sin(bp * 1.7) * 1.8 + (moving ? 3.5 : 0.8);
  const wob = Math.sin(bp * 2.3 + 1) * 1.6;
  if (side) {
    celLine([[hx - 3 * mirror, headY + 7], [hx - (8 + fl) * mirror, headY + 5.5 + wob * 0.5], [hx - (13 + fl * 1.5) * mirror, headY + 8 + wob]], 3.6, colors.scarf, colors.outline, 1.8);
  } else {
    const d = backView ? -1 : 1;
    celLine([[hx + 4 * d, headY + 8], [hx + (5 + wob * 0.4) * d, headY + 13], [hx + (4 + wob * 0.8) * d, headY + 17 + fl * 0.3]], 3.4, colors.scarf, colors.outline, 1.8);
  }

  celDisc(hx, headY, 6.6, backView ? colors.skinDark : colors.skin, colors.skinDark, colors.outline);
  if (!backView) {
    ctx.save();
    ctx.beginPath(); ctx.arc(hx, headY, 6.1, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = colors.faceShadow;
    ctx.fillRect(hx - 8, headY - 3, 16, 7.6);
    ctx.restore();
  }
  // Cuello de piel/lana, más ancho y con el borde superior rizado (textura
  // de vellón) en vez de un pañuelo plano.
  celBox(hx - 8, headY + 3.5, 16, 8, 3, collarFill, collarDark, colors.outline, 2);
  ctx.fillStyle = collarFill;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(hx + i * 2.3, headY + 3.5, 2, Math.PI, 0);
    ctx.fill();
  }
  ctx.strokeStyle = colors.outline; ctx.lineWidth = 1.2;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(hx + i * 2.3, headY + 3.5, 2, Math.PI, 0);
    ctx.stroke();
  }

  if (colors.helmetType === "stahlhelm") {
    const dome = () => {
      ctx.beginPath();
      ctx.arc(hx, headY - 1, 8.4, Math.PI, 0);
      ctx.lineTo(hx + 10, headY + 2.6);
      ctx.lineTo(hx - 10, headY + 2.6);
      ctx.closePath();
    };
    dome();
    ctx.fillStyle = colors.helmet; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = colors.helmetDark;
    ctx.fillRect(hx + 2.6, headY - 11, 9, 15);
    ctx.fillRect(hx - 11, headY + 0.4, 22, 2.6);
    ctx.fillStyle = colors.helmetLight;
    ctx.beginPath(); ctx.ellipse(hx - 3.6, headY - 5.6, 2.8, 1.3, -0.55, 0, Math.PI * 2); ctx.fill();
    if (!backView) {
      ctx.fillStyle = colors.accent;
      ctx.beginPath(); ctx.arc(hx + (side ? 3.6 * mirror : 0), headY - 3.2, 1.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    dome();
    ctx.strokeStyle = colors.outline; ctx.lineWidth = 2.4; ctx.stroke();
  } else if (colors.helmetType === "gorra") {
    // Gorra de plato boliviana: copa redondeada, banda oscura en la base,
    // visera de cuero al frente y escarapela dorada centrada.
    const dome = () => {
      ctx.beginPath();
      ctx.arc(hx, headY - 2, 7.6, Math.PI, 0);
      ctx.lineTo(hx + 8.4, headY + 1.6);
      ctx.lineTo(hx - 8.4, headY + 1.6);
      ctx.closePath();
    };
    dome();
    ctx.fillStyle = colors.helmet; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = colors.helmetDark;
    ctx.fillRect(hx + 1.6, headY - 10, 8, 12);
    ctx.fillStyle = colors.helmetLight;
    ctx.beginPath(); ctx.ellipse(hx - 3.2, headY - 5, 2.6, 1.3, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    dome();
    ctx.strokeStyle = colors.outline; ctx.lineWidth = 2.2; ctx.stroke();

    ctx.fillStyle = colors.helmetDark;
    ctx.fillRect(hx - 8.4, headY + 0.2, 16.8, 2.6);
    ctx.strokeStyle = colors.outline; ctx.lineWidth = 1.4;
    ctx.strokeRect(hx - 8.4, headY + 0.2, 16.8, 2.6);

    if (!backView) {
      const visorX = hx + (side ? 3 * mirror : 0);
      ctx.fillStyle = colors.visor || "#2b2018";
      ctx.beginPath();
      ctx.ellipse(visorX, headY + 2.4, 6, 2.2, 0, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = colors.outline; ctx.lineWidth = 1.4; ctx.stroke();

      ctx.fillStyle = colors.accent;
      ctx.beginPath(); ctx.arc(hx, headY - 1, 1.9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = colors.outline; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = colors.outline;
      ctx.beginPath(); ctx.arc(hx, headY - 1, 0.7, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.beginPath(); ctx.ellipse(hx, headY - 0.5, 12, 3.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = colors.helmetDark; ctx.fill();
    ctx.strokeStyle = colors.outline; ctx.lineWidth = 2.4; ctx.stroke();
    const dome = () => {
      ctx.beginPath();
      ctx.arc(hx, headY - 1.5, 7, Math.PI, 0);
      ctx.closePath();
    };
    dome();
    ctx.fillStyle = colors.helmet; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = colors.helmetDark;
    ctx.fillRect(hx + 2.4, headY - 10, 9, 10);
    ctx.fillStyle = colors.accent;
    ctx.fillRect(hx - 8, headY - 3.9, 16, 1.3);
    ctx.fillStyle = colors.helmetLight;
    ctx.beginPath(); ctx.ellipse(hx - 3, headY - 6, 2.4, 1.2, -0.55, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    dome();
    ctx.strokeStyle = colors.outline; ctx.lineWidth = 2.4; ctx.stroke();
  }

  ctx.restore();
  return muzzle;
}


const TANK_TIERS = {
  // Solo se usa para los restos calcinados y la torreta voladora al morir el tren.
  tren_blindado: {
    hullLen: 176, hullWid: 46, turretR: 8, barrelLen: 22, barrelW: 7,
    trackWid: 8, trackOff: 14, shadowRx: 90, shadowRy: 14, shadowDrop: 26,
    recoilMag: 8, flashScale: 2,
  },
  tanqueta_asalto: {
    hullLen: 34, hullWid: 20, turretR: 8.5, barrelLen: 19, barrelW: 3.2,
    trackWid: 6, trackOff: 10, shadowRx: 20, shadowRy: 7, shadowDrop: 13,
    recoilMag: 3, flashScale: 0.72,
  },
  tanqueta: {
    hullLen: 44, hullWid: 26, turretR: 11.5, barrelLen: 26, barrelW: 4.4,
    trackWid: 8, trackOff: 13, shadowRx: 26, shadowRy: 9, shadowDrop: 16,
    recoilMag: 4.5, flashScale: 1,
  },
  tanqueta_pesada: {
    hullLen: 58, hullWid: 34, turretR: 15, barrelLen: 34, barrelW: 6,
    trackWid: 10, trackOff: 17, shadowRx: 34, shadowRy: 12, shadowDrop: 20,
    recoilMag: 6.5, flashScale: 1.5,
  },
};

// Los tanques enemigos se dibujan 1.3x más grandes (casco, orugas, torreta, cañón,
// sombra y restos). El servidor usa radios de colisión acordes (ver ENEMY_TYPES).
const TANK_SCALE = 1.3;
function tankScale(type) {
  return type && type.startsWith("tanqueta") ? TANK_SCALE : 1;
}

// ---------------------------------------------------------------------------
// TANQUES — tres tamaños bien diferenciados (ligero/mediano/pesado), con
// fogonazo y retroceso real al disparar, y la torreta apuntando siempre al
// ángulo verdadero hacia Navajas (aimAngle), no solo a una de 4 direcciones.
// ---------------------------------------------------------------------------
function drawEnemyVehicle(id, x, y, dir, colors, aimAngle, type) {
  const tier = TANK_TIERS[type] || TANK_TIERS.tanqueta;
  const k = tankScale(type);
  const heavy = type === "tanqueta_pesada";
  const light = type === "tanqueta_asalto";
  const moving = isMoving(id, x, y);
  const phase = unitPhase(id, 90);
  const [ox, oy] = DIR_OFFSETS[dir] || [1, 0];
  const moveAngle = Math.atan2(oy, ox);
  const turretAngle = (typeof aimAngle === "number") ? aimAngle : moveAngle;

  const now = performance.now();
  const untilFiring = enemyFiringUntil.get(id) || 0;
  const firing = untilFiring > now;
  const fireT = firing ? 1 - (untilFiring - now) / 150 : 1;
  const recoil = firing ? Math.max(0, 1 - fireT) * tier.recoilMag : 0;

  ctx.fillStyle = "rgba(20, 16, 10, 0.4)";
  ctx.beginPath();
  ctx.ellipse(x, y + tier.shadowDrop * k, tier.shadowRx * k, tier.shadowRy * k, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(moveAngle);
  ctx.scale(k, k);

  const hl = tier.hullLen / 2, hw = tier.hullWid / 2;

  // orugas
  for (const s of [-tier.trackOff, tier.trackOff]) {
    ctx.fillStyle = colors.track;
    roundRect(-hl, s - tier.trackWid / 2, hl * 2, tier.trackWid, 3);
    ctx.fill();
    const segOffset = moving ? (phase * 6) % 8 : 0;
    ctx.fillStyle = colors.trackLight;
    for (let i = -hl + segOffset; i < hl; i += 8) {
      ctx.fillRect(i, s - tier.trackWid / 2 + 1, 4, tier.trackWid - 2);
    }
  }

  // faldones laterales — solo el pesado, remarcan su blindaje extra.
  if (heavy) {
    ctx.fillStyle = colors.hullDark;
    roundRect(-hl + 4, -hw - 3, hl * 2 - 10, 3, 1); ctx.fill();
    roundRect(-hl + 4, hw, hl * 2 - 10, 3, 1); ctx.fill();
  }

  // casco: el pesado tiene morro en cuña (glacis); el resto, prisma
  // redondeado — más chato y afilado cuanto más ligero es el tanque.
  const drawHullShape = (inset) => {
    if (heavy) {
      ctx.beginPath();
      ctx.moveTo(-hl + inset, -hw + inset);
      ctx.lineTo(hl - 6, -hw + inset);
      ctx.lineTo(hl + 5 - inset, 0);
      ctx.lineTo(hl - 6, hw - inset);
      ctx.lineTo(-hl + inset, hw - inset);
      ctx.closePath();
    } else {
      roundRect(-hl + inset, -hw + inset, hl * 2 - inset * 2, hw * 2 - inset * 2, light ? 3 : 4);
    }
  };

  ctx.fillStyle = colors.outline;
  drawHullShape(0);
  ctx.fill();

  const hullGrad = ctx.createLinearGradient(0, -hw, 0, hw);
  hullGrad.addColorStop(0, colors.hullLight);
  hullGrad.addColorStop(0.5, colors.hull);
  hullGrad.addColorStop(1, colors.hullDark);
  ctx.fillStyle = hullGrad;
  drawHullShape(2);
  ctx.fill();

  // remaches — ausentes en el ligero (chapa lisa y liviana), abundantes y
  // gruesos en el pesado.
  if (!light) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    const rivetXs = heavy ? [-hl + 8, -hl / 3, hl / 3 - 4, hl - 16] : [-14, -4, 6, 16];
    for (const rx of rivetXs) {
      ctx.beginPath(); ctx.arc(rx, -hw + 3, heavy ? 1.5 : 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx, hw - 3, heavy ? 1.5 : 1, 0, Math.PI * 2); ctx.fill();
    }
  }

  // A partir de acá, todo gira hacia el ángulo real de puntería (aimAngle),
  // no solo hacia la dirección cardinal de movimiento.
  ctx.rotate(turretAngle - moveAngle);
  const turretCx = heavy ? 3 : light ? 1 : 2;

  ctx.fillStyle = colors.outline;
  ctx.beginPath(); ctx.arc(turretCx, 0, tier.turretR + 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors.turret;
  ctx.beginPath(); ctx.arc(turretCx, 0, tier.turretR, 0, Math.PI * 2); ctx.fill();

  // Escotilla del comandante.
  ctx.fillStyle = colors.hullDark;
  ctx.beginPath();
  ctx.arc(turretCx - tier.turretR * 0.25, -tier.turretR * 0.25, tier.turretR * (heavy ? 0.42 : 0.32), 0, Math.PI * 2);
  ctx.fill();
  if (heavy) {
    ctx.strokeStyle = colors.outline; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(turretCx - tier.turretR * 0.25, -tier.turretR * 0.25, tier.turretR * 0.42, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = colors.barrel;
  ctx.fillRect(turretCx - recoil, -tier.barrelW / 2, tier.barrelLen, tier.barrelW);

  // Freno de boca — solo el pesado, remata el cañón con más presencia.
  if (heavy) {
    ctx.fillStyle = "#20241b";
    ctx.fillRect(turretCx - recoil + tier.barrelLen - 3, -tier.barrelW / 2 - 1.2, 5, tier.barrelW + 2.4);
  }

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(turretCx - tier.turretR * 0.3, -tier.turretR * 0.3, tier.turretR * 0.36, Math.PI * 1.1, Math.PI * 1.7);
  ctx.fill();

  // Fogonazo de boca — grande, con estrella de disparo real (como el de la
  // torreta fija) y una lengüeta que se estira hacia adelante. Antes era
  // apenas un puntito y se perdía en medio del combate.
  if (firing) {
    const tipX = turretCx - recoil + tier.barrelLen;
    const alpha = fireT < 0.5 ? 1 : Math.max(0, 1 - (fireT - 0.5) / 0.5);
    const tongue = (16 + 14 * (1 - fireT)) * tier.flashScale;
    ctx.save();
    ctx.translate(tipX, 0);
    ctx.scale(tier.flashScale, tier.flashScale);

    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
    glow.addColorStop(0, `rgba(255, 248, 220, ${alpha})`);
    glow.addColorStop(0.4, `rgba(255, 200, 110, ${alpha * 0.8})`);
    glow.addColorStop(1, "rgba(255, 140, 40, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = `rgba(255, 226, 140, ${alpha})`;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 === 0 ? 17 : 6.5;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.8;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 235, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, -4.6);
    ctx.lineTo(tongue, 0);
    ctx.lineTo(0, 4.6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  ctx.restore();

  const tipDist = (hl + tier.barrelLen) * k + 6;
  return {
    x: x + Math.cos(turretAngle) * tipDist,
    y: y + Math.sin(turretAngle) * tipDist,
    ux: Math.cos(turretAngle), uy: Math.sin(turretAngle),
  };
}

// ---------------------------------------------------------------------------
// TORRETA FIJA — emplazamiento de sacos de arena con ametralladora pesada.
// No se mueve nunca; solo gira hacia el jugador (dir lo decide el servidor
// igual que con cualquier otro enemigo, sin desplazarlo por tener speed 0).
// ---------------------------------------------------------------------------
function damagedTurretColors(base, t) {
  return {
    ...base,
    metal: blendColor(base.metal, 0xdc2626, t),
    metalDark: blendColor(base.metalDark, 0x7f1d1d, t),
    bag: blendColor(base.bag, 0xdc2626, t * 0.5),
  };
}

let turretShellCasings = [];

function drawEnemyTurret(id, x, y, dir, colors, aimAngle) {
  const [ox, oy] = DIR_OFFSETS[dir] || [1, 0];
  const angle = (typeof aimAngle === "number") ? aimAngle : Math.atan2(oy, ox);
  const now = performance.now();
  const untilFiring = enemyFiringUntil.get(id) || 0;
  const firing = untilFiring > now;
  // 0 → 1 a lo largo de la ventana de disparo, para animar el retroceso
  // del arma entera y no solo alargar el cañón.
  const fireT = firing ? 1 - (untilFiring - now) / 150 : 1;
  const recoil = firing ? Math.max(0, 1 - fireT) * 3.2 : 0;
  const jitter = firing ? (Math.sin(now / 18) * 0.6) : 0;

  ctx.fillStyle = "rgba(20, 16, 10, 0.4)";
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 24, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Anillo de sacos de arena, más denso del lado contrario a la mira.
  for (let i = -3; i <= 3; i++) {
    const a = angle + Math.PI + i * 0.36;
    const bx = x + Math.cos(a) * 19;
    const by = y + Math.sin(a) * 11;
    celDisc(bx, by, 7.4, colors.bag, colors.bagDark, colors.outline, 1.8);
  }
  ctx.fillStyle = colors.bagLight;
  ctx.beginPath();
  ctx.ellipse(x - Math.cos(angle) * 19, y - 3 - Math.sin(angle) * 11, 5, 2.4, angle, 0, Math.PI * 2);
  ctx.fill();

  // Casquillos eyectados: se generan al empezar a disparar y quedan
  // tirados junto al saco, para que se note que el arma escupió munición.
  if (firing && fireT < 0.15) {
    turretShellCasings.push({
      x: x - Math.sin(angle) * 10, y: y - 5 + Math.cos(angle) * 10,
      vx: -Math.sin(angle) * 1.4 + (Math.random() - 0.5), vy: -1.5 - Math.random(),
      startedAt: now,
    });
  }
  turretShellCasings = turretShellCasings.filter((s) => now - s.startedAt < 900);
  for (const s of turretShellCasings) {
    const st = (now - s.startedAt) / 900;
    ctx.fillStyle = "#c9a24a";
    ctx.beginPath();
    ctx.ellipse(s.x + s.vx * st * 14, s.y + s.vy * st * 14 + st * st * 30, 1.8, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Base giratoria + cuerpo del arma + cañón — todo el conjunto retrocede
  // un toque y tiembla mientras dispara, en vez de solo alargar el cañón.
  ctx.save();
  ctx.translate(x - Math.cos(angle) * recoil, y - 5 - Math.sin(angle) * recoil + jitter);
  ctx.rotate(angle);
  ctx.fillStyle = colors.metalDark;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = colors.outline; ctx.lineWidth = 2; ctx.stroke();
  // Rueditas de traslación del afuste, a los costados de la base.
  ctx.fillStyle = colors.metal;
  for (const wy of [-6, 6]) {
    ctx.beginPath(); ctx.arc(-2, wy, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = colors.outline; ctx.lineWidth = 1; ctx.stroke();
  }

  ctx.fillStyle = colors.metal;
  roundRect(-5, -4.5, 15, 9, 2);
  ctx.fill();
  ctx.strokeStyle = colors.outline; ctx.lineWidth = 1.6; ctx.stroke();

  const barrelLen = 22 + recoil * 0.6;
  ctx.fillStyle = colors.barrel;
  ctx.fillRect(9, -1.9, barrelLen, 3.8);
  ctx.fillStyle = "#12171a";
  ctx.fillRect(9 + barrelLen - 2, -2.6, 3, 5.2);
  // Freno de boca (muzzle brake) con ranuras — remata el cañón en vez de
  // dejarlo como una punta lisa.
  ctx.fillStyle = "#4a545b";
  ctx.fillRect(9 + barrelLen, -2.4, 3.4, 4.8);
  ctx.strokeStyle = "#12171a"; ctx.lineWidth = 0.9;
  for (const gy of [-1.4, 0, 1.4]) {
    ctx.beginPath(); ctx.moveTo(9 + barrelLen, gy); ctx.lineTo(9 + barrelLen + 3.4, gy); ctx.stroke();
  }

  if (firing) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - fireT / 0.6);
    ctx.fillStyle = "#ffd83a";
    ctx.beginPath();
    ctx.moveTo(9 + barrelLen + 3.4, 0);
    ctx.lineTo(9 + barrelLen + 10, -3.2);
    ctx.lineTo(9 + barrelLen + 13, 0);
    ctx.lineTo(9 + barrelLen + 10, 3.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Gunner: cabeza y hombros, más los brazos sosteniendo el arma —
  // tiemblan un poco durante la ráfaga, en vez de quedarse clavados.
  const headX = x - Math.cos(angle) * (3 + recoil * 0.3);
  const headY = y - 11 + jitter * 0.5;
  const gripX = x + Math.cos(angle) * 4;
  const gripY = y - 6 + Math.sin(angle) * 4;
  celLine([[headX - Math.sin(angle) * 5, headY + 5], [gripX, gripY]], 4.2, colors.metal, colors.outline, 1.6);
  celDisc(headX, headY, 5.4, colors.skin, colors.skinDark, colors.outline, 1.6);
  celBox(headX - 6, headY + 3, 12, 6, 2, colors.metal, colors.metalDark, colors.outline, 1.6);
  celDisc(gripX, gripY, 2.6, colors.skin, colors.skinDark, colors.outline, 1.4);

  const tipX = x + Math.cos(angle) * (9 + barrelLen + 3);
  const tipY = y - 5 + Math.sin(angle) * (9 + barrelLen + 3);
  return { x: tipX, y: tipY, ux: Math.cos(angle), uy: Math.sin(angle) };
}

function drawEnemyTurretWrapper(id, x, y, dir, aimAngle) {
  let colors = TURRET_EMPLACEMENT_COLORS;
  const flash = enemyHitUntil.get(id);
  if (flash && performance.now() < flash.until) {
    const t = (flash.until - performance.now()) / ENEMY_HIT_FLASH_MS;
    colors = damagedTurretColors(TURRET_EMPLACEMENT_COLORS, t);
  }
  const muzzle = drawEnemyTurret(id, x, y, dir, colors, aimAngle);
  if (muzzle) muzzlePoints.set(id, muzzle);
}

// ---------------------------------------------------------------------------
// MORTERO — emplazamiento fijo que lanza proyectiles en arco (ver
// drawEnemyMortarThrows). No dispara balas, así que no tiene "firing" propio.
// ---------------------------------------------------------------------------
// Emplazamiento de mortero: sacos de arena en herradura, cajón de
// munición con proyectiles sueltos, un cargador arrodillado al lado, y el
// tubo sobre bípode con placa base — inspirado en la referencia que
// pasaste, con humo real saliendo de la boca al disparar.
function drawEnemyMortarUnit(id, x, y, dir) {
  const [ox, oy] = DIR_OFFSETS[dir] || [1, 0];
  const angle = Math.atan2(oy, ox);
  const now = performance.now();
  const untilFiring = enemyFiringUntil.get(id) || 0;
  const firing = untilFiring > now;
  const fireT = firing ? 1 - (untilFiring - now) / 650 : 1;
  // Sacudida del emplazamiento entero justo al disparar — el tubo entero
  // "salta" un instante antes de asentarse, y el humo se ve más denso.
  const kick = firing ? Math.max(0, 1 - fireT / 0.22) : 0;

  ctx.fillStyle = "rgba(20, 16, 10, 0.42)";
  ctx.beginPath();
  ctx.ellipse(x, y + 18, 40, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Anillo de sacos de arena más grande y en dos filas escalonadas, en
  // herradura abierta hacia donde apunta el tubo — un emplazamiento se
  // nota más si tiene volumen real, no solo una fila de círculos.
  for (let i = -4; i <= 4; i++) {
    const a = angle + Math.PI + i * 0.3;
    const bx = x + Math.cos(a) * 28;
    const by = y + Math.sin(a) * 16;
    celDisc(bx, by, 8.4, "#7a7350", "#4c472e", "#161a12", 1.9);
  }
  for (let i = -3; i <= 3; i++) {
    const a = angle + Math.PI + i * 0.36;
    const bx = x + Math.cos(a) * 21;
    const by = y + Math.sin(a) * 12 - 4;
    celDisc(bx, by, 6.6, "#8a8360", "#5c5636", "#161a12", 1.6);
  }
  // Estaca con la bandera del bando, clavada en el saco central trasero.
  const flagA = angle + Math.PI;
  const stakeX = x + Math.cos(flagA) * 27;
  const stakeY = y + Math.sin(flagA) * 15 - 6;
  celLine([[stakeX, stakeY + 4], [stakeX, stakeY - 14]], 1.8, "#5c4f30", "#161a12", 1);
  ctx.fillStyle = TURRET_EMPLACEMENT_COLORS.accent;
  ctx.beginPath();
  ctx.moveTo(stakeX, stakeY - 14);
  ctx.lineTo(stakeX + 9, stakeY - 11);
  ctx.lineTo(stakeX, stakeY - 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#161a12"; ctx.lineWidth = 1; ctx.stroke();

  // Cajón de munición, más grande, con la tapa entreabierta y proyectiles
  // sueltos apoyados al costado.
  const crateSide = -Math.sin(angle) >= 0 ? 1 : -1;
  const cx = x + Math.cos(angle + Math.PI / 2) * 27 * crateSide;
  const cy = y + Math.sin(angle + Math.PI / 2) * 16 * crateSide + 7;
  celBox(cx - 9, cy - 5, 18, 13, 2, "#6b5024", "#3a2e1c", "#161a12", 1.7);
  celBox(cx - 9, cy - 9, 18, 4.5, 1.6, "#5c4320", "#3a2e1c", "#161a12", 1.5);
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(cx - 10 + i * 7, cy + 10);
    ctx.rotate(0.15 * (i - 1));
    ctx.fillStyle = "#3f4a2e";
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.4, 5.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#161a12"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#8a9450";
    ctx.beginPath(); ctx.ellipse(0, -3.4, 1.8, 1.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Cargador arrodillado, del lado contrario a los cajones. Tiene su
  // propio ciclo de recarga (agacharse al cajón → levantar la granada →
  // acercarla al tubo), sincronizado libremente con el reloj para que no
  // quede parado como una estatua entre disparo y disparo.
  const loaderA = angle + Math.PI * 0.65;
  const loaderDir = Math.cos(angle) >= 0 ? "left" : "right";
  const loaderX = x + Math.cos(loaderA) * 16;
  const loaderY = y + Math.sin(loaderA) * 10;
  const reloadCycle = (now / 1400 + (id.charCodeAt(0) % 10) / 10) % 1;
  const reachDown = reloadCycle < 0.4 ? Math.sin((reloadCycle / 0.4) * Math.PI) : 0;
  const lift = reloadCycle >= 0.4 && reloadCycle < 0.85
    ? Math.sin(((reloadCycle - 0.4) / 0.45) * Math.PI)
    : 0;

  drawSoldierFigure(loaderX, loaderY - reachDown * 2, {
    dir: loaderDir, kneeling: true, weapon: "none", colors: UNIFORMS.enemigo,
  });
  ctx.save();
  const shellMirror = loaderDir === "left" ? -1 : 1;
  const shellX = loaderX + shellMirror * (8 - reachDown * 3 + lift * 2);
  const shellY = loaderY - 12 + reachDown * 6 - lift * 8;
  ctx.translate(shellX, shellY);
  ctx.rotate(shellMirror * (-0.5 - lift * 0.6));
  ctx.fillStyle = "#3f4a2e";
  ctx.beginPath(); ctx.ellipse(0, 0, 2.4, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#161a12"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#8a9450";
  ctx.beginPath(); ctx.ellipse(0, -3.6, 1.8, 1.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Base y placa de apoyo, más ancha, con nervaduras remachadas.
  ctx.save();
  ctx.translate(x, y - 6 + kick * -2);
  ctx.fillStyle = "rgba(20,16,10,0.3)";
  ctx.beginPath(); ctx.ellipse(0, 16, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Tubo sobre bípode y placa base, apuntando hacia Navajas — todo el
  // conjunto escalado un poco más grande y con más detalle metálico.
  ctx.save();
  ctx.translate(x, y - 6 + kick * -2);
  ctx.rotate(angle - Math.PI / 2);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.scale(1.18, 1.18);

  // Placa base acanalada.
  ctx.fillStyle = "#2c2f24";
  ctx.beginPath();
  ctx.ellipse(0, 11, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#12140f"; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.strokeStyle = "#4a5138"; ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * 3.6, 8); ctx.lineTo(i * 3.6, 14); ctx.stroke();
  }

  // Bípode: dos patas robustas con collarín de sujeción al tubo.
  ctx.strokeStyle = "#20261d"; ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(-8, 4); ctx.lineTo(-1.8, -7);
  ctx.moveTo(8, 4); ctx.lineTo(1.8, -7);
  ctx.stroke();
  ctx.strokeStyle = "#3a4030"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-8, 4); ctx.lineTo(-1.8, -7);
  ctx.moveTo(8, 4); ctx.lineTo(1.8, -7);
  ctx.stroke();
  // Manivela de elevación al costado del bípode.
  ctx.fillStyle = "#4a5138";
  ctx.beginPath(); ctx.arc(6, -2, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#12140f"; ctx.lineWidth = 1; ctx.stroke();

  // Tubo: más largo, con anillos de refuerzo y boca reforzada.
  const tubeLen = (30 + (firing ? 2.5 : 0));
  ctx.fillStyle = "#3a4030";
  roundRect(-3.8, -tubeLen, 7.6, tubeLen + 9, 2.6);
  ctx.fill();
  ctx.strokeStyle = "#161a12"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(-3.8 + 1.2, -tubeLen + 2, 1.6, tubeLen + 4);
  ctx.strokeStyle = "#1c211a"; ctx.lineWidth = 1.4;
  for (const ring of [-tubeLen + 6, -tubeLen * 0.5, -6]) {
    ctx.beginPath(); ctx.moveTo(-3.8, ring); ctx.lineTo(3.8, ring); ctx.stroke();
  }
  // Boca del tubo reforzada, un poco más ancha que el cuerpo.
  ctx.fillStyle = "#20261d";
  roundRect(-4.6, -tubeLen - 2.5, 9.2, 5.5, 1.6);
  ctx.fill();
  ctx.strokeStyle = "#12140f"; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = "#20261d";
  ctx.fillRect(-3.8, -4, 7.6, 3.4);

  if (firing && fireT < 0.35) {
    const flashA = 1 - fireT / 0.35;
    // Fogonazo en forma de estrella, más grande, en vez de un simple
    // círculo — se lee como disparo de verdad, no como un parpadeo.
    ctx.save();
    ctx.globalAlpha = flashA;
    ctx.translate(0, -tubeLen - 4);
    ctx.fillStyle = "#ffe27a";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rr = i % 2 === 0 ? 12 : 5;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.85;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Humo de la boca: más lento y ancho que el fogonazo, se disipa despacio.
  if (firing) {
    const smokeA = Math.max(0, 1 - fireT);
    const sAngle = angle - Math.PI / 2;
    const sx = x + Math.cos(sAngle) * 34;
    const sy = y - 6 + Math.sin(sAngle) * 34 - fireT * 22;
    ctx.save();
    ctx.globalAlpha = smokeA * 0.6;
    ctx.fillStyle = "#cfcabb";
    ctx.beginPath();
    ctx.arc(sx, sy, 6 + fireT * 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = smokeA * 0.4;
    ctx.beginPath();
    ctx.arc(sx + Math.cos(sAngle) * 6, sy - 6, 4 + fireT * 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Gunner: cabeza y hombros justo detrás del tubo, con protector auditivo
  // en la mano libre durante el disparo (gesto más creíble que quedarse
  // inmóvil junto a un arma que ruge).
  const gunnerA = angle - Math.PI * 0.4;
  const gx = x + Math.cos(gunnerA) * 11;
  const gy = y - 6 + Math.sin(gunnerA) * 7;
  celDisc(gx, gy, 5.8, UNIFORMS.enemigo.skin, UNIFORMS.enemigo.skinDark, UNIFORMS.enemigo.outline, 1.7);
  celBox(gx - 6.5, gy + 3, 13, 6.5, 2, UNIFORMS.enemigo.cloth, UNIFORMS.enemigo.clothDark, UNIFORMS.enemigo.outline, 1.7);
  if (firing && fireT < 0.5) {
    ctx.fillStyle = "#2b3038";
    ctx.beginPath(); ctx.arc(gx - 4, gy - 1, 2, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// ALIADO — soldado boliviano rescatado que combate junto a Navajas.
// Visualmente es el mismo uniforme; solo cambia el id que lo anima.
// ---------------------------------------------------------------------------
function drawAllySoldier(id, x, y, dir, lastShotAt) {
  const moving = isMoving(id, x, y);
  const bob = moving ? Math.abs(Math.sin(unitPhase(id))) * 2 : 0;
  const drawY = y - bob;

  ctx.fillStyle = "rgba(58, 46, 28, 0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 11, moving ? 3 : 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const shotAge = Date.now() - (lastShotAt || 0);
  const firing = shotAge < 220;
  const recoilT = firing ? shotAge / 220 : null;

  const muzzle = drawSoldierFigure(x, drawY, {
    dir, moving, phase: unitPhase(id), colors: UNIFORMS.boliviano, weapon: "rifle", firing, recoilT,
  });
  if (muzzle) muzzlePoints.set(id, muzzle);
}

// ---------------------------------------------------------------------------
// Movimiento e interpolación
// ---------------------------------------------------------------------------
const motionTrackers = new Map();
const renderPos = new Map();

function smooth(id, x, y) {
  const prev = renderPos.get(id);
  if (!prev) {
    renderPos.set(id, { x, y });
    return { x, y };
  }
  if (Math.hypot(x - prev.x, y - prev.y) > 60) {
    prev.x = x; prev.y = y;
  } else {
    prev.x += (x - prev.x) * 0.35;
    prev.y += (y - prev.y) * 0.35;
  }
  return prev;
}

function isMoving(id, x, y) {
  const now = performance.now();
  const prev = motionTrackers.get(id);
  if (!prev) {
    motionTrackers.set(id, { lastX: x, lastY: y, lastCheck: now, moving: false });
    return false;
  }
  const dt = now - prev.lastCheck;
  if (dt > 80) {
    prev.moving = Math.hypot(x - prev.lastX, y - prev.lastY) > 0.3;
    prev.lastX = x; prev.lastY = y; prev.lastCheck = now;
  }
  return prev.moving;
}

const DIR_KEYS = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
  W: "up", S: "down", A: "left", D: "right",
};

window.addEventListener("keydown", (e) => {
  // Con una carta abierta, el teclado solo sirve para cerrarla.
  if (letterOpen) {
    if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
      e.preventDefault();
      if (!e.repeat) closeLetter();
    }
    return;
  }
  if (gameState !== "PLAYING") return;
  if (e.key === "Escape") {
    if (!e.repeat) requestPause();
    return;
  }
  if (DIR_KEYS[e.key]) keysDown.add(DIR_KEYS[e.key]);
  if (latestState && latestState.paused) return;
  
  if (e.key === " ") { 
    e.preventDefault(); 
    // NUEVO: El sonido se dispara al instante al tocar la barra espaciadora
    // respetando el tiempo de recarga del arma (250ms)
    if (performance.now() - lastShotVisualAt > 250) {
      if (window.sfxGunshot) window.sfxGunshot();
    }
    requestShoot(); 
  }
  
  if (e.key === "g" || e.key === "G") requestGrenade();
  if (e.key === "f" || e.key === "F") requestMelee();
  
  // Cheat de desarrollador: Invocar Jefe al instante
  if (e.key === "b" || e.key === "B") fetch("/api/cheat-boss", { method: "POST" });
  
  // Activar Lanzallamas con la E

  if (e.key === "e" || e.key === "E") {
    if (latestState && latestState.navajas) {
      if ((latestState.navajas.fuel || 0) > 0) {
        if (window.sfxFlameUse) window.sfxFlameUse();
        requestFlame();
      } else {
        if (window.sfxFlameEmpty) window.sfxFlameEmpty();
      }
    }
  }
});

// Le avisa al servidor (extras.js) que dispare fuego
async function requestFlame() {
  const res = await fetch("/api/flame", { method: "POST" });
  const result = await res.json();
  if (result.ok) {
    shakeUntil = performance.now() + 150;
    shakeMag = Math.max(shakeMag, 2);
  } else if (result.reason === "sin_combustible") {
    // Si te quedas sin gasolina en medio de la ráfaga, apagamos el sonido
    if (window.sfxFlameStop) window.sfxFlameStop();
  }
  return result;
}

window.addEventListener("keyup", (e) => {
  if (DIR_KEYS[e.key]) keysDown.delete(DIR_KEYS[e.key]);
  
  // NUEVO: Cortamos el sonido al instante cuando el jugador suelta la E
  if (e.key === "e" || e.key === "E") {
    if (window.sfxFlameStop) window.sfxFlameStop();
  }
});

// Correr: Shift mantenido. El servidor decide si de verdad hay resistencia
// para hacerlo (ver requestMove) — esto solo manda la intención.
let shiftHeld = false;
const RUN_SPEED_MULTIPLIER_CLIENT = 1.85; // solo para la predicción de colisión del cliente

window.addEventListener("keydown", (e) => {
  if (e.key === "Shift") shiftHeld = true;
});
window.addEventListener("keyup", (e) => {
  if (e.key === "Shift") shiftHeld = false;
});
window.addEventListener("blur", () => { shiftHeld = false; });

let pauseInFlight = false;

function setPauseMenu(visible) {
  if (letterOpen) visible = false; // la carta manda: no mostrar el menú de pausa encima
  if (visible === !pauseMenu.classList.contains("hidden")) return;
  pauseMenu.classList.toggle("hidden", !visible);
  if (visible) pauseResumeBtn.focus();
}

async function requestPause() {
  if (pauseInFlight || gameState !== "PLAYING") return;
  pauseInFlight = true;
  try {
    const res = await fetch("/api/pause", { method: "POST" });
    const data = await res.json();
    if (latestState) latestState.paused = data.paused;
    setPauseMenu(!!data.paused);
  } catch (err) {
    console.error("No se pudo cambiar la pausa:", err);
  } finally {
    pauseInFlight = false;
  }
}

async function requestMove(direction, running = false) {
  if (gameState !== "PLAYING") return null;
  const res = await fetch("/api/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ direction, running }),
  });
  return res.json();
}

async function requestShoot() {
  const res = await fetch("/api/shoot", { method: "POST" });
  const result = await res.json();
  if (result.ok && latestState) {
    const p = latestState.navajas;
    if (result.meleeTriggered) {
      // El servidor decidió que estábamos a distancia de bayoneta: misma
      // visual que requestMelee(), aunque el disparo lo pidió el jugador.
      lastMeleeVisualAt = performance.now();
      meleeSlashes.push({
        x: p.x, y: p.y, dir: p.dir,
        startedAt: performance.now(), hit: !!result.killed,
      });
      shakeUntil = performance.now() + 120;
      shakeMag = Math.max(shakeMag, 3);
      if (result.killed) {
        for (let i = 0; i < 16; i++) {
          bloodSpurts.push({
            x: p.x, y: p.y - 18,
            vx: (Math.random() - 0.5) * 5.5, vy: -2.2 - Math.random() * 3.2,
            startedAt: performance.now(),
          });
        }
      }
    } else {
      lastShotVisualAt = performance.now();
      const m = muzzlePoints.get("navajas");
      bullets.push({
        x: m ? m.x : p.x, y: m ? m.y : p.y, dir: enSombraDeJefeAvion(p.x, p.y) ? "up" : p.dir,
        startedAt: performance.now(), hit: !!result.killed, hero: true,
      });
      shakeUntil = performance.now() + 90;
      shakeMag = Math.max(shakeMag, 1.5);
      if (window.sfxGunshot) window.sfxGunshot();
    }
  }
  return result;
}

async function requestMelee() {
  const res = await fetch("/api/melee", { method: "POST" });
  const result = await res.json();
  if (result.ok && latestState) {
    const p = latestState.navajas;
    lastMeleeVisualAt = performance.now();
    meleeSlashes.push({
      x: p.x, y: p.y, dir: p.dir,
      startedAt: performance.now(), hit: !!result.killed,
    });
    shakeUntil = performance.now() + 120;
    shakeMag = Math.max(shakeMag, 3);
    if (window.sfxMelee) window.sfxMelee();

    if (result.killed) {
      for (let i = 0; i < 16; i++) {
        bloodSpurts.push({
          x: p.x, y: p.y - 18,
          vx: (Math.random() - 0.5) * 5.5, vy: -2.2 - Math.random() * 3.2,
          startedAt: performance.now(),
        });
      }
    }
  }
  return result;
}

const GRENADE_FLIGHT_MS = 420;

async function requestGrenade() {
  const res = await fetch("/api/grenade", { method: "POST" });
  const result = await res.json();
  if (result.ok && latestState) {
    const p = latestState.navajas;
    grenadeThrows.push({
      fromX: p.x, fromY: p.y - 20, toX: result.x, toY: result.y,
      startedAt: performance.now(),
    });
    setTimeout(() => {
      explosionAnims.push({ x: result.x, y: result.y, startedAt: performance.now() });
      spawnLingeringSmoke(result.x, result.y, performance.now());
      scorchMarks.push({ x: result.x, y: result.y, at: performance.now() });
      if (scorchMarks.length > 14) scorchMarks.shift();
      shakeUntil = performance.now() + 380;
      shakeMag = Math.max(shakeMag, 6);
    }, GRENADE_FLIGHT_MS);
  }
  return result;
}

async function fetchState() {
  if (gameState !== "PLAYING") return;
  const res = await fetch("/api/state");
  const prevState = latestState;
  latestState = await res.json();
  if (latestState && latestState.currentLevelIndex !== lastKnownLevel) {
    lastKnownLevel = latestState.currentLevelIndex;
    dayElapsedMs = LEVEL_TIME_OF_DAY[lastKnownLevel] ?? 0;
    lastDayTickAt = performance.now();
    // Carta narrativa al entrar a un nivel nuevo (el juego queda en pausa mientras se lee).
    selectedLevel = lastKnownLevel; // "Reintentar" vuelve al nivel en el que estás
    if (lastKnownLevel > 0 && !lettersShown.has(lastKnownLevel)) {
      lettersShown.add(lastKnownLevel);
      openLetter(lastKnownLevel, true);
    }
  }
  if (latestState) {
    WORLD_W = latestState.mapWidth || WORLD_W;
    WORLD_H = latestState.mapHeight || WORLD_H;
    if (latestState.pozo) {
      POZO_X = latestState.pozo.x;
      POZO_Y = latestState.pozo.y;
    } else {
      POZO_X = WORLD_W / 2;
      POZO_Y = WORLD_H / 2;
    }
  }
  if (latestState) {
    if (latestState.isTransitioning && !prevIsTransitioning && window.sfxLevelComplete) {
      window.sfxLevelComplete();
    }
    prevIsTransitioning = !!latestState.isTransitioning;
  }
  detectDamage(prevState);
  updateHud();
  syncEnemyShots();
  syncMortarShots();
  syncPlaneBombs();
  syncExplosions();
  syncHits();
  syncShellImpacts();
  syncItemEvents(); // Llamamos a la sincronización de objetos
}

// Revisa si recogiste un objeto que el servidor envió
let renderedItemEvents = new Set();
function syncItemEvents() {
  if (!latestState || !latestState.itemEvents) return;
  for (const ev of latestState.itemEvents) {
    const key = `${ev.at}-${ev.x}-${ev.y}`;
    if (renderedItemEvents.has(key)) continue;
    renderedItemEvents.add(key);
    
    // Si la caja recogida es el lanzallamas, suena el item
    if (ev.type === "lanzallamas" && window.sfxItemFlame) {
      window.sfxItemFlame();
    }
  }
  if (renderedItemEvents.size > 50) {
    renderedItemEvents = new Set(Array.from(renderedItemEvents).slice(-25));
  }
}
function detectDamage(prevState) {
  if (!latestState || !latestState.navajas) return;
  const newHealth = latestState.navajas.health;
  if (prevHealth !== null && newHealth < prevHealth) {
    const now = performance.now();
    damageFlashUntil = now + DAMAGE_FLASH_MS;
    shakeUntil = now + 260;
    shakeMag = Math.max(shakeMag, 5);
    
    // ¡NUEVO! El sonido se dispara exactamente aquí cuando la vida llega a 0
    if (newHealth <= 0 && prevHealth > 0) {
      if (window.sfxPlayerDeath) window.sfxPlayerDeath();
    }

    const p = latestState.navajas;
    for (let i = 0; i < 7; i++) {
      bloodSpurts.push({
        x: p.x, y: p.y - 18,
        vx: (Math.random() - 0.5) * 2.4, vy: -1 - Math.random() * 1.6,
        startedAt: now,
      });
    }
  }
  prevHealth = newHealth;
}

function syncEnemyShots() {
  // Las balas enemigas ya no se dibujan aquí con una animación falsa: ahora
  // son un arreglo real del servidor (state.enemyBullets) que drawBullets()
  // lee directamente en sus coordenadas x,y verdaderas. Esta función solo
  // dispara el flash de boca de cañón sobre el enemigo que disparó.
  if (!latestState || !latestState.enemyShots) return;
  const now = performance.now();
  for (const shot of latestState.enemyShots) {
    const key = `${shot.at}-${shot.x}-${shot.y}`;
    if (renderedEnemyShotIds.has(key)) continue;
    renderedEnemyShotIds.add(key);
    if (shot.id) enemyFiringUntil.set(shot.id, now + 150);

    // Sacudida de cámara al disparo de un tanque — proporcional a su
    // calibre, y solo si está razonablemente cerca de Navajas.
    if (shot.type && (shot.type.startsWith("tanqueta") || shot.type === "tren_blindado" || shot.type === "jefe_canon")) {
      const navShake = latestState.navajas;
      const distShake = navShake ? Math.hypot(shot.x - navShake.x, shot.y - navShake.y) : 0;
      if (!navShake || distShake < 520) {
        const mag = shot.type === "jefe_canon" ? 5.2 : shot.type === "tren_blindado" ? 4.2 : shot.type === "tanqueta_pesada" ? 3.2 : shot.type === "tanqueta" ? 2.1 : 1.3;
        shakeUntil = Math.max(shakeUntil, now + 130);
        shakeMag = Math.max(shakeMag, mag);
      }
    }

    // Sonido del disparo enemigo: throttleado para no saturar cuando hay
    // varios enemigos tirando a la vez, y solo si está razonablemente
    // cerca de Navajas (en mapas largos, uno lejano no debería sonar).
    if (window.sfxEnemyGunshot && now - lastEnemyGunshotSoundAt > 45) {
      const nav = latestState.navajas;
      const dist = nav ? Math.hypot(shot.x - nav.x, shot.y - nav.y) : 0;
      if (!nav || dist < 700) {
        lastEnemyGunshotSoundAt = now;
        window.sfxEnemyGunshot();
      }
    }
  }
  if (renderedEnemyShotIds.size > 200) {
    renderedEnemyShotIds = new Set(Array.from(renderedEnemyShotIds).slice(-100));
  }
}

function syncMortarShots() {
  if (!latestState || !latestState.mortarShots) return;
  const now = performance.now();
  for (const shot of latestState.mortarShots) {
    const key = `${shot.at}-${shot.fromX}-${shot.fromY}`;
    if (mortarShotIds.has(key)) continue;
    mortarShotIds.add(key);
    enemyMortarThrows.push({
      fromX: shot.fromX, fromY: shot.fromY,
      toX: shot.toX, toY: shot.toY,
      startedAt: now,
      flightMs: shot.flightMs || MORTAR_FLIGHT_MS_CLIENT,
      isMega: !!shot.isMega,
      radius: shot.isMega ? 130 : 66,
    });
    // Humo real en la boca del tubo — drawEnemyMortarUnit lo lee para
    // mostrar el fogonazo y la voluta que salen al disparar.
    if (shot.enemyId) enemyFiringUntil.set(shot.enemyId, now + 650);
    if (shot.bossId) bossMortarUntil.set(shot.bossId, now + 520);
    if (window.sfxMortarLaunch) window.sfxMortarLaunch();
  }
  if (mortarShotIds.size > 100) mortarShotIds = new Set(Array.from(mortarShotIds).slice(-50));
}

function syncPlaneBombs() {
  if (!latestState || !latestState.bombShots) return;
  const now = performance.now();
  for (const shot of latestState.bombShots) {
    const key = `${shot.at}-${shot.fromX}-${shot.fromY}`;
    if (planeBombShotIds.has(key)) continue;
    planeBombShotIds.add(key);
    planeBombThrows.push({
      fromX: shot.fromX, fromY: shot.fromY - PLANE_ALTITUDE_PX,
      toX: shot.toX, toY: shot.toY,
      startedAt: now,
      flightMs: shot.flightMs || BOMB_FLIGHT_MS_CLIENT,
    });
    const planeId = shot.id.slice(0, shot.id.lastIndexOf("_"));
    planeBombOpenUntil.set(planeId, now + 380);
    if (window.sfxMortarLaunch) window.sfxMortarLaunch();
  }
  if (planeBombShotIds.size > 100) planeBombShotIds = new Set(Array.from(planeBombShotIds).slice(-50));
}

function syncExplosions() {
  if (!latestState || !latestState.explosions) return;
  const now = performance.now();
  for (const ex of latestState.explosions) {
    const key = `${ex.at}-${ex.x}-${ex.y}`;
    if (renderedExplosionIds.has(key)) continue;
    renderedExplosionIds.add(key);
    if (window.sfxExplosion) window.sfxExplosion();
    const already = explosionAnims.some(
      (a) => Math.abs(a.x - ex.x) < 1 && Math.abs(a.y - ex.y) < 1 && now - a.startedAt < 500
    );
    if (!already) {
      explosionAnims.push({ x: ex.x, y: ex.y, startedAt: now, isMega: !!ex.isMega });
      spawnLingeringSmoke(ex.x, ex.y, now);
      scorchMarks.push({ x: ex.x, y: ex.y, at: now });
      if (scorchMarks.length > 14) scorchMarks.shift();
      if (ex.isMega) {
        shakeUntil = Math.max(shakeUntil, now + 500);
        shakeMag = Math.max(shakeMag, 8);
      }
    }
  }
  if (renderedExplosionIds.size > 100) {
    renderedExplosionIds = new Set(Array.from(renderedExplosionIds).slice(-50));
  }
}

// Impactos del jugador sobre enemigos: flash de daño + chispas/sangre en el
// punto de impacto, y si murió, un colapso breve (o una mini explosión si
// era una tanqueta) — para que el golpe se note de verdad.
// ---------------------------------------------------------------------------
// CAÍDA DEL BOMBARDERO — derribado, arde, pierde piezas, entra en barrena y se
// estrella contra el suelo con una explosión enorme.
// ---------------------------------------------------------------------------
const PLANE_CRASH_MS = 3600;
const PLANE_CRASH_TRAVEL_PX = 330;

function iniciarCaidaAvion(hit, now) {
  const en = latestState && latestState.enemies.find((e) => e.id === hit.id);
  const h0 = en && typeof en.heading === "number" ? en.heading : 0;
  const sp = renderPos.get(hit.id) || { x: hit.x, y: hit.y };
  const spin = Math.random() < 0.5 ? -1 : 1;
  planeCrashes.set(hit.id, {
    startedAt: now, x0: sp.x, y0: sp.y, h0, spin,
    trail: [], lastTrailAt: 0, pieces: [], piecesSpawned: 0, impacted: false, impactAt: 0,
  });
  if (window.sfxDestruction) window.sfxDestruction();
  shakeUntil = Math.max(shakeUntil, now + 700);
  shakeMag = Math.max(shakeMag, 8);
  explosionAnims.push({ x: sp.x, y: sp.y - PLANE_ALTITUDE_PX, startedAt: now }); // estallido en el aire (motor reventado)
}

// Posición de la caída en el instante `now`: punto de suelo, ángulo dibujado y altura.
function estadoCaidaAvion(c, now) {
  const t = Math.min(1, (now - c.startedAt) / PLANE_CRASH_MS);
  const avance = PLANE_CRASH_TRAVEL_PX * (1 - (1 - t) * (1 - t));
  let gx = c.x0 + Math.cos(c.h0) * avance;
  let gy = c.y0 + Math.sin(c.h0) * avance;
  gx = Math.max(60, Math.min(WORLD_W - 60, gx));
  gy = Math.max(60, Math.min(WORLD_H - 60, gy));
  const alt = PLANE_ALTITUDE_PX * (1 - t * t * (0.55 + 0.45 * t));
  const angle = c.h0 + c.spin * Math.pow(t, 1.5) * 7.4; // barrena que se cierra
  return { t, gx, gy, alt, angle };
}

function actualizarCaidasAvion(now) {
  for (const [id, c] of planeCrashes) {
    const st = estadoCaidaAvion(c, now);
    const fx = st.gx, fy = st.gy - st.alt;

    // Rastro de humo/fuego pegado al avión
    if (!c.impacted && now - c.lastTrailAt > 32) {
      c.lastTrailAt = now;
      c.trail.push({ x: fx, y: fy, at: now, r: 8 + Math.random() * 6 });
    }
    c.trail = c.trail.filter((p) => now - p.at < 2300);

    // Piezas que se desprenden: motor, tramo de ala y cola
    const plan = [0.14, 0.34, 0.56];
    while (!c.impacted && c.piecesSpawned < plan.length && st.t >= plan[c.piecesSpawned]) {
      const kind = ["motor", "ala", "cola"][c.piecesSpawned];
      const dir = c.piecesSpawned % 2 ? -1 : 1;
      c.pieces.push({
        kind, x: fx, y: fy, at: now,
        vx: Math.cos(st.angle + dir * Math.PI / 2) * (60 + Math.random() * 50) + Math.cos(c.h0) * 40,
        vy: Math.sin(st.angle + dir * Math.PI / 2) * (60 + Math.random() * 50) * 0.6 - 30,
        landY: st.gy + (Math.random() - 0.5) * 30,
        rot: Math.random() * 6, spin: (Math.random() - 0.5) * 12, landed: false,
      });
      c.piecesSpawned++;
      if (window.sfxExplosion) window.sfxExplosion();
    }

    for (const pc of c.pieces) {
      if (pc.landed) continue;
      const u = (now - pc.at) / 1000;
      pc.cx = pc.x + pc.vx * u;
      pc.cy = pc.y + pc.vy * u + 0.5 * 420 * u * u;
      if (pc.cy >= pc.landY) {
        pc.landed = true;
        explosionAnims.push({ x: pc.cx, y: pc.landY, startedAt: now });
        spawnLingeringSmoke(pc.cx, pc.landY, now);
        scorchMarks.push({ x: pc.cx, y: pc.landY, at: now });
        if (scorchMarks.length > 14) scorchMarks.shift();
        shakeUntil = Math.max(shakeUntil, now + 260);
        shakeMag = Math.max(shakeMag, 4);
        if (window.sfxExplosion) window.sfxExplosion();
      }
    }

    // Impacto final
    if (!c.impacted && st.t >= 1) {
      c.impacted = true;
      c.impactAt = now;
      const debris = [];
      for (let i = 0; i < 14; i++) {
        debris.push({
          angle: Math.random() * Math.PI * 2, speed: 70 + Math.random() * 90,
          size: 4 + Math.random() * 6, rot: (Math.random() - 0.5) * 10, drop: 0.55 + Math.random() * 0.3,
        });
      }
      vehicleExplosionAnims.push({
        x: st.gx, y: st.gy, startedAt: now, size: 2.8, debris,
        type: "jefe_avion", wreckAngle: c.h0,
      });
      explosionAnims.push({ x: st.gx, y: st.gy, startedAt: now, isMega: true });
      explosionAnims.push({ x: st.gx + Math.cos(c.h0) * 60, y: st.gy + Math.sin(c.h0) * 40, startedAt: now + 1, isMega: false });
      spawnLingeringSmoke(st.gx, st.gy, now);
      for (let i = 0; i < 3; i++) scorchMarks.push({ x: st.gx + (i - 1) * 46, y: st.gy + (i % 2) * 14, at: now });
      while (scorchMarks.length > 14) scorchMarks.shift();
      shakeUntil = Math.max(shakeUntil, now + 1100);
      shakeMag = Math.max(shakeMag, 13);
      if (window.sfxDestruction) window.sfxDestruction();
      if (window.sfxExplosion) window.sfxExplosion();
    }
    if (c.impacted && now - c.impactAt > 900 && c.pieces.every((p) => p.landed)) planeCrashes.delete(id);
  }
}

// Sombra en el suelo que se le acerca al avión mientras baja
function dibujarSombraCaidaAvion(st) {
  ctx.save();
  ctx.translate(st.gx, st.gy);
  ctx.rotate(st.angle);
  ctx.globalAlpha = 0.22 + 0.2 * st.t;
  ctx.fillStyle = "#0a0a08";
  ctx.beginPath();
  ctx.ellipse(0, 0, 92, 14, 0, 0, Math.PI * 2);
  ctx.ellipse(6, 0, 20, 118, 0, 0, Math.PI * 2);
  ctx.ellipse(-78, 0, 12, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Humo denso y fuego que va dejando atrás (debajo del avión)
function dibujarEstelaCaidaAvion(c, now) {
  ctx.save();
  for (const p of c.trail) {
    const a = now - p.at;
    const u = a / 2300;
    const fuego = a < 420;
    ctx.globalAlpha = Math.max(0, (fuego ? 0.85 : 0.6) * (1 - u));
    ctx.fillStyle = fuego ? (a < 200 ? "#ffd34a" : "#ff7a1f") : (u < 0.5 ? "#2a2a27" : "#4a4a45");
    ctx.beginPath();
    ctx.arc(p.x + Math.sin(p.at / 97) * 4, p.y - a * 0.02, p.r * (0.7 + u * 2.2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Llamas sobre motores y fuselaje (encima del avión) + piezas que caen
function dibujarLlamasCaidaAvion(c, fx, fy, angle, now) {
  const ca = Math.cos(angle), sa = Math.sin(angle), k = 2.2;
  const loc = (lx, ly) => ({ x: fx + (lx * ca - ly * sa) * k, y: fy + (lx * sa + ly * ca) * k });
  const focos = [[3, -30, 1], [3, -16, 0.8], [3, 16, 1], [3, 30, 0.7], [-10, 0, 1.3], [20, -10, 0.8], [-30, 0, 1.1]];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < focos.length; i++) {
    const [lx, ly, sz] = focos[i];
    const p = loc(lx, ly);
    for (let j = 0; j < 3; j++) {
      const u = ((now / 260) + j / 3 + i * 0.17) % 1;
      const r = (7 + 10 * (1 - u)) * sz;
      const bx = p.x - ca * u * 34 + Math.sin(now / 50 + i + j) * 2.5;
      const by = p.y - sa * u * 34 - u * 22;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      g.addColorStop(0, `rgba(255, 245, 190, ${0.9 * (1 - u)})`);
      g.addColorStop(0.45, `rgba(255, 140, 30, ${0.7 * (1 - u)})`);
      g.addColorStop(1, "rgba(200, 30, 10, 0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();

  // Piezas desprendidas, cayendo en llamas
  for (const pc of c.pieces) {
    if (pc.landed) continue;
    const u = (now - pc.at) / 1000;
    ctx.save();
    for (let j = 0; j < 6; j++) {
      const back = j * 0.035;
      ctx.globalAlpha = 0.6 * (1 - j / 6);
      ctx.fillStyle = j < 2 ? "#ff9a2a" : "#2b2b28";
      ctx.beginPath();
      ctx.arc(pc.x + pc.vx * (u - back), pc.y + pc.vy * (u - back) + 0.5 * 420 * (u - back) * (u - back), 6 - j * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.translate(pc.cx, pc.cy);
    ctx.rotate(pc.rot + pc.spin * u);
    ctx.lineJoin = "round";
    ctx.fillStyle = "#3a423c"; ctx.strokeStyle = "#0b0e0c"; ctx.lineWidth = 2;
    if (pc.kind === "motor") {
      roundRect(-14, -7, 28, 14, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#1a1d1a"; ctx.beginPath(); ctx.arc(14, 0, 6, 0, Math.PI * 2); ctx.fill();
    } else if (pc.kind === "ala") {
      ctx.beginPath(); ctx.moveTo(-26, -8); ctx.lineTo(26, -14); ctx.lineTo(30, 6); ctx.lineTo(-22, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#c8322a"; ctx.beginPath(); ctx.arc(8, 0, 5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(-24, -6); ctx.lineTo(24, -3); ctx.lineTo(24, 3); ctx.lineTo(-24, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#c8322a"; ctx.fillRect(10, -3, 8, 6);
    }
    const fl = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
    fl.addColorStop(0, "rgba(255, 220, 120, 0.85)"); fl.addColorStop(1, "rgba(255, 90, 20, 0)");
    ctx.fillStyle = fl; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function syncHits() {
  if (!latestState || !latestState.hits) return;
  const now = performance.now();
  for (const hit of latestState.hits) {
    const key = `${hit.at}-${hit.id}`;
    if (renderedHitIds.has(key)) continue;
    renderedHitIds.add(key);

    // NUEVO: Que suene el disparo cuando tus soldados aliados aciertan al enemigo
    if (hit.weapon === "aliado") {
      if (window.sfxGunshot) window.sfxGunshot();
    }

    enemyHitUntil.set(hit.id, { until: now + ENEMY_HIT_FLASH_MS, killed: hit.killed });

    const isVehicle = !!(hit.type && (hit.type.startsWith("tanqueta") || hit.type === "tren_blindado" || hit.type === "jefe_canon" || hit.type === "jefe_avion"));
    // Bala rebotada por el blindaje frontal del cañón: lluvia de chispas.
    const particleCount = hit.deflected ? 12 : isVehicle ? 5 : 7;
    for (let i = 0; i < particleCount; i++) {
      impactSparks.push({
        x: hit.x, y: hit.y - 16,
        vx: (Math.random() - 0.5) * (isVehicle ? 1.6 : 2.4),
        vy: -0.8 - Math.random() * 1.4,
        startedAt: now,
        color: isVehicle ? "spark" : "blood",
      });
    }

    if (hit.killed) {
      if (hit.type === "jefe_avion") {
        iniciarCaidaAvion(hit, now); // no explota en el aire: cae en llamas y se estrella
      } else if (isVehicle) {
        // Explosión mecánica propia de los tanques — nunca la misma
        // animación que morteros, granadas o bombas. Precomputamos acá la
        // chatarra y la torreta que sale volando, para que su trayectoria
        // sea la misma en todos los frames (no aleatoria por frame).
        if (window.sfxDestruction) window.sfxDestruction();
        const isTank = hit.type.startsWith("tanqueta");
        const sizeMul = (hit.type === "jefe_avion" ? 2.6 : hit.type === "jefe_canon" ? 2.4 : hit.type === "tren_blindado" ? 2.2 : hit.type === "tanqueta_pesada" ? 1.5 : hit.type === "tanqueta_asalto" ? 0.78 : 1) * (isTank ? TANK_SCALE : 1);

        const debris = [];
        for (let i = 0; i < 10; i++) {
          debris.push({
            angle: Math.random() * Math.PI * 2,
            speed: 60 + Math.random() * 70,
            size: (3 + Math.random() * 3.5) * sizeMul,
            rot: (Math.random() - 0.5) * 10,
            drop: 0.55 + Math.random() * 0.3,
          });
        }
        const turretTier = TANK_TIERS[hit.type] || TANK_TIERS.tanqueta;

        vehicleExplosionAnims.push({
          x: hit.x, y: hit.y, startedAt: now, size: sizeMul, debris,
          type: hit.type,
          wreckAngle: (Math.random() - 0.5) * 0.7,
          turret: {
            // En tanques, la torreta caída mide lo mismo que la real (ya escalada).
            r: isTank ? (turretTier.turretR * TANK_SCALE) / sizeMul : turretTier.turretR,
            barrelLen: isTank ? (turretTier.barrelLen * TANK_SCALE) / sizeMul : turretTier.barrelLen,
            vx: (Math.random() - 0.5) * 1.6,
            vy: -2.6 - Math.random() * 1.2,
            spin: (Math.random() - 0.5) * 0.5,
            rot0: Math.random() * Math.PI * 2,
          },
        });
        spawnLingeringSmoke(hit.x, hit.y, now);
        scorchMarks.push({ x: hit.x, y: hit.y, at: now });
        if (scorchMarks.length > 14) scorchMarks.shift();
        const bossDeath = hit.type === "tren_blindado" || hit.type === "jefe_canon" || hit.type === "jefe_avion";
        shakeUntil = Math.max(shakeUntil, now + (bossDeath ? 900 : hit.type === "tanqueta_pesada" ? 380 : 260));
        shakeMag = Math.max(shakeMag, bossDeath ? 10 : hit.type === "tanqueta_pesada" ? 6 : 4.5);
      } else if (hit.type === "torreta") {
        if (window.sfxDestruction) window.sfxDestruction();
        explosionAnims.push({ x: hit.x, y: hit.y, startedAt: now });
        scorchMarks.push({ x: hit.x, y: hit.y, at: now });
        if (scorchMarks.length > 14) scorchMarks.shift();
        shakeUntil = Math.max(shakeUntil, now + 300);
        shakeMag = Math.max(shakeMag, 5);
      } else {
        // Excluimos a las torretas, para que solo griten soldados y morteros
        if (hit.type !== "torreta") {
          if (window.sfxDeath) window.sfxDeath();
        }

        if (hit.weapon === "fuego") {
          charredUnits.push({ x: hit.x, y: hit.y, startedAt: now });
        } else {
          fallingUnits.push({ x: hit.x, y: hit.y, startedAt: now });
        }
      }
    }
  }
  if (renderedHitIds.size > 200) {
    renderedHitIds = new Set(Array.from(renderedHitIds).slice(-100));
  }
}

// Impactos del obús del tanque pesado: el servidor los manda en
// latestState.shellImpacts solo cuando ese calibre acierta — acá solo
// disparamos la animación local, una vez por evento.
function syncShellImpacts() {
  if (!latestState || !latestState.shellImpacts) return;
  const now = performance.now();
  for (const s of latestState.shellImpacts) {
    const key = `${s.at}-${s.x}-${s.y}`;
    if (renderedShellImpactIds.has(key)) continue;
    renderedShellImpactIds.add(key);
    shellImpactAnims.push({ x: s.x, y: s.y, startedAt: now });
  }
  if (renderedShellImpactIds.size > 100) {
    renderedShellImpactIds = new Set(Array.from(renderedShellImpactIds).slice(-50));
  }
}

// Barra de resistencia azul neón, dibujada directo en el canvas (no depende del
// HTML/CSS). Predice la recarga (100 en 15 s) entre lecturas del servidor, así se
// ve llenarse en tiempo real, y se puede correr con la barra incompleta.
let staminaTarget = 100, staminaShown = 100, staminaFetchAt = 0, staminaAgotada = false;
function renderStaminaBar(now) {
  // Se oculta la barra vieja del HTML (la que se veía estática) para no duplicar.
  if (barStamina && !barStamina._oculta) {
    barStamina._oculta = true;
    const pad = barStamina.parentElement;
    const objetivo = pad && pad !== document.body && pad.children.length === 1 ? pad : barStamina;
    objetivo.style.setProperty("display", "none", "important");
  }
  const pausado = !latestState || latestState.paused;
  const corriendo = shiftHeld && keysDown.size > 0 && !staminaAgotada && staminaTarget > 0;
  let pred = staminaTarget;
  if (!pausado && !corriendo) pred = Math.min(100, staminaTarget + ((now - staminaFetchAt) * 100) / 15000);
  staminaShown += (pred - staminaShown) * 0.4;
  if (Math.abs(pred - staminaShown) < 0.05) staminaShown = pred;
}

function drawStaminaBar() {
  if (!latestState || !latestState.navajas) return;
  const now = performance.now();
  const s = Math.max(0, Math.min(100, staminaShown));
  const w = 260, h = 14;
  const x = (VIEWPORT_W - w) / 2, y = VIEWPORT_H - 34;
  const pulso = 0.5 + 0.5 * Math.sin(now / 120);
  const recargando = s < 99.5;

  ctx.save();
  ctx.textAlign = "left";
  ctx.font = "bold 11px 'Special Elite', 'Courier New', monospace";
  ctx.fillStyle = "#000"; ctx.fillText("RESISTENCIA", x + 1, y - 5 + 1);
  ctx.fillStyle = staminaAgotada ? `rgba(120, 220, 255, ${0.5 + 0.5 * pulso})` : "#7ff3ff";
  ctx.fillText("RESISTENCIA", x, y - 5);
  ctx.textAlign = "right";
  ctx.fillStyle = "#000"; ctx.fillText(Math.round(s) + "%", x + w + 1, y - 5 + 1);
  ctx.fillStyle = "#7ff3ff"; ctx.fillText(Math.round(s) + "%", x + w, y - 5);

  roundRect(x - 3, y - 3, w + 6, h + 6, 6);
  ctx.fillStyle = "rgba(2, 10, 22, 0.88)"; ctx.fill();
  ctx.strokeStyle = "rgba(0, 240, 255, 0.85)"; ctx.lineWidth = 2; ctx.stroke();

  if (s > 0.4) {
    const fw = Math.max(6, (w * s) / 100);
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = recargando ? 10 + 12 * pulso : 12;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#d6feff"); g.addColorStop(0.45, "#00f0ff"); g.addColorStop(1, "#0088ff");
    ctx.globalAlpha = staminaAgotada ? 0.55 + 0.45 * pulso : 1;
    ctx.fillStyle = g;
    roundRect(x, y, fw, h, 4); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    roundRect(x + 2, y + 2, Math.max(0, fw - 4), 3, 2); ctx.fill();
  }
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  for (let i = 1; i < 10; i++) ctx.fillRect(x + (w * i) / 10 - 0.5, y, 1, h);
  ctx.restore();
}

function updateHud() {
  if (!latestState) return;
  const p = latestState.navajas;
  const pct = Math.max(0, p.health);

  barHealth.style.width = `${pct}%`;
  const hue = Math.round((pct / 100) * 120);
  barHealth.style.background = `hsl(${hue}, 70%, 45%)`;

  ammoCount.textContent = "∞";
  if (livesDisplay) {
    const lives = latestState.lives ?? 3;
    livesDisplay.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const icon = document.createElement("span");
      icon.textContent = "🪖";
      icon.style.opacity = i < lives ? "1" : "0.22";
      icon.style.filter = i < lives ? "none" : "grayscale(1)";
      icon.style.marginRight = "2px";
      livesDisplay.appendChild(icon);
    }
  }
  staminaTarget = Math.max(0, Math.min(100, p.stamina ?? 100));
  staminaFetchAt = performance.now();
  staminaAgotada = !!p.exhausted;
  cavadoresCount.textContent = latestState.cavadores.filter((c) => c.alive).length;
  const enemiesLeft = latestState.enemies.filter((e) => e.alive).length + (latestState.enemiesReserve || 0);
  enemiesCount.textContent = enemiesLeft;
  scoreCount.textContent = "NIVEL " + (latestState.currentLevelIndex + 1) + " | " + (latestState.score ?? 0);
  if (grenadeCount) grenadeCount.textContent = p.grenades ?? 0;

  const muerto = pct <= 0;
  const victoria = latestState.gameOver === "victoria";
  if (victoria || muerto || latestState.gameOver) {
    gameState = "GAMEOVER";
    keysDown.clear();
    overlay.classList.toggle("victory", victoria);
    overlayText.textContent = victoria ? "¡VICTORIA!" : "MISIÓN FALLIDA";
    overlaySubtext.textContent = victoria ? "El pozo resiste." : "Navajas cae. Derrota.";
    finalScoreValue.textContent = String(latestState.score ?? 0).padStart(6, "0");
    if (victoria) {
      openPeaceScreen(); // el parte de guerra aparece al pulsar Continuar
    } else {
      overlay.classList.remove("hidden");
    }
    if (!gameOverSoundPlayed) {
      gameOverSoundPlayed = true;
      if (victoria && window.sfxVictory) window.sfxVictory();
      else if (!victoria && window.sfxDefeat) window.sfxDefeat();
    }
  } else {
    overlay.classList.add("hidden");
    removeEndingNarrative();
  }

  setPauseMenu(!!latestState.paused && gameState === "PLAYING");
}

// Párrafo de cierre que aparece debajo del cartel de victoria — se crea
// una sola vez y se limpia si se reinicia la partida.
let endingParagraph = null;
function showEndingNarrative() {
  if (endingParagraph || !window.NARRATIVE_ENDING) return;
  endingParagraph = document.createElement("p");
  endingParagraph.textContent = window.NARRATIVE_ENDING;
  endingParagraph.style.cssText = [
    "max-width:520px", "margin:14px auto 0", "font-family:Georgia, 'Times New Roman', serif",
    "font-size:15px", "line-height:1.5", "color:#d8c9a3", "text-align:center", "padding:0 12px",
  ].join(";");
  overlay.appendChild(endingParagraph);
}
function removeEndingNarrative() {
  if (endingParagraph) {
    endingParagraph.remove();
    endingParagraph = null;
  }
}

function getCamera() {
  if (!latestState) return { x: 0, y: 0 };
  const p = renderPos.get("navajas") || latestState.navajas;
  let camX = p.x - VIEWPORT_W / 2;
  let camY = p.y - VIEWPORT_H / 2;
  camX = Math.max(0, Math.min(camX, WORLD_W - VIEWPORT_W));
  camY = Math.max(0, Math.min(camY, WORLD_H - VIEWPORT_H));

  const now = performance.now();
  if (now < shakeUntil) {
    const k = (shakeUntil - now) / 300;
    camX += (Math.random() - 0.5) * shakeMag * k * 2;
    camY += (Math.random() - 0.5) * shakeMag * k * 2;
  } else {
    shakeMag = 0;
  }
  return { x: camX, y: camY };
}

// ---------------------------------------------------------------------------
// CAVADORES ALREDEDOR DEL POZO
// ---------------------------------------------------------------------------
const CAVADORES_EN_ANILLO = true;
let POZO_X = WORLD_W / 2;
let POZO_Y = WORLD_H / 2;
const RADIO_ANILLO = 62;

function posicionCavador(cav, index, total) {
  if (!CAVADORES_EN_ANILLO) return { x: cav.x, y: cav.y, angle: Math.atan2(POZO_Y - cav.y, POZO_X - cav.x) };
  const angle = (index / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;
  return {
    x: POZO_X + Math.cos(angle) * RADIO_ANILLO,
    y: POZO_Y + Math.sin(angle) * RADIO_ANILLO * 0.62,
    angle: angle + Math.PI,
  };
}

// ---------------------------------------------------------------------------
// HISTORIA DEL LUGAR (puntos fijos + fragmentos ambientales sueltos)
// ---------------------------------------------------------------------------
let narrativeBox = null;
let activeNarrative = null;
let narrativeShownAt = 0;
const NARRATIVE_HOLD_MS = 2500;

let nextAmbientAt = performance.now() + 25000 + Math.random() * 20000;
let ambientActive = false;

function ensureNarrativeBox() {
  if (narrativeBox) return narrativeBox;
  const box = document.createElement("div");
  box.style.cssText = [
    "position:absolute", "left:50%", "bottom:8%", "transform:translateX(-50%)",
    "max-width:min(300px, 80%)", "background:rgba(20,15,9,0.72)",
    "border:1px solid rgba(196,168,110,0.45)", "border-radius:999px",
    "padding:5px 16px", "color:#ecdfc2", "font-family:'Special Elite', 'Courier New', monospace",
    "font-size:12px", "letter-spacing:0.12em", "text-transform:uppercase", "line-height:1.3",
    "white-space:nowrap", "pointer-events:none",
    "opacity:0", "transition:opacity 0.4s ease", "z-index:20", "text-align:center",
  ].join(";");
  const title = document.createElement("div");
  title.style.cssText = "color:#d8b467;";
  const body = document.createElement("div");
  box.appendChild(title);
  box.appendChild(body);
  (canvas.parentElement || document.body).style.position =
    (canvas.parentElement || document.body).style.position || "relative";
  (canvas.parentElement || document.body).appendChild(box);
  narrativeBox = { el: box, title, body };
  return narrativeBox;
}

function updateNarrative() {
  if (!latestState) return;
  if (!latestState.hasNarrative) {
    if (narrativeBox) narrativeBox.el.style.opacity = "0";
    activeNarrative = null;
    ambientActive = false;
    return;
  }
  const now = performance.now();
  const box = ensureNarrativeBox();
  const points = window.NARRATIVE_POINTS;
  const p = latestState.navajas;

  let nearest = null;
  let nearestDist = Infinity;
  if (Array.isArray(points)) {
    for (const pt of points) {
      const d = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (d <= pt.radius && d < nearestDist) { nearest = pt; nearestDist = d; }
    }
  }

  if (nearest) {
    ambientActive = false;
    if (activeNarrative?.id !== nearest.id) {
      activeNarrative = nearest;
      narrativeShownAt = now;
      box.title.textContent = nearest.title || "";
      box.body.textContent = nearest.text || "";
      box.el.style.opacity = "1";
    } else {
      narrativeShownAt = now;
    }
    return;
  }

  if (activeNarrative && !ambientActive) {
    if (now - narrativeShownAt > NARRATIVE_HOLD_MS) {
      box.el.style.opacity = "0";
      activeNarrative = null;
    }
    return;
  }

  // Sin nada de ubicación cerca: de vez en cuando (y solo de vez en
  // cuando) soltamos un pensamiento suelto, para no recargar la pantalla.
  const fragments = window.AMBIENT_FRAGMENTS;
  if (!ambientActive && Array.isArray(fragments) && fragments.length && now > nextAmbientAt) {
    ambientActive = true;
    activeNarrative = { id: "__ambient__" };
    narrativeShownAt = now;
    const line = fragments[Math.floor(Math.random() * fragments.length)];
    box.title.textContent = "";
    box.body.textContent = line;
    box.el.style.opacity = "1";
    nextAmbientAt = now + 45000 + Math.random() * 45000;
  } else if (ambientActive && now - narrativeShownAt > 2600) {
    box.el.style.opacity = "0";
    activeNarrative = null;
    ambientActive = false;
  }
}

function radarBlip(rctx, cx, cy, r, color) {
  const glow = rctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
  glow.addColorStop(0, color + "cc");
  glow.addColorStop(1, color + "00");
  rctx.fillStyle = glow;
  rctx.beginPath(); rctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2); rctx.fill();
  rctx.fillStyle = color;
  rctx.beginPath(); rctx.arc(cx, cy, r, 0, Math.PI * 2); rctx.fill();
  rctx.strokeStyle = "rgba(0,0,0,0.6)";
  rctx.lineWidth = 0.8;
  rctx.stroke();
}

function drawRadar() {
  if (!radarCtx || !latestState) return;
  const w = radarCanvas.width, h = radarCanvas.height;
  radarCtx.clearRect(0, 0, w, h);

  const mw = latestState.mapWidth || WORLD_W;
  const mh = latestState.mapHeight || WORLD_H;
  const pad = 12;
  const scale = Math.min((w - pad * 2) / mw, (h - pad * 2) / mh);
  const mapW = mw * scale, mapH = mh * scale;
  const ox = (w - mapW) / 2;
  const oy = (h - mapH) / 2;
  const toX = (x) => ox + x * scale;
  const toY = (y) => oy + y * scale;
  const now = performance.now();

  // Fondo tipo visor: degradé radial verde oscuro + viñeta.
  const bgGrad = radarCtx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
  bgGrad.addColorStop(0, "#0f1a10");
  bgGrad.addColorStop(1, "#050905");
  radarCtx.fillStyle = bgGrad;
  radarCtx.fillRect(0, 0, w, h);

  // Grid concéntrico + cruz central, estilo osciloscopio de radar militar.
  radarCtx.save();
  radarCtx.strokeStyle = "rgba(90, 160, 100, 0.22)";
  radarCtx.lineWidth = 1;
  const cx = w / 2, cy = h / 2;
  const maxR = Math.hypot(w / 2, h / 2);
  for (let r = maxR / 4; r < maxR; r += maxR / 4) {
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, r, 0, Math.PI * 2);
    radarCtx.stroke();
  }
  radarCtx.beginPath();
  radarCtx.moveTo(0, cy); radarCtx.lineTo(w, cy);
  radarCtx.moveTo(cx, 0); radarCtx.lineTo(cx, h);
  radarCtx.stroke();
  radarCtx.restore();

  // Barrido giratorio (sweep) — cono translúcido que da vueltas.
  const sweepAngle = (now / 1800) % (Math.PI * 2);
  const sweepGrad = radarCtx.createConicGradient
    ? radarCtx.createConicGradient(sweepAngle, cx, cy)
    : null;
  radarCtx.save();
  if (sweepGrad) {
    sweepGrad.addColorStop(0, "rgba(120, 230, 140, 0.28)");
    sweepGrad.addColorStop(0.06, "rgba(120, 230, 140, 0)");
    sweepGrad.addColorStop(1, "rgba(120, 230, 140, 0)");
    radarCtx.fillStyle = sweepGrad;
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, maxR, 0, Math.PI * 2);
    radarCtx.fill();
  }
  radarCtx.restore();

  // Marco del terreno del nivel.
  radarCtx.strokeStyle = "rgba(140, 200, 150, 0.55)";
  radarCtx.lineWidth = 1.2;
  radarCtx.strokeRect(ox, oy, mapW, mapH);

  if (latestState.pozo) {
    radarBlip(radarCtx, toX(latestState.pozo.x), toY(latestState.pozo.y), 3.4, "#e0b43a");
  }

  for (const en of latestState.enemies) {
    if (!en.alive) continue;
    const isVehicle = en.type && (en.type.startsWith("tanqueta") || en.type === "tren_blindado");
    const esJefeNuevo = en.type === "jefe_canon" || en.type === "jefe_avion";
    const color = esJefeNuevo ? "#ff2a2a" : isVehicle ? "#ff5a3a" : en.type === "torreta" ? "#ff9a3a" : en.type === "mortero" ? "#ffe45c" : "#ff4444";
    radarBlip(radarCtx, toX(en.x), toY(en.y), esJefeNuevo ? 4.4 : isVehicle ? 3.2 : 2.2, color);
  }

  if (Array.isArray(latestState.allies)) {
    for (const a of latestState.allies) {
      radarBlip(radarCtx, toX(a.x), toY(a.y), 2.2, "#7fd66a");
    }
  }

  // Jugador: blip blanco con anillo pulsante propio (para distinguirlo de
  // cualquier otro punto de un vistazo).
  const px = toX(latestState.navajas.x), py = toY(latestState.navajas.y);
  const pulse = 0.5 + 0.5 * Math.sin(now / 260);
  radarCtx.strokeStyle = `rgba(255,255,255,${0.3 + pulse * 0.4})`;
  radarCtx.lineWidth = 1.4;
  radarCtx.beginPath();
  radarCtx.arc(px, py, 5 + pulse * 2.5, 0, Math.PI * 2);
  radarCtx.stroke();
  radarBlip(radarCtx, px, py, 3, "#ffffff");

  // Rectángulo de cámara (lo que ves en pantalla ahora mismo).
  const cam = getCamera();
  radarCtx.strokeStyle = "rgba(255,255,255,0.4)";
  radarCtx.lineWidth = 1;
  radarCtx.setLineDash([3, 2]);
  radarCtx.strokeRect(toX(cam.x), toY(cam.y), VIEWPORT_W * scale, VIEWPORT_H * scale);
  radarCtx.setLineDash([]);

  // Nivel actual, esquina inferior — reemplaza el texto genérico "Radar"
  // del label fijo por algo que de verdad varía con el juego.
  radarCtx.fillStyle = "rgba(127, 214, 106, 0.85)";
  radarCtx.font = "8px 'Special Elite', 'Courier New', monospace";
  radarCtx.textAlign = "right";
  radarCtx.fillText(`NIVEL ${(latestState.currentLevelIndex ?? 0) + 1}`, w - 6, h - 5);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderStaminaBar(performance.now());
  updateNarrative();

  const cam = getCamera();
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  const t = performance.now() / 1000;
  drawTerrain(ctx, WORLD_W, WORLD_H, t, latestState ? latestState.currentLevelIndex : 0);
  drawPath(ctx, WORLD_W, WORLD_H);
  if (latestState && latestState.bossRailY != null) drawBossRails(latestState.bossRailY);
  drawScorchMarks();
  drawVehicleExplosions("ground"); // restos de tanques: en el suelo, POR DEBAJO de árboles y obstáculos
  drawLandedChutes();
  if (latestState && latestState.hasNarrative && typeof drawNarrativeMarkers === "function") drawNarrativeMarkers(ctx);
  drawObstacles(ctx, latestState ? latestState.obstacles : []);
  drawTrees(ctx, latestState ? latestState.trees : [], t);

  if (latestState) {
    if (latestState.pozo) {
      drawPozo(ctx, POZO_X, POZO_Y);
      drawTierraExcavada();
    }

    const vivos = latestState.cavadores.filter((c) => c.alive);
    vivos.forEach((cav, i) => {
      const pos = posicionCavador(cav, i, vivos.length);
      drawCavadorCavando(cav.id, pos.x, pos.y, pos.angle);
    });

    drawPrisoners();

    const actores = [];
    for (const en of latestState.enemies) {
      if (!en.alive) continue;
      const p = smooth(en.id, en.x, en.y);
      // La sombra del bombardero va debajo de todos los actores; su casco se dibuja en la capa aérea.
      const paraEnAire = en.para && paraAltNow(en) > 0;
      actores.push({ y: (en.type === "jefe_avion" || paraEnAire) ? -1e6 : p.y, draw: () => drawEnemyUnit(en, p.x, p.y) });
    }
    if (Array.isArray(latestState.allies)) {
      for (const ally of latestState.allies) {
        const ap = smooth(ally.id, ally.x, ally.y);
        actores.push({ y: ap.y, draw: () => drawAllySoldier(ally.id, ap.x, ap.y, ally.dir, ally.lastShotAt) });
      }
    }
    const np = smooth("navajas", latestState.navajas.x, latestState.navajas.y);
    actores.push({ y: np.y, draw: () => drawSoldadoBoliviano("navajas", np.x, np.y, latestState.navajas.dir) });
    actores.sort((a, b) => a.y - b.y).forEach((a) => a.draw());

    drawParatroopers();
    drawFallingUnits();
    drawCharredUnits();
    drawMeleeSlashes();
    drawBullets();
    drawBlood();
    drawImpactSparks();
    drawGrenadeThrows();
    drawEnemyMortarThrows();
    drawPlanes();
    drawJefeAvionAereo();
    drawPlaneBombThrows();
    drawExplosions();
    drawVehicleExplosions("fx");
    drawShellImpacts();
    drawLingeringSmokes();
  }

  ctx.restore();

  drawVignette();
  drawDamageOverlay();
  drawRadar();
  drawBossHud();
  drawBossHudJefes();
  drawAvionDerribadoBanner();
  drawStaminaBar();

  if (latestState && latestState.isTransitioning) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
    ctx.fillStyle = "#e0b43a";
    ctx.font = "bold 34px Georgia, 'Times New Roman', serif";
    ctx.fillText("ZONA ASEGURADA", VIEWPORT_W / 2, VIEWPORT_H / 2 - 6);
    ctx.fillStyle = "#ecdfc2";
    ctx.font = "16px 'Special Elite', 'Courier New', monospace";
    ctx.fillText("AVANZANDO...", VIEWPORT_W / 2, VIEWPORT_H / 2 + 22);
    ctx.restore();
  }
}
// ---------------------------------------------------------------------------
// JEFE NIVEL 1 — TREN BLINDADO (vista cenital, frente hacia +x, espejado por facing)
// Vagón trasero + vagón de cañón con torreta giratoria + locomotora con
// caldera, chimenea humeante y quitanieves. Bielas animadas según su avance,
// sirena + vapor + señal de peligro al pitar, faro rojo y temblor al embestir.
// ---------------------------------------------------------------------------
const TRAIN_COLORS = {
  steel: "#4a5546", steelDark: "#2a3226", steelLight: "#6b7a64", plate: "#3b4436",
  rivet: "rgba(0,0,0,0.38)", wheel: "#23261f", wheelDark: "#12140f", rod: "#9aa2a8",
  outline: "#0f120d", accent: "#9fd6ff", lamp: "#ffdd55", alarm: "#ff3a2a", brass: "#b39a4a",
};

let bossIntroAt = 0;

function trainRivets(x0, x1, y, C) {
  ctx.fillStyle = C.rivet;
  for (let rx = x0; rx <= x1; rx += 6.5) {
    ctx.beginPath(); ctx.arc(rx, y, 1, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// TREN BLINDADO v2 — más grande (x1.18), cañón doble, ametralladoras laterales,
// caldera con chimenea incandescente, quitanieves con franjas de peligro y
// púas, escotilla de morteros que se abre en la fase 2, aura roja al
// enfurecerse, chispas al embestir y humo/fuego cuando está por caer.
// ---------------------------------------------------------------------------
const bossMortarUntil = new Map();

function trainStar(cx, cy, R, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? R : R * 0.42;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}

function drawEnemyTrain(en, x, y) {
  const id = en.id;
  const now = performance.now();
  const S = 1.18;
  const face = en.facing === -1 ? -1 : 1;
  const aim = typeof en.aimAngle === "number" ? en.aimAngle : (face === 1 ? 0 : Math.PI);
  const la = face === 1 ? aim : Math.PI - aim;
  const untilFiring = enemyFiringUntil.get(id) || 0;
  const firing = untilFiring > now;
  const fireT = firing ? 1 - (untilFiring - now) / 150 : 1;
  const recoil = firing ? Math.max(0, 1 - fireT) * 8 : 0;
  const charging = !!en.charging;
  const enraged = !!en.enraged;
  const warning = !!en.warning;
  const pulse = 0.5 + 0.5 * Math.sin(now / 150);
  const alarmOn = warning && Math.sin(now / 90) > 0;
  const mUntil = bossMortarUntil.get(id) || 0;
  const hatchOpen = mUntil > now;
  const hatchT = hatchOpen ? 1 - (mUntil - now) / 520 : 1;
  const hpPct = Math.max(0, Math.min(1, en.health / (en.maxHealth || 1200)));
  const rod = Math.sin(x / 9) * 3;

  const flash = enemyHitUntil.get(id);
  const ft = flash && now < flash.until ? (flash.until - now) / ENEMY_HIT_FLASH_MS : 0;
  const tint = Math.max(ft, enraged ? 0.12 + 0.08 * pulse : 0);
  const C = tint > 0 ? {
    ...TRAIN_COLORS,
    steel: blendColor(TRAIN_COLORS.steel, 0xdc2626, tint),
    steelDark: blendColor(TRAIN_COLORS.steelDark, 0x7f1d1d, tint),
    steelLight: blendColor(TRAIN_COLORS.steelLight, 0xef4444, tint),
    plate: blendColor(TRAIN_COLORS.plate, 0xdc2626, tint * 0.7),
  } : TRAIN_COLORS;

  // Aura roja de la fase 2
  if (enraged) {
    const ag = ctx.createRadialGradient(x, y, 20, x, y, 150);
    ag.addColorStop(0, `rgba(255, 60, 30, ${0.16 + 0.1 * pulse})`);
    ag.addColorStop(1, "rgba(255, 60, 30, 0)");
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.ellipse(x, y, 150, 76, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Sombra
  ctx.fillStyle = "rgba(20, 16, 10, 0.42)";
  ctx.beginPath(); ctx.ellipse(x + face * 10, y + 34, 124, 16, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  if (charging) ctx.translate(0, Math.sin(now / 24) * 1.1);
  ctx.scale(face * S, S);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Ruedas y bielas
  for (const wx of [-80, -62, -34, -14, 26, 44, 62]) {
    for (const sy of [-1, 1]) {
      celBox(wx - 6, sy > 0 ? 23 : -29, 12, 6.5, 1.8, C.wheel, C.wheelDark, C.outline, 1.5);
      ctx.fillStyle = C.rod;
      ctx.fillRect(wx - 1, sy > 0 ? 25.4 : -26.6, 2, 1.8);
    }
  }
  for (const sy of [-1, 1]) {
    celLine([[26 + rod, sy * 26], [62 + rod, sy * 26]], 2, C.rod, C.outline, 1);
  }

  // Enganches
  celBox(-51, -4, 9, 8, 1.5, C.wheel, C.wheelDark, C.outline, 1.4);
  celBox(9, -4, 9, 8, 1.5, C.wheel, C.wheelDark, C.outline, 1.4);

  // ---- Vagón trasero: escotilla de morteros ----
  celBox(-96, -25, 46, 50, 3.5, C.steel, C.steelDark, C.outline, 2.8);
  ctx.strokeStyle = C.steelDark; ctx.lineWidth = 1.6;
  for (const rx of [-90, -56]) {
    ctx.beginPath(); ctx.moveTo(rx, -22); ctx.lineTo(rx, 22); ctx.stroke();
  }
  trainRivets(-93, -53, -21.5, C);
  trainRivets(-93, -53, 21.5, C);
  celBox(-101, -12, 6, 24, 1.5, C.plate, C.steelDark, C.outline, 1.8);

  const hx = -73;
  celDisc(hx, 0, 12.5, C.plate, C.steelDark, C.outline, 2.2);
  if (hatchOpen) {
    ctx.fillStyle = "#050403";
    ctx.beginPath(); ctx.arc(hx, 0, 9.5, 0, Math.PI * 2); ctx.fill();
    const hg = ctx.createRadialGradient(hx, 0, 0, hx, 0, 11);
    hg.addColorStop(0, `rgba(255, 190, 80, ${0.95 - hatchT * 0.4})`);
    hg.addColorStop(1, "rgba(255, 90, 30, 0)");
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(hx, 0, 11, 0, Math.PI * 2); ctx.fill();
    const lift = hatchT * 30;
    ctx.fillStyle = "#23261f";
    ctx.beginPath(); ctx.ellipse(hx, -lift, 3.4, 5.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#0d0f0b"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = "#ffdd55";
    ctx.beginPath(); ctx.arc(hx, -lift - 4.4, 1.6, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = Math.max(0, 0.5 - hatchT * 0.4);
      ctx.fillStyle = "#cfcabb";
      ctx.beginPath(); ctx.arc(hx + Math.sin(i * 2.1) * 4, -6 - hatchT * 14 - i * 4, 4 + hatchT * 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.strokeStyle = C.outline; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(hx - 12, 0); ctx.lineTo(hx + 12, 0); ctx.stroke();
    ctx.fillStyle = C.steelLight;
    for (const hy of [-4, 4]) { ctx.beginPath(); ctx.arc(hx, hy, 1.5, 0, Math.PI * 2); ctx.fill(); }
    if (enraged) {
      ctx.strokeStyle = `rgba(255, 70, 40, ${0.35 + 0.5 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hx, 0, 10, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // ---- Vagón de cañón ----
  celBox(-46, -26, 56, 52, 3.5, C.steel, C.steelDark, C.outline, 2.8);
  ctx.fillStyle = C.accent;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(-44, -23, 52, 2.2);
  ctx.fillRect(-44, 20.8, 52, 2.2);
  ctx.globalAlpha = 1;
  trainRivets(-43, 7, -18.5, C);
  trainRivets(-43, 7, 18.5, C);

  // Ametralladoras laterales (siguen a Navajas)
  for (const sy of [-1, 1]) {
    ctx.save();
    ctx.translate(-36, sy * 22);
    ctx.rotate(la);
    ctx.fillStyle = "#1c1f1a";
    ctx.fillRect(3, -1.4, 14, 2.8);
    ctx.fillStyle = "#4a545b";
    ctx.fillRect(15, -2, 3, 4);
    celDisc(0, 0, 5.2, C.steel, C.steelDark, C.outline, 1.6);
    ctx.restore();
  }

  // Base de la torreta con anillo remachado
  celDisc(-19, 0, 20, C.plate, C.steelDark, C.outline, 2.4);
  ctx.fillStyle = C.rivet;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(-19 + Math.cos(a) * 17, Math.sin(a) * 17, 1.1, 0, Math.PI * 2); ctx.fill();
  }

  // Torreta con cañón doble
  ctx.save();
  ctx.translate(-19, 0);
  ctx.rotate(la);
  for (const by of [-4.4, 4.4]) {
    ctx.fillStyle = "#1c1f1a";
    ctx.fillRect(8 - recoil, by - 2.2, 38, 4.4);
    ctx.strokeStyle = C.outline; ctx.lineWidth = 1.4;
    ctx.strokeRect(8 - recoil, by - 2.2, 38, 4.4);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(9 - recoil, by - 2, 34, 1);
    ctx.fillStyle = "#12171a";
    ctx.fillRect(42 - recoil, by - 3.4, 7, 6.8);
    ctx.strokeStyle = "#4a545b"; ctx.lineWidth = 0.9;
    for (const gx of [44, 46.5]) {
      ctx.beginPath(); ctx.moveTo(gx - recoil, by - 3.4); ctx.lineTo(gx - recoil, by + 3.4); ctx.stroke();
    }
  }
  celBox(5 - recoil * 0.4, -10, 12, 20, 2.4, C.plate, C.steelDark, C.outline, 1.8);
  celDisc(0, 0, 14.5, C.steel, C.steelDark, C.outline, 2.4);
  celDisc(-4, -4, 4.4, C.steelDark, C.wheelDark, C.outline, 1.6);
  ctx.fillStyle = enraged ? "#ff5a3a" : C.accent;
  ctx.fillRect(6, -1.4, 5, 2.8);
  ctx.restore();

  // ---- Cabina ----
  celBox(12, -23, 24, 46, 3, C.steel, C.steelDark, C.outline, 2.8);
  ctx.fillStyle = C.wheelDark;
  ctx.fillRect(30, -16, 4, 8);
  ctx.fillRect(30, 8, 4, 8);
  trainRivets(15, 29, -20.5, C);
  trainRivets(15, 29, 20.5, C);
  celDisc(22, 0, 8, "#8a1f18", "#4a0f0b", C.outline, 1.8);
  trainStar(22, 0, 5, "#ecdfc2");
  for (const sy of [-1, 1]) {
    const on = alarmOn || (enraged && pulse > 0.5);
    if (on) {
      ctx.fillStyle = "rgba(255, 60, 40, 0.35)";
      ctx.beginPath(); ctx.arc(16, sy * 18, 9, 0, Math.PI * 2); ctx.fill();
    }
    celDisc(16, sy * 18, 3.2, on ? C.alarm : "#5a1d18", "#2a0c0a", C.outline, 1.3);
  }

  // ---- Caldera ----
  celBox(36, -17, 46, 34, 12, C.steel, C.steelDark, C.outline, 2.8);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  roundRect(39, -13, 40, 4, 2); ctx.fill();
  ctx.strokeStyle = C.steelDark; ctx.lineWidth = 2;
  for (const bx of [46, 58, 72]) {
    ctx.beginPath(); ctx.moveTo(bx, -16); ctx.lineTo(bx, 16); ctx.stroke();
  }
  for (const sy of [-1, 1]) celLine([[40, sy * 13], [78, sy * 13]], 2.2, C.rod, C.outline, 1);
  celDisc(49, 0, 6.2, C.brass, "#6e5b25", C.outline, 1.8);
  celDisc(66, 0, 9.2, "#3a3f36", "#12140f", C.outline, 2.2);
  if (enraged || charging) {
    const cg = ctx.createRadialGradient(66, 0, 0, 66, 0, 6);
    cg.addColorStop(0, "rgba(255, 190, 80, 0.98)");
    cg.addColorStop(1, "rgba(200, 50, 20, 0.7)");
    ctx.fillStyle = cg;
  } else {
    ctx.fillStyle = "#050505";
  }
  ctx.beginPath(); ctx.arc(66, 0, 5.6, 0, Math.PI * 2); ctx.fill();

  // Grietas cuando está muy dañado
  if (hpPct < 0.5) {
    ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(40, -12); ctx.lineTo(45, -6); ctx.lineTo(42, 0); ctx.lineTo(48, 7);
    ctx.moveTo(-40, 8); ctx.lineTo(-33, 12); ctx.lineTo(-36, 18);
    ctx.stroke();
  }

  // ---- Quitanieves blindado con franjas y púas ----
  const plow = () => {
    ctx.beginPath();
    ctx.moveTo(82, -19); ctx.lineTo(108, -7); ctx.lineTo(108, 7); ctx.lineTo(82, 19);
    ctx.closePath();
  };
  plow();
  ctx.fillStyle = "#1a1a16"; ctx.fill();
  ctx.save();
  plow(); ctx.clip();
  ctx.strokeStyle = "#e0b43a"; ctx.lineWidth = 5;
  for (let i = -2; i < 8; i++) {
    ctx.beginPath(); ctx.moveTo(78 + i * 8, -22); ctx.lineTo(90 + i * 8, 22); ctx.stroke();
  }
  ctx.restore();
  plow();
  ctx.strokeStyle = C.outline; ctx.lineWidth = 2.6; ctx.stroke();
  // púas
  for (const [sx, sy2, len, hw] of [[108, 0, 13, 4], [104, -11, 9, 3], [104, 11, 9, 3]]) {
    ctx.beginPath();
    ctx.moveTo(sx, sy2 - hw); ctx.lineTo(sx + len, sy2); ctx.lineTo(sx, sy2 + hw);
    ctx.closePath();
    ctx.fillStyle = "#c9ced2"; ctx.fill();
    ctx.strokeStyle = C.outline; ctx.lineWidth = 1.6; ctx.stroke();
  }
  celDisc(96, 0, 3.6, charging ? C.alarm : C.lamp, charging ? "#a01810" : "#c99a20", C.outline, 1.4);

  ctx.restore();

  // ---- Efectos en coordenadas de mundo ----
  const lampX = x + face * 96 * S;
  const glowR = charging ? 52 : 30;
  const gl = ctx.createRadialGradient(lampX, y, 0, lampX, y, glowR);
  gl.addColorStop(0, charging ? "rgba(255, 80, 40, 0.6)" : "rgba(255, 225, 120, 0.42)");
  gl.addColorStop(1, "rgba(255, 200, 80, 0)");
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.arc(lampX, y, glowR, 0, Math.PI * 2); ctx.fill();

  drawSmokeColumn(x + face * 66 * S, y - 4, now / 1000, charging || enraged ? 1 : 0.6, 0.7);

  // Chispas de las ruedas al embestir
  if (charging) {
    for (let i = 0; i < 9; i++) {
      const tt = ((now / 150) + i / 9) % 1;
      const side = i % 2 ? 1 : -1;
      ctx.globalAlpha = 1 - tt;
      ctx.fillStyle = i % 3 ? "#ffd83a" : "#fff3c2";
      ctx.beginPath();
      ctx.arc(x - face * (14 + i * 15) - face * tt * 24, y + side * (31 - tt * 4), 1.8 - tt, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Humo y fuego cuando está por caer
  if (hpPct < 0.3) {
    drawSmokeColumn(x - face * 40, y, now / 1000 + 3, 0.9, 0.7);
    drawFlameLicks(x - face * 50, y - 6, now / 1000, 0.85, 0.85, 2);
  }

  // Fogonazo doble del cañón
  if (firing) {
    const tcx = x - face * 19 * S;
    const tipD = (49 - recoil) * S;
    const alpha = fireT < 0.5 ? 1 : Math.max(0, 1 - (fireT - 0.5) / 0.5);
    const px = -Math.sin(aim), py = Math.cos(aim);
    for (const sgn of [-1, 1]) {
      const fx = tcx + Math.cos(aim) * tipD + px * sgn * 4.4 * S;
      const fy = y + Math.sin(aim) * tipD + py * sgn * 4.4 * S;
      drawMuzzleFlash(fx, fy, Math.cos(aim), Math.sin(aim), alpha, 1.7);
    }
    ctx.fillStyle = `rgba(190, 185, 170, ${0.45 * alpha})`;
    ctx.beginPath();
    ctx.arc(tcx + Math.cos(aim) * (tipD + 14), y + Math.sin(aim) * (tipD + 14) - 6, 9 + (1 - alpha) * 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Aviso de embestida: vapor + señal de peligro
  if (warning) {
    for (let i = 0; i < 6; i++) {
      const tt = ((now / 420) + i / 6) % 1;
      const side = i % 2 ? 1 : -1;
      ctx.globalAlpha = 0.65 * (1 - tt);
      ctx.fillStyle = "#e8ecee";
      ctx.beginPath();
      ctx.arc(x + face * (56 - (i >> 1) * 22) * S, y + side * (30 + tt * 14), 3 + tt * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const sy = y - 66 + Math.sin(now / 110) * 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, sy - 17); ctx.lineTo(x + 17, sy + 13); ctx.lineTo(x - 17, sy + 13);
    ctx.closePath();
    ctx.fillStyle = alarmOn ? "#ffdd55" : "#c8322a";
    ctx.fill();
    ctx.strokeStyle = "#0f120d"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#0f120d";
    ctx.font = "bold 20px Georgia, 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.fillText("!", x, sy + 9);
    ctx.restore();
  }
}

function drawEnemyTrainLegacy(en, x, y) {
  const id = en.id;
  const now = performance.now();
  const face = en.facing === -1 ? -1 : 1;
  const aim = typeof en.aimAngle === "number" ? en.aimAngle : (face === 1 ? 0 : Math.PI);
  const la = face === 1 ? aim : Math.PI - aim;
  const untilFiring = enemyFiringUntil.get(id) || 0;
  const firing = untilFiring > now;
  const fireT = firing ? 1 - (untilFiring - now) / 150 : 1;
  const recoil = firing ? Math.max(0, 1 - fireT) * 7 : 0;
  const charging = !!en.charging;
  const alarmOn = !!en.warning && Math.sin(now / 90) > 0;

  const flash = enemyHitUntil.get(id);
  const ft = flash && now < flash.until ? (flash.until - now) / ENEMY_HIT_FLASH_MS : 0;
  const C = ft > 0 ? {
    ...TRAIN_COLORS,
    steel: blendColor(TRAIN_COLORS.steel, 0xdc2626, ft),
    steelDark: blendColor(TRAIN_COLORS.steelDark, 0x7f1d1d, ft),
    steelLight: blendColor(TRAIN_COLORS.steelLight, 0xef4444, ft),
    plate: blendColor(TRAIN_COLORS.plate, 0xdc2626, ft * 0.7),
  } : TRAIN_COLORS;

  const rod = Math.sin(x / 9) * 3;

  // Sombra
  ctx.fillStyle = "rgba(20, 16, 10, 0.4)";
  ctx.beginPath();
  ctx.ellipse(x, y + 28, 96, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  if (charging) ctx.translate(0, Math.sin(now / 24) * 0.9);
  ctx.scale(face, 1);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Ruedas (a ambos lados) y bielas de la locomotora
  for (const wx of [-80, -60, -32, -12, 28, 44, 60]) {
    for (const sy of [-1, 1]) {
      celBox(wx - 6, sy > 0 ? 22 : -28, 12, 6, 1.8, C.wheel, C.wheelDark, C.outline, 1.5);
      ctx.fillStyle = C.rod;
      ctx.fillRect(wx - 1, sy > 0 ? 24.4 : -25.6, 2, 1.6);
    }
  }
  for (const sy of [-1, 1]) {
    celLine([[28 + rod, sy * 25], [60 + rod, sy * 25]], 2, C.rod, C.outline, 1);
  }

  // Enganches
  celBox(-49, -4, 9, 8, 1.5, C.wheel, C.wheelDark, C.outline, 1.4);
  celBox(7, -4, 9, 8, 1.5, C.wheel, C.wheelDark, C.outline, 1.4);

  // Vagón trasero (munición / tropa)
  celBox(-90, -22, 42, 44, 3.5, C.steel, C.steelDark, C.outline, 2.6);
  ctx.strokeStyle = C.steelDark; ctx.lineWidth = 1.6;
  for (const rx of [-82, -72, -60, -52]) {
    ctx.beginPath(); ctx.moveTo(rx, -19); ctx.lineTo(rx, 19); ctx.stroke();
  }
  trainRivets(-87, -51, -19.5, C);
  trainRivets(-87, -51, 19.5, C);
  celDisc(-67, 0, 7, C.steelLight, C.steelDark, C.outline, 1.8);
  ctx.strokeStyle = C.outline; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-72, 0); ctx.lineTo(-62, 0); ctx.moveTo(-67, -5); ctx.lineTo(-67, 5); ctx.stroke();

  // Vagón de cañón
  celBox(-42, -23, 50, 46, 3.5, C.steel, C.steelDark, C.outline, 2.6);
  ctx.fillStyle = C.accent;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(-40, -20, 46, 2);
  ctx.fillRect(-40, 18, 46, 2);
  ctx.globalAlpha = 1;
  trainRivets(-39, 5, -16.5, C);
  trainRivets(-39, 5, 16.5, C);
  celDisc(-17, 0, 17, C.plate, C.steelDark, C.outline, 2.2);

  // Torreta: apunta al ángulo real hacia Navajas
  ctx.save();
  ctx.translate(-17, 0);
  ctx.rotate(la);
  ctx.fillStyle = "#1c1f1a";
  ctx.fillRect(6 - recoil, -3.2, 34, 6.4);
  ctx.strokeStyle = C.outline; ctx.lineWidth = 1.6;
  ctx.strokeRect(6 - recoil, -3.2, 34, 6.4);
  ctx.fillStyle = "#12171a";
  ctx.fillRect(36 - recoil, -4.6, 6, 9.2);
  celDisc(0, 0, 12.5, C.steel, C.steelDark, C.outline, 2.2);
  celBox(5 - recoil * 0.3, -5.5, 9, 11, 2, C.plate, C.steelDark, C.outline, 1.6);
  celDisc(-4, -4, 3.6, C.steelDark, C.wheelDark, C.outline, 1.4);
  ctx.fillStyle = C.accent;
  ctx.beginPath(); ctx.arc(1, 3, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Locomotora: cabina
  celBox(14, -21, 20, 42, 3, C.steel, C.steelDark, C.outline, 2.6);
  ctx.fillStyle = C.wheelDark;
  ctx.fillRect(28, -14, 4, 7);
  ctx.fillRect(28, 7, 4, 7);
  trainRivets(17, 31, -18.5, C);
  trainRivets(17, 31, 18.5, C);
  celDisc(23, 0, 4.4, alarmOn ? C.alarm : "#5a1d18", "#2a0c0a", C.outline, 1.6);

  // Caldera
  celBox(34, -15, 40, 30, 11, C.steel, C.steelDark, C.outline, 2.6);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  roundRect(37, -11, 34, 4, 2); ctx.fill();
  ctx.strokeStyle = C.steelDark; ctx.lineWidth = 2;
  for (const bx of [44, 56, 70]) {
    ctx.beginPath(); ctx.moveTo(bx, -14); ctx.lineTo(bx, 14); ctx.stroke();
  }
  celDisc(48, 0, 5.5, C.brass, "#6e5b25", C.outline, 1.8);
  celDisc(65, 0, 6.8, "#3a3f36", "#12140f", C.outline, 2);
  ctx.fillStyle = "#050505";
  ctx.beginPath(); ctx.arc(65, 0, 3.6, 0, Math.PI * 2); ctx.fill();

  // Quitanieves / pilot blindado
  ctx.beginPath();
  ctx.moveTo(74, -14); ctx.lineTo(91, -5); ctx.lineTo(91, 5); ctx.lineTo(74, 14);
  ctx.closePath();
  ctx.fillStyle = C.plate; ctx.fill();
  ctx.strokeStyle = C.outline; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.strokeStyle = C.accent; ctx.lineWidth = 1.8;
  for (const oy of [-8, 0, 8]) {
    ctx.beginPath(); ctx.moveTo(76, oy * 0.9); ctx.lineTo(89, oy * 0.35); ctx.stroke();
  }

  // Faro
  celDisc(88, 0, 3.2, charging ? C.alarm : C.lamp, charging ? "#a01810" : "#c99a20", C.outline, 1.4);

  ctx.restore();

  // Resplandor del faro (mundo)
  const lampX = x + face * 90;
  const glowR = charging ? 40 : 26;
  const gl = ctx.createRadialGradient(lampX, y, 0, lampX, y, glowR);
  gl.addColorStop(0, charging ? "rgba(255, 80, 40, 0.55)" : "rgba(255, 225, 120, 0.4)");
  gl.addColorStop(1, "rgba(255, 200, 80, 0)");
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.arc(lampX, y, glowR, 0, Math.PI * 2); ctx.fill();

  // Humo de la chimenea: más denso al embestir o enfurecido
  drawSmokeColumn(x + face * 65, y - 4, now / 1000, charging || en.enraged ? 1 : 0.6, 0.55);

  // Fogonazo del cañón
  if (firing) {
    const tcx = x - face * 17;
    const tipD = 44 - recoil;
    const fx = tcx + Math.cos(aim) * tipD;
    const fy = y + Math.sin(aim) * tipD;
    const alpha = fireT < 0.5 ? 1 : Math.max(0, 1 - (fireT - 0.5) / 0.5);
    drawMuzzleFlash(fx, fy, Math.cos(aim), Math.sin(aim), alpha, 2.1);
    ctx.fillStyle = `rgba(190, 185, 170, ${0.45 * alpha})`;
    ctx.beginPath(); ctx.arc(fx + Math.cos(aim) * 10, fy + Math.sin(aim) * 10 - 6, 8 + (1 - alpha) * 10, 0, Math.PI * 2); ctx.fill();
  }

  // Aviso de embestida: vapor por los costados + señal de peligro
  if (en.warning) {
    for (let i = 0; i < 6; i++) {
      const tt = ((now / 420) + i / 6) % 1;
      const side = i % 2 ? 1 : -1;
      ctx.globalAlpha = 0.65 * (1 - tt);
      ctx.fillStyle = "#e8ecee";
      ctx.beginPath();
      ctx.arc(x + face * (50 - (i >> 1) * 18), y + side * (26 + tt * 12), 3 + tt * 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const sy = y - 58 + Math.sin(now / 110) * 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, sy - 15); ctx.lineTo(x + 15, sy + 11); ctx.lineTo(x - 15, sy + 11);
    ctx.closePath();
    ctx.fillStyle = alarmOn ? "#ffdd55" : "#c8322a";
    ctx.fill();
    ctx.strokeStyle = "#0f120d"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#0f120d";
    ctx.font = "bold 18px Georgia, 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.fillText("!", x, sy + 8);
    ctx.restore();
  }
}

// Obús del tren: largo, con banda de cobre, estela ardiente y humo.
function drawTrainShell(eb, ox, oy, angle) {
  const grad = ctx.createLinearGradient(eb.x - ox * 40, eb.y - oy * 40, eb.x, eb.y);
  grad.addColorStop(0, "rgba(255, 90, 30, 0)");
  grad.addColorStop(1, "rgba(255, 200, 90, 0.85)");
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = grad;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(eb.x - ox * 40, eb.y - oy * 40);
  ctx.lineTo(eb.x, eb.y);
  ctx.stroke();
  ctx.restore();

  for (let i = 0; i < 3; i++) {
    const back = 12 + i * 10;
    ctx.fillStyle = `rgba(150, 145, 130, ${0.34 - i * 0.09})`;
    ctx.beginPath();
    ctx.arc(eb.x - ox * back, eb.y - oy * back, 4 + i * 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(eb.x, eb.y);
  ctx.rotate(angle);
  ctx.fillStyle = "#23261f";
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 3.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#0d0f0b"; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.fillStyle = "#c98a3a";
  ctx.fillRect(-2, -3.6, 3, 7.2);
  ctx.fillStyle = "#ffdd55";
  ctx.beginPath(); ctx.ellipse(6, 0, 2.4, 2.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Riel del jefe: balasto, durmientes, dos rieles de acero y franja roja
// pulsante en todo el riel mientras el tren pita o embiste.
// Riel v2: balasto con piedras, durmientes de madera desgastada con placas y
// tornillos, rieles de acero brillante, bordes de peligro amarillo/negro,
// postes con señal y baliza, y flechas rojas animadas en la dirección de la
// embestida cuando el tren pita o carga.
function drawBossRails(railY) {
  if (!latestState) return;
  const now = performance.now();
  const pl = renderPos.get("navajas") || latestState.navajas;
  const camX = Math.max(0, Math.min(pl.x - VIEWPORT_W / 2, WORLD_W - VIEWPORT_W));
  const x0 = Math.max(0, camX - 40);
  const x1 = Math.min(WORLD_W, camX + VIEWPORT_W + 40);
  const boss = latestState.enemies.find((e) => e.alive && e.type === "tren_blindado");
  const alert = !!(boss && (boss.warning || boss.charging));
  const pulse = 0.5 + 0.5 * Math.sin(now / 110);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Balasto
  ctx.fillStyle = "#4a3f2c";
  ctx.fillRect(x0, railY - 40, x1 - x0, 80);
  ctx.fillStyle = "rgba(20, 15, 8, 0.4)";
  ctx.fillRect(x0, railY - 40, x1 - x0, 4);
  ctx.fillRect(x0, railY + 36, x1 - x0, 4);
  for (let sx = Math.floor(x0 / 13) * 13; sx < x1; sx += 13) {
    const r1 = (((sx * 9301 + 49297) % 233280) / 233280);
    const r2 = (((sx * 4177 + 11003) % 233280) / 233280);
    ctx.fillStyle = r1 > 0.5 ? "#7a6a4a" : "#2f2718";
    ctx.fillRect(sx + r1 * 6, railY - 38 + r2 * 6, 3 + r2 * 2.5, 2.2 + r1 * 1.5);
    ctx.fillStyle = r2 > 0.5 ? "#6b5c3e" : "#3a2f1c";
    ctx.fillRect(sx + r2 * 6, railY + 30 + r1 * 6, 3 + r1 * 2.5, 2.2 + r2 * 1.5);
  }

  // Durmientes
  for (let sx = Math.floor(x0 / 22) * 22; sx < x1; sx += 22) {
    const v = (((sx * 7919) % 97) / 97);
    ctx.fillStyle = v > 0.5 ? "#5a3d22" : "#4a3119";
    ctx.fillRect(sx, railY - 29, 10, 58);
    ctx.strokeStyle = "#1d1108"; ctx.lineWidth = 1.4;
    ctx.strokeRect(sx, railY - 29, 10, 58);
    ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx + 3.5, railY - 27); ctx.lineTo(sx + 3.5, railY + 27); ctx.stroke();
    for (const oy of [-14, 14]) {
      ctx.fillStyle = "#2a2f26";
      ctx.fillRect(sx + 1, railY + oy - 4, 8, 8);
      ctx.fillStyle = "#8a9096";
      ctx.fillRect(sx + 2.4, railY + oy - 1.6, 1.6, 1.6);
      ctx.fillRect(sx + 6, railY + oy - 1.6, 1.6, 1.6);
    }
  }

  // Rieles de acero
  for (const oy of [-14, 14]) {
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(x0, railY + oy + 2); ctx.lineTo(x1, railY + oy + 2); ctx.stroke();
    ctx.strokeStyle = "#12171a"; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x0, railY + oy); ctx.lineTo(x1, railY + oy); ctx.stroke();
    ctx.strokeStyle = "#a7afb5"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0, railY + oy); ctx.lineTo(x1, railY + oy); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, railY + oy - 1); ctx.lineTo(x1, railY + oy - 1); ctx.stroke();
  }

  // Bordes de peligro
  for (const oy of [-40, 40]) {
    ctx.strokeStyle = "#12140f"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x0, railY + oy); ctx.lineTo(x1, railY + oy); ctx.stroke();
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = "#e0b43a"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x0, railY + oy); ctx.lineTo(x1, railY + oy); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Postes con señal y baliza
  for (let sx = Math.ceil(x0 / 360) * 360; sx < x1; sx += 360) {
    ctx.strokeStyle = "#12140f"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(sx, railY - 44); ctx.lineTo(sx, railY - 66); ctx.stroke();
    ctx.strokeStyle = "#7a7f74"; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(sx, railY - 44); ctx.lineTo(sx, railY - 66); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx, railY - 88); ctx.lineTo(sx + 13, railY - 65); ctx.lineTo(sx - 13, railY - 65);
    ctx.closePath();
    ctx.fillStyle = "#e0b43a"; ctx.fill();
    ctx.strokeStyle = "#12140f"; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.fillStyle = "#12140f";
    ctx.font = "bold 14px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("!", sx, railY - 69);
    const on = alert && Math.sin(now / 120 + sx) > 0;
    if (on) {
      ctx.fillStyle = "rgba(255, 60, 40, 0.35)";
      ctx.beginPath(); ctx.arc(sx, railY - 44, 10, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = on ? "#ff3a2a" : "#5a1d18";
    ctx.beginPath(); ctx.arc(sx, railY - 44, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#12140f"; ctx.lineWidth = 1.4; ctx.stroke();
  }

  // Alerta de embestida: franja roja + flechas en la dirección de carga
  if (alert) {
    ctx.fillStyle = `rgba(220, 38, 38, ${0.12 + pulse * 0.16})`;
    ctx.fillRect(x0, railY - 40, x1 - x0, 80);

    const dir = boss.chargeDir || boss.facing || 1;
    const off = ((now / 5) * dir) % 64;
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(255, 70, 40, ${0.35 + pulse * 0.4})`;
    for (let sx = Math.floor(x0 / 64) * 64 - 64; sx < x1 + 64; sx += 64) {
      const cx = sx + off;
      ctx.beginPath();
      ctx.moveTo(cx - 7 * dir, railY - 10);
      ctx.lineTo(cx + 7 * dir, railY);
      ctx.lineTo(cx - 7 * dir, railY + 10);
      ctx.stroke();
    }

    if (boss.charging) {
      for (let i = 0; i < 8; i++) {
        const tt = ((now / 140) + i / 8) % 1;
        ctx.globalAlpha = 1 - tt;
        ctx.fillStyle = i % 2 ? "#ffd83a" : "#fff3c2";
        ctx.beginPath();
        ctx.arc(boss.x - dir * (70 + i * 14) - dir * tt * 20, railY + (i % 2 ? 14 : -14), 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function drawBossRailsLegacy(railY) {
  if (!latestState) return;
  const now = performance.now();
  const pl = renderPos.get("navajas") || latestState.navajas;
  const camX = Math.max(0, Math.min(pl.x - VIEWPORT_W / 2, WORLD_W - VIEWPORT_W));
  const x0 = Math.max(0, camX - 30);
  const x1 = Math.min(WORLD_W, camX + VIEWPORT_W + 30);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.fillStyle = "rgba(74, 62, 42, 0.6)";
  ctx.fillRect(x0, railY - 30, x1 - x0, 60);
  ctx.fillStyle = "rgba(30, 24, 14, 0.35)";
  ctx.fillRect(x0, railY - 30, x1 - x0, 3);
  ctx.fillRect(x0, railY + 27, x1 - x0, 3);

  for (let sx = Math.floor(x0 / 24) * 24; sx < x1; sx += 24) {
    ctx.fillStyle = "#5a3d22";
    ctx.fillRect(sx, railY - 26, 9, 52);
    ctx.strokeStyle = "#1d1108"; ctx.lineWidth = 1.4;
    ctx.strokeRect(sx, railY - 26, 9, 52);
  }

  for (const oy of [-14, 14]) {
    ctx.strokeStyle = "#12171a"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x0, railY + oy); ctx.lineTo(x1, railY + oy); ctx.stroke();
    ctx.strokeStyle = "#a7afb5"; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(x0, railY + oy); ctx.lineTo(x1, railY + oy); ctx.stroke();
  }

  const boss = latestState.enemies.find((e) => e.alive && e.type === "tren_blindado");
  if (boss && (boss.warning || boss.charging)) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 110);
    ctx.fillStyle = `rgba(220, 38, 38, ${0.12 + pulse * 0.16})`;
    ctx.fillRect(x0, railY - 36, x1 - x0, 72);
  }
  ctx.restore();
}

// Barra de vida del jefe + cartel de aparición.
// Barra del jefe v2: marco metálico remachado, marcas cada 10%, divisor de
// fase 2 en el 50%, resplandor rojo al enfurecerse, viñeta roja y cartel
// "EL TREN SE ENFURECE" con aviso de morteros.
let bossEnrageAt = 0;

function drawBossHud() {
  if (!latestState || !Array.isArray(latestState.enemies)) return;
  const boss = latestState.enemies.find((e) => e.alive && e.type === "tren_blindado");
  if (!boss) { bossIntroAt = 0; bossEnrageAt = 0; return; }
  const now = performance.now();
  if (!bossIntroAt) {
    bossIntroAt = now;
    shakeUntil = Math.max(shakeUntil, now + 600);
    shakeMag = Math.max(shakeMag, 5);
  }

  const maxHp = boss.maxHealth || 1200;
  const pct = Math.max(0, Math.min(1, boss.health / maxHp));
  const enraged = !!boss.enraged || pct < 0.5;
  if (enraged && !bossEnrageAt) {
    bossEnrageAt = now;
    shakeUntil = Math.max(shakeUntil, now + 700);
    shakeMag = Math.max(shakeMag, 7);
    if (window.sfxExplosion) window.sfxExplosion();
  }
  const pr = 0.5 + 0.5 * Math.sin(now / 260);

  ctx.save();

  if (enraged) {
    const vg = ctx.createRadialGradient(VIEWPORT_W / 2, VIEWPORT_H / 2, VIEWPORT_H * 0.4, VIEWPORT_W / 2, VIEWPORT_H / 2, VIEWPORT_H * 0.95);
    vg.addColorStop(0, "rgba(160, 10, 10, 0)");
    vg.addColorStop(1, `rgba(160, 10, 10, ${0.14 + 0.1 * pr})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
  }

  const bw = 460, bh = 16;
  const bx = (VIEWPORT_W - bw) / 2, by = 36;

  // Nombre
  ctx.textAlign = "center";
  ctx.font = "bold 15px 'Special Elite', 'Courier New', monospace";
  const title = enraged ? "TREN BLINDADO — ¡ENFURECIDO!" : "TREN BLINDADO";
  ctx.fillStyle = "#000000";
  ctx.fillText(title, VIEWPORT_W / 2 + 1.5, by - 11 + 1.5);
  ctx.fillStyle = enraged ? (pr > 0.5 ? "#ff6a4a" : "#ffd0a0") : "#ecdfc2";
  ctx.fillText(title, VIEWPORT_W / 2, by - 11);

  // Marco
  roundRect(bx - 7, by - 7, bw + 14, bh + 14, 9);
  ctx.fillStyle = "#15130e"; ctx.fill();
  ctx.strokeStyle = enraged ? `rgba(255, 90, 60, ${0.6 + 0.4 * pr})` : "#6b7a64";
  ctx.lineWidth = 2.4; ctx.stroke();
  roundRect(bx - 3, by - 3, bw + 6, bh + 6, 6);
  ctx.fillStyle = "rgba(6, 5, 3, 0.9)"; ctx.fill();
  ctx.strokeStyle = "#000000"; ctx.lineWidth = 2; ctx.stroke();

  // Remaches del marco
  ctx.fillStyle = "#8a9096";
  for (const [rx, ry] of [[bx - 4, by - 4], [bx + bw + 4, by - 4], [bx - 4, by + bh + 4], [bx + bw + 4, by + bh + 4]]) {
    ctx.beginPath(); ctx.arc(rx, ry, 1.6, 0, Math.PI * 2); ctx.fill();
  }

  // Vida
  if (pct > 0) {
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, enraged ? "#ff3a2a" : "#e8a53a");
    g.addColorStop(1, enraged ? "#a01810" : "#c8322a");
    ctx.save();
    if (enraged) { ctx.shadowColor = "rgba(255, 60, 40, 0.9)"; ctx.shadowBlur = 12; }
    ctx.fillStyle = g;
    roundRect(bx, by, Math.max(8, bw * pct), bh, 4);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    roundRect(bx + 2, by + 2, Math.max(4, bw * pct - 4), 3, 1.5);
    ctx.fill();
  }

  // Marcas cada 10% y divisor de fase 2
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  for (let i = 1; i < 10; i++) {
    if (i === 5) continue;
    ctx.fillRect(bx + bw * (i / 10) - 0.5, by, 1, bh);
  }
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(bx + bw * 0.5 - 1.5, by - 3, 3, bh + 6);

  // Porcentaje y fase
  ctx.textAlign = "right";
  ctx.font = "11px 'Special Elite', 'Courier New', monospace";
  ctx.fillStyle = "#ecdfc2";
  ctx.fillText(`${Math.ceil(pct * 100)}%`, bx + bw - 4, by + bh - 3.5);
  if (enraged) {
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(255, 150, 110, ${0.7 + 0.3 * pr})`;
    ctx.font = "11px 'Special Elite', 'Courier New', monospace";
    ctx.fillText("FASE 2 · BOMBARDEO DE MORTEROS", VIEWPORT_W / 2, by + bh + 22);
  }

  // Cartel de aparición
  ctx.textAlign = "center";
  const age = now - bossIntroAt;
  if (age < 2800) {
    const a = age < 300 ? age / 300 : age > 2300 ? 1 - (age - 2300) / 500 : 1;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = "rgba(90, 10, 8, 0.6)";
    ctx.fillRect(0, VIEWPORT_H * 0.36 - 34, VIEWPORT_W, 86);
    ctx.fillStyle = "#e0b43a";
    ctx.fillRect(0, VIEWPORT_H * 0.36 - 34, VIEWPORT_W, 3);
    ctx.fillRect(0, VIEWPORT_H * 0.36 + 49, VIEWPORT_W, 3);
    ctx.fillStyle = "#ffdd55";
    ctx.font = "bold 40px Georgia, 'Times New Roman', serif";
    ctx.fillText("¡TREN BLINDADO!", VIEWPORT_W / 2, VIEWPORT_H * 0.36 + 10);
    ctx.fillStyle = "#ecdfc2";
    ctx.font = "14px 'Special Elite', 'Courier New', monospace";
    ctx.fillText("SAL DEL RIEL CUANDO PITE LA ALARMA", VIEWPORT_W / 2, VIEWPORT_H * 0.36 + 36);
    ctx.globalAlpha = 1;
  }

  // Cartel de furia (fase 2)
  const eAge = bossEnrageAt ? now - bossEnrageAt : 99999;
  if (eAge < 2800) {
    const a = eAge < 250 ? eAge / 250 : eAge > 2300 ? 1 - (eAge - 2300) / 500 : 1;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = "rgba(120, 8, 6, 0.7)";
    ctx.fillRect(0, VIEWPORT_H * 0.5 - 34, VIEWPORT_W, 86);
    ctx.fillStyle = "#ff3a2a";
    ctx.fillRect(0, VIEWPORT_H * 0.5 - 34, VIEWPORT_W, 3);
    ctx.fillRect(0, VIEWPORT_H * 0.5 + 49, VIEWPORT_W, 3);
    ctx.fillStyle = "#ffdd55";
    ctx.font = "bold 36px Georgia, 'Times New Roman', serif";
    ctx.fillText("¡EL TREN SE ENFURECE!", VIEWPORT_W / 2, VIEWPORT_H * 0.5 + 8);
    ctx.fillStyle = "#ecdfc2";
    ctx.font = "14px 'Special Elite', 'Courier New', monospace";
    ctx.fillText("¡CUIDADO CON LOS MORTEROS!", VIEWPORT_W / 2, VIEWPORT_H * 0.5 + 34);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawBossHudLegacy() {
  if (!latestState || !Array.isArray(latestState.enemies)) return;
  const boss = latestState.enemies.find((e) => e.alive && e.type === "tren_blindado");
  if (!boss) { bossIntroAt = 0; return; }
  const now = performance.now();
  if (!bossIntroAt) {
    bossIntroAt = now;
    shakeUntil = Math.max(shakeUntil, now + 500);
    shakeMag = Math.max(shakeMag, 4);
  }

  const maxHp = boss.maxHealth || 1200;
  const pct = Math.max(0, Math.min(1, boss.health / maxHp));
  const enraged = !!boss.enraged || pct < 0.5;
  const bw = 380, bh = 14;
  const bx = (VIEWPORT_W - bw) / 2, by = 30;

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "13px 'Special Elite', 'Courier New', monospace";
  ctx.fillStyle = enraged ? (Math.sin(now / 120) > 0 ? "#ff6a4a" : "#ffd0a0") : "#ecdfc2";
  ctx.fillText(enraged ? "TREN BLINDADO — ¡ENFURECIDO!" : "TREN BLINDADO", VIEWPORT_W / 2, by - 8);

  roundRect(bx - 3, by - 3, bw + 6, bh + 6, 6);
  ctx.fillStyle = "rgba(10, 8, 5, 0.78)"; ctx.fill();
  ctx.strokeStyle = "#000000"; ctx.lineWidth = 2; ctx.stroke();

  if (pct > 0) {
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, enraged ? "#ff3a2a" : "#e8a53a");
    g.addColorStop(1, enraged ? "#a01810" : "#c8322a");
    ctx.fillStyle = g;
    roundRect(bx, by, Math.max(8, bw * pct), bh, 4);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(bx + bw * 0.5 - 1, by, 2, bh);

  const age = now - bossIntroAt;
  if (age < 2800) {
    const a = age < 300 ? age / 300 : age > 2300 ? 1 - (age - 2300) / 500 : 1;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = "rgba(90, 10, 8, 0.55)";
    ctx.fillRect(0, VIEWPORT_H * 0.36 - 32, VIEWPORT_W, 80);
    ctx.fillStyle = "#ffdd55";
    ctx.font = "bold 36px Georgia, 'Times New Roman', serif";
    ctx.fillText("¡TREN BLINDADO!", VIEWPORT_W / 2, VIEWPORT_H * 0.36 + 8);
    ctx.fillStyle = "#ecdfc2";
    ctx.font = "14px 'Special Elite', 'Courier New', monospace";
    ctx.fillText("SAL DEL RIEL CUANDO PITE LA ALARMA", VIEWPORT_W / 2, VIEWPORT_H * 0.36 + 34);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// JEFE NIVEL 3 — helper: ¿(x, y) está dentro de la sombra del bombardero?
// Misma elipse que usa el servidor para decidir si el disparo acierta.
// ---------------------------------------------------------------------------
function enSombraDeJefeAvion(x, y) {
  if (!latestState || !Array.isArray(latestState.enemies)) return false;
  for (const e of latestState.enemies) {
    if (!e.alive || e.type !== "jefe_avion" || !e.entered) continue;
    const nx = (x - e.x) / JEFE_AVION_RX;
    const ny = (y - e.y) / JEFE_AVION_RY;
    if (nx * nx + ny * ny < 1) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// JEFE NIVEL 2 — CAÑÓN MASTODONTE
// Casco a la vista desde arriba: frente blindado (placas con franjas de
// peligro) a la izquierda, radiador trasero brillante a la derecha (punto
// débil) y torreta que gira hacia Navajas. Al apuntar muestra la línea de
// mira y una retícula en el punto donde va a caer el proyectil.
// ---------------------------------------------------------------------------
function drawJefeCanon(en, x, y) {
  const now = performance.now();
  const id = en.id;
  const aim = typeof en.aimAngle === "number" ? en.aimAngle : Math.PI;
  const enraged = !!en.enraged;
  const warning = !!en.warning;
  const pulse = 0.5 + 0.5 * Math.sin(now / 130);
  const flash = enemyHitUntil.get(id);
  const ft = flash && now < flash.until ? (flash.until - now) / ENEMY_HIT_FLASH_MS : 0;
  const tint = Math.max(ft, enraged ? 0.1 + 0.08 * pulse : 0);
  const fu = enemyFiringUntil.get(id) || 0;
  const recoil = fu > now ? ((fu - now) / 150) * 12 : 0;
  const T = (hex, t = tint) => (t > 0 ? blendColor(hex, 0xdc2626, t) : hex);

  // Sombra en el suelo
  ctx.save();
  ctx.fillStyle = "rgba(20, 16, 8, 0.32)";
  ctx.beginPath();
  ctx.ellipse(x + 8, y + 30, 118, 74, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Telegrafiado: línea de mira + retícula en el punto fijado (coordenadas de mundo)
  if (warning && typeof en.lockX === "number") {
    const mx = x + Math.cos(en.lockAngle) * 122;
    const my = y + Math.sin(en.lockAngle) * 122;
    ctx.save();
    ctx.setLineDash([12, 10]);
    ctx.lineDashOffset = -now / 25;
    ctx.strokeStyle = `rgba(255, 60, 40, ${0.45 + 0.4 * pulse})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(en.lockX, en.lockY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(en.lockX, en.lockY, 26 - 6 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(en.lockX - 34, en.lockY); ctx.lineTo(en.lockX + 34, en.lockY);
    ctx.moveTo(en.lockX, en.lockY - 34); ctx.lineTo(en.lockX, en.lockY + 34);
    ctx.stroke();
    ctx.restore();
  }

  // Polvareda de las orugas mientras avanza a su posición
  if (en.phase === "avance") {
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const u = ((now / 900) + i / 14) % 1;
      const side = i % 2 ? 1 : -1;
      ctx.globalAlpha = 0.5 * (1 - u);
      ctx.fillStyle = i % 3 ? "#b39c74" : "#8a7a5c";
      ctx.beginPath();
      ctx.arc(x + 90 + u * 150 + (i % 5) * 4, y + side * (60 + 8 * Math.sin(i * 2.1)) - u * 18, 10 + u * 26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(x, y);
  if (en.phase === "avance") ctx.translate(0, Math.sin(now / 45) * 1.6); // vibración del motor
  ctx.scale(1.2, 1.2); // más grande e imponente (hitbox radius 84 en el servidor)
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Orugas (arriba y abajo del casco) con ruedas y tacos
  for (const ty of [-54, 32]) {
    roundRect(-74, ty, 148, 22, 9);
    ctx.fillStyle = "#171913"; ctx.fill();
    ctx.strokeStyle = "#0a0b08"; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = "#2f3427"; ctx.lineWidth = 2;
    for (let tx = -66; tx <= 66; tx += 10) {
      ctx.beginPath(); ctx.moveTo(tx, ty + 3); ctx.lineTo(tx, ty + 19); ctx.stroke();
    }
    ctx.fillStyle = "#23261f";
    for (const wx of [-56, -28, 0, 28, 56]) {
      ctx.beginPath(); ctx.arc(wx, ty + 11, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#0a0b08"; ctx.lineWidth = 1.6; ctx.stroke();
    }
  }

  // Casco principal
  roundRect(-60, -34, 120, 68, 12);
  ctx.fillStyle = T("#4c5642"); ctx.fill();
  ctx.strokeStyle = "#0d0f0b"; ctx.lineWidth = 4; ctx.stroke();
  roundRect(-28, -27, 82, 54, 8);
  ctx.fillStyle = T("#3d4634"); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  for (let rx = -52; rx <= 52; rx += 13) {
    ctx.beginPath(); ctx.arc(rx, -30, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx, 30, 1.4, 0, Math.PI * 2); ctx.fill();
  }

  // Glacis frontal blindado (izquierda) con franjas de peligro
  ctx.beginPath();
  ctx.moveTo(-60, -34); ctx.lineTo(-86, -20); ctx.lineTo(-86, 20); ctx.lineTo(-60, 34);
  ctx.closePath();
  ctx.fillStyle = T("#3a4232"); ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "#d9b53a"; ctx.lineWidth = 5;
  for (let sx = -104; sx < -54; sx += 14) {
    ctx.beginPath(); ctx.moveTo(sx, -40); ctx.lineTo(sx + 30, 40); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "#0d0f0b"; ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-60, -34); ctx.lineTo(-86, -20); ctx.lineTo(-86, 20); ctx.lineTo(-60, 34);
  ctx.stroke();

  // Arco de blindaje frontal (±60°): acá las balas casi no hacen daño
  ctx.strokeStyle = "#0d0f0b"; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.arc(0, 0, 80, Math.PI - 1.05, Math.PI + 1.05); ctx.stroke();
  ctx.strokeStyle = T("#8a9686"); ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(0, 0, 80, Math.PI - 1.05, Math.PI + 1.05); ctx.stroke();

  // Radiador trasero (derecha): el punto débil, brilla más al enfurecerse
  const glow = ctx.createRadialGradient(66, 0, 4, 66, 0, 46);
  const ga = enraged ? 0.5 + 0.3 * pulse : 0.22 + 0.16 * pulse;
  glow.addColorStop(0, `rgba(255, 150, 50, ${ga})`);
  glow.addColorStop(1, "rgba(255, 150, 50, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(20, -50, 90, 100);
  roundRect(56, -22, 14, 44, 4);
  ctx.fillStyle = "#2a1a10"; ctx.fill();
  ctx.strokeStyle = "#0d0f0b"; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.strokeStyle = `rgba(255, 140, 50, ${0.55 + 0.3 * pulse})`; ctx.lineWidth = 1.6;
  for (let gy = -16; gy <= 16; gy += 8) {
    ctx.beginPath(); ctx.moveTo(58, gy); ctx.lineTo(68, gy); ctx.stroke();
  }

  // Torreta giratoria: tubo, manguito, freno de boca y cúpula
  ctx.save();
  ctx.rotate(aim);
  ctx.strokeStyle = "#0a0b08"; ctx.lineWidth = 3;
  roundRect(30 - recoil, -10, 62, 20, 4);
  ctx.fillStyle = T("#20231d"); ctx.fill(); ctx.stroke();
  roundRect(14 - recoil, -14, 26, 28, 5);
  ctx.fillStyle = T("#2d312a"); ctx.fill(); ctx.stroke();
  roundRect(86 - recoil, -14, 16, 28, 4);
  ctx.fillStyle = "#15170f"; ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.arc(102 - recoil, 0, 5, 0, Math.PI * 2); ctx.fill();
  if (warning) {
    ctx.fillStyle = `rgba(255, 70, 40, ${0.35 + 0.35 * pulse})`;
    ctx.beginPath(); ctx.arc(102 - recoil, 0, 15, 0, Math.PI * 2); ctx.fill();
  }
  roundRect(-32, -27, 58, 54, 16);
  ctx.fillStyle = T("#56604b"); ctx.fill();
  ctx.strokeStyle = "#0d0f0b"; ctx.lineWidth = 3.4; ctx.stroke();
  ctx.fillStyle = T("#3b4332");
  ctx.beginPath(); ctx.arc(-8, -10, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#0d0f0b"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#1a1d16";
  ctx.fillRect(2, 8, 14, 5);
  ctx.restore();

  // Púas de embestida en el glacis frontal
  ctx.fillStyle = T("#2a2f24"); ctx.strokeStyle = "#0a0b08"; ctx.lineWidth = 2.4;
  for (const sy of [-1, 1]) {
    for (const oy of [6, 16]) {
      ctx.beginPath();
      ctx.moveTo(-84, sy * oy); ctx.lineTo(-106, sy * (oy + 4)); ctx.lineTo(-84, sy * (oy + 9));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  // Visores rojos del frente
  ctx.fillStyle = `rgba(255, 40, 30, ${0.55 + 0.45 * pulse})`;
  ctx.fillRect(-82, -9, 12, 4); ctx.fillRect(-82, 5, 12, 4);
  // Chimeneas de escape con humo constante
  for (const ex of [30, 46]) {
    roundRect(ex, -46, 9, 15, 3);
    ctx.fillStyle = "#1a1c16"; ctx.fill(); ctx.strokeStyle = "#0a0b08"; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const u = ((now / 1100) + i / 3 + ex / 100) % 1;
      ctx.globalAlpha = 0.34 * (1 - u);
      ctx.fillStyle = "#3a3a36";
      ctx.beginPath(); ctx.arc(ex + 4.5 + u * 10, -50 - u * 40, 4 + u * 10, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Humo negro al enfurecerse
  if (enraged) {
    for (let i = 0; i < 3; i++) {
      const t = ((now / 900) + i / 3) % 1;
      ctx.globalAlpha = 0.4 * (1 - t);
      ctx.fillStyle = "#1c1c1a";
      ctx.beginPath(); ctx.arc(34 + i * 9, -42 - t * 48, 8 + t * 14, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// JEFE NIVEL 3 — AVIÓN BOMBARDERO (parte en el suelo: su SOMBRA)
// La silueta proyectada + la elipse de impacto. La elipse se pone verde
// cuando Navajas está adentro: ahí el fusil apunta al cielo y no falla.
// ---------------------------------------------------------------------------
function drawJefeAvionSombra(en, x, y) {
  const now = performance.now();
  const heading = typeof en.heading === "number" ? en.heading : 0;
  const nav = renderPos.get("navajas") || (latestState && latestState.navajas);
  const dentro = !!nav && !!en.entered && enSombraDeJefeAvion(nav.x, nav.y);
  const pulse = 0.5 + 0.5 * Math.sin(now / 200);

  // Silueta del bombardero proyectada en el suelo (fuselaje, alas, cola)
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = "#0a0a08";
  ctx.beginPath();
  ctx.moveTo(92, 0);   ctx.ellipse(0, 0, 92, 14, 0, 0, Math.PI * 2);
  ctx.moveTo(26, 0);   ctx.ellipse(6, 0, 20, 118, 0, 0, Math.PI * 2);
  ctx.moveTo(-66, 0);  ctx.ellipse(-78, 0, 12, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (!en.entered) return;

  // Elipse de impacto (hitbox real, alineada al mundo)
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.ellipse(0, 0, JEFE_AVION_RX, JEFE_AVION_RY, 0, 0, Math.PI * 2);
  ctx.fillStyle = dentro ? "rgba(120, 255, 140, 0.12)" : "rgba(255, 70, 60, 0.06)";
  ctx.fill();
  ctx.setLineDash([14, 9]);
  ctx.lineDashOffset = -now / 40;
  ctx.lineWidth = dentro ? 3.4 : 2.4;
  ctx.strokeStyle = dentro
    ? `rgba(120, 255, 140, ${0.75 + 0.25 * pulse})`
    : `rgba(255, 70, 60, ${0.45 + 0.3 * pulse})`;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.moveTo(0, -10); ctx.lineTo(0, 10);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// JEFE NIVEL 3 — AVIÓN BOMBARDERO (capa aérea: el casco a 230 px de altura)
// Cuatrimotor de ala ancha con hélices, cabina de vidrio, bodega que se abre
// al soltar bombas y humo negro al enfurecerse. Una línea tenue lo une a su
// sombra para que se lea la altura.
// ---------------------------------------------------------------------------
function drawJefeAvionAereo() {
  if (!latestState || !Array.isArray(latestState.enemies)) return;
  const now = performance.now();
  actualizarCaidasAvion(now);

  for (const en of latestState.enemies) {
    if (en.type !== "jefe_avion") continue;
    const crash = planeCrashes.get(en.id);
    if (!en.alive && (!crash || crash.impacted)) continue;
    const sp = renderPos.get(en.id) || { x: en.x, y: en.y };
    let gx = sp.x, gy = sp.y;
    let angle = typeof en.heading === "number" ? en.heading : 0;
    let alt = PLANE_ALTITUDE_PX;
    let crashSt = null;
    if (crash) {
      crashSt = estadoCaidaAvion(crash, now);
      gx = crashSt.gx; gy = crashSt.gy; angle = crashSt.angle; alt = crashSt.alt;
    }
    const bob = crash ? 0 : Math.sin(now / 420) * 3;
    const fx = gx, fy = gy - alt + bob;
    const enraged = !!en.enraged || !!crash;
    if (crash) { dibujarSombraCaidaAvion(crashSt); dibujarEstelaCaidaAvion(crash, now); }
    const pulse = 0.5 + 0.5 * Math.sin(now / 150);
    const flash = enemyHitUntil.get(en.id);
    const ft = flash && now < flash.until ? (flash.until - now) / ENEMY_HIT_FLASH_MS : 0;
    const T = (hex) => (ft > 0 ? blendColor(hex, 0xdc2626, ft) : hex);
    const backX = -Math.cos(angle), backY = -Math.sin(angle);
    const perpX = -Math.sin(angle), perpY = Math.cos(angle);
    const k = 2.2;
    const motores = [-30, -16, 16, 30];

    // Línea de altura: une el casco con su sombra
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(fx, fy + 14); ctx.stroke();
    ctx.restore();

    // Estela de humo de los 4 motores (negra si está enfurecido)
    for (let m = 0; m < motores.length; m++) {
      for (let i = 0; i < 3; i++) {
        const age = (now / 5 + i * 80 + m * 37) % 280;
        const d = 60 * k * 0.6 + age * 0.6;
        const off = motores[m] * k;
        const tx = fx + backX * d + perpX * off + perpX * Math.sin(i * 1.7 + m) * 2.4;
        const ty = fy + backY * d + perpY * off + perpY * Math.sin(i * 1.7 + m) * 2.4;
        ctx.save();
        ctx.globalAlpha = Math.max(0, (enraged ? 0.42 : 0.24) - age / 950);
        ctx.fillStyle = enraged ? "#1d1d1b" : "#cfcabb";
        ctx.beginPath(); ctx.arc(tx, ty, 3 + age * 0.03, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(angle);
    ctx.scale(k, k);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const bayOpen = (planeBombOpenUntil.get(en.id) || 0) > now;

    // Ala principal ancha
    drawPlaneWing(2, 13, 10, 44, T("#7d8a80"), T("#48524b"), "#0b0e0c");

    // Cuatro motores con hélice giratoria
    for (const wy of motores) {
      if (enraged) {
        ctx.fillStyle = `rgba(255, 130, 40, ${0.55 + 0.3 * pulse})`;
        ctx.beginPath(); ctx.ellipse(-2, wy, 4 + 2.5 * pulse, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      }
      roundRect(3, wy - 3.6, 18, 7.2, 3);
      ctx.fillStyle = T("#2d342e"); ctx.fill();
      ctx.strokeStyle = "#0b0e0c"; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.save();
      ctx.translate(23, wy);
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#c3cbd0";
      ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.rotate((now / 14 + wy * 3) % (Math.PI * 2));
      ctx.strokeStyle = "#0b0e0c"; ctx.lineWidth = 1.6;
      for (let b = 0; b < 3; b++) {
        const a = (b * Math.PI * 2) / 3;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 6.5, Math.sin(a) * 6.5); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = "#4a4d40";
      ctx.beginPath(); ctx.arc(23, wy, 1.6, 0, Math.PI * 2); ctx.fill();
    }

    // Fuselaje
    ctx.beginPath();
    ctx.moveTo(46, 0);
    ctx.quadraticCurveTo(38, -8.5, 16, -8);
    ctx.quadraticCurveTo(-8, -9, -30, -5);
    ctx.quadraticCurveTo(-46, -3, -52, 0);
    ctx.quadraticCurveTo(-46, 3, -30, 5);
    ctx.quadraticCurveTo(-8, 9, 16, 8);
    ctx.quadraticCurveTo(38, 8.5, 46, 0);
    ctx.closePath();
    const fg = ctx.createLinearGradient(0, -8, 0, 8);
    fg.addColorStop(0, T("#a9b3a8"));
    fg.addColorStop(0.5, T("#7f8b80"));
    fg.addColorStop(1, T("#56615a"));
    ctx.fillStyle = fg; ctx.fill();
    ctx.strokeStyle = "#0b0e0c"; ctx.lineWidth = 1.8; ctx.stroke();

    // Cabina de vidrio y franja roja de jefe
    ctx.fillStyle = "rgba(159, 214, 255, 0.85)";
    ctx.beginPath(); ctx.ellipse(33, 0, 6, 4.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#0b0e0c"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath(); ctx.ellipse(31.5, -1.4, 2.4, 1, 0, 0, Math.PI * 2); ctx.fill();
    roundRect(-8, -8, 5, 16, 1.5);
    ctx.fillStyle = "#c8322a"; ctx.fill();
    ctx.strokeStyle = "#0b0e0c"; ctx.lineWidth = 1; ctx.stroke();

    // Bodega de bombas
    roundRect(-26, -4, 18, 8, 2);
    ctx.fillStyle = bayOpen ? "#2a2018" : T("#4a544d"); ctx.fill();
    ctx.strokeStyle = "#0b0e0c"; ctx.lineWidth = 1.2; ctx.stroke();
    if (bayOpen) {
      ctx.fillStyle = "rgba(255, 214, 110, 0.75)";
      ctx.beginPath(); ctx.ellipse(-17, 0, 6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Escarapelas en las alas
    for (const wy of [-38, 38]) {
      ctx.fillStyle = "#c8322a";
      ctx.beginPath(); ctx.arc(4, wy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e8e2c8";
      ctx.beginPath(); ctx.arc(4, wy, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2a5aa0";
      ctx.beginPath(); ctx.arc(4, wy, 1.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#0b0e0c"; ctx.lineWidth = 1.2; ctx.stroke();
    }

    // Torreta dorsal y cola
    ctx.fillStyle = "#1c211d";
    ctx.beginPath(); ctx.arc(10, 0, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#0b0e0c"; ctx.lineWidth = 1.2; ctx.stroke();
    drawPlaneWing(-44, 6, 5, 22, T("#98a39a"), T("#66716a"), "#0b0e0c");
    roundRect(-54, -2.2, 10, 4.4, 1.5);
    ctx.fillStyle = "#c8322a"; ctx.fill();
    ctx.strokeStyle = "#0b0e0c"; ctx.lineWidth = 1.2; ctx.stroke();

    ctx.restore();
    if (crash) dibujarLlamasCaidaAvion(crash, fx, fy, angle, now);
  }
  // Piezas que siguen cayendo aunque el casco ya se haya estrellado
  for (const [id, c] of planeCrashes) {
    if (!c.impacted) continue;
    dibujarEstelaCaidaAvion(c, now);
    dibujarLlamasCaidaAvion(c, -9999, -9999, 0, now);
  }
}

// Cartel mientras el bombardero se viene abajo
function drawAvionDerribadoBanner() {
  if (planeCrashes.size === 0) return;
  const now = performance.now();
  let c = null;
  for (const v of planeCrashes.values()) c = v;
  const age = now - c.startedAt;
  if (age > 3400) return;
  const a = age < 250 ? age / 250 : age > 2900 ? (3400 - age) / 500 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.textAlign = "center";
  ctx.font = "bold 30px 'Special Elite', 'Courier New', monospace";
  ctx.fillStyle = "#000";
  ctx.fillText("¡BOMBARDERO DERRIBADO!", VIEWPORT_W / 2 + 2, VIEWPORT_H * 0.26 + 2);
  ctx.fillStyle = 0.5 + 0.5 * Math.sin(now / 110) > 0.5 ? "#ffb347" : "#ff5a2a";
  ctx.fillText("¡BOMBARDERO DERRIBADO!", VIEWPORT_W / 2, VIEWPORT_H * 0.26);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// HUD de los jefes nuevos: tarjeta de presentación, barra de vida con divisor
// de fase en el 50%, viñeta roja al enfurecerse y pista contextual.
// ---------------------------------------------------------------------------
let canonPrevEntered = null;
let jefeHudIntroAt = 0;
let jefeHudEnrageAt = 0;

function drawBossHudJefes() {
  if (!latestState || !Array.isArray(latestState.enemies)) return;
  const boss = latestState.enemies.find((e) => e.alive && (e.type === "jefe_canon" || e.type === "jefe_avion"));
  if (!boss) { jefeHudIntroAt = 0; jefeHudEnrageAt = 0; return; }

  const now = performance.now();
  const esAvion = boss.type === "jefe_avion";
  const nombre = esAvion ? "AVIÓN BOMBARDERO" : "CAÑÓN MASTODONTE";

  if (!jefeHudIntroAt) {
    jefeHudIntroAt = now;
    shakeUntil = Math.max(shakeUntil, now + 600);
    shakeMag = Math.max(shakeMag, 5);
    if (window.sfxExplosion) window.sfxExplosion();
  }

  const maxHp = boss.maxHealth || (esAvion ? 2200 : 1800);
  const pct = Math.max(0, Math.min(1, boss.health / maxHp));
  const enraged = !!boss.enraged || pct < 0.5;
  if (enraged && !jefeHudEnrageAt) {
    jefeHudEnrageAt = now;
    shakeUntil = Math.max(shakeUntil, now + 700);
    shakeMag = Math.max(shakeMag, 7);
    if (window.sfxExplosion) window.sfxExplosion();
  }
  const pr = 0.5 + 0.5 * Math.sin(now / 260);

  // Cañón: la tierra tiembla mientras entra, y un golpe fuerte cuando se planta
  if (boss.type === "jefe_canon") {
    if (!boss.entered) {
      shakeUntil = Math.max(shakeUntil, now + 300);
      shakeMag = Math.max(shakeMag, boss.phase === "tremor" ? 2.6 + 1.2 * Math.sin(now / 90) : 4.2);
    } else if (canonPrevEntered === false) {
      shakeUntil = Math.max(shakeUntil, now + 500);
      shakeMag = Math.max(shakeMag, 7);
      if (window.sfxExplosion) window.sfxExplosion();
    }
    canonPrevEntered = !!boss.entered;
  }

  ctx.save();

  if (enraged) {
    const vg = ctx.createRadialGradient(VIEWPORT_W / 2, VIEWPORT_H / 2, VIEWPORT_H * 0.4, VIEWPORT_W / 2, VIEWPORT_H / 2, VIEWPORT_H * 0.95);
    vg.addColorStop(0, "rgba(160, 10, 10, 0)");
    vg.addColorStop(1, `rgba(160, 10, 10, ${0.14 + 0.1 * pr})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
  }

  // Tarjeta de presentación (2.6 s)
  const introAge = now - jefeHudIntroAt;
  if (introAge < 2600) {
    const a = introAge < 300 ? introAge / 300 : introAge > 2100 ? (2600 - introAge) / 500 : 1;
    ctx.globalAlpha = a;
    ctx.textAlign = "center";
    ctx.font = "bold 34px 'Special Elite', 'Courier New', monospace";
    ctx.fillStyle = "#000";
    ctx.fillText(nombre, VIEWPORT_W / 2 + 2, VIEWPORT_H * 0.3 + 2);
    ctx.fillStyle = "#ff6a4a";
    ctx.fillText(nombre, VIEWPORT_W / 2, VIEWPORT_H * 0.3);
    ctx.font = "15px 'Special Elite', 'Courier New', monospace";
    ctx.fillStyle = "#ecdfc2";
    ctx.fillText(
      esAvion ? "PÁRATE BAJO SU SOMBRA PARA DISPARARLE" : "SU FRENTE ESTÁ BLINDADO — ATACA POR LOS FLANCOS O POR ATRÁS",
      VIEWPORT_W / 2, VIEWPORT_H * 0.3 + 30
    );
    ctx.globalAlpha = 1;
  }

  // Barra de vida
  const bw = 460, bh = 16;
  const bx = (VIEWPORT_W - bw) / 2, by = 36;
  ctx.textAlign = "center";
  ctx.font = "bold 15px 'Special Elite', 'Courier New', monospace";
  const title = enraged ? `${nombre} — ¡ENFURECIDO!` : nombre;
  ctx.fillStyle = "#000";
  ctx.fillText(title, VIEWPORT_W / 2 + 1.5, by - 11 + 1.5);
  ctx.fillStyle = enraged ? (pr > 0.5 ? "#ff6a4a" : "#ffd0a0") : "#ecdfc2";
  ctx.fillText(title, VIEWPORT_W / 2, by - 11);

  roundRect(bx - 7, by - 7, bw + 14, bh + 14, 9);
  ctx.fillStyle = "#15130e"; ctx.fill();
  ctx.strokeStyle = enraged ? `rgba(255, 90, 60, ${0.6 + 0.4 * pr})` : "#6b7a64";
  ctx.lineWidth = 2.4; ctx.stroke();
  roundRect(bx - 3, by - 3, bw + 6, bh + 6, 6);
  ctx.fillStyle = "rgba(6, 5, 3, 0.9)"; ctx.fill();

  if (pct > 0) {
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    if (enraged) { g.addColorStop(0, "#7f1d1d"); g.addColorStop(1, "#ff3a2a"); }
    else { g.addColorStop(0, "#4d6b3a"); g.addColorStop(1, "#9fd66a"); }
    ctx.fillStyle = g;
    roundRect(bx, by, Math.max(6, bw * pct), bh, 4);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  for (let i = 1; i < 10; i++) ctx.fillRect(bx + (bw * i) / 10 - 0.5, by, 1, bh);
  ctx.fillStyle = "rgba(255, 220, 160, 0.9)";
  ctx.fillRect(bx + bw * 0.5 - 1, by - 4, 2, bh + 8);

  // Pista contextual bajo la barra
  ctx.font = "13px 'Special Elite', 'Courier New', monospace";
  let pista = "", color = "#ecdfc2";
  if (esAvion) {
    const nav = renderPos.get("navajas") || latestState.navajas;
    if (!boss.entered) { pista = "¡BOMBARDERO ENTRANDO!"; color = "#ffd0a0"; }
    else if (nav && enSombraDeJefeAvion(nav.x, nav.y)) { pista = "EN LA MIRA — ¡DISPARA!"; color = "#8dff9a"; }
    else { pista = "ENTRA EN SU SOMBRA PARA DISPARARLE"; }
  } else if (!boss.entered) {
    pista = boss.phase === "tremor" ? "¡LA TIERRA TIEMBLA… ALGO ENORME SE ACERCA!" : "¡LA MAQUINARIA AVANZA A SU POSICIÓN!";
    color = pr > 0.5 ? "#ffd0a0" : "#ff6a4a";
  } else if (boss.warning) {
    pista = "¡DISPARO APUNTADO — MUÉVETE!"; color = pr > 0.5 ? "#ff6a4a" : "#ffd0a0";
  } else {
    pista = "FRENTE BLINDADO · FLANCOS Y RETAGUARDIA = DAÑO COMPLETO";
  }
  ctx.fillStyle = "#000";
  ctx.fillText(pista, VIEWPORT_W / 2 + 1, by + bh + 22 + 1);
  ctx.fillStyle = color;
  ctx.fillText(pista, VIEWPORT_W / 2, by + bh + 22);

  ctx.restore();
}

function drawEnemyUnit(en, x, y) {
  if (en.type === "tren_blindado") {
    drawEnemyTrain(en, x, y);
  } else if (en.type === "jefe_canon") {
    drawJefeCanon(en, x, y);
  } else if (en.type === "jefe_avion") {
    drawJefeAvionSombra(en, x, y);
  } else if (en.type && en.type.startsWith("tanqueta")) {
    drawEnemyVehicleWrapper(en.id, x, y, en.dir, en.aimAngle, en.type);
  } else if (en.type === "torreta") {
    drawEnemyTurretWrapper(en.id, x, y, en.dir, en.aimAngle);
  } else if (en.type === "mortero") {
    drawEnemyMortarUnit(en.id, x, y, en.dir);
  } else if (en.para && paraAltNow(en) > 0) {
    // En el aire: aquí solo la sombra en el suelo; el paracaídas va en la capa aérea.
    drawParatrooperGroundShadow(en, x, y, paraAltNow(en));
  } else {
    drawEnemySoldier(en.id, x, y, en.dir, !!en.para);
  }
}

function scorchPath(cx, cy, rx, ry, seed) {
  ctx.beginPath();
  for (let i = 0; i <= 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const k = 1 + Math.sin(a * 3 + seed) * 0.12 + Math.sin(a * 5 + seed * 2) * 0.07;
    const px = cx + Math.cos(a) * rx * k;
    const py = cy + Math.sin(a) * ry * k;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawScorchMarks() {
  const now = performance.now();
  for (const s of scorchMarks) {
    const seed = Math.floor(s.at) % 97;
    ctx.save();
    ctx.globalAlpha = 0.9 * Math.max(0.55, 1 - (now - s.at) / 40000);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    scorchPath(s.x, s.y, 38, 22, seed);
    ctx.fillStyle = "#5a4326"; ctx.fill();
    ctx.strokeStyle = "#2a1d0e"; ctx.lineWidth = 2; ctx.stroke();

    scorchPath(s.x, s.y + 1, 27, 15.5, seed + 1);
    ctx.fillStyle = "#2b2014"; ctx.fill();

    scorchPath(s.x + 1, s.y + 2, 14, 8, seed + 2);
    ctx.fillStyle = "#160f08"; ctx.fill();

    ctx.strokeStyle = "#2a1d0e"; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + seed;
      const r0 = 30 + (i % 3) * 3;
      const r1 = r0 + 7 + (i % 4) * 2.5;
      ctx.beginPath();
      ctx.moveTo(s.x + Math.cos(a) * r0, s.y + Math.sin(a) * r0 * 0.58);
      ctx.lineTo(s.x + Math.cos(a) * r1, s.y + Math.sin(a) * r1 * 0.58);
      ctx.stroke();
    }

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + seed * 0.7;
      const r = 33 + (i % 3) * 4;
      const px = s.x + Math.cos(a) * r;
      const py = s.y + Math.sin(a) * r * 0.58;
      ctx.fillStyle = i % 2 ? "#7a5a38" : "#4a3822";
      ctx.strokeStyle = "#160f08"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.rect(px - 2.2, py - 1.6, 4.4, 3.2);
      ctx.fill(); ctx.stroke();
    }

    ctx.restore();
  }
}
function drawTierraExcavada() {
  ctx.fillStyle = "rgba(122, 96, 58, 0.55)";
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const mx = POZO_X + Math.cos(a) * (RADIO_ANILLO + 18);
    const my = POZO_Y + Math.sin(a) * (RADIO_ANILLO + 18) * 0.62;
    ctx.beginPath();
    ctx.ellipse(mx, my, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Ciclo día/noche: de atardecer cálido a noche cerrada. Solo avanza mientras
// se juega (no en el menú, en pausa ni en pantalla final).
const DAY_CYCLE_MS = 300000;
const DAY_SUN_SECONDS = 900; // segundos "de sol" que recorre drawSun (y: 100 → 550)
let dayElapsedMs = 0;
let lastDayTickAt = performance.now();
let lastKnownLevel = -1;
const LEVEL_TIME_OF_DAY = [0, 150000, 300000];

function getDayProgress() {
  const now = performance.now();
  const dt = Math.min(now - lastDayTickAt, 250);
  lastDayTickAt = now;
  if (gameState === "PLAYING" && latestState && !latestState.paused && !latestState.gameOver) {
    dayElapsedMs += dt;
  }
  return Math.min(1, dayElapsedMs / DAY_CYCLE_MS);
}

function drawVignette() {
  const w = VIEWPORT_W, h = VIEWPORT_H;

  // Multiplicador de oscuridad (0 = tarde cálida, 1 = noche profunda).
  const p = getDayProgress();
  const dark = p * p * (3 - 2 * p);
  const mix = (from, to) => Math.round(from + (to - from) * dark);
  const cr = mix(40, 5), cg = mix(15, 10), cb = mix(5, 25);
  const ca = 0.4 + (0.8 - 0.4) * dark;

  const gradient = ctx.createRadialGradient(w / 2, h / 2, h * (0.35 - 0.1 * dark), w / 2, h / 2, h * 0.85);
  gradient.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${(ca * 0.3 * dark).toFixed(3)})`);
  gradient.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, ${ca.toFixed(3)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------------------
// PRISIONEROS
// ---------------------------------------------------------------------------
const ROPE_COLOR = "#8b5e2b";
const ROPE_EDGE = "#24160a";

function drawPrisonerTied(x, y) {
  const c = UNIFORMS.boliviano;
  const now = performance.now();
  const breathe = Math.sin(now / 650 + x) * 0.7;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Anillo tenue: radio en el que Navajas lo libera.
  ctx.strokeStyle = `rgba(236, 224, 194, ${0.2 + 0.12 * Math.sin(now / 400)})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.arc(x, y, 45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(58, 46, 28, 0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 15, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sentado: piernas al frente, torso redondo y cabeza gacha.
  celBox(x - 10, y + 6, 8, 8, 3, c.boot, c.bootDark, c.outline);
  celBox(x + 2, y + 6, 8, 8, 3, c.boot, c.bootDark, c.outline);
  celDisc(x, y - 1 + breathe, 10.5, c.cloth, c.clothDark, c.outline, 2.4);
  celDisc(x + 1, y - 13 + breathe, 6.6, c.skin, c.skinDark, c.outline);
  ctx.fillStyle = "#2b1d10";
  ctx.beginPath();
  ctx.arc(x + 1, y - 14 + breathe, 6.6, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();

  // Soga gruesa: dos vueltas al torso, una diagonal y la punta suelta.
  celLine([[x - 11, y - 4 + breathe], [x + 11, y - 1 + breathe]], 3.6, ROPE_COLOR, ROPE_EDGE, 1.6);
  celLine([[x - 11, y + 3 + breathe], [x + 11, y + 5 + breathe]], 3.6, ROPE_COLOR, ROPE_EDGE, 1.6);
  celLine([[x - 9, y - 8 + breathe], [x + 9, y + 7 + breathe]], 3.2, ROPE_COLOR, ROPE_EDGE, 1.6);
  celLine([[x + 11, y - 1 + breathe], [x + 15, y + 7]], 3, ROPE_COLOR, ROPE_EDGE, 1.4);

  ctx.restore();
}

function drawPrisonerFreed(pr) {
  const p = smooth(pr.id, pr.x, pr.y);
  const dx = POZO_X - p.x;
  const dy = POZO_Y - p.y;
  const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  const phase = unitPhase(pr.id, 90);
  const bob = Math.abs(Math.sin(phase)) * 2.2;

  ctx.fillStyle = "rgba(58, 46, 28, 0.35)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 16, 12, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  drawSoldierFigure(p.x, p.y - bob, {
    dir, moving: true, phase, colors: UNIFORMS.boliviano, weapon: "none",
  });
}

function drawPrisoners() {
  if (!latestState || !Array.isArray(latestState.prisoners)) return;
  for (const pr of latestState.prisoners) {
    if (pr.status === "tied") drawPrisonerTied(pr.x, pr.y);
    else if (pr.status === "freed") drawPrisonerFreed(pr);
  }
}

function drawDamageOverlay() {
  const now = performance.now();
  const hit = Math.max(0, (damageFlashUntil - now) / DAMAGE_FLASH_MS);
  const hp = latestState?.navajas?.health ?? 100;
  const critico = hp > 0 && hp < 35 ? (Math.sin(now / 320) * 0.5 + 0.5) * 0.18 : 0;
  const alpha = hit * 0.4 + critico;
  if (alpha <= 0.01) return;

  const g = ctx.createRadialGradient(
    VIEWPORT_W / 2, VIEWPORT_H / 2, VIEWPORT_H * 0.2,
    VIEWPORT_W / 2, VIEWPORT_H / 2, VIEWPORT_H * 0.8
  );
  g.addColorStop(0, "rgba(140, 10, 10, 0)");
  g.addColorStop(1, `rgba(150, 12, 12, ${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
}

const DIG_CYCLE_MS = 900;

function cavadorPhase(id) {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return ((performance.now() + (hash % DIG_CYCLE_MS)) % DIG_CYCLE_MS) / DIG_CYCLE_MS;
}

function drawCavadorCavando(id, x, y, angleHaciaPozo) {
  const phase = cavadorPhase(id);
  const swing = phase < 0.35 ? phase / 0.35 : 1 - (phase - 0.35) / 0.65;
  const digSwing = swing * 2 - 1;

  ctx.fillStyle = "rgba(58, 46, 28, 0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 13, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const mirandoIzquierda = Math.cos(angleHaciaPozo) < 0;

  drawSoldierFigure(x, y, {
    dir: mirandoIzquierda ? "left" : "right",
    kneeling: true, weapon: "pickaxe", colors: UNIFORMS.boliviano, digSwing,
  });

  if (phase > 0.33 && phase < 0.45) {
    // Activamos el sonido justo en la fase de la animación donde vuela la tierra
    if (window.sfxDig) window.sfxDig();

    const kick = (phase - 0.33) / 0.12;
    const dirX = mirandoIzquierda ? -1 : 1;
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + (i - 2) * 0.42;
      const dist = 8 + kick * 13;
      const px = x + 11 * dirX + Math.cos(angle) * dist * dirX;
      const py = y + 11 + Math.sin(angle) * dist * 0.6 - kick * 9;
      ctx.fillStyle = `rgba(163, 129, 79, ${0.85 - kick * 0.5})`;
      ctx.beginPath();
      ctx.arc(px, py, 2.2 - kick, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function blendColor(hex, target, t) {
  const c = parseInt(hex.slice(1), 16);
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const tr = (target >> 16) & 255, tg = (target >> 8) & 255, tb = target & 255;
  return `rgb(${Math.round(r + (tr - r) * t)}, ${Math.round(g + (tg - g) * t)}, ${Math.round(b + (tb - b) * t)})`;
}

function damagedUniform(base, t) {
  return {
    ...base,
    cloth: blendColor(base.cloth, 0xdc2626, t),
    clothDark: blendColor(base.clothDark, 0x7f1d1d, t),
    clothLight: blendColor(base.clothLight, 0xef4444, t),
    skin: blendColor(base.skin, 0xdc2626, t * 0.6),
  };
}

function damagedVehicle(base, t) {
  return {
    ...base,
    hull: blendColor(base.hull, 0xdc2626, t),
    hullDark: blendColor(base.hullDark, 0x7f1d1d, t),
    hullLight: blendColor(base.hullLight, 0xef4444, t),
  };
}

function drawSoldadoBoliviano(id, x, y, dir) {
  const moving = isMoving(id, x, y);
  const bob = moving ? Math.abs(Math.sin(unitPhase(id))) * 2.2 : 0;
  const drawY = y - bob;

  ctx.fillStyle = "rgba(58, 46, 28, 0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + 16, 12, moving ? 3.5 : 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const now = performance.now();
  const firing = now - lastShotVisualAt < 150;
  const recoilAge = now - lastShotVisualAt;
  const recoilT = (recoilAge >= 0 && recoilAge < RECOIL_DURATION_MS) ? recoilAge / RECOIL_DURATION_MS : null;

  let colors = UNIFORMS.boliviano;
  const remaining = damageFlashUntil - now;
  if (remaining > 0) {
    const pulse = Math.max(0, Math.sin((remaining / DAMAGE_FLASH_MS) * Math.PI * 3));
    colors = damagedUniform(UNIFORMS.boliviano, pulse * 0.8);
  }

  const meleeAge = now - lastMeleeVisualAt;
  const inMelee = meleeAge >= 0 && meleeAge < MELEE_THRUST_MS;
  const meleeT = inMelee ? meleeAge / MELEE_THRUST_MS : null;

  // Dentro de la sombra del bombardero el fusil apunta al cielo (y así se ve que ahí SÍ le pegás).
  const apuntaAlCielo = !inMelee && enSombraDeJefeAvion(x, y);

  const muzzle = drawSoldierFigure(x, drawY, {
    dir, moving, phase: unitPhase(id), colors,
    weapon: inMelee ? "bayoneta" : "rifle", firing, meleeT, recoilT,
    weaponScale: 1.4, hero: true, antiAir: apuntaAlCielo,
  });
  if (muzzle) muzzlePoints.set(id, muzzle);
}

// ---------------------------------------------------------------------------
// PARACAIDISTAS — bajan del jefe bombardero colgados de un paracaídas de
// gajos oliva/crema con líneas de suspensión, balanceándose. En el aire son
// intocables; al aterrizar dejan el paracaídas caído en el suelo y pelean
// con su propio uniforme (caqui, casco oliva, correaje rojo).
// paraAlt viene del servidor (1 = recién lanzado, 0 = en tierra); la altura
// visible se suaviza localmente para que la caída sea fluida entre ticks.
// ---------------------------------------------------------------------------
const PARA_DROP_MS_CLIENT = 3600;
const paraChuteState = new Map(); // id -> { start, landed }
let landedChutes = [];            // paracaídas caídos en el suelo

function paraAltNow(en) {
  if (!en || !en.para) return 0;
  const now = performance.now();
  const server = typeof en.paraAlt === "number" ? en.paraAlt : 0;
  let st = paraChuteState.get(en.id);
  if (!st) {
    st = { start: now - (1 - server) * PARA_DROP_MS_CLIENT, landed: server <= 0 };
    paraChuteState.set(en.id, st);
    if (paraChuteState.size > 60) paraChuteState.delete(paraChuteState.keys().next().value);
  }
  if (st.landed) return 0;
  if (server <= 0) {
    st.landed = true;
    landedChutes.push({ x: en.x, y: en.y, at: now, seed: (Math.floor(now) % 628) / 100 });
    if (landedChutes.length > 12) landedChutes.shift();
    return 0;
  }
  const local = Math.max(0, 1 - (now - st.start) / PARA_DROP_MS_CLIENT);
  return Math.min(local, server + 0.03);
}

function drawParatrooperGroundShadow(en, x, y, alt) {
  const now = performance.now();
  // Sombra del paracaídas: crece y se oscurece a medida que se acerca al suelo.
  ctx.save();
  ctx.fillStyle = `rgba(20, 16, 10, ${0.16 + 0.16 * (1 - alt)})`;
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 26 - 6 * alt, 8 - 2 * alt, 0, 0, Math.PI * 2);
  ctx.fill();
  // Marca de aterrizaje: anillo punteado que se cierra.
  ctx.globalAlpha = 0.3 + 0.25 * Math.sin(now / 160);
  ctx.strokeStyle = "#ffdd55";
  ctx.lineWidth = 1.6;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 12 + 20 * alt, 5 + 8 * alt, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawParachuteCanopy(sz, colorA, colorB) {
  const R = 27 * sz, H = 20 * sz, N = 7;
  const xs = [];
  for (let i = 0; i <= N; i++) xs.push(-R + (i * 2 * R) / N);

  const canopyPath = () => {
    ctx.beginPath();
    ctx.ellipse(0, 0, R, H, 0, Math.PI, Math.PI * 2);
    for (let i = N - 1; i >= 0; i--) {
      ctx.quadraticCurveTo((xs[i] + xs[i + 1]) / 2, -5 * sz, xs[i], 0);
    }
    ctx.closePath();
  };

  ctx.save();
  canopyPath();
  ctx.clip();
  for (let i = 0; i < N; i++) {
    ctx.fillStyle = i % 2 ? colorB : colorA;
    ctx.beginPath();
    ctx.moveTo(xs[i], 2 * sz);
    ctx.lineTo(xs[i + 1], 2 * sz);
    ctx.lineTo(xs[i + 1] * 0.22, -H);
    ctx.lineTo(xs[i] * 0.22, -H);
    ctx.closePath();
    ctx.fill();
  }
  const shade = ctx.createLinearGradient(-R, 0, R, 0);
  shade.addColorStop(0, "rgba(0,0,0,0.28)");
  shade.addColorStop(0.4, "rgba(255,255,255,0.10)");
  shade.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = shade;
  ctx.fillRect(-R, -H, R * 2, H + 6 * sz);
  ctx.strokeStyle = "rgba(12,20,27,0.55)";
  ctx.lineWidth = 1;
  for (let i = 1; i < N; i++) {
    ctx.beginPath(); ctx.moveTo(xs[i], 0); ctx.lineTo(xs[i] * 0.22, -H); ctx.stroke();
  }
  ctx.restore();

  canopyPath();
  ctx.strokeStyle = "#0c141b";
  ctx.lineWidth = 2.4;
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.fillStyle = "#0c141b";
  ctx.beginPath(); ctx.ellipse(0, -H + 1.5 * sz, 3 * sz, 1.6 * sz, 0, 0, Math.PI * 2); ctx.fill();
  return xs;
}

function drawParatroopers() {
  if (!latestState || !Array.isArray(latestState.enemies)) return;
  const now = performance.now();
  for (const en of latestState.enemies) {
    if (!en.alive || !en.para) continue;
    const alt = paraAltNow(en);
    if (alt <= 0) continue;

    const gp = smooth(en.id, en.x, en.y);
    const seed = (parseInt(String(en.id).replace(/\D/g, ""), 10) || 1) * 1.7;
    const altPx = alt * PLANE_ALTITUDE_PX;
    // Balanceo: el paracaidista oscila colgado; se calma al acercarse al suelo.
    const sway = Math.sin(now / 430 + seed) * (0.16 * (0.35 + alt * 0.65));
    const drift = Math.sin(now / 900 + seed * 2) * 6 * alt;
    const anchorX = gp.x + drift;
    const anchorY = gp.y - altPx - 30; // centro del paracaídas

    const flash = enemyHitUntil.get(en.id);
    const colors = flash && now < flash.until
      ? damagedUniform(UNIFORMS.paracaidista, (flash.until - now) / ENEMY_HIT_FLASH_MS)
      : UNIFORMS.paracaidista;

    ctx.save();
    ctx.translate(anchorX, anchorY);
    ctx.rotate(sway);

    const D = 46; // largo de las líneas de suspensión
    // Líneas de suspensión (dibujadas antes del gajo para que salgan de su borde).
    const xs = [];
    const R = 27, N = 7;
    for (let i = 0; i <= N; i++) xs.push(-R + (i * 2 * R) / N);
    ctx.strokeStyle = "rgba(12,20,27,0.85)";
    ctx.lineWidth = 1.2;
    for (const px of xs) {
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(0, D); ctx.stroke();
    }

    // Paracaidista colgado del arnés, con las piernas colgando y pataleando.
    drawSoldierFigure(0, D + 13, {
      dir: "down", moving: true, phase: now / 210 + seed, colors, weapon: "none",
    });
    // Correaje: dos tirantes desde el arnés hacia los hombros.
    ctx.strokeStyle = "#a8321f";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-1, D); ctx.lineTo(-5, D + 9); ctx.moveTo(1, D); ctx.lineTo(5, D + 9); ctx.stroke();

    drawParachuteCanopy(1, "#6e7a4a", "#e2d8b4");
    ctx.restore();
  }
}

function drawLandedChutes() {
  const now = performance.now();
  const LIFE = 9000;
  landedChutes = landedChutes.filter((c) => now - c.at < LIFE);
  for (const c of landedChutes) {
    const age = now - c.at;
    const a = age > LIFE - 2000 ? Math.max(0, (LIFE - age) / 2000) : 1;
    ctx.save();
    ctx.globalAlpha = a * 0.95;
    ctx.translate(c.x, c.y + 10);
    ctx.rotate(c.seed);
    ctx.lineJoin = "round";
    // Tela arrugada: gajos aplastados en abanico.
    const cols = ["#6e7a4a", "#e2d8b4", "#6e7a4a", "#e2d8b4", "#6e7a4a"];
    for (let i = 0; i < 5; i++) {
      const ang = -0.9 + i * 0.45;
      ctx.save();
      ctx.rotate(ang);
      ctx.fillStyle = cols[i];
      ctx.strokeStyle = "#0c141b";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(10, -6 - (i % 2) * 3, 24 - (i % 3) * 3, -1);
      ctx.quadraticCurveTo(14, 8, 0, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // Cuerdas tiradas.
    ctx.strokeStyle = "rgba(12,20,27,0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4, 2); ctx.quadraticCurveTo(-18, 8, -26, 3);
    ctx.moveTo(-2, 4); ctx.quadraticCurveTo(-12, 16, -22, 14);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemySoldier(id, x, y, dir, para = false) {
  const moving = isMoving(id, x, y);
  const bob = moving ? Math.abs(Math.sin(unitPhase(id))) * 2 : 0;
  const drawY = y - bob;

  ctx.fillStyle = "rgba(58, 46, 28, 0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 11, moving ? 3 : 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const firingUntil = enemyFiringUntil.get(id) || 0;
  const firing = firingUntil > performance.now();
  const recoilT = firing ? 1 - Math.max(0, firingUntil - performance.now()) / 150 : null;

  const baseUniform = para ? UNIFORMS.paracaidista : UNIFORMS.enemigo;
  let colors = baseUniform;
  const flash = enemyHitUntil.get(id);
  if (flash && performance.now() < flash.until) {
    const t = (flash.until - performance.now()) / ENEMY_HIT_FLASH_MS;
    colors = damagedUniform(baseUniform, t);
  }

  const muzzle = drawSoldierFigure(x, drawY, {
    dir, moving, phase: unitPhase(id), colors, weapon: "rifle", firing, recoilT,
  });
  if (muzzle) muzzlePoints.set(id, muzzle);
}
function drawEnemyVehicleWrapper(id, x, y, dir, aimAngle, type) {
  const base = VEHICLE_PALETTES[type] || VEHICLE_COLORS;
  let colors = base;
  const flash = enemyHitUntil.get(id);
  if (flash && performance.now() < flash.until) {
    const t = (flash.until - performance.now()) / ENEMY_HIT_FLASH_MS;
    colors = damagedVehicle(base, t);
  }
  const muzzle = drawEnemyVehicle(id, x, y, dir, colors, aimAngle, type);
  if (muzzle) muzzlePoints.set(id, muzzle);
}

// Colapso breve de un soldado al morir — nada más que un cuerpo que cae y
// se desvanece, para que la muerte se note sin depender de que el servidor
// siga mandando su posición (ya lo sacó de la lista de vivos).
const FALLING_DURATION_MS = 520;
function drawFallingUnits() {
  const now = performance.now();
  fallingUnits = fallingUnits.filter((f) => now - f.startedAt < FALLING_DURATION_MS);
  for (const f of fallingUnits) {
    const t = (now - f.startedAt) / FALLING_DURATION_MS;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.translate(f.x, f.y + t * 6);
    ctx.rotate((Math.PI / 2) * Math.min(1, t * 2));
    ctx.fillStyle = "#5a4635";
    roundRect(-9, -4, 18, 8, 3);
    ctx.fill();
    ctx.restore();

    if (t < 0.5) {
      ctx.fillStyle = `rgba(163, 129, 79, ${0.6 * (1 - t * 2)})`;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y + 8, 10 + t * 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

const CHARRED_DURATION_MS = 8000;
function drawCharredUnits() {
  const now = performance.now();
  charredUnits = charredUnits.filter((c) => now - c.startedAt < CHARRED_DURATION_MS);
  for (const c of charredUnits) {
    const age = now - c.startedAt;
    const seed = Math.floor(c.startedAt) % 97;

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.sin(seed) * 0.3);

    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const k = 1 + Math.sin(a * 3 + seed) * 0.18 + Math.sin(a * 5 + seed * 2) * 0.1;
      const px = Math.cos(a) * 11 * k;
      const py = Math.sin(a) * 6 * k;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "#111111";
    ctx.fill();

    ctx.fillStyle = "#444444";
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + seed;
      const px = Math.cos(a) * 5;
      const py = Math.sin(a) * 3;
      ctx.beginPath();
      ctx.arc(px, py, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (age < 3000) {
      const flicker = Math.sin(now / 60 + seed) > 0.3;
      if (flicker) {
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * 9;
          ctx.fillStyle = "#ff8a1f";
          ctx.beginPath();
          ctx.arc(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d - Math.random() * 4, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const smokeT = age / 3000;
      ctx.save();
      ctx.globalAlpha = 0.25 * (1 - smokeT);
      ctx.fillStyle = "#555555";
      for (let i = 0; i < 3; i++) {
        const sy = c.y - 6 - ((age / 20 + i * 30) % 40);
        const sx = c.x + Math.sin((age / 300) + i) * 4;
        ctx.beginPath();
        ctx.arc(sx, sy, 3 + i, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

function drawImpactSparks() {
  const now = performance.now();
  impactSparks = impactSparks.filter((s) => now - s.startedAt < 500);
  for (const s of impactSparks) {
    const t = (now - s.startedAt) / 500;
    const px = s.x + s.vx * t * 60;
    const py = s.y + s.vy * t * 60 + t * t * 110;
    const alpha = 1 - t;
    if (s.color === "spark") {
      ctx.fillStyle = `rgba(255, 205, 110, ${alpha})`;
    } else {
      ctx.fillStyle = `rgba(150, 20, 18, ${alpha})`;
    }
    ctx.beginPath();
    ctx.arc(px, py, 2 * (1 - t * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

const MUZZLE_FLASH_MS = 90;
const MELEE_SLASH_MS = 180;

function drawSteelBlade(outerR, innerR, startA, endA, alpha, hit) {
  ctx.beginPath();
  ctx.arc(0, 0, outerR, startA, endA);
  ctx.arc(0, 0, innerR, endA, startA, true);
  ctx.closePath();

  const grad = ctx.createLinearGradient(
    Math.cos(startA) * outerR, Math.sin(startA) * outerR,
    Math.cos(endA) * outerR, Math.sin(endA) * outerR
  );
  grad.addColorStop(0, "rgba(230,236,240,0)");
  grad.addColorStop(0.22, hit ? "#ffffff" : "#c7d0d6");
  grad.addColorStop(0.5, hit ? "#eef3f5" : "#8f9aa3");
  grad.addColorStop(0.78, hit ? "#ffffff" : "#c7d0d6");
  grad.addColorStop(1, "rgba(230,236,240,0)");

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = "#12151a";
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, (outerR + innerR) / 2, startA + 0.08, endA - 0.08);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = alpha * 0.85;
  ctx.stroke();
  ctx.restore();
}

function drawMeleeSlashes() {
  const now = performance.now();
  meleeSlashes = meleeSlashes.filter((s) => now - s.startedAt < MELEE_SLASH_MS);

  for (const s of meleeSlashes) {
    const t = (now - s.startedAt) / MELEE_SLASH_MS;
    const [ox, oy] = DIR_OFFSETS[s.dir] || [1, 0];
    const angle = Math.atan2(oy, ox);
    const px = s.x + ox * 15;
    const py = s.y - 17;

    const swingStart = -0.22;
    const swingEnd = 0.22;
    const bladeWidth = 0.3;
    const outerR = 46 + t * 14;
    const innerR = outerR * 0.7;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const trailSteps = -1; // la hoja ya la dibuja la bayoneta del soldado
    for (let i = trailSteps; i >= 0; i--) {
      const lag = i * 0.055;
      const tt = Math.max(0, t - lag);
      if (tt >= 1) continue;
      const rot = swingStart + tt * (swingEnd - swingStart);
      const alpha = Math.max(0, (1 - t) * (1 - i / (trailSteps + 1)));
      if (alpha <= 0.02) continue;
      drawSteelBlade(outerR, innerR, rot - bladeWidth / 2, rot + bladeWidth / 2, alpha, s.hit && i === 0);
    }

    ctx.restore();

    if (t < 0.5) {
      const mt = t / 0.5;
      const rot = swingStart + t * (swingEnd - swingStart);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      ctx.globalAlpha = (1 - mt) * 0.35;
      ctx.strokeStyle = "#dfe6ea";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const rr = outerR * (1.05 + i * 0.14);
        ctx.beginPath();
        ctx.arc(0, 0, rr, rot - bladeWidth * 0.7, rot + bladeWidth * 0.2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (s.hit && t < 0.32) {
      const ft = t / 0.32;
      const rot = swingStart + t * (swingEnd - swingStart);
      const bx = px + Math.cos(angle + rot) * outerR * 0.85;
      const by = py + Math.sin(angle + rot) * outerR * 0.85;

      ctx.save();
      ctx.globalAlpha = 1 - ft;
      ctx.strokeStyle = "#eef3f5";
      ctx.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + rot;
        const len = 5 + ft * 13;
        ctx.lineWidth = 2.2 * (1 - ft);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(bx, by, 3 * (1 - ft * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawBullets() {
  const now = performance.now();
  bullets = bullets.filter((b) => now - b.startedAt < BULLET_DURATION);

  for (const b of bullets) {
    const t = (now - b.startedAt) / BULLET_DURATION;
    const [ox, oy] = DIR_OFFSETS[b.dir] || [1, 0];
    const bx = b.x + ox * BULLET_RANGE * t;
    const by = b.y + oy * BULLET_RANGE * t;
    const angle = Math.atan2(oy, ox);

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const bsz = b.hero ? 1.25 : 1;
    ctx.scale(bsz, bsz);
    ctx.beginPath();
    ctx.moveTo(-9, -3.2);
    ctx.lineTo(6, -3.2);
    ctx.arc(6, 0, 3.2, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-9, 3.2);
    ctx.arc(-9, 0, 3.2, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = b.hit ? "#ff8a1f" : "#ffd83a";
    ctx.fill();
    ctx.strokeStyle = "#1a1208";
    ctx.lineWidth = 2.6;
    ctx.stroke();

    ctx.fillStyle = "#fff3c2";
    ctx.beginPath();
    ctx.ellipse(2, -1, 3.6, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    const flashAge = now - b.startedAt;
    if (flashAge < MUZZLE_FLASH_MS) {
      const ft = flashAge / MUZZLE_FLASH_MS;
      drawMuzzleFlash(b.x, b.y, ox, oy, 1 - ft, b.hero ? 1.4 : 1);
    }
    if (flashAge < BULLET_DURATION) {
      const st = flashAge / BULLET_DURATION;
      ctx.fillStyle = `rgba(190, 185, 170, ${(1 - st) * 0.35})`;
      ctx.beginPath();
      ctx.arc(b.x + ox * 4, b.y + oy * 4 - st * 6, 3 + st * 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawEnemyBullets();
}

// Balas reales de enemigos: el servidor manda x,y verdaderos en
// latestState.enemyBullets, así que acá solo se dibujan en su posición
// real, sin ninguna interpolación ni animación inventada. Cada tipo de
// tanque tiene su propio proyectil, para que se note su diferencia de
// calibre sin necesidad de leer el HUD.
function drawEnemyBullets() {
  if (!latestState || !latestState.enemyBullets) return;

  for (const eb of latestState.enemyBullets) {
    const angle = Math.atan2(eb.vy, eb.vx);
    const ox = Math.cos(angle);
    const oy = Math.sin(angle);

    if (eb.type === "tren_blindado" || eb.type === "jefe_canon") {
      drawTrainShell(eb, ox, oy, angle);
    } else if (eb.type === "tanqueta_pesada") {
      drawHeavyShell(eb, ox, oy, angle);
    } else if (eb.type === "tanqueta") {
      drawMediumShell(eb, ox, oy, angle);
    } else if (eb.type === "tanqueta_asalto") {
      drawLightShell(eb, ox, oy, angle);
    } else {
      drawRifleTracer(eb, ox, oy);
    }
  }
}

function drawRifleTracer(eb, ox, oy) {
  const grad = ctx.createLinearGradient(eb.x - ox * 22, eb.y - oy * 22, eb.x, eb.y);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(159,214,255,0.85)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(eb.x - ox * 22, eb.y - oy * 22);
  ctx.lineTo(eb.x, eb.y);
  ctx.stroke();

  ctx.fillStyle = "#cfeaff";
  ctx.beginPath();
  ctx.arc(eb.x, eb.y, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

// Obús ligero: pequeño, veloz, casi todo destello — refleja su poco daño.
function drawLightShell(eb, ox, oy, angle) {
  const grad = ctx.createLinearGradient(eb.x - ox * 16, eb.y - oy * 16, eb.x, eb.y);
  grad.addColorStop(0, "rgba(255, 214, 110, 0)");
  grad.addColorStop(1, "rgba(255, 224, 140, 0.9)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(eb.x - ox * 16, eb.y - oy * 16);
  ctx.lineTo(eb.x, eb.y);
  ctx.stroke();

  ctx.save();
  ctx.translate(eb.x, eb.y);
  ctx.rotate(angle);
  ctx.fillStyle = "#ffdc7a";
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.6, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Obús mediano: proyectil visible con estela corta de humo de disparo.
function drawMediumShell(eb, ox, oy, angle) {
  const grad = ctx.createLinearGradient(eb.x - ox * 24, eb.y - oy * 24, eb.x, eb.y);
  grad.addColorStop(0, "rgba(255, 160, 60, 0)");
  grad.addColorStop(1, "rgba(255, 190, 90, 0.75)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(eb.x - ox * 24, eb.y - oy * 24);
  ctx.lineTo(eb.x, eb.y);
  ctx.stroke();

  ctx.save();
  ctx.translate(eb.x, eb.y);
  ctx.rotate(angle);
  ctx.fillStyle = "#3a3f30";
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.6, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c9a24a";
  ctx.beginPath();
  ctx.ellipse(2.6, 0, 1.8, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(180, 175, 160, 0.35)";
  ctx.beginPath();
  ctx.arc(eb.x - ox * 8, eb.y - oy * 8, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

// Obús pesado: proyectil grande, lento, con humo denso — se ve amenazante
// aunque su daño siga siendo menor al del mortero.
function drawHeavyShell(eb, ox, oy, angle) {
  const grad = ctx.createLinearGradient(eb.x - ox * 34, eb.y - oy * 34, eb.x, eb.y);
  grad.addColorStop(0, "rgba(255, 120, 40, 0)");
  grad.addColorStop(1, "rgba(255, 150, 60, 0.65)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(eb.x - ox * 34, eb.y - oy * 34);
  ctx.lineTo(eb.x, eb.y);
  ctx.stroke();

  for (let i = 0; i < 3; i++) {
    const back = 10 + i * 9;
    ctx.fillStyle = `rgba(150, 145, 130, ${0.32 - i * 0.08})`;
    ctx.beginPath();
    ctx.arc(eb.x - ox * back, eb.y - oy * back, 4.4 + i * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(eb.x, eb.y);
  ctx.rotate(angle);
  ctx.fillStyle = "#2c2f24";
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0d0f0b"; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = "#c9a24a";
  ctx.beginPath();
  ctx.ellipse(4.4, 0, 2.4, 2.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMuzzleFlash(x, y, ox, oy, alpha, size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(oy, ox));

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 18 * size);
  glow.addColorStop(0, `rgba(255, 240, 190, ${alpha * 0.9})`);
  glow.addColorStop(1, "rgba(255, 170, 60, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 18 * size, 0, Math.PI * 2);
  ctx.fill();

  const len = (12 + 9 * alpha) * size;
  ctx.fillStyle = `rgba(255, 214, 110, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(0, -4.5 * size);
  ctx.lineTo(len, -2 * size);
  ctx.lineTo(len + 6 * size, 0);
  ctx.lineTo(len, 2 * size);
  ctx.lineTo(0, 4.5 * size);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(255, 180, 70, ${alpha * 0.8})`;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(len * 0.55, -8 * size); ctx.lineTo(len * 0.35, 0); ctx.closePath();
  ctx.moveTo(0, 0); ctx.lineTo(len * 0.55, 8 * size); ctx.lineTo(len * 0.35, 0); ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(255, 255, 235, ${alpha})`;
  ctx.beginPath();
  ctx.arc(2, 0, 3.2 * size, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(210, 170, 70, ${alpha})`;
  ctx.fillRect(-6, -8 - (1 - alpha) * 6, 3, 1.6);

  ctx.restore();
}

function drawBlood() {
  const now = performance.now();
  bloodSpurts = bloodSpurts.filter((b) => now - b.startedAt < 600);
  for (const b of bloodSpurts) {
    const t = (now - b.startedAt) / 600;
    const px = b.x + b.vx * t * 60;
    const py = b.y + b.vy * t * 60 + t * t * 120;
    ctx.fillStyle = `rgba(150, 20, 18, ${1 - t})`;
    ctx.beginPath();
    ctx.arc(px, py, 2.4 * (1 - t * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

function blastEase(u) {
  return 1 - Math.pow(1 - u, 3);
}

function blastDisc(cx, cy, r, fill, dark, edge, lw) {
  if (r <= 0.2) return;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = dark; ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.92, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = edge; ctx.lineWidth = lw; ctx.stroke();
}

function blastStar(cx, cy, R, spikes, rot, fill, edge, lw) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = rot + (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? R * (0.82 + ((i * 37) % 6) / 30) : R * 0.42;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr * 0.75;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = lw; ctx.stroke();
}

function blastFlame(x, y, h, w, fill, edge, lw) {
  if (h < 1) return;
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 1.1, y - h * 0.5, x + w * 0.2, y - h);
  ctx.quadraticCurveTo(x + w * 1.0, y - h * 0.45, x + w, y);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = lw; ctx.stroke();
}

const BLAST_LAYERS = [
  ["#e8481c", "#a02410", "#000000", 4, 1, 0.52],
  ["#ff8a1f", "#d4560f", "#7a2410", 2.5, 0.74, 0.44],
  ["#ffd83a", "#f5a51a", "#c2560f", 2.5, 0.5, 0.34],
  ["#fff8d6", "#ffe27a", "#f0a020", 2, 0.28, 0.24],
];

function blastBlob(cx, cy, R, rot, k, fill, dark, edge, lw) {
  const lobes = 9 - k;
  for (let i = 0; i < lobes; i++) {
    const a = rot + (i / lobes) * Math.PI * 2;
    const d = 0.6 + ((i * 53 + k * 17) % 9) / 45;
    const lr = R * (0.36 + ((i * 31 + k * 7) % 6) / 40);
    blastDisc(cx + Math.cos(a) * R * d, cy + Math.sin(a) * R * d * 0.82, lr, fill, dark, edge, lw);
  }
  blastDisc(cx, cy, R * 0.8, fill, dark, edge, lw);
}

function drawGrenadeBody(now) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath(); ctx.ellipse(0, 0, 5.4, 6.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#2f3a1c"; ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath(); ctx.ellipse(-1.3, -1.2, 4.6, 5.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#5f7538"; ctx.fill();
  ctx.strokeStyle = "#2a3418"; ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * 2.1, -7); ctx.quadraticCurveTo(i * 2.6, 0, i * 2.1, 7); ctx.stroke();
  }
  for (let j = -2; j <= 2; j++) {
    ctx.beginPath(); ctx.moveTo(-6, j * 2.5); ctx.quadraticCurveTo(0, j * 2.5 + 1.4, 6, j * 2.5); ctx.stroke();
  }
  ctx.fillStyle = "#a3bd66";
  ctx.beginPath(); ctx.ellipse(-2.6, -2.8, 1.5, 0.9, -0.7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, 0, 5.4, 6.6, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "#000000"; ctx.lineWidth = 2.2; ctx.stroke();

  ctx.beginPath(); ctx.moveTo(1.6, -9); ctx.quadraticCurveTo(6.6, -5.5, 5.6, 3);
  ctx.strokeStyle = "#000000"; ctx.lineWidth = 3.6; ctx.stroke();
  ctx.strokeStyle = "#c9ced2"; ctx.lineWidth = 1.8; ctx.stroke();

  ctx.fillStyle = "#8a9096";
  ctx.fillRect(-2.4, -9.6, 4.8, 3.6);
  ctx.fillStyle = "#565d63";
  ctx.fillRect(0.6, -9.6, 1.8, 3.6);
  ctx.strokeStyle = "#000000"; ctx.lineWidth = 1.8;
  ctx.strokeRect(-2.4, -9.6, 4.8, 3.6);

  ctx.beginPath(); ctx.arc(-4.6, -9.2, 2.4, 0, Math.PI * 2);
  ctx.strokeStyle = "#000000"; ctx.lineWidth = 3.2; ctx.stroke();
  ctx.strokeStyle = "#e6ebee"; ctx.lineWidth = 1.4; ctx.stroke();

  const fk = Math.sin(now / 30) > 0 ? 1 : 0.6;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = (i % 2 ? 1.2 : 3.2) * fk;
    ctx.lineTo(Math.cos(a) * rr, -11.8 + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffe45c"; ctx.fill();
  ctx.strokeStyle = "#e8481c"; ctx.lineWidth = 1; ctx.stroke();
}

function drawGrenadeThrows() {
  const now = performance.now();
  grenadeThrows = grenadeThrows.filter((g) => now - g.startedAt < GRENADE_FLIGHT_MS);

  for (const g of grenadeThrows) {
    const t = (now - g.startedAt) / GRENADE_FLIGHT_MS;
    const x = g.fromX + (g.toX - g.fromX) * t;
    const y = g.fromY + (g.toY - g.fromY) * t;
    const arc = Math.sin(t * Math.PI) * 52;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.ellipse(g.toX, g.toY + 4, 26 - t * 12, 15 - t * 7, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#000000"; ctx.lineWidth = 5; ctx.stroke();
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -now / 40;
    ctx.strokeStyle = Math.sin(now / 45) > 0 ? "#ffd83a" : "#e8481c";
    ctx.lineWidth = 2.4; ctx.stroke();
    ctx.restore();

    ctx.fillStyle = `rgba(0,0,0,${0.35 - arc / 260})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 6.5 * (1 - arc / 80), 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    for (let i = 1; i <= 4; i++) {
      const tt = Math.max(0, t - i * 0.05);
      const sx = g.fromX + (g.toX - g.fromX) * tt;
      const sy = g.fromY + (g.toY - g.fromY) * tt - Math.sin(tt * Math.PI) * 52;
      ctx.globalAlpha = 0.95 - i * 0.2;
      blastDisc(sx, sy, 1.8 + i * 1.1, "#b8b8ae", "#7a7a72", "#1c1c1a", 1.6);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(x, y - arc);
    ctx.rotate(t * Math.PI * 5);
    ctx.scale(1.2, 1.2);
    drawGrenadeBody(now);
    ctx.restore();
  }
}

const MORTAR_FLIGHT_MS_CLIENT = 900;
function drawEnemyMortarThrows() {
  const now = performance.now();
  enemyMortarThrows = enemyMortarThrows.filter((g) => now - g.startedAt < (g.flightMs || MORTAR_FLIGHT_MS_CLIENT) + 250);
  for (const g of enemyMortarThrows) {
    const flightMs = g.flightMs || MORTAR_FLIGHT_MS_CLIENT;
    const t = Math.min(1, (now - g.startedAt) / flightMs);
    const x = g.fromX + (g.toX - g.fromX) * t;
    const y = g.fromY + (g.toY - g.fromY) * t;
    const arc = Math.sin(t * Math.PI) * (g.isMega ? 110 : 70);
    const rad = g.radius || 66;
    const zr = g.isMega ? 130 : 70; // radio del aviso largo

    // Retícula de impacto: avisa dónde va a caer para poder esquivarlo.
    ctx.save();
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(now / 70);
    ctx.strokeStyle = g.isMega ? "#ff1a1a" : "#ff4a2a";
    ctx.lineWidth = g.isMega ? 4 : 2;
    ctx.beginPath();
    ctx.arc(g.toX, g.toY, rad, 0, Math.PI * 2 * Math.min(1, t / 0.9));
    ctx.stroke();
    ctx.restore();

    // Aviso largo (bombas del jefe): zona roja rellena que se intensifica,
    // anillo exterior fijo, anillo interior que se cierra, mira y cuenta regresiva.
    if (flightMs > 1200) {
      const left = Math.max(0, (1 - t) * flightMs / 1000);
      const blink = Math.sin(now / (170 - 120 * t)) > 0;
      ctx.save();
      ctx.lineCap = "round";

      const zone = ctx.createRadialGradient(g.toX, g.toY, 0, g.toX, g.toY, zr);
      zone.addColorStop(0, `rgba(255, 60, 30, ${0.08 + 0.2 * t})`);
      zone.addColorStop(1, `rgba(255, 60, 30, ${0.2 + 0.3 * t})`);
      ctx.fillStyle = zone;
      ctx.beginPath(); ctx.arc(g.toX, g.toY, zr, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = "#000000"; ctx.lineWidth = g.isMega ? 7 : 5;
      ctx.beginPath(); ctx.arc(g.toX, g.toY, zr, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = blink ? "#ffdd55" : "#ff3a2a"; ctx.lineWidth = g.isMega ? 3.6 : 2.6;
      ctx.beginPath(); ctx.arc(g.toX, g.toY, zr, 0, Math.PI * 2); ctx.stroke();

      const inner = zr * (1 - t);
      if (inner > 4) {
        ctx.strokeStyle = "rgba(255, 240, 200, 0.85)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(g.toX, g.toY, inner, 0, Math.PI * 2); ctx.stroke();
      }

      ctx.strokeStyle = "rgba(255, 70, 40, 0.8)"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(g.toX - zr - 8, g.toY); ctx.lineTo(g.toX - zr + 16, g.toY);
      ctx.moveTo(g.toX + zr - 16, g.toY); ctx.lineTo(g.toX + zr + 8, g.toY);
      ctx.moveTo(g.toX, g.toY - zr - 8); ctx.lineTo(g.toX, g.toY - zr + 16);
      ctx.moveTo(g.toX, g.toY + zr - 16); ctx.lineTo(g.toX, g.toY + zr + 8);
      ctx.stroke();

      if (g.isMega) {
        ctx.textAlign = "center";
        ctx.font = "bold 14px Georgia, 'Times New Roman', serif";
        ctx.lineWidth = 4; ctx.strokeStyle = "#000000";
        ctx.strokeText("¡MEGA-MORTERO!", g.toX, g.toY - zr - 14);
        ctx.fillStyle = blink ? "#ff3a2a" : "#ffdd55";
        ctx.fillText("¡MEGA-MORTERO!", g.toX, g.toY - zr - 14);
      }

      ctx.textAlign = "center";
      ctx.font = "bold 20px Georgia, 'Times New Roman', serif";
      ctx.lineWidth = 4; ctx.strokeStyle = "#000000";
      ctx.strokeText(left.toFixed(1), g.toX, g.toY + 7);
      ctx.fillStyle = blink ? "#ffdd55" : "#ffffff";
      ctx.fillText(left.toFixed(1), g.toX, g.toY + 7);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y - arc);
    ctx.rotate(t * Math.PI * 4);
    ctx.fillStyle = g.isMega ? "#4a1410" : "#2b2e22";
    ctx.beginPath();
    ctx.ellipse(0, 0, g.isMega ? 11 : 5.5, g.isMega ? 7.2 : 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0d0f0b";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = `rgba(0,0,0,${Math.max(0, 0.3 - arc / 300)})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 6 * Math.max(0, 1 - arc / 100), 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// AVIÓN BOMBARDERO — biplano plateado con escarapela, cruzando a altura
// fija. Se dibuja más arriba que su propia sombra proyectada en el suelo,
// para que se lea como algo que vuela y no como una unidad más caminando.
// ---------------------------------------------------------------------------
function drawPlaneWing(cx, chordFront, chordBack, halfSpan, fill, dark, edge) {
  const x = cx - chordBack;
  const w = chordFront + chordBack;
  const y = -halfSpan;
  const h = halfSpan * 2;
  const r = Math.min(6, w / 2, h / 2);
  roundRect(x, y, w, h, r);
  ctx.fillStyle = dark;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h * 0.56);
  ctx.restore();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.8;
  roundRect(x, y, w, h, r);
  ctx.stroke();
}

function drawPlanes() {
  if (!latestState || !Array.isArray(latestState.planes)) return;
  const now = performance.now();

  // Mantenemos tu audio de la avioneta
  if (window.updatePlaneAudio) {
    window.updatePlaneAudio(latestState.planes, latestState.navajas);
  }

  for (const pl of latestState.planes) {
    const groundX = pl.x, groundY = pl.y;
    const angle = pl.angle || 0;
    const bob = Math.sin(now / 480 + groundX * 0.01) * 2.2;
    const flyX = groundX, flyY = groundY - PLANE_ALTITUDE_PX + bob;

    // Sombra proyectada con la silueta real del avión en la arena
    ctx.save();
    ctx.translate(groundX, groundY);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#0a0a08";
    ctx.beginPath();
    // Fuselaje, alas y cola en la sombra
    ctx.ellipse(0, 0, 48, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(6, 0, 12, 42, 0, 0, Math.PI * 2);
    ctx.ellipse(-35, 0, 7, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const backX = -Math.cos(angle), backY = -Math.sin(angle);
    const perpX = -Math.sin(angle), perpY = Math.cos(angle);
    
    for (let i = 0; i < 5; i++) {
      const trailAge = (now / 4.5 + i * 46) % 260;
      const dist = 52 + trailAge * 0.55;
      const tx = flyX + backX * dist + perpX * Math.sin(i * 1.7) * 2.4;
      const ty = flyY + backY * dist + perpY * Math.sin(i * 1.7) * 2.4;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.28 - trailAge / 900);
      ctx.fillStyle = "#cfcabb";
      ctx.beginPath();
      ctx.arc(tx, ty, 3 + trailAge * 0.025, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(flyX, flyY);
    ctx.rotate(angle);
    ctx.scale(1.5, 1.5); // Tamaño imponente
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const bayOpen = (planeBombOpenUntil.get(pl.id) || 0) > now;

    // --- DISEÑO ORIGINAL PLATEADO ---
    drawPlaneWing(2, 9, 7, 34, "#8a9096", "#565d63", "#12171a");

    for (const wy of [-14, 14]) {
      ctx.strokeStyle = "#2a2f26"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(4, wy * 0.5); ctx.lineTo(6, wy); ctx.stroke();
      ctx.fillStyle = "#1c1f1a";
      ctx.beginPath(); ctx.ellipse(7, wy, 3.6, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#0d0f0b"; ctx.lineWidth = 1; ctx.stroke();
    }

    ctx.strokeStyle = "#2a2f26"; ctx.lineWidth = 1.4;
    for (const wy of [-22, -11, 11, 22]) {
      ctx.beginPath(); ctx.moveTo(1, wy); ctx.lineTo(3, wy); ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(34, 0);
    ctx.quadraticCurveTo(26, -6, 10, -5.5);
    ctx.quadraticCurveTo(-2, -6.5, -20, -4);
    ctx.quadraticCurveTo(-32, -3, -36, 0);
    ctx.quadraticCurveTo(-32, 3, -20, 4);
    ctx.quadraticCurveTo(-2, 6.5, 10, 5.5);
    ctx.quadraticCurveTo(26, 6, 34, 0);
    ctx.closePath();
    const fuseGrad = ctx.createLinearGradient(0, -6, 0, 6);
    fuseGrad.addColorStop(0, "#c3cbd0");
    fuseGrad.addColorStop(0.5, "#9aa2a8");
    fuseGrad.addColorStop(1, "#6d757a");
    ctx.fillStyle = fuseGrad;
    ctx.fill();
    ctx.strokeStyle = "#12171a"; ctx.lineWidth = 1.8; ctx.stroke();

    ctx.fillStyle = bayOpen ? "#3a3f30" : "#565d63";
    roundRect(-10, -3.2, 16, 6.4, 1.6);
    ctx.fill();
    ctx.strokeStyle = "#12171a"; ctx.lineWidth = 1.2; ctx.stroke();
    if (bayOpen) {
      ctx.fillStyle = "rgba(255, 214, 110, 0.7)";
      ctx.beginPath(); ctx.ellipse(-2, 0, 4, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    }

    drawPlaneWing(4, 10, 6, 36, "#d7dde1", "#9aa2a8", "#12171a");
    for (const wy of [-24, 24]) {
      ctx.fillStyle = "#c8322a";
      ctx.beginPath(); ctx.arc(3, wy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e8e2c8";
      ctx.beginPath(); ctx.arc(3, wy, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2a5aa0";
      ctx.beginPath(); ctx.arc(3, wy, 1.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#12171a"; ctx.lineWidth = 1.2; ctx.stroke();
    }

    ctx.fillStyle = "#2a2f26";
    ctx.beginPath(); ctx.ellipse(-4, 0, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#12171a"; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = UNIFORMS.enemigo.skin;
    ctx.beginPath(); ctx.arc(-5, 0, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1c2126";
    ctx.beginPath(); ctx.ellipse(-4, -0.6, 2.4, 1.6, 0, 0, Math.PI * 2); ctx.fill();

    drawPlaneWing(-30, 4, 4, 13, "#b7bfc4", "#7d868b", "#12171a");
    ctx.fillStyle = "#c8322a";
    roundRect(-38, -2.2, 6, 4.4, 1.2);
    ctx.fill();
    ctx.strokeStyle = "#12171a"; ctx.lineWidth = 1.2; ctx.stroke();

    ctx.fillStyle = "#2a2f26";
    ctx.beginPath(); ctx.arc(28, 0, 5.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#12171a"; ctx.lineWidth = 1.6; ctx.stroke();

    ctx.save();
    ctx.translate(34, 0);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#c3cbd0";
    ctx.beginPath(); ctx.ellipse(0, 0, 9.5, 9.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.rotate((now / 18) % (Math.PI * 2));
    ctx.strokeStyle = "#12171a"; ctx.lineWidth = 2.2;
    for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#4a4d40";
    ctx.beginPath(); ctx.arc(34, 0, 2, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// FUEGO ANTIAÉREO (eje Z)
// El proyectil sube del suelo al cielo hasta la altitud del avión
// (PLANE_ALTITUDE_PX): se dibuja en pantalla en (x, y - z), con su sombra
// pegada al suelo, un hilo punteado que marca la altura, perspectiva (se
// achica al subir) y una estela. Al llegar estalla en una nube de metralla
// (flak) sobre el avión. Es solo visual: el avión sigue siendo invulnerable.
// Se activa cuando hay un avión a la vista y ningún enemigo terrestre cerca.
// ---------------------------------------------------------------------------
function pickAntiAirTarget(p) {
  return null;
}
function fireAntiAir() {}
function drawAntiAirShots() {}
function drawAntiAirBursts() {}
function __aaMuerto(p) {
  if (!latestState || !Array.isArray(latestState.planes) || latestState.planes.length === 0) return null;
  let best = null, bestD = AA_RANGE_PX;
  for (const pl of latestState.planes) {
    const d = Math.hypot(pl.x - p.x, pl.y - p.y);
    if (d < bestD) { best = pl; bestD = d; }
  }
  if (!best) return null;
  for (const e of latestState.enemies) {
    if (!e.alive) continue;
    const r = ENEMY_RADIUS[e.type] || 12;
    if (Math.hypot(e.x - p.x, e.y - p.y) < 210 + r * 0.5) return null;
  }
  return best;
}

function fireAntiAir(pl) {
  const now = performance.now();
  const p = latestState.navajas;
  const rp = renderPos.get("navajas") || p;
  const sign = p.dir === "left" ? -1 : 1;
  const mx = rp.x + sign * 26;
  const my = rp.y - 55;
  const z0 = 52;
  const offX = (Math.random() - 0.5) * 52;
  const offY = (Math.random() - 0.5) * 40;
  antiAirShots.push({
    planeId: pl.id, mx, my, z0, gx0: mx, gy0: my + z0,
    offX, offY, tx: pl.x + offX, ty: pl.y + offY, startedAt: now,
  });
  if (antiAirShots.length > 12) antiAirShots.shift();
  antiAirPoseUntil = now + AA_POSE_MS;
  shakeUntil = Math.max(shakeUntil, now + 110);
  shakeMag = Math.max(shakeMag, 1.8);
}

function aaShotPos(s, u) {
  const e = 1 - Math.pow(1 - u, 1.8);
  return {
    gx: s.gx0 + (s.tx - s.gx0) * u,
    gy: s.gy0 + (s.ty - s.gy0) * u,
    z: s.z0 + (PLANE_ALTITUDE_PX - s.z0) * e,
  };
}

function drawAntiAirShots() {
  const now = performance.now();
  const alive = [];
  for (const s of antiAirShots) {
    const pl = latestState && Array.isArray(latestState.planes)
      ? latestState.planes.find((q) => q.id === s.planeId) : null;
    if (pl) { s.tx = pl.x + s.offX; s.ty = pl.y + s.offY; }

    const t = (now - s.startedAt) / AA_FLIGHT_MS;
    if (t >= 1) {
      antiAirBursts.push({
        x: s.tx, y: s.ty - PLANE_ALTITUDE_PX, gy: s.ty,
        startedAt: now, seed: (Math.floor(s.startedAt) % 628) / 100,
      });
      continue;
    }
    alive.push(s);

    const head = aaShotPos(s, t);
    const zk = head.z / PLANE_ALTITUDE_PX;
    const sc = 1 - 0.4 * zk;
    const hx = head.gx, hy = head.gy - head.z;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Sombra sobre la arena
    ctx.fillStyle = `rgba(0, 0, 0, ${0.32 - 0.14 * zk})`;
    ctx.beginPath();
    ctx.ellipse(head.gx, head.gy + 4, 5.5 * sc, 2.4 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hilo de altura (sombra → proyectil)
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = "rgba(255, 240, 180, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(head.gx, head.gy + 4); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.setLineDash([]);

    // Estela
    const trail = [];
    for (let i = 6; i >= 0; i--) {
      const q = aaShotPos(s, Math.max(0, t - i * 0.04));
      trail.push([q.gx, q.gy - q.z]);
    }
    ctx.globalAlpha = 0.9;
    celLine(trail, 2.6 * sc, "#ffd83a", "#1a1208", 1.4);
    ctx.globalAlpha = 1;

    // Proyectil
    blastDisc(hx, hy, 3.6 * sc + 0.6, "#fff3c2", "#ffd83a", "#1a1208", 1.6);
    ctx.restore();

    // Fogonazo de boca, apuntando al cielo
    const age = now - s.startedAt;
    if (age < 90) {
      const q = aaShotPos(s, 0.12);
      let dx = q.gx - s.mx, dy = (q.gy - q.z) - s.my;
      const dl = Math.hypot(dx, dy) || 1;
      drawMuzzleFlash(s.mx, s.my, dx / dl, dy / dl, 1 - age / 90, 1.3);
    }
  }
  antiAirShots = alive;
}

function drawAntiAirBursts() {
  const now = performance.now();
  antiAirBursts = antiAirBursts.filter((b) => now - b.startedAt < AA_BURST_MS);

  for (const b of antiAirBursts) {
    const t = (now - b.startedAt) / AA_BURST_MS;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Sombra del estallido sobre la arena
    ctx.globalAlpha = 0.22 * (1 - t);
    ctx.fillStyle = "#0a0a08";
    ctx.beginPath();
    ctx.ellipse(b.x, b.gy + 6, 22 + t * 22, 8 + t * 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Humo negro de metralla
    for (let i = 0; i < 6; i++) {
      const a = b.seed + i * 1.05;
      const d = blastEase(Math.min(1, t / 0.55)) * (10 + (i % 3) * 7);
      const r = 6 + (i % 3) * 1.8 + t * 9;
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      blastDisc(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d * 0.75 - t * 16, r, "#3a3a38", "#1c1c1a", "#000000", 2);
    }
    ctx.globalAlpha = 1;

    // Bola de fuego
    if (t < 0.38) {
      const u = t / 0.38;
      ctx.globalAlpha = 1 - u * u;
      const R = 7 + blastEase(u) * 15;
      blastDisc(b.x, b.y, R, "#ff8a1f", "#c2560f", "#000000", 2.5);
      blastDisc(b.x, b.y, R * 0.55, "#ffd83a", "#f5a51a", "#c2560f", 1.6);
      ctx.globalAlpha = 1;
    }

    // Destello inicial
    if (t < 0.16) {
      const u = t / 0.16;
      ctx.globalAlpha = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
      const R = 12 + blastEase(u) * 18;
      blastStar(b.x, b.y, R, 8, b.seed, "#ffe45c", "#000000", 3);
      blastStar(b.x, b.y, R * 0.55, 8, b.seed + 0.2, "#ffffff", "#ffb347", 1.6);
      ctx.globalAlpha = 1;
    }

    // Esquirlas
    if (t < 0.45) {
      const u = t / 0.45;
      ctx.globalAlpha = 1 - u;
      for (let i = 0; i < 9; i++) {
        const a = b.seed + i * 0.7;
        const r0 = 8 + blastEase(u) * (30 + (i % 3) * 6);
        const r1 = r0 + 7;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(a) * r0, b.y + Math.sin(a) * r0 * 0.8);
        ctx.lineTo(b.x + Math.cos(a) * r1, b.y + Math.sin(a) * r1 * 0.8);
        ctx.strokeStyle = "#000000"; ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = i % 2 ? "#ffe45c" : "#ffffff"; ctx.lineWidth = 1.8; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}

// Torpedo del jefe bombardero: casco de acero con franjas, punta con espoleta
// parpadeante, aletas, hélice de cola, llama y estela. Apunta en su dirección
// de caída y proyecta su sombra al suelo.
function drawTorpedo(x, y, t, g, now) {
  const ang = Math.atan2(g.toY - g.fromY, g.toX - g.fromX);
  const gy = y + PLANE_ALTITUDE_PX * (1 - t);

  ctx.save();
  ctx.globalAlpha = 0.16 + 0.24 * t;
  ctx.fillStyle = "#000000";
  ctx.beginPath(); ctx.ellipse(x, gy, 8 + 8 * t, 3.5 + 3.5 * t, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Estela de humo y fuego
  ctx.save();
  const bx = -Math.cos(ang), by = -Math.sin(ang);
  for (let i = 0; i < 9; i++) {
    const d = 34 + i * 8;
    ctx.globalAlpha = 0.5 * (1 - i / 9);
    ctx.fillStyle = i < 3 ? "#ffb347" : "#5a5a54";
    ctx.beginPath();
    ctx.arc(x + bx * d + Math.sin(now / 90 + i) * 2, y + by * d + Math.cos(now / 90 + i) * 2, 3 + i * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang + 0.05 * Math.sin(now / 70));
  const k = 0.9 + 0.15 * t;
  ctx.scale(k, k);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Llama de la cola
  const fl = 0.75 + 0.25 * Math.sin(now / 35);
  const fg = ctx.createLinearGradient(-32, 0, -64 * fl, 0);
  fg.addColorStop(0, "rgba(255, 240, 170, 0.95)");
  fg.addColorStop(0.5, "rgba(255, 140, 40, 0.7)");
  fg.addColorStop(1, "rgba(255, 60, 20, 0)");
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.moveTo(-32, -4); ctx.lineTo(-64 * fl, 0); ctx.lineTo(-32, 4); ctx.closePath(); ctx.fill();

  // Aletas
  ctx.fillStyle = "#1c1f17"; ctx.strokeStyle = "#0a0b08"; ctx.lineWidth = 1.6;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-14, s * 6); ctx.lineTo(-30, s * 17); ctx.lineTo(-30, s * 7); ctx.lineTo(-22, s * 6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // Cuerpo
  const cuerpo = () => {
    ctx.beginPath();
    ctx.moveTo(-26, -6.5); ctx.lineTo(12, -6.5);
    ctx.quadraticCurveTo(28, -6, 34, 0);
    ctx.quadraticCurveTo(28, 6, 12, 6.5);
    ctx.lineTo(-26, 6.5); ctx.closePath();
  };
  cuerpo();
  const bg = ctx.createLinearGradient(0, -6.5, 0, 6.5);
  bg.addColorStop(0, "#9aa38c"); bg.addColorStop(0.35, "#59634d"); bg.addColorStop(1, "#20241b");
  ctx.fillStyle = bg; ctx.fill();
  ctx.save();
  cuerpo(); ctx.clip();
  ctx.fillStyle = "#d9b53a"; ctx.fillRect(2, -7, 4, 14); ctx.fillRect(8, -7, 2, 14);
  ctx.fillStyle = "#c62d22"; ctx.fillRect(-16, -7, 5, 14);
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)"; ctx.fillRect(-26, -5, 60, 1.8);
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)"; ctx.fillRect(-26, 3.5, 60, 3);
  ctx.restore();
  cuerpo(); ctx.strokeStyle = "#0d0f0b"; ctx.lineWidth = 2; ctx.stroke();

  // Remaches
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  for (let rx = -22; rx <= -6; rx += 5) {
    ctx.beginPath(); ctx.arc(rx, -4.2, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx, 4.2, 0.9, 0, Math.PI * 2); ctx.fill();
  }

  // Espoleta roja parpadeante en la punta
  const blink = 0.5 + 0.5 * Math.sin(now / 90);
  const ng = ctx.createRadialGradient(31, 0, 0.5, 31, 0, 5);
  ng.addColorStop(0, `rgba(255, ${Math.round(120 + 100 * blink)}, 60, 1)`);
  ng.addColorStop(1, "rgba(255, 40, 20, 0)");
  ctx.fillStyle = ng;
  ctx.beginPath(); ctx.arc(31, 0, 5, 0, Math.PI * 2); ctx.fill();

  // Hélice de cola girando
  const hp = Math.abs(Math.cos(now / 22));
  ctx.strokeStyle = "rgba(200, 200, 190, 0.7)"; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(-29, 0, 1.6, 9 * hp + 1, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

const BOMB_FLIGHT_MS_CLIENT = 700;
function drawPlaneBombThrows() {
  const now = performance.now();
  planeBombThrows = planeBombThrows.filter((g) => now - g.startedAt < (g.flightMs || BOMB_FLIGHT_MS_CLIENT) + 250);
  for (const g of planeBombThrows) {
    const flightMs = g.flightMs || BOMB_FLIGHT_MS_CLIENT;
    const t = Math.min(1, (now - g.startedAt) / flightMs);
    const x = g.fromX + (g.toX - g.fromX) * t;
    const y = g.fromY + (g.toY - g.fromY) * t;

    ctx.save();
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(now / 70);
    ctx.strokeStyle = "#ff4a2a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(g.toX, g.toY, 60, 0, Math.PI * 2 * Math.min(1, t / 0.85));
    ctx.stroke();
    ctx.restore();

    // Bombas del jefe (aviso largo, igual que los morteros de los jefes anteriores):
    // zona roja que se intensifica y anillo interior que se cierra hasta el impacto.
    if (flightMs > 1000) {
      const blink = Math.sin(now / (170 - 120 * t)) > 0;
      ctx.save();
      const zone = ctx.createRadialGradient(g.toX, g.toY, 0, g.toX, g.toY, 62);
      zone.addColorStop(0, `rgba(255, 60, 30, ${0.08 + 0.2 * t})`);
      zone.addColorStop(1, `rgba(255, 60, 30, ${0.2 + 0.3 * t})`);
      ctx.fillStyle = zone;
      ctx.beginPath(); ctx.arc(g.toX, g.toY, 62, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#000000"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(g.toX, g.toY, 62, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = blink ? "#ffdd55" : "#ff3a2a"; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(g.toX, g.toY, 62, 0, Math.PI * 2); ctx.stroke();
      const inner = 62 * (1 - t);
      if (inner > 4) {
        ctx.strokeStyle = "rgba(255, 240, 200, 0.85)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(g.toX, g.toY, inner, 0, Math.PI * 2); ctx.stroke();
      }
      // Contador numérico: segundos que faltan para el impacto.
      const left = Math.max(0, (1 - t) * flightMs / 1000);
      ctx.textAlign = "center";
      ctx.font = "bold 20px Georgia, 'Times New Roman', serif";
      ctx.lineWidth = 4; ctx.strokeStyle = "#000000";
      ctx.strokeText(left.toFixed(1), g.toX, g.toY + 7);
      ctx.fillStyle = blink ? "#ffdd55" : "#ffffff";
      ctx.fillText(left.toFixed(1), g.toX, g.toY + 7);
      ctx.restore();
    }

    if (flightMs > 1000) { // bombas del jefe bombardero → torpedo
      drawTorpedo(x, y, t, g, now);
      continue;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.15 * Math.sin(t * 9));
    ctx.fillStyle = "#2c2f24";
    roundRect(-2.6, -9, 5.2, 14, 2.4);
    ctx.fill();
    ctx.strokeStyle = "#0d0f0b"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = "#12140f";
    ctx.beginPath();
    ctx.moveTo(-2.6, 5); ctx.lineTo(-5.4, 9); ctx.lineTo(-2.6, 7); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2.6, 5); ctx.lineTo(5.4, 9); ctx.lineTo(2.6, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

const SMOKE_LIFETIME_MS = 4000;

function spawnLingeringSmoke(x, y, now) {
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    lingeringSmokes.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y - 6 + (Math.random() - 0.5) * 14,
      radio: 11 + Math.random() * 6,
      drift: (Math.random() - 0.5) * 0.008,
      flip: Math.random() < 0.5 ? -1 : 1,
      startedAt: now + 300 + i * 90,
    });
  }
}

const SMOKE_COLORS = ["#2b2b2b", "#4a4a4a"];
const SMOKE_PUFF = [
  [-0.85, 0.4, 0.62, 0], [0.9, 0.35, 0.66, 0], [0, 0.3, 0.9, 0],
  [-0.45, -0.25, 0.62, 1], [0.35, -0.5, 0.7, 1], [-0.05, -0.05, 0.72, 1],
];

function drawLingeringSmokes() {
  const now = performance.now();
  lingeringSmokes = lingeringSmokes.filter((s) => now - s.startedAt <= SMOKE_LIFETIME_MS);
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#000000";
  ctx.lineJoin = "round";
  for (const s of lingeringSmokes) {
    const age = now - s.startedAt;
    if (age < 0) continue;
    const t = age / SMOKE_LIFETIME_MS;
    const cx = s.x + s.drift * age;
    const cy = s.y - age * 0.011;
    const r = s.radio + age * 0.005 + 6 * blastEase(Math.min(1, age / 500));
    ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    for (const [dx, dy, k, c] of SMOKE_PUFF) {
      ctx.fillStyle = SMOKE_COLORS[c];
      ctx.beginPath();
      ctx.arc(cx + dx * s.flip * r, cy + dy * r, r * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

const EXPLOSION_DURATION_MS = 1100;

function drawExplosions() {
  const now = performance.now();
  explosionAnims = explosionAnims.filter((e) => now - e.startedAt < EXPLOSION_DURATION_MS);

  for (const ex of explosionAnims) {
    const t = (now - ex.startedAt) / EXPLOSION_DURATION_MS;
    const seed = (Math.floor(ex.startedAt) % 628) / 100;
    const megaScale = ex.isMega ? 1.8 : 1;

    ctx.save();
    if (ex.isMega) {
      ctx.translate(ex.x, ex.y);
      ctx.scale(megaScale, megaScale);
      ctx.translate(-ex.x, -ex.y);
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (const delay of [0, 0.06]) {
      const u = (t - delay) / 0.42;
      if (u <= 0 || u >= 1) continue;
      const e = blastEase(u);
      const sc = delay ? 0.72 : 1;
      ctx.globalAlpha = 1 - u * u;
      ctx.beginPath();
      ctx.ellipse(ex.x, ex.y + 4, 112 * e * sc, 66 * e * sc, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "#000000"; ctx.lineWidth = 8 * (1 - u) + 3; ctx.stroke();
      ctx.strokeStyle = delay ? "#ffb347" : "#fff0c2"; ctx.lineWidth = 4 * (1 - u) + 1; ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (t < 0.7) {
      const u = t / 0.7;
      const e = blastEase(u);
      ctx.globalAlpha = 1 - u * u;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + seed;
        const rr = 18 + e * (70 + (i % 3) * 8);
        blastDisc(ex.x + Math.cos(a) * rr, ex.y + 6 + Math.sin(a) * rr * 0.42, 7 + u * 9 + (i % 3) * 1.5, "#c9b07c", "#8f7748", "#3b2e18", 2.5);
      }
      ctx.globalAlpha = 1;
    }

    if (t < 0.16) {
      const u = t / 0.16;
      ctx.globalAlpha = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
      const R = 26 + blastEase(u) * 56;
      blastStar(ex.x, ex.y - 6, R, 9, seed, "#ffe45c", "#000000", 4);
      blastStar(ex.x, ex.y - 6, R * 0.6, 9, seed + 0.2, "#ffffff", "#ffb347", 2);
      ctx.globalAlpha = 1;
    }

    const grow = blastEase(Math.min(1, t / 0.2));
    const baseR = 10 + grow * 40;
    const cy = ex.y - 4 - 16 * blastEase(Math.min(1, t / 0.4));
    BLAST_LAYERS.forEach(([fill, dark, edge, lw, f, end], k) => {
      const u = t / end;
      if (u >= 1) return;
      const s = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      blastBlob(ex.x, cy, baseR * f * s, seed + k * 0.5, k, fill, dark, edge, lw);
    });

    if (t > 0.3 && t < 0.8) {
      const env = Math.sin(((t - 0.3) / 0.5) * Math.PI);
      for (let i = 0; i < 5; i++) {
        const fx = ex.x + (i - 2) * 11 + Math.sin(i * 3.1) * 4;
        const fy = ex.y + 6 + Math.abs(i - 2) * 2;
        const h = (16 + (i % 3) * 6) * env * (0.75 + 0.25 * Math.sin(now / 55 + i * 2.3));
        blastFlame(fx, fy, h, 6.5, "#ff7a1a", "#000000", 2.6);
        blastFlame(fx + 0.5, fy - 0.5, h * 0.6, 3.6, "#ffd83a", "#e8801a", 1.4);
      }
    }

    if (t < 0.55) {
      const u = t / 0.55;
      ctx.globalAlpha = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
      for (let i = 0; i < 14; i++) {
        const a = ((i * 137.5) % 360) * (Math.PI / 180);
        const sp = 70 + (i % 5) * 20;
        const arcH = 26 + (i % 4) * 9;
        const at = (uu) => [
          ex.x + Math.cos(a) * sp * blastEase(uu),
          ex.y + Math.sin(a) * sp * blastEase(uu) * 0.5 - Math.sin(uu * Math.PI * 0.9) * arcH,
        ];
        const [px, py] = at(u);
        const [qx, qy] = at(Math.max(0, u - 0.09));
        ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py);
        ctx.strokeStyle = "#000000"; ctx.lineWidth = 5; ctx.stroke();
        ctx.strokeStyle = i % 2 ? "#ffe45c" : "#ffffff"; ctx.lineWidth = 2.4; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (t < 0.85) {
      const tt = t * 1.1;
      ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.15;
      for (let i = 0; i < 12; i++) {
        const a = ((i * 97.3 + 20) % 360) * (Math.PI / 180);
        const d = (50 + (i % 5) * 16) * Math.min(t * 1.5, 0.8);
        const v0 = 95 + (i % 4) * 26;
        const lift = Math.min(0, -v0 * tt + 130 * tt * tt);
        const sz = 3 + (i % 3) * 0.9;
        ctx.save();
        ctx.translate(ex.x + Math.cos(a) * d, ex.y + Math.sin(a) * d * 0.5 + lift);
        ctx.rotate(lift < 0 ? tt * 9 + i : i);
        ctx.fillStyle = i % 2 ? "#7a5a38" : "#4a3822";
        ctx.strokeStyle = "#000000"; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.rect(-sz, -sz * 0.7, sz * 2, sz * 1.4);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}

const VEHICLE_BLAST_MS = 950;    // el estallido en sí: flash, ondas, bola de fuego
const VEHICLE_WRECK_MS = 5000;   // el casco quedando ahí, ardiendo de verdad
const VEHICLE_FADE_MS = 400;     // se apaga y desaparece al final
const VEHICLE_EXPLOSION_DURATION_MS = VEHICLE_BLAST_MS + VEHICLE_WRECK_MS + VEHICLE_FADE_MS;

// ---------------------------------------------------------------------------
// EXPLOSIÓN DE TANQUE — la destrucción "de verdad": flash blanco, doble onda
// expansiva metálica, bola de fuego sucia en capas, chispas de metal al
// rojo, placas de chatarra con física real, LA TORRETA SALIENDO DISPARADA
// y cayendo girando, y humo negro denso que se va abriendo. A propósito muy
// distinta de la fragmentación de granadas, mortero y bombas.
// ---------------------------------------------------------------------------
// Llamaradas que trepan desde un punto — reutilizables tanto para el casco
// calcinado como para la torreta caída ardiendo aparte.
function drawFlameLicks(x, y, et, intensity, sizeMul, seed) {
  if (intensity <= 0.02) return;
  for (let i = 0; i < 5; i++) {
    const a = seed + i * 1.37;
    const baseX = x + Math.sin(a) * 11 * sizeMul;
    const flicker = 0.55 + 0.45 * Math.sin(et * 13 + i * 2.4);
    const h = (11 + (i % 3) * 5) * sizeMul * intensity * flicker;
    if (h < 1.5) continue;
    blastFlame(baseX, y, h, 5.2 * sizeMul, "#ff7a1a", "#000000", 2 * sizeMul);
    blastFlame(baseX + 0.6 * sizeMul, y - 0.6 * sizeMul, h * 0.55, 2.8 * sizeMul, "#ffd83a", "#e8801a", 1.2 * sizeMul);
  }
}

// Columna de humo continua y creíble, calculada en función del tiempo
// transcurrido — no hace falta guardar partículas: cada "bocanada" se
// reconstruye sola en base a su ciclo, así que sube y se disipa sin parar
// mientras el incendio esté vivo.
function drawSmokeColumn(x, y, et, intensity, sizeMul) {
  if (intensity <= 0.02) return;
  const puffCount = 6;
  const cycle = 2.1;
  for (let i = 0; i < puffCount; i++) {
    const offset = (i / puffCount) * cycle;
    const localT = ((et + offset) % cycle) / cycle;
    const rise = localT * 74 * sizeMul;
    const drift = Math.sin(et * 0.55 + i * 1.8) * 11 * sizeMul;
    const r = (6.5 + localT * 15) * sizeMul;
    const alpha = intensity * 0.55 * (1 - localT);
    if (alpha <= 0.02) continue;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = i % 2 ? "#141412" : "#3a3a34";
    ctx.beginPath();
    ctx.arc(x + drift, y - 10 * sizeMul - rise, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Casco calcinado — silueta oscura, chapa cuarteada y el hueco negro donde
// antes iba la torreta (que ya salió volando).
function drawCharredHull(x, y, type, angle) {
  const tier = TANK_TIERS[type] || TANK_TIERS.tanqueta;
  const hl = tier.hullLen / 2, hw = tier.hullWid / 2;
  const k = tankScale(type);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(k, k);

  ctx.fillStyle = "#100e0a";
  roundRect(-hl, -hw, hl * 2, hw * 2, 4);
  ctx.fill();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  roundRect(-hl, -hw, hl * 2, hw * 2, 4);
  ctx.stroke();

  ctx.strokeStyle = "rgba(120, 55, 25, 0.35)";
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo((i * hl) / 2.4, -hw + 1.5);
    ctx.lineTo((i * hl) / 2.4, hw - 1.5);
    ctx.stroke();
  }

  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.ellipse(2, 0, hw * 0.5, hw * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// EXPLOSIÓN DE TANQUE — estallido violento en varias oleadas (con
// munición cocinándose adentro) y, después, un casco calcinado que se
// queda ardiendo con llamas, humo y brasas durante varios segundos antes
// de apagarse del todo. Nada que ver con la fragmentación de granadas,
// mortero o bombas.
// ---------------------------------------------------------------------------
function drawVehicleExplosions(layer = "fx") {
  const now = performance.now();
  vehicleExplosionAnims = vehicleExplosionAnims.filter((e) => now - e.startedAt < VEHICLE_EXPLOSION_DURATION_MS);

  for (const ex of vehicleExplosionAnims) {
    const elapsedMs = now - ex.startedAt;
    const et = elapsedMs / 1000;
    const s = ex.size || 1;
    const seed = (Math.floor(ex.startedAt) % 628) / 100;
    const fadeStart = VEHICLE_BLAST_MS + VEHICLE_WRECK_MS;
    const overallAlpha = elapsedMs > fadeStart ? Math.max(0, 1 - (elapsedMs - fadeStart) / VEHICLE_FADE_MS) : 1;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.globalAlpha = overallAlpha;

    // ---- Chatarra: física con tiempo topado — cae, aterriza y se queda ahí. ----
    // layer "ground": lo que ya quedó en el suelo (casco, chatarra, torreta caída,
    // llamas) — se dibuja ANTES de árboles y obstáculos para que queden debajo.
    // layer "fx": lo que vuela o sube (estallido, piezas en el aire, humo, brasas).
    const debrisLandT = 0.62;
    const etDebris = Math.min(et, debrisLandT);
    const debrisLanded = et >= debrisLandT;
    for (const d of ((layer === "ground") === debrisLanded ? (ex.debris || []) : [])) {
      const grav = 260;
      const dx = ex.x + Math.cos(d.angle) * d.speed * etDebris;
      const dy = ex.y - 8 * s + Math.sin(d.angle) * d.speed * etDebris * 0.6 + 0.5 * grav * d.drop * etDebris * etDebris;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(d.rot * etDebris * 4);
      ctx.fillStyle = "#2a2d22";
      ctx.strokeStyle = "#0d0f0b";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.rect(-d.size, -d.size * 0.6, d.size * 2, d.size * 1.2);
      ctx.fill(); ctx.stroke();
      if (et > debrisLandT + 0.3 && Math.sin(et * 9 + d.angle * 5) > 0.5) {
        ctx.fillStyle = "#ff7a2a";
        ctx.beginPath(); ctx.arc(0, -d.size * 0.4, 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // ---- LA TORRETA SALE VOLANDO y cae girando, quedando como un resto
    // más del wreck, con su propia llamita saliendo de la escotilla. ----
    let turretX = ex.x, turretY = ex.y;
    if (ex.turret) {
      const grav = 280;
      const turretLandT = 0.85;
      const etT = Math.min(et, turretLandT);
      turretX = ex.x + ex.turret.vx * 55 * etT;
      turretY = ex.y - 12 * s + ex.turret.vy * 55 * etT + 0.5 * grav * etT * etT;
      if ((layer === "ground") === (et >= turretLandT)) {
      ctx.save();
      ctx.translate(turretX, turretY);
      ctx.rotate(ex.turret.rot0 + ex.turret.spin * etT * 6);
      ctx.fillStyle = "#15140f";
      ctx.beginPath(); ctx.arc(0, 0, ex.turret.r * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2c3226";
      ctx.beginPath(); ctx.arc(0, 0, ex.turret.r * s * 0.78, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#15140f";
      ctx.fillRect(0, -1.8 * s, ex.turret.barrelLen * s * 0.55, 3.6 * s);
      ctx.restore();
      }
    }

    // ---- Fase 1: el estallido (primeros ~950ms) — flash, ondas, bola de
    // fuego principal y 3 mini-explosiones de "cocinado" desfasadas, para
    // que se sienta como munición reventando adentro y no una bola limpia. ----
    if (layer === "fx" && elapsedMs < VEHICLE_BLAST_MS) {
      const t = elapsedMs / VEHICLE_BLAST_MS;

      if (t < 0.1) {
        ctx.globalAlpha = overallAlpha * (1 - t / 0.1);
        ctx.fillStyle = "#fffdf0";
        ctx.beginPath(); ctx.arc(ex.x, ex.y - 6 * s, 34 * s, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = overallAlpha;
      }

      for (const delay of [0, 0.05]) {
        const u = (t - delay) / 0.42;
        if (u <= 0 || u >= 1) continue;
        const eas = blastEase(u);
        ctx.globalAlpha = overallAlpha * (1 - u * u);
        ctx.beginPath();
        ctx.ellipse(ex.x, ex.y + 4 * s, 92 * s * eas, 50 * s * eas, 0, 0, Math.PI * 2);
        ctx.strokeStyle = delay ? "#ffb347" : "#e7ecef";
        ctx.lineWidth = (7 * s) * (1 - u) + 2;
        ctx.stroke();
      }
      ctx.globalAlpha = overallAlpha;

      const grow = blastEase(Math.min(1, t / 0.3));
      const baseR = (13 + grow * 36) * s;
      const fireCy = ex.y - 4 * s - 12 * s * blastEase(Math.min(1, t / 0.42));
      const tankLayers = [
        ["#c8322a", "#4a120c", "#000000", 4, 1, 0.58],
        ["#e8481c", "#8f200f", "#2c0b06", 2.6, 0.72, 0.46],
        ["#ff8a1f", "#c8540e", "#5c1f0a", 2.2, 0.48, 0.35],
        ["#ffce5c", "#f0951a", "#a8480f", 1.8, 0.24, 0.24],
      ];
      tankLayers.forEach(([fill, dark, edge, lw, f, end], k) => {
        const u = t / end;
        if (u >= 1) return;
        const fade = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
        blastBlob(ex.x, fireCy, baseR * f * fade, seed + k * 0.6, k, fill, dark, edge, lw);
      });

      // Munición cocinándose: 3 mini estallidos desfasados alrededor del casco.
      const cookOffs = [[0.18, 20, -13], [0.34, -17, -7], [0.5, 9, 9]];
      for (const [delay, ox2, oy2] of cookOffs) {
        const u = (t - delay) / 0.3;
        if (u <= 0 || u >= 1) continue;
        const fade = u < 0.6 ? u / 0.6 : 1 - (u - 0.6) / 0.4;
        ctx.globalAlpha = overallAlpha * fade;
        const r2 = (6 + blastEase(u) * 14) * s;
        const g2 = ctx.createRadialGradient(ex.x + ox2 * s, ex.y + oy2 * s, 0, ex.x + ox2 * s, ex.y + oy2 * s, r2);
        g2.addColorStop(0, "#fff3c2");
        g2.addColorStop(0.4, "#ff9a2a");
        g2.addColorStop(1, "rgba(180,50,20,0)");
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(ex.x + ox2 * s, ex.y + oy2 * s, r2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = overallAlpha;

      if (t < 0.5) {
        const u = t / 0.5;
        ctx.globalAlpha = overallAlpha * (u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4);
        for (let i = 0; i < 10; i++) {
          const a = ((i * 131.6) % 360) * (Math.PI / 180);
          const sp = (60 + (i % 5) * 18) * s;
          const arcH = (20 + (i % 4) * 8) * s;
          const at2 = (uu) => [
            ex.x + Math.cos(a) * sp * blastEase(uu),
            ex.y + Math.sin(a) * sp * blastEase(uu) * 0.5 - Math.sin(uu * Math.PI * 0.9) * arcH,
          ];
          const [px, py] = at2(u);
          const [qx, qy] = at2(Math.max(0, u - 0.08));
          ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py);
          ctx.strokeStyle = "#000000"; ctx.lineWidth = 4 * s; ctx.stroke();
          ctx.strokeStyle = i % 2 ? "#ffe45c" : "#ffffff"; ctx.lineWidth = 2 * s; ctx.stroke();
        }
      }
      ctx.globalAlpha = overallAlpha;
    }

    // ---- Fase 2: el casco calcinado, ardiendo de verdad durante varios
    // segundos — esto es lo que faltaba: la evidencia de que ahí murió un
    // tanque, no solo un fogonazo de medio segundo. ----
    if (elapsedMs > 260) {
      if (layer === "ground") drawCharredHull(ex.x, ex.y, ex.type, ex.wreckAngle || 0);

      let fireIntensity;
      if (elapsedMs < 500) fireIntensity = (elapsedMs - 260) / 240;
      else if (elapsedMs < fadeStart - 900) fireIntensity = 1;
      else if (elapsedMs < fadeStart) fireIntensity = Math.max(0.18, 1 - (elapsedMs - (fadeStart - 900)) / 900);
      else fireIntensity = 0.15;
      fireIntensity = Math.max(0, Math.min(1, fireIntensity));

      if (layer === "ground") drawFlameLicks(ex.x, ex.y - 2 * s, et, fireIntensity, s, seed);
      if (layer === "fx") drawSmokeColumn(ex.x, ex.y, et, fireIntensity * 0.9 + 0.15, s);

      // Llama propia saliendo de la torreta que quedó tirada aparte.
      if (layer === "ground" && ex.turret && elapsedMs > 500 && fireIntensity > 0.1) {
        drawFlameLicks(turretX, turretY - ex.turret.r * s * 0.5, et, fireIntensity * 0.7, s * 0.75, seed + 4);
      }

      // Brasas sueltas saltando del casco.
      if (layer === "fx" && fireIntensity > 0.3) {
        for (let i = 0; i < 4; i++) {
          const cycle = 1.6;
          const localT = ((et + i * 0.35) % cycle) / cycle;
          const bx = ex.x + Math.sin(seed + i * 2.3) * 12 * s;
          const by = ex.y - 4 * s - localT * 26 * s;
          const alphaE = fireIntensity * (1 - localT);
          if (alphaE <= 0.05) continue;
          ctx.globalAlpha = overallAlpha * alphaE;
          ctx.fillStyle = "#ffb347";
          ctx.beginPath();
          ctx.arc(bx + Math.sin(et * 6 + i) * 3 * s, by, 1.3 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = overallAlpha;
      }
    }

    ctx.restore();
  }
}

const SHELL_IMPACT_DURATION_MS = 420;

// ---------------------------------------------------------------------------
// IMPACTO DE OBÚS PESADO — una detonación chica, rápida y seca: no se
// parece en nada a la de granada/mortero/bomba ni a la destrucción de un
// tanque. Es solo el "puf" de un proyectil de cañón al pegar.
// ---------------------------------------------------------------------------
function drawShellImpacts() {
  const now = performance.now();
  shellImpactAnims = shellImpactAnims.filter((e) => now - e.startedAt < SHELL_IMPACT_DURATION_MS);

  for (const ex of shellImpactAnims) {
    const t = (now - ex.startedAt) / SHELL_IMPACT_DURATION_MS;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (t < 0.4) {
      const u = t / 0.4;
      ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = "#ffe7b0";
      ctx.lineWidth = 3 - u * 2;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, 8 + u * 22, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const grow = blastEase(Math.min(1, t / 0.3));
    const r = 6 + grow * 16;
    const alpha = t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.45);
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, r);
    g.addColorStop(0, "#fff3c2");
    g.addColorStop(0.4, "#ffa63a");
    g.addColorStop(1, "rgba(180,60,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.4 * (1 - t);
    ctx.fillStyle = "#3a3a34";
    ctx.beginPath(); ctx.arc(ex.x, ex.y - 4 - t * 10, 6 + t * 6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    if (t < 0.5) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + ex.startedAt;
        const d = t * 20;
        ctx.fillStyle = "#ffcf6b";
        ctx.beginPath();
        ctx.arc(ex.x + Math.cos(a) * d, ex.y + Math.sin(a) * d * 0.6, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// LOOP
// ---------------------------------------------------------------------------
const MOVE_STEP_PREDICT = 6;

async function gameLoop(timestamp) {
  if (gameState !== "PLAYING") {
    requestAnimationFrame(gameLoop);
    return;
  }

  const vivo = latestState && (latestState.navajas?.health ?? 100) > 0;
    const enJuego = latestState && !latestState.gameOver && !latestState.paused && vivo;

  const stamina = latestState && latestState.navajas ? (latestState.navajas.stamina ?? 100) : 100;
  const isRunningNow = shiftHeld && keysDown.size > 0 && stamina > 0 && !(latestState && latestState.navajas && latestState.navajas.exhausted);

  if (enJuego && timestamp - lastMoveSentAt > MOVE_SEND_INTERVAL) {
    const p = latestState.navajas;
    const predictMult = isRunningNow ? RUN_SPEED_MULTIPLIER_CLIENT : 1;
    const pedidos = [];
    for (const dir of keysDown) {
      const [ox, oy] = DIR_OFFSETS[dir];
      const nx = p.x + ox * MOVE_STEP_PREDICT * predictMult;
      const ny = p.y + oy * MOVE_STEP_PREDICT * predictMult;
      if (blockedAt(nx, ny)) continue;
      pedidos.push(requestMove(dir, isRunningNow));
    }
    lastMoveSentAt = timestamp;
    await Promise.all(pedidos);
  }

  if (enJuego && keysDown.size > 0 && timestamp - lastFootstepAt > (isRunningNow ? 190 : 320)) {
    lastFootstepAt = timestamp;
    if (window.sfxFootstep) window.sfxFootstep();
  }

  if (timestamp - lastStateFetchAt > STATE_FETCH_INTERVAL) {
    lastStateFetchAt = timestamp;
    await fetchState();
  }

  draw();
  requestAnimationFrame(gameLoop);
}

async function resetGame(level) {
  // Si viene de un click (MouseEvent) o sin argumento, usa el nivel elegido.
  const lvl = Number.isInteger(level) ? level : selectedLevel;
  try {
    await fetch("/api/restart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: lvl }),
    });
  } catch (err) {
    console.error("No se pudo reiniciar la partida:", err);
  }
  renderedEnemyShotIds = new Set();
  renderedExplosionIds = new Set();
  renderedHitIds = new Set();
  renderedShellImpactIds = new Set();
  renderedItemEvents = new Set(); // Reiniciamos el registro de items
  motionTrackers.clear();
  renderPos.clear();
  planeCrashes.clear();
  muzzlePoints.clear();
  enemyHitUntil.clear();
  enemyFiringUntil.clear();
  scorchMarks = [];
  bloodSpurts = [];
  impactSparks = [];
  fallingUnits = [];
  charredUnits = [];
  explosionAnims = [];
  vehicleExplosionAnims = [];
  shellImpactAnims = [];
  lingeringSmokes = [];
  grenadeThrows = [];
  enemyMortarThrows = [];
  mortarShotIds = new Set();
  planeBombThrows = [];
  planeBombShotIds = new Set();
  meleeSlashes = [];
  bullets = [];
  prevHealth = null;
  damageFlashUntil = 0;
  gameOverSoundPlayed = false;
  prevIsTransitioning = false;
  removeEndingNarrative();
  activeNarrative = null;
  ambientActive = false;
  nextAmbientAt = performance.now() + 25000 + Math.random() * 20000;

  latestState = null;
  keysDown.clear();
  lastMoveSentAt = 0;
  lastStateFetchAt = 0;
  overlay.classList.add("hidden");
  pauseMenu.classList.add("hidden");
  letterOverlay.classList.add("hidden");
  pazOverlay.classList.add("hidden");
  pazOpen = false;
  letterOpen = false;
  letterPausedGame = false;
  lastKnownLevel = -1; // fuerza a detectar el nivel de la partida nueva (día/noche y carta)
  dayElapsedMs = 0;
  lastDayTickAt = performance.now();
  gameState = "PLAYING";
}

restartBtn.addEventListener("click", resetGame);

pauseResumeBtn.addEventListener("click", requestPause);
pauseRestartBtn.addEventListener("click", resetGame);
pauseMenuBtn.addEventListener("click", async () => {
  await resetGame();
  gameState = "MENU";
  keysDown.clear();
  startScreen.classList.remove("hidden");
  startBtn.focus();
});

startBtn.addEventListener("click", openLevelSelect);

resizeCanvas();
requestAnimationFrame(gameLoop);