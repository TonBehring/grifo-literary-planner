import { createFileRoute } from "@tanstack/react-router";
import { ConfirmEmailPage } from "@/components/ConfirmEmailPage";

export const Route = createFileRoute("/confirmar")({
  validateSearch: (search: Record<string, unknown>): { token_hash?: string | undefined; type?: string | undefined } => ({
    token_hash: typeof search['token_hash'] === "string" ? search['token_hash'] : undefined,
    type: typeof search['type'] === "string" ? search['type'] : "email",
  }),
  head: () => ({
    meta: [
      { title: "Confirmar e-mail — Grifo" },
      { name: "description", content: "Confirme seu e-mail para ativar sua conta no Grifo." },
      { property: "og:title", content: "Confirmar e-mail — Grifo" },
      { property: "og:description", content: "Ative sua conta no Grifo confirmando seu e-mail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ConfirmationRoute,
});

function ConfirmationRoute() {
  const { token_hash, type } = Route.useSearch();
  return <ConfirmEmailPage tokenHash={token_hash} type={type} />;
}