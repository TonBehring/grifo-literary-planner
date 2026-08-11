import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("user already registered")) return "Este e-mail já está cadastrado. Tente entrar.";
  if (m.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("unable to validate email address")) return "Digite um e-mail válido.";
  return "Não foi possível continuar. Verifique os dados e tente de novo.";
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar no Grifo — seu planner de leitura" },
      {
        name: "description",
        content:
          "Acesse o Grifo para acompanhar leituras, anotar citações e organizar empréstimos de livros.",
      },
      { property: "og:title", content: "Entrar no Grifo" },
      {
        property: "og:description",
        content: "Seu planner de literatura: progresso, citações e empréstimos em um só lugar.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Conecte o banco de dados para entrar.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (error) throw error;
        toast.success("Se esse e-mail estiver cadastrado, enviamos um link para redefinir a senha.");
        setMode("login");
        setPassword("");
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Confirme seu e-mail para ativar a conta.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
   } catch (err) {
      toast.error(err instanceof Error ? friendlyAuthError(err.message) : "Não foi possível continuar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="font-display text-5xl tracking-tight">
            Grifo
            <span className="ml-1 inline-block h-2 w-2 rounded-full bg-primary align-super" />
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Um planner de literatura para marcar o que importa.
          </p>
        </div>

        <form onSubmit={submit} className="card-teal mt-8 rounded-3xl p-6">
          {mode !== "reset" && (
            <div className="mb-6 flex rounded-full bg-white/10 p-1 text-sm">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={
                    "flex-1 rounded-full py-2 transition-colors " +
                    (mode === m ? "bg-primary text-primary-foreground" : "opacity-70")
                  }
                >
                  {m === "login" ? "Entrar" : "Criar conta"}
                </button>
              ))}
            </div>
          )}

          {mode === "reset" && (
            <p className="mb-5 text-sm opacity-80">
              Informe seu e-mail e enviaremos um link para você criar uma nova senha.
            </p>
          )}

          {mode === "signup" && (
            <Field label="Nome">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                className={inputClass}
              />
            </Field>
          )}

          <Field label="E-mail">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              required
              className={inputClass}
            />
          </Field>

          {mode !== "reset" && (
            <Field label="Senha">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={mode === "signup" ? 6 : undefined}
                  maxLength={72}
                  required
                  className={inputClass + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-3 flex items-center text-white/60 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
          )}

          {mode === "login" && (
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="-mt-2 mb-4 block text-xs text-white/70 underline underline-offset-4 hover:text-white"
            >
              Esqueci minha senha
            </button>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy
              ? "Aguarde…"
              : mode === "login"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar minha estante"
                  : "Enviar link de redefinição"}
          </button>

          {mode === "reset" && (
            <button
              type="button"
              onClick={() => setMode("login")}
              className="mt-3 block w-full text-center text-xs text-white/70 underline underline-offset-4 hover:text-white"
            >
              Voltar para o login
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[11px] tracking-[0.18em] uppercase opacity-70">
        {label}
      </span>
      {children}
    </label>
  );
}
