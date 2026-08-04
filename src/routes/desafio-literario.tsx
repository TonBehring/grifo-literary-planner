import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  DESAFIOS,
  PERIODO_LABEL,
  calcPeriodoFim,
  createBoard,
  daysLeft,
  desafioTexto,
  getActiveBoard,
  listBoardItems,
  listPastBoards,
  toggleDesafio,
  type DesafioItem,
  type PeriodoTipo,
} from "@/lib/desafios";

export const Route = createFileRoute("/desafio-literario")({
  head: () => ({
    meta: [
      { title: "Desafio Literário — Grifo" },
      {
        name: "description",
        content:
          "Monte seu bingo de leitura por período e marque os desafios literários conquistados.",
      },
      { property: "og:title", content: "Desafio Literário — Grifo" },
      {
        property: "og:description",
        content: "Um cartela de desafios de leitura personalizada para o seu período.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <DesafioPage />
    </AppShell>
  ),
});

const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");

function DesafioPage() {
  const { user } = useAuth();
  const enabled = Boolean(user);
  const {
    data: board,
    isLoading,
    error,
  } = useQuery({ queryKey: ["desafio_board"], queryFn: getActiveBoard, enabled });

  return (
    <section>
      <p className="text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        Bingo de leitura
      </p>
      <h1 className="font-display mt-2 text-4xl leading-tight">Desafio Literário</h1>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Carregando desafio…</p>}
      {error && (
        <p className="mt-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "Erro ao carregar"}
        </p>
      )}
      {!isLoading && !error && (board ? <BoardView board={board} /> : <SetupView />)}

      <Historico enabled={enabled} />
    </section>
  );
}

function SetupView() {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<PeriodoTipo>("mes");
  const [selected, setSelected] = useState<string[]>(DESAFIOS.map((d) => d.slug));

  const create = useMutation({
    mutationFn: () => createBoard(tipo, selected),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["desafio_board"] });
      toast.success("Cartela criada! Bom desafio.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar cartela"),
  });

  const toggle = (slug: string) =>
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  return (
    <div className="mt-7 space-y-5">
      <div className="panel-cream rounded-2xl p-5">
        <p className="font-display text-lg">Escolha o período</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(PERIODO_LABEL) as PeriodoTipo[]).map((p) => (
            <button
              key={p}
              onClick={() => setTipo(p)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition-colors",
                tipo === p
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {PERIODO_LABEL[p]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Termina em {fmt(calcPeriodoFim(tipo))}
        </p>
      </div>

      <div className="panel-cream rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-lg">Escolha os desafios</p>
          <button
            onClick={() =>
              setSelected((prev) =>
                prev.length === DESAFIOS.length ? [] : DESAFIOS.map((d) => d.slug),
              )
            }
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            {selected.length === DESAFIOS.length ? "Limpar todos" : "Selecionar todos"}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{selected.length} selecionados</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {DESAFIOS.map((d) => {
            const on = selected.includes(d.slug);
            return (
              <button
                key={d.slug}
                onClick={() => toggle(d.slug)}
                className={cn(
                  "rounded-xl border p-3 text-left text-sm transition-colors",
                  on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground",
                )}
              >
                {d.texto}
              </button>
            );
          })}
        </div>
      </div>

      <button
        disabled={selected.length === 0 || create.isPending}
        onClick={() => create.mutate()}
        className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {create.isPending ? "Criando…" : "Começar desafio"}
      </button>
    </div>
  );
}

function BoardView({ board }: { board: { id: string; periodo_tipo: PeriodoTipo; periodo_inicio: string; periodo_fim: string } }) {
  const queryClient = useQueryClient();
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const { data: items, isLoading } = useQuery({
    queryKey: ["desafio_items", board.id],
    queryFn: () => listBoardItems(board.id),
  });

  const mutate = useMutation({
    mutationFn: toggleDesafio,
    onSuccess: (concluido, item) => {
      void queryClient.invalidateQueries({ queryKey: ["desafio_items", board.id] });
      if (concluido) setCelebrate(desafioTexto(item.desafio_slug));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar"),
  });

  const done = items?.filter((i) => i.concluido).length ?? 0;
  const total = items?.length ?? 0;
  const bingo = total > 0 && done === total;

  return (
    <div className="mt-7 space-y-5">
      <div className="card-teal rounded-2xl p-5">
        <p className="text-[11px] tracking-[0.2em] text-primary uppercase">
          {PERIODO_LABEL[board.periodo_tipo]}
        </p>
        <p className="font-display mt-1 text-2xl">
          {done} de {total} concluídos
        </p>
        <p className="mt-1 text-sm opacity-70">
          {fmt(board.periodo_inicio)} até {fmt(board.periodo_fim)} · faltam{" "}
          {daysLeft(board.periodo_fim)} dias
        </p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {bingo && (
        <div className="panel-cream flex items-center gap-3 rounded-2xl p-5">
          <Trophy className="h-6 w-6 text-primary" />
          <div>
            <p className="font-display text-xl">Bingo!</p>
            <p className="text-sm text-muted-foreground">
              Você completou todos os desafios desta cartela.
            </p>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando cartela…</p>}

      <div className="grid grid-cols-2 gap-3">
        {items?.map((item: DesafioItem) => (
          <button
            key={item.id}
            onClick={() => mutate.mutate(item)}
            className={cn(
              "relative min-h-28 rounded-2xl border p-4 text-left text-sm transition-colors",
              item.concluido
                ? "card-teal border-primary/60"
                : "panel-cream border-border hover:border-primary/50",
            )}
          >
            {item.concluido && (
              <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-primary" />
            )}
            <span className={cn("font-display block pr-5 text-base leading-snug", item.concluido && "opacity-90")}>
              {desafioTexto(item.desafio_slug)}
            </span>
          </button>
        ))}
      </div>

      <Dialog open={celebrate !== null} onOpenChange={(o) => !o && setCelebrate(null)}>
        <DialogContent className="panel-cream max-w-md rounded-3xl border-none p-7">
          <div className="text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 text-[11px] tracking-[0.2em] text-primary uppercase">
              Desafio concluído
            </p>
            <h2 className="font-display mt-2 text-2xl leading-snug">{celebrate}</h2>
            <p className="mt-2 text-sm opacity-70">
              {bingo ? "Bingo! Cartela completa." : "Mais um quadradinho grifado na sua cartela."}
            </p>
          </div>
          <button
            onClick={() => setCelebrate(null)}
            className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Continuar
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Historico({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["desafio_boards_past"],
    queryFn: listPastBoards,
    enabled: enabled && open,
  });

  return (
    <div className="mt-8">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-2xl border border-border px-5 py-4 text-left"
      >
        <span className="font-display text-lg">Histórico de desafios</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando histórico…</p>}
          {data?.length === 0 && (
            <p className="panel-cream rounded-2xl p-5 text-sm text-muted-foreground">
              Nenhum período encerrado ainda. Suas conquistas passadas aparecerão aqui.
            </p>
          )}
          {data?.map((b) => (
            <div key={b.id} className="panel-cream flex items-center gap-3 rounded-2xl p-4">
              <Trophy className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-display text-base">{PERIODO_LABEL[b.periodo_tipo]}</p>
                <p className="text-xs text-muted-foreground">
                  {fmt(b.periodo_inicio)} até {fmt(b.periodo_fim)} · {b.concluidos} de {b.total}{" "}
                  concluídos
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
