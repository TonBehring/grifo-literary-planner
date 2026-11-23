import { useQuery } from "@tanstack/react-query";
import { Library, Star } from "lucide-react";
import { BookCover } from "@/components/BookCover";
import { getClubShelf } from "@/lib/api";

function ddmm(iso: string) {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}
function full(iso: string) {
  const [y] = iso.slice(0, 10).split("-");
  return `${ddmm(iso)}/${y}`;
}

export function formatShelfPeriod(inicio: string, fim: string | null): string {
  if (!fim) return `desde ${full(inicio)}`;
  return inicio.slice(0, 4) === fim.slice(0, 4) ? `${ddmm(inicio)} a ${full(fim)}` : `${full(inicio)} a ${full(fim)}`;
}

export function formatShelfRating(media: number | string | null, avaliacoes: number): string {
  if (!avaliacoes || media === null) return "Sem avaliações ainda";
  const n = Number(media).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${n} · ${avaliacoes} ${avaliacoes === 1 ? "avaliação" : "avaliações"}`;
}

export function ClubShelf({ clubId }: { clubId: string }) {
  const shelf = useQuery({ queryKey: ["club-shelf", clubId], queryFn: () => getClubShelf(clubId) });
  return (
    <div className="panel-cream mt-4 rounded-2xl p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Library className="h-4 w-4" />
        Estante do clube
      </p>
      {shelf.isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">Carregando…</p>
      ) : !shelf.data || shelf.data.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Quando o clube terminar uma leitura, ela aparece aqui.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shelf.data.map((b) => {
            const media = b.nota_media === null ? 0 : Number(b.nota_media);
            return (
              <div key={b.club_book_id} data-testid="shelf-item" className="min-w-0">
                <div className="aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                  <BookCover src={b.capa_url} title={b.titulo} />
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm font-medium">{b.titulo}</p>
                {b.autor && <p className="truncate text-xs text-muted-foreground">{b.autor}</p>}
                <p className="text-xs text-muted-foreground">{formatShelfPeriod(b.data_inicio, b.data_fim)}</p>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  {b.avaliacoes > 0 && (
                    <span className="flex" aria-hidden>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={"h-3 w-3 " + (i <= Math.round(media) ? "fill-primary text-primary" : "text-muted-foreground")} />
                      ))}
                    </span>
                  )}
                  <span>{formatShelfRating(b.nota_media, b.avaliacoes)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {b.membros_que_leram} {b.membros_que_leram === 1 ? "membro leu" : "membros leram"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
