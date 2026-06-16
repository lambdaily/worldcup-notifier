import express from "express";
import webpush from "web-push";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- Configuración ----------
const PORT = process.env.PORT || 3000;
const MODE = process.env.MODE || "demo"; // "demo" | "live"
const FD_TOKEN = process.env.FD_TOKEN || ""; // token de football-data.org
const COMPETITION = process.env.COMPETITION || "WC"; // WC, CL, PD, PL, SA...
const POLL_MS = (Number(process.env.POLL_SECONDS) || 15) * 1000;

const DATA_DIR = path.join(__dirname, "data");
const SUBS_FILE = path.join(DATA_DIR, "subscriptions.json");
const VAPID_FILE = path.join(DATA_DIR, "vapid.json");
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- VAPID (claves para Web Push) ----------
let vapid;
if (process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE) {
  vapid = { publicKey: process.env.VAPID_PUBLIC, privateKey: process.env.VAPID_PRIVATE };
} else if (fs.existsSync(VAPID_FILE)) {
  vapid = JSON.parse(fs.readFileSync(VAPID_FILE, "utf8"));
} else {
  vapid = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapid, null, 2));
  console.log("🔑 Claves VAPID generadas en data/vapid.json");
}
webpush.setVapidDetails("mailto:goal@notifier.app", vapid.publicKey, vapid.privateKey);

// ---------- Suscripciones ----------
let subscriptions = fs.existsSync(SUBS_FILE)
  ? JSON.parse(fs.readFileSync(SUBS_FILE, "utf8"))
  : [];
const saveSubs = () => fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2));

function addSubscription(sub) {
  if (!subscriptions.find((s) => s.endpoint === sub.endpoint)) {
    subscriptions.push(sub);
    saveSubs();
  }
}
// Clientes SSE (overlay de escritorio Electron)
let sseClients = [];
function sseSend(payload) {
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach((res) => {
    try { res.write(line); } catch (e) {}
  });
}
// Emite un gol por TODOS los canales: push (móvil) + SSE (escritorio)
function emitGoal(goal) {
  sseSend(goal);
  return broadcast(goal);
}

async function broadcast(payload) {
  const json = JSON.stringify(payload);
  const dead = [];
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, json);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) dead.push(sub.endpoint);
      }
    })
  );
  if (dead.length) {
    subscriptions = subscriptions.filter((s) => !dead.includes(s.endpoint));
    saveSubs();
  }
}

// ---------- Estado de partidos ----------
let matches = []; // estado actual mostrado en la PWA
const lastScores = new Map(); // id -> "home-away"

// ---------- Fuente de datos: LIVE (football-data.org) ----------
async function fetchLive() {
  const url = `https://api.football-data.org/v4/competitions/${COMPETITION}/matches?status=LIVE`;
  const res = await fetch(url, { headers: { "X-Auth-Token": FD_TOKEN } });
  if (!res.ok) throw new Error(`football-data ${res.status}`);
  const data = await res.json();
  return (data.matches || []).map((m) => ({
    id: String(m.id),
    minute: m.minute ? `${m.minute}'` : m.status,
    home: {
      name: m.homeTeam.shortName || m.homeTeam.name,
      flag: m.homeTeam.crest,
      score: m.score.fullTime.home ?? 0,
    },
    away: {
      name: m.awayTeam.shortName || m.awayTeam.name,
      flag: m.awayTeam.crest,
      score: m.score.fullTime.away ?? 0,
    },
  }));
}

// ---------- Fuente de datos: DEMO (fixtures reales + simulación de los EN VIVO) ----------
const flag = (code) => `https://flagcdn.com/w320/${code}.png`;

// Partidos reales del Mundial. status: "finished" | "live" | "scheduled"
let demoFixtures = [
  { id: "wc-fr-sn", group: "I", status: "finished", min: 90,
    home: { name: "Francia", code: "fr", score: 3 }, away: { name: "Senegal", code: "sn", score: 1 } },
  { id: "wc-ir-nz", group: "G", status: "finished", min: 90,
    home: { name: "Irán", code: "ir", score: 2 }, away: { name: "Nueva Zelanda", code: "nz", score: 2 } },
  { id: "wc-iq-no", group: "I", status: "live", min: 0, when: "Hoy 19:00",
    home: { name: "Irak", code: "iq", score: 0 }, away: { name: "Noruega", code: "no", score: 0 } },
  { id: "wc-ar-dz", group: "J", status: "live", min: 0, when: "Hoy 22:00",
    home: { name: "Argentina", code: "ar", score: 0 }, away: { name: "Argelia", code: "dz", score: 0 } },
  { id: "wc-at-jo", group: "J", status: "live", min: 0, when: "Mañana 01:00",
    home: { name: "Austria", code: "at", score: 0 }, away: { name: "Jordania", code: "jo", score: 0 } },
  { id: "wc-pt-cd", group: "K", status: "live", min: 0, when: "Mañana 14:00",
    home: { name: "Portugal", code: "pt", score: 0 }, away: { name: "RD Congo", code: "cd", score: 0 } },
];

function fetchDemo() {
  return demoFixtures.map((m) => {
    if (m.status === "live") {
      m.min = Math.min(90, (m.min || 0) + 1);
      // ~15% de probabilidad de gol por ciclo
      if (Math.random() < 0.15) {
        const side = Math.random() < 0.5 ? "home" : "away";
        m[side].score += 1;
      }
      // Reiniciar partido cuando termina para seguir generando goles
      if (m.min >= 90) {
        m.min = 0;
        m.home.score = 0;
        m.away.score = 0;
      }
    }
    const label =
      m.status === "live" ? `${m.min}'` :
      m.status === "finished" ? "Fin" : (m.when || "Próx.");
    return {
      id: m.id,
      minute: `Grupo ${m.group} · ${label}`,
      home: { name: m.home.name, flag: flag(m.home.code), score: m.home.score },
      away: { name: m.away.name, flag: flag(m.away.code), score: m.away.score },
    };
  });
}

// ---------- Detección de goles ----------
async function poll() {
  try {
    const fresh = MODE === "live" ? await fetchLive() : fetchDemo();
    for (const m of fresh) {
      const key = `${m.home.score}-${m.away.score}`;
      const prev = lastScores.get(m.id);
      if (prev !== undefined && prev !== key) {
        const [ph, pa] = prev.split("-").map(Number);
        const scoredHome = m.home.score > ph;
        const scorer = scoredHome ? m.home : m.away;
        const goal = {
          type: "goal",
          team: scorer.name,
          flag: scorer.flag,
          homeName: m.home.name,
          awayName: m.away.name,
          score: `${m.home.score} - ${m.away.score}`,
          minute: m.minute,
        };
        console.log(`⚽ GOL: ${scorer.name} (${goal.homeName} ${goal.score} ${goal.awayName})`);
        emitGoal(goal);
      }
      lastScores.set(m.id, key);
    }
    matches = fresh;
  } catch (err) {
    console.error("poll error:", err.message);
  }
}

setInterval(poll, POLL_MS);
poll();

// ---------- Servidor HTTP ----------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/vapid", (_req, res) => res.json({ publicKey: vapid.publicKey }));
app.get("/api/matches", (_req, res) => res.json({ mode: MODE, matches }));

app.post("/api/subscribe", (req, res) => {
  addSubscription(req.body);
  res.json({ ok: true });
});

// Canal en tiempo real para el overlay de escritorio (Electron)
app.get("/api/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.flushHeaders();
  res.write(": conectado\n\n");
  sseClients.push(res);
  req.on("close", () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

// botón de prueba: dispara un gol de prueba a todos
app.post("/api/test-goal", async (_req, res) => {
  await emitGoal({
    type: "goal",
    team: "Argentina",
    flag: flag("ar"),
    homeName: "Argentina",
    awayName: "Brasil",
    score: "1 - 0",
    minute: "23'",
  });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Goal Notifier en http://localhost:${PORT}`);
  console.log(`   Modo: ${MODE}${MODE === "live" ? ` (competición ${COMPETITION})` : ""}`);
  console.log(`   Sondeo cada ${POLL_MS / 1000}s\n`);
});
