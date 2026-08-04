import { supabase } from "@/integrations/supabase/client";

export type PeriodoTipo = "semana" | "mes" | "semestre" | "ano";

export const PERIODO_LABEL: Record<PeriodoTipo, string> = {
  semana: "Semana",
  mes: "Mês",
  semestre: "Semestre",
  ano: "Ano",
};

export const DESAFIOS: { slug: string; texto: string }[] = [
  { slug: "ler-livro-empacado", texto: "Ler um livro empacado na estante" },
  { slug: "dar-livro-presente", texto: "Dar um livro de presente" },
  { slug: "novo-genero", texto: "Conhecer um novo gênero literário" },
  { slug: "novo-autor-favorito", texto: "Descobrir um novo autor favorito" },
  { slug: "romance-nacional", texto: "Ler um romance nacional" },
  { slug: "reler-favorita", texto: "Reler uma história favorita" },
  { slug: "comprar-sebo", texto: "Comprar um livro em um sebo" },
  { slug: "emprestar-livro", texto: "Emprestar um livro" },
  { slug: "ler-mesmo-dia", texto: "Ler um livro inteiro no mesmo dia" },
  { slug: "nao-ficcao", texto: "Ler um livro de não ficção" },
  { slug: "visitar-biblioteca", texto: "Visitar uma biblioteca" },
  { slug: "romance-epoca", texto: "Ler um romance de época" },
  { slug: "saga-familiar", texto: "Ler uma saga familiar" },
  { slug: "clube-leitura", texto: "Participar de um clube de leitura" },
  { slug: "recomendacao-amigo", texto: "Ler a recomendação de um amigo" },
  { slug: "dark-romance", texto: "Ler um dark romance" },
  { slug: "leitura-verao", texto: "Fazer uma leitura de verão" },
  { slug: "new-adult", texto: "Ler um new adult" },
  { slug: "romantasia", texto: "Ler uma romantasia" },
  { slug: "serie-completa", texto: "Ler uma série completa de livros" },
  { slug: "mais-400-paginas", texto: "Um livro com mais de 400 páginas" },
  { slug: "ler-fora-de-casa", texto: "Ler fora de casa" },
  { slug: "escolher-pela-capa", texto: "Escolher um livro pela capa" },
  { slug: "audiolivro", texto: "Ouvir um audiolivro" },
];

export const desafioTexto = (slug: string) =>
  DESAFIOS.find((d) => d.slug === slug)?.texto ?? slug;

export type DesafioBoard = {
  id: string;
  user_id: string;
  periodo_tipo: PeriodoTipo;
  periodo_inicio: string;
  periodo_fim: string;
  criado_em: string;
};

export type DesafioItem = {
  id: string;
  board_id: string;
  desafio_slug: string;
  concluido: boolean;
  concluido_em: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export function calcPeriodoFim(tipo: PeriodoTipo, inicio = new Date()) {
  const d = new Date(inicio);
  if (tipo === "semana") d.setDate(d.getDate() + 7);
  if (tipo === "mes") d.setMonth(d.getMonth() + 1);
  if (tipo === "semestre") d.setMonth(d.getMonth() + 6);
  if (tipo === "ano") d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function daysLeft(periodoFim: string) {
  const end = new Date(`${periodoFim}T23:59:59`);
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
}

export async function getActiveBoard(): Promise<DesafioBoard | null> {
  const { data, error } = await supabase
    .from("desafio_boards")
    .select("*")
    .gte("periodo_fim", today())
    .order("criado_em", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as DesafioBoard) ?? null;
}

export async function listBoardItems(boardId: string): Promise<DesafioItem[]> {
  const { data, error } = await supabase
    .from("desafios_usuario")
    .select("*")
    .eq("board_id", boardId);
  if (error) throw new Error(error.message);
  const order = new Map(DESAFIOS.map((d, i) => [d.slug, i]));
  return ((data ?? []) as DesafioItem[]).sort(
    (a, b) => (order.get(a.desafio_slug) ?? 99) - (order.get(b.desafio_slug) ?? 99),
  );
}

export async function createBoard(tipo: PeriodoTipo, slugs: string[]) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Sessão expirada. Entre novamente.");

  const inicio = today();
  const { data, error } = await supabase
    .from("desafio_boards")
    .insert({
      user_id: userId,
      periodo_tipo: tipo,
      periodo_inicio: inicio,
      periodo_fim: calcPeriodoFim(tipo),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const board = data as DesafioBoard;
  const { error: itemsError } = await supabase
    .from("desafios_usuario")
    .insert(slugs.map((slug) => ({ board_id: board.id, desafio_slug: slug })));
  if (itemsError) throw new Error(itemsError.message);
  return board;
}

export async function toggleDesafio(item: DesafioItem) {
  const concluido = !item.concluido;
  const { error } = await supabase
    .from("desafios_usuario")
    .update({ concluido, concluido_em: concluido ? new Date().toISOString() : null })
    .eq("id", item.id);
  if (error) throw new Error(error.message);
  return concluido;
}

export type PastBoard = DesafioBoard & { total: number; concluidos: number };

export async function listPastBoards(): Promise<PastBoard[]> {
  const { data, error } = await supabase
    .from("desafio_boards")
    .select("*, desafios_usuario(concluido)")
    .lt("periodo_fim", today())
    .order("periodo_fim", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as (DesafioBoard & { desafios_usuario: { concluido: boolean }[] })[]).map(
    ({ desafios_usuario, ...board }) => ({
      ...board,
      total: desafios_usuario?.length ?? 0,
      concluidos: desafios_usuario?.filter((d) => d.concluido).length ?? 0,
    }),
  );
}
