import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/estatisticas")({
  head: () => ({
    meta: [
      { title: "Estatísticas — Grifo" },
      {
        name: "description",
        content:
          "Acompanhe livros lidos no ano, meta de leitura, humor dos últimos 30 dias e sua constância.",
      },
      { property: "og:title", content: "Estatísticas — Grifo" },
      {
        property: "og:description",
        content: "Seus números de leitura: páginas, metas, humor e constância.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <StatsPage />
    </AppShell>
  ),
});

const MOOD_EMOJI: Record<string, string> = {
  "Apaixonado (a)": "😍",
  "Emocionado (a)": "🥹",
  "Impactado (a)": "🤯",
  "Sereno (a)": "😌",
  "Arrastado (a)": "😴",
  "Irritado (a)": "😤",
};

const YEAR = new Date().getFullYear();

function dayKey(value: string) {
  return value.slice(0, 10);
}

type LogRow = { humor: string | null; paginas_lidas: number | null; data: string };

async function fetchFinished(userId: string) {
  const { data, error } = await supabase
    .from("user_books")
    .select("id, data_conclusao, book:books(total_paginas)")
    .eq("user_id", userId)
    .eq("status", "lido")
    .gte("data_conclusao", `${YEAR}-01-01`)
    .lte("data_conclusao", `${YEAR}-12-31T23:59:59`);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Array<{
    id: string;
    data_conclusao: string | null;
    book: { total_paginas: number | null } | null;
  }>;
}

async function fetchLogs(userId: string, since: string) {
  const { data, error } = await supabase
    .from("reading_logs")
    .select("humor, paginas_lidas, data, user_book:user_books!inner(user_id)")
    .eq("user_book.user_id", userId)
    .gte("data", since)
    .order("data", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LogRow[];
}

function StatsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const yearStart = `${YEAR}-01-01`;
  const since90 = new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);
  const since = since90 < yearStart ? since90 : yearStart;

  const finished = useQuery({
    queryKey: ["stats-finished", userId],
    queryFn: () => fetchFinished(userId),
    enabled: Boolean(userId),
  });

  const logs = useQuery({
    queryKey: ["stats-logs", userId],
    queryFn: () => fetchLogs(userId, since),
    enabled: Boolean(userId),
  });

  const booksRead = finished.data?.length ?? 0;
  const pages = (finished.data ?? []).reduce((sum, ub) => sum + (ub.book?.total_paginas ?? 0), 0);

  const yearLogs = (logs.data ?? []).filter((l) => l.data >= yearStart);
  const pagesByDay = new Map<string, number>();
  for (const l of yearLogs) {
    const k = dayKey(l.data);
    pagesByDay.set(k, (pagesByDay.get(k) ?? 0) + (l.paginas_lidas ?? 0));
  }
  const totalPagesLogged = [...pagesByDay.values()].reduce((a, b) => a + b, 0);
  const avgPerDay = pagesByDay.size ? Math.round(totalPagesLogged / pagesByDay.size) : 0;

  const loadingTop = finished.isLoading || logs.isLoading;

  return (
    <section className="pb-6">
      <h1 className="font-display text-4xl leading-tight">Estatísticas</h1>

      <div className="card-teal mt-6 rounded-2xl p-5">
        <h2 className="font-display text-xl">Sua leitura em {YEAR}</h2>
        {loadingTop ? (
          <p className="mt-4 text-sm opacity-70">Carregando...</p>
        ) : booksRead === 0 && pagesByDay.size === 0 ? (
          <p className="mt-4 text-sm opacity-70">
            Comece a registrar seu progresso para ver suas estatísticas aqui.
          </p>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat value={String(booksRead)} label="livros lidos" />
            <Stat value={pages.toLocaleString("pt-BR")} label="páginas" />
            <Stat value={String(avgPerDay)} label="páginas/dia" />
          </div>
        )}
      </div>

      <GoalCard userId={userId} booksRead={booksRead} />

      <div className="mt-8">
        <h2 className="font-display text-xl">Seu humor de leitura</h2>
        {logs.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <MoodStrip logs={logs.data ?? []} />
        )}
      </div>

      <div className="mt-8">
        <h2 className="font-display text-xl">Calendário de constância</h2>
        {logs.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <Streak logs={logs.data ?? []} />
        )}
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-3xl leading-none">{value}</p>
      <p className="mt-1 text-xs opacity-70">{label}</p>
    </div>
  );
}

function GoalCard({ userId, booksRead }: { userId: string; booksRead: number }) {
  const queryClient = useQueryClient();
  const [meta, setMeta] = useState("12");

  const goal = useQuery({
    queryKey: ["reading-goal", userId, YEAR],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reading_goals")
        .select("id, ano, meta_livros, meta_paginas")
        .eq("user_id", userId)
        .eq("ano", YEAR)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as { id: string; meta_livros: number | null } | null;
    },
    enabled: Boolean(userId),
  });

  const create = useMutation({
    mutationFn: async () => {
      const value = Number(meta);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Informe uma meta válida");
      const { error } = await supabase
        .from("reading_goals")
        .insert({ user_id: userId, ano: YEAR, meta_livros: Math.round(value) });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reading-goal", userId, YEAR] });
      toast.success("Meta definida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const target = goal.data?.meta_livros ?? 0;
  const percent = target > 0 ? Math.min(100, Math.round((booksRead / target) * 100)) : 0;

  return (
    <div className="panel-cream mt-6 rounded-2xl p-5">
      <h2 className="font-display text-xl">Meta do ano</h2>
      {goal.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Carregando...</p>
      ) : !goal.data ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Você ainda não definiu uma meta para {YEAR}. Quantos livros quer ler?
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              min={1}
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              aria-label="Meta de livros"
              className="w-28 rounded-xl border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {create.isPending ? "Salvando..." : "Definir meta"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            {booksRead} de {target} livros · {percent}%
          </p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

function MoodStrip({ logs }: { logs: LogRow[] }) {
  const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const recent = logs.filter((l) => dayKey(l.data) >= since && l.humor);

  if (recent.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Nenhum humor registrado nos últimos 30 dias. Registre sua leitura para ver isso aqui.
      </p>
    );
  }

  return (
    <div className="card-teal mt-3 overflow-x-auto rounded-2xl p-4">
      <div className="flex min-w-max gap-4">
        {recent.map((l, i) => (
          <div key={`${l.data}-${i}`} className="flex w-14 flex-col items-center gap-1">
            <span className="text-2xl leading-none">
              {MOOD_EMOJI[l.humor ?? ""] ?? "📖"}
            </span>
            <span className="text-[10px] opacity-70">
              {new Date(`${dayKey(l.data)}T12:00:00`).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Streak({ logs }: { logs: LogRow[] }) {
  const counts = new Map<string, number>();
  for (const l of logs) {
    const k = dayKey(l.data);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const days: Array<{ key: string; count: number }> = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    days.push({ key: d, count: counts.get(d) ?? 0 });
  }
  const active = days.filter((d) => d.count > 0).length;

  return (
    <div className="panel-cream mt-3 rounded-2xl p-5">
      {active === 0 ? (
        <p className="text-sm text-muted-foreground">
          Comece a registrar seu progresso para ver sua constância aqui.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {active} dias com leitura registrada nos últimos 90 dias.
        </p>
      )}
      <div className="mt-4 grid grid-flow-col grid-rows-7 gap-1">
        {days.map((d) => {
          const opacity = d.count === 0 ? 0.08 : d.count === 1 ? 0.4 : d.count === 2 ? 0.7 : 1;
          return (
            <div
              key={d.key}
              title={`${new Date(`${d.key}T12:00:00`).toLocaleDateString("pt-BR")} · ${d.count} registro(s)`}
              className="h-3.5 w-3.5 rounded-[3px] bg-teal"
              style={{ opacity }}
            />
          );
        })}
      </div>
    </div>
  );
}
