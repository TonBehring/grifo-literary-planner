import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Painel administrativo — Grifo" }],
  }),
  component: () => (
    <AppShell>
      <AdminPage />
    </AppShell>
  ),
});

type Indicador = { indicador: string; valor: string };

async function fetchIndicadores(): Promise<Indicador[]> {
  const { data, error } = await supabase.rpc("admin_indicadores");
  if (error) throw new Error(error.message);
  return (data ?? []) as Indicador[];
}

function AdminPage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-indicadores"],
    queryFn: fetchIndicadores,
    enabled: Boolean(user),
    retry: false,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (isError) {
    return (
      <section>
        <h1 className="font-display text-4xl leading-tight">Página não encontrada</h1>
      </section>
    );
  }

  return (
    <section className="pb-6">
      <h1 className="font-display text-4xl leading-tight">Painel administrativo</h1>
      <p className="mt-2 text-sm text-muted-foreground">Indicadores gerais do Grifo.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(data ?? []).map((item) => (
          <div key={item.indicador} className="panel-cream rounded-2xl p-4">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {item.indicador}
            </p>
            <p className="font-display mt-2 text-2xl leading-snug">{item.valor}</p>
          </div>
        ))}
      </div>

      <GrantAccessForm />
    </section>
  );
}

function GrantAccessForm() {
  const [email, setEmail] = useState("");
  const [granting, setGranting] = useState(false);

  async function grant() {
    if (!email.trim()) return;
    setGranting(true);
    try {
      const { error } = await supabase.rpc("grant_cortesia_subscription", {
        target_email: email.trim(),
      });
      if (error) throw new Error(error.message);
      toast.success(`Acesso de cortesia concedido para ${email.trim()}`);
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível conceder acesso");
    } finally {
      setGranting(false);
    }
  }

  return (
    <div className="panel-cream mt-6 rounded-2xl p-5">
      <h2 className="font-display text-xl">Conceder acesso gratuito</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Dá 12 meses de acesso de cortesia para um e-mail já cadastrado no Grifo.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@exemplo.com"
          className="flex-1 rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={grant}
          disabled={granting}
          className="rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {granting ? "..." : "Conceder"}
        </button>
      </div>
    </div>
  );
}
