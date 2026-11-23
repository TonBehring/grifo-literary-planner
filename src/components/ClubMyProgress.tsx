import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { useHasActiveSubscription } from "@/components/SubscriptionGate";
import { addClubBookToMyShelf, getMyClubProgress, saveClubManualProgress } from "@/lib/api";

export function progressPercent(paginas: number, total: number | null): number | null {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.round((paginas / total) * 100));
}

// Barra de progresso fina, usada no cartão do livro e no ranking.
export function ProgressBar({
  percent,
  tone = "light",
  label,
}: {
  percent: number;
  tone?: "light" | "dark";
  label: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={"h-1.5 w-full overflow-hidden rounded-full " + (tone === "dark" ? "bg-white/20" : "bg-muted")}
    >
      <div
        className={"h-full rounded-full " + (tone === "dark" ? "bg-white" : "bg-primary")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// "Meu progresso", dentro do cartão do livro atual (fundo verde escuro).
// - Quem assina: o progresso vem da estante pessoal (botão para adicionar o
//   livro do clube à estante, ou atalho para abrir o livro lá).
// - Quem não assina: informa a página em que está direto no clube.
export function ClubMyProgress({
  clubId,
  userId,
  totalPaginas,
  minhasPaginas,
  onChanged,
}: {
  clubId: string;
  userId: string;
  totalPaginas: number | null;
  minhasPaginas: number | null;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const { active, loading } = useHasActiveSubscription();
  const progress = useQuery({
    queryKey: ["club-my-progress", clubId, userId],
    queryFn: () => getMyClubProgress(clubId, userId),
  });
  const [editando, setEditando] = useState(false);
  const [pagina, setPagina] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (loading || progress.isLoading || !progress.data) return null;
  const p = progress.data;
  const total = totalPaginas ?? p.totalPaginas;
  const lidas = minhasPaginas ?? 0;
  const pct = progressPercent(lidas, total);

  function atualizar() {
    void queryClient.invalidateQueries({ queryKey: ["club-my-progress", clubId, userId] });
    onChanged?.();
  }

  async function adicionar() {
    setSalvando(true);
    try {
      await addClubBookToMyShelf(p.bookId, userId);
      toast.success("Livro adicionado à sua estante como Lendo.");
      atualizar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível adicionar à estante");
    } finally {
      setSalvando(false);
    }
  }

  async function salvar() {
    const n = Number(pagina);
    if (!pagina.trim() || !Number.isInteger(n) || n < 0) {
      toast.error("Informe um número de página válido.");
      return;
    }
    if (total && n > total) {
      toast.error(`Esse livro tem ${total} páginas.`);
      return;
    }
    setSalvando(true);
    try {
      await saveClubManualProgress(p.clubBookId, userId, n);
      toast.success("Progresso atualizado.");
      setPagina("");
      setEditando(false);
      atualizar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o progresso");
    } finally {
      setSalvando(false);
    }
  }

  const resumo =
    lidas > 0
      ? total
        ? `Você leu ${lidas} de ${total} páginas`
        : `Você leu ${lidas} páginas`
      : "Você ainda não começou";

  const botao =
    "inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#052C2D] disabled:opacity-60";

  return (
    <div className="mt-4 border-t border-white/15 pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm">{resumo}</p>
        {pct !== null && lidas > 0 && <p className="text-sm font-semibold">{pct}%</p>}
      </div>
      {pct !== null && (
        <div className="mt-2">
          <ProgressBar percent={pct} tone="dark" label="Meu progresso no livro do clube" />
        </div>
      )}

      {active ? (
        p.userBookId ? (
          <>
            <p className="mt-3 text-xs opacity-80">
              Seu progresso vem da sua estante. Registre suas leituras por lá e o clube atualiza
              sozinho.
            </p>
            <Link to="/livro/$id" params={{ id: p.userBookId }} className={botao + " mt-2"}>
              <BookOpen className="h-4 w-4" />
              Registrar leitura
            </Link>
          </>
        ) : (
          <>
            <p className="mt-3 text-xs opacity-80">
              Adicione este livro à sua estante e registre suas leituras por lá. O clube atualiza
              sozinho.
            </p>
            <button type="button" onClick={adicionar} disabled={salvando} className={botao + " mt-2"}>
              <Plus className="h-4 w-4" />
              {salvando ? "Adicionando…" : "Adicionar à minha estante"}
            </button>
          </>
        )
      ) : (
        <>
          {editando ? (
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor="club-my-page" className="sr-only">
                Em que página você está?
              </label>
              <input
                id="club-my-page"
                type="number"
                inputMode="numeric"
                min={0}
                max={total ?? undefined}
                autoFocus
                value={pagina}
                onChange={(e) => setPagina(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvar()}
                placeholder={p.paginaManual !== null ? String(p.paginaManual) : "Página"}
                className="w-28 rounded-lg border border-white/30 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/60"
              />
              <button type="button" onClick={salvar} disabled={salvando} className={botao}>
                {salvando ? "Salvando…" : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="text-xs underline underline-offset-4 opacity-80"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditando(true)} className={botao + " mt-3"}>
              <BookOpen className="h-4 w-4" />
              Atualizar minha página
            </button>
          )}
          <p className="mt-3 text-xs opacity-80">
            Quer acompanhar este e outros livros na sua estante pessoal, com cronômetro e
            histórico?{" "}
            <Link to="/conta" className="font-medium underline underline-offset-4">
              Assine o Grifo
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
