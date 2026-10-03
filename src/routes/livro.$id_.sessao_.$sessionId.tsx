// src/routes/livro.$id_.sessao_.$sessionId.tsx
// Tela do cronômetro de leitura em andamento (passo 2 + som ambiente, passo 3).
//
// IMPORTANTE sobre o nome do arquivo: tem um "_" depois de "$id" E outro
// depois de "sessao" (livro.$id_.sessao_.$sessionId.tsx). Isso é
// proposital — sem esses underscores, o TanStack Router tentaria aninhar
// essa tela dentro de livro.$id.tsx e/ou livro.$id_.sessao.tsx, que não
// têm <Outlet/> pra exibir uma tela filha (foi exatamente o bug que
// resolvemos na tela de configuração). Com os underscores, a URL final
// continua sendo /livro/$id/sessao/$sessionId, só que como rota
// independente.
//
// Sobre os sons ambiente: por enquanto apontam direto para faixas de
// domínio livre hospedadas no CDN do Mixkit (mixkit.co), que oferece uso
// livre comercial sem necessidade de atribuição. Pra deixar mais robusto
// no futuro (e não depender de um CDN de terceiros no app em produção),
// o ideal é baixar essas faixas e subir num bucket público do Supabase
// Storage, trocando só a URL de cada item em SOUND_OPTIONS abaixo.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Church,
  CloudRain,
  Flame,
  Lock,
  Music,
  Pause,
  Pencil,
  Piano,
  Play,
  Square,
  Trees,
  Unlock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import {
  addReadingLog,
  finishReadingSession,
  getReadingSession,
  getUserBook,
  updateReadingSessionSom,
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

type SoundOption = {
  id: string;
  label: string;
  url: string;
  icon: typeof Flame;
};

const SOUND_OPTIONS: SoundOption[] = [
  {
    id: "lareira",
    label: "Lareira",
    url: "https://assets.mixkit.co/active_storage/sfx/1330/1330-preview.mp3",
    icon: Flame,
  },
  {
    id: "chuva",
    label: "Chuva",
    url: "https://assets.mixkit.co/active_storage/sfx/1247/1247-preview.mp3",
    icon: CloudRain,
  },
  {
    id: "natureza",
    label: "Natureza",
    url: "https://assets.mixkit.co/active_storage/sfx/2472/2472-preview.mp3",
    icon: Trees,
  },
  {
    id: "lofi",
    label: "Lo-fi",
    url: "https://assets.mixkit.co/music/135/135.mp3",
    icon: Music,
  },
  {
    id: "jazz",
    label: "Jazz",
    url: "https://assets.mixkit.co/music/24/24.mp3",
    icon: Music,
  },
  {
    id: "piano",
    label: "Piano",
    url: "https://assets.mixkit.co/music/493/493.mp3",
    icon: Piano,
  },
  {
    id: "gregoriano",
    label: "Canto gregoriano",
    // Faixa de domínio público (Public Domain Mark 1.0) hospedada no
    // Internet Archive: https://archive.org/details/chantsloop1mp3
    url: "https://archive.org/download/chantsloop1mp3/chantsloop1mp3.mp3",
    icon: Church,
  },
];

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
  const pausadoAntesDeEncerrarRef = useRef(false);
  const [paginaFim, setPaginaFim] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [somAberto, setSomAberto] = useState(false);
  const [somAtual, setSomAtual] = useState<string | null>(null);
  const [somCarregado, setSomCarregado] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (ub && paginaFim === null) {
      setPaginaFim(ub.current_page ?? session?.pagina_inicio ?? 0);
    }
  }, [ub, session, paginaFim]);

  // Carrega o som que já estava salvo na sessão (ex: se a pessoa recarregou
  // a página no meio da leitura) só uma vez, quando a sessão chega.
  useEffect(() => {
    if (session && !somCarregado) {
      setSomAtual(session.som_ambiente ?? null);
      setSomCarregado(true);
    }
  }, [session, somCarregado]);

  useEffect(() => {
    if (!audioRef.current) return;
    const option = SOUND_OPTIONS.find((o) => o.id === somAtual);
    if (!option) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      return;
    }
    if (audioRef.current.src !== option.url) {
      audioRef.current.src = option.url;
      audioRef.current.loop = true;
      audioRef.current.volume = 0.5;
    }
    if (!paused) {
      void audioRef.current.play().catch(() => {
        // Autoplay pode ser bloqueado em alguns navegadores até a pessoa
        // interagir de novo — não é um erro grave, só não toca ainda.
      });
    }
  }, [somAtual, paused]);

  useEffect(() => {
    return () => {
      void wakeLockRef.current?.release?.();
      audioRef.current?.pause();
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
      audioRef.current?.pause();
    } else {
      if (pauseStartedAtRef.current != null) {
        pausedAccumMsRef.current += Date.now() - pauseStartedAtRef.current;
      }
      pauseStartedAtRef.current = null;
      setPaused(false);
      if (somAtual) void audioRef.current?.play().catch(() => {});
    }
  }

  // Abrir a confirmação de encerramento pausa o cronômetro e o som — se a
  // pessoa cancelar, volta tudo de onde parou (a não ser que já estivesse
  // pausado manualmente antes de clicar em "Encerrar sessão").
  function abrirEncerrar() {
    pausadoAntesDeEncerrarRef.current = paused;
    if (!paused) {
      pauseStartedAtRef.current = Date.now();
      setPaused(true);
      audioRef.current?.pause();
    }
    setEncerrando(true);
  }

  function cancelarEncerrar() {
    setEncerrando(false);
    if (!pausadoAntesDeEncerrarRef.current) {
      if (pauseStartedAtRef.current != null) {
        pausedAccumMsRef.current += Date.now() - pauseStartedAtRef.current;
      }
      pauseStartedAtRef.current = null;
      setPaused(false);
      if (somAtual) void audioRef.current?.play().catch(() => {});
    }
  }

  async function escolherSom(id: string | null) {
    setSomAtual(id);
    setSomAberto(false);
    try {
      await updateReadingSessionSom(sessionId, id);
    } catch {
      // Falhar em salvar a preferência de som não deve atrapalhar a
      // leitura — só não vai lembrar da escolha se a pessoa recarregar.
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
  const somSelecionado = SOUND_OPTIONS.find((o) => o.id === somAtual) ?? null;

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
      <audio ref={audioRef} />

      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/livro/$id", params: { id } })}
          aria-label="Fechar"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSomAberto(true)}
            aria-label="Som ambiente"
            className={
              "inline-flex h-10 w-10 items-center justify-center rounded-full border text-muted-foreground " +
              (somSelecionado ? "border-primary text-primary" : "border-border")
            }
          >
            <Music className="h-4 w-4" />
          </button>
          <button
            onClick={toggleTelaFixa}
            aria-label={telaFixa ? "Permitir que a tela apague" : "Manter a tela sempre ligada"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground"
          >
            {telaFixa ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </button>
        </div>
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
        {somSelecionado && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-primary">
            <somSelecionado.icon className="h-3.5 w-3.5" />
            {somSelecionado.label}
          </p>
        )}
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
            onClick={abrirEncerrar}
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
              onClick={cancelarEncerrar}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {somAberto && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40"
          onClick={() => setSomAberto(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl rounded-t-3xl bg-background p-5 pb-8"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <h2 className="font-display text-lg">Som ambiente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Toca em loop enquanto você lê. Escolha "Sem som" pra desligar.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {SOUND_OPTIONS.map((option) => {
                const Icon = option.icon;
                const ativo = somAtual === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => void escolherSom(option.id)}
                    className={
                      "flex flex-col items-center gap-2 rounded-2xl border py-4 text-xs font-medium transition-colors " +
                      (ativo
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50")
                    }
                  >
                    <Icon className="h-5 w-5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => void escolherSom(null)}
              className="mt-4 w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground"
            >
              Sem som
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
