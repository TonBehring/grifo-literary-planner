import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/conta")({
  head: () => ({
    meta: [{ title: "Minha conta — Grifo" }],
  }),
  component: () => (
    <AppShell>
      <AccountPage />
    </AppShell>
  ),
});

function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState((user?.user_metadata?.full_name as string) ?? "");
  const [nickname, setNickname] = useState((user?.user_metadata?.nickname as string) ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (newPassword && newPassword.length < 6) {
      toast.error("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setSaving(true);
    try {
      const payload: {
        data: { full_name: string; nickname: string };
        email?: string;
        password?: string;
      } = {
        data: { full_name: fullName.trim(), nickname: nickname.trim() },
      };
      if (email.trim() && email.trim() !== user?.email) payload.email = email.trim();
      if (newPassword) payload.password = newPassword;

      const { error } = await supabase.auth.updateUser(payload);
      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      toast.success(
        payload.email
          ? "Dados salvos! Confirme o novo e-mail na sua caixa de entrada para efetivar a troca."
          : "Dados atualizados com sucesso.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h1 className="font-display text-4xl leading-tight">Minha conta</h1>

      <div className="panel-cream mt-6 space-y-4 rounded-2xl p-5">
        <Field label="Nome completo">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </Field>

        <Field label="Apelido">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={60}
            placeholder="Como quer ser chamado"
            className={inputClass}
          />
        </Field>

        <Field label="E-mail">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            className={inputClass}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Se trocar o e-mail, você vai receber uma confirmação no novo endereço antes da troca valer.
        </p>

        <div className="border-t border-border pt-4">
          <p className="mb-3 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Trocar senha (opcional)
          </p>
          <Field label="Nova senha">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              maxLength={72}
              className={inputClass}
            />
          </Field>
          <Field label="Confirmar nova senha">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              maxLength={72}
              className={inputClass}
            />
          </Field>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>

        <button
          onClick={() => {
            void signOut().then(() => navigate({ to: "/auth" }));
          }}
          className="w-full rounded-xl border border-destructive/40 py-3 text-sm text-destructive"
        >
          Sair da conta
        </button>
      </div>
    </section>
  );
}

const inputClass =
  "w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
