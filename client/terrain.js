// terrain.js — Escenario árido del Chaco, generado por código.
//
// Sobre los vehículos: en 1932-35 no existían los jeeps (son un invento de
// la Segunda Guerra Mundial, casi diez años después). Lo que Bolivia sí usó
// en el Chaco fueron tanques ligeros Vickers de 6 toneladas — y la mayoría
// quedó varada en la arena suelta sin pelear casi nada. Por eso el "recurso
// nuevo" histórico es justamente ese: una tanqueta Vickers destruida y
// abandonada como decoración/punto de historia, y otra viva como enemigo
// pesado (ver ENEMY_TYPES en state.js y drawEnemyVehicle en game.js).

const TILE_SIZE = 40;

function terrainNoise(x, y, seed = 7) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

// ---------------------------------------------------------------------------
// SUELO
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SUELO — se pinta UNA sola vez en un lienzo aparte (a doble resolución) y
// luego solo se copia en cada frame. Encima se animan únicamente el pasto que
// se mece, las sombras de nubes y el polvo.
// ---------------------------------------------------------------------------
const TERRAIN_SCALE = 2;
let terrainCache = null;
let swayTufts = [];

function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TERRAIN_PALETTES = [
  { // Nivel 1 — La Infiltración: amanecer pálido, terreno más abierto
    base: "#d6b98a",
    tones: [
      [240, 220, 180], [214, 190, 140], [184, 142, 92],
      [140, 150, 100], [176, 114, 74],
    ],
    grassCount: 220,
    stoneCount: 60,
  },
  { // Nivel 2 — Maquinaria Pesada: terreno rocoso y gris, más árido
    base: "#b3a488",
    tones: [
      [200, 190, 168], [176, 164, 140], [140, 128, 104],
      [110, 118, 96], [150, 108, 80],
    ],
    grassCount: 90,
    stoneCount: 140,
  },
  { // Nivel 3 — La Vigilia: el Chaco cálido original, sin cambios
    base: "#c9a876",
    tones: [
      [232, 208, 160], [206, 178, 128], [176, 132, 82],
      [124, 138, 90], [168, 104, 66],
    ],
    grassCount: 320,
    stoneCount: 70,
  },
];

function buildTerrainCache(mapWidth, mapHeight, levelIndex = 0) {
  const palette = TERRAIN_PALETTES[levelIndex] || TERRAIN_PALETTES[TERRAIN_PALETTES.length - 1];
  const cv = document.createElement("canvas");
  cv.width = mapWidth * TERRAIN_SCALE;
  cv.height = mapHeight * TERRAIN_SCALE;
  const g = cv.getContext("2d");
  g.scale(TERRAIN_SCALE, TERRAIN_SCALE);
  g.lineCap = "round";

  const rnd = seededRandom(1932);
  const between = (a, b) => a + rnd() * (b - a);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  // 1. Base: arena reseca (el tono depende del nivel).
  g.fillStyle = palette.base;
  g.fillRect(0, 0, mapWidth, mapHeight);

  // 2. Manchas grandes y suaves (arena clara, arcilla, pasto seco, tierra rojiza).
  const tones = palette.tones;
  for (let i = 0; i < 170; i++) {
    const [r, gr, b] = pick(tones);
    const x = rnd() * mapWidth, y = rnd() * mapHeight, rad = between(60, 210);
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(${r},${gr},${b},${between(0.07, 0.2).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // 3. Barro seco agrietado (zonas de arcilla con red de grietas).
  const crack = (x, y, ang, len, depth) => {
    g.beginPath();
    g.moveTo(x, y);
    let cx = x, cy = y, a = ang;
    const steps = 3 + Math.floor(rnd() * 3);
    for (let s = 0; s < steps; s++) {
      a += between(-0.7, 0.7);
      cx += Math.cos(a) * (len / steps);
      cy += Math.sin(a) * (len / steps);
      g.lineTo(cx, cy);
      if (depth > 0 && rnd() < 0.4) crack(cx, cy, a + between(-1.3, 1.3), len * 0.55, depth - 1);
    }
    g.strokeStyle = "rgba(74, 50, 28, 0.24)";
    g.lineWidth = 0.9;
    g.stroke();
    g.strokeStyle = "rgba(244, 224, 184, 0.16)";
    g.lineWidth = 0.7;
    g.translate(0, 0.8);
    g.stroke();
    g.translate(0, -0.8);
  };
  for (let z = 0; z < 12; z++) {
    const zx = rnd() * mapWidth, zy = rnd() * mapHeight;
    const zr = between(50, 110);
    const grad = g.createRadialGradient(zx, zy, 0, zx, zy, zr);
    grad.addColorStop(0, "rgba(150, 108, 64, 0.22)");
    grad.addColorStop(1, "rgba(150, 108, 64, 0)");
    g.fillStyle = grad;
    g.fillRect(zx - zr, zy - zr, zr * 2, zr * 2);
    for (let c = 0; c < 22; c++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * zr * 0.9;
      crack(zx + Math.cos(a) * d, zy + Math.sin(a) * d, rnd() * Math.PI * 2, between(12, 28), 1);
    }
  }

  // 4. Moteado medio: pequeñas manchas oscuras y claras sin cuadrícula.
  for (let i = 0; i < 900; i++) {
    const dark = rnd() < 0.5;
    g.fillStyle = dark
      ? `rgba(70, 50, 28, ${between(0.04, 0.09).toFixed(3)})`
      : `rgba(244, 228, 192, ${between(0.05, 0.11).toFixed(3)})`;
    g.beginPath();
    g.ellipse(rnd() * mapWidth, rnd() * mapHeight, between(4, 14), between(2, 6), rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }

  // 5. Grano fino de arena.
  for (let i = 0; i < 14000; i++) {
    const s = between(0.7, 1.5);
    g.fillStyle = rnd() < 0.55
      ? `rgba(60, 42, 22, ${between(0.06, 0.2).toFixed(3)})`
      : `rgba(250, 236, 204, ${between(0.08, 0.22).toFixed(3)})`;
    g.fillRect(rnd() * mapWidth, rnd() * mapHeight, s, s);
  }

  // 6. Ramitas secas.
  g.strokeStyle = "rgba(96, 68, 38, 0.7)";
  g.lineWidth = 1.1;
  for (let i = 0; i < 46; i++) {
    const x = rnd() * mapWidth, y = rnd() * mapHeight, a = rnd() * Math.PI, len = between(8, 22);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.4) * len * 0.5, y + Math.sin(a + 0.4) * len * 0.5,
      x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }

  // 7. Piedras sueltas (solas y en grupitos).
  const stoneColors = ["#8b7a5e", "#a39272", "#75664c", "#b5a482"];
  const stone = (x, y, r) => {
    g.fillStyle = "rgba(40, 28, 16, 0.32)";
    g.beginPath(); g.ellipse(x + 1, y + 1.4, r, r * 0.7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = pick(stoneColors);
    g.beginPath(); g.ellipse(x, y, r, r * 0.75, rnd(), 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255, 246, 218, 0.32)";
    g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.3, r * 0.42, r * 0.26, 0, 0, Math.PI * 2); g.fill();
  };
  for (let i = 0; i < 70; i++) {
    const cx = rnd() * mapWidth, cy = rnd() * mapHeight;
    const n = 2 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) stone(cx + between(-9, 9), cy + between(-6, 6), between(1.4, 4.2));
  }
  for (let i = 0; i < palette.stoneCount; i++) stone(rnd() * mapWidth, rnd() * mapHeight, between(1.6, 5));

  // 8. Pasto seco fijo (matas estáticas) — más denso o más ralo según el nivel.
  const grassTones = ["rgba(150,140,84,0.8)", "rgba(180,162,104,0.8)", "rgba(118,126,76,0.75)"];
  for (let i = 0; i < palette.grassCount; i++) {
    const x = rnd() * mapWidth, y = rnd() * mapHeight;
    g.strokeStyle = pick(grassTones);
    g.lineWidth = 1.1;
    const blades = 3 + Math.floor(rnd() * 3);
    for (let b = 0; b < blades; b++) {
      const h = between(5, 10), lean = between(-4, 4);
      g.beginPath();
      g.moveTo(x + b * 1.6, y);
      g.quadraticCurveTo(x + b * 1.6 + lean * 0.4, y - h * 0.6, x + b * 1.6 + lean, y - h);
      g.stroke();
    }
  }

  // 9. Matorral bajo visto desde arriba (espinos secos).
  for (let i = 0; i < 46; i++) {
    const x = rnd() * mapWidth, y = rnd() * mapHeight, r = between(5, 9);
    g.fillStyle = "rgba(40, 28, 16, 0.28)";
    g.beginPath(); g.ellipse(x + 2, y + 3, r * 1.1, r * 0.6, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = pick(["#5f6d3c", "#7c8a5a", "#6b6a3a"]);
    g.lineWidth = 1.6;
    const spikes = 9 + Math.floor(rnd() * 4);
    for (let s = 0; s < spikes; s++) {
      const a = (s / spikes) * Math.PI * 2 + rnd() * 0.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8);
      g.stroke();
    }
    g.fillStyle = "#3f4a28";
    g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill();
  }

  // 10. Casquillos de bala y restos de guerra (detalle mínimo).
  for (let i = 0; i < 80; i++) {
    g.save();
    g.translate(rnd() * mapWidth, rnd() * mapHeight);
    g.rotate(rnd() * Math.PI);
    g.fillStyle = "#b58a2c";
    g.fillRect(-1.6, -0.6, 3.2, 1.2);
    g.fillStyle = "rgba(255, 236, 160, 0.6)";
    g.fillRect(-1.6, -0.6, 1.2, 0.5);
    g.restore();
  }

  // Posiciones del pasto que sí se mece (se anima en cada frame).
  swayTufts = [];
  for (let i = 0; i < 110; i++) {
    swayTufts.push({ x: rnd() * mapWidth, y: rnd() * mapHeight, s: i * 1.7 });
  }

  return cv;
}

let terrainCacheKey = null;
function drawTerrain(ctx, mapWidth, mapHeight, time = 0, levelIndex = 0) {
  const key = `${mapWidth}x${mapHeight}_${levelIndex}`;
  if (!terrainCache || terrainCacheKey !== key) {
    terrainCache = buildTerrainCache(mapWidth, mapHeight, levelIndex);
    terrainCacheKey = key;
  }
  ctx.drawImage(terrainCache, 0, 0, mapWidth, mapHeight);
  for (const t of swayTufts) drawGrassTuft(ctx, t.x, t.y, time, t.s);
  drawCloudShadows(ctx, mapWidth, mapHeight, time);
  drawHeatDust(ctx, mapWidth, mapHeight, time);
}

// (versión anterior por losetas, ya sin uso)
function drawTerrainLegacy(ctx, mapWidth, mapHeight, time = 0) {
  const cols = Math.ceil(mapWidth / TILE_SIZE);
  const rows = Math.ceil(mapHeight / TILE_SIZE);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      const v = terrainNoise(col, row);
      const v2 = terrainNoise(col, row, 41);

      const mix = v * 0.7 + v2 * 0.3;
      const shade = 188 + Math.floor(mix * 30 - 15);
      ctx.fillStyle = `rgb(${shade}, ${shade - 35}, ${shade - 94})`;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

      if (v2 > 0.88) {
        ctx.fillStyle = "rgba(210, 195, 160, 0.28)";
        ctx.beginPath();
        ctx.ellipse(x + TILE_SIZE * 0.5, y + TILE_SIZE * 0.5, TILE_SIZE * 0.55, TILE_SIZE * 0.4, v, 0, Math.PI * 2);
        ctx.fill();
      }

      const patchV = terrainNoise(col, row, 23);
      if (patchV > 0.72 && patchV < 0.9) {
        ctx.fillStyle = "rgba(124, 138, 90, 0.22)";
        ctx.beginPath();
        ctx.ellipse(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE * 0.7, TILE_SIZE * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        drawGrassTuft(ctx, x + TILE_SIZE * 0.4, y + TILE_SIZE * 0.6, time, col + row);
      }

      if (v > 0.85) {
        ctx.strokeStyle = "rgba(58, 46, 28, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 5);
        ctx.lineTo(x + TILE_SIZE * 0.5, y + TILE_SIZE * 0.4);
        ctx.lineTo(x + TILE_SIZE - 8, y + TILE_SIZE - 10);
        ctx.stroke();
      }

      if (v > 0.93) {
        ctx.fillStyle = "#7c8a5a";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (v < 0.04) {
        ctx.fillStyle = "#5c4a30";
        ctx.beginPath();
        ctx.ellipse(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawCloudShadows(ctx, mapWidth, mapHeight, time);
  drawHeatDust(ctx, mapWidth, mapHeight, time);
}

// Sol del atardecer: se dibuja en coordenadas de pantalla (w x h = viewport).
// `time` son los segundos de "día" transcurridos; el sol baja 0.5 px por segundo.
function drawSun(ctx, w, h, time) {
  const x = w * 0.8;
  const y = 100 + time * 0.5;
  const radius = 34;
  if (y - radius > h) return;

  ctx.save();
  ctx.fillStyle = "#ffd726";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawGrassTuft(ctx, x, y, time, seedOffset) {
  const sway = Math.sin(time * 1.3 + seedOffset) * 2;
  ctx.strokeStyle = "rgba(139, 148, 92, 0.55)";
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 2, y);
    ctx.quadraticCurveTo(x + i * 2 + sway * 0.5, y - 5, x + i * 3 + sway, y - 9);
    ctx.stroke();
  }
}

function drawCloudShadows(ctx, mapWidth, mapHeight, time) {
  const speed = 6;
  const clouds = [
    { w: 260, h: 140, phase: 0 },
    { w: 340, h: 170, phase: 900 },
    { w: 200, h: 110, phase: 1700 },
  ];
  ctx.save();
  for (const c of clouds) {
    const travel = (time * speed + c.phase) % (mapWidth + c.w) - c.w;
    const y = (c.phase % mapHeight) * 0.6 + mapHeight * 0.15;
    const g = ctx.createRadialGradient(travel, y, 0, travel, y, c.w / 2);
    g.addColorStop(0, "rgba(20, 16, 10, 0.10)");
    g.addColorStop(1, "rgba(20, 16, 10, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(travel, y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHeatDust(ctx, mapWidth, mapHeight, time) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 5; i++) {
    const baseX = (i * 313) % mapWidth;
    const baseY = (i * 517) % mapHeight;
    const x = baseX + Math.sin(time * 0.5 + i) * 30;
    const y = baseY + Math.cos(time * 0.35 + i * 2) * 10;
    ctx.fillStyle = "rgba(196, 178, 140, 0.18)";
    ctx.beginPath();
    ctx.ellipse(x, y, 26, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// CAMINO
// ---------------------------------------------------------------------------
function drawPath(ctx, mapWidth, mapHeight) {
  ctx.strokeStyle = "rgba(212, 190, 140, 0.25)";
  ctx.lineWidth = 58;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, mapHeight * 0.55);
  ctx.bezierCurveTo(
    mapWidth * 0.25, mapHeight * 0.35,
    mapWidth * 0.5, mapHeight * 0.7,
    mapWidth, mapHeight * 0.45
  );
  ctx.stroke();

  ctx.strokeStyle = "#8a6f45";
  ctx.lineWidth = 46;
  ctx.beginPath();
  ctx.moveTo(0, mapHeight * 0.55);
  ctx.bezierCurveTo(
    mapWidth * 0.25, mapHeight * 0.35,
    mapWidth * 0.5, mapHeight * 0.7,
    mapWidth, mapHeight * 0.45
  );
  ctx.stroke();

  ctx.strokeStyle = "rgba(58, 46, 28, 0.35)";
  ctx.lineWidth = 3;
  for (const offset of [-12, 12]) {
    ctx.beginPath();
    ctx.moveTo(0, mapHeight * 0.55 + offset);
    ctx.bezierCurveTo(
      mapWidth * 0.25, mapHeight * 0.35 + offset,
      mapWidth * 0.5, mapHeight * 0.7 + offset,
      mapWidth, mapHeight * 0.45 + offset
    );
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(58, 46, 28, 0.4)";
  ctx.lineWidth = 46;
  ctx.setLineDash([2, 14]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ---------------------------------------------------------------------------
// ÁRBOLES
// ---------------------------------------------------------------------------
function drawTree(ctx, x, y, time, seed) {
  const sway = Math.sin(time * 0.8 + seed) * 2.2;

  ctx.fillStyle = "rgba(58, 46, 28, 0.32)";
  ctx.beginPath();
  ctx.ellipse(x + 6, y + 23, 22, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#3a2c1c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 9, y + 20); ctx.lineTo(x - 3, y + 12);
  ctx.moveTo(x + 9, y + 20); ctx.lineTo(x + 4, y + 12);
  ctx.stroke();

  ctx.strokeStyle = "#3f2f1e";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y + 20);
  ctx.quadraticCurveTo(x - 7, y, x + sway * 0.3, y - 18);
  ctx.stroke();
  ctx.strokeStyle = "#5a4630";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 1, y + 18);
  ctx.quadraticCurveTo(x - 6, y, x + sway * 0.3 - 1, y - 17);
  ctx.stroke();

  const canopyTones = ["#4e5c34", "#5c6b3f", "#6f7d4a", "#84925a"];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = canopyTones[i];
    ctx.beginPath();
    ctx.ellipse(
      x + sway + (i - 1.5) * 9,
      y - 24 - i * 3.5,
      24 - i * 3,
      17 - i * 2.2,
      sway * 0.02,
      0, Math.PI * 2
    );
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255, 245, 210, 0.15)";
  ctx.beginPath();
  ctx.ellipse(x + sway - 6, y - 36, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTrees(ctx, trees, time = 0) {
  (trees || []).forEach((t, i) => drawTree(ctx, t.x, t.y, time, i * 1.7));
}

// ---------------------------------------------------------------------------
// EL POZO
// ---------------------------------------------------------------------------
function drawPozo(ctx, x, y) {
  ctx.fillStyle = "#a3814f";
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 58, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(58, 46, 28, 0.5)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * 30, y + Math.sin(angle) * 18);
    ctx.lineTo(x + Math.cos(angle) * 55, y + Math.sin(angle) * 32);
    ctx.stroke();
  }

  const stoneCount = 14;
  for (let i = 0; i < stoneCount; i++) {
    const angle = (i / stoneCount) * Math.PI * 2;
    const sx = x + Math.cos(angle) * 34;
    const sy = y + Math.sin(angle) * 20;
    ctx.fillStyle = i % 2 === 0 ? "#6b5637" : "#5c4a30";
    ctx.beginPath();
    ctx.ellipse(sx, sy, 6, 4, angle, 0, Math.PI * 2);
    ctx.fill();
  }

  const gradient = ctx.createRadialGradient(x, y, 2, x, y, 26);
  gradient.addColorStop(0, "#0a0704");
  gradient.addColorStop(1, "#2b2114");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(x, y, 28, 17, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#3a2e1c";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 30, y - 6); ctx.lineTo(x - 34, y - 46);
  ctx.moveTo(x + 30, y - 6); ctx.lineTo(x + 34, y - 46);
  ctx.stroke();

  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x - 36, y - 44); ctx.lineTo(x + 36, y - 44);
  ctx.stroke();

  ctx.strokeStyle = "#8a6f45";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 42); ctx.lineTo(x, y - 4);
  ctx.stroke();

  ctx.fillStyle = "#5c4a30";
  ctx.fillRect(x - 5, y - 10, 10, 8);
  ctx.strokeStyle = "#2b2114";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 5, y - 10, 10, 8);

  ctx.fillStyle = "#6b4f2e";
  ctx.fillRect(x - 34 - 6, y - 34, 12, 8);
  ctx.strokeStyle = "#2b2114";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 34 - 6, y - 34, 12, 8);
}

// ---------------------------------------------------------------------------
// OBSTÁCULOS
// ---------------------------------------------------------------------------
// La tanqueta varada solo existe (visualmente y como punto de historia) en
// el nivel 3, que es el único que la manda en sus obstacles — pero el
// marcador narrativo de más abajo necesita su posición igual.
const WRECKED_TANK = { x: 1050, y: 380 };

function drawObstacles(ctx, obstacles) {
  for (const obs of (obstacles || [])) {
    if (obs.type === "alambrada") drawAlambrada(ctx, obs);
    if (obs.type === "carreta") drawCarreta(ctx, obs);
    if (obs.type === "tanqueta_abandonada") drawWreckedTank(ctx, obs);
  }
}

function drawAlambrada(ctx, obs) {
  ctx.save();
  ctx.translate(obs.x, obs.y);
  ctx.rotate(obs.angle || 0);

  const posts = Math.floor(obs.length / 20);
  ctx.strokeStyle = "#3a2e1c";
  ctx.lineWidth = 2;
  for (let i = 0; i <= posts; i++) {
    const px = i * 20;
    ctx.beginPath();
    ctx.moveTo(px, -14); ctx.lineTo(px, 4);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(180, 180, 180, 0.6)";
  ctx.lineWidth = 0.8;
  for (const yy of [-11, -6]) {
    ctx.beginPath();
    ctx.moveTo(0, yy);
    for (let i = 0; i <= posts * 2; i++) {
      ctx.lineTo((i * obs.length) / (posts * 2), yy + (i % 2 === 0 ? 0 : 1.5));
    }
    ctx.stroke();
  }

  ctx.restore();
}

function drawCarreta(ctx, obs) {
  ctx.save();
  ctx.translate(obs.x, obs.y);
  ctx.rotate(-0.4);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 20, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6b5024";
  ctx.fillRect(-20, -12, 40, 24);
  ctx.strokeStyle = "#3a2e1c";
  ctx.lineWidth = 2;
  ctx.strokeRect(-20, -12, 40, 24);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  for (const yy of [-4, 4]) {
    ctx.beginPath(); ctx.moveTo(-20, yy); ctx.lineTo(20, yy); ctx.stroke();
  }

  ctx.strokeStyle = "#2b2114";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(15, 10, 10, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(15, 0); ctx.lineTo(15, 20);
  ctx.moveTo(5, 10); ctx.lineTo(25, 10);
  ctx.stroke();

  ctx.restore();
}

// Tanqueta Vickers 6-ton fuera de combate — nunca disparó un tiro, la
// tragó la arena. Es obstáculo (con el que se puede chocar) y también
// punto de historia (ver NARRATIVE_POINTS, id "tanqueta").
function drawWreckedTank(ctx, obs) {
  const x = obs.x, y = obs.y;

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 34, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.15);

  ctx.fillStyle = "#26261f";
  ctx.fillRect(-30, 6, 60, 10);
  for (let i = -26; i < 30; i += 8) {
    ctx.fillStyle = "#3a3a30";
    ctx.fillRect(i, 6, 5, 10);
  }
  ctx.fillStyle = "rgba(163, 129, 79, 0.55)";
  ctx.beginPath();
  ctx.ellipse(0, 14, 32, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(-0.06);
  ctx.fillStyle = "#4c5a3f";
  ctx.fillRect(-26, -14, 52, 22);
  ctx.strokeStyle = "#20241a";
  ctx.lineWidth = 2;
  ctx.strokeRect(-26, -14, 52, 22);
  ctx.fillStyle = "rgba(120, 70, 40, 0.45)";
  ctx.beginPath(); ctx.ellipse(-8, -4, 9, 6, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(14, 2, 6, 4, -0.3, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.translate(6, -18);
  ctx.rotate(0.9);
  ctx.fillStyle = "#3d4a33";
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#20241a";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#20241a";
  ctx.fillRect(0, -2, 20, 4);
  ctx.restore();

  ctx.restore();
  ctx.restore();

  ctx.strokeStyle = "rgba(139, 148, 92, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 18, y + 12); ctx.quadraticCurveTo(x - 20, y + 2, x - 15, y - 2);
  ctx.moveTo(x + 20, y + 14); ctx.quadraticCurveTo(x + 23, y + 4, x + 18, y);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// HISTORIA DEL LUGAR — homenaje a "El pozo" de Augusto Céspedes
// Textos propios (no son fragmentos del cuento). Los de ubicación aparecen
// al acercarse a un punto; los ambientales aparecen solos, de vez en
// cuando, mientras se juega; el de cierre aparece al ganar el nivel.
// ---------------------------------------------------------------------------
const NARRATIVE_POINTS = [
  { id: "cruz", x: 400, y: 500, radius: 75, marker: "cruz", title: "Cruz sin nombre", text: "" },
  { id: "cantimplora", x: 1000, y: 250, radius: 70, marker: "cantimplora", title: "La cantimplora vacía", text: "" },
  { id: "fusil", x: 250, y: 600, radius: 70, marker: "fusil", title: "Fusil sin dueño", text: "" },
  { id: "tanqueta", x: WRECKED_TANK.x, y: WRECKED_TANK.y, radius: 85, marker: null, title: "La tanqueta varada", text: "" },
  { id: "pozo", x: 700, y: 400, radius: 90, marker: "placa", title: "Cavar por agua", text: "" },
];

// Fragmentos cortos que no dependen de la posición — aparecen solos, muy de
// vez en cuando, para no recargar la partida con texto.
const AMBIENT_FRAGMENTS = [
  "Sed. Arena. Silencio.",
  "Todavía falta agua.",
  "El sol no perdona.",
  "Cavar. Resistir. Beber.",
  "Polvo en la garganta.",
];

// Texto que se muestra al terminar el nivel con victoria.
const NARRATIVE_ENDING = "Hay agua. Por fin.";

function drawNarrativeMarkers(ctx) {
  for (const p of NARRATIVE_POINTS) {
    switch (p.marker) {
      case "cruz": drawCrossMarker(ctx, p.x, p.y); break;
      case "cantimplora": drawCanteenMarker(ctx, p.x, p.y); break;
      case "fusil": drawBuriedRifleMarker(ctx, p.x, p.y); break;
      // "placa" ya va pegada al pozo en drawPozo(); la tanqueta destruida
      // ya se dibuja como obstáculo, no necesita marcador aparte.
    }
  }
}

function drawCrossMarker(ctx, x, y) {
  ctx.fillStyle = "rgba(58, 46, 28, 0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#5a4326";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y + 12); ctx.lineTo(x - 2, y - 16);
  ctx.moveTo(x - 8, y - 8); ctx.lineTo(x + 6, y - 10);
  ctx.stroke();
}

function drawCanteenMarker(ctx, x, y) {
  ctx.fillStyle = "rgba(58, 46, 28, 0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.5);
  ctx.fillStyle = "#5c6b52";
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a4436";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#8a8f7a";
  ctx.fillRect(-2, -11, 4, 4);
  ctx.strokeStyle = "rgba(120,60,40,0.6)";
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.moveTo(-6, i * 3); ctx.lineTo(6, i * 3); ctx.stroke();
  }
  ctx.restore();
}

function drawBuriedRifleMarker(ctx, x, y) {
  ctx.fillStyle = "rgba(58, 46, 28, 0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  ctx.strokeStyle = "#241d10";
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-14, 4); ctx.lineTo(10, -6); ctx.stroke();
  ctx.strokeStyle = "#5a3a1e";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-14, 4); ctx.lineTo(-4, 0); ctx.stroke();
  ctx.strokeStyle = "#1c1c1c";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(10, -6); ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(122, 96, 58, 0.6)";
  ctx.beginPath();
  ctx.ellipse(x - 12, y + 3, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

// terrain.js se sirve como <script> plano (no es módulo), así que estas
// `const` no quedan colgadas de `window` solas — hay que asignarlas a mano.
// Árboles, obstáculos y colisionadores ya NO viven acá: el servidor los
// manda por nivel dentro de /api/state (trees, obstacles, colliders), así
// nunca se pueden desincronizar entre cliente y servidor.
window.NARRATIVE_POINTS = NARRATIVE_POINTS;
window.AMBIENT_FRAGMENTS = AMBIENT_FRAGMENTS;
window.NARRATIVE_ENDING = NARRATIVE_ENDING;