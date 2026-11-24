import { useEffect, useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateClubReadCard, type ClubReadCardInput } from "@/lib/club-read-card";

const FILE_NAME = "grifo-eu-li-com-o-clube.png";

// Botão + janela para compartilhar o card "Eu li ... com o clube ... no Grifo".
export function ShareClubReadDialog({ input }: { input: ClubReadCardInput }) {
  const [open, setOpen] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBlob(null);
    setError(false);
    generateClubReadCard(input)
      .then((b) => {
        if (!cancelled) setBlob(b);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attempt]);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  function download() {
    if (!url) return;
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      window.open(url, "_blank");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = FILE_NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function share() {
    if (!blob) return;
    const file = new File([blob], FILE_NAME, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Eu li ${input.titulo}`,
          text: `Eu li ${input.titulo} com o clube ${input.clube} no Grifo: useogrifo.app`,
        });
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") download();
      }
    } else {
      download();
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="w-fit gap-1.5">
        <Share2 className="h-4 w-4" />
        Compartilhar que li
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Compartilhar leitura</DialogTitle>
            <DialogDescription>Uma imagem no formato dos stories, pronta para Instagram e WhatsApp.</DialogDescription>
          </DialogHeader>
          {error ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm">Não foi possível gerar a imagem. Tente de novo.</p>
              <Button onClick={() => setAttempt((a) => a + 1)}>Tentar de novo</Button>
            </div>
          ) : !url ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando imagem…
            </div>
          ) : (
            <>
              <img
                src={url}
                alt={`Eu li ${input.titulo} com o clube ${input.clube}`}
                className="mx-auto max-h-[60vh] w-auto rounded-lg border object-contain"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1 gap-1.5" onClick={share}>
                  <Share2 className="h-4 w-4" />
                  Compartilhar
                </Button>
                <Button variant="outline" className="flex-1 gap-1.5" onClick={download}>
                  <Download className="h-4 w-4" />
                  Baixar imagem
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
