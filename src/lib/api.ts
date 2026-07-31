import { supabase } from "@/integrations/supabase/client";
import type { BookFormat, BookNote, Loan, ShelfStatus, UserBook } from "./types";

const USER_BOOK_SELECT =
  "id, user_id, book_id, status, format, current_page, total_pages, progress_percent, rating, review, is_favorite, started_at, finished_at, book:books(id, title, author, cover_url, isbn, page_count)";

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export async function listUserBooks(status?: ShelfStatus): Promise<UserBook[]> {
  let query = supabase.from("user_books").select(USER_BOOK_SELECT);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("created_at", { ascending: false });
  return (unwrap(data, error) ?? []) as unknown as UserBook[];
}

export async function getUserBook(id: string): Promise<UserBook> {
  const { data, error } = await supabase
    .from("user_books")
    .select(USER_BOOK_SELECT)
    .eq("id", id)
    .single();
  return unwrap(data, error) as unknown as UserBook;
}

export async function updateUserBook(id: string, patch: Partial<UserBook>) {
  const { error } = await supabase.from("user_books").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export type NewBookInput = {
  title: string;
  author: string | null;
  cover_url: string | null;
  isbn: string | null;
  page_count: number | null;
  status: ShelfStatus;
  format: BookFormat;
};

export async function addBookToShelf(input: NewBookInput, userId: string) {
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
        title: input.title,
        author: input.author,
        cover_url: input.cover_url,
        isbn: input.isbn,
        page_count: input.page_count,
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
      format: input.format,
      current_page: 0,
      total_pages: input.page_count,
      progress_percent: 0,
      started_at: input.status === "lendo" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  return (unwrap(data, error) as { id: string }).id;
}

export async function listNotes(userBookId: string): Promise<BookNote[]> {
  const { data, error } = await supabase
    .from("book_notes")
    .select("id, user_book_id, content, kind, page, created_at")
    .eq("user_book_id", userBookId)
    .order("created_at", { ascending: false });
  return (unwrap(data, error) ?? []) as unknown as BookNote[];
}

export async function addNote(note: {
  user_book_id: string;
  user_id: string;
  content: string;
  kind: "nota" | "citacao";
  page: number | null;
}) {
  const { error } = await supabase.from("book_notes").insert(note);
  if (error) throw new Error(error.message);
}

export async function addReadingLog(log: {
  user_book_id: string;
  user_id: string;
  mood: string;
  pages_read: number | null;
}) {
  const { error } = await supabase.from("reading_logs").insert(log);
  if (error) throw new Error(error.message);
}

export async function listLoans(): Promise<Loan[]> {
  const { data, error } = await supabase
    .from("loans")
    .select("id, user_id, direction, person_name, book_title, due_date, returned")
    .order("due_date", { ascending: true });
  return (unwrap(data, error) ?? []) as unknown as Loan[];
}

export async function addLoan(loan: Omit<Loan, "id">) {
  const { error } = await supabase.from("loans").insert(loan);
  if (error) throw new Error(error.message);
}

export async function setLoanReturned(id: string, returned: boolean) {
  const { error } = await supabase.from("loans").update({ returned }).eq("id", id);
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

export async function searchGoogleBooks(term: string): Promise<GoogleVolume[]> {
  const isIsbn = /^[\d-]{10,17}$/.test(term.trim());
  const q = isIsbn ? `isbn:${term.replace(/-/g, "")}` : term;
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?maxResults=20&q=${encodeURIComponent(q)}`,
  );
  if (!res.ok) throw new Error("Não foi possível buscar no Google Books");
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
  return (json.items ?? []).map((item) => {
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
}