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
      Sua assinatura não está ativa. Você continua vendo tudo que já registrou, mas {action} exige
      uma assinatura ativa.{" "}
      <Link to="/conta" className="font-medium text-primary underline underline-offset-4">
        Assinar o Grifo
      </Link>
    </div>
  );
}
