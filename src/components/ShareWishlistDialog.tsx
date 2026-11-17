import { useEffect, useState } from "react";
import { Share2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { UserBook } from "@/lib/types";
import { firstName, generateWishlistCard, toCardBooks } from "@/lib/wishlist-card";

const FILE_NAME = "grifo-quero-comprar.png";

async function resolveName(user: { id: string; user_metadata?: Record<string, unknown> } | null) {
  if (!user) return "";
  try {
    const { data } = await supabase.from("profiles").select("nome_exibicao").eq("id", user.id).maybeSingle();
    const n = (data as { nome_exibicao?: string | null } | null)?.nome_exibicao;
    if (n?.trim()) return firstName(n);
  } catch {
    /* fallback below */
  }
  const m = user.user_metadata ?? {};
  const raw = [m["nome"], m["name"], m["full_name"]].find((v) => typeof v === "string" && v.trim());
  return firstName(raw as string | undefined);
}

export function ShareWishlistDialog({ books }: { books: UserBook[] }) {
  const { user } = useAuth();
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
    (async () => {
      try {
        const nome = await resolveName(user as never);
        const b = await generateWishlistCard({ nome, livros: toCardBooks(books) });
        if (!cancelled) setBlob(b);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, attempt, books, user]);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  async function share() {
    if (!blob) return;
    const file = new File([blob], FILE_NAME, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Minha lista Quero comprar",
          text: "Minha lista de desejos no Grifo: useogrifo.app",
        });
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") download();
      }
    } else {
      download();
    }
  }

  function download() {
    if (!url) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
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

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="w-fit gap-1.5">
        <Share2 className="h-4 w-4" />
        Compartilhar lista
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Compartilhar lista</DialogTitle>
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
                alt="Pré-visualização da lista Quero comprar"
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
