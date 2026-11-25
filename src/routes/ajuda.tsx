import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Mail, Search, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CATEGORIAS, CONTATO_AJUDA, GUIAS, normalizarBusca, type Guia, type Pergunta } from "@/lib/help-content";

export const Route = createFileRoute("/ajuda")({
  head: () => ({
    meta: [
      { title: "Ajuda — Grifo" },
      { name: "description", content: "Passo a passo e perguntas frequentes sobre o Grifo." },
    ],
  }),
  component: () => (
    <AppShell>
      <HelpPage />
    </AppShell>
  ),
});

function textoGuia(g: Guia) {
  return normalizarBusca([g.titulo, g.resumo, ...g.passos, g.dica ?? ""].join(" "));
}

function textoPergunta(p: Pergunta) {
  return normalizarBusca([p.pergunta, ...p.resposta].join(" "));
}

function HelpPage() {
  const [busca, setBusca] = useState("");
  const termo = normalizarBusca(busca.trim());

  const guias = useMemo(
    () => (termo.length < 2 ? GUIAS : GUIAS.filter((g) => textoGuia(g).includes(termo))),
    [termo],
  );
  const categorias = useMemo(
    () =>
      termo.length < 2
        ? CATEGORIAS
        : CATEGORIAS.map((c) => ({ ...c, perguntas: c.perguntas.filter((p) => textoPergunta(p).includes(termo)) })).filter(
            (c) => c.perguntas.length > 0,
          ),
    [termo],
  );
  const buscando = termo.length >= 2;
  const nada = buscando && guias.length === 0 && categorias.length === 0;
  // Na busca, abre tudo o que achou para a resposta aparecer direto.
  const abertosGuias = buscando ? guias.map((g) => g.id) : [];
  const abertasPerguntas = buscando ? categorias.flatMap((c) => c.perguntas.map((p) => p.id)) : [];

  return (
    <section className="space-y-8">
      <div>
        <h1 className="font-display text-4xl leading-tight">Ajuda</h1>
        <p className="mt-2 text-sm text-muted-foreground">Passo a passo e respostas para as dúvidas mais comuns.</p>
        <label className="relative mt-5 block">
          <span className="sr-only">Buscar na ajuda</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            maxLength={80}
            placeholder="Busque: clube, assinatura, câmera…"
            className="w-full rounded-xl border border-border bg-card/0 py-3 pl-11 pr-10 text-sm outline-none focus:border-primary"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      </div>

      {nada && (
        <div className="panel-cream rounded-2xl p-5 text-sm">
          <p>Não achamos nada sobre "{busca.trim()}".</p>
          <p className="mt-1 text-muted-foreground">Tente outra palavra ou fale com a gente pelo e-mail abaixo.</p>
        </div>
      )}

      {guias.length > 0 && (
        <div>
          <h2 className="font-display text-2xl">Passo a passo</h2>
          <Accordion
            key={buscando ? `g-${termo}` : "g"}
            type="multiple"
            defaultValue={abertosGuias}
            className="panel-cream mt-3 rounded-2xl px-5"
          >
            {guias.map((g) => (
              <AccordionItem key={g.id} value={g.id} className="border-border/60 last:border-b-0">
                <AccordionTrigger className="text-left hover:no-underline">
                  <span>
                    <span className="block font-medium">{g.titulo}</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{g.resumo}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="space-y-2.5">
                    {g.passos.map((p, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#052C2D] text-xs font-medium text-[#F9F4EA]">
                          {i + 1}
                        </span>
                        <span className="pt-0.5">{p}</span>
                      </li>
                    ))}
                  </ol>
                  {g.dica && (
                    <p className="mt-4 rounded-xl border border-[#85651C]/30 px-3 py-2 text-xs">
                      <strong className="text-[#85651C]">Dica:</strong> {g.dica}
                    </p>
                  )}
                  {g.link && (
                    <Link
                      to={g.link.to}
                      className="mt-4 inline-block text-sm font-medium text-[#85651C] underline underline-offset-4"
                    >
                      {g.link.label}
                    </Link>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {categorias.length > 0 && (
        <div>
          <h2 className="font-display text-2xl">Perguntas frequentes</h2>
          <div className="mt-3 space-y-5">
            {categorias.map((c) => (
              <div key={c.id}>
                <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{c.titulo}</p>
                <Accordion
                  key={buscando ? `${c.id}-${termo}` : c.id}
                  type="multiple"
                  defaultValue={abertasPerguntas}
                  className="panel-cream mt-2 rounded-2xl px-5"
                >
                  {c.perguntas.map((p) => (
                    <AccordionItem key={p.id} value={p.id} className="border-border/60 last:border-b-0">
                      <AccordionTrigger className="text-left text-sm hover:no-underline">{p.pergunta}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          {p.resposta.map((r, i) => (
                            <p key={i}>{r}</p>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-[#052C2D] p-5 text-[#F9F4EA]">
        <p className="font-display text-xl">Não achou o que procurava?</p>
        <p className="mt-1 text-sm opacity-80">
          Escreva para a gente contando o que aconteceu. Se puder, mande um print da tela.
        </p>
        <a
          href={`mailto:${CONTATO_AJUDA}?subject=${encodeURIComponent("Ajuda com o Grifo")}`}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#DAAE5A] px-5 py-2.5 text-sm font-medium text-[#052C2D]"
        >
          <Mail className="h-4 w-4" /> {CONTATO_AJUDA}
        </a>
      </div>
    </section>
  );
}
