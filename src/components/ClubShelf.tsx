import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Library, Plus, RotateCcw, Star } from "lucide-react";
import { toast } from "sonner";
import { BookCover } from "@/components/BookCover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHasActiveSubscription } from "@/components/SubscriptionGate";
import {
  addClubBookToMyShelf,
  getClubShelf,
  getMyUserBookIds,
  reopenClubBook,
  type ClubShelfItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

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
  if (!avaliacoes) return "Sem avaliações ainda";
  // Avaliação do clube ainda aberta e eu não avaliei: a nota fica escondida.
  if (media === null) return `${avaliacoes} ${avaliacoes === 1 ? "avaliação" : "avaliações"} · avalie para ver`;
  const n = Number(media).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${n} · ${avaliacoes} ${avaliacoes === 1 ? "avaliação" : "avaliações"}`;
}

export function ClubShelf({
  clubId,
  souAdmin = false,
  livroAtualTitulo = null,
  onChanged,
  ocultarSeVazia = false,
}: {
  clubId: string;
  souAdmin?: boolean;
  livroAtualTitulo?: string | null;
  onChanged?: () => void;
  ocultarSeVazia?: boolean;
}) {
  const shelf = useQuery({ queryKey: ["club-shelf", clubId], queryFn: () => getClubShelf(clubId) });
  const [voltando, setVoltando] = useState<ClubShelfItem | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Toque num livro da estante: abre o livro na estante da pessoa; se ela não
  // tiver, oferece adicionar (assinante) ou convida para assinar.
  const { user } = useAuth();
  const { active: assinante } = useHasActiveSubscription();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bookIds = (shelf.data ?? []).map((b) => b.book_id);
  const meus = useQuery({
    queryKey: ["club-shelf-mine", clubId, user?.id ?? "", bookIds.join(",")],
    queryFn: () => getMyUserBookIds(user!.id, bookIds),
    enabled: Boolean(user) && bookIds.length > 0,
  });
  const [escolhido, setEscolhido] = useState<ClubShelfItem | null>(null);
  const [adicionando, setAdicionando] = useState(false);

  if (ocultarSeVazia && shelf.data && shelf.data.length === 0) return null;

  function abrirLivro(b: ClubShelfItem) {
    const meuId = meus.data?.[b.book_id];
    if (meuId) {
      navigate({ to: "/livro/$id", params: { id: meuId } });
      return;
    }
    setEscolhido(b);
  }

  async function adicionar(status: "quero_ler" | "lido") {
    if (!user || !escolhido) return;
    setAdicionando(true);
    try {
      const id = await addClubBookToMyShelf(escolhido.book_id, user.id, status);
      toast.success(`"${escolhido.titulo}" está na sua estante.`);
      void queryClient.invalidateQueries({ queryKey: ["club-shelf-mine", clubId] });
      setEscolhido(null);
      navigate({ to: "/livro/$id", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível adicionar à estante");
    } finally {
      setAdicionando(false);
    }
  }

  async function voltarParaLendo() {
    if (!voltando) return;
    setSalvando(true);
    try {
      await reopenClubBook(voltando.club_book_id);
      toast.success(`"${voltando.titulo}" voltou a ser a leitura do clube.`);
      setVoltando(null);
      onChanged?.();
      void shelf.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível voltar para lendo");
    } finally {
      setSalvando(false);
    }
  }

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
                <button
                  type="button"
                  onClick={() => abrirLivro(b)}
                  className="block w-full text-left"
                  aria-label={`Abrir ${b.titulo}`}
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                    <BookCover src={b.capa_url} title={b.titulo} />
                    {meus.data?.[b.book_id] && (
                      <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium">
                        <Check className="h-3 w-3" />
                        Na sua estante
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm font-medium">{b.titulo}</p>
                  {b.autor && <p className="truncate text-xs text-muted-foreground">{b.autor}</p>}
                </button>
                <p className="text-xs text-muted-foreground">{formatShelfPeriod(b.data_inicio, b.data_fim)}</p>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  {b.avaliacoes > 0 && b.nota_media !== null && (
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
                {souAdmin && (
                  <button
                    type="button"
                    onClick={() => setVoltando(b)}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Voltar para lendo
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={escolhido !== null} onOpenChange={(open) => !open && !adicionando && setEscolhido(null)}>
        <DialogContent className="max-w-sm">
          {escolhido && (
            <>
              <DialogHeader>
                <DialogTitle>{escolhido.titulo}</DialogTitle>
                <DialogDescription>
                  {escolhido.autor ? `${escolhido.autor}. ` : ""}
                  {assinante
                    ? "Este livro ainda não está na sua estante."
                    : "Para guardar este livro na sua estante e acompanhar suas leituras, assine o Grifo."}
                </DialogDescription>
              </DialogHeader>
              <div className="mx-auto h-40 w-28 overflow-hidden rounded-lg bg-muted">
                <BookCover src={escolhido.capa_url} title={escolhido.titulo} />
              </div>
              {assinante ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void adicionar("quero_ler")}
                    disabled={adicionando}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    {adicionando ? "Adicionando…" : "Adicionar como Quero ler"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void adicionar("lido")}
                    disabled={adicionando}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium disabled:opacity-60"
                  >
                    <BookOpen className="h-4 w-4" />
                    Já li este livro
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    to="/conta"
                    className="inline-flex items-center justify-center rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground"
                  >
                    Assinar o Grifo
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEscolhido(null)}
                    className="rounded-full border border-border py-3 text-sm font-medium"
                  >
                    Agora não
                  </button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={voltando !== null} onOpenChange={(open) => !open && setVoltando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Voltar para lendo</AlertDialogTitle>
            <AlertDialogDescription>
              {livroAtualTitulo && livroAtualTitulo !== voltando?.titulo
                ? `"${voltando?.titulo}" volta a ser a leitura do clube, e "${livroAtualTitulo}" vai para a estante.`
                : `"${voltando?.titulo}" volta a ser a leitura atual do clube e sai da estante.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={salvando}
              onClick={(e) => {
                e.preventDefault();
                void voltarParaLendo();
              }}
            >
              {salvando ? "Voltando…" : "Voltar para lendo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
