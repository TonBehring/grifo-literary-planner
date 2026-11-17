import { supabase } from "@/integrations/supabase/client";
import type { UserBook } from "@/lib/types";

export const CARD_W = 1080;
export const CARD_H = 1920;
export const CARD_TITLE = "Lista de desejos";
const TITLE_BASELINE = 340;
const SUBTITLE_BASELINE = 410;
const RIBBON_WITH_SUBTITLE = 470;
const RIBBON_WITHOUT_SUBTITLE = 400;
const CREAM = "#F9F4EA";
const DARK = "#052C2D";
const GREEN = "#144142";
const GOLD = "#DAAE5A";
const GOLD_DARK = "#A9802F";
const MUTED = "#5E7C7A";
const SANS = "Inter, ui-sans-serif, system-ui, sans-serif";
const SERIF = '"Playfair Display", Georgia, serif';
const COVER_TIMEOUT_MS = 8000;

export type WishlistCardBook = { title: string; author: string | null; coverUrl: string | null };
export type CoverSlot = { x: number; y: number; w: number; h: number };
export type WishlistLayout = { slots: CoverSlot[]; extra: number; bottom: number };

export function toCardBooks(list: UserBook[]): WishlistCardBook[] {
  return list.map((ub) => ({
    title: ub.book?.title || "Sem título",
    author: ub.book?.author ?? null,
    coverUrl: ub.book?.cover_url ?? null,
  }));
}

export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/** Small line under the title. Empty when there is no name, so the card shows no hole. */
export function subtitleFor(nome: string | null | undefined): string {
  const f = firstName(nome);
  return f ? `de ${f}` : "";
}

export type WishlistHeader = { title: string; subtitle: string; ribbonY: number };

/** Card header: fixed title, optional "de {first name}" line, and the gold ribbon position. */
export function headerFor(nome: string | null | undefined): WishlistHeader {
  const subtitle = subtitleFor(nome);
  return {
    title: CARD_TITLE,
    subtitle,
    ribbonY: subtitle ? RIBBON_WITH_SUBTITLE : RIBBON_WITHOUT_SUBTITLE,
  };
}

export function extraLabel(n: number): string {
  return n === 1 ? "e mais 1 livro" : `e mais ${n} livros`;
}

/** Pure layout: 1 to 3 books in one centered row with larger covers; otherwise 3x2 grid (max 6). */
export function computeLayout(count: number, top = 540): WishlistLayout {
  const shown = Math.min(count, 6);
  const extra = Math.max(0, count - 6);
  const slots: CoverSlot[] = [];
  const textH = 140;
  if (shown <= 3) {
    const w = 280;
    const gap = 50;
    const h = w * 1.5;
    const total = shown * w + (shown - 1) * gap;
    const x0 = (CARD_W - total) / 2;
    const y = top + 120;
    for (let i = 0; i < shown; i++) slots.push({ x: x0 + i * (w + gap), y, w, h });
    return { slots, extra, bottom: y + h + textH };
  }
  const w = 240;
  const gap = 60;
  const h = w * 1.5;
  const x0 = (CARD_W - (3 * w + 2 * gap)) / 2;
  for (let i = 0; i < shown; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    slots.push({ x: x0 + col * (w + gap), y: top + row * (h + textH + 10), w, h });
  }
  return { slots, extra, bottom: top + 2 * (h + textH + 10) - 20 };
}

type Measurer = { measureText(t: string): { width: number } };

/** Wrap text into at most maxLines lines; truncates the last line with an ellipsis. */
export function wrapText(ctx: Measurer, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  let i = 0;
  for (; i < words.length; i++) {
    const w = words[i]!;
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !cur) {
      cur = test;
    } else {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    }
  }
  const overflow = lines.length === maxLines;
  if (!overflow && cur) lines.push(cur);
  const truncated = overflow || lines.some((l) => ctx.measureText(l).width > maxWidth);
  if (truncated && lines.length) {
    const idx = lines.length - 1;
    let last = lines[idx]!;
    const ell = "…";
    if (overflow || ctx.measureText(last).width > maxWidth) {
      while (last.length > 1 && ctx.measureText(last + ell).width > maxWidth) last = last.slice(0, -1);
      lines[idx] = last.trimEnd() + ell;
    }
    for (let j = 0; j < idx; j++) {
      let l = lines[j]!;
      if (ctx.measureText(l).width > maxWidth) {
        while (l.length > 1 && ctx.measureText(l + ell).width > maxWidth) l = l.slice(0, -1);
        lines[j] = l + ell;
      }
    }
  }
  return lines;
}

function withTimeout(ms: number) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

async function blobToImage(blob: Blob): Promise<CanvasImageSource> {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Load a cover through the CORS proxy. Returns null on any failure. */
export async function loadCover(url: string | null, token: string | null): Promise<CanvasImageSource | null> {
  if (!url) return null;
  const base = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const key = (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    import.meta.env["VITE_SUPABASE_ANON_KEY"]) as string | undefined;
  if (!base || !key) return null;
  const { signal, done } = withTimeout(COVER_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/functions/v1/cover-proxy?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${token ?? key}`, apikey: key },
      signal,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size || (blob.type && !blob.type.startsWith("image/"))) return null;
    return await blobToImage(blob);
  } catch {
    return null;
  } finally {
    done();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function sizeOf(img: CanvasImageSource): { w: number; h: number } {
  const anyImg = img as { naturalWidth?: number; width?: number; naturalHeight?: number; height?: number };
  return { w: anyImg.naturalWidth || Number(anyImg.width) || 1, h: anyImg.naturalHeight || Number(anyImg.height) || 1 };
}

function drawCover(ctx: CanvasRenderingContext2D, s: CoverSlot, book: WishlistCardBook, img: CanvasImageSource | null) {
  const r = 14;
  ctx.save();
  ctx.shadowColor = "rgba(5,44,45,0.28)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  roundRect(ctx, s.x, s.y, s.w, s.h, r);
  ctx.fillStyle = GREEN;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, s.x, s.y, s.w, s.h, r);
  ctx.clip();
  if (img) {
    const { w, h } = sizeOf(img);
    const scale = Math.max(s.w / w, s.h / h);
    const dw = w * scale;
    const dh = h * scale;
    ctx.drawImage(img, s.x + (s.w - dw) / 2, s.y + (s.h - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = GREEN;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = GOLD;
    ctx.fillRect(s.x + s.w / 2 - 30, s.y + 40, 60, 4);
    ctx.fillRect(s.x + s.w / 2 - 30, s.y + s.h - 44, 60, 4);
    ctx.fillStyle = CREAM;
    ctx.font = `600 30px ${SERIF}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = wrapText(ctx, book.title, s.w - 40, 4);
    const lh = 38;
    const y0 = s.y + s.h / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, s.x + s.w / 2, y0 + i * lh));
  }
  ctx.restore();

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = DARK;
  ctx.font = `600 28px ${SANS}`;
  const tl = wrapText(ctx, book.title, s.w, 2);
  tl.forEach((l, i) => ctx.fillText(l, s.x + s.w / 2, s.y + s.h + 22 + i * 34));
  ctx.fillStyle = MUTED;
  ctx.font = `400 24px ${SANS}`;
  const al = wrapText(ctx, book.author || "Autor desconhecido", s.w, 1);
  if (al[0]) ctx.fillText(al[0], s.x + s.w / 2, s.y + s.h + 22 + tl.length * 34 + 8);
}

async function loadLogo(): Promise<CanvasImageSource | null> {
  try {
    const res = await fetch("/brand/logo-grifo.png");
    if (!res.ok) return null;
    return await blobToImage(await res.blob());
  } catch {
    return null;
  }
}

export async function generateWishlistCard({
  nome,
  livros,
}: {
  nome?: string | null;
  livros: WishlistCardBook[];
}): Promise<Blob> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await Promise.all([
      document.fonts.load(`600 80px ${SERIF}`).catch(() => null),
      document.fonts.load(`600 28px ${SANS}`).catch(() => null),
    ]);
    await document.fonts.ready;
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  const shown = livros.slice(0, 6);
  const [logo, ...covers] = await Promise.all([loadLogo(), ...shown.map((b) => loadCover(b.coverUrl, token))]);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  if (logo) {
    const { w, h } = sizeOf(logo);
    const lw = 260;
    const lh = (h / w) * lw;
    ctx.drawImage(logo, (CARD_W - lw) / 2, 110, lw, lh);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = DARK;
  ctx.font = `700 104px ${SERIF}`;
  const header = headerFor(nome);
  ctx.fillText(header.title, CARD_W / 2, TITLE_BASELINE);
  if (header.subtitle) {
    ctx.fillStyle = GREEN;
    ctx.font = `400 38px ${SANS}`;
    ctx.fillText(header.subtitle, CARD_W / 2, SUBTITLE_BASELINE);
  }

  ctx.fillStyle = GOLD;
  ctx.fillRect(CARD_W / 2 - 180, header.ribbonY, 360, 3);
  ctx.beginPath();
  ctx.moveTo(CARD_W / 2, header.ribbonY - 9);
  ctx.lineTo(CARD_W / 2 + 10, header.ribbonY + 1.5);
  ctx.lineTo(CARD_W / 2, header.ribbonY + 12);
  ctx.lineTo(CARD_W / 2 - 10, header.ribbonY + 1.5);
  ctx.closePath();
  ctx.fill();

  const layout = computeLayout(livros.length);
  layout.slots.forEach((s, i) => drawCover(ctx, s, shown[i]!, covers[i] ?? null));

  if (layout.extra > 0) {
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = GOLD_DARK;
    ctx.font = `600 40px ${SERIF}`;
    ctx.fillText(extraLabel(layout.extra), CARD_W / 2, layout.bottom + 20);
  }

  const fh = 220;
  ctx.fillStyle = DARK;
  ctx.fillRect(0, CARD_H - fh, CARD_W, fh);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, CARD_H - fh, CARD_W, 4);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = CREAM;
  ctx.font = `500 40px ${SANS}`;
  ctx.fillText("Organizo minhas leituras no Grifo", CARD_W / 2, CARD_H - fh + 95);
  ctx.fillStyle = GOLD;
  ctx.font = `700 46px ${SERIF}`;
  ctx.fillText("useogrifo.app", CARD_W / 2, CARD_H - fh + 160);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b && b.size ? resolve(b) : reject(new Error("Falha ao gerar imagem"))), "image/png"),
  );
}
