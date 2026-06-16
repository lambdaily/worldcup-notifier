const { app, BrowserWindow, screen } = require("electron");
const path = require("path");

const SERVER = process.env.SERVER_URL || "http://localhost:3000";

let win;

function createOverlay() {
  const { width, height } = screen.getPrimaryDisplay().bounds;

  win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  // Siempre encima de TODO (incluso pantalla completa / otras apps)
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Click-through: no bloquea el mouse, los clicks pasan a las apps de abajo
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile(path.join(__dirname, "overlay.html"), {
    query: { server: SERVER },
  });
}

app.whenReady().then(createOverlay);
app.on("window-all-closed", () => app.quit());
