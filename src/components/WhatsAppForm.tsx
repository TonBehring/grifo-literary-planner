import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatWhatsApp, saveWhatsApp, validWhatsApp, whatsappQueryKey, type WhatsAppProfile } from "@/lib/whatsapp";

export function WhatsAppForm({ userId, profile, submitLabel = "Salvar", onSaved }: {
  userId: string;
  profile?: WhatsAppProfile;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const id = useId();
  const queryClient = useQueryClient();
  const [number, setNumber] = useState(() => formatWhatsApp(profile?.whatsapp ?? ""));
  const [accepts, setAccepts] = useState(profile?.whatsapp_aceita_contato ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    setNumber(formatWhatsApp(profile?.whatsapp ?? ""));
    setAccepts(profile?.whatsapp_aceita_contato ?? true);
  }, [profile?.whatsapp, profile?.whatsapp_aceita_contato]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || !validWhatsApp(number)) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const saved = await saveWhatsApp(number, accepts);
      queryClient.setQueryData(whatsappQueryKey(userId), saved);
      toast.success("Pronto! Seu WhatsApp foi salvo 💚");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar seu WhatsApp agora. Tente novamente.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={`${id}-number`} className="block text-sm font-medium">Seu WhatsApp</label>
        <input id={`${id}-number`} type="tel" inputMode="tel" autoComplete="tel-national"
          placeholder="(11) 98765-4321" value={number} disabled={saving}
          onChange={(event) => { setNumber(formatWhatsApp(event.target.value)); setError(""); }}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex items-start gap-2.5">
        <Checkbox id={`${id}-accepts`} checked={accepts} disabled={saving}
          onCheckedChange={(checked) => setAccepts(checked === true)} className="mt-0.5" />
        <label htmlFor={`${id}-accepts`} className="text-sm leading-relaxed text-muted-foreground">
          Aceito receber mensagens do Grifo pelo WhatsApp. Posso sair quando quiser.
        </label>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={!validWhatsApp(number) || saving}
        className="h-auto min-h-11 w-full whitespace-normal bg-contact-action text-contact-surface hover:bg-contact-action/90">
        {saving ? "Salvando…" : submitLabel}
      </Button>
    </form>
  );
}