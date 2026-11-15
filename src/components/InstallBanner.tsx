import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InstallInstructions } from "@/components/InstallInstructions";
import { dismissInstall, installDismissed, useInstallPrompt } from "@/lib/install";

const excluded = new Set(["/auth", "/confirmar", "/redefinir-senha", "/assinatura/retorno"]);

export function InstallBanner({ userId, pathname, dialogOpen }: { userId: string; pathname: string; dialogOpen: boolean }) {
  const install = useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const banner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { if (installDismissed(window.localStorage)) return; } catch { /* Disabled storage. */ }
    const timer = window.setTimeout(() => setVisible(true), 5000);
    return () => window.clearTimeout(timer);
  }, [userId]);

  const show = visible && install.ready && !install.standalone && install.platform !== "desktop"
    && !excluded.has(pathname.replace(/\/$/, "")) && !dialogOpen;

  useEffect(() => {
    if (!show) return;
    const navigation = document.querySelector("[data-install-navigation]");
    if (!navigation) return;
    const resize = () => banner.current?.style.setProperty("bottom", `${navigation.getBoundingClientRect().height}px`);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(navigation);
    return () => observer.disconnect();
  }, [show]);

  useEffect(() => {
    if (dialogOpen || install.standalone) setSheetOpen(false);
  }, [dialogOpen, install.standalone]);

  function dismiss() {
    try { dismissInstall(window.localStorage); } catch { /* Still hide. */ }
    setVisible(false);
    setSheetOpen(false);
  }

  async function activate() {
    if (install.platform !== "android" || !install.canPrompt) { setSheetOpen(true); return; }
    setBusy(true);
    try {
      const outcome = await install.promptInstall();
      if (outcome === "accepted") setVisible(false);
      if (outcome === "unavailable") setSheetOpen(true);
    } catch { toast.error("Não foi possível instalar agora. Tente novamente."); }
    finally { setBusy(false); }
  }

  return <>
    {show && <div ref={banner} role="region" aria-label="Instalar Grifo" className="contact-theme fixed inset-x-0 bottom-0 z-30 border-t border-contact-detail bg-contact-action text-contact-surface">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{install.platform === "inapp" ? "Para instalar o Grifo, abra no navegador" : "Tenha o Grifo na tela inicial"}</p>
          <Button size="sm" disabled={busy} onClick={() => void activate()} className="mt-2 bg-contact-detail text-contact-heading hover:bg-contact-detail/90">
            {busy ? "Instalando…" : install.platform === "inapp" ? "Como fazer" : install.platform === "android" && install.canPrompt ? "Instalar" : "Como instalar"}
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={dismiss} title="Agora não" aria-label="Agora não" className="shrink-0 self-start text-contact-surface hover:bg-contact-surface/10 hover:text-contact-surface"><X /></Button>
      </div>
    </div>}
    <InstallInstructions open={sheetOpen} onOpenChange={setSheetOpen} platform={install.platform} iosOtherBrowser={install.iosOtherBrowser} />
  </>;
}