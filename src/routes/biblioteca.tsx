import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BookCard } from "@/components/BookCard";
import { listUserBooks } from "@/lib/api";
import { STATUS_LABEL, type ShelfStatus, type UserBook } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/biblioteca")({
  head: () => ({
    meta: [
      { title: "Minha Biblioteca — Grifo" },
      {
        name: "description",
        content: "Organize seus livros entre Lendo, Quero Ler e Lidos, ou veja sua lista de desejos de compra.",
      },
      { property: "og:title", content: "Minha Biblioteca — Grifo" },
      {
        property: "og:description",
        content: "Todas as suas leituras organizadas em três estantes.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <LibraryPage />
    </AppShell>
  ),
});

const TABS: ShelfStatus[] = ["lendo", "quero_ler", "lido"];

function ShelfGroup({ status, books }: { status: ShelfStatus; books: UserBook[] }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg text-muted-foreground">
        {STATUS_LABEL[status]} ({books.length})
      </h2>
      {books.length === 0 && (
        <p className="panel-cream rounded-2xl p-6 text-center text-sm text-muted-foreground">
          Nenhum livro nessa estante ainda.
        </p>
      )}
      {books.map((ub) => (
        <BookCard key={ub.id} userBook={ub} />
      ))}
    </div>
  );
}

function LibraryPage() {
  const [view, setView] = useState<"biblioteca" | "desejos">("biblioteca");
  const [tab, setTab] = useState<ShelfStatus>("lendo");
  const [showAllGrouped, setShowAllGrouped] = useState(false);
  const { user } = useAuth();
  const { data: all, isLoading } = useQuery({
    queryKey: ["user_books", "all"],
    queryFn: () => listUserBooks(),
    enabled: Boolean(user),
  });

  const counts: Record<ShelfStatus, number> = {
    lendo: all?.filter((b) => b.status === "lendo").length ?? 0,
    quero_ler: all?.filter((b) => b.status === "quero_ler").length ?? 0,
    lido: all?.filter((b) => b.status === "lido").length ?? 0,
    desejo_compra: all?.filter((b) => b.status === "desejo_compra").length ?? 0,
  };

  const libraryTotal = (all?.length ?? 0) - counts.desejo_compra;
  const libraryData = all?.filter((b) => b.status === tab);
  const wishlistData = all?.filter((b) => b.status === "desejo_compra");

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-4xl leading-tight">
          {view === "biblioteca" ? "Minha Biblioteca" : "Quero comprar"}
        </h1>
        {view === "biblioteca" ? (
          <button
            onClick={() => setShowAllGrouped(true)}
            className="text-sm text-primary underline underline-offset-4"
          >
            {libraryTotal} livros no total
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">{counts.desejo_compra} livros</p>
        )}
      </div>

      <div className="mt-5 flex gap-2 rounded-full border border-primary/30 p-1 text-sm">
        <button
          onClick={() => setView("biblioteca")}
          className={
            "flex-1 rounded-full py-2 transition-colors " +
            (view === "biblioteca"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Minha Biblioteca
        </button>
        <button
          onClick={() => setView("desejos")}
          className={
            "flex-1 rounded-full py-2 transition-colors " +
            (view === "desejos"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Quero comprar ({counts.desejo_compra})
        </button>
      </div>

      {view === "biblioteca" && (
        <>
          <div className="mt-4 flex gap-2 rounded-full border border-border bg-secondary/60 p-1 text-sm">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setShowAllGrouped(false);
                }}
                className={
                  "flex-1 rounded-full py-2 transition-colors " +
                  (!showAllGrouped && tab === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {STATUS_LABEL[t]} ({counts[t]})
              </button>
            ))}
          </div>

          {isLoading && <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>}

          {!isLoading && showAllGrouped && (
            <div className="mt-6 space-y-8">
              {TABS.map((t) => (
                <ShelfGroup key={t} status={t} books={all?.filter((b) => b.status === t) ?? []} />
              ))}
            </div>
          )}

          {!isLoading && !showAllGrouped && (
            <div className="mt-6 space-y-4">
              {libraryData?.map((ub) => <BookCard key={ub.id} userBook={ub} />)}
              {libraryData?.length === 0 && (
                <p className="panel-cream rounded-2xl p-8 text-center text-sm text-muted-foreground">
                  Nenhum livro nessa estante ainda.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {view === "desejos" && (
        <div className="mt-6 space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {wishlistData?.map((ub) => <BookCard key={ub.id} userBook={ub} />)}
          {wishlistData?.length === 0 && !isLoading && (
            <p className="panel-cream rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Nenhum livro na sua lista de desejos ainda.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
