import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  createSubscriptionCheckout,
  hasActiveAccess,
  type Subscription,
} from "@/lib/subscription";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "grifo:subscription-nudge-dismissed-at";
const DAY_MS = 24 * 60 * 60 * 1000;

type OfferStatus = { founder_slots_left: number; is_founder: boolean; launch_window: boolean };

function dismissedRecently(): boolean {
  try {
    const v = window.localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const t = Number(v);
    return Number.isFinite(t) && Date.now() - t < DAY_MS;
  } catch {
    return false;
  }
}

function saveDismiss() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

async function getOfferStatus(): Promise<OfferStatus> {
  const { data, error } = await supabase.rpc("get_offer_status");
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as OfferStatus | null;
  if (!row) throw new Error("sem oferta");
  return row;
}

function offerText(o: OfferStatus): string {
  if (o.is_founder || o.founder_slots_left > 0) {
    let t =
      "Selo de fundador: 20% de desconto para sempre, em todas as renovações. Hoje, o fundador paga R$ 43,92 por ano.";
    if (o.founder_slots_left > 0 && o.founder_slots_left <= 50) t += " Restam poucos selos.";
    return t;
  }
  if (o.launch_window) return "Oferta de lançamento: R$ 43,92 no primeiro ano. Depois, R$ 54,90 por ano.";
  return "R$ 54,90 por ano.";
}

export function SubscriptionNudge({
  subscription,
  loading,
  pathname,
  onOpenChange,
}: {
  subscription: Subscription | null | undefined;
  loading: boolean;
  pathname: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [redirecting, setRedirecting] = useState<"card" | "pix" | null>(null);
  const excluded = pathname === "/conta" || pathname.startsWith("/assinatura/retorno");
  const eligible = !loading && !hasActiveAccess(subscription) && !excluded;

  useEffect(() => {
    if (eligible && !dismissedRecently()) setOpen(true);
    if (!eligible) setOpen(false);
  }, [eligible]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const offer = useQuery({
    queryKey: ["offer-status"],
    queryFn: getOfferStatus,
    enabled: open,
    retry: false,
  });

  const status = subscription?.status ?? null;
  const pending = status === "pending";
  const stepText = !status
    ? "Você ainda não escolheu sua assinatura."
    : pending
      ? "Você começou o pagamento, mas ele não foi concluído. Pode continuar de onde parou."
      : "Sua assinatura não está mais ativa. Renove para voltar a usar tudo.";

  function dismiss() {
    saveDismiss();
    setOpen(false);
  }

  async function subscribe(method: "card" | "pix") {
    setRedirecting(method);
    try {
      const url = await createSubscriptionCheckout(method);
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível iniciar a assinatura");
      setRedirecting(null);
    }
  }

  const steps = [
    { label: "Conta criada", done: true },
    { label: "E-mail confirmado", done: true },
    { label: "Assinatura", done: false },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
      <DialogContent className="panel-cream max-h-[90vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl p-6">
        <DialogTitle className="font-display pr-6 text-2xl leading-tight">
          Falta pouco para usar o Grifo por completo 📚
        </DialogTitle>
        <DialogDescription className="sr-only">Passos para concluir sua assinatura</DialogDescription>

        <ol className="mt-2 space-y-3">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                  s.done
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-primary bg-primary text-primary-foreground",
                )}
              >
                {s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <div>
                <p className={cn("text-sm", s.done ? "text-muted-foreground" : "font-semibold")}>
                  {s.label}
                </p>
                {!s.done && <p className="mt-0.5 text-sm text-muted-foreground">{stepText}</p>}
              </div>
            </li>
          ))}
        </ol>

        {offer.data && (
          <div className="mt-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
            {offerText(offer.data)}
          </div>
        )}

        <div className="mt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void subscribe("pix")}
            disabled={redirecting !== null}
            className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {redirecting === "pix" ? "Abrindo pagamento…" : "Pagar com Pix"}
          </button>
          <button
            type="button"
            onClick={() => void subscribe("card")}
            disabled={redirecting !== null}
            className="w-full rounded-xl border border-primary/40 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:opacity-60"
          >
            {redirecting === "card" ? "Abrindo pagamento…" : "Pagar com cartão"}
          </button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Pix: pagamento anual, sem renovação automática. Cartão: renova sozinho todo ano.
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-xl py-2.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Agora não
          </button>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          O que dá para fazer sem assinatura: montar sua estante, ver o que você já registrou e
          participar de 1 clube de leitura.
        </p>
      </DialogContent>
    </Dialog>
  );
}
