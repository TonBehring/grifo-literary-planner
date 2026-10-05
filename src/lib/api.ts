import { supabase } from "@/integrations/supabase/client";
import { listContacts } from "./contatos";
import type { BookFormat, BookNote, Loan, ShelfStatus, UserBook } from "./types";

const USER_BOOK_SELECT =
  "id, user_id, book_id, status, formato, pagina_atual, nota, resenha, favoritado, motivo_abandono, titulo_override, autor_override, capa_url_override, genero_override, total_paginas_override, data_inicio, data_conclusao, origem_emprestimo_id, book:books(id, titulo, autor, capa_url, isbn, total_paginas, genero)";

type DbBook = {
  id: string;
  titulo: string;
  autor: string | null;
  capa_url: string | null;
  isbn: string | null;
  total_paginas: number | null;
  genero: string | null;
};

type DbUserBook = {
  id: string;
  user_id: string;
  book_id: string;
  status: ShelfStatus;
  formato: BookFormat;
  pagina_atual: number | null;
  nota: number | null;
  resenha: string | null;
  favoritado: boolean | null;
  motivo_abandono: string | null;
  titulo_override: string | null;
  autor_override: string | null;
  capa_url_override: string | null;
  genero_override: string | null;
  total_paginas_override: number | null;
  data_inicio: string | null;
  data_conclusao: string | null;
  origem_emprestimo_id: string | null;
  book: DbBook | null;
};

function mapUserBook(row: DbUserBook): UserBook {
  const effectiveBook = row.book
    ? {
        id: row.book.id,
        titulo: row.titulo_override ?? row.book.titulo,
        autor: row.autor_override ?? row.book.autor,
        capa_url: row.capa_url_override ?? row.book.capa_url,
        isbn: row.book.isbn,
        total_paginas: row.total_paginas_override ?? row.book.total_paginas,
        genero: row.genero_override ?? row.book.genero,
      }
    : null;
  const totalPages = effectiveBook?.total_paginas ?? null;
  const isPhysical = row.formato === "fisico";
  return {
    id: row.id,
    user_id: row.user_id,
    book_id: row.book_id,
    status: row.status,
    format: row.formato,
    current_page: isPhysical ? (row.pagina_atual ?? 0) : null,
    total_pages: totalPages,
    progress_percent: isPhysical ? null : (row.pagina_atual ?? 0),
    rating: row.nota,
    review: row.resenha,
    is_favorite: row.favoritado,
    abandon_reason: row.motivo_abandono,
    started_at: row.data_inicio,
    finished_at: row.data_conclusao,
    origem_emprestimo_id: row.origem_emprestimo_id,
    book: effectiveBook
      ? {
          id: effectiveBook.id,
          title: effectiveBook.titulo,
          author: effectiveBook.autor,
          cover_url: effectiveBook.capa_url,
          isbn: effectiveBook.isbn,
          page_count: effectiveBook.total_paginas,
          genre: effectiveBook.genero,
        }
      : null,
  };
}

function toDbUserBookPatch(patch: Partial<UserBook>) {
  const db: Record<string, unknown> = {};
  if (patch.status !== undefined) db["status"] = patch.status;
  if (patch.format !== undefined) db["formato"] = patch.format;
  if (patch.current_page !== undefined) db["pagina_atual"] = patch.current_page;
  if (patch.progress_percent !== undefined) db["pagina_atual"] = patch.progress_percent;
  if (patch.rating !== undefined) db["nota"] = patch.rating;
  if (patch.review !== undefined) db["resenha"] = patch.review;
if (patch.is_favorite !== undefined) db["favoritado"] = patch.is_favorite;
  if (patch.abandon_reason !== undefined) db["motivo_abandono"] = patch.abandon_reason;
  if (patch.started_at !== undefined) db["data_inicio"] = patch.started_at;
  if (patch.finished_at !== undefined) db["data_conclusao"] = patch.finished_at;
  return db;
}

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export async function listUserBooks(status?: ShelfStatus): Promise<UserBook[]> {
  let query = supabase.from("user_books").select(USER_BOOK_SELECT);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("criado_em", { ascending: false });
  const rows = (unwrap(data, error) ?? []) as unknown as DbUserBook[];

  const loanIds = rows
    .map((r) => r.origem_emprestimo_id)
    .filter((v): v is string => Boolean(v));
  let returnedLoanIds = new Set<string>();
  if (loanIds.length > 0) {
    const { data: loanRows, error: loansError } = await supabase
      .from("loans")
      .select("id, status")
      .in("id", loanIds);
    if (loansError) throw new Error(loansError.message);
    returnedLoanIds = new Set(
      ((loanRows ?? []) as Array<{ id: string; status: string }>)
        .filter((l) => l.status === "devolvido")
        .map((l) => l.id),
    );
  }

  return rows
    .filter((r) => !(r.origem_emprestimo_id && returnedLoanIds.has(r.origem_emprestimo_id)))
    .map(mapUserBook);
}

export async function getUserBook(id: string): Promise<UserBook> {
  const { data, error } = await supabase
    .from("user_books")
    .select(USER_BOOK_SELECT)
    .eq("id", id)
    .maybeSingle();
  const row = unwrap(data, error) as unknown as DbUserBook | null;
  if (!row) throw new Error("Livro não encontrado na sua estante");
  return mapUserBook(row);
}

export async function updateUserBook(id: string, patch: Partial<UserBook>) {
  const { error } = await supabase
    .from("user_books")
    .update(toDbUserBookPatch(patch))
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateUserBookOverrides(
  userBookId: string,
  overrides: {
    title?: string;
    author?: string | null;
    cover_url?: string | null;
    genre?: string | null;
    page_count?: number | null;
  },
) {
  const db: Record<string, unknown> = {};
  if (overrides.title !== undefined) db["titulo_override"] = overrides.title;
  if (overrides.author !== undefined) db["autor_override"] = overrides.author;
  if (overrides.cover_url !== undefined) db["capa_url_override"] = overrides.cover_url;
  if (overrides.genre !== undefined) db["genero_override"] = overrides.genre;
  if (overrides.page_count !== undefined) db["total_paginas_override"] = overrides.page_count;
  if (Object.keys(db).length === 0) return;
  const { error } = await supabase.from("user_books").update(db).eq("id", userBookId);
  if (error) throw new Error(error.message);
}

export async function updateBookInfo(
  bookId: string,
  patch: {
    title?: string;
    author?: string | null;
    page_count?: number | null;
    cover_url?: string | null;
    genre?: string | null;
  },
) {
  const db: Record<string, unknown> = {};
  if (patch.title !== undefined) db["titulo"] = patch.title;
  if (patch.author !== undefined) db["autor"] = patch.author;
  if (patch.page_count !== undefined) db["total_paginas"] = patch.page_count;
  if (patch.cover_url !== undefined) db["capa_url"] = patch.cover_url;
  if (patch.genre !== undefined) db["genero"] = patch.genre;
  if (Object.keys(db).length === 0) return;
  const { data, error } = await supabase.from("books").update(db).eq("id", bookId).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "O banco recusou a alteração do livro (falta política de UPDATE na tabela books).",
    );
  }
}

export async function deleteUserBook(id: string) {
  await supabase.from("book_notes").delete().eq("user_book_id", id);
  await supabase.from("reading_logs").delete().eq("user_book_id", id);
  await supabase.from("reading_sessions").delete().eq("user_book_id", id);
  await supabase.from("loans").delete().eq("user_book_id", id);
  const { error } = await supabase.from("user_books").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type NewBookInput = {
  title: string;
  author: string | null;
  cover_url: string | null;
  isbn: string | null;
  page_count: number | null;
  genre: string | null;
  status: ShelfStatus;
  format: BookFormat;
  pre_cadastro?: boolean;
  started_at?: string | null;
  finished_at?: string | null;
};

export async function addBookToShelf(
  input: NewBookInput,
  userId: string,
): Promise<{ id: string; alreadyExists: boolean }> {
  let bookId: string | null = null;

  if (input.isbn) {
    const { data: existing } = await supabase
      .from("books")
      .select("id")
      .eq("isbn", input.isbn)
      .maybeSingle();
    bookId = (existing as { id: string } | null)?.id ?? null;
  }

  if (!bookId) {
    const { data, error } = await supabase
      .from("books")
      .insert({
        titulo: input.title,
        autor: input.author,
        capa_url: input.cover_url,
        isbn: input.isbn,
        total_paginas: input.page_count,
        genero: input.genre,
      })
      .select("id")
      .single();
    bookId = (unwrap(data, error) as { id: string }).id;
  }

  const { data, error } = await supabase
    .from("user_books")
    .insert({
      user_id: userId,
      book_id: bookId,
      status: input.status,
      formato: input.format,
      pagina_atual: 0,
      data_inicio: input.started_at ?? (input.status === "lendo" ? new Date().toISOString() : null),
      data_conclusao: input.finished_at ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existingUserBook } = await supabase
        .from("user_books")
        .select("id")
        .eq("user_id", userId)
        .eq("book_id", bookId)
        .maybeSingle();
      if (existingUserBook) {
        return { id: (existingUserBook as { id: string }).id, alreadyExists: true };
      }
    }
    throw new Error(error.message);
  }

 return { id: (data as { id: string }).id, alreadyExists: false };
}

export async function listNotes(userBookId: string): Promise<BookNote[]> {
  const { data, error } = await supabase
    .from("book_notes")
    .select("id, user_book_id, conteudo, tipo, criado_em, pagina_referencia")
    .eq("user_book_id", userBookId)
    .order("criado_em", { ascending: false });
  const rows = (unwrap(data, error) ?? []) as unknown as Array<{
    id: string;
    user_book_id: string;
    conteudo: string;
    tipo: string;
    criado_em: string;
    pagina_referencia: number | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    user_book_id: r.user_book_id,
    content: r.conteudo,
    kind: r.tipo === "citacao" ? "citacao" : "nota",
    page: r.pagina_referencia,
    created_at: r.criado_em,
  }));
}

export async function addNote(note: {
  user_book_id: string;
  user_id: string;
  content: string;
  kind: "nota" | "citacao";
  page: number | null;
}) {
  const { error } = await supabase.from("book_notes").insert({
    user_book_id: note.user_book_id,
    conteudo: note.content,
    tipo: note.kind === "citacao" ? "citacao" : "anotacao",
    pagina_referencia: note.page,
  });
  if (error) throw new Error(error.message);
}

export async function updateNote(id: string, patch: { content?: string; page?: number | null }) {
  const payload: Record<string, unknown> = {};
  if (patch.content !== undefined) payload["conteudo"] = patch.content;
  if (patch.page !== undefined) payload["pagina_referencia"] = patch.page;
  const { error } = await supabase.from("book_notes").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from("book_notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addReadingLog(log: {
  user_book_id: string;
  user_id: string;
  mood: string | null;
  pages_read: number | null;
}) {
  const { error } = await supabase.from("reading_logs").insert({
    user_book_id: log.user_book_id,
    humor: log.mood,
    paginas_lidas: log.pages_read,
  });
  if (error) throw new Error(error.message);
}

export async function listLoans(currentUserId: string): Promise<Loan[]> {
  const { data, error } = await supabase
    .from("loans")
    .select(
      "id, user_id, linked_user_id, user_book_id, book_id, direction, pessoa_nome, data_prevista_devolucao, status, aceito, copia_user_book_id, book:books(titulo)",
    )
    .order("data_prevista_devolucao", { ascending: true });
  const rows = (unwrap(data, error) ?? []) as unknown as Array<{
    id: string;
    user_id: string;
    linked_user_id: string | null;
    user_book_id: string | null;
    book_id: string | null;
    direction: Loan["direction"];
    pessoa_nome: string;
    data_prevista_devolucao: string | null;
    status: string;
    aceito: boolean;
    copia_user_book_id: string | null;
    book: { titulo: string } | null;
  }>;

  const needsNames = rows.some((row) => row.user_id !== currentUserId);
  const contactNames = new Map<string, string>();
  if (needsNames) {
    const contacts = await listContacts();
    for (const c of contacts) contactNames.set(c.id, c.nome);
  }

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    linked_user_id: r.linked_user_id,
    user_book_id: r.user_book_id,
    book_id: r.book_id,
    direction:
      r.user_id === currentUserId
        ? r.direction
        : r.direction === "emprestei"
          ? "peguei_emprestado"
          : "emprestei",
    person_name:
      r.user_id === currentUserId
        ? r.pessoa_nome
        : (contactNames.get(r.user_id) ?? "Usuário do Grifo"),
    book_title: r.book?.titulo ?? "Livro",
    due_date: r.data_prevista_devolucao,
    returned: r.status === "devolvido",
    is_owner: r.user_id === currentUserId,
    aceito: r.aceito,
    copia_user_book_id: r.copia_user_book_id,
  }));
}

export async function getActiveLoanForUserBook(
  userBookId: string,
): Promise<{ id: string; person_name: string; due_date: string | null } | null> {
  const { data, error } = await supabase
    .from("loans")
    .select("id, pessoa_nome, data_prevista_devolucao")
    .eq("user_book_id", userBookId)
    .eq("direction", "emprestei")
    .neq("status", "devolvido")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { id: string; pessoa_nome: string; data_prevista_devolucao: string | null };
  return { id: row.id, person_name: row.pessoa_nome, due_date: row.data_prevista_devolucao };
}

export async function acceptLoan(loanId: string, bookId: string, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("user_books")
    .insert({
      user_id: userId,
      book_id: bookId,
      status: "lendo",
      formato: "fisico",
      pagina_atual: 0,
      data_inicio: new Date().toISOString(),
      origem_emprestimo_id: loanId,
    })
    .select("id")
    .single();

  let newId: string;
  if (error) {
    if (error.code !== "23505") throw new Error(error.message);
    const { data: existing, error: findError } = await supabase
      .from("user_books")
      .select("id, origem_emprestimo_id")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .maybeSingle();
    if (findError || !existing) throw new Error(error.message);
    const existingRow = existing as { id: string; origem_emprestimo_id: string | null };
    newId = existingRow.id;
    if (existingRow.origem_emprestimo_id) {
      const { error: reuseError } = await supabase
        .from("user_books")
        .update({ origem_emprestimo_id: loanId })
        .eq("id", newId);
      if (reuseError) throw new Error(reuseError.message);
    }
  } else {
    newId = (data as { id: string }).id;
  }

  const { error: updateError } = await supabase
    .from("loans")
    .update({ aceito: true, copia_user_book_id: newId })
    .eq("id", loanId);
  if (updateError) throw new Error(updateError.message);
  return newId;
}

export type NewLoanInput = {
  user_id: string;
  linked_user_id: string | null;
  user_book_id: string | null;
  book_id: string;
  direction: Loan["direction"];
  person_name: string;
  due_date: string | null;
  returned: boolean;
  // E-mail de quem ainda não tem conta no Grifo — guardado só nesse caso,
  // pra vincular o empréstimo sozinho quando essa pessoa se cadastrar com
  // esse mesmo e-mail (ver claim_invited_loans no banco).
  invited_email?: string | null;
};
export async function addLoan(loan: NewLoanInput) {
  const { error } = await supabase.from("loans").insert({
    user_id: loan.user_id,
    linked_user_id: loan.linked_user_id,
    user_book_id: loan.user_book_id,
    book_id: loan.book_id,
    direction: loan.direction,
    pessoa_nome: loan.person_name,
    data_prevista_devolucao: loan.due_date,
    status: loan.returned ? "devolvido" : "ativo",
    invited_email: loan.invited_email ?? null,
  });
  if (error) throw new Error(error.message);
}

// Manda o e-mail convidando quem ainda não tem conta a se cadastrar, pra
// acompanhar o empréstimo que acabou de ser registrado pra ela.
export async function sendLoanInviteEmail(input: {
  email: string;
  book_title: string;
  lender_name?: string;
}) {
  const { error } = await supabase.functions.invoke("convidar-emprestimo", {
    body: { email: input.email, book_title: input.book_title, lender_name: input.lender_name },
  });
  if (error) throw new Error(error.message);
}

// Roda no login: vincula automaticamente à conta que acabou de logar
// qualquer empréstimo cujo convite tenha sido mandado pra esse mesmo
// e-mail. Retorna quantos empréstimos foram vinculados agora.
export async function claimInvitedLoans(): Promise<number> {
  const { data, error } = await supabase.rpc("claim_invited_loans");
  if (error) throw new Error(error.message);
  return (data as number | null) ?? 0;
}

export async function setLoanReturned(id: string, returned: boolean) {
  const { error } = await supabase
    .from("loans")
    .update({ status: returned ? "devolvido" : "ativo" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export type GoogleVolume = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  isbn: string | null;
  page_count: number | null;
};

export async function searchLocalCatalog(isbn: string): Promise<GoogleVolume[]> {
  const clean = isbn.replace(/-/g, "");
  const { data, error } = await supabase
    .from("books")
    .select("id, titulo, autor, capa_url, isbn, total_paginas")
    .eq("isbn", clean)
    .maybeSingle();
  if (error || !data) return [];
  return [
    {
      id: data.id,
      title: data.titulo,
      author: data.autor,
      cover_url: data.capa_url,
      isbn: data.isbn,
      page_count: data.total_paginas,
    },
  ];
}
export async function searchGoogleBooks(term: string): Promise<GoogleVolume[]> {
  const isIsbn = /^[\d-]{10,17}$/.test(term.trim());
  const q = isIsbn ? `isbn:${term.replace(/-/g, "")}` : term;
  let res: Response;
  try {
    res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?maxResults=20&q=${encodeURIComponent(q)}`,
    );
  } catch {
    return searchOpenLibrary(term);
  }
  if (!res.ok) return searchOpenLibrary(term);
  const json = (await res.json()) as {
    items?: Array<{
      id: string;
      volumeInfo?: {
        title?: string;
        authors?: string[];
        pageCount?: number;
        imageLinks?: { thumbnail?: string };
        industryIdentifiers?: Array<{ identifier: string }>;
      };
    }>;
  };
  const items = (json.items ?? []).map((item) => {
    const v = item.volumeInfo ?? {};
    return {
      id: item.id,
      title: v.title ?? "Sem título",
      author: v.authors?.join(", ") ?? null,
      cover_url: v.imageLinks?.thumbnail?.replace("http://", "https://") ?? null,
      isbn: v.industryIdentifiers?.[0]?.identifier ?? null,
      page_count: v.pageCount ?? null,
    };
  });
  if (items.length === 0) return searchOpenLibrary(term);
  return items;
}

export async function searchOpenLibrary(term: string): Promise<GoogleVolume[]> {
  const clean = term.trim();
  const isIsbn = /^[\d-]{10,17}$/.test(clean);
  const params = isIsbn
    ? `isbn=${clean.replace(/-/g, "")}`
    : `q=${encodeURIComponent(clean)}`;
  const res = await fetch(
    `https://openlibrary.org/search.json?${params}&limit=20&fields=key,title,author_name,cover_i,isbn,number_of_pages_median`,
  );
  if (!res.ok) throw new Error("Não foi possível buscar agora. Tente o cadastro manual.");
  const json = (await res.json()) as {
    docs?: Array<{
      key?: string;
      title?: string;
      author_name?: string[];
      cover_i?: number;
      isbn?: string[];
      number_of_pages_median?: number;
    }>;
  };
  return (json.docs ?? []).map((d, i) => ({
    id: d.key ?? `ol-${i}`,
    title: d.title ?? "Sem título",
    author: d.author_name?.join(", ") ?? null,
    cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
    isbn: isIsbn ? clean.replace(/-/g, "") : (d.isbn?.[0] ?? null),
    page_count: d.number_of_pages_median ?? null,
  }));
}

// --- Indicadores de tempo de leitura --------------------------------------

export type ReadingTimeStats = {
  totalSegundos: number;
  paginasLidas: number;
  sessoes: number;
};

function summarizeReadingSessions(
  rows: Array<{
    duracao_real_segundos: number | null;
    pagina_inicio: number | null;
    pagina_fim: number | null;
  }>,
): ReadingTimeStats {
  const totalSegundos = rows.reduce((acc, r) => acc + (r.duracao_real_segundos ?? 0), 0);
  const paginasLidas = rows.reduce((acc, r) => {
    if (r.pagina_inicio != null && r.pagina_fim != null) {
      return acc + Math.max(0, r.pagina_fim - r.pagina_inicio);
    }
    return acc;
  }, 0);
  return { totalSegundos, paginasLidas, sessoes: rows.length };
}

// Tempo total e ritmo (min/página) só deste livro — usado na tela do livro.
export async function getReadingStatsForBook(userBookId: string): Promise<ReadingTimeStats> {
  const { data, error } = await supabase
    .from("reading_sessions")
    .select("duracao_real_segundos, pagina_inicio, pagina_fim")
    .eq("user_book_id", userBookId)
    .not("finalizado_em", "is", null);
  if (error) throw new Error(error.message);
  return summarizeReadingSessions((data ?? []) as any);
}

// Tempo total e ritmo somando todos os livros do usuário — usado em
// Estatísticas.
export async function getReadingStatsOverall(userId: string): Promise<ReadingTimeStats> {
  const { data, error } = await supabase
    .from("reading_sessions")
    .select("duracao_real_segundos, pagina_inicio, pagina_fim")
    .eq("user_id", userId)
    .not("finalizado_em", "is", null);
  if (error) throw new Error(error.message);
  return summarizeReadingSessions((data ?? []) as any);
}

// --- Sessões de leitura (cronometrada ou livre) --------------------------

export type ReadingSession = {
  id: string;
  user_id: string;
  user_book_id: string;
  modo: "cronometrado" | "livre";
  duracao_planejada_min: number | null;
  pagina_inicio: number | null;
  pagina_fim: number | null;
  duracao_real_segundos: number | null;
  som_ambiente: string | null;
  iniciado_em: string;
  finalizado_em: string | null;
};

// Cria a sessão no momento em que a pessoa toca em "Iniciar leitura".
export async function startReadingSession(input: {
  user_id: string;
  user_book_id: string;
  modo: "cronometrado" | "livre";
  duracao_planejada_min: number | null;
  pagina_inicio: number | null;
}): Promise<ReadingSession> {
  const { data, error } = await supabase
    .from("reading_sessions")
    .insert({
      user_id: input.user_id,
      user_book_id: input.user_book_id,
      modo: input.modo,
      duracao_planejada_min: input.duracao_planejada_min,
      pagina_inicio: input.pagina_inicio,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ReadingSession;
}

// Busca uma sessão específica (usado na tela do cronômetro, que recebe
// só o id da sessão pela URL).
export async function getReadingSession(sessionId: string): Promise<ReadingSession> {
  const { data, error } = await supabase
    .from("reading_sessions")
    .select()
    .eq("id", sessionId)
    .single();
  if (error) throw new Error(error.message);
  return data as ReadingSession;
}

// Atualiza o som ambiente escolhido durante a sessão (pode ser chamado
// várias vezes, se a pessoa trocar de som no meio da leitura).
export async function updateReadingSessionSom(
  sessionId: string,
  somAmbiente: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("reading_sessions")
    .update({ som_ambiente: somAmbiente })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

// Encerra a sessão: grava página final e duração real (em segundos).
export async function finishReadingSession(
  sessionId: string,
  input: { pagina_fim: number | null; duracao_real_segundos: number },
): Promise<void> {
  const { error } = await supabase
    .from("reading_sessions")
    .update({
      pagina_fim: input.pagina_fim,
      duracao_real_segundos: input.duracao_real_segundos,
      finalizado_em: new Date().toISOString(),
    })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

// --- Clubes de leitura (v1: criar, listar, entrar por código) --------------

export type ClubType = "publico" | "privado";

export type Club = {
  id: string;
  nome: string;
  descricao: string | null;
  imagem_url: string | null;
  tipo: ClubType;
  criado_por: string;
  criado_em: string;
};

export type ClubSummary = Club & {
  membros_count: number;
  livro_atual_titulo: string | null;
  livro_atual_capa: string | null;
  meu_papel: "admin" | "membro";
};

// Lista os clubes dos quais o usuário logado participa, já com contagem de
// membros e o livro atual (se houver) — usado na tela de listagem.
export async function listMyClubs(userId: string): Promise<ClubSummary[]> {
  const { data: memberRows, error: memberError } = await supabase
    .from("club_members")
    .select("club_id, papel")
    .eq("user_id", userId);
  if (memberError) throw new Error(memberError.message);
  const myRows = (memberRows ?? []) as Array<{ club_id: string; papel: "admin" | "membro" }>;
  if (myRows.length === 0) return [];

  const clubIds = myRows.map((r) => r.club_id);
  const papelByClub = new Map(myRows.map((r) => [r.club_id, r.papel]));

  const { data: clubRows, error: clubError } = await supabase
    .from("clubs")
    .select("id, nome, descricao, imagem_url, tipo, criado_por, criado_em")
    .in("id", clubIds)
    .order("criado_em", { ascending: false });
  if (clubError) throw new Error(clubError.message);
  const clubs = (clubRows ?? []) as Club[];

  const { data: allMemberRows, error: allMembersError } = await supabase
    .from("club_members")
    .select("club_id")
    .in("club_id", clubIds);
  if (allMembersError) throw new Error(allMembersError.message);
  const countByClub = new Map<string, number>();
  for (const m of (allMemberRows ?? []) as Array<{ club_id: string }>) {
    countByClub.set(m.club_id, (countByClub.get(m.club_id) ?? 0) + 1);
  }

  const { data: bookRows, error: bookError } = await supabase
    .from("club_books")
    .select("club_id, book:books(titulo, capa_url)")
    .in("club_id", clubIds)
    .eq("status", "atual");
  if (bookError) throw new Error(bookError.message);
  const bookByClub = new Map<string, { titulo: string; capa_url: string | null }>();
  for (const b of (bookRows ?? []) as Array<{
    club_id: string;
    book: { titulo: string; capa_url: string | null } | null;
  }>) {
    if (b.book) bookByClub.set(b.club_id, b.book);
  }

  return clubs.map((c) => ({
    ...c,
    membros_count: countByClub.get(c.id) ?? 0,
    livro_atual_titulo: bookByClub.get(c.id)?.titulo ?? null,
    livro_atual_capa: bookByClub.get(c.id)?.capa_url ?? null,
    meu_papel: papelByClub.get(c.id) ?? "membro",
  }));
}

// Atualiza a foto do clube (só funciona se quem chama for admin, por
// causa da política de RLS de clubs). Passe null pra remover a foto.
export async function updateClubImage(clubId: string, imagemUrl: string | null): Promise<void> {
  const { error } = await supabase.from("clubs").update({ imagem_url: imagemUrl }).eq("id", clubId);
  if (error) throw new Error(error.message);
}

export async function createClub(input: {
  nome: string;
  descricao: string | null;
  tipo: ClubType;
  criado_por: string;
}): Promise<Club> {
  const { data, error } = await supabase
    .from("clubs")
    .insert({
      nome: input.nome,
      descricao: input.descricao,
      tipo: input.tipo,
      criado_por: input.criado_por,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  // O criador vira admin automaticamente via trigger no banco
  // (add_creator_as_admin) — não precisamos inserir em club_members aqui.
  return data as Club;
}

// Alfabeto sem 0/O/1/I, pra evitar confusão ao digitar o código à mão.
const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomInviteCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

// Gera um código de convite pro clube (só funciona se quem chama for admin
// do clube, por causa da política de RLS de club_invites).
export async function createClubInvite(clubId: string, criadoPor: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const codigo = randomInviteCode();
    const { error } = await supabase.from("club_invites").insert({
      club_id: clubId,
      codigo,
      criado_por: criadoPor,
    });
    if (!error) return codigo;
    if (error.code !== "23505") throw new Error(error.message);
    // Colidiu com um código já existente — tenta de novo com outro.
  }
  throw new Error("Não foi possível gerar um código de convite. Tente novamente.");
}

// Busca o código de convite mais recente e ainda válido de um clube; se
// não existir nenhum (ou o último já expirou/esgotou), gera um novo. Usado
// pelo botão "Ver código de convite" — o código do toast de criação some
// depois de alguns segundos, então precisamos de um jeito de recuperá-lo.
export async function getOrCreateClubInviteCode(clubId: string, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("club_invites")
    .select("codigo, expira_em, usos_max, usos_atual")
    .eq("club_id", clubId)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as {
    codigo: string;
    expira_em: string | null;
    usos_max: number | null;
    usos_atual: number;
  } | null;
  const aindaValido =
    row &&
    (row.expira_em == null || new Date(row.expira_em) > new Date()) &&
    (row.usos_max == null || row.usos_atual < row.usos_max);
  if (row && aindaValido) return row.codigo;
  return createClubInvite(clubId, userId);
}

// Entra num clube usando um código de convite (chama a função do banco que
// valida expiração/limite de usos e insere o membro numa só transação).
export async function joinClubByCode(codigo: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_club_via_invite", {
    p_codigo: codigo.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export type PublicClubSummary = {
  id: string;
  nome: string;
  descricao: string | null;
  imagem_url: string | null;
  criado_em: string;
  membros_count: number;
  livro_atual_titulo: string | null;
  livro_atual_capa: string | null;
  ja_sou_membro: boolean;
};

// Lista clubes marcados como públicos, com contagem de membros (via RPC,
// já que a policy normal de club_members não deixa ver isso de fora).
export async function listPublicClubs(): Promise<PublicClubSummary[]> {
  const { data, error } = await supabase.rpc("listar_clubes_publicos");
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicClubSummary[];
}

// Entra direto num clube público, sem precisar de código de convite.
export async function joinPublicClub(clubId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("club_members").insert({
    club_id: clubId,
    user_id: userId,
    papel: "membro",
  });
  if (error) throw new Error(error.message);
}

// --- Clube: detalhe, livro atual, membros e mural ---------------------------

export type ClubMember = {
  user_id: string;
  papel: "admin" | "membro";
  entrou_em: string;
  username: string | null;
  nome: string | null;
  avatar_url: string | null;
};

// Nome de exibição de um membro: nome/apelido salvo em "Minha conta", senão
// o username, senão um rótulo genérico.
export function clubMemberDisplayName(m: Pick<ClubMember, "nome" | "username">): string {
  return m.nome || (m.username ? `@${m.username}` : "Leitor do Grifo");
}

export async function listClubMembers(clubId: string): Promise<ClubMember[]> {
  const { data, error } = await supabase.rpc("listar_membros_do_clube", {
    p_club_id: clubId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClubMember[];
}

export type ClubDetail = {
  club: Club;
  meuPapel: "admin" | "membro";
  livroAtualTitulo: string | null;
  livroAtualAutor: string | null;
  livroAtualCapa: string | null;
};

export async function getClubDetail(clubId: string, userId: string): Promise<ClubDetail> {
  const { data: clubRow, error: clubError } = await supabase
    .from("clubs")
    .select("id, nome, descricao, imagem_url, tipo, criado_por, criado_em")
    .eq("id", clubId)
    .single();
  if (clubError) throw new Error(clubError.message);

  const { data: memberRow, error: memberError } = await supabase
    .from("club_members")
    .select("papel")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  if (!memberRow) throw new Error("Você não é membro deste clube.");

  const { data: bookRow, error: bookError } = await supabase
    .from("club_books")
    .select("book:books(titulo, autor, capa_url)")
    .eq("club_id", clubId)
    .eq("status", "atual")
    .maybeSingle();
  if (bookError) throw new Error(bookError.message);
  const book = (
    bookRow as { book: { titulo: string; autor: string | null; capa_url: string | null } | null } | null
  )?.book;

  return {
    club: clubRow as Club,
    meuPapel: (memberRow as { papel: "admin" | "membro" }).papel,
    livroAtualTitulo: book?.titulo ?? null,
    livroAtualAutor: book?.autor ?? null,
    livroAtualCapa: book?.capa_url ?? null,
  };
}

// Define (ou troca) o livro atual do clube, a partir de um resultado de
// busca (mesmo GoogleVolume usado ao adicionar livro na estante). Encerra
// o livro atual anterior (se houver) antes de marcar o novo.
export async function setClubCurrentBook(
  clubId: string,
  volume: GoogleVolume,
  adicionadoPor: string,
): Promise<void> {
  let bookId: string | null = null;

  if (volume.isbn) {
    const { data: existing } = await supabase
      .from("books")
      .select("id")
      .eq("isbn", volume.isbn)
      .maybeSingle();
    bookId = (existing as { id: string } | null)?.id ?? null;
  }

  if (!bookId) {
    const { data, error } = await supabase
      .from("books")
      .insert({
        titulo: volume.title,
        autor: volume.author,
        capa_url: volume.cover_url,
        isbn: volume.isbn,
        total_paginas: volume.page_count,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    bookId = (data as { id: string }).id;
  }

  const { error: encerraError } = await supabase
    .from("club_books")
    .update({ status: "concluido", data_fim_real: new Date().toISOString().slice(0, 10) })
    .eq("club_id", clubId)
    .eq("status", "atual");
  if (encerraError) throw new Error(encerraError.message);

  const { error: insertError } = await supabase.from("club_books").insert({
    club_id: clubId,
    book_id: bookId,
    status: "atual",
    data_inicio: new Date().toISOString().slice(0, 10),
    adicionado_por: adicionadoPor,
  });
  if (insertError) throw new Error(insertError.message);
}

export type ClubRankingEntry = {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  papel: "admin" | "membro";
  paginas_lidas: number;
  segundos_lidos: number;
  tem_livro_na_estante: boolean;
};

// Ranking de leitura do clube: quem mais avançou no livro atual, contando
// só as sessões de leitura (cronômetro/livre) registradas depois que esse
// livro virou o "atual" do clube. Só conta quem tem o mesmo livro (mesmo
// book_id — por isso o match por ISBN em setClubCurrentBook importa) na
// própria estante, já que é de lá que vem o progresso real da pessoa.
export async function getClubRanking(clubId: string): Promise<ClubRankingEntry[]> {
  const members = await listClubMembers(clubId);
  if (members.length === 0) return [];

  const { data: clubBookRow, error: clubBookError } = await supabase
    .from("club_books")
    .select("book_id, data_inicio")
    .eq("club_id", clubId)
    .eq("status", "atual")
    .maybeSingle();
  if (clubBookError) throw new Error(clubBookError.message);
  const clubBook = clubBookRow as { book_id: string; data_inicio: string | null } | null;

  const base: ClubRankingEntry[] = members.map((m) => ({
    user_id: m.user_id,
    nome: clubMemberDisplayName(m),
    avatar_url: m.avatar_url,
    papel: m.papel,
    paginas_lidas: 0,
    segundos_lidos: 0,
    tem_livro_na_estante: false,
  }));

  if (!clubBook) return base;

  const memberIds = members.map((m) => m.user_id);
  const { data: userBookRows, error: userBooksError } = await supabase
    .from("user_books")
    .select("id, user_id")
    .eq("book_id", clubBook.book_id)
    .in("user_id", memberIds);
  if (userBooksError) throw new Error(userBooksError.message);
  const rows = (userBookRows ?? []) as Array<{ id: string; user_id: string }>;
  if (rows.length === 0) return base;

  const userIdByUserBookId = new Map(rows.map((r) => [r.id, r.user_id]));
  const userBookIds = rows.map((r) => r.id);

  let sessionsQuery = supabase
    .from("reading_sessions")
    .select("user_book_id, pagina_inicio, pagina_fim, duracao_real_segundos")
    .in("user_book_id", userBookIds)
    .not("finalizado_em", "is", null);
  if (clubBook.data_inicio) {
    sessionsQuery = sessionsQuery.gte("iniciado_em", clubBook.data_inicio);
  }
  const { data: sessionRows, error: sessionsError } = await sessionsQuery;
  if (sessionsError) throw new Error(sessionsError.message);

  const porUsuario = new Map<string, { paginas: number; segundos: number }>();
  for (const s of (sessionRows ?? []) as Array<{
    user_book_id: string;
    pagina_inicio: number | null;
    pagina_fim: number | null;
    duracao_real_segundos: number | null;
  }>) {
    const userId = userIdByUserBookId.get(s.user_book_id);
    if (!userId) continue;
    const paginas =
      s.pagina_inicio != null && s.pagina_fim != null
        ? Math.max(0, s.pagina_fim - s.pagina_inicio)
        : 0;
    const atual = porUsuario.get(userId) ?? { paginas: 0, segundos: 0 };
    porUsuario.set(userId, {
      paginas: atual.paginas + paginas,
      segundos: atual.segundos + (s.duracao_real_segundos ?? 0),
    });
  }

  const temLivroSet = new Set(rows.map((r) => r.user_id));

  return base
    .map((entry) => {
      const agregado = porUsuario.get(entry.user_id);
      return {
        ...entry,
        paginas_lidas: agregado?.paginas ?? 0,
        segundos_lidos: agregado?.segundos ?? 0,
        tem_livro_na_estante: temLivroSet.has(entry.user_id),
      };
    })
    .sort((a, b) => b.paginas_lidas - a.paginas_lidas || b.segundos_lidos - a.segundos_lidos);
}

export type ClubEvent = {
  id: string;
  club_id: string;
  titulo: string;
  descricao: string | null;
  data_hora: string;
  local_ou_link: string | null;
  criado_por: string;
  criado_em: string;
};

// Lista os eventos do clube, dos mais próximos pros mais distantes no
// tempo (passados ficam no fim — a UI separa visualmente por data atual).
export async function listClubEvents(clubId: string): Promise<ClubEvent[]> {
  const { data, error } = await supabase
    .from("club_events")
    .select("id, club_id, titulo, descricao, data_hora, local_ou_link, criado_por, criado_em")
    .eq("club_id", clubId)
    .order("data_hora", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClubEvent[];
}

export async function createClubEvent(input: {
  club_id: string;
  titulo: string;
  descricao: string | null;
  data_hora: string;
  local_ou_link: string | null;
  criado_por: string;
}): Promise<void> {
  const { error } = await supabase.from("club_events").insert({
    club_id: input.club_id,
    titulo: input.titulo,
    descricao: input.descricao,
    data_hora: input.data_hora,
    local_ou_link: input.local_ou_link,
    criado_por: input.criado_por,
  });
  if (error) throw new Error(error.message);
}

export async function deleteClubEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from("club_events").delete().eq("id", eventId);
  if (error) throw new Error(error.message);
}

export type ClubPost = {
  id: string;
  user_id: string;
  conteudo: string;
  pagina_referencia: number | null;
  criado_em: string;
  likes_count: number;
  curtido_por_mim: boolean;
  // ids de quem curtiu — usado pra mostrar "fulano e mais 2 curtiram".
  curtido_por: string[];
};

export async function listClubPosts(clubId: string, userId: string): Promise<ClubPost[]> {
  const { data, error } = await supabase
    .from("club_posts")
    .select("id, user_id, conteudo, pagina_referencia, criado_em, club_post_likes(user_id)")
    .eq("club_id", clubId)
    .order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    user_id: string;
    conteudo: string;
    pagina_referencia: number | null;
    criado_em: string;
    club_post_likes: Array<{ user_id: string }> | null;
  }>;
  return rows.map((r) => {
    const curtidores = (r.club_post_likes ?? []).map((l) => l.user_id);
    return {
      id: r.id,
      user_id: r.user_id,
      conteudo: r.conteudo,
      pagina_referencia: r.pagina_referencia,
      criado_em: r.criado_em,
      likes_count: curtidores.length,
      curtido_por_mim: curtidores.includes(userId),
      curtido_por: curtidores,
    };
  });
}

export async function addClubPost(input: {
  club_id: string;
  user_id: string;
  conteudo: string;
  pagina_referencia: number | null;
}): Promise<void> {
  const { error } = await supabase.from("club_posts").insert({
    club_id: input.club_id,
    user_id: input.user_id,
    conteudo: input.conteudo,
    pagina_referencia: input.pagina_referencia,
  });
  if (error) throw new Error(error.message);
}

export async function deleteClubPost(postId: string): Promise<void> {
  const { error } = await supabase.from("club_posts").delete().eq("id", postId);
  if (error) throw new Error(error.message);
}

export type ClubComment = {
  id: string;
  post_id: string;
  user_id: string;
  conteudo: string;
  criado_em: string;
};

export async function listClubPostComments(postId: string): Promise<ClubComment[]> {
  const { data, error } = await supabase
    .from("club_post_comments")
    .select("id, post_id, user_id, conteudo, criado_em")
    .eq("post_id", postId)
    .order("criado_em", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClubComment[];
}

export async function addClubPostComment(input: {
  post_id: string;
  user_id: string;
  conteudo: string;
}): Promise<void> {
  const { error } = await supabase.from("club_post_comments").insert({
    post_id: input.post_id,
    user_id: input.user_id,
    conteudo: input.conteudo,
  });
  if (error) throw new Error(error.message);
}

export async function deleteClubPostComment(commentId: string): Promise<void> {
  const { error } = await supabase.from("club_post_comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);
}

export async function toggleClubPostLike(
  postId: string,
  userId: string,
  curtidoAtualmente: boolean,
): Promise<void> {
  if (curtidoAtualmente) {
    const { error } = await supabase
      .from("club_post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("club_post_likes")
      .insert({ post_id: postId, user_id: userId });
    if (error) throw new Error(error.message);
  }
}
