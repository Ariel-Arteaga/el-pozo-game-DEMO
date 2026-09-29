// client/audio.js — efectos de sonido generados por código con Web Audio
// API y audios externos.
(function () {
  let ctxAudio = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicStarted = false;

  // --- AQUÍ CARGAMOS TUS SONIDOS DESDE LA CARPETA ASSETS ---
  const sndExplosion = new Audio('assets/explosion_granada.mp3');
  const sndDisparo = new Audio('assets/disparos.mp3');
  const sndCavando = new Audio('assets/cavando.mp3');
  const sndDestruccion = new Audio('assets/destruccion.mp3');
  
  const sndAvioneta = new Audio('assets/avioneta.mp3');
  sndAvioneta.loop = true; 
  
  const sndItemLanza = new Audio('assets/item_lanza.mp3');
  
  const sndLanzallamas = new Audio('assets/lanzallamas.mp3');
  sndLanzallamas.loop = true;  // NUEVO: Que se repita mientras mantenemos pulsado
  sndLanzallamas.volume = 0.7; // NUEVO: Le bajamos el volumen (de 1.0 a 0.4)
  
  const sndAcabaLanzallamas = new Audio('assets/acaba_lanzallamas.mp3');
  
  // Arreglo con todos los sonidos de muerte para elegirlos al azar
  const sndMuertes = [
    new Audio('assets/muerte1.mp3'),
    new Audio('assets/muerte2.mp3'),
    new Audio('assets/muerte3.mp3'),
    new Audio('assets/muerte4.mp3'),
    new Audio('assets/muerte5.mp3'),
    new Audio('assets/muerte6.mp3'),
    new Audio('assets/muerte7.mp3')
  ];

  // Arreglo exclusivo para el protagonista (sin la muerte2)
  const sndMuertesProta = [
    new Audio('assets/muerte1.mp3'),
    new Audio('assets/muerte3.mp3'),
    new Audio('assets/muerte4.mp3'),
    new Audio('assets/muerte5.mp3'),
    new Audio('assets/muerte6.mp3'),
    new Audio('assets/muerte7.mp3')
  ];
  // ---------------------------------------------------------

  function ensureAudio() {
    if (ctxAudio) return ctxAudio;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctxAudio = new AC();
    masterGain = ctxAudio.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctxAudio.destination);
    musicGain = ctxAudio.createGain();
    musicGain.gain.value = 0.22;
    musicGain.connect(masterGain);
    sfxGain = ctxAudio.createGain();
    sfxGain.gain.value = 1;
    sfxGain.connect(masterGain);
    return ctxAudio;
  }

  function resumeAudio() {
    const c = ensureAudio();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    if (!musicStarted) {
      musicStarted = true;
      startAmbientMusic();
    }
  }
  window.addEventListener("pointerdown", resumeAudio);
  window.addEventListener("keydown", resumeAudio);

  function noiseBuffer(duration) {
    const c = ensureAudio();
    const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * duration)), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function playNoiseBurst({ duration = 0.15, filterFreq = 1200, filterType = "lowpass", gain = 0.5, decay = 0.12 } = {}) {
    const c = ensureAudio();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(duration);
    const filter = c.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + decay);
    src.connect(filter); filter.connect(g); g.connect(sfxGain);
    src.start();
    src.stop(c.currentTime + duration + 0.05);
  }

  function playTone({ freq = 220, type = "sine", duration = 0.2, gain = 0.3, freqEnd = null } = {}) {
    const c = ensureAudio();
    if (!c) return;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + duration);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(g); g.connect(sfxGain);
    osc.start();
    osc.stop(c.currentTime + duration + 0.02);
  }

  // --- Efectos concretos ---

  window.sfxGunshot = function () {
    // Reproduce el audio de tu disparo desde assets
    sndDisparo.cloneNode().play().catch(err => console.log("Audio no pudo reproducirse:", err));
  };

  window.sfxEnemyGunshot = function () {
    // Reproducimos el mp3 para los enemigos (usa el mismo 'sndDisparo' de arriba)
    sndDisparo.cloneNode().play().catch(err => console.log("Audio no pudo reproducirse:", err));
  };

  window.sfxMelee = function () {
    playNoiseBurst({ duration: 0.1, filterFreq: 3200, filterType: "highpass", gain: 0.3, decay: 0.09 });
  };

  window.sfxExplosion = function () {
    // Reproduce el audio de tu explosión desde assets
    sndExplosion.cloneNode().play().catch(err => console.log("Audio no pudo reproducirse:", err));
  };

  // Seguro de tiempo para que la pala no suene 60 veces por segundo
  let lastDig = 0;
  window.sfxDig = function () {
    const now = performance.now();
    if (now - lastDig > 120) { 
      lastDig = now;
      sndCavando.cloneNode().play().catch(err => console.log("Audio no pudo reproducirse:", err));
    }
  };

  // Escoge un sonido aleatorio de la lista y lo reproduce
  window.sfxDeath = function () {
    const randomIndex = Math.floor(Math.random() * sndMuertes.length);
    sndMuertes[randomIndex].cloneNode().play().catch(err => console.log("Audio no pudo reproducirse:", err));
  };

  // Escoge un grito aleatorio SOLO para el protagonista
  window.sfxPlayerDeath = function () {
    const randomIndex = Math.floor(Math.random() * sndMuertesProta.length);
    sndMuertesProta[randomIndex].cloneNode().play().catch(err => console.log("Audio no pudo reproducirse:", err));
  };

  // Nuevos sonidos de vehículos y lanzallamas
  window.sfxDestruction = function () {
    sndDestruccion.cloneNode().play().catch(err => console.log(err));
  };
  
  window.sfxItemFlame = function () {
    sndItemLanza.cloneNode().play().catch(err => console.log(err));
  };

  window.sfxFlameUse = function () {
    // Ya NO lo clonamos. Usamos el principal para poder pausarlo.
    if (sndLanzallamas.paused) {
      sndLanzallamas.play().catch(err => console.log(err));
    }
  };

  // NUEVO: Función para cortar el sonido en seco
  window.sfxFlameStop = function () {
    sndLanzallamas.pause();
    sndLanzallamas.currentTime = 0; // Lo reiniciamos desde cero para la próxima vez
  };

  window.sfxFlameEmpty = function () {
    sndAcabaLanzallamas.cloneNode().play().catch(err => console.log(err));
  };

  // Lógica para que el volumen de la avioneta suba y baje según la distancia
  let planePlaying = false;
  window.updatePlaneAudio = function (planes, navajas) {
    if (!planes || planes.length === 0 || !navajas || !navajas.alive) {
      if (planePlaying) {
        sndAvioneta.pause();
        planePlaying = false;
      }
      return;
    }
    
    // Calcula la distancia a la avioneta más cercana
    let minDist = Infinity;
    for (const pl of planes) {
      const d = Math.hypot(pl.x - navajas.x, pl.y - navajas.y);
      if (d < minDist) minDist = d;
    }

    // A partir de los 1200 píxeles empieza a escucharse cada vez más fuerte
    let vol = Math.max(0, 1 - (minDist / 1200));
    sndAvioneta.volume = vol * 1.0; // ¡Volumen al máximo permitido por el navegador!

    if (vol > 0 && !planePlaying) {
      sndAvioneta.play().catch(err => console.log(err));
      planePlaying = true;
    } else if (vol <= 0 && planePlaying) {
      sndAvioneta.pause();
      planePlaying = false;
    }
  };

  window.sfxMortarLaunch = function () {
    playNoiseBurst({ duration: 0.2, filterFreq: 800, gain: 0.3, decay: 0.18 });
    playTone({ freq: 200, type: "sine", duration: 0.2, gain: 0.18, freqEnd: 400 });
  };

  window.sfxFootstep = function () {
    playNoiseBurst({ duration: 0.05, filterFreq: 350, gain: 0.12, decay: 0.05 });
  };

  window.sfxVictory = function () {
    playTone({ freq: 392, type: "triangle", duration: 0.18, gain: 0.3 });
    setTimeout(() => playTone({ freq: 494, type: "triangle", duration: 0.18, gain: 0.3 }), 140);
    setTimeout(() => playTone({ freq: 587, type: "triangle", duration: 0.35, gain: 0.3 }), 280);
  };

  window.sfxDefeat = function () {
    playTone({ freq: 220, type: "sawtooth", duration: 0.5, gain: 0.25, freqEnd: 90 });
  };

  window.sfxLevelComplete = function () {
    playTone({ freq: 330, type: "triangle", duration: 0.2, gain: 0.28 });
    setTimeout(() => playTone({ freq: 440, type: "triangle", duration: 0.3, gain: 0.28 }), 130);
  };

  // Música ambiente: drone grave de tensión con un LFO lento que lo hace
  // "respirar", en loop constante mientras se juega.
  function startAmbientMusic() {
    const c = ensureAudio();
    if (!c) return;
    const osc1 = c.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 55;
    const osc2 = c.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 55 * 1.5;
    const lfo = c.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.07;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain);
    const g = c.createGain();
    g.gain.value = 0.12;
    lfoGain.connect(g.gain);
    osc1.connect(g); osc2.connect(g); g.connect(musicGain);
    osc1.start(); osc2.start(); lfo.start();
  }
})();