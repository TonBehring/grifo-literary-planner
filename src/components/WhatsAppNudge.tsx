import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WhatsAppForm } from "@/components/WhatsAppForm";
import { dismissWhatsApp, getWhatsApp, whatsappDismissed, whatsappExcluded, whatsappQueryKey } from "@/lib/whatsapp";

export function WhatsAppNudge({ userId, pathname, subscriptionOpen, subscriptionLoading }: {
  userId: string;
  pathname: string;
  subscriptionOpen: boolean;
  subscriptionLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const blocked = useRef(false);
  const handled = useRef(false);
  const profile = useQuery({
    queryKey: whatsappQueryKey(userId), queryFn: () => getWhatsApp(userId),
    enabled: !whatsappExcluded(pathname), retry: false,
  });

  useEffect(() => {
    if (subscriptionOpen) {
      blocked.current = true;
      setOpen(false);
    }
  }, [subscriptionOpen]);

  useEffect(() => {
    if (profile.data?.whatsapp?.trim()) setOpen(false);
    if (whatsappExcluded(pathname) || subscriptionLoading || subscriptionOpen || blocked.current
      || handled.current || !profile.isSuccess || profile.data.whatsapp?.trim()) return;
    try {
      if (whatsappDismissed(window.localStorage)) return;
    } catch { /* Storage may be disabled. */ }
    const timer = window.setTimeout(() => {
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) {
        blocked.current = true;
        return;
      }
      if (!blocked.current && !handled.current) setOpen(true);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [pathname, subscriptionLoading, subscriptionOpen, profile.isSuccess, profile.data?.whatsapp]);

  useEffect(() => {
    if (!open) return;
    const observer = new MutationObserver(() => {
      const other = document.querySelector('[role="dialog"][data-state="open"]:not([data-whatsapp-nudge]), [role="alertdialog"][data-state="open"]');
      if (other) { blocked.current = true; setOpen(false); }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
    return () => observer.disconnect();
  }, [open]);

  function dismiss() {
    handled.current = true;
    try { dismissWhatsApp(window.localStorage); } catch { /* Still close. */ }
    setOpen(false);
  }

  return (
    <Dialog open={open && !subscriptionOpen} onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogContent data-whatsapp-nudge className="contact-theme max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto border-contact-detail/40 bg-contact-surface p-6 text-contact-heading">
        <DialogTitle className="font-display pr-6 text-2xl leading-tight">Vamos manter contato? 📚</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
          Quer receber pelo WhatsApp novidades do Grifo, lembretes de leitura e avisos dos clubes? Deixe seu número aqui.
        </DialogDescription>
        <WhatsAppForm userId={userId} submitLabel="Salvar meu WhatsApp" onSaved={() => { handled.current = true; setOpen(false); }} />
        <Button variant="link" onClick={dismiss} className="text-muted-foreground">Agora não</Button>
      </DialogContent>
    </Dialog>
  );
}