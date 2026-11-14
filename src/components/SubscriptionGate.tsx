import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMySubscription, hasActiveAccess } from "@/lib/subscription";

export function useHasActiveSubscription() {
  const { data, isLoading } = useQuery({ queryKey: ["subscription"], queryFn: getMySubscription });
  return { active: hasActiveAccess(data), loading: isLoading };
}

export function SubscriptionRequiredNotice({ action }: { action: string }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
      <p>Isso faz parte da assinatura. Sua estante continua gratuita.</p>
      <p className="mt-1">Assine para {action}.</p>
      <Link
        to="/conta"
        className="mt-3 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Assinar
      </Link>
    </div>
  );
}
