// Campanha de teste grátis (ex.: /convite/45paginas). O link guarda a
// campanha no navegador; o checkout de cartão envia a campanha e a função
// asaas-create-subscription confere se a pessoa pode ganhar o teste.

import { supabase } from "@/integrations/supabase/client";

const KEY = "grifo_campanha_teste";
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export type TrialCampaign = {
  slug: string;
  nome: string;
  parceiro: string | null;
  dias: number;
};

type Salvo = { slug: string; em: number; levadoParaConta?: boolean };

function ler(): Salvo | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const salvo = JSON.parse(raw) as Salvo;
    if (!salvo.slug || !salvo.em || Date.now() - salvo.em > VALIDADE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return salvo;
  } catch {
    return null;
  }
}

export function savePendingCampaign(slug: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ slug, em: Date.now() } satisfies Salvo));
  } catch {
    // sem armazenamento: a pessoa ainda pode assinar normalmente
  }
}

export function peekPendingCampaign(): string | null {
  return ler()?.slug ?? null;
}

export function clearPendingCampaign(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}

// Depois do login, o app leva a pessoa uma única vez para "Minha conta".
export function shouldRedirectToAccount(): boolean {
  const salvo = ler();
  return Boolean(salvo && !salvo.levadoParaConta);
}

export function markRedirectedToAccount(): void {
  const salvo = ler();
  if (!salvo) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...salvo, levadoParaConta: true }));
  } catch {
    // ignora
  }
}

export async function getTrialCampaign(slug: string): Promise<TrialCampaign | null> {
  const { data, error } = await supabase
    .from("trial_campaigns")
    .select("slug, nome, parceiro, dias")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TrialCampaign | null) ?? null;
}
