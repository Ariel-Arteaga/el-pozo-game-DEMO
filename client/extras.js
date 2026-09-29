// client/extras.js — Lanzallamas, ítems que dan los prisioneros y rediseños
// (tanques y prisioneros atados). Se carga DESPUÉS de game.js y solo reemplaza
// o envuelve funciones ya existentes: no toca la red ni las colisiones.
(function () {
  const FLAME_SEND_MS = 120;
  const FLAME_RANGE_PX = 190;

  let flameHeld = false;
  let lastFlameVisualAt = -10000;
  let itemPopups = [];
  let seenItemEvents = new Set();

  const ITEM_LABELS = { botiquin: "+35 VIDA", granadas: "+5 GRANADAS", lanzallamas: "¡LANZALLAMAS!  [E]" };
  const ITEM_COLORS = { botiquin: "#8be39c", granadas: "#ffd83a", lanzallamas: "#ff9a2a" };

  const frac = (n) => n - Math.floor(n);

  // -------------------------------------------------------------------------
  // LANZALLAMAS — mantener E. El servidor decide el daño; acá solo se pide y
  // se dibuja el chorro de fuego.
  // -------------------------------------------------------------------------
  async function requestFlame() {
    try {
      const res = await fetch("/api/flame", { method: "POST" });
      const result = await res.json();
      if (result.ok) {
        lastFlameVisualAt = performance.now();
        shakeUntil = Math.max(shakeUntil, performance.now() + 70);
        shakeMag = Math.max(shakeMag, 1);
      }
    } catch (err) {
      console.error("No se pudo usar el lanzallamas:", err);
    }
  }

  window.addEventListener("keydown", (e) => {
    if ((e.key === "e" || e.key === "E") && gameState === "PLAYING") flameHeld = true;
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "e" || e.key === "E") flameHeld = false;
  });
  window.addEventListener("blur", () => { flameHeld = false; });

  setInterval(() => {
    if (!flameHeld || gameState !== "PLAYING" || !latestState) return;
    if (latestState.paused || latestState.gameOver) return;
    if ((latestState.navajas.fuel || 0) <= 0) return;
    requestFlame();
  }, FLAME_SEND_MS);

  function drawFlames() {
    if (!latestState) return;
    const now = performance.now();
    if (now - lastFlameVisualAt > 170) return;

    const nav = latestState.navajas;
    const np = renderPos.get("navajas") || nav;
    const [ox, oy] = DIR_OFFSETS[nav.dir] || [1, 0];
    const m = muzzlePoints.get("navajas");
    const sx = m ? m.x : np.x + ox * 24;
    const sy = m ? m.y : np.y - 17 + oy * 14;
    const px = -oy, py = ox;

    const N = 28;
    const seed = Math.floor(now / 55);
    const parts = [];
    for (let i = 0; i < N; i++) {
      const u = ((i / N) + now / 300) % 1;
      const r1 = frac(Math.sin(i * 12.9898 + seed * 3.17) * 43758.5453);
      const r2 = frac(Math.sin(i * 78.233 + seed * 1.91) * 12345.6789);
      const dist = 8 + u * FLAME_RANGE_PX;
      const spread = (r1 - 0.5) * (6 + dist * 0.42);
      parts.push({
        u,
        x: sx + ox * dist + px * spread,
        y: sy + oy * dist + py * spread - u * 5,
        r: 3 + u * 10 + r2 * 3,
      });
    }
    parts.sort((a, b) => b.u - a.u);

    ctx.save();
    ctx.lineJoin = "round";
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 34);
    glow.addColorStop(0, "rgba(255, 220, 130, 0.65)");
    glow.addColorStop(1, "rgba(255, 140, 40, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(sx, sy, 34, 0, Math.PI * 2); ctx.fill();

    for (const p of parts) {
      let fill, dark, edge;
      if (p.u < 0.2) { fill = "#fffbe0"; dark = "#ffd83a"; edge = "#f0a020"; }
      else if (p.u < 0.5) { fill = "#ffd83a"; dark = "#ff8a1f"; edge = "#c2560f"; }
      else if (p.u < 0.78) { fill = "#ff8a1f"; dark = "#e8481c"; edge = "#7a2410"; }
      else { fill = "#e8481c"; dark = "#a02410"; edge = "#3a1208"; }
      ctx.globalAlpha = p.u < 0.85 ? 1 : 1 - (p.u - 0.85) / 0.15;
      blastDisc(p.x, p.y, p.r, fill, dark, edge, 2);
    }
    ctx.restore();
  }

  // Tanque de combustible en la espalda (solo mientras hay combustible).
  function drawFuelTank(x, drawY, dir, moving) {
    if (dir === "down") return;
    const mirror = dir === "left" ? -1 : 1;
    const side = dir === "left" || dir === "right";
    const bx = x + (moving ? (side ? 2.8 * mirror : 0) : (side ? 1.2 * mirror : 0));
    const ty = drawY - 27;
    const tx = side ? (mirror > 0 ? bx - 19 : bx + 10) : bx - 5;
    ctx.save();
    ctx.lineJoin = "round";
    celBox(tx, ty, 9, 21, 4, "#c2462c", "#7a2412", "#12171a", 2);
    ctx.fillStyle = "#e8c04a";
    ctx.fillRect(tx + 0.5, ty + 8, 8, 2.6);
    celBox(tx + 2.4, ty - 3.6, 4.2, 4.4, 1.2, "#8a9096", "#4a5056", "#12171a", 1.5);
    ctx.restore();
  }

  // Boquilla del lanzallamas sobre el fusil mientras dispara fuego.
  function drawNozzle(m) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    celLine([[m.x - m.ux * 15, m.y - m.uy * 11], [m.x, m.y]], 6.4, "#59606a", "#12171a", 1.8);
    celLine([[m.x - m.ux * 2, m.y - m.uy * 2], [m.x + m.ux * 4, m.y + m.uy * 3]], 7.6, "#2a3238", "#12171a", 1.6);
    ctx.fillStyle = Math.sin(performance.now() / 40) > 0 ? "#ffd83a" : "#ff8a1f";
    ctx.beginPath(); ctx.arc(m.x + m.ux * 5, m.y + m.uy * 4, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawSoldadoBoliviano = function (id, x, y, dir) {
    const moving = isMoving(id, x, y);
    const bob = moving ? Math.abs(Math.sin(unitPhase(id))) * 2.2 : 0;
    const drawY = y - bob;

    ctx.fillStyle = "rgba(58, 46, 28, 0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + 16, 12, moving ? 3.5 : 5, 0, 0, Math.PI * 2);
    ctx.fill();

    const now = performance.now();
    const firing = now - lastShotVisualAt < 150;
    const flaming = now - lastFlameVisualAt < 260;

    let colors = UNIFORMS.boliviano;
    const remaining = damageFlashUntil - now;
    if (remaining > 0) {
      const pulse = Math.max(0, Math.sin((remaining / DAMAGE_FLASH_MS) * Math.PI * 3));
      colors = damagedUniform(UNIFORMS.boliviano, pulse * 0.8);
    }

    const meleeAge = now - lastMeleeVisualAt;
    const inMelee = meleeAge >= 0 && meleeAge < MELEE_THRUST_MS;
    const meleeT = inMelee ? meleeAge / MELEE_THRUST_MS : null;
    const hasTank = ((latestState && latestState.navajas && latestState.navajas.fuel) || 0) > 0;

    const muzzle = drawSoldierFigure(x, drawY, {
      dir, moving, phase: unitPhase(id), colors,
      weapon: inMelee ? "bayoneta" : "rifle", firing: firing || flaming, meleeT,
    });
    if (hasTank) drawFuelTank(x, drawY, dir, moving);
    if (flaming && muzzle && !inMelee) drawNozzle(muzzle);
    if (muzzle) muzzlePoints.set(id, muzzle);
  };

  // -------------------------------------------------------------------------
  // ÍTEMS — cajas en el suelo y regalos de prisioneros liberados.
  // -------------------------------------------------------------------------
  function drawItemIcon(type, now) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (type === "lanzallamas") {
      celBox(-7, -9, 14, 22, 5, "#c2462c", "#7a2412", "#1a0d08", 2.2);
      ctx.fillStyle = "#e8c04a";
      ctx.fillRect(-7, 0, 14, 3.2);
      ctx.strokeStyle = "#1a0d08"; ctx.lineWidth = 1.2;
      ctx.strokeRect(-7, 0, 14, 3.2);
      celBox(-2.4, -13, 4.8, 4.6, 1.4, "#8a9096", "#4a5056", "#1a0d08", 1.6);
      celLine([[7, -5], [12, -1], [11, 7]], 2.2, "#3a3a3a", "#12171a", 1.2);
      const f = Math.sin(now / 90) * 2;
      blastFlame(0, -14, 10 + f, 4.2, "#ff8a1f", "#000000", 1.8);
      blastFlame(0.4, -14.4, 5.5 + f * 0.6, 2.3, "#ffd83a", "#e8801a", 1);
    } else if (type === "botiquin") {
      celBox(-9, -7, 18, 14, 3, "#f1eee2", "#bdb8a4", "#1a1208", 2.2);
      ctx.fillStyle = "#d63a2a";
      ctx.fillRect(-2, -5, 4, 10);
      ctx.fillRect(-5, -2, 10, 4);
    } else if (type === "granadas") {
      ctx.save();
      ctx.scale(1.15, 1.15);
      drawGrenadeBody(now);
      ctx.restore();
    }
  }

  function drawItems() {
    if (!latestState || !Array.isArray(latestState.items)) return;
    const now = performance.now();
    for (const it of latestState.items) {
      const bob = Math.sin(now / 320 + it.x) * 2;
      const pulse = 0.5 + 0.5 * Math.sin(now / 300 + it.y);

      ctx.save();
      ctx.strokeStyle = `rgba(255, 220, 130, ${0.25 + pulse * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(it.x, it.y + 12, 17 + pulse * 3, 8 + pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(58, 46, 28, 0.35)";
      ctx.beginPath();
      ctx.ellipse(it.x, it.y + 12, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(it.x, it.y + bob);
      drawItemIcon(it.type, now);
      ctx.restore();
    }
  }

  function syncItemEvents() {
    if (!latestState || !Array.isArray(latestState.itemEvents)) return;
    const now = performance.now();
    for (const ev of latestState.itemEvents) {
      const key = `${ev.at}-${ev.type}`;
      if (seenItemEvents.has(key)) continue;
      seenItemEvents.add(key);
      itemPopups.push({
        text: ITEM_LABELS[ev.type] || ev.type,
        color: ITEM_COLORS[ev.type] || "#ffffff",
        x: ev.x, y: ev.y, startedAt: now,
      });
    }
    if (seenItemEvents.size > 100) seenItemEvents = new Set(Array.from(seenItemEvents).slice(-50));
  }

  function drawItemPopups() {
    const now = performance.now();
    itemPopups = itemPopups.filter((p) => now - p.startedAt < 1500);
    for (const p of itemPopups) {
      const t = (now - p.startedAt) / 1500;
      ctx.save();
      ctx.globalAlpha = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
      ctx.font = "bold 14px 'Special Elite', 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#1a0d08";
      const y = p.y - 34 - t * 26;
      ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, y);
      ctx.restore();
    }
  }

  // -------------------------------------------------------------------------
  // PRISIONERO ATADO — sentado contra un poste, manos y pies atados, ojos
  // vendados, respirando, con sudor y un forcejeo cada tanto.
  // -------------------------------------------------------------------------
  drawPrisonerTied = function (x, y) {
    const c = UNIFORMS.boliviano;
    const now = performance.now();
    const seed = x * 0.013;
    const inhale = 0.5 + 0.5 * Math.sin(now / 820 + seed);
    const cyc = (now / 1000 + seed * 3) % 6;
    const struggle = cyc < 0.7 ? Math.sin(now / 45) * (1 - cyc / 0.7) : 0;
    const sx = struggle * 1.1;
    const lift = inhale * 0.8;

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

    // Sombra y montículo de tierra.
    ctx.fillStyle = "rgba(58, 46, 28, 0.38)";
    ctx.beginPath(); ctx.ellipse(x, y + 12, 17, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(122, 96, 58, 0.55)";
    ctx.beginPath(); ctx.ellipse(x, y + 9, 12, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Poste al que está amarrado.
    celBox(x - 3.4, y - 33, 6.8, 40, 2, "#8a6a3c", "#4f3a1e", "#1d1108", 2);
    ctx.strokeStyle = "rgba(29, 17, 8, 0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 1, y - 30); ctx.lineTo(x - 1, y + 2); ctx.stroke();

    // Piernas estiradas con los tobillos atados.
    celLine([[x - 5, y + 3], [x - 6, y + 9]], 6, c.clothDark, c.outline);
    celLine([[x + 5, y + 3], [x + 6, y + 9]], 6, c.cloth, c.outline);
    celBox(x - 11, y + 8, 9, 7, 3, c.boot, c.bootDark, c.outline);
    celBox(x + 2, y + 8, 9, 7, 3, c.boot, c.bootDark, c.outline);
    celLine([[x - 9, y + 10], [x + 9, y + 10]], 3.2, ROPE_COLOR, ROPE_EDGE, 1.5);

    // Torso: camisa rota y sucia; sube y baja al respirar.
    const ty = y - 10 - lift;
    celBox(x - 9.5 + sx, ty, 19, 18 + inhale * 0.9, 5, c.cloth, c.clothDark, c.outline, 2.4);
    ctx.fillStyle = c.skin;
    ctx.beginPath(); ctx.ellipse(x + 5 + sx, ty + 5, 3.4, 2.4, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c.outline; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = "rgba(26, 18, 8, 0.75)"; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 9 + sx, ty + 17); ctx.lineTo(x - 6 + sx, ty + 14); ctx.lineTo(x - 3 + sx, ty + 18);
    ctx.lineTo(x + 1 + sx, ty + 15); ctx.lineTo(x + 5 + sx, ty + 19);
    ctx.stroke();
    ctx.fillStyle = "rgba(50, 34, 18, 0.32)";
    ctx.beginPath(); ctx.ellipse(x - 3 + sx, ty + 9, 4, 2.6, 0.3, 0, Math.PI * 2); ctx.fill();

    // Brazos hacia atrás (manos atadas al poste).
    celLine([[x - 9 + sx, ty + 4], [x - 11, ty + 12]], 4.6, c.clothDark, c.outline);
    celLine([[x + 9 + sx, ty + 4], [x + 11, ty + 12]], 4.6, c.cloth, c.outline);
    celDisc(x - 11, ty + 13, 2.2, ROPE_COLOR, ROPE_EDGE, ROPE_EDGE, 1.2);
    celDisc(x + 11, ty + 13, 2.2, ROPE_COLOR, ROPE_EDGE, ROPE_EDGE, 1.2);

    // Soga alrededor del pecho, con nudo.
    celLine([[x - 10 + sx, ty + 4.5], [x + 10 + sx, ty + 5.5]], 2.2, ROPE_COLOR, ROPE_EDGE, 1.1);
    celLine([[x - 10 + sx, ty + 12.5], [x + 10 + sx, ty + 13.5]], 2.2, ROPE_COLOR, ROPE_EDGE, 1.1);
    celDisc(x + 8 + sx, ty + 8.5, 2.3, ROPE_COLOR, ROPE_EDGE, ROPE_EDGE, 1.2);
    celLine([[x + 8 + sx, ty + 10], [x + 10.5 + sx, ty + 16]], 2.2, ROPE_COLOR, ROPE_EDGE, 1.1);

    // Cabeza gacha, con ojos vendados, magulladura y sudor.
    const hx = x + 1 + sx * 1.3;
    const hy = ty - 3 + (cyc < 0.7 ? -1.2 : 1.4);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(0.12 + Math.sin(now / 900 + seed) * 0.04 + struggle * 0.05);
    celDisc(0, 0, 7.2, c.skin, c.skinDark, c.outline);
    ctx.fillStyle = "#2b1d10";
    ctx.beginPath(); ctx.arc(0, -0.6, 7.2, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    ctx.fillStyle = "rgba(110, 62, 96, 0.55)";
    ctx.beginPath(); ctx.ellipse(-3.6, 3, 2.3, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    celLine([[-7.4, -0.4], [7.4, 0.4]], 3.8, "#e6dfc8", "#2a241a", 1.4);
    celLine([[7, 0.4], [10.4, 4]], 2.2, "#e6dfc8", "#2a241a", 1);
    ctx.restore();

    const t = (now / 2400 + seed) % 1;
    ctx.fillStyle = `rgba(190, 225, 240, ${0.95 - t * 0.9})`;
    ctx.beginPath();
    ctx.arc(hx + 7.2, hy - 3 + t * 10, 1.5 * (1 - t * 0.3), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // -------------------------------------------------------------------------
  // TANQUETA VICKERS 6-ton (dos torretas), vista desde arriba.
  // -------------------------------------------------------------------------
  let tankMuzzleFlashes = [];
  let tankExhaustSmokes = [];

  drawEnemyVehicle = function (id, x, y, dir, colors, aimAngle) {
    const moving = isMoving(id, x, y);
    const phase = unitPhase(id, 90);
    const [ox, oy] = DIR_OFFSETS[dir] || [1, 0];
    const angle = Math.atan2(oy, ox);
    const useAim = (typeof aimAngle === "number") ? aimAngle : angle;
    const now = performance.now();
    const rumble = moving ? Math.sin(now / 38 + phase) * 0.45 : Math.sin(now / 260 + phase) * 0.15;

    // Retroceso de las torretas al disparar — comparten el mismo flag de
    // disparo que usan las torretas fijas y los soldados (enemyFiringUntil),
    // así que no hace falta ningún dato nuevo del servidor.
    const untilFiring = enemyFiringUntil.get(id) || 0;
    const firing = untilFiring > now;
    const fireT = firing ? 1 - (untilFiring - now) / 150 : 1;
    const turretRecoil = firing ? Math.max(0, 1 - fireT) * 2.6 : 0;

    if (firing && fireT < 0.1) {
      tankMuzzleFlashes.push({ id, startedAt: now });
    }
    tankMuzzleFlashes = tankMuzzleFlashes.filter((f) => now - f.startedAt < 200);

    // Humo de escape constante mientras se mueve, saliendo de la parte
    // trasera del casco (no solo el polvo bajo las orugas que ya había).
    if (moving && Math.random() < 0.35) {
      const backAngle = angle + Math.PI;
      tankExhaustSmokes.push({
        id,
        x: x + Math.cos(backAngle) * 22 + (Math.random() - 0.5) * 4,
        y: y + Math.sin(backAngle) * 22 + (Math.random() - 0.5) * 4,
        startedAt: now,
      });
    }
    tankExhaustSmokes = tankExhaustSmokes.filter((s) => now - s.startedAt < 1300);

    ctx.fillStyle = "rgba(20, 16, 10, 0.4)";
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 17, 31, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    if (moving) {
      for (let i = 0; i < 3; i++) {
        const t = ((now / 420) + i / 3) % 1;
        ctx.fillStyle = `rgba(78, 78, 72, ${(1 - t) * 0.5})`;
        ctx.beginPath();
        ctx.arc(x - ox * (28 + t * 22), y - oy * (28 + t * 22) - 6 - t * 9, 2 + t * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.translate(0, rumble);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Orugas con eslabones que avanzan, rueda motriz y rueda guía.
    for (const s of [-15, 15]) {
      ctx.fillStyle = colors.outline;
      roundRect(-28, s - 6, 56, 12, 5);
      ctx.fill();
      ctx.fillStyle = colors.track;
      roundRect(-27, s - 5, 54, 10, 4);
      ctx.fill();
      const off = moving ? (phase * 5) % 6 : 0;
      ctx.fillStyle = colors.trackLight;
      for (let i = -26 + off; i < 26; i += 6) ctx.fillRect(i, s - 4.2, 2.4, 8.4);
      for (const wx of [-22, 22]) {
        ctx.fillStyle = "#1d1f18";
        ctx.beginPath(); ctx.arc(wx, s, 4.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#4a4d40";
        ctx.beginPath(); ctx.arc(wx, s, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = colors.hullDark;
      ctx.fillRect(-25, s + (s < 0 ? -6 : 4), 50, 2);
    }

    // Casco con proa inclinada.
    const hullPath = () => {
      ctx.beginPath();
      ctx.moveTo(-24, -11.5); ctx.lineTo(15, -11.5); ctx.lineTo(26, -6.5);
      ctx.lineTo(26, 6.5); ctx.lineTo(15, 11.5); ctx.lineTo(-24, 11.5);
      ctx.closePath();
    };
    const hullGrad = ctx.createLinearGradient(0, -11.5, 0, 11.5);
    hullGrad.addColorStop(0, colors.hullLight);
    hullGrad.addColorStop(0.5, colors.hull);
    hullGrad.addColorStop(1, colors.hullDark);
    hullPath();
    ctx.fillStyle = hullGrad;
    ctx.fill();

    ctx.save();
    hullPath();
    ctx.clip();
    // Camuflaje.
    ctx.fillStyle = "rgba(52, 44, 24, 0.5)";
    ctx.beginPath(); ctx.ellipse(-8, -5, 9, 4, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(9, 6, 8, 3.5, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-17, 7, 5, 3, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(176, 152, 96, 0.38)";
    ctx.beginPath(); ctx.ellipse(4, -8, 7, 3, 0.1, 0, Math.PI * 2); ctx.fill();
    // Cubierta del motor con rejilla.
    ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
    ctx.fillRect(-24, -9.5, 15, 19);
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    for (let i = 0; i < 5; i++) ctx.fillRect(-22 + i * 2.8, -7.5, 1.5, 15);
    // Uniones y remaches.
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-9, -11.5); ctx.lineTo(-9, 11.5);
    ctx.moveTo(9, -11.5); ctx.lineTo(9, 11.5);
    ctx.stroke();
    ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
    for (let rx = -20; rx <= 22; rx += 6) {
      ctx.beginPath(); ctx.arc(rx, -9.5, 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx, 9.5, 0.9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath(); ctx.moveTo(15, -11.5); ctx.lineTo(26, -6.5); ctx.lineTo(26, 6.5); ctx.lineTo(15, 11.5); ctx.closePath(); ctx.fill();
    ctx.restore();

    hullPath();
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // Franja de identificación, faros, escape y escotilla del conductor.
    ctx.fillStyle = colors.accent;
    ctx.fillRect(-3, -10.6, 11, 1.6);
    ctx.fillRect(-3, 9, 11, 1.6);
    for (const ly of [-4.4, 4.4]) {
      ctx.fillStyle = "#ece6c2";
      ctx.beginPath(); ctx.arc(25.4, ly, 1.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = colors.outline; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.fillStyle = "#2b2b28";
    roundRect(-27, -8.6, 4, 3, 1.4); ctx.fill();
    ctx.fillStyle = colors.outline;
    roundRect(11, -2.8, 8, 5.6, 2); ctx.fill();
    ctx.fillStyle = colors.hullDark;
    roundRect(11.8, -2, 6.4, 4, 1.6); ctx.fill();
    ctx.fillStyle = "#0d0f0b";
    ctx.fillRect(17, -1.2, 1.4, 2.4);

    // Escotilla del comandante con periscopio que gira lento — le da vida
    // al casco cuando el tanque está quieto o esperando línea de tiro.
    ctx.fillStyle = colors.hullDark;
    ctx.beginPath(); ctx.arc(-6, -1, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = colors.outline; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.save();
    ctx.translate(-6, -1);
    ctx.rotate((now / 900) % (Math.PI * 2));
    ctx.fillStyle = "#2a2f26";
    ctx.fillRect(-1, -3.6, 2, 3);
    ctx.restore();

    ctx.restore();

    // Humo negro y chispas saliendo del casco cuando el tanque está muy
    // dañado — usamos la misma señal que ya tiñe el casco de rojo
    // (damagedVehicle en game.js siempre pasa por acá con un "t" alto).
    const isCritical = colors.hull !== VEHICLE_PALETTES[Object.keys(VEHICLE_PALETTES).find((k) => VEHICLE_PALETTES[k] === colors)]?.hull;

    // Las torretas se dibujan FUERA del giro del casco: su base va montada
    // sobre el casco (por eso su posición depende de "angle"), pero el
    // cañón apunta de forma continua al objetivo real ("useAim") en vez de
    // quedar encajado en una de las 4 direcciones del movimiento — así ya
    // no se ven "clavados" cuando el blanco está en diagonal o al costado.
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    for (const ty of [-6.4, 6.4]) {
      const anchorX = x + 2 * cosA - ty * sinA;
      const anchorY = y + 2 * sinA + ty * cosA;

      ctx.save();
      ctx.translate(anchorX, anchorY);
      ctx.rotate(useAim);
      ctx.translate(-turretRecoil, 0);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      ctx.fillStyle = colors.outline;
      ctx.beginPath(); ctx.arc(0, 0, 7.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = colors.turret;
      ctx.beginPath(); ctx.arc(0, 0, 6.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.13)";
      ctx.beginPath(); ctx.arc(-1.4, -1.6, 3.6, Math.PI * 1.05, Math.PI * 1.75); ctx.fill();
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, 5.4, -0.6, 0.6); ctx.stroke();
      ctx.fillStyle = colors.hullDark;
      ctx.beginPath(); ctx.arc(-1, 0, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = colors.outline; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = colors.barrel;
      ctx.fillRect(5, -1.2, 15, 2.4);
      ctx.fillStyle = "#3d423a";
      ctx.fillRect(6, -1.9, 7, 3.8);
      ctx.fillStyle = "#0d0f0b";
      for (let h = 0; h < 3; h++) ctx.fillRect(7.4 + h * 2.2, -0.5, 0.9, 1);
      ctx.fillStyle = colors.outline;
      ctx.fillRect(20, -1.7, 2.6, 3.4);

      // Destello de disparo en la punta del cañón — mismo flag de firing
      // que dispara el retroceso.
      if (firing && fireT < 0.5) {
        ctx.save();
        ctx.globalAlpha = 1 - fireT / 0.5;
        ctx.fillStyle = "#ffd83a";
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(27, -3);
        ctx.lineTo(30, 0);
        ctx.lineTo(27, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }

    // Humo residual del disparo, en el punto medio entre las dos torretas.
    for (const f of tankMuzzleFlashes) {
      if (f.id !== id) continue;
      const ft = (now - f.startedAt) / 200;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.4 - ft * 0.4);
      ctx.fillStyle = "#cfcabb";
      ctx.beginPath();
      ctx.arc(x + Math.cos(useAim) * 34, y + Math.sin(useAim) * 34, 4 + ft * 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Estela de humo de escape, siguiendo al tanque un rato después de
    // haber sido emitida.
    for (const s of tankExhaustSmokes) {
      if (s.id !== id) continue;
      const st = (now - s.startedAt) / 1300;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.35 - st * 0.35);
      ctx.fillStyle = "#4a4a44";
      ctx.beginPath();
      ctx.arc(s.x, s.y - st * 14, 2.4 + st * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    return { x: x + Math.cos(useAim) * 30, y: y + Math.sin(useAim) * 30, ux: Math.cos(useAim), uy: Math.sin(useAim) };
  };

  // -------------------------------------------------------------------------
  // Enganches a funciones existentes (siempre protegidos con try/catch para
  // que un error visual nunca detenga el juego).
  // -------------------------------------------------------------------------
  const baseDrawPrisoners = drawPrisoners;
  drawPrisoners = function () {
    baseDrawPrisoners();
    try { drawItems(); } catch (err) { console.error(err); }
  };

  const baseDrawMeleeSlashes = drawMeleeSlashes;
  drawMeleeSlashes = function () {
    baseDrawMeleeSlashes();
    try { drawFlames(); } catch (err) { console.error(err); }
  };

  const baseDrawSmokes = drawLingeringSmokes;
  drawLingeringSmokes = function () {
    baseDrawSmokes();
    try { drawItemPopups(); } catch (err) { console.error(err); }
  };

  const baseUpdateHud = updateHud;
  updateHud = function () {
    baseUpdateHud();
    const el = document.getElementById("fuel-count");
    if (el && latestState && latestState.navajas) el.textContent = latestState.navajas.fuel || 0;
  };

  const baseFetchState = fetchState;
  fetchState = async function () {
    await baseFetchState();
    if (gameState === "PLAYING") syncItemEvents();
  };
})();