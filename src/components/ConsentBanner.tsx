import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  STORAGE_KEY,
  isConsentRequiredRegion,
  updateConsent,
} from "@/lib/consent";

// Banner de consentimento de rastreamento publicitário. Só aparece para
// visitantes de regiões que exigem consentimento (UE, Reino Unido, Suíça,
// Quebec) e que ainda não fizeram uma escolha. Aceitar e recusar têm o
// mesmo peso visual, e a escolha pode ser alterada depois.
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== null) return;
    let cancelled = false;
    void isConsentRequiredRegion().then((required) => {
      if (!cancelled && required && localStorage.getItem(STORAGE_KEY) === null) {
        setVisible(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function choose(decision: "granted" | "denied") {
    localStorage.setItem(STORAGE_KEY, decision);
    updateConsent(decision);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4"
    >
      <div className="panel-cream mx-auto max-w-lg rounded-2xl border border-border p-5 shadow-lg">
        <h2 id="consent-title" className="font-display text-lg">
          Cookies de medição
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Usamos cookies do Google Ads para medir se nossos anúncios trazem
          novos leitores ao Grifo. Você pode aceitar ou recusar — o app
          funciona igual nos dois casos. Detalhes na{" "}
          <Link to="/privacidade" className="text-primary underline underline-offset-4">
            Política de Privacidade
          </Link>
          .
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
