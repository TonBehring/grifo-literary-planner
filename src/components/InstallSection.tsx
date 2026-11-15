import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InstallInstructions } from "@/components/InstallInstructions";
import { useInstallPrompt } from "@/lib/install";

export function InstallSection() {
  const install = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function activate() {
    if ((install.platform === "android" || install.platform === "desktop") && install.canPrompt) {
      setBusy(true);
      try {
        if (await install.promptInstall() === "unavailable") setOpen(true);
      } catch { toast.error("Não foi possível instalar agora. Tente novamente."); }
      finally { setBusy(false); }
    } else setOpen(true);
  }
  return <section className="mt-6 border-y border-border py-5">
    <h2 className="font-display text-xl">App no celular</h2>
    {install.standalone ? <p className="mt-2 text-sm text-muted-foreground">Você já está usando o Grifo instalado ✅</p> : <>
      <p className="mt-2 text-sm text-muted-foreground">Instale o Grifo na tela inicial para abrir mais rápido e receber lembretes.</p>
      {install.ready && (install.platform !== "desktop" || install.canPrompt) ? <Button className="mt-4" disabled={busy} onClick={() => void activate()}><Download />{busy ? "Instalando…" : "Instalar o app"}</Button>
        : install.ready && <p className="mt-3 text-sm text-muted-foreground">No computador, procure o ícone de instalar na barra de endereço do navegador.</p>}
    </>}
    <InstallInstructions open={open && !install.standalone} onOpenChange={setOpen} platform={install.platform} iosOtherBrowser={install.iosOtherBrowser} />
  </section>;
}