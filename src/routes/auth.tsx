import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { reportSignupConversion } from "@/lib/google-ads";
import { Button } from "@/components/ui/button";

function isEmailSendLimited(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: number; code?: string; message?: string };
  const message = value.message?.toLowerCase() ?? "";
  return value.status === 429 || value.code === "over_email_send_rate_limit" ||
    message.includes("security purposes") || message.includes("rate limit");
}

function friendlyAuthError(message: string, error?: unknown): string {
  if (isEmailSendLimited(error ?? { message })) {
    return "Já enviamos um e-mail agora há pouco. Confira sua caixa de entrada; se precisar, peça outro em 1 minuto.";
  }
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("user already registered")) return "Este e-mail já está cadastrado. Tente entrar.";
  if (m.includes("password should be at least")) return "A senha precisa ter pelo menos 8 caracteres.";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
const [name, setName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [signupDoneEmail, setSignupDoneEmail] = useState<string | null>(null);
  const submitting = useRef(false);
  const sending = useRef(false);

  function showSignupDone() {
    setSignupDoneEmail(email);
    setPassword("");
    setResent(false);
    setCooldown(60);
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resendConfirmation() {
    const targetEmail = signupDoneEmail ?? unconfirmedEmail;
    if (!targetEmail || cooldown > 0 || sending.current) return;
    sending.current = true;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        const limited = isEmailSendLimited(error);
        if (limited) {
          toast.error("Aguarde um minuto para pedir outro e-mail.");
          setCooldown(60);
        } else {
          toast.error("Não foi possível reenviar o e-mail. Tente de novo.");
        }
        return;
      }
      setResent(true);
      setCooldown(60);
    } catch {
      toast.error("Não foi possível reenviar o e-mail. Tente de novo.");
    } finally {
      sending.current = false;
      setResending(false);
    }
  }
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || busy || signupDoneEmail) return;
    if (!isSupabaseConfigured) {
      toast.error("Conecte o banco de dados para entrar.");
      return;
    }
    if (mode === "signup" && !acceptedTerms) {
      toast.error("Você precisa aceitar os Termos de Uso e a Política de Privacidade para criar conta.");
      return;
    }
    submitting.current = true;
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
            data: {
              full_name: name,
              // Registro de consentimento (LGPD) — guarda quando a pessoa
              // aceitou os Termos/Política vigentes no momento do cadastro.
              terms_accepted_at: new Date().toISOString(),
            },
          },
        });
        if (error) throw error;
        if (data.user?.identities?.length === 0) {
          toast.error("Este e-mail já tem cadastro. Entre com sua senha ou use Esqueci minha senha.");
          setMode("login");
          setPassword("");
          setUnconfirmedEmail(null);
          return;
        }
        // Medição da campanha de anúncios: conta a conversão "Cadastro
        // concluído" (respeita o consentimento de rastreamento do visitante).
        if (data.user) void reportSignupConversion();
        if (!data.session) {
          showSignupDone();
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const code = (error as { code?: string }).code;
          if (code === "email_not_confirmed" || error.message.toLowerCase().includes("email not confirmed")) {
            setUnconfirmedEmail(email);
            setResent(false);
            return;
          }
          throw error;
        }
        setUnconfirmedEmail(null);
      }
   } catch (err) {
      if (mode === "signup" && isEmailSendLimited(err)) showSignupDone();
      toast.error(friendlyAuthError(err instanceof Error ? err.message : "", err));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1>
            <img
              src="/brand/logo-grifo.png"
              alt="Grifo"
              className="mx-auto h-14 w-auto"
            />
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Um planner de literatura para marcar o que importa.
          </p>
        </div>

        {signupDoneEmail ? (
          <section className="card-teal mt-8 rounded-3xl p-6 text-center" aria-live="polite">
            <h2 className="font-display text-2xl">Falta só um passo! 📬</h2>
            <p className="mt-4 text-sm leading-relaxed">
              Enviamos um link de confirmação para <strong className="break-all">{signupDoneEmail}</strong>.
              {" "}Abra o e-mail e toque em Confirmar para ativar sua conta.
            </p>
            <p className="mt-3 text-xs leading-relaxed opacity-70">
              Não chegou em alguns minutos? Olhe no spam ou em Promoções.
            </p>
            <Button onClick={() => void resendConfirmation()} disabled={resending || cooldown > 0}
              className="mt-6 h-12 w-full whitespace-normal">
              {resending ? "Reenviando…" : cooldown > 0 ? `Reenviar e-mail (${cooldown}s)` : "Reenviar e-mail"}
            </Button>
            {resent && <p className="mt-3 text-xs text-primary">E-mail reenviado!</p>}
            <Button variant="link" className="mt-3 h-auto w-full whitespace-normal" onClick={() => {
              setSignupDoneEmail(null);
              setMode("signup");
              setEmail("");
              setPassword("");
              setName("");
              setAcceptedTerms(false);
              setShowPassword(false);
              setUnconfirmedEmail(null);
              setResent(false);
            }}>Usar outro e-mail</Button>
            <Button variant="link" className="h-auto w-full whitespace-normal" onClick={() => {
              setEmail(signupDoneEmail);
              setSignupDoneEmail(null);
              setMode("login");
              setPassword("");
              setUnconfirmedEmail(null);
            }}>Já confirmei, quero entrar</Button>
          </section>
        ) : (
        <form onSubmit={submit} className="card-teal mt-8 rounded-3xl p-6">
          {mode !== "reset" && (
            <div className="mb-6 flex rounded-full bg-white/10 p-1 text-sm">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={busy}
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
                  minLength={mode === "signup" ? 8 : undefined}
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

          {mode === "signup" && (
            <label className="mb-5 flex items-start gap-2.5 text-xs leading-relaxed text-white/80">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/30 bg-white/5 accent-primary"
              />
              <span>
                Li e concordo com os{" "}
                <a
                  href="/termos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  Termos de Uso
                </a>{" "}
                e a{" "}
                <a
                  href="/privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  Política de Privacidade
                </a>{" "}
                do Grifo.
              </span>
            </label>
          )}

          {mode === "login" && unconfirmedEmail && (
            <div className="mb-4 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
              <p>
                Falta só confirmar seu e-mail. Enviamos um link para{" "}
                <strong className="break-all">{unconfirmedEmail}</strong>. Não achou? Olhe também no
                spam.
              </p>
              <button
                type="button"
                onClick={() => void resendConfirmation()}
                disabled={resending || cooldown > 0}
                className="mt-3 w-full rounded-lg border border-primary/60 py-2 text-xs font-medium text-primary transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {resending
                  ? "Reenviando…"
                  : cooldown > 0
                    ? `Reenviar e-mail de confirmação (${cooldown}s)`
                    : "Reenviar e-mail de confirmação"}
              </button>
              {resent && <p className="mt-2 text-xs font-medium text-primary">E-mail reenviado!</p>}
            </div>
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
            disabled={busy || (mode === "signup" && !acceptedTerms)}
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
        )}
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
