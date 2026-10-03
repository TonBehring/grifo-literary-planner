// src/routes/clubes_.$clubId.tsx
//
// IMPORTANTE: o nome do arquivo tem um "_" logo depois de "clubes"
// (clubes_.$clubId.tsx, não clubes.$clubId.tsx) — mesma convenção usada em
// livro.$id_.sessao.tsx e clubes_.novo.tsx, pra essa tela não ficar
// aninhada (e invisível) dentro de clubes.tsx, que não tem <Outlet />.
//
// Página de um clube: livro atual (com busca pra definir/trocar, só pra
// admin), lista de membros e o mural de posts (v1: sem threads, só posts
// + curtidas).

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Search, Heart, Trash2, Copy, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import {
  getClubDetail,
  listClubMembers,
  listClubPosts,
  addClubPost,
  deleteClubPost,
  toggleClubPostLike,
  setClubCurrentBook,
  getOrCreateClubInviteCode,
  searchGoogleBooks,
  clubMemberDisplayName,
  type GoogleVolume,
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

  const [buscaLivroAberta, setBuscaLivroAberta] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState<GoogleVolume[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [definindoLivro, setDefinindoLivro] = useState(false);

  const [codigoVisivel, setCodigoVisivel] = useState<string | null>(null);
  const [carregandoCodigo, setCarregandoCodigo] = useState(false);

  const [novoPost, setNovoPost] = useState("");
  const [paginaPost, setPaginaPost] = useState("");
  const [publicando, setPublicando] = useState(false);

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
      void queryClient.invalidateQueries({ queryKey: ["club-detail", clubId] });
      void queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível definir o livro");
    } finally {
      setDefinindoLivro(false);
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
  const memberNameByUserId = new Map(
    (members.data ?? []).map((m) => [m.user_id, clubMemberDisplayName(m)]),
  );

  return (
    <section className="pb-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate({ to: "/clubes" })}
          aria-label="Voltar"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-display truncate text-xl">{club.nome}</h1>
      </div>
      {club.descricao && <p className="mt-2 text-sm text-muted-foreground">{club.descricao}</p>}

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
            <span
              key={m.user_id}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
            >
              {clubMemberDisplayName(m)}
              {m.papel === "admin" ? " · admin" : ""}
            </span>
          ))}
        </div>
      </div>

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

          {posts.data?.map((post) => (
            <div key={post.id} className="panel-cream rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {memberNameByUserId.get(post.user_id) ?? "Leitor do Grifo"}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {post.pagina_referencia != null && <span>pág. {post.pagina_referencia}</span>}
                  <span>{timeAgo(post.criado_em)}</span>
                </div>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm">{post.conteudo}</p>
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => curtir(post.id, post.curtido_por_mim)}
                  className={
                    "inline-flex items-center gap-1 text-xs transition-colors " +
                    (post.curtido_por_mim ? "text-primary" : "text-muted-foreground")
                  }
                >
                  <Heart className={"h-3.5 w-3.5 " + (post.curtido_por_mim ? "fill-current" : "")} />
                  {post.likes_count > 0 ? post.likes_count : "Curtir"}
                </button>
                {(post.user_id === user?.id || souAdmin) && (
                  <button
                    onClick={() => apagarPost(post.id)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Apagar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
