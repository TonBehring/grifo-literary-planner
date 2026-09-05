import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Quote, Share2, StickyNote, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import { BookEditPanel } from "@/components/BookEditPanel";
import { CelebrationModal } from "@/components/CelebrationModal";
import { MoodPicker } from "@/components/MoodPicker";
import { NoteEditorModal } from "@/components/NoteEditorModal";
import { StarRating } from "@/components/StarRating";
import { SubscriptionRequiredNotice, useHasActiveSubscription } from "@/components/SubscriptionGate";
import { renderFormattedText } from "@/lib/note-format";
import {
  addNote,
  addReadingLog,
  deleteNote,
  deleteUserBook,
  getActiveLoanForUserBook,
  getUserBook,
  listNotes,
  updateNote,
  updateUserBook,
} from "@/lib/api";
import { FORMAT_LABEL, STATUS_LABEL, progressOf, type BookFormat, type BookNote, type ShelfStatus, type UserBook } from "@/lib/types";
import { generateQuoteImage, shareOrDownloadImage } from "@/lib/quote-image";
import { useAuth } from "@/lib/auth";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function daysBetween(startIso: string, endIso: string) {
  const start = new Date(`${startIso.slice(0, 10)}T00:00:00`);
  const end = new Date(`${endIso.slice(0, 10)}T00:00:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

function diasLabel(n: number) {
  return `${n} ${n === 1 ? "dia" : "dias"}`;
}

export const Route = createFileRoute("/livro/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do livro — Grifo" },
      {
        name: "description",
        content: "Atualize o progresso, registre o humor do dia e guarde citações do seu livro.",
      },
      { property: "og:title", content: "Detalhe do livro — Grifo" },
      {
        property: "og:description",
        content: "Progresso, humor da leitura e anotações em um só lugar.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <BookDetail />
    </AppShell>
  ),
});

function BookDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { active: subscriptionActive } = useHasActiveSubscription();

  const [progressInput, setProgressInput] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<BookNote | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [editing, setEditing] = useState(false);
const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [acquireFormat, setAcquireFormat] = useState<BookFormat>("fisico");
  const [acquireStatus, setAcquireStatus] = useState<ShelfStatus>("quero_ler");
 const [abandoning, setAbandoning] = useState(false);
  const [abandonReason, setAbandonReason] = useState("");
 const [sharingId, setSharingId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const { data: ub, isLoading } = useQuery({
    queryKey: ["user_book", id],
    queryFn: () => getUserBook(id),
    enabled: Boolean(user),
  });
  const { data: notes } = useQuery({
    queryKey: ["notes", id],
    queryFn: () => listNotes(id),
    enabled: Boolean(user),
  });
  const { data: activeLoan } = useQuery({
    queryKey: ["active-loan", id],
    queryFn: () => getActiveLoanForUserBook(id),
    enabled: Boolean(user),
  });

   async function shareQuote(note: BookNote) {
    setSharingId(note.id);
    try {
      const blob = await generateQuoteImage({
        quote: note.content,
        page: note.page,
        bookTitle: ub?.book?.title ?? "Livro",
        bookAuthor: ub?.book?.author,
      });
      await shareOrDownloadImage(blob, `grifo-citacao-${note.id}.png`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a imagem.");
    } finally {
      setSharingId(null);
    }
  }

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["user_book", id] });
    void queryClient.invalidateQueries({ queryKey: ["user_books"] });
  };

  const saveProgress = useMutation({
    mutationFn: async () => {
      if (!ub) return;
      const value = Number(progressInput);
      if (!Number.isFinite(value) || value < 1) {
        throw new Error("Informe um valor válido, maior que zero.");
      }
      const rounded = Math.round(value);
      const patch: Partial<UserBook> =
        ub.format === "fisico"
          ? { current_page: rounded }
          : { progress_percent: Math.min(100, rounded) };
      if (ub.format === "fisico" && ub.current_page != null && rounded < ub.current_page) {
        throw new Error(
          `A página não pode ser menor que a última registrada (${ub.current_page}).`,
        );
      }
      if (
        ub.format !== "fisico" &&
        ub.progress_percent != null &&
        Math.min(100, rounded) < ub.progress_percent
      ) {
        throw new Error(
          `O progresso não pode ser menor que o já registrado (${ub.progress_percent}%).`,
        );
      }
      if (ub.status === "quero_ler" || ub.status === "abandonado") {
        patch.status = "lendo";
        patch.abandon_reason = null;
        if (!ub.started_at) {
          patch.started_at = new Date().toISOString();
        }
      }
      await updateUserBook(id, patch);
      if (user) {
        // Registra quantas páginas foram lidas *nesta* atualização (a
        // diferença entre a página atual e a última registrada), não a
        // página atual em si — senão o calendário de constância e o
        // "Ritmo" em Estatísticas contam a página absoluta como se fosse
        // tudo lido no mesmo dia.
        const paginasLidasNestaAtualizacao =
          ub.format === "fisico" ? Math.max(0, rounded - (ub.current_page ?? 0)) : null;
        await addReadingLog({
          user_book_id: id,
          user_id: user.id,
          mood: mood ?? null,
          pages_read: paginasLidasNestaAtualizacao,
        });
      }
    },
    onSuccess: () => {
      setProgressInput("");
      setMood(null);
      refresh();
      toast.success("Progresso atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNote = useMutation({
    mutationFn: async (data: { content: string; kind: "nota" | "citacao"; page: string }) => {
      if (!user) throw new Error("Não autenticado");
      await addNote({
        user_book_id: id,
        user_id: user.id,
        content: data.content.slice(0, 2000),
        kind: data.kind,
        page: data.page ? Number(data.page) : null,
      });
    },
    onSuccess: () => {
      setNoteModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["notes", id] });
      toast.success("Anotação guardada");
    },
   onError: (e: Error) => toast.error(e.message),
  });

  const editNote = useMutation({
    mutationFn: async (data: { noteId: string; content: string }) => {
      await updateNote(data.noteId, { content: data.content.slice(0, 2000) });
    },
    onSuccess: () => {
      setNoteModalOpen(false);
      setEditingNote(null);
      void queryClient.invalidateQueries({ queryKey: ["notes", id] });
      toast.success("Anotação atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeNote = useMutation({
    mutationFn: async (noteId: string) => {
      await deleteNote(noteId);
    },
    onSuccess: () => {
      setDeletingNoteId(null);
      void queryClient.invalidateQueries({ queryKey: ["notes", id] });
      toast.success("Anotação excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const acquire = useMutation({
    mutationFn: async () => {
      await updateUserBook(id, {
        status: acquireStatus,
        format: acquireFormat,
        started_at: acquireStatus === "lendo" ? new Date().toISOString() : null,
        abandon_reason: null,
      });
    },
    onSuccess: () => {
      toast.success("Livro adicionado à sua biblioteca!");
      void queryClient.invalidateQueries({ queryKey: ["user_books"] });
      navigate({ to: "/biblioteca" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

 const abandon = useMutation({
    mutationFn: async () => {
      await updateUserBook(id, {
        status: "abandonado",
        abandon_reason: abandonReason.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Livro movido para abandonados");
      setAbandoning(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteUserBook(id);
      toast.success("Livro removido da biblioteca");
      void queryClient.invalidateQueries({ queryKey: ["user_books"] });
      navigate({ to: "/biblioteca" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir");
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading || !ub) {
    return <p className="text-sm text-muted-foreground">Carregando livro…</p>;
  }

  const pct = progressOf(ub);

  return (
    <section className="space-y-7">
      <div className="card-teal flex gap-5 rounded-3xl p-5">
        <div className="flex w-28 shrink-0 flex-col gap-2">
          <div className="h-40 w-28 overflow-hidden rounded-lg bg-teal-deep">
            <BookCover src={ub.book?.cover_url} title={ub.book?.title} />
          </div>
          {!activeLoan &&
            subscriptionActive &&
            ub.status !== "desejo_compra" &&
            ub.status !== "lido" &&
            ub.status !== "abandonado" && (
              <button
                onClick={() => setCelebrate(true)}
                className="rounded-lg border border-primary/60 py-2.5 text-center text-[11px] font-medium leading-tight text-cream transition-colors hover:bg-primary/20"
              >
                Terminei este livro
              </button>
            )}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.18em] text-primary uppercase">
            {FORMAT_LABEL[ub.format] ?? ub.format}
          </p>
          <h1 className="font-display mt-1 text-2xl leading-snug">{ub.book?.title}</h1>
          <p className="text-sm opacity-70">{ub.book?.author ?? "Autor desconhecido"}</p>
          {ub.book?.genre && (
            <span className="mt-1 inline-block rounded-full border border-primary/30 px-2 py-0.5 text-[10px] text-primary">
              {ub.book.genre}
            </span>
          )}
          {ub.origem_emprestimo_id && (
            <span className="mt-1 ml-2 inline-block rounded-full border border-primary/30 px-2 py-0.5 text-[10px] text-primary">
              Empréstimo recebido
            </span>
          )}
          {ub.status === "abandonado" && ub.abandon_reason && (
            <p className="mt-3 rounded-xl bg-white/10 p-3 text-xs opacity-80">
              <strong>Motivo do abandono:</strong> {ub.abandon_reason}
            </p>
          )}
         {ub.status !== "desejo_compra" && (
            <>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs opacity-80">{pct}% concluído</p>
            </>
          )}
          {(ub.status === "lendo" || ub.status === "lido") && ub.started_at && (
            <p className="mt-1 text-xs opacity-70">
              Início: {formatDate(ub.started_at)}
              {ub.finished_at && ` · Conclusão: ${formatDate(ub.finished_at)}`}
              {" · "}
              {ub.finished_at
                ? `Lido em ${diasLabel(daysBetween(ub.started_at, ub.finished_at))}`
                : `Lendo há ${diasLabel(daysBetween(ub.started_at, new Date().toISOString()))}`}
            </p>
          )}
          {ub.rating != null && (
            <div className="mt-3">
              <StarRating value={ub.rating} size="sm" />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            {subscriptionActive && (
              <button
                onClick={() => {
                  setEditing((v) => !v);
                  setConfirmDelete(false);
                }}
                className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
              >
                <Pencil className="h-3.5 w-3.5" />
                {editing ? "Fechar edição" : "Editar"}
              </button>
            )}
            {subscriptionActive && (ub.status === "lendo" || ub.status === "quero_ler") && (
              <button
                onClick={() => setAbandoning((v) => !v)}
                className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-4"
              >
                Abandonar
              </button>
            )}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 text-destructive underline underline-offset-4"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            ) : (
              <span className="text-muted-foreground">Confirme abaixo</span>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <BookEditPanel
          ub={ub}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      )}

      {abandoning && (
        <div className="panel-cream rounded-2xl p-5">
          <p className="text-sm">
            Por que você está abandonando “{ub.book?.title ?? "este livro"}”? (opcional)
          </p>
          <textarea
            value={abandonReason}
            onChange={(e) => setAbandonReason(e.target.value)}
            rows={3}
            placeholder="Ex: não me conectei com a história"
            className="mt-3 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => abandon.mutate()}
              disabled={abandon.isPending}
              className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-60"
            >
              {abandon.isPending ? "Salvando…" : "Confirmar abandono"}
            </button>
            <button
              onClick={() => setAbandoning(false)}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="panel-cream rounded-2xl border-destructive/40 p-5">
          <p className="text-sm">
            Excluir “{ub.book?.title ?? "este livro"}”? As anotações e registros também serão
            removidos.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-60"
            >
              {deleting ? "Excluindo…" : "Sim, excluir"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

   {(ub.status === "desejo_compra" || ub.status === "abandonado") && (
        <div className="panel-cream rounded-2xl p-5">
          <h2 className="font-display text-xl">
            {ub.status === "abandonado" ? "Retomar leitura" : "Adquiri este livro"}
          </h2>
          {!subscriptionActive ? (
            <div className="mt-3">
              <SubscriptionRequiredNotice
                action={ub.status === "abandonado" ? "retomar a leitura" : "adquirir este livro"}
              />
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                {ub.status === "abandonado"
                  ? "Escolha para onde este livro volta na sua biblioteca."
                  : "Escolha o formato e onde ele vai entrar na sua biblioteca."}
              </p>

              <p className="mt-5 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                Formato
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(FORMAT_LABEL) as BookFormat[]).map((f) => (
                  <Chip key={f} active={acquireFormat === f} onClick={() => setAcquireFormat(f)}>
                    {FORMAT_LABEL[f]}
                  </Chip>
                ))}
              </div>

              <p className="mt-5 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                Estante
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(ub.status === "abandonado"
                  ? (["lendo", "quero_ler"] as ShelfStatus[])
                  : (["lendo", "quero_ler", "lido"] as ShelfStatus[])
                ).map((s) => (
                  <Chip key={s} active={acquireStatus === s} onClick={() => setAcquireStatus(s)}>
                    {STATUS_LABEL[s]}
                  </Chip>
                ))}
              </div>

              <button
                onClick={() => acquire.mutate()}
                disabled={acquire.isPending}
                className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {acquire.isPending
                  ? "Salvando…"
                  : ub.status === "abandonado"
                    ? "Retomar este livro"
                    : "Confirmar aquisição"}
              </button>
            </>
          )}
        </div>
      )}
      {activeLoan && ub.status !== "desejo_compra" && (
        <div className="panel-cream rounded-2xl border border-primary/30 p-5">
          <p className="text-sm">
            <strong>Este livro está emprestado</strong> para {activeLoan.person_name}
            {activeLoan.due_date
              ? ` até ${new Date(activeLoan.due_date).toLocaleDateString("pt-BR")}`
              : ""}
            . Atualizações de progresso e novas anotações ficam bloqueadas até a devolução.
          </p>
        </div>
      )}
      {ub.status !== "desejo_compra" && !activeLoan && (
        <div className="panel-cream rounded-2xl p-5">
          <h2 className="font-display text-xl">Atualizar progresso</h2>

          {!subscriptionActive ? (
            <div className="mt-3">
              <SubscriptionRequiredNotice action="registrar novo progresso" />
            </div>
          ) : (
            <>
              <p className="mt-3 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                Humor do dia
              </p>
              <div className="mt-2">
                <MoodPicker value={mood} onChange={setMood} />
              </div>

              <div className="mt-5 flex items-center gap-2">
                <input
                  value={progressInput}
                  onChange={(e) => setProgressInput(e.target.value)}
                  inputMode="numeric"
                  placeholder={ub.format === "fisico" ? "Página atual" : "% concluído"}
                  className="min-w-0 flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={() => saveProgress.mutate()}
                  className="shrink-0 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Registrar
                </button>
              </div>
            </>
          )}
        </div>
      )}

     {ub.status !== "desejo_compra" && (
      <div className="panel-cream rounded-2xl p-5">
        <h2 className="font-display text-xl">Anotações e citações</h2>
        {activeLoan ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Novas anotações ficam bloqueadas enquanto o livro está emprestado.
          </p>
        ) : !subscriptionActive ? (
          <div className="mt-3">
            <SubscriptionRequiredNotice action="guardar uma nova nota ou citação" />
          </div>
        ) : (
          <button
            onClick={() => {
              setEditingNote(null);
              setNoteModalOpen(true);
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 py-4 text-sm text-primary transition-colors hover:bg-primary/10"
          >
            <StickyNote className="h-4 w-4" />
            Escrever nova anotação ou citação
          </button>
        )}

       <div className="mt-6 space-y-3">
        {notes?.map((n) => (
           <blockquote
             key={n.id}
             className={
               "rounded-xl border-l-2 border-primary bg-secondary/50 p-4 text-sm " +
               (n.kind === "citacao" ? "font-display text-base italic" : "")
             }
           >
             <span className="mb-2 flex items-center justify-between gap-1.5 text-[10px] font-sans not-italic uppercase tracking-[0.14em] text-primary">
               <span className="flex items-center gap-1.5">
                 {n.kind === "citacao" ? (
                   <Quote className="h-3 w-3" />
                 ) : (
                   <StickyNote className="h-3 w-3" />
                 )}
                 {n.kind === "citacao" ? "Citação" : "Nota"}
               </span>
               <span className="flex items-center gap-2">
                {subscriptionActive && (
                  <button
                    type="button"
                    aria-label="Editar"
                    onClick={() => {
                      setEditingNote(n);
                      setNoteModalOpen(true);
                    }}
                    className="not-italic text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Excluir"
                  onClick={() => setDeletingNoteId(n.id)}
                  className="not-italic text-primary"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                 {n.kind === "citacao" && (
                  <button
                    type="button"
                    aria-label="Compartilhar citação"
                    disabled={sharingId === n.id}
                    onClick={() => void shareQuote(n)}
                    className="not-italic text-primary disabled:opacity-50"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>             </span>
             {deletingNoteId === n.id ? (
               <div className="not-italic font-sans">
                 <p className="text-sm text-foreground">Excluir esta {n.kind === "citacao" ? "citação" : "nota"}?</p>
                 <div className="mt-3 flex gap-2">
                   <button
                     type="button"
                     onClick={() => removeNote.mutate(n.id)}
                     disabled={removeNote.isPending}
                     className="rounded-xl bg-destructive px-4 py-2 text-xs font-medium text-destructive-foreground disabled:opacity-60"
                   >
                     {removeNote.isPending ? "Excluindo…" : "Sim, excluir"}
                   </button>
                   <button
                     type="button"
                     onClick={() => setDeletingNoteId(null)}
                     className="rounded-xl border border-border px-4 py-2 text-xs"
                   >
                     Cancelar
                   </button>
                 </div>
               </div>
             ) : (
               <>
                 {renderFormattedText(n.content)}
                 {n.page != null && (
                   <span className="mt-2 block text-xs not-italic font-sans text-muted-foreground">
                     p. {n.page}
                   </span>
                 )}
               </>
             )}
           </blockquote>
         ))}        </div>      </div>
      )}
      <NoteEditorModal
        open={noteModalOpen}
        onOpenChange={(v) => {
          setNoteModalOpen(v);
          if (!v) setEditingNote(null);
        }}
        userBookId={id}
        noteId={editingNote?.id ?? null}
        initialContent={editingNote?.content ?? ""}
        initialKind={editingNote?.kind ?? "citacao"}
        initialPage={editingNote?.page != null ? String(editingNote.page) : ""}
        saving={editingNote ? editNote.isPending : saveNote.isPending}
        onSave={(data) => {
          if (editingNote) {
            editNote.mutate({ noteId: editingNote.id, content: data.content });
          } else {
            saveNote.mutate(data);
          }
        }}
      />

      <CelebrationModal        open={celebrate}
        bookTitle={ub.book?.title ?? "Livro"}
        onOpenChange={setCelebrate}
        onSave={async ({ rating, review, favorite }) => {
  try {
    await updateUserBook(id, {
      status: "lido",
      progress_percent: 100,
      current_page: ub.format === "fisico" ? ub.total_pages : ub.current_page,
      rating,
      review,
      is_favorite: favorite,
      finished_at: new Date().toISOString(),
    });
            setCelebrate(false);
            refresh();
            toast.success("Leitura concluída 🎉");
            navigate({ to: "/biblioteca" });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao salvar");
          }
        }}
      />
    </section>
  );
}
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-4 py-2 text-sm transition-colors " +
        (active
          ? "border-primary bg-primary/20 text-foreground"
          : "border-border text-muted-foreground hover:border-primary/50")
      }
    >
      {children}
    </button>
  );
}
