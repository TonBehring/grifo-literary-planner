import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { BookCard } from "@/components/BookCard";
import { listUserBooks } from "@/lib/api";
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

function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["user_books", "lendo"],
    queryFn: () => listUserBooks("lendo"),
    enabled: Boolean(user),
  });

  return (
    <section>
      <p className="text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        Sua estante viva
      </p>
      <h1 className="font-display mt-2 text-4xl leading-tight">Lendo Agora</h1>

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
