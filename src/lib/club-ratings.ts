import { supabase } from "@/integrations/supabase/client";

// Avaliação do clube ao fim de uma leitura. Revelação conjunta: a média e os
// comentários só aparecem para quem já avaliou (ou para todos depois que a
// avaliação fecha, quando a próxima leitura começa).

export type ClubRatingEntry = {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  nota: number;
  comentario: string | null;
};

export type ClubRatingSummary = {
  club_book_id: string;
  club_id: string;
  clube: string;
  titulo: string;
  autor: string | null;
  capa_url: string | null;
  janela_aberta: boolean;
  fecha_em: string | null;
  total_membros: number;
  avaliaram: number;
  minha_nota: number | null;
  meu_comentario: string | null;
  revelado: boolean;
  media: number | null;
  distribuicao: number[] | null; // quantidade de notas 1, 2, 3, 4 e 5
  avaliacoes: ClubRatingEntry[] | null;
};

// Leitura concluída do clube com avaliação aberta (a mais recente), ou null.
export async function getOpenClubRating(clubId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("club_avaliacao_aberta", { p_club_id: clubId });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

export async function getClubRatingSummary(clubBookId: string): Promise<ClubRatingSummary> {
  const { data, error } = await supabase.rpc("club_avaliacao_resumo", { p_club_book_id: clubBookId });
  if (error) throw new Error(error.message);
  return data as ClubRatingSummary;
}

export async function rateClubBook(clubBookId: string, nota: number, comentario: string): Promise<void> {
  const { error } = await supabase.rpc("club_avaliar", {
    p_club_book_id: clubBookId,
    p_nota: nota,
    p_comentario: comentario.trim() || null,
  });
  if (error) throw new Error(error.message);
}
