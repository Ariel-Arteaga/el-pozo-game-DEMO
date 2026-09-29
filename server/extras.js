// server/extras.js — ítems, lanzallamas y regalos de prisioneros.
// El servidor sigue siendo la única autoridad: el cliente solo pide
// (POST /api/flame) y dibuja lo que este archivo confirma en el estado.
const gameState = require("./state");

const ITEM_PICKUP_DIST = 24;
const PRISONER_ITEM_CHANCE = 0.7; // probabilidad de que un prisionero liberado dé algo

const FLAME_FUEL_MAX = 100;
const FLAME_FUEL_PER_PICKUP = 60;
const FLAME_COOLDOWN_MS = 100;
const FLAME_RANGE = 190; // recurso limitado, así que pega fuerte y lejos
const FLAME_HALF_WIDTH = 36; // ancho del cono a la salida de la boquilla
const FLAME_SPREAD = 0.32; // cuánto se ensancha por cada px de distancia
const FLAME_DAMAGE = 24;

const ENEMY_RADIUS = { soldado: 12, tanqueta: 20 };
const DIR_VECTORS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const initialized = new WeakSet();

// Ítems por nivel — coordenadas pensadas para cada mapa propio (nivel 1
// largo, nivel 2 más chico, nivel 3 el original).
const LEVEL_ITEMS = [
  [ // Nivel 1 — La Infiltración
    { id: "it1_1", x: 550, y: 550, type: "lanzallamas" },
    { id: "it1_2", x: 1150, y: 200, type: "botiquin" },
    { id: "it1_3", x: 1750, y: 600, type: "granadas" },
    { id: "it1_4", x: 2300, y: 250, type: "granadas" },
  ],
  [ // Nivel 2 — Maquinaria Pesada
    { id: "it2_1", x: 250, y: 450, type: "botiquin" },
    { id: "it2_2", x: 950, y: 600, type: "granadas" },
    { id: "it2_3", x: 1550, y: 350, type: "lanzallamas" },
  ],
  [ // Nivel 3 — La Vigilia
    { id: "it3_1", x: 880, y: 250, type: "lanzallamas" },
    { id: "it3_2", x: 760, y: 640, type: "botiquin" },
    { id: "it3_3", x: 300, y: 300, type: "granadas" },
  ],
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function logEvent(s, type, detail) {
  s.log.push({ type, detail, at: Date.now() });
  if (s.log.length > 200) s.log.shift();
}

// Agrega al estado los campos nuevos (una sola vez por partida).
function ensureExtras(s) {
  if (initialized.has(s)) return;
  initialized.add(s);
  const levelItems = LEVEL_ITEMS[s.currentLevelIndex] || LEVEL_ITEMS[LEVEL_ITEMS.length - 1];
  s.items = levelItems.map((it) => ({ ...it }));
  s.itemEvents = [];
  s.navajas.fuel = 0;
  s.navajas.lastFlameAt = 0;
}

function giveItem(s, type, x, y) {
  const p = s.navajas;
  if (type === "botiquin") p.health = clamp(p.health + 35, 0, 100);
  else if (type === "granadas") p.grenades += 5;
  else if (type === "lanzallamas") p.fuel = Math.min(FLAME_FUEL_MAX, (p.fuel || 0) + FLAME_FUEL_PER_PICKUP);
  else return;
  s.itemEvents.push({ type, x, y, at: Date.now() });
  logEvent(s, "item_recibido", type);
}

// "A veces" un prisionero liberado entrega algo a Navajas.
function rewardFromPrisoner(s, pr) {
  if (Math.random() > PRISONER_ITEM_CHANCE) return;
  const r = Math.random();
  let type = r < 0.4 ? "botiquin" : r < 0.7 ? "granadas" : "lanzallamas";
  if (type === "botiquin" && s.navajas.health >= 100) type = "granadas";
  giveItem(s, type, pr.x, pr.y);
}

const baseTick = gameState.tick;
gameState.tick = function () {
  const s = gameState.getPublicState();
  ensureExtras(s);

  const before = new Map(s.prisoners.map((pr) => [pr.id, pr.status]));
  baseTick();
  if (s.paused || s.gameOver || !s.navajas.alive) return;

  for (const pr of s.prisoners) {
    if (before.get(pr.id) === "tied" && pr.status === "freed") rewardFromPrisoner(s, pr);
  }

  const p = s.navajas;
  for (let i = s.items.length - 1; i >= 0; i--) {
    const it = s.items[i];
    if (Math.hypot(it.x - p.x, it.y - p.y) < ITEM_PICKUP_DIST) {
      s.items.splice(i, 1);
      giveItem(s, it.type, it.x, it.y);
    }
  }

  const now = Date.now();
  s.itemEvents = s.itemEvents.filter((e) => now - e.at < 1500);
};

// Cada partida nueva vuelve a poner las cajas del mapa.
const baseReset = gameState.resetState;
gameState.resetState = function (levelIndex = 0) {
  baseReset(levelIndex);
  ensureExtras(gameState.getPublicState());
};

ensureExtras(gameState.getPublicState());

function requestFlame() {
  const s = gameState.getPublicState();
  ensureExtras(s);
  if (s.paused) return { ok: false, reason: "pausado" };
  if (s.gameOver || !s.navajas.alive) return { ok: false, reason: "juego_terminado" };

  const p = s.navajas;
  const now = Date.now();
  if ((p.fuel || 0) <= 0) return { ok: false, reason: "sin_combustible" };
  if (now - p.lastFlameAt < FLAME_COOLDOWN_MS) return { ok: false, reason: "cooldown" };

  p.lastFlameAt = now;
  p.fuel -= 1;

  const [ux, uy] = DIR_VECTORS[p.dir] || [1, 0];
  let kills = 0;
  for (const enemy of s.enemies) {
    if (!enemy.alive) continue;
    const radius = ENEMY_RADIUS[enemy.type] || ENEMY_RADIUS.soldado;
    const dx = enemy.x - p.x;
    const dy = enemy.y - p.y;
    const along = dx * ux + dy * uy;
    const across = Math.abs(dx * uy - dy * ux);
    if (along < 0 || along > FLAME_RANGE + radius) continue;
    if (across > FLAME_HALF_WIDTH + along * FLAME_SPREAD + radius * 0.5) continue;

    enemy.health -= FLAME_DAMAGE;
    const isKill = enemy.health <= 0;
    if (isKill) {
      enemy.alive = false;
      kills += 1;
      s.score += 120;
      logEvent(s, "enemigo_derrotado_fuego", enemy.id);
    }
    s.hits.push({ id: enemy.id, x: enemy.x, y: enemy.y, at: now, killed: isKill, type: enemy.type, weapon: "fuego" });
  }
  if (s.hits.length > 60) s.hits.splice(0, s.hits.length - 60);

  // La victoria la detecta el siguiente tick() del servidor.
  return { ok: true, fuel: p.fuel, kills };
}

module.exports = function installExtras(app) {
  app.post("/api/flame", (req, res) => {
    res.json(requestFlame());
  });
};