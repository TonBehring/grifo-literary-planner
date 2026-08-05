import { useState } from "react";
import { toast } from "sonner";
import { CoverPicker } from "@/components/CoverPicker";
import { updateUserBook, updateUserBookOverrides } from "@/lib/api";
import { uploadCover } from "@/lib/cover-upload";
import { FORMAT_LABEL, STATUS_LABEL, GENRE_OPTIONS, type BookFormat, type ShelfStatus, type UserBook } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export function BookEditPanel({
  ub,
  onSaved,
}: {
  ub: UserBook;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(ub.book?.title ?? "");
  const [author, setAuthor] = useState(ub.book?.author ?? "");
  const [pages, setPages] = useState(ub.book?.page_count ? String(ub.book.page_count) : "");
  const [cover, setCover] = useState<string | null>(ub.book?.cover_url ?? null);
  const [format, setFormat] = useState<BookFormat>(ub.format);
  const [status, setStatus] = useState<ShelfStatus>(ub.status);
  const [genre, setGenre] = useState<string | null>(ub.book?.genre ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function save() {
    if (!title.trim()) {
      toast.error("O título não pode ficar vazio");
      return;
    }
    setSaving(true);
    try {
      await updateUserBookOverrides(ub.id, {
        title: title.trim(),
        author: author.trim() || null,
        page_count: pages ? Number(pages) : null,
        cover_url: cover,
        genre,
      });
      await updateUserBook(ub.id, { format, status });
      onSaved();
      toast.success("Informações atualizadas");
    } catch (err) {      toast.error(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
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

      <div className="mt-4">
        <CoverPicker
          cover={cover}
          title={title || null}
          uploading={uploading}
          onUpload={async (file) => {
            if (!user) return;
            setUploading(true);
            try {
              setCover(await uploadCover(file, user.id));
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Não foi possível carregar a capa");
            } finally {
              setUploading(false);
            }
          }}
          onUseUrl={(url) => {
            if (!/^https?:\/\/\S+$/i.test(url)) {
              toast.error("Cole um link válido começando com http:// ou https://");
              return;
            }
            setCover(url);
            toast.success("Capa definida pelo link");
          }}
          onRemove={() => setCover(null)}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Depois de definir a capa, toque em “Salvar alterações” para gravar no livro.
        </p>
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
        {(Object.keys(STATUS_LABEL) as ShelfStatus[])
          .filter((s) => s !== "abandonado")
          .map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
              {STATUS_LABEL[s]}
            </Chip>
          ))}
      </div>

      <p className="mt-5 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Gênero</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {GENRE_OPTIONS.map((g) => (
          <Chip key={g} active={genre === g} onClick={() => setGenre(genre === g ? null : g)}>
            {g}
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
