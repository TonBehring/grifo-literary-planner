import { supabase } from "@/integrations/supabase/client";

// Releitura: as leituras já concluídas de um livro ficam em
// user_book_readings; a leitura atual continua em user_books.

export type BookReading = {
  id: string;
  data_inicio: string | null;
  data_conclusao: string | null;
};

export async function listBookReadings(userBookId: string): Promise<BookReading[]> {
  const { data, error } = await supabase
    .from("user_book_readings")
    .select("id, data_inicio, data_conclusao")
    .eq("user_book_id", userBookId)
    .order("criado_em", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BookReading[];
}

// Guarda a leitura concluída no histórico e volta o livro para "Lendo".
export async function rereadBook(userBookId: string): Promise<void> {
  const { error } = await supabase.rpc("reler_livro", { p_user_book_id: userBookId });
  if (error) throw new Error(error.message);
}

export type FinishedReadingRow = {
  id: string;
  data_inicio: string | null;
  data_conclusao: string | null;
  nota: number | null;
  resenha: string | null;
  book: { titulo: string | null; total_paginas: number | null; genero: string | null } | null;
};

// Leituras anteriores no mesmo formato das estatísticas. Nota e resenha
// ficam só na leitura atual (uma por livro), para não contar em dobro.
export async function listArchivedReadingsForStats(
  userId: string,
  year?: number,
): Promise<FinishedReadingRow[]> {
  let query = supabase
    .from("user_book_readings")
    .select("id, data_inicio, data_conclusao, user_book:user_books(book:books(titulo, total_paginas, genero))")
    .eq("user_id", userId);
  if (year) {
    query = query.gte("data_conclusao", `${year}-01-01`).lte("data_conclusao", `${year}-12-31`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{
    id: string;
    data_inicio: string | null;
    data_conclusao: string | null;
    user_book: { book: FinishedReadingRow["book"] } | null;
  }>).map((r) => ({
    id: r.id,
    data_inicio: r.data_inicio,
    data_conclusao: r.data_conclusao,
    nota: null,
    resenha: null,
    book: r.user_book?.book ?? null,
  }));
}
