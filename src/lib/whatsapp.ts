import { supabase } from "@/integrations/supabase/client";

export type WhatsAppProfile = {
  whatsapp: string | null;
  whatsapp_aceita_contato: boolean;
};

export const WHATSAPP_DISMISS_KEY = "grifo_whatsapp_nudge_until";
export const WHATSAPP_DISMISS_MS = 3 * 24 * 60 * 60 * 1000;
export const whatsappQueryKey = (userId: string) => ["profile-whatsapp", userId];

export function localWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, "");
  return (digits.length === 12 || digits.length === 13) && digits.startsWith("55")
    ? digits.slice(2)
    : digits;
}

export function validWhatsApp(value: string): boolean {
  return /^\d{10,11}$/.test(localWhatsApp(value));
}

export function formatWhatsApp(value: string): string {
  const digits = localWhatsApp(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const subscriber = digits.slice(2);
  const split = subscriber.length > 8 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${subscriber.slice(0, split)}${subscriber.length > split ? `-${subscriber.slice(split)}` : ""}`;
}

export function whatsappDismissed(storage: Pick<Storage, "getItem">, now = Date.now()): boolean {
  try {
    return Number(storage.getItem(WHATSAPP_DISMISS_KEY)) > now;
  } catch {
    return false;
  }
}

export function dismissWhatsApp(storage: Pick<Storage, "setItem">, now = Date.now()): void {
  try {
    storage.setItem(WHATSAPP_DISMISS_KEY, String(now + WHATSAPP_DISMISS_MS));
  } catch {
    // The dialog still closes if storage is unavailable.
  }
}

export function whatsappExcluded(pathname: string): boolean {
  return ["/conta", "/assinatura/retorno", "/confirmar", "/auth", "/redefinir-senha"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function getWhatsApp(userId: string): Promise<WhatsAppProfile> {
  const { data, error } = await supabase.from("profiles")
    .select("whatsapp, whatsapp_aceita_contato").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return { whatsapp: data?.whatsapp ?? null, whatsapp_aceita_contato: data?.whatsapp_aceita_contato ?? true };
}

export async function saveWhatsApp(value: string, accepts: boolean): Promise<WhatsAppProfile> {
  const digits = localWhatsApp(value);
  if (!validWhatsApp(digits)) throw new Error("Confira o número com DDD, por favor.");
  const { error } = await supabase.rpc("salvar_whatsapp", { p_whatsapp: digits, p_aceita: accepts });
  if (error) {
    throw new Error(error.message.includes("whatsapp_invalido")
      ? "Confira o número com DDD, por favor."
      : "Não foi possível salvar seu WhatsApp agora. Tente novamente.");
  }
  return { whatsapp: `55${digits}`, whatsapp_aceita_contato: accepts };
}