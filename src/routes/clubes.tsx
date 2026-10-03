// src/routes/clubes.tsx
//
// Tela de listagem dos clubes de leitura do usuário — ponto de entrada do
// recurso. As ações de criar e entrar por código ficam em telas próprias
// (clubes_.novo.tsx e clubes_.entrar.tsx) para manter esta tela simples.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, KeyRound, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import { listMyClubs } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/clubes")({
  component: () => (
    <AppShell>
      <ClubesPage />
    </AppShell>
  ),
});

function ClubesPage() {
  const { user } = useAuth();

  const { data: clubs, isLoading } = useQuery({
    queryKey: ["my-clubs", user?.id],
    queryFn: () => listMyClubs(user!.id),
    enabled: Boolean(user),
  });

  return (
    <section>
      <h1 className="font-display text-2xl">Clubes de leitura</h1>

      <div className="mt-4 flex gap-2">
        <Link
          to="/clubes/novo"
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Criar clube
        </Link>
        <Link
          to="/clubes/entrar"
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium text-foreground"
        >
          <KeyRound className="h-4 w-4" />
          Entrar com código
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

        {!isLoading && clubs && clubs.length === 0 && (
          <div className="panel-cream rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Você ainda não participa de nenhum clube. Crie o seu ou entre com um código de
              convite.
            </p>
          </div>
        )}

        {clubs?.map((club) => (
          <div key={club.id} className="panel-cream flex items-center gap-3 rounded-2xl p-4">
            <div className="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
              {club.livro_atual_capa ? (
                <BookCover src={club.livro_atual_capa} title={club.livro_atual_titulo} />
              ) : (
                <Users className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display truncate text-base">{club.nome}</p>
              <p className="truncate text-xs text-muted-foreground">
                {club.livro_atual_titulo ? `Lendo: ${club.livro_atual_titulo}` : "Sem livro atual"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {club.membros_count} {club.membros_count === 1 ? "membro" : "membros"}
                {club.meu_papel === "admin" ? " · você é admin" : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
