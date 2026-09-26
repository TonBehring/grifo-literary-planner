import { supabase } from "@/integrations/supabase/client";

export type FounderStatus = {
  founder_number: number;
  discount_applied: boolean;
} | null;

// Traz o status de fundador do próprio usuário logado — a RLS da tabela
// "founders" só deixa cada um ver a própria linha, então não precisa (nem
// dá) filtrar por id aqui.
export async function getMyFounderStatus(): Promise<FounderStatus> {
  const { data, error } = await supabase
    .from("founders")
    .select("founder_number, discount_applied")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as FounderStatus;
}
