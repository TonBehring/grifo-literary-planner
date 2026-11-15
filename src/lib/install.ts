import { useEffect, useSyncExternalStore } from "react";

export type InstallPlatform = "android" | "ios" | "desktop" | "inapp";
type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
export const INSTALL_DISMISS_KEY = "grifo_install_banner_until";
export const INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export function detectInstallPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/Instagram|FBAN|FBAV|WhatsApp|\bLine\b|TikTok|BytedanceWebview/i.test(userAgent)) return "inapp";
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh|MacIntel/i.test(userAgent) && maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function installDismissed(storage: Pick<Storage, "getItem">, now = Date.now()): boolean {
  try { return Number(storage.getItem(INSTALL_DISMISS_KEY)) > now; } catch { return false; }
}

export function dismissInstall(storage: Pick<Storage, "setItem">, now = Date.now()): void {
  try { storage.setItem(INSTALL_DISMISS_KEY, String(now + INSTALL_DISMISS_MS)); } catch { /* Still hide the banner. */ }
}

const initial = { ready: false, platform: "desktop" as InstallPlatform, standalone: false, canPrompt: false, iosOtherBrowser: false };
let snapshot = initial;
let deferredPrompt: InstallEvent | null = null;
let installed = false;
let listening = false;
const listeners = new Set<() => void>();

function refresh() {
  const next = {
    ready: true,
    platform: detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints),
    standalone: installed || isStandalone(),
    canPrompt: deferredPrompt !== null && !installed,
    iosOtherBrowser: /CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent),
  };
  if (Object.keys(next).some((key) => next[key as keyof typeof next] !== snapshot[key as keyof typeof snapshot])) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }
}

// Called at module evaluation by the root, before React mounts or redirects.
// Only listeners are registered here; browser-dependent render state is read after mounting.
export function initializeInstallCapture() {
  if (typeof window === "undefined" || listening) return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallEvent;
    refresh();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    refresh();
  });
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferredPrompt;
  if (!event) return "unavailable";
  deferredPrompt = null;
  refresh();
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") installed = true;
  refresh();
  return outcome;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useInstallPrompt() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => initial);
  useEffect(() => {
    initializeInstallCapture();
    refresh();
    const media = window.matchMedia?.("(display-mode: standalone)");
    media?.addEventListener?.("change", refresh);
    return () => media?.removeEventListener?.("change", refresh);
  }, []);
  return { ...state, promptInstall };
}