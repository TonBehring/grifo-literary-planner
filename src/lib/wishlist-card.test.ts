import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
import { computeLayout, extraLabel, loadCover, subtitleFor, wrapText } from "./wishlist-card";

const mono = { measureText: (t: string) => ({ width: t.length * 10 }) };

describe("wishlist card layout", () => {
  it("1 to 3 books use one centered row with larger covers", () => {
    for (const n of [1, 2, 3]) {
      const l = computeLayout(n);
      expect(l.slots).toHaveLength(n);
      expect(new Set(l.slots.map((s) => s.y)).size).toBe(1);
      const left = l.slots[0]!.x;
      const right = 1080 - (l.slots[n - 1]!.x + l.slots[n - 1]!.w);
      expect(Math.abs(left - right)).toBeLessThan(1);
      expect(l.slots[0]!.w).toBeGreaterThan(computeLayout(6).slots[0]!.w);
    }
  });
  it("6 books form a 3x2 grid with 2:3 covers", () => {
    const l = computeLayout(6);
    expect(new Set(l.slots.map((s) => s.x)).size).toBe(3);
    expect(new Set(l.slots.map((s) => s.y)).size).toBe(2);
    expect(l.slots[0]!.h / l.slots[0]!.w).toBe(1.5);
    expect(l.extra).toBe(0);
  });
  it("more than 6 shows the first 6 and 'e mais N livros'", () => {
    const l = computeLayout(10);
    expect(l.slots).toHaveLength(6);
    expect(l.extra).toBe(4);
    expect(extraLabel(4)).toBe("e mais 4 livros");
  });
  it("subtitle uses first name or falls back", () => {
    expect(subtitleFor("Ton Behring")).toBe("A lista de desejos de Ton");
    expect(subtitleFor("")).toBe("Minha lista de desejos");
  });
});

describe("wrapText", () => {
  it("limits to max lines with ellipsis", () => {
    const lines = wrapText(mono, "um dois tres quatro cinco seis sete", 100, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith("…")).toBe(true);
  });
  it("truncates a single long line", () => {
    const [l] = wrapText(mono, "Autorcomnomemuitolongomesmo", 100, 1);
    expect(l!.endsWith("…")).toBe(true);
    expect(mono.measureText(l!).width).toBeLessThanOrEqual(100);
  });
  it("keeps short text intact", () => {
    expect(wrapText(mono, "Duna", 100, 2)).toEqual(["Duna"]);
  });
});

describe("loadCover", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("returns null (placeholder) when the proxy fails", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "k");
    const f = vi.fn(async () => new Response(JSON.stringify({ error: "x" }), { status: 502 }));
    vi.stubGlobal("fetch", f);
    expect(await loadCover("https://books.google.com/a.jpg", "tok")).toBeNull();
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("cover-proxy?url=https%3A%2F%2Fbooks.google.com");
  });
  it("returns null on network error and without url", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("net"); }));
    expect(await loadCover("https://a/b.jpg", null)).toBeNull();
    expect(await loadCover(null, null)).toBeNull();
  });
});
