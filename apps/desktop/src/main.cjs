const { app, BrowserWindow, Menu, nativeTheme, shell, ipcMain, Tray, Notification, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const packageMetadata = require("../package.json");

const HOTEL_URL = process.env.HOTELOPS_URL || "https://noderasoftware.com/hotel/";
const DESKTOP_APP_VERSION = typeof packageMetadata.version === "string" && packageMetadata.version ? packageMetadata.version : "1.0.2";
const ALLOWED_HOSTS = new Set(["noderasoftware.com", "www.noderasoftware.com"]);
const PRELOAD_PATH = path.join(__dirname, "preload.cjs");
const OFFLINE_PATH = path.join(__dirname, "offline.html");
const DESKTOP_SHELL_CSS = fs.readFileSync(path.join(__dirname, "desktop-inject.css"), "utf8");
const DESKTOP_SHELL_JS = fs.readFileSync(path.join(__dirname, "desktop-inject.js"), "utf8");
const DESKTOP_BRAND_LOGO_DATA_URL = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, "brand-logo.png")).toString("base64")}`;
const DESKTOP_BRAND_LOGO_PATH = path.join(__dirname, "brand-logo.png");
const DESKTOP_TRAY_ICON_PATH = path.join(__dirname, "tray-icon.png");
const DESKTOP_PLATFORM = process.platform;
const IS_MAC = DESKTOP_PLATFORM === "darwin";
const USE_SYSTEM_TITLEBAR_OVERLAY = false;
const USE_CUSTOM_CONTROLS_WINDOW = false;
const START_HIDDEN = process.argv.includes("--hidden") || process.argv.includes("--background");
const WORK_ORDER_POLL_INTERVAL_MS = 15000;

let mainWindow = null;
let controlsWindow = null;
let controlsShowTimer = null;
let tray = null;
let isQuitting = false;
let lastDesktopNotificationKey = "";
let lastDesktopNotificationAt = 0;
let desktopAuthToken = "";
let desktopApiBaseUrl = resolveDefaultApiBaseUrl();
let workOrderPollTimer = null;
let workOrderPollInFlight = false;
let workOrderWatcherBootstrapped = false;
let knownWorkOrderIds = new Set();
const CONTROLS_WINDOW_WIDTH = 132;
const CONTROLS_WINDOW_HEIGHT = 40;
const CONTROLS_RIGHT_GAP = 4;
const CONTROLS_TOP_GAP = 0;

const CONTROLS_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body {
      width: 132px;
      height: 40px;
      margin: 0;
      overflow: hidden;
      background: transparent;
      font-family: "Segoe UI", Arial, sans-serif;
      user-select: none;
    }

    .controls {
      width: 132px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 2px;
      background: transparent;
    }

    button {
      width: 42px;
      height: 36px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 0;
      padding: 0;
      background: rgba(0, 0, 0, .004);
      color: #0f172a;
      cursor: default;
    }

    button:hover {
      background: rgba(15, 23, 42, .10);
    }

    button:active {
      background: rgba(15, 23, 42, .16);
    }

    button.close:hover {
      background: #ef4444;
      color: #ffffff;
    }

    button.close:active {
      background: #dc2626;
    }

    .icon {
      display: block;
      position: relative;
      color: currentColor;
    }

    .min {
      width: 12px;
      height: 1.8px;
      border-radius: 999px;
      background: currentColor;
    }

    .max {
      width: 11px;
      height: 11px;
      box-sizing: border-box;
      border: 2px solid currentColor;
      border-radius: 2px;
    }

    .is-maximized .max {
      width: 12px;
      height: 12px;
      border: 0;
    }

    .is-maximized .max::before,
    .is-maximized .max::after {
      content: "";
      position: absolute;
      width: 9px;
      height: 9px;
      box-sizing: border-box;
      border: 2px solid currentColor;
      border-radius: 2px;
    }

    .is-maximized .max::before {
      top: 0;
      right: 0;
      opacity: .65;
    }

    .is-maximized .max::after {
      left: 0;
      bottom: 0;
      background: transparent;
    }

    .is-maximized button:hover .max::after {
      background: transparent;
    }

    .close-icon {
      width: 13px;
      height: 13px;
    }

    .close-icon::before,
    .close-icon::after {
      content: "";
      position: absolute;
      top: 6px;
      left: 1px;
      width: 12px;
      height: 1.8px;
      border-radius: 999px;
      background: currentColor;
    }

    .close-icon::before {
      transform: rotate(45deg);
    }

    .close-icon::after {
      transform: rotate(-45deg);
    }
  </style>
</head>
<body>
  <div class="controls">
    <button type="button" data-action="minimize" aria-label="Kucult"><span class="icon min"></span></button>
    <button type="button" data-action="maximize" aria-label="Buyut"><span class="icon max"></span></button>
    <button type="button" class="close" data-action="close" aria-label="Kapat"><span class="icon close-icon"></span></button>
  </div>
  <script>
    const { ipcRenderer } = require("electron");
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      ipcRenderer.send("hotelops-window-control-child", button.dataset.action);
    });
    ipcRenderer.on("hotelops-window-state", (_event, state) => {
      document.body.classList.toggle("is-maximized", Boolean(state && state.maximized));
    });
  </script>
</body>
</html>`;

function isAllowedUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function resolveDefaultApiBaseUrl() {
  const configured = process.env.HOTELOPS_API_URL;
  if (configured) return normalizeApiBaseUrl(configured);

  try {
    const hotelUrl = new URL(HOTEL_URL);
    return `${hotelUrl.origin}/api`;
  } catch {
    return "https://noderasoftware.com/api";
  }
}

function normalizeApiBaseUrl(value) {
  try {
    const url = new URL(value || "", HOTEL_URL);
    const localHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    if (!["http:", "https:"].includes(url.protocol)) return "https://noderasoftware.com/api";
    if (!localHost && !ALLOWED_HOSTS.has(url.hostname)) return "https://noderasoftware.com/api";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "https://noderasoftware.com/api";
  }
}

function jobCode(job) {
  return typeof job?.id === "string" && job.id.trim()
    ? job.id.trim()
    : typeof job?.code === "string" && job.code.trim()
      ? job.code.trim()
      : "";
}

function jobNotificationBody(job) {
  const code = jobCode(job) || "Yeni is";
  const title = typeof job?.title === "string" && job.title.trim() ? job.title.trim() : "Yeni is kaydi";
  const location = [job?.room, job?.location].filter(Boolean).join(" / ");
  return location ? `${code} - ${title}\n${location}` : `${code} - ${title}`;
}

function showWorkOrderNotification(job) {
  const code = jobCode(job);
  if (!code) return false;

  return showDesktopNotification({
    title: "Yeni Is Bildirimi",
    body: jobNotificationBody(job),
    tag: `work-order-${code}`,
    path: `/hotel/jobs/detail?id=${encodeURIComponent(code)}`
  });
}

function updateTrayMenu() {
  if (!tray || IS_MAC) return;

  tray.setToolTip(desktopAuthToken ? "Nodera Sistem - bildirim servisi aktif" : "Nodera Sistem - oturum bekleniyor");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Nodera Sistem'i Ac", click: focusMainWindow },
      { label: desktopAuthToken ? "Bildirim servisi: Aktif" : "Bildirim servisi: Oturum bekliyor", enabled: false },
      { type: "separator" },
      { label: "Yenile", click: () => mainWindow && !mainWindow.isDestroyed() && mainWindow.reload() },
      {
        label: "Test bildirimi gonder",
        click: () => showDesktopNotification({
          title: "Nodera Sistem",
          body: "Windows bildirim servisi calisiyor.",
          tag: "hotelops-test"
        })
      },
      { type: "separator" },
      {
        label: "Cikis",
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
}

function createMenu(win) {
  return Menu.buildFromTemplate([
    {
      label: "Nodera Sistem",
      submenu: [
        { label: "Yenile", accelerator: "F5", click: () => win.reload() },
        { label: "Geri", accelerator: "Alt+Left", click: () => win.webContents.canGoBack() && win.webContents.goBack() },
        { label: "Ileri", accelerator: "Alt+Right", click: () => win.webContents.canGoForward() && win.webContents.goForward() },
        { type: "separator" },
        { label: "Tam ekran", accelerator: "F11", click: () => win.setFullScreen(!win.isFullScreen()) },
        { type: "separator" },
        { label: "Cikis", accelerator: "Alt+F4", role: "quit" }
      ]
    },
    {
      label: "Gorunum",
      submenu: [
        { label: "Yakinlastir", role: "zoomIn" },
        { label: "Uzaklastir", role: "zoomOut" },
        { label: "Varsayilan yakinlik", role: "resetZoom" },
        { type: "separator" },
        { label: "Gelistirici araclari", accelerator: "Ctrl+Shift+I", click: () => win.webContents.toggleDevTools() }
      ]
    }
  ]);
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (USE_CUSTOM_CONTROLS_WINDOW) scheduleControlsWindow(120);
}

function createTray() {
  if (tray || IS_MAC) return;

  const image = nativeImage.createFromPath(DESKTOP_TRAY_ICON_PATH);
  const trayImage = image.isEmpty() ? undefined : image.resize({ width: 16, height: 16 });

  tray = new Tray(trayImage || DESKTOP_TRAY_ICON_PATH);
  updateTrayMenu();
  tray.on("click", focusMainWindow);
}

function showDesktopNotification(payload = {}) {
  if (!Notification.isSupported()) return false;

  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "Nodera Sistem";
  const body = typeof payload.body === "string" && payload.body.trim() ? payload.body.trim() : "Yeni is bildirimi";
  const tag = typeof payload.tag === "string" ? payload.tag : "";
  const notificationPath = typeof payload.path === "string" ? payload.path : "";
  const key = `${title}|${body}|${tag}`;
  const now = Date.now();

  if (key === lastDesktopNotificationKey && now - lastDesktopNotificationAt < 5000) return false;
  lastDesktopNotificationKey = key;
  lastDesktopNotificationAt = now;

  const notification = new Notification({
    title,
    body,
    icon: DESKTOP_TRAY_ICON_PATH,
    silent: false
  });

  notification.on("click", () => {
    focusMainWindow();

    if (!notificationPath || !mainWindow || mainWindow.isDestroyed()) return;
    try {
      const targetUrl = new URL(notificationPath, HOTEL_URL).toString();
      if (isAllowedUrl(targetUrl)) mainWindow.loadURL(targetUrl);
    } catch {
      // Notification clicks still focus the app even if a stale path is invalid.
    }
  });
  notification.show();
  return true;
}

async function pollWorkOrders() {
  if (!desktopAuthToken || workOrderPollInFlight) return;
  if (typeof fetch !== "function") return;

  workOrderPollInFlight = true;
  try {
    const response = await fetch(`${desktopApiBaseUrl}/work-orders`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${desktopAuthToken}`
      },
      cache: "no-store"
    });

    if (response.status === 401 || response.status === 403) {
      clearDesktopAuthToken();
      return;
    }

    if (!response.ok) return;

    const data = await response.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    const nextIds = new Set(items.map(jobCode).filter(Boolean));

    if (!workOrderWatcherBootstrapped) {
      knownWorkOrderIds = nextIds;
      workOrderWatcherBootstrapped = true;
      updateTrayMenu();
      return;
    }

    const freshItems = items
      .filter((item) => {
        const code = jobCode(item);
        return code && !knownWorkOrderIds.has(code);
      })
      .reverse()
      .slice(0, 3);

    knownWorkOrderIds = nextIds;
    freshItems.forEach(showWorkOrderNotification);
  } catch {
    // Network can be transient. Keep the watcher alive and try again on the next tick.
  } finally {
    workOrderPollInFlight = false;
  }
}

function startWorkOrderWatcher(runImmediately = false) {
  if (!desktopAuthToken) return;

  if (!workOrderPollTimer) {
    workOrderPollTimer = setInterval(pollWorkOrders, WORK_ORDER_POLL_INTERVAL_MS);
    if (typeof workOrderPollTimer.unref === "function") workOrderPollTimer.unref();
  }

  updateTrayMenu();
  if (runImmediately) void pollWorkOrders();
}

function stopWorkOrderWatcher() {
  if (workOrderPollTimer) {
    clearInterval(workOrderPollTimer);
    workOrderPollTimer = null;
  }
  workOrderPollInFlight = false;
  workOrderWatcherBootstrapped = false;
  knownWorkOrderIds = new Set();
  updateTrayMenu();
}

function setDesktopAuthToken(payload = {}) {
  const token = typeof payload === "string" ? payload : payload.token;
  const apiBaseUrl = typeof payload === "object" && payload ? payload.apiBaseUrl : "";

  if (typeof token !== "string" || !token.trim()) {
    clearDesktopAuthToken();
    return false;
  }

  const normalizedToken = token.trim();
  const tokenChanged = normalizedToken !== desktopAuthToken;
  desktopAuthToken = normalizedToken;
  desktopApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl || desktopApiBaseUrl || resolveDefaultApiBaseUrl());

  if (tokenChanged) {
    knownWorkOrderIds = new Set();
    workOrderWatcherBootstrapped = false;
  }

  startWorkOrderWatcher(tokenChanged || !workOrderWatcherBootstrapped);
  return true;
}

function clearDesktopAuthToken() {
  desktopAuthToken = "";
  stopWorkOrderWatcher();
  return true;
}

function applyWindowsBackdrop(win) {
  if (process.platform !== "win32") return;

  try {
    if (typeof win.setBackgroundMaterial === "function") {
      win.setBackgroundMaterial("mica");
    }
  } catch {
    // Older Windows builds simply render the same frameless shell without Mica.
  }
}

function sendWindowState(win) {
  if (!win || win.isDestroyed()) return;

  const state = {
    maximized: win.isMaximized(),
    fullscreen: win.isFullScreen()
  };

  if (!win.webContents.isDestroyed()) {
    win.webContents.send("hotelops-window-state", state);
  }

  if (controlsWindow && !controlsWindow.isDestroyed() && !controlsWindow.webContents.isDestroyed()) {
    controlsWindow.webContents.send("hotelops-window-state", state);
  }
}

function registerWindowStateEvents(win) {
  ["maximize", "unmaximize", "restore", "enter-full-screen", "leave-full-screen"].forEach((eventName) => {
    win.on(eventName, () => sendWindowState(win));
  });
}

async function injectDesktopChrome(win) {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  if (!isAllowedUrl(win.webContents.getURL())) return;

  try {
    const payload = [
      `window.__HOTELOPS_DESKTOP_CSS__ = ${JSON.stringify(DESKTOP_SHELL_CSS)};`,
      `window.__HOTELOPS_DESKTOP_PLATFORM__ = ${JSON.stringify(DESKTOP_PLATFORM)};`,
      `window.__HOTELOPS_DESKTOP_LOGO_SRC__ = ${JSON.stringify(DESKTOP_BRAND_LOGO_DATA_URL)};`,
      `window.__HOTELOPS_NATIVE_WINDOW_CONTROLS__ = ${JSON.stringify(USE_SYSTEM_TITLEBAR_OVERLAY || USE_CUSTOM_CONTROLS_WINDOW)};`,
      `window.__HOTELOPS_SHELL__ = "desktop"; try { localStorage.setItem("hotelops.shell", "desktop"); } catch (_) {}`,
      DESKTOP_SHELL_JS
    ].join("\n");
    await win.webContents.executeJavaScript(payload, true);
    sendWindowState(win);
  } catch (error) {
    console.warn("Desktop shell injection failed:", error);
  }
}

function performWindowControl(win, action) {
  if (!win || win.isDestroyed()) return false;

  switch (action) {
    case "minimize":
      if (win === mainWindow) hideControlsWindow();
      win.minimize();
      break;
    case "maximize":
      if (win === mainWindow) {
        hideControlsWindow();
        win.show();
        win.focus();
      }
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
      if (win === mainWindow) {
        if (USE_CUSTOM_CONTROLS_WINDOW) scheduleControlsWindow(240);
      }
      break;
    case "fullscreen":
      win.setFullScreen(!win.isFullScreen());
      break;
    case "close":
      win.close();
      break;
    default:
      return false;
  }

  sendWindowState(win);
  return true;
}

function handleWindowControl(event, action) {
  return performWindowControl(BrowserWindow.fromWebContents(event.sender), action);
}

function positionControlsWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || !controlsWindow || controlsWindow.isDestroyed()) return;

  const bounds = mainWindow.getBounds();
  controlsWindow.setBounds({
    x: bounds.x + bounds.width - CONTROLS_WINDOW_WIDTH - CONTROLS_RIGHT_GAP,
    y: bounds.y + CONTROLS_TOP_GAP,
    width: CONTROLS_WINDOW_WIDTH,
    height: CONTROLS_WINDOW_HEIGHT
  });
}

function hideControlsWindow() {
  if (controlsShowTimer) {
    clearTimeout(controlsShowTimer);
    controlsShowTimer = null;
  }

  if (!controlsWindow || controlsWindow.isDestroyed()) return;
  controlsWindow.hide();
}

function scheduleControlsWindow(delay = 180) {
  if (!mainWindow || mainWindow.isDestroyed() || !controlsWindow || controlsWindow.isDestroyed()) return;

  if (controlsShowTimer) {
    clearTimeout(controlsShowTimer);
  }

  controlsWindow.hide();
  controlsShowTimer = setTimeout(() => {
    controlsShowTimer = null;
    showControlsWindow();
  }, delay);
}

function showControlsWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || !controlsWindow || controlsWindow.isDestroyed()) return;
  if (!mainWindow.isVisible()) return;
  if (mainWindow.isMinimized()) return;

  if (controlsShowTimer) {
    clearTimeout(controlsShowTimer);
    controlsShowTimer = null;
  }

  positionControlsWindow();
  controlsWindow.showInactive();
  sendWindowState(mainWindow);
}

function createControlsWindow(parent) {
  controlsWindow = new BrowserWindow({
    parent,
    width: 132,
    height: 40,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    closable: true,
    show: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  });

  controlsWindow.setMenuBarVisibility(false);
  controlsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(CONTROLS_HTML)}`);
  controlsWindow.once("ready-to-show", showControlsWindow);
}

function createWindow() {
  nativeTheme.themeSource = "system";

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 420,
    minHeight: 620,
    show: false,
    title: "Nodera Sistem Desktop",
    frame: false,
    ...(IS_MAC
      ? {
          titleBarStyle: "hiddenInset",
          trafficLightPosition: { x: 18, y: 18 }
        }
      : {
          thickFrame: true,
          backgroundMaterial: "mica"
        }),
    resizable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: true,
    closable: true,
    autoHideMenuBar: true,
    backgroundColor: "#f3f6fb",
    hasShadow: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      partition: "persist:hotelops"
    }
  });

  mainWindow.webContents.setUserAgent(`${mainWindow.webContents.getUserAgent()} NoderaHotelOpsDesktop/${DESKTOP_APP_VERSION}`);

  applyWindowsBackdrop(mainWindow);
  registerWindowStateEvents(mainWindow);
  Menu.setApplicationMenu(createMenu(mainWindow));
  createTray();
  if (USE_CUSTOM_CONTROLS_WINDOW) createControlsWindow(mainWindow);

  mainWindow.once("ready-to-show", () => {
    if (!START_HIDDEN) {
      mainWindow.show();
      mainWindow.focus();
      if (USE_CUSTOM_CONTROLS_WINDOW) scheduleControlsWindow(120);
    }
    sendWindowState(mainWindow);
  });

  if (USE_CUSTOM_CONTROLS_WINDOW) {
    ["show", "focus", "resize", "maximize", "unmaximize", "restore"].forEach((eventName) => {
      mainWindow.on(eventName, () => scheduleControlsWindow(220));
    });
  }

  mainWindow.on("move", () => {
    if (!controlsWindow || controlsWindow.isDestroyed() || !controlsWindow.isVisible()) return;
    positionControlsWindow();
  });

  mainWindow.on("minimize", () => {
    hideControlsWindow();
  });

  mainWindow.on("close", (event) => {
    if (isQuitting || IS_MAC) return;

    event.preventDefault();
    hideControlsWindow();
    mainWindow.hide();
  });

  mainWindow.on("closed", () => {
    if (controlsShowTimer) {
      clearTimeout(controlsShowTimer);
      controlsShowTimer = null;
    }
    if (controlsWindow && !controlsWindow.isDestroyed()) controlsWindow.close();
    controlsWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) {
      mainWindow.loadURL(url);
    } else {
      shell.openExternal(url);
    }

    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("file://")) return;
    if (isAllowedUrl(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;

    if (input.key === "F11") {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      sendWindowState(mainWindow);
      return;
    }

    if (input.alt && input.key === "F4") {
      event.preventDefault();
      mainWindow.close();
      return;
    }

    if (input.control && input.alt && input.key.toLowerCase() === "m") {
      event.preventDefault();
      mainWindow.minimize();
    }
  });

  mainWindow.webContents.on("dom-ready", () => injectDesktopChrome(mainWindow));
  mainWindow.webContents.on("did-navigate", () => injectDesktopChrome(mainWindow));
  mainWindow.webContents.on("did-navigate-in-page", () => injectDesktopChrome(mainWindow));

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    if (!isMainFrame || validatedUrl.startsWith("file://")) return;

    mainWindow.loadFile(OFFLINE_PATH, {
      query: {
        url: HOTEL_URL,
        code: String(errorCode),
        reason: errorDescription || "Baglanti kurulamadi"
      }
    });
  });

  mainWindow.loadURL(HOTEL_URL);
}

function configureBackgroundStartup() {
  if (process.platform !== "win32" || !app.isPackaged) return;

  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      args: ["--hidden"]
    });
  } catch {
    // Login-item support can vary on unpacked/dev builds; tray mode still works after manual launch.
  }
}

if (process.platform === "win32") {
  app.setAppUserModelId("com.noderasoftware.hotelops");
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", focusMainWindow);
}

ipcMain.handle("hotelops-window-control", handleWindowControl);
ipcMain.handle("hotelops-desktop-notify", (_event, payload) => showDesktopNotification(payload));
ipcMain.handle("hotelops-desktop-set-auth-token", (_event, payload) => setDesktopAuthToken(payload));
ipcMain.handle("hotelops-desktop-clear-auth-token", () => clearDesktopAuthToken());
ipcMain.on("hotelops-window-control-child", (_event, action) => {
  performWindowControl(mainWindow, action);
});

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    configureBackgroundStartup();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else focusMainWindow();
    });
  });
}

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) app.quit();
});
