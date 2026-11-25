import { supabase } from "@/integrations/supabase/client";

// Corrige o progresso para um valor MENOR que o registrado (página ou %),
// quando a pessoa digitou a mais por engano. No livro físico, o banco também
// tira as páginas a mais dos registros de leitura mais recentes, para o
// calendário e as estatísticas não contarem o que não foi lido.
export async function corrigirProgresso(userBookId: string, valor: number): Promise<void> {
  const { error } = await supabase.rpc("corrigir_progresso", {
    p_user_book_id: userBookId,
    p_valor: valor,
  });
  if (error) throw new Error(error.message);
}
