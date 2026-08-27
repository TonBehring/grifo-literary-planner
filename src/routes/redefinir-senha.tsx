import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [{ title: "Redefinir senha — Grifo" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada. Você já está com a nova senha.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? "Não foi possível redefinir. O link pode ter expirado — solicite um novo em Esqueci minha senha."
          : "Não foi possível redefinir a senha.",
      );
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
          <p className="mt-3 text-sm text-muted-foreground">Crie uma nova senha para sua conta.</p>
        </div>

        <form onSubmit={submit} className="card-teal mt-8 rounded-3xl p-6">
          <label className="mb-4 block">
            <span className="mb-1.5 block text-[11px] tracking-[0.18em] uppercase opacity-70">
              Nova senha
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={72}
                required
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary"
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
          </label>

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Aguarde…" : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
