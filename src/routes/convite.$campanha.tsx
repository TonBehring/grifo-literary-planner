// Página pública de um convite de teste grátis (ex.: /convite/45paginas).
// Guarda a campanha no navegador e manda para "Minha conta" (passando pelo
// login/cadastro, se precisar), onde o botão do cartão já vem com o teste.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, BookOpen, NotebookPen, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getTrialCampaign, savePendingCampaign } from "@/lib/trial-campaign";

export const Route = createFileRoute("/convite/$campanha")({
  head: () => ({
    meta: [
      { title: "7 dias grátis no Grifo" },
      {
        name: "description",
        content: "Organize sua estante, acompanhe suas leituras e leia junto em clubes de leitura.",
      },
      { property: "og:title", content: "7 dias grátis no Grifo" },
      {
        property: "og:description",
        content: "Organize sua estante, acompanhe suas leituras e leia junto em clubes de leitura.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConvitePage,
});

const RECURSOS = [
  { icon: BookOpen, texto: "Cronômetro de leitura e progresso de cada livro" },
  { icon: NotebookPen, texto: "Anotações e citações guardadas com o livro" },
  { icon: Users, texto: "Clubes de leitura com mural, encontros e ranking" },
  { icon: BarChart3, texto: "Estatísticas e desafio literário do ano" },
];

// Preço mostrado no convite. Enquanto houver selo de fundador, quem assina
// paga o preço de fundador (20% de desconto em todas as renovações).
const PRECO_CHEIO = "R$ 54,90";
const PRECO_FUNDADOR = "R$ 43,92";
const POR_MES = "R$ 3,66";

function ConvitePage() {
  const { campanha: slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const campanha = useQuery({
    queryKey: ["trial-campaign", slug],
    queryFn: () => getTrialCampaign(slug.toLowerCase()),
  });

  function comecar() {
    if (!campanha.data) return;
    savePendingCampaign(campanha.data.slug);
    navigate({ to: user ? "/conta" : "/auth" });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <img src="/brand/logo-grifo.png" alt="Grifo" className="h-9 w-auto self-start" />

      {campanha.isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Carregando…</p>
      ) : !campanha.data ? (
        <div className="panel-cream mt-10 rounded-2xl p-6 text-center">
          <p className="font-display text-xl">Este convite não está mais valendo</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Você ainda pode conhecer o Grifo e assinar quando quiser.
          </p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
          >
            Ir para o Grifo
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-10 text-sm font-medium text-[#85651C]">Presente de {campanha.data.nome}</p>
          <h1 className="font-display mt-2 text-4xl leading-tight">
            {campanha.data.dias} dias grátis no Grifo
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            O app para organizar sua estante, acompanhar suas leituras e ler junto com outras
            pessoas.
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {RECURSOS.map(({ icon: Icon, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[#85651C]">
                  <Icon className="h-4 w-4" />
                </span>
                {texto}
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-2xl border border-[#85651C]/40 bg-primary/10 p-5">
            <p className="text-sm font-medium text-[#85651C]">Depois do teste</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground line-through">{PRECO_CHEIO}</span>
              <span className="font-display text-3xl">{PRECO_FUNDADOR}</span>
              <span className="text-sm text-muted-foreground">por ano</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Menos de {POR_MES} por mês. Preço de fundador: 20% de desconto para sempre, em
              todas as renovações, e selo de fundador numerado.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Só 250 pessoas vão ter o selo de fundador.
            </p>
          </div>

          <div className="panel-cream mt-4 rounded-2xl p-5">
            <p className="text-sm font-medium">Como funciona</p>
            <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground">
              <li>{user ? "Toque no botão abaixo." : "Crie sua conta ou entre."}</li>
              <li>
                Cadastre o cartão. Nada é cobrado nos primeiros {campanha.data.dias} dias.
              </li>
              <li>
                Gostou? A assinatura anual de {PRECO_FUNDADOR} começa sozinha no fim do teste. Não
                gostou? Cancele em Minha conta antes disso e não paga nada.
              </li>
            </ol>
          </div>

          <button
            onClick={comecar}
            className="mt-8 w-full rounded-full bg-primary py-4 text-base font-medium text-primary-foreground"
          >
            Começar meus {campanha.data.dias} dias grátis
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Você confere o valor de novo na tela de pagamento, antes de confirmar.
          </p>
        </>
      )}
    </div>
  );
}
