import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

export const Route = createFileRoute("/notificacoes")({
  head: () => ({
    meta: [{ title: "Notificações — Grifo" }],
  }),
  component: () => (
    <AppShell>
      <NotificacoesPage />
    </AppShell>
  ),
});

function NotificacoesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: getMyNotifications,
  });

  const hasUnread = (data ?? []).some((n) => !n.read_at);

  async function handleOpen(id: string, read: boolean) {
    if (read) return;
    await markNotificationRead(id);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  }

  async function handleMarkAll() {
    await markAllNotificationsRead();
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  }

  return (
    <section className="pb-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl leading-tight">Notificações</h1>
        {hasUnread && (
          <button
            onClick={handleMarkAll}
            className="text-sm text-primary underline underline-offset-4"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
      ) : !data || data.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Você ainda não recebeu nenhuma notificação.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {data.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleOpen(n.id, Boolean(n.read_at))}
              className={
                "block w-full rounded-xl border p-4 text-left transition-colors " +
                (n.read_at ? "border-border bg-transparent" : "border-primary/40 bg-primary/5")
              }
            >
              <div className="flex items-start gap-2">
                {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                <div>
                  <p className="font-display text-lg leading-snug">{n.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
