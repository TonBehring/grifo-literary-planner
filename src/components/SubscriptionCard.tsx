import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  cancelTrial,
  createSubscriptionCheckout,
  getMySubscription,
  hasActiveAccess,
  isInTrial,
} from "@/lib/subscription";
import { getTrialCampaign, peekPendingCampaign } from "@/lib/trial-campaign";

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function valorBr(v: number | string | null | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;
}

// Card "Assinatura" de Minha conta: assinar (com teste grátis quando a
// pessoa chegou por um convite), ver o teste em andamento e cancelá-lo.
export function SubscriptionCard() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"card" | "pix" | null>(null);
  const [cancelarAberto, setCancelarAberto] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [slugCampanha, setSlugCampanha] = useState<string | null>(null);

  useEffect(() => {
    setSlugCampanha(peekPendingCampaign());
  }, []);

  const subscription = useQuery({ queryKey: ["subscription"], queryFn: getMySubscription });
  const campanha = useQuery({
    queryKey: ["trial-campaign", slugCampanha],
    queryFn: () => getTrialCampaign(slugCampanha!),
    enabled: Boolean(slugCampanha),
  });

  async function subscribe(method: "card" | "pix") {
    setBusy(method);
    try {
      const url = await createSubscriptionCheckout(method);
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível iniciar a assinatura");
      setSlugCampanha(peekPendingCampaign());
      setBusy(null);
    }
  }

  async function confirmarCancelamento() {
    setCancelando(true);
    try {
      await cancelTrial();
      toast.success("Teste cancelado. Você não será cobrado.");
      setCancelarAberto(false);
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível cancelar o teste");
    } finally {
      setCancelando(false);
    }
  }

  const sub = subscription.data;
  const active = hasActiveAccess(sub);
  const emTeste = isInTrial(sub);
  const testeCancelado = emTeste && sub?.status === "canceled";
  const oferta = campanha.data; // convite válido guardado no navegador
  const valor = valorBr(sub?.charged_value);

  return (
    <div className="panel-cream mt-6 rounded-2xl p-5">
      <h2 className="font-display text-xl">Assinatura</h2>

      {subscription.isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Carregando…</p>
      ) : emTeste && sub?.trial_until ? (
        testeCancelado ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Teste grátis cancelado. Você continua com acesso até {dataHora(sub.trial_until)} e não
            será cobrado.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm">
              Teste grátis até <strong>{dataHora(sub.trial_until)}</strong>.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nessa data acontece a primeira cobrança no cartão
              {valor ? ` (${valor} por ano)` : ""}. Se não quiser continuar, cancele antes e não paga
              nada.
            </p>
            <button
              onClick={() => setCancelarAberto(true)}
              className="mt-4 text-sm font-medium text-[#85651C] underline underline-offset-4"
            >
              Cancelar teste grátis
            </button>
            <AlertDialog open={cancelarAberto} onOpenChange={setCancelarAberto}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar teste grátis?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A cobrança no cartão não vai acontecer. Você continua usando o Grifo até{" "}
                    {dataHora(sub.trial_until)}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={cancelando}>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={cancelando}
                    onClick={(e) => {
                      e.preventDefault();
                      void confirmarCancelamento();
                    }}
                  >
                    {cancelando ? "Cancelando…" : "Cancelar teste"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )
      ) : active ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            {sub?.provider === "cortesia" ? "Acesso de cortesia" : "Assinatura ativa"} até{" "}
            {new Date(sub!.current_period_end as string).toLocaleDateString("pt-BR")}.
          </p>
          {sub?.provider === "mercado_pago" && (
            <button
              onClick={() => void subscribe("card")}
              disabled={busy !== null}
              className="mt-4 text-sm text-[#85651C] underline underline-offset-4 disabled:opacity-60"
            >
              {busy === "card" ? "Abrindo checkout…" : "Gerenciar / renovar assinatura"}
            </button>
          )}
        </>
      ) : oferta ? (
        <>
          <div className="mt-3 flex items-start gap-3 rounded-xl bg-primary/10 p-3">
            <Gift className="mt-0.5 h-5 w-5 shrink-0 text-[#85651C]" />
            <div>
              <p className="text-sm font-medium">
                Você ganhou {oferta.dias} dias grátis pelo convite de {oferta.nome}.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre o cartão agora e só pague depois de {oferta.dias} dias. Cancele antes, aqui
                mesmo, e não paga nada.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => void subscribe("card")}
              disabled={busy !== null}
              className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy === "card" ? "Abrindo pagamento…" : `Começar ${oferta.dias} dias grátis no cartão`}
            </button>
            <button
              onClick={() => void subscribe("pix")}
              disabled={busy !== null}
              className="w-full rounded-xl border border-primary/40 py-3 text-sm font-medium text-[#85651C] disabled:opacity-60"
            >
              {busy === "pix" ? "Abrindo pagamento…" : "Pagar agora com Pix"}
            </button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              O teste grátis é só no cartão, que renova sozinho todo ano. No Pix o pagamento é na
              hora e vale 1 ano, sem renovação automática.
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Você ainda não tem uma assinatura ativa.</p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => void subscribe("pix")}
              disabled={busy !== null}
              className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy === "pix" ? "Abrindo pagamento…" : "Pagar com Pix"}
            </button>
            <button
              onClick={() => void subscribe("card")}
              disabled={busy !== null}
              className="w-full rounded-xl border border-primary/40 py-3 text-sm font-medium text-[#85651C] disabled:opacity-60"
            >
              {busy === "card" ? "Abrindo pagamento…" : "Pagar com cartão"}
            </button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Pix: pagamento anual, sem renovação automática. Cartão: renova sozinho todo ano.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
