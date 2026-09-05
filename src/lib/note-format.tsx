import type { ReactNode } from "react";

// Suporte a uma formatação bem simples nas anotações: **negrito**,
// *itálico* e ==grifado==. Não é rich text de verdade (não salvamos HTML),
// é só um "markdown levinho" que a gente também sabe desenhar na tela.
const TOKEN_RE = /(\*\*(.+?)\*\*|\*(.+?)\*|==(.+?)==)/g;

export function renderFormattedText(text: string): ReactNode[] {
  const lines = text.split("\n");
  const out: ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    let lastIndex = 0;
    let key = 0;
    const re = new RegExp(TOKEN_RE);
    let match: RegExpExecArray | null;

    while ((match = re.exec(line)) !== null) {
      if (match.index > lastIndex) {
        out.push(line.slice(lastIndex, match.index));
      }
      if (match[2] !== undefined) {
        out.push(<strong key={`b-${lineIdx}-${key++}`}>{match[2]}</strong>);
      } else if (match[3] !== undefined) {
        out.push(<em key={`i-${lineIdx}-${key++}`}>{match[3]}</em>);
      } else if (match[4] !== undefined) {
        out.push(
          <mark
            key={`h-${lineIdx}-${key++}`}
            className="rounded bg-primary/30 px-0.5 text-inherit"
          >
            {match[4]}
          </mark>,
        );
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) out.push(line.slice(lastIndex));
    if (lineIdx < lines.length - 1) out.push(<br key={`br-${lineIdx}`} />);
  });

  return out;
}
