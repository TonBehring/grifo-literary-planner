import { Check, Copy, MoreVertical, PlusSquare, Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { InstallPlatform } from "@/lib/install";

export function InstallInstructions({ open, onOpenChange, platform, iosOtherBrowser }: {
  open: boolean; onOpenChange: (open: boolean) => void; platform: InstallPlatform; iosOtherBrowser: boolean;
}) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText("https://useogrifo.app");
      toast.success("Link copiado!");
    } catch { toast.error("Não foi possível copiar o link. Tente novamente."); }
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="contact-theme max-h-[85dvh] overflow-y-auto border-contact-detail bg-contact-surface pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-contact-heading motion-reduce:animate-none motion-reduce:transition-none">
        <div className="mx-auto max-w-lg space-y-5">
          <SheetTitle className="pr-7 font-display text-2xl">{platform === "inapp" ? "Abra no navegador" : "Instale o Grifo"}</SheetTitle>
          <SheetDescription className="sr-only">Instalação do Grifo na tela inicial</SheetDescription>
          {platform === "ios" ? <>
            <ol className="space-y-5 text-sm leading-relaxed">
              <li className="flex gap-3"><Share className="size-6 shrink-0 text-contact-action" /><span>1. Toque em Compartilhar na barra do Safari.</span></li>
              <li className="flex gap-3"><PlusSquare className="size-6 shrink-0 text-contact-action" /><span>2. Role e toque em “Adicionar à Tela de Início”.</span></li>
              <li className="flex gap-3"><Check className="size-6 shrink-0 text-contact-action" /><span>3. Toque em “Adicionar”.</span></li>
            </ol>
            {iosOtherBrowser && <p className="text-sm text-muted-foreground">No iPhone, funciona melhor pelo Safari.</p>}
          </> : platform === "inapp" ? <>
            <p className="text-sm leading-relaxed">Toque nos três pontinhos (⋯ ou ⋮) no canto da tela e escolha Abrir no navegador. Depois é só instalar por lá.</p>
            <Button onClick={() => void copyLink()} className="bg-contact-action text-contact-surface hover:bg-contact-action/90"><Copy />Copiar link</Button>
          </> : <p className="flex gap-3 text-sm leading-relaxed"><MoreVertical className="size-6 shrink-0 text-contact-action" /><span>Toque no menu ⋮ do navegador e escolha Instalar app ou Adicionar à tela inicial.</span></p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}