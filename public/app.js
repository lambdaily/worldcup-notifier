// ---------- Estado ----------
let soundOn = true;
let audioCtx = null;
const prevScores = new Map();

const $ = (id) => document.getElementById(id);

// ---------- Capacitor (app nativa) ----------
import { initCapacitor, showNativeNotification, isNativeApp } from './capacitor.js';
initCapacitor();

window.addEventListener('capacitor-goal', (e) => {
  celebrate(e.detail);
});

window.addEventListener('app-resumed', () => {
  refreshMatches();
});

// ---------- Sonido de gol (sintetizado, sin archivos) ----------
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}
function playGoalSound() {
  if (!soundOn) return;
  initAudio();
  const now = audioCtx.currentTime;

  // Bocina de estadio (dos tonos)
  [0, 0.18].forEach((t, i) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sawtooth";
    o.frequency.value = i === 0 ? 320 : 400;
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.exponentialRampToValueAtTime(0.25, now + t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.5);
    o.connect(g).connect(audioCtx.destination);
    o.start(now + t);
    o.stop(now + t + 0.55);
  });

  // "Rugido" de multitud con ruido filtrado
  const dur = 1.6;
  const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const bp = audioCtx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1000;
  bp.Q.value = 0.7;
  const ng = audioCtx.createGain();
  ng.gain.setValueAtTime(0.0001, now);
  ng.gain.exponentialRampToValueAtTime(0.22, now + 0.4);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  noise.connect(bp).connect(ng).connect(audioCtx.destination);
  noise.start(now);
  noise.stop(now + dur);
}

// ---------- Confeti ----------
function confettiBurst() {
  const box = $("confetti");
  box.innerHTML = "";
  const colors = ["#00e676", "#ffd23f", "#ff3b5c", "#3f8cff", "#fff"];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement("div");
    p.className = "confetti-piece";
    p.style.left = Math.random() * 100 + "%";
    p.style.background = colors[(Math.random() * colors.length) | 0];
    p.style.animationDuration = 1.5 + Math.random() * 1.5 + "s";
    p.style.animationDelay = Math.random() * 0.4 + "s";
    box.appendChild(p);
  }
}

// ---------- Celebración ----------
let overlayTimer = null;

function hideOverlay() {
  const overlay = $("goalOverlay");
  overlay.classList.add("exit");
  setTimeout(() => {
    overlay.classList.add("hidden");
    overlay.classList.remove("exit");
  }, 800);
}

function celebrate(goal) {
  $("goalFlag").src = goal.flag || "";
  $("goalTeam").textContent = goal.team || "";
  $("goalHome").textContent = goal.homeName || "Local";
  $("goalAway").textContent = goal.awayName || "Visitante";
  $("goalScore").textContent = goal.score || "0 - 0";
  $("goalMinute").textContent = goal.minute ? `⏱ ${goal.minute}` : "";
  $("goalOverlay").classList.remove("hidden", "exit");
  confettiBurst();
  playGoalSound();
  if (navigator.vibrate) navigator.vibrate([200, 80, 200, 80, 400]);

  clearTimeout(overlayTimer);
  overlayTimer = setTimeout(hideOverlay, 7000);
}
$("goalOverlay").addEventListener("click", () => {
  clearTimeout(overlayTimer);
  hideOverlay();
});

// ---------- Render de partidos ----------
async function refreshMatches() {
  try {
    const res = await fetch("/api/matches");
    const { matches } = await res.json();
    const box = $("matches");
    if (!matches.length) {
      box.innerHTML = '<p class="empty">No hay partidos en vivo ahora mismo.</p>';
      return;
    }
    box.innerHTML = matches
      .map(
        (m) => `
      <div class="match" data-id="${m.id}">
        <div class="team">
          <img src="${m.home.flag}" alt="" onerror="this.style.opacity=0" />
          <span>${m.home.name}</span>
        </div>
        <div>
          <div class="score">${m.home.score} - ${m.away.score}</div>
          <span class="match__minute">${m.minute}</span>
        </div>
        <div class="team team--away">
          <img src="${m.away.flag}" alt="" onerror="this.style.opacity=0" />
          <span>${m.away.name}</span>
        </div>
      </div>`
      )
      .join("");

    // Detección local de gol (si la app está abierta) por si no llega el push
    for (const m of matches) {
      const key = `${m.home.score}-${m.away.score}`;
      const prev = prevScores.get(m.id);
      if (prev !== undefined && prev !== key) {
        const el = document.querySelector(`.match[data-id="${m.id}"]`);
        if (el) { el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1000); }
      }
      prevScores.set(m.id, key);
    }
  } catch (e) {
    /* servidor no disponible */
  }
}

// ---------- Web Push ----------
function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function enableNotifications() {
  initAudio(); // desbloquea audio con el gesto del usuario
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Tu navegador no soporta notificaciones push.");
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    alert("Necesitas permitir las notificaciones para recibir avisos de gol.");
    return;
  }
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await (await fetch("/api/vapid")).json();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  await fetch("/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub),
  });
  $("notifBanner").classList.add("hidden");
  setStatus(true);
}

function setStatus(on) {
  const s = $("status");
  s.textContent = on ? "Avisos ON" : "Avisos OFF";
  s.className = "status " + (on ? "status--on" : "status--off");
}

// ---------- Detección de iOS / PWA ----------
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
if (isIOS && !isStandalone) $("iosHint").classList.remove("hidden");

// ---------- Eventos UI ----------
$("enableNotif").addEventListener("click", enableNotifications);
$("soundToggle").addEventListener("click", () => {
  soundOn = !soundOn;
  $("soundToggle").textContent = soundOn ? "🔊" : "🔇";
  if (soundOn) { initAudio(); playGoalSound(); }
});
$("testBtn").addEventListener("click", async () => {
  initAudio();
  try { await fetch("/api/test-goal", { method: "POST" }); } catch (e) {}
  // también mostramos localmente al instante
  celebrate({
    team: "Argentina",
    flag: "https://flagcdn.com/w320/ar.png",
    homeName: "Argentina", awayName: "Brasil",
    score: "1 - 0", minute: "23'",
  });
});

// ---------- Mensajes desde el Service Worker (push con app abierta) ----------
navigator.serviceWorker?.addEventListener("message", (e) => {
  if (e.data?.type === "goal") celebrate(e.data);
});

// ---------- Arranque ----------
async function init() {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("sw.js");
      const perm = Notification.permission;
      setStatus(perm === "granted");
      if (perm === "granted") $("notifBanner").classList.add("hidden");
    } catch (e) { console.error("SW error", e); }
  }

  // Verificar si hay un gol en la URL (desde notificación)
  const params = new URLSearchParams(location.search);
  if (params.get("goal")) {
    try { celebrate(JSON.parse(decodeURIComponent(params.get("goal")))); } catch (e) {}
  } else {
    // Verificar si hay un gol guardado en cache (app cerrada)
    try {
      const cache = await caches.open("goal-notifier");
      const response = await cache.match("/last-goal");
      if (response) {
        const goal = await response.json();
        celebrate(goal);
        await cache.delete("/last-goal");
      }
    } catch (e) {}
  }

  refreshMatches();
  setInterval(refreshMatches, 10000);
}
init();
