import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { clubMemberDisplayName, type ClubMember } from "@/lib/api";
import { encerrarEnquete, getEnquete, votarEnquete } from "@/lib/club-polls";

type ConfirmFn = (opts: { title: string; description?: string }) => Promise<boolean>;

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Enquete dentro de um post do mural. Resultado e nomes de quem votou só
// aparecem depois do voto (ou quando a enquete encerra).
export function ClubPoll({
  postId,
  autorId,
  userId,
  souAdmin,
  memberByUserId,
  confirm,
}: {
  postId: string;
  autorId: string;
  userId: string;
  souAdmin: boolean;
  memberByUserId: Map<string, ClubMember>;
  confirm: ConfirmFn;
}) {
  const queryClient = useQueryClient();
  const poll = useQuery({ queryKey: ["club-poll", postId], queryFn: () => getEnquete(postId) });
  const [escolha, setEscolha] = useState<string[] | null>(null);
  const [verNomes, setVerNomes] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const p = poll.data;
  if (poll.isLoading) return <p className="mt-2 text-xs text-muted-foreground">Carregando enquete…</p>;
  if (!p) return null;

  const votando = !p.encerrada && (escolha !== null || !p.revelado);
  const selecionadas = escolha ?? p.meus_votos;
  const podeEncerrar = !p.encerrada && (autorId === userId || souAdmin);

  function alternar(optionId: string) {
    const atual = escolha ?? p!.meus_votos;
    if (p!.multipla) {
      setEscolha(atual.includes(optionId) ? atual.filter((x) => x !== optionId) : [...atual, optionId]);
    } else {
      setEscolha([optionId]);
    }
  }

  async function enviar(ids: string[]) {
    setSalvando(true);
    try {
      await votarEnquete(postId, ids);
      setEscolha(null);
      await queryClient.invalidateQueries({ queryKey: ["club-poll", postId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível votar");
    } finally {
      setSalvando(false);
    }
  }

  async function encerrar() {
    if (!(await confirm({ title: "Encerrar enquete?", description: "Ninguém mais vai poder votar e o resultado aparece para todos." }))) return;
    try {
      await encerrarEnquete(postId);
      await queryClient.invalidateQueries({ queryKey: ["club-poll", postId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível encerrar");
    }
  }

  const nomeDe = (uid: string) => {
    if (uid === userId) return "você";
    const m = memberByUserId.get(uid);
    return m ? clubMemberDisplayName(m) : "alguém";
  };
  const maior = Math.max(1, ...p.opcoes.map((o) => o.votos ?? 0));

  return (
    <div className="mt-3">
      {votando ? (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {p.multipla ? "Escolha uma ou mais opções" : "Escolha uma opção"}
          </p>
          <div className="flex flex-col gap-2" role={p.multipla ? "group" : "radiogroup"}>
            {p.opcoes.map((o) => {
              const marcada = selecionadas.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  role={p.multipla ? "checkbox" : "radio"}
                  aria-checked={marcada}
                  onClick={() => alternar(o.id)}
                  className={
                    "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors " +
                    (marcada ? "border-primary bg-primary/10" : "border-border")
                  }
                >
                  <span
                    className={
                      "flex h-4 w-4 shrink-0 items-center justify-center border " +
                      (p.multipla ? "rounded " : "rounded-full ") +
                      (marcada ? "border-primary bg-primary text-primary-foreground" : "border-border")
                    }
                  >
                    {marcada && <Check className="h-3 w-3" />}
                  </span>
                  {o.texto}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void enviar(selecionadas)}
              disabled={salvando || selecionadas.length === 0}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Votar"}
            </button>
            {escolha !== null && p.revelado && (
              <button type="button" onClick={() => setEscolha(null)} className="text-xs text-muted-foreground underline underline-offset-4">
                Cancelar
              </button>
            )}
            {escolha !== null && p.meus_votos.length > 0 && (
              <button
                type="button"
                onClick={() => void enviar([])}
                disabled={salvando}
                className="text-xs text-muted-foreground underline underline-offset-4"
              >
                Tirar meu voto
              </button>
            )}
          </div>
          {!p.revelado && <p className="mt-2 text-xs text-muted-foreground">O resultado aparece depois que você votar.</p>}
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {p.opcoes.map((o) => {
            const votos = o.votos ?? 0;
            const pct = p.total_votantes > 0 ? Math.round((votos / p.total_votantes) * 100) : 0;
            const minha = p.meus_votos.includes(o.id);
            const vencedora = votos > 0 && votos === maior;
            return (
              <div key={o.id}>
                <div className="relative overflow-hidden rounded-xl border border-border px-3 py-2.5">
                  <span
                    aria-hidden
                    className={"absolute inset-y-0 left-0 " + (vencedora ? "bg-primary/30" : "bg-primary/15")}
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {minha && <Check className="h-3.5 w-3.5 shrink-0 text-[#85651C]" aria-label="Seu voto" />}
                      <span className={vencedora ? "font-medium" : ""}>{o.texto}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {pct}% · {votos}
                    </span>
                  </span>
                </div>
                {verNomes && (o.votantes ?? []).length > 0 && (
                  <p className="mt-1 px-1 text-xs text-muted-foreground">{(o.votantes ?? []).map(nomeDe).join(", ")}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          {p.total_votantes} {p.total_votantes === 1 ? "pessoa votou" : "pessoas votaram"}
        </span>
        {p.encerrada ? (
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3 w-3" /> Encerrada
          </span>
        ) : (
          p.encerra_em && <span>Encerra em {dataCurta(p.encerra_em)}</span>
        )}
        {!votando && p.revelado && p.total_votantes > 0 && (
          <button type="button" onClick={() => setVerNomes((v) => !v)} className="underline underline-offset-4">
            {verNomes ? "Esconder quem votou" : "Ver quem votou"}
          </button>
        )}
        {!votando && !p.encerrada && (
          <button type="button" onClick={() => setEscolha(p.meus_votos)} className="font-medium text-[#85651C] underline underline-offset-4">
            Mudar voto
          </button>
        )}
        {podeEncerrar && (
          <button type="button" onClick={() => void encerrar()} className="underline underline-offset-4">
            Encerrar enquete
          </button>
        )}
      </div>
    </div>
  );
}
