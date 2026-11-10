import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Props = { tokenHash?: string; type?: string };

export function ConfirmEmailPage({ tokenHash, type = "email" }: Props) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const confirming = useRef(false);
  const sending = useRef(false);
  const [failed, setFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendError, setResendError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function confirm() {
    if (confirming.current || loading || user) return;
    const otpType = type === "signup" ? "email" : type;
    if (!tokenHash || (otpType !== "email" && otpType !== "email_change" && otpType !== "invite")) {
      setFailed(true);
      return;
    }
    confirming.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
      if (error) {
        setFailed(true);
        return;
      }
      toast.success("E-mail confirmado! Bem-vindo ao Grifo 📚");
      await navigate({ to: "/" });
    } catch {
      setFailed(true);
    } finally {
      confirming.current = false;
      setBusy(false);
    }
  }

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || cooldown > 0 || !email.trim()) return;
    sending.current = true;
    setResending(true);
    setResendError("");
    setSent(false);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        const message = error.message.toLowerCase();
        const limited = error.status === 429 || error.code === "over_email_send_rate_limit" ||
          message.includes("rate limit") || message.includes("security purposes");
        if (limited) {
          setCooldown(60);
          setResendError("Aguarde um minuto para pedir outro e-mail.");
        } else {
          setResendError("Não foi possível reenviar o e-mail. Tente de novo.");
        }
        return;
      }
      setSent(true);
      setCooldown(60);
    } catch {
      setResendError("Não foi possível reenviar o e-mail. Tente de novo.");
    } finally {
      sending.current = false;
      setResending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-sm">
        <img src="/brand/logo-grifo.png" alt="Grifo" className="mx-auto h-14 w-auto max-w-full object-contain" />
        <section className="card-teal mt-8 rounded-3xl p-6 text-center" aria-busy={busy || resending}>
          {user && !busy ? (
            <>
              <h1 className="font-display text-2xl">Seu e-mail já está confirmado.</h1>
              <Button asChild className="mt-6 h-12 w-full"><Link to="/">Ir para o Grifo</Link></Button>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl">Confirme seu e-mail</h1>
              {!failed ? (
                <>
                  <p className="mt-3 text-sm opacity-80">Toque no botão abaixo para ativar sua conta no Grifo.</p>
                  <Button onClick={() => void confirm()} disabled={busy || loading} className="mt-6 h-12 w-full">
                    {busy ? "Confirmando…" : "Confirmar meu e-mail"}
                  </Button>
                </>
              ) : (
                <>
                  <p role="alert" className="mt-3 text-sm">Este link expirou ou já foi usado.</p>
                  <form onSubmit={(event) => void resend(event)} className="mt-6 text-left">
                    <label htmlFor="confirmation-email" className="mb-2 block text-sm">E-mail</label>
                    <input id="confirmation-email" type="email" autoComplete="email" required maxLength={255}
                      value={email} onChange={(event) => setEmail(event.target.value)}
                      className="w-full rounded-lg border border-card-foreground/20 bg-card-foreground/5 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                    <Button type="submit" disabled={resending || cooldown > 0} className="mt-4 h-12 w-full">
                      {resending ? "Enviando…" : cooldown > 0 ? `Enviar novo link (${cooldown}s)` : "Enviar novo link"}
                    </Button>
                    {sent && <p role="status" className="mt-3 text-sm text-primary">Pronto! Enviamos um novo link para o seu e-mail.</p>}
                    {resendError && <p role="alert" className="mt-3 text-sm">{resendError}</p>}
                  </form>
                </>
              )}
              <Button asChild variant="link" className="mt-4 h-auto w-full whitespace-normal text-sm">
                <Link to="/auth">Já confirmei, quero entrar</Link>
              </Button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}