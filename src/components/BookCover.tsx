import { useState } from "react";
import capaPadrao from "@/assets/capa-padrao.jpg";

export function BookCover({
  src,
  title,
  className = "",
}: {
  src?: string | null;
  title?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = !src || failed ? capaPadrao : src;

  return (
    <img
      src={url}
      alt={title ? `Capa de ${title}` : "Capa padrão do livro"}
      loading="lazy"
      width={640}
      height={960}
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
