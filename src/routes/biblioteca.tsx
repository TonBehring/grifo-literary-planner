import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BookCard } from "@/components/BookCard";
import { listUserBooks } from "@/lib/api";
import { STATUS_LABEL, type ShelfStatus } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/biblioteca")({
  head: () => ({
    meta: [
      { title: "Minha Biblioteca — Grifo" },
      {
        name: "description",
        content: "Organize seus livros entre Lendo, Quero Ler e Lidos na sua biblioteca do Grifo.",
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

function LibraryPage() {
  const [tab, setTab] = useState<ShelfStatus>("lendo");
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
  };

  const data = all?.filter((b) => b.status === tab);

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-4xl leading-tight">Minha Biblioteca</h1>
        <p className="text-sm text-muted-foreground">{all?.length ?? 0} livros no total</p>
      </div>

      <div className="mt-6 flex gap-2 rounded-full border border-border bg-secondary/60 p-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "flex-1 rounded-full py-2 transition-colors " +
              (tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {STATUS_LABEL[t]} ({counts[t]})
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {data?.map((ub) => <BookCard key={ub.id} userBook={ub} />)}
        {data?.length === 0 && !isLoading && (
          <p className="panel-cream rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Nenhum livro nessa estante ainda.
          </p>
        )}
      </div>
    </section>
  );
}
