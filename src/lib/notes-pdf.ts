// src/lib/notes-pdf.ts
//
// Exporta notas/citações em PDF, usando jsPDF (só client, sem precisar de
// backend). O conteúdo da nota é texto puro com uma formatação leve
// própria do Grifo (**negrito**, *itálico*, ==marca-texto==, ver
// note-format.tsx) — o PDF não reconstrói esse estilo visual (negrito,
// itálico etc.), só remove os marcadores e mostra o texto limpo.
//
// Se o pacote "jspdf" ainda não estiver instalado no projeto, o Lovable
// deve detectar o import novo e instalar sozinho ao publicar; se não
// instalar automaticamente, adicione a dependência "jspdf" manualmente.

import jsPDF from "jspdf";
import type { BookNote } from "./types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

// Tira os marcadores de formatação (**negrito**, *itálico*, ==marca-texto==)
// e deixa só o texto, já que o PDF não reproduz o estilo visual.
function stripFormatting(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/==(.+?)==/g, "$1");
}

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  pageHeight: number,
  marginTop: number,
): number {
  let cursorY = y;
  for (const paragraph of text.split("\n")) {
    const lines = paragraph.length > 0 ? doc.splitTextToSize(paragraph, maxWidth) : [""];
    for (const line of lines) {
      if (cursorY > pageHeight - 56) {
        doc.addPage();
        cursorY = marginTop;
      }
      doc.text(line, x, cursorY);
      cursorY += lineHeight;
    }
  }
  return cursorY;
}

function writeNoteBlock(
  doc: jsPDF,
  note: Pick<BookNote, "kind" | "page" | "created_at" | "content">,
  x: number,
  y: number,
  maxWidth: number,
  pageHeight: number,
  marginTop: number,
): number {
  if (y > pageHeight - 72) {
    doc.addPage();
    y = marginTop;
  }

  const label = note.kind === "citacao" ? "Citação" : "Nota";
  const pageLabel = note.page != null ? ` · pág. ${note.page}` : "";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${label}${pageLabel} — ${formatDate(note.created_at)}`, x, y);
  y += 16;

  doc.setFont("helvetica", note.kind === "citacao" ? "italic" : "normal");
  doc.setFontSize(11);
  doc.setTextColor(0);
  const conteudo = stripFormatting(note.content);
  const texto = note.kind === "citacao" ? `“${conteudo}”` : conteudo;
  y = addWrappedText(doc, texto, x, y, maxWidth, 15, pageHeight, marginTop) + 18;

  return y;
}

// Notas de um único livro — botão na tela do livro.
export function exportBookNotesToPdf(bookTitle: string, notes: BookNote[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const marginTop = 64;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  let y = marginTop;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  y = addWrappedText(doc, bookTitle, marginX, y, maxWidth, 20, pageHeight, marginTop) + 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(`Notas exportadas do Grifo em ${formatDate(new Date().toISOString())}`, marginX, y);
  y += 26;
  doc.setTextColor(0);

  if (notes.length === 0) {
    doc.setFontSize(11);
    doc.text("Nenhuma nota ou citação registrada ainda.", marginX, y);
  }

  for (const note of notes) {
    y = writeNoteBlock(doc, note, marginX, y, maxWidth, pageHeight, marginTop);
  }

  const nomeArquivo = bookTitle.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "notas";
  doc.save(`grifo-notas-${nomeArquivo}.pdf`);
}

// Todas as notas do usuário, agrupadas por livro — botão geral (em
// Estatísticas). O Map deve vir com os livros já na ordem desejada.
export function exportAllNotesToPdf(notesByBook: Map<string, BookNote[]>) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const marginTop = 64;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  let y = marginTop;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  y = addWrappedText(doc, "Minhas notas e citações", marginX, y, maxWidth, 22, pageHeight, marginTop) + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(`Exportado do Grifo em ${formatDate(new Date().toISOString())}`, marginX, y);
  y += 30;
  doc.setTextColor(0);

  if (notesByBook.size === 0) {
    doc.setFontSize(12);
    doc.text("Você ainda não registrou nenhuma nota ou citação.", marginX, y);
  }

  for (const [bookTitle, notes] of notesByBook) {
    if (y > pageHeight - 96) {
      doc.addPage();
      y = marginTop;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(0);
    y = addWrappedText(doc, bookTitle, marginX, y, maxWidth, 18, pageHeight, marginTop) + 10;

    for (const note of notes) {
      y = writeNoteBlock(doc, note, marginX, y, maxWidth, pageHeight, marginTop);
    }
    y += 8;
  }

  doc.save("grifo-minhas-notas.pdf");
}
