(() => {
  const rootClass = "hotelops-desktop-shell";
  const styleId = "hotelops-desktop-shell-style";
  const controlsId = "hotelops-desktop-window-controls";
  const hiddenHrefAttribute = "data-hotelops-desktop-href";
  const hiddenTitleAttribute = "data-hotelops-desktop-title";
  const platformClass = `hotelops-platform-${String(window.__HOTELOPS_DESKTOP_PLATFORM__ || "unknown")
    .replace(/[^a-z0-9_-]/gi, "-")
    .toLowerCase()}`;
  let lastWindowActionAt = 0;

  function findWindowActionTarget(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return null;

    const button = target.closest("[data-window-action]");
    if (!button) return null;

    const controls = document.getElementById(controlsId);
    if (!controls || !controls.contains(button)) return null;

    return button;
  }

  function runWindowAction(action) {
    if (typeof action !== "string" || !action) return;
    lastWindowActionAt = Date.now();
    window.hotelOpsDesktopShell?.control?.(action)?.catch?.(() => {});
  }

  function bindWindowControls() {
    if (window.__hotelOpsDesktopShellControlsBound) return;
    window.__hotelOpsDesktopShellControlsBound = true;

    document.addEventListener(
      "pointerdown",
      (event) => {
        const button = findWindowActionTarget(event);
        if (!button) return;

        event.stopPropagation();
      },
      true
    );

    document.addEventListener(
      "pointerup",
      (event) => {
        const button = findWindowActionTarget(event);
        if (!button) return;

        event.preventDefault();
        event.stopPropagation();
        runWindowAction(button.dataset.windowAction);
      },
      true
    );

    document.addEventListener(
      "click",
      (event) => {
        const button = findWindowActionTarget(event);
        if (!button) return;

        event.preventDefault();
        event.stopPropagation();
        if (Date.now() - lastWindowActionAt < 350) return;
        runWindowAction(button.dataset.windowAction);
      },
      true
    );

    document.addEventListener(
      "dblclick",
      (event) => {
        const button = findWindowActionTarget(event);
        if (!button) return;

        event.preventDefault();
        event.stopPropagation();
      },
      true
    );
  }

  function installStyle() {
    if (document.getElementById(styleId)) return;
    if (typeof window.__HOTELOPS_DESKTOP_CSS__ !== "string") return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = window.__HOTELOPS_DESKTOP_CSS__;
    document.head.appendChild(style);
  }

  function installControls() {
    if (window.__HOTELOPS_NATIVE_WINDOW_CONTROLS__) {
      document.getElementById(controlsId)?.remove();
      return;
    }

    if (window.__HOTELOPS_DESKTOP_PLATFORM__ === "darwin") {
      document.getElementById(controlsId)?.remove();
      return;
    }

    if (!document.body) return;
    if (document.getElementById(controlsId)) return;

    const controls = document.createElement("div");
    controls.id = controlsId;
    controls.setAttribute("aria-label", "Pencere kontrolleri");
    controls.innerHTML = `
      <button type="button" class="window-control-btn" data-window-action="minimize" aria-label="Kucult">
        <span class="window-control-icon window-control-min"></span>
      </button>
      <button type="button" class="window-control-btn" data-window-action="maximize" aria-label="Buyut">
        <span class="window-control-icon window-control-max"></span>
      </button>
      <button type="button" class="window-control-btn window-control-close" data-window-action="close" aria-label="Kapat">
        <span class="window-control-icon window-control-x"></span>
      </button>
    `;
    document.body.appendChild(controls);
  }

  function installBrandLogo() {
    const src = window.__HOTELOPS_DESKTOP_LOGO_SRC__;
    if (typeof src !== "string" || !src.trim()) return;

    document.querySelectorAll(".brand-icon, .login-logo .logo-mark").forEach((target) => {
      const existing = target.querySelector(".brand-logo-img");
      if (existing && existing.getAttribute("src") === src) return;

      target.textContent = "";
      const img = document.createElement("img");
      img.className = "brand-logo-img";
      img.src = src;
      img.alt = "Nodera Software";
      img.draggable = false;
      target.appendChild(img);
    });
  }

  function suppressImageDrag(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") return;

    root.querySelectorAll("img").forEach((img) => {
      img.draggable = false;
      img.setAttribute("draggable", "false");
    });
  }

  function hideLinkChrome(anchor) {
    if (!anchor || anchor.nodeType !== Node.ELEMENT_NODE || anchor.tagName !== "A") return;

    const href = anchor.getAttribute("href");
    if (href && !anchor.hasAttribute(hiddenHrefAttribute)) {
      anchor.setAttribute(hiddenHrefAttribute, href);
    }

    const title = anchor.getAttribute("title");
    if (title && !anchor.hasAttribute(hiddenTitleAttribute)) {
      anchor.setAttribute(hiddenTitleAttribute, title);
    }

    anchor.removeAttribute("href");
    anchor.removeAttribute("title");
    anchor.setAttribute("draggable", "false");
  }

  function hideAllLinkChrome(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") return;
    root.querySelectorAll("a").forEach(hideLinkChrome);
  }

  function findHiddenLinkTarget(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return null;
    return target.closest(`a[${hiddenHrefAttribute}]`);
  }

  function bindLinkChromeSuppression() {
    if (window.__hotelOpsDesktopShellLinkChromeBound) return;
    window.__hotelOpsDesktopShellLinkChromeBound = true;

    document.addEventListener(
      "pointerover",
      (event) => {
        const anchor = event.target?.closest?.("a");
        if (anchor) hideLinkChrome(anchor);
      },
      true
    );

    document.addEventListener(
      "mouseover",
      (event) => {
        const anchor = event.target?.closest?.("a");
        if (anchor) hideLinkChrome(anchor);
      },
      true
    );

    document.addEventListener(
      "dragstart",
      (event) => {
        const target = event.target;
        const isImageDrag = target && target.nodeType === Node.ELEMENT_NODE && target.closest?.("img, .brand-logo-img, .brand-icon, .login-logo .logo-mark");
        if (!isImageDrag && !findHiddenLinkTarget(event)) return;

        event.preventDefault();
        event.stopPropagation();
      },
      true
    );

    document.addEventListener(
      "click",
      (event) => {
        const anchor = findHiddenLinkTarget(event);
        if (!anchor) return;
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const href = anchor.getAttribute(hiddenHrefAttribute);
        if (!href) return;

        const before = window.location.href;
        window.setTimeout(() => {
          if (window.location.href !== before) return;
          if (event.defaultPrevented) return;
          window.location.assign(href);
        }, 0);
      },
      true
    );
  }

  function notifyDesktop(payload) {
    window.hotelOpsDesktopShell?.notify?.(payload)?.catch?.(() => {});
  }

  function readApiToken() {
    try {
      return localStorage.getItem("hotelops.api.token") || sessionStorage.getItem("hotelops.api.session-token") || "";
    } catch {
      return "";
    }
  }

  function readApiBaseUrl() {
    try {
      if (window.location.port === "3000") return `${window.location.protocol}//${window.location.hostname}:4000`;
      return `${window.location.origin}/api`;
    } catch {
      return "";
    }
  }

  function syncDesktopAuthToken() {
    const token = readApiToken();
    if (token) {
      window.hotelOpsDesktopShell?.setAuthToken?.({
        token,
        apiBaseUrl: readApiBaseUrl()
      })?.catch?.(() => {});
      return;
    }

    window.hotelOpsDesktopShell?.clearAuthToken?.()?.catch?.(() => {});
  }

  function bindDesktopAuthTokenSync() {
    if (window.__hotelOpsDesktopShellAuthSyncBound) return;
    window.__hotelOpsDesktopShellAuthSyncBound = true;

    syncDesktopAuthToken();
    window.addEventListener("focus", syncDesktopAuthToken);
    window.addEventListener("storage", syncDesktopAuthToken);
    window.addEventListener("hotelops:auth-token-changed", syncDesktopAuthToken);
    window.setInterval(syncDesktopAuthToken, 5000);
  }

  function readUrgentBadgeCount() {
    const badge = document.querySelector(".notif-badge");
    const text = badge?.textContent?.replace(/[^\d]/g, "") || "";
    return Number.parseInt(text, 10) || 0;
  }

  function bindDesktopNotifications() {
    if (window.__hotelOpsDesktopShellNotificationsBound) return;
    window.__hotelOpsDesktopShellNotificationsBound = true;

    let lastBadgeCount = readUrgentBadgeCount();

    window.addEventListener("hotelops:new-work-order", (event) => {
      const detail = event.detail || {};
      const title = typeof detail.title === "string" && detail.title.trim() ? detail.title.trim() : "Yeni is kaydi";
      const id = typeof detail.id === "string" ? detail.id : String(Date.now());
      notifyDesktop({
        title: "Yeni Is Bildirimi",
        body: `${id} - ${title}`,
        tag: `work-order-${id}`,
        path: `/hotel/jobs/detail?id=${encodeURIComponent(id)}`
      });
    });

    const observerRoot = document.body || document.documentElement;
    const observer = new MutationObserver(() => {
      const nextBadgeCount = readUrgentBadgeCount();
      if (nextBadgeCount > lastBadgeCount) {
        notifyDesktop({
          title: "Nodera Sistem",
          body: `${nextBadgeCount} acil is bildirimi var`,
          tag: `urgent-${nextBadgeCount}`
        });
      }
      lastBadgeCount = nextBadgeCount;
    });

    observer.observe(observerRoot, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function applyState(state) {
    document.documentElement.dataset.hotelopsMaximized = state && state.maximized ? "true" : "false";
    document.documentElement.dataset.hotelopsFullscreen = state && state.fullscreen ? "true" : "false";
  }

  function install() {
    document.documentElement.classList.add(rootClass, platformClass);
    installStyle();
    installControls();
    bindWindowControls();
    installBrandLogo();
    suppressImageDrag();
    hideAllLinkChrome();
    bindLinkChromeSuppression();
    bindDesktopAuthTokenSync();
    bindDesktopNotifications();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }

  if (!window.__hotelOpsDesktopShellStateBound) {
    window.__hotelOpsDesktopShellStateBound = true;
    window.hotelOpsDesktopShell?.onState?.(applyState);
  }

  if (!window.__hotelOpsDesktopShellObserver) {
    window.__hotelOpsDesktopShellObserver = new MutationObserver(() => {
      for (const className of [rootClass, platformClass]) {
        if (!document.documentElement.classList.contains(className)) {
          document.documentElement.classList.add(className);
        }
      }

      installStyle();
      installControls();
      installBrandLogo();
      suppressImageDrag();
      hideAllLinkChrome();
    });

    window.__hotelOpsDesktopShellObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
})();
