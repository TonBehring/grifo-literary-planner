import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Quote, StickyNote, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import { BookEditPanel } from "@/components/BookEditPanel";
import { CelebrationModal } from "@/components/CelebrationModal";
import { MoodPicker } from "@/components/MoodPicker";
import { StarRating } from "@/components/StarRating";
import {
  addNote,
  addReadingLog,
  deleteUserBook,
  getUserBook,
  listNotes,
  updateUserBook,
} from "@/lib/api";
import { FORMAT_LABEL, STATUS_LABEL, progressOf, type BookFormat, type ShelfStatus, type UserBook } from "@/lib/types";
import { useAuth } from "@/lib/auth";

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

  const [progressInput, setProgressInput] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteKind, setNoteKind] = useState<"nota" | "citacao">("citacao");
  const [notePage, setNotePage] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [editing, setEditing] = useState(false);
const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [acquireFormat, setAcquireFormat] = useState<BookFormat>("fisico");
  const [acquireStatus, setAcquireStatus] = useState<ShelfStatus>("quero_ler");
  const [abandoning, setAbandoning] = useState(false);
  const [abandonReason, setAbandonReason] = useState("");

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

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["user_book", id] });
    void queryClient.invalidateQueries({ queryKey: ["user_books"] });
  };

  const saveProgress = useMutation({
    mutationFn: async () => {
      if (!ub) return;
      const value = Number(progressInput);
      if (!Number.isFinite(value) || value < 0) throw new Error("Valor inválido");
      const patch: Partial<UserBook> =
        ub.format === "fisico"
          ? { current_page: Math.round(value) }
          : { progress_percent: Math.min(100, Math.round(value)) };
      if (ub.status === "quero_ler" || ub.status === "abandonado") {
        patch.status = "lendo";
        patch.abandon_reason = null;
        if (!ub.started_at) {
          patch.started_at = new Date().toISOString();
        }
      }
      await updateUserBook(id, patch);
      if (mood && user) {
        await addReadingLog({
          user_book_id: id,
          user_id: user.id,
          mood,
          pages_read: ub.format === "fisico" ? Math.round(value) : null,
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
    mutationFn: async () => {
      if (!user || noteText.trim().length === 0) throw new Error("Escreva algo antes de salvar");
     await addNote({
        user_book_id: id,
        user_id: user.id,
        content: noteText.trim().slice(0, 2000),
        kind: noteKind,
        page: notePage ? Number(notePage) : null,
      });
    },
    onSuccess: () => {
      setNoteText("");
      setNotePage("");
      void queryClient.invalidateQueries({ queryKey: ["notes", id] });
      toast.success("Anotação guardada");
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
        <div className="h-40 w-28 shrink-0 overflow-hidden rounded-lg bg-teal-deep">
          <BookCover src={ub.book?.cover_url} title={ub.book?.title} />
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
          {ub.rating != null && (
            <div className="mt-3">
              <StarRating value={ub.rating} size="sm" />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
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
            {(ub.status === "lendo" || ub.status === "quero_ler") && (
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
        </div>
      )}      {ub.status !== "desejo_compra" && (
        <div className="panel-cream rounded-2xl p-5">
          <h2 className="font-display text-xl">Atualizar progresso</h2>
          <div className="mt-3 flex gap-2">
            <input
              value={progressInput}
              onChange={(e) => setProgressInput(e.target.value)}
              inputMode="numeric"
              placeholder={ub.format === "fisico" ? "Página atual" : "% concluído"}
              className="flex-1 rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => saveProgress.mutate()}
              className="rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground"
            >
              Salvar
            </button>
          </div>

          <p className="mt-5 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Humor do dia
          </p>
          <div className="mt-2">
            <MoodPicker value={mood} onChange={setMood} />
          </div>

          {ub.status !== "lido" && ub.status !== "abandonado" && (
            <button
              onClick={() => setCelebrate(true)}
              className="mt-6 w-full rounded-xl border border-primary py-3 text-sm font-medium text-foreground transition-colors hover:bg-primary/10"
            >
              Concluí este livro
            </button>
          )}
        </div>
      )}
      
     {ub.status !== "desejo_compra" && (
      <div className="panel-cream rounded-2xl p-5">
        <h2 className="font-display text-xl">Anotações e citações</h2>        <div className="mt-3 flex gap-2">
          {(["citacao", "nota"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setNoteKind(k)}
              className={
                "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors " +
                (noteKind === k
                  ? "border-primary bg-primary/20"
                  : "border-border text-muted-foreground")
              }
            >
              {k === "citacao" ? <Quote className="h-4 w-4" /> : <StickyNote className="h-4 w-4" />}
              {k === "citacao" ? "Citação" : "Nota"}
            </button>
          ))}
        </div>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Grife o trecho que te marcou…"
          className="mt-3 w-full resize-none rounded-xl border border-border p-3 text-sm outline-none focus:border-primary"
        />
        <input
          value={notePage}
          onChange={(e) => setNotePage(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="Página (opcional)"
          className="mt-2 w-32 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => saveNote.mutate()}
          className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground"
        >
          Guardar
        </button>

       <div className="mt-6 space-y-3">
         {notes?.map((n) => (
            <blockquote
              key={n.id}
              className={
                "rounded-xl border-l-2 border-primary bg-secondary/50 p-4 text-sm " +
                (n.kind === "citacao" ? "font-display text-base italic" : "")
              }
            >
              <span className="mb-2 flex items-center gap-1.5 text-[10px] font-sans not-italic uppercase tracking-[0.14em] text-primary">
                {n.kind === "citacao" ? (
                  <Quote className="h-3 w-3" />
                ) : (
                  <StickyNote className="h-3 w-3" />
                )}
                {n.kind === "citacao" ? "Citação" : "Nota"}
              </span>
              {n.content}
              {n.page != null && (
                <span className="mt-2 block text-xs not-italic font-sans text-muted-foreground">
                  p. {n.page}
                </span>
              )}
            </blockquote>
          ))}        </div>
      </div>
      )}

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
