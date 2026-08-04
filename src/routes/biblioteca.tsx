import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LayoutGrid } from "lucide-react";
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
  const [view, setView] = useState<"biblioteca" | "desejos" | "abandonados">("biblioteca");
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
    abandonado: all?.filter((b) => b.status === "abandonado").length ?? 0,
  };

  const libraryTotal = (all?.length ?? 0) - counts.desejo_compra;
  const libraryData = all?.filter((b) => b.status === tab);
  const wishlistData = all?.filter((b) => b.status === "desejo_compra");
  const abandonedData = all?.filter((b) => b.status === "abandonado");

  return (
    <section>
     <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
       <h1 className="font-display text-4xl leading-tight">
          {view === "biblioteca" ? "Minha Biblioteca" : view === "desejos" ? "Quero comprar" : "Abandonados"}
        </h1>
        {view === "biblioteca" ? (
          <button
            onClick={() => setShowAllGrouped(true)}
            className={
              "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
              (showAllGrouped
                ? "border-primary bg-primary/15 text-primary"
                : "border-primary/30 text-primary hover:bg-primary/10")
            }
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Ver tudo ({libraryTotal})
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
        <button
          onClick={() => setView("abandonados")}
          className={
            "flex-1 rounded-full py-2 text-xs transition-colors sm:text-sm " +
            (view === "abandonados"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Abandonados ({counts.abandonado})
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

      {view === "abandonados" && (
        <div className="mt-6 space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {abandonedData?.map((ub) => (
            <div key={ub.id} className="panel-cream rounded-2xl p-4">
              <p className="font-display text-lg">{ub.book?.title}</p>
              <p className="text-sm text-muted-foreground">{ub.book?.author ?? "Autor desconhecido"}</p>
              {ub.abandon_reason && (
                <p className="mt-2 text-sm">
                  <strong>Por quê?</strong> {ub.abandon_reason}
                </p>
              )}
            </div>
          ))}
          {abandonedData?.length === 0 && !isLoading && (
            <p className="panel-cream rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Nenhum livro abandonado por aqui.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
