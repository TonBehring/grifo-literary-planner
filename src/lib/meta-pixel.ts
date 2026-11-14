import { canTrackAds } from "./consent";

export const META_PIXEL_ID = "1439881227703450";
const PURCHASE_KEY_PREFIX = "grifo_meta_purchase_";

type MetaFbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  push?: MetaFbq;
  version?: string;
};

declare global {
  interface Window {
    fbq?: MetaFbq;
    _fbq?: MetaFbq;
  }
}

let initialized = false;

function ensureFbq(): MetaFbq {
  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue?.push(args);
    }) as MetaFbq;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    window.fbq = fbq;
  }
  window._fbq = window.fbq;
  return window.fbq;
}

export async function loadMetaPixel(): Promise<boolean> {
  if (!(await canTrackAds())) return false;
  const fbq = ensureFbq();
  if (!initialized) {
    // Sem dados de correspondência: nenhum e-mail, nome ou identificador pessoal.
    fbq("init", META_PIXEL_ID, {}, { agent: "lovable" });
    initialized = true;
  }
  fbq("consent", "grant");
  if (!document.querySelector("script[data-meta-pixel]")) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset["metaPixel"] = "";
    document.head.appendChild(script);
  }
  return true;
}

export function revokeMetaPixel(): void {
  window.fbq?.("consent", "revoke");
}

async function track(
  event: "PageView" | "CompleteRegistration" | "Purchase",
  parameters?: Record<string, unknown>,
  eventId?: string,
): Promise<boolean> {
  if (!(await loadMetaPixel())) return false;
  const args: unknown[] = ["track", event];
  if (parameters) args.push(parameters);
  if (eventId) args.push({ eventID: eventId });
  window.fbq?.(...args);
  return true;
}

export async function trackMetaPageView(): Promise<boolean> {
  return track("PageView");
}

export async function reportMetaCompleteRegistration(): Promise<boolean> {
  const eventId = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return track("CompleteRegistration", undefined, eventId);
}

export function metaPurchaseValue(chargedValue: number | string | null | undefined): number {
  if (chargedValue === null || chargedValue === undefined || chargedValue === "") return 43.92;
  const parsed = Number(chargedValue);
  return Number.isFinite(parsed) ? parsed : 43.92;
}

export async function reportMetaPurchase(subscription: {
  id?: string | null;
  current_period_end: string | null;
  charged_value?: number | string | null;
}): Promise<boolean> {
  const subscriptionKey = subscription.id || subscription.current_period_end;
  if (!subscriptionKey) return false;
  const storageKey = `${PURCHASE_KEY_PREFIX}${subscriptionKey}`;
  try {
    if (localStorage.getItem(storageKey)) return false;
  } catch {
    // Sem armazenamento, a tentativa continua e pode se repetir em outra visita.
  }

  const sent = await track(
    "Purchase",
    { value: metaPurchaseValue(subscription.charged_value), currency: "BRL" },
    `grifo-purchase-${subscriptionKey}`,
  );
  if (sent) {
    try {
      localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      // O envio não deve falhar por causa do armazenamento local.
    }
  }
  return sent;
}
