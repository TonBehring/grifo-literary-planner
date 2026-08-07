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
      data_inicio: input.status === "lendo" ? new Date().toISOString() : null,
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
  if (patch.content !== undefined) payload.conteudo = patch.content;
  if (patch.page !== undefined) payload.pagina_referencia = patch.page;
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
  mood: string;
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
  });
  if (error) throw new Error(error.message);
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
