// state.js
// Esta es la ÚNICA fuente de verdad del juego. El cliente nunca modifica
// estos valores directamente: solo puede pedirle al servidor que lo haga,
// y el servidor decide si la petición es válida.

const MAP_WIDTH = 1400;
const MAP_HEIGHT = 800;
const PLAYER_SPEED = 4.8;
const PLAYER_RADIUS = 9; // para chocar contra árboles/obstáculos/enemigos
const SHOOT_COOLDOWN_MS = 250;
const MELEE_COOLDOWN_MS = 450;
const MELEE_RANGE = 60;
const MELEE_DAMAGE = 50;

const ENEMY_APPROACH_STOP_DIST = 160; // deja de acercarse a esta distancia

const ENEMY_BULLET_SPEED = 9; // px por tick del servidor
const ENEMY_BULLET_LIFETIME_MS = 2200;
const PLAYER_HIT_RADIUS = PLAYER_RADIUS + 4; // hitbox real contra balas enemigas

// Estadísticas por tipo de enemigo. "tanqueta" es más lenta y aguanta mucho
// más, pero pega más fuerte y conviene gastarle una granada en vez de
// vaciarle el cargador.
const ENEMY_TYPES = {
  soldado: { health: 40, damage: 8, speed: 1.2, shootRange: 308, shootCooldownMs: 1400, radius: 12 },
  tanqueta: { health: 170, damage: 13, speed: 1.15, shootRange: 360, shootCooldownMs: 1900, radius: 26, bulletSpeed: 8.5 },
  // Torreta fija: no se mueve nunca (speed 0), pero apunta y dispara igual
  // que cualquier otro enemigo — su "movimiento" en tick() no la desplaza,
  // solo actualiza hacia dónde mira.
  torreta: { health: 90, damage: 14, speed: 0, shootRange: 380, shootCooldownMs: 900, radius: 18 },
  // Mortero: se reacomoda lento, no dispara balas — lanza proyectiles en
  // arco (ver MORTAR_* y la rama "mortero" dentro de tick()).
  mortero: { health: 55, damage: 0, speed: 0.3, shootRange: 480, shootCooldownMs: 3200, radius: 16 },
  // Variantes de tanque: el "pesado" aguanta mucho y pega fuerte pero es
  // lento; el "de asalto" es frágil pero rápido y dispara más seguido.
  // Escalera de daño de disparo directo: soldado/torreta < asalto 
  // pesado < mortero (el mortero sigue siendo el que más pega).
  tanqueta_pesada: { health: 280, damage: 17, speed: 0.85, shootRange: 400, shootCooldownMs: 2600, radius: 35, bulletSpeed: 6.5 },
  tanqueta_asalto: { health: 100, damage: 9, speed: 1.7, shootRange: 320, shootCooldownMs: 1300, radius: 21, bulletSpeed: 10.5 },
  // Jefe del nivel 1. Su movimiento es propio (ver moverTrenBlindado): va sobre un riel.
  tren_blindado: { health: 1200, damage: 15, speed: 0, shootRange: 720, shootCooldownMs: 1500, radius: 60, bulletSpeed: 14, bulletLifetimeMs: 5600 },
  // Jefe del nivel 2: cañón fijo con blindaje frontal (ver multiplicadorBlindajeCanon).
  // bulletLifetimeMs cubre todo su alcance: 900 px a 16 px/tick = 5.6 s.
  jefe_canon: { health: 1800, damage: 16, speed: 0, shootRange: 900, shootCooldownMs: 2600, radius: 84, bulletSpeed: 16, bulletLifetimeMs: 6000 },
  // Jefe del nivel 3: vuela (flying). Su hitbox es la elipse de su SOMBRA (rx = radius, ry = radius / 2).
  jefe_avion: { health: 2200, damage: 0, speed: 0, shootRange: 0, shootCooldownMs: 4200, radius: 110, bulletSpeed: 0, flying: true },
};
const BOSS_TYPES = new Set(["tren_blindado", "jefe_canon", "jefe_avion"]);
const JEFE_AVION_ALT = 230; // altura visual del avión sobre su sombra (= PLANE_ALTITUDE_PX del cliente)
// Cuántos enemigos hay en total a lo largo del nivel (los iniciales + los
// refuerzos que van llegando) y cuántos como máximo puede haber vivos a la
// vez. Antes el nivel se acababa apenas caían 4 soldados; ahora hay más
// carne de cañón y de a poco van llegando refuerzos desde los bordes.
const TOTAL_ENEMIES_TARGET = 18;
const MAX_ALIVE_ENEMIES = 7;
const SPAWN_INTERVAL_MS = 3200;
const TANQUETA_CHANCE = 0.22; // 22% de los refuerzos llegan como tanqueta normal
const TANQUETA_PESADA_CHANCE = 0.06;
const TANQUETA_ASALTO_CHANCE = 0.08;

// Mortero: dispara un proyectil en arco que tarda en caer y hace daño de
// área — pensado para pegar fuerte (un quinto de la vida máxima) si no te
// movés del punto marcado antes de que llegue.
const MORTAR_FLIGHT_MS = 900;
const MORTAR_RADIUS = 70;
const MORTAR_DAMAGE = 20; // 100 / 5

// Aliados: prisioneros rescatados que se suman a pelear. Inmortales y con
// daño bajo y fijo — acompañan y ayudan, no reemplazan a Navajas.
const ALLY_DAMAGE = 6;
const ALLY_RANGE = 220;
const ALLY_COOLDOWN_MS = 900;
const ALLY_SPEED = PLAYER_SPEED; // los aliados avanzan igual de rápido que Navajas
const ALLY_FOLLOW_DIST = 55;

// Vidas: Navajas puede caer hasta 2 veces sin que sea game over — a la
// tercera (sin vidas restantes) recién ahí es derrota real. Las vidas se
// arrastran entre niveles (no se resetean al pasar de nivel), y al perder
// una, Navajas revive al 100% de vida en el punto de spawn del NIVEL
// ACTUAL (no vuelve al inicio de la campaña).
const STARTING_LIVES = 3;

// Correr: gasta resistencia mientras se usa y se recupera sola apenas se
// deja de correr (incluso en medio de un combate, para no castigar doble).
const RUN_SPEED_MULTIPLIER = 1.85;
const STAMINA_MAX = 100;
const STAMINA_DRAIN_PER_MOVE = 1.1; // por cada paso corrido
const STAMINA_REGEN_MS = 15000; // de 0 a 100 en exactamente 15 s (por tiempo real, no por tick), solo si no corriste hace poco
const STAMINA_MIN_TO_RUN = 12; // si la barra llega a 0, hay que recuperar este mínimo antes de volver a correr (evita que Shift la deje pegada en 0)
const STAMINA_RUN_COOLDOWN_MS = 200; // cuánto "cuenta" como corriendo recién después de soltar Shift

// Avión bombardero: cruza el mapa a altura fija en niveles marcados con
// hasAirRaid y suelta bombas a intervalos mientras pasa. Es invulnerable
// (no se le puede disparar) — solo se esquivan sus bombas, igual que las
// del mortero.
const PLANE_SPEED = 3.6; // px por tick — velocidad de crucero
const PLANE_LEAVE_SPEED = PLANE_SPEED * 1.8; // más rápido cuando se va, para no tardar una eternidad en desaparecer
const PLANE_SPAWN_INTERVAL_MS = 30000; // cada cuánto vuelve a atacar (desde que empezó el ataque anterior)
const PLANE_SPAWN_INITIAL_DELAY_MS = 6000; // la primera pasada tarda un poco en llegar
const PLANE_SPAWN_RADIUS = 480; // a qué distancia de Navajas aparece, en un ángulo al azar (horizontal, vertical o diagonal)
const PLANE_TURN_RATE = 0.06; // rad por tick — qué tan cerrado puede girar (perseguidor, no un misil perfecto)
const PLANE_MAX_ACTIVE_MS = 14000; // tiempo máximo persiguiendo antes de irse, aunque no haya gastado todas las bombas
const PLANE_LEAVE_DIST = 550; // a esta distancia de Navajas ya "se fue" y se lo saca del juego
const PLANE_BOMB_LOOKAHEAD_PX = 230; // hasta dónde "ve" a Navajas por delante para largar la bomba
const PLANE_BOMB_HALF_WIDTH = 85; // qué tan centrado tiene que estar Navajas en la mira para soltar
const PLANE_MAX_PASSES = 4; // bombas máximas antes de irse

// Nivel 3: mientras el jefe bombardero está vivo, la avioneta (la NO jefe,
// inmortal) solo vuelve a bombardear cada 1 minuto.
const PLANE_SPAWN_INTERVAL_WITH_BOSS_MS = 60000;
// Bombas del jefe bombardero: 1.4 s de aviso en el suelo, con cuenta regresiva numérica.
const JEFE_AVION_BOMB_FLIGHT_MS = 1400;
// Al derribar al bombardero, el cliente anima su caída en llamas (~3.6 s) y el
// estallido contra el suelo. La victoria final espera este tiempo para no cortarla.
const JEFE_AVION_CRASH_DELAY_MS = 5600;
// Paracaidistas: bajan del avión con paracaídas y no se les puede tocar en el aire.
const PARACAIDISTA_DROP_MS = 3600;
const BOMB_INTERVAL_MS = 650; // cooldown mínimo entre bombas (además de tener que estar alineado)
const BOMB_FLIGHT_MS = 650;
const BOMB_RADIUS = 62;
const BOMB_DAMAGE = 18;

// ---------------------------------------------------------------------------
// CAMPAÑA — cada nivel es un mundo propio: tamaño de mapa, árboles,
// obstáculos, si hay pozo o no, y de dónde aparece Navajas. El cliente ya
// no tiene copia propia de nada de esto: se lo mandamos entero en
// getPublicState() y dibuja lo que recibe.
// ---------------------------------------------------------------------------
const CAMPAIGN = [
  {
    level: 1, title: "LA INFILTRACIÓN",
    target: 31, maxAlive: 9,
    prisoners: [
      { id: "p1", x: 900, y: 220, status: "tied" },
      { id: "p2", x: 1900, y: 600, status: "tied" },
    ],
    timeOfDay: 0,
    mapWidth: 2600, mapHeight: 800,
    spawnZone: { x0: 40, y0: 40, x1: 140, y1: 140 },
    pozo: null,
    hasNarrative: false,
    hasAirRaid: true,
    turrets: [
      { id: "trt1", x: 700, y: 200 },
      { id: "trt2", x: 1400, y: 600 },
      { id: "trt3", x: 2150, y: 250 },
    ],
    mortars: [
      { id: "mtr1", x: 1050, y: 450 },
      { id: "mtr2", x: 1950, y: 300 },
    ],
    trees: [
      { x: 260, y: 120 }, { x: 420, y: 680 }, { x: 600, y: 90 },
      { x: 780, y: 700 }, { x: 960, y: 140 }, { x: 1140, y: 660 },
      { x: 1320, y: 110 }, { x: 1500, y: 690 }, { x: 1680, y: 150 },
      { x: 1860, y: 640 }, { x: 2040, y: 120 }, { x: 2220, y: 680 },
      { x: 2400, y: 300 }, { x: 140, y: 420 },
    ],
    obstacles: [
      { type: "alambrada", x: 500, y: 400, length: 90, angle: 0.2 },
      { type: "alambrada", x: 1300, y: 250, length: 110, angle: -0.15 },
      { type: "alambrada", x: 2000, y: 550, length: 90, angle: 0.1 },
      { type: "carreta", x: 800, y: 550 },
      { type: "carreta", x: 1600, y: 200 },
      { type: "carreta", x: 2250, y: 500 },
    ],
  },
  {
    level: 2, title: "MAQUINARIA PESADA",
    target: 22, maxAlive: 6,
    prisoners: [{ id: "p3", x: 900, y: 200, status: "tied" }],
    timeOfDay: 150000,
    mapWidth: 1800, mapHeight: 800,
    spawn: { x: 120, y: 400 },
    pozo: null,
    hasNarrative: false,
    hasAirRaid: true,
    turrets: [
      { id: "trt4", x: 1000, y: 250 },
      { id: "trt5", x: 1500, y: 550 },
    ],
    mortars: [
      { id: "mtr3", x: 1250, y: 620 },
    ],
    trees: [
      { x: 150, y: 150 }, { x: 300, y: 650 }, { x: 500, y: 100 },
      { x: 700, y: 700 }, { x: 900, y: 130 }, { x: 1100, y: 660 },
      { x: 1300, y: 120 }, { x: 1500, y: 680 }, { x: 1650, y: 240 },
    ],
    obstacles: [
      { type: "alambrada", x: 400, y: 300, length: 100, angle: 0.1 },
      { type: "alambrada", x: 1100, y: 500, length: 110, angle: -0.2 },
      { type: "carreta", x: 700, y: 550 },
      { type: "carreta", x: 1400, y: 250 },
    ],
  },
  {
    level: 3, title: "LA VIGILIA",
    target: 35, maxAlive: 9,
    prisoners: [],
    timeOfDay: 300000,
    mapWidth: 1400, mapHeight: 800,
    spawn: { x: 100, y: 400 },
    pozo: { x: 700, y: 400 },
    hasNarrative: true,
    hasAirRaid: true,
    mortars: [
      { id: "mtr4", x: 900, y: 260 },
      { id: "mtr5", x: 1150, y: 600 },
    ],
    trees: [
      { x: 120, y: 120 }, { x: 220, y: 680 }, { x: 380, y: 90 },
      { x: 480, y: 720 }, { x: 620, y: 130 }, { x: 780, y: 690 },
      { x: 880, y: 100 }, { x: 1020, y: 700 }, { x: 1180, y: 120 },
      { x: 1320, y: 650 }, { x: 60, y: 420 }, { x: 1340, y: 420 },
      { x: 950, y: 480 }, { x: 260, y: 300 },
    ],
    obstacles: [
      { type: "alambrada", x: 300, y: 150, length: 90, angle: 0 },
      { type: "alambrada", x: 950, y: 550, length: 110, angle: 0.3 },
      { type: "alambrada", x: 650, y: 680, length: 90, angle: -0.2 },
      { type: "carreta", x: 500, y: 600 },
      { type: "carreta", x: 200, y: 500 },
      { type: "carreta", x: 1150, y: 200 },
      { type: "tanqueta_abandonada", x: 1050, y: 380 },
    ],
  },
];

function buildColliders(trees, obstacles) {
  return [
    ...trees.map((t) => ({ x: t.x, y: t.y, r: 15 })),
    ...obstacles.filter((o) => o.type === "carreta").map((o) => ({ x: o.x, y: o.y, r: 24 })),
    ...obstacles.filter((o) => o.type === "alambrada").map((o) => ({ x: o.x, y: o.y, r: o.length / 2 + 6 })),
    ...obstacles.filter((o) => o.type === "tanqueta_abandonada").map((o) => ({ x: o.x, y: o.y, r: 30 })),
  ];
}

function computeSpawnPoints(mapWidth, mapHeight) {
  return [
    { x: mapWidth - 30, y: 90 },
    { x: mapWidth - 30, y: mapHeight - 90 },
    { x: mapWidth / 2, y: 30 },
    { x: mapWidth / 2, y: mapHeight - 30 },
  ];
}

function collidesWithTerrain(x, y, bodyRadius = PLAYER_RADIUS) {
  for (const c of state.colliders) {
    if (Math.hypot(x - c.x, y - c.y) < c.r + bodyRadius) return true;
  }
  return false;
}

// Paracaidista todavía en el aire: no se lo puede herir, no bloquea el paso y no dispara.
function enElAire(e, now = Date.now()) {
  // El cañón del nivel 2 también es intocable mientras entra a su posición.
  if (e.type === "jefe_canon" && !e.entered) return true;
  return !!e.paraLandAt && now < e.paraLandAt;
}

// Enemigos vivos como obstáculo — esto es lo que evita que el jugador (o un
// enemigo) atraviese a otro como si fuesen fantasmas.
function collidesWithEnemies(x, y, excludeId = null) {
  for (const e of state.enemies) {
    if (!e.alive || e.id === excludeId) continue;
    const st = ENEMY_TYPES[e.type] || ENEMY_TYPES.soldado;
    if (st.flying) continue; // el avión vuela: su sombra no bloquea el paso
    if (enElAire(e)) continue;
    if (Math.hypot(x - e.x, y - e.y) < st.radius + PLAYER_RADIUS) return true;
  }
  return false;
}

function collidesWithPlayer(x, y, enemyRadius) {
  const p = state.navajas;
  if (!p.alive) return false;
  return Math.hypot(x - p.x, y - p.y) < enemyRadius + PLAYER_RADIUS;
}

function resolveSpawn(cfg) {
  if (cfg.spawnZone) {
    const z = cfg.spawnZone;
    return {
      x: z.x0 + Math.random() * (z.x1 - z.x0),
      y: z.y0 + Math.random() * (z.y1 - z.y0),
    };
  }
  return cfg.spawn;
}

function createInitialState(levelIndex = 0, oldNavajas = null, oldAllies = null, oldLives = null) {
  const cfg = CAMPAIGN[levelIndex] || CAMPAIGN[CAMPAIGN.length - 1];
  const spawnPoint = resolveSpawn(cfg);

  const initialEnemies = [
    { id: "sol1", x: 700, y: 200, health: 40, alive: true, type: "soldado", dir: "down", lastShotAt: 0 },
    { id: "sol2", x: 900, y: 620, health: 40, alive: true, type: "soldado", dir: "up", lastShotAt: 0 },
    { id: "sol3", x: 1100, y: 300, health: 40, alive: true, type: "soldado", dir: "left", lastShotAt: 0 },
    { id: "sol4", x: 500, y: 650, health: 40, alive: true, type: "soldado", dir: "up", lastShotAt: 0 },
    { id: "sol5", x: 1200, y: 500, health: 40, alive: true, type: "soldado", dir: "left", lastShotAt: 0 },
    { id: "sol6", x: 650, y: 150, health: 40, alive: true, type: "soldado", dir: "down", lastShotAt: 0 },
  ].map((e) => ({ ...e, x: (e.x / 1400) * cfg.mapWidth, y: (e.y / 800) * cfg.mapHeight }));

  const turretEnemies = (cfg.turrets || []).map((t) => ({
    id: t.id,
    x: t.x,
    y: t.y,
    health: ENEMY_TYPES.torreta.health,
    alive: true,
    type: "torreta",
    dir: "down",
    lastShotAt: 0,
  }));
  const mortarEnemies = (cfg.mortars || []).map((t) => ({
    id: t.id,
    x: t.x,
    y: t.y,
    health: ENEMY_TYPES.mortero.health,
    alive: true,
    type: "mortero",
    dir: "down",
    lastShotAt: 0,
  }));
  const allInitialEnemies = [...initialEnemies, ...turretEnemies, ...mortarEnemies];

  return {
    navajas: oldNavajas
      ? { ...oldNavajas, x: spawnPoint.x, y: spawnPoint.y }
      : {
          x: spawnPoint.x,
          y: spawnPoint.y,
          dir: "right",
          health: 100,
          grenades: 3,
          lastGrenadeAt: 0,
          lastShotAt: 0,
          lastMeleeAt: 0,
          alive: true,
          fuel: 0,
          stamina: STAMINA_MAX,
          lastRanAt: 0,
        },
    lives: oldLives != null ? oldLives : STARTING_LIVES,
    cavadores: cfg.pozo
      ? [
          { id: "cav1", x: cfg.pozo.x + 60, y: cfg.pozo.y - 60, health: 100, alive: true },
          { id: "cav2", x: cfg.pozo.x + 60, y: cfg.pozo.y, health: 100, alive: true },
          { id: "cav3", x: cfg.pozo.x + 60, y: cfg.pozo.y + 60, health: 100, alive: true },
          // Los aliados que veníamos arrastrando de niveles de avance, al
          // llegar a un nivel con pozo, pasan a cavar como cualquier otro
          // cavador — ya cumplieron su parte peleando.
          ...(oldAllies || []).map((a, i) => ({
            id: `cav_${a.id}`,
            x: cfg.pozo.x - 60,
            y: cfg.pozo.y - 60 + i * 40,
            health: 100,
            alive: true,
          })),
        ]
      : [],
    enemies: allInitialEnemies,
    enemiesReserve: cfg.target,
    nextEnemyId: allInitialEnemies.length,
    lastSpawnAt: Date.now(),
    enemyBullets: [], // proyectiles físicos reales de enemigos: x, y, vx, vy, createdAt
    enemyShots: [], // disparos recientes de enemigos, solo para animación del cliente
    explosions: [], // explosiones de granadas recientes, solo para animación del cliente
    hits: [], // impactos del jugador sobre enemigos, solo para animación del cliente
    mortarShots: [], // proyectiles de mortero en vuelo, solo para animación del cliente
    pendingMortarImpacts: [], // impactos de mortero pendientes de resolver (x, y, landAt)
    planes: [], // aviones bombarderos actualmente cruzando el mapa
    bombShots: [], // bombas soltadas recientes, solo para animación del cliente
    pendingBombImpacts: [], // impactos de bomba pendientes de resolver (x, y, landAt)
    shellImpacts: [], // impactos del obús del tanque pesado, solo para animación del cliente
    // Si el nivel tiene pozo, los aliados pasan a ser cavadores (arriba);
    // si no, siguen como aliados de combate en el siguiente nivel de avance.
    allies: cfg.pozo ? [] : (oldAllies ? oldAllies.map((a) => ({ ...a })) : []),
    rescued: 0,
    prisoners: JSON.parse(JSON.stringify(cfg.prisoners)),
    level: levelIndex + 1,
    currentLevelIndex: levelIndex,
    isTransitioning: false,
    mapWidth: cfg.mapWidth,
    mapHeight: cfg.mapHeight,
    trees: cfg.trees,
    obstacles: cfg.obstacles,
    colliders: buildColliders(cfg.trees, cfg.obstacles),
    pozo: cfg.pozo || null,
    hasNarrative: !!cfg.hasNarrative,
    hasAirRaid: !!cfg.hasAirRaid,
    lastPlaneSpawnAt: Date.now() - PLANE_SPAWN_INTERVAL_MS + PLANE_SPAWN_INITIAL_DELAY_MS,
    score: 0,
    gameOver: null,
    paused: false,
    log: [],
  };
}

let state = createInitialState();

function resetState(levelIndex = 0) {
  const idx = Number.isInteger(levelIndex) ? Math.max(0, Math.min(CAMPAIGN.length - 1, levelIndex)) : 0;
  state = createInitialState(idx);
}

let pauseStartedAt = 0;

function togglePause() {
  if (state.gameOver) return;
  const now = Date.now();

  if (!state.paused) {
    state.paused = true;
    pauseStartedAt = now;
    return;
  }

  // Al reanudar se corren los temporizadores lo que duró la pausa.
  const delta = now - pauseStartedAt;
  state.paused = false;
  state.lastSpawnAt += delta;
  state.navajas.lastShotAt += delta;
  state.navajas.lastMeleeAt += delta;
  state.navajas.lastGrenadeAt += delta;
  for (const e of state.enemies) {
    e.lastShotAt += delta;
    if (e.paraLandAt) e.paraLandAt += delta;
    if (e.type === "jefe_canon" || e.type === "jefe_avion") {
      for (const k of ["nextShotAt", "warnUntil", "nextMortarAt", "nextMegaAt", "nextBombAt", "nextParaAt", "lastTickAt", "tremorUntil", "wpUntil", "diedAt"]) {
        if (e[k]) e[k] += delta;
      }
    }
    if (e.type === "tren_blindado") {
      e.nextChargeAt += delta;
      e.chargeWarnUntil += delta;
      e.lastTickAt += delta;
      e.lastRamAt += delta;
      if (e.nextMortarAt) e.nextMortarAt += delta;
    }
  }
  for (const b of state.enemyBullets) b.createdAt += delta;
  for (const a of state.allies) a.lastShotAt += delta;
  for (const m of state.pendingMortarImpacts) m.landAt += delta;
  for (const pl of state.planes) pl.lastBombAt += delta;
  for (const bi of state.pendingBombImpacts) bi.landAt += delta;
  state.lastPlaneSpawnAt += delta;
}

function logEvent(type, detail) {
  state.log.push({ type, detail, at: Date.now() });
  if (state.log.length > 200) state.log.shift();
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function requestMove(direction, running = false) {
  if (state.paused) return { ok: false, reason: "pausado" };
  if (state.gameOver || !state.navajas.alive) {
    return { ok: false, reason: "juego_terminado" };
  }

  const p = state.navajas;
  if (p.exhausted && p.stamina >= STAMINA_MIN_TO_RUN) p.exhausted = false;
  const canRun = !!running && p.stamina > 0 && !p.exhausted; // con la barra parcial SÍ se puede correr
  const speed = canRun ? PLAYER_SPEED * RUN_SPEED_MULTIPLIER : PLAYER_SPEED;
  let nx = p.x;
  let ny = p.y;

  switch (direction) {
    case "up": ny = p.y - speed; p.dir = "up"; break;
    case "down": ny = p.y + speed; p.dir = "down"; break;
    case "left": nx = p.x - speed; p.dir = "left"; break;
    case "right": nx = p.x + speed; p.dir = "right"; break;
    default: return { ok: false, reason: "direccion_invalida" };
  }

  nx = clamp(nx, 0, state.mapWidth);
  ny = clamp(ny, 0, state.mapHeight);

  // Cada eje se prueba por separado: así si chocás en diagonal contra algo,
  // igual podés deslizarte por el otro eje en vez de quedar pegado.
  if (!collidesWithTerrain(nx, p.y) && !collidesWithEnemies(nx, p.y)) p.x = nx;
  if (!collidesWithTerrain(p.x, ny) && !collidesWithEnemies(p.x, ny)) p.y = ny;

  if (canRun) {
    p.stamina = clamp(p.stamina - STAMINA_DRAIN_PER_MOVE, 0, STAMINA_MAX);
    p.lastRanAt = Date.now();
    if (p.stamina <= 0) p.exhausted = true;
  }

  return { ok: true, navajas: p, running: canRun };
}

function requestShoot() {
  if (state.paused) return { ok: false, reason: "pausado" };
  if (state.gameOver || !state.navajas.alive) {
    return { ok: false, reason: "juego_terminado" };
  }

  const p = state.navajas;
  const now = Date.now();

  // Si hay un SOLDADO (nunca tanques, torretas ni morteros) al alcance de
  // cuerpo a cuerpo, la tecla de disparo hace la estocada de bayoneta en
  // vez de tirar — no hace falta soltar el disparo para rematar de cerca.
  // Lejos de rango, este bloque no hace nada y se dispara como siempre.
  let meleeTarget = null;
  let meleeTargetDist = Infinity;
  for (const enemy of state.enemies) {
    if (!enemy.alive || enemy.type !== "soldado" || enElAire(enemy, now)) continue;
    const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (dist <= MELEE_RANGE + ENEMY_TYPES.soldado.radius && dist < meleeTargetDist) {
      meleeTarget = enemy;
      meleeTargetDist = dist;
    }
  }

  if (meleeTarget) {
    if (now - p.lastMeleeAt < MELEE_COOLDOWN_MS) {
      return { ok: false, reason: "cooldown" };
    }
    const dx = meleeTarget.x - p.x;
    const dy = meleeTarget.y - p.y;
    p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    p.lastMeleeAt = now;
    meleeTarget.health -= MELEE_DAMAGE;
    const isKill = meleeTarget.health <= 0;
    if (isKill) {
      meleeTarget.alive = false;
      state.score += 120;
      logEvent("enemigo_derrotado", meleeTarget.id);
    }
    state.hits.push({
      id: meleeTarget.id, x: meleeTarget.x, y: meleeTarget.y, at: now,
      killed: isKill, type: meleeTarget.type, weapon: "melee",
    });
    if (state.hits.length > 60) state.hits.shift();
    checkVictoryConditions();
    return { ok: true, killed: isKill ? meleeTarget.id : null, meleeTriggered: true };
  }

  if (now - p.lastShotAt < SHOOT_COOLDOWN_MS) {
    return { ok: false, reason: "cooldown" };
  }
  p.lastShotAt = now;

  let killed = null;
  // Si Navajas está parado dentro de la sombra del avión, el fusil apunta al
  // cielo: el disparo va al avión y no a lo que tenga enfrente en el suelo.
  const jefeAereo = state.enemies.find(
    (e) => e.alive && e.type === "jefe_avion" && enSombraDeJefeAvion(e, ENEMY_TYPES.jefe_avion, p)
  );
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    if (enElAire(enemy, now)) continue; // paracaidista descendiendo: intocable
    if (jefeAereo && enemy !== jefeAereo) continue;
    const stats = ENEMY_TYPES[enemy.type] || ENEMY_TYPES.soldado;
    const dx = enemy.x - p.x;
    const dy = enemy.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 250 + stats.radius) continue;

    const facingMatch =
      (p.dir === "right" && dx > 0 && Math.abs(dy) < 40) ||
      (p.dir === "left" && dx < 0 && Math.abs(dy) < 40) ||
      (p.dir === "up" && dy < 0 && Math.abs(dx) < 40) ||
      (p.dir === "down" && dy > 0 && Math.abs(dx) < 40);

    const trenMatch = enemy.type === "tren_blindado" && (
      (p.dir === "right" && dx > 0 && Math.abs(dy) < 42) ||
      (p.dir === "left" && dx < 0 && Math.abs(dy) < 42) ||
      (p.dir === "up" && dy < 0 && Math.abs(dx) < 120) ||
      (p.dir === "down" && dy > 0 && Math.abs(dx) < 120)
    );

    // Cañón Mastodonte: casco enorme, se lo acierta por todo su ancho.
    const anchoCanon = stats.radius * 0.9;
    const canonMatch = enemy.type === "jefe_canon" && (
      (p.dir === "right" && dx > 0 && Math.abs(dy) < anchoCanon) ||
      (p.dir === "left" && dx < 0 && Math.abs(dy) < anchoCanon) ||
      (p.dir === "up" && dy < 0 && Math.abs(dx) < anchoCanon) ||
      (p.dir === "down" && dy > 0 && Math.abs(dx) < anchoCanon)
    );

    // Avión: solo se lo acierta desde su sombra (ver jefeAereo arriba).
    const acierto = enemy.type === "jefe_avion" ? enemy === jefeAereo : (facingMatch || trenMatch || canonMatch);

    if (acierto) {
      const dano = danoBalaContra(enemy, p, 34);
      enemy.health -= dano;
      const isKill = enemy.health <= 0;
      if (isKill) {
        enemy.alive = false;
        killed = enemy.id;
        state.score += 100;
        logEvent("enemigo_derrotado", enemy.id);
      }
      // Evento de impacto: el cliente lo usa para el flash de daño y las
      // chispas/sangre sobre el enemigo, no solo para la muerte.
      // Las chispas de un impacto al avión salen del casco en el aire, no de su sombra.
      const hitY = enemy.type === "jefe_avion" && !isKill ? enemy.y - JEFE_AVION_ALT : enemy.y;
      state.hits.push({
        id: enemy.id, x: enemy.x, y: hitY, at: now,
        killed: isKill, type: enemy.type, weapon: "bala", deflected: dano < 34,
      });
      if (state.hits.length > 60) state.hits.shift();
      break;
    }
  }

  checkVictoryConditions();
  return { ok: true, killed };
}

function requestMelee() {
  if (state.paused) return { ok: false, reason: "pausado" };
  if (state.gameOver || !state.navajas.alive) {
    return { ok: false, reason: "juego_terminado" };
  }

  const p = state.navajas;
  const now = Date.now();

  if (now - p.lastMeleeAt < MELEE_COOLDOWN_MS) {
    return { ok: false, reason: "cooldown" };
  }
  p.lastMeleeAt = now;

  let killed = null;
  for (const enemy of state.enemies) {
    if (!enemy.alive || enElAire(enemy, now)) continue;
    const stats = ENEMY_TYPES[enemy.type] || ENEMY_TYPES.soldado;
    const dx = enemy.x - p.x;
    const dy = enemy.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > MELEE_RANGE + stats.radius || stats.flying) continue;

    const facingMatch =
      (p.dir === "right" && dx > 0 && Math.abs(dy) < 40) ||
      (p.dir === "left" && dx < 0 && Math.abs(dy) < 40) ||
      (p.dir === "up" && dy < 0 && Math.abs(dx) < 40) ||
      (p.dir === "down" && dy > 0 && Math.abs(dx) < 40);

    if (facingMatch) {
      enemy.health -= MELEE_DAMAGE;
      const isKill = enemy.health <= 0;
      if (isKill) {
        enemy.alive = false;
        killed = enemy.id;
        state.score += 120;
        logEvent("enemigo_derrotado", enemy.id);
      }
      state.hits.push({
        id: enemy.id, x: enemy.x, y: enemy.y, at: now,
        killed: isKill, type: enemy.type, weapon: "melee",
      });
      if (state.hits.length > 60) state.hits.shift();
      break;
    }
  }

  checkVictoryConditions();
  return { ok: true, killed };
}

const GRENADE_COOLDOWN_MS = 700;
const GRENADE_THROW_DISTANCE = 130; // qué tan lejos cae, en la dirección que mira Navajas
const GRENADE_RADIUS = 95; // radio de daño de área
const GRENADE_DAMAGE = 85;

function requestGrenade() {
  if (state.paused) return { ok: false, reason: "pausado" };
  if (state.gameOver || !state.navajas.alive) {
    return { ok: false, reason: "juego_terminado" };
  }

  const p = state.navajas;
  const now = Date.now();

  if (now - p.lastGrenadeAt < GRENADE_COOLDOWN_MS) {
    return { ok: false, reason: "cooldown" };
  }
  if (p.grenades <= 0) {
    return { ok: false, reason: "sin_granadas" };
  }

  p.grenades -= 1;
  p.lastGrenadeAt = now;

  const dirOffsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const [ox, oy] = dirOffsets[p.dir] || [1, 0];
  const targetX = clamp(p.x + ox * GRENADE_THROW_DISTANCE, 0, state.mapWidth);
  const targetY = clamp(p.y + oy * GRENADE_THROW_DISTANCE, 0, state.mapHeight);

  let kills = 0;
  for (const enemy of state.enemies) {
    if (!enemy.alive || enElAire(enemy, now)) continue;
    const dx = enemy.x - targetX;
    const dy = enemy.y - targetY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > GRENADE_RADIUS) continue;
    if ((ENEMY_TYPES[enemy.type] || {}).flying) continue; // la granada explota en el suelo, el avión pasa por arriba

    enemy.health -= GRENADE_DAMAGE;
    const isKill = enemy.health <= 0;
    if (isKill) {
      enemy.alive = false;
      kills += 1;
      logEvent("enemigo_derrotado_granada", enemy.id);
    }
    state.hits.push({
      id: enemy.id, x: enemy.x, y: enemy.y, at: now,
      killed: isKill, type: enemy.type, weapon: "granada",
    });
  }
  if (state.hits.length > 60) state.hits.splice(0, state.hits.length - 60);
  state.score += kills * 150;

  state.explosions.push({ x: targetX, y: targetY, at: now });
  if (state.explosions.length > 10) state.explosions.shift();

  checkVictoryConditions();
  return { ok: true, grenades: p.grenades, x: targetX, y: targetY, kills };
}

// Refuerzos: si hay menos enemigos vivos que el máximo permitido y todavía
// queda gente en la "reserva" del nivel, cada tanto entra uno nuevo por
// alguno de los bordes del mapa. Así el nivel no se vacía a los pocos
// segundos aunque el jugador dispare bien.
function maybeSpawnReinforcement(now) {
  if (state.enemiesReserve <= 0) return;
  // Las torretas y morteros fijos no cuentan para el tope: antes ocupaban
  // los cupos y por eso casi no llegaban refuerzos.
  const aliveCount = state.enemies.filter((e) => e.alive && e.type !== "torreta" && e.type !== "mortero").length;
  const cfgActual = CAMPAIGN[state.currentLevelIndex] || CAMPAIGN[CAMPAIGN.length - 1];
  const maxAlive = cfgActual.maxAlive || MAX_ALIVE_ENEMIES;
  // Niveles 1, 2 y 3: la última plaza de la reserva es el jefe (tren, cañón o
  // avión). Solo entra cuando ya no queda vivo ningún otro enemigo.
  const esperandoJefe = state.enemiesReserve === 1 && state.currentLevelIndex <= 2;
  if (esperandoJefe) {
    if (state.enemies.some((e) => e.alive && !BOSS_TYPES.has(e.type))) return;
  } else if (aliveCount >= maxAlive) {
    return;
  }
  if (now - state.lastSpawnAt < SPAWN_INTERVAL_MS) return;

  const TREN_RAIL_Y = 750;
  const spawnPoints = computeSpawnPoints(state.mapWidth, state.mapHeight);
  let point = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
  let type = "soldado";
  const esJefe = state.enemiesReserve === 1 && state.currentLevelIndex <= 2;
  if (esJefe && state.currentLevelIndex === 0) {
    type = "tren_blindado";
    point = { x: -160, y: TREN_RAIL_Y };
  } else if (esJefe && state.currentLevelIndex === 1) {
    type = "jefe_canon";
    // Nace FUERA del mapa (lado derecho, centrado en Y) y entra avanzando tras un temblor.
    point = { x: state.mapWidth + 140, y: state.mapHeight / 2 };
  } else if (esJefe && state.currentLevelIndex === 2) {
    type = "jefe_avion";
    // Entra volando desde fuera del mapa, por la izquierda, a la altura del pozo.
    point = { x: -280, y: state.pozo ? state.pozo.y : state.mapHeight / 2 };
  } else {
    const r = Math.random();
    if (r < TANQUETA_PESADA_CHANCE) type = "tanqueta_pesada";
    else if (r < TANQUETA_PESADA_CHANCE + TANQUETA_ASALTO_CHANCE) type = "tanqueta_asalto";
    else if (r < TANQUETA_PESADA_CHANCE + TANQUETA_ASALTO_CHANCE + TANQUETA_CHANCE) type = "tanqueta";
  }
  const stats = ENEMY_TYPES[type];
  if (type === "tren_blindado") {
    state.bossRailY = TREN_RAIL_Y;
    logEvent("jefe_tren_blindado", null);
  } else if (type === "jefe_canon") {
    logEvent("jefe_canon", null);
  } else if (type === "jefe_avion") {
    logEvent("jefe_avion", null);
  }

  state.nextEnemyId += 1;
  state.enemies.push({
    id: `ref${state.nextEnemyId}`,
    x: point.x,
    y: point.y,
    ...(type === "tren_blindado" ? {
      maxHealth: stats.health, railY: TREN_RAIL_Y, facing: 1, entered: false,
      chargeDir: 0, chargeEndX: 0, chargeWarnUntil: 0, nextChargeAt: now + 9000,
      warning: false, charging: false, enraged: false, lastRamAt: 0, lastTickAt: now,
    } : {}),
    ...(type === "jefe_canon" ? {
      maxHealth: stats.health, warning: false, warnUntil: 0, enraged: false,
      nextShotAt: now + 3500, nextMortarAt: now + 5500, nextMegaAt: now + CANON_MEGA_INTERVAL_MS,
      lockAngle: Math.PI, lockX: point.x, lockY: point.y,
      entered: false, phase: "tremor", tremorUntil: now + CANON_TREMOR_MS,
      homeX: state.mapWidth - CANON_HOME_FROM_EDGE, lastTickAt: now,
    } : {}),
    ...(type === "jefe_avion" ? {
      maxHealth: stats.health, entered: false, enraged: false,
      angle: Math.PI, heading: 0, lastTickAt: now, nextBombAt: now + 4500, nextParaAt: 0,
    } : {}),
    health: stats.health,
    alive: true,
    type,
    dir: "left",
    lastShotAt: 0,
  });
  state.enemiesReserve -= 1;
  state.lastSpawnAt = now;
  logEvent("refuerzo_enemigo", { type, restante: state.enemiesReserve });
}

// Pasada de bombardeo: aparece desde un borde lateral, cruza a altura fija
// (cerca de la altura actual de Navajas, para que sea relevante) y va
// soltando bombas a intervalos mientras pasa. Solo una pasada a la vez.
function maybeSpawnPlane(now) {
  if (!state.hasAirRaid) return;
  if (state.planes.length > 0) return;
  // Con el jefe bombardero en el aire, la avioneta (inmortal, no es el jefe)
  // solo bombardea una vez por minuto.
  const hayJefeAvion = state.enemies.some((e) => e.alive && e.type === "jefe_avion");
  const intervalo = hayJefeAvion ? PLANE_SPAWN_INTERVAL_WITH_BOSS_MS : PLANE_SPAWN_INTERVAL_MS;
  if (now - state.lastPlaneSpawnAt < intervalo) return;

  const p = state.navajas;
  // Aparece a cierta distancia de Navajas, en un ángulo al azar — puede
  // venir desde cualquier lado: horizontal, vertical o en diagonal.
  const spawnAngle = Math.random() * Math.PI * 2;
  const startX = p.x + Math.cos(spawnAngle) * PLANE_SPAWN_RADIUS;
  const startY = clamp(p.y + Math.sin(spawnAngle) * PLANE_SPAWN_RADIUS, 40, state.mapHeight - 40);
  const aimAngle = Math.atan2(p.y - startY, p.x - startX);

  state.planes.push({
    id: `plane${now}`,
    x: startX,
    y: startY,
    angle: aimAngle,
    vx: Math.cos(aimAngle) * PLANE_SPEED,
    vy: Math.sin(aimAngle) * PLANE_SPEED,
    spawnedAt: now,
    lastBombAt: now,
    bombsDropped: 0,
    nextBombGapMs: BOMB_INTERVAL_MS,
    leaving: false,
  });
  state.lastPlaneSpawnAt = now;
  logEvent("avion_bombardero", { startX, startY });
}

// Se ejecuta periódicamente en el servidor (ver server.js), NO por petición
// del cliente. Así los enemigos avanzan, disparan y llegan refuerzos aunque
// el jugador no esté haciendo nada en ese instante.
// ---------------------------------------------------------------------------
// JEFE NIVEL 1 — TREN BLINDADO
// Va sobre su riel horizontal (ignora terreno y otros enemigos). Patrulla
// siguiendo la X de Navajas y, cada cierto tiempo, PITA (1.4 s de aviso) y
// embiste a lo largo del riel: la única forma de esquivarlo es salirse de la
// franja del riel. Bajo el 50% de vida se enfurece (más rápido y dispara más).
// Toda la velocidad es por segundo real, no por tick.
// ---------------------------------------------------------------------------
const TRAIN_ENTRY_SPEED = 170;
const TRAIN_PATROL_SPEED = 80;
const TRAIN_CHARGE_SPEED = 330;
const TRAIN_CHARGE_DISTANCE = 900;
const TRAIN_WARN_MS = 1400;
const TRAIN_RAM_DAMAGE = 14;
const TRAIN_RAM_DAMAGE_CHARGE = 40;

// Salva de morteros del jefe (fase 2): 1 bomba directa a Navajas + 2 alrededor.
const BOSS_MORTAR_FLIGHT_MS = 1500; // tiempo de aviso antes de que caiga cada bomba del jefe
function lanzarSalvaMorteroTren(train, p, now) {
  const bombas = 3;
  for (let i = 0; i < bombas; i++) {
    let tx = p.x, ty = p.y;
    if (i > 0) {
      const a = Math.random() * Math.PI * 2;
      const d = 90 + Math.random() * 60;
      tx = clamp(p.x + Math.cos(a) * d, 0, state.mapWidth);
      ty = clamp(p.y + Math.sin(a) * d, 0, state.mapHeight);
    }
    state.mortarShots.push({
      id: `${train.id}_m${now}_${i}`,
      bossId: train.id,
      fromX: train.x + train.facing * 30 + (i - 1) * 14,
      fromY: train.y - 10,
      toX: tx, toY: ty,
      at: now + i,
      flightMs: BOSS_MORTAR_FLIGHT_MS,
    });
    state.pendingMortarImpacts.push({ x: tx, y: ty, landAt: now + BOSS_MORTAR_FLIGHT_MS });
  }
  if (state.mortarShots.length > 20) state.mortarShots.splice(0, state.mortarShots.length - 20);
}

function moverTrenBlindado(train, stats, p, now) {
  const dt = Math.min(0.2, (now - (train.lastTickAt || now)) / 1000);
  train.lastTickAt = now;
  train.y = train.railY;

  const enraged = train.health < stats.health * 0.5;
  train.enraged = enraged;
  train.warning = now < train.chargeWarnUntil;
  train.charging = !train.warning && train.chargeDir !== 0;

  // Fase 2: al bajar del 50% se enfurece y empieza a bombardear con morteros.
  if (enraged && !train.wasEnraged) {
    train.wasEnraged = true;
    train.enrageAt = now;
    train.nextMortarAt = now + 1800;
    logEvent("jefe_enfurecido", null);
  }
  if (enraged && train.entered && !train.warning && !train.charging && p.alive && now >= (train.nextMortarAt || 0)) {
    train.nextMortarAt = now + 5500;
    lanzarSalvaMorteroTren(train, p, now);
  }

  if (!train.entered) {
    train.x += TRAIN_ENTRY_SPEED * dt;
    train.facing = 1;
    if (train.x >= 240) train.entered = true;
  } else if (train.warning) {
    // parado, pitando
  } else if (train.chargeDir !== 0) {
    train.x += train.chargeDir * TRAIN_CHARGE_SPEED * (enraged ? 1.2 : 1) * dt;
    train.facing = train.chargeDir;
    const llego = train.chargeDir > 0 ? train.x >= train.chargeEndX : train.x <= train.chargeEndX;
    if (llego) {
      train.chargeDir = 0;
      train.nextChargeAt = now + (enraged ? 5500 : 11000);
    }
  } else {
    const tx = clamp(p.x, 150, state.mapWidth - 150);
    const ddx = tx - train.x;
    if (Math.abs(ddx) > 24) {
      const sp = enraged ? TRAIN_PATROL_SPEED * 1.35 : TRAIN_PATROL_SPEED;
      train.x += Math.sign(ddx) * sp * dt;
      train.facing = Math.sign(ddx);
    }
    if (now >= train.nextChargeAt) {
      train.chargeDir = p.x >= train.x ? 1 : -1;
      train.chargeEndX = clamp(train.x + train.chargeDir * TRAIN_CHARGE_DISTANCE, 100, state.mapWidth - 100);
      train.chargeWarnUntil = now + (enraged ? 1100 : TRAIN_WARN_MS);
    }
  }

  // Atropello: solo hace daño si Navajas está sobre el riel, en el largo del tren.
  if (p.alive && Math.abs(p.x - (train.x + train.facing * 10)) < 116 && Math.abs(p.y - train.y) < 40 && now - train.lastRamAt > 700) {
    train.lastRamAt = now;
    const dmg = train.charging ? TRAIN_RAM_DAMAGE_CHARGE : TRAIN_RAM_DAMAGE;
    p.health = clamp(p.health - dmg, 0, 100);
    logEvent("jugador_recibio_dano", { from: "tren", damage: dmg });
    if (p.health <= 0) handlePlayerDown();
  }
}

// ---------------------------------------------------------------------------
// JEFE NIVEL 2 — CAÑÓN MASTODONTE
// Fijo en el lado derecho. Su casco mira a la izquierda: el FRENTE (±60°) está
// blindado y casi no siente las balas (x0.25), los FLANCOS reciben daño normal
// y la RETAGUARDIA (±30°, el radiador) recibe x1.6. Las granadas y la bayoneta
// ignoran el blindaje. Ataques: disparo directo TELEGRAFIADO (apunta 0.75 s a
// donde estabas y dispara a ese punto — se esquiva moviéndote) y salvas de
// mortero. Bajo el 50% de vida se enfurece: dispara en abanico de 3 y bombardea más.
// ---------------------------------------------------------------------------
const CANON_WARN_MS = 750;
const CANON_MUZZLE_DIST = 122; // punta del cañón ya escalada (dibujo x1.2)
const CANON_TREMOR_MS = 2600;        // temblor de tierra antes de que aparezca
const CANON_ENTRY_SPEED = 95;        // px/s mientras avanza a su posición
const CANON_HOME_FROM_EDGE = 480;    // posición final: 480 px desde el borde derecho (más centrado)
const CANON_FRONT_ANGLE = Math.PI; // el casco mira a la izquierda
const CANON_FRONT_ARC = Math.PI / 3; // ±60° del frente: blindaje pesado
const CANON_REAR_ARC = Math.PI / 6; // ±30° de la retaguardia: radiador (punto débil)
// Mega-mortero: una bomba enorme y lenta (2 s de aviso), radio 130 y 25 de daño.
const CANON_MEGA_FLIGHT_MS = 2000;
const CANON_MEGA_RADIUS = 130;
const CANON_MEGA_DAMAGE = 25;
const CANON_MEGA_INTERVAL_MS = 7500;
const CANON_MEGA_INTERVAL_ENRAGED_MS = 5500;
const CANON_FRONT_MULT = 0.25;
const CANON_REAR_MULT = 1.6;

function diferenciaAngular(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

function multiplicadorBlindajeCanon(boss, p) {
  const haciaJugador = Math.atan2(p.y - boss.y, p.x - boss.x);
  const d = diferenciaAngular(haciaJugador, CANON_FRONT_ANGLE);
  if (d < CANON_FRONT_ARC) return CANON_FRONT_MULT;
  if (d > Math.PI - CANON_REAR_ARC) return CANON_REAR_MULT;
  return 1;
}

// Daño de una bala del jugador contra un enemigo (solo el cañón lo modifica).
function danoBalaContra(enemy, p, base) {
  if (enemy.type === "jefe_canon") {
    return Math.max(4, Math.round(base * multiplicadorBlindajeCanon(enemy, p)));
  }
  return base;
}

// Salva de morteros de un jefe: 1 directa a Navajas + (bombas - 1) alrededor.
function lanzarSalvaJefe(boss, p, now, bombas) {
  for (let i = 0; i < bombas; i++) {
    let tx = p.x, ty = p.y;
    if (i > 0) {
      const a = Math.random() * Math.PI * 2;
      const d = 80 + Math.random() * 70;
      tx = clamp(p.x + Math.cos(a) * d, 0, state.mapWidth);
      ty = clamp(p.y + Math.sin(a) * d, 0, state.mapHeight);
    }
    state.mortarShots.push({
      id: `${boss.id}_m${now}_${i}`,
      enemyId: boss.id,
      fromX: boss.x, fromY: boss.y - 24,
      toX: tx, toY: ty,
      at: now + i,
      flightMs: BOSS_MORTAR_FLIGHT_MS,
    });
    state.pendingMortarImpacts.push({ x: tx, y: ty, landAt: now + BOSS_MORTAR_FLIGHT_MS });
  }
  if (state.mortarShots.length > 20) state.mortarShots.splice(0, state.mortarShots.length - 20);
}

// Fase 1: temblor (invisible, fuera del mapa). Fase 2: avanza hasta su puesto. Luego queda fijo.
function moverJefeCanon(boss, now) {
  if (boss.entered) return;
  const dt = Math.min(0.2, (now - (boss.lastTickAt || now)) / 1000);
  boss.lastTickAt = now;
  if (now < boss.tremorUntil) { boss.phase = "tremor"; return; }
  boss.phase = "avance";
  boss.x -= CANON_ENTRY_SPEED * dt;
  if (boss.x > boss.homeX) return;

  boss.x = boss.homeX;
  boss.entered = true;
  boss.phase = "listo";
  boss.nextShotAt = now + 3000;
  boss.nextMortarAt = now + 5000;
  boss.nextMegaAt = now + CANON_MEGA_INTERVAL_MS;
  // Si Navajas quedó parado justo donde se planta, se lo empuja afuera del casco.
  const p = state.navajas;
  const d = Math.hypot(p.x - boss.x, p.y - boss.y) || 1;
  const minD = ENEMY_TYPES.jefe_canon.radius + PLAYER_RADIUS + 6;
  if (d < minD) {
    p.x = clamp(boss.x + ((p.x - boss.x) / d) * minD, 0, state.mapWidth);
    p.y = clamp(boss.y + ((p.y - boss.y) / d) * minD, 0, state.mapHeight);
  }
  logEvent("jefe_canon_llego", boss.id);
}

function actualizarJefeCanon(boss, stats, p, now, dist) {
  if (!p.alive) return;

  if (boss.health < stats.health * 0.5 && !boss.enraged) {
    boss.enraged = true;
    boss.nextMortarAt = Math.min(boss.nextMortarAt || 0, now + 1500);
    logEvent("jefe_enfurecido", boss.id);
  }

  // 1) Disparo directo: primero apunta y avisa, después dispara al punto fijado.
  if (!boss.warning && dist <= stats.shootRange && now >= boss.nextShotAt) {
    boss.warning = true;
    boss.warnUntil = now + CANON_WARN_MS;
    boss.lockAngle = Math.atan2(p.y - boss.y, p.x - boss.x);
    boss.lockX = p.x;
    boss.lockY = p.y;
  }
  if (boss.warning) {
    boss.aimAngle = boss.lockAngle; // el cañón queda clavado en el punto fijado
    if (now >= boss.warnUntil) {
      boss.warning = false;
      boss.lastShotAt = now;
      boss.nextShotAt = now + (boss.enraged ? stats.shootCooldownMs * 0.6 : stats.shootCooldownMs);
      const abanico = boss.enraged ? [-0.16, 0, 0.16] : [0];
      for (const off of abanico) {
        const ang = boss.lockAngle + off;
        state.enemyBullets.push({
          id: boss.id,
          x: boss.x + Math.cos(ang) * CANON_MUZZLE_DIST,
          y: boss.y + Math.sin(ang) * CANON_MUZZLE_DIST,
          vx: Math.cos(ang) * stats.bulletSpeed,
          vy: Math.sin(ang) * stats.bulletSpeed,
          damage: stats.damage,
          lifetime: stats.bulletLifetimeMs,
          type: boss.type,
          dir: boss.dir,
          createdAt: now,
        });
      }
      state.enemyShots.push({ id: boss.id, x: boss.x, y: boss.y, dir: boss.dir, at: now, type: boss.type });
      if (state.enemyShots.length > 30) state.enemyShots.shift();
    }
  }

  // 2) Morteros: caen con 1.5 s de aviso en el suelo.
  if (now >= (boss.nextMortarAt || 0) && dist <= stats.shootRange + 200) {
    boss.nextMortarAt = now + (boss.enraged ? 3600 : 6200);
    lanzarSalvaJefe(boss, p, now, boss.enraged ? 4 : 2);
  }

  // 3) Mega-mortero: apunta a donde estás y tarda 2 s en caer — hay que salirse del círculo.
  if (now >= (boss.nextMegaAt || 0) && dist <= stats.shootRange + 200) {
    boss.nextMegaAt = now + (boss.enraged ? CANON_MEGA_INTERVAL_ENRAGED_MS : CANON_MEGA_INTERVAL_MS);
    boss.nextMortarAt = Math.max(boss.nextMortarAt || 0, now + 1500); // no se apila con una salva normal
    state.mortarShots.push({
      id: `${boss.id}_mega_${now}`,
      enemyId: boss.id,
      fromX: boss.x, fromY: boss.y - 24,
      toX: p.x, toY: p.y,
      at: now,
      flightMs: CANON_MEGA_FLIGHT_MS,
      isMega: true,
    });
    if (state.mortarShots.length > 20) state.mortarShots.splice(0, state.mortarShots.length - 20);
    state.pendingMortarImpacts.push({
      x: p.x, y: p.y, landAt: now + CANON_MEGA_FLIGHT_MS,
      isMega: true, damage: CANON_MEGA_DAMAGE, radius: CANON_MEGA_RADIUS,
    });
    logEvent("mega_mortero", boss.id);
  }
}

// ---------------------------------------------------------------------------
// JEFE NIVEL 3 — AVIÓN BOMBARDERO
// Vuela en órbita alrededor del pozo, a 230 px de altura. Solo se lo puede
// dañar desde el suelo, parado DENTRO de su sombra (elipse rx = radius,
// ry = radius / 2): ahí el fusil apunta al cielo y no falla. Fuera de la
// sombra, las balas no lo tocan. Sus bombas caen con aviso en el suelo (igual
// que el mortero). Bajo el 50% se enfurece: órbita más rápida, bombas de a 3
// y suelta paracaidistas.
// ---------------------------------------------------------------------------
const JEFE_AVION_ORBIT_RX = 300;
const JEFE_AVION_ORBIT_RY = 150;
const JEFE_AVION_ORBIT_SPEED = 0.44; // rad/s
const JEFE_AVION_ORBIT_SPEED_ENRAGED = 0.66;
const JEFE_AVION_ENTRY_SPEED = 300; // px/s al entrar volando
const JEFE_AVION_TURN_RATE = 1.8; // rad/s: giro suave del morro

function enSombraDeJefeAvion(boss, stats, p) {
  if (!boss.entered) return false;
  const nx = (p.x - boss.x) / stats.radius;
  const ny = (p.y - boss.y) / (stats.radius * 0.5);
  return nx * nx + ny * ny < 1;
}

function girarHacia(actual, deseado, maxPaso) {
  let d = deseado - actual;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return actual + clamp(d, -maxPaso, maxPaso);
}

const JEFE_AVION_CRUISE_SPEED = 135;          // px/s
const JEFE_AVION_CRUISE_SPEED_ENRAGED = 190;
const JEFE_AVION_WP_MARGIN_X = 150;
const JEFE_AVION_WP_MARGIN_Y = 90;
const JEFE_AVION_WP_REACH = 70;

// Elige un destino totalmente al azar dentro del mapa (lejos de donde está).
function elegirDestinoJefeAvion(boss, now) {
  let tx = boss.x, ty = boss.y;
  for (let i = 0; i < 10; i++) {
    tx = JEFE_AVION_WP_MARGIN_X + Math.random() * (state.mapWidth - 2 * JEFE_AVION_WP_MARGIN_X);
    ty = JEFE_AVION_WP_MARGIN_Y + Math.random() * (state.mapHeight - 2 * JEFE_AVION_WP_MARGIN_Y);
    if (Math.hypot(tx - boss.x, ty - boss.y) > 320) break;
  }
  boss.wpX = tx;
  boss.wpY = ty;
  boss.wpUntil = now + 3500 + Math.random() * 3500;
  boss.speedMul = 0.8 + Math.random() * 0.45;
}

function moverJefeAvion(boss, stats, now) {
  const dt = Math.min(0.2, (now - (boss.lastTickAt || now)) / 1000);
  boss.lastTickAt = now;

  if (boss.health < stats.health * 0.5 && !boss.enraged) {
    boss.enraged = true;
    boss.nextParaAt = now + 2500;
    logEvent("jefe_enfurecido", boss.id);
  }

  const vel = (boss.enraged ? JEFE_AVION_CRUISE_SPEED_ENRAGED : JEFE_AVION_CRUISE_SPEED) * (boss.speedMul || 1);
  // Alcance = radio de giro, así nunca queda dando vueltas alrededor de un destino.
  const alcance = Math.max(JEFE_AVION_WP_REACH, (vel / JEFE_AVION_TURN_RATE) * 1.1);
  if (boss.wpX === undefined || now >= boss.wpUntil || Math.hypot(boss.wpX - boss.x, boss.wpY - boss.y) < alcance) {
    elegirDestinoJefeAvion(boss, now);
  }

  const deseado = Math.atan2(boss.wpY - boss.y, boss.wpX - boss.x);
  boss.heading = girarHacia(boss.heading || 0, deseado, JEFE_AVION_TURN_RATE * dt);
  boss.x += Math.cos(boss.heading) * vel * dt;
  boss.y += Math.sin(boss.heading) * vel * dt;
  if (!boss.entered && boss.x > 60) boss.entered = true;
}

function actualizarAtaqueJefeAvion(boss, stats, p, now) {
  if (!boss.entered || !p.alive) return;

  // Bombardeo: 1 bomba directa (2 extra al enfurecerse), con aviso en el suelo.
  if (now >= boss.nextBombAt) {
    const n = boss.enraged ? 3 : 1;
    boss.nextBombAt = now + (boss.enraged ? Math.round(stats.shootCooldownMs * 0.72) : stats.shootCooldownMs);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sep = i === 0 ? 0 : 85;
      const bx = clamp(p.x + Math.cos(ang) * sep + (Math.random() - 0.5) * 30, 0, state.mapWidth);
      const by = clamp(p.y + Math.sin(ang) * sep + (Math.random() - 0.5) * 30, 0, state.mapHeight);
      // El id termina en "_<at>" y "at" es único por bomba: así el cliente
      // no colapsa bombas simultáneas y deduce bien qué avión abrió la bodega.
      state.bombShots.push({
        id: `${boss.id}_${now + i}`,
        fromX: boss.x, fromY: boss.y,
        toX: bx, toY: by,
        at: now + i,
        flightMs: JEFE_AVION_BOMB_FLIGHT_MS,
      });
      state.pendingBombImpacts.push({ x: bx, y: by, landAt: now + JEFE_AVION_BOMB_FLIGHT_MS });
    }
    if (state.bombShots.length > 20) state.bombShots.splice(0, state.bombShots.length - 20);
  }

  // Paracaidistas (solo enfurecido): 2 soldados cada 8 s, con tope para no saturar.
  if (boss.enraged && now >= boss.nextParaAt) {
    boss.nextParaAt = now + 8000;
    const cfg = CAMPAIGN[state.currentLevelIndex] || CAMPAIGN[CAMPAIGN.length - 1];
    const tope = (cfg.maxAlive || MAX_ALIVE_ENEMIES) + 2;
    let vivos = state.enemies.filter((e) => e.alive && e.type === "soldado").length;
    for (let i = 0; i < 2 && vivos < tope; i++, vivos++) {
      // Punto de aterrizaje: cerca de la sombra del avión, lejos de árboles/obstáculos y de Navajas.
      let lx = boss.x, ly = boss.y;
      for (let intento = 0; intento < 12; intento++) {
        lx = clamp(boss.x + (Math.random() - 0.5) * 160, 30, state.mapWidth - 30);
        ly = clamp(boss.y + (Math.random() - 0.5) * 120, 30, state.mapHeight - 30);
        if (!collidesWithTerrain(lx, ly, 16) && Math.hypot(lx - p.x, ly - p.y) > 70) break;
      }
      state.nextEnemyId += 1;
      state.enemies.push({
        id: `para${state.nextEnemyId}`,
        x: lx,
        y: ly,
        health: ENEMY_TYPES.soldado.health, alive: true, type: "soldado", dir: "down", lastShotAt: now,
        para: true,               // el cliente lo dibuja con paracaídas
        paraAlt: 1,               // 1 = recién lanzado, 0 = en tierra
        paraLandAt: now + PARACAIDISTA_DROP_MS,
      });
    }
    logEvent("paracaidistas", null);
  }
}

function tick() {
  if (state.paused) return;
  if (state.gameOver || !state.navajas.alive) return;

  const p = state.navajas;
  const now = Date.now();

  // Resistencia: se recupera de a poco apenas dejás de correr — incluso en
  // medio de un tiroteo, para no castigar doblemente a alguien que ya está
  // en aprietos.
  const ranRecently = now - (p.lastRanAt || 0) < STAMINA_RUN_COOLDOWN_MS;
  // Regeneración por tiempo real: STAMINA_MAX / STAMINA_REGEN_MS por milisegundo,
  // así llena la barra en 15 s exactos sin importar cada cuánto corra el tick.
  // El tope de 1 s evita un salto brusco al reanudar después de una pausa.
  const staminaDt = p.staminaAt ? Math.min(1000, Math.max(0, now - p.staminaAt)) : 0;
  p.staminaAt = now;
  if (!ranRecently && p.stamina < STAMINA_MAX) {
    p.stamina = clamp(p.stamina + (STAMINA_MAX * staminaDt) / STAMINA_REGEN_MS, 0, STAMINA_MAX);
  }
  if (p.exhausted && p.stamina >= STAMINA_MIN_TO_RUN) p.exhausted = false;

  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const stats = ENEMY_TYPES[enemy.type] || ENEMY_TYPES.soldado;

    // Paracaidista: baja con el paracaídas y no hace nada (ni se mueve ni dispara)
    // hasta tocar el suelo. paraAlt va de 1 (en el avión) a 0 (en tierra).
    if (enemy.paraLandAt) {
      if (now < enemy.paraLandAt) {
        enemy.paraAlt = clamp((enemy.paraLandAt - now) / PARACAIDISTA_DROP_MS, 0, 1);
        continue;
      }
      enemy.paraAlt = 0;
      enemy.paraLandAt = 0;
      enemy.lastShotAt = now; // no dispara en el mismo instante en que aterriza
    }

    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    enemy.dir =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    // Ángulo real y continuo hacia Navajas — lo usan tanques y torretas
    // para que el cañón apunte de verdad al jugador en vez de quedar
    // encajado en una de las 4 direcciones cardinales de "dir".
    enemy.aimAngle = Math.atan2(dy, dx);

    if (enemy.type === "tren_blindado") {
      moverTrenBlindado(enemy, stats, p, now);
    } else if (enemy.type === "jefe_avion") {
      moverJefeAvion(enemy, stats, now);
    } else if (enemy.type === "jefe_canon") {
      moverJefeCanon(enemy, now); // entra con temblor y después queda fijo; solo gira la torreta (aimAngle).
    } else if (dist > ENEMY_APPROACH_STOP_DIST) {
      const nx = clamp(enemy.x + (dx / dist) * stats.speed, 0, state.mapWidth);
      const ny = clamp(enemy.y + (dy / dist) * stats.speed, 0, state.mapHeight);
      // Los tanques (más grandes) chocan con el terreno según su propio tamaño,
      // así no se les ve atravesar árboles ni carretas.
      const bodyR = enemy.type.startsWith("tanqueta") ? stats.radius * 0.7 : PLAYER_RADIUS;
      if (!collidesWithTerrain(nx, enemy.y, bodyR) && !collidesWithEnemies(nx, enemy.y, enemy.id) && !collidesWithPlayer(nx, enemy.y, stats.radius)) {
        enemy.x = nx;
      }
      if (!collidesWithTerrain(enemy.x, ny, bodyR) && !collidesWithEnemies(enemy.x, ny, enemy.id) && !collidesWithPlayer(enemy.x, ny, stats.radius)) {
        enemy.y = ny;
      }
    }

        // Los jefes nuevos llevan su propia lógica de ataque (no usan el disparo genérico).
        const esJefeNuevo = enemy.type === "jefe_canon" || enemy.type === "jefe_avion";
        if (enemy.type === "jefe_canon") {
          if (enemy.entered) actualizarJefeCanon(enemy, stats, p, now, dist);
        } else if (enemy.type === "jefe_avion") {
          actualizarAtaqueJefeAvion(enemy, stats, p, now);
        }
        const shootCooldown = enemy.enraged ? stats.shootCooldownMs * 0.4 : stats.shootCooldownMs;
        const trenListo = enemy.type !== "tren_blindado" || (enemy.entered && !enemy.warning && !enemy.charging);
        if (!esJefeNuevo && trenListo && dist <= stats.shootRange && now - enemy.lastShotAt > shootCooldown) {
      enemy.lastShotAt = now;

      if (enemy.type === "mortero") {
        state.mortarShots.push({
          id: `${enemy.id}_${now}`,
          enemyId: enemy.id,
          fromX: enemy.x, fromY: enemy.y,
          toX: p.x, toY: p.y,
          at: now,
        });
        if (state.mortarShots.length > 20) state.mortarShots.shift();
        state.pendingMortarImpacts.push({ x: p.x, y: p.y, landAt: now + MORTAR_FLIGHT_MS });
      } else {
        const bdx = p.x - enemy.x;
        const bdy = p.y - enemy.y;
        const blen = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
        const bulletSpeed = stats.bulletSpeed || ENEMY_BULLET_SPEED;

        state.enemyBullets.push({
          id: enemy.id,
          x: enemy.x,
          y: enemy.y,
          vx: (bdx / blen) * bulletSpeed,
          vy: (bdy / blen) * bulletSpeed,
          damage: stats.damage,
          lifetime: stats.bulletLifetimeMs || ENEMY_BULLET_LIFETIME_MS,
          type: enemy.type,
          dir: enemy.dir,
          createdAt: now,
        });

        state.enemyShots.push({ id: enemy.id, x: enemy.x, y: enemy.y, dir: enemy.dir, at: now, type: enemy.type });
        if (state.enemyShots.length > 30) state.enemyShots.shift();
      }
    }
  }

  // Balas enemigas: se mueven a velocidad real y solo hacen daño si de
  // verdad colisionan con Navajas. La derrota sigue dependiendo únicamente
  // de que su vida llegue a 0 por este daño (o de que además se quede sin
  // vidas de repuesto — ver handlePlayerDown).
  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
  }

  state.enemyBullets = state.enemyBullets.filter((bullet) => {
    if (now - bullet.createdAt > (bullet.lifetime || ENEMY_BULLET_LIFETIME_MS)) return false;

    const hitDist = Math.hypot(bullet.x - p.x, bullet.y - p.y);
    if (hitDist < PLAYER_HIT_RADIUS) {
      p.health = clamp(p.health - bullet.damage, 0, 100);
      logEvent("jugador_recibio_dano", { from: bullet.id, damage: bullet.damage });

      // El obús del tanque pesado, al impactar, deja su propia pequeña
      // explosión visual — ningún otro proyectil enemigo genera esto.
      if (bullet.type === "tanqueta_pesada" || bullet.type === "tren_blindado" || bullet.type === "jefe_canon") {
        state.shellImpacts.push({ x: bullet.x, y: bullet.y, at: now });
        if (state.shellImpacts.length > 20) state.shellImpacts.shift();
      }

      if (p.health <= 0) handlePlayerDown();
      return false;
    }

    return true;
  });

  // Impactos de mortero: se resuelven cuando llega su momento de caer, ni
  // un tick antes — así el jugador tiene toda la ventana de vuelo para
  // moverse fuera de la retícula de impacto.
  state.pendingMortarImpacts = state.pendingMortarImpacts.filter((imp) => {
    if (now < imp.landAt) return true;
    const radio = imp.radius || MORTAR_RADIUS;
    const dano = imp.damage || MORTAR_DAMAGE;
    const blastDist = Math.hypot(imp.x - p.x, imp.y - p.y);
    if (blastDist < radio && p.alive) {
      p.health = clamp(p.health - dano, 0, 100);
      logEvent("jugador_recibio_dano", { from: imp.isMega ? "mega_mortero" : "mortero", damage: dano });
      if (p.health <= 0) handlePlayerDown();
    }
    state.explosions.push({ x: imp.x, y: imp.y, at: now, isMega: !!imp.isMega });
    if (state.explosions.length > 10) state.explosions.shift();
    return false;
  });

  // Prisioneros: se liberan cuando Navajas se acerca y caminan hacia el
  // pozo. Si el nivel todavía no tiene pozo, se reúnen en el centro del
  // mapa (parche temporal hasta que se conviertan en aliados de verdad).
  const centro = state.pozo || { x: state.mapWidth / 2, y: state.mapHeight / 2 };
  const centroX = centro.x;
  const centroY = centro.y;
  for (let i = state.prisoners.length - 1; i >= 0; i--) {
    const pr = state.prisoners[i];
    if (pr.status === "tied") {
      const distNavajas = Math.hypot(pr.x - p.x, pr.y - p.y);
      if (distNavajas < 45) {
        if (state.pozo) {
          pr.status = "freed";
          logEvent("prisionero_liberado", pr.id);
        } else {
          // Sin pozo (niveles de avance): el prisionero se suma de
          // inmediato como aliado que combate junto a Navajas — no hay
          // un punto de reunión natural en un nivel de avance.
          state.prisoners.splice(i, 1);
          state.allies.push({ id: `ally_${pr.id}`, x: pr.x, y: pr.y, dir: "right", lastShotAt: 0 });
          state.rescued += 1;
          logEvent("prisionero_rescatado", pr.id);
        }
      }
    } else if (pr.status === "freed") {
      const dx = centroX - pr.x;
      const dy = centroY - pr.y;
      const distCentro = Math.hypot(dx, dy);

      if (distCentro < 30) {
        state.prisoners.splice(i, 1);
        state.cavadores.push({ id: `cav_${pr.id}`, x: centroX, y: centroY, health: 100, alive: true });
        state.rescued += 1;
        logEvent("prisionero_rescatado", pr.id);
      } else {
        pr.x += (dx / distCentro) * 1.5;
        pr.y += (dy / distCentro) * 1.5;
      }
    }
  }

  // Aliados: prisioneros ya rescatados. Siguen a Navajas a media distancia
  // y disparan solos al enemigo más cercano dentro de rango. Son
  // inmortales (nunca entran en ninguna lista que reciba daño) y su daño
  // está fijo y regulado para que ayuden sin romper el balance del juego.
  for (const ally of state.allies) {
    const adx = p.x - ally.x;
    const ady = p.y - ally.y;
    const adist = Math.hypot(adx, ady) || 1;
    if (adist > ALLY_FOLLOW_DIST) {
      const nx = clamp(ally.x + (adx / adist) * ALLY_SPEED, 0, state.mapWidth);
      const ny = clamp(ally.y + (ady / adist) * ALLY_SPEED, 0, state.mapHeight);
      if (!collidesWithTerrain(nx, ally.y)) ally.x = nx;
      if (!collidesWithTerrain(ally.x, ny)) ally.y = ny;
    }

    let nearest = null;
    let nearestDist = Infinity;
    for (const enemy of state.enemies) {
      if (!enemy.alive || enElAire(enemy, now)) continue;
      if ((ENEMY_TYPES[enemy.type] || {}).flying) continue;
      const d = Math.hypot(enemy.x - ally.x, enemy.y - ally.y);
      if (d < ALLY_RANGE && d < nearestDist) { nearest = enemy; nearestDist = d; }
    }
    if (nearest) {
      ally.dir =
        Math.abs(nearest.x - ally.x) > Math.abs(nearest.y - ally.y)
          ? (nearest.x > ally.x ? "right" : "left")
          : (nearest.y > ally.y ? "down" : "up");

      if (now - ally.lastShotAt > ALLY_COOLDOWN_MS) {
        ally.lastShotAt = now;
        nearest.health -= ALLY_DAMAGE;
        const isKill = nearest.health <= 0;
        if (isKill) {
          nearest.alive = false;
          state.score += 60;
          logEvent("enemigo_derrotado_aliado", nearest.id);
        }
        state.hits.push({
          id: nearest.id, x: nearest.x, y: nearest.y, at: now,
          killed: isKill, type: nearest.type, weapon: "aliado",
        });
        if (state.hits.length > 60) state.hits.shift();
      }
    }
  }

  maybeSpawnReinforcement(now);
  maybeSpawnPlane(now);

  // Avión bombardero: avanza a velocidad constante y suelta bombas a
  // intervalos mientras está sobre el mapa. Es invulnerable — no entra en
  // ninguna lista de "enemies", así que no se le puede disparar.
  for (const plane of state.planes) {
    if (!plane.leaving) {
      // Persigue a Navajas con un radio de giro limitado — no es un misil
      // perfecto, así que arma curvas y vueltas de verdad en vez de
      // clavarse en línea recta.
      const desiredAngle = Math.atan2(p.y - plane.y, p.x - plane.x);
      let diff = desiredAngle - plane.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      plane.angle += clamp(diff, -PLANE_TURN_RATE, PLANE_TURN_RATE);

      if (now - plane.spawnedAt > PLANE_MAX_ACTIVE_MS) plane.leaving = true;
    }

    const speed = plane.leaving ? PLANE_LEAVE_SPEED : PLANE_SPEED;
    plane.vx = Math.cos(plane.angle) * speed;
    plane.vy = Math.sin(plane.angle) * speed;
    plane.x += plane.vx;
    plane.y += plane.vy;

    if (!plane.leaving && plane.bombsDropped < PLANE_MAX_PASSES) {
      const dx = p.x - plane.x;
      const dy = p.y - plane.y;
      const cosA = Math.cos(plane.angle), sinA = Math.sin(plane.angle);
      const along = dx * cosA + dy * sinA;
      const across = Math.abs(dx * sinA - dy * cosA);
      const enCursoDeColision = along > 0 && along < PLANE_BOMB_LOOKAHEAD_PX && across < PLANE_BOMB_HALF_WIDTH;

      if (enCursoDeColision && now - plane.lastBombAt > plane.nextBombGapMs) {
        plane.lastBombAt = now;
        plane.bombsDropped += 1;
        // Apunta bien, pero no perfecto — la dispersión al azar es lo que
        // lo hace impredecible sin volverse imposible de esquivar.
        const bombX = p.x + (Math.random() - 0.5) * 55;
        const bombY = p.y + (Math.random() - 0.5) * 45;
        plane.nextBombGapMs = BOMB_INTERVAL_MS + Math.random() * 350;
        state.bombShots.push({
          id: `${plane.id}_${now}`,
          fromX: plane.x, fromY: plane.y,
          toX: bombX, toY: bombY,
          at: now,
        });
        if (state.bombShots.length > 20) state.bombShots.shift();
        state.pendingBombImpacts.push({ x: bombX, y: bombY, landAt: now + BOMB_FLIGHT_MS });
        if (plane.bombsDropped >= PLANE_MAX_PASSES) plane.leaving = true;
      }
    }
  }
  state.planes = state.planes.filter(
    (pl) => !(pl.leaving && Math.hypot(pl.x - p.x, pl.y - p.y) > PLANE_LEAVE_DIST)
  );

  // Impactos de bomba: mismo patrón que el mortero — se resuelven recién
  // cuando llega su momento de caer, dando toda la ventana de vuelo para
  // esquivar la retícula marcada en el suelo.
  state.pendingBombImpacts = state.pendingBombImpacts.filter((imp) => {
    if (now < imp.landAt) return true;
    const blastDist = Math.hypot(imp.x - p.x, imp.y - p.y);
    if (blastDist < BOMB_RADIUS && p.alive) {
      p.health = clamp(p.health - BOMB_DAMAGE, 0, 100);
      logEvent("jugador_recibio_dano", { from: "bomba", damage: BOMB_DAMAGE });
      if (p.health <= 0) handlePlayerDown();
    }
    state.explosions.push({ x: imp.x, y: imp.y, at: now });
    if (state.explosions.length > 10) state.explosions.shift();
    return false;
  });

  state.enemyShots = state.enemyShots.filter((s) => now - s.at < 1000);
  state.mortarShots = state.mortarShots.filter((s) => now - s.at < (s.flightMs || MORTAR_FLIGHT_MS) + 300);
  state.bombShots = state.bombShots.filter((s) => now - s.at < (s.flightMs || BOMB_FLIGHT_MS) + 300);
  state.explosions = state.explosions.filter((ex) => now - ex.at < 1000);
  state.hits = state.hits.filter((h) => now - h.at < 1000);
  state.shellImpacts = state.shellImpacts.filter((s) => now - s.at < 1000);

  checkVictoryConditions();
}

// Se llama cada vez que la vida de Navajas llega a 0. Si todavía le
// quedan vidas de repuesto, revive al 100% en el spawn del nivel ACTUAL
// (sin reiniciar enemigos, aliados ni progreso del nivel) y resta una
// vida; recién cuando se queda sin ninguna, cae de verdad.
function handlePlayerDown() {
  const p = state.navajas;
  state.lives -= 1;
  logEvent("navajas_caido", { vidasRestantes: state.lives });

  if (state.lives > 0) {
    const cfg = CAMPAIGN[state.currentLevelIndex] || CAMPAIGN[CAMPAIGN.length - 1];
    const spawnPoint = resolveSpawn(cfg);
    p.health = 100;
    p.x = spawnPoint.x;
    p.y = spawnPoint.y;
    p.alive = true;
    logEvent("navajas_revivio", { vidasRestantes: state.lives });
  } else {
    p.alive = false;
  }
}

// La derrota depende únicamente de que Navajas se haya quedado sin vida Y
// sin vidas de repuesto. La victoria ahora espera a que se acabe también
// la reserva de refuerzos, no solo a que la tanda que está en pantalla muera.
function checkVictoryConditions() {
  const _ahora = Date.now();
  for (const e of state.enemies) {
    if (e.type === "jefe_avion" && !e.alive && !e.diedAt) e.diedAt = _ahora;
  }
  const cavadoresVivos = state.cavadores.filter((c) => c.alive).length;
  if (state.pozo && cavadoresVivos === 0 && !state.log.some((e) => e.type === "cavadores_perdidos")) {
    logEvent("cavadores_perdidos", null);
  }

  if (!state.navajas.alive && state.lives <= 0) {
    state.gameOver = "derrota";
    logEvent("fin_partida", "derrota");
    return;
  }
  if (!state.navajas.alive) return; // en pleno revivir del tick anterior, no evaluar nada más

  const enemigosVivos = state.enemies.filter((e) => e.alive).length;
  if (enemigosVivos === 0 && state.enemiesReserve <= 0) {
    const esUltimoNivel = state.currentLevelIndex >= CAMPAIGN.length - 1;
    // El bombardero se está estrellando: se espera a que termine la animación.
    const jefeCayendo = state.enemies.find((e) => e.type === "jefe_avion" && !e.alive && e.diedAt && _ahora - e.diedAt < JEFE_AVION_CRASH_DELAY_MS);
    if (jefeCayendo) return;
    if (esUltimoNivel) {
      state.gameOver = "victoria";
      logEvent("fin_partida", "victoria");
    } else if (!state.isTransitioning) {
      state.isTransitioning = true;
      logEvent("nivel_completado", state.currentLevelIndex);
      setTimeout(() => {
        startNextLevel();
      }, 5000);
    }
  }
}

function startNextLevel() {
  const navajasConBonus = { ...state.navajas, health: clamp(state.navajas.health + 25, 0, 100) };
  state = createInitialState(state.currentLevelIndex + 1, navajasConBonus, state.allies, state.lives);
}
function triggerBossCheat() {
  if (state.gameOver || !state.navajas.alive) return;
  for (const e of state.enemies) {
    e.alive = false;
  }
  state.enemiesReserve = 1;
  state.lastSpawnAt = 0; // Fuerza el spawn inmediato en el próximo tick
  logEvent("cheat_activado", "Jefe Invocado");
}

function getPublicState() {
  return state;
}

module.exports = {
  triggerBossCheat,
  requestMove,
  requestShoot,
  requestGrenade,
  requestMelee,
  tick,
  togglePause,
  getPublicState,
  resetState,
  MAP_WIDTH,
  MAP_HEIGHT,
};