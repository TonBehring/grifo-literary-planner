import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
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
import { listBookReadings, rereadBook } from "@/lib/readings";

function data(iso: string | null): string {
  return iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "?";
}

// Período de uma leitura, sem "?" quando faltam datas (ex.: livro cadastrado
// como lido sem informar quando foi lido).
function periodo(inicio: string | null, fim: string | null): string {
  if (inicio && fim) return `${data(inicio)} a ${data(fim)}`;
  if (fim) return `concluída em ${data(fim)}`;
  if (inicio) return `iniciada em ${data(inicio)}`;
  return "datas não registradas";
}

function vezes(n: number): string {
  return n === 1 ? "1 vez" : `${n} vezes`;
}

// Página do livro: histórico de leituras ("Lido 2 vezes") e botão "Reler".
export function RereadSection({
  userBookId,
  status,
  startedAt,
  finishedAt,
  subscriptionActive,
  onChanged,
}: {
  userBookId: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  subscriptionActive: boolean;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const readings = useQuery({
    queryKey: ["book-readings", userBookId],
    queryFn: () => listBookReadings(userBookId),
  });
  const [confirmar, setConfirmar] = useState(false);
  const [relendo, setRelendo] = useState(false);

  const anteriores = readings.data ?? [];
  const lido = status === "lido";
  if (!lido && anteriores.length === 0) return null;

  const totalConcluidas = anteriores.length + (lido ? 1 : 0);

  async function reler() {
    setRelendo(true);
    try {
      await rereadBook(userBookId);
      toast.success("Boa releitura! O livro voltou para Lendo.");
      setConfirmar(false);
      void queryClient.invalidateQueries({ queryKey: ["book-readings", userBookId] });
      void queryClient.invalidateQueries({ queryKey: ["user_books"] });
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível reler agora");
    } finally {
      setRelendo(false);
    }
  }

  return (
    <div className="panel-cream rounded-2xl p-5">
      <h2 className="font-display text-xl">Suas leituras</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {totalConcluidas > 0 ? `Lido ${vezes(totalConcluidas)}.` : ""}
        {!lido && " Você está relendo este livro."}
      </p>

      <ol className="mt-3 flex flex-col gap-1.5 text-sm">
        {anteriores.map((r, i) => (
          <li key={r.id} className="text-muted-foreground">
            <span className="font-medium text-foreground">{i + 1}ª leitura:</span>{" "}
            {periodo(r.data_inicio, r.data_conclusao)}
          </li>
        ))}
        <li className="text-muted-foreground">
          <span className="font-medium text-foreground">{anteriores.length + 1}ª leitura:</span>{" "}
          {lido
            ? periodo(startedAt, finishedAt)
            : startedAt
              ? `desde ${data(startedAt)} (em andamento)`
              : "em andamento"}
        </li>
      </ol>

      {lido &&
        (subscriptionActive ? (
          <button
            type="button"
            onClick={() => setConfirmar(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#85651C]/50 py-3 text-sm font-medium text-[#85651C]"
          >
            <RotateCcw className="h-4 w-4" />
            Reler este livro
          </button>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Quer ler de novo e registrar a nova leitura?{" "}
            <Link to="/conta" className="font-medium text-[#85651C] underline underline-offset-4">
              Assine o Grifo
            </Link>
            .
          </p>
        ))}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reler este livro?</AlertDialogTitle>
            <AlertDialogDescription>
              O livro volta para "Lendo", começando do início. A leitura anterior fica guardada no
              histórico e continua contando nas suas estatísticas. Suas anotações, citações, nota e
              resenha continuam aqui.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={relendo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={relendo}
              onClick={(e) => {
                e.preventDefault();
                void reler();
              }}
            >
              {relendo ? "Salvando…" : "Reler"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
