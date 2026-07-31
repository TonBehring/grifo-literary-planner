# Grifo Literary Planner

Crie um app de organização de leitura chamado "Grifo".

Identidade visual:

- Fundo: off-white/creme suave

- Cards e elementos: verde-petróleo escuro (teal)

- Botões e detalhes: dourado metálico

- Fonte de interface: Inter (sem serifa)

- Fonte de títulos de livros e citações: Playfair Display (serifada)

- Vibe: aconchegante, elegante, premium, como um planner físico de literatura

Telas do MVP:

1. Login/cadastro

2. Dashboard "Lendo Agora": lista dos livros em andamento com barra de progresso (páginas ou % dependendo do formato: físico, ebook, audiobook)

3. Minha Biblioteca: abas "Lendo", "Quero Ler" e "Lidos"

4. Tela de adicionar livro: busca manual por título/ISBN (via Google Books API)

5. Tela de detalhe do livro: progresso, humor do dia (emojis estilizados), campo de anotação/citação

6. Modal de celebração ao concluir um livro: nota de 1 a 5 estrelas (com meia estrela), campo de resenha, botão de favoritar

7. Empréstimos: lista de "livros que emprestei" e "livros que peguei emprestado", com nome da pessoa e prazo

Conecte ao Supabase já existente:

- Project URL: [COLE AQUI A URL QUE VOCÊ COPIOU]

- Anon key: [COLE AQUI A ANON KEY QUE VOCÊ COPIOU]

O banco já tem as tabelas: profiles, books, user_books, reading_logs, book_notes, loans, reading_goals.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2c97fd07-054f-42c9-a574-5076946a1903).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
