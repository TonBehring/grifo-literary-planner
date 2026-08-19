import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getMySubscription, hasActiveAccess } from "@/lib/subscription";

export const Route = createFileRoute("/assinatura/retorno")({
  head: () => ({ meta: [{ title: "Confirmando assinatura — Grifo" }] }),
  component: () => (
    <AppShell>
      <ReturnPage />
    </AppShell>
  ),
});

function ReturnPage() {
  const [checking, setChecking] = useState(true);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let attempts = 0;
    let cancelled = false;

    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const sub = await getMySubscription();
        if (cancelled) return;
        if (hasActiveAccess(sub)) {
          setConfirmed(true);
          setChecking(false);
          clearInterval(interval);
        } else if (attempts >= 6) {
          setChecking(false);
          clearInterval(interval);
        }
      } catch {
        // ignora e tenta de novo no próximo ciclo
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="pb-6">
      <h1 className="font-display text-4xl leading-tight">Assinatura</h1>
      <div className="panel-cream mt-6 rounded-2xl p-6 text-center">
        {checking ? (
          <p className="text-sm text-muted-foreground">Confirmando seu pagamento…</p>
        ) : confirmed ? (
          <>
            <p className="text-sm">Assinatura confirmada! Já pode aproveitar o Grifo.</p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
            >
              Ir para o Grifo
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Ainda não recebemos a confirmação do pagamento. Isso pode levar alguns minutos —
              confira novamente daqui a pouco em "Minha conta".
            </p>
            <Link to="/conta" className="mt-4 inline-block text-sm text-primary underline underline-offset-4">
              Ir para Minha conta
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
