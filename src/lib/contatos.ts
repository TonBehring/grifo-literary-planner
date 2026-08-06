import { supabase } from "@/integrations/supabase/client";

export type Contato = { id: string; nome: string; username: string | null };

export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

function clean(message: string) {
  return message.replace(/^.*?:\s*/, "").trim() || message;
}

export async function setUsername(value: string): Promise<string> {
  const { data, error } = await supabase.rpc("definir_username", {
    novo_username: value.trim().toLowerCase(),
  });
  if (error) throw new Error(clean(error.message));
  return data as string;
}

export async function getMyUsername(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  return ((data as { username: string | null } | null)?.username) ?? null;
}

export async function connectByUsername(username: string): Promise<Contato> {
  const { data, error } = await supabase.rpc("conectar_por_username", {
    username_alvo: username.trim().toLowerCase(),
  });
  if (error) throw new Error(clean(error.message));
  const row = (data as Array<{ contato_id: string; nome: string }> | null)?.[0];
  if (!row) throw new Error("Usuário não encontrado");
  return { id: row.contato_id, nome: row.nome, username: username.trim().toLowerCase() };
}

export async function listContacts(): Promise<Contato[]> {
  const { data, error } = await supabase.rpc("listar_meus_contatos");
  if (error) throw new Error(clean(error.message));
  return ((data as Array<{ contato_id: string; nome: string; username: string | null }> | null) ?? []).map(
    (r) => ({ id: r.contato_id, nome: r.nome, username: r.username }),
  );
}