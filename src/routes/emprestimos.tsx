import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { addLoan, findUserByEmail, listLoans, listUserBooks, setLoanReturned } from "@/lib/api";
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
  const [userBookId, setUserBookId] = useState("");
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [dueDate, setDueDate] = useState("");

  const { data } = useQuery({
    queryKey: ["loans"],
    queryFn: () => {
      if (!user) throw new Error("Sessão expirada");
      return listLoans(user.id);
    },
    enabled: Boolean(user),
  });

  const { data: shelf } = useQuery({
    queryKey: ["user_books"],
    queryFn: () => listUserBooks(),
    enabled: Boolean(user),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      if (!userBookId || !personName.trim()) throw new Error("Escolha o livro e informe a pessoa");
      const cleanEmail = personEmail.trim();
      const linkedUser = cleanEmail ? await findUserByEmail(cleanEmail) : null;
      await addLoan({
        user_id: user.id,
        linked_user_id: linkedUser?.id ?? null,
        user_book_id: userBookId,
        direction,
        person_name: personName.trim().slice(0, 100),
        due_date: dueDate || null,
        returned: false,
      });
      return { linkedUser, attemptedLink: Boolean(cleanEmail) };
    },
    onSuccess: ({ linkedUser, attemptedLink }) => {
      setUserBookId("");
      setPersonName("");
      setPersonEmail("");
      setDueDate("");
      void queryClient.invalidateQueries({ queryKey: ["loans"] });
      if (linkedUser) {
        toast.success(`Empréstimo vinculado a ${linkedUser.name}`);
      } else if (attemptedLink) {
        toast.warning("Conta não encontrada; o empréstimo foi salvo sem vínculo.");
      } else {
        toast.success("Empréstimo registrado");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, returned }: { id: string; returned: boolean }) =>
      setLoanReturned(id, returned),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["loans"] }),
  });

  const lentActive = (data ?? []).filter((l) => l.direction === "emprestei" && !l.returned);
  const lentReturned = (data ?? []).filter((l) => l.direction === "emprestei" && l.returned);
  const borrowedActive = (data ?? []).filter(
    (l) => l.direction === "peguei_emprestado" && !l.returned,
  );
  const borrowedReturned = (data ?? []).filter(
    (l) => l.direction === "peguei_emprestado" && l.returned,
  );

  return (
    <section>
      <h1 className="font-display text-4xl leading-tight">Empréstimos</h1>

      <div className="panel-cream mt-6 rounded-2xl p-5">
        <div className="flex gap-2">
          {(["emprestei", "peguei_emprestado"] as const).map((d) => (
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
        <select
          value={userBookId}
          onChange={(e) => setUserBookId(e.target.value)}
          aria-label="Livro"
          className="mt-3 w-full rounded-xl border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-primary"
        >
          <option value="">Escolha um livro da sua estante</option>
          {(shelf ?? []).map((ub) => (
            <option key={ub.id} value={ub.id}>
              {ub.book?.title ?? "Sem título"}
            </option>
          ))}
        </select>
        <input
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          maxLength={100}
          placeholder={direction === "emprestei" ? "Para quem?" : "De quem?"}
          className="mt-3 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <input
          type="email"
          value={personEmail}
          onChange={(e) => setPersonEmail(e.target.value)}
          maxLength={254}
          placeholder="E-mail da pessoa (se ela tiver conta no Grifo)"
          aria-label="E-mail da pessoa"
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

      <LoanList
        title="Livros que emprestei"
        activeLoans={lentActive}
        returnedLoans={lentReturned}
        onToggle={toggle.mutate}
      />
      <LoanList
        title="Livros que peguei emprestado"
        activeLoans={borrowedActive}
        returnedLoans={borrowedReturned}
        onToggle={toggle.mutate}
      />
    </section>
  );
}

function LoanList({
  title,
  activeLoans,
  returnedLoans,
  onToggle,
}: {
  title: string;
  activeLoans: Loan[];
  returnedLoans: Loan[];
  onToggle: (input: { id: string; returned: boolean }) => void;
}) {
  const [showReturned, setShowReturned] = useState(false);

  return (
    <div className="mt-8">
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-3 space-y-3">
        {activeLoans.length === 0 && (
          <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
        )}
        {activeLoans.map((l) => (
          <LoanCard key={l.id} loan={l} onToggle={onToggle} />
        ))}
      </div>

      {returnedLoans.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowReturned((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showReturned ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Ver devolvidos ({returnedLoans.length})
          </button>

          {showReturned && (
            <div className="mt-3 space-y-3 opacity-60">
              {returnedLoans.map((l) => (
                <LoanCard key={l.id} loan={l} onToggle={onToggle} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LoanCard({
  loan,
  onToggle,
}: {
  loan: Loan;
  onToggle: (input: { id: string; returned: boolean }) => void;
}) {
  return (
    <div className="card-teal flex items-center gap-4 rounded-2xl p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display truncate text-lg">{loan.book_title}</h3>
          {loan.linked_user_id && (
            <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] text-primary">
              Conta vinculada
            </span>
          )}
        </div>
        <p className="text-sm opacity-70">
          {loan.person_name}
          {loan.due_date ? ` · até ${new Date(loan.due_date).toLocaleDateString("pt-BR")}` : ""}
        </p>
      </div>
      {loan.is_owner ? (
        <button
          onClick={() => onToggle({ id: loan.id, returned: !loan.returned })}
          className={
            "shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors " +
            (loan.returned
              ? "bg-primary text-primary-foreground"
              : "border border-primary/40 opacity-80")
          }
        >
          {loan.returned ? "Devolvido" : "Marcar devolvido"}
        </button>
      ) : (
        <span className="shrink-0 rounded-full border border-primary/30 px-3 py-1.5 text-xs opacity-70">
          {loan.returned ? "Devolvido" : "Em aberto"}
        </span>
      )}
    </div>
  );
}
