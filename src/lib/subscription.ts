import { supabase } from "@/integrations/supabase/client";
import { clearPendingCampaign, peekPendingCampaign } from "@/lib/trial-campaign";

export type Subscription = {
  id?: string;
  provider: "mercado_pago" | "asaas" | "cortesia";
  status: string;
  current_period_end: string | null;
  charged_value?: number | string | null;
  // fim do teste grátis com cartão (a 1ª cobrança acontece nessa data)
  trial_until?: string | null;
};

export async function getMySubscription(): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, provider, status, current_period_end, charged_value, trial_until")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Subscription | null) ?? null;
}

export function hasActiveAccess(sub: Subscription | null | undefined): boolean {
  if (!sub?.current_period_end) return false;
  return new Date(sub.current_period_end).getTime() > Date.now();
}

// Está no teste grátis: acesso até trial_until e 1ª cobrança nessa data.
export function isInTrial(sub: Subscription | null | undefined): boolean {
  return Boolean(sub?.trial_until && new Date(sub.trial_until).getTime() > Date.now());
}

// Lê a mensagem de erro que a Edge Function devolveu (o supabase-js só
// mostra "non-2xx status code" por padrão).
async function functionErrorMessage(error: unknown, fallback: string): Promise<{ message: string; code?: string }> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = (await ctx.json()) as { error?: string; trial_error?: string };
      if (body?.error) return { message: body.error, ...(body.trial_error ? { code: body.trial_error } : {}) };
    } catch {
      // corpo não era JSON
    }
  }
  const msg = (error as { message?: unknown } | null)?.message;
  return { message: typeof msg === "string" && msg ? msg : fallback };
}

export async function createSubscriptionCheckout(
  method: "card" | "pix" = "card",
): Promise<string> {
  // Convite de teste grátis guardado no navegador (só vale no cartão).
  const campanha = method === "card" ? peekPendingCampaign() : null;
  const { data, error } = await supabase.functions.invoke("asaas-create-subscription", {
    body: campanha ? { method, campanha } : { method },
  });
  if (error) {
    const { message, code } = await functionErrorMessage(error, "Não foi possível iniciar a assinatura");
    // Convite inválido ou pessoa sem direito ao teste: esquece o convite,
    // para o próximo toque seguir a assinatura normal.
    if (code === "campanha_invalida" || code === "nao_elegivel") clearPendingCampaign();
    throw new Error(message);
  }
  const payload = data as { checkout_url?: string; error?: string } | null;
  if (!payload?.checkout_url) {
    throw new Error(payload?.error ?? "Não foi possível iniciar a assinatura");
  }
  return payload.checkout_url;
}

// Cancela o teste grátis antes da 1ª cobrança. O acesso continua até o fim do teste.
export async function cancelTrial(): Promise<{ acesso_ate: string }> {
  const { data, error } = await supabase.functions.invoke("asaas-cancel-trial", { body: {} });
  if (error) {
    const { message } = await functionErrorMessage(error, "Não foi possível cancelar o teste");
    throw new Error(message);
  }
  return data as { acesso_ate: string };
}
