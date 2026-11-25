import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import { useHasActiveSubscription } from "@/components/SubscriptionGate";
import { searchByIsbn, type GoogleVolume } from "@/lib/api";
import {
  addBooksInBatch,
  dedupeByTitle,
  getMyShelfKeys,
  isOnShelf,
  LOTE_MAXIMO,
  searchBooksByAuthor,
} from "@/lib/bulk-add";
import { FORMAT_LABEL, STATUS_LABEL, type BookFormat, type ShelfStatus } from "@/lib/types";
import { useAuth } from "@/lib/auth";

const IsbnScannerView = lazy(() => import("@/components/IsbnScannerView"));

export const Route = createFileRoute("/adicionar_/lote")({
  head: () => ({
    meta: [
      { title: "Adicionar vários livros — Grifo" },
      { name: "description", content: "Escaneie vários livros seguidos ou busque pelo autor e adicione todos de uma vez." },
    ],
  }),
  component: () => (
    <AppShell>
      <BatchAddPage />
    </AppShell>
  ),
});

type Item =
  | { chave: string; estado: "buscando"; isbn: string }
  | { chave: string; estado: "nao_encontrado"; isbn: string }
  | { chave: string; estado: "pronto"; livro: GoogleVolume; jaTenho: boolean };

type Aba = "camera" | "autor";

function BatchAddPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { active: subscriptionActive } = useHasActiveSubscription();
  const availableStatuses: ShelfStatus[] = subscriptionActive
    ? (Object.keys(STATUS_LABEL) as ShelfStatus[])
    : ["lendo", "quero_ler", "lido"];

  const [aba, setAba] = useState<Aba>("camera");
  const [fila, setFila] = useState<Item[]>([]);
  const filaRef = useRef<Item[]>([]);
  filaRef.current = fila;
  const [cameraAberta, setCameraAberta] = useState(false);

  const [autor, setAutor] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<GoogleVolume[]>([]);
  const [proximo, setProximo] = useState<number | null>(null);
  const [autorBuscado, setAutorBuscado] = useState("");

  const [format, setFormat] = useState<BookFormat>("fisico");
  const [status, setStatus] = useState<ShelfStatus>("quero_ler");
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);

  const estante = useQuery({
    queryKey: ["shelf-keys", user?.id],
    queryFn: () => getMyShelfKeys(user!.id),
    enabled: Boolean(user),
  });

  const prontos = fila.filter(
    (i): i is Extract<Item, { estado: "pronto" }> => i.estado === "pronto" && !i.jaTenho,
  );
  const cheio = fila.length >= LOTE_MAXIMO;

  function avisarCheio() {
    toast.error(`Dá para adicionar até ${LOTE_MAXIMO} livros por vez. Salve estes e continue em seguida.`);
  }

  // Câmera ----------------------------------------------------------------

  function chaveIsbn(isbn: string) {
    return `isbn:${isbn}`;
  }

  async function aoEscanear(isbn: string) {
    const atual = filaRef.current;
    const repetido = atual.some(
      (i) => i.chave === chaveIsbn(isbn) || (i.estado === "pronto" && i.livro.isbn?.replace(/[^0-9Xx]/g, "") === isbn),
    );
    if (repetido) {
      toast.info("Esse livro já está na lista");
      return;
    }
    if (atual.length >= LOTE_MAXIMO) {
      avisarCheio();
      return;
    }
    const chave = chaveIsbn(isbn);
    setFila((f) => [{ chave, estado: "buscando", isbn }, ...f]);
    let livro: GoogleVolume | undefined;
    try {
      livro = (await searchByIsbn(isbn))[0];
    } catch {
      livro = undefined;
    }
    setFila((f) =>
      f.map((i): Item =>
        i.chave !== chave
          ? i
          : livro
            ? { chave, estado: "pronto", livro, jaTenho: isOnShelf(livro, estante.data) }
            : { chave, estado: "nao_encontrado", isbn },
      ),
    );
  }

  // Autor -----------------------------------------------------------------

  async function buscarAutor(e?: React.FormEvent, continuar = false) {
    e?.preventDefault();
    const nome = continuar ? autorBuscado : autor.trim();
    if (nome.length < 3) {
      toast.error("Digite pelo menos 3 letras do nome do autor");
      return;
    }
    setBuscando(true);
    try {
      const pagina = await searchBooksByAuthor(nome, continuar && proximo != null ? proximo : 0);
      const lista = continuar ? dedupeByTitle([...resultados, ...pagina.items]) : dedupeByTitle(pagina.items);
      setResultados(lista);
      setProximo(pagina.temMais ? pagina.proximo : null);
      setAutorBuscado(nome);
      if (!continuar && lista.length === 0) toast.info("Não encontramos livros desse autor. Confira o nome.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível buscar agora");
    } finally {
      setBuscando(false);
    }
  }

  function chaveLivro(v: GoogleVolume) {
    return `g:${v.id}`;
  }

  function naFila(v: GoogleVolume) {
    return fila.some((i) => i.chave === chaveLivro(v));
  }

  function alternar(v: GoogleVolume) {
    if (naFila(v)) {
      setFila((f) => f.filter((i) => i.chave !== chaveLivro(v)));
      return;
    }
    if (cheio) {
      avisarCheio();
      return;
    }
    setFila((f) => [...f, { chave: chaveLivro(v), estado: "pronto", livro: v, jaTenho: false }]);
  }

  const selecionaveis = resultados.filter((v) => !isOnShelf(v, estante.data));
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every(naFila);

  function marcarTodos() {
    if (todosMarcados) {
      const chaves = new Set(selecionaveis.map(chaveLivro));
      setFila((f) => f.filter((i) => !chaves.has(i.chave)));
      return;
    }
    setFila((f) => {
      const novos = selecionaveis
        .filter((v) => !f.some((i) => i.chave === chaveLivro(v)))
        .map((v): Item => ({ chave: chaveLivro(v), estado: "pronto", livro: v, jaTenho: false }));
      const cabe = Math.max(0, LOTE_MAXIMO - f.length);
      if (novos.length > cabe) avisarCheio();
      return [...f, ...novos.slice(0, cabe)];
    });
  }

  // Salvar ----------------------------------------------------------------

  async function salvar() {
    if (!user) {
      toast.error("Faça login para adicionar livros");
      return;
    }
    if (prontos.length === 0) return;
    setCameraAberta(false);
    setSalvando(true);
    setProgresso({ feitos: 0, total: prontos.length });
    try {
      const r = await addBooksInBatch(
        prontos.map((i) => i.livro),
        { status, format },
        user.id,
        (feitos, total) => setProgresso({ feitos, total }),
      );
      await queryClient.invalidateQueries({ queryKey: ["user_books"] });
      await queryClient.invalidateQueries({ queryKey: ["shelf-keys"] });
      const partes = [`${r.adicionados} ${r.adicionados === 1 ? "livro adicionado" : "livros adicionados"}`];
      if (r.jaTinha) partes.push(`${r.jaTinha} já ${r.jaTinha === 1 ? "estava" : "estavam"} na estante`);
      if (r.falhas.length) {
        toast.error(`${partes.join(", ")}. Não deu para salvar: ${r.falhas.join(", ")}.`);
        const falharam = new Set(r.falhas);
        setFila((f) => f.filter((i) => i.estado === "pronto" && falharam.has(i.livro.title)));
        return;
      }
      toast.success(partes.join(", "));
      navigate({ to: "/biblioteca" });
    } finally {
      setSalvando(false);
      setProgresso(null);
    }
  }

  return (
    <section className="pb-28">
      <Link to="/adicionar" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Adicionar um livro
      </Link>
      <h1 className="font-display mt-3 text-4xl leading-tight">Adicionar vários livros</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Escaneie um livro atrás do outro ou busque pelo autor. No final, confira a lista e adicione todos de uma vez.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-border p-1" role="tablist">
        <AbaBotao ativa={aba === "camera"} onClick={() => setAba("camera")}>
          <Camera className="h-4 w-4" /> Escanear
        </AbaBotao>
        <AbaBotao
          ativa={aba === "autor"}
          onClick={() => {
            setAba("autor");
            setCameraAberta(false);
          }}
        >
          <Search className="h-4 w-4" /> Por autor
        </AbaBotao>
      </div>

      {aba === "camera" && (
        <div className="mt-5">
          {cameraAberta ? (
            <>
              <Suspense fallback={<div className="h-[320px] rounded-xl bg-muted" aria-label="Carregando câmera" />}>
                <IsbnScannerView onResult={(isbn) => void aoEscanear(isbn)} continuous />
              </Suspense>
              <button
                type="button"
                onClick={() => setCameraAberta(false)}
                className="mt-3 w-full rounded-xl border border-border py-3 text-sm"
              >
                Fechar câmera
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => (cheio ? avisarCheio() : setCameraAberta(true))}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground"
            >
              <Camera className="h-4 w-4" /> {fila.length ? "Continuar escaneando" : "Abrir câmera"}
            </button>
          )}
          <p className="mt-2 text-center text-xs text-muted-foreground">
            A câmera fica aberta. Cada livro lido entra na lista abaixo.
          </p>
        </div>
      )}

      {aba === "autor" && (
        <div className="mt-5">
          <form onSubmit={(e) => void buscarAutor(e)} className="flex gap-2">
            <input
              value={autor}
              onChange={(e) => setAutor(e.target.value)}
              maxLength={120}
              placeholder="Ex.: Machado de Assis"
              className="flex-1 rounded-xl border border-border bg-card/0 px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <button type="submit" className="rounded-xl bg-primary px-4 text-primary-foreground" aria-label="Buscar autor">
              {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </form>

          {resultados.length > 0 && (
            <>
              <div className="mt-4 flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                  {resultados.length} {resultados.length === 1 ? "livro" : "livros"} de {autorBuscado}
                </p>
                {selecionaveis.length > 0 && (
                  <button type="button" onClick={marcarTodos} className="font-medium text-[#85651C] underline underline-offset-4">
                    {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
                  </button>
                )}
              </div>
              <ul className="mt-3 space-y-2">
                {resultados.map((v) => {
                  const tenho = isOnShelf(v, estante.data);
                  const marcado = naFila(v);
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        disabled={tenho}
                        onClick={() => alternar(v)}
                        aria-pressed={marcado}
                        className={
                          "flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors " +
                          (marcado ? "border-primary bg-primary/10" : "border-border") +
                          (tenho ? " opacity-60" : "")
                        }
                      >
                        <span
                          className={
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border " +
                            (marcado ? "border-primary bg-primary text-primary-foreground" : "border-border")
                          }
                        >
                          {marcado && <Check className="h-4 w-4" />}
                        </span>
                        <span className="h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
                          <BookCover src={v.cover_url} title={v.title} />
                        </span>
                        <span className="min-w-0">
                          <span className="font-display block truncate text-base">{v.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {tenho ? "Já está na sua estante" : (v.author ?? "Autor desconhecido")}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {proximo != null && (
                <button
                  type="button"
                  onClick={() => void buscarAutor(undefined, true)}
                  disabled={buscando}
                  className="mt-3 w-full rounded-xl border border-border py-3 text-sm disabled:opacity-60"
                >
                  {buscando ? "Carregando…" : "Carregar mais"}
                </button>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Não achou algum? Ele pode estar com outro nome de autor. Use a câmera ou o cadastro de um livro.
              </p>
            </>
          )}
        </div>
      )}

      {fila.length > 0 && (
        <div className="panel-cream mt-8 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-xl">Sua lista</p>
            <button type="button" onClick={() => setFila([])} className="text-xs text-muted-foreground underline underline-offset-4">
              Limpar
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {fila.map((i) => (
              <li key={i.chave} className="flex items-center gap-3">
                {i.estado === "pronto" ? (
                  <>
                    <span className="h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">
                      <BookCover src={i.livro.cover_url} title={i.livro.title} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{i.livro.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {i.jaTenho ? "Já está na sua estante, não será adicionado" : (i.livro.author ?? "Autor desconhecido")}
                      </span>
                    </span>
                  </>
                ) : i.estado === "buscando" ? (
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando {i.isbn}…
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                    Não encontramos o ISBN {i.isbn}. Cadastre este depois pelo{" "}
                    <Link to="/adicionar" className="underline underline-offset-4">
                      cadastro de um livro
                    </Link>
                    .
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setFila((f) => f.filter((x) => x.chave !== i.chave))}
                  className="shrink-0 rounded-full p-2 text-muted-foreground"
                  aria-label="Tirar da lista"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Formato</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(FORMAT_LABEL) as BookFormat[]).map((f) => (
              <Chip key={f} active={format === f} onClick={() => setFormat(f)}>
                {FORMAT_LABEL[f]}
              </Chip>
            ))}
          </div>
          <p className="mt-5 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Estante</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableStatuses.map((s) => (
              <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                {STATUS_LABEL[s]}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Todos entram com o mesmo formato e estante. Depois dá para mudar cada um na página do livro.
          </p>
        </div>
      )}

      {fila.length > 0 && (
        <div className="fixed inset-x-0 bottom-[84px] z-30 px-5">
          <div className="mx-auto max-w-3xl">
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando || prontos.length === 0}
              className="w-full rounded-xl bg-primary py-3.5 text-sm font-medium text-primary-foreground shadow-lg disabled:opacity-60"
            >
              {progresso
                ? `Adicionando ${progresso.feitos} de ${progresso.total}…`
                : prontos.length === 0
                  ? "Nenhum livro novo na lista"
                  : `Adicionar ${prontos.length} ${prontos.length === 1 ? "livro" : "livros"}`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function AbaBotao({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={onClick}
      className={
        "flex items-center justify-center gap-2 rounded-full py-2 text-sm transition-colors " +
        (ativa ? "bg-[#052C2D] text-[#F9F4EA]" : "text-muted-foreground")
      }
    >
      {children}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-4 py-2 text-sm transition-colors " +
        (active ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:border-primary/50")
      }
    >
      {children}
    </button>
  );
}
