// server.js
// El servidor es la autoridad. El cliente le pide cosas ("quiero moverme",
// "quiero disparar") y el servidor decide qué es válido y responde con el
// estado real. El cliente solo dibuja lo que el servidor confirma.

const express = require("express");
const path = require("path");
const gameState = require("./state");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "client")));

app.get("/api/state", (req, res) => {
  res.json(gameState.getPublicState());
});

app.post("/api/move", (req, res) => {
  const { direction, running } = req.body;
  const result = gameState.requestMove(direction, !!running);
  res.json(result);
});

app.post("/api/shoot", (req, res) => {
  const result = gameState.requestShoot();
  res.json(result);
});

app.post("/api/grenade", (req, res) => {
  const result = gameState.requestGrenade();
  res.json(result);
});

app.post("/api/melee", (req, res) => {
  const result = gameState.requestMelee();
  res.json(result);
});

app.post("/api/restart", (req, res) => {
  const level = Number.isInteger(req.body && req.body.level) ? req.body.level : 0;
  gameState.resetState(level);
  res.json({ ok: true });
});

app.post("/api/pause", (req, res) => {
  gameState.togglePause();
  res.json({ paused: gameState.getPublicState().paused });
});

app.post("/api/cheat-boss", (req, res) => {
  gameState.triggerBossCheat();
  res.json({ ok: true });
});

// Lanzallamas, ítems y regalos de prisioneros (ver extras.js).
require("./extras")(app);

// El "tick" del servidor: acá es donde los enemigos avanzan y disparan por
// su cuenta, sin que el cliente tenga que pedir nada. Es lo que le da vida
// al mundo aunque el jugador esté quieto.
const TICK_INTERVAL_MS = 100;
setInterval(() => {
  gameState.tick();
}, TICK_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`Servidor de El Pozo escuchando en http://localhost:${PORT}`);
});