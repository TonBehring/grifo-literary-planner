import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { BookCard } from "@/components/BookCard";
import { listUserBooks } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/desejos")({
  head: () => ({
    meta: [
      { title: "Quero comprar — Grifo" },
      {
        name: "description",
        content: "Sua lista de desejos de livros para comprar.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <WishlistPage />
    </AppShell>
  ),
});

function WishlistPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["user_books", "desejo_compra"],
    queryFn: () => listUserBooks("desejo_compra"),
    enabled: Boolean(user),
  });

  return (
    <section>
      <h1 className="font-display text-4xl leading-tight">Quero comprar</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Livros que você ainda não tem, mas quer colocar na sua estante.
      </p>

      <div className="mt-6 space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {data?.map((ub) => <BookCard key={ub.id} userBook={ub} />)}
        {data?.length === 0 && !isLoading && (
          <p className="panel-cream rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Nenhum livro na sua lista de desejos ainda.
          </p>
        )}
      </div>
    </section>
  );
}
