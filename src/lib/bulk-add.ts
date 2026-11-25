// Cadastro de vários livros de uma vez (página /adicionar/lote).

import { supabase } from "@/integrations/supabase/client";
import { addBookToShelf, GOOGLE_BOOKS_KEY, normalizeTitle, type GoogleVolume } from "@/lib/api";
import type { BookFormat, ShelfStatus } from "@/lib/types";

export const LOTE_MAXIMO = 60;
const POR_PAGINA = 40;

type GoogleBooksJson = {
  totalItems?: number;
  items?: Array<{
    id: string;
    volumeInfo?: {
      title?: string;
      subtitle?: string;
      authors?: string[];
      pageCount?: number;
      language?: string;
      imageLinks?: { thumbnail?: string };
      industryIdentifiers?: Array<{ type?: string; identifier: string }>;
    };
  }>;
};

export type AuthorPage = { items: GoogleVolume[]; temMais: boolean; proximo: number };

/** Livros de um autor no Google Books, 40 por página, em português primeiro. */
export async function searchBooksByAuthor(nome: string, inicio = 0): Promise<AuthorPage> {
  const q = `inauthor:"${nome.trim().replace(/"/g, "")}"`;
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?maxResults=${POR_PAGINA}&startIndex=${inicio}&printType=books&country=BR&orderBy=relevance&key=${GOOGLE_BOOKS_KEY}&q=${encodeURIComponent(q)}`,
  );
  if (!res.ok) throw new Error("Não foi possível buscar agora. Tente de novo em instantes.");
  const json = (await res.json()) as GoogleBooksJson;
  const brutos = json.items ?? [];
  const items: GoogleVolume[] = brutos.map((item) => {
    const v = item.volumeInfo ?? {};
    const ids = v.industryIdentifiers ?? [];
    const isbn =
      ids.find((i) => i.type === "ISBN_13")?.identifier ??
      ids.find((i) => i.type === "ISBN_10")?.identifier ??
      null;
    return {
      id: item.id,
      title: v.title ?? "Sem título",
      author: v.authors?.join(", ") ?? null,
      cover_url: v.imageLinks?.thumbnail?.replace("http://", "https://") ?? null,
      isbn,
      page_count: v.pageCount ?? null,
      language: v.language ?? null,
    };
  });
  const proximo = inicio + brutos.length;
  return {
    items,
    temMais: brutos.length === POR_PAGINA && proximo < (json.totalItems ?? 0),
    proximo,
  };
}

/**
 * Junta edições repetidas do mesmo título (o Google Books costuma trazer
 * várias). Fica a edição em português, com capa e com ISBN, nessa ordem.
 */
export function dedupeByTitle(lista: GoogleVolume[]): GoogleVolume[] {
  const pontos = (v: GoogleVolume) =>
    ((v.language ?? "").toLowerCase().startsWith("pt") ? 4 : 0) + (v.cover_url ? 2 : 0) + (v.isbn ? 1 : 0);
  const porTitulo = new Map<string, GoogleVolume>();
  for (const v of lista) {
    const chave = normalizeTitle(v.title);
    const atual = porTitulo.get(chave);
    if (!atual || pontos(v) > pontos(atual)) porTitulo.set(chave, v);
  }
  return [...porTitulo.values()].sort((a, b) => pontos(b) - pontos(a));
}

export type ShelfKeys = { isbns: Set<string>; titulos: Set<string> };

/** ISBNs e títulos que a pessoa já tem na estante, para marcar "já está na estante". */
export async function getMyShelfKeys(userId: string): Promise<ShelfKeys> {
  const { data, error } = await supabase
    .from("user_books")
    .select("book:books(isbn, titulo)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Array<{ book: { isbn: string | null; titulo: string } | null }>;
  const isbns = new Set<string>();
  const titulos = new Set<string>();
  for (const r of rows) {
    if (r.book?.isbn) isbns.add(r.book.isbn.replace(/[^0-9Xx]/g, ""));
    if (r.book?.titulo) titulos.add(normalizeTitle(r.book.titulo));
  }
  return { isbns, titulos };
}

export function isOnShelf(v: GoogleVolume, keys: ShelfKeys | undefined): boolean {
  if (!keys) return false;
  if (v.isbn && keys.isbns.has(v.isbn.replace(/[^0-9Xx]/g, ""))) return true;
  return keys.titulos.has(normalizeTitle(v.title));
}

export type BatchResult = { adicionados: number; jaTinha: number; falhas: string[] };

/** Adiciona os livros um por um, avisando o progresso. */
export async function addBooksInBatch(
  livros: GoogleVolume[],
  opcoes: { status: ShelfStatus; format: BookFormat },
  userId: string,
  onProgress?: (feitos: number, total: number) => void,
): Promise<BatchResult> {
  const resultado: BatchResult = { adicionados: 0, jaTinha: 0, falhas: [] };
  let feitos = 0;
  for (const livro of livros) {
    try {
      const { alreadyExists } = await addBookToShelf(
        {
          ...livro,
          genre: null,
          status: opcoes.status,
          format: opcoes.format,
        },
        userId,
      );
      if (alreadyExists) resultado.jaTinha += 1;
      else resultado.adicionados += 1;
    } catch {
      resultado.falhas.push(livro.title);
    }
    feitos += 1;
    onProgress?.(feitos, livros.length);
  }
  return resultado;
}
