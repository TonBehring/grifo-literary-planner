import { createFileRoute, Link } from "@tanstack/react-router";

// ATENÇÃO — antes de publicar de verdade:
// 1. Trocar CONTATO_EMAIL abaixo pelo e-mail dedicado do Grifo (ainda não
//    existe — é o bloqueio combinado antes do "GO LIVE" desta página).
// 2. Preencher a comarca do foro na seção 10.
const CONTATO_EMAIL = "contato@PLACEHOLDER-TROCAR.com";

// Página pública (sem exigir login) — precisa ser acessível a partir da tela
// de cadastro, antes de existir uma conta.
export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [{ title: "Termos de Uso — Grifo" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6 px-5 py-10">
      <div>
        <Link to="/auth" className="text-sm text-primary underline underline-offset-4">
          ← Voltar
        </Link>
        <h1 className="font-display mt-3 text-3xl leading-tight">Termos de Uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: [DATA DA PUBLICAÇÃO]
        </p>
      </div>

      <div className="panel-cream space-y-5 rounded-2xl p-6 text-sm leading-relaxed">
        <p>
          Estes Termos de Uso regulam o uso do aplicativo <strong>Grifo</strong> ("aplicativo",
          "nós"), um planner de literatura para acompanhar leituras, anotar citações e organizar
          empréstimos de livros. Ao criar uma conta, você concorda com estes Termos e com a nossa{" "}
          <Link to="/privacidade" className="text-primary underline underline-offset-4">
            Política de Privacidade
          </Link>
          .
        </p>

        <Section title="1. Cadastro e conta">
          <p>
            Para usar o Grifo, você precisa criar uma conta com e-mail e senha. Você é responsável
            por manter a confidencialidade da sua senha e por todas as atividades feitas na sua
            conta. Você deve ter no mínimo 18 anos, ou usar o aplicativo com autorização e
            supervisão de um responsável legal.
          </p>
          <p className="mt-2">
            As informações que você cadastra (nome, apelido, foto de perfil) devem ser
            verdadeiras. Não é permitido criar contas falsas ou se passar por outra pessoa.
          </p>
        </Section>

        <Section title="2. O que o Grifo oferece">
          <p>
            O Grifo permite: cadastrar e acompanhar o progresso de livros que você está lendo;
            registrar anotações, citações e avaliações; participar do Desafio Literário; registrar
            e acompanhar empréstimos de livros entre você e outras pessoas; conectar sua conta a
            outros usuários; e, mediante assinatura paga, acessar recursos completos do
            aplicativo.
          </p>
          <p className="mt-2">
            Algumas funcionalidades (como registrar novo progresso, notas e empréstimos) exigem
            uma assinatura ativa, conforme indicado no próprio aplicativo.
          </p>
        </Section>

        <Section title="3. Assinatura e pagamento">
          <p>
            A assinatura do Grifo é processada pela Asaas, nossa processadora de pagamentos. Os
            valores, a periodicidade e as condições de cobrança são exibidos antes da confirmação
            da assinatura. O cancelamento pode ser feito a qualquer momento; o acesso aos recursos
            pagos permanece ativo até o fim do período já pago.
          </p>
          <p className="mt-2">
            Reembolsos e estornos seguem a política vigente informada no momento da contratação e
            as regras da processadora de pagamento.
          </p>
        </Section>

        <Section title="4. Conteúdo enviado por você">
          <p>
            Você é o único responsável pelo conteúdo que cadastra no Grifo (anotações, citações,
            resenhas, motivos de abandono de leitura, fotos de capa e de perfil). Ao enviar esse
            conteúdo, você garante que tem o direito de fazê-lo e que ele não viola direitos de
            terceiros.
          </p>
          <p className="mt-2">
            Você concede ao Grifo uma licença limitada para armazenar e exibir esse conteúdo
            dentro do aplicativo, exclusivamente para viabilizar suas funcionalidades.
          </p>
          <p className="mt-2">
            É proibido usar o Grifo para publicar conteúdo ilegal, ofensivo, discriminatório ou
            que viole direitos de terceiros.
          </p>
        </Section>

        <Section title="5. Empréstimos e conexões entre usuários">
          <p>
            O Grifo é uma ferramenta de organização entre pessoas que já combinaram um empréstimo
            por conta própria — não somos parte do acordo de empréstimo, não garantimos a
            devolução do livro nem mediamos conflitos entre as partes. Ao registrar um empréstimo
            ou aceitar uma conexão com outro usuário, você concorda que certas informações (como
            seu apelido e o título do livro emprestado) fiquem visíveis para a outra pessoa
            envolvida.
          </p>
        </Section>

        <Section title="6. Propriedade intelectual">
          <p>
            A marca Grifo, seu logotipo, design e código são de propriedade do Grifo (ou de seus
            licenciantes) e não podem ser copiados ou reutilizados sem autorização. As informações
            de livros (título, autor, capa) exibidas no Grifo podem vir de bases de dados públicas
            de terceiros (Google Books, Open Library) e pertencem aos seus respectivos detentores
            de direitos.
          </p>
        </Section>

        <Section title="7. Cancelamento e exclusão de conta">
          <p>
            Você pode encerrar sua conta a qualquer momento entrando em contato pelo e-mail{" "}
            <a href={`mailto:${CONTATO_EMAIL}`} className="text-primary underline underline-offset-4">
              {CONTATO_EMAIL}
            </a>
            . Após a exclusão, seus dados pessoais são apagados ou anonimizados conforme descrito
            na nossa Política de Privacidade.
          </p>
          <p className="mt-2">
            Podemos suspender ou encerrar contas que violem estes Termos, mediante aviso prévio
            sempre que possível.
          </p>
        </Section>

        <Section title="8. Limitação de responsabilidade">
          <p>
            O Grifo é fornecido "como está". Fazemos o possível para manter o aplicativo
            disponível e funcionando corretamente, mas não garantimos que ele estará livre de
            interrupções, erros ou perda de dados, e não nos responsabilizamos por danos indiretos
            decorrentes do uso do aplicativo, dentro dos limites permitidos pela lei brasileira.
          </p>
          <p className="mt-2">
            Recomendamos que você não dependa do Grifo como única cópia de anotações ou citações
            que sejam de grande valor para você.
          </p>
        </Section>

        <Section title="9. Alterações destes Termos">
          <p>
            Podemos atualizar estes Termos para refletir mudanças no aplicativo ou na legislação.
            Mudanças relevantes serão avisadas dentro do próprio app. O uso continuado do Grifo
            após uma atualização representa concordância com os novos Termos.
          </p>
        </Section>

        <Section title="10. Lei aplicável">
          <p>
            Estes Termos são regidos pelas leis do Brasil. Qualquer disputa relacionada ao uso do
            Grifo será resolvida no foro da comarca de [CIDADE/UF A DEFINIR], salvo disposição
            legal em contrário.
          </p>
        </Section>

        <Section title="11. Contato">
          <p>
            Dúvidas sobre estes Termos de Uso:{" "}
            <a href={`mailto:${CONTATO_EMAIL}`} className="text-primary underline underline-offset-4">
              {CONTATO_EMAIL}
            </a>
            .
          </p>
        </Section>
      </div>

      <Link to="/privacidade" className="inline-block text-sm text-primary underline underline-offset-4">
        Ver Política de Privacidade
      </Link>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-lg">{title}</h2>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
