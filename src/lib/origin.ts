export type SignupOrigin = {
  utm_source: string | null;
  utm_campaign: string | null;
  ref: string | null;
  captured_at: string;
};

export const SIGNUP_ORIGIN_KEY = "grifo_origem";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function clean(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 200) : null;
}

function readValidOrigin(storage: Storage, now: number): SignupOrigin | null {
  try {
    const raw = storage.getItem(SIGNUP_ORIGIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SignupOrigin>;
    const capturedAt = typeof parsed.captured_at === "string" ? Date.parse(parsed.captured_at) : NaN;
    if (!Number.isFinite(capturedAt) || now - capturedAt >= THIRTY_DAYS_MS) return null;
    return {
      utm_source: typeof parsed.utm_source === "string" ? parsed.utm_source : null,
      utm_campaign: typeof parsed.utm_campaign === "string" ? parsed.utm_campaign : null,
      ref: typeof parsed.ref === "string" ? parsed.ref : null,
      captured_at: new Date(capturedAt).toISOString(),
    };
  } catch {
    return null;
  }
}

export function captureSignupOrigin(
  search?: string,
  now = Date.now(),
  storage: Storage = window.localStorage,
): SignupOrigin | null {
  const existing = readValidOrigin(storage, now);
  if (existing) return existing;

  const params = new URLSearchParams(search ?? window.location.search);
  if (!params.has("utm_source") && !params.has("utm_campaign") && !params.has("ref")) {
    return null;
  }

  const origin: SignupOrigin = {
    utm_source: clean(params.get("utm_source")),
    utm_campaign: clean(params.get("utm_campaign")),
    ref: clean(params.get("ref")),
    captured_at: new Date(now).toISOString(),
  };

  try {
    storage.setItem(SIGNUP_ORIGIN_KEY, JSON.stringify(origin));
  } catch {
    // Se o armazenamento estiver indisponível, o cadastro continua sem origem.
  }
  return origin;
}

export function getSignupOriginMetadata(
  now = Date.now(),
  storage: Storage = window.localStorage,
): Pick<SignupOrigin, "utm_source" | "utm_campaign" | "ref"> {
  const origin = readValidOrigin(storage, now);
  return {
    utm_source: origin?.utm_source ?? null,
    utm_campaign: origin?.utm_campaign ?? null,
    ref: origin?.ref ?? null,
  };
}
