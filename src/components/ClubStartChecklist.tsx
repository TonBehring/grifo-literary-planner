import type { ReactNode } from "react";
import { Check } from "lucide-react";

// Primeiros passos para o admin de um clube novo. Some quando tudo estiver feito.
export function ClubStartChecklist({
  temLivro,
  temEncontro,
  temOutrosMembros,
  onDefinirLivro,
  onMarcarEncontro,
  botaoConvidar,
}: {
  temLivro: boolean;
  temEncontro: boolean;
  temOutrosMembros: boolean;
  onDefinirLivro: () => void;
  onMarcarEncontro: () => void;
  botaoConvidar: ReactNode;
}) {
  if (temLivro && temEncontro && temOutrosMembros) return null;
  const feitos = [temLivro, temEncontro, temOutrosMembros].filter(Boolean).length;

  const item = (feito: boolean, texto: string, acao: ReactNode) => (
    <li className="flex items-center gap-3">
      <span
        className={
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border " +
          (feito ? "border-primary bg-primary text-primary-foreground" : "border-border")
        }
        aria-hidden
      >
        {feito && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className={"min-w-0 flex-1 text-sm " + (feito ? "text-muted-foreground line-through" : "")}>
        {texto}
      </span>
      {!feito && acao}
    </li>
  );

  const link = (rotulo: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-xs font-medium text-primary underline underline-offset-4"
    >
      {rotulo}
    </button>
  );

  return (
    <div className="panel-cream mt-4 rounded-2xl p-4">
      <p className="text-sm font-medium">Primeiros passos do clube</p>
      <p className="text-xs text-muted-foreground">{feitos} de 3 feitos. Só você, que administra, vê isto.</p>
      <ul className="mt-3 flex flex-col gap-3">
        {item(temLivro, "Defina o livro do clube", link("Definir", onDefinirLivro))}
        {item(temEncontro, "Marque o primeiro encontro", link("Marcar", onMarcarEncontro))}
        {item(temOutrosMembros, "Convide pessoas para o clube", botaoConvidar)}
      </ul>
    </div>
  );
}
