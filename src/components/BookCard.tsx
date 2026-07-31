import { Link } from "@tanstack/react-router";
import { FORMAT_LABEL, progressOf, type UserBook } from "@/lib/types";

export function BookCard({ userBook }: { userBook: UserBook }) {
  const pct = progressOf(userBook);
  const book = userBook.book;

  return (
    <Link
      to="/livro/$id"
      params={{ id: userBook.id }}
      className="card-teal flex gap-4 rounded-2xl p-4 transition-transform hover:-translate-y-0.5"
    >
      <div className="h-28 w-20 shrink-0 overflow-hidden rounded-md bg-teal-deep">
        {book?.cover_url ? (
          <img
            src={book.cover_url}
            alt={`Capa de ${book.title}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-xl text-primary">
            {book?.title?.[0] ?? "?"}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] tracking-[0.18em] text-primary uppercase">
          {FORMAT_LABEL[userBook.format] ?? userBook.format}
        </p>
        <h3 className="font-display mt-1 truncate text-lg leading-snug">
          {book?.title ?? "Sem título"}
        </h3>
        <p className="truncate text-sm opacity-70">{book?.author ?? "Autor desconhecido"}</p>

        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs opacity-80">
            <span>
              {userBook.format === "fisico" && userBook.total_pages
                ? `pág. ${userBook.current_page ?? 0} de ${userBook.total_pages}`
                : `${pct}% concluído`}
            </span>
            <span className="text-primary">{pct}%</span>
          </div>
        </div>
      </div>
    </Link>
  );
}