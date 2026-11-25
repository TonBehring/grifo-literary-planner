import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Library,
  HandHeart,
  Plus,
  LogOut,
  BarChart3,
  UserRound,
  Users,
  Bell,
  CircleHelp,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { getMySubscription, hasActiveAccess } from "@/lib/subscription";
import { getUnreadCount } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { peekPendingInvite, savePendingInviteFromUrl } from "@/lib/club-invite";
import { markRedirectedToAccount, shouldRedirectToAccount } from "@/lib/trial-campaign";
import { SubscriptionNudge } from "@/components/SubscriptionNudge";
import { WhatsAppNudge } from "@/components/WhatsAppNudge";
import { InstallBanner } from "@/components/InstallBanner";

const NAV = [
  { to: "/", label: "Lendo Agora", icon: BookOpen },
  { to: "/biblioteca", label: "Biblioteca", icon: Library },
  { to: "/clubes", label: "Clubes de Leitura", icon: Users },
  { to: "/emprestimos", label: "Empréstimos", icon: HandHeart },
  { to: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [subscriptionNudgeOpen, setSubscriptionNudgeOpen] = useState(false);
  const [whatsappNudgeOpen, setWhatsappNudgeOpen] = useState(false);

  useEffect(() => {
    const sync = () => setWhatsappNudgeOpen(Boolean(document.querySelector('[data-whatsapp-nudge][data-state="open"]')));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
    return () => observer.disconnect();
  }, []);

  const subscription = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: getMySubscription,
    enabled: Boolean(user),
  });

  const unreadCount = useQuery({
    queryKey: ["notifications-unread-count", user?.id],
    queryFn: getUnreadCount,
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!loading && !user && isSupabaseConfigured) {
      // Se a pessoa abriu um link de convite de clube, guarda o código para
      // depois do login ou do cadastro.
      savePendingInviteFromUrl(window.location.pathname, window.location.search);
      navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  // Depois de entrar (ou criar a conta), quem tinha um convite guardado vai
  // direto para a tela de entrar no clube, com o código preenchido.
  useEffect(() => {
    if (
      !loading &&
      user &&
      pathname !== "/clubes/entrar" &&
      !pathname.startsWith("/assinatura") &&
      peekPendingInvite()
    ) {
      navigate({ to: "/clubes/entrar" });
    }
  }, [loading, user, pathname, navigate]);

  // Quem chegou por um convite de teste grátis (/convite/...) vai uma vez para
  // "Minha conta" depois de entrar, onde o botão do cartão já vem com o teste.
  useEffect(() => {
    if (
      !loading &&
      user &&
      pathname !== "/conta" &&
      pathname !== "/clubes/entrar" &&
      !pathname.startsWith("/assinatura") &&
      shouldRedirectToAccount()
    ) {
      markRedirectedToAccount();
      navigate({ to: "/conta" });
    }
  }, [loading, user, pathname, navigate]);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="panel-cream max-w-md rounded-2xl p-8 text-center">
          <h1 className="font-display text-2xl">Grifo ainda não está conectado</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Cole a Project URL e a anon key do seu projeto para ativar login, biblioteca e
            empréstimos.
          </p>
        </div>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-8 pb-4">
        <Link to="/" className="inline-flex items-center">
          <img src="/brand/logo-grifo.png" alt="Grifo" className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          {(pathname === "/" || pathname.startsWith("/biblioteca")) && (
            <Link
              to="/adicionar"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Livro
            </Link>
          )}
          <Link
            to="/notificacoes"
            aria-label="Notificações"
            className="relative inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            {(unreadCount.data ?? 0) > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive" />
            )}
          </Link>
          <Link
            to="/ajuda"
            aria-label="Ajuda"
            className="inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <CircleHelp className="h-4 w-4" />
          </Link>
          <Link
            to="/conta"
            aria-label="Minha conta"
            className="inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <UserRound className="h-4 w-4" />
          </Link>
          <button
            aria-label="Sair da conta"
            onClick={() => {
              void signOut().then(() => navigate({ to: "/auth" }));
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5">
        {!subscription.isLoading && !hasActiveAccess(subscription.data) && pathname !== "/conta" && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-xs">
            <span>Assine o Grifo para registrar progresso, anotações e muito mais.</span>
            <Link to="/conta" className="font-medium text-[#85651C] underline underline-offset-4">
              Assinar
            </Link>
          </div>
        )}
        {children}
      </main>

      <SubscriptionNudge
        subscription={subscription.data}
        loading={subscription.isLoading || subscription.isError}
        pathname={pathname}
        onOpenChange={setSubscriptionNudgeOpen}
      />
      <WhatsAppNudge key={`${user.id}:${pathname}`} userId={user.id} pathname={pathname}
        subscriptionOpen={subscriptionNudgeOpen}
        subscriptionLoading={subscription.isLoading || subscription.isError} />

      <InstallBanner userId={user.id} pathname={pathname} dialogOpen={subscriptionNudgeOpen || whatsappNudgeOpen} />

      <nav data-install-navigation className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-center text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative inline-flex">
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
