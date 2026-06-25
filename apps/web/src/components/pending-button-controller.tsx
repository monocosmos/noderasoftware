"use client";

import { useEffect } from "react";

const CLICK_FETCH_WINDOW_MS = 3500;

type PendingControl = HTMLButtonElement | HTMLInputElement;

function findPendingControl(target: EventTarget | null): PendingControl | null {
  if (!(target instanceof Element)) return null;
  const control = target.closest("button, input[type='submit'], input[type='button']");
  if (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) {
    return control;
  }
  return null;
}

function setControlBusy(control: PendingControl, busy: boolean) {
  if (busy) {
    control.dataset.autoPending = "true";
    control.setAttribute("aria-busy", "true");
    control.disabled = true;
    return;
  }

  delete control.dataset.autoPending;
  control.removeAttribute("aria-busy");
  control.disabled = false;
}

export function PendingButtonController() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const originalFetch = window.fetch.bind(window);
    const pendingCounts = new WeakMap<PendingControl, number>();
    let latestControl: PendingControl | null = null;
    let latestControlAt = 0;

    function rememberControl(control: PendingControl | null) {
      if (!control || control.disabled || control.getAttribute("aria-disabled") === "true") return;
      latestControl = control;
      latestControlAt = Date.now();
    }

    function beginPending(control: PendingControl) {
      pendingCounts.set(control, (pendingCounts.get(control) ?? 0) + 1);
      setControlBusy(control, true);
    }

    function endPending(control: PendingControl) {
      const nextCount = Math.max(0, (pendingCounts.get(control) ?? 1) - 1);
      if (nextCount > 0) {
        pendingCounts.set(control, nextCount);
        return;
      }

      pendingCounts.delete(control);
      if (control.dataset.autoPending === "true") {
        setControlBusy(control, false);
      }
    }

    function onClick(event: MouseEvent) {
      rememberControl(findPendingControl(event.target));
    }

    function onSubmit(event: SubmitEvent) {
      const submitter = event.submitter instanceof HTMLElement ? findPendingControl(event.submitter) : null;
      const activeControl = findPendingControl(document.activeElement);
      rememberControl(submitter ?? activeControl);
    }

    window.fetch = ((...args: Parameters<typeof fetch>) => {
      const control =
        latestControl && Date.now() - latestControlAt <= CLICK_FETCH_WINDOW_MS
          ? latestControl
          : null;

      if (control) beginPending(control);

      return originalFetch(...args).finally(() => {
        if (control) endPending(control);
      });
    }) as typeof fetch;

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);

    return () => {
      window.fetch = originalFetch;
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return null;
}
