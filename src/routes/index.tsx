import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { BookCard } from "@/components/BookCard";
import { listUserBooks } from "@/lib/api";
import { getMyUsername } from "@/lib/contatos";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grifo — Lendo Agora" },
      {
        name: "description",
        content:
          "Acompanhe o progresso dos livros que você está lendo, por páginas ou porcentagem.",
      },
      { property: "og:title", content: "Grifo — Lendo Agora" },
      {
        property: "og:description",
        content: "Seu painel de leituras em andamento, com progresso e humor do dia.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

function saudacaoPorHorario(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function Dashboard() {
  const { user } = useAuth();

  const { data: username } = useQuery({
    queryKey: ["my-username", user?.id],
    queryFn: () => getMyUsername(user!.id),
    enabled: Boolean(user),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["user_books", "lendo"],
    queryFn: () => listUserBooks("lendo"),
    enabled: Boolean(user),
  });

  const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim();
  const displayName = username ? `@${username}` : fullName;

  return (
    <section>
      {displayName && (
        <p className="font-display text-2xl leading-snug">
          {saudacaoPorHorario()}, {displayName} — o que vamos ler hoje?
        </p>
      )}

      <p className="mt-4 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        Sua estante viva
      </p>
      <h1 className="font-display mt-2 text-4xl leading-tight">Lendo Agora</h1>

      <Link
        to="/desafio-literario"
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Desafio Literário
      </Link>

      <div className="mt-7 space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando leituras…</p>}
        {error && (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Erro ao carregar"}
          </p>
        )}
        {data?.map((ub) => <BookCard key={ub.id} userBook={ub} />)}
        {data?.length === 0 && (
          <div className="panel-cream rounded-2xl p-8 text-center">
            <p className="font-display text-xl">Nenhuma leitura em andamento</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Comece adicionando o livro que está na sua mesa de cabeceira.
            </p>
            <Link
              to="/adicionar"
              className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Adicionar livro
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
