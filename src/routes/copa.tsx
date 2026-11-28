import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import {
  configurarCopa,
  diaMes,
  formatPaginas,
  getCopa,
  iniciais,
  listarCopas,
  type CopaClube,
  type CopaDados,
  type CopaEscalacao,
  type CopaJogo,
  type CopaRodada,
} from "@/lib/copa";

// Copa dos clubes de torcida. Rota escondida: não aparece no menu e as
// funções do banco só respondem para admins. Para os outros, a página
// mostra "Página não encontrada", igual ao /admin.

export const Route = createFileRoute("/copa")({
  head: () => ({
    meta: [
      { title: "Copa dos Clubes — Grifo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AppShell>
      <CopaPage />
    </AppShell>
  ),
});

function CopaPage() {
  const { user } = useAuth();

  const lista = useQuery({
    queryKey: ["copa-lista"],
    queryFn: listarCopas,
    enabled: Boolean(user),
    retry: false,
  });

  const copaId = lista.data?.[0]?.id ?? null;

  const dados = useQuery({
    queryKey: ["copa-dados", copaId],
    queryFn: () => getCopa(copaId as string),
    enabled: Boolean(copaId),
    retry: false,
  });

  if (lista.isLoading || (copaId && dados.isLoading)) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (lista.isError || dados.isError || !copaId || !dados.data) {
    return (
      <section>
        <h1 className="font-display text-4xl leading-tight">Página não encontrada</h1>
      </section>
    );
  }

  return <CopaView dados={dados.data} />;
}

type Aba = "tabela" | "rodadas" | "regras";

function CopaView({ dados }: { dados: CopaDados }) {
  const { copa, rodadas } = dados;
  const [aba, setAba] = useState<Aba>("rodadas");

  const clubes = useMemo(() => {
    const m = new Map<string, CopaClube>();
    for (const c of dados.clubes) m.set(c.id, c);
    return m;
  }, [dados.clubes]);

  const rodadaAtual =
    rodadas.find((r) => r.status === "ao_vivo") ??
    [...rodadas].reverse().find((r) => r.status === "encerrada") ??
    rodadas[0];

  return (
    <section className="pb-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em]">
          Só admins veem esta página
        </span>
        {copa.modo === "demo" && (
          <span className="rounded-full border border-border px-2.5 py-1 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Demonstração com leitores fictícios
          </span>
        )}
      </div>

      <h1 className="font-display mt-3 text-4xl leading-tight">{copa.nome.replace(" (demonstração)", "")}</h1>
      {rodadaAtual && (
        <p className="mt-1 text-sm text-muted-foreground">
          Rodada {rodadaAtual.numero} de {rodadas.length}
          {rodadaAtual.status === "ao_vivo" ? " · ao vivo" : ""} · {copa.titulares} titulares por clube
        </p>
      )}

      <div className="panel-cream mt-4 rounded-2xl p-5">
        <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Juntas, as torcidas já leram</p>
        <p className="font-display mt-1 text-4xl leading-none">{formatPaginas(dados.total_paginas)}</p>
        <p className="mt-1 text-sm text-muted-foreground">páginas nesta Copa</p>
      </div>

      <Controles dados={dados} />

      <div className="mt-6 flex gap-2" role="tablist">
        {(
          [
            ["rodadas", "Rodadas"],
            ["tabela", "Tabela"],
            ["regras", "Como funciona"],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={aba === valor}
            onClick={() => setAba(valor)}
            className={
              "rounded-full border px-4 py-2 text-sm " +
              (aba === valor ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground")
            }
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "rodadas" && (
        <Rodadas rodadas={rodadas} clubes={clubes} inicial={rodadaAtual?.numero ?? 1} titulares={copa.titulares} />
      )}
      {aba === "tabela" && <Tabela dados={dados} />}
      {aba === "regras" && <Regras dados={dados} />}
    </section>
  );
}

// --- Controles ao vivo (titulares e data simulada) ---------------------------

function Controles({ dados }: { dados: CopaDados }) {
  const { copa } = dados;
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [data, setData] = useState(copa.data_referencia);

  useEffect(() => setData(copa.data_referencia), [copa.data_referencia]);

  async function salvar(titulares: number, dataRef: string | null) {
    setSalvando(true);
    try {
      await configurarCopa(copa.id, titulares, dataRef);
      await queryClient.invalidateQueries({ queryKey: ["copa-dados", copa.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  }

  const dataAtual = copa.modo === "demo" ? copa.data_referencia : null;

  return (
    <div className="panel-cream mt-4 rounded-2xl p-5">
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Titulares por clube</p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          aria-label="Menos titulares"
          disabled={salvando || copa.titulares <= 1}
          onClick={() => salvar(copa.titulares - 1, dataAtual)}
          className="h-10 w-10 rounded-full border border-border text-lg disabled:opacity-40"
        >
          −
        </button>
        <span className="font-display w-10 text-center text-3xl">{copa.titulares}</span>
        <button
          type="button"
          aria-label="Mais titulares"
          disabled={salvando || copa.titulares >= 30}
          onClick={() => salvar(copa.titulares + 1, dataAtual)}
          className="h-10 w-10 rounded-full border border-border text-lg disabled:opacity-40"
        >
          +
        </button>
        <div className="ml-1 flex gap-2">
          {[5, 11].map((n) => (
            <button
              key={n}
              type="button"
              disabled={salvando || copa.titulares === n}
              onClick={() => salvar(n, dataAtual)}
              className="whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground disabled:border-primary disabled:bg-primary/15 disabled:text-foreground"
            >
              {n === 5 ? "Futsal (5)" : "Campo (11)"}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Mude aqui e todos os placares e a tabela são recalculados na hora.
      </p>

      {copa.modo === "demo" && (
        <div className="mt-4 border-t border-border pt-4">
          <label htmlFor="copa-data" className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Dia simulado da demonstração
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="copa-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={salvando || !data || data === copa.data_referencia}
              onClick={() => salvar(copa.titulares, data)}
              className="rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Rodadas e jogos ---------------------------------------------------------

function Rodadas({
  rodadas,
  clubes,
  inicial,
  titulares,
}: {
  rodadas: CopaRodada[];
  clubes: Map<string, CopaClube>;
  inicial: number;
  titulares: number;
}) {
  const [numero, setNumero] = useState(inicial);
  useEffect(() => setNumero(inicial), [inicial]);

  const rodada = rodadas.find((r) => r.numero === numero) ?? rodadas[0];
  if (!rodada) return <p className="mt-4 text-sm text-muted-foreground">Nenhuma rodada cadastrada.</p>;

  return (
    <div className="mt-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {rodadas.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={r.numero === rodada.numero}
            onClick={() => setNumero(r.numero)}
            className={
              "shrink-0 rounded-xl border px-3 py-2 text-left text-xs " +
              (r.numero === rodada.numero
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted-foreground")
            }
          >
            <span className="block font-medium">Rodada {r.numero}</span>
            <span className="block">
              {diaMes(r.inicio)} a {diaMes(r.fim)}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {rodada.status === "ao_vivo" && "Rodada em andamento. O placar muda a cada página registrada."}
        {rodada.status === "encerrada" && "Rodada encerrada."}
        {rodada.status === "futura" && `Começa em ${diaMes(rodada.inicio)}.`}
      </p>

      <div className="mt-3 space-y-3">
        {rodada.jogos.map((j) => (
          <Jogo key={j.id} jogo={j} rodada={rodada} clubes={clubes} titulares={titulares} />
        ))}
      </div>
    </div>
  );
}

function Jogo({
  jogo,
  rodada,
  clubes,
  titulares,
}: {
  jogo: CopaJogo;
  rodada: CopaRodada;
  clubes: Map<string, CopaClube>;
  titulares: number;
}) {
  const [aberto, setAberto] = useState(false);
  const m = clubes.get(jogo.mandante);
  const v = clubes.get(jogo.visitante);
  const futura = rodada.status === "futura";
  const aoVivo = rodada.status === "ao_vivo";

  const venceM = jogo.resultado === "mandante";
  const venceV = jogo.resultado === "visitante";

  const escM = rodada.escalacoes.filter((e) => e.clube_id === jogo.mandante);
  const escV = rodada.escalacoes.filter((e) => e.clube_id === jogo.visitante);

  return (
    <div className="panel-cream rounded-2xl p-4">
      <button
        type="button"
        disabled={futura}
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <span>
            {aoVivo ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Ao vivo
              </span>
            ) : futura ? (
              "Em breve"
            ) : jogo.resultado === "empate" ? (
              "Empate"
            ) : (
              "Encerrado"
            )}
          </span>
          {!futura && <span>{aberto ? "Fechar escalação" : "Ver escalação"}</span>}
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <LadoClube clube={m} destaque={venceM} />
          <div className="font-display flex items-baseline gap-2 text-2xl tabular-nums">
            <span className={venceV ? "text-muted-foreground" : ""}>
              {futura ? "–" : formatPaginas(jogo.placar_mandante ?? 0)}
            </span>
            <span className="text-base text-muted-foreground">×</span>
            <span className={venceM ? "text-muted-foreground" : ""}>
              {futura ? "–" : formatPaginas(jogo.placar_visitante ?? 0)}
            </span>
          </div>
          <LadoClube clube={v} destaque={venceV} />
        </div>
        {!futura && <p className="mt-1 text-center text-[11px] text-muted-foreground">páginas dos titulares</p>}
      </button>

      {aberto && !futura && (
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
          <Escalacao lista={escM} titulares={titulares} />
          <Escalacao lista={escV} titulares={titulares} />
        </div>
      )}
    </div>
  );
}

function LadoClube({ clube, destaque }: { clube: CopaClube | undefined; destaque: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <ClubeLogo nome={clube?.nome ?? "Clube"} logo={clube?.logo ?? null} tamanho="grande" />
      <p className={"mt-2 w-full truncate text-sm leading-tight " + (destaque ? "font-semibold" : "")}>
        {clube?.nome ?? "Clube"}
      </p>
      <p className="w-full truncate text-xs text-muted-foreground">{clube?.time ?? ""}</p>
    </div>
  );
}

/** Logo do clube de leitura (imagem do clube no Grifo); sem imagem, mostra as iniciais. */
function ClubeLogo({ nome, logo, tamanho }: { nome: string; logo: string | null; tamanho: "grande" | "pequeno" }) {
  const [falhou, setFalhou] = useState(false);
  const classe =
    tamanho === "grande"
      ? "h-14 w-14 text-base"
      : "h-8 w-8 text-[11px]";
  if (logo && !falhou) {
    return (
      <img
        src={logo}
        alt={`Logo do ${nome}`}
        loading="lazy"
        onError={() => setFalhou(true)}
        className={classe + " shrink-0 rounded-full border border-border bg-white object-cover"}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={
        classe +
        " font-display flex shrink-0 items-center justify-center rounded-full bg-[#144142] font-semibold text-[#DAAE5A]"
      }
    >
      {iniciais(nome)}
    </span>
  );
}

function Escalacao({ lista, titulares }: { lista: CopaEscalacao[]; titulares: number }) {
  if (!lista.length) return <p className="text-xs text-muted-foreground">Ninguém leu ainda.</p>;
  const tit = lista.filter((e) => e.titular);
  const banco = lista.filter((e) => !e.titular);
  return (
    <div className="min-w-0 text-sm">
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        Titulares ({tit.length}/{titulares})
      </p>
      <ul className="mt-1.5 space-y-1">
        {tit.map((e) => (
          <li key={`${e.posicao}-${e.leitor}`} className="flex justify-between gap-2">
            <span className="truncate">{e.leitor}</span>
            <span className="tabular-nums">{formatPaginas(e.paginas)}</span>
          </li>
        ))}
      </ul>
      {banco.length > 0 && (
        <>
          <p className="mt-3 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Banco</p>
          <ul className="mt-1.5 space-y-1 text-muted-foreground">
            {banco.map((e) => (
              <li key={`${e.posicao}-${e.leitor}`} className="flex justify-between gap-2">
                <span className="truncate">{e.leitor}</span>
                <span className="tabular-nums">{formatPaginas(e.paginas)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// --- Tabela de classificação ---------------------------------------------------

function Tabela({ dados }: { dados: CopaDados }) {
  const encerradas = dados.rodadas.filter((r) => r.status === "encerrada").length;
  return (
    <div className="panel-cream mt-4 rounded-2xl p-4">
      <p className="text-xs text-muted-foreground">
        {encerradas === 0
          ? "A tabela começa a contar quando a primeira rodada terminar."
          : `Conta as ${encerradas} rodada(s) encerrada(s). A rodada em andamento entra quando terminar.`}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="py-2 pr-2 font-medium">#</th>
              <th className="py-2 pr-2 font-medium">Clube</th>
              <th className="py-2 pr-2 text-right font-medium">P</th>
              <th className="py-2 pr-2 text-right font-medium">J</th>
              <th className="py-2 pr-2 text-right font-medium">V</th>
              <th className="py-2 pr-2 text-right font-medium">E</th>
              <th className="py-2 pr-2 text-right font-medium">D</th>
              <th className="py-2 text-right font-medium">SP</th>
            </tr>
          </thead>
          <tbody>
            {dados.tabela.map((l, i) => (
              <tr key={l.clube_id} className="border-b border-border/50 last:border-0">
                <td className="py-2.5 pr-2 text-muted-foreground">{i + 1}</td>
                <td className="py-2.5 pr-2">
                  <div className="flex items-center gap-2.5">
                    <ClubeLogo nome={l.nome} logo={l.logo} tamanho="pequeno" />
                    <div className="min-w-0">
                      <span className="block font-medium">{l.nome}</span>
                      <span className="block text-xs text-muted-foreground">{l.time}</span>
                    </div>
                  </div>
                </td>
                <td className="font-display py-2.5 pr-2 text-right text-lg">{l.pontos}</td>
                <td className="py-2.5 pr-2 text-right">{l.jogos}</td>
                <td className="py-2.5 pr-2 text-right">{l.vitorias}</td>
                <td className="py-2.5 pr-2 text-right">{l.empates}</td>
                <td className="py-2.5 pr-2 text-right">{l.derrotas}</td>
                <td className="py-2.5 text-right tabular-nums">
                  {l.saldo > 0 ? "+" : ""}
                  {formatPaginas(l.saldo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        P pontos · J jogos · V vitórias · E empates · D derrotas · SP saldo de páginas
      </p>
    </div>
  );
}

// --- Regras ---------------------------------------------------------------------

function Regras({ dados }: { dados: CopaDados }) {
  const { copa } = dados;
  const itens = [
    "Cada rodada dura uma semana, de segunda a domingo, com confrontos 1x1 entre os clubes.",
    `Todo mundo do clube lê, mas só os ${copa.titulares} leitores que mais leram na semana entram no placar. Os outros ficam no banco e entram se passarem alguém.`,
    "Vitória vale 3 pontos e empate vale 1. É empate quando a diferença fica abaixo de " +
      `${copa.empate_pct}% do placar maior.`,
    "Só contam páginas registradas no Grifo dentro da semana da rodada.",
    `Cada leitor conta no máximo ${copa.teto_diario} páginas por dia, para ninguém aparecer com 2 mil páginas do nada.`,
    "Quem entra no clube durante a Copa começa a contar na rodada seguinte.",
    "Desempate na tabela: pontos, vitórias, saldo de páginas e páginas lidas.",
  ];
  return (
    <div className="panel-cream mt-4 rounded-2xl p-5">
      <p className="text-sm text-muted-foreground">Regras em discussão com os clubes. Tudo pode mudar.</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
        {itens.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
    </div>
  );
}
