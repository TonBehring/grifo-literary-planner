// Conteúdo da Central de Ajuda (/ajuda). Para mudar um texto, edite aqui:
// a página só monta o que está nesta lista.

export const CONTATO_AJUDA = "contato@useogrifo.app";

export type Guia = {
  id: string;
  titulo: string;
  resumo: string;
  passos: string[];
  dica?: string;
  link?: { to: "/adicionar" | "/adicionar/lote" | "/clubes" | "/conta"; label: string };
};

export type Pergunta = { id: string; pergunta: string; resposta: string[] };

export type Categoria = { id: string; titulo: string; perguntas: Pergunta[] };

export const GUIAS: Guia[] = [
  {
    id: "instalar",
    titulo: "Instalar o Grifo no celular",
    resumo: "Ícone na tela inicial, tela cheia e notificações, sem loja de aplicativos.",
    passos: [
      "Android (Chrome): abra useogrifo.app, toque nos três pontinhos no canto de cima e escolha \"Instalar app\" ou \"Adicionar à tela inicial\".",
      "iPhone (Safari): abra useogrifo.app, toque no botão Compartilhar (o quadrado com a seta para cima) e escolha \"Adicionar à Tela de Início\".",
      "Pronto: o Grifo aparece na tela do celular como os outros apps. Entre pelo ícone a partir de agora.",
    ],
    dica: "No iPhone, as notificações só funcionam com o Grifo instalado na Tela de Início.",
  },
  {
    id: "primeiro-livro",
    titulo: "Adicionar um livro",
    resumo: "Busque pelo título, escaneie o código de barras ou cadastre à mão.",
    passos: [
      "Toque em \"+ Livro\", no topo da tela Lendo Agora ou da Biblioteca.",
      "Digite o título, o autor ou o ISBN e toque na lupa. Ou toque no ícone da câmera e aponte para o código de barras da contracapa.",
      "Escolha o livro certo na lista. Se não achar, toque em \"Não achou? Cadastrar manualmente\".",
      "Escolha o formato (físico, ebook ou audiobook) e a estante (Lendo, Quero Ler ou Lidos) e toque em Adicionar.",
    ],
    dica: "Leu antes de usar o Grifo? Marque \"Já li esse livro antes de usar o Grifo\" para ele contar nas suas estatísticas.",
    link: { to: "/adicionar", label: "Adicionar um livro" },
  },
  {
    id: "varios-livros",
    titulo: "Adicionar vários livros de uma vez",
    resumo: "Para quem tem muitos livros em casa ou vários do mesmo autor.",
    passos: [
      "Em \"Adicionar livro\", toque em \"Tem muitos livros para cadastrar?\".",
      "Na aba Escanear, abra a câmera e passe um livro de cada vez. Cada um entra na lista abaixo.",
      "Na aba Por autor, digite o nome do autor e marque os livros que você tem.",
      "Confira a lista, escolha o formato e a estante e toque em \"Adicionar\". Dá para colocar até 60 livros por vez.",
    ],
    link: { to: "/adicionar/lote", label: "Adicionar vários livros" },
  },
  {
    id: "progresso",
    titulo: "Registrar o progresso da leitura",
    resumo: "Página por página no livro físico, ou porcentagem no ebook e no audiobook.",
    passos: [
      "Abra o livro em Lendo Agora ou na Biblioteca.",
      "Em \"Atualizar progresso\", digite a página em que você parou (ou a porcentagem) e toque em Registrar.",
      "Se quiser cronometrar, toque em \"Iniciar leitura\" antes de começar. No fim, informe a página e o Grifo calcula o tempo e o seu ritmo.",
    ],
    dica: "Digitou uma página a mais? Registre a página certa e toque em \"Corrigir\" quando o Grifo perguntar.",
  },
  {
    id: "anotacoes",
    titulo: "Guardar anotações e citações",
    resumo: "Escreva o que pensou do livro e guarde os trechos que marcaram.",
    passos: [
      "Abra o livro e toque em \"Escrever nova anotação ou citação\".",
      "Escolha se é nota ou citação, escreva e, se quiser, informe a página.",
      "Use os botões de negrito, itálico e grifado para destacar partes do texto.",
      "Numa citação, toque no ícone de compartilhar para gerar uma imagem pronta para os stories.",
    ],
    dica: "O rascunho é salvo enquanto você escreve. Se o app fechar, o texto volta quando você abrir de novo. Para levar tudo junto, use \"Baixar PDF\".",
  },
  {
    id: "terminar",
    titulo: "Terminar um livro (e reler)",
    resumo: "Conclua a leitura, dê sua nota e guarde a resenha.",
    passos: [
      "Abra o livro e toque em \"Terminei este livro\".",
      "Dê de 1 a 5 estrelas, escreva uma resenha se quiser e marque como favorito.",
      "O livro vai para a estante Lidos e entra nas suas estatísticas.",
      "Para ler de novo, abra o livro lido e toque em \"Reler este livro\". A leitura anterior fica guardada no histórico e conta na sua meta do ano.",
    ],
  },
  {
    id: "clube",
    titulo: "Entrar ou criar um clube de leitura",
    resumo: "Leia junto com amigos, acompanhe o progresso de todos e converse no mural.",
    passos: [
      "Toque em \"Clubes de Leitura\", na barra de baixo.",
      "Recebeu um convite? Toque no link ou em \"Entrar com código\" e digite o código do clube.",
      "Para procurar um clube aberto, toque em \"Descobrir clubes públicos\".",
      "Para criar o seu, toque em \"Criar clube\", dê um nome e defina o livro atual. Depois use \"Convidar\" para mandar o link no WhatsApp.",
    ],
    link: { to: "/clubes", label: "Ver clubes" },
  },
  {
    id: "notificacoes",
    titulo: "Ativar as notificações",
    resumo: "Lembretes de leitura, de empréstimos e novidades dos seus clubes.",
    passos: [
      "Toque no ícone de pessoa, no topo, para abrir Minha conta.",
      "Toque em \"Ativar notificações\" e permita quando o celular perguntar.",
      "No iPhone, instale o Grifo na Tela de Início antes (veja \"Instalar o Grifo no celular\").",
    ],
    link: { to: "/conta", label: "Abrir Minha conta" },
  },
];

export const CATEGORIAS: Categoria[] = [
  {
    id: "assinatura",
    titulo: "Conta e assinatura",
    perguntas: [
      {
        id: "sem-assinatura",
        pergunta: "O que dá para fazer sem assinatura?",
        resposta: [
          "Sem assinatura, você cria sua conta, monta sua estante com os livros que está lendo, quer ler ou já leu, entra em clubes de leitura, conversa no mural e marca suas páginas no clube.",
          "Com a assinatura, você registra o progresso na sua estante, usa o cronômetro de leitura, guarda anotações e citações, acompanha estatísticas e o Desafio Literário, registra empréstimos, cria clubes e relê livros.",
        ],
      },
      {
        id: "preco",
        pergunta: "Quanto custa a assinatura?",
        resposta: [
          "A assinatura é anual: R$ 54,90 por ano, no cartão.",
          "Quem assina agora vira fundador e ganha 20% de desconto para sempre, em todas as renovações, enquanto houver selos de fundador.",
        ],
      },
      {
        id: "teste",
        pergunta: "Como funciona o teste de 7 dias?",
        resposta: [
          "Quando você recebe um convite de teste, cadastra o cartão e usa o Grifo completo por 7 dias. A primeira cobrança só acontece depois desse prazo.",
          "Se não quiser continuar, cancele em Minha conta, no botão \"Cancelar teste grátis\", antes do fim dos 7 dias. Assim nada é cobrado.",
        ],
      },
      {
        id: "cancelar",
        pergunta: "Como cancelo a renovação da assinatura?",
        resposta: [
          `Escreva para ${CONTATO_AJUDA} com o e-mail da sua conta e a gente cancela a renovação. Você continua com acesso até o fim do período que já pagou.`,
        ],
      },
      {
        id: "senha",
        pergunta: "Esqueci minha senha. E agora?",
        resposta: [
          "Na tela de entrar, toque em \"Esqueci minha senha\" e informe o seu e-mail. Chega um link para criar uma senha nova.",
          "Não chegou? Olhe a caixa de spam e a aba Promoções do Gmail.",
        ],
      },
      {
        id: "excluir-conta",
        pergunta: "Como excluo minha conta?",
        resposta: [
          `Escreva para ${CONTATO_AJUDA} pelo e-mail da sua conta pedindo a exclusão. Apagamos sua conta e seus dados e confirmamos por e-mail.`,
        ],
      },
    ],
  },
  {
    id: "livros",
    titulo: "Livros e estante",
    perguntas: [
      {
        id: "estantes",
        pergunta: "Qual a diferença entre as estantes?",
        resposta: [
          "Lendo: o que você está lendo agora. Quero Ler: a sua fila. Lidos: o que você terminou. Quero comprar: a sua lista de desejos. Abandonado: o que você parou de ler, com o motivo, se quiser anotar.",
        ],
      },
      {
        id: "isbn-errado",
        pergunta: "Escaneei o código e veio o livro errado (ou não encontrou nada).",
        resposta: [
          "Deixe o código reto, com boa luz, a uns 15 cm da câmera, e tente de novo.",
          "Se o livro não aparecer, toque em \"Cadastrar manualmente\" e preencha título, autor e páginas. Você também pode digitar o ISBN direto no campo de busca.",
        ],
      },
      {
        id: "editar-livro",
        pergunta: "Como mudo a capa, o título ou o número de páginas?",
        resposta: [
          "Abra o livro e toque em \"Editar\". A mudança vale só para a sua estante, não para a de outros leitores.",
        ],
      },
      {
        id: "pagina-menor",
        pergunta: "Registrei uma página a mais por engano. Como corrijo?",
        resposta: [
          "Abra o livro, digite a página certa em \"Atualizar progresso\" e toque em Registrar. O Grifo pergunta se você quer corrigir: toque em \"Corrigir\". As páginas a mais saem das suas estatísticas.",
          "A correção vale para livros na estante Lendo. Se vai ler de novo um livro que já terminou, use \"Reler este livro\".",
        ],
      },
      {
        id: "abandonar",
        pergunta: "Parei de ler um livro. O que faço?",
        resposta: [
          "Abra o livro e toque em \"Abandonar\". Se mudar de ideia, abra o livro na estante Abandonado e toque em \"Retomar este livro\".",
        ],
      },
      {
        id: "excluir-livro",
        pergunta: "Como tiro um livro da minha estante?",
        resposta: [
          "Abra o livro e toque em \"Excluir\". Atenção: as anotações e os registros desse livro também são apagados.",
        ],
      },
    ],
  },
  {
    id: "clubes",
    titulo: "Clubes de leitura",
    perguntas: [
      {
        id: "clube-assinatura",
        pergunta: "Preciso de assinatura para participar de um clube?",
        resposta: [
          "Não. Participar de um clube é livre. Para criar o seu próprio clube, é preciso ser assinante.",
        ],
      },
      {
        id: "clube-progresso",
        pergunta: "Como meu progresso aparece no clube?",
        resposta: [
          "Se você é assinante, toque em \"Adicionar à minha estante\" no livro do clube. A cada página que você registra na sua estante, o clube atualiza sozinho.",
          "Sem assinatura, digite a página em que parou direto na tela do clube.",
        ],
      },
      {
        id: "spoiler",
        pergunta: "Como o mural evita spoiler?",
        resposta: [
          "Ao publicar, informe a página do trecho que você está comentando. Quem ainda não chegou nessa página vê o post escondido e só abre se tocar em \"Toque para ver mesmo assim\".",
        ],
      },
      {
        id: "avaliacao-clube",
        pergunta: "Como funciona a avaliação no fim da leitura?",
        resposta: [
          "Quando o administrador conclui a leitura, cada membro dá sua nota de 1 a 5. A nota do clube e os comentários só aparecem para você depois que você avaliar, para ninguém ser influenciado.",
          "A avaliação fica aberta até o clube começar a próxima leitura. Depois, dá para compartilhar um card \"Eu li com o clube\" nos stories.",
        ],
      },
      {
        id: "convidar",
        pergunta: "Como convido alguém para o meu clube?",
        resposta: [
          "Na tela do clube, toque em \"Convidar\" e escolha \"Enviar pelo WhatsApp\", compartilhar ou copiar o link. Quem ainda não tem conta cria uma pelo link e já entra no clube.",
        ],
      },
    ],
  },
  {
    id: "app",
    titulo: "Notificações, empréstimos e o app",
    perguntas: [
      {
        id: "sem-notificacao",
        pergunta: "Não estou recebendo notificações.",
        resposta: [
          "Confira se você tocou em \"Ativar notificações\" em Minha conta e se permitiu as notificações do Grifo nas configurações do celular.",
          "No iPhone, o Grifo precisa estar instalado na Tela de Início (iOS 16.4 ou mais novo). Mesmo assim, alguns aparelhos atrasam ou seguram notificações: o sininho no topo do Grifo sempre mostra tudo.",
        ],
      },
      {
        id: "emprestimos",
        pergunta: "Como funcionam os empréstimos?",
        resposta: [
          "Em Empréstimos, registre o livro que você emprestou ou pegou emprestado, com a data de devolução. Pode ser alguém do Grifo ou só o nome da pessoa.",
          "Quando a outra pessoa também usa o Grifo, ela acompanha a leitura dela separada da sua. O Grifo avisa quando a devolução estiver perto.",
        ],
      },
      {
        id: "atualizar-app",
        pergunta: "O app está estranho ou não mostra uma novidade.",
        resposta: [
          "Feche o Grifo por completo e abra de novo. Isso carrega a versão mais nova. Se continuar, fale com a gente.",
        ],
      },
    ],
  },
];

/** Tira acentos e maiúsculas para a busca da ajuda. */
export function normalizarBusca(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
