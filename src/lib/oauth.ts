import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { reportSignupConversion } from "@/lib/google-ads";
import { reportMetaCompleteRegistration } from "@/lib/meta-pixel";
import { getSignupOriginMetadata } from "@/lib/origin";

export const OAUTH_PENDING_KEY = "grifo_oauth_pending";
const NEW_ACCOUNT_MS = 15 * 60 * 1000;
const PENDING_MS = 30 * 60 * 1000;

export function markOAuthPending(now = Date.now()) {
  try {
    localStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify({ ts: now }));
  } catch {
    // Sem armazenamento, a conversão apenas não é medida.
  }
}

export function isGoogleUser(user: User): boolean {
  return user.app_metadata?.provider === "google" ||
    (user.identities ?? []).some((i) => i.provider === "google");
}

export function hasEmailIdentity(user: User): boolean {
  const identities = user.identities ?? [];
  if (identities.length === 0) return user.app_metadata?.provider !== "google";
  return identities.some((i) => i.provider === "email");
}

function readPendingTs(): number | null {
  try {
    const raw = localStorage.getItem(OAUTH_PENDING_KEY);
    if (!raw) return null;
    const ts = Number((JSON.parse(raw) as { ts?: unknown }).ts);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

const processed = new Set<string>();

export async function handleOAuthLogin(user: User, now = Date.now()): Promise<void> {
  if (processed.has(user.id)) return;
  processed.add(user.id);
  try {
    if (!isGoogleUser(user)) return;
    const created = Date.parse(user.created_at ?? "");
    const isNew = Number.isFinite(created) && now - created < NEW_ACCOUNT_MS;

    if (!user.user_metadata?.["terms_accepted_at"]) {
      try {
        await supabase.auth.updateUser({
          data: {
            terms_accepted_at: new Date(now).toISOString(),
            ...(isNew ? getSignupOriginMetadata() : {}),
          },
        });
      } catch {
        // Nunca bloqueia a entrada no app.
      }
    }

    const pendingTs = readPendingTs();
    if (pendingTs !== null) {
      if (isNew && now - pendingTs < PENDING_MS) {
        try {
          void reportSignupConversion();
          void reportMetaCompleteRegistration();
        } catch {
          // Medição opcional.
        }
      }
      try {
        localStorage.removeItem(OAUTH_PENDING_KEY);
      } catch {
        // ignore
      }
    }
  } catch {
    // Nunca bloqueia a entrada no app.
  }
}

/** Só para testes. */
export function resetOAuthProcessed() {
  processed.clear();
}
