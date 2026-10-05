// src/routes/clubes_.descobrir.tsx
//
// IMPORTANTE: o nome do arquivo tem um "_" logo depois de "clubes"
// (clubes_.descobrir.tsx, não clubes.descobrir.tsx) — mesma convenção
// usada em clubes_.novo.tsx e clubes_.entrar.tsx, pra essa tela não ficar
// aninhada (e invisível) dentro de clubes.tsx, que não tem <Outlet />.
//
// Lista os clubes marcados como "público" que a pessoa ainda não
// participa, com botão de entrar direto (sem precisar de código).

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import { listPublicClubs, joinPublicClub } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/clubes/descobrir")({
  component: () => (
    <AppShell>
      <DescobrirClubes />
    </AppShell>
  ),
});

function DescobrirClubes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const clubes = useQuery({
    queryKey: ["public-clubs"],
    queryFn: () => listPublicClubs(),
    enabled: Boolean(user),
  });

  const [entrandoEm, setEntrandoEm] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  async function entrar(clubId: string) {
    if (!user) return;
    setEntrandoEm(clubId);
    try {
      await joinPublicClub(clubId, user.id);
      toast.success("Você entrou no clube!");
      void queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
      void queryClient.invalidateQueries({ queryKey: ["public-clubs"] });
      navigate({ to: "/clubes/$clubId", params: { clubId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível entrar no clube");
    } finally {
      setEntrandoEm(null);
    }
  }

  const termo = busca.trim().toLowerCase();
  const disponiveis = (clubes.data ?? [])
    .filter((c) => !c.ja_sou_membro)
    .filter((c) => !termo || c.nome.toLowerCase().includes(termo));

  return (
    <section>
      <div className="flex items-center gap-2">
        <Link
          to="/clubes"
          aria-label="Voltar"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-xl">Descobrir clubes públicos</h1>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-border px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar clube pelo nome"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {clubes.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

        {!clubes.isLoading && disponiveis.length === 0 && (
          <div className="panel-cream rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {termo
                ? "Nenhum clube público encontrado com esse nome."
                : "Nenhum clube público disponível no momento."}
            </p>
          </div>
        )}

        {disponiveis.map((club) => (
          <div key={club.id} className="panel-cream rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {club.imagem_url ? (
                  <img src={club.imagem_url} alt="" className="h-full w-full object-cover" />
                ) : club.livro_atual_capa ? (
                  <BookCover src={club.livro_atual_capa} title={club.livro_atual_titulo} />
                ) : (
                  <Users className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display truncate text-base">{club.nome}</p>
                {club.descricao && (
                  <p className="truncate text-xs text-muted-foreground">{club.descricao}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {club.membros_count} {club.membros_count === 1 ? "membro" : "membros"}
                  {club.livro_atual_titulo ? ` · Lendo: ${club.livro_atual_titulo}` : ""}
                </p>
              </div>
              <button
                onClick={() => entrar(club.id)}
                disabled={entrandoEm === club.id}
                className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                {entrandoEm === club.id ? "Entrando…" : "Entrar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
