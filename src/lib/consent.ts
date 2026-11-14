// Consentimento de rastreamento publicitário (Google Ads).
// Visitantes de regiões que exigem consentimento (UE, Reino Unido, Suíça,
// Quebec) veem o banner; nas demais regiões o rastreamento fica ativo.

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const STORAGE_KEY = "cookie_consent";

const CONSENT_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH", "CA",
];

let consentRegion: Promise<boolean> | undefined;

export function isConsentRequiredRegion(): Promise<boolean> {
  return (consentRegion ??= lookupConsentRegion());
}

async function lookupConsentRegion(): Promise<boolean> {
  try {
    const res = await fetch("/cdn-cgi/trace", { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return true;
    const country = (await res.text()).match(/^loc=([A-Z0-9]{2})$/m)?.[1];
    if (!country || country === "XX" || country === "T1") return true;
    return CONSENT_COUNTRIES.includes(country);
  } catch {
    return true;
  }
}

export async function hasAdConsent(): Promise<boolean> {
  return localStorage.getItem(STORAGE_KEY) === "granted";
}

export async function canTrackAds(): Promise<boolean> {
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return false;
  const choice = localStorage.getItem(STORAGE_KEY);
  if (choice !== null) return choice === "granted";
  const required = await isConsentRequiredRegion();
  const latest = localStorage.getItem(STORAGE_KEY);
  return latest !== null ? latest === "granted" : !required;
}

export function updateConsent(decision: "granted" | "denied") {
  if (decision === "denied") window.gtag?.("set", "user_data", null);
  window.gtag?.("consent", "update", {
    ad_storage: decision,
    ad_user_data: decision,
    ad_personalization: decision,
  });
}

const AD_CONSENT_EVENT = "grifo:ad-consent-change";

export function saveAdConsent(decision: "granted" | "denied") {
  localStorage.setItem(STORAGE_KEY, decision);
  updateConsent(decision);
  window.dispatchEvent(new CustomEvent(AD_CONSENT_EVENT, { detail: decision }));
}

export function onAdConsentChange(listener: (granted: boolean) => void): () => void {
  const onLocalChoice = (event: Event) => {
    listener((event as CustomEvent<"granted" | "denied">).detail === "granted");
  };
  const onOtherTab = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener(event.newValue === "granted");
  };
  window.addEventListener(AD_CONSENT_EVENT, onLocalChoice);
  window.addEventListener("storage", onOtherTab);
  return () => {
    window.removeEventListener(AD_CONSENT_EVENT, onLocalChoice);
    window.removeEventListener("storage", onOtherTab);
  };
}
