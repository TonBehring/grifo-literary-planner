import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BookOpen, Library, HandHeart, Plus, LogOut, ShoppingCart } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Lendo Agora", icon: BookOpen },
  { to: "/biblioteca", label: "Biblioteca", icon: Library },
  { to: "/desejos", label: "Quero comprar", icon: ShoppingCart },
  { to: "/emprestimos", label: "Empréstimos", icon: HandHeart },
  { to: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user && isSupabaseConfigured) {
      navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

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
        <Link to="/" className="font-display text-2xl tracking-tight">
          Grifo
          <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary align-super" />
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
         <button
            aria-label="Sair da conta"
            onClick={() => {
              void signOut().then(() => navigate({ to: "/auth" }));
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
