function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fitQuoteFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
) {
  let fontSize = 64;
  let lines: string[] = [];
  while (fontSize >= 32) {
    ctx.font = `italic 500 ${fontSize}px "Playfair Display", Georgia, serif`;
    lines = wrapText(ctx, text, maxWidth);
    if (lines.length * fontSize * 1.35 <= maxHeight) break;
    fontSize -= 4;
  }
  return { fontSize, lines };
}

export async function generateQuoteImage(opts: {
  quote: string;
  page?: number | null;
  bookTitle: string;
  bookAuthor?: string | null;
}): Promise<Blob> {
  await document.fonts.load('italic 500 64px "Playfair Display"');
  await document.fonts.load('600 34px "Playfair Display"');
  await document.fonts.load('600 30px "Inter"');
  await document.fonts.ready;

  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar a imagem.");

  const cream = "oklch(0.968 0.014 85.5)";
  const teal = "oklch(0.268 0.042 198)";
  const tealSoft = "oklch(0.5 0.028 190)";
  const gold = "oklch(0.775 0.115 82)";

  ctx.fillStyle = cream;
  ctx.fillRect(0, 0, W, H);

  const padX = 96;

  ctx.fillStyle = gold;
  ctx.font = '600 160px "Playfair Display", Georgia, serif';
  ctx.fillText("\u201C", padX - 12, 300);

  const maxWidth = W - padX * 2;
  const { fontSize, lines } = fitQuoteFont(ctx, opts.quote, maxWidth, 620);
  ctx.fillStyle = teal;
  ctx.font = `italic 500 ${fontSize}px "Playfair Display", Georgia, serif`;
  const lineHeight = fontSize * 1.35;
  let y = 380;
  for (const line of lines) {
    ctx.fillText(line, padX, y);
    y += lineHeight;
  }

  const dividerY = y + 24;
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(padX, dividerY);
  ctx.lineTo(padX + 72, dividerY);
  ctx.stroke();

  ctx.fillStyle = teal;
  ctx.font = '600 30px "Inter", sans-serif';
  ctx.fillText(opts.bookTitle.toUpperCase(), padX, dividerY + 56);

  let infoY = dividerY + 94;
  if (opts.bookAuthor) {
    ctx.fillStyle = tealSoft;
    ctx.font = '400 26px "Inter", sans-serif';
    ctx.fillText(opts.bookAuthor, padX, infoY);
    infoY += 34;
  }
  if (opts.page != null) {
    ctx.fillStyle = tealSoft;
    ctx.font = '400 24px "Inter", sans-serif';
    ctx.fillText(`p. ${opts.page}`, padX, infoY);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = gold;
  ctx.font = '600 34px "Playfair Display", Georgia, serif';
  ctx.fillText("Grifo\u2022", W / 2, H - 72);
  ctx.textAlign = "left";

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Não foi possível gerar a imagem."));
    }, "image/png");
  });
}

export async function shareOrDownloadImage(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" });
  const canShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as unknown as { canShare?: (data: unknown) => boolean }).canShare ===
      "function" &&
    (navigator as unknown as { canShare: (data: unknown) => boolean }).canShare({ files: [file] });

  if (canShare) {
    try {
      await (
        navigator as unknown as { share: (data: unknown) => Promise<void> }
      ).share({ files: [file], title: "Grifo" });
      return;
    } catch {
      /* usuário cancelou ou o navegador falhou; cai no download */
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
