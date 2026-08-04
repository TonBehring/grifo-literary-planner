import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Camera, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { uploadCover } from "@/lib/cover-upload";
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
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState((user?.user_metadata?.['full_name'] as string) ?? "");
  const [nickname, setNickname] = useState((user?.user_metadata?.['nickname'] as string) ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [avatarUrl, setAvatarUrl] = useState((user?.user_metadata?.['avatar_url'] as string) ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

const [changingPassword, setChangingPassword] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadCover(file, user.id);
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: url } });
      if (error) throw error;
      setAvatarUrl(url);
      toast.success("Foto atualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a foto");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload: { data: { full_name: string; nickname: string }; email?: string } = {
        data: { full_name: fullName.trim(), nickname: nickname.trim() },
      };
      if (email.trim() && email.trim() !== user?.email) payload.email = email.trim();

      const { error } = await supabase.auth.updateUser(payload);
      if (error) throw error;

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

  async function verifyCurrentPassword() {
    if (!user?.email || !currentPassword) return;
    setVerifying(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (error) {
        toast.error("Senha atual incorreta.");
        return;
      }
      setPasswordVerified(true);
    } finally {
      setVerifying(false);
    }
  }

  async function saveNewPassword() {
    if (newPassword.length < 6) {
      toast.error("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso.");
      setChangingPassword(false);
      setPasswordVerified(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setSavingPassword(false);
    }
  }

  const initial = (nickname || fullName || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <section>
      <h1 className="font-display text-4xl leading-tight">Minha conta</h1>

      <div className="panel-cream mt-6 space-y-4 rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <div className="h-20 w-20 overflow-hidden rounded-full bg-teal-deep">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Sua foto" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl text-white/80">
                  {initial}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Trocar foto"
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow disabled:opacity-60"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {uploadingAvatar ? "Enviando foto…" : "Toque no ícone da câmera para trocar sua foto."}
          </p>
        </div>

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

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>

        <div className="border-t border-border pt-4">
          {!changingPassword && (
            <button
              onClick={() => setChangingPassword(true)}
              className="text-sm text-primary underline underline-offset-4"
            >
              Trocar senha
            </button>
          )}

          {changingPassword && !passwordVerified && (
            <div className="space-y-3">
              <Field label="Confirme sua senha atual">
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={inputClass + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    aria-label={showCurrentPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <div className="flex gap-2">
                <button
                  onClick={verifyCurrentPassword}
                  disabled={verifying || !currentPassword}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {verifying ? "Verificando…" : "Confirmar"}
                </button>
                <button
                  onClick={() => {
                    setChangingPassword(false);
                    setCurrentPassword("");
                  }}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {changingPassword && passwordVerified && (
            <div className="space-y-3">
<Field label="Nova senha">
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    maxLength={72}
                    className={inputClass + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label={showNewPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Field label="Confirmar nova senha">
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    maxLength={72}
                    className={inputClass + " pr-10"}
                  />
                </div>
              </Field>
              <button
                onClick={saveNewPassword}
                disabled={savingPassword}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {savingPassword ? "Salvando…" : "Salvar nova senha"}
              </button>
            </div>
          )}
        </div>

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
