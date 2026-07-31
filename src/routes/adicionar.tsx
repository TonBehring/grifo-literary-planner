import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import { CoverPicker } from "@/components/CoverPicker";
import { addBookToShelf, searchGoogleBooks, type GoogleVolume } from "@/lib/api";
import { FORMAT_LABEL, STATUS_LABEL, type BookFormat, type ShelfStatus } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { uploadCover } from "@/lib/cover-upload";

export const Route = createFileRoute("/adicionar")({
  head: () => ({
    meta: [
      { title: "Adicionar livro — Grifo" },
      {
        name: "description",
        content: "Busque por título ou ISBN e adicione um novo livro à sua estante no Grifo.",
      },
      { property: "og:title", content: "Adicionar livro — Grifo" },
      {
        property: "og:description",
        content: "Busca por título ou ISBN para incluir livros na sua biblioteca.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <AddBookPage />
    </AppShell>
  ),
});

function AddBookPage() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<GoogleVolume[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<GoogleVolume | null>(null);
  const [format, setFormat] = useState<BookFormat>("fisico");
  const [status, setStatus] = useState<ShelfStatus>("lendo");
  const [saving, setSaving] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualPages, setManualPages] = useState("");
  const [manualCover, setManualCover] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [searched, setSearched] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (term.trim().length < 2) return;
    setSearching(true);
    try {
      const found = await searchGoogleBooks(term.trim());
      setResults(found);
      setSearched(true);
      if (found.length === 0) {
        setManual(true);
        setManualTitle(term.trim());
        toast.info("Nada encontrado. Cadastre manualmente abaixo.");
      }
    } catch (err) {
      setManual(true);
      setManualTitle(term.trim());
      toast.error(err instanceof Error ? err.message : "Erro na busca");
    } finally {
      setSearching(false);
    }
  }


  async function save() {
    const payload = manual
      ? {
          id: "manual",
          title: manualTitle.trim(),
          author: manualAuthor.trim() || null,
          cover_url: manualCover,
          isbn: null,
          page_count: manualPages ? Number(manualPages) : null,
        }
      : selected;
    if (!payload || !payload.title) {
      toast.error("Informe ao menos o título do livro");
      return;
    }
    if (!user) {
      toast.error("Faça login para adicionar livros");
      return;
    }
    setSaving(true);
    try {
      const id = await addBookToShelf({ ...payload, status, format }, user.id);
      await queryClient.invalidateQueries({ queryKey: ["user_books"] });
      toast.success("Livro adicionado à estante");
      navigate({ to: "/livro/$id", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h1 className="font-display text-4xl leading-tight">Adicionar livro</h1>
      <p className="mt-2 text-sm text-muted-foreground">Busque por título ou ISBN.</p>

      <form onSubmit={runSearch} className="mt-6 flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          maxLength={120}
          placeholder="Ex.: Cem anos de solidão ou 9788501012531"
          className="flex-1 rounded-xl border border-border bg-card/0 px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 text-primary-foreground"
          aria-label="Buscar"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>

      {searching && <p className="mt-6 text-sm text-muted-foreground">Buscando…</p>}

      <div className="mt-6 space-y-3">
        {results.map((v) => (
          <button
            key={v.id}
            onClick={() => {
              setSelected(v);
              setManual(false);
            }}
            className={
              "flex w-full gap-4 rounded-2xl p-3 text-left transition-colors " +
              (!manual && selected?.id === v.id ? "card-teal" : "panel-cream")
            }
          >
            <div className="h-24 w-16 shrink-0 overflow-hidden rounded bg-muted">
              <BookCover src={v.cover_url} title={v.title} />
            </div>
            <div className="min-w-0">
              <h3 className="font-display truncate text-lg">{v.title}</h3>
              <p className="truncate text-sm opacity-70">{v.author ?? "Autor desconhecido"}</p>
              {v.page_count && <p className="mt-1 text-xs opacity-60">{v.page_count} páginas</p>}
            </div>
          </button>
        ))}
      </div>

      {searched && !searching && (
        <button
          onClick={() => {
            setManual(true);
            setSelected(null);
            if (!manualTitle) setManualTitle(term.trim());
          }}
          className="mt-6 text-sm text-primary underline underline-offset-4"
        >
          Não achou? Cadastrar manualmente
        </button>
      )}

      {manual && (
        <div className="panel-cream mt-6 space-y-3 rounded-2xl p-5">
          <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Cadastro manual
          </p>
          <input
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="Título"
            maxLength={200}
            className="w-full rounded-xl border border-border bg-card/0 px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <input
            value={manualAuthor}
            onChange={(e) => setManualAuthor(e.target.value)}
            placeholder="Autor"
            maxLength={200}
            className="w-full rounded-xl border border-border bg-card/0 px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <input
            value={manualPages}
            onChange={(e) => setManualPages(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Total de páginas (opcional)"
            className="w-full rounded-xl border border-border bg-card/0 px-4 py-3 text-sm outline-none focus:border-primary"
          />

          <div className="flex items-center gap-4 pt-1">
            <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
              <BookCover src={manualCover} title={manualTitle || null} />
            </div>
            <div className="min-w-0">
              <label className="inline-block cursor-pointer rounded-xl border border-primary px-4 py-2 text-sm text-primary">
                {uploadingCover
                  ? "Enviando…"
                  : manualCover
                    ? "Trocar capa"
                    : "Enviar capa do livro"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingCover}
                  onChange={pickCover}
                />
              </label>
              {manualCover && (
                <button
                  onClick={() => setManualCover(null)}
                  className="ml-3 text-sm text-muted-foreground underline underline-offset-4"
                >
                  Remover
                </button>
              )}
              <p className="mt-2 text-xs text-muted-foreground">JPG ou PNG, até 5MB.</p>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <input
              value={coverUrlInput}
              onChange={(e) => setCoverUrlInput(e.target.value)}
              placeholder="Ou cole o link da imagem da capa"
              maxLength={2000}
              className="min-w-0 flex-1 rounded-xl border border-border bg-card/0 px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => {
                const url = coverUrlInput.trim();
                if (!/^https?:\/\/\S+$/i.test(url)) {
                  toast.error("Cole um link válido começando com http:// ou https://");
                  return;
                }
                setManualCover(url);
                toast.success("Capa definida pelo link");
              }}
              className="shrink-0 rounded-xl border border-primary px-4 text-sm text-primary"
            >
              Usar
            </button>
          </div>
        </div>
      )}

      {(selected || manual) && (
        <div className="panel-cream mt-8 rounded-2xl p-5">
          <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Formato</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(FORMAT_LABEL) as BookFormat[]).map((f) => (
              <Chip key={f} active={format === f} onClick={() => setFormat(f)}>
                {FORMAT_LABEL[f]}
              </Chip>
            ))}
          </div>

          <p className="mt-5 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Estante
          </p>
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
            {saving
              ? "Salvando…"
              : `Adicionar "${(manual ? manualTitle : selected?.title) || "livro"}"`}
          </button>
        </div>
      )}
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