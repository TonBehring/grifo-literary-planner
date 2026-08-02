import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { Camera, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import { CoverPicker } from "@/components/CoverPicker";
import { addBookToShelf, searchGoogleBooks, searchLocalCatalog, type GoogleVolume } from "@/lib/api";
import { FORMAT_LABEL, STATUS_LABEL, GENRE_OPTIONS, type BookFormat, type ShelfStatus } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { uploadCover } from "@/lib/cover-upload";

const IsbnScannerView = lazy(() => import("@/components/IsbnScannerView"));

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
  const [genre, setGenre] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualPages, setManualPages] = useState("");
  const [manualCover, setManualCover] = useState<string | null>(null);
  const [manualIsbn, setManualIsbn] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [searched, setSearched] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

async function searchByTerm(value: string) {
    const query = value.trim();
    if (query.length < 2) return;
    const looksLikeIsbn = /^[\d-]{10,17}$/.test(query);
    setSearching(true);
    try {
      if (looksLikeIsbn) {
        const local = await searchLocalCatalog(query);
        if (local.length > 0) {
          setResults(local);
          setSearched(true);
          setSearching(false);
          return;
        }
      }
      const found = await searchGoogleBooks(query);
      setResults(found);
      setSearched(true);
      if (found.length === 0) {
        setManual(true);
        setManualTitle(looksLikeIsbn ? "" : query);
        setManualIsbn(looksLikeIsbn ? query.replace(/-/g, "") : null);
        toast.info(
          looksLikeIsbn
            ? `ISBN ${query} não encontrado. Preencha o título manualmente abaixo.`
            : "Nada encontrado. Cadastre manualmente abaixo.",
        );
      }
    } catch (err) {
      setManual(true);
      setManualTitle(looksLikeIsbn ? "" : query);
      setManualIsbn(looksLikeIsbn ? query.replace(/-/g, "") : null);
      toast.error(err instanceof Error ? err.message : "Erro na busca");
    } finally {
      setSearching(false);
    }
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    await searchByTerm(term);
  }

  function handleScan(text: string) {
    const code = text.replace(/[^0-9Xx]/g, "");
    setScannerOpen(false);
    setTerm(code);
    void searchByTerm(code);
  }


  async function save() {
    const payload = manual
      ? {
          id: "manual",
          title: manualTitle.trim(),
          author: manualAuthor.trim() || null,
          cover_url: manualCover,
          isbn: manualIsbn,
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
      const { id, alreadyExists } = await addBookToShelf({ ...payload, status, format, genre }, user.id);
      await queryClient.invalidateQueries({ queryKey: ["user_books"] });
      if (alreadyExists) {
        toast.info("Você já tem esse livro na sua estante");
      } else {
        toast.success("Livro adicionado à estante");
      }
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
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="rounded-xl border border-border px-4 text-foreground transition-colors hover:border-primary"
          aria-label="Escanear código de barras"
        >
          <Camera className="h-4 w-4" />
        </button>
      </form>

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Escanear ISBN</DialogTitle>
            <DialogDescription>
              Posicione o código de barras da contracapa dentro do retângulo.
            </DialogDescription>
          </DialogHeader>
          {scannerOpen && (
            <Suspense
              fallback={
                <div className="h-[320px] rounded-xl bg-muted" aria-label="Carregando câmera" />
              }
            >
              <IsbnScannerView onResult={handleScan} />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>

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

          <div className="pt-1">
            <CoverPicker
              cover={manualCover}
              title={manualTitle || null}
              uploading={uploadingCover}
              onUpload={async (file) => {
                if (!user) {
                  toast.error("Faça login para enviar uma capa");
                  return;
                }
                setUploadingCover(true);
                try {
                  setManualCover(await uploadCover(file, user.id));
                  toast.success("Capa carregada");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Não foi possível carregar a capa");
                } finally {
                  setUploadingCover(false);
                }
              }}
              onUseUrl={(url) => {
                if (!/^https?:\/\/\S+$/i.test(url)) {
                  toast.error("Cole um link válido começando com http:// ou https://");
                  return;
                }
                setManualCover(url);
                toast.success("Capa definida pelo link");
              }}
              onRemove={() => setManualCover(null)}
            />
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
          <p className="mt-5 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Gênero
          </p>
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
