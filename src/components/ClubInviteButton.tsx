import { useState } from "react";
import { Copy, Share2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getClubInviteCode } from "@/lib/api";

const APP_URL = "https://useogrifo.app";

export function inviteMessage(clubNome: string, codigo: string): string {
  return (
    `Vem ler com a gente no clube "${clubNome}" no Grifo! ` +
    `Entre por este link: ${APP_URL}/clubes/entrar?codigo=${codigo} ` +
    `ou use o código ${codigo} em Clubes de Leitura > Entrar em um clube.`
  );
}

// Botão "Convidar": qualquer membro gera (ou reaproveita) o código do clube e
// compartilha pelo WhatsApp, pelo menu de compartilhar do celular ou copiando.
export function ClubInviteButton({
  clubId,
  clubNome,
  className,
}: {
  clubId: string;
  clubNome: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function abrir() {
    setCarregando(true);
    try {
      const c = codigo ?? (await getClubInviteCode(clubId));
      setCodigo(c);
      setAberto(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar o convite");
    } finally {
      setCarregando(false);
    }
  }

  const mensagem = codigo ? inviteMessage(clubNome, codigo) : "";
  const podeCompartilhar = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function compartilhar() {
    try {
      await navigator.share({ text: mensagem });
    } catch {
      // a pessoa fechou o menu de compartilhar
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem);
      toast.success("Convite copiado!");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={carregando}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        }
      >
        <UserPlus className="h-4 w-4" />
        {carregando ? "Gerando…" : "Convidar"}
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar para o clube</DialogTitle>
            <DialogDescription>
              Quem receber o convite entra no "{clubNome}" pelo link ou com o código.
            </DialogDescription>
          </DialogHeader>
          {codigo && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">Código do clube</p>
                <p className="mt-1 text-2xl font-medium tracking-[0.3em]">{codigo}</p>
              </div>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground"
              >
                Enviar pelo WhatsApp
              </a>
              {podeCompartilhar && (
                <button
                  type="button"
                  onClick={compartilhar}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium"
                >
                  <Share2 className="h-4 w-4" />
                  Compartilhar
                </button>
              )}
              <button
                type="button"
                onClick={copiar}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium"
              >
                <Copy className="h-4 w-4" />
                Copiar convite
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
