import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { addLoan, listLoans, setLoanReturned } from "@/lib/api";
import type { Loan } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/emprestimos")({
  head: () => ({
    meta: [
      { title: "Empréstimos — Grifo" },
      {
        name: "description",
        content: "Controle os livros que você emprestou e os que pegou emprestado, com prazos.",
      },
      { property: "og:title", content: "Empréstimos — Grifo" },
      {
        property: "og:description",
        content: "Quem está com seus livros e quais livros estão com você.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <LoansPage />
    </AppShell>
  ),
});

function LoansPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<Loan["direction"]>("emprestei");
  const [bookTitle, setBookTitle] = useState("");
  const [personName, setPersonName] = useState("");
  const [dueDate, setDueDate] = useState("");

  const { data } = useQuery({
    queryKey: ["loans"],
    queryFn: listLoans,
    enabled: Boolean(user),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      if (!bookTitle.trim() || !personName.trim()) throw new Error("Preencha livro e pessoa");
      await addLoan({
        user_id: user.id,
        direction,
        book_title: bookTitle.trim().slice(0, 200),
        person_name: personName.trim().slice(0, 100),
        due_date: dueDate || null,
        returned: false,
      });
    },
    onSuccess: () => {
      setBookTitle("");
      setPersonName("");
      setDueDate("");
      void queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast.success("Empréstimo registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, returned }: { id: string; returned: boolean }) =>
      setLoanReturned(id, returned),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["loans"] }),
  });

  const lent = (data ?? []).filter((l) => l.direction === "emprestei");
  const borrowed = (data ?? []).filter((l) => l.direction === "peguei");

  return (
    <section>
      <h1 className="font-display text-4xl leading-tight">Empréstimos</h1>

      <div className="panel-cream mt-6 rounded-2xl p-5">
        <div className="flex gap-2">
          {(["emprestei", "peguei"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={
                "flex-1 rounded-full border px-4 py-2 text-sm transition-colors " +
                (direction === d
                  ? "border-primary bg-primary/20"
                  : "border-border text-muted-foreground")
              }
            >
              {d === "emprestei" ? "Emprestei" : "Peguei emprestado"}
            </button>
          ))}
        </div>
        <input
          value={bookTitle}
          onChange={(e) => setBookTitle(e.target.value)}
          maxLength={200}
          placeholder="Título do livro"
          className="mt-3 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <input
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          maxLength={100}
          placeholder={direction === "emprestei" ? "Para quem?" : "De quem?"}
          className="mt-3 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mt-3 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => create.mutate()}
          className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground"
        >
          Registrar
        </button>
      </div>

      <LoanList title="Livros que emprestei" loans={lent} onToggle={toggle.mutate} />
      <LoanList title="Livros que peguei emprestado" loans={borrowed} onToggle={toggle.mutate} />
    </section>
  );
}

function LoanList({
  title,
  loans,
  onToggle,
}: {
  title: string;
  loans: Loan[];
  onToggle: (input: { id: string; returned: boolean }) => void;
}) {
  return (
    <div className="mt-8">
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-3 space-y-3">
        {loans.length === 0 && (
          <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
        )}
        {loans.map((l) => (
          <div key={l.id} className="card-teal flex items-center gap-4 rounded-2xl p-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-display truncate text-lg">{l.book_title}</h3>
              <p className="text-sm opacity-70">
                {l.person_name}
                {l.due_date ? ` · até ${new Date(l.due_date).toLocaleDateString("pt-BR")}` : ""}
              </p>
            </div>
            <button
              onClick={() => onToggle({ id: l.id, returned: !l.returned })}
              className={
                "shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors " +
                (l.returned
                  ? "bg-primary text-primary-foreground"
                  : "border border-white/25 opacity-80")
              }
            >
              {l.returned ? "Devolvido" : "Marcar devolvido"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}