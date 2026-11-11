# Coleta de WhatsApp

## O que será entregue
- Aviso com número brasileiro e aceite marcado por padrão, exibido após cerca de três segundos para quem ainda não tem WhatsApp salvo.
- O aviso não aparece nas páginas excluídas nem junto de outro diálogo. Se o aviso de assinatura aparecer, o WhatsApp espera uma próxima navegação ou carregamento.
- Fechar ou escolher “Agora não” adia o aviso por três dias.
- Seção WhatsApp na conta para consultar, editar e salvar o número e o aceite.

## Detalhes técnicos
- Ler `profiles` com `maybeSingle()`, tratando linha ausente como número vazio. Salvar exclusivamente pela RPC existente `salvar_whatsapp`, sem migração.
- Compartilhar leitura, validação, máscara e formulário entre o aviso e a conta. Identificar consultas pelo usuário e atualizar o cache após salvar.
- `SubscriptionNudge` comunica seu estado ao `AppShell`; o WhatsApp cancela a abertura naquele carregamento se a assinatura ou outro diálogo estiver aberto.
- Reutilizar Dialog, Checkbox e Button; definir tokens locais para as cores solicitadas sem alterar o restante do app.
- Testar números de 10/11 dígitos, perfil ausente, RPC, erro de validação, prazo de três dias e prioridade dos diálogos. Conferir a prévia e o resultado da compilação automática.

## Preservado
Cadastro, login, confirmação de e-mail, assinatura e banco permanecem como estão.