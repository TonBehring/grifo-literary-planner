import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
    </section>
  );
}
