// Enquetes do mural do clube e edição de posts, comentários e encontros.
// As enquetes ficam no banco em club_polls / club_poll_options /
// club_poll_votes e só são acessadas pelas funções club_* abaixo.

import { supabase } from "@/integrations/supabase/client";

export type PollOption = {
  id: string;
  texto: string;
  // null enquanto o resultado está escondido (a pessoa ainda não votou e a
  // enquete não encerrou)
  votos: number | null;
  votantes: string[] | null;
};

export type ClubPollData = {
  post_id: string;
  multipla: boolean;
  encerra_em: string | null;
  encerrada: boolean;
  revelado: boolean;
  total_votantes: number;
  meus_votos: string[];
  opcoes: PollOption[];
};

export const MAX_OPCOES = 10;

export async function criarEnquete(input: {
  clubId: string;
  pergunta: string;
  opcoes: string[];
  multipla: boolean;
  encerraEm: string | null;
  pagina: number | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("club_criar_enquete", {
    p_club_id: input.clubId,
    p_pergunta: input.pergunta,
    p_opcoes: input.opcoes,
    p_multipla: input.multipla,
    p_encerra_em: input.encerraEm,
    p_pagina: input.pagina,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function getEnquete(postId: string): Promise<ClubPollData | null> {
  const { data, error } = await supabase.rpc("club_enquetes", { p_post_ids: [postId] });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as Array<Omit<ClubPollData, "opcoes" | "meus_votos"> & {
    opcoes: PollOption[] | null;
    meus_votos: string[] | null;
  }>)[0];
  if (!row) return null;
  return { ...row, opcoes: row.opcoes ?? [], meus_votos: row.meus_votos ?? [] };
}

/** Grava as opções escolhidas (lista vazia tira o voto). */
export async function votarEnquete(postId: string, optionIds: string[]): Promise<void> {
  const { error } = await supabase.rpc("club_votar_enquete", {
    p_post_id: postId,
    p_option_ids: optionIds,
  });
  if (error) throw new Error(error.message);
}

export async function encerrarEnquete(postId: string): Promise<void> {
  const { error } = await supabase.rpc("club_encerrar_enquete", { p_post_id: postId });
  if (error) throw new Error(error.message);
}

// --- Edição -------------------------------------------------------------------

export async function updateClubPost(
  postId: string,
  patch: { conteudo: string; pagina_referencia: number | null },
): Promise<void> {
  const { error } = await supabase
    .from("club_posts")
    .update({ conteudo: patch.conteudo, pagina_referencia: patch.pagina_referencia })
    .eq("id", postId);
  if (error) throw new Error(error.message);
}

export async function updateClubPostComment(commentId: string, conteudo: string): Promise<void> {
  const { error } = await supabase.from("club_post_comments").update({ conteudo }).eq("id", commentId);
  if (error) throw new Error(error.message);
}

export async function updateClubEvent(
  eventId: string,
  patch: { titulo: string; descricao: string | null; data_hora: string; local_ou_link: string | null },
): Promise<void> {
  const { error } = await supabase
    .from("club_events")
    .update({
      titulo: patch.titulo,
      descricao: patch.descricao,
      data_hora: patch.data_hora,
      local_ou_link: patch.local_ou_link,
    })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
}

/** "2026-11-27T19:30" (campo datetime-local) a partir de uma data ISO. */
export function paraCampoDataHora(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
