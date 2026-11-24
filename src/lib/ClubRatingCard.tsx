import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { BookCover } from "@/components/BookCover";
import { StarRating } from "@/components/StarRating";
import { ShareClubReadDialog } from "@/components/ShareClubReadDialog";
import { getClubRatingSummary, getOpenClubRating, rateClubBook } from "@/lib/club-ratings";

function media(n: number | null): string {
  return n == null ? "-" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function fechamento(iso: string | null): string {
  if (!iso) return "Fica aberta até o clube começar a próxima leitura.";
  const d = new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `A avaliação fecha em ${d}.`;
}

// Cartão "Avalie a leitura do clube", que aparece depois que o admin conclui
// a leitura e some quando a avaliação fecha (início da próxima leitura).
export function ClubRatingCard({ clubId }: { clubId: string }) {
  const queryClient = useQueryClient();
  const aberta = useQuery({ queryKey: ["club-rating-open", clubId], queryFn: () => getOpenClubRating(clubId) });
  const clubBookId = aberta.data ?? null;
  const resumo = useQuery({
    queryKey: ["club-rating", clubBookId],
    queryFn: () => getClubRatingSummary(clubBookId!),
    enabled: Boolean(clubBookId),
  });
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");
  const [editando, setEditando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const r = resumo.data;
  if (!clubBookId || !r) return null;

  const jaAvaliei = r.minha_nota != null;
  const mostrarFormulario = r.janela_aberta && (!jaAvaliei || editando);

  function abrirEdicao() {
    setNota(r?.minha_nota ?? 0);
    setComentario(r?.meu_comentario ?? "");
    setEditando(true);
  }

  async function enviar() {
    if (!clubBookId) return;
    if (nota < 1) {
      toast.error("Escolha de 1 a 5 estrelas.");
      return;
    }
    setEnviando(true);
    try {
      await rateClubBook(clubBookId, nota, comentario);
      toast.success(jaAvaliei ? "Avaliação atualizada." : "Avaliação enviada! Veja o que o clube achou.");
      setEditando(false);
      void queryClient.invalidateQueries({ queryKey: ["club-rating", clubBookId] });
      void queryClient.invalidateQueries({ queryKey: ["club-shelf", clubId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a avaliação");
    } finally {
      setEnviando(false);
    }
  }

  const cabecalho = (
    <div className="flex items-center gap-3">
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
        <BookCover src={r.capa_url} title={r.titulo} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-[#85651C]">Avaliação do clube</p>
        <p className="font-display truncate text-base">{r.titulo}</p>
        {r.autor && <p className="truncate text-xs text-muted-foreground">{r.autor}</p>}
      </div>
    </div>
  );

  if (mostrarFormulario) {
    return (
      <div className="panel-cream mt-4 rounded-2xl border border-[#85651C]/30 p-4">
        {cabecalho}
        <p className="mt-3 text-sm">
          {jaAvaliei ? "Mude a sua nota, se quiser." : "O clube terminou esta leitura. Qual a sua nota?"}
        </p>
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Sua nota">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={nota === n}
              aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
              onClick={() => setNota(n)}
              className="p-1"
            >
              <Star className={"h-8 w-8 " + (n <= nota ? "fill-primary text-primary" : "text-primary/35")} />
            </button>
          ))}
        </div>
        <label htmlFor="club-rating-comment" className="mt-3 block text-xs text-muted-foreground">
          O que você achou, em uma frase? (opcional)
        </label>
        <textarea
          id="club-rating-comment"
          value={comentario}
          onChange={(e) => setComentario(e.target.value.slice(0, 280))}
          rows={2}
          className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <p className="text-right text-[11px] text-muted-foreground">{comentario.length}/280</p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={enviando}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {enviando ? "Enviando…" : jaAvaliei ? "Salvar" : "Enviar avaliação"}
          </button>
          {editando && (
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="text-sm text-muted-foreground underline underline-offset-4"
            >
              Cancelar
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {r.avaliaram} de {r.total_membros} {r.total_membros === 1 ? "membro já avaliou" : "membros já avaliaram"}.
          {!jaAvaliei && " A nota do clube e os comentários aparecem depois que você avaliar."}{" "}
          {fechamento(r.fecha_em)}
        </p>
      </div>
    );
  }

  // Resultado (já avaliei, ou a avaliação fechou)
  const dist = r.distribuicao ?? [0, 0, 0, 0, 0];
  const maior = Math.max(1, ...dist);
  return (
    <div className="panel-cream mt-4 rounded-2xl p-4">
      {cabecalho}
      {r.revelado && r.media != null ? (
        <>
          <div className="mt-4 flex items-center gap-4">
            <p className="font-display text-4xl">{media(r.media)}</p>
            <div>
              <StarRating value={Number(r.media)} size="sm" />
              <p className="mt-1 text-xs text-muted-foreground">
                {r.avaliaram} de {r.total_membros} {r.total_membros === 1 ? "membro avaliou" : "membros avaliaram"}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-1">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-3 text-right">{n}</span>
                <Star className="h-3 w-3 fill-primary text-primary" />
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${((dist[n - 1] ?? 0) / maior) * 100}%` }}
                  />
                </span>
                <span className="w-4">{dist[n - 1] ?? 0}</span>
              </div>
            ))}
          </div>
          {(r.avaliacoes ?? []).some((a) => a.comentario) && (
            <div className="mt-4 flex flex-col gap-3">
              {(r.avaliacoes ?? [])
                .filter((a) => a.comentario)
                .map((a) => (
                  <div key={a.user_id} className="flex items-start gap-2">
                    {a.avatar_url ? (
                      <img src={a.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                        {a.nome.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs font-medium">
                        {a.nome}
                        <StarRating value={a.nota} size="sm" />
                      </p>
                      <p className="text-sm text-muted-foreground">{a.comentario}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Ninguém avaliou esta leitura.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/50 pt-3">
        {jaAvaliei && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Sua nota: <StarRating value={r.minha_nota ?? 0} size="sm" />
          </span>
        )}
        {jaAvaliei && r.janela_aberta && (
          <button
            type="button"
            onClick={abrirEdicao}
            className="text-xs font-medium text-[#85651C] underline underline-offset-4"
          >
            Mudar minha nota
          </button>
        )}
      </div>
      <div className="mt-3">
        <ShareClubReadDialog
          input={{
            titulo: r.titulo,
            autor: r.autor,
            capaUrl: r.capa_url,
            clube: r.clube,
            minhaNota: r.minha_nota,
            mediaClube: r.revelado ? r.media : null,
          }}
        />
      </div>
      {r.janela_aberta && <p className="mt-3 text-xs text-muted-foreground">{fechamento(r.fecha_em)}</p>}
    </div>
  );
}
