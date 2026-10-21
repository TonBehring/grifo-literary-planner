// Tag do Google Ads (medição de conversões da campanha de captação).
// Rota escolhida: banner regional com Consent Mode avançado — a tag carrega
// sempre, mas respeita os sinais de consentimento definidos em consent.ts e
// no script de padrões de consentimento em __root.tsx.

import { canTrackAds, updateConsent } from "./consent";

const GOOGLE_ADS_ID = "AW-18528072528";
const SIGNUP_CONVERSION = "AW-18528072528/SBFlCIiXlqQdENDm74JF";

export async function loadGoogleAds() {
  const allowed = await canTrackAds();
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function () {
      window.dataLayer.push(arguments);
    };
  updateConsent(allowed ? "granted" : "denied");
  if (document.querySelector("script[data-google-ads]")) return;
  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ADS_ID);
  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
  script.async = true;
  script.dataset.googleAds = "";
  document.head.appendChild(script);
}

// Dispara a conversão "Cadastro concluído" quando uma conta é criada.
export async function reportSignupConversion() {
  await loadGoogleAds();
  window.gtag?.("event", "conversion", {
    send_to: SIGNUP_CONVERSION,
    value: 1.0,
    currency: "BRL",
  });
}
