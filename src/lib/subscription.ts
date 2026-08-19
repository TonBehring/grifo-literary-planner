import { supabase } from "@/integrations/supabase/client";

export type Subscription = {
  provider: "mercado_pago" | "cortesia";
  status: string;
  current_period_end: string | null;
};

export async function getMySubscription(): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("provider, status, current_period_end")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Subscription | null) ?? null;
}

export function hasActiveAccess(sub: Subscription | null | undefined): boolean {
  if (!sub?.current_period_end) return false;
  return new Date(sub.current_period_end).getTime() > Date.now();
}

export async function createSubscriptionCheckout(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("mp-create-subscription");
  if (error) throw new Error(error.message);
  const payload = data as { checkout_url?: string; error?: string } | null;
  if (!payload?.checkout_url) {
    throw new Error(payload?.error ?? "Não foi possível iniciar a assinatura");
  }
  return payload.checkout_url;
}
