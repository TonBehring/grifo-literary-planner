// Card compartilhável "Eu li [livro] com o clube [nome] no Grifo",
// no formato dos stories (1080x1920).

import { supabase } from "@/integrations/supabase/client";
import { loadCover, wrapText } from "@/lib/wishlist-card";

const W = 1080;
const H = 1920;
const CREAM = "#F9F4EA";
const DARK = "#052C2D";
const GREEN = "#144142";
const GOLD = "#DAAE5A";
const GOLD_DARK = "#85651C";
const MUTED = "#5E7C7A";
const SANS = "Inter, ui-sans-serif, system-ui, sans-serif";
const SERIF = '"Playfair Display", Georgia, serif';

export type ClubReadCardInput = {
  titulo: string;
  autor: string | null;
  capaUrl: string | null;
  clube: string;
  minhaNota: number | null;
  mediaClube: number | null;
};

function sizeOf(img: CanvasImageSource): { w: number; h: number } {
  const i = img as { naturalWidth?: number; width?: number; naturalHeight?: number; height?: number };
  return { w: i.naturalWidth || Number(i.width) || 1, h: i.naturalHeight || Number(i.height) || 1 };
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

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, filled: boolean) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = GOLD;
    ctx.fill();
  } else {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function stars(ctx: CanvasRenderingContext2D, nota: number, cx: number, cy: number, r: number) {
  const gap = r * 2.5;
  const x0 = cx - gap * 2;
  for (let i = 0; i < 5; i++) star(ctx, x0 + i * gap, cy, r, i < Math.round(nota));
}

async function loadLogo(): Promise<CanvasImageSource | null> {
  try {
    const res = await fetch("/brand/logo-grifo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

export async function generateClubReadCard(input: ClubReadCardInput): Promise<Blob> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await Promise.all([
      document.fonts.load(`700 64px ${SERIF}`).catch(() => null),
      document.fonts.load(`500 36px ${SANS}`).catch(() => null),
    ]);
    await document.fonts.ready;
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  const [logo, capa] = await Promise.all([loadLogo(), loadCover(input.capaUrl, token)]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  if (logo) {
    const { w, h } = sizeOf(logo);
    const lw = 220;
    ctx.drawImage(logo, (W - lw) / 2, 100, lw, (h / w) * lw);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = GOLD_DARK;
  ctx.font = `600 34px ${SANS}`;
  ctx.fillText("E U   L I", W / 2, 300);

  // Capa
  const cw = 400;
  const ch = 600;
  const cx = (W - cw) / 2;
  const cy = 350;
  ctx.save();
  ctx.shadowColor = "rgba(5,44,45,0.30)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, cx, cy, cw, ch, 18);
  ctx.fillStyle = GREEN;
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, cx, cy, cw, ch, 18);
  ctx.clip();
  if (capa) {
    const { w, h } = sizeOf(capa);
    const s = Math.max(cw / w, ch / h);
    ctx.drawImage(capa, cx + (cw - w * s) / 2, cy + (ch - h * s) / 2, w * s, h * s);
  } else {
    ctx.fillStyle = GREEN;
    ctx.fillRect(cx, cy, cw, ch);
    ctx.fillStyle = CREAM;
    ctx.font = `600 40px ${SERIF}`;
    ctx.textBaseline = "middle";
    const linhas = wrapText(ctx, input.titulo, cw - 60, 5);
    const lh = 52;
    const y0 = cy + ch / 2 - ((linhas.length - 1) * lh) / 2;
    linhas.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lh));
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  // Título e autor
  let y = cy + ch + 100;
  ctx.fillStyle = DARK;
  ctx.font = `700 62px ${SERIF}`;
  const titulo = wrapText(ctx, input.titulo, W - 160, 2);
  titulo.forEach((l) => {
    ctx.fillText(l, W / 2, y);
    y += 74;
  });
  if (input.autor) {
    ctx.fillStyle = MUTED;
    ctx.font = `400 36px ${SANS}`;
    const autor = wrapText(ctx, input.autor, W - 200, 1);
    if (autor[0]) ctx.fillText(autor[0], W / 2, y);
    y += 70;
  }

  // Clube
  ctx.fillStyle = GREEN;
  ctx.font = `400 38px ${SANS}`;
  ctx.fillText("com o clube de leitura", W / 2, y);
  y += 72;
  ctx.fillStyle = DARK;
  ctx.font = `700 52px ${SERIF}`;
  const clube = wrapText(ctx, input.clube, W - 160, 2);
  clube.forEach((l) => {
    ctx.fillText(l, W / 2, y);
    y += 64;
  });

  // Notas
  if (input.minhaNota) {
    y += 30;
    stars(ctx, input.minhaNota, W / 2, y, 26);
    y += 70;
    if (input.mediaClube) {
      ctx.fillStyle = MUTED;
      ctx.font = `500 32px ${SANS}`;
      const media = input.mediaClube.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      ctx.fillText(`Nota do clube: ${media}`, W / 2, y);
    }
  }

  // Rodapé
  const fh = 220;
  ctx.fillStyle = DARK;
  ctx.fillRect(0, H - fh, W, fh);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, H - fh, W, 4);
  ctx.fillStyle = CREAM;
  ctx.font = `500 40px ${SANS}`;
  ctx.fillText("Leio com meu clube no Grifo", W / 2, H - fh + 95);
  ctx.fillStyle = GOLD;
  ctx.font = `700 46px ${SERIF}`;
  ctx.fillText("useogrifo.app", W / 2, H - fh + 160);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b && b.size ? resolve(b) : reject(new Error("Falha ao gerar imagem"))), "image/png"),
  );
}
