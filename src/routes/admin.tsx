import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel administrativo — Grifo" },
      { name: "description", content: "Indicadores e gestão administrativa do Grifo." },
      { property: "og:title", content: "Painel administrativo — Grifo" },
      { property: "og:description", content: "Indicadores e gestão administrativa do Grifo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <AdminPage />
    </AppShell>
  ),
});

type Indicador = { indicador: string; valor: string };

async function fetchIndicadores(inicio: string, fim: string): Promise<Indicador[]> {
  const { data, error } = await supabase.rpc("admin_indicadores", {
    p_inicio: inicio || null,
    p_fim: fim || null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as Indicador[];
}

function AdminPage() {
  const { user } = useAuth();
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-indicadores", inicio, fim],
    queryFn: () => fetchIndicadores(inicio, fim),
    enabled: Boolean(user),
    retry: false,
  });

  const temFiltro = Boolean(inicio || fim);

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

      <div className="panel-cream mt-4 flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">De</label>
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Até</label>
          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        {temFiltro && (
          <button
            onClick={() => {
              setInicio("");
              setFim("");
            }}
            className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground"
          >
            Limpar período
          </button>
        )}
        {temFiltro && (
          <p className="w-full text-xs text-muted-foreground">
            "Usuários ativos (30 dias)" e "Usuários com username definido" sempre mostram o estado atual,
            independente do período escolhido.
          </p>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(data ?? []).map((item) => (
          <div key={item.indicador} className="panel-cream rounded-2xl p-4">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{item.indicador}</p>
            <p className="font-display mt-2 text-2xl leading-snug">{item.valor}</p>
          </div>
        ))}
      </div>

      <FoundersSection />
      <SupabaseUsageSection />
      <WaitlistSection />
      <GrantAccessForm />
      <BroadcastPushForm />
      <PnlSection />
    </section>
  );
}

// --- Campanha de Fundadores (250 primeiros a assinar) -------------------

const FOUNDER_SLOTS = 250;

type Fundador = {
  founder_number: number;
  apelido: string | null;
  email: string;
  discount_applied: boolean;
  discount_error: string | null;
  created_at: string;
};

async function fetchFundadores(): Promise<Fundador[]> {
  const { data, error } = await supabase.rpc("admin_fundadores");
  if (error) throw new Error(error.message);
  return (data ?? []) as Fundador[];
}

function FoundersSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-fundadores"],
    queryFn: fetchFundadores,
    retry: false,
  });

  if (isLoading || isError) return null;

  const fundadores = data ?? [];
  const comErro = fundadores.filter((f) => f.discount_error);
  const restantes = Math.max(0, FOUNDER_SLOTS - fundadores.length);

  return (
    <div className="panel-cream mt-6 rounded-2xl p-5">
      <h2 className="font-display text-xl">Campanha de Fundadores</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {fundadores.length} de {FOUNDER_SLOTS} vagas preenchidas — {restantes} restantes.
      </p>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, (fundadores.length / FOUNDER_SLOTS) * 100)}%` }}
        />
      </div>

      {comErro.length > 0 && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">
            {comErro.length} fundador(es) com o desconto ainda não aplicado na Asaas — corrija manualmente no painel da
            Asaas (Assinaturas → aplicar 20% de desconto vitalício):
          </p>
          <ul className="mt-2 space-y-2 text-xs">
            {comErro.map((f) => (
              <li key={f.founder_number} className="rounded-lg bg-white/40 p-2">
                <strong>#{f.founder_number}</strong> — {f.apelido ?? f.email} ({f.email})
                <br />
                <span className="text-muted-foreground">{f.discount_error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
        <div className={"h-full rounded-full transition-all " + barColor(pct)} style={{ width: `${pct * 100}%` }} />
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
        <UsageBar label="Banco de dados" used={data.db_size_bytes} limit={DB_LIMIT_BYTES} formatUsed={formatBytes} />
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
          <strong>Hora de considerar o plano Pro ($25/mês).</strong> Pelo menos um dos limites do plano gratuito já
          passou de {Math.round(SAFETY_THRESHOLD * 100)}% de uso — vale migrar antes de bater no teto e o projeto ser
          pausado ou travar novos cadastros/uploads.
        </div>
      )}
    </div>
  );
}

// --- Lista de espera (cadastros da landing page via Brevo) --------------

type ListaEsperaPorOrigem = { origem: string; total: number };
type ListaEsperaPorDia = { dia: string; total: number };

async function fetchListaEsperaTotal(): Promise<number> {
  const { data, error } = await supabase.rpc("admin_lista_espera_total");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

async function fetchListaEsperaPorOrigem(): Promise<ListaEsperaPorOrigem[]> {
  const { data, error } = await supabase.rpc("admin_lista_espera_por_origem");
  if (error) throw new Error(error.message);
  return (data ?? []) as ListaEsperaPorOrigem[];
}

async function fetchListaEsperaPorDia(): Promise<ListaEsperaPorDia[]> {
  const { data, error } = await supabase.rpc("admin_lista_espera_por_dia");
  if (error) throw new Error(error.message);
  return (data ?? []) as ListaEsperaPorDia[];
}

function WaitlistSection() {
  const total = useQuery({
    queryKey: ["admin-lista-espera-total"],
    queryFn: fetchListaEsperaTotal,
    retry: false,
  });
  const porOrigem = useQuery({
    queryKey: ["admin-lista-espera-origem"],
    queryFn: fetchListaEsperaPorOrigem,
    retry: false,
  });
  const porDia = useQuery({
    queryKey: ["admin-lista-espera-dia"],
    queryFn: fetchListaEsperaPorDia,
    retry: false,
  });

  if (total.isLoading || porOrigem.isLoading || porDia.isLoading) return null;
  if (total.isError || porOrigem.isError || porDia.isError) return null;

  const origens = porOrigem.data ?? [];
  const dias = porDia.data ?? [];
  const maxDia = Math.max(1, ...dias.map((d) => d.total));

  return (
    <div className="panel-cream mt-6 rounded-2xl p-5">
      <h2 className="font-display text-xl">Lista de espera</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cadastros na landing page, sincronizados automaticamente do Brevo.
      </p>

      <p className="font-display mt-4 text-3xl leading-none">{total.data ?? 0}</p>
      <p className="text-xs text-muted-foreground">cadastros no total</p>

      {origens.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Por origem</p>
          {origens.map((o) => (
            <div key={o.origem} className="flex items-center justify-between text-sm">
              <span className="truncate pr-3">{o.origem}</span>
              <span className="font-medium">{o.total}</span>
            </div>
          ))}
        </div>
      )}

      {dias.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Cadastros por dia (últimos 30 dias)
          </p>
          <div className="mt-2 flex h-20 items-end gap-[2px]">
            {dias.map((d) => (
              <div
                key={d.dia}
                title={`${d.dia}: ${d.total}`}
                className="flex-1 rounded-t bg-primary/70"
                style={{ height: `${Math.max(2, (d.total / maxDia) * 100)}%` }}
              />
            ))}
          </div>
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

// --- Enviar push para todos os usuários ---------------------------------

function BroadcastPushForm() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("push-broadcast", {
        body: { title: title.trim(), body: message.trim() },
      });
      if (error) throw new Error(error.message);
      const { total, sent, removed } = data as { total: number; sent: number; removed: number };
      setResult(
        `Enviado para ${sent} de ${total} inscrições` +
          (removed > 0 ? ` (${removed} inscrição(ões) expirada(s) removida(s))` : ""),
      );
      setTitle("");
      setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="panel-cream mt-6 rounded-2xl p-5">
      <h2 className="font-display text-xl">Enviar notificação para todos</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Manda um push (e registra no histórico) para todos os usuários com notificações ativadas.
      </p>
      <div className="mt-3 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          maxLength={80}
          className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Mensagem"
          rows={3}
          maxLength={200}
          className="w-full resize-none rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
        />
      </div>
      <button
        onClick={send}
        disabled={sending || !title.trim() || !message.trim()}
        className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {sending ? "Enviando…" : "Enviar para todos"}
      </button>
      {result && <p className="mt-3 text-sm text-muted-foreground">{result}</p>}
    </div>
  );
}

// --- P&L (lançamentos manuais de receita e custo) ------------------------

type PnlResumo = { total_receita: number; total_custo: number; lucro: number };
type PnlPorCategoria = { tipo: "receita" | "custo"; categoria: string; total: number };
type PnlPorMes = { mes: string; receita: number; custo: number };
type PnlLancamento = {
  id: string;
  tipo: "receita" | "custo";
  categoria: string;
  descricao: string | null;
  valor: number;
  mes_referencia: string;
  criado_em: string;
};

const CATEGORIAS_SUGERIDAS = [
  "Assinaturas",
  "Supabase",
  "Brevo",
  "Asaas (taxas)",
  "Resend",
  "Domínio",
  "Anthropic / IA",
  "Marketing",
  "Outros",
];

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMes(mesISO: string): string {
  const [ano, mes] = mesISO.split("-");
  const nomes = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  return `${nomes[Number(mes) - 1]}/${ano?.slice(2) ?? ""}`;
}

async function fetchPnlResumo(): Promise<PnlResumo> {
  const { data, error } = await supabase.rpc("admin_pnl_resumo");
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as PnlResumo;
  return row ?? { total_receita: 0, total_custo: 0, lucro: 0 };
}

async function fetchPnlPorCategoria(): Promise<PnlPorCategoria[]> {
  const { data, error } = await supabase.rpc("admin_pnl_por_categoria");
  if (error) throw new Error(error.message);
  return (data ?? []) as PnlPorCategoria[];
}

async function fetchPnlPorMes(): Promise<PnlPorMes[]> {
  const { data, error } = await supabase.rpc("admin_pnl_por_mes");
  if (error) throw new Error(error.message);
  return (data ?? []) as PnlPorMes[];
}

async function fetchPnlLista(): Promise<PnlLancamento[]> {
  const { data, error } = await supabase.rpc("admin_pnl_lista");
  if (error) throw new Error(error.message);
  return (data ?? []) as PnlLancamento[];
}

function PnlSection() {
  const queryClient = useQueryClient();

  const resumo = useQuery({ queryKey: ["admin-pnl-resumo"], queryFn: fetchPnlResumo, retry: false });
  const porCategoria = useQuery({
    queryKey: ["admin-pnl-categoria"],
    queryFn: fetchPnlPorCategoria,
    retry: false,
  });
  const porMes = useQuery({ queryKey: ["admin-pnl-mes"], queryFn: fetchPnlPorMes, retry: false });
  const lista = useQuery({ queryKey: ["admin-pnl-lista"], queryFn: fetchPnlLista, retry: false });

  const [tipo, setTipo] = useState<"receita" | "custo">("receita");
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("");
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7)); // "YYYY-MM"
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["admin-pnl-resumo"] });
    queryClient.invalidateQueries({ queryKey: ["admin-pnl-categoria"] });
    queryClient.invalidateQueries({ queryKey: ["admin-pnl-mes"] });
    queryClient.invalidateQueries({ queryKey: ["admin-pnl-lista"] });
  }

  async function lancar() {
    const valorNum = Number(valor.replace(",", "."));
    if (!categoria.trim() || !valorNum || valorNum <= 0 || !mes) return;
    setSalvando(true);
    try {
      const { error } = await supabase.rpc("admin_pnl_lancar", {
        p_tipo: tipo,
        p_categoria: categoria.trim(),
        p_valor: valorNum,
        p_mes_referencia: `${mes}-01`,
        p_descricao: descricao.trim() || null,
      });
      if (error) throw new Error(error.message);
      toast.success("Lançamento registrado.");
      setCategoria("");
      setValor("");
      setDescricao("");
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível lançar");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    try {
      const { error } = await supabase.rpc("admin_pnl_excluir", { p_id: id });
      if (error) throw new Error(error.message);
      toast.success("Lançamento removido.");
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível remover");
    }
  }

  const meses = porMes.data ?? [];
  const maxValor = Math.max(1, ...meses.flatMap((m) => [m.receita, m.custo]));
  const receitas = (porCategoria.data ?? []).filter((c) => c.tipo === "receita");
  const custos = (porCategoria.data ?? []).filter((c) => c.tipo === "custo");

  return (
    <div className="panel-cream mt-6 rounded-2xl p-5">
      <h2 className="font-display text-xl">P&L do Grifo</h2>
      <p className="mt-1 text-sm text-muted-foreground">Lançamentos manuais de receita e custo, por mês.</p>

      {!resumo.isLoading && !resumo.isError && resumo.data && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Receita</p>
            <p className="font-display mt-1 text-xl">{formatBRL(resumo.data.total_receita)}</p>
          </div>
          <div className="rounded-xl bg-destructive/10 p-3">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Custo</p>
            <p className="font-display mt-1 text-xl">{formatBRL(resumo.data.total_custo)}</p>
          </div>
          <div className="rounded-xl bg-border p-3">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Lucro</p>
            <p className="font-display mt-1 text-xl">{formatBRL(resumo.data.lucro)}</p>
          </div>
        </div>
      )}

      {meses.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Receita x custo por mês</p>
          <div className="mt-2 flex h-24 items-end gap-3 overflow-x-auto pb-1">
            {meses.map((m) => (
              <div key={m.mes} className="flex flex-col items-center gap-1">
                <div className="flex h-20 items-end gap-[2px]">
                  <div
                    title={`Receita: ${formatBRL(m.receita)}`}
                    className="w-3 rounded-t bg-primary/70"
                    style={{ height: `${Math.max(2, (m.receita / maxValor) * 100)}%` }}
                  />
                  <div
                    title={`Custo: ${formatBRL(m.custo)}`}
                    className="w-3 rounded-t bg-destructive/60"
                    style={{ height: `${Math.max(2, (m.custo / maxValor) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{formatMes(m.mes.slice(0, 7))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(receitas.length > 0 || custos.length > 0) && (
        <div className="mt-5 grid grid-cols-2 gap-4">
          {receitas.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Receita por categoria</p>
              {receitas.map((c) => (
                <div key={c.categoria} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{c.categoria}</span>
                  <span className="font-medium">{formatBRL(c.total)}</span>
                </div>
              ))}
            </div>
          )}
          {custos.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Custo por categoria</p>
              {custos.map((c) => (
                <div key={c.categoria} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{c.categoria}</span>
                  <span className="font-medium">{formatBRL(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 border-t border-border pt-4">
        <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Novo lançamento</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "receita" | "custo")}
            className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="receita">Receita</option>
            <option value="custo">Custo</option>
          </select>
          <input
            list="categorias-pnl"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Categoria"
            className="min-w-0 flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <datalist id="categorias-pnl">
            {CATEGORIAS_SUGERIDAS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Valor (R$)"
            inputMode="decimal"
            className="w-28 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descrição (opcional)"
          className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={lancar}
          disabled={salvando || !categoria.trim() || !valor.trim()}
          className="mt-2 w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {salvando ? "Lançando…" : "Lançar"}
        </button>
      </div>

      {lista.data && lista.data.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Lançamentos recentes</p>
          <div className="mt-2 max-h-80 space-y-2 overflow-y-auto">
            {lista.data.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-white/40 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate">
                    <span className={l.tipo === "receita" ? "text-primary" : "text-destructive"}>
                      {l.tipo === "receita" ? "+" : "-"}
                      {formatBRL(l.valor)}
                    </span>{" "}
                    — {l.categoria} ({formatMes(l.mes_referencia.slice(0, 7))})
                  </p>
                  {l.descricao && <p className="truncate text-xs text-muted-foreground">{l.descricao}</p>}
                </div>
                <button
                  onClick={() => excluir(l.id)}
                  className="shrink-0 text-xs text-muted-foreground underline underline-offset-4"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
