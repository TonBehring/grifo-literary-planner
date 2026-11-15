import { afterEach, describe, expect, it, vi } from "vitest";
import { detectInstallPlatform, dismissInstall, INSTALL_DISMISS_KEY, installDismissed, isStandalone, initializeInstallCapture, promptInstall } from "./install";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

describe("install platform", () => {
  it("detects Android", () => expect(detectInstallPlatform("Mozilla/5.0 (Linux; Android 14) Chrome/130")).toBe("android"));
  it("detects iPhone and iPad", () => {
    expect(detectInstallPlatform("Mozilla/5.0 (iPhone) Safari/604")).toBe("ios");
    expect(detectInstallPlatform("Mozilla/5.0 (iPad) Safari/604")).toBe("ios");
  });
  it("detects an iPad identifying as Mac with touch", () => expect(detectInstallPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605", 5)).toBe("ios"));
  it("does not classify a non-touch Mac as iPad", () => expect(detectInstallPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605", 0)).toBe("desktop"));
  it.each(["Instagram", "FBAN", "FBAV", "WhatsApp", "Line/13", "TikTok", "BytedanceWebview"])("prioritizes %s internal browser", (browser) => {
    expect(detectInstallPlatform(`Mozilla (iPhone) ${browser}`)).toBe("inapp");
  });
  it("detects desktop", () => expect(detectInstallPlatform("Mozilla/5.0 (Windows NT 10.0) Chrome/130")).toBe("desktop"));
});

describe("standalone", () => {
  it("detects display mode", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    expect(isStandalone()).toBe(true);
  });
  it("detects Safari standalone", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    vi.spyOn(window, "navigator", "get").mockReturnValue({ standalone: true } as unknown as Navigator);
    expect(isStandalone()).toBe(true);
  });
  it("does not classify browser mode as installed", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    expect(isStandalone()).toBe(false);
  });
});

describe("seven-day dismissal", () => {
  it("stores exactly seven days and expires at that boundary", () => {
    const now = Date.parse("2026-11-15T04:10:00Z");
    dismissInstall(localStorage, now);
    expect(localStorage.getItem(INSTALL_DISMISS_KEY)).toBe(String(Date.parse("2026-11-22T04:10:00Z")));
    expect(installDismissed(localStorage, now + 7 * 24 * 60 * 60 * 1000 - 1)).toBe(true);
    expect(installDismissed(localStorage, now + 7 * 24 * 60 * 60 * 1000)).toBe(false);
  });
  it("handles unavailable storage", () => {
    expect(installDismissed({ getItem: () => { throw new Error("blocked"); } })).toBe(false);
    expect(() => dismissInstall({ setItem: () => { throw new Error("blocked"); } })).not.toThrow();
  });
});

it("captures the prompt before mounting and consumes it only once", async () => {
  initializeInstallCapture();
  const event = new Event("beforeinstallprompt", { cancelable: true });
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(await promptInstall()).toBe("accepted");
  expect(prompt).toHaveBeenCalledOnce();
  expect(await promptInstall()).toBe("unavailable");
});