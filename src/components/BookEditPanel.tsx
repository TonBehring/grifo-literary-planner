import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BookCover } from "@/components/BookCover";
import { deleteUserBook, updateBookInfo, updateUserBook } from "@/lib/api";
import { uploadCover } from "@/lib/cover-upload";
import { FORMAT_LABEL, STATUS_LABEL, type BookFormat, type ShelfStatus, type UserBook } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export function BookEditPanel({
  ub,
  onSaved,
  onDeleted,
}: {
  ub: UserBook;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(ub.book?.title ?? "");
  const [author, setAuthor] = useState(ub.book?.author ?? "");
  const [pages, setPages] = useState(ub.book?.page_count ? String(ub.book.page_count) : "");
  const [cover, setCover] = useState<string | null>(ub.book?.cover_url ?? null);
  const [format, setFormat] = useState<BookFormat>(ub.format);
  const [status, setStatus] = useState<ShelfStatus>(ub.status);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function pickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    try {
      setCover(await uploadCover(file, user.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar a capa");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!title.trim()) {
      toast.error("O título não pode ficar vazio");
      return;
    }
    setSaving(true);
    try {
      if (ub.book_id) {
        await updateBookInfo(ub.book_id, {
          title: title.trim(),
          author: author.trim() || null,
          page_count: pages ? Number(pages) : null,
          cover_url: cover,
        });
      }
      await updateUserBook(ub.id, { format, status });
      onSaved();
      toast.success("Informações atualizadas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await deleteUserBook(ub.id);
      toast.success("Livro removido da biblioteca");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="panel-cream rounded-2xl p-5">
      <h2 className="font-display text-xl">Editar livro</h2>

      <div className="mt-4 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Título"
          className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={200}
          placeholder="Autor"
          className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <input
          value={pages}
          onChange={(e) => setPages(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="Total de páginas"
          className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          <BookCover src={cover} title={title || null} />
        </div>
        <div>
          <label className="inline-block cursor-pointer rounded-xl border border-primary px-4 py-2 text-sm text-primary">
            {uploading ? "Enviando…" : cover ? "Trocar capa" : "Enviar capa"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={pickCover}
            />
          </label>
          {cover && (
            <button
              onClick={() => setCover(null)}
              className="ml-3 text-sm text-muted-foreground underline underline-offset-4"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      <p className="mt-5 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Formato</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(Object.keys(FORMAT_LABEL) as BookFormat[]).map((f) => (
          <Chip key={f} active={format === f} onClick={() => setFormat(f)}>
            {FORMAT_LABEL[f]}
          </Chip>
        ))}
      </div>

      <p className="mt-5 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Estante</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABEL) as ShelfStatus[]).map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {STATUS_LABEL[s]}
          </Chip>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {saving ? "Salvando…" : "Salvar alterações"}
      </button>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-3 text-sm text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Excluir da biblioteca
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-destructive/40 p-4">
          <p className="text-sm">
            Excluir “{ub.book?.title ?? "este livro"}”? As anotações e registros também serão
            removidos.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={remove}
              disabled={deleting}
              className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-60"
            >
              {deleting ? "Excluindo…" : "Sim, excluir"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
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
