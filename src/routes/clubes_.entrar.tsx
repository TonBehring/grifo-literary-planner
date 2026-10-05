// src/routes/clubes_.entrar.tsx
//
// IMPORTANTE: mesma convenção do "_" depois de "clubes" — ver o comentário
// em clubes_.novo.tsx. Garante que /clubes/entrar não fique aninhada
// (e invisível) dentro de clubes.tsx.

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { joinClubByCode, listMyClubs } from "@/lib/api";
import { getMySubscription, hasActiveAccess } from "@/lib/subscription";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/clubes_/entrar")({
  component: () => (
    <AppShell>
      <EntrarClube />
    </AppShell>
  ),
});

function EntrarClube() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState("");
  const [entrando, setEntrando] = useState(false);

  const subscription = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: getMySubscription,
    enabled: Boolean(user),
  });
  const meusClubes = useQuery({
    queryKey: ["my-clubs", user?.id],
    queryFn: () => listMyClubs(user!.id),
    enabled: Boolean(user),
  });
  const limiteAtingido =
    !hasActiveAccess(subscription.data) && (meusClubes.data?.length ?? 0) >= 1;

  async function entrar() {
    if (!codigo.trim()) {
      toast.error("Digite o código do convite.");
      return;
    }
    setEntrando(true);
    try {
      await joinClubByCode(codigo);
      toast.success("Você entrou no clube!");
      navigate({ to: "/clubes" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Código inválido ou expirado");
    } finally {
      setEntrando(false);
    }
  }

  return (
    <section className="flex min-h-[70vh] flex-col">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Entrar em um clube</h1>
        <button
          onClick={() => navigate({ to: "/clubes" })}
          aria-label="Fechar"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {limiteAtingido ? (
        <div className="panel-cream mt-8 rounded-2xl p-6 text-center">
          <p className="font-display text-lg">Você já participa de 1 clube</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Sem assinatura ativa, dá pra participar de até 1 Clube de Leitura por vez. Assine o
            Grifo pra entrar em quantos clubes quiser.
          </p>
          <Link
            to="/conta"
            className="mt-4 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Assinar o Grifo
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-col items-center text-center">
            <p className="text-sm text-muted-foreground">
              Peça o código de convite para quem administra o clube.
            </p>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="CÓDIGO"
              maxLength={8}
              className="mt-4 w-48 rounded-xl border border-border px-3 py-3 text-center text-lg font-medium tracking-[0.3em] outline-none focus:border-primary"
            />
          </div>

          <div className="mt-auto pt-10">
            <button
              onClick={entrar}
              disabled={entrando}
              className="w-full rounded-full bg-primary py-4 text-base font-medium text-primary-foreground disabled:opacity-60"
            >
              {entrando ? "Entrando…" : "Entrar"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
