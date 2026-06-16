const params = new URLSearchParams(location.search);
const SERVER = params.get("server") || "http://localhost:3000";

const $ = (id) => document.getElementById(id);
const conn = $("conn");
const runner = $("runner");

function showConn(text) {
  conn.textContent = text;
  conn.classList.add("show");
  setTimeout(() => conn.classList.remove("show"), 2000);
}

function confettiBurst() {
  const box = $("confetti");
  box.innerHTML = "";
  const colors = ["#00e676", "#ffd23f", "#ff3b5c", "#3f8cff", "#fff"];
  for (let i = 0; i < 80; i++) {
    const p = document.createElement("div");
    p.className = "piece";
    p.style.left = Math.random() * 100 + "%";
    p.style.background = colors[(Math.random() * colors.length) | 0];
    p.style.animationDuration = 1.5 + Math.random() * 2 + "s";
    p.style.animationDelay = Math.random() * 0.5 + "s";
    box.appendChild(p);
  }
}

function celebrate(goal) {
  $("team").textContent = goal.team || "";
  $("score").textContent = goal.score || "0 - 0";
  $("flag").src = goal.flag || "";

  runner.classList.remove("hidden");
  runner.classList.remove("go");
  void runner.offsetWidth;
  runner.classList.add("go");

  confettiBurst();

  setTimeout(() => {
    runner.classList.add("hidden");
    runner.classList.remove("go");
  }, 5000);
}

function connect() {
  showConn("conectando…");
  const es = new EventSource(`${SERVER}/api/events`);

  es.onopen = () => showConn("conectado");

  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === "goal") celebrate(data);
    } catch (err) {}
  };

  es.onerror = () => {
    showConn("reconectando…");
  };
}

connect();
