import { createFileRoute, Link } from "@tanstack/react-router";

// ATENÇÃO — antes de publicar de verdade:
// 1. Trocar CONTATO_EMAIL abaixo pelo e-mail dedicado do Grifo (ainda não
//    existe — é o bloqueio combinado antes do "GO LIVE" desta página).
// 2. Preencher razão social/nome do responsável e o nome do encarregado.
const CONTATO_EMAIL = "contato@PLACEHOLDER-TROCAR.com";

// Página pública (sem exigir login) — precisa ser acessível a partir da tela
// de cadastro, antes de existir uma conta.
export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [{ title: "Política de Privacidade — Grifo" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6 px-5 py-10">
      <div>
        <Link to="/auth" className="text-sm text-primary underline underline-offset-4">
          ← Voltar
        </Link>
        <h1 className="font-display mt-3 text-3xl leading-tight">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: [DATA DA PUBLICAÇÃO]
        </p>
      </div>

      <div className="panel-cream space-y-5 rounded-2xl p-6 text-sm leading-relaxed">
        <p>
          Esta Política de Privacidade explica como o <strong>Grifo</strong> ("nós") coleta, usa,
          compartilha e protege os dados pessoais de quem usa o aplicativo ("você", "usuário"),
          em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
        </p>
        <p>
          Ao criar uma conta no Grifo, você concorda com o tratamento dos seus dados conforme
          descrito aqui.
        </p>

        <Section title="1. Quem é o responsável pelo tratamento dos dados">
          <p>
            O Grifo é operado por [NOME/RAZÃO SOCIAL A PREENCHER], que atua como controlador dos
            dados pessoais tratados no aplicativo.
          </p>
          <p className="mt-2">
            <strong>Encarregado de Dados (DPO):</strong> [NOME], contato:{" "}
            <a href={`mailto:${CONTATO_EMAIL}`} className="text-primary underline underline-offset-4">
              {CONTATO_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="2. Quais dados coletamos">
          <p>Coletamos apenas os dados necessários para o funcionamento do Grifo:</p>
          <p className="mt-2">
            <strong>Dados de conta:</strong> nome completo, apelido (nome de usuário único),
            e-mail e senha (armazenada de forma criptografada — nunca temos acesso a ela em texto
            puro), foto de perfil (opcional).
          </p>
          <p className="mt-2">
            <strong>Dados de leitura:</strong> livros que você cadastra (título, autor, gênero,
            número de páginas, capa), status de leitura, progresso, datas de início e conclusão,
            avaliações e resenhas, humor registrado a cada atualização de progresso.
          </p>
          <p className="mt-2">
            <strong>Anotações e citações:</strong> o conteúdo que você escreve nas anotações e
            citações dos livros.
          </p>
          <p className="mt-2">
            <strong>Empréstimos e conexões:</strong> nome da pessoa para quem você emprestou um
            livro, data prevista de devolução e, quando aplicável, a conta do Grifo vinculada a
            esse empréstimo. Conexões com outros usuários ficam registradas para ambas as contas.
          </p>
          <p className="mt-2">
            <strong>Dados de assinatura e pagamento:</strong> o Grifo <strong>não armazena dados
            do seu cartão de crédito</strong>. Os pagamentos são processados diretamente pela
            Asaas, nossa processadora de pagamentos; guardamos apenas o status da sua assinatura
            e a data de renovação.
          </p>
          <p className="mt-2">
            <strong>Notificações push:</strong> se você ativa notificações, guardamos um
            identificador técnico do seu navegador/dispositivo, necessário para entregar a
            notificação, e um histórico das notificações enviadas a você.
          </p>
          <p className="mt-2">
            <strong>Dados de uso:</strong> registros técnicos básicos de acesso e erros, usados
            apenas para manter o app funcionando e para estatísticas agregadas e anônimas de uso —
            não vendemos nem compartilhamos esses dados com terceiros para fins de publicidade.
          </p>
        </Section>

        <Section title="3. Para que usamos seus dados">
          <p>
            Usamos os dados que você fornece exclusivamente para: criar e manter sua conta e
            permitir o login; exibir seu progresso de leitura, estatísticas, desafios e
            histórico; viabilizar funcionalidades sociais que você escolhe usar, como empréstimos
            e conexões entre contas; processar sua assinatura, quando aplicável; enviar
            notificações que você ativou; e corrigir problemas técnicos e melhorar o aplicativo.
          </p>
          <p className="mt-2">
            Não usamos seus dados para treinar modelos de inteligência artificial de terceiros,
            nem os vendemos a anunciantes.
          </p>
        </Section>

        <Section title="4. Com quem compartilhamos dados">
          <p>
            Compartilhamos dados apenas com prestadores de serviço estritamente necessários para
            o funcionamento do Grifo: <strong>Supabase</strong> (banco de dados, autenticação e
            armazenamento de arquivos); <strong>Asaas</strong> (processamento de pagamento, que
            recebe os dados necessários para a cobrança — os dados do cartão são inseridos
            diretamente na Asaas, nunca passam pelo Grifo); <strong>serviços de busca de livros</strong>{" "}
            (Google Books, Open Library, que recebem apenas o termo buscado, sem dados pessoais);{" "}
            <strong>provedores de notificação push</strong> (ex.: Firebase Cloud Messaging, que
            recebe apenas o identificador técnico do seu aparelho); e <strong>Lovable</strong>{" "}
            (plataforma de hospedagem do aplicativo).
          </p>
          <p className="mt-2">
            Outras pessoas usuárias do Grifo só veem os dados que você optar por compartilhar (por
            exemplo, seu apelido e o título de um livro, ao aceitar uma conexão ou um empréstimo).
            Não exibimos seu e-mail nem sua senha para outros usuários, e não compartilhamos seus
            dados com terceiros para fins de marketing.
          </p>
        </Section>

        <Section title="5. Por quanto tempo guardamos seus dados">
          <p>
            Guardamos seus dados enquanto sua conta estiver ativa. Se você solicitar a exclusão
            da sua conta, apagamos ou anonimizamos seus dados pessoais em até 30 dias, exceto
            quando formos obrigados a manter algum registro por exigência legal (por exemplo,
            dados fiscais de uma cobrança já processada).
          </p>
        </Section>

        <Section title="6. Seus direitos">
          <p>
            Conforme o Artigo 18 da LGPD, você pode, a qualquer momento: confirmar se tratamos
            dados seus; solicitar acesso, correção ou atualização dos seus dados; solicitar a
            eliminação dos seus dados; solicitar a portabilidade dos seus dados a outro serviço;
            revogar o consentimento dado; e solicitar informação sobre com quem compartilhamos
            seus dados.
          </p>
          <p className="mt-2">
            Para exercer qualquer um desses direitos, entre em contato pelo e-mail{" "}
            <a href={`mailto:${CONTATO_EMAIL}`} className="text-primary underline underline-offset-4">
              {CONTATO_EMAIL}
            </a>
            . Respondemos em até 15 dias.
          </p>
        </Section>

        <Section title="7. Segurança">
          <p>
            Adotamos medidas técnicas para proteger seus dados, incluindo controle de acesso por
            conta, conexão criptografada (HTTPS) em todo o aplicativo, e senha mínima de 8
            caracteres. Nenhum sistema é 100% imune a incidentes; se um vazamento de dados
            pessoais ocorrer, avisaremos os usuários afetados e a Autoridade Nacional de Proteção
            de Dados (ANPD), conforme exigido pela LGPD.
          </p>
        </Section>

        <Section title="8. Menores de idade">
          <p>
            O Grifo não é direcionado a crianças. Se você tem menos de 18 anos, o uso do
            aplicativo deve ser autorizado e supervisionado por um responsável legal.
          </p>
        </Section>

        <Section title="9. Cookies e armazenamento local">
          <p>
            O Grifo usa apenas o armazenamento estritamente necessário para manter você conectado
            e para lembrar preferências do próprio aplicativo. Não usamos cookies de rastreamento
            publicitário nem compartilhamos esse tipo de dado com redes de anúncio.
          </p>
        </Section>

        <Section title="10. Alterações nesta política">
          <p>
            Podemos atualizar esta política para refletir mudanças no aplicativo ou na
            legislação. Avisaremos sobre alterações relevantes dentro do próprio app.
          </p>
        </Section>

        <Section title="11. Contato">
          <p>
            Dúvidas sobre esta Política de Privacidade ou sobre o tratamento dos seus dados:{" "}
            <a href={`mailto:${CONTATO_EMAIL}`} className="text-primary underline underline-offset-4">
              {CONTATO_EMAIL}
            </a>
            .
          </p>
        </Section>
      </div>

      <Link to="/termos" className="inline-block text-sm text-primary underline underline-offset-4">
        Ver Termos de Uso
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
