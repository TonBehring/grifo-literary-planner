// src/routes/livro.$id_.sessao.tsx
// Tela de configuração da sessão de leitura (escolher cronometrado/livre
// e duração), antes de iniciar o cronômetro. A tela do cronômetro em si
// (próximo passo) vai ficar em livro.$id_.sessao.$sessionId.tsx — por
// enquanto, ao iniciar, só criamos a sessão no banco e voltamos pro
// detalhe do livro (dá pra já testar a gravação no Supabase).
//
// IMPORTANTE: o nome do arquivo tem um "_" logo depois de "$id"
// (livro.$id_.sessao.tsx, não livro.$id.sessao.tsx). Isso é proposital —
// é a convenção do TanStack Router pra gerar a URL /livro/$id/sessao
// SEM aninhar essa tela dentro da tela de livro.$id.tsx (que não tem um
// <Outlet /> pra exibir uma tela filha). Sem o "_", a rota existe mas
// nunca aparece na tela, porque fica "presa" dentro da rota do livro.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { X, Lock, Unlock, Clock, Infinity as InfinityIcon } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import { getUserBook } from "@/lib/api";
import { startReadingSession } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const DURACOES = [15, 30, 45, 60];

export const Route = createFileRoute("/livro/$id/sessao")({
  head: () => ({ meta: [
    { title: "Iniciar sessão de leitura — Grifo" },
    { name: "description", content: "Configure uma sessão de leitura para o seu livro no Grifo." },
    { property: "og:title", content: "Iniciar sessão de leitura — Grifo" },
    { property: "og:description", content: "Configure uma sessão de leitura para o seu livro no Grifo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <AppShell>
      <ReadingSessionSetup />
    </AppShell>
  ),
});

function ReadingSessionSetup() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: ub, isLoading } = useQuery({
    queryKey: ["user_book", id],
    queryFn: () => getUserBook(id),
    enabled: Boolean(user),
  });

  const [modo, setModo] = useState<"cronometrado" | "livre">("cronometrado");
  const [duracaoMin, setDuracaoMin] = useState(30);
  const [paginaAtual, setPaginaAtual] = useState<number | null>(null);
  const [editandoPagina, setEditandoPagina] = useState(false);
  const [telaFixa, setTelaFixa] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (ub && paginaAtual === null) {
      setPaginaAtual(ub.current_page ?? 0);
    }
  }, [ub, paginaAtual]);

  // Mantém a tela ligada enquanto a pessoa configura/lê, se ela ativar —
  // cai graciosamente se o navegador não suportar Wake Lock API.
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
      // Sem suporte ou permissão — só não liga o recurso, não trava a tela.
      toast.error("Seu navegador não permite manter a tela sempre ligada.");
    }
  }

  useEffect(() => {
    return () => {
      void wakeLockRef.current?.release?.();
    };
  }, []);

  async function iniciarLeitura() {
    if (!user || !ub) return;
    setIniciando(true);
    try {
      const session = await startReadingSession({
        user_id: user.id,
        user_book_id: id,
        modo,
        duracao_planejada_min: modo === "cronometrado" ? duracaoMin : null,
        pagina_inicio: paginaAtual,
      });
      toast.success(
        modo === "cronometrado"
          ? `Sessão iniciada — ${duracaoMin} min no cronômetro.`
          : "Sessão de leitura livre iniciada.",
      );
      navigate({
        to: "/livro/$id/sessao/$sessionId",
        params: { id, sessionId: session.id },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível iniciar a sessão");
    } finally {
      setIniciando(false);
    }
  }

  if (isLoading || !ub) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
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

      <div className="mt-8 flex flex-col items-center text-center">
        <div className="h-40 w-28 overflow-hidden rounded-lg bg-muted">
          <BookCover src={ub.book?.cover_url} title={ub.book?.title} />
        </div>
        <h1 className="font-display mt-5 text-2xl">{ub.book?.title}</h1>

        {editandoPagina ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              value={paginaAtual ?? 0}
              onChange={(e) => setPaginaAtual(Number(e.target.value))}
              className="w-24 rounded-lg border border-border px-2 py-1 text-center text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => setEditandoPagina(false)}
              className="text-sm text-primary underline underline-offset-4"
            >
              Ok
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Página {paginaAtual ?? 0}{" "}
            <button
              onClick={() => setEditandoPagina(true)}
              className="font-medium text-primary underline underline-offset-4"
            >
              editar
            </button>
          </p>
        )}
      </div>

      <div className="mt-10 flex justify-center gap-3">
        <button
          onClick={() => setModo("cronometrado")}
          className={
            "flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-colors " +
            (modo === "cronometrado"
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground")
          }
        >
          <Clock className="h-4 w-4" />
          Cronometrado
        </button>
        <button
          onClick={() => setModo("livre")}
          className={
            "flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-colors " +
            (modo === "livre"
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground")
          }
        >
          <InfinityIcon className="h-4 w-4" />
          Leitura livre
        </button>
      </div>

      {modo === "cronometrado" && (
        <div className="mt-10 flex flex-col items-center">
          <p className="font-display text-4xl">{duracaoMin} min</p>
          <input
            type="range"
            min={5}
            max={90}
            step={5}
            value={duracaoMin}
            onChange={(e) => setDuracaoMin(Number(e.target.value))}
            className="mt-4 w-full max-w-sm"
          />
          <div className="mt-4 flex gap-2">
            {DURACOES.map((d) => (
              <button
                key={d}
                onClick={() => setDuracaoMin(d)}
                className={
                  "rounded-full px-4 py-2 text-sm transition-colors " +
                  (duracaoMin === d
                    ? "bg-primary/20 border border-primary text-foreground"
                    : "border border-border text-muted-foreground")
                }
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pt-10">
        <button
          onClick={iniciarLeitura}
          disabled={iniciando}
          className="w-full rounded-full bg-primary py-4 text-base font-medium text-primary-foreground disabled:opacity-60"
        >
          {iniciando ? "Iniciando…" : "Iniciar leitura"}
        </button>
      </div>
    </section>
  );
}
