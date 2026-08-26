import { supabase } from "@/integrations/supabase/client";

export type GrifoNotification = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

export async function getMyNotifications(): Promise<GrifoNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, url, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as GrifoNotification[];
}

export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
  await syncAppBadge();
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw new Error(error.message);
  await syncAppBadge();
}

// Atualiza o número no ícone do app (tela inicial) pra refletir o total de
// não lidas agora. No Android isso não faz nada visível — lá o número vem
// automaticamente das notificações não dispensadas na bandeja. No iPhone
// (iOS/iPadOS 16.4+, app instalado, com permissão de notificação concedida)
// é isso que efetivamente atualiza o número no ícone.
export async function syncAppBadge(): Promise<void> {
  if (typeof navigator === "undefined") return;
  try {
    const count = await getUnreadCount();
    if (count > 0 && "setAppBadge" in navigator) {
      // deno-lint-ignore no-explicit-any
      await (navigator as any).setAppBadge(count);
    } else if ("clearAppBadge" in navigator) {
      // deno-lint-ignore no-explicit-any
      await (navigator as any).clearAppBadge();
    }
  } catch {
    // Badging API não suportada nesse navegador/contexto — ignora.
  }
}
