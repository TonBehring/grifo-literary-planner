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

      <SupabaseUsageSection />
      <GrantAccessForm />
    </section>
  );
}

// --- Uso do Supabase x limites do plano gratuito -----------------------

type UsoSupabase = {
  db_size_bytes: number;
  storage_size_bytes: number;
  total_usuarios: number;
  usuarios_ativos_30d: number;
};

// Limites do plano gratuito do Supabase (ago/2026). Egress fica de fora
// de propósito: só dá pra ver no painel do Supabase (Project Settings →
// Usage), porque exige um token de acesso da conta inteira, não só deste
// projeto — não vale o risco de guardar isso como secret aqui.
const DB_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GB
const MAU_LIMIT = 50_000;

// A partir de quantos % de um limite mostramos o aviso de upgrade.
const SAFETY_THRESHOLD = 0.7;

async function fetchUsoSupabase(): Promise<UsoSupabase> {
  const { data, error } = await supabase.rpc("admin_uso_supabase");
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as UsoSupabase;
  return row;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function barColor(pct: number): string {
  if (pct >= 0.9) return "bg-destructive";
  if (pct >= SAFETY_THRESHOLD) return "bg-amber-500";
  return "bg-primary";
}

function UsageBar({
  label,
  used,
  limit,
  formatUsed,
}: {
  label: string;
  used: number;
  limit: number;
  formatUsed: (n: number) => string;
}) {
  const pct = Math.min(1, used / limit);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {formatUsed(used)} de {formatUsed(limit)} ({Math.round(pct * 100)}%)
        </span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={"h-full rounded-full transition-all " + barColor(pct)}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

function SupabaseUsageSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-uso-supabase"],
    queryFn: fetchUsoSupabase,
    retry: false,
  });

  if (isLoading || isError || !data) return null;

  const metrics = [
    { pct: data.db_size_bytes / DB_LIMIT_BYTES },
    { pct: data.storage_size_bytes / STORAGE_LIMIT_BYTES },
    { pct: data.usuarios_ativos_30d / MAU_LIMIT },
  ];
  const maxPct = Math.max(...metrics.map((m) => m.pct));
  const nearLimit = maxPct >= SAFETY_THRESHOLD;

  return (
    <div className="panel-cream mt-6 rounded-2xl p-5">
      <h2 className="font-display text-xl">Uso do Supabase (plano gratuito)</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Egress não entra aqui — confira em Project Settings → Usage no painel do Supabase.
      </p>

      <div className="mt-4 space-y-4">
        <UsageBar
          label="Banco de dados"
          used={data.db_size_bytes}
          limit={DB_LIMIT_BYTES}
          formatUsed={formatBytes}
        />
        <UsageBar
          label="Storage (capas)"
          used={data.storage_size_bytes}
          limit={STORAGE_LIMIT_BYTES}
          formatUsed={formatBytes}
        />
        <UsageBar
          label="Usuários ativos (30 dias)"
          used={data.usuarios_ativos_30d}
          limit={MAU_LIMIT}
          formatUsed={(n) => n.toLocaleString("pt-BR")}
        />
      </div>

      {nearLimit && (
        <div className="mt-4 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          <strong>Hora de considerar o plano Pro ($25/mês).</strong> Pelo menos um dos limites do
          plano gratuito já passou de {Math.round(SAFETY_THRESHOLD * 100)}% de uso — vale migrar
          antes de bater no teto e o projeto ser pausado ou travar novos cadastros/uploads.
        </div>
      )}
    </div>
  );
}

// --- Conceder acesso de cortesia ----------------------------------------

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
