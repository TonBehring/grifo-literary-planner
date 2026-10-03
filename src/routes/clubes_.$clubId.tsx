// src/routes/clubes_.$clubId.tsx
//
// IMPORTANTE: o nome do arquivo tem um "_" logo depois de "clubes"
// (clubes_.$clubId.tsx, não clubes.$clubId.tsx) — mesma convenção usada em
// livro.$id_.sessao.tsx e clubes_.novo.tsx, pra essa tela não ficar
// aninhada (e invisível) dentro de clubes.tsx, que não tem <Outlet />.
//
// Página de um clube: foto do clube, livro atual (com busca pra
// definir/trocar, só pra admin), lista de membros (com avatar) e o mural
// de posts com avatar do autor (v1: sem threads, só posts + curtidas).

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Search,
  Heart,
  MessageCircle,
  Trash2,
  Copy,
  Trophy,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import { CoverPicker } from "@/components/CoverPicker";
import { uploadCover } from "@/lib/cover-upload";
import {
  getClubDetail,
  listClubMembers,
  listClubPosts,
  addClubPost,
  deleteClubPost,
  toggleClubPostLike,
  listClubPostComments,
  addClubPostComment,
  deleteClubPostComment,
  setClubCurrentBook,
  getOrCreateClubInviteCode,
  updateClubImage,
  searchGoogleBooks,
  clubMemberDisplayName,
  getClubRanking,
  type GoogleVolume,
  type ClubMember,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/clubes/$clubId")({
  component: () => (
    <AppShell>
      <ClubPage />
    </AppShell>
  ),
});

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// Avatar pequeno e reutilizável: mostra a foto do membro, ou a inicial do
// nome dele como fallback, quando ele nunca trocou a foto em "Minha conta".
function MemberAvatar({ member, sizeClass = "h-6 w-6" }: { member: ClubMember; sizeClass?: string }) {
  const nome = clubMemberDisplayName(member);
  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground`}
    >
      {nome.slice(0, 1).toUpperCase()}
    </span>
  );
}

// Pilha de avatares sobrepostos (estilo Instagram) + legenda de quem curtiu.
function CurtidoresResumo({
  curtidoPor,
  currentUserId,
  memberByUserId,
  aberto,
  onToggle,
}: {
  curtidoPor: string[];
  currentUserId: string | undefined;
  memberByUserId: Map<string, ClubMember>;
  aberto: boolean;
  onToggle: () => void;
}) {
  if (curtidoPor.length === 0) return null;

  const nomeDe = (uid: string) => {
    if (uid === currentUserId) return "você";
    const m = memberByUserId.get(uid);
    return m ? clubMemberDisplayName(m) : "alguém";
  };

  const primeiros = curtidoPor.slice(0, 3);
  const restantes = curtidoPor.length - primeiros.length;

  let legenda: string;
  if (curtidoPor.length === 1) {
    legenda = `Curtido por ${nomeDe(curtidoPor[0])}`;
  } else if (restantes > 0) {
    legenda = `Curtido por ${nomeDe(curtidoPor[0])} e mais ${curtidoPor.length - 1} ${
      curtidoPor.length - 1 === 1 ? "pessoa" : "pessoas"
    }`;
  } else {
    legenda = `Curtido por ${curtidoPor.map(nomeDe).join(", ")}`;
  }

  return (
    <button onClick={onToggle} className="mt-1.5 flex items-center gap-1.5">
      <span className="flex items-center">
        {primeiros.map((uid, i) => {
          const m = memberByUserId.get(uid);
          return (
            <span
              key={uid}
              className="-ml-1.5 first:ml-0 rounded-full ring-2 ring-background"
              style={{ zIndex: primeiros.length - i }}
            >
              {m ? (
                <MemberAvatar member={m} sizeClass="h-4 w-4" />
              ) : (
                <span className="h-4 w-4 rounded-full bg-muted" />
              )}
            </span>
          );
        })}
      </span>
      <span className="text-xs text-muted-foreground underline-offset-4 hover:underline">
        {aberto ? "Ocultar curtidas" : legenda}
      </span>
    </button>
  );
}

function PostComments({
  postId,
  memberByUserId,
  currentUserId,
  souAdmin,
}: {
  postId: string;
  memberByUserId: Map<string, ClubMember>;
  currentUserId: string | undefined;
  souAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const comments = useQuery({
    queryKey: ["club-post-comments", postId],
    queryFn: () => listClubPostComments(postId),
  });
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!currentUserId || !texto.trim()) return;
    setEnviando(true);
    try {
      await addClubPostComment({
        post_id: postId,
        user_id: currentUserId,
        conteudo: texto.trim(),
      });
      setTexto("");
      void queryClient.invalidateQueries({ queryKey: ["club-post-comments", postId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível comentar");
    } finally {
      setEnviando(false);
    }
  }

  async function apagar(commentId: string) {
    try {
      await deleteClubPostComment(commentId);
      void queryClient.invalidateQueries({ queryKey: ["club-post-comments", postId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível apagar");
    }
  }

  return (
    <div className="mt-3 border-t border-border/50 pt-3">
      {comments.isLoading && (
        <p className="text-xs text-muted-foreground">Carregando comentários…</p>
      )}
      {!comments.isLoading && comments.data?.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>
      )}
      <div className="flex flex-col gap-2">
        {comments.data?.map((c) => {
          const autor = memberByUserId.get(c.user_id);
          return (
            <div key={c.id} className="flex items-start gap-2">
              {autor ? (
                <MemberAvatar member={autor} sizeClass="h-6 w-6" />
              ) : (
                <span className="h-6 w-6 shrink-0 rounded-full bg-muted" />
              )}
              <p className="min-w-0 flex-1 text-xs">
                <span className="font-medium">
                  {autor ? clubMemberDisplayName(autor) : "Leitor do Grifo"}
                </span>{" "}
                <span className="text-muted-foreground">{c.conteudo}</span>
              </p>
              {(c.user_id === currentUserId || souAdmin) && (
                <button
                  onClick={() => apagar(c.id)}
                  aria-label="Apagar comentário"
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Adicione um comentário…"
          className="min-w-0 flex-1 rounded-full border border-border px-3 py-1.5 text-xs outline-none focus:border-primary"
        />
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="shrink-0 text-xs font-medium text-primary disabled:opacity-50"
        >
          Publicar
        </button>
      </div>
    </div>
  );
}

function ClubPage() {
  const { clubId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const detail = useQuery({
    queryKey: ["club-detail", clubId],
    queryFn: () => getClubDetail(clubId, user!.id),
    enabled: Boolean(user),
  });

  const members = useQuery({
    queryKey: ["club-members", clubId],
    queryFn: () => listClubMembers(clubId),
    enabled: Boolean(user),
  });

  const posts = useQuery({
    queryKey: ["club-posts", clubId],
    queryFn: () => listClubPosts(clubId, user!.id),
    enabled: Boolean(user),
  });

  const ranking = useQuery({
    queryKey: ["club-ranking", clubId],
    queryFn: () => getClubRanking(clubId),
    enabled: Boolean(user) && Boolean(detail.data?.livroAtualTitulo),
  });

  const [buscaLivroAberta, setBuscaLivroAberta] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState<GoogleVolume[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [definindoLivro, setDefinindoLivro] = useState(false);

  const [fotoAberta, setFotoAberta] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const [codigoVisivel, setCodigoVisivel] = useState<string | null>(null);
  const [carregandoCodigo, setCarregandoCodigo] = useState(false);

  const [novoPost, setNovoPost] = useState("");
  const [paginaPost, setPaginaPost] = useState("");
  const [publicando, setPublicando] = useState(false);

  const [membroSelecionado, setMembroSelecionado] = useState<ClubMember | null>(null);
  const [curtidoresAbertos, setCurtidoresAbertos] = useState<Record<string, boolean>>({});
  const [comentariosAbertos, setComentariosAbertos] = useState<Record<string, boolean>>({});

  function invalidarClube() {
    void queryClient.invalidateQueries({ queryKey: ["club-detail", clubId] });
    void queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
  }

  async function buscarLivro() {
    if (!termoBusca.trim()) return;
    setBuscando(true);
    try {
      const resultados = await searchGoogleBooks(termoBusca.trim());
      setResultadosBusca(resultados);
    } catch {
      toast.error("Não foi possível buscar agora.");
    } finally {
      setBuscando(false);
    }
  }

  async function escolherLivro(volume: GoogleVolume) {
    if (!user) return;
    setDefinindoLivro(true);
    try {
      await setClubCurrentBook(clubId, volume, user.id);
      toast.success("Livro do clube atualizado!");
      setBuscaLivroAberta(false);
      setTermoBusca("");
      setResultadosBusca([]);
      invalidarClube();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível definir o livro");
    } finally {
      setDefinindoLivro(false);
    }
  }

  async function handleUploadFotoClube(file: File) {
    if (!user) return;
    setEnviandoFoto(true);
    try {
      const url = await uploadCover(file, user.id);
      await updateClubImage(clubId, url);
      invalidarClube();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a foto");
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function handleUsarUrlFotoClube(url: string) {
    try {
      await updateClubImage(clubId, url);
      invalidarClube();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a foto");
    }
  }

  async function handleRemoverFotoClube() {
    try {
      await updateClubImage(clubId, null);
      invalidarClube();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível remover a foto");
    }
  }

  async function verCodigo() {
    if (!user) return;
    if (codigoVisivel) {
      setCodigoVisivel(null);
      return;
    }
    setCarregandoCodigo(true);
    try {
      const codigo = await getOrCreateClubInviteCode(clubId, user.id);
      setCodigoVisivel(codigo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível buscar o código");
    } finally {
      setCarregandoCodigo(false);
    }
  }

  async function copiarCodigo() {
    if (!codigoVisivel) return;
    try {
      await navigator.clipboard.writeText(codigoVisivel);
      toast.success("Código copiado!");
    } catch {
      toast.error("Não foi possível copiar — copie manualmente.");
    }
  }

  async function publicarPost() {
    if (!user) return;
    if (!novoPost.trim()) {
      toast.error("Escreva algo antes de publicar.");
      return;
    }
    setPublicando(true);
    try {
      await addClubPost({
        club_id: clubId,
        user_id: user.id,
        conteudo: novoPost.trim(),
        pagina_referencia: paginaPost.trim() ? Number(paginaPost) : null,
      });
      setNovoPost("");
      setPaginaPost("");
      void queryClient.invalidateQueries({ queryKey: ["club-posts", clubId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível publicar");
    } finally {
      setPublicando(false);
    }
  }

  async function curtir(postId: string, jaCurtido: boolean) {
    if (!user) return;
    // Otimista: atualiza a UI antes da resposta do banco, pra parecer instantâneo.
    queryClient.setQueryData<typeof posts.data>(["club-posts", clubId], (old) =>
      old?.map((p) =>
        p.id === postId
          ? {
              ...p,
              curtido_por_mim: !jaCurtido,
              likes_count: p.likes_count + (jaCurtido ? -1 : 1),
              curtido_por: jaCurtido
                ? p.curtido_por.filter((id) => id !== user.id)
                : [...p.curtido_por, user.id],
            }
          : p,
      ),
    );
    try {
      await toggleClubPostLike(postId, user.id, jaCurtido);
    } catch {
      void queryClient.invalidateQueries({ queryKey: ["club-posts", clubId] });
    }
  }

  async function apagarPost(postId: string) {
    try {
      await deleteClubPost(postId);
      void queryClient.invalidateQueries({ queryKey: ["club-posts", clubId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível apagar");
    }
  }

  if (detail.isLoading || !detail.data) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  const { club, meuPapel, livroAtualTitulo, livroAtualAutor, livroAtualCapa } = detail.data;
  const souAdmin = meuPapel === "admin";
  const memberByUserId = new Map((members.data ?? []).map((m) => [m.user_id, m]));

  return (
    <section className="pb-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate({ to: "/clubes" })}
          aria-label="Voltar"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          {club.imagem_url ? (
            <img src={club.imagem_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <h1 className="font-display truncate text-xl">{club.nome}</h1>
      </div>
      {club.descricao && <p className="mt-2 text-sm text-muted-foreground">{club.descricao}</p>}

      {souAdmin && (
        <div className="mt-2">
          <button
            onClick={() => setFotoAberta((v) => !v)}
            className="text-xs font-medium text-primary underline underline-offset-4"
          >
            {fotoAberta ? "Fechar" : "Alterar foto do clube"}
          </button>
          {fotoAberta && (
            <div className="mt-2">
              <CoverPicker
                cover={club.imagem_url}
                title={club.nome}
                onUpload={handleUploadFotoClube}
                onUseUrl={handleUsarUrlFotoClube}
                onRemove={handleRemoverFotoClube}
                uploading={enviandoFoto}
              />
            </div>
          )}
        </div>
      )}

      {/* Livro atual */}
      <div className="card-teal mt-4 rounded-2xl p-4">
        <p className="text-xs uppercase tracking-wide opacity-80">Livro atual</p>
        {livroAtualTitulo ? (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-white/10">
              <BookCover src={livroAtualCapa} title={livroAtualTitulo} />
            </div>
            <div className="min-w-0">
              <p className="font-display truncate text-base">{livroAtualTitulo}</p>
              {livroAtualAutor && <p className="truncate text-sm opacity-80">{livroAtualAutor}</p>}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm opacity-80">Nenhum livro definido ainda.</p>
        )}

        {souAdmin && (
          <button
            onClick={() => setBuscaLivroAberta((v) => !v)}
            className="mt-3 text-xs font-medium underline underline-offset-4"
          >
            {livroAtualTitulo ? "Trocar livro" : "Definir livro atual"}
          </button>
        )}

        {souAdmin && buscaLivroAberta && (
          <div className="mt-3 rounded-xl bg-white/10 p-3">
            <div className="flex gap-2">
              <input
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarLivro()}
                placeholder="Título, autor ou ISBN"
                className="min-w-0 flex-1 rounded-lg border border-white/30 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/60"
              />
              <button
                onClick={buscarLivro}
                disabled={buscando}
                aria-label="Buscar"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex max-h-64 flex-col gap-2 overflow-y-auto">
              {resultadosBusca.map((v) => (
                <button
                  key={v.id}
                  onClick={() => escolherLivro(v)}
                  disabled={definindoLivro}
                  className="flex items-center gap-2 rounded-lg bg-white/10 p-2 text-left disabled:opacity-60"
                >
                  <div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-white/10">
                    <BookCover src={v.cover_url} title={v.title} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{v.title}</p>
                    {v.author && <p className="truncate text-xs opacity-70">{v.author}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ranking de leitura (só existe enquanto houver um livro atual) */}
      {livroAtualTitulo && (
        <div className="panel-cream mt-4 rounded-2xl p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Trophy className="h-4 w-4" />
            Ranking de leitura
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Páginas lidas de "{livroAtualTitulo}" desde que virou o livro do clube — só conta
            quem tem esse mesmo livro na própria estante.
          </p>

          <div className="mt-3 flex flex-col gap-1.5">
            {ranking.isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}

            {ranking.data?.map((entry, i) => (
              <div
                key={entry.user_id}
                className={
                  "flex items-center gap-3 rounded-xl px-2 py-1.5 " +
                  (i === 0 && entry.paginas_lidas > 0 ? "bg-primary/10" : "")
                }
              >
                <span
                  className={
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                    (i === 0 && entry.paginas_lidas > 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {i + 1}
                </span>
                {entry.avatar_url ? (
                  <img
                    src={entry.avatar_url}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                    {entry.nome.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm">{entry.nome}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.paginas_lidas > 0
                    ? `${entry.paginas_lidas} pág.`
                    : entry.tem_livro_na_estante
                      ? "0 pág."
                      : "sem progresso"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Membros */}
      <div className="panel-cream mt-4 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <UsersIcon className="h-4 w-4" />
            {members.data?.length ?? 0} {(members.data?.length ?? 0) === 1 ? "membro" : "membros"}
          </p>
          {souAdmin && (
            <button
              onClick={verCodigo}
              disabled={carregandoCodigo}
              className="text-xs font-medium text-primary underline underline-offset-4 disabled:opacity-60"
            >
              {carregandoCodigo
                ? "Buscando…"
                : codigoVisivel
                  ? "Ocultar código"
                  : "Ver código de convite"}
            </button>
          )}
        </div>

        {codigoVisivel && (
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium tracking-[0.2em]">
              {codigoVisivel}
            </span>
            <button
              onClick={copiarCodigo}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {(members.data ?? []).map((m) => (
            <button
              key={m.user_id}
              onClick={() => setMembroSelecionado(m)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border py-1 pl-1 pr-3 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <MemberAvatar member={m} sizeClass="h-5 w-5" />
              {clubMemberDisplayName(m)}
              {m.papel === "admin" ? " · admin" : ""}
            </button>
          ))}
        </div>
      </div>

      {membroSelecionado && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setMembroSelecionado(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-3xl bg-background p-6 sm:rounded-3xl"
          >
            <div className="flex flex-col items-center text-center">
              <MemberAvatar member={membroSelecionado} sizeClass="h-16 w-16" />
              <p className="font-display mt-3 text-lg">
                {clubMemberDisplayName(membroSelecionado)}
              </p>
              {membroSelecionado.username && (
                <p className="text-sm text-muted-foreground">@{membroSelecionado.username}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {membroSelecionado.papel === "admin" ? "Administrador do clube" : "Membro"} ·
                entrou em{" "}
                {new Date(membroSelecionado.entrou_em).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <button
              onClick={() => setMembroSelecionado(null)}
              className="mt-5 w-full rounded-full border border-border py-2.5 text-sm font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Mural */}
      <div className="mt-4">
        <p className="text-sm font-medium">Mural do clube</p>

        <div className="panel-cream mt-2 rounded-2xl p-4">
          <textarea
            value={novoPost}
            onChange={(e) => setNovoPost(e.target.value)}
            rows={3}
            placeholder="Compartilhe uma impressão, uma dúvida, uma citação…"
            className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              value={paginaPost}
              onChange={(e) => setPaginaPost(e.target.value)}
              placeholder="Página (opcional)"
              className="w-36 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={publicarPost}
              disabled={publicando}
              className="ml-auto rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {publicando ? "Publicando…" : "Publicar"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {posts.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

          {!posts.isLoading && posts.data && posts.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ninguém postou ainda — comece a conversa.
            </p>
          )}

          {posts.data?.map((post) => {
            const autor = memberByUserId.get(post.user_id);
            return (
              <div key={post.id} className="panel-cream rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {autor ? (
                      <MemberAvatar member={autor} sizeClass="h-7 w-7" />
                    ) : (
                      <span className="h-7 w-7 shrink-0 rounded-full bg-muted" />
                    )}
                    <p className="text-sm font-medium">
                      {autor ? clubMemberDisplayName(autor) : "Leitor do Grifo"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {post.pagina_referencia != null && <span>pág. {post.pagina_referencia}</span>}
                    <span>{timeAgo(post.criado_em)}</span>
                  </div>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm">{post.conteudo}</p>

                <div className="mt-2 flex items-center gap-4">
                  <button
                    onClick={() => curtir(post.id, post.curtido_por_mim)}
                    className={
                      "inline-flex items-center gap-1 text-xs transition-colors " +
                      (post.curtido_por_mim ? "text-primary" : "text-muted-foreground")
                    }
                  >
                    <Heart
                      className={"h-4 w-4 " + (post.curtido_por_mim ? "fill-current" : "")}
                    />
                    Curtir
                  </button>
                  <button
                    onClick={() =>
                      setComentariosAbertos((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                    }
                    className={
                      "inline-flex items-center gap-1 text-xs transition-colors " +
                      (comentariosAbertos[post.id] ? "text-foreground" : "text-muted-foreground")
                    }
                  >
                    <MessageCircle className="h-4 w-4" />
                    Comentar
                  </button>
                  {(post.user_id === user?.id || souAdmin) && (
                    <button
                      onClick={() => apagarPost(post.id)}
                      className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Apagar
                    </button>
                  )}
                </div>

                <CurtidoresResumo
                  curtidoPor={post.curtido_por}
                  currentUserId={user?.id}
                  memberByUserId={memberByUserId}
                  aberto={Boolean(curtidoresAbertos[post.id])}
                  onToggle={() =>
                    setCurtidoresAbertos((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                  }
                />

                {curtidoresAbertos[post.id] && post.likes_count > 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {post.curtido_por
                      .map((uid) => {
                        if (uid === user?.id) return "você";
                        const membro = memberByUserId.get(uid);
                        return membro ? clubMemberDisplayName(membro) : "alguém";
                      })
                      .join(", ")}
                  </p>
                )}

                {comentariosAbertos[post.id] && (
                  <PostComments
                    postId={post.id}
                    memberByUserId={memberByUserId}
                    currentUserId={user?.id}
                    souAdmin={souAdmin}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
