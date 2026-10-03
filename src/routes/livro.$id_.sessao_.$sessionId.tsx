// src/routes/livro.$id_.sessao_.$sessionId.tsx
// Tela do cronômetro de leitura em andamento (passo 2).
//
// IMPORTANTE sobre o nome do arquivo: tem um "_" depois de "$id" E outro
// depois de "sessao" (livro.$id_.sessao_.$sessionId.tsx). Isso é
// proposital — sem esses underscores, o TanStack Router tentaria aninhar
// essa tela dentro de livro.$id.tsx e/ou livro.$id_.sessao.tsx, que não
// têm <Outlet/> pra exibir uma tela filha (foi exatamente o bug que
// resolvemos na tela de configuração). Com os underscores, a URL final
// continua sendo /livro/$id/sessao/$sessionId, só que como rota
// independente.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Lock, Pause, Pencil, Play, Square, Unlock, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import {
  addReadingLog,
  finishReadingSession,
  getReadingSession,
  getUserBook,
  updateUserBook,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/livro/$id/sessao/$sessionId")({
  component: () => (
    <AppShell>
      <ReadingSessionTimer />
    </AppShell>
  ),
});

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function ReadingSessionTimer() {
  const { id, sessionId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: ub } = useQuery({
    queryKey: ["user_book", id],
    queryFn: () => getUserBook(id),
    enabled: Boolean(user),
  });
  const { data: session, isLoading } = useQuery({
    queryKey: ["reading_session", sessionId],
    queryFn: () => getReadingSession(sessionId),
    enabled: Boolean(user),
  });

  // Só serve pra forçar um re-render a cada segundo — o tempo real vem
  // sempre de Date.now() comparado com iniciado_em, não de um contador
  // incrementado manualmente (assim não desalinha se a aba ficar em
  // segundo plano um tempo).
  const [, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedAccumMsRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const [telaFixa, setTelaFixa] = useState(false);
  const wakeLockRef = useRef<any>(null);

  const [encerrando, setEncerrando] = useState(false);
  const [paginaFim, setPaginaFim] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (ub && paginaFim === null) {
      setPaginaFim(ub.current_page ?? session?.pagina_inicio ?? 0);
    }
  }, [ub, session, paginaFim]);

  useEffect(() => {
    return () => {
      void wakeLockRef.current?.release?.();
    };
  }, []);

  async function toggleTelaFixa() {
    try {
      if (!telaFixa) {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
        setTelaFixa(true);
      } else {
        await wakeLockRef.current?.release?.();
        wakeLockRef.current = null;
        setTelaFixa(false);
      }
    } catch {
      toast.error("Seu navegador não permite manter a tela sempre ligada.");
    }
  }

  function togglePause() {
    if (!paused) {
      pauseStartedAtRef.current = Date.now();
      setPaused(true);
    } else {
      if (pauseStartedAtRef.current != null) {
        pausedAccumMsRef.current += Date.now() - pauseStartedAtRef.current;
      }
      pauseStartedAtRef.current = null;
      setPaused(false);
    }
  }

  if (isLoading || !ub || !session) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  const startedMs = new Date(session.iniciado_em).getTime();
  const nowMs =
    paused && pauseStartedAtRef.current != null ? pauseStartedAtRef.current : Date.now();
  const elapsedSeconds = Math.max(0, (nowMs - startedMs - pausedAccumMsRef.current) / 1000);
  const plannedSeconds = (session.duracao_planejada_min ?? 0) * 60;
  const isCronometrado = session.modo === "cronometrado";
  const remainingSeconds = isCronometrado ? plannedSeconds - elapsedSeconds : 0;
  const tempoEsgotado = isCronometrado && remainingSeconds <= 0;

  async function confirmarEncerramento() {
    if (!user || !ub || !session) return;
    setSalvando(true);
    try {
      const duracaoReal = Math.round(elapsedSeconds);
      await finishReadingSession(sessionId, {
        pagina_fim: paginaFim,
        duracao_real_segundos: duracaoReal,
      });

      // Já aproveita e atualiza o progresso do livro, igual à tela de
      // "Atualizar progresso" — evita a pessoa ter que repetir a página
      // manualmente depois de uma sessão.
      if (
        ub.format === "fisico" &&
        paginaFim != null &&
        (ub.current_page == null || paginaFim > ub.current_page)
      ) {
        const paginasLidas = Math.max(
          0,
          paginaFim - (ub.current_page ?? session.pagina_inicio ?? 0),
        );
        await updateUserBook(id, { current_page: paginaFim });
        await addReadingLog({
          user_book_id: id,
          user_id: user.id,
          mood: null,
          pages_read: paginasLidas,
        });
      }

      void queryClient.invalidateQueries({ queryKey: ["user_book", id] });
      void queryClient.invalidateQueries({ queryKey: ["user_books"] });

      const minutos = Math.round(duracaoReal / 60);
      toast.success(`Sessão encerrada — ${minutos} min de leitura registrados.`);
      navigate({ to: "/livro/$id", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível encerrar a sessão");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="flex min-h-[70vh] flex-col">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/livro/$id", params: { id } })}
          aria-label="Fechar"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          onClick={toggleTelaFixa}
          aria-label={telaFixa ? "Permitir que a tela apague" : "Manter a tela sempre ligada"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground"
        >
          {telaFixa ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-6 flex flex-col items-center text-center">
        <div className="h-32 w-24 overflow-hidden rounded-lg bg-muted">
          <BookCover src={ub.book?.cover_url} title={ub.book?.title} />
        </div>
        <h1 className="font-display mt-4 text-xl">{ub.book?.title}</h1>
      </div>

      <div className="mt-10 flex flex-1 flex-col items-center justify-center">
        <p className="font-display text-7xl tabular-nums">
          {formatMMSS(isCronometrado ? remainingSeconds : elapsedSeconds)}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {isCronometrado
            ? tempoEsgotado
              ? "Tempo esgotado — quando quiser, encerre a sessão."
              : paused
                ? "Pausado"
                : "Contando regressivamente"
            : paused
              ? "Pausado"
              : "Leitura livre em andamento"}
        </p>
      </div>

      {!encerrando ? (
        <div className="mt-auto flex gap-3 pt-10">
          <button
            onClick={togglePause}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border py-4 text-sm font-medium text-foreground"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? "Retomar" : "Pausar"}
          </button>
          <button
            onClick={() => setEncerrando(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-4 text-sm font-medium text-primary-foreground"
          >
            <Square className="h-4 w-4" />
            Encerrar sessão
          </button>
        </div>
      ) : (
        <div className="panel-cream mt-auto rounded-2xl p-5">
          <h2 className="font-display text-lg">Encerrar sessão de leitura</h2>
          <p className="mt-1 text-sm text-muted-foreground">Em que página você parou?</p>
          <div className="mt-3 flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            <input
              type="number"
              value={paginaFim ?? 0}
              onChange={(e) => setPaginaFim(Number(e.target.value))}
              className="w-28 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={confirmarEncerramento}
              disabled={salvando}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Confirmar"}
            </button>
            <button
              onClick={() => setEncerrando(false)}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
