// --- Lista de espera (cadastros da landing page via Brevo) --------------
//
// Onde colar no admin.tsx:
// 1) Este bloco inteiro vai no final do arquivo (mesmo nível das outras
//    seções como FoundersSection, SupabaseUsageSection etc.).
// 2) Dentro do componente AdminPage, logo abaixo de <SupabaseUsageSection />,
//    adiciona a linha: <WaitlistSection />

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
