const { contextBridge, ipcRenderer } = require("electron");
const packageMetadata = require("../package.json");

const validActions = new Set(["minimize", "maximize", "fullscreen", "close"]);
const appVersion = typeof packageMetadata.version === "string" && packageMetadata.version ? packageMetadata.version : "1.0.0";
const appVersionCode = 1;

contextBridge.exposeInMainWorld("hotelOpsDesktopShell", {
  version() {
    return appVersion;
  },
  versionCode() {
    return appVersionCode;
  },
  control(action) {
    if (!validActions.has(action)) return Promise.resolve(false);
    return ipcRenderer.invoke("hotelops-window-control", action);
  },
  onState(callback) {
    if (typeof callback !== "function") return () => {};

    const handler = (_event, state) => {
      callback({
        maximized: Boolean(state && state.maximized),
        fullscreen: Boolean(state && state.fullscreen)
      });
    };

    ipcRenderer.on("hotelops-window-state", handler);
    return () => ipcRenderer.removeListener("hotelops-window-state", handler);
  },
  notify(payload) {
    return ipcRenderer.invoke("hotelops-desktop-notify", {
      title: typeof payload?.title === "string" ? payload.title : "Nodera Sistem",
      body: typeof payload?.body === "string" ? payload.body : "Yeni is bildirimi",
      tag: typeof payload?.tag === "string" ? payload.tag : "",
      path: typeof payload?.path === "string" ? payload.path : ""
    });
  },
  openDownloadUrl(url) {
    return ipcRenderer.invoke("hotelops-desktop-open-download-url", typeof url === "string" ? url : "");
  },
  setAuthToken(payload) {
    return ipcRenderer.invoke("hotelops-desktop-set-auth-token", {
      token: typeof payload?.token === "string" ? payload.token : "",
      apiBaseUrl: typeof payload?.apiBaseUrl === "string" ? payload.apiBaseUrl : ""
    });
  },
  clearAuthToken() {
    return ipcRenderer.invoke("hotelops-desktop-clear-auth-token");
  }
});
