import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { useHasActiveSubscription } from "@/components/SubscriptionGate";
import { addClubBookToMyShelf, getMyClubProgress, saveClubManualProgress } from "@/lib/api";

// Bloco "Meu progresso" dentro do ranking do clube.
// - Quem assina: o progresso vem da estante pessoal (botão para adicionar o
//   livro do clube à estante, ou atalho para abrir o livro lá).
// - Quem não assina: informa a página em que está direto no clube.
export function ClubMyProgress({
  clubId,
  userId,
  onChanged,
}: {
  clubId: string;
  userId: string;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const { active, loading } = useHasActiveSubscription();
  const progress = useQuery({
    queryKey: ["club-my-progress", clubId, userId],
    queryFn: () => getMyClubProgress(clubId, userId),
  });
  const [pagina, setPagina] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (loading || progress.isLoading || !progress.data) return null;
  const p = progress.data;

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
    if (p.totalPaginas && n > p.totalPaginas) {
      toast.error(`Esse livro tem ${p.totalPaginas} páginas.`);
      return;
    }
    setSalvando(true);
    try {
      await saveClubManualProgress(p.clubBookId, userId, n);
      toast.success("Progresso atualizado.");
      setPagina("");
      atualizar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o progresso");
    } finally {
      setSalvando(false);
    }
  }

  if (active) {
    return (
      <div className="mt-3 rounded-xl border border-border p-3">
        <p className="text-xs font-medium">Meu progresso</p>
        {p.userBookId ? (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              Seu progresso vem da sua estante. Registre suas leituras por lá e o clube atualiza
              sozinho.
            </p>
            <Link
              to="/livro/$id"
              params={{ id: p.userBookId }}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-4"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Abrir na minha estante
            </Link>
          </>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              Adicione este livro à sua estante e registre suas leituras por lá. O clube atualiza
              sozinho.
            </p>
            <button
              type="button"
              onClick={adicionar}
              disabled={salvando}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              {salvando ? "Adicionando…" : "Adicionar à minha estante"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border p-3">
      <label htmlFor="club-my-page" className="text-xs font-medium">
        Em que página você está?
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id="club-my-page"
          type="number"
          inputMode="numeric"
          min={0}
          max={p.totalPaginas ?? undefined}
          value={pagina}
          onChange={(e) => setPagina(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && salvar()}
          placeholder={p.paginaManual !== null ? String(p.paginaManual) : "Página"}
          className="w-28 rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
      {p.paginaManual !== null && (
        <p className="mt-1 text-xs text-muted-foreground">
          Última atualização: página {p.paginaManual}
          {p.totalPaginas ? ` de ${p.totalPaginas}` : ""}.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Quer acompanhar este e outros livros na sua estante pessoal, com cronômetro e histórico?{" "}
        <Link to="/conta" className="font-medium text-primary underline underline-offset-4">
          Assine o Grifo
        </Link>
        .
      </p>
    </div>
  );
}
