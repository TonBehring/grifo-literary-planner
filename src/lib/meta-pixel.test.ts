import { beforeEach, expect, it, vi } from "vitest";

const { canTrackAds } = vi.hoisted(() => ({ canTrackAds: vi.fn() }));
vi.mock("./consent", () => ({ canTrackAds }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  canTrackAds.mockResolvedValue(true);
  localStorage.clear();
  document.head.innerHTML = "";
  delete window.fbq;
  delete window._fbq;
});

it("loads one Pixel and sends PageView on every route change without personal data", async () => {
  const meta = await import("./meta-pixel");
  await meta.trackMetaPageView();
  await meta.trackMetaPageView();
  const calls = (window.fbq as unknown as { queue: unknown[][] }).queue;
  expect(calls.filter((call) => call[0] === "init")).toHaveLength(1);
  expect(calls.find((call) => call[0] === "init")).toEqual([
    "init", "1439881227703450", {}, { agent: "lovable" },
  ]);
  expect(calls.filter((call) => call[1] === "PageView")).toHaveLength(2);
  expect(document.querySelectorAll("script[data-meta-pixel]")).toHaveLength(1);
});

it("does not initialize or send while advertising consent is absent", async () => {
  canTrackAds.mockResolvedValue(false);
  const meta = await import("./meta-pixel");
  expect(await meta.reportMetaCompleteRegistration()).toBe(false);
  expect(window.fbq).toBeUndefined();
  expect(document.querySelector("script[data-meta-pixel]")).toBeNull();
});

it("uses the charged value and reports only once per subscription", async () => {
  const meta = await import("./meta-pixel");
  const subscription = { id: "sub-1", current_period_end: "2027-11-14", charged_value: 54.9 };
  expect(await meta.reportMetaPurchase(subscription)).toBe(true);
  expect(await meta.reportMetaPurchase(subscription)).toBe(false);
  const calls = (window.fbq as unknown as { queue: unknown[][] }).queue;
  const purchases = calls.filter((call) => call[1] === "Purchase");
  expect(purchases).toHaveLength(1);
  expect(purchases[0]?.[2]).toEqual({ value: 54.9, currency: "BRL" });
});

it("falls back to 43.92 only when charged value is absent", async () => {
  const meta = await import("./meta-pixel");
  expect(meta.metaPurchaseValue(null)).toBe(43.92);
  expect(meta.metaPurchaseValue(undefined)).toBe(43.92);
  expect(meta.metaPurchaseValue("")).toBe(43.92);
  expect(meta.metaPurchaseValue(0)).toBe(0);
  expect(meta.metaPurchaseValue("43.92")).toBe(43.92);
});
