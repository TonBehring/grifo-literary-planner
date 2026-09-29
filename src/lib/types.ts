export type BookFormat = "fisico" | "ebook" | "audiobook";
export type ShelfStatus = "lendo" | "quero_ler" | "lido" | "desejo_compra" | "abandonado";

export type Book = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  isbn: string | null;
  page_count: number | null;
  genre: string | null;
};

export const GENRE_OPTIONS = [
  "Religioso",
  "Literatura",
  "Romance",
  "Ficção Científica",
  "Fantasia",
  "Autoajuda",
  "Biografia",
  "Infantil",
  "Técnico/Acadêmico",
  "Outro",
] as const;

export type UserBook = {
  id: string;
  user_id: string;
  book_id: string;
  status: ShelfStatus;
  format: BookFormat;
  current_page: number | null;
  total_pages: number | null;
  progress_percent: number | null;
  rating: number | null;
  review: string | null;
  abandon_reason: string | null;
  is_favorite: boolean | null;
  started_at: string | null;
  finished_at: string | null;
  origem_emprestimo_id: string | null;
  book: Book | null;
};

export type BookNote = {
  id: string;
  user_book_id: string;
  content: string;
  kind: "nota" | "citacao";
  page: number | null;
  created_at: string;
};

export type ReadingLog = {
  id: string;
  user_book_id: string;
  mood: string | null;
  pages_read: number | null;
  created_at: string;
};

export type Loan = {
  id: string;
  user_id: string;
  linked_user_id: string | null;
  user_book_id: string | null;
  book_id: string | null;
  direction: "emprestei" | "peguei_emprestado";
  person_name: string;
  book_title: string;
  due_date: string | null;
  returned: boolean | null;
  is_owner: boolean;
  aceito: boolean;
  copia_user_book_id: string | null;
};

export const FORMAT_LABEL: Record<BookFormat, string> = {
  fisico: "Físico",
  ebook: "Ebook",
  audiobook: "Audiobook",
};

export const STATUS_LABEL: Record<ShelfStatus, string> = {
  lendo: "Lendo",
  quero_ler: "Quero Ler",
  lido: "Lidos",
  desejo_compra: "Quero comprar",
  abandonado: "Abandonado",
};

export function progressOf(ub: Pick<UserBook, "format" | "current_page" | "total_pages" | "progress_percent" | "status">) {
  if (ub.status === "lido") return 100;
  if (ub.format === "fisico" && ub.total_pages && ub.current_page != null) {
    return Math.min(100, Math.round((ub.current_page / ub.total_pages) * 100));
  }
  return Math.min(100, Math.round(ub.progress_percent ?? 0));
}
